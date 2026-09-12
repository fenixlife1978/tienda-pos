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
    refreshBcvRate,
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

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      role: 'cajero',
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
                <h3 className="font-bold text-slate-900 text-sm">
                  Tipo de Cambio Oficial BCV (Banco Central de Venezuela)
                </h3>
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
                  <span>{isRefreshingBcv ? 'Consultando BCV...' : 'Sincronizar con API BCV Ahora'}</span>
                </button>

                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
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
              onClick={handleOpenCreateUser}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            Los roles jerárquicos determinan qué módulos del ERP puede operar cada colaborador.
          </p>

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
                  {u.name} — [{roleLabels[u.role].label}]
                </option>
              ))}
            </select>
          </div>

          {/* Users List */}
          <div className="divide-y divide-slate-100 text-xs">
            {users.map((u) => {
              const r = roleLabels[u.role];

              return (
                <div key={u.id} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{u.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${r.color}`}>
                        {r.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{u.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{r.desc}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditUser(u)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50"
                      title="Editar usuario"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {users.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar al usuario ${u.name}?`)) deleteUser(u.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                >
                  <option value="admin">Administrador General</option>
                  <option value="gerente">Gerente Comercial</option>
                  <option value="cajero">Cajero Mostrador POS</option>
                  <option value="despachador">Despachador / Logística</option>
                </select>
              </div>

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
