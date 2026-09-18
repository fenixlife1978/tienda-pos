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
  creditDays: number; // Días de crédito específicos (e.g. 7, 15, 30)
  creditLimitUSD: number;
  currentDebtUSD: number;
  creditStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  creditRequestedLimitUSD?: number;
  creditRequestedDays?: number;
  creditRequestedAt?: string;
  password?: string;
  avatar?: string;
  notificationPreferences?: CustomerNotificationPreferences;
  // Campos de Verificación y Gestión de Solicitudes
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  isFirstTime?: boolean;
  registeredAt?: string;
  businessType?: string; // Bodegón, Minimarket, Panadería, Restaurante, Detal, etc.
  tradeName?: string; // Razón comercial / Rótulo del local
  contactPerson?: string; // Nombre del contacto o comprador
  attachedDocRif?: string; // e.g. "RIF Fiscal J-41234567-8 Verificado"
  attachedCommercialRef?: string; // Referencia comercial o bancaria
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  assignedPriceTier?: 'publico' | 'mayorista' | 'distribuidor' | 'especial';
  verificationNotes?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
}

export interface ProductUnit {
  id: string;
  name: string; // e.g. "Unidad", "Kilogramo (Kg)", "Litro (L)", "Bulto", "Caja", "Gramos (g)"
  abbreviation: string; // e.g. "Unid", "Kg", "L", "Blt", "Caj", "g"
  allowDecimals?: boolean;
}

export interface ProductPresentation {
  id: string;
  name: string; // e.g. "Bulto x 24 un", "Caja x 12 un", "Fardo x 20 un"
  factor: number; // Unidades base
  priceUSD: number;
  barcode?: string;
  saleType?: 'packaging' | 'weight' | 'fractional_amount';
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

export interface PromotionOffer {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  category: string;
  image?: string;
  costUSD?: number;
  originalPriceUSD: number;
  discountPercentage: number;
  promotionalPriceUSD: number;
  customerSavingsUSD: number;
  customerSavingsBs: number;
  conditionText?: string; // ej: "Después de 6 artículos", "A partir de 12 unidades" (Editable en texto libre)
  condition?: string;
  badgeText?: string; // ej: "SUPER OFERTA", "PROMO FLASH", "LIQUIDACIÓN", "DESCUENTO X VOLUMEN"
  minQuantity?: number;
  active: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
  stockAvailable?: number;
  createdAt: string;
}

export interface PromotionConditionPreset {
  id: string;
  label: string;
  minQuantity?: number;
  description?: string;
  isCustom?: boolean;
}

// 4 Métodos de formación de precio
export type PricingMethod = 'markup' | 'margin_on_sale' | 'gap_system' | 'manual';

// Matriz de listas de precios alternativos
export interface PriceListTier {
  name: string; // "Público / Detal", "Mayorista", "Distribuidor", "Especial"
  marginPercent: number; // % de ganancia
  priceUSD: number; // Precio calculado en USD
  priceBs: number; // Precio calculado en Bs
  active: boolean;
}

export interface PriceListMatrix {
  publico: PriceListTier;
  mayorista: PriceListTier;
  distribuidor: PriceListTier;
  especial: PriceListTier;
}

// Modalidades de venta permitidas
export interface AllowedSaleModes {
  originalPresentation: boolean; // Presentación original
  unit: boolean; // Unidad
  fractional: boolean; // Fraccionada
  shots: boolean; // Tragos / Shots
  contentControl: boolean; // Control por contenido / Balanza
}

// Configuración de Presentaciones y Unidades de Venta
export interface SalesPresentationsConfig {
  mainPresentation: string; // Unidad, Caja, Paquete, Botella, Litro, Kg, Metro, etc.
  contentQuantity: number;
  baseUnit: string;
  conversionFactor: number;
  allowedModes: AllowedSaleModes;
}

export interface CompositeComponent {
  productId: string;
  productName: string;
  quantity: number;
  costUSD: number;
}

export interface Product {
  id: string;
  code: string; // SKU o Código Interno
  barcode?: string; // Código de barras EAN-13, EAN-8 o Code 128
  ean?: string; // Código EAN-13 internacional
  name: string;
  category: string;
  costUSD: number; // Costo de compra en USD
  additionalExpensesPercent?: number; // Gastos adicionales en %
  realCostUSD?: number; // Costo Real = Costo de compra × (1 + Gastos%)
  lastCostUSD?: number; // Último costo registrado (auditoría / reposición)
  pricingMethod?: PricingMethod; // Método de formación de precio
  profitMarginPercent?: number; // % Margen de ganancia
  gapPercent?: number; // % de brecha (para sistema de brecha)
  ivaRate?: number; // Alícuota de IVA: 16 (General), 8 (Reducida), 0 (Exento)
  priceUSD: number; // Precio final de venta en USD
  priceListMatrix?: PriceListMatrix; // Matriz de listas (Público, Mayorista, Distribuidor, Especial)
  
