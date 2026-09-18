import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ReceivableItem, Customer, Invoice, PaymentMethod, ReceivablePaymentSplit } from '../../types';
import {
  HandCoins,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  UserCheck,
  CreditCard,
  X,
  Phone,
  Eye,
  FileText,
  History,
  Layers,
  Sparkles,
  Users,
  ChevronRight,
  ShieldAlert,
  Calendar,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { CustomerCreditDetailModal } from './CustomerCreditDetailModal';
import { InvoiceItemsDetailModal } from './InvoiceItemsDetailModal';

export const AccountsReceivableView: React.FC = () => {
  const {
    receivables,
    invoices,
    customers,
    settings,
    registerReceivablePayment,
    registerGlobalCustomerPayment,
    liquidateCustomerInvoice,
    liquidateCustomerTotalDebt,
    updateCustomerCredit,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('todos'); // 'todos' | 'pendiente' | 'parcial' | 'liquidado' | 'vencido' | 'por_vencer'
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('todos');
  const [customerFilter, setCustomerFilter] = useState<string>('todos'); // 'todos' | 'con_deuda' | 'en_mora' | 'con_credito'

  // Date range filters
  const [datePreset, setDatePreset] = useState<string>('todos');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateField, setDateField] = useState<'issuedDate' | 'dueDate'>('issuedDate');

  // Modal states
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<{
    invoice: Invoice | null;
    receivable: ReceivableItem | null;
  } | null>(null);
  
  const [selectedReceivableForPay, setSelectedReceivableForPay] = useState<ReceivableItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia_usd');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSplits, setPaymentSplits] = useState<ReceivablePaymentSplit[]>([]);

  const [editingCustomerCredit, setEditingCustomerCredit] = useState<Customer | null>(null);

  // Credit form
  const [creditFormData, setCreditFormData] = useState({
    hasCredit: true,
    creditDays: 15,
    creditLimitUSD: 2000,
  });

  // Handle Quick Date Range Presets
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'todos') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'hoy') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'ultimos_7') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(sevenDaysAgo);
      setEndDate(todayStr);
    } else if (preset === 'este_mes') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'ultimos_30') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(thirtyDaysAgo);
      setEndDate(todayStr);
    } else if (preset === 'este_ano') {
      const firstDayYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(firstDayYear);
      setEndDate(todayStr);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setPaymentStatusFilter('todos');
    setSelectedCustomerId('todos');
    setDatePreset('todos');
    setStartDate('');
    setEndDate('');
    setCustomerFilter('todos');
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    paymentStatusFilter !== 'todos' ||
    selectedCustomerId !== 'todos' ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    customerFilter !== 'todos';

  // Filtered receivables calculation
  const filteredReceivables = useMemo(() => {
    return receivables.filter((r) => {
      // Search term match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.customerName.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.customerPhone.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Customer match
      if (selectedCustomerId !== 'todos' && r.customerId !== selectedCustomerId) {
        return false;
      }

      // Payment Status filter match
      if (paymentStatusFilter === 'pendiente') {
        // Totalmente pendiente, sin abono registrado
        if (r.amountPaidUSD > 0 || r.balanceUSD <= 0.001) return false;
      } else if (paymentStatusFilter === 'parcial') {
        // Parcialmente pagado (abono registrado pero con saldo pendiente)
        if (r.amountPaidUSD <= 0 || r.balanceUSD <= 0.001) return false;
      } else if (paymentStatusFilter === 'liquidado') {
        // Totalmente pagado (saldo 0)
        if (r.balanceUSD > 0.001) return false;
      } else if (paymentStatusFilter === 'vencido') {
        if (r.status !== 'vencido' || r.balanceUSD <= 0.001) return false;
      } else if (paymentStatusFilter === 'por_vencer') {
        if (r.status !== 'por_vencer' || r.balanceUSD <= 0.001) return false;
      } else if (paymentStatusFilter === 'al_dia') {
        if (r.status !== 'al_dia' || r.balanceUSD <= 0.001) return false;
      }

      // Date Range match
      const targetDate = dateField === 'issuedDate' ? r.issuedDate : r.dueDate;
      if (startDate && targetDate < startDate) return false;
      if (endDate && targetDate > endDate) return false;

      return true;
    });
  }, [receivables, searchQuery, selectedCustomerId, paymentStatusFilter, startDate, endDate, dateField]);

  // Counts for filter pills
  const statusCounts = useMemo(() => {
    return {
      todos: receivables.length,
      pendiente: receivables.filter((r) => r.amountPaidUSD === 0 && r.balanceUSD > 0.001).length,
      parcial: receivables.filter((r) => r.amountPaidUSD > 0 && r.balanceUSD > 0.001).length,
      liquidado: receivables.filter((r) => r.balanceUSD <= 0.001).length,
      vencido: receivables.filter((r) => r.status === 'vencido' && r.balanceUSD > 0.001).length,
      por_vencer: receivables.filter((r) => r.status === 'por_vencer' && r.balanceUSD > 0.001).length,
    };
  }, [receivables]);

  // Filtered customers for cards
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cust.name.toLowerCase().includes(q) ||
        cust.rif.toLowerCase().includes(q) ||
        cust.phone.toLowerCase().includes(q);
      
      if (!matchesSearch) return false;

      if (selectedCustomerId !== 'todos' && cust.id !== selectedCustomerId) {
        return false;
      }

      const custPendingRecs = receivables.filter((r) => r.customerId === cust.id && r.balanceUSD > 0.001);
      const hasDebt = custPendingRecs.length > 0;
      const hasOverdue = custPendingRecs.some((r) => r.status === 'vencido');

      if (customerFilter === 'con_deuda') return hasDebt;
      if (customerFilter === 'en_mora') return hasOverdue;
      if (customerFilter === 'con_credito') return cust.hasCredit;
      return true;
    });
  }, [customers, receivables, searchQuery, selectedCustomerId, customerFilter]);

  // Financial KPIs
  const totalReceivableUSD = receivables.reduce((sum, r) => sum + r.balanceUSD, 0);
  const overdueUSD = receivables.filter((r) => r.status === 'vencido').reduce((sum, r) => sum + r.balanceUSD, 0);
  const totalPaidUSD = receivables.reduce((sum, r) => sum + r.amountPaidUSD, 0);

  // Filtered sum
  const filteredBalanceUSD = filteredReceivables.reduce((sum, r) => sum + r.balanceUSD, 0);
  const filteredPaidUSD = filteredReceivables.reduce((sum, r) => sum + r.amountPaidUSD, 0);

  const handleOpenPayment = (rec: ReceivableItem) => {
    setSelectedReceivableForPay(rec);
    setPaymentAmount(rec.balanceUSD);
    setPaymentReference('');
    setPaymentNotes('');
    const rate = settings.bcvRate;
    setPaymentSplits([{
      id: 'cxc-ui-' + Date.now(),
      method: 'transferencia_usd',
      amountUSD: rec.balanceUSD,
      amountBs: Number((rec.balanceUSD * rate).toFixed(2)),
      currency: 'USD',
      reference: '',
      createdAt: new Date().toISOString(),
    }]);
  };

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivableForPay || paymentAmount <= 0) return;
    const rate = settings.bcvRate;
    const normalized = paymentSplits.reduce((sum, s) => sum + (s.currency === 'USD' ? Number(s.amountUSD || 0) : Number(s.amountBs || 0) / rate), 0);
    if (normalized <= 0 || normalized > selectedReceivableForPay.balanceUSD + 0.0001) {
      alert('Los métodos y montos del cobro no cuadran con el saldo pendiente.');
      return;
    }
    registerReceivablePayment(selectedReceivableForPay.id, normalized, {
      paymentMethod: paymentSplits.length > 1 ? 'mixto' : paymentSplits[0]?.method || paymentMethod,
      paymentSplits,
      reference: paymentReference,
      notes: paymentNotes,
      bcvRate: rate,
    });
    setSelectedReceivableForPay(null);
  };

  const handleOpenCreditConfig = (cust: Customer) => {
    setEditingCustomerCredit(cust);
    setCreditFormData({
      hasCredit: cust.hasCredit,
      creditDays: cust.creditDays || settings.defaultCreditDays,
      creditLimitUSD: cust.creditLimitUSD || settings.defaultCreditLimitUSD,
    });
  };

  const handleSaveCreditConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomerCredit) return;
    updateCustomerCredit(
      editingCustomerCredit.id,
      creditFormData.hasCredit,
      creditFormData.creditDays,
      creditFormData.creditLimitUSD
    );
    setEditingCustomerCredit(null);
  };

  const handleExportCSV = () => {
    const rows = [
      ['REPORTE DE CUENTAS POR COBRAR (CxC) - FILTROS APLICADOS'],
      ['Fecha Generación', new Date().toLocaleString('es-VE')],
      ['Tasa BCV', `${formatPlainNumber(settings.bcvRate, 2)} Bs/USD`],
      ['Filtro Estado Pago', paymentStatusFilter.toUpperCase()],
      ['Rango de Fechas', startDate || endDate ? `${startDate || 'Inicio'} hasta ${endDate || 'Fin'}` : 'Todas'],
      [],
      ['N° Factura', 'Cliente', 'Teléfono', 'Fecha Emisión', 'Fecha Vencimiento', 'Días Crédito', 'Monto Total USD', 'Abonado USD', 'Saldo Pendiente USD', 'Saldo Pendiente Bs', 'Estado'],
      ...filteredReceivables.map((r) => [
        r.invoiceNumber,
        r.customerName,
        r.customerPhone,
        r.issuedDate,
        r.dueDate,
        r.creditDays,
        formatPlainNumber(r.totalAmountUSD, 6),
        formatPlainNumber(r.amountPaidUSD, 6),
        formatPlainNumber(r.balanceUSD, 6),
        formatPlainNumber(r.balanceUSD * settings.bcvRate, 6),
        r.status.toUpperCase(),
      ]),
    ];
    exportToCSV(`Cuentas_Por_Cobrar_${new Date().toISOString().split('T')[0]}`, rows);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-indigo-600" />
            Cuentas por Cobrar (CxC) & Gestión Individual de Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tarjetas personales por cliente con historial de compras, facturas detalladas, liquidación 100% y abono global distribuido (FIFO).
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-2xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          Exportar Cartera a Excel
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Cartera por Cobrar
          </span>
          <p className="text-2xl font-extrabold text-blue-700 mt-1 font-mono">
            {formatUSD(totalReceivableUSD)} USD
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            ≈ {formatBs(totalReceivableUSD * settings.bcvRate)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
            Saldo Vencido (Mora)
          </span>
          <p className="text-2xl font-extrabold text-rose-600 mt-1 font-mono">
            {formatUSD(overdueUSD)} USD
          </p>
          <p className="text-[10px] text-rose-700 mt-0.5">
            Requiere gestión de cobranza inmediata
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Cobros Recaudados (Abonos)
          </span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
            {formatUSD(totalPaidUSD)} USD
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            Ingresos liquidados a caja
          </p>
        </div>
      </div>

      {/* SEARCH AND ADVANCED FILTERS BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">
              Búsqueda & Filtros de Movimientos Financieros
            </h3>
            {hasActiveFilters && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                Filtros Activos
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar Filtros
            </button>
          )}
        </div>

        {/* Row 1: Universal Search & Customer Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, RIF, teléfono, N° factura..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Customer Dropdown */}
          <div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="todos">Todos los Clientes ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.rif})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Date Range Preset */}
          <div>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="todos">Cualquier Fecha</option>
              <option value="hoy">Hoy</option>
              <option value="ultimos_7">Últimos 7 días</option>
              <option value="este_mes">Este Mes</option>
              <option value="ultimos_30">Últimos 30 días</option>
              <option value="este_ano">Este Año</option>
            </select>
          </div>
        </div>

        {/* Row 2: Date Inputs & Date Field Selection */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Filtrar por:</span>
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as 'issuedDate' | 'dueDate')}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="issuedDate">Fecha Emisión</option>
              <option value="dueDate">Fecha Vencimiento</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500">Desde:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500">Hasta:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setDatePreset('todos');
              }}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline cursor-pointer"
            >
              Limpiar Fechas
            </button>
          )}
        </div>

        {/* Row 3: Payment Status Filter Tabs / Chips */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            Estado de Pago de Facturas:
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'todos', label: 'Todos', count: statusCounts.todos, color: 'indigo' },
              { id: 'pendiente', label: 'Pendiente (Sin Abono)', count: statusCounts.pendiente, color: 'amber' },
              { id: 'parcial', label: 'Parcialmente Pagado', count: statusCounts.parcial, color: 'sky' },
              { id: 'liquidado', label: 'Liquidado / Pagado', count: statusCounts.liquidado, color: 'emerald' },
              { id: 'por_vencer', label: 'Por Vencer', count: statusCounts.por_vencer, color: 'blue' },
              { id: 'vencido', label: 'Vencido (Mora)', count: statusCounts.vencido, color: 'rose' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setPaymentStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  paymentStatusFilter === st.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    paymentStatusFilter === st.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {st.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtered Results Summary Bar */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600">
              Mostrando <strong>{filteredReceivables.length}</strong> de {receivables.length} facturas
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">
              <strong>{filteredCustomers.length}</strong> de {customers.length} clientes
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 font-sans">Saldo Filtrado: </span>
              <strong className="text-blue-700 font-bold">{formatUSD(filteredBalanceUSD)}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-sans">Abonado Filtrado: </span>
              <strong className="text-emerald-700 font-bold">{formatUSD(filteredPaidUSD)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Tarjetas Personales de Clientes */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Tarjetas de Clientes & Líneas de Crédito
            </h3>
            <p className="text-[11px] text-slate-500">
              Pulsa en <strong>DETALLES</strong> en cualquiera de los clientes para consultar su estado de cuenta, ver los ítems de cada factura, abonar o liquidar deudas de forma individual o global (FIFO).
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'con_deuda', label: 'Con Deuda' },
              { id: 'en_mora', label: 'En Mora' },
              { id: 'con_credito', label: 'Línea Activa' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setCustomerFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                  customerFilter === f.id
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Client Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust) => {
            const custPendingRecs = receivables.filter((r) => r.customerId === cust.id && r.balanceUSD > 0.001);
            const custAllRecs = receivables.filter((r) => r.customerId === cust.id);
            const totalCustDebt = custPendingRecs.reduce((sum, r) => sum + r.balanceUSD, 0);
            const overdueCustRecs = custPendingRecs.filter((r) => r.status === 'vencido');
            const hasOverdue = overdueCustRecs.length > 0;

            return (
              <div
                key={cust.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                  hasOverdue
                    ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                    : totalCustDebt > 0
                    ? 'bg-slate-50/70 border-slate-200 hover:border-indigo-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Customer Info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-slate-900 text-sm block leading-tight">
                        {cust.name}
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono">RIF: {cust.rif}</p>
                      {cust.phone && <p className="text-[10px] text-slate-500 font-mono">Telf: {cust.phone}</p>}
                    </div>

                    <div className="shrink-0 text-right space-y-1">
                      {cust.hasCredit ? (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {cust.creditDays || 15} DÍAS
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          CONTADO
                        </span>
                      )}

                      {hasOverdue && (
                        <div>
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300">
                            {overdueCustRecs.length} en Mora
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Deuda Actual (CxC):</span>
                      <strong className={`font-mono font-bold ${totalCustDebt > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                        {formatUSD(totalCustDebt)}
                      </strong>
                    </div>

                    {totalCustDebt > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Contravalor Bs:</span>
                        <span className="text-slate-600 font-semibold">{formatBs(totalCustDebt * settings.bcvRate)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-500">Límite Aprobado:</span>
                      <strong className="font-mono text-slate-700">{formatUSD(cust.creditLimitUSD || 0)}</strong>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Facturas registradas:</span>
                      <span className="font-semibold text-slate-700">
                        {custPendingRecs.length} pendientes • {custAllRecs.length} total
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-2 border-t border-slate-200/70 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerForDetail(cust)}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    DETALLES
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenCreditConfig(cust)}
                    className="py-2 px-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs transition cursor-pointer"
                    title="Ajustar días de crédito y límite"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: General Receivables Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Listado Detallado de Facturas por Cobrar
            </h3>
            <p className="text-[11px] text-slate-500">
              Movimientos financieros filtrados con acceso al detalle de productos y registro de pagos.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'pendiente', label: 'Pendiente' },
              { id: 'parcial', label: 'Parcial' },
              { id: 'liquidado', label: 'Liquidado' },
              { id: 'vencido', label: 'Vencido' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setPaymentStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  paymentStatusFilter === st.id
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Factura</th>
                <th className="py-3 px-4">Cliente / Contacto</th>
                <th className="py-3 px-4">Emisión</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-center">Plazo</th>
                <th className="py-3 px-4 text-right">Monto Total</th>
                <th className="py-3 px-4 text-right">Abonado</th>
                <th className="py-3 px-4 text-right">Saldo USD</th>
                <th className="py-3 px-4 text-right">Saldo Bs (BCV)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No hay registros de cuentas por cobrar con estos filtros.
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((rec) => {
                  const balanceBs = rec.balanceUSD * settings.bcvRate;
                  const matchingCustomer = customers.find((c) => c.id === rec.customerId);
                  const matchingInvoice = invoices.find(
                    (inv) => inv.id === rec.invoiceId || inv.invoiceNumber === rec.invoiceNumber
                  ) || null;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                      {/* Factura */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceForDetail({ invoice: matchingInvoice, receivable: rec })}
                          className="font-mono font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                          title="Clic para ver detalle de productos"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {rec.invoiceNumber}
                        </button>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => matchingCustomer && setSelectedCustomerForDetail(matchingCustomer)}
                          className="font-semibold text-slate-800 hover:text-indigo-700 text-left hover:underline cursor-pointer block"
                        >
                          {rec.customerName}
                        </button>
                        <p className="text-[10px] text-slate-500 font-mono">{rec.customerPhone}</p>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-mono">{rec.issuedDate}</td>
                      <td className="py-3 px-4 text-slate-800 font-mono font-semibold">{rec.dueDate}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{rec.creditDays}d</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{formatUSD(rec.totalAmountUSD)}</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">{formatUSD(rec.amountPaidUSD)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatUSD(rec.balanceUSD)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatBs(balanceBs)}
                      </td>
                      
                      {/* Estado */}
                      <td className="py-3 px-4 text-center">
                        {rec.status === 'al_dia' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            Al Día
                          </span>
                        )}
                        {rec.status === 'por_vencer' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Por Vencer
                          </span>
                        )}
                        {rec.status === 'vencido' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Vencido
                          </span>
                        )}
                        {rec.status === 'pagado' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Liquidado
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceForDetail({ invoice: matchingInvoice, receivable: rec })}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="Ver productos de esta factura"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {rec.balanceUSD > 0.01 ? (
                            <button
                              onClick={() => handleOpenPayment(rec)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] transition cursor-pointer shadow-2xs"
                            >
                              Cobrar
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Listo
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Individual Customer Credit Details & Full Statement */}
      {selectedCustomerForDetail && (
        <CustomerCreditDetailModal
          customer={selectedCustomerForDetail}
          receivables={receivables}
          invoices={invoices}
          bcvRate={settings.bcvRate}
          onClose={() => setSelectedCustomerForDetail(null)}
          onRegisterReceivablePayment={registerReceivablePayment}
          onRegisterGlobalCustomerPayment={registerGlobalCustomerPayment}
          onLiquidateCustomerInvoice={liquidateCustomerInvoice}
          onLiquidateCustomerTotalDebt={liquidateCustomerTotalDebt}
          onOpenCreditConfig={(cust) => {
            setSelectedCustomerForDetail(null);
            handleOpenCreditConfig(cust);
          }}
          onInspectInvoice={(inv, rec) => {
            setSelectedInvoiceForDetail({ invoice: inv, receivable: rec });
          }}
        />
      )}

      {/* Modal 2: Invoice Items & Line Items Breakdown */}
      {selectedInvoiceForDetail && (
        <InvoiceItemsDetailModal
          invoice={selectedInvoiceForDetail.invoice}
          receivable={selectedInvoiceForDetail.receivable}
          bcvRate={settings.bcvRate}
          onClose={() => setSelectedInvoiceForDetail(null)}
          onPayOrLiquidate={(rec) => {
            handleOpenPayment(rec);
          }}
        />
      )}

      {/* Modal 3: Quick Payment / Cobro a Factura */}
      {selectedReceivableForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-sm">
                Registrar Cobro / Abono a Cuenta
              </h3>
              <button onClick={() => setSelectedReceivableForPay(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-1 text-blue-900">
                <p>Factura: <strong>{selectedReceivableForPay.invoiceNumber}</strong></p>
                <p>Cliente: <strong>{selectedReceivableForPay.customerName}</strong></p>
                <p>Saldo Pendiente Actual: <strong className="font-mono text-sm">{formatUSD(selectedReceivableForPay.balanceUSD)} USD</strong></p>
                <p className="text-[11px] text-blue-700 font-mono">
                  ≈ {formatBs(selectedReceivableForPay.balanceUSD * settings.bcvRate)} (Tasa: {settings.bcvRate.toFixed(2)} Bs/USD)
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto a Cobrar (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedReceivableForPay.balanceUSD}
                  min="0.01"
                  required
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-base focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700">Distribución del cobro por método / moneda</label>
                  <button type="button" onClick={() => setPaymentSplits(prev => [...prev, {
                    id: 'cxc-ui-' + Date.now(),
                    method: 'efectivo_usd',
                    amountUSD: 0,
                    amountBs: 0,
                    currency: 'USD',
                  }])} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold">+ Agregar método</button>
                </div>
                {paymentSplits.map((split, idx) => (
                  <div key={split.id} className="grid grid-cols-12 gap-1.5 items-end">
                    <select value={split.method} onChange={e => {
                      const method = e.target.value as Exclude<PaymentMethod,'mixto'>;
                      const currency = ['efectivo_bs','transferencia_bs','pago_movil','biopago','tarjeta'].includes(method) ? 'Bs' : 'USD';
                      setPaymentSplits(prev => prev.map((s,i) => i===idx ? {...s, method, currency} : s));
                    }} className="col-span-5 px-2 py-1.5 border rounded-lg text-[10px] bg-white">
                      <option value="efectivo_usd">Efectivo USD (físico)</option>
                      <option value="efectivo_bs">Efectivo Bs. (físico)</option>
                      <option value="zelle">Zelle</option>
                      <option value="transferencia_usd">Transferencia USD</option>
                      <option value="transferencia_bs">Transferencia Bs.</option>
                      <option value="pago_movil">Pago Móvil</option>
                      <option value="biopago">Biopago</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                    <select value={split.currency} onChange={e => setPaymentSplits(prev => prev.map((s,i)=>i===idx?{...s,currency:e.target.value as 'Bs'|'USD'}:s))} className="col-span-2 px-1 py-1.5 border rounded-lg text-[10px] bg-white">
                      <option value="USD">USD</option><option value="Bs">Bs.</option>
                    </select>
                    <input type="number" min="0" step="0.01" value={split.currency==='USD' ? split.amountUSD || '' : split.amountBs || ''} onChange={e => {
                      const amount = Number(e.target.value) || 0;
                      setPaymentSplits(prev => prev.map((s,i)=>i===idx ? (s.currency==='USD' ? {...s, amountUSD: amount, amountBs: Number((amount * settings.bcvRate).toFixed(2))} : {...s, amountBs: amount, amountUSD: Number((amount / settings.bcvRate).toFixed(6))}) : s));
                    }} className="col-span-3 px-2 py-1.5 border rounded-lg text-[10px] font-mono font-bold" />
                    <button type="button" disabled={paymentSplits.length===1} onClick={()=>setPaymentSplits(prev=>prev.filter((_,i)=>i!==idx))} className="col-span-2 px-2 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-[10px] font-bold disabled:opacity-30">Quitar</button>
                  </div>
                ))}
                <div className="flex justify-between text-[10px] font-bold pt-1 border-t">
                  <span>Total normalizado</span>
                  <span>{formatUSD(paymentSplits.reduce((sum,s)=>sum+(s.currency==='USD'?s.amountUSD:s.amountBs/settings.bcvRate),0))} USD</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Método principal</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="transferencia_usd">Zelle / Transf. USD</option>
                    <option value="divisas_efectivo">Efectivo USD</option>
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="transferencia_bs">Transferencia Bs</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Referencia</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Ej: REF-99201"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notas / Observaciones</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Observaciones de cobranza..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReceivableForPay(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Confirmar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Edit Customer Credit Days & Limit */}
      {editingCustomerCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-sm">
                Editar Crédito: {editingCustomerCredit.name}
              </h3>
              <button onClick={() => setEditingCustomerCredit(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreditConfig} className="p-6 space-y-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={creditFormData.hasCredit}
                  onChange={(e) => setCreditFormData({ ...creditFormData, hasCredit: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-bold text-slate-800">Habilitar Ventas a Crédito para este Cliente</span>
              </label>

              {creditFormData.hasCredit && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Días de Crédito Asignados (Plazo) *
                    </label>
                    <select
                      value={creditFormData.creditDays}
                      onChange={(e) => setCreditFormData({ ...creditFormData, creditDays: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                    >
                      <option value={7}>7 Días (Semanal)</option>
                      <option value={15}>15 Días (Quincenal)</option>
                      <option value={21}>21 Días (3 Semanas)</option>
                      <option value={30}>30 Días (Mensual)</option>
                      <option value={45}>45 Días</option>
                      <option value={60}>60 Días</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Límite Máximo de Crédito (USD) *
                    </label>
                    <input
                      type="number"
                      min="100"
                      step="50"
                      required
                      value={creditFormData.creditLimitUSD}
                      onChange={(e) => setCreditFormData({ ...creditFormData, creditLimitUSD: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomerCredit(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                >
                  Guardar Condiciones
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
