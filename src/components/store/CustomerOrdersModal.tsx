import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, OrderStatus } from '../../types';
import {
  X,
  History,
  Repeat,
  FileText,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Download,
  Printer,
} from 'lucide-react';
import { InvoiceModal } from '../common/InvoiceModal';

export const CustomerOrdersModal: React.FC = () => {
  const {
    isOrdersModalOpen,
    setIsOrdersModalOpen,
    orders,
    currentCustomer,
    invoices,
    reorder,
    selectedInvoiceForModal,
    setSelectedInvoiceForModal,
  } = useApp();

  const [selectedStatus, setSelectedStatus] = useState<string>('todos');

  if (!isOrdersModalOpen) return null;

  // Filter orders for the active customer or show all if in demo mode
  const customerOrders = currentCustomer
    ? orders.filter((o) => o.customerId === currentCustomer.id)
    : orders;

  const filteredOrders = customerOrders.filter((o) => {
    if (selectedStatus === 'todos') return true;
    return o.orderStatus === selectedStatus;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'en_tramite':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 animate-pulse text-amber-600" /> En trámite
          </span>
        );
      case 'despachado_facturado':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Despachado / Facturado
          </span>
        );
      default:
        return null;
    }
  };

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'en_tramite':
        return 0;
      case 'despachado_facturado':
        return 1;
      default:
        return 0;
    }
  };

  const handleOpenInvoice = (orderId: string) => {
    const inv = invoices.find((i) => i.orderId === orderId);
    if (inv) {
      setSelectedInvoiceForModal(inv);
    } else {
      alert('No se encontró factura asociada a este pedido.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden my-6 border border-slate-200 flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Historial de Compras y Pedidos</h3>
                <p className="text-xs text-slate-500">
                  Consulta el progreso de entrega en tiempo real, vuelve a pedir en 1 clic y descarga facturas fiscales.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOrdersModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="font-semibold text-slate-500 mr-2">Filtrar:</span>
            {['todos', 'en_tramite', 'despachado_facturado'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status === 'todos' ? 'Todos' : status === 'en_tramite' ? 'En trámite' : 'Despachado / Facturado'}
              </button>
            ))}
          </div>

          {/* Orders List Content */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-semibold text-slate-700">No hay pedidos registrados en esta sección</p>
                <p className="text-xs text-slate-400 mt-1">Realiza tu primera compra desde el catálogo online.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const currentStep = getStepIndex(order.orderStatus);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition overflow-hidden"
                  >
                    {/* Order card top bar */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-blue-700 text-sm">
                          {order.orderNumber}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString('es-VE')} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-slate-400">|</span>
                        <span className="text-xs font-medium text-slate-600 capitalize">
                          Canal: {order.channel === 'online' ? 'Tienda Online' : 'Punto de Venta (POS)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusBadge(order.orderStatus)}
                      </div>
                    </div>

                    {/* Live Delivery Progress Tracker */}
                    <div className="p-4 border-b border-slate-100 bg-white">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Seguimiento en Tiempo Real del Despacho:
                      </p>

                      <div className="flex items-center justify-between max-w-sm mx-auto relative py-2">
                        <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-slate-200 z-0">
                          <div
                            className={`h-full transition-all duration-500 ${
                              order.orderStatus === 'despachado_facturado' ? 'bg-emerald-500 w-full' : 'bg-amber-500 w-1/2'
                            }`}
                          ></div>
                        </div>

                        {/* Step 1: En trámite */}
                        <div className="relative z-10 flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold ring-4 ring-amber-100">
                            <Clock className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-800 mt-1.5 leading-tight">
                            1. En trámite
                          </span>
                          <span className="text-[10px] text-slate-500">Revisión y Empaque</span>
                        </div>

                        {/* Step 2: Despachado / Facturado */}
                        <div className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                              order.orderStatus === 'despachado_facturado'
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            <Truck className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-800 mt-1.5 leading-tight">
                            2. Despachado / Facturado
                          </span>
                          <span className="text-[10px] text-slate-500">Factura y Despacho</span>
                        </div>
                      </div>

                      {order.estimatedDelivery && order.orderStatus === 'en_tramite' && (
                        <div className="mt-3 p-2 rounded-lg bg-blue-50 text-blue-800 text-xs flex items-center justify-between">
                          <span>Estimado de llegada: <strong>{order.estimatedDelivery}</strong></span>
                          {order.notes && <span className="text-slate-500 italic truncate max-w-xs">{order.notes}</span>}
                        </div>
                      )}
                    </div>

                    {/* Items List inside card */}
                    <div className="p-4 space-y-2">
                      <div className="divide-y divide-slate-100 text-xs">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="py-1.5 flex justify-between items-center">
                            <span className="text-slate-800 font-medium">
                              {item.quantity}x {item.productName}
                            </span>
                            <div className="text-right font-mono">
                              <span className="text-slate-900 font-semibold">${item.subtotalUSD.toFixed(2)}</span>
                              <span className="text-slate-400 text-[10px] ml-1">
                                ({(item.subtotalUSD * order.bcvRate).toFixed(2)} Bs)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Payment and Financial info */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-600 space-y-0.5">
                          <p>
                            Método de Pago: <strong className="capitalize">{order.paymentMethod.replace('_', ' ')}</strong>
                            {order.paymentReference && ` (Ref: ${order.paymentReference})`}
                          </p>
                          {order.creditDueDate && (
                            <p className="text-amber-700 font-semibold">
                              Vencimiento Crédito: {order.creditDueDate} ({order.creditDays || 15} días)
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-base font-extrabold text-blue-900 font-mono">
                            ${order.totalUSD.toFixed(2)} USD
                          </p>
                          <p className="text-xs font-semibold text-emerald-700 font-mono">
                            {order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar (Reorder in 1-Click + View/Download Invoice) */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                      <button
                        onClick={() => handleOpenInvoice(order.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ver / Descargar Factura</span>
                      </button>

                      <button
                        onClick={() => reorder(order.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                        title="Vuelve a cargar los productos de esta compra al carrito"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                        <span>Volver a pedir</span>
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Footer */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={() => setIsOrdersModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer transition"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>

      {/* Embedded Invoice Modal */}
      <InvoiceModal
        invoice={selectedInvoiceForModal}
        onClose={() => setSelectedInvoiceForModal(null)}
      />
    </>
  );
};
