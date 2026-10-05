import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ErpNavbar, ErpTab } from './ErpNavbar';
import { SalesDashboardView } from './SalesDashboardView';
import { PosView } from './PosView';
import { OrdersManagementView } from './OrdersManagementView';
import { CustomerRequestsManagementView } from './CustomerRequestsManagementView';
import { InventoryView } from './InventoryView';
import { PurchasesEntryView } from './PurchasesEntryView';
import { SupplierManagementView } from './SupplierManagementView';
import { ProfitabilityMarginView } from './ProfitabilityMarginView';
import { PromotionsManagementView } from './PromotionsManagementView';
import { AccountsReceivableView } from './AccountsReceivableView';
import { AccountsPayableView } from './AccountsPayableView';
import { FinancialReportsView } from './FinancialReportsView';
import { SettingsAndUsersView } from './SettingsAndUsersView';
import { CashRegisterView } from './CashRegisterView';
import { InventoryTransfersView } from './InventoryTransfersView';
import { TerminalManagementView } from './TerminalManagementView';
import { SalesManagementView } from './SalesManagementView';

export const ErpDashboard: React.FC = () => {
  const { currentUser, orders, products, receivables, customers } = useApp();
  const isCashier = currentUser?.role === 'cajero';
  const cashierAllowedTabs: ErpTab[] = ['caja', 'pos', 'pedidos', 'cxc'];
  const isAllowedForCashier = (tab: ErpTab) => !isCashier || cashierAllowedTabs.includes(tab);
  const [activeTab, setActiveTab] = useState<ErpTab>(() => {
    const saved = localStorage.getItem('omni_erp_active_tab') as ErpTab | null;
    return saved || 'dashboard';
  });

  useEffect(() => {
    if (isCashier && !isAllowedForCashier(activeTab)) {
      setActiveTab('pos');
      return;
    }
    localStorage.setItem('omni_erp_active_tab', activeTab);
  }, [activeTab, isCashier]);

  useEffect(() => {
    const handler = (event: Event) => {
      const tab = (event as CustomEvent<string>).detail as ErpTab;
      if (tab && isAllowedForCashier(tab)) setActiveTab(tab);
    };
    window.addEventListener('omni-restore-erp-tab', handler);
    return () => window.removeEventListener('omni-restore-erp-tab', handler);
  }, [isCashier]);

  // Count badges for the ERP tabs
  const pendingOrdersCount = orders.filter(
    (o) => o.orderStatus === 'pendiente' || o.orderStatus === 'en_tramite'
  ).length;
  const pendingRequestsCount = customers.filter(
    (c) =>
      c.verificationStatus === 'pending' ||
      (c.isFirstTime && c.verificationStatus !== 'verified' && c.verificationStatus !== 'rejected') ||
      c.creditStatus === 'pending'
  ).length;
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const overdueReceivablesCount = receivables.filter((r) => r.status === 'vencido').length;
  // Solo cuentan pagos enviados por clientes que siguen pendientes de aprobación.
  const pendingCustomerPaymentsCount = receivables.reduce(
    (count, receivable) =>
      count +
      (receivable.paymentHistory || []).filter(
        (payment) => payment.reportedByCustomer && payment.verificationStatus === 'pendiente'
      ).length,
    0
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-100/60 pb-16">
      {/* ERP Secondary Navigation Bar */}
      <ErpNavbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (isAllowedForCashier(tab)) setActiveTab(tab);
        }}
        pendingOrdersCount={pendingOrdersCount}
        pendingRequestsCount={pendingRequestsCount}
        lowStockCount={lowStockCount}
        overdueReceivablesCount={overdueReceivablesCount}
        pendingCustomerPaymentsCount={pendingCustomerPaymentsCount}
      />

      {/* Render Active Module */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && !isCashier && <SalesDashboardView />} 
        {activeTab === 'ventas' && !isCashier && <SalesManagementView />}
        {activeTab === 'caja' && <CashRegisterView />}
        {activeTab === 'pos' && <PosView />}
        {activeTab === 'pedidos' && <OrdersManagementView />}
        {activeTab === 'solicitudes' && !isCashier && <CustomerRequestsManagementView />}
        {activeTab === 'inventario' && !isCashier && <InventoryView />}
        {activeTab === 'almacenes' && !isCashier && <InventoryTransfersView />}
        {activeTab === 'entradas_compras' && !isCashier && <PurchasesEntryView />}
        {activeTab === 'proveedores' && !isCashier && <SupplierManagementView />}
        {activeTab === 'rentabilidad' && !isCashier && <ProfitabilityMarginView />}
        {activeTab === 'promociones' && !isCashier && <PromotionsManagementView />}
        {activeTab === 'cxc' && <AccountsReceivableView />}
        {activeTab === 'cxp' && !isCashier && <AccountsPayableView />}
        {activeTab === 'reportes' && !isCashier && <FinancialReportsView />}
        {activeTab === 'terminales' && !isCashier && <TerminalManagementView />}
        {activeTab === 'configuracion' && !isCashier && <SettingsAndUsersView />}
      </main>
    </div>
  );
};

