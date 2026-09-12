import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, OrderStatus, PaymentStatus } from '../../types';
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
} from 'lucide-react';
import { InvoiceModal } from '../common/InvoiceModal';
import { exportToCSV } from '../../utils/exportUtils';

export const OrdersManagementView: React.FC = () => {
  const {
    orders,
    invoices,
    updateOrderStatus,
    updatePaymentStatus,
    selectedInvoiceForModal,
    setSelectedInvoiceForModal,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [channelFilter, setChannelFilter] = useState<string>('todos');

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
        o.paymentMethod,
        o.paymentStatus.toUpperCase(),
        o.totalUSD.toFixed(2),
        o.totalBs.toFixed(2),
      ]),
    ];
    exportToCSV(`Pedidos_ERP_${new Date().toISOString().split('T')[0]}`, rows);
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

        <button
          onClick={handleExportOrdersCSV}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-2xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          Exportar Lista a Excel
        </button>
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
                { id: 'pendiente', label: 'Pendientes' },
                { id: 'en_preparacion', label: 'En Preparación' },
                { id: 'en_camino', label: 'En Camino' },
                { id: 'entregado', label: 'Entregados' },
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
                        <p className="font-medium text-slate-700">
                          {order.items.length} producto(s)
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {order.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                        </p>
                      </td>

                      {/* Monto */}
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-slate-900">${order.totalUSD.toFixed(2)}</p>
                        <p className="text-[10px] font-mono text-emerald-700 font-semibold">
                          {order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs
                        </p>
                      </td>

                      {/* Pago */}
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-700 capitalize">
                          {order.paymentMethod.replace('_', ' ')}
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
                        {order.orderStatus === 'pendiente' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> Pendiente
                          </span>
                        )}
                        {order.orderStatus === 'en_preparacion' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                            <Package className="w-3 h-3 text-blue-600" /> En Preparación
                          </span>
                        )}
                        {order.orderStatus === 'en_camino' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                            <Truck className="w-3 h-3 text-purple-600" /> En Camino
                          </span>
                        )}
                        {order.orderStatus === 'entregado' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Entregado
                          </span>
                        )}
                        {order.orderStatus === 'cancelado' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                            <XCircle className="w-3 h-3 text-rose-600" /> Cancelado
                          </span>
                        )}
                      </td>

                      {/* Acciones ERP */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Invoice button */}
                          <button
                            onClick={() => handleViewInvoice(order.id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded bg-slate-100 hover:bg-indigo-50 transition cursor-pointer"
                            title="Ver Factura Fiscal / Imprimir"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Pipeline action buttons */}
                          {order.orderStatus === 'pendiente' && (
                            <button
                              onClick={() => {
                                updateOrderStatus(order.id, 'en_preparacion');
                                if (order.paymentStatus === 'pendiente') {
                                  updatePaymentStatus(order.id, 'pagado');
                                }
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-[10px] transition cursor-pointer"
                              title="Aprobar pedido y pasar a preparación"
                            >
                              Aprobar
                            </button>
                          )}

                          {order.orderStatus === 'en_preparacion' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'en_camino')}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-[10px] transition cursor-pointer"
                              title="Asignar a motorizado / Despachar"
                            >
                              Despachar
                            </button>
                          )}

                          {order.orderStatus === 'en_camino' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'entregado')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[10px] transition cursor-pointer"
                              title="Confirmar entrega al cliente"
                            >
                              Entregado
                            </button>
                          )}

                          {order.orderStatus !== 'entregado' && order.orderStatus !== 'cancelado' && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Está seguro de anular el pedido ${order.orderNumber}?`)) {
                                  updateOrderStatus(order.id, 'cancelado');
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                              title="Anular Pedido"
                            >
                              <XCircle className="w-4 h-4" />
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

      {/* Invoice Modal */}
      <InvoiceModal
        invoice={selectedInvoiceForModal}
        onClose={() => setSelectedInvoiceForModal(null)}
      />
    </div>
  );
};
