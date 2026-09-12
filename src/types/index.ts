export type Role = 'admin' | 'gerente' | 'cajero' | 'despachador';
export type UserRole = Role;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  active: boolean;
  createdAt: string;
  password?: string;
  isInitialGeneric?: boolean;
}
export type AppUser = User;

export interface CustomerNotificationPreferences {
  orderStatus: boolean;
  promotions: boolean;
  creditAlerts: boolean;
  soundEnabled: boolean;
  channel: 'push' | 'sms' | 'email' | 'all';
}

export interface Customer {
  id: string;
  name: string;
  rif: string; // Cédula o RIF (e.g. J-40123456-7)
  email: string;
  phone: string;
  address: string;
  hasCredit: boolean;
  creditDays: number; // Días de crédito específicos (e.g. 15, 30)
  creditLimitUSD: number;
  currentDebtUSD: number;
  password?: string;
  avatar?: string;
  notificationPreferences?: CustomerNotificationPreferences;
}

export interface ProductPresentation {
  id: string;
  name: string; // e.g. "Bulto x 24 un", "Caja x 12 un", "Fardo x 20 un"
  factor: number; // Unidades base
  priceUSD: number;
  barcode?: string;
}

export interface ProductSupplierInfo {
  id: string;
  supplierId: string;
  supplierName: string;
  costUSD: number;
  barcode: string; // Código de barras de este proveedor
}

export interface AlternativePrice {
  discountPercent: number; // % descuento asignado
  finalPriceUSD: number; // Precio final con descuento aplicado
  customerSavingsUSD: number; // Ahorro del cliente al adquirirlo a este precio
  active: boolean;
}

export interface AlternativePrices {
  promocion: AlternativePrice;
  oferta: AlternativePrice;
  granMayor: AlternativePrice;
}

export interface CompositeComponent {
  productId: string;
  productName: string;
  quantity: number;
  costUSD: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  costUSD: number;
  profitMarginPercent?: number; // % Margen de ganancia
  priceUSD: number;
  stock: number;
  minStock: number;
  unit: string;
  image: string;
  isOffer?: boolean;
  discountPercentage?: number;
  description?: string;
  // Campos avanzados solicitados
  appliesIva?: boolean; // Selector si aplica o no IVA (true: aplica 16%, false: exento)
  alternativePrices?: AlternativePrices; // Promoción, Oferta, Gran Mayor
  presentations?: ProductPresentation[]; // Presentaciones (tipos) y precios
  suppliersInfo?: ProductSupplierInfo[]; // Proveedores con costo y código de barras
  highestSupplierCost?: number; // Costo más alto detectado entre proveedores
  // Producto Compuesto
  isComposite?: boolean; // Marcador si el producto es Compuesto
  compositeComponents?: CompositeComponent[]; // Componentes si es compuesto
  compositeVirtualStock?: number; // Stock virtual calculado según componentes
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus = 'en_tramite' | 'despachado_facturado';
export type CustomerPortalTab = 'catalogo' | 'ofertas' | 'pedidos' | 'facturas' | 'credito';
export type PaymentStatus = 'pendiente' | 'pagado' | 'a_credito';
export type PaymentMethod =
  | 'efectivo_bs'
  | 'biopago'
  | 'transferencia_bs'
  | 'zelle'
  | 'pago_movil'
  | 'efectivo_usd'
  | 'credito';

export const formatPaymentMethod = (method: PaymentMethod | string): string => {
  switch (method) {
    case 'efectivo_bs':
      return 'Efectivo Bs.';
    case 'biopago':
      return 'Biopago';
    case 'transferencia_bs':
      return 'Transferencia';
    case 'zelle':
      return 'Zelle';
    case 'efectivo_usd':
      return 'Efectivo USD';
    case 'pago_movil':
      return 'Pago Móvil';
    case 'credito':
      return 'Crédito Comercial';
    default:
      return (method || '').replace(/_/g, ' ');
  }
};

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceUSD: number;
  subtotalUSD: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerRif: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  subtotalUSD: number;
  taxUSD: number; // IVA 16%
  totalUSD: number;
  totalBs: number;
  bcvRate: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentReference?: string;
  channel: 'online' | 'pos';
  createdAt: string;
  estimatedDelivery?: string;
  creditDueDate?: string;
  creditDays?: number;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerRif: string;
  customerAddress: string;
  customerPhone: string;
  items: OrderItem[];
  subtotalUSD: number;
  taxUSD: number;
  totalUSD: number;
  totalBs: number;
  bcvRate: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  dueDate?: string;
  isCredit: boolean;
  creditDays?: number;
}

export interface ReceivableItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalAmountUSD: number;
  amountPaidUSD: number;
  balanceUSD: number;
  issuedDate: string;
  dueDate: string;
  creditDays: number;
  status: 'al_dia' | 'por_vencer' | 'vencido' | 'pagado';
}

export interface Supplier {
  id: string;
  name: string;
  rif: string;
  phone: string;
  email: string;
  contactPerson: string;
  creditDays: number;
}

export interface PayableItem {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  description: string;
  totalAmountUSD: number;
  amountPaidUSD: number;
  balanceUSD: number;
  issuedDate: string;
  dueDate: string;
  status: 'al_dia' | 'por_vencer' | 'vencido' | 'pagado';
}

export interface SystemSettings {
  companyName: string;
  companyRif: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  bcvRate: number;
  autoUpdateBcv: boolean;
  lastBcvUpdate: string;
  defaultCreditDays: number;
  defaultCreditLimitUSD: number;
  ivaPercentage: number;
  pagoMovilBank: string;
  pagoMovilPhone: string;
  pagoMovilRif: string;
  zelleEmail: string;
  zelleBeneficiary: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'order_status' | 'inventory_alert' | 'credit_alert' | 'bcv_update' | 'promotion' | 'custom_broadcast';
  createdAt: string;
  read: boolean;
  relatedOrderId?: string;
  targetRole?: 'client' | 'seller' | 'all';
  targetCustomerId?: string;
  actionUrl?: string;
  badge?: string;
  priority?: 'normal' | 'high' | 'urgent';
}
