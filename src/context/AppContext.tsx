import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppNotification,
  CartItem,
  Customer,
  CustomerNotificationPreferences,
  Invoice,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PayableItem,
  Product,
  ReceivableItem,
  Supplier,
  SystemSettings,
  User,
} from '../types';
import { playNotificationSound } from '../utils/notificationSound';
import {
  INITIAL_CUSTOMERS,
  INITIAL_INVOICES,
  INITIAL_ORDERS,
  INITIAL_PAYABLES,
  INITIAL_PRODUCTS,
  INITIAL_RECEIVABLES,
  INITIAL_SETTINGS,
  INITIAL_SUPPLIERS,
  INITIAL_USERS,
} from '../data/initialData';

interface AppContextType {
  mode: 'store' | 'erp';
  setMode: (mode: 'store' | 'erp') => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  currentCustomer: Customer | null;
  setCurrentCustomer: (customer: Customer | null) => void;
  products: Product[];
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
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  createOrder: (orderInput: {
    customerId: string;
    customerName: string;
    customerRif: string;
    customerPhone: string;
    customerAddress: string;
    items: { product: Product; quantity: number }[];
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    channel: 'online' | 'pos';
    notes?: string;
    customCreditDays?: number;
  }) => { order: Order; invoice: Invoice };
  reorder: (orderId: string) => boolean;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updatePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => void;
  updateBcvRate: (newRate: number) => void;
  fetchAutomaticBcvRate: () => Promise<number>;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  adjustProductStock: (productId: string, delta: number, reason: string) => void;
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (customer: Customer) => void;
  updateCustomerCredit: (customerId: string, hasCredit: boolean, creditDays: number, creditLimitUSD: number) => void;
  registerReceivablePayment: (receivableId: string, amountUSD: number) => void;
  registerPayablePayment: (payableId: string, amountUSD: number) => void;
  addSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  updateSupplier: (supplier: Supplier) => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (userId: string) => void;
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
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isNotificationSettingsOpen: boolean;
  setIsNotificationSettingsOpen: (open: boolean) => void;
  isSellerAlertsModalOpen: boolean;
  setIsSellerAlertsModalOpen: (open: boolean) => void;
  // UI states
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isOrdersModalOpen: boolean;
  setIsOrdersModalOpen: (open: boolean) => void;
  selectedInvoiceForModal: Invoice | null;
  setSelectedInvoiceForModal: (invoice: Invoice | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'store' | 'erp'>(() => {
    return (localStorage.getItem('omni_mode') as 'store' | 'erp') || 'store';
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('omni_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('omni_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    return users[0] || INITIAL_USERS[0];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('omni_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(() => {
    return customers[0] || INITIAL_CUSTOMERS[0];
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
            type: 'bcv_update',
            createdAt: new Date().toISOString(),
            read: false,
          },
        ];
  });

  // UI Modals & Navigation
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [storeTab, setStoreTab] = useState<'catalog' | 'offers'>('catalog');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isSellerAlertsModalOpen, setIsSellerAlertsModalOpen] = useState(false);

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
    badge?: string;
    sound?: boolean;
  }) => {
    const type = options.type || 'promotion';
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: options.title,
      message: options.message,
      type,
      createdAt: new Date().toISOString(),
      read: false,
      relatedOrderId: options.relatedOrderId,
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

  // Cart operations
  const addToCart = (product: Product, quantity = 1) => {
    if (product.stock <= 0) {
      alert(`El producto "${product.name}" está agotado en inventario.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const nextQty = existing.quantity + quantity;
        if (nextQty > product.stock) {
          alert(`Stock insuficiente. Solo quedan ${product.stock} unidades de "${product.name}".`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock) }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (product && quantity > product.stock) {
      alert(`Stock máximo disponible: ${product.stock} unidades.`);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
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
    items: { product: Product; quantity: number }[];
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
      const effectivePrice = item.product.isOffer && item.product.discountPercentage
        ? item.product.priceUSD * (1 - item.product.discountPercentage / 100)
        : item.product.priceUSD;
      return {
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPriceUSD: effectivePrice,
        subtotalUSD: effectivePrice * item.quantity,
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
      paymentStatus: isCredit ? 'a_credito' : orderInput.paymentMethod === 'efectivo_usd' && orderInput.channel === 'pos' ? 'pagado' : 'pendiente',
      orderStatus: 'pendiente', // Pedidos se envían en estado pendiente según requerimiento
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

    // Deduct stock in real-time
    setProducts((prev) =>
      prev.map((p) => {
        const bought = orderInput.items.find((item) => item.product.id === p.id);
        if (bought) {
          const remaining = Math.max(0, p.stock - bought.quantity);
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
      })
    );

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
      pendiente: '🕒 Pedido Registrado (Pendiente)',
      en_preparacion: '📦 ¡Tu Pedido está en Preparación!',
      en_camino: '🚚 ¡Tu Pedido va en Camino a tu Dirección!',
      entregado: '✅ ¡Pedido Entregado con Éxito!',
      cancelado: '❌ Pedido Cancelado',
    };

    const statusMessages: Record<OrderStatus, string> = {
      pendiente: 'Tu pedido está registrado y en espera de confirmación y empaque.',
      en_preparacion: 'El equipo de almacén está empacando y verificando tus productos.',
      en_camino: 'El despachador va en ruta a tu dirección. Mantén tu teléfono atento.',
      entregado: 'El pedido fue recibido a conformidad. ¡Muchas gracias por tu preferencia!',
      cancelado: 'El pedido ha sido anulado o cancelado en el sistema.',
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
            badge: status === 'entregado' ? 'Completado' : 'En vivo',
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

  // BCV Rate management
  const updateBcvRate = (newRate: number) => {
    setSettings((prev) => ({
      ...prev,
      bcvRate: Number(newRate.toFixed(2)),
      lastBcvUpdate: new Date().toISOString(),
    }));
    pushNotification(
      'Tasa BCV Actualizada',
      `La tasa oficial de cambio se fijó en ${newRate.toFixed(2)} Bs/USD. Precios en bolívares sincronizados.`,
      'bcv_update'
    );
  };

  const fetchAutomaticBcvRate = async (): Promise<number> => {
    // Simulate real-time API call to BCV feed with slight realistic fluctuation
    await new Promise((res) => setTimeout(res, 800));
    const variation = (Math.random() * 0.4 - 0.15); // e.g. slight change
    const newRate = Number((settings.bcvRate + variation).toFixed(2));
    updateBcvRate(newRate);
    return newRate;
  };

  // Product CRUD
  const addProduct = (product: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...product,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [newProd, ...prev]);
  };

  const updateProduct = (product: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
  };

  const deleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const adjustProductStock = (productId: string, delta: number, reason: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const newStock = Math.max(0, p.stock + delta);
          return { ...p, stock: newStock };
        }
        return p;
      })
    );
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
      prev.map((c) =>
        c.id === customerId
          ? { ...c, hasCredit, creditDays, creditLimitUSD }
          : c
      )
    );
    pushNotification(
      'Crédito Actualizado',
      `Términos de crédito modificados: ${creditDays} días, límite $${creditLimitUSD.toFixed(2)}.`,
      'credit_alert'
    );
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
    };
    setUsers((prev) => [newUser, ...prev]);
  };

  const updateUser = (user: User) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
  };

  const deleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
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
        updateCartQuantity,
        removeFromCart,
        clearCart,
        createOrder,
        reorder,
        updateOrderStatus,
        updatePaymentStatus,
        updateBcvRate,
        fetchAutomaticBcvRate,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustProductStock,
        addCustomer,
        updateCustomer,
        updateCustomerCredit,
        registerReceivablePayment,
        registerPayablePayment,
        addSupplier,
        updateSupplier,
        addUser,
        updateUser,
        deleteUser,
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
        isAuthModalOpen,
        setIsAuthModalOpen,
        isNotificationSettingsOpen,
        setIsNotificationSettingsOpen,
        isSellerAlertsModalOpen,
        setIsSellerAlertsModalOpen,
        // UI states
        isCartOpen,
        setIsCartOpen,
        isOrdersModalOpen,
        setIsOrdersModalOpen,
        selectedInvoiceForModal,
        setSelectedInvoiceForModal,
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
