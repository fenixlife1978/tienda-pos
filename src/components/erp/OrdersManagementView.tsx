import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, OrderStatus, PaymentStatus, formatPaymentMethod } from '../../types';
import {
  ClipboardList,
  Search,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  FileText,
  Phone,
  MapPin,
  CreditCard,
  Building2,
  Download,
  CheckSquare,
  FileDown,
  Loader2,
} from 'lucide-react';
import { InvoiceModal } from '../common/InvoiceModal';
import { OrderChecklistModal } from './OrderChecklistModal';
import { exportToCSV, exportElementToPDF } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';

export const OrdersManagementView: React.FC = () => {
  const {
    orders,
    invoices,
    updateOrderStatus,
    updatePaymentStatus,
    processSaleReturn,
    voidSale,
    currentUser,
    selectedInvoiceForModal,
    setSelectedInvoiceForModal,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [channelFilter, setChannelFilter] = useState<string>('todos');
  const [selectedOrderForChecklist, setSelectedOrderForChecklist] = useState<Order | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerRif.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'todos' || o.orderStatus === statusFilter;
    const matchesChannel = channelFilter === 'todos' || o.channel === channelFilter;

    return matchesSearch && matchesStatus && matchesChannel;
  });

  const handleExportOrdersCSV = () => {
    const rows = [
      ['REPORTE DE PEDIDOS Y GESTIÓN OMNICANAL'],
      ['Fecha Generación', new Date().toLocaleString('es-VE')],
      [],
      ['N° Pedido', 'Canal', 'Fecha', 'Cliente', 'RIF', 'Teléfono', 'Estado Pedido', 'Método Pago', 'Estado Pago', 'Total USD', 'Total Bs'],
      ...filteredOrders.map((o) => [
        o.orderNumber,
        o.channel === 'online' ? 'Tienda Online' : 'Punto de Venta POS',
        new Date(o.createdAt).toLocaleDateString('es-VE'),
        o.customerName,
        o.customerRif,
        o.customerPhone,
        o.orderStatus.toUpperCase(),
        formatPaymentMethod(o.paymentMethod),
        o.paymentStatus.toUpperCase(),
        formatPlainNumber(o.totalUSD, 6),
        formatPlainNumber(o.totalBs, 6),
      ]),
    ];
    exportToCSV(`Pedidos_ERP_${new Date().toISOString().split('T')[0]}`, rows);
  };

  const handleExportOrdersPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    try {
      await exportElementToPDF(
        'orders-management-table-printable',
        `Reporte_Pedidos_Ventas_${new Date().toISOString().split('T')[0]}`,
        {
          format: 'a4',
          orientation: 'landscape',
          margin: 6,
          scale: 2.2,
        }
      );
    } catch (err) {
      console.error('Error al exportar reporte de pedidos a PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleViewInvoice = (orderId: string) => {
    const inv = invoices.find((i) => i.orderId === orderId);
    if (inv) {
      setSelectedInvoiceForModal(inv);
    } else {
      alert('No se encontró factura para este pedido.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header and stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Gestión de Pedidos Omnicanal
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administre los pedidos de la tienda online y ventas de caja. Al cambiar estados se envían notificaciones al cliente en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportOrdersPDF}
            disabled={isExportingPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl transition cursor-pointer shadow-2xs"
            title="Exportar reporte de ventas y pedidos a PDF"
          >
            {isExportingPDF ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>{isExportingPDF ? 'Generando PDF...' : 'Exportar a PDF'}</span>
          </button>

          <button
            onClick={handleExportOrdersCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* Filter and search controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          <div className="relative w-full md:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por N° pedido, cliente o RIF..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
            {/* Status pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'en_tramite', label: 'En trámite' },
                { id: 'despachado_facturado', label: 'Despachado / Facturado' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Channel filter */}
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
            >
              <option value="todos">Todos los Canales</option>
              <option value="online">Solo Tienda Online</option>
              <option value="pos">Solo Punto de Venta POS</option>
            </select>
          </div>

        </div>
      </div>

      {/* Orders Table */}
      <div id="orders-management-table-printable" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Pedido / Fecha</th>
                <th className="py-3 px-4">Canal</th>
                <th className="py-3 px-4">Cliente / Contacto</th>
                <th className="py-3 px-4">Productos</th>
                <th className="py-3 px-4">Monto Total</th>
                <th className="py-3 px-4">Pago / Ref</th>
                <th className="py-3 px-4">Estado Entrega</th>
                <th className="py-3 px-4 text-center">Acciones ERP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No se encontraron pedidos con los criterios actuales.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition">
                      
                      {/* Pedido / Fecha */}
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-indigo-700">{order.orderNumber}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString('es-VE')} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>

                      {/* Canal */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            order.channel === 'online'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {order.channel === 'online' ? 'Tienda Web' : 'Caja POS'}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800">{order.customerName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">RIF: {order.customerRif}</p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-slate-400" /> {order.customerPhone}
                        </p>
                      </td>

                      {/* Productos */}
                      <td className="py-3 px-4 max-w-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForChecklist(order)}
                          className="w-full text-left group p-1.5 -m-1.5 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition cursor-pointer"
                          title="Clic para checar lista de productos y cantidades antes de aprobar"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 text-xs group-hover:text-indigo-900">
                              <Package className="w-3.5 h-3.5 text-indigo-600" />
                              {order.items.length} producto(s)
                            </span>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition">
                              Checar ↗
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate mt-1">
                            {order.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                          </p>
                        </button>
                      </td>

                      {/* Monto */}
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-slate-900">{formatUSD(order.totalUSD)}</p>
                        <p className="text-[10px] font-mono text-emerald-700 font-semibold">
                          {formatBs(order.totalBs)}
                        </p>
                      </td>

                      {/* Pago */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800">
                          {formatPaymentMethod(order.paymentMethod)}
                        </p>
                        {order.paymentReference && (
                          <p className="text-[10px] font-mono text-slate-500">
                            Ref: {order.paymentReference}
                          </p>
                        )}
                        <span
                          className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            order.paymentStatus === 'pagado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.paymentStatus === 'a_credito'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.paymentStatus.toUpperCase()}
                        </span>
                      </td>

                      {/* Estado Entrega */}
                      <td className="py-3 px-4">
                        {order.orderStatus === 'en_tramite' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> En trámite
                          </span>
                        )}
                        {order.orderStatus === 'despachado_facturado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Despachado / Facturado
                          </span>
                        )}
                      </td>

                      {/* Acciones ERP */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Botón Checar y Organizar Pedido */}
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForChecklist(order)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Checar lista de productos y cantidades para organizar antes de aprobar"
                          >
                            <Package className="w-3 h-3 text-indigo-600" />
                            <span>Checar Pedido</span>
                          </button>

                          {/* Invoice button */}
                          <button
                            type="button"
                            onClick={() => handleViewInvoice(order.id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg bg-slate-100 hover:bg-indigo-50 transition cursor-pointer"
                            title="Ver Factura Fiscal / Imprimir"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Devolución / anulación: operaciones sensibles requieren supervisor */}
                          {(currentUser.role === 'admin' || currentUser.role === 'gerente') && !order.isReturned && !order.isVoided && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const reason = window.prompt('Motivo de la devolución total:');
                                  if (!reason) return;
                                  const result = processSaleReturn(order.id, reason);
                                  alert(`${result.message}\n\nN° Devolución: ${result.returnNumber || '—'}`);
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[10px] transition cursor-pointer"
                                title="Registrar devolución total y reintegrar mercancía"
                              >
                                Devolver
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(`¿Anular definitivamente la venta ${order.orderNumber}?`)) return;
                                  const reason = window.prompt('Motivo de la anulación:');
                                  if (!reason) return;
                                  const result = voidSale(order.id, reason);
                                  alert(`${result.message}\n\nN° Anulación: ${result.voidNumber || '—'}`);
                                }}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg font-bold text-[10px] transition cursor-pointer"
                                title="Anular venta y reintegrar mercancía"
                              >
                                Anular
                              </button>
                            </>
                          )}

                          {(order.isReturned || order.isVoided) && (
                            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px]">
                              {order.isReturned ? `DEVUELTA · ${order.returnNumber || ''}` : `ANULADA · ${order.voidNumber || ''}`}
                            </span>
                          )}

                          {/* Pipeline action buttons */}
                          {order.orderStatus === 'en_tramite' && (
                            <button
                              type="button"
                              onClick={() => {
                                updateOrderStatus(order.id, 'despachado_facturado');
                                if (order.paymentStatus === 'pendiente') {
                                  updatePaymentStatus(order.id, 'pagado');
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Marcar como despachado y facturado"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Despachar</span>
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checklist and Organization Modal */}
      <OrderChecklistModal
        order={selectedOrderForChecklist}
        onClose={() => setSelectedOrderForChecklist(null)}
        onViewInvoice={handleViewInvoice}
      />

      {/* Invoice Modal */}
      <InvoiceModal
        invoice={selectedInvoiceForModal}
        onClose={() => setSelectedInvoiceForModal(null)}
      />
    </div>
  );
};
