import React from 'react';
import { PayableItem, PaymentMethod, Supplier } from '../../types';
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
  Clock,
  Phone,
  MapPin,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

interface PayableItemsDetailModalProps {
  payable: PayableItem | null;
  supplier?: Supplier | null;
  bcvRate: number;
  onClose: () => void;
  onPayOrLiquidate?: (payable: PayableItem) => void;
}

export const PayableItemsDetailModal: React.FC<PayableItemsDetailModalProps> = ({
  payable,
  supplier,
  bcvRate,
  onClose,
  onPayOrLiquidate,
}) => {
  if (!payable) return null;

  const invNumber = payable.invoiceNumber || 'COMPRA-000000';
  const supplierName = payable.supplierName || supplier?.name || 'Proveedor';
  const supplierRif = supplier?.rif || '';
  const supplierPhone = supplier?.phone || '';
  const supplierAddress = supplier?.address || '';

  const totalUSD = payable.totalAmountUSD || 0;
  const balanceUSD = payable.balanceUSD || 0;
  const amountPaidUSD = payable.amountPaidUSD || 0;
  const issuedDate = payable.issuedDate || 'N/A';
  const dueDate = payable.dueDate || 'N/A';
  const creditDays = payable.creditDays || 15;
  const isSettled = balanceUSD <= 0.01;

  const items = payable.items || [];
  const paymentHistory = payable.paymentHistory || [];

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
            <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-400/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base text-white tracking-wide">
                  {invNumber}
                </h3>
                {isSettled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Liquidada / Pagada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertCircle className="w-3 h-3" /> Saldo Pendiente: {formatUSD(balanceUSD)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Detalle de Factura de Compra / Proveedor (CxP)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Supplier & Invoice metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Datos del Proveedor
              </span>
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-purple-600" />
                {supplierName}
              </p>
              {supplierRif && <p className="text-slate-600 font-mono">RIF: {supplierRif}</p>}
              {supplierPhone && (
                <p className="text-slate-600 font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> {supplierPhone}
                </p>
              )}
              {supplierAddress && (
                <p className="text-slate-500 text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> {supplierAddress}
                </p>
              )}
            </div>

            <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Términos y Fechas de Pago
              </span>
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> Fecha Emisión:
                </span>
                <span className="font-semibold text-slate-800">{issuedDate}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Vencimiento:
                </span>
                <span className="font-semibold text-slate-800">{dueDate}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-slate-400" /> Plazo Crédito:
                </span>
                <span className="font-semibold text-purple-700">{creditDays} días</span>
              </div>
            </div>
          </div>

          {/* Purchased Items Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-purple-600" />
              Artículos / Bienes Facturados ({items.length})
            </h4>

            {items.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                Esta compra fue registrada como factura global de inventario / servicios sin desglose de renglones específicos.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Producto / Concepto</th>
                      <th className="py-2.5 px-3 text-center">Cant.</th>
                      <th className="py-2.5 px-3 text-right">Costo Unit. (USD)</th>
                      <th className="py-2.5 px-3 text-right">Subtotal (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {formatUSD(item.unitCostUSD || item.unitPriceUSD || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {formatUSD(item.totalUSD)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Financial Totals Summary */}
          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Monto Total de la Factura:</span>
              <strong className="font-mono text-slate-900 text-sm">{formatUSD(totalUSD)}</strong>
            </div>
            <div className="flex justify-between items-center text-emerald-700">
              <span>Total Abonado / Pagado:</span>
              <strong className="font-mono text-emerald-700">-{formatUSD(amountPaidUSD)}</strong>
            </div>
            <div className="border-t border-purple-200/60 pt-2 flex justify-between items-center">
              <span className="font-bold text-slate-900">Saldo Pendiente por Pagar:</span>
              <div className="text-right">
                <span className={`font-mono font-extrabold text-base ${balanceUSD > 0.01 ? 'text-purple-700' : 'text-emerald-600'}`}>
                  {formatUSD(balanceUSD)}
                </span>
                {balanceUSD > 0.01 && (
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    ≈ {formatBs(balanceUSD * bcvRate)} (Tasa: {bcvRate.toFixed(2)} Bs)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payment / Abonos History */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-purple-600" />
              Historial de Pagos y Abonos Registrados ({paymentHistory.length})
            </h4>

            {paymentHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                Aún no se han registrado abonos ni pagos para esta factura de compra.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {paymentHistory.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {formatPaymentMethod(pay.paymentMethod)}
                        </span>
                        {pay.isFullSettlement && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                            Liquidación Total
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {pay.date.split('T')[0]} {pay.date.includes('T') ? pay.date.split('T')[1].substring(0, 5) : ''}
                        {pay.reference && ` • Ref: ${pay.reference}`}
                      </p>
                      {pay.notes && (
                        <p className="text-[11px] text-slate-600 italic">"{pay.notes}"</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-emerald-700 text-sm">
                        +{formatUSD(pay.amountUSD)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {formatBs(pay.amountBs)}
                      </p>
                      {pay.balanceAfterUSD !== undefined && (
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          Saldo restante: {formatUSD(pay.balanceAfterUSD)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cerrar
          </button>

          {!isSettled && onPayOrLiquidate && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onPayOrLiquidate(payable);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Abonar / Liquidar Esta Factura
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