  // Pestaña Inventario
  stock: number; // Stock físico o virtual
  initialStock?: number; // Stock inicial
  minStock: number; // Stock mínimo
  maxStock?: number; // Stock máximo
  reorderPoint?: number; // Punto de reorden
  warehouse?: 'Principal' | 'Secundario' | 'Depósito' | string; // Almacén
  location?: string; // Ubicación física (pasillo/estante)

  // Pestaña Presentaciones y Unidades de Venta
  unit: string; // Unidad de medida
  salesPresentationsConfig?: SalesPresentationsConfig; // Configuración completa de presentaciones y modalidades

  image: string;
  isOffer?: boolean;
  discountPercentage?: number;
  offerCondition?: string; // e.g. "Después de 6 artículos", "A partir de 12 unidades" (Texto libre)
  offerBadgeText?: string; // e.g. "PROMO FLASH", "SUPER OFERTA", "LIQUIDACIÓN"
  offerSavingsUSD?: number;
  offerSavingsBs?: number;
  offerMinQuantity?: number;
  promotionalPriceUSD?: number;
  offerStartDate?: string;
  offerEndDate?: string;
  description?: string;
  
  // Campos avanzados
  appliesIva?: boolean; // true si aplica IVA (16% u 8%), false si exento (0%)
  alternativePrices?: AlternativePrices; // Promoción, Oferta, Gran Mayor (compatibilidad)
  presentations?: ProductPresentation[]; // Presentaciones registradas (bultos, cajas, etc.)
  suppliersInfo?: ProductSupplierInfo[]; // Proveedores vinculados con costo y código de barras
  highestSupplierCost?: number; // Costo más alto detectado entre proveedores
  
  // Producto Compuesto
  isComposite?: boolean; // Marcador si el producto es Compuesto
  compositeComponents?: CompositeComponent[]; // Componentes si es compuesto
  compositeVirtualStock?: number; // Stock virtual calculado según componentes
  
