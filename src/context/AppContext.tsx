import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  AppNotification,
  BcvHistoryEntry,
  CartItem,
  Customer,
  CustomerNotificationPreferences,
  CustomerPortalTab,
  Invoice,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PayableItem,
  Product,
  ProductCategory,
  ProductPresentation,
  ProductUnit,
  ReceivableItem,
  Supplier,
  SystemSettings,
  User,
} from '../types';
import { playNotificationSound } from '../utils/notificationSound';
import {
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_GENERIC_ADMIN,
  INITIAL_INVOICES,
  INITIAL_ORDERS,
  INITIAL_PAYABLES,
  INITIAL_PRODUCTS,
  INITIAL_RECEIVABLES,
  INITIAL_SETTINGS,
  INITIAL_SUPPLIERS,
  INITIAL_UNITS,
  INITIAL_USERS,
} from '../data/initialData';
import { tursoService, TursoSyncState } from '../services/tursoService';
import { fetchBcvRateFromApi, fetchBcvOfficialHistory } from '../services/bcvService';
import { scanAndGenerateReminders, AutomatedReminderRecord } from '../services/reminderService';

interface AppContextType {
  mode: 'store' | 'erp';
  setMode: (mode: 'store' | 'erp') => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  currentCustomer: Customer | null;
  setCurrentCustomer: (customer: Customer | null) => void;
  products: Product[];
  categories: ProductCategory[];
  addCategory: (category: Omit<ProductCategory, 'id'>) => void;
  deleteCategory: (categoryId: string) => { success: boolean; message: string };
  updateCategory: (category: ProductCategory) => void;
  units: ProductUnit[];
  addUnit: (unit: Omit<ProductUnit, 'id'>) => void;
  deleteUnit: (unitId: string) => { success: boolean; message: string };
  updateUnit: (unit: ProductUnit) => void;
  cart: CartItem[];
  orders: Order[];
  invoices: Invoice[];
  receivables: ReceivableItem[];
  payables: PayableItem[];
  suppliers: Supplier[];
  customers: Customer[];
  users: User[];
  settings: SystemSettings;
  notifications: AppNotification[];
  // Actions
  addToCart: (product: Product, quantity?: number) => void;
  addToCartWithPresentation: (
    product: Product,
    options: {
      presentation?: ProductPresentation;
      quantity?: number;
      saleMode?: 'standard' | 'presentation' | 'weight' | 'custom_amount';
      weightKg?: number;
      customAmountBs?: number;
      customAmountUSD?: number;
      unitPriceUSD?: number;
      customNote?: string;
    }
  ) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  createOrder: (orderInput: {
    customerId: string;
    customerName: string;
    customerRif: string;
    customerPhone: string;
    customerAddress: string;
    items: {
      product: Product;
      quantity: number;
      selectedPresentation?: ProductPresentation;
      saleMode?: 'standard' | 'presentation' | 'weight' | 'custom_amount';
      weightKg?: number;
      customAmountBs?: number;
      customAmountUSD?: number;
      unitPriceUSD?: number;
      customNote?: string;
    }[];
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    channel: 'online' | 'pos';
    notes?: string;
    customCreditDays?: number;
  }) => { order: Order; invoice: Invoice };
  reorder: (orderId: string) => boolean;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updatePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => void;
  updateBcvRate: (
    newRate: number,
    updatedBy?: string,
    type?: 'manual' | 'automatic',
    extra?: {
      effectiveDate?: string;
      source?: string;
      currencies?: {
        EUR?: number;
        CNY?: number;
        TRY?: number;
        RUB?: number;
      };
    }
  ) => void;
  fetchAutomaticBcvRate: () => Promise<number>;
  syncBcvOfficialHistory: (daysLimit?: number) => Promise<number>;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  adjustProductStock: (productId: string, delta: number, reason: string) => void;
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (customer: Customer) => void;
  updateCustomerCredit: (customerId: string, hasCredit: boolean, creditDays: number, creditLimitUSD: number) => void;
  approveCustomerCreditRequest: (customerId: string, approvedLimitUSD: number, approvedCreditDays: number) => void;
  rejectCustomerCreditRequest: (customerId: string) => void;
  registerReceivablePayment: (receivableId: string, amountUSD: number) => void;
  registerPayablePayment: (payableId: string, amountUSD: number) => void;
  addSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  updateSupplier: (supplier: Supplier) => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (userId: string) => { success: boolean; message: string };
  resetSystemToFactory: () => void;
  refreshBcvRate: () => Promise<number>;
  updateSettings: (settings: Partial<SystemSettings>) => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  // Advanced Push Notifications
  activePushToasts: AppNotification[];
  dismissPushToast: (id: string) => void;
  triggerPushNotification: (options: {
    title: string;
    message: string;
    type?: AppNotification['type'];
    relatedOrderId?: string;
    badge?: string;
    sound?: boolean;
  }) => void;
  broadcastPushNotification: (options: {
    title: string;
    message: string;
    type: AppNotification['type'];
    targetRole?: 'client' | 'seller' | 'all';
    targetCustomerId?: string;
    badge?: string;
  }) => void;
  // Customer Auth & Preferences
  loginCustomer: (identifier: string, password?: string) => boolean;
  registerCustomer: (customerData: Omit<Customer, 'id'>) => Customer;
  logoutCustomer: () => void;
  updateCustomerPreferences: (preferences: CustomerNotificationPreferences) => void;
  // Navigation tabs & modals
  storeTab: 'catalog' | 'offers';
  setStoreTab: (tab: 'catalog' | 'offers') => void;
  customerPortalTab: CustomerPortalTab;
  setCustomerPortalTab: (tab: CustomerPortalTab) => void;
  isAdminActive: boolean;
  setIsAdminActive: (active: boolean) => void;
  authInitialTab: 'login' | 'register';
  setAuthInitialTab: (tab: 'login' | 'register') => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isAdminModalOpen: boolean;
  setIsAdminModalOpen: (open: boolean) => void;
  isNotificationSettingsOpen: boolean;
  setIsNotificationSettingsOpen: (open: boolean) => void;
  isSellerAlertsModalOpen: boolean;
  setIsSellerAlertsModalOpen: (open: boolean) => void;
  isBusinessSettingsModalOpen: boolean;
  setIsBusinessSettingsModalOpen: (open: boolean) => void;
  // BCV Control Panel & Category/Unit Modal
  isBcvPanelOpen: boolean;
  setIsBcvPanelOpen: (open: boolean) => void;
  isCategoryUnitModalOpen: boolean;
  setIsCategoryUnitModalOpen: (open: boolean) => void;
  presentationModalProduct: Product | null;
  setPresentationModalProduct: (p: Product | null) => void;
  presentationCallback: ((result: {
    product: Product;
    presentation?: ProductPresentation;
    quantity: number;
    saleMode: 'standard' | 'presentation' | 'weight' | 'custom_amount';
    weightKg?: number;
    customAmountBs?: number;
    customAmountUSD?: number;
    unitPriceUSD: number;
    customNote?: string;
  }) => void) | null;
  openPresentationModal: (
    product: Product,
    callback?: (result: {
      product: Product;
      presentation?: ProductPresentation;
      quantity: number;
      saleMode: 'standard' | 'presentation' | 'weight' | 'custom_amount';
      weightKg?: number;
      customAmountBs?: number;
      customAmountUSD?: number;
      unitPriceUSD: number;
      customNote?: string;
    }) => void
  ) => void;
  // UI states
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isOrdersModalOpen: boolean;
  setIsOrdersModalOpen: (open: boolean) => void;
  selectedInvoiceForModal: Invoice | null;
  setSelectedInvoiceForModal: (invoice: Invoice | null) => void;
  lastSuccessfulOrder: Order | null;
  setLastSuccessfulOrder: (order: Order | null) => void;
  // Automated Credit and Past-Due Invoice Reminders
  automatedReminders: AutomatedReminderRecord[];
  runManualReminderScan: () => AutomatedReminderRecord[];
  // Real-Time Stock Synchronization
  lastStockUpdateEvent: {
    productIds: string[];
    timestamp: number;
    source: 'order' | 'adjustment' | 'pos';
    summary?: string;
  } | null;
  broadcastStockUpdate: (
    updatedProducts: Product[],
    meta?: { productIds: string[]; source: 'order' | 'adjustment' | 'pos'; summary?: string }
  ) => void;
  // Turso Database Cloud State
  tursoState: TursoSyncState;
  bootstrapTursoSchema: () => Promise<{ success: boolean; tables: string[]; error?: string }>;
  syncWithTurso: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'store' | 'erp'>(() => {
    return (localStorage.getItem('omni_mode') as 'store' | 'erp') || 'store';
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('omni_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.bcvSourceUrl = 'https://bcv.today/api/rate.json';
        if (!parsed.bcvHistory || !Array.isArray(parsed.bcvHistory) || parsed.bcvHistory.length === 0) {
          const savedHist = localStorage.getItem('omni_bcv_history');
          parsed.bcvHistory = savedHist ? JSON.parse(savedHist) : INITIAL_SETTINGS.bcvHistory;
        }
        if (parsed.bcvRate && parsed.bcvRate < 100) {
          parsed.bcvRate = INITIAL_SETTINGS.bcvRate;
          parsed.bcvEffectiveDate = INITIAL_SETTINGS.bcvEffectiveDate;
        }
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          companyName: parsed.companyName || INITIAL_SETTINGS.companyName,
          companyRif: parsed.companyRif || INITIAL_SETTINGS.companyRif,
          companyPhone: parsed.companyPhone || INITIAL_SETTINGS.companyPhone,
          companyEmail: parsed.companyEmail || INITIAL_SETTINGS.companyEmail,
          companyAddress: parsed.companyAddress || INITIAL_SETTINGS.companyAddress,
          companyLogo: parsed.companyLogo || INITIAL_SETTINGS.companyLogo || '/logo.png',
          defaultCreditDays: parsed.defaultCreditDays || 7,
          defaultCreditLimitUSD: parsed.defaultCreditLimitUSD || 1000,
        };
      } catch (e) {
        console.error('Error reading omni_settings:', e);
      }
    }
    return INITIAL_SETTINGS;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('omni_users');
    if (saved) {
      try {
        const parsed: User[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Rule: Siempre debe existir al menos un administrador activo en el sistema.
          // Si no hay ninguno, se restaura automáticamente el Administrador Genérico Inicial.
          const hasAdmin = parsed.some((u) => u.role === 'admin' && u.active);
          if (!hasAdmin) {
            return [INITIAL_GENERIC_ADMIN, ...parsed];
          }
          return parsed;
        }
      } catch (e) {
        console.error('Error al cargar omni_users:', e);
      }
    }
    return INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUsers = localStorage.getItem('omni_users');
    if (savedUsers) {
      try {
        const list: User[] = JSON.parse(savedUsers);
        const admin = list.find((u) => u.role === 'admin' && u.active);
        if (admin) return admin;
      } catch (e) {}
    }
    return INITIAL_GENERIC_ADMIN;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('omni_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(() => {
    const activeId = localStorage.getItem('omni_active_customer_id');
    if (activeId) {
      const saved = localStorage.getItem('omni_customers');
      const list: Customer[] = saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
      const found = list.find((c) => c.id === activeId);
      if (found) return found;
    }
    return null;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('omni_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('omni_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('omni_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('omni_invoices');
    return saved ? JSON.parse(saved) : INITIAL_INVOICES;
  });

  const [receivables, setReceivables] = useState<ReceivableItem[]>(() => {
    const saved = localStorage.getItem('omni_receivables');
    return saved ? JSON.parse(saved) : INITIAL_RECEIVABLES;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('omni_suppliers');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  const [payables, setPayables] = useState<PayableItem[]>(() => {
    const saved = localStorage.getItem('omni_payables');
    return saved ? JSON.parse(saved) : INITIAL_PAYABLES;
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('omni_notifications');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'notif-1',
            title: 'Bienvenido al Sistema OmniPOS',
            message: 'Tasa BCV configurada a 68.45 Bs/USD. Tienda online y ERP sincronizados.',
            type: 'custom_broadcast',
            createdAt: new Date().toISOString(),
            read: false,
          },
        ];
  });

  // UI Modals & Navigation
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [lastSuccessfulOrder, setLastSuccessfulOrder] = useState<Order | null>(null);
  const [storeTab, setStoreTab] = useState<'catalog' | 'offers'>('catalog');
  const [customerPortalTab, setCustomerPortalTab] = useState<CustomerPortalTab>('catalogo');
  const [isAdminActive, setIsAdminActive] = useState<boolean>(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>('login');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isSellerAlertsModalOpen, setIsSellerAlertsModalOpen] = useState(false);
  const [isBusinessSettingsModalOpen, setIsBusinessSettingsModalOpen] = useState(false);
  const [isBcvPanelOpen, setIsBcvPanelOpen] = useState(false);
  const [isCategoryUnitModalOpen, setIsCategoryUnitModalOpen] = useState(false);
  const [presentationModalProduct, setPresentationModalProduct] = useState<Product | null>(null);
  const [presentationCallback, setPresentationCallback] = useState<((result: any) => void) | null>(null);

  const openPresentationModal = (
    product: Product,
    callback?: (result: any) => void
  ) => {
    setPresentationModalProduct(product);
    setPresentationCallback(callback ? () => callback : null);
  };

  // Dynamic Categories and Units of Measurement
  const [categories, setCategories] = useState<ProductCategory[]>(() => {
    const saved = localStorage.getItem('omni_categories');
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  // Automated Credit and Past-Due Invoice Reminders State
  const [automatedReminders, setAutomatedReminders] = useState<AutomatedReminderRecord[]>(() => {
    const saved = localStorage.getItem('omni_automated_reminders');
    return saved ? JSON.parse(saved) : [];
  });

  const [units, setUnits] = useState<ProductUnit[]>(() => {
    const saved = localStorage.getItem('omni_units');
    return saved ? JSON.parse(saved) : INITIAL_UNITS;
  });

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('omni_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('omni_units', JSON.stringify(units));
  }, [units]);

  useEffect(() => {
    localStorage.setItem('omni_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('omni_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('omni_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('omni_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('omni_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('omni_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('omni_receivables', JSON.stringify(receivables));
  }, [receivables]);

  useEffect(() => {
    localStorage.setItem('omni_payables', JSON.stringify(payables));
  }, [payables]);

  useEffect(() => {
    localStorage.setItem('omni_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  // --- Real-time multi-client / cross-tab stock synchronization ---
  const [lastStockUpdateEvent, setLastStockUpdateEvent] = useState<{
    productIds: string[];
    timestamp: number;
    source: 'order' | 'adjustment' | 'pos';
    summary?: string;
  } | null>(null);

  const broadcastStockUpdate = (
    updatedProducts: Product[],
    meta?: { productIds: string[]; source: 'order' | 'adjustment' | 'pos'; summary?: string }
  ) => {
    try {
      localStorage.setItem('omni_products', JSON.stringify(updatedProducts));
      const pulse = {
        productIds: meta?.productIds || [],
        source: meta?.source || 'order',
        summary: meta?.summary || 'Stock actualizado en tiempo real',
        timestamp: Date.now(),
      };
      localStorage.setItem('omni_stock_pulse', JSON.stringify(pulse));

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('omni_stock_sync_channel');
        channel.postMessage({
          type: 'REALTIME_STOCK_UPDATE',
          products: updatedProducts,
          affectedProductIds: meta?.productIds || [],
          source: meta?.source || 'order',
          summary: meta?.summary,
          timestamp: Date.now(),
        });
        channel.close();
      }
    } catch (e) {
      console.warn('Error broadcasting real-time stock update:', e);
    }
  };

  useEffect(() => {
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel('omni_stock_sync_channel');
        broadcastChannel.onmessage = (event) => {
          const data = event.data;
          if (data && data.type === 'REALTIME_STOCK_UPDATE' && Array.isArray(data.products)) {
            setProducts(data.products);
            setLastStockUpdateEvent({
              productIds: data.affectedProductIds || [],
              timestamp: data.timestamp || Date.now(),
              source: data.source || 'order',
              summary: data.summary,
            });
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel initialization error:', e);
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'omni_products' && e.newValue) {
        try {
          const parsedProducts: Product[] = JSON.parse(e.newValue);
          if (Array.isArray(parsedProducts)) {
            setProducts(parsedProducts);
          }
        } catch (err) {
          console.error('Error parsing synced products from storage:', err);
        }
      }
      if (e.key === 'omni_stock_pulse' && e.newValue) {
        try {
          const pulse = JSON.parse(e.newValue);
          setLastStockUpdateEvent({
            productIds: pulse.productIds || [],
            timestamp: pulse.timestamp || Date.now(),
            source: pulse.source || 'order',
            summary: pulse.summary,
          });
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // --- Turso Cloud DB State & Sync Engine ---
  const [tursoState, setTursoState] = useState<TursoSyncState>({
    isConnected: false,
    isSyncing: false,
    statusText: 'Iniciando...',
    lastSyncTime: null,
    errorMessage: null,
    tablesCreated: [],
    totalRecordsInCloud: 0,
  });

  const bootstrapTursoSchema = async () => {
    setTursoState((prev) => ({
      ...prev,
      isSyncing: true,
      statusText: 'Creando y verificando tablas automáticas...',
    }));
    try {
      const res = await tursoService.autoBootstrapSchema();
      if (res.success) {
        await tursoService.autoSeedIfEmpty();
        setTursoState((prev) => ({
          ...prev,
          isConnected: true,
          isSyncing: false,
          statusText: 'Tablas creadas y sincronizadas',
          lastSyncTime: new Date().toISOString(),
          tablesCreated: res.tables,
          errorMessage: null,
        }));
      } else {
        setTursoState((prev) => ({
          ...prev,
          isConnected: false,
          isSyncing: false,
          statusText: 'Error en creación de tablas',
          errorMessage: res.error || 'Error desconocido',
        }));
      }
      return res;
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      setTursoState((prev) => ({
        ...prev,
        isConnected: false,
        isSyncing: false,
        statusText: 'Error de conexión',
        errorMessage: errorMsg,
      }));
      return { success: false, tables: [], error: errorMsg };
    }
  };

  const syncWithTurso = async () => {
    if (!tursoService.isConfigured()) return;
    setTursoState((prev) => ({ ...prev, isSyncing: true, statusText: 'Sincronizando con Turso Cloud...' }));
    try {
      const cloudData = await tursoService.loadAllData();
      if (cloudData.products.length > 0) setProducts(cloudData.products);
      if (cloudData.categories.length > 0) setCategories(cloudData.categories);
      if (cloudData.units.length > 0) setUnits(cloudData.units);
      if (cloudData.customers.length > 0) setCustomers(cloudData.customers);
      if (cloudData.suppliers.length > 0) setSuppliers(cloudData.suppliers);
      if (cloudData.orders.length > 0) setOrders(cloudData.orders);
      if (cloudData.invoices.length > 0) setInvoices(cloudData.invoices);
      if (cloudData.receivables.length > 0) setReceivables(cloudData.receivables);
      if (cloudData.payables.length > 0) setPayables(cloudData.payables);
      if (cloudData.users.length > 0) setUsers(cloudData.users);
      if (cloudData.settings) setSettings(cloudData.settings);

      setTursoState({
        isConnected: true,
        isSyncing: false,
        statusText: 'Sincronizado con Turso DB',
        lastSyncTime: new Date().toISOString(),
        errorMessage: null,
        tablesCreated: [
          'products', 'categories', 'units', 'customers', 'suppliers',
          'orders', 'invoices', 'accounts_receivable', 'accounts_payable',
          'system_users', 'system_settings', 'bcv_history'
        ],
        totalRecordsInCloud: (cloudData.products.length || 0) + (cloudData.orders.length || 0),
      });
    } catch (err: any) {
      console.error('Error syncing with Turso:', err);
      setTursoState((prev) => ({
        ...prev,
        isSyncing: false,
        errorMessage: err.message || 'Fallo de sincronización',
      }));
    }
  };

  // Initial Turso Auto-Init on component mount
  useEffect(() => {
    const initTursoOnMount = async () => {
      if (tursoService.isConfigured()) {
        await bootstrapTursoSchema();
        await syncWithTurso();
      } else {
        setTursoState({
          isConnected: false,
          isSyncing: false,
          statusText: 'Modo Local (Sin configurar)',
          lastSyncTime: null,
          errorMessage: null,
          tablesCreated: [],
          totalRecordsInCloud: 0,
        });
      }
    };
    initTursoOnMount();
  }, []);

  // Active push notification toasts floating on screen
  const [activePushToasts, setActivePushToasts] = useState<AppNotification[]>([]);

  const dismissPushToast = (id: string) => {
    setActivePushToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const triggerPushNotification = (options: {
    title: string;
    message: string;
    type?: AppNotification['type'];
    relatedOrderId?: string;
    targetCustomerId?: string;
    targetRole?: 'client' | 'seller' | 'all';
    priority?: 'normal' | 'high' | 'urgent';
    actionUrl?: string;
    badge?: string;
    sound?: boolean;
  }) => {
    // Suppress push notifications and sound alerts for BCV rate updates
    if (options.type === 'bcv_update') {
      return;
    }

    const type = options.type || 'promotion';
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: options.title,
      message: options.message,
      type,
      createdAt: new Date().toISOString(),
      read: false,
      relatedOrderId: options.relatedOrderId,
      targetCustomerId: options.targetCustomerId,
      targetRole: options.targetRole,
      priority: options.priority,
      actionUrl: options.actionUrl,
      badge: options.badge,
    };

    setNotifications((prev) => [newNotif, ...prev]);

    // Check sound preference
    const soundAllowed =
      options.sound !== false && (currentCustomer?.notificationPreferences?.soundEnabled ?? true);
    if (soundAllowed) {
      if (type === 'order_status') {
        playNotificationSound('order_status');
      } else if (type === 'promotion') {
        playNotificationSound('promotion');
      } else if (type === 'inventory_alert' || type === 'credit_alert') {
        playNotificationSound('alert');
      } else {
        playNotificationSound('promotion');
      }
    }

    // Add to visible toasts (max 3 visible simultaneously)
    setActivePushToasts((prev) => [newNotif, ...prev.slice(0, 2)]);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      dismissPushToast(newNotif.id);
    }, 6000);
  };

  const broadcastPushNotification = (options: {
    title: string;
    message: string;
    type: AppNotification['type'];
    targetRole?: 'client' | 'seller' | 'all';
    targetCustomerId?: string;
    badge?: string;
  }) => {
    triggerPushNotification({
      title: options.title,
      message: options.message,
      type: options.type,
      badge: options.badge,
    });
  };

  const pushNotification = (
    title: string,
    message: string,
    type: AppNotification['type'],
    relatedOrderId?: string
  ) => {
    triggerPushNotification({ title, message, type, relatedOrderId });
  };

  // Customer Auth & Preferences logic
  const loginCustomer = (identifier: string, password?: string): boolean => {
    const trimmed = identifier.trim().toLowerCase();
    const found = customers.find(
      (c) =>
        c.rif.toLowerCase() === trimmed ||
        c.email.toLowerCase() === trimmed ||
        c.phone.replace(/\D/g, '') === trimmed.replace(/\D/g, '') ||
        c.name.toLowerCase().includes(trimmed)
    );

    if (found) {
      if (password && found.password && found.password !== password) {
        alert('Contraseña incorrecta.');
        return false;
      }
      setCurrentCustomer(found);
      localStorage.setItem('omni_active_customer_id', found.id);
      setIsAdminActive(false);
      triggerPushNotification({
        title: `¡Bienvenido de nuevo, ${found.name}!`,
        message: 'Has iniciado sesión exitosamente. Tus notificaciones y crédito comercial están activos.',
        type: 'promotion',
        badge: 'Sesión Iniciada',
      });
      return true;
    }
    return false;
  };

  const registerCustomer = (customerData: Omit<Customer, 'id'>): Customer => {
    const newCustomer: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
      notificationPreferences: customerData.notificationPreferences || {
        orderStatus: true,
        promotions: true,
        creditAlerts: true,
        soundEnabled: true,
        channel: 'push',
      },
    };
    setCustomers((prev) => [...prev, newCustomer]);
    setCurrentCustomer(newCustomer);
    localStorage.setItem('omni_active_customer_id', newCustomer.id);
    setIsAdminActive(false);
    triggerPushNotification({
      title: `¡Bienvenido a nuestro Portal!`,
      message: `Hola ${newCustomer.name}, tu cuenta ha sido creada exitosamente. Notificaciones activadas.`,
      type: 'promotion',
      badge: 'Nuevo Cliente',
    });
    return newCustomer;
  };

  const logoutCustomer = () => {
    setCurrentCustomer(null);
    localStorage.removeItem('omni_active_customer_id');
    triggerPushNotification({
      title: 'Sesión Finalizada',
      message: 'Has salido de tu cuenta de cliente de forma segura.',
      type: 'promotion',
    });
  };

  const updateCustomerPreferences = (preferences: CustomerNotificationPreferences) => {
    if (!currentCustomer) return;
    const updated = { ...currentCustomer, notificationPreferences: preferences };
    setCurrentCustomer(updated);
    setCustomers((prev) => prev.map((c) => (c.id === currentCustomer.id ? updated : c)));
  };

  // Dynamic Category & Unit Management
  const addCategory = (catData: Omit<ProductCategory, 'id'>) => {
    const newCat: ProductCategory = {
      ...catData,
      id: `cat-${Date.now()}`,
    };
    setCategories((prev) => [...prev, newCat]);
    pushNotification('Categoría Creada', `Categoría "${newCat.name}" agregada exitosamente.`, 'promotion');
  };

  const deleteCategory = (categoryId: string): { success: boolean; message: string } => {
    const target = categories.find((c) => c.id === categoryId);
    if (!target) return { success: false, message: 'Categoría no encontrada.' };

    const associatedCount = products.filter(
      (p) => p.category.toLowerCase().trim() === target.name.toLowerCase().trim()
    ).length;

    if (associatedCount > 0) {
      return {
        success: false,
        message: `No se puede eliminar la categoría "${target.name}" porque tiene ${associatedCount} producto(s) asignados en inventario. Reasigne o elimine esos productos primero.`,
      };
    }

    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    pushNotification('Categoría Eliminada', `Categoría "${target.name}" eliminada del sistema.`, 'inventory_alert');
    return { success: true, message: `Categoría "${target.name}" eliminada correctamente.` };
  };

  const updateCategory = (cat: ProductCategory) => {
    const old = categories.find((c) => c.id === cat.id);
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)));
    if (old && old.name !== cat.name) {
      setProducts((prev) =>
        prev.map((p) =>
          p.category.toLowerCase().trim() === old.name.toLowerCase().trim()
            ? { ...p, category: cat.name }
            : p
        )
      );
    }
  };

  const addUnit = (unitData: Omit<ProductUnit, 'id'>) => {
    const newUnit: ProductUnit = {
      ...unitData,
      id: `unit-${Date.now()}`,
    };
    setUnits((prev) => [...prev, newUnit]);
    pushNotification('Unidad Creada', `Unidad de medida "${newUnit.name} (${newUnit.abbreviation})" registrada.`, 'promotion');
  };

  const deleteUnit = (unitId: string): { success: boolean; message: string } => {
    const target = units.find((u) => u.id === unitId);
    if (!target) return { success: false, message: 'Unidad no encontrada.' };

    const associatedCount = products.filter(
      (p) =>
        p.unit.toLowerCase().trim() === target.name.toLowerCase().trim() ||
        p.unit.toLowerCase().trim() === target.abbreviation.toLowerCase().trim()
    ).length;

    if (associatedCount > 0) {
      return {
        success: false,
        message: `No se puede eliminar la unidad "${target.name}" porque tiene ${associatedCount} producto(s) asignados en inventario.`,
      };
    }

    setUnits((prev) => prev.filter((u) => u.id !== unitId));
    pushNotification('Unidad Eliminada', `Unidad "${target.name}" eliminada del sistema.`, 'inventory_alert');
    return { success: true, message: `Unidad "${target.name}" eliminada correctamente.` };
  };

  const updateUnit = (unit: ProductUnit) => {
    setUnits((prev) => prev.map((u) => (u.id === unit.id ? unit : u)));
  };

  // Cart operations
  const addToCart = (product: Product, quantity = 1) => {
    if (product.stock <= 0) {
      alert(`El producto "${product.name}" está agotado en inventario.`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && (!item.saleMode || item.saleMode === 'standard')
      );
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const nextQty = existing.quantity + quantity;
        if (nextQty > product.stock) {
          alert(`Stock insuficiente. Solo quedan ${product.stock} unidades de "${product.name}".`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...existing, quantity: nextQty };
        return updated;
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product,
          quantity: Math.min(quantity, product.stock),
          saleMode: 'standard',
        },
      ];
    });
  };

  const addToCartWithPresentation = (
    product: Product,
    options: {
      presentation?: ProductPresentation;
      quantity?: number;
      saleMode?: 'standard' | 'presentation' | 'weight' | 'custom_amount';
      weightKg?: number;
      customAmountBs?: number;
      customAmountUSD?: number;
      unitPriceUSD?: number;
      customNote?: string;
    }
  ) => {
    const saleMode = options.saleMode || (options.presentation ? 'presentation' : 'standard');
    const quantity = options.quantity !== undefined ? options.quantity : 1;

    if (product.stock <= 0) {
      alert(`El producto "${product.name}" no tiene existencias disponibles.`);
      return;
    }

    // Required stock validation
    let requiredStockUnits = quantity;
    if (saleMode === 'presentation' && options.presentation) {
      requiredStockUnits = quantity * options.presentation.factor;
    } else if (saleMode === 'weight' && options.weightKg) {
      requiredStockUnits = options.weightKg;
    } else if (saleMode === 'custom_amount') {
      requiredStockUnits = quantity;
    }

    if (requiredStockUnits > product.stock) {
      alert(`Stock insuficiente. Solo quedan ${product.stock} ${product.unit} de "${product.name}".`);
      return;
    }

    let effectivePriceUSD = options.unitPriceUSD;
    if (effectivePriceUSD === undefined) {
      if (saleMode === 'presentation' && options.presentation) {
        effectivePriceUSD = options.presentation.priceUSD;
      } else if (saleMode === 'weight' && options.weightKg) {
        const kgRate = product.pricePerKgUSD || product.priceUSD;
        effectivePriceUSD = Number((kgRate * options.weightKg).toFixed(2));
      } else if (saleMode === 'custom_amount' && options.customAmountUSD) {
        effectivePriceUSD = options.customAmountUSD;
      } else {
        effectivePriceUSD =
          product.isOffer && product.discountPercentage
            ? product.priceUSD * (1 - product.discountPercentage / 100)
            : product.priceUSD;
      }
    }

    const cartItemId = `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newItem: CartItem = {
      id: cartItemId,
      product,
      quantity: saleMode === 'weight' || saleMode === 'custom_amount' ? 1 : quantity,
      selectedPresentation: options.presentation,
      saleMode,
      weightKg: options.weightKg,
      customAmountBs: options.customAmountBs,
      customAmountUSD: options.customAmountUSD,
      unitPriceUSD: effectivePriceUSD,
      customNote: options.customNote,
    };

    setCart((prev) => [...prev, newItem]);

    const title =
      saleMode === 'presentation'
        ? `${product.name} (${options.presentation?.name})`
        : saleMode === 'weight'
        ? `${product.name} (${options.weightKg} Kg)`
        : saleMode === 'custom_amount'
        ? `${product.name} (${options.customAmountBs?.toFixed(2)} Bs)`
        : product.name;

    pushNotification(
      'Agregado al Carrito',
      `"${title}" agregado al carrito de compras.`,
      'order_status'
    );
  };

  const updateCartQuantity = (cartItemIdOrProdId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemIdOrProdId);
      return;
    }

    setCart((prev) => {
      const item = prev.find((i) => i.id === cartItemIdOrProdId || i.product.id === cartItemIdOrProdId);
      if (item && item.saleMode === 'presentation' && item.selectedPresentation) {
        const requiredUnits = quantity * item.selectedPresentation.factor;
        if (requiredUnits > item.product.stock) {
          alert(`Stock insuficiente para ${quantity} empaques (${requiredUnits} unidades). Máximo disponible: ${item.product.stock} unidades.`);
          return prev;
        }
      } else if (item && quantity > item.product.stock) {
        alert(`Stock máximo disponible: ${item.product.stock} ${item.product.unit}.`);
        return prev;
      }

      return prev.map((i) =>
        i.id === cartItemIdOrProdId || i.product.id === cartItemIdOrProdId ? { ...i, quantity } : i
      );
    });
  };

  const removeFromCart = (cartItemIdOrProdId: string) => {
    setCart((prev) =>
      prev.filter((item) => item.id !== cartItemIdOrProdId && item.product.id !== cartItemIdOrProdId)
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  // Create Order and Invoice
  const createOrder = (orderInput: {
    customerId: string;
    customerName: string;
    customerRif: string;
    customerPhone: string;
    customerAddress: string;
    items: {
      product: Product;
      quantity: number;
      selectedPresentation?: ProductPresentation;
      saleMode?: 'standard' | 'presentation' | 'weight' | 'custom_amount';
      weightKg?: number;
      customAmountBs?: number;
      customAmountUSD?: number;
      unitPriceUSD?: number;
      customNote?: string;
    }[];
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    channel: 'online' | 'pos';
    notes?: string;
    customCreditDays?: number;
  }) => {
    const orderNum = `PED-${new Date().getFullYear()}-${String(orders.length + 104).padStart(4, '0')}`;
    const invoiceNum = `FACT-${String(invoices.length + 453).padStart(6, '0')}`;
    const now = new Date();

    const orderItems = orderInput.items.map((item) => {
      let unitPriceUSD: number;
      let subtotalUSD: number;

      if (item.unitPriceUSD !== undefined) {
        unitPriceUSD = item.unitPriceUSD;
        subtotalUSD = unitPriceUSD * item.quantity;
      } else if (item.saleMode === 'presentation' && item.selectedPresentation) {
        unitPriceUSD = item.selectedPresentation.priceUSD;
        subtotalUSD = unitPriceUSD * item.quantity;
      } else if (item.saleMode === 'weight' && item.weightKg) {
        const kgRate = item.product.pricePerKgUSD || item.product.priceUSD;
        unitPriceUSD = Number((kgRate * item.weightKg).toFixed(2));
        subtotalUSD = unitPriceUSD * item.quantity;
      } else if (item.saleMode === 'custom_amount' && item.customAmountUSD) {
        unitPriceUSD = item.customAmountUSD;
        subtotalUSD = unitPriceUSD * item.quantity;
      } else {
        const effectivePrice =
          item.product.isOffer && item.product.discountPercentage
            ? item.product.priceUSD * (1 - item.product.discountPercentage / 100)
            : item.product.priceUSD;
        unitPriceUSD = effectivePrice;
        subtotalUSD = effectivePrice * item.quantity;
      }

      return {
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPriceUSD: Number(unitPriceUSD.toFixed(2)),
        subtotalUSD: Number(subtotalUSD.toFixed(2)),
        presentationName: item.selectedPresentation?.name,
        saleMode: item.saleMode,
        weightKg: item.weightKg,
        customAmountBs: item.customAmountBs,
      };
    });

    const subtotalUSD = orderItems.reduce((acc, curr) => acc + curr.subtotalUSD, 0);
    const taxUSD = subtotalUSD * (settings.ivaPercentage / 100);
    const totalUSD = subtotalUSD + taxUSD;
    const totalBs = totalUSD * settings.bcvRate;

    const isCredit = orderInput.paymentMethod === 'credito';
    const customer = customers.find((c) => c.id === orderInput.customerId);
    const creditDays = orderInput.customCreditDays || customer?.creditDays || settings.defaultCreditDays;
    const dueDate = isCredit
      ? new Date(now.getTime() + creditDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: orderNum,
      customerId: orderInput.customerId,
      customerName: orderInput.customerName,
      customerRif: orderInput.customerRif,
      customerPhone: orderInput.customerPhone,
      customerAddress: orderInput.customerAddress,
      items: orderItems,
      subtotalUSD,
      taxUSD,
      totalUSD,
      totalBs,
      bcvRate: settings.bcvRate,
      paymentMethod: orderInput.paymentMethod,
      paymentStatus: isCredit
        ? 'a_credito'
        : ['efectivo_usd', 'efectivo_bs', 'biopago'].includes(orderInput.paymentMethod) && orderInput.channel === 'pos'
        ? 'pagado'
        : 'pendiente',
      orderStatus: 'en_tramite',
      paymentReference: orderInput.paymentReference,
      channel: orderInput.channel,
      createdAt: now.toISOString(),
      creditDays: isCredit ? creditDays : undefined,
      creditDueDate: dueDate,
      estimatedDelivery: 'Tiempo estimado: 2 a 4 horas hábiles',
      notes: orderInput.notes,
    };

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invoiceNum,
      orderId: newOrder.id,
      customerId: orderInput.customerId,
      customerName: orderInput.customerName,
      customerRif: orderInput.customerRif,
      customerAddress: orderInput.customerAddress,
      customerPhone: orderInput.customerPhone,
      items: orderItems,
      subtotalUSD,
      taxUSD,
      totalUSD,
      totalBs,
      bcvRate: settings.bcvRate,
      paymentMethod: orderInput.paymentMethod,
      paymentStatus: newOrder.paymentStatus,
      createdAt: now.toISOString(),
      dueDate,
      isCredit,
      creditDays: isCredit ? creditDays : undefined,
    };

    // Deduct stock in real-time accurately by presentation factor / weight / fractional
    const boughtProductIds: string[] = [];
    const updatedProducts = products.map((p) => {
      const boughtItems = orderInput.items.filter((item) => item.product.id === p.id);
      if (boughtItems.length > 0) {
        boughtProductIds.push(p.id);
        let totalStockDeduction = 0;
        for (const bought of boughtItems) {
          if (bought.selectedPresentation) {
            totalStockDeduction += bought.quantity * bought.selectedPresentation.factor;
          } else if (bought.saleMode === 'weight' && bought.weightKg) {
            totalStockDeduction += bought.weightKg;
          } else {
            totalStockDeduction += bought.quantity;
          }
        }
        const remaining = Math.max(0, Number((p.stock - totalStockDeduction).toFixed(3)));
        if (remaining <= p.minStock) {
          pushNotification(
            'Alerta de Inventario',
            `El producto ${p.name} ha alcanzado su nivel crítico (${remaining} ${p.unit}).`,
            'inventory_alert'
          );
        }
        return { ...p, stock: remaining };
      }
      return p;
    });

    setProducts(updatedProducts);
    broadcastStockUpdate(updatedProducts, {
      productIds: boughtProductIds,
      source: orderInput.channel === 'pos' ? 'pos' : 'order',
      summary: `Pedido ${newOrder.orderNumber}: Stock sincronizado en tiempo real`,
    });

    // If credit, add to Cuentas por Cobrar (CxC) and increase customer debt
    if (isCredit && dueDate) {
      const newRec: ReceivableItem = {
        id: `rec-${Date.now()}`,
        invoiceId: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        customerId: orderInput.customerId,
        customerName: orderInput.customerName,
        customerPhone: orderInput.customerPhone,
        totalAmountUSD: totalUSD,
        amountPaidUSD: 0,
        balanceUSD: totalUSD,
        issuedDate: now.toISOString().split('T')[0],
        dueDate,
        creditDays,
        status: 'al_dia',
      };
      setReceivables((prev) => [newRec, ...prev]);

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === orderInput.customerId
            ? { ...c, currentDebtUSD: c.currentDebtUSD + totalUSD }
            : c
        )
      );
    }

    setOrders((prev) => [newOrder, ...prev]);
    setInvoices((prev) => [newInvoice, ...prev]);
    clearCart();

    pushNotification(
      'Nuevo Pedido Registrado',
      `El pedido ${newOrder.orderNumber} por $${totalUSD.toFixed(2)} (${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs) está en estado Pendiente.`,
      'order_status',
      newOrder.id
    );

    return { order: newOrder, invoice: newInvoice };
  };

  // Reorder functionality (one click reorder)
  const reorder = (orderId: string): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return false;

    let itemsAdded = 0;
    const newCartItems: CartItem[] = [];

    for (const item of order.items) {
      const liveProduct = products.find((p) => p.id === item.productId);
      if (liveProduct && liveProduct.stock > 0) {
        const qtyToLoad = Math.min(item.quantity, liveProduct.stock);
        newCartItems.push({
          product: liveProduct,
          quantity: qtyToLoad,
        });
        itemsAdded++;
      }
    }

    if (newCartItems.length === 0) {
      alert('Lo sentimos, los productos de este pedido previo se encuentran actualmente agotados.');
      return false;
    }

    setCart(newCartItems);
    setIsCartOpen(true);
    setIsOrdersModalOpen(false);
    pushNotification(
      'Pedido Reordenado',
      `Se cargaron ${itemsAdded} productos de la compra ${order.orderNumber} a tu carrito.`,
      'order_status'
    );
    return true;
  };

  // Update order status with real-time customer push notification
  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    const statusTitles: Record<OrderStatus, string> = {
      en_tramite: '⏳ Pedido En Trámite',
      despachado_facturado: '🚚 Pedido Despachado / Facturado',
    };

    const statusMessages: Record<OrderStatus, string> = {
      en_tramite: 'Tu pedido está siendo procesado por nuestro equipo de almacén.',
      despachado_facturado: '¡Tu pedido fue despachado y la factura fiscal ha sido emitida!',
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updated = { ...o, orderStatus: status };
          triggerPushNotification({
            title: `${statusTitles[status]} (${o.orderNumber})`,
            message: statusMessages[status],
            type: 'order_status',
            relatedOrderId: o.id,
            badge: status === 'despachado_facturado' ? 'Despachado' : 'En trámite',
          });
          return updated;
        }
        return o;
      })
    );
  };

  const updatePaymentStatus = (orderId: string, paymentStatus: PaymentStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, paymentStatus } : o))
    );
    setInvoices((prev) =>
      prev.map((inv) => (inv.orderId === orderId ? { ...inv, paymentStatus } : inv))
    );
  };

  // BCV Rate management with history tracking
  const updateBcvRate = (
    newRate: number,
    updatedBy = 'Administrador',
    type: 'manual' | 'automatic' = 'manual',
    extra?: {
      effectiveDate?: string;
      source?: string;
      currencies?: {
        EUR?: number;
        CNY?: number;
        TRY?: number;
        RUB?: number;
      };
    }
  ) => {
    if (newRate <= 0) return;
    const cleanRate = Number(newRate.toFixed(2));
    const previousRate = settings.bcvRate;
    const changePercent =
      previousRate > 0 ? Number((((cleanRate - previousRate) / previousRate) * 100).toFixed(2)) : 0;

    const historyEntry: BcvHistoryEntry = {
      id: `bcv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      rate: cleanRate,
      date: new Date().toISOString(),
      effectiveDate: extra?.effectiveDate || new Date().toISOString().split('T')[0],
      type,
      updatedBy,
      source: extra?.source || (type === 'automatic' ? 'https://bcv.today/api/rate.json' : 'manual'),
      previousRate,
      changePercent,
      currencies: extra?.currencies,
    };

    setSettings((prev) => {
      const existingHistory = prev.bcvHistory || [];
      // Evitar duplicados inmediatos si es la misma tasa registrada en el mismo minuto
      const isDuplicate =
        existingHistory.length > 0 &&
        existingHistory[0].rate === cleanRate &&
        Math.abs(new Date(existingHistory[0].date).getTime() - new Date(historyEntry.date).getTime()) < 60000;

      const updatedHistory = isDuplicate
        ? existingHistory
        : [historyEntry, ...existingHistory].slice(0, 1000); // Conservar hasta 1000 registros históricos

      const updatedSettings: SystemSettings = {
        ...prev,
        bcvRate: cleanRate,
        lastBcvUpdate: new Date().toISOString(),
        bcvSourceUrl: 'https://bcv.today/api/rate.json',
        bcvEffectiveDate: extra?.effectiveDate || prev.bcvEffectiveDate || new Date().toISOString().split('T')[0],
        bcvHistory: updatedHistory,
      };

      try {
        localStorage.setItem('omni_bcv_history', JSON.stringify(updatedHistory));
        localStorage.setItem('omni_settings', JSON.stringify(updatedSettings));
      } catch (e) {
        console.warn('Error saving omni_bcv_history:', e);
      }

      // Persistir en Turso Cloud si está conectado
      if (tursoState.isConnected) {
        tursoService.saveBcvHistoryEntry(historyEntry).catch(console.warn);
        tursoService.saveSettings(updatedSettings).catch(console.warn);
      }

      return updatedSettings;
    });
  };

  /**
   * Sincroniza la tasa oficial en tiempo real desde: https://bcv.today/api/rate.json
   */
  const fetchAutomaticBcvRate = async (): Promise<number> => {
    try {
      const result = await fetchBcvRateFromApi();
      const newRate = Number(result.rate.toFixed(2));
      updateBcvRate(
        newRate,
        'API Oficial BCV (bcv.today)',
        'automatic',
        {
          effectiveDate: result.effectiveDate,
          source: result.sourceUrl,
          currencies: result.currencies,
        }
      );
      return newRate;
    } catch (err) {
      console.warn('Error al consultar bcv.today:', err);
      return settings.bcvRate;
    }
  };

  /**
   * Sincroniza y pobla el historial oficial desde bcv.today
   */
  const syncBcvOfficialHistory = async (daysLimit: number = 60): Promise<number> => {
    try {
      const historyList = await fetchBcvOfficialHistory(daysLimit);
      if (historyList.length === 0) return 0;

      setSettings((prev) => {
        const existing = prev.bcvHistory || [];
        const existingDates = new Set(
          existing.map((h) => h.effectiveDate || h.date.split('T')[0])
        );

        const newEntries = historyList.filter(
          (h) => !existingDates.has(h.effectiveDate || h.date.split('T')[0])
        );

        const merged = [...existing, ...newEntries]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 1000);

        const updatedSettings: SystemSettings = {
          ...prev,
          bcvHistory: merged,
        };

        try {
          localStorage.setItem('omni_bcv_history', JSON.stringify(merged));
          localStorage.setItem('omni_settings', JSON.stringify(updatedSettings));
        } catch (e) {
          console.warn('Error saving bcv history:', e);
        }

        if (tursoState.isConnected) {
          for (const item of newEntries) {
            tursoService.saveBcvHistoryEntry(item).catch(console.warn);
          }
          tursoService.saveSettings(updatedSettings).catch(console.warn);
        }

        return updatedSettings;
      });

      return historyList.length;
    } catch (err) {
      console.warn('Error syncing official BCV history:', err);
      return 0;
    }
  };

  // Inicialización silenciosa al cargar la app: consultar bcv.today y asegurar histórico
  useEffect(() => {
    let active = true;

    const initializeBcvData = async () => {
      try {
        await fetchAutomaticBcvRate();
      } catch (e) {
        console.warn('Initial BCV rate sync attempt:', e);
      }

      if (active && (!settings.bcvHistory || settings.bcvHistory.length < 5)) {
        try {
          await syncBcvOfficialHistory(60);
        } catch (e) {
          console.warn('Initial BCV history sync attempt:', e);
        }
      }
    };

    initializeBcvData();

    return () => {
      active = false;
    };
  }, []);

  // Background timer for automatic BCV rate synchronization when enabled
  useEffect(() => {
    if (!settings.autoUpdateBcv) return;
    const intervalSec = Math.max(30, settings.bcvAutoUpdateIntervalSeconds || 60);
    const timer = setInterval(() => {
      fetchAutomaticBcvRate();
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [settings.autoUpdateBcv, settings.bcvAutoUpdateIntervalSeconds]);

  // Automated background cron/timer for credit limit & overdue invoice reminders
  useEffect(() => {
    if (settings.autoRemindersEnabled === false) return;

    const runScan = () => {
      try {
        const { newReminders, notificationsToPush } = scanAndGenerateReminders(
          customers,
          invoices,
          receivables,
          settings,
          automatedReminders
        );

        if (newReminders.length > 0) {
          setAutomatedReminders((prev) => {
            const updated = [...newReminders, ...prev].slice(0, 100);
            try {
              localStorage.setItem('omni_automated_reminders', JSON.stringify(updated));
            } catch (e) {
              console.warn('Error saving automated reminders:', e);
            }
            return updated;
          });

          for (const notif of notificationsToPush) {
            triggerPushNotification({
              title: notif.title,
              message: notif.message,
              type: notif.type as any,
              targetCustomerId: notif.targetCustomerId,
              badge: notif.badge,
            });
          }
        }
      } catch (err) {
        console.warn('Background reminder scan error:', err);
      }
    };

    // Run after initial delay, then every 60 seconds
    const timeout = setTimeout(runScan, 3000);
    const interval = setInterval(runScan, 60000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [customers, invoices, receivables, settings.autoRemindersEnabled, settings.creditReminderThresholdPercent]);

  const runManualReminderScan = (): AutomatedReminderRecord[] => {
    const { newReminders, notificationsToPush } = scanAndGenerateReminders(
      customers,
      invoices,
      receivables,
      settings,
      automatedReminders
    );

    if (newReminders.length > 0) {
      setAutomatedReminders((prev) => {
        const updated = [...newReminders, ...prev].slice(0, 100);
        try {
          localStorage.setItem('omni_automated_reminders', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      for (const notif of notificationsToPush) {
        triggerPushNotification({
          title: notif.title,
          message: notif.message,
          type: notif.type as any,
          targetCustomerId: notif.targetCustomerId,
          badge: notif.badge,
        });
      }
    }
    return newReminders;
  };

  // Product CRUD
  const addProduct = (product: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...product,
      id: `prod-${Date.now()}`,
    };
    const updated = [newProd, ...products];
    setProducts(updated);
    broadcastStockUpdate(updated, {
      productIds: [newProd.id],
      source: 'adjustment',
      summary: `Nuevo producto agregado: ${newProd.name}`,
    });
  };

  const updateProduct = (product: Product) => {
    const updated = products.map((p) => (p.id === product.id ? product : p));
    setProducts(updated);
    broadcastStockUpdate(updated, {
      productIds: [product.id],
      source: 'adjustment',
      summary: `Producto actualizado: ${product.name}`,
    });
  };

  const deleteProduct = (productId: string) => {
    const updated = products.filter((p) => p.id !== productId);
    setProducts(updated);
    broadcastStockUpdate(updated, {
      productIds: [productId],
      source: 'adjustment',
      summary: 'Producto eliminado',
    });
  };

  const adjustProductStock = (productId: string, delta: number, reason: string) => {
    const target = products.find((p) => p.id === productId);
    const updated = products.map((p) => {
      if (p.id === productId) {
        const newStock = Math.max(0, p.stock + delta);
        return { ...p, stock: newStock };
      }
      return p;
    });
    setProducts(updated);
    broadcastStockUpdate(updated, {
      productIds: [productId],
      source: 'adjustment',
      summary: `Stock ajustado (${delta > 0 ? '+' : ''}${delta}) en ${target?.name || 'producto'}: ${reason}`,
    });
    pushNotification('Ajuste de Stock', `Inventario ajustado (${delta > 0 ? '+' : ''}${delta}). Motivo: ${reason}`, 'inventory_alert');
  };

  // Customer Management & Credit
  const addCustomer = (customer: Omit<Customer, 'id'>) => {
    const newCust: Customer = {
      ...customer,
      id: `cust-${Date.now()}`,
    };
    setCustomers((prev) => [newCust, ...prev]);
  };

  const updateCustomer = (customer: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
  };

  const updateCustomerCredit = (
    customerId: string,
    hasCredit: boolean,
    creditDays: number,
    creditLimitUSD: number
  ) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updated: Customer = {
            ...c,
            hasCredit,
            creditDays,
            creditLimitUSD,
            creditStatus: hasCredit ? 'approved' : 'none',
          };
          if (currentCustomer?.id === customerId) {
            setCurrentCustomer(updated);
          }
          return updated;
        }
        return c;
      })
    );
    triggerPushNotification({
      title: '💳 Crédito Comercial Modificado',
      message: `Términos de crédito: ${creditDays} días, límite $${creditLimitUSD.toFixed(2)}.`,
      type: 'credit_alert',
    });
  };

  const approveCustomerCreditRequest = (
    customerId: string,
    approvedLimitUSD: number,
    approvedCreditDays: number
  ) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updated: Customer = {
            ...c,
            hasCredit: true,
            creditDays: approvedCreditDays,
            creditLimitUSD: approvedLimitUSD,
            creditStatus: 'approved',
          };
          if (currentCustomer?.id === customerId) {
            setCurrentCustomer(updated);
          }
          return updated;
        }
        return c;
      })
    );
    triggerPushNotification({
      title: '🎉 ¡Crédito Comercial Aprobado!',
      message: `Línea de crédito activada: $${approvedLimitUSD.toFixed(2)} por ${approvedCreditDays} días de plazo.`,
      type: 'credit_alert',
      targetCustomerId: customerId,
      badge: 'Crédito Aprobado',
    });
  };

  const rejectCustomerCreditRequest = (customerId: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updated: Customer = {
            ...c,
            hasCredit: false,
            creditStatus: 'rejected',
          };
          if (currentCustomer?.id === customerId) {
            setCurrentCustomer(updated);
          }
          return updated;
        }
        return c;
      })
    );
    triggerPushNotification({
      title: '⚠️ Solicitud de Crédito Revisada',
      message: 'La solicitud de crédito comercial no fue aprobada por el momento.',
      type: 'credit_alert',
      targetCustomerId: customerId,
    });
  };

  // Accounts Receivable payment registration (Cobro a Clientes)
  const registerReceivablePayment = (receivableId: string, amountUSD: number) => {
    setReceivables((prev) =>
      prev.map((rec) => {
        if (rec.id === receivableId) {
          const newPaid = rec.amountPaidUSD + amountUSD;
          const newBalance = Math.max(0, rec.totalAmountUSD - newPaid);
          const isFull = newBalance <= 0.01;

          // Update customer debt
          setCustomers((custs) =>
            custs.map((c) =>
              c.id === rec.customerId
                ? { ...c, currentDebtUSD: Math.max(0, c.currentDebtUSD - amountUSD) }
                : c
            )
          );

          return {
            ...rec,
            amountPaidUSD: newPaid,
            balanceUSD: newBalance,
            status: isFull ? 'pagado' : rec.status,
          };
        }
        return rec;
      })
    );
    pushNotification(
      'Pago Registrado (CxC)',
      `Abono de $${amountUSD.toFixed(2)} registrado satisfactoriamente en Cuentas por Cobrar.`,
      'credit_alert'
    );
  };

  // Accounts Payable payment registration (Pago a Proveedores)
  const registerPayablePayment = (payableId: string, amountUSD: number) => {
    setPayables((prev) =>
      prev.map((pay) => {
        if (pay.id === payableId) {
          const newPaid = pay.amountPaidUSD + amountUSD;
          const newBalance = Math.max(0, pay.totalAmountUSD - newPaid);
          const isFull = newBalance <= 0.01;
          return {
            ...pay,
            amountPaidUSD: newPaid,
            balanceUSD: newBalance,
            status: isFull ? 'pagado' : pay.status,
          };
        }
        return pay;
      })
    );
    pushNotification(
      'Pago a Proveedor (CxP)',
      `Pago de $${amountUSD.toFixed(2)} registrado en Cuentas por Pagar.`,
      'credit_alert'
    );
  };

  const addSupplier = (supplier: Omit<Supplier, 'id'>) => {
    const newSup: Supplier = {
      ...supplier,
      id: `sup-${Date.now()}`,
    };
    setSuppliers((prev) => [newSup, ...prev]);
  };

  const updateSupplier = (supplier: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? supplier : s)));
  };

  const addUser = (user: Omit<User, 'id' | 'createdAt'>) => {
    const newUser: User = {
      ...user,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      active: user.active ?? true,
      password: user.password || 'admin123',
      isInitialGeneric: false,
    };
    setUsers((prev) => [...prev, newUser]);
    triggerPushNotification({
      title: 'Colaborador Registrado',
      message: `Se ha creado el usuario ${newUser.name} con rol ${newUser.role.toUpperCase()}.`,
      type: 'inventory_alert',
      badge: 'Usuarios ERP',
    });
  };

  const updateUser = (user: User) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
    if (currentUser.id === user.id) {
      setCurrentUser(user);
    }
  };

  const deleteUser = (userId: string): { success: boolean; message: string } => {
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'Usuario no encontrado' };

    if (target.role === 'admin') {
      const activeAdmins = users.filter((u) => u.role === 'admin' && u.active);
      if (activeAdmins.length <= 1) {
        alert(
          'No se puede eliminar el único Administrador del sistema. Crea un nuevo Administrador primero.'
        );
        return {
          success: false,
          message: 'No se puede eliminar el único Administrador.',
        };
      }
    }

    if (currentUser.id === userId) {
      const remainingAdmin = users.find(
        (u) => u.id !== userId && u.role === 'admin' && u.active
      );
      if (remainingAdmin) {
        setCurrentUser(remainingAdmin);
      }
    }

    setUsers((prev) => prev.filter((u) => u.id !== userId));

    triggerPushNotification({
      title: 'Usuario Eliminado',
      message: `El usuario "${target.name}" ha sido eliminado del sistema.`,
      type: 'inventory_alert',
      badge: 'Control ERP',
    });

    return { success: true, message: 'Usuario eliminado exitosamente' };
  };

  const resetSystemToFactory = () => {
    localStorage.removeItem('omni_users');
    localStorage.removeItem('omni_settings');
    localStorage.removeItem('omni_customers');
    localStorage.removeItem('omni_products');
    localStorage.removeItem('omni_cart');
    localStorage.removeItem('omni_orders');
    localStorage.removeItem('omni_invoices');
    localStorage.removeItem('omni_receivables');
    localStorage.removeItem('omni_payables');
    localStorage.removeItem('omni_suppliers');
    localStorage.removeItem('omni_notifications');
    localStorage.removeItem('omni_active_customer_id');

    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_GENERIC_ADMIN);
    setSettings(INITIAL_SETTINGS);
    setCustomers(INITIAL_CUSTOMERS);
    setProducts(INITIAL_PRODUCTS);
    setCart([]);
    setOrders(INITIAL_ORDERS);
    setInvoices(INITIAL_INVOICES);
    setReceivables(INITIAL_RECEIVABLES);
    setPayables(INITIAL_PAYABLES);
    setSuppliers(INITIAL_SUPPLIERS);
    setCurrentCustomer(null);

    triggerPushNotification({
      title: 'Sistema Reiniciado desde Cero',
      message: 'Valores restablecidos a fábrica. El Administrador Inicial (Genérico) ha sido restaurado.',
      type: 'custom_broadcast',
      badge: 'Reset de Fábrica',
    });
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        currentUser,
        setCurrentUser,
        currentCustomer,
        setCurrentCustomer,
        products,
        categories,
        addCategory,
        deleteCategory,
        updateCategory,
        units,
        addUnit,
        deleteUnit,
        updateUnit,
        cart,
        orders,
        invoices,
        receivables,
        payables,
        suppliers,
        customers,
        users,
        settings,
        notifications,
        addToCart,
        addToCartWithPresentation,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        createOrder,
        reorder,
        updateOrderStatus,
        updatePaymentStatus,
        updateBcvRate,
        fetchAutomaticBcvRate,
        syncBcvOfficialHistory,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustProductStock,
        addCustomer,
        updateCustomer,
        updateCustomerCredit,
        approveCustomerCreditRequest,
        rejectCustomerCreditRequest,
        registerReceivablePayment,
        registerPayablePayment,
        addSupplier,
        updateSupplier,
        addUser,
        updateUser,
        deleteUser,
        resetSystemToFactory,
        refreshBcvRate: fetchAutomaticBcvRate,
        updateSettings,
        markNotificationAsRead,
        clearAllNotifications,
        // Push notifications & Toasts
        activePushToasts,
        dismissPushToast,
        triggerPushNotification,
        broadcastPushNotification,
        // Customer Auth
        loginCustomer,
        registerCustomer,
        logoutCustomer,
        updateCustomerPreferences,
        // Navigation tabs & modals
        storeTab,
        setStoreTab,
        customerPortalTab,
        setCustomerPortalTab,
        isAdminActive,
        setIsAdminActive,
        authInitialTab,
        setAuthInitialTab,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isAdminModalOpen,
        setIsAdminModalOpen,
        isNotificationSettingsOpen,
        setIsNotificationSettingsOpen,
        isSellerAlertsModalOpen,
        setIsSellerAlertsModalOpen,
        isBusinessSettingsModalOpen,
        setIsBusinessSettingsModalOpen,
        // BCV Panel & Category/Unit Modal & Presentation modal
        isBcvPanelOpen,
        setIsBcvPanelOpen,
        isCategoryUnitModalOpen,
        setIsCategoryUnitModalOpen,
        presentationModalProduct,
        setPresentationModalProduct,
        presentationCallback,
        openPresentationModal,
        // UI states
        isCartOpen,
        setIsCartOpen,
        isOrdersModalOpen,
        setIsOrdersModalOpen,
        selectedInvoiceForModal,
        setSelectedInvoiceForModal,
        lastSuccessfulOrder,
        setLastSuccessfulOrder,
        // Automated Reminders
        automatedReminders,
        runManualReminderScan,
        // Real-Time Stock Synchronization
        lastStockUpdateEvent,
        broadcastStockUpdate,
        // Turso Database Cloud State
        tursoState,
        bootstrapTursoSchema,
        syncWithTurso,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
