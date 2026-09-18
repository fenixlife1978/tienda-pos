import { tursoService } from './tursoService';
import { Customer, Invoice, Order, Product, ReceivableItem } from '../types';

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

type OfflineOperation = OfflineSaleOperation;

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
