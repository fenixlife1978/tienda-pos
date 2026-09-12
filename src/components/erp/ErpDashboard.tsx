import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ErpNavbar, ErpTab } from './ErpNavbar';
import { PosView } from './PosView';
import { OrdersManagementView } from './OrdersManagementView';
import { InventoryView } from './InventoryView';
import { AccountsReceivableView } from './AccountsReceivableView';
import { AccountsPayableView } from './AccountsPayableView';
import { FinancialReportsView } from './FinancialReportsView';
import { SettingsAndUsersView } from './SettingsAndUsersView';

export const ErpDashboard: React.FC = () => {
  const { orders, products, receivables } = useApp();
  const [activeTab, setActiveTab] = useState<ErpTab>('pos');

  // Count badges for the ERP tabs
  const pendingOrdersCount = orders.filter((o) => o.orderStatus === 'pendiente').length;
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const overdueReceivablesCount = receivables.filter((r) => r.status === 'vencido').length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-100/60 pb-16">
      {/* ERP Secondary Navigation Bar */}
      <ErpNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingOrdersCount={pendingOrdersCount}
        lowStockCount={lowStockCount}
        overdueReceivablesCount={overdueReceivablesCount}
      />

      {/* Render Active Module */}
      <main>
        {activeTab === 'pos' && <PosView />}
        {activeTab === 'pedidos' && <OrdersManagementView />}
        {activeTab === 'inventario' && <InventoryView />}
        {activeTab === 'cxc' && <AccountsReceivableView />}
        {activeTab === 'cxp' && <AccountsPayableView />}
        {activeTab === 'reportes' && <FinancialReportsView />}
        {activeTab === 'configuracion' && <SettingsAndUsersView />}
      </main>
    </div>
  );
};
