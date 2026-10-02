import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
const formatPaymentMethod = (method: string): string => {
  switch (method) {
    case 'efectivo_bs': return 'Efectivo Bs.';
    case 'biopago': return 'Biopago';
    case 'transferencia_bs': return 'Transferencia Bs.';
    case 'transferencia_usd': return 'Zelle / Transf. USD';
    case 'zelle': return 'Zelle';
    case 'efectivo_usd':
    case 'divisas_efectivo': return 'Efectivo Divisas USD';
    case 'pago_movil': return 'Pago Móvil';
    case 'tarjeta': return 'Tarjeta';
    case 'mixto': return 'Cobro Mixto';
    case 'credito': return 'Crédito Comercial';
    default: return (method || '').replace(/_/g, ' ');
  }
};
import {
  Store,
  Flame,
  History,
  FileText,
  CreditCard,
  ShoppingCart,
  Bell,
  LogOut,
  TrendingUp,
  Package,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  Eye,
  RefreshCw,
  Truck,
  AlertCircle,
  SlidersHorizontal,
  WalletCards,
  Building2,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  CircleDollarSign,
} from 'lucide-react';
import { StoreCatalog } from '../store/StoreCatalog';
import { OffersWall } from '../store/OffersWall';
import { OrderStatus } from '../../types';

