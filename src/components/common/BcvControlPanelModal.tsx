import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sliders,
  DollarSign,
  History,
  ShieldCheck,
  X,
  ArrowRight,
  BarChart3,
} from 'lucide-react';

export const BcvControlPanelModal: React.FC = () => {
  const {
    settings,
    updateBcvRate,
    fetchAutomaticBcvRate,
    updateSettings,
    products,
    isBcvPanelOpen,
    setIsBcvPanelOpen,
  } = useApp();

  const [manualRateInput, setManualRateInput] = useState<string>(settings.bcvRate.toFixed(2));
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'adjust' | 'impact' | 'history'>('adjust');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  if (!isBcvPanelOpen) return null;

  const parsedManualRate = parseFloat(manualRateInput);
  const isValidManualRate = !isNaN(parsedManualRate) && parsedManualRate > 0;
  const simulatedRate = isValidManualRate ? parsedManualRate : settings.bcvRate;

  const handleApplyManualRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidManualRate) {
      setFeedbackMsg({ type: 'error', text: 'Por favor ingrese un valor de tasa válido mayor a 0.' });
      return;
    }

    updateBcvRate(parsedManualRate, 'Administrador (Manual)', 'manual');
    setFeedbackMsg({
      type: 'success',
      text: `¡Tasa BCV actualizada a ${parsedManualRate.toFixed(2)} Bs/USD! Se ha recalculado automáticamente toda la tienda y facturación.`,
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleSyncAutomatic = async () => {
    setIsSyncing(true);
    setFeedbackMsg(null);
    try {
      const newRate = await fetchAutomaticBcvRate();
      setManualRateInput(newRate.toFixed(2));
      setFeedbackMsg({
        type: 'success',
        text: `Sincronización exitosa con la API oficial del BCV. Tasa actualizada a ${newRate.toFixed(2)} Bs/USD.`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Error al consultar el servicio del BCV. Puede ingresar la tasa manualmente.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoUpdate = (enabled: boolean) => {
    updateSettings({ autoUpdateBcv: enabled });
    setFeedbackMsg({
      type: 'info',
      text: enabled
        ? `Actualización automática activada cada ${settings.bcvAutoUpdateIntervalSeconds || 60} segundos.`
        : 'Actualización automática en segundo plano desactivada.',
    });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleIntervalChange = (seconds: number) => {
    updateSettings({ bcvAutoUpdateIntervalSeconds: seconds });
    setFeedbackMsg({
      type: 'info',
      text: `Intervalo de sincronización ajustado a cada ${seconds} segundos.`,
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Preview sample products impact
  const previewProducts = products.slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-400/30 shadow-inner">
              <TrendingUp className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Panel de Control de Tasa Oficial BCV
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 tracking-wide uppercase">
                  Sincronización en Vivo
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                Banco Central de Venezuela — Afecta en tiempo real tienda online, POS de caja y facturación fiscal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsBcvPanelOpen(false)}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Rate Ribbon */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Tasa Actual Vigente:</span>
            <span className="text-2xl font-black font-mono text-emerald-700 tracking-tight">
              {settings.bcvRate.toFixed(2)}{' '}
              <span className="text-xs font-semibold text-slate-600">Bs / USD</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3 h-3" />
              Oficial
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Última actualización:</span>
              <span className="font-semibold text-slate-700">
                {new Date(settings.lastBcvUpdate).toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {feedbackMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : feedbackMsg.type === 'info'
                ? 'bg-blue-50 text-blue-800 border-b border-blue-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTab('adjust')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'adjust'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Ajuste Manual y Automático
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('impact')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'impact'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Impacto en Precios en Tiempo Real
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Historial de Tasas ({settings.bcvHistory?.length || 0})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {activeTab === 'adjust' && (
            <div className="space-y-6">
              {/* Dual Column: Manual Setting & Auto-Update Engine */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Method 1: Manual Input */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-sm">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      1. Ingreso Manual de Tasa
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Modo Inmediato</span>
                  </div>

                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    Ingrese directamente el valor oficial en bolívares por dólar. Al aplicar, todos los precios del catálogo mayorista, tienda en línea y tickets se sincronizan al instante.
                  </p>

                  <form onSubmit={handleApplyManualRate} className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Nueva Tasa BCV (Bs. / USD):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          value={manualRateInput}
                          onChange={(e) => setManualRateInput(e.target.value)}
                          className="w-full pl-3 pr-16 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl font-mono text-base font-extrabold text-slate-900 transition"
                          placeholder="68.45"
                        />
                        <span className="absolute right-3 top-2.5 font-mono text-xs font-bold text-slate-400">
                          Bs/USD
                        </span>
                      </div>
                    </div>

                    {/* Impact preview pill */}
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-900 flex items-center justify-between">
                      <span className="text-[11px]">Ejemplo: $10.00 pasará a:</span>
                      <span className="font-mono font-bold text-xs text-emerald-800">
                        {(10 * simulatedRate).toFixed(2)} Bs.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={!isValidManualRate}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Fijar Tasa Manualmente & Propagar
                    </button>
                  </form>
                </div>

                {/* Method 2: Automatic Background Engine */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-sm">
                        <Zap className="w-4 h-4 text-teal-600" />
                        2. Sincronización Automática
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        settings.autoUpdateBcv ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {settings.autoUpdateBcv ? 'Activo' : 'Pausado'}
                      </span>
                    </div>

                    <p className="text-slate-500 leading-relaxed text-[11px]">
                      Conecta periódicamente con el feed del Banco Central de Venezuela para obtener la cotización oficial sin intervención humana.
                    </p>

                    {/* Toggle auto-update */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800 text-xs">Actualización en Segundo Plano</p>
                        <p className="text-[10px] text-slate-400">Consulta automática de tasa</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.autoUpdateBcv}
                          onChange={(e) => handleToggleAutoUpdate(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    {/* Interval selector */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Frecuencia de sincronización automática:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { sec: 30, label: '30 seg' },
                          { sec: 60, label: '1 min' },
                          { sec: 300, label: '5 min' },
                        ].map((item) => (
                          <button
                            key={item.sec}
                            type="button"
                            onClick={() => handleIntervalChange(item.sec)}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              (settings.bcvAutoUpdateIntervalSeconds || 60) === item.sec
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Manual trigger button */}
                  <button
                    type="button"
                    onClick={handleSyncAutomatic}
                    disabled={isSyncing}
                    className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Consultando API BCV...' : 'Sincronizar con API BCV Ahora'}
                  </button>
                </div>
              </div>

              {/* Propagation Notice */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <p className="font-bold text-blue-950 mb-0.5">Propagación Universal Inmediata</p>
                  <p className="text-blue-800">
                    Cualquier cambio de tasa (manual o automático) impacta de forma transparente y matemática a:
                    <strong> Catálogo Online, Carrito de Compras, Pantalla de Venta POS de Caja, Facturas Fiscales emitidas y Cuentas por Cobrar en Bolívares</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'impact' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">Simulación de Precios en Tienda & Facturación</h4>
                  <p className="text-[11px] text-slate-500">
                    Comparativa con la tasa ingresada ({simulatedRate.toFixed(2)} Bs/USD) frente a la tasa previa:
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Tasa a Probar: {simulatedRate.toFixed(2)} Bs/USD
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Producto / Presentación</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3 text-right">Precio Base USD</th>
                      <th className="py-2.5 px-3 text-right">Precio Bs. (Actual)</th>
                      <th className="py-2.5 px-3 text-right">Precio Bs. (Nueva Tasa)</th>
                      <th className="py-2.5 px-3 text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewProducts.map((p) => {
                      const currentBs = p.priceUSD * settings.bcvRate;
                      const simulatedBs = p.priceUSD * simulatedRate;
                      const diffBs = simulatedBs - currentBs;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                            {p.name}
                            {p.isWeighable && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800">
                                Al Peso (Kg)
                              </span>
                            )}
                            {p.isFractionable && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-purple-100 text-purple-800">
                                Monto Libre
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-600">{p.category}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            ${p.priceUSD.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {currentBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 bg-emerald-50/50">
                            {simulatedBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${diffBs >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {diffBs >= 0 ? '+' : ''}{diffBs.toFixed(2)} Bs.
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleApplyManualRate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  Aplicar Esta Tasa a Toda la Plataforma
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs">Registro de Auditoría de Cambios de Tasa</h4>
                <span className="text-[10px] text-slate-400">Últimos movimientos registrados</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Fecha y Hora</th>
                      <th className="py-2.5 px-3">Origen</th>
                      <th className="py-2.5 px-3">Responsable</th>
                      <th className="py-2.5 px-3 text-right">Tasa Fijada</th>
                      <th className="py-2.5 px-3 text-right">Tasa Previa</th>
                      <th className="py-2.5 px-3 text-right">Variación %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {(!settings.bcvHistory || settings.bcvHistory.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                          No hay historial de cambios registrado aún.
                        </td>
                      </tr>
                    ) : (
                      settings.bcvHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 text-slate-700">
                            {new Date(item.date).toLocaleString('es-VE')}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.type === 'automatic'
                                ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              {item.type === 'automatic' ? 'API Automática' : 'Manual'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-600">{item.updatedBy}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {item.rate.toFixed(2)} Bs.
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-400">
                            {item.previousRate ? `${item.previousRate.toFixed(2)} Bs.` : '—'}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${
                            (item.changePercent || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {(item.changePercent || 0) >= 0 ? '+' : ''}{item.changePercent || 0}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Los cálculos se efectúan con redondeo matemático oficial a dos decimales.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsBcvPanelOpen(false)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer text-xs"
          >
            Cerrar Panel
          </button>
        </div>

      </div>
    </div>
  );
};
