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
} from 'lucide-react';

export type ErpTab = 'pos' | 'pedidos' | 'inventario' | 'cxc' | 'cxp' | 'reportes' | 'configuracion';

interface ErpNavbarProps {
  activeTab: ErpTab;
  onSelectTab: (tab: ErpTab) => void;
  pendingOrdersCount: number;
  lowStockCount: number;
  overdueReceivablesCount: number;
}

export const ErpNavbar: React.FC<ErpNavbarProps> = ({
  activeTab,
  onSelectTab,
  pendingOrdersCount,
  lowStockCount,
  overdueReceivablesCount,
}) => {
  const { setIsSellerAlertsModalOpen } = useApp();

  const totalCriticalAlerts = pendingOrdersCount + lowStockCount + overdueReceivablesCount;

  const tabs = [
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
  );
};