  // Modalidades de Venta Especiales
  isWeighable?: boolean; // Venta por peso en balanza / Kg (ej. Queso, charcutería, carne)
  pricePerKgUSD?: number; // Precio por Kg si es pesable
  isFractionable?: boolean; // Venta fraccionada por monto libre en Bs. (ej. Licor a granel, combustible)
  fractionUnit?: string; // Unidad de despacho fraccionado (ej. "Litro", "ml", "Kg")
}

export interface CartItem {
  id?: string; // ID único para soportar diferentes presentaciones o cortes de un mismo producto
  product: Product;
  quantity: number;
  selectedPresentation?: ProductPresentation;
  saleMode?: 'standard' | 'presentation' | 'weight' | 'custom_amount';
  weightKg?: number; // Para venta de queso / charcutería por peso
  customAmountBs?: number; // Para venta de licor / a granel por monto en Bs.
  customAmountUSD?: number;
  unitPriceUSD?: number;
  customNote?: string;
}

export type OrderStatus = 'en_tramite' | 'despachado_facturado';
export type CustomerPortalTab = 'catalogo' | 'ofertas' | 'pedidos' | 'facturas' | 'credito';
export type PaymentStatus = 'pendiente' | 'pagado' | 'a_credito';
export type PaymentMethod =
  | 'efectivo_bs'
  | 'biopago'
  | 'transferencia_bs'
  | 'transferencia_usd'
  | 'zelle'
  | 'pago_movil'
  | 'efectivo_usd'
  | 'divisas_efectivo'
  | 'credito';

export const formatPaymentMethod = (method: PaymentMethod | string): string => {
  switch (method) {
    case 'efectivo_bs':
      return 'Efectivo Bs.';
    case 'biopago':
      return 'Biopago';
    case 'transferencia_bs':
      return 'Transferencia Bs.';
    case 'transferencia_usd':
      return 'Zelle / Transf. USD';
    case 'zelle':
      return 'Zelle';
    case 'efectivo_usd':
    case 'divisas_efectivo':
      return 'Efectivo Divisas USD';
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
  presentationName?: string;
  saleMode?: string;
  weightKg?: number;
  customAmountBs?: number;
  customNote?: string;
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
  isCreditApproved?: boolean; // When credit order is received and approved by admin
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
  isCreditApproved?: boolean; // When credit order is received and approved by admin to release fiscal invoice
}

export interface ReceivablePaymentRecord {
  id: string;
  date: string;
  amountUSD: number;
  amountBs: number;
  bcvRate: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  registeredBy?: string;
  balanceAfterUSD: number;
  isFullSettlement?: boolean;
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
  paymentHistory?: ReceivablePaymentRecord[];
}

export interface Supplier {
  id: string;
  name: string;
  rif: string;
  phone: string;
  email: string;
  contactPerson?: string;
  contactName?: string;
  creditDays: number;
  creditLimitUSD?: number;
  address?: string;
}

export type PurchasePaymentCondition = 'contado' | 'credito' | 'mixto';

export interface PurchaseEntryItem {
  productId: string;
  productName: string;
  productCode: string;
  category: string;
  quantity: number;
  previousCostUSD: number; // Costo anterior automático
  currentBaseCostUSD: number; // Costo base de compra actual
  additionalExpenseUSD: number; // Gastos adicionales (fletes, IVA, otros)
  realCostUSD: number; // Costo real unitario = base + adicionales
  subtotalUSD: number; // quantity * realCostUSD
  notes?: string;
}

export interface PurchaseEntry {
  id: string;
  entryNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierRif?: string;
  invoiceNumber: string;
  bcvRate: number;
  paymentCondition: PurchasePaymentCondition;
  creditDays?: number;
  creditDueDate?: string;
  totalInvoiceUSD: number;
  totalInvoiceBs: number;
  amountPaidUSD: number;
  amountPaidBs: number;
  balanceUSD: number;
  balanceBs: number;
  items: PurchaseEntryItem[];
  notes?: string;
  registeredBy?: string;
  createdAt: string;
}

export interface PayablePaymentRecord {
  id: string;
  date: string;
  amountUSD: number;
  amountBs: number;
  bcvRate: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  registeredBy?: string;
  balanceAfterUSD?: number;
  isFullSettlement?: boolean;
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
  creditDays?: number;
  status: 'al_dia' | 'por_vencer' | 'vencido' | 'pagado';
  paymentHistory?: PayablePaymentRecord[];
  items?: {
    productName: string;
    quantity: number;
    unitPriceUSD: number;
    subtotalUSD: number;
  }[];
}

export interface BcvHistoryEntry {
  id: string;
  rate: number;
  date: string;
  effectiveDate?: string;
  type: 'manual' | 'automatic';
  updatedBy: string;
  source?: string;
  previousRate?: number;
  changePercent?: number;
  currencies?: {
    EUR?: number;
    CNY?: number;
    TRY?: number;
    RUB?: number;
  };
}

export interface AcceptedPaymentMethodsConfig {
  pago_movil: boolean;
  zelle: boolean;
  transferencia_bs: boolean;
  credito: boolean;
  efectivo_usd?: boolean;
  efectivo_bs?: boolean;
  biopago?: boolean;
}

export interface SystemSettings {
  companyName: string;
  companyRif: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  companyLogo?: string;
  bcvRate: number;
  autoUpdateBcv: boolean;
  lastBcvUpdate: string;
  bcvAutoUpdateIntervalSeconds?: number;
  bcvSourceUrl?: string;
  bcvEffectiveDate?: string;
  bcvHistory?: BcvHistoryEntry[];
  defaultCreditDays: number; // Por defecto: 7 días
  defaultCreditLimitUSD: number; // Por defecto: $1,000
  ivaPercentage: number;
  // Métodos de Pago Aceptados
  acceptedPaymentMethods: AcceptedPaymentMethodsConfig;
  // Datos Pago Móvil
  pagoMovilBank: string;
  pagoMovilPhone: string;
  pagoMovilRif: string;
  // Datos Zelle
  zelleEmail: string;
  zelleBeneficiary: string;
  // Datos Transferencia Bancaria
  transferenciaBank?: string;
  transferenciaAccountNumber?: string;
  transferenciaAccountType?: string; // Corriente / Ahorro
  transferenciaBeneficiary?: string;
  transferenciaRif?: string;
  // Políticas & Cron de Recordatorios
  autoRemindersEnabled?: boolean;
  creditReminderThresholdPercent?: number; // Ej: 80%
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

export interface SlowMovingProductAnalysis {
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  stock: number;
  costUSD: number;
  priceUSD: number;
  totalValueUSD: number;
  unitsSold: number;
  revenueUSD: number;
  lastSaleDate: string | null;
  daysSinceLastSale: number | null;
  status: 'sin_movimiento' | 'poco_movimiento' | 'movimiento_normal';
}
