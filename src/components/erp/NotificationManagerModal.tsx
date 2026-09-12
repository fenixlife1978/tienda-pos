import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Bell,
  Send,
  Sparkles,
  AlertTriangle,
  Package,
  CreditCard,
  TrendingUp,
  CheckCircle2,
  Users,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { playNotificationSound } from '../../utils/notificationSound';

interface NotificationManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationManagerModal: React.FC<NotificationManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    customers,
    orders,
    products,
    receivables,
    settings,
    broadcastPushNotification,
    notifications,
    markNotificationAsRead,
    clearAllNotifications,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'broadcast' | 'alerts'>('broadcast');

  // Broadcast state
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'credit' | string>('all');
  const [broadcastType, setBroadcastType] = useState<'promotion' | 'order_status' | 'credit_alert' | 'custom_broadcast'>('promotion');
  const [broadcastTitle, setBroadcastTitle] = useState('🔥 ¡Mega Promoción de Fin de Semana!');
  const [broadcastMessage, setBroadcastMessage] = useState('Aprovecha hasta un 25% de descuento en víveres y charcutería seleccionada. ¡Haz tu pedido online ahora!');
  const [broadcastBadge, setBroadcastBadge] = useState('Oferta Flash');
  const [sendSuccess, setSendSuccess] = useState(false);

  if (!isOpen) return null;

  // Critical seller alerts
  const pendingOrders = orders.filter((o) => o.orderStatus === 'pendiente');
  const lowStockItems = products.filter((p) => p.stock <= p.minStock);
  const overdueReceivables = receivables.filter((r) => r.status === 'vencido');

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    broadcastPushNotification({
      title: broadcastTitle.trim(),
      message: broadcastMessage.trim(),
      type: broadcastType,
      targetRole: 'client',
      targetCustomerId: broadcastTarget.startsWith('cust-') ? broadcastTarget : undefined,
      badge: broadcastBadge.trim() || undefined,
    });

    playNotificationSound(broadcastType === 'promotion' ? 'promotion' : 'order_status');
    setSendSuccess(true);
    setTimeout(() => {
      setSendSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-400">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base">Centro de Notificaciones & Alertas ERP</h3>
              <p className="text-xs text-slate-300">
                Envía notificaciones push en tiempo real a tus clientes y monitorea alertas críticas de la empresa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'broadcast'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Emitir Push a Clientes (Promociones / Avisos)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 relative ${
              activeTab === 'alerts'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Alertas del Vendedor en Dashboard</span>
            {(pendingOrders.length > 0 || lowStockItems.length > 0 || overdueReceivables.length > 0) && (
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {activeTab === 'broadcast' ? (
            /* BROADCAST TAB */
            <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
              {sendSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>¡Notificación Push enviada en tiempo real a los clientes seleccionados!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Audiencia Destinataria *
                  </label>
                  <select
                    value={broadcastTarget}
                    onChange={(e) => setBroadcastTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">📢 Todos los Clientes Registrados ({customers.length})</option>
                    <option value="credit">💳 Clientes con Crédito Activo ({customers.filter((c) => c.hasCredit).length})</option>
                    <optgroup label="Cliente Específico:">
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.rif})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tipo de Notificación *
                  </label>
                  <select
                    value={broadcastType}
                    onChange={(e) => setBroadcastType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="promotion">✨ Promoción / Oferta Especial</option>
                    <option value="order_status">📦 Actualización de Despachos / Logística</option>
                    <option value="credit_alert">⚠️ Alerta de Crédito o Recordatorio de Pago</option>
                    <option value="custom_broadcast">💬 Comunicado Comercial General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Título de la Notificación Push *
                  </label>
                  <input
                    type="text"
                    required
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Ej. 🔥 20% Descuento en Harinas y Pastas"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Etiqueta / Badge
                  </label>
                  <input
                    type="text"
                    value={broadcastBadge}
                    onChange={(e) => setBroadcastBadge(e.target.value)}
                    placeholder="Ej. Oferta Flash"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mensaje Detallado *
                </label>
                <textarea
                  required
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Escribe el mensaje persuasivo o informativo que aparecerá en pantalla..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Push Live Preview Card */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Vista Previa del Toast Push en el Móvil/Navegador del Cliente:
                </p>
                <div className="flex items-start gap-3 bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                  <div className="p-2 rounded-lg bg-rose-600/30 text-rose-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-bold">
                        {settings.companyName}
                      </span>
                      {broadcastBadge && (
                        <span className="text-[9px] bg-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                          {broadcastBadge}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-400 ml-auto">Ahora</span>
                    </div>
                    <p className="text-xs font-bold text-white mt-1">{broadcastTitle}</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">{broadcastMessage}</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Emitir Notificación Push en Tiempo Real</span>
              </button>
            </form>
          ) : (
            /* SELLER ALERTS TAB */
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-700">
                  Alertas Operativas y Financieras del Sistema:
                </p>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="text-[11px] text-slate-500 hover:text-rose-600 transition cursor-pointer"
                  >
                    Limpiar historial
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Pending orders alert box */}
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-800">Pedidos Nuevos</span>
                    <Package className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-amber-900">{pendingOrders.length}</p>
                  <p className="text-[10px] text-amber-700">Requieren aprobación y despacho</p>
                </div>

                {/* Stock alert box */}
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-800">Stock Crítico</span>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-rose-900">{lowStockItems.length}</p>
                  <p className="text-[10px] text-rose-700">Productos por debajo del mínimo</p>
                </div>

                {/* Overdue receivables */}
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-800">Créditos Vencidos</span>
                    <CreditCard className="w-4 h-4 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold font-mono text-purple-900">{overdueReceivables.length}</p>
                  <p className="text-[10px] text-purple-700">Facturas de clientes en mora</p>
                </div>
              </div>

              {/* Feed of system alerts */}
              <div className="space-y-2 mt-4">
                <p className="text-[11px] uppercase font-bold text-slate-600">
                  Registro Reciente de Alertas Push del Sistema:
                </p>
                {notifications.length === 0 ? (
                  <p className="text-slate-600 italic text-center py-6">
                    No hay alertas pendientes en este momento.
                  </p>
                ) : (
                  notifications.slice(0, 8).map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                        notif.read ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-blue-50/40 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-white border border-slate-200 mt-0.5">
                          {notif.type === 'order_status' && <Package className="w-3.5 h-3.5 text-blue-600" />}
                          {notif.type === 'promotion' && <Sparkles className="w-3.5 h-3.5 text-rose-600" />}
                          {notif.type === 'inventory_alert' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                          {notif.type === 'bcv_update' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{notif.title}</p>
                          <p className="text-slate-600 text-[11px] mt-0.5">{notif.message}</p>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      {!notif.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationAsRead(notif.id)}
                          className="text-[10px] font-semibold text-blue-600 hover:underline shrink-0"
                        >
                          Marcar leída
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
