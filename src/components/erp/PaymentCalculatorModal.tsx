import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Banknote, Calculator, Check, CreditCard, DollarSign, Fingerprint, Plus, Smartphone, Trash2, X, Building2 } from 'lucide-react';
import { PaymentMethod, PaymentSplit } from '../../types';
import { formatBs, formatUSD } from '../../utils/formatUtils';

type CalculatorPayment = PaymentSplit & {
  currency: 'Bs' | 'USD';
  originalAmount: number;
};

interface PaymentCalculatorModalProps {
  totalUSD: number;
  totalBs: number;
  exchangeRate: number;
  onClose: () => void;
  onConfirm: (data: {
    payments: CalculatorPayment[];
    totalPaidUSD: number;
    totalPaidBs: number;
    changeUSD: number;
    changeBs: number;
  }) => void;
}

const METHODS: Array<{
  id: Exclude<PaymentMethod, 'mixto' | 'credito' | 'transferencia_usd' | 'divisas_efectivo'>;
  label: string;
  currency: 'Bs' | 'USD';
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'efectivo_bs', label: 'Efectivo Bs.', currency: 'Bs', icon: Banknote },
  { id: 'efectivo_usd', label: 'Efectivo USD', currency: 'USD', icon: DollarSign },
  { id: 'zelle', label: 'Zelle', currency: 'USD', icon: DollarSign },
  { id: 'pago_movil', label: 'Pago Móvil', currency: 'Bs', icon: Smartphone },
  { id: 'biopago', label: 'Biopago', currency: 'Bs', icon: Fingerprint },
  { id: 'transferencia_bs', label: 'Transferencia', currency: 'Bs', icon: Building2 },
  { id: 'tarjeta', label: 'Tarjeta', currency: 'Bs', icon: CreditCard },
];

const isCash = (method: PaymentMethod) => method === 'efectivo_bs' || method === 'efectivo_usd';

