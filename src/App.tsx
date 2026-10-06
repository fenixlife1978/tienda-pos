import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { LandingPage } from './components/landing/LandingPage';
import { CustomerDashboard } from './components/customer/CustomerDashboard';
import { CartDrawer } from './components/store/CartDrawer';
import { CustomerOrdersModal } from './components/store/CustomerOrdersModal';
import { ErpDashboard } from './components/erp/ErpDashboard';
import { OffersWall } from './components/store/OffersWall';
import { InvoiceModal } from './components/common/InvoiceModal';
import { CustomerAuthModal } from './components/store/CustomerAuthModal';
import { AdminLoginModal } from './components/common/AdminLoginModal';
import { NotificationSettingsModal } from './components/store/NotificationSettingsModal';
import { CustomerNotificationsModal } from './components/store/CustomerNotificationsModal';
import { NotificationManagerModal } from './components/erp/NotificationManagerModal';
import { PushNotificationToastContainer } from './components/common/PushNotificationToast';
import { BcvControlPanelModal } from './components/common/BcvControlPanelModal';
import { CategoryUnitManagementModal } from './components/common/CategoryUnitManagementModal';
import { PresentationSaleModal } from './components/common/PresentationSaleModal';
import { OrderSuccessModal } from './components/store/OrderSuccessModal';
import { BusinessSettingsModal } from './components/erp/BusinessSettingsModal';
import { OfflineIndicator } from './components/common/OfflineIndicator';


class ErpRenderBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error('ERP render error:', error);
  }

  handleReset = () => {
    try {
      sessionStorage.removeItem('omni_erp_active_tab');
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex-1 min-h-[calc(100vh-64px)] bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-rose-200 rounded-2xl shadow-sm p-6">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-black text-slate-900">No se pudo cargar el panel ERP</h2>
          <p className="mt-2 text-sm text-slate-600">Se produjo un error al renderizar el módulo administrativo.</p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-slate-950 text-rose-200 p-3 text-xs whitespace-pre-wrap break-words">{this.state.message}</pre>
          <button type="button" onClick={this.handleReset} className="mt-4 w-full rounded-xl bg-indigo-600 text-white py-2.5 text-sm font-bold">Reintentar ERP</button>
        </div>
      </div>
    );
  }
}

const MainLayout: React.FC = () => {
  const {
    mode,
    currentCustomer,
    isAdminActive,
    authInitialTab,
    selectedInvoiceForModal,
    setSelectedInvoiceForModal,
    customerInvoiceModalMode,
    lastSuccessfulOrder,
    setLastSuccessfulOrder,
    invoices,
    orders,
    setIsOrdersModalOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isAdminModalOpen,
    setIsAdminModalOpen,
    isNotificationSettingsOpen,
    setIsNotificationSettingsOpen,
    isCustomerNotificationsOpen,
    setIsCustomerNotificationsOpen,
    isSellerAlertsModalOpen,
    setIsSellerAlertsModalOpen,
    isBusinessSettingsModalOpen,
    setIsBusinessSettingsModalOpen,
  } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white relative">
      {/* Real-time Push Notification Toast Container (Floating Top-Right) */}
      <PushNotificationToastContainer />

      {/* Main Routing Architecture */}
      {isAdminActive && mode === 'erp' ? (
        <ErpRenderBoundary>
          <Header />
          <div className="flex-1">
            <ErpDashboard />
          </div>
        </ErpRenderBoundary>
      ) : isAdminActive && mode === 'store' ? (
        <>
          <Header />
          <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
            <OffersWall />
          </div>
        </>
      ) : currentCustomer ? (
        <div className="flex-1">
          <CustomerDashboard />
          <CartDrawer />
          <CustomerOrdersModal />
        </div>
      ) : (
        <div className="flex-1">
          <LandingPage />
        </div>
      )}

      {/* Order Success Summary Modal with 'Share via WhatsApp' button */}
      <OrderSuccessModal
        isOpen={Boolean(lastSuccessfulOrder)}
        order={lastSuccessfulOrder}
        onClose={() => setLastSuccessfulOrder(null)}
        onViewInvoice={() => {
          if (lastSuccessfulOrder) {
            const inv = invoices.find((i) => i.orderId === lastSuccessfulOrder.id);
            if (inv) {
              setSelectedInvoiceForModal(inv);
            }
          }
        }}
        onViewOrders={() => {
          setLastSuccessfulOrder(null);
          setIsOrdersModalOpen(true);
        }}
      />

      {/* Global Invoice Preview / Print Modal */}
      {selectedInvoiceForModal && (
        <InvoiceModal
          invoice={selectedInvoiceForModal}
          onClose={() => setSelectedInvoiceForModal(null)}
          customerView={Boolean(currentCustomer)}
          customerOrderStatus={currentCustomer ? orders.find((o) => o.id === selectedInvoiceForModal.orderId)?.orderStatus : undefined}
          customerOrderView={Boolean(currentCustomer && customerInvoiceModalMode === 'order')}
        />
      )}

      {/* Customer Authentication & Registration Modal */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authInitialTab}
      />

      {/* Admin / Employee ERP Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      {/* Customer Notification Inbox: messages sent by administration */}
      <CustomerNotificationsModal
        isOpen={isCustomerNotificationsOpen}
        onClose={() => setIsCustomerNotificationsOpen(false)}
      />

      {/* Customer Push Notification Preferences Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
      />

      {/* Vendor Push Broadcast & Dashboard Alerts Modal */}
      <NotificationManagerModal
        isOpen={isSellerAlertsModalOpen}
        onClose={() => setIsSellerAlertsModalOpen(false)}
      />

      {/* BCV Control Panel (Manual & Auto BCV Rate Management) */}
      <BcvControlPanelModal />

      {/* Categories & Units of Measure CRUD Management Modal */}
      <CategoryUnitManagementModal />

      {/* Presentation, Weight-based (Queso, etc.) and Fractional Bs. (Licor) Sales Modal */}
      <PresentationSaleModal />

      {/* Business Identity & Commercial Credit Policies Modal */}
      <BusinessSettingsModal
        isOpen={isBusinessSettingsModalOpen}
        onClose={() => setIsBusinessSettingsModalOpen(false)}
      />

      {/* PWA Offline & Connectivity Restored Banner */}
      <OfflineIndicator />
    </div>
  );
};

class AppRenderBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Global app render error:', error, info);
  }

  handleReset = () => {
    try {
      sessionStorage.removeItem('omni_erp_active_tab');
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white border border-rose-200 rounded-2xl shadow-sm p-6">
          <div className="text-3xl mb-3">⚠️</div>
          <h1 className="text-lg font-black text-slate-900">Tienda POS encontró un error de ejecución</h1>
          <p className="mt-2 text-sm text-slate-600">
            El sistema se detuvo al actualizar los datos. El error quedó visible para poder corregirlo sin dejar la pantalla en blanco.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-slate-950 text-rose-200 p-3 text-xs whitespace-pre-wrap break-words">{this.state.message}</pre>
          <button type="button" onClick={this.handleReset} className="mt-4 w-full rounded-xl bg-indigo-600 text-white py-2.5 text-sm font-bold">
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <AppRenderBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </AppRenderBoundary>
  );
}
