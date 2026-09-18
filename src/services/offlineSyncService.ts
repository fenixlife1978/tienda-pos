import { tursoService } from './tursoService';
import { terminalIdentity } from './terminalIdentity';
import {
  Customer,
  Invoice,
  Order,
  Product,
  ReceivableItem,
  PayableItem,
  Supplier,
  User,
  ProductCategory,
  ProductUnit,
  SystemSettings,
  PurchaseEntry,
} from '../types';

const QUEUE_KEY = 'omni_offline_sync_queue_v1';

export interface OfflineInventoryMovement {
  movementId: string;
  productId: string;
  quantityDelta: number;
  movementType: 'sale' | 'purchase' | 'return' | 'adjustment' | 'transfer_in' | 'transfer_out';
  sourceOperationId: string;
  terminalId: string;
  createdAt: string;
}

export interface OfflineSaleOperation {
  id: string;
  terminalId: string;
  type: 'sale';
  createdAt: string;
  order: Order;
  invoice: Invoice;
  inventoryMovements: OfflineInventoryMovement[];
  receivable?: ReceivableItem;
  customer?: Customer;
}

export type OfflineSnapshotEntity =
  | 'settings'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'orders'
  | 'invoices'
  | 'receivables'
  | 'payables'
  | 'purchaseEntries'
  | 'users'
  | 'categories'
  | 'units';

export interface OfflineSaleReversalOperation {
  id: string;
  terminalId: string;
  type: 'sale_reversal';
  createdAt: string;
  order: Order;
  invoice: Invoice;
  inventoryMovements: OfflineInventoryMovement[];
  receivable?: ReceivableItem;
  customer?: Customer;
}

export interface OfflineInventoryMovementOperation {
  id: string;
  terminalId: string;
  type: 'inventory_movement';
  movement: OfflineInventoryMovement;
  createdAt: string;
}

export interface OfflineSnapshotOperation {
  id: string;
  terminalId: string;
  type: 'snapshot';
  entity: OfflineSnapshotEntity;
  data: unknown;
  createdAt: string;
}

type OfflineOperation =
  | OfflineSaleOperation
  | OfflineSaleReversalOperation
  | OfflineInventoryMovementOperation
  | OfflineSnapshotOperation;

