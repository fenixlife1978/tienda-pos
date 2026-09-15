import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole, AppUser } from '../../types';
import {
  Settings,
  Shield,
  Users,
  Building2,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  CreditCard,
  Lock,
  UserCheck,
  RotateCcw,
  AlertTriangle,
  KeyRound,
  ShieldAlert,
  Info,
  Layers,
  TrendingUp,
  Database,
  Server,
  Cloud,
} from 'lucide-react';

export const SettingsAndUsersView: React.FC = () => {
  const {
    settings,
    updateSettings,
    users,
    currentUser,
    setCurrentUser,
    addUser,
    updateUser,
    deleteUser,
    resetSystemToFactory,
    refreshBcvRate,
    setIsBcvPanelOpen,
    setIsCategoryUnitModalOpen,
    categories,
    units,
    tursoState,
    setIsTursoModalOpen,
    syncWithTurso,
  } = useApp();

  const [isRefreshingBcv, setIsRefreshingBcv] = useState(false);
  const [bcvRateInput, setBcvRateInput] = useState(settings.bcvRate.toString());
  const [autoUpdateBcv, setAutoUpdateBcv] = useState(settings.autoUpdateBcv);

  // Business info form
  const [companyData, setCompanyData] = useState({
    companyName: settings.companyName,
    companyRif: settings.companyRif,
    companyAddress: settings.companyAddress,
    companyPhone: settings.companyPhone,
    companyEmail: settings.companyEmail,
    ivaPercentage: settings.ivaPercentage,
    defaultCreditDays: settings.defaultCreditDays,
    defaultCreditLimitUSD: settings.defaultCreditLimitUSD,
  });

  // User modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: 'cajero' as UserRole,
    password: 'admin123',
    active: true,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleManualBcvRefresh = async () => {
    setIsRefreshingBcv(true);
    await refreshBcvRate();
    setIsRefreshingBcv(false);
    setBcvRateInput(settings.bcvRate.toString());
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(bcvRateInput) || settings.bcvRate;
    updateSettings({
      ...companyData,
      bcvRate: rate,
      autoUpdateBcv: autoUpdateBcv,
      lastBcvUpdate: new Date().toISOString(),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleOpenCreateUser = (defaultRole?: UserRole) => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      role: defaultRole || 'cajero',
      password: 'admin' + Math.floor(100 + Math.random() * 900),
      active: true,
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: AppUser) => {
    setEditingUser(u);
    setUserFormData({
      name: u.name,
      email: u.email,
      role: u.role,
      password: u.password || 'admin123',
      active: u.active,
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUser({
        ...editingUser,
        ...userFormData,
      });
    } else {
      addUser(userFormData);
    }
    setIsUserModalOpen(false);
  };

  const roleLabels: Record<UserRole, { label: string; color: string; desc: string }> = {
    admin: {
      label: 'Administrador General',
      color: 'bg-purple-100 text-purple-800',
      desc: 'Control total de finanzas, configuración, usuarios e inventarios.',
    },
    gerente: {
      label: 'Gerente Comercial',
      color: 'bg-blue-100 text-blue-800',
      desc: 'Supervisión de compras, cuentas por cobrar/pagar e inventario.',
    },
    cajero: {
      label: 'Cajero POS',
      color: 'bg-emerald-100 text-emerald-800',
      desc: 'Operación del Punto de Venta (POS), cobros y facturación de mostrador.',
    },
    despachador: {
      label: 'Despachador / Logística',
      color: 'bg-amber-100 text-amber-800',
      desc: 'Preparación de pedidos, asignación de rutas y entregas.',
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Configuración del Sistema, Tasa BCV & Roles Jerárquicos
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Parámetros fiscales de la empresa, actualización del tipo de cambio oficial y control de usuarios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: BCV & Company Settings (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Tasa BCV Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Tipo de Cambio Oficial BCV (Banco Central de Venezuela)
                  </h3>
                  <span className="text-[10px] text-emerald-700 font-mono">
                    Fuente API: https://bcv.today/api/rate.json
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Última sync: {new Date(settings.lastBcvUpdate).toLocaleDateString('es-VE')} {new Date(settings.lastBcvUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tasa Actual (Bs por cada 1 USD):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={bcvRateInput}
                    onChange={(e) => setBcvRateInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-lg text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    Bs. / $
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleManualBcvRefresh}
                  disabled={isRefreshingBcv}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingBcv ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingBcv ? 'Consultando bcv.today...' : 'Sincronizar con bcv.today Ahora'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBcvPanelOpen(true)}
                  className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Abrir Panel de Control BCV Completo</span>
                </button>

                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={autoUpdateBcv}
                    onChange={(e) => setAutoUpdateBcv(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Actualización automática de tasa BCV cada 60s</span>
                </label>
              </div>
            </div>
          </div>

          {/* Turso Cloud Database (LibSQL) Integration Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">
                      Base de Datos Turso (LibSQL Cloud)
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tursoState.isConnected
                          ? 'bg-emerald-100 text-emerald-800'
                          : tursoState.errorMessage
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tursoState.isConnected ? '🟢 Conectado' : tursoState.errorMessage ? '🔴 Error' : '🟡 Modo Local'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tablas automáticas DDL, persistencia cloud y compatibilidad con variables Vercel.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTursoModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Configurar Turso</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-800 flex items-center gap-2">
                  <span>Estado: {tursoState.statusText}</span>
                  {tursoState.isSyncing && <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin" />}
                </div>
                <p className="text-[11px] text-slate-500">
                  {tursoState.tablesCreated.length > 0
                    ? `12 tablas DDL activas: products, orders, categories, invoices, customers, etc.`
                    : `Las tablas se crean automáticamente en Turso al ingresar URL y Token.`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => syncWithTurso()}
                  disabled={!tursoState.isConnected || tursoState.isSyncing}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${tursoState.isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sincronizar Cloud</span>
                </button>
              </div>
            </div>
          </div>

          {/* Categorías y Unidades de Medida Section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Categorías de Productos y Unidades de Medida
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Control maestro de taxonomía del catálogo comercial e inventario.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryUnitModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Administrar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Categorías preview */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Categorías ({categories.length})</span>
                  <span className="text-[10px] text-slate-500">Disponibles en tienda & ERP</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {categories.map((c) => (
                    <span
                      key={c.id}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 shadow-2xs"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Unidades preview */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Unidades de Medida ({units.length})</span>
                  <span className="text-[10px] text-slate-500">Balanza, volumen y empaque</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {units.map((u) => (
                    <span
                      key={u.id}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 shadow-2xs"
                    >
                      {u.name} <span className="text-slate-400 font-mono">({u.abbreviation})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Company Fiscal Profile */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Datos Fiscales del Comercio & Políticas de Crédito
                </h3>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Razón Social del Comercio *</label>
                  <input
                    type="text"
                    required
                    value={companyData.companyName}
                    onChange={(e) => setCompanyData({ ...companyData, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">RIF Fiscal *</label>
                  <input
                    type="text"
                    required
                    value={companyData.companyRif}
                    onChange={(e) => setCompanyData({ ...companyData, companyRif: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Dirección Fiscal y Comercial *</label>
                <input
                  type="text"
                  required
                  value={companyData.companyAddress}
                  onChange={(e) => setCompanyData({ ...companyData, companyAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Teléfono Contacto</label>
                  <input
                    type="text"
                    value={companyData.companyPhone}
                    onChange={(e) => setCompanyData({ ...companyData, companyPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email Comercial</label>
                  <input
                    type="email"
                    value={companyData.companyEmail}
                    onChange={(e) => setCompanyData({ ...companyData, companyEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Alícuota IVA (%)</label>
                  <input
                    type="number"
                    value={companyData.ivaPercentage}
                    onChange={(e) => setCompanyData({ ...companyData, ivaPercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Días de Crédito Generales (Por Defecto)
                  </label>
                  <select
                    value={companyData.defaultCreditDays}
                    onChange={(e) => setCompanyData({ ...companyData, defaultCreditDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                  >
                    <option value={7}>7 Días</option>
                    <option value={15}>15 Días</option>
                    <option value={21}>21 Días</option>
                    <option value={30}>30 Días</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Límite de Crédito Base (USD)
                  </label>
                  <input
                    type="number"
                    value={companyData.defaultCreditLimitUSD}
                    onChange={(e) => setCompanyData({ ...companyData, defaultCreditLimitUSD: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {savedSuccess ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Configuración guardada correctamente
                  </span>
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Guardar Parámetros
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Col: Users & Role-Based Access Control (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Personal Operativo & Roles Jerárquicos
              </h3>
            </div>

            <button
              onClick={() => handleOpenCreateUser()}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            Los roles jerárquicos determinan qué módulos del ERP puede operar cada colaborador.
          </p>

          {/* First Admin / Generic Admin Status Banner */}
          {(() => {
            const adminUsers = users.filter((u) => u.role === 'admin' && u.active);
            const genericAdmin = users.find((u) => u.isInitialGeneric || u.id === 'usr-admin-initial');
            const hasCustomAdmin = users.some(
              (u) => u.role === 'admin' && u.active && !u.isInitialGeneric && u.id !== 'usr-admin-initial'
            );

            if (!genericAdmin) return null;

            return (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  hasCustomAdmin
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50/90 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {hasCustomAdmin ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-bold">
                        {hasCustomAdmin
                          ? 'Listo para eliminar Administrador Genérico'
                          : 'Primer Administrador del Sistema (Genérico)'}
                      </p>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                        hasCustomAdmin
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>
                        {hasCustomAdmin ? 'Eliminación Habilitada' : 'Por Defecto Inicial'}
                      </span>
                    </div>

                    <p className="text-[11px] mt-1 leading-relaxed opacity-90">
                      {hasCustomAdmin
                        ? 'Has registrado administradores personalizados. Ahora puedes eliminar de manera segura el Administrador Genérico Inicial.'
                        : 'Siempre hay un primer administrador activo por defecto al reiniciar el sistema. Crea tu propio Administrador General para poder eliminar el usuario genérico.'}
                    </p>

                    <div className="mt-2.5 flex items-center gap-2">
                      {!hasCustomAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCreateUser('admin')}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Crear Nuevo Administrador
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                `¿Eliminar definitivamente el Administrador Genérico Inicial (${genericAdmin.name})? El control continuará con tus administradores personalizados.`
                              )
                            ) {
                              deleteUser(genericAdmin.id);
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar Administrador Genérico
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Active User Switcher */}
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs">
            <label className="block font-semibold text-indigo-950 mb-1">
              Usuario de Sesión Activo en este Terminal:
            </label>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const found = users.find((u) => u.id === e.target.value);
                if (found) setCurrentUser(found);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg font-bold text-indigo-900"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.isInitialGeneric ? '*(Genérico Inicial)*' : ''} — [{roleLabels[u.role].label}]
                </option>
              ))}
            </select>
          </div>

          {/* Users List */}
          <div className="divide-y divide-slate-100 text-xs">
            {users.map((u) => {
              const r = roleLabels[u.role];
              const isGeneric = u.isInitialGeneric || u.id === 'usr-admin-initial';
              const adminCount = users.filter((x) => x.role === 'admin' && x.active).length;
              const canDeleteThisAdmin = u.role !== 'admin' || adminCount > 1;

              return (
                <div key={u.id} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 truncate">{u.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${r.color}`}>
                        {r.label}
                      </span>
                      {isGeneric && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          Genérico Inicial
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{u.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{r.desc}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditUser(u)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 cursor-pointer"
                      title="Editar usuario"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {isGeneric ? (
                      canDeleteThisAdmin ? (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `¿Eliminar al Administrador Genérico Inicial (${u.name})? El control continuará con los administradores personalizados.`
                              )
                            ) {
                              deleteUser(u.id);
                            }
                          }}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                          title="Eliminar usuario genérico inicial"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Eliminar</span>
                        </button>
                      ) : (
                        <span
                          className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-md font-medium"
                          title="No se puede eliminar mientras sea el único Administrador. Registra un nuevo Administrador primero."
                        >
                          Protegido
                        </span>
                      )
                    ) : (
                      canDeleteThisAdmin ? (
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar al usuario ${u.name}?`)) deleteUser(u.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span
                          className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-md font-medium"
                          title="Debe haber al menos un Administrador en el sistema."
                        >
                          Único Admin
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Role Hierarchy Matrix Reference */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Matriz de Permisos por Rol
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div className="p-2 bg-slate-50 rounded-lg">
                <strong className="text-purple-700">Administrador:</strong> Acceso ilimitado (POS, Inventarios, CxC, CxP, Reportes, Configuración).
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <strong className="text-blue-700">Gerente:</strong> Gestión de compras, inventarios, cobranzas y pedidos.
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <strong className="text-emerald-700">Cajero POS:</strong> Facturación de mostrador, apertura y cierre de caja.
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <strong className="text-amber-700">Despachador:</strong> Seguimiento y actualización de entregas de pedidos.
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Factory Reset / Reiniciar Sistema desde Cero */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <span>Reiniciar Sistema desde Cero (Restablecimiento de Fábrica)</span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Cada vez que el sistema se reinicie desde cero, se restablecerá el primer Administrador Genérico Inicial por defecto para que puedas ingresar y reconfigurar la plataforma a tu medida.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                '¿Confirmas reiniciar el sistema desde cero? Se restablecerán todos los datos a sus valores originales y se restaurará el Administrador Genérico Inicial.'
              )
            ) {
              resetSystemToFactory();
            }
          }}
          className="px-4 py-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-2 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
          <span>Reiniciar Sistema desde Cero</span>
        </button>
      </div>

      {/* Modal: Create or Edit User */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                {editingUser ? 'Editar Usuario Operativo' : 'Registrar Nuevo Colaborador'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Correo Electrónico Corporativo *</label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Rol Jerárquico Asignado *</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="admin">Administrador General</option>
                  <option value="gerente">Gerente Comercial</option>
                  <option value="cajero">Cajero Mostrador POS</option>
                  <option value="despachador">Despachador / Logística</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Contraseña de Acceso ERP *</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder="Contraseña del usuario (ej: clave123)"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {userFormData.role === 'admin' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-[11px] flex items-start gap-2">
                  <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">
                    Al registrar este nuevo <strong>Administrador General</strong>, se activará la opción para que puedas eliminar de forma segura el <strong>Administrador Genérico Inicial</strong>.
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
