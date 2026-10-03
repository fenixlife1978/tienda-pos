import React from 'react';
import { Bell, CheckCircle2, X, Package, CreditCard, Sparkles, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface CustomerNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerNotificationsModal: React.FC<CustomerNotificationsModalProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationAsRead, clearCustomerNotifications } = useApp();

  if (!isOpen) return null;

  const customerNotifications = notifications
    .filter((n) => !n.read && (n.targetRole === 'client' || n.targetRole === 'all'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const iconFor = (type: string) => {
    if (type === 'order_status') return <Package className="w-5 h-5" />;
    if (type === 'credit_alert') return <CreditCard className="w-5 h-5" />;
    if (type === 'promotion' || type === 'custom_broadcast') return <Sparkles className="w-5 h-5" />;
    return <AlertCircle className="w-5 h-5" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10"><Bell className="w-5 h-5" /></div>
            <div>
              <h3 className="font-bold">Notificaciones</h3>
              <p className="text-xs text-slate-300">Mensajes no leídos enviados por administración</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {customerNotifications.length > 0 && (
              <button
                type="button"
                onClick={clearCustomerNotifications}
                className="px-3 py-2 rounded-lg text-xs font-bold hover:bg-white/10"
              >
                LIMPIAR
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {customerNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Bell className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold">No tienes notificaciones</p>
              <p className="text-xs mt-1">Aquí aparecerán los avisos enviados por administración.</p>
            </div>
          ) : (
            customerNotifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => markNotificationAsRead(notification.id)}
                className={`w-full text-left p-4 rounded-xl border transition ${notification.read ? 'bg-white border-slate-200' : 'bg-blue-50 border-blue-200'}`}
              >
                <div className="flex gap-3">
                  <div className={`shrink-0 p-2 rounded-lg ${notification.read ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>
                    {notification.read ? <CheckCircle2 className="w-5 h-5" /> : iconFor(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-bold text-sm text-slate-900">{notification.title}</h4>
                      {!notification.read && <span className="mt-1 w-2 h-2 shrink-0 rounded-full bg-blue-600" />}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>
                    <p className="mt-2 text-[10px] text-slate-400">
                      {new Date(notification.createdAt).toLocaleString('es-VE')}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
