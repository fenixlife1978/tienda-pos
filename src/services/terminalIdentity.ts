const TERMINAL_ID_KEY = 'omni_terminal_id_v1';
const ORDER_SEQUENCE_KEY = 'omni_order_sequence_v1';
const INVOICE_SEQUENCE_KEY = 'omni_invoice_sequence_v1';
const RETURN_SEQUENCE_KEY = 'omni_return_sequence_v1';
const VOID_SEQUENCE_KEY = 'omni_void_sequence_v1';
const CREDIT_NOTE_SEQUENCE_KEY = 'omni_credit_note_sequence_v1';
const RECEIPT_SEQUENCE_KEY = 'omni_receipt_sequence_v1';
const QUOTE_SEQUENCE_KEY = 'omni_quote_sequence_v1';

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

  nextReturnNumber(): string { return `DEV-${this.getId()}-${String(nextSequence(RETURN_SEQUENCE_KEY)).padStart(6, '0')}`; },
  nextVoidNumber(): string { return `ANU-${this.getId()}-${String(nextSequence(VOID_SEQUENCE_KEY)).padStart(6, '0')}`; },
  nextCreditNoteNumber(): string { return `NC-${this.getId()}-${String(nextSequence(CREDIT_NOTE_SEQUENCE_KEY)).padStart(6, '0')}`; },
  nextReceiptNumber(): string { return `REC-${this.getId()}-${String(nextSequence(RECEIPT_SEQUENCE_KEY)).padStart(6, '0')}`; },
  nextQuoteNumber(): string { return `PRE-${this.getId()}-${String(nextSequence(QUOTE_SEQUENCE_KEY)).padStart(6, '0')}`; },
};