export const CustomerDashboard: React.FC = () => {
  const {
    currentCustomer,
    logoutCustomer,
    settings,
    orders,
    invoices,
    cart,
    setIsCartOpen,
    setSelectedInvoiceForModal,
    setCustomerInvoiceModalMode,
    reorder,
    customerPortalTab,
    setCustomerPortalTab,
    setIsNotificationSettingsOpen,
    requestCustomerPushPermission,
    notifications,
    setIsAdminModalOpen,
    receivables,
    reportCustomerReceivablePayment,
  } = useApp();

  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'todos' | OrderStatus>('todos');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [debtPaymentReceivableId, setDebtPaymentReceivableId] = useState<string | null>(null);
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<import('../../types').PaymentMethod>('pago_movil');
  const [debtPaymentMixed, setDebtPaymentMixed] = useState(false);
  const [debtPaymentSplitAmounts, setDebtPaymentSplitAmounts] = useState<Record<string, string>>({});
  const [debtPaymentSplitRefs, setDebtPaymentSplitRefs] = useState<Record<string, string>>({});
  const [debtPaymentAmount, setDebtPaymentAmount] = useState('');
  const [debtPaymentReference, setDebtPaymentReference] = useState('');
  const [debtPaymentSenderName, setDebtPaymentSenderName] = useState('');
  const [debtPaymentSenderEmail, setDebtPaymentSenderEmail] = useState('');
  const [debtPaymentSenderBank, setDebtPaymentSenderBank] = useState('');
  const [debtPaymentSenderPhone, setDebtPaymentSenderPhone] = useState('');
  const [debtPaymentSubmitting, setDebtPaymentSubmitting] = useState(false);
  const debtPaymentSubmitLockRef = React.useRef(false);

  if (!currentCustomer) return null;

  // Cart stats
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalUSD = cart.reduce((sum, item) => {
    const price = item.product.isOffer && item.product.discountPercentage
      ? item.product.priceUSD * (1 - item.product.discountPercentage / 100)
      : item.product.priceUSD;
    return sum + price * item.quantity;
  }, 0);

  // Strict isolation: filter orders only for this customer
  const customerOrders = orders.filter((o) => o.customerId === currentCustomer.id);
  const customerInvoices = invoices.filter((inv) => {
    if (inv.customerId !== currentCustomer.id) return false;
    const relatedOrder = orders.find((o) => o.id === inv.orderId);
    if (!relatedOrder) return false;
    const isApproved = relatedOrder.orderStatus === 'aprobado' || relatedOrder.orderStatus === 'despachado_facturado';
    // La factura fiscal solo se libera después de la aprobación administrativa,
    // incluso cuando el cliente reportó un pago inmediato con referencia.
    return isApproved;
  });

  // Filtered orders
  const filteredOrders = customerOrders.filter((o) => {
    const matchStatus = orderStatusFilter === 'todos' || o.orderStatus === orderStatusFilter;
    const matchSearch =
      o.orderNumber.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.items.some((i) => i.productName.toLowerCase().includes(orderSearchQuery.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const customerDebts = receivables
    .filter((r) => r.customerId === currentCustomer.id && r.balanceUSD > 0.001 && !r.isVoided)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Pagos online del portal: únicamente Pago Móvil, Transferencia Bs. y Zelle.
  // El efectivo se coordina con administración y se registra posteriormente desde CxC.
  const onlinePaymentMethods = ['pago_movil', 'transferencia_bs', 'zelle'] as const;

  const selectedDebt = debtPaymentReceivableId ? customerDebts.find((r) => r.id === debtPaymentReceivableId) || null : null;

  const openDebtPayment = (receivableId: string) => {
    const debt = customerDebts.find((r) => r.id === receivableId);
    if (!debt) return;
    setDebtPaymentReceivableId(receivableId);
    setDebtPaymentMethod(onlinePaymentMethods[0] || 'pago_movil');
    setDebtPaymentMixed(false);
    setDebtPaymentSplitAmounts({});
    setDebtPaymentSplitRefs({});
    setDebtPaymentAmount((debt.balanceUSD * settings.bcvRate).toFixed(2));
    setDebtPaymentReference('');
    setDebtPaymentSenderName('');
    setDebtPaymentSenderEmail('');
    setDebtPaymentSenderBank('');
    setDebtPaymentSenderPhone('');
  };

  const closeDebtPayment = () => {
    if (!debtPaymentSubmitting) setDebtPaymentReceivableId(null);
  };

  const submitDebtPayment = async () => {
    if (!selectedDebt) return;
    const enteredAmount = Number(debtPaymentAmount);
    const isBsPaymentMethod = !debtPaymentMixed && ['pago_movil', 'transferencia_bs'].includes(debtPaymentMethod);
    const amount = isBsPaymentMethod ? enteredAmount / (settings.bcvRate || 1) : enteredAmount;
    const mixedSplits = onlinePaymentMethods
      .map((method) => ({
        method,
        amountUSD: Number(debtPaymentSplitAmounts[method] || 0),
        reference: (debtPaymentSplitRefs[method] || '').trim(),
      }))
      .filter((split) => split.amountUSD > 0);

    const totalReported = debtPaymentMixed
      ? mixedSplits.reduce((sum, split) => sum + split.amountUSD, 0)
      : amount;

    if (!Number.isFinite(totalReported) || totalReported <= 0 || totalReported > selectedDebt.balanceUSD + 0.01) {
      alert('Indica un monto válido que no supere el saldo pendiente.');
      return;
    }

    if (debtPaymentMixed) {
      if (mixedSplits.length < 2) {
        alert('Para un pago mixto debes utilizar al menos dos de los tres métodos online disponibles.');
        return;
      }
      if (mixedSplits.some((split) => !split.reference)) {
        alert('Cada método utilizado en el pago mixto debe tener su referencia.');
        return;
      }
      if (mixedSplits.some((split) => split.method === 'transferencia_bs') && !debtPaymentSenderBank.trim()) {
        alert('Indica el banco emisor de la transferencia.');
        return;
      }
      if (mixedSplits.some((split) => split.method === 'zelle') && (!debtPaymentSenderEmail.trim() || !debtPaymentSenderName.trim())) {
        alert('Para Zelle debes indicar el correo y el titular que realizó el envío.');
        return;
      }
    } else {
      const needsReference = ['pago_movil', 'transferencia_bs', 'zelle'].includes(debtPaymentMethod);
      if (needsReference && !debtPaymentReference.trim()) {
        alert('Indica el número de referencia de la operación.');
        return;
      }
      if (debtPaymentMethod === 'transferencia_bs' && !debtPaymentSenderBank.trim()) {
        alert('Indica el banco emisor.');
        return;
      }
      if (debtPaymentMethod === 'zelle' && (!debtPaymentSenderEmail.trim() || !debtPaymentSenderName.trim())) {
        alert('Para Zelle debes indicar el correo y el titular que realizó el envío.');
        return;
      }
    }

    if (debtPaymentSubmitLockRef.current) return;
    debtPaymentSubmitLockRef.current = true;
    setDebtPaymentSubmitting(true);
    try {
      await reportCustomerReceivablePayment(selectedDebt.id, totalReported, {
        paymentMethod: debtPaymentMixed ? 'mixto' : debtPaymentMethod,
        paymentSplits: debtPaymentMixed ? mixedSplits : undefined,
        reference: debtPaymentMixed ? undefined : debtPaymentReference,
        bcvRate: settings.bcvRate,
        senderName: debtPaymentSenderName,
        senderEmail: debtPaymentSenderEmail,
        senderBank: debtPaymentSenderBank,
        senderPhone: debtPaymentSenderPhone,
        notes: debtPaymentMixed
          ? 'Pago mixto online reportado desde Mis Deudas por el cliente. Pendiente de aprobación administrativa.'
          : 'Pago online reportado desde Mis Deudas por el cliente. Pendiente de aprobación administrativa.',
      });
      alert('Pago reportado correctamente. Queda pendiente de aprobación por la administración.');
      closeDebtPayment();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No fue posible reportar el pago.');
    } finally {
      debtPaymentSubmitLockRef.current = false;
      setDebtPaymentSubmitting(false);
    }
  };

  // Filtered invoices
  const filteredInvoices = customerInvoices.filter((inv) => {
    return (
      inv.invoiceNumber.toLowerCase().includes(invoiceSearchQuery.toLowerCase()) ||
      inv.items.some((i) => i.productName.toLowerCase().includes(invoiceSearchQuery.toLowerCase()))
    );
  });

  // Estado de cuenta del cliente: movimientos financieros consolidados en USD.
  // Las compras a credito aumentan la deuda; los prepagos se muestran como pago
  // pero no reducen deudas anteriores; solo los pagos CxC aprobados reducen saldo.
  type CustomerBalanceMovement = {
    id: string;
    date: string;
    concept: string;
    reference?: string;
    creditUSD: number;
    paymentUSD: number;
    balanceUSD: number;
    method?: string;
    status?: string;
    detailType: 'credito' | 'prepago' | 'pago_deuda';
  };

  const customerBalanceMovements: CustomerBalanceMovement[] = [];
  const eligibleOnlinePrepaidMethods = new Set(['transferencia_bs', 'pago_movil', 'zelle']);

  customerOrders.forEach((order) => {
    if (order.orderStatus === 'cancelado') return;
    const isCreditOrder = order.paymentMethod === 'credito' || order.paymentStatus === 'a_credito';
    if (isCreditOrder) {
      const isFinanciallyRegistered = Boolean(order.posRegisteredAt || order.approvedAt || order.channel === 'pos');
      if (!isFinanciallyRegistered) return;
      customerBalanceMovements.push({
        id: 'credit-order-' + order.id,
        date: order.posRegisteredAt || order.approvedAt || order.createdAt,
        concept: 'Compra a credito · Pedido ' + order.orderNumber,
        reference: order.orderNumber,
        creditUSD: Number(order.totalUSD || 0),
        paymentUSD: 0,
        balanceUSD: 0,
        method: 'credito',
        status: 'Registrado',
        detailType: 'credito',
      });
      return;
    }

    const isOnlinePrepaid = order.channel === 'online' && order.paymentStatus === 'pagado' && (
      eligibleOnlinePrepaidMethods.has(order.paymentMethod) ||
      (order.paymentMethod === 'mixto' && (order.paymentSplits || []).some((split) => eligibleOnlinePrepaidMethods.has(split.method)))
    );
    if (!isOnlinePrepaid) return;
    customerBalanceMovements.push({
      id: 'prepaid-order-' + order.id,
      date: order.approvedAt || order.createdAt,
      concept: 'Compra online prepaga · Pedido ' + order.orderNumber,
      reference: order.orderNumber,
      creditUSD: 0,
      paymentUSD: Number(order.totalUSD || 0),
      balanceUSD: 0,
      method: formatPaymentMethod(order.paymentMethod),
      status: 'Pagado',
      detailType: 'prepago',
    });
  });

  receivables
    .filter((receivable) => receivable.customerId === currentCustomer.id && !receivable.isVoided)
    .forEach((receivable) => {
      (receivable.paymentHistory || []).forEach((payment) => {
        if (payment.verificationStatus === 'rechazado' || payment.verificationStatus === 'pendiente') return;
        if (payment.verificationStatus !== 'aprobado' && payment.reportedByCustomer) return;
        const amount = Number(payment.amountUSD || 0);
        if (amount <= 0) return;
        customerBalanceMovements.push({
          id: 'debt-payment-' + receivable.id + '-' + payment.id,
          date: payment.date,
          concept: 'Pago de deuda · Factura ' + receivable.invoiceNumber,
          reference: payment.reference || receivable.invoiceNumber,
          creditUSD: 0,
          paymentUSD: amount,
          balanceUSD: 0,
          method: formatPaymentMethod(payment.paymentMethod),
          status: 'Aprobado',
          detailType: 'pago_deuda',
        });
      });
    });

  customerBalanceMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let runningDebtUSD = 0;
  customerBalanceMovements.forEach((movement) => {
    runningDebtUSD += movement.creditUSD;
    if (movement.detailType === 'pago_deuda') runningDebtUSD = Math.max(0, runningDebtUSD - movement.paymentUSD);
    movement.balanceUSD = runningDebtUSD;
  });

  const customerBalanceCreditUSD = customerBalanceMovements.reduce((sum, movement) => sum + movement.creditUSD, 0);
  const customerBalancePaymentsUSD = customerBalanceMovements.reduce((sum, movement) => sum + movement.paymentUSD, 0);
  const customerBalanceDebtPaymentsUSD = customerBalanceMovements.filter((movement) => movement.detailType === 'pago_deuda').reduce((sum, movement) => sum + movement.paymentUSD, 0);
  const customerBalanceCurrentDebtUSD = runningDebtUSD;

  // Credit calculation
  const creditAvailableUSD = Math.max(0, currentCustomer.creditLimitUSD - currentCustomer.currentDebtUSD);
  const creditUsagePercent = currentCustomer.creditLimitUSD > 0
    ? Math.min(100, Math.round((currentCustomer.currentDebtUSD / currentCustomer.creditLimitUSD) * 100))
    : 0;

  // Unread notifs
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpenOrder = (orderId: string) => {
    const inv = invoices.find((i) => i.orderId === orderId && i.customerId === currentCustomer.id);
    if (inv) {
      setCustomerInvoiceModalMode('order');
      setSelectedInvoiceForModal(inv);
    } else {
      alert('No se encontró el documento del pedido.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* Customer Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-3">
            
            {/* Logo and Business Identity */}
            <div className="flex items-center gap-3">
              <img
                src="./logo.png"
                alt="Distribuidora La Gran Bodega M&S"
                className="h-12 sm:h-14 w-auto object-contain rounded-xl shadow-xs"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                    DISTRIBUIDORA LA GRAN BODEGA M&S
                  </h1>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-bold text-blue-700">Mi Cuenta:</span>
                  <span className="font-semibold text-slate-800">{currentCustomer.name}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-slate-500">{currentCustomer.rif}</span>
                </div>
              </div>
            </div>

            {/* Right Controls: BCV, Cart, Notifications & Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Tasa BCV */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-mono font-bold">BCV: {settings.bcvRate.toFixed(2)} Bs</span>
              </div>

              {/* Push Notifications button */}
              <button
                onClick={() => setIsNotificationSettingsOpen(true)}
                className="relative p-2.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Ajustes de Notificaciones Push"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></span>
                )}
              </button>

              {/* Cart Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer"
              >
                <div className="relative">
                  <ShoppingCart className="w-4 h-4" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                <span className="hidden xs:inline">${cartTotalUSD.toFixed(2)}</span>
              </button>

              {/* Logout Button */}
              <button
                onClick={logoutCustomer}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                title="Cerrar Sesión y Salir al Portal Principal"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>

            </div>

          </div>
        </div>

        {/* Customer Sub-Navbar (Exclusively for client) */}
        <div className="bg-slate-100/90 border-t border-slate-200 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-1 sm:gap-2">
              
              {/* Tab: Catálogo */}
              <button
                onClick={() => setCustomerPortalTab('catalogo')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  customerPortalTab === 'catalogo'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Catálogo de Productos</span>
              </button>

              {/* Tab: Muro de Ofertas */}
              <button
                onClick={() => setCustomerPortalTab('ofertas')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  customerPortalTab === 'ofertas'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Flame className="w-4 h-4 text-amber-300" />
                <span>Muro de Ofertas</span>
              </button>

              {/* Tab: Mis Compras y Pedidos */}
              <button
                onClick={() => setCustomerPortalTab('pedidos')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  customerPortalTab === 'pedidos'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Mis Compras y Pedidos</span>
                {customerOrders.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    customerPortalTab === 'pedidos' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {customerOrders.length}
                  </span>
                )}
              </button>

              {/* Tab: Mis Facturas */}
              <button
                onClick={() => setCustomerPortalTab('facturas')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  customerPortalTab === 'facturas'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Mis Facturas</span>
                {customerInvoices.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    customerPortalTab === 'facturas' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {customerInvoices.length}
                  </span>
                )}
              </button>

              {/* Tab: Mis Deudas */}
              <button
                onClick={() => setCustomerPortalTab('deudas')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  customerPortalTab === 'deudas' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <WalletCards className="w-4 h-4" />
                <span>Mis Deudas</span>
                {customerDebts.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    customerPortalTab === 'deudas' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>{customerDebts.length}</span>
                )}
              </button>

              {/* Tab: Balance de Creditos/Pagos */}
              <button
                onClick={() => setCustomerPortalTab('balance')}
                className={'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ' + (customerPortalTab === 'balance' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-white hover:text-slate-900')}
              >
                <CircleDollarSign className="w-4 h-4" />
                <span>Balance Creditos/Pagos</span>
              </button>

              {/* Tab: Mi Línea de Crédito */}
              <button
                onClick={() => setCustomerPortalTab('credito')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  customerPortalTab === 'credito'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Mi Línea de Crédito</span>
              </button>

            </div>

            {/* Quick Credit indicator on right */}
            {currentCustomer.hasCredit && (
              <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="text-slate-400">Crédito Disponible:</span>
                <span className="font-bold text-emerald-700 font-mono">${creditAvailableUSD.toFixed(2)}</span>
                <span className="text-slate-400">({currentCustomer.creditDays} días)</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area based on customerPortalTab */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Verification Status Banner if pending */}
        {currentCustomer.verificationStatus === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3 shadow-xs">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-slate-900 text-sm">
                Cuenta en Proceso de Verificación Inicial
              </h4>
              <p className="text-slate-600 mt-0.5">
                Tu registro ha sido recibido exitosamente por la administración. Mientras se completa la validación de tus datos comerciales y asignación de crédito, puedes explorar el catálogo y realizar compras de contado.
              </p>
              {currentCustomer.creditRequestedLimitUSD && currentCustomer.creditRequestedLimitUSD > 0 && (
                <div className="mt-2 text-amber-900 font-semibold bg-amber-100/60 px-3 py-1.5 rounded-lg inline-block">
                  Solicitud de Crédito en revisión: <strong>${currentCustomer.creditRequestedLimitUSD} USD</strong> ({currentCustomer.creditRequestedDays || 15} días)
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: CATÁLOGO DE PRODUCTOS */}
        {customerPortalTab === 'catalogo' && (
          <div>
            <StoreCatalog />
          </div>
        )}

        {/* TAB 2: MURO DE OFERTAS */}
        {customerPortalTab === 'ofertas' && (
          <div>
            <OffersWall />
          </div>
        )}

        {/* TAB 3: MIS COMPRAS Y PEDIDOS */}
        {customerPortalTab === 'pedidos' && (
          <div className="space-y-6">
            
            {/* Header & Filter Controls */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <History className="w-6 h-6 text-blue-600" />
                    Historial de Mis Compras y Pedidos
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Consulta el estatus de tus pedidos en tiempo real con seguimiento directo y repite tus pedidos en 1 clic.
                  </p>
                </div>

                <button
                  onClick={() => setCustomerPortalTab('catalogo')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Package className="w-4 h-4" />
                  <span>Nuevo Pedido</span>
                </button>
              </div>

              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Buscar por N° pedido o producto..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Simplified statuses: En trámite & Despachado/Facturado */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
                  <span className="font-semibold text-slate-400 mr-1">Estado:</span>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'en_tramite', label: 'En trámite' },
                    { id: 'aprobado', label: 'Aprobado' },
                    { id: 'despachado_facturado', label: 'Despachado' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setOrderStatusFilter(tab.id as 'todos' | OrderStatus)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                        orderStatusFilter === tab.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <Package className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">No hay pedidos registrados en esta sección</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Revisa el catálogo o el muro de ofertas para armar tu pedido con despacho garantizado.
                </p>
                <button
                  onClick={() => setCustomerPortalTab('catalogo')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Explorar Catálogo de Productos
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const isAprobado = order.orderStatus === 'aprobado';
                  const isDespachado = order.orderStatus === 'despachado_facturado';

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition overflow-hidden"
                    >
                      {/* Card Top bar */}
                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-extrabold text-blue-700 text-sm">
                            {order.orderNumber}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(order.createdAt).toLocaleDateString('es-VE')} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-600">
                            Método: <strong>{formatPaymentMethod(order.paymentMethod)}</strong>
                          </span>
                          {order.paymentStatus === 'pagado' && (
                            <>
                              <span className="text-xs text-slate-300">•</span>
                              <span className="text-xs text-emerald-700">
                                Pago registrado: <strong>{new Date(
                                  (order.paymentSplits || []).map((s) => s.createdAt).filter(Boolean).sort()[0] || order.createdAt
                                ).toLocaleDateString('es-VE')} {new Date(
                                  (order.paymentSplits || []).map((s) => s.createdAt).filter(Boolean).sort()[0] || order.createdAt
                                ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Status Badge: En trámite vs Despachado/Facturado */}
                        <div>
                          {isDespachado ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
                              <Truck className="w-3.5 h-3.5 text-emerald-600" />
                              Despachado
                            </span>
                          ) : isAprobado ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-xs border border-blue-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              Aprobado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              En trámite
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Visual Tracker */}
                      <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center justify-between max-w-md mx-auto relative">
                          <div className="absolute top-1/2 left-10 right-10 -translate-y-1/2 h-1 bg-slate-200 z-0">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isDespachado ? 'bg-emerald-500 w-full' : isAprobado ? 'bg-blue-500 w-2/3' : 'bg-amber-500 w-1/3'
                              }`}
                            ></div>
                          </div>

                          {/* Step 1: En trámite */}
                          <div className="relative z-10 flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-xs shadow-sm ring-4 ring-amber-100">
                              <Clock className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-900 mt-1">1. En trámite</span>
                            <span className="text-[10px] text-slate-500">Validando & Preparando</span>
                          </div>

                          {/* Step 2: Aprobado */}
                          <div className="relative z-10 flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shadow-sm ring-4 transition ${
                              isAprobado || isDespachado ? 'bg-blue-600 text-white ring-blue-100' : 'bg-slate-200 text-slate-500 ring-slate-100'
                            }`}>
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-900 mt-1">2. Aprobado</span>
                            <span className="text-[10px] text-slate-500">
                              {isAprobado ? 'Factura habilitada' : 'Pendiente de aprobación'}
                            </span>
                          </div>

                          {/* Step 3: Despachado */}
                          <div className="relative z-10 flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shadow-sm ring-4 transition ${
                              isDespachado ? 'bg-emerald-600 text-white ring-emerald-100' : 'bg-slate-200 text-slate-500 ring-slate-100'
                            }`}>
                              <Truck className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-900 mt-1">3. Despachado</span>
                            <span className="text-[10px] text-slate-500">Pedido entregado</span>
                          </div>
                        </div>
                      </div>

                      {/* Products List in this order */}
                      <div className="p-4 space-y-2">
                        <div className="divide-y divide-slate-100 text-xs">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-100 font-bold text-slate-600 flex items-center justify-center text-[10px]">
                                  {item.quantity}x
                                </span>
                                <span className="font-semibold text-slate-800">{item.productName}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-900">${item.subtotalUSD.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Footer & Actions */}
                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-xs text-slate-500">Total del Pedido: </span>
                          <span className="text-base font-extrabold text-blue-700">${order.totalUSD.toFixed(2)}</span>
                          <span className="text-xs text-slate-400 font-mono ml-2">
                            ({order.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Historial siempre abre el formato de Orden de Compra (Pedido). La factura fiscal se consulta en Mis Facturas. */}
                          <button
                            onClick={() => handleOpenOrder(order.id)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>Ver Pedido</span>
                          </button>

                          {/* Reorder Button */}
                          <button
                            onClick={() => reorder(order.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Repetir Compra</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* TAB 4: MIS FACTURAS */}
        {customerPortalTab === 'facturas' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    Mis Facturas Fiscales
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Comprobantes oficiales de facturación con IVA desglosado y cálculo a tasa legal BCV. Puedes visualizarlas o descargarlas para tu contabilidad.
                  </p>
                </div>

                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    placeholder="Buscar factura o producto..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Invoices List */}
            {filteredInvoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">No se encontraron facturas registradas</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Al completar compras en línea o por despacho, tus facturas se guardarán automáticamente aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="font-mono font-black text-blue-700 text-sm">
                            {inv.invoiceNumber}
                          </span>
                          <p className="text-[11px] text-slate-500">
                            Fecha: {new Date(inv.createdAt).toLocaleDateString('es-VE')}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          {inv.isCredit ? `Crédito (${inv.creditDays}d)` : 'Contado'}
                        </span>
                      </div>

                      <div className="py-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-semibold">${inv.subtotalUSD.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IVA (16%):</span>
                          <span className="font-semibold">${inv.taxUSD.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-1 border-t border-slate-100">
                          <span>Total a Pagar:</span>
                          <span className="text-blue-700">${inv.totalUSD.toFixed(2)}</span>
                        </div>
                        <div className="text-right text-[11px] text-slate-500 font-mono">
                          {inv.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs (Tasa {inv.bcvRate.toFixed(2)})
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {inv.items.length} producto{inv.items.length !== 1 ? 's' : ''}
                      </span>

                      <button
                        onClick={() => {
                          setCustomerInvoiceModalMode('invoice');
                          setSelectedInvoiceForModal(inv);
                        }}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver & Descargar Factura</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MIS DEUDAS */}
        {customerPortalTab === 'deudas' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><WalletCards className="w-6 h-6 text-amber-600" />Mis Deudas</h2>
                  <p className="text-xs text-slate-500 mt-1">Consulta tus facturas pendientes, vencimientos y reporta tus pagos para validación.</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-right">
                  <div className="text-[10px] uppercase font-bold text-amber-700">Saldo pendiente</div>
                  <div className="font-mono font-black text-lg text-amber-800">${customerDebts.reduce((sum, d) => sum + d.balanceUSD, 0).toFixed(2)} USD</div>
                </div>
              </div>
            </div>
            {customerDebts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No tienes deudas pendientes</h3>
                <p className="text-xs text-slate-500 mt-1">Tus facturas de crédito aparecen aquí mientras tengan saldo pendiente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {customerDebts.map((debt) => {
                  const pendingReport = debt.paymentHistory?.find((p) => p.reportedByCustomer && p.verificationStatus === 'pendiente');
                  const overdue = new Date(debt.dueDate).getTime() < new Date(new Date().toDateString()).getTime();
                  return (
                    <div key={debt.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div><div className="font-mono font-black text-blue-700">{debt.invoiceNumber}</div><div className="text-[11px] text-slate-500">Emitida: {new Date(debt.issuedDate).toLocaleDateString('es-VE')}</div></div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          overdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>{overdue ? 'Vencida' : 'Pendiente'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 py-4">
                        <div className="bg-slate-50 rounded-xl p-3"><div className="text-[10px] uppercase font-bold text-slate-400">Vencimiento</div><div className="font-bold text-slate-800">{new Date(debt.dueDate).toLocaleDateString('es-VE')}</div></div>
                        <div className="bg-amber-50 rounded-xl p-3"><div className="text-[10px] uppercase font-bold text-amber-600">Saldo</div><div className="font-mono font-black text-amber-800">${debt.balanceUSD.toFixed(2)} USD</div></div>
                      </div>
                      {pendingReport && <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800"><strong>Pago reportado:</strong> ${pendingReport.amountUSD.toFixed(2)} USD · {formatPaymentMethod(pendingReport.paymentMethod)} · pendiente de validación.</div>}
                      <button onClick={() => openDebtPayment(debt.id)} disabled={!!pendingReport} className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-black text-sm rounded-xl shadow-xs transition cursor-pointer">{pendingReport ? 'Pago pendiente de validación' : 'PAGAR AHORA'}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: BALANCE DE CREDITOS/PAGOS */}
        {customerPortalTab === 'balance' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><CircleDollarSign className="w-6 h-6 text-emerald-600" />Balance de Creditos/Pagos</h2>
                  <p className="text-xs text-slate-500 mt-1">Ficha cronologica de compras a credito, compras online prepagadas y pagos de deudas aprobados.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3"><div className="text-[10px] uppercase font-bold text-slate-500">Credito utilizado</div><div className="font-mono font-black text-slate-900">${customerBalanceCreditUSD.toFixed(2)}</div></div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3"><div className="text-[10px] uppercase font-bold text-emerald-700">Pagos realizados</div><div className="font-mono font-black text-emerald-800">${customerBalancePaymentsUSD.toFixed(2)}</div></div>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3"><div className="text-[10px] uppercase font-bold text-amber-700">Saldo adeudado</div><div className="font-mono font-black text-amber-800">${customerBalanceCurrentDebtUSD.toFixed(2)}</div></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div><h3 className="font-black text-slate-900">Movimientos de Creditos, Compras y Pagos</h3><p className="text-[11px] text-slate-500">El saldo solo cambia con compras a credito y pagos de CxC aprobados.</p></div>
                <span className="text-[11px] font-bold text-slate-500">{customerBalanceMovements.length} movimiento(s)</span>
              </div>
              {customerBalanceMovements.length === 0 ? (
                <div className="p-10 text-center"><CircleDollarSign className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="font-bold text-slate-700">Aun no hay movimientos de credito o pagos.</p><p className="text-xs text-slate-500 mt-1">Los movimientos apareceran automaticamente cuando se registren operaciones financieras.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead className="bg-slate-50 border-b border-slate-200"><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3 font-black">Fecha</th><th className="px-4 py-3 font-black">Concepto</th><th className="px-4 py-3 font-black text-right">Credito (+)</th><th className="px-4 py-3 font-black text-right">Pagos (-)</th><th className="px-4 py-3 font-black text-right">Saldo</th><th className="px-4 py-3 font-black">Metodo / Estado</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerBalanceMovements.map((movement) => (
                        <tr key={movement.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">{new Date(movement.date).toLocaleString('es-VE')}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2">{movement.detailType === 'credito' ? <ArrowUpCircle className="w-4 h-4 text-amber-600 shrink-0" /> : <ArrowDownCircle className="w-4 h-4 text-emerald-600 shrink-0" />}<div><div className="text-xs font-bold text-slate-800">{movement.concept}</div>{movement.reference && <div className="text-[10px] text-slate-400 font-mono">{movement.reference}</div>}</div></div></td>
                          <td className="px-4 py-3 text-right font-mono font-black text-amber-700">{movement.creditUSD > 0 ? `+${movement.creditUSD.toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">{movement.paymentUSD > 0 ? `-${movement.paymentUSD.toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-3 text-right font-mono font-black text-slate-900">${movement.balanceUSD.toFixed(2)}</td>
                          <td className="px-4 py-3 text-xs"><div className="font-semibold text-slate-700">{movement.method || '—'}</div><div className="text-[10px] text-slate-400">{movement.status || 'Registrado'}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {customerPortalTab === 'credito' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                  Mi Línea de Crédito Comercial
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Facilidades crediticias otorgadas por Distribuidora La Gran Bodega M&S para mantener abastecido tu negocio.
                </p>
              </div>

              {/* Credit Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500">Límite Total Asignado</p>
                  <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    ${currentCustomer.creditLimitUSD.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Plazo acordado: {currentCustomer.creditDays} días continuos
                  </p>
                </div>

                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-800">Crédito Disponible para Compras</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                    ${creditAvailableUSD.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-1">
                    Puedes usarlo directamente al pagar en el checkout
                  </p>
                </div>

                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
                  <p className="text-xs font-semibold text-amber-800">Saldo Pendiente / Deuda</p>
                  <p className="text-2xl font-black text-amber-700 mt-1 font-mono">
                    ${currentCustomer.currentDebtUSD.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-amber-600 mt-1">
                    {creditUsagePercent}% del límite utilizado
                  </p>
                </div>

              </div>

              {/* Progress bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Uso de Crédito</span>
                  <span>{creditUsagePercent}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      creditUsagePercent > 80 ? 'bg-rose-500' : creditUsagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${creditUsagePercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-200 text-xs text-blue-900 space-y-2">
                <h4 className="font-bold flex items-center gap-1.5 text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Condiciones de Pago del Crédito Comercial:
                </h4>
                <p>
                  Los pagos de facturas a crédito pueden realizarse mediante Pago Móvil, Transferencia Bancaria en Bolívares a la tasa oficial del día de pago, o depósito en Divisas en nuestras cuentas bancarias. Para solicitar aumento de límite de crédito, contacta a tu asesor comercial.
                </p>
              </div>

            </div>
          </div>
        )}

      {selectedDebt && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-6">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div><h3 className="font-black text-slate-900 text-lg">Reportar pago</h3><p className="text-xs text-slate-500">{selectedDebt.invoiceNumber} · Saldo ${selectedDebt.balanceUSD.toFixed(2)} USD</p></div>
              <button onClick={closeDebtPayment} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-700">Método de pago
                  <select value={debtPaymentMixed ? 'mixto' : debtPaymentMethod} onChange={(e) => {
                    const value = e.target.value as import('../../types').PaymentMethod;
                    if (value === 'mixto') {
                      setDebtPaymentMixed(true);
                      setDebtPaymentSplitAmounts({});
                      setDebtPaymentSplitRefs({});
                    } else {
                      setDebtPaymentMixed(false);
                      setDebtPaymentMethod(value);
                      setDebtPaymentAmount(
                        ['pago_movil', 'transferencia_bs'].includes(value)
                          ? (selectedDebt ? selectedDebt.balanceUSD * settings.bcvRate : 0).toFixed(2)
                          : (selectedDebt ? selectedDebt.balanceUSD : 0).toFixed(2)
                      );
                    }
                  }} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white">
                    {onlinePaymentMethods.map((method) => <option key={method} value={method}>{formatPaymentMethod(method)}</option>)}
                    {onlinePaymentMethods.length >= 2 && <option value="mixto">Pago Mixto Online</option>}
                  </select>
                </label>
                {!debtPaymentMixed ? (
                  <label className="text-xs font-bold text-slate-700">{['pago_movil','transferencia_bs'].includes(debtPaymentMethod) ? 'Monto Bs.' : 'Monto USD'}
                    <input
                      type="number"
                      min="0.01"
                      max={['pago_movil','transferencia_bs'].includes(debtPaymentMethod) ? selectedDebt.balanceUSD * settings.bcvRate : selectedDebt.balanceUSD}
                      step="0.01"
                      value={debtPaymentAmount}
                      onChange={(e) => setDebtPaymentAmount(e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">
                      {['pago_movil','transferencia_bs'].includes(debtPaymentMethod)
                        ? `Equivalente: $${(Number(debtPaymentAmount || 0) / Number(settings.bcvRate || 1)).toFixed(2)} USD`
                        : `Equivalente: Bs. ${(Number(debtPaymentAmount || 0) * Number(settings.bcvRate || 1)).toFixed(2)}`}
                    </span>
                  </label>
                ) : (
                  <div className="text-xs text-slate-700">
                    <div className="font-bold">Pago Mixto Online</div>
                    <div className="text-[10px] text-slate-500 mt-1">Distribuye el saldo entre dos o tres métodos. Solo se permiten los métodos online disponibles.</div>
                  </div>
                )}
              </div>
              {debtPaymentMixed && (
                <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                  {onlinePaymentMethods.map((method) => (
                    <div key={method} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="text-xs font-bold text-slate-700">
                        {formatPaymentMethod(method)} · Monto USD
                        <input
                          type="number"
                          min="0"
                          max={selectedDebt.balanceUSD}
                          step="0.01"
                          value={debtPaymentSplitAmounts[method] || ''}
                          onChange={(e) => setDebtPaymentSplitAmounts((prev) => ({ ...prev, [method]: e.target.value }))}
                          className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white font-mono"
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-700">
                        Referencia
                        <input
                          value={debtPaymentSplitRefs[method] || ''}
                          onChange={(e) => setDebtPaymentSplitRefs((prev) => ({ ...prev, [method]: e.target.value }))}
                          placeholder="Referencia de la operación"
                          className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {['pago_movil','transferencia_bs','zelle'].includes(debtPaymentMethod) && !debtPaymentMixed && (
                <label className="block text-xs font-bold text-slate-700">Número de referencia
                  <input value={debtPaymentReference} onChange={(e) => setDebtPaymentReference(e.target.value)} placeholder="Referencia de la operación" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5" />
                </label>
              )}
              {debtPaymentMethod === 'transferencia_bs' && !debtPaymentMixed && (
                <label className="block text-xs font-bold text-slate-700"><span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Banco emisor</span>
                  <input value={debtPaymentSenderBank} onChange={(e) => setDebtPaymentSenderBank(e.target.value)} placeholder="Banco desde el cual se realizó la transferencia" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5" />
                </label>
              )}
              {debtPaymentMethod === 'zelle' && !debtPaymentMixed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-slate-700">Correo del remitente<input type="email" value={debtPaymentSenderEmail} onChange={(e) => setDebtPaymentSenderEmail(e.target.value)} placeholder="correo desde el que enviaste" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5" /></label>
                  <label className="text-xs font-bold text-slate-700">Titular del envío<input value={debtPaymentSenderName} onChange={(e) => setDebtPaymentSenderName(e.target.value)} placeholder="Nombre del titular" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5" /></label>
                </div>
              )}
              <label className="text-xs font-bold text-slate-700">Teléfono del remitente (opcional)<input value={debtPaymentSenderPhone} onChange={(e) => setDebtPaymentSenderPhone(e.target.value)} placeholder="Teléfono" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5" /></label>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <strong>¿Deseas pagar en efectivo?</strong> Informa a la administración para coordinar el retiro del dinero. El pago en efectivo no se reporta desde este portal: el administrador lo registrará posteriormente en CxC como <strong>Efectivo Bs.</strong> o <strong>Efectivo USD</strong>.
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800"><strong>Importante:</strong> reportar el pago no liquida automáticamente la deuda. La administración recibirá la notificación, revisará el pago en CxC y solo al aprobarlo se aplicará a la factura y se registrarán los procesos financieros correspondientes.</div>
              <div className="flex justify-end gap-2">
                <button onClick={closeDebtPayment} disabled={debtPaymentSubmitting} className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-sm">Cancelar</button>
                <button onClick={submitDebtPayment} disabled={debtPaymentSubmitting} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm">{debtPaymentSubmitting ? 'Enviando...' : 'Reportar pago'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <p className="font-semibold text-slate-700">DISTRIBUIDORA LA GRAN BODEGA M&S</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Portal de Clientes • RIF: {settings.companyRif}</p>
      </footer>

    </div>
  );
};