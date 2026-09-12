import React from 'react';
import { useApp } from '../../context/AppContext';
import { AppNotification } from '../../types';
import {
  Bell,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  Tag,
  AlertTriangle,
  TrendingUp,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface ToastItemProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
  onAction?: (notification: AppNotification) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onDismiss, onAction }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'order_status':
        if (notification.message.includes('camino') || notification.message.includes('enviado')) {
          return <Truck className="w-5 h-5 text-indigo-400 animate-bounce" />;
        }
        if (notification.message.includes('preparación')) {
          return <Package className="w-5 h-5 text-blue-400" />;
        }
        if (notification.message.includes('entregado')) {
          return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
        }
        return <Clock className="w-5 h-5 text-amber-400" />;
      case 'promotion':
        return <Sparkles className="w-5 h-5 text-rose-400" />;
      case 'inventory_alert':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'credit_alert':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'bcv_update':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      default:
        return <Bell className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'promotion':
        return 'border-rose-500/40 shadow-rose-900/20';
      case 'order_status':
        return 'border-blue-500/40 shadow-blue-900/20';
      case 'inventory_alert':
      case 'credit_alert':
        return 'border-amber-500/40 shadow-amber-900/20';
      default:
        return 'border-slate-700 shadow-slate-950/40';
    }
  };

  return (
    <div
      role="alert"
      className={`relative w-full max-w-sm sm:max-w-md bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-xl border ${getBorderColor()} transition-all duration-300 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-top-4`}
    >
      <div className="flex items-start gap-3">
        {/* Icon Circle */}
        <div className="shrink-0 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/60 shadow-inner">
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Notificación Push
            </span>
            {notification.badge && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {notification.badge}
              </span>
            )}
            <span className="text-[10px] text-slate-400 ml-auto">Ahora</span>
          </div>

          <h4 className="text-sm font-bold text-white mt-1 leading-snug truncate">
            {notification.title}
          </h4>
          <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>

          {/* Action button if applicable */}
          <div className="mt-2.5 flex items-center gap-2">
            {onAction && (
              <button
                type="button"
                onClick={() => onAction(notification)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <span>Ver detalle</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              Descartar
            </button>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          className="shrink-0 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          title="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-dismiss progress animation bar */}
      <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 animate-[shrink_6s_linear_forwards]" />
      </div>
    </div>
  );
};

export const PushNotificationToastContainer: React.FC = () => {
  const {
    activePushToasts,
    dismissPushToast,
    setIsOrdersModalOpen,
    setStoreTab,
    setMode,
  } = useApp();

  if (activePushToasts.length === 0) return null;

  const handleAction = (notification: AppNotification) => {
    dismissPushToast(notification.id);
    if (notification.type === 'order_status') {
      setIsOrdersModalOpen(true);
    } else if (notification.type === 'promotion') {
      setMode('store');
      setStoreTab('offers');
    } else if (notification.type === 'inventory_alert') {
      setMode('erp');
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm sm:max-w-md w-full pointer-events-auto">
      {activePushToasts.map((toast) => (
        <ToastItem
          key={toast.id}
          notification={toast}
          onDismiss={dismissPushToast}
          onAction={handleAction}
        />
      ))}
    </div>
  );
};
