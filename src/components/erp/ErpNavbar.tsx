import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calculator,
  ClipboardList,
  Boxes,
  HandCoins,
  Receipt,
  BarChart3,
  Settings,
  Bell,
  Send,
  TrendingUp,
  Layers,
  Building2,
  LayoutDashboard,
  UserCheck,
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

export type ErpTab =
  | 'dashboard'
  | 'pos'
  | 'pedidos'
  | 'solicitudes'
  | 'inventario'
  | 'cxc'
  | 'cxp'
  | 'reportes'
  | 'configuracion';

interface ErpNavbarProps {
  activeTab: ErpTab;
  onSelectTab: (tab: ErpTab) => void;
  pendingOrdersCount: number;
  pendingRequestsCount: number;
  lowStockCount: number;
  overdueReceivablesCount: number;
}

export const ErpNavbar: React.FC<ErpNavbarProps> = ({
  activeTab,
  onSelectTab,
  pendingOrdersCount,
  pendingRequestsCount,
  lowStockCount,
  overdueReceivablesCount,
}) => {
  const {
    setIsSellerAlertsModalOpen,
    setIsBcvPanelOpen,
    setIsCategoryUnitModalOpen,
    setIsBusinessSettingsModalOpen,
    settings,
  } = useApp();

  const totalCriticalAlerts =
    pendingOrdersCount + pendingRequestsCount + lowStockCount + overdueReceivablesCount;

  const tabs = [
    {
      id: 'dashboard' as ErpTab,
      label: 'Dashboard & Ventas',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'pos' as ErpTab,
      label: 'Punto de Venta (POS)',
      icon: Calculator,
      badge: null,
    },
    {
      id: 'pedidos' as ErpTab,
      label: 'Gestión de Pedidos',
      icon: ClipboardList,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'solicitudes' as ErpTab,
      label: 'Gestión de Solicitudes',
      icon: UserCheck,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
      badgeColor: 'bg-indigo-600 text-white animate-pulse',
    },
    {
      id: 'inventario' as ErpTab,
      label: 'Control de Inventarios',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'cxc' as ErpTab,
      label: 'Cuentas por Cobrar (CxC)',
      icon: HandCoins,
      badge: overdueReceivablesCount > 0 ? overdueReceivablesCount : null,
      badgeColor: 'bg-rose-600 text-white',
    },
    {
      id: 'cxp' as ErpTab,
      label: 'Cuentas por Pagar (CxP)',
      icon: Receipt,
      badge: null,
    },
    {
      id: 'reportes' as ErpTab,
      label: 'Reportes Financieros',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'configuracion' as ErpTab,
      label: 'Configuración & Usuarios',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2 gap-3">
          <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar py-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== null && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${tab.badgeColor}`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Tasa BCV Quick Manager */}
            <button
              type="button"
              onClick={() => setIsBcvPanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Panel de Control Tasa BCV (Manual y Automático)"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-mono text-[11px] sm:text-xs">BCV: {settings.bcvRate.toFixed(2)} Bs</span>
            </button>

            {/* Categorías y Unidades */}
            <button
              type="button"
              onClick={() => setIsCategoryUnitModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Gestionar Categorías y Unidades de Medida"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Categorías & Unidades</span>
            </button>

            {/* Datos de la Empresa / Distribuidora */}
            <button
              type="button"
              onClick={() => setIsBusinessSettingsModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Configurar Datos Comerciales, RIF, Logo y Políticas de Crédito"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Datos del Negocio</span>
            </button>

            {/* PWA Install Button in ERP Navbar */}
            <PWAInstallButton className="hidden xl:inline-flex" variant="full" />

            {/* Quick Alert & Push Broadcaster CTA */}
            <button
              type="button"
              onClick={() => setIsSellerAlertsModalOpen(true)}
              className="hidden lg:flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Centro de Alertas & Push</span>
              {totalCriticalAlerts > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                  {totalCriticalAlerts}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
