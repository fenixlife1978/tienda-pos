import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { LandingPage } from './components/landing/LandingPage';
import { CustomerDashboard } from './components/customer/CustomerDashboard';
import { CartDrawer } from './components/store/CartDrawer';
import { CustomerOrdersModal } from './components/store/CustomerOrdersModal';
import { ErpDashboard } from './components/erp/ErpDashboard';
import { InvoiceModal } from './components/common/InvoiceModal';
import { CustomerAuthModal } from './components/store/CustomerAuthModal';
import { AdminLoginModal } from './components/common/AdminLoginModal';
import { NotificationSettingsModal } from './components/store/NotificationSettingsModal';
import { NotificationManagerModal } from './components/erp/NotificationManagerModal';
import { PushNotificationToastContainer } from './components/common/PushNotificationToast';
import { BcvControlPanelModal } from './components/common/BcvControlPanelModal';
import { CategoryUnitManagementModal } from './components/common/CategoryUnitManagementModal';
import { PresentationSaleModal } from './components/common/PresentationSaleModal';

const MainLayout: React.FC = () => {
  const {
    mode,
    currentCustomer,
    isAdminActive,
    authInitialTab,
    selectedInvoiceForModal,
    setSelectedInvoiceForModal,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isAdminModalOpen,
    setIsAdminModalOpen,
    isNotificationSettingsOpen,
    setIsNotificationSettingsOpen,
    isSellerAlertsModalOpen,
    setIsSellerAlertsModalOpen,
  } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white relative">
      {/* Real-time Push Notification Toast Container (Floating Top-Right) */}
      <PushNotificationToastContainer />

      {/* Main Routing Architecture */}
      {isAdminActive && mode === 'erp' ? (
        <>
          <Header />
          <div className="flex-1">
            <ErpDashboard />
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

      {/* Global Invoice Preview / Print Modal */}
      {selectedInvoiceForModal && (
        <InvoiceModal
          invoice={selectedInvoiceForModal}
          onClose={() => setSelectedInvoiceForModal(null)}
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
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
