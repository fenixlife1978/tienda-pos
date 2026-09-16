import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setDismissed(false);
    } else if (wasOffline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // When reconnected, show brief green confirmation
  if (showRestoredNotice) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg border border-emerald-500 animate-fade-in">
        <Wifi className="w-4 h-4 text-emerald-100 shrink-0" />
        <span>Conexión restablecida. Sincronización en línea activa.</span>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200 ml-1" />
      </div>
    );
  }

  // When offline and not dismissed
  if (!isOnline && !dismissed) {
    return (
      <aside aria-label="Aviso de modo offline" className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-amber-500/50 flex flex-col gap-2 animate-slide-up">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <WifiOff className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                Modo Fuera de Línea Activo (PWA Caché)
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </p>
              <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                La conexión a internet es inestable. El catálogo POS, carrito y precios operan desde la memoria local.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white text-xs font-bold p-1 rounded-md"
            title="Ocultar aviso"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> POS y Carrito 100% operativos
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200 font-semibold"
          >
            <RefreshCw className="w-3 h-3" /> Reintentar
          </button>
        </div>
      </aside>
    );
  }

  return null;
};
