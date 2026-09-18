import React, { useState } from 'react';
import { Customer, Invoice, ReceivableItem, PaymentMethod } from '../../types';
import {
  X,
  CreditCard,
  Building,
  User,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  ArrowRight,
  Layers,
  FileText,
  History,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

interface CustomerCreditDetailModalProps {
  customer: Customer;
  receivables: ReceivableItem[];
  invoices: Invoice[];
  bcvRate: number;
  onClose: () => void;
  onRegisterReceivablePayment: (
    receivableId: string,
    amountUSD: number,
    details?: {
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      bcvRate?: number;
    }
  ) => void;
  onRegisterGlobalCustomerPayment: (
    customerId: string,
    amountUSD: number,
    details?: {
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      bcvRate?: number;
    }
  ) => { liquidatedInvoicesCount: number; partialAbonoUSD: number; fullyPaidTotalUSD: number };
  onLiquidateCustomerInvoice: (
    receivableId: string,
    details?: {
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      bcvRate?: number;
    }
  ) => void;
  onLiquidateCustomerTotalDebt: (
    customerId: string,
    details?: {
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      bcvRate?: number;
    }
  ) => void;
  onOpenCreditConfig: (customer: Customer) => void;
  onInspectInvoice: (invoice: Invoice | null, receivable: ReceivableItem | null) => void;
}

export const CustomerCreditDetailModal: React.FC<CustomerCreditDetailModalProps> = ({
  customer,
  receivables,
  invoices,
  bcvRate,
  onClose,
  onRegisterReceivablePayment,
  onRegisterGlobalCustomerPayment,
  onLiquidateCustomerInvoice,
  onLiquidateCustomerTotalDebt,
  onOpenCreditConfig,
  onInspectInvoice,
}) => {
  // Filter receivables for this specific customer
  const customerReceivables = receivables.filter((r) => r.customerId === customer.id);
  
  // Sort pending receivables chronologically (oldest issuedDate first for FIFO)
  const pendingReceivables = customerReceivables
    .filter((r) => r.balanceUSD > 0.001)
    .sort((a, b) => new Date(a.issuedDate).getTime() - new Date(b.issuedDate).getTime());

  const paidReceivables = customerReceivables.filter((r) => r.balanceUSD <= 0.001);

  const totalDebtUSD = pendingReceivables.reduce((sum, r) => sum + r.balanceUSD, 0);
  const totalInvoicedUSD = customerReceivables.reduce((sum, r) => sum + r.totalAmountUSD, 0);
  const totalPaidUSD = customerReceivables.reduce((sum, r) => sum + r.amountPaidUSD, 0);
  const overdueCount = pendingReceivables.filter((r) => r.status === 'vencido').length;
  const availableCreditUSD = Math.max(0, (customer.creditLimitUSD || 0) - totalDebtUSD);

  // Tabs & filters
  const [filterTab, setFilterTab] = useState<'pendientes' | 'todas' | 'pagadas'>('pendientes');
  const [searchInvoice, setSearchInvoice] = useState('');

  // Global payment modal / panel state
  const [showGlobalPayPanel, setShowGlobalPayPanel] = useState(false);
  const [globalPayAmount, setGlobalPayAmount] = useState<number>(totalDebtUSD > 0 ? totalDebtUSD : 0);
  const [globalPaymentMethod, setGlobalPaymentMethod] = useState<PaymentMethod>('transferencia_usd');
  const [globalPayReference, setGlobalPayReference] = useState('');
  const [globalPayNotes, setGlobalPayNotes] = useState('');
  const [globalPaySuccessMessage, setGlobalPaySuccessMessage] = useState<string | null>(null);

  // Individual invoice payment modal state
  const [activePayingReceivable, setActivePayingReceivable] = useState<ReceivableItem | null>(null);
  const [singlePayAmount, setSinglePayAmount] = useState<number>(0);
  const [singlePaymentMethod, setSinglePaymentMethod] = useState<PaymentMethod>('transferencia_usd');
  const [singlePayReference, setSinglePayReference] = useState('');
  const [singlePayNotes, setSinglePayNotes] = useState('');

  // Expandable invoice history in-line
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});

  const toggleHistory = (recId: string) => {
    setExpandedHistories((prev) => ({ ...prev, [recId]: !prev[recId] }));
  };

  // Filtered displayed receivables
  const displayedReceivables = customerReceivables
    .filter((r) => {
      if (filterTab === 'pendientes') return r.balanceUSD > 0.001;
      if (filterTab === 'pagadas') return r.balanceUSD <= 0.001;
      return true;
    })
    .filter((r) => {
      if (!searchInvoice) return true;
      return r.invoiceNumber.toLowerCase().includes(searchInvoice.toLowerCase());
    })
    .sort((a, b) => new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime());

  // FIFO Simulation Calculation for Global Pay Preview
  const simulateFifoDistribution = (amount: number) => {
    let remaining = amount;
    return pendingReceivables.map((rec) => {
      if (remaining <= 0) {
        return {
          rec,
          appliedAmount: 0,
          newBalance: rec.balanceUSD,
          status: 'sin_cambio' as const,
        };
      }
      const applied = Math.min(rec.balanceUSD, remaining);
      remaining -= applied;
      const newBal = Math.max(0, rec.balanceUSD - applied);
      return {
        rec,
        appliedAmount: applied,
        newBalance: newBal,
        status: (newBal <= 0.01 ? 'liquidada' : 'abono_parcial') as 'liquidada' | 'abono_parcial',
      };
    });
  };

  const fifoPreview = simulateFifoDistribution(globalPayAmount || 0);

  // Handle Global Payment Submission
  const handleExecuteGlobalPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalPayAmount <= 0) return;

    const result = onRegisterGlobalCustomerPayment(customer.id, globalPayAmount, {
      paymentMethod: globalPaymentMethod,
      reference: globalPayReference,
      notes: globalPayNotes || 'Abono Global Distribuido (FIFO)',
      bcvRate: bcvRate,
    });

    setGlobalPaySuccessMessage(
      `¡Pago de $${globalPayAmount.toFixed(2)} USD procesado con éxito! Se liquidaron ${result.liquidatedInvoicesCount} factura(s)${
        result.partialAbonoUSD > 0 ? ` y se aplicó un abono de $${result.partialAbonoUSD.toFixed(2)} a la siguiente.` : '.'
      }`
    );
    setShowGlobalPayPanel(false);
    setGlobalPayReference('');
    setGlobalPayNotes('');
    setTimeout(() => setGlobalPaySuccessMessage(null), 6000);
  };

  // Handle Single Invoice Payment Submission
  const handleExecuteSinglePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePayingReceivable || singlePayAmount <= 0) return;

    onRegisterReceivablePayment(activePayingReceivable.id, singlePayAmount, {
      paymentMethod: singlePaymentMethod,
      reference: singlePayReference,
      notes: singlePayNotes || 'Abono individual a factura',
      bcvRate: bcvRate,
    });

    setActivePayingReceivable(null);
    setSinglePayReference('');
    setSinglePayNotes('');
  };

  const handle1ClickLiquidateInvoice = (rec: ReceivableItem) => {
    if (window.confirm(`¿Confirmas la liquidación total de la factura ${rec.invoiceNumber} por $${rec.balanceUSD.toFixed(2)} USD?`)) {
      onLiquidateCustomerInvoice(rec.id, {
        paymentMethod: 'transferencia_usd',
        notes: 'Liquidación directa 100% de factura',
        bcvRate: bcvRate,
      });
    }
  };

  const handle1ClickLiquidateTotalDebt = () => {
    if (totalDebtUSD <= 0) return;
    if (
      window.confirm(
        `¿Confirmas la liquidación TOTAL de la deuda de ${customer.name} por $${totalDebtUSD.toFixed(2)} USD (${pendingReceivables.length} facturas)?`
      )
    ) {
      onLiquidateCustomerTotalDebt(customer.id, {
        paymentMethod: 'transferencia_usd',
        notes: 'Cancelación / Liquidación TOTAL de deuda',
        bcvRate: bcvRate,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-400/30">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white tracking-tight">
                  {customer.name}
                </h3>
                {customer.hasCredit ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Crédito {customer.creditDays || 15} Días
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                    Contado
                  </span>
                )}
                {overdueCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40">
                    {overdueCount} Factura(s) en Mora
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-3 font-mono">
                <span>RIF: {customer.rif}</span>
                {customer.phone && <span>• Telf: {customer.phone}</span>}
                {customer.assignedPriceTier && (
                  <span className="capitalize text-indigo-300">• Tarifa: {customer.assignedPriceTier}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenCreditConfig(customer)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition cursor-pointer"
            >
              Ajustar Condiciones
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {globalPaySuccessMessage && (
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{globalPaySuccessMessage}</span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Total Debt */}
            <div className="p-4 rounded-xl border bg-amber-50/70 border-amber-200 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                Deuda Total Actual (CxC)
              </span>
              <p className="text-xl font-extrabold text-amber-900 mt-1 font-mono">
                {formatUSD(totalDebtUSD)}
              </p>
              <p className="text-[10px] text-amber-700 mt-0.5 font-mono font-semibold">
                ≈ {formatBs(totalDebtUSD * bcvRate)}
              </p>
            </div>

            {/* Credit Limit */}
            <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Límite de Crédito
              </span>
              <p className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
                {formatUSD(customer.creditLimitUSD || 0)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Plazo acordado: {customer.creditDays || 15} días
              </p>
            </div>

            {/* Available Limit */}
            <div className="p-4 rounded-xl border bg-emerald-50/70 border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Cupo Disponible
              </span>
              <p className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
                {formatUSD(availableCreditUSD)}
              </p>
              <p className="text-[10px] text-emerald-600 mt-0.5">
                {totalDebtUSD === 0 ? '100% disponible' : `${((availableCreditUSD / (customer.creditLimitUSD || 1)) * 100).toFixed(0)}% restante`}
              </p>
            </div>

            {/* Invoices Summary */}
            <div className="p-4 rounded-xl border bg-indigo-50/70 border-indigo-200 shadow-2xs">
              <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
                Historial de Cartera
              </span>
              <p className="text-xl font-extrabold text-indigo-900 mt-1 font-mono">
                {customerReceivables.length} Facturas
              </p>
              <p className="text-[10px] text-indigo-700 mt-0.5">
                {pendingReceivables.length} pendientes • {paidReceivables.length} liquidadas
              </p>
            </div>
          </div>

          {/* Action Bar for Global Debt Settlement */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-900/50 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-sm text-white">
                  Operaciones Globales de Cobranza (FIFO)
                </h4>
              </div>
              <p className="text-xs text-slate-300">
                Liquida toda la deuda del cliente en un solo paso o abona un monto global que se distribuirá en cascada desde la factura más antigua.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                disabled={totalDebtUSD <= 0}
                onClick={handle1ClickLiquidateTotalDebt}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                  totalDebtUSD > 0
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Liquidar Deuda Total ({formatUSD(totalDebtUSD)})
              </button>

              <button
                type="button"
                disabled={totalDebtUSD <= 0}
                onClick={() => {
                  setGlobalPayAmount(totalDebtUSD);
                  setShowGlobalPayPanel(!showGlobalPayPanel);
                }}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border shadow-sm ${
                  totalDebtUSD > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                {showGlobalPayPanel ? 'Ocultar Abono Global' : 'Abonar Monto Global'}
              </button>
            </div>
          </div>

          {/* Collapsible Global Payment Panel with FIFO Waterfall Simulation */}
          {showGlobalPayPanel && totalDebtUSD > 0 && (
            <div className="p-5 bg-indigo-50/80 rounded-2xl border border-indigo-200 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-200">
                <div>
                  <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Distribución en Cascada de Abono Global (FIFO - De la más antigua a la más reciente)
                  </h4>
                  <p className="text-[11px] text-indigo-700">
                    Ingresa la cantidad que el cliente desea pagar. El sistema liquidará tantas facturas como sea posible en estricto orden cronológico y aplicará cualquier saldo remanente a la factura siguiente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGlobalPayPanel(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteGlobalPayment} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Monto a Abonar (USD) *
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={totalDebtUSD}
                        required
                        value={globalPayAmount || ''}
                        onChange={(e) => setGlobalPayAmount(parseFloat(e.target.value) || 0)}
                        className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">
                      ≈ {formatBs((globalPayAmount || 0) * bcvRate)} a tasa {bcvRate.toFixed(2)} Bs/USD
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Método de Pago *
                    </label>
                    <select
                      value={globalPaymentMethod}
                      onChange={(e) => setGlobalPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="transferencia_usd">Zelle / Transferencia USD</option>
                      <option value="divisas_efectivo">Divisas en Efectivo ($ USD)</option>
                      <option value="pago_movil">Pago Móvil (Bs)</option>
                      <option value="transferencia_bs">Transferencia Bancaria (Bs)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      N° Referencia / Comprobante
                    </label>
                    <input
                      type="text"
                      value={globalPayReference}
                      onChange={(e) => setGlobalPayReference(e.target.value)}
                      placeholder="Ej: REF-992014 / ZELLE-MARIA"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Live Waterfall Preview Simulation Table */}
                <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden shadow-2xs p-3 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                    Simulación en Tiempo Real de Liquidación ({pendingReceivables.length} Facturas Pendientes)
                  </span>

                  <div className="divide-y divide-slate-100">
                    {fifoPreview.map(({ rec, appliedAmount, newBalance, status }) => (
                      <div
                        key={rec.id}
                        className={`py-2 px-3 rounded-lg flex items-center justify-between text-xs transition ${
                          status === 'liquidada'
                            ? 'bg-emerald-50/70 border border-emerald-200'
                            : status === 'abono_parcial'
                            ? 'bg-amber-50/70 border border-amber-200'
                            : 'bg-slate-50/50 opacity-60'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-700">{rec.invoiceNumber}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Emisión: {rec.issuedDate}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Saldo original: {formatUSD(rec.balanceUSD)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-mono font-bold text-slate-900">
                              Aplicar: <span className="text-emerald-700 font-bold">+{formatUSD(appliedAmount)}</span>
                            </p>
                            <p className="text-[10px] font-mono text-slate-500">
                              Saldo Restante: <strong className={newBalance <= 0.01 ? 'text-emerald-700' : 'text-amber-800'}>{formatUSD(newBalance)}</strong>
                            </p>
                          </div>

                          <div className="w-24 text-right">
                            {status === 'liquidada' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✅ 100% Pagada
                              </span>
                            )}
                            {status === 'abono_parcial' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                🟡 Abono Parcial
                              </span>
                            )}
                            {status === 'sin_cambio' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                ⏳ Sin cambios
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGlobalPayPanel(false)}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={globalPayAmount <= 0}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Abono Global de {formatUSD(globalPayAmount)} USD
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Invoices List / Statement Header & Filters */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">
                  Historial Individual de Facturas & Estado de Cuenta
                </h4>
                <span className="text-xs text-slate-400 font-mono">({displayedReceivables.length})</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Tabs */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterTab('pendientes')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      filterTab === 'pendientes'
                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pendientes ({pendingReceivables.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('todas')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      filterTab === 'todas'
                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({customerReceivables.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('pagadas')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      filterTab === 'pagadas'
                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Liquidadas ({paidReceivables.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Invoices Cards / Rows List */}
            {displayedReceivables.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
                No se encontraron facturas en este estado para este cliente.
              </div>
            ) : (
              <div className="space-y-3">
                {displayedReceivables.map((rec) => {
                  const matchingInvoice = invoices.find(
                    (inv) => inv.id === rec.invoiceId || inv.invoiceNumber === rec.invoiceNumber
                  ) || null;
                  const isSettled = rec.balanceUSD <= 0.01;
                  const isHistoryOpen = !!expandedHistories[rec.id];
                  const historyCount = rec.paymentHistory?.length || 0;

                  return (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-2xl border transition shadow-2xs ${
                        isSettled
                          ? 'bg-white border-slate-200 hover:border-slate-300'
                          : rec.status === 'vencido'
                          ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                          : 'bg-white border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      {/* Invoice Main Header Row */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Left: Invoice Number & Dates */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onInspectInvoice(matchingInvoice, rec)}
                              className="font-mono font-bold text-sm text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Haz clic para ver el detalle de productos, cantidades y precios de esta compra"
                            >
                              <FileText className="w-4 h-4" />
                              {rec.invoiceNumber}
                            </button>

                            {/* Status Pill */}
                            {rec.status === 'al_dia' && !isSettled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                Al Día ({rec.creditDays}d)
                              </span>
                            )}
                            {rec.status === 'por_vencer' && !isSettled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Por Vencer ({rec.creditDays}d)
                              </span>
                            )}
                            {rec.status === 'vencido' && !isSettled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                ⚠️ Vencido
                              </span>
                            )}
                            {isSettled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Liquidada
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-slate-500 text-[11px] font-mono">
                            <span>Emisión: <strong className="text-slate-700">{rec.issuedDate}</strong></span>
                            <span>Vencimiento: <strong className={rec.status === 'vencido' ? 'text-rose-700' : 'text-slate-700'}>{rec.dueDate}</strong></span>
                            {matchingInvoice && (
                              <span className="text-indigo-600 font-sans font-medium">
                                • {matchingInvoice.items.length} producto(s)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle: Financials */}
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Factura</span>
                            <span className="font-mono font-bold text-slate-800">{formatUSD(rec.totalAmountUSD)}</span>
                          </div>

                          <div>
                            <span className="text-[10px] text-emerald-600 block uppercase font-bold">Abonado</span>
                            <span className="font-mono font-bold text-emerald-700">{formatUSD(rec.amountPaidUSD)}</span>
                          </div>

                          <div className="pl-2 border-l border-slate-200">
                            <span className="text-[10px] text-amber-800 block uppercase font-bold">Saldo Pendiente</span>
                            <span className="font-mono font-extrabold text-slate-900 text-sm block">
                              {formatUSD(rec.balanceUSD)}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 block">
                              ≈ {formatBs(rec.balanceUSD * bcvRate)}
                            </span>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          {/* Button: View Items Breakdown */}
                          <button
                            type="button"
                            onClick={() => onInspectInvoice(matchingInvoice, rec)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                            title="Ver productos, precios y cantidades"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            Ver Productos
                          </button>

                          {/* Button: Toggle internal payment history */}
                          <button
                            type="button"
                            onClick={() => toggleHistory(rec.id)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-emerald-600" />
                            Abonos ({historyCount})
                            {isHistoryOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {/* Action Buttons if pending */}
                          {!isSettled && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePayingReceivable(rec);
                                  setSinglePayAmount(rec.balanceUSD);
                                }}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs transition cursor-pointer"
                              >
                                Abonar
                              </button>

                              <button
                                type="button"
                                onClick={() => handle1ClickLiquidateInvoice(rec)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-2xs"
                              >
                                Liquidar 100%
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expandable Internal Payment History for this Invoice */}
                      {isHistoryOpen && (
                        <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2 animate-in fade-in">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Historial Interno de Abonos y Liquidaciones de {rec.invoiceNumber}:
                          </span>

                          {historyCount === 0 ? (
                            <p className="text-slate-400 italic text-[11px] py-1">
                              No hay registros de abonos previos en esta factura.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {rec.paymentHistory?.map((pay) => (
                                <div
                                  key={pay.id}
                                  className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-[11px]"
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-emerald-900">
                                        +{formatUSD(pay.amountUSD)} USD
                                      </span>
                                      <span className="font-mono text-[10px] text-emerald-700 font-semibold">
                                        ≈ {formatBs(pay.amountBs)}
                                      </span>
                                    </div>
                                    <p className="text-slate-600 text-[10px] mt-0.5">
                                      {pay.notes || 'Abono registrado'}
                                    </p>
                                    <p className="text-slate-400 text-[9px] font-mono">
                                      {new Date(pay.date).toLocaleDateString('es-VE')} {new Date(pay.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {pay.reference && <span> • Ref: {pay.reference}</span>}
                                    </p>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="text-[10px] text-slate-500 block">
                                      Saldo post-pago:
                                    </span>
                                    <span className="font-mono font-bold text-slate-800">
                                      {formatUSD(pay.balanceAfterUSD)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Modal: Single Invoice Custom Abono */}
        {activePayingReceivable && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
                <div>
                  <h4 className="font-bold text-sm">
                    Abonar a Factura: {activePayingReceivable.invoiceNumber}
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Cliente: {customer.name}
                  </p>
                </div>
                <button
                  onClick={() => setActivePayingReceivable(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleExecuteSinglePayment} className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5 text-amber-900">
                  <p>Saldo Pendiente: <strong className="font-mono text-sm">{formatUSD(activePayingReceivable.balanceUSD)} USD</strong></p>
                  <p className="text-[11px] text-amber-700 font-mono font-semibold">
                    ≈ {formatBs(activePayingReceivable.balanceUSD * bcvRate)} (Tasa: {bcvRate.toFixed(2)} Bs/USD)
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Monto a Abonar (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={activePayingReceivable.balanceUSD}
                    required
                    value={singlePayAmount || ''}
                    onChange={(e) => setSinglePayAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setSinglePayAmount(activePayingReceivable.balanceUSD)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700"
                    >
                      Monto Total ({formatUSD(activePayingReceivable.balanceUSD)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSinglePayAmount(parseFloat((activePayingReceivable.balanceUSD / 2).toFixed(2)))}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700"
                    >
                      50% ({formatUSD(activePayingReceivable.balanceUSD / 2)})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Método de Pago</label>
                    <select
                      value={singlePaymentMethod}
                      onChange={(e) => setSinglePaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="transferencia_usd">Zelle / USD</option>
                      <option value="divisas_efectivo">Efectivo USD</option>
                      <option value="pago_movil">Pago Móvil</option>
                      <option value="transferencia_bs">Transf. Bs</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Referencia</label>
                    <input
                      type="text"
                      value={singlePayReference}
                      onChange={(e) => setSinglePayReference(e.target.value)}
                      placeholder="Ej: REF-12345"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Notas / Observaciones</label>
                  <input
                    type="text"
                    value={singlePayNotes}
                    onChange={(e) => setSinglePayNotes(e.target.value)}
                    placeholder="Nota de cobro..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePayingReceivable(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    Registrar Cobro
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-slate-500 text-xs">
            Mostrando {displayedReceivables.length} de {customerReceivables.length} facturas registradas.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition cursor-pointer"
          >
            Cerrar Estado de Cuenta
          </button>
        </div>

      </div>
    </div>
  );
};