export const PaymentCalculatorModal: React.FC<PaymentCalculatorModalProps> = ({
  totalUSD,
  totalBs,
  exchangeRate,
  onClose,
  onConfirm,
}) => {
  const [payments, setPayments] = useState<CalculatorPayment[]>([]);
  const [method, setMethod] = useState<CalculatorPayment['method']>('efectivo_bs');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const methodInfo = METHODS.find((item) => item.id === method) || METHODS[0];

  const totals = useMemo(() => {
    const paidUSD = payments.reduce((sum, p) => sum + p.amountUSD, 0);
    const paidBs = payments.reduce((sum, p) => sum + p.amountBs, 0);
    const nonCashUSD = payments.filter((p) => !isCash(p.method)).reduce((sum, p) => sum + p.amountUSD, 0);
    const cashUSD = payments.filter((p) => isCash(p.method)).reduce((sum, p) => sum + p.amountUSD, 0);
    const remainingAfterNonCash = Math.max(0, totalUSD - nonCashUSD);
    const changeUSD = Math.max(0, cashUSD - remainingAfterNonCash);
    const coveredUSD = Math.min(totalUSD, nonCashUSD + cashUSD);
    return {
      paidUSD,
      paidBs,
      nonCashUSD,
      cashUSD,
      remainingUSD: Math.max(0, totalUSD - coveredUSD),
      changeUSD,
      changeBs: changeUSD * exchangeRate,
      fullyPaid: coveredUSD + 0.0001 >= totalUSD,
    };
  }, [payments, totalUSD, exchangeRate]);

  const addPayment = useCallback(() => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    const amountUSD = methodInfo.currency === 'USD'
      ? numeric
      : (exchangeRate > 0 ? numeric / exchangeRate : 0);
    const amountBs = methodInfo.currency === 'USD'
      ? numeric * exchangeRate
      : numeric;

    const payment: CalculatorPayment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      method,
      amountUSD: Number(amountUSD.toFixed(6)),
      amountBs: Number(amountBs.toFixed(2)),
      originalAmount: Number(numeric.toFixed(2)),
      currency: methodInfo.currency,
      reference: reference.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setPayments((current) => [...current, payment]);
    setAmount('');
    setReference('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [amount, method, methodInfo.currency, exchangeRate, reference]);

  const setExactAmount = () => {
    const remaining = Math.max(0, totalUSD - totals.paidUSD);
    if (remaining <= 0) return;
    const exact = methodInfo.currency === 'USD' ? remaining : remaining * exchangeRate;
    setAmount(exact.toFixed(2));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const confirm = () => {
    if (!totals.fullyPaid || payments.length === 0) return;
    onConfirm({
      payments,
      totalPaidUSD: totals.paidUSD,
      totalPaidBs: totals.paidBs,
      changeUSD: totals.changeUSD,
      changeBs: totals.changeBs,
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter' && document.activeElement === inputRef.current) {
        event.preventDefault();
        addPayment();
      }
      if (event.code === 'Space' && document.activeElement !== inputRef.current && totals.fullyPaid) {
        event.preventDefault();
        confirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addPayment, confirm, onClose, totals.fullyPaid]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4">
      <div className="w-[560px] max-w-[96vw] max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide">Calculadora de Cobro</h3>
              <p className="text-[10px] text-white/50">Registre uno o varios medios de pago</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(92vh-58px)]">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <span className="block text-[9px] font-black uppercase text-slate-400">Total factura</span>
              <strong className="block text-xl font-black text-slate-900">{formatUSD(totalUSD)}</strong>
              <span className="text-[10px] font-semibold text-slate-500">{formatBs(totalBs)}</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <span className="block text-[9px] font-black uppercase text-emerald-600">Pagado</span>
              <strong className="block text-xl font-black text-emerald-700">{formatUSD(totals.paidUSD)}</strong>
              <span className="text-[10px] font-semibold text-emerald-700">{formatBs(totals.paidBs)}</span>
            </div>
            <div className={`rounded-xl border p-3 text-center ${totals.remainingUSD > 0 ? 'border-rose-200 bg-rose-50' : 'border-blue-200 bg-blue-50'}`}>
              <span className={`block text-[9px] font-black uppercase ${totals.remainingUSD > 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                {totals.remainingUSD > 0 ? 'Falta' : 'Vuelto'}
              </span>
              <strong className={`block text-xl font-black ${totals.remainingUSD > 0 ? 'text-rose-700' : 'text-blue-700'}`}>
                {totals.remainingUSD > 0 ? formatUSD(totals.remainingUSD) : formatUSD(totals.changeUSD)}
              </strong>
              <span className="text-[10px] font-semibold">{formatBs(totals.remainingUSD > 0 ? totals.remainingUSD * exchangeRate : totals.changeBs)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-[1.15fr_1fr_auto] gap-2 items-end">
              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Medio de pago</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as CalculatorPayment['method'])}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-bold"
                >
                  {METHODS.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.currency})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                  Monto {methodInfo.currency}
                </label>
                <div className="relative">
                  {methodInfo.currency === 'USD' ? <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" /> : <Banknote className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />}
                  <input
                    ref={inputRef}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-right font-mono font-black"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <button onClick={addPayment} disabled={!amount} className="h-10 w-10 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center disabled:opacity-30">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Referencia / comprobante (opcional)"
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono"
              />
              <button onClick={setExactAmount} className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-[9px] font-black uppercase">
                Monto exacto
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-slate-400">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Equivalencia: {methodInfo.currency === 'USD' ? formatBs((Number(amount) || 0) * exchangeRate) : formatUSD((Number(amount) || 0) / exchangeRate)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-3 py-2 flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest">Pagos registrados</span>
              <span className="text-[9px] text-white/50">{payments.length} medio(s)</span>
            </div>
            {payments.length === 0 ? (
              <div className="py-6 text-center text-[10px] font-bold uppercase text-slate-300">Esperando pagos...</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payments.map((payment) => {
                  const info = METHODS.find((item) => item.id === payment.method);
                  const Icon = info?.icon || Banknote;
                  return (
                    <div key={payment.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-3 py-2 bg-white">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase text-slate-800">{info?.label}</p>
                        <p className="text-[9px] text-slate-400 truncate">{payment.reference || 'Sin referencia'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black">{payment.currency === 'USD' ? formatUSD(payment.originalAmount) : formatBs(payment.originalAmount)}</p>
                        <p className="text-[8px] text-slate-400">≈ {formatUSD(payment.amountUSD)}</p>
                      </div>
                      <button onClick={() => setPayments((current) => current.filter((p) => p.id !== payment.id))} className="p-1 text-slate-300 hover:text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`rounded-xl border-2 p-3 text-center ${totals.remainingUSD > 0 ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
            {totals.remainingUSD > 0 ? (
              <>
                <span className="block text-[9px] font-black uppercase tracking-widest text-rose-600">Monto faltante</span>
                <strong className="block text-2xl font-black text-rose-700">{formatUSD(totals.remainingUSD)}</strong>
                <span className="text-[10px] font-bold text-rose-600">{formatBs(totals.remainingUSD * exchangeRate)}</span>
              </>
            ) : totals.changeUSD > 0 ? (
              <>
                <span className="block text-[9px] font-black uppercase tracking-widest text-blue-600">Vuelto a entregar</span>
                <strong className="block text-2xl font-black text-blue-700">{formatUSD(totals.changeUSD)}</strong>
                <span className="text-[10px] font-bold text-blue-600">{formatBs(totals.changeBs)}</span>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 text-emerald-700">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Check className="w-4 h-4" /></span>
                <span className="text-sm font-black uppercase">Pago exacto</span>
              </div>
            )}
          </div>

          <button
            onClick={confirm}
            disabled={!totals.fullyPaid || payments.length === 0}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs disabled:bg-slate-200 disabled:text-slate-400"
          >
            Confirmar cobro y emitir factura
          </button>
        </div>
      </div>
    </div>
  );
};
