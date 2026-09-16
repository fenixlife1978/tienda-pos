import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ProductCard } from './ProductCard';
import { OffersWall } from './OffersWall';
import {
  Search,
  Tag,
  Sparkles,
  CreditCard,
  ShieldCheck,
  Flame,
  Bell,
  LogIn,
  SlidersHorizontal,
  Package,
  TrendingUp,
  Radio,
  Zap,
} from 'lucide-react';

export const StoreCatalog: React.FC = () => {
  const {
    products,
    currentCustomer,
    settings,
    storeTab,
    setStoreTab,
    setIsAuthModalOpen,
    setIsNotificationSettingsOpen,
    lastStockUpdateEvent,
    addToCart,
    triggerPushNotification,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [onlyOffers, setOnlyOffers] = useState(false);

  const categories = useMemo(() => {
    const cats = ['Todos'];
    products.forEach((p) => {
      if (!cats.includes(p.category)) {
        cats.push(p.category);
      }
    });
    return cats;
  }, [products]);

  const offerCount = useMemo(() => {
    return products.filter((p) => Boolean(p.isOffer && p.discountPercentage && p.discountPercentage > 0)).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      const matchesOffers = !onlyOffers || Boolean(p.isOffer);

      return matchesSearch && matchesCategory && matchesOffers;
    });
  }, [products, searchQuery, selectedCategory, onlyOffers]);

  const creditAvailableUSD = currentCustomer
    ? Math.max(0, currentCustomer.creditLimitUSD - currentCustomer.currentDebtUSD)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* Customer Account & Welcome Banner */}
      {currentCustomer ? (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Cliente Autenticado
                </span>
                <span className="text-xs text-slate-300">RIF: {currentCustomer.rif}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold mt-1 tracking-tight text-white">
                {currentCustomer.name}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentCustomer.phone} • {currentCustomer.address}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Notification Preferences Quick Action */}
              <button
                type="button"
                onClick={() => setIsNotificationSettingsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                title="Configurar Notificaciones Push"
              >
                <Bell className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Push Notifs</span>
              </button>

              {/* Credit Box */}
              <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/10 text-xs">
                <CreditCard className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-300 uppercase font-semibold">Crédito Comercial</p>
                  {currentCustomer.hasCredit ? (
                    <p className="font-bold text-emerald-300 font-mono text-xs">
                      Disp: ${creditAvailableUSD.toFixed(2)} ({currentCustomer.creditDays}d)
                    </p>
                  ) : (
                    <p className="text-amber-300 font-semibold text-xs">Contado</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Guest Banner with CTA to Login/Register */
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-extrabold uppercase tracking-wider text-blue-100">
              <Sparkles className="w-3.5 h-3.5" /> Portal de Compras Oficial
            </span>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              ¡Bienvenido a nuestro Portal de Pedidos!
            </h2>
            <p className="text-xs text-blue-100 max-w-xl">
              Inicia sesión o regístrate para activar tu línea de crédito comercial, consultar tu historial de compras y recibir notificaciones en tiempo real.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-blue-600" />
            <span>Ingresar o Registrarse</span>
          </button>
        </div>
      )}

      {/* Main Tabs: Catálogo General vs Muro de Ofertas */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStoreTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
              storeTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Catálogo de Productos</span>
          </button>

          <button
            type="button"
            onClick={() => setStoreTab('offers')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer relative ${
              storeTab === 'offers'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-xs'
                : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Muro de Ofertas</span>
            {offerCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-rose-700">
                {offerCount}
              </span>
            )}
          </button>
        </div>

        {/* Right side: BCV Rate & Live Real-Time Stock Status */}
        <div className="flex items-center gap-2">
          {/* Real-time live stock indicator */}
          <div
            className="flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl text-emerald-800 font-semibold"
            title="El inventario se sincroniza en tiempo real para todos los clientes conectados"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">Stock en Vivo</span>
          </div>

          {/* BCV Rate Pill */}
          <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 font-mono font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tasa BCV: <strong>{settings.bcvRate.toFixed(2)} Bs/$</strong></span>
          </div>
        </div>
      </div>

      {/* Real-time Stock Sync Pulse Banner if recent order placed */}
      {lastStockUpdateEvent && Date.now() - lastStockUpdateEvent.timestamp < 10000 && (
        <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-300" />
            <span>
              {lastStockUpdateEvent.summary || 'El stock del catálogo se ha actualizado en tiempo real.'}
            </span>
          </div>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
            Sincronizado
          </span>
        </div>
      )}

      {/* RENDER ACTIVE TAB */}
      {storeTab === 'offers' ? (
        <OffersWall />
      ) : (
        /* CATALOG VIEW */
        <div className="space-y-4">
          {/* Search Bar & Category Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Bar matching screenshot */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Escanear código o escribir producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
                />
              </div>

              {/* Offers filter quick toggle */}
              <button
                type="button"
                onClick={() => setOnlyOffers(!onlyOffers)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                  onlyOffers
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Solo Ofertas</span>
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-500">
              Mostrando {filteredProducts.length} productos (en pares de 2)
            </p>
          </div>

          {/* Products Grid - STRICTLY IN PAIRS OF 2 (2 COLUMNS) AS REQUESTED BY USER */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <p className="text-slate-500 font-medium text-base">
                No se encontraron productos con los filtros seleccionados.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Intenta con otro término de búsqueda o selecciona otra categoría.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Todos');
                  setOnlyOffers(false);
                }}
                className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