function readQueue(): OfflineOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineOperation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const offlineSyncService = {
  enqueueSale(
    operation: Omit<
      OfflineSaleOperation,
      'id' | 'type' | 'createdAt' | 'terminalId' | 'inventoryMovements'
    > & {
      inventoryMovements: Omit<
        OfflineInventoryMovement,
        'movementId' | 'sourceOperationId' | 'terminalId' | 'createdAt'
      >[];
    }
  ) {
    const queue = readQueue();
    const operationId = crypto.randomUUID();
    const terminalId = terminalIdentity.getId();
    const createdAt = new Date().toISOString();

    const inventoryMovements: OfflineInventoryMovement[] = operation.inventoryMovements.map(
      (movement) => ({
        ...movement,
        movementId: crypto.randomUUID(),
        sourceOperationId: operationId,
        terminalId,
        createdAt,
      })
    );

    queue.push({
      ...operation,
      id: operationId,
      terminalId,
      type: 'sale',
      createdAt,
      inventoryMovements,
    });

    writeQueue(queue);
    return queue.length;
  },

  enqueueSaleReversal(operation: Omit<OfflineSaleReversalOperation, 'id' | 'type' | 'createdAt' | 'terminalId' | 'inventoryMovements'> & {
    inventoryMovements: Omit<OfflineInventoryMovement, 'movementId' | 'sourceOperationId' | 'terminalId' | 'createdAt'>[];
  }) {
    const queue = readQueue();
    const operationId = crypto.randomUUID();
    const terminalId = terminalIdentity.getId();
    const createdAt = new Date().toISOString();
    const inventoryMovements: OfflineInventoryMovement[] = operation.inventoryMovements.map((movement) => ({
      ...movement, movementId: crypto.randomUUID(), sourceOperationId: operationId, terminalId, createdAt,
    }));
    queue.push({ ...operation, id: operationId, terminalId, type: 'sale_reversal', createdAt, inventoryMovements });
    writeQueue(queue);
    return queue.length;
  },

  enqueueInventoryMovement(
    movement: Omit<
      OfflineInventoryMovement,
      'movementId' | 'sourceOperationId' | 'terminalId' | 'createdAt'
    > & {
      sourceOperationId?: string;
    }
  ) {
    const queue = readQueue();
    const operationId = movement.sourceOperationId || crypto.randomUUID();
    const terminalId = terminalIdentity.getId();
    const createdAt = new Date().toISOString();

    queue.push({
      id: operationId,
      terminalId,
      type: 'inventory_movement',
      movement: {
        ...movement,
        movementId: crypto.randomUUID(),
        sourceOperationId: operationId,
        terminalId,
        createdAt,
      },
      createdAt,
    });

    writeQueue(queue);
    return queue.length;
  },

  enqueueSnapshot(entity: OfflineSnapshotEntity, data: unknown) {
    const queue = readQueue().filter(
      (item) => !(item.type === 'snapshot' && item.entity === entity)
    );

    queue.push({
      id: crypto.randomUUID(),
      terminalId: terminalIdentity.getId(),
      type: 'snapshot',
      entity,
      data,
      createdAt: new Date().toISOString(),
    });

    writeQueue(queue);
    return queue.length;
  },

  pendingCount() {
    return readQueue().length;
  },

  async flush(): Promise<{ processed: number; pending: number }> {
    if (!tursoService.isConfigured() || !navigator.onLine) {
      return { processed: 0, pending: readQueue().length };
    }

    const queue = readQueue();
    if (!queue.length) return { processed: 0, pending: 0 };

    let processed = 0;

    for (const operation of queue) {
      try {
        // Ventas y reversos se aplican en una única transacción central.
        // Esto hace que la cantidad de terminales concurrentes sea irrelevante:
        // Turso serializa la escritura y valida el stock contra el valor actual.
        if (operation.type === 'sale') {
          await tursoService.applyOfflineSale({ ...operation, operationId: operation.id });
          writeQueue(readQueue().filter((item) => item.id !== operation.id));
          processed++;
          continue;
        }

        if (operation.type === 'sale_reversal') {
          await tursoService.applySaleReversal({ ...operation, operationId: operation.id });
          writeQueue(readQueue().filter((item) => item.id !== operation.id));
          processed++;
          continue;
        }

        const opStatus = await tursoService.beginSyncOperation({
          operationId: operation.id,
          terminalId: operation.terminalId,
          operationType: operation.type,
          entityId: operation.type === 'inventory_movement' ? operation.movement.movementId : operation.entity,
          payload: operation.type === 'inventory_movement' ? operation.movement : undefined,
        });

        if (opStatus === 'processed') {
          writeQueue(readQueue().filter((item) => item.id !== operation.id));
          processed++;
          continue;
        }

        if (operation.type === 'inventory_movement') {
          await tursoService.applyInventoryMovement(operation.movement);
        }

        if (operation.type === 'snapshot') {
          switch (operation.entity) {
            case 'settings':
              await tursoService.saveSettings(operation.data as SystemSettings);
              break;
            case 'products':
              for (const item of operation.data as Product[]) await tursoService.saveProductMaster(item);
              break;
            case 'customers':
              for (const item of operation.data as Customer[]) await tursoService.saveCustomer(item);
              break;
            case 'suppliers':
              for (const item of operation.data as Supplier[]) await tursoService.saveSupplier(item);
              break;
            case 'orders':
              for (const item of operation.data as Order[]) await tursoService.saveOrder(item);
              break;
            case 'invoices':
              for (const item of operation.data as Invoice[]) await tursoService.saveInvoice(item);
              break;
            case 'receivables':
              for (const item of operation.data as ReceivableItem[]) await tursoService.saveReceivable(item);
              break;
            case 'payables':
              for (const item of operation.data as PayableItem[]) await tursoService.savePayable(item);
              break;
            case 'purchaseEntries':
              for (const item of operation.data as PurchaseEntry[]) await tursoService.savePurchaseEntry(item);
              break;
            case 'users':
              for (const item of operation.data as User[]) await tursoService.saveUser(item);
              break;
            case 'categories':
              for (const item of operation.data as ProductCategory[]) await tursoService.saveCategory(item);
              break;
            case 'units':
              for (const item of operation.data as ProductUnit[]) await tursoService.saveUnit(item);
              break;
          }
        }

        await tursoService.completeSyncOperation(operation.id);
        writeQueue(readQueue().filter((item) => item.id !== operation.id));
        processed++;
      } catch (error) {
        try {
          await tursoService.failSyncOperation(operation.id, error);
        } catch {}
        console.warn('Offline sync paused; operation will be retried:', error);
        break;
      }
    }

    return { processed, pending: readQueue().length };
  },
};
