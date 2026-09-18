import React, { useState } from 'react';
import { Supplier, PayableItem, PaymentMethod } from '../../types';
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
  MapPin,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

interface SupplierCreditDetailModalProps {
  supplier: Supplier;
  payables: PayableItem[];
  bcvRate: number;
  onClose: () => void;
  onRegisterPayablePayment: (
    payableId: string,
    amountUSD: number,
    details?: {
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      bcvRate?: number;
    }
  ) => void;
  onRegisterGlobalSupplierPayment: (
    supplierId: string,
    amountUSD: number,
    details?: {
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      bcvRate?: number;
    }
  ) => { liquidatedInvoicesCount: number; partialAbonoUSD: number; fullyPaidTotalUSD: number };
  onLiquidateSupplierInvoice: (
    payableId: string,
    details?: {
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      bcvRate?: number;
    }
  ) => void;
  onLiquidateSupplierTotalDebt: (
    supplierId: string,
    details?: {
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      bcvRate?: number;
    }
  ) => void;
  onOpenCreditConfig: (supplier: Supplier) => void;
  onInspectPayable: (payable: PayableItem | null) => void;
}

export const SupplierCreditDetailModal: React.FC<SupplierCreditDetailModalProps> = ({
  supplier,
  payables,
  bcvRate,
  onClose,
  onRegisterPayablePayment,
  onRegisterGlobalSupplierPayment,
  onLiquidateSupplierInvoice,
  onLiquidateSupplierTotalDebt,
  onOpenCreditConfig,
  onInspectPayable,
}) => {
  // Filter payables for this specific supplier
  const supplierPayables = payables.filter((p) => p.supplierId === supplier.id);
  
  // Sort pending payables chronologically (oldest issuedDate first for FIFO)
  const pendingPayables = supplierPayables
    .filter((p) => p.balanceUSD > 0.001)
    .sort((a, b) => new Date(a.issuedDate).getTime() - new Date(b.issuedDate).getTime());

  const paidPayables = supplierPayables.filter((p) => p.balanceUSD <= 0.001);

  const totalDebtUSD = pendingPayables.reduce((sum, p) => sum + p.balanceUSD, 0);
  const totalPurchasedUSD = supplierPayables.reduce((sum, p) => sum + p.totalAmountUSD, 0);
  const totalPaidUSD = supplierPayables.reduce((sum, p) => sum + p.amountPaidUSD, 0);
  const overdueCount = pendingPayables.filter((p) => p.status === 'vencido').length;

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
  const [activePayingPayable, setActivePayingPayable] = useState<PayableItem | null>(null);
  const [singlePayAmount, setSinglePayAmount] = useState<number>(0);
  const [singlePaymentMethod, setSinglePaymentMethod] = useState<PaymentMethod>('transferencia_usd');
  const [singlePayReference, setSinglePayReference] = useState('');
  const [singlePayNotes, setSinglePayNotes] = useState('');

  // Expanded histories accordion map
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});

  const toggleHistory = (payId: string) => {
    setExpandedHistories((prev) => ({
      ...prev,
      [payId]: !prev[payId],
    }));
  };

  // Preview waterfall calculation for the entered global amount
  const calculateFifoPreview = (amount: number) => {
    let rem = amount;
    const previewList: {
      payable: PayableItem;
      appliedAmount: number;
      willFullyLiquidate: boolean;
      newBalance: number;
    }[] = [];

    for (const p of pendingPayables) {
      if (rem <= 0.0001) break;
      const applied = Math.min(p.balanceUSD, rem);
      rem -= applied;
      const newBal = Math.max(0, p.balanceUSD - applied);
      previewList.push({
        payable: p,
        appliedAmount: applied,
        willFullyLiquidate: newBal <= 0.01,
        newBalance: newBal,
      });
    }

    return {
      items: previewList,
      remainingUnused: rem,
      liquidatedCount: previewList.filter((x) => x.willFullyLiquidate).length,
    };
  };

  const fifoPreview = calculateFifoPreview(globalPayAmount || 0);

  // Handle Global Payment Execution
  const handleExecuteGlobalPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalPayAmount <= 0) return;

    const result = onRegisterGlobalSupplierPayment(supplier.id, globalPayAmount, {
      paymentMethod: globalPaymentMethod,
      reference: globalPayReference,
      notes: globalPayNotes || 'Pago Global Distribuido a Proveedor (FIFO)',
      bcvRate,
    });

    setGlobalPaySuccessMessage(
      `¡Pago global procesado con éxito! Se liquidaron ${result.liquidatedInvoicesCount} factura(s)${
        result.partialAbonoUSD > 0 ? ` y se aplicó un abono parcial de ${formatUSD(result.partialAbonoUSD)} a la más antigua.` : '.'
      }`
    );

    setTimeout(() => {
      setShowGlobalPayPanel(false);
      setGlobalPaySuccessMessage(null);
    }, 2800);
  };

  // Handle 100% Total Debt Liquidation
  const handleExecuteTotalDebtLiquidation = () => {
    if (totalDebtUSD <= 0) return;
    onLiquidateSupplierTotalDebt(supplier.id, {
      paymentMethod: 'transferencia_usd',
      reference: 'LIQ-TOTAL-SUP',
      notes: 'Liquidación TOTAL de compras con el proveedor',
      bcvRate,
    });
    setGlobalPaySuccessMessage('¡Todas las facturas de compras han sido 100% liquidadas!');
    setTimeout(() => {
      setGlobalPaySuccessMessage(null);
    }, 2500);
  };

  // Handle Individual Invoice Single Payment
  const handleOpenSinglePay = (p: PayableItem) => {
    setActivePayingPayable(p);
    setSinglePayAmount(p.balanceUSD);
    setSinglePaymentMethod('transferencia_usd');
    setSinglePayReference('');
    setSinglePayNotes('');
  };

  const handleExecuteSinglePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePayingPayable || singlePayAmount <= 0) return;

    onRegisterPayablePayment(activePayingPayable.id, singlePayAmount, {
      paymentMethod: singlePaymentMethod,
      reference: singlePayReference,
      notes: singlePayNotes || 'Abono / Pago individual a proveedor',
      bcvRate,
    });

    setActivePayingPayable(null);
  };

  // Filtered invoice list according to current tab & search
  const displayedPayables = supplierPayables
    .filter((p) => {
      if (filterTab === 'pendientes') return p.balanceUSD > 0.001;
      if (filterTab === 'pagadas') return p.balanceUSD <= 0.001;
      return true;
    })
    .filter((p) => {
      if (!searchInvoice) return true;
      return (
        p.invoiceNumber.toLowerCase().includes(searchInvoice.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(searchInvoice.toLowerCase())) ||
        p.items?.some((it) => it.productName.toLowerCase().includes(searchInvoice.toLowerCase()))
      );
    })
    .sort((a, b) => new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-purple-500/20 text-purple-300 rounded-2xl border border-purple-400/30">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-extrabold text-lg text-white tracking-tight">
                  {supplier.name}
                </h3>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700">
                  RIF: {supplier.rif}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  {supplier.creditDays || 15} DÍAS DE PLAZO
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                {supplier.phone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {supplier.phone}
                  </span>
                )}
                {supplier.contactName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Contacto: {supplier.contactName}
                  </span>
                )}
                {supplier.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {supplier.address}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => onOpenCreditConfig(supplier)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5 text-purple-400" />
              Condiciones de Crédito
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/40">
          
          {/* FINANCIAL SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Debt (CxP) */}
            <div className={`p-4 rounded-2xl border transition shadow-2xs ${
              totalDebtUSD > 0
                ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                : 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Saldo por Pagar al Proveedor
                </span>
                {overdueCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    {overdueCount} en mora
                  </span>
                )}
              </div>
              <p className={`text-2xl font-extrabold font-mono mt-1 ${
                totalDebtUSD > 0 ? 'text-amber-800' : 'text-emerald-700'
              }`}>
                {formatUSD(totalDebtUSD)}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                ≈ {formatBs(totalDebtUSD * bcvRate)} (Tasa: {bcvRate.toFixed(2)} Bs)
              </p>
            </div>

            {/* Total Purchases */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Facturas de Compras
              </span>
              <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {formatUSD(totalPurchasedUSD)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {supplierPayables.length} compras ({pendingPayables.length} con saldo pendiente)
              </p>
            </div>

            {/* Total Paid / Settled */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Total Pagado / Egresado
              </span>
              <p className="text-2xl font-extrabold font-mono text-emerald-700 mt-1">
                {formatUSD(totalPaidUSD)}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {paidPayables.length} compras liquidadas 100%
              </p>
            </div>
          </div>

          {/* SUCCESS NOTIFICATION BANNER */}
          {globalPaySuccessMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{globalPaySuccessMessage}</span>
            </div>
          )}

          {/* ACTION BUTTONS: 100% TOTAL LIQUIDATION & GLOBAL FIFO ABONO */}
          {totalDebtUSD > 0 && !showGlobalPayPanel && (
            <div className="bg-gradient-to-r from-purple-900 to-slate-900 p-5 rounded-2xl text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h4 className="font-extrabold text-sm text-white">
                    Gestión de Pagos & Liquidación de Compras
                  </h4>
                </div>
                <p className="text-xs text-purple-200 max-w-xl">
                  El proveedor tiene <strong>{pendingPayables.length}</strong> compra(s) pendiente(s) por un total de <strong>{formatUSD(totalDebtUSD)}</strong>. Puedes liquidar toda la deuda en 1 clic o registrar un abono global con distribución automática en cascada (FIFO).
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setGlobalPayAmount(totalDebtUSD);
                    setShowGlobalPayPanel(true);
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <DollarSign className="w-4 h-4" />
                  Abonar Monto Global (FIFO)
                </button>

                <button
                  type="button"
                  onClick={handleExecuteTotalDebtLiquidation}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Liquidar 100% Deuda Total
                </button>
              </div>
            </div>
          )}

          {/* GLOBAL FIFO PAYMENT FORM PANEL */}
          {showGlobalPayPanel && (
            <div className="bg-white p-5 rounded-2xl border-2 border-purple-400/80 shadow-md space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Abono Global con Distribución Automática (FIFO)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      El monto será aplicado para liquidar las compras pendientes en orden cronológico desde la más antigua hasta la más reciente.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGlobalPayPanel(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteGlobalPayment} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Amount USD */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      Monto a Pagar (USD) *
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
                        className="w-full pl-8 pr-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Deuda total: {formatUSD(totalDebtUSD)}
                    </span>
                  </div>

                  {/* Equivalent Bs */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      Contravalor en Bs (BCV)
                    </label>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800">
                      {formatBs((globalPayAmount || 0) * bcvRate)}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Tasa: {bcvRate.toFixed(2)} Bs/USD
                    </span>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      Método de Pago *
                    </label>
                    <select
                      value={globalPaymentMethod}
                      onChange={(e) => setGlobalPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                    >
                      <option value="transferencia_usd">Zelle / Transferencia USD</option>
                      <option value="transferencia_bs">Transferencia Bancaria Bs</option>
                      <option value="pago_movil">Pago Móvil</option>
                      <option value="divisas_efectivo">Efectivo Divisas</option>
                    </select>
                  </div>

                  {/* Reference */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      N° Referencia
                    </label>
                    <input
                      type="text"
                      value={globalPayReference}
                      onChange={(e) => setGlobalPayReference(e.target.value)}
                      placeholder="Ej. REF-987654"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">
                    Notas u Observaciones del Pago
                  </label>
                  <input
                    type="text"
                    value={globalPayNotes}
                    onChange={(e) => setGlobalPayNotes(e.target.value)}
                    placeholder="Detalles sobre el comprobante o acuerdo comercial..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                {/* FIFO DISTRIBUTION LIVE PREVIEW */}
                <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                      Distribución en Cascada (FIFO) en Tiempo Real:
                    </span>
                    <span className="font-semibold text-purple-800">
                      {fifoPreview.liquidatedCount} factura(s) liquidada(s) 100%
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {fifoPreview.items.map((item, idx) => (
                      <div
                        key={item.payable.id}
                        className="p-2.5 bg-white rounded-lg border border-purple-200/70 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800">
                            #{idx + 1} {item.payable.invoiceNumber}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({item.payable.issuedDate})
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Saldo: {formatUSD(item.payable.balanceUSD)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-700">
                            +{formatUSD(item.appliedAmount)}
                          </span>
                          {item.willFullyLiquidate ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Liquidada
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              Abono (Queda: {formatUSD(item.newBalance)})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowGlobalPayPanel(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={globalPayAmount <= 0}
                    className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar y Registrar Pago de {formatUSD(globalPayAmount)}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* INVOICES SECTION WITH TABS AND ACCORDION */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            
            {/* Tab Controls & Search */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterTab('pendientes')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    filterTab === 'pendientes'
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Pendientes / Con Saldo</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-bold">
                    {pendingPayables.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterTab('todas')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    filterTab === 'todas'
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Todas las Compras</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-bold">
                    {supplierPayables.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterTab('pagadas')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    filterTab === 'pagadas'
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Liquidadas 100%</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-bold">
                    {paidPayables.length}
                  </span>
                </button>
              </div>

              {/* Search Box */}
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={searchInvoice}
                  onChange={(e) => setSearchInvoice(e.target.value)}
                  placeholder="Buscar factura o producto..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                />
              </div>
            </div>

            {/* Invoices List */}
            <div className="divide-y divide-slate-100">
              {displayedPayables.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No se encontraron facturas con los filtros seleccionados.
                </div>
              ) : (
                displayedPayables.map((p) => {
                  const isSettled = p.balanceUSD <= 0.01;
                  const isOverdue = p.status === 'vencido' && !isSettled;
                  const historyList = p.paymentHistory || [];
                  const isExpanded = !!expandedHistories[p.id];

                  return (
                    <div
                      key={p.id}
                      className={`p-4 transition ${
                        isOverdue
                          ? 'bg-rose-50/20'
                          : isSettled
                          ? 'bg-white hover:bg-slate-50/50'
                          : 'bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        
                        {/* Left Info: Invoice # & Dates */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onInspectPayable(p)}
                              className="font-mono font-bold text-sm text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1.5 cursor-pointer"
                              title="Ver detalle de productos facturados"
                            >
                              <FileText className="w-4 h-4 text-purple-600" />
                              {p.invoiceNumber}
                            </button>

                            {isSettled ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Liquidada
                              </span>
                            ) : p.amountPaidUSD > 0 ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                                Parcialmente Pagada
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                Pendiente
                              </span>
                            )}

                            {isOverdue && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Vencida
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono flex-wrap">
                            <span>Emisión: {p.issuedDate}</span>
                            <span>•</span>
                            <span className={isOverdue ? 'text-rose-700 font-bold' : ''}>
                              Vencimiento: {p.dueDate} ({p.creditDays} días)
                            </span>
                            {p.items && p.items.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-slate-600 font-sans">
                                  {p.items.length} productos
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Middle: Financial amounts */}
                        <div className="flex items-center gap-6 text-xs shrink-0">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">
                              Monto Total
                            </span>
                            <strong className="font-mono text-slate-800">
                              {formatUSD(p.totalAmountUSD)}
                            </strong>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">
                              Abonado
                            </span>
                            <span className="font-mono text-emerald-700 font-bold">
                              {formatUSD(p.amountPaidUSD)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">
                              Saldo Restante
                            </span>
                            <strong className={`font-mono text-sm ${isSettled ? 'text-slate-400' : 'text-purple-700'}`}>
                              {formatUSD(p.balanceUSD)}
                            </strong>
                            {!isSettled && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                ≈ {formatBs(p.balanceUSD * bcvRate)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onInspectPayable(p)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                            title="Ver ítems de la compra"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Ver Productos
                          </button>

                          {!isSettled && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenSinglePay(p)}
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Abonar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onLiquidateSupplierInvoice(p.id, {
                                    paymentMethod: 'transferencia_usd',
                                    bcvRate,
                                    notes: 'Liquidación 100% individual de factura',
                                  })
                                }
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Liquidar 100%
                              </button>
                            </>
                          )}

                          {historyList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleHistory(p.id)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                              title="Historial de pagos de esta factura"
                            >
                              <History className="w-3.5 h-3.5 text-slate-400" />
                              <span>{historyList.length}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* EXPANDABLE PAYMENT HISTORY */}
                      {isExpanded && historyList.length > 0 && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 animate-in fade-in">
                          <h5 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1">
                            <History className="w-3.5 h-3.5 text-purple-600" />
                            Abonos Registrados para Factura {p.invoiceNumber}
                          </h5>

                          <div className="space-y-1.5">
                            {historyList.map((h) => (
                              <div
                                key={h.id}
                                className="p-2.5 bg-white rounded-lg border border-slate-200/80 flex items-center justify-between gap-2"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">
                                      {h.paymentMethod}
                                    </span>
                                    {h.reference && (
                                      <span className="text-[10px] font-mono text-slate-500">
                                        Ref: {h.reference}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-mono">
                                    {h.date.split('T')[0]} • Registrado por: {h.registeredBy || 'Admin'}
                                  </p>
                                  {h.notes && (
                                    <p className="text-[11px] text-slate-600 italic">"{h.notes}"</p>
                                  )}
                                </div>

                                <div className="text-right font-mono">
                                  <span className="font-bold text-emerald-700 text-sm block">
                                    +{formatUSD(h.amountUSD)}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {formatBs(h.amountBs)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Cerrar
          </button>

          <div className="text-xs text-slate-500 font-mono">
            Tasa Oficial BCV: <strong>{bcvRate.toFixed(2)} Bs/USD</strong>
          </div>
        </div>
      </div>

      {/* INDIVIDUAL INVOICE PAYMENT POPUP MODAL */}
      {activePayingPayable && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-purple-400" />
                <h4 className="font-bold text-sm">
                  Registrar Pago: {activePayingPayable.invoiceNumber}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActivePayingPayable(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteSinglePay} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
                <span className="text-purple-900 font-medium">Saldo Pendiente Factura:</span>
                <strong className="font-mono text-purple-700 text-sm font-extrabold">
                  {formatUSD(activePayingPayable.balanceUSD)}
                </strong>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  Monto a Pagar (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={activePayingPayable.balanceUSD}
                  required
                  value={singlePayAmount || ''}
                  onChange={(e) => setSinglePayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  ≈ {formatBs((singlePayAmount || 0) * bcvRate)}
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  Método de Pago *
                </label>
                <select
                  value={singlePaymentMethod}
                  onChange={(e) => setSinglePaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                >
                  <option value="transferencia_usd">Zelle / Transferencia USD</option>
                  <option value="transferencia_bs">Transferencia Bancaria Bs</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="divisas_efectivo">Efectivo Divisas</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  N° de Referencia / Comprobante
                </label>
                <input
                  type="text"
                  value={singlePayReference}
                  onChange={(e) => setSinglePayReference(e.target.value)}
                  placeholder="Ej. REF-123456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  value={singlePayNotes}
                  onChange={(e) => setSinglePayNotes(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePayingPayable(null)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={singlePayAmount <= 0}
                  className="px-4 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
