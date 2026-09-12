import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { StoreCatalog } from './components/store/StoreCatalog';
import { CartDrawer } from './components/store/CartDrawer';
import { CustomerOrdersModal } from './components/store/CustomerOrdersModal';
import { ErpDashboard } from './components/erp/ErpDashboard';
import { InvoiceModal } from './components/common/InvoiceModal';
import { CustomerAuthModal } from './components/store/CustomerAuthModal';
import { NotificationSettingsModal } from './components/store/NotificationSettingsModal';
import { NotificationManagerModal } from './components/erp/NotificationManagerModal';
import { PushNotificationToastContainer } from './components/common/PushNotificationToast';

const MainLayout: React.FC = () => {
  const {
    mode,
    selectedInvoiceForModal,
    setSelectedInvoiceForModal,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isNotificationSettingsOpen,
    setIsNotificationSettingsOpen,
    isSellerAlertsModalOpen,
    setIsSellerAlertsModalOpen,
  } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white relative">
      {/* Real-time Push Notification Toast Container (Floating Top-Right) */}
      <PushNotificationToastContainer />

      {/* Top Main Navigation Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex-1">
        {mode === 'store' ? (
          <main className="pb-16">
            <StoreCatalog />
            <CartDrawer />
            <CustomerOrdersModal />
          </main>
        ) : (
          <ErpDashboard />
        )}
      </div>

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
