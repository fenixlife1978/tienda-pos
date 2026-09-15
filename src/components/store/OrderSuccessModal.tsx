import React, { useState } from 'react';
import { Order, Invoice, formatPaymentMethod } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle2,
  X,
  MessageCircle,
  Share2,
  FileText,
  Clock,
  Truck,
  Phone,
  Mail,
  MapPin,
  Copy,
  Check,
  Package,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';
import {
  getOrderWhatsAppUrl,
  buildOrderWhatsAppMessage,
  STORE_PHONE_DISPLAY,
  STORE_EMAIL,
  STORE_ADDRESS,
} from '../../utils/whatsappUtils';

interface OrderSuccessModalProps {
  isOpen: boolean;
  order: Order | null;
  invoice?: Invoice | null;
  onClose: () => void;
  onViewInvoice?: () => void;
  onViewOrders?: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  order,
  invoice,
  onClose,
  onViewInvoice,
  onViewOrders,
}) => {
  const { settings } = useApp();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const whatsappUrl = getOrderWhatsAppUrl(order, settings);

  const handleCopySummary = async () => {
    try {
      const text = buildOrderWhatsAppMessage(order, settings);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error copying order summary:', err);
    }
  };

  const contactPhone = settings.companyPhone || STORE_PHONE_DISPLAY;
  const contactEmail = settings.companyEmail || STORE_EMAIL;
  const contactAddress = settings.companyAddress || STORE_ADDRESS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-emerald-50/80 to-white border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs ring-4 ring-emerald-50">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider mb-1">
                <Clock className="w-3 h-3 text-emerald-600 animate-pulse" /> En trámite de despacho
              </span>
              <h2 className="text-xl font-bold text-slate-900">¡Pedido Registrado con Éxito!</h2>
              <p className="text-xs text-slate-500">
                Orden N° <strong className="font-mono text-blue-700">{order.orderNumber}</strong> • {new Date(order.createdAt).toLocaleDateString('es-VE')} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* WhatsApp Share Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-200" />
                  Compartir Pedido por WhatsApp
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5 leading-relaxed">
                  Envía el resumen de tu pedido directamente a nuestro equipo de ventas para agilizar la validación del pago y la asignación del despacho.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-white hover:bg-emerald-50 text-emerald-800 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                id="share-whatsapp-btn"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Enviar al WhatsApp de Ventas ({contactPhone})</span>
              </a>

              <button
                type="button"
                onClick={handleCopySummary}
                className="py-3 px-4 bg-emerald-700/80 hover:bg-emerald-700 text-white font-medium rounded-xl border border-emerald-500/50 transition flex items-center justify-center gap-1.5 text-xs cursor-pointer shrink-0"
                title="Copiar texto del pedido"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
          </div>

          {/* Store Sales Team Contact Information Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
            <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Equipo de Ventas y Atención al Cliente:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-slate-600">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">Teléfono Directo / WhatsApp:</p>
                  <a
                    href={`https://wa.me/584245751804`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-slate-800 hover:text-emerald-700 transition"
                  >
                    {contactPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">Correo Electrónico:</p>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="font-bold text-slate-800 hover:text-blue-700 transition truncate block max-w-[170px]"
                  >
                    {contactEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">Ubicación / Sede:</p>
                  <p className="font-bold text-slate-800 text-[11px] leading-tight">
                    {contactAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Details Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Resumen de la Orden
              </h4>
              <span className="font-mono text-slate-500">{order.items.length} producto(s)</span>
            </div>

            {/* Customer & Delivery Data */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/50">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Cliente:</p>
                <p className="font-bold text-slate-900">{order.customerName}</p>
                <p className="text-slate-500 font-mono">RIF/CI: {order.customerRif}</p>
                <p className="text-slate-500">Tel: {order.customerPhone}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Despacho / Entrega:</p>
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  {order.customerAddress}
                </p>
                <p className="text-slate-500 mt-0.5">
                  Método de Pago: <strong className="text-slate-800 capitalize">{formatPaymentMethod(order.paymentMethod)}</strong>
                </p>
                {order.paymentReference && (
                  <p className="text-slate-600 font-mono">
                    Ref: <span className="font-bold">{order.paymentReference}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="p-4 space-y-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                Artículos Solicitados:
              </p>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                {order.items.map((item, idx) => {
                  const lineBs = item.subtotalUSD * order.bcvRate;
                  return (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                          {item.quantity}x
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatUSD(item.unitPriceUSD)} USD c/u
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <p className="font-bold text-slate-900">{formatUSD(item.subtotalUSD)} USD</p>
                        <p className="text-[10px] text-slate-500">({formatBs(lineBs)})</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Base Imponible:</span>
                <span className="font-mono font-medium">{formatUSD(order.subtotalUSD)} USD</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IVA (16%):</span>
                <span className="font-mono font-medium">{formatUSD(order.taxUSD)} USD</span>
              </div>
              <div className="flex justify-between items-center text-sm font-extrabold text-blue-900 pt-1.5 border-t border-slate-200">
                <span>Total Pedido (USD):</span>
                <span className="font-mono text-base text-blue-700">{formatUSD(order.totalUSD)} USD</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 px-3 py-2 rounded-lg text-emerald-900 font-bold border border-emerald-200">
                <span>Total a Cancelar en Bolívares:</span>
                <div className="text-right">
                  <span className="font-mono text-sm">{formatBs(order.totalBs)}</span>
                  <p className="text-[10px] text-emerald-700 font-normal font-sans">
                    Tasa Oficial BCV: {order.bcvRate.toFixed(2)} Bs/$
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Secondary Actions */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {onViewInvoice && (
                <button
                  type="button"
                  onClick={onViewInvoice}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl font-medium transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ver Factura Fiscal</span>
                </button>
              )}

              {onViewOrders && (
                <button
                  type="button"
                  onClick={onViewOrders}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl font-medium transition cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5 text-slate-600" />
                  <span>Mis Pedidos</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition cursor-pointer"
            >
              Cerrar y Seguir Comprando
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
