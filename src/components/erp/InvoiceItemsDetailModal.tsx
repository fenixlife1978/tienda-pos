import React from 'react';
import { Invoice, ReceivableItem, PaymentMethod } from '../../types';
import {
  X,
  FileText,
  Calendar,
  DollarSign,
  Package,
  History,
  CheckCircle2,
  AlertCircle,
  Building,
  User,
  CreditCard,
  Layers,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

interface InvoiceItemsDetailModalProps {
  invoice: Invoice | null;
  receivable: ReceivableItem | null;
  bcvRate: number;
  onClose: () => void;
  onPayOrLiquidate?: (receivable: ReceivableItem) => void;
}

export const InvoiceItemsDetailModal: React.FC<InvoiceItemsDetailModalProps> = ({
  invoice,
  receivable,
  bcvRate,
  onClose,
  onPayOrLiquidate,
}) => {
  if (!invoice && !receivable) return null;

  const invNumber = invoice?.invoiceNumber || receivable?.invoiceNumber || 'FACT-000000';
  const customerName = invoice?.customerName || receivable?.customerName || 'Cliente';
  const customerRif = invoice?.customerRif || '';
  const customerPhone = invoice?.customerPhone || receivable?.customerPhone || '';
  const customerAddress = invoice?.customerAddress || '';
  
  const totalUSD = invoice?.totalUSD || receivable?.totalAmountUSD || 0;
  const balanceUSD = receivable ? receivable.balanceUSD : invoice?.paymentStatus === 'pagado' ? 0 : totalUSD;
  const amountPaidUSD = receivable ? receivable.amountPaidUSD : invoice?.paymentStatus === 'pagado' ? totalUSD : 0;
  const issuedDate = invoice?.createdAt ? invoice.createdAt.split('T')[0] : receivable?.issuedDate || 'N/A';
  const dueDate = invoice?.dueDate || receivable?.dueDate || 'N/A';
  const creditDays = invoice?.creditDays || receivable?.creditDays || 15;
  const isSettled = balanceUSD <= 0.01;

  const items = invoice?.items || [];
  const paymentHistory = receivable?.paymentHistory || [];

  const formatPaymentMethod = (method?: PaymentMethod | string) => {
    switch (method) {
      case 'pago_movil':
        return 'Pago Móvil';
      case 'transferencia_bs':
        return 'Transferencia Bs';
      case 'transferencia_usd':
        return 'Zelle / Transf. USD';
      case 'divisas_efectivo':
        return 'Divisas Efectivo';
      case 'credito':
        return 'Crédito Comercial';
      default:
        return method || 'Otro';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base text-white tracking-wide">
                  {invNumber}
                </h3>
                {isSettled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Liquidada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertCircle className="w-3 h-3" /> Saldo Pendiente: {formatUSD(balanceUSD)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Detalle de Factura Comercial & Historial de Abonos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
          
          {/* Customer & Invoice Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <p className="text-slate-500 font-medium flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" /> Cliente:
              </p>
              <p className="font-bold text-slate-900 text-sm">{customerName}</p>
              {customerRif && <p className="font-mono text-slate-600">RIF: {customerRif}</p>}
              {customerPhone && <p className="text-slate-600">Telf: {customerPhone}</p>}
              {customerAddress && <p className="text-[11px] text-slate-500 truncate">{customerAddress}</p>}
            </div>

            <div className="space-y-1 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
              <div className="flex sm:justify-end items-center gap-1 text-slate-500 font-medium">
                <Calendar className="w-3 h-3 text-slate-400" /> Emisión: <span className="font-mono font-bold text-slate-800 ml-1">{issuedDate}</span>
              </div>
              <div className="flex sm:justify-end items-center gap-1 text-slate-500 font-medium">
                <Calendar className="w-3 h-3 text-amber-500" /> Vencimiento: <span className="font-mono font-bold text-amber-700 ml-1">{dueDate}</span> ({creditDays} días)
              </div>
              <div className="flex sm:justify-end items-center gap-1 text-slate-500 font-medium">
                <DollarSign className="w-3 h-3 text-indigo-500" /> Tasa de Conversión: <span className="font-mono text-slate-700 ml-1">{bcvRate.toFixed(2)} Bs/USD</span>
              </div>
            </div>
          </div>

          {/* Financial Summary Strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Monto Factura</span>
              <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{formatUSD(totalUSD)}</p>
              <p className="font-mono text-[10px] text-slate-500 mt-0.5">{formatBs(totalUSD * bcvRate)}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Abonado</span>
              <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">{formatUSD(amountPaidUSD)}</p>
              <p className="font-mono text-[10px] text-emerald-600 mt-0.5">{formatBs(amountPaidUSD * bcvRate)}</p>
            </div>
            <div className={`p-3 rounded-xl border text-center ${balanceUSD > 0.01 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${balanceUSD > 0.01 ? 'text-amber-800' : 'text-slate-500'}`}>
                Saldo Pendiente
              </span>
              <p className={`font-mono font-bold text-sm mt-0.5 ${balanceUSD > 0.01 ? 'text-amber-900' : 'text-slate-600'}`}>
                {formatUSD(balanceUSD)}
              </p>
              <p className={`font-mono text-[10px] mt-0.5 ${balanceUSD > 0.01 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                {formatBs(balanceUSD * bcvRate)}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <Package className="w-4 h-4 text-indigo-600" />
                Productos / Items Facturados ({items.length})
              </h4>
            </div>

            {items.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-400">
                Información de ítems individualizada en proceso de sincronización.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Producto / Presentación</th>
                      <th className="py-2.5 px-3 text-center">Cantidad</th>
                      <th className="py-2.5 px-3 text-right">Precio Unit. (USD)</th>
                      <th className="py-2.5 px-3 text-right">Subtotal (USD)</th>
                      <th className="py-2.5 px-3 text-right">Subtotal (Bs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, idx) => {
                      const itemSubBs = it.subtotalUSD * bcvRate;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-800">{it.productName}</p>
                            {it.presentationName && (
                              <p className="text-[10px] text-slate-500 font-medium">
                                Pres: {it.presentationName}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700 font-mono">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatUSD(it.unitPriceUSD)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {formatUSD(it.subtotalUSD)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold text-[11px]">
                            {formatBs(itemSubBs)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment / Abono History Timeline for this specific invoice */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <History className="w-4 h-4 text-emerald-600" />
              Historial de Abonos y Liquidaciones de esta Factura ({paymentHistory.length})
            </h4>

            {paymentHistory.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-400">
                Esta factura no registra abonos parciales previos.
              </div>
            ) : (
              <div className="space-y-2">
                {paymentHistory.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-900 font-mono text-xs">
                          +{formatUSD(rec.amountUSD)} USD
                        </span>
                        <span className="text-[10px] text-emerald-700 font-mono font-semibold">
                          ≈ {formatBs(rec.amountBs)}
                        </span>
                        {rec.isFullSettlement && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800 font-bold text-[9px]">
                            Liquidación Total
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {rec.notes || 'Abono registrado en CxC'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Método: <strong>{formatPaymentMethod(rec.paymentMethod)}</strong>
                        {rec.reference && <span> • Ref: <strong className="font-mono">{rec.reference}</strong></span>}
                        {rec.registeredBy && <span> • Registrado por: {rec.registeredBy}</span>}
                      </p>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <p className="text-[10px] text-slate-400 font-mono">
                        {new Date(rec.date).toLocaleDateString('es-VE')} {new Date(rec.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Saldo restante posterior: <strong className="font-mono text-slate-700">{formatUSD(rec.balanceAfterUSD)}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-slate-500 text-[11px]">
            {isSettled ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Factura 100% solvente y archivada en libros.
              </span>
            ) : (
              <span>
                Saldo por cobrar: <strong className="font-mono text-slate-900">{formatUSD(balanceUSD)} USD</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
            >
              Cerrar
            </button>
            {!isSettled && receivable && onPayOrLiquidate && (
              <button
                onClick={() => {
                  onClose();
                  onPayOrLiquidate(receivable);
                }}
                className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer shadow-xs"
              >
                Abonar / Liquidar Esta Factura
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
