import { tursoService } from './tursoService';
import { Customer, Invoice, Order, Product, ReceivableItem, PayableItem, Supplier, User, ProductCategory, ProductUnit, SystemSettings } from '../types';

const QUEUE_KEY = 'omni_offline_sync_queue_v1';

export interface OfflineSaleOperation {
  id: string;
  type: 'sale';
  createdAt: string;
  order: Order;
  invoice: Invoice;
  products: Product[];
  receivable?: ReceivableItem;
  customer?: Customer;
}

export type OfflineSnapshotEntity =
  | 'settings' | 'products' | 'customers' | 'suppliers' | 'orders' | 'invoices'
  | 'receivables' | 'payables' | 'users' | 'categories' | 'units';

export interface OfflineSnapshotOperation {
  id: string;
  type: 'snapshot';
  entity: OfflineSnapshotEntity;
  data: unknown;
  createdAt: string;
}

type OfflineOperation = OfflineSaleOperation | OfflineSnapshotOperation;

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
  enqueueSale(operation: Omit<OfflineSaleOperation, 'id' | 'type' | 'createdAt'>) {
    const queue = readQueue();
    queue.push({
      ...operation,
      id: crypto.randomUUID(),
      type: 'sale',
      createdAt: new Date().toISOString(),
    });
    writeQueue(queue);
    return queue.length;
  },

  enqueueSnapshot(entity: OfflineSnapshotEntity, data: unknown) {
    const queue = readQueue().filter((item) => !(item.type === 'snapshot' && item.entity === entity));
    queue.push({
      id: crypto.randomUUID(),
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
        if (operation.type === 'sale') {
          // Save master/customer state first, then the immutable sale documents.
          for (const product of operation.products) {
            await tursoService.saveProduct(product);
          }
          if (operation.customer) {
            await tursoService.saveCustomer(operation.customer);
          }
          await tursoService.saveOrder(operation.order);
          await tursoService.saveInvoice(operation.invoice);
          if (operation.receivable) {
            await tursoService.saveReceivable(operation.receivable);
          }
        }

        if (operation.type === 'snapshot') {
          switch (operation.entity) {
            case 'settings':
              await tursoService.saveSettings(operation.data as SystemSettings);
              break;
            case 'products':
              for (const item of operation.data as Product[]) await tursoService.saveProduct(item);
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

        // Remove only after every write in this operation succeeds.
        const remaining = readQueue().filter((item) => item.id !== operation.id);
        writeQueue(remaining);
        processed++;
      } catch (error) {
        console.warn('Offline sync paused; operation will be retried:', error);
        break;
      }
    }

    return { processed, pending: readQueue().length };
  },
};
