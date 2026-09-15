import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LogIn,
  UserPlus,
  Truck,
  FileText,
  CreditCard,
  BellRing,
  ShieldCheck,
  TrendingUp,
  Package,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Sparkles,
  Percent,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const {
    settings,
    products,
    setIsAuthModalOpen,
    setAuthInitialTab,
    isAdminModalOpen,
    setIsAdminModalOpen,
  } = useApp();

  const handleOpenLogin = () => {
    setAuthInitialTab('login');
    setIsAuthModalOpen(true);
  };

  const handleOpenRegister = () => {
    setAuthInitialTab('register');
    setIsAuthModalOpen(true);
  };

  // Featured products for preview (pairs of 2)
  const previewProducts = products.slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src="/logo.png"
                alt="Distribuidora La Gran Bodega M&S"
                className="h-12 sm:h-14 w-auto object-contain rounded-xl shadow-xs"
              />
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">
                  DISTRIBUIDORA LA GRAN BODEGA M&S
                </h1>
                <p className="text-[11px] sm:text-xs text-blue-700 font-bold uppercase tracking-wider">
                  Portal Mayorista & Detal
                </p>
              </div>
            </div>

            {/* Right actions: BCV Ticker, Auth Buttons & Discreet Staff Lock */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Tasa Oficial BCV:</span>
                <span className="font-mono font-bold">{settings.bcvRate.toFixed(2)} Bs/$</span>
              </div>

              <button
                onClick={handleOpenLogin}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-xl transition cursor-pointer"
                title="Acceso para clientes y comercios"
              >
                <LogIn className="w-4 h-4 text-blue-600" />
                <span>Iniciar Sesión</span>
              </button>

              <button
                onClick={handleOpenRegister}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
                title="Registrar cuenta de cliente"
              >
                <UserPlus className="w-4 h-4" />
                <span>Registrarse</span>
              </button>

              {/* Botón para ingresar como Administrador */}
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition cursor-pointer shadow-xs"
                title="Ingresar como Administrador / ERP"
              >
                <Lock className="w-3.5 h-3.5 text-slate-700" />
                <span>Acceso Admin</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-slate-900 to-slate-950 text-white py-14 sm:py-20">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span>Distribución Líder en Venezuela • Despacho Inmediato</span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                DISTRIBUIDORA LA GRAN BODEGA <span className="text-yellow-400">M&S</span>
              </h2>

              <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                El canal digital oficial para bodegas, panaderías, supermercados y clientes mayoristas y detal. 
                Consulta el catálogo en tiempo real, gestiona tus órdenes con estados simplificados <strong className="text-white">"En trámite"</strong> y <strong className="text-white">"Despachado/Facturado"</strong>, y descarga tus facturas con respaldo a tasa oficial BCV.
              </p>

              {/* Call to Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <button
                  onClick={handleOpenLogin}
                  className="w-full sm:w-auto px-6 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg hover:shadow-blue-500/25 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Ingresar a Mi Cuenta</span>
                </button>

                <button
                  onClick={handleOpenRegister}
                  className="w-full sm:w-auto px-6 py-3.5 text-sm font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  <span>Registrar Nueva Cuenta de Cliente</span>
                </button>
              </div>

              {/* Quick Trust Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Factura Fiscal Seniat</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Crédito a 15 y 30 días</span>
                </div>
                <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Tasa oficial BCV</span>
                </div>
              </div>

            </div>

            {/* Right Card with Official 3D Logo */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-md w-full text-center space-y-5">
                <div className="relative mx-auto w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/80 bg-slate-950 flex items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="Logo Distribuidora La Gran Bodega M&S"
                    className="w-full h-full object-contain p-2"
                  />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">
                    DISTRIBUIDORA LA GRAN BODEGA M&S
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    RIF: {settings.companyRif} • San Felipe, Edo. Yaracuy
                  </p>
                </div>

                <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 text-left space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Tasa del Día BCV:</span>
                    <span className="font-mono font-bold text-emerald-400">{settings.bcvRate.toFixed(2)} Bs/$</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Modalidad de Pedido:</span>
                    <span className="font-semibold text-blue-300">En línea o al mayor</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Seguimiento:</span>
                    <span className="font-semibold text-amber-300">En trámite → Despachado</span>
                  </div>
                </div>

                <button
                  onClick={handleOpenLogin}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Acceso Exclusivo para Clientes
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4 Pillars Section */}
      <section className="py-14 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              ¿Por qué ordenar con Distribuidora La Gran Bodega M&S?
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Facilitamos el aprovisionamiento de tu negocio con máxima seriedad, transparencia y rapidez.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Pillar 1 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                <Truck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1.5">Despacho Garantizado</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Flota de camiones con despacho puntual directo a tu local comercial o dirección registrada.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1.5">Facturación & Tasa BCV</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Emisión de facturas fiscales oficiales. Precios transparentes calculados en Bs y Divisas al cambio legal.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                <CreditCard className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1.5">Línea de Crédito Comercial</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Plazos de 15 a 30 días para comercios afiliados con límites acordes al volumen de compras.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-4">
                <BellRing className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1.5">Alertas y Notificaciones</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Avisos instantáneos cuando tu pedido pase a <strong>"En trámite"</strong> o sea <strong>"Despachado/Facturado"</strong>.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Product Catalog Preview (Pairs of 2) */}
      <section className="py-14 bg-slate-100/70 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                Muestrario de Productos
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5">
                Catálogo Mayorista y Detal
              </h3>
              <p className="text-xs text-slate-500">
                Visualización de productos en cuadrícula en pares. Inicia sesión para solicitar cotizaciones y compras.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenLogin}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>Acceder para Comprar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grid in pairs of 2 */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {previewProducts.map((product) => {
              const priceBs = product.priceUSD * settings.bcvRate;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div className="relative aspect-video sm:aspect-4/3 bg-slate-100 overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {product.isOffer && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <Percent className="w-3 h-3" />
                        Oferta -{product.discountPercentage}%
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-bold">
                      {product.category}
                    </span>
                  </div>

                  <div className="p-3 sm:p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-mono">Cód: {product.code}</p>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-tight">
                        {product.name}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-sm sm:text-base font-extrabold text-blue-700">
                          ${product.priceUSD.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
                        </div>
                      </div>

                      <button
                        onClick={handleOpenLogin}
                        className="px-2.5 sm:px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
                      >
                        Pedir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Banner to Register */}
          <div className="mt-8 bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-6 sm:p-8 text-center space-y-3">
            <h4 className="text-lg sm:text-xl font-black">
              ¿Listo para realizar tu primer pedido al mayor o al detal?
            </h4>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl mx-auto">
              Crea tu cuenta de cliente en segundos. Asignamos cupos de crédito, listas de precios preferenciales y despacho directo.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={handleOpenRegister}
                className="px-6 py-2.5 bg-white text-blue-800 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Crear Mi Cuenta Ahora
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 pt-12 pb-8 mt-auto text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* Col 1: Brand & Logo */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Logo Gran Bodega"
                  className="h-10 w-auto object-contain rounded-lg"
                />
                <span className="font-extrabold text-white text-sm">
                  DISTRIBUIDORA LA GRAN BODEGA M&S
                </span>
              </div>
              <p className="text-slate-400 text-xs max-w-md leading-relaxed">
                Empresa líder en abastecimiento y comercialización de víveres, alimentos y artículos de consumo masivo en Venezuela. Facturación fiscal y tasa oficial BCV garantizada.
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                RIF: {settings.companyRif}
              </p>
            </div>

            {/* Col 2: Contacto */}
            <div className="space-y-2">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Contacto Directo</h5>
              <p className="flex items-center gap-2 text-xs">
                <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{settings.companyPhone}</span>
              </p>
              <p className="flex items-center gap-2 text-xs">
                <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{settings.companyEmail}</span>
              </p>
              <p className="flex items-start gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>{settings.companyAddress}</span>
              </p>
            </div>

            {/* Col 3: Portal de Clientes */}
            <div className="space-y-2">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Acceso a Clientes</h5>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <button onClick={handleOpenLogin} className="hover:text-white transition cursor-pointer">
                    Iniciar Sesión de Cliente
                  </button>
                </li>
                <li>
                  <button onClick={handleOpenRegister} className="hover:text-white transition cursor-pointer">
                    Registrar Nuevo Comercio / Cliente
                  </button>
                </li>
                <li>
                  <button onClick={handleOpenLogin} className="hover:text-white transition cursor-pointer">
                    Consultar Mis Facturas
                  </button>
                </li>
                <li>
                  <button onClick={handleOpenLogin} className="hover:text-white transition cursor-pointer">
                    Seguimiento de Pedidos
                  </button>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar with discreet Admin Link */}
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <p>© {new Date().getFullYear()} DISTRIBUIDORA LA GRAN BODEGA M&S. Todos los derechos reservados.</p>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-blue-400 hover:underline transition cursor-pointer"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Acceso Administrativo / Personal Interno</span>
              </button>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
};
