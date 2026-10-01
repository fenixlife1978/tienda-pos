const TERMINAL_ID_KEY = 'omni_terminal_id_v2';
const LEGACY_TERMINAL_ID_KEY = 'omni_terminal_id_v1';

function getOrCreateFallbackId(): string {
  const existing = sessionStorage.getItem(TERMINAL_ID_KEY);
  if (existing) return existing;
  const legacy = localStorage.getItem(LEGACY_TERMINAL_ID_KEY);
  const id = legacy || `POS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  sessionStorage.setItem(TERMINAL_ID_KEY, id);
  return id;
}

function sequenceKey(kind: string, terminalId: string): string {
  return `omni_terminal_sequence_v2:${terminalId}:${kind}`;
}

function nextSequence(kind: string, terminalId: string): number {
  const key = sequenceKey(kind, terminalId);
  const current = Number(localStorage.getItem(key) || '0');
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return next;
}

export const terminalIdentity = {
  getId(): string { return getOrCreateFallbackId(); },
  setId(id: string): void {
    const clean = String(id || '').trim();
    if (!clean) throw new Error('Terminal inválido.');
    sessionStorage.setItem(TERMINAL_ID_KEY, clean);
  },
  clear(): void { sessionStorage.removeItem(TERMINAL_ID_KEY); },
  hasAssignedTerminal(): boolean { return Boolean(sessionStorage.getItem(TERMINAL_ID_KEY)); },
  getAssignedId(): string | null { return sessionStorage.getItem(TERMINAL_ID_KEY); },
  nextOrderNumber(): string {
    const terminalId = this.getId();
    return `PED-${terminalId}-${String(nextSequence('order', terminalId)).padStart(6, '0')}`;
  },
  nextInvoiceNumber(): string {
    const terminalId = this.getId();
    return `FACT-${terminalId}-${String(nextSequence('invoice', terminalId)).padStart(8, '0')}`;
  },
  nextReturnNumber(): string {
    const terminalId = this.getId();
    return `DEV-${terminalId}-${String(nextSequence('return', terminalId)).padStart(6, '0')}`;
  },
  nextVoidNumber(): string {
    const terminalId = this.getId();
    return `ANU-${terminalId}-${String(nextSequence('void', terminalId)).padStart(6, '0')}`;
  },
  nextCreditNoteNumber(): string {
    const terminalId = this.getId();
    return `NC-${terminalId}-${String(nextSequence('credit_note', terminalId)).padStart(6, '0')}`;
  },
  nextReceiptNumber(): string {
    const terminalId = this.getId();
    return `REC-${terminalId}-${String(nextSequence('receipt', terminalId)).padStart(6, '0')}`;
  },
  nextQuoteNumber(): string {
    const terminalId = this.getId();
    return `PRE-${terminalId}-${String(nextSequence('quote', terminalId)).padStart(6, '0')}`;
  },
};
