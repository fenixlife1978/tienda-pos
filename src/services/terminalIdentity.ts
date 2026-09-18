const TERMINAL_ID_KEY = 'omni_terminal_id_v1';
const ORDER_SEQUENCE_KEY = 'omni_order_sequence_v1';
const INVOICE_SEQUENCE_KEY = 'omni_invoice_sequence_v1';

function getOrCreateId(key: string, prefix: string): string {
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  localStorage.setItem(key, id);
  return id;
}

function nextSequence(key: string): number {
  const current = Number(localStorage.getItem(key) || '0');
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return next;
}

export const terminalIdentity = {
  getId(): string {
    return getOrCreateId(TERMINAL_ID_KEY, 'POS');
  },

  nextOrderNumber(): string {
    return `PED-${this.getId()}-${String(nextSequence(ORDER_SEQUENCE_KEY)).padStart(6, '0')}`;
  },

  nextInvoiceNumber(): string {
    return `FACT-${this.getId()}-${String(nextSequence(INVOICE_SEQUENCE_KEY)).padStart(8, '0')}`;
  },
};
