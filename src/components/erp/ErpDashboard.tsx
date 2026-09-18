import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ErpNavbar, ErpTab } from './ErpNavbar';
import { SalesDashboardView } from './SalesDashboardView';
import { PosView } from './PosView';
import { OrdersManagementView } from './OrdersManagementView';
import { CustomerRequestsManagementView } from './CustomerRequestsManagementView';
import { InventoryView } from './InventoryView';
import { PurchasesEntryView } from './PurchasesEntryView';
import { ProfitabilityMarginView } from './ProfitabilityMarginView';
import { PromotionsManagementView } from './PromotionsManagementView';
import { AccountsReceivableView } from './AccountsReceivableView';
import { AccountsPayableView } from './AccountsPayableView';
import { FinancialReportsView } from './FinancialReportsView';
import { SettingsAndUsersView } from './SettingsAndUsersView';

export const ErpDashboard: React.FC = () => {
  const { orders, products, receivables, customers } = useApp();
  const [activeTab, setActiveTab] = useState<ErpTab>('dashboard');

  // Count badges for the ERP tabs
  const pendingOrdersCount = orders.filter((o) => o.orderStatus === 'pendiente').length;
  const pendingRequestsCount = customers.filter(
    (c) =>
      c.verificationStatus === 'pending' ||
      (c.isFirstTime && c.verificationStatus !== 'verified' && c.verificationStatus !== 'rejected') ||
      c.creditStatus === 'pending'
  ).length;
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const overdueReceivablesCount = receivables.filter((r) => r.status === 'vencido').length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-100/60 pb-16">
      {/* ERP Secondary Navigation Bar */}
      <ErpNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingOrdersCount={pendingOrdersCount}
        pendingRequestsCount={pendingRequestsCount}
        lowStockCount={lowStockCount}
        overdueReceivablesCount={overdueReceivablesCount}
      />

      {/* Render Active Module */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && <SalesDashboardView />}
        {activeTab === 'pos' && <PosView />}
        {activeTab === 'pedidos' && <OrdersManagementView />}
        {activeTab === 'solicitudes' && <CustomerRequestsManagementView />}
        {activeTab === 'inventario' && <InventoryView />}
        {activeTab === 'entradas_compras' && <PurchasesEntryView />}
        {activeTab === 'rentabilidad' && <ProfitabilityMarginView />}
        {activeTab === 'promociones' && <PromotionsManagementView />}
        {activeTab === 'cxc' && <AccountsReceivableView />}
        {activeTab === 'cxp' && <AccountsPayableView />}
        {activeTab === 'reportes' && <FinancialReportsView />}
        {activeTab === 'configuracion' && <SettingsAndUsersView />}
      </main>
    </div>
  );
};

