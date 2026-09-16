import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, formatPaymentMethod } from '../../types';
import {
  X,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  FileText,
  Printer,
  Phone,
  MapPin,
  Building2,
  CreditCard,
  AlertTriangle,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { printElement } from '../../utils/exportUtils';
import { playNotificationSound } from '../../utils/notificationSound';

interface OrderChecklistModalProps {
  order: Order | null;
  onClose: () => void;
  onViewInvoice?: (orderId: string) => void;
}

export const OrderChecklistModal: React.FC<OrderChecklistModalProps> = ({
  order,
  onClose,
  onViewInvoice,
}) => {
  const { products, updateOrderStatus, updatePaymentStatus, triggerPushNotification, settings } = useApp();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [justApproved, setJustApproved] = useState(false);

  // Initialize or reset checklist when order changes
  useEffect(() => {
    if (order) {
      setJustApproved(false);
      // Default: if already dispatched, mark all as checked; otherwise all unchecked
      const initial: Record<string, boolean> = {};
      order.items.forEach((item, index) => {
        const key = `${item.productId}-${index}`;
        initial[key] = order.orderStatus === 'despachado_facturado';
      });
      setCheckedItems(initial);
    }
  }, [order]);

  if (!order) return null;

  const totalItemsCount = order.items.length;
  const checkedItemsCount = Object.values(checkedItems).filter(Boolean).length;
  const allChecked = totalItemsCount > 0 && checkedItemsCount === totalItemsCount;
  const progressPercent = totalItemsCount > 0 ? Math.round((checkedItemsCount / totalItemsCount) * 100) : 0;

  const toggleItem = (key: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleAll = () => {
    const nextState = !allChecked;
    const updated: Record<string, boolean> = {};
    order.items.forEach((item, index) => {
      const key = `${item.productId}-${index}`;
      updated[key] = nextState;
    });
    setCheckedItems(updated);
  };

  const handleApproveOrder = () => {
    updateOrderStatus(order.id, 'despachado_facturado');
    if (order.paymentStatus === 'pendiente') {
      updatePaymentStatus(order.id, 'pagado');
    }
    setJustApproved(true);
    playNotificationSound('cash');
    triggerPushNotification({
      title: '¡Pedido Aprobado y Organizado!',
      message: `El pedido ${order.orderNumber} para ${order.customerName} ha sido verificado y aprobado para despacho.`,
      type: 'order_status',
      relatedOrderId: order.id,
    });
  };

  const handlePrintPackingSlip = () => {
    printElement('printable-order-checklist-content');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center shrink-0 shadow-xs">
              <Package className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-lg tracking-tight text-white">
                  Chequeo y Organización de Pedido
                </h3>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {order.orderNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    order.channel === 'online'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  }`}
                >
                  {order.channel === 'online' ? 'Tienda Online' : 'Punto de Venta POS'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Revise, organice y verifique las cantidades físicas antes de aprobar el despacho final.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPackingSlip}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Imprimir Hoja de Preparación / Packing Slip"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir Hoja</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Status Alert Banner if just approved */}
          {justApproved && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold">¡Pedido Aprobado Exitosamente!</p>
                  <p className="text-[11px] text-emerald-700">El estado cambió a "Despachado / Facturado" y el cliente ha sido notificado.</p>
                </div>
              </div>
              {onViewInvoice && (
                <button
                  type="button"
                  onClick={() => onViewInvoice(order.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ver Factura</span>
                </button>
              )}
            </div>
          )}

          {/* Customer and Order Metadata Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Customer info */}
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Datos del Cliente</p>
              <p className="text-sm font-bold text-slate-900">{order.customerName}</p>
              <p className="text-slate-600 font-mono">RIF/Cédula: {order.customerRif}</p>
              <p className="text-slate-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" /> {order.customerPhone || 'N/A'}
              </p>
              <p className="text-slate-600 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {order.customerAddress || 'Entrega en tienda'}
              </p>
            </div>

            {/* Payment info */}
            <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Condiciones de Pago</p>
              <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                <span>{formatPaymentMethod(order.paymentMethod)}</span>
              </div>
              {order.paymentReference && (
                <p className="text-slate-600 font-mono">Referencia: {order.paymentReference}</p>
              )}
              <div className="pt-1 flex items-center gap-2">
                <span className="text-slate-500">Estado Pago:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    order.paymentStatus === 'pagado'
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.paymentStatus === 'a_credito'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {order.paymentStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Tasa BCV: <span className="font-mono font-bold text-slate-700">{formatPlainNumber(order.bcvRate, 2)} Bs/USD</span>
              </p>
            </div>

            {/* Order status & totals summary */}
            <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado & Total</p>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Estado Pedido:</span>
                {order.orderStatus === 'en_tramite' && !justApproved ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                    <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> En trámite (Por Aprobar)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Despachado / Facturado
                  </span>
                )}
              </div>
              <div className="pt-2">
                <p className="text-[11px] text-slate-500">Total a Facturar:</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {formatUSD(order.totalUSD)}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 font-mono">
                    {formatBs(order.totalBs)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            
            {/* Checklist Header and Controls */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>Productos y Cantidades a Organizar ({totalItemsCount})</span>
                  <span className="text-xs font-semibold text-slate-500">
                    ({checkedItemsCount} de {totalItemsCount} listos)
                  </span>
                </h4>
                {/* Progress bar */}
                <div className="w-48 bg-slate-200 h-2 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      allChecked ? 'bg-emerald-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  {allChecked ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                      <span>Desmarcar Todos</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Marcar Todos como Listos</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Checklist Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 text-center w-12">Listo</th>
                    <th className="py-2.5 px-3">Producto / Presentación</th>
                    <th className="py-2.5 px-3 text-center">Cantidad Pedida</th>
                    <th className="py-2.5 px-3 text-center">Stock Disponible</th>
                    <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item, index) => {
                    const key = `${item.productId}-${index}`;
                    const isChecked = !!checkedItems[key];
                    const matchedProduct = products.find((p) => p.id === item.productId);
                    const currentStock = matchedProduct ? matchedProduct.stock : null;
                    const isStockLow = currentStock !== null && currentStock < item.quantity;

                    return (
                      <tr
                        key={key}
                        onClick={() => toggleItem(key)}
                        className={`transition cursor-pointer select-none ${
                          isChecked
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(key)}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* Product info */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            {matchedProduct?.image ? (
                              <img
                                src={matchedProduct.image}
                                alt={item.productName}
                                className="w-9 h-9 object-cover rounded-lg border border-slate-200 shrink-0 bg-white"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <p className={`font-bold ${isChecked ? 'text-emerald-950 line-through' : 'text-slate-800'}`}>
                                {item.productName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                {matchedProduct?.code && (
                                  <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                                    Cód: {matchedProduct.code}
                                  </span>
                                )}
                                {item.presentationName && (
                                  <span className="bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.2 rounded">
                                    {item.presentationName}
                                  </span>
                                )}
                                {item.customNote && (
                                  <span className="text-amber-700 italic">
                                    Nota: {item.customNote}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Cantidad Pedida */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-mono font-extrabold text-sm border border-indigo-200 shadow-2xs">
                            {item.quantity} {item.quantity === 1 ? 'un' : 'uns'}
                          </span>
                        </td>

                        {/* Stock Disponible */}
                        <td className="py-3 px-3 text-center">
                          {currentStock !== null ? (
                            <div>
                              <span
                                className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                  isStockLow
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {isStockLow && <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                                {currentStock} en almacén
                              </span>
                              {isStockLow && (
                                <p className="text-[9px] text-rose-600 font-bold mt-0.5">
                                  ¡Stock menor al pedido!
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">No registrado</span>
                          )}
                        </td>

                        {/* Unit Price */}
                        <td className="py-3 px-3 text-right font-mono">
                          <p className="font-semibold text-slate-700">{formatUSD(item.unitPriceUSD)}</p>
                          <p className="text-[10px] text-slate-400">{formatBs(item.unitPriceUSD * order.bcvRate)}</p>
                        </td>

                        {/* Subtotal */}
                        <td className="py-3 px-3 text-right font-mono">
                          <p className="font-bold text-slate-900">{formatUSD(item.subtotalUSD)}</p>
                          <p className="text-[10px] font-semibold text-emerald-700">{formatBs(item.subtotalUSD * order.bcvRate)}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer with financial totals */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-700">{totalItemsCount}</span> producto(s) en este pedido.
                {allChecked && (
                  <span className="text-emerald-700 font-bold ml-2">
                    ✓ Todos los productos han sido verificados físicamente.
                  </span>
                )}
              </div>

              <div className="w-full sm:w-auto text-xs space-y-1 bg-white p-3 rounded-lg border border-slate-200 min-w-[240px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Base:</span>
                  <span className="font-mono font-medium">{formatUSD(order.subtotalUSD)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>IVA (16%):</span>
                  <span className="font-mono font-medium">{formatUSD(order.taxUSD)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1 text-sm">
                  <span>Total Pedido:</span>
                  <div className="text-right">
                    <span className="font-mono">{formatUSD(order.totalUSD)}</span>
                    <p className="text-[11px] text-emerald-700 font-mono font-semibold">{formatBs(order.totalBs)}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onViewInvoice && (
              <button
                type="button"
                onClick={() => onViewInvoice(order.id)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs w-full sm:w-auto justify-center"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Ver Factura Fiscal</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrintPackingSlip}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs w-full sm:w-auto justify-center"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimir Hoja de Despacho</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer w-full sm:w-auto"
            >
              Cerrar
            </button>

            {/* Approval button if en_tramite */}
            {order.orderStatus === 'en_tramite' && !justApproved && (
              <button
                type="button"
                onClick={handleApproveOrder}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Aprobar y Despachar Pedido</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Hidden Print Slip Content for Printing */}
      <div id="printable-order-checklist-content" className="hidden print:block p-8 bg-white text-black font-sans">
        <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase">{settings.companyName}</h1>
            <p className="text-xs">RIF: {settings.companyRif}</p>
            <p className="text-xs">{settings.address}</p>
            <p className="text-xs">Tel: {settings.phone}</p>
          </div>
          <div className="text-right">
            <h2 className="text-base font-bold uppercase text-indigo-900">HOJA DE DESPACHO / PACKING SLIP</h2>
            <p className="text-sm font-mono font-bold">N° Pedido: {order.orderNumber}</p>
            <p className="text-xs">Fecha: {new Date(order.createdAt).toLocaleDateString('es-VE')} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-xs">Canal: {order.channel === 'online' ? 'Tienda Online' : 'Punto de Venta'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs mb-4 p-3 bg-gray-50 border border-gray-300">
          <div>
            <p className="font-bold uppercase text-gray-700">Cliente:</p>
            <p className="font-semibold text-sm">{order.customerName}</p>
            <p>RIF: {order.customerRif}</p>
            <p>Tel: {order.customerPhone}</p>
            <p>Dirección: {order.customerAddress}</p>
          </div>
          <div>
            <p className="font-bold uppercase text-gray-700">Detalles de Facturación:</p>
            <p>Condición: {formatPaymentMethod(order.paymentMethod)}</p>
            <p>Estado Pago: {order.paymentStatus.toUpperCase()}</p>
            {order.paymentReference && <p>Ref Pago: {order.paymentReference}</p>}
            <p>Tasa BCV: {formatPlainNumber(order.bcvRate, 2)} Bs/USD</p>
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse border border-gray-300 mb-6">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 font-bold">
              <th className="p-2 border-r border-gray-300 w-10 text-center">[ ✓ ]</th>
              <th className="p-2 border-r border-gray-300">Producto / Código</th>
              <th className="p-2 border-r border-gray-300 text-center">Cantidad Pedida</th>
              <th className="p-2 border-r border-gray-300 text-right">Precio Unit. USD</th>
              <th className="p-2 text-right">Subtotal USD</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="p-2 border-r border-gray-300 text-center font-mono">[  ]</td>
                <td className="p-2 border-r border-gray-300">
                  <p className="font-bold">{it.productName}</p>
                  {it.presentationName && <p className="text-[10px] text-gray-500">{it.presentationName}</p>}
                </td>
                <td className="p-2 border-r border-gray-300 text-center font-bold text-sm">
                  {it.quantity} un
                </td>
                <td className="p-2 border-r border-gray-300 text-right font-mono">
                  {formatUSD(it.unitPriceUSD)}
                </td>
                <td className="p-2 text-right font-mono font-bold">
                  {formatUSD(it.subtotalUSD)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between items-start text-xs pt-4 border-t border-gray-300">
          <div className="space-y-6">
            <p className="italic text-gray-600">Verificado y Organizado por: _____________________________</p>
            <p className="italic text-gray-600">Recibido Conforme Cliente: _______________________________</p>
          </div>
          <div className="text-right space-y-1 min-w-[200px]">
            <div className="flex justify-between font-semibold">
              <span>Subtotal:</span>
              <span className="font-mono">{formatUSD(order.subtotalUSD)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>IVA (16%):</span>
              <span className="font-mono">{formatUSD(order.taxUSD)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-300">
              <span>Total USD:</span>
              <span className="font-mono">{formatUSD(order.totalUSD)}</span>
            </div>
            <div className="flex justify-between font-bold text-xs text-gray-700">
              <span>Total Bs:</span>
              <span className="font-mono">{formatBs(order.totalBs)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
