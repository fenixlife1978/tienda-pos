import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Store,
  LayoutDashboard,
  ShoppingCart,
  History,
  TrendingUp,
  RefreshCw,
  Bell,
  CheckCheck,
  CreditCard,
  UserCircle,
  Building2,
  ChevronDown,
  Flame,
  LogIn,
  LogOut,
  Send,
  SlidersHorizontal,
  Sparkles,
  Package,
  Layers,
  Database,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { offlineSyncService } from '../../services/offlineSyncService';

export const Header: React.FC = () => {
  const {
    mode,
    setMode,
    settings,
    updateBcvRate,
    fetchAutomaticBcvRate,
    cart,
    setIsCartOpen,
    setIsOrdersModalOpen,
    orders,
    notifications,
    markNotificationAsRead,
    clearAllNotifications,
    currentCustomer,
    setCurrentCustomer,
    customers,
    currentUser,
    setCurrentUser,
    users,
    storeTab,
    setStoreTab,
    isAdminActive,
    setIsAdminActive,
    setIsAuthModalOpen,
    setIsNotificationSettingsOpen,
    setIsSellerAlertsModalOpen,
    logoutCustomer,
    setIsBcvPanelOpen,
    setIsCategoryUnitModalOpen,
    tursoState,
    syncWithTurso,
  } = useApp();

  const [isUpdatingBcv, setIsUpdatingBcv] = useState(false);
  const [showBcvModal, setShowBcvModal] = useState(false);
  const [showTursoModal, setShowTursoModal] = useState(false);
  const [isForcingSync, setIsForcingSync] = useState(false);
  const [customBcvInput, setCustomBcvInput] = useState(settings.bcvRate.toString());
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Unread notifications count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Cart totals
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalUSD = cart.reduce((sum, item) => {
    const price = item.product.isOffer && item.product.discountPercentage
      ? item.product.priceUSD * (1 - item.product.discountPercentage / 100)
      : item.product.priceUSD;
    return sum + price * item.quantity;
  }, 0);

  // Customer orders count
  const customerOrdersCount = currentCustomer
    ? orders.filter((o) => o.customerId === currentCustomer.id).length
    : 0;

  const handleAutoBcv = async () => {
    setIsUpdatingBcv(true);
    try {
      await fetchAutomaticBcvRate();
    } finally {
      setIsUpdatingBcv(false);
    }
  };

  const handleSaveCustomBcv = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(customBcvInput);
    if (!isNaN(parsed) && parsed > 0) {
      updateBcvRate(parsed);
      setShowBcvModal(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Logo and Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <img
              src="./logo.png"
              alt="DISTRIBUIDORA LA GRAN BODEGA M&S"
              className="h-10 sm:h-11 w-auto object-contain rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm md:text-base tracking-tight truncate max-w-[200px] sm:max-w-none">
                  DISTRIBUIDORA LA GRAN BODEGA M&S
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  Panel ERP
                </span>
              </div>
              <p className="text-[10px] text-slate-500 hidden md:block truncate">
                Administración General, Facturación Fiscal y Despacho
              </p>
            </div>
          </div>

          {/* Action button to exit ERP and return to main landing */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsAdminActive(false);
                setMode('store');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:border-rose-300 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Cerrar panel ERP y volver a la página principal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar ERP / Inicio</span>
            </button>
          </div>

          {/* Right Section: Tasa BCV, Mode actions, Cart, Notifications & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            
            {/* Tasa BCV Ticker & Control Panel Trigger */}
            <div className="relative hidden xs:block">
              <button
                type="button"
                onClick={() => setIsBcvPanelOpen(true)}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shadow-2xs"
                title="Panel de Control Tasa BCV (Manual, Automático e Historial)"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-bold font-mono text-[11px] sm:text-xs">
                  BCV: {settings.bcvRate.toFixed(2)} Bs
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAutoBcv();
                  }}
                  className={`p-0.5 rounded hover:bg-emerald-200 ml-0.5 ${isUpdatingBcv ? 'animate-spin' : ''}`}
                  title="Sincronizar tasa BCV de inmediato"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-700" />
                </span>
              </button>
            </div>

            {/* Turso Cloud Database Status Badge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTursoModal(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
                  tursoState.isSyncing
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : tursoState.isConnected
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100 animate-pulse'
                }`}
                title="Estado de conexión con la base de datos central en la nube (Turso DB)"
              >
                <Database className={`w-3.5 h-3.5 shrink-0 ${tursoState.isConnected ? 'text-indigo-600' : 'text-rose-600'}`} />
                <span className="hidden sm:inline">
                  {tursoState.isSyncing
                    ? 'Sincronizando...'
                    : tursoState.isConnected
                    ? 'Turso Cloud: En Línea'
                    : 'Turso: Modo Local'}
                </span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${tursoState.isConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              </button>
            </div>

            {/* Categorías y Unidades Quick Access (Admin / ERP) */}
            {isAdminActive && (
              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setIsCategoryUnitModalOpen(true)}
                  className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                  title="Gestionar Categorías y Unidades de Medida"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden lg:inline text-[11px]">Cat. & Unidades</span>
                </button>
              </div>
            )}

            {/* Mode-specific actions */}
            {mode === 'store' ? (
              <>
                {/* Muro de Ofertas Quick Switcher */}
                <button
                  type="button"
                  onClick={() => setStoreTab(storeTab === 'offers' ? 'catalog' : 'offers')}
                  className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    storeTab === 'offers'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  }`}
                  title="Ver Muro de Ofertas"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Ofertas</span>
                </button>

                {/* Historic purchases button */}
                <button
                  onClick={() => setIsOrdersModalOpen(true)}
                  className="relative flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer"
                  title="Consultar Historial de Compras y Facturas"
                >
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden md:inline">Mis Compras</span>
                  {customerOrdersCount > 0 && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold text-blue-800 bg-blue-100 rounded-full">
                      {customerOrdersCount}
                    </span>
                  )}
                </button>

                {/* Cart button */}
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <div className="relative">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {cartItemCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-900 text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                        {cartItemCount}
                      </span>
                    )}
                  </div>
                  <span className="hidden sm:inline font-mono">
                    ${cartTotalUSD.toFixed(2)}
                  </span>
                </button>

                {/* Customer Account / Login button */}
                {currentCustomer ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
                    >
                      <UserCircle className="w-4 h-4 text-blue-600" />
                      <span className="hidden lg:inline max-w-[100px] truncate font-bold">
                        {currentCustomer.name.split(' ')[0]}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {showCustomerDropdown && (
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-xs">
                        <div className="pb-2 border-b border-slate-100">
                          <p className="font-bold text-slate-900">{currentCustomer.name}</p>
                          <p className="text-[11px] text-slate-500">RIF: {currentCustomer.rif}</p>
                          <p className="text-[11px] text-slate-500">{currentCustomer.email}</p>
                        </div>

                        <div className="py-2 space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsNotificationSettingsOpen(true);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-700 font-semibold flex items-center gap-2"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>Configurar Notificaciones Push</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsOrdersModalOpen(true);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                          >
                            <History className="w-3.5 h-3.5 text-slate-500" />
                            <span>Historial de Compras & Facturas</span>
                          </button>
                        </div>

                        {/* Switch simulated customer or logout */}
                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                            Cambiar de Cuenta:
                          </p>
                          {customers.map((cust) => (
                            <button
                              key={cust.id}
                              onClick={() => {
                                setCurrentCustomer(cust);
                                setShowCustomerDropdown(false);
                              }}
                              className={`w-full text-left px-2 py-1.5 rounded-lg transition flex items-center justify-between text-[11px] ${
                                currentCustomer.id === cust.id
                                  ? 'bg-blue-50 text-blue-900 font-bold'
                                  : 'hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <span className="truncate">{cust.name}</span>
                              <span className="text-[10px] text-slate-400">{cust.rif}</span>
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              logoutCustomer();
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center gap-2 mt-2"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Cerrar Sesión</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ingresar</span>
                  </button>
                )}
              </>
            ) : (
              <>
                {/* ERP Mode: Broadcast & Alerts Manager Quick Action */}
                <button
                  type="button"
                  onClick={() => setIsSellerAlertsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="Emitir Notificaciones Push y Ver Alertas Críticas"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Push ERP</span>
                </button>

                {/* ERP User Switcher / Profile */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="text-left hidden md:block leading-tight">
                      <p className="font-semibold text-slate-900 truncate max-w-[110px]">{currentUser.name}</p>
                      <p className="text-[10px] text-indigo-700 uppercase font-bold">{currentUser.role}</p>
                    </div>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 z-50 text-xs">
                      <p className="font-bold text-slate-400 uppercase px-2 py-1 text-[10px]">
                        Cambiar Rol Operativo (ERP):
                      </p>
                      <div className="space-y-1 my-1">
                        {users.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setCurrentUser(u);
                              setShowUserDropdown(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-xl transition flex items-center justify-between ${
                              currentUser.id === u.id
                                ? 'bg-indigo-50 text-indigo-900 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div>
                              <p className="font-semibold">{u.name}</p>
                              <p className="text-[10px] text-slate-400">{u.email}</p>
                            </div>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              {u.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* In-App PWA Install Button */}
            <PWAInstallButton className="hidden sm:inline-flex" />

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Notificaciones push del sistema"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ring-2 ring-white animate-pulse min-w-[18px] text-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-50 text-xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-blue-600" /> Notificaciones Push del Sistema
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={clearAllNotifications}
                        className="text-[11px] text-slate-500 hover:text-slate-800 transition cursor-pointer"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-slate-400 italic">No hay notificaciones</p>
                    ) : (
                      notifications.slice(0, 10).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => markNotificationAsRead(notif.id)}
                          className={`p-2.5 rounded-xl border transition cursor-pointer ${
                            notif.read
                              ? 'bg-white border-slate-100 text-slate-600'
                              : 'bg-blue-50/70 border-blue-100 text-slate-900 font-medium'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-xs text-blue-900">{notif.title}</p>
                            <span className="text-[10px] text-slate-400">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-snug">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Quick trigger modal button */}
                  <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between">
                    {mode === 'erp' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotificationsDropdown(false);
                          setIsSellerAlertsModalOpen(true);
                        }}
                        className="w-full py-1.5 text-center text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Abrir Gestor de Alertas & Push Broadcast
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotificationsDropdown(false);
                          setIsNotificationSettingsOpen(true);
                        }}
                        className="w-full py-1.5 text-center text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Configurar Mis Preferencias de Notificación
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Manual BCV Edit Modal */}
      {showBcvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">Ajuste de Tasa Oficial BCV</h3>
            <p className="text-xs text-slate-500 mb-4">
              Esta tasa se aplica a todo el sistema, tienda online, cotizaciones y facturación en Bolívares.
            </p>
            <form onSubmit={handleSaveCustomBcv} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tasa en Bolívares por USD (Bs/USD)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={customBcvInput}
                    onChange={(e) => setCustomBcvInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ej. 68.45"
                    required
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">Bs/$</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBcvModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Guardar Tasa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Turso Cloud DB Connection Status & Diagnostics Modal */}
      {showTursoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 relative">
            <button
              onClick={() => setShowTursoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl ${tursoState.isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Estado de Base de Datos Cloud</h3>
                <p className="text-xs text-slate-500">Turso LibSQL Central Database</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600">Estado de Conexión:</span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                  tursoState.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${tursoState.isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {tursoState.isConnected ? 'En Línea (Conectado)' : 'Desconectado (Modo Local)'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 block">Detalle de Sincronización:</span>
                <p className="text-xs font-medium text-slate-800">{tursoState.statusText || 'Sin información'}</p>
                {tursoState.lastSyncTime && (
                  <p className="text-[10px] text-slate-400">
                    Última sincronización: {new Date(tursoState.lastSyncTime).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {tursoState.errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Error de Conexión con la Nube:</span>
                  </div>
                  <p className="text-xs font-mono bg-rose-100/60 p-2 rounded-lg text-rose-900 break-words">
                    {tursoState.errorMessage}
                  </p>
                  <p className="text-[10px] text-rose-700 italic pt-1">
                    Sugerencia: Si estás en Vercel, verifica que las variables TURSO_DATABASE_URL y TURSO_AUTH_TOKEN estén configuradas en las Variables de Entorno del proyecto.
                  </p>
                </div>
              )}
              {offlineSyncService.pendingCount() > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold block">Cola Local Pendiente:</span>
                    <span>{offlineSyncService.pendingCount()} operación(es) retenida(s)</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      offlineSyncService.clearAllQueue();
                      setIsForcingSync(true);
                      try {
                        await syncWithTurso(true);
                      } finally {
                        setIsForcingSync(false);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
                  >
                    Descartar Cola
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTursoModal(false)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsForcingSync(true);
                  try {
                    await syncWithTurso(true);
                  } finally {
                    setIsForcingSync(false);
                  }
                }}
                disabled={isForcingSync}
                className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isForcingSync ? 'animate-spin' : ''}`} />
                <span>{isForcingSync ? 'Sincronizando...' : 'Forzar Sincronización'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
