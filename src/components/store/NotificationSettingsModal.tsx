import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Bell,
  Volume2,
  VolumeX,
  Package,
  Sparkles,
  CreditCard,
  CheckCircle2,
  Send,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { playNotificationSound } from '../../utils/notificationSound';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentCustomer, updateCustomerPreferences, triggerPushNotification } = useApp();

  const currentPrefs = currentCustomer?.notificationPreferences || {
    orderStatus: true,
    promotions: true,
    creditAlerts: true,
    soundEnabled: true,
    channel: 'push' as const,
  };

  const [prefs, setPrefs] = useState(currentPrefs);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    updateCustomerPreferences(prefs);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  const handleTestNotification = () => {
    if (prefs.soundEnabled) {
      playNotificationSound('promotion');
    }
    triggerPushNotification({
      title: '¡Notificación de Prueba Activada!',
      message: 'Tu navegador y cuenta están configurados para recibir alertas en tiempo real sobre tus compras.',
      type: 'promotion',
      badge: 'Test Push',
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-400">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base">Configuración de Notificaciones Push</h3>
              <p className="text-xs text-slate-300">
                {currentCustomer ? currentCustomer.name : 'Preferencias de Usuario'}
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

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>¡Preferencias de notificaciones guardadas exitosamente!</span>
            </div>
          )}

          <p className="text-slate-600 text-xs">
            Selecciona qué tipo de avisos en tiempo real deseas recibir mientras navegas o cuando tu pedido cambie de estado:
          </p>

          <div className="space-y-3">
            {/* Order status */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 mt-0.5">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Estado de Pedidos en Vivo</h4>
                  <p className="text-[11px] text-slate-500">
                    Avisos inmediatos al pasar a Preparación, En Camino con el repartidor y Entregado.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.orderStatus}
                  onChange={(e) => setPrefs({ ...prefs, orderStatus: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Promotions */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-700 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Promociones y Ofertas Flash</h4>
                  <p className="text-[11px] text-slate-500">
                    Descuentos especiales, productos en oferta limitada y ofertas por rubro.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.promotions}
                  onChange={(e) => setPrefs({ ...prefs, promotions: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Credit alerts */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Alertas de Crédito Comercial</h4>
                  <p className="text-[11px] text-slate-500">
                    Recordatorios de facturas por vencer y confirmaciones de abonos registrados.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.creditAlerts}
                  onChange={(e) => setPrefs({ ...prefs, creditAlerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {/* Audio chime toggle */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 mt-0.5">
                  {prefs.soundEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Sonido de Notificación</h4>
                  <p className="text-[11px] text-slate-500">
                    Emitir un timbre acústico agradable cuando llega una alerta push.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.soundEnabled}
                  onChange={(e) => setPrefs({ ...prefs, soundEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Test Push Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestNotification}
              className="w-full py-2.5 px-3 border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/60 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Probar Notificación Push en Pantalla</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Guardar Preferencias
          </button>
        </div>
      </div>
    </div>
  );
};
