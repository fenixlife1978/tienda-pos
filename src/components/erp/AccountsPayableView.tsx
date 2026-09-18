import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PayableItem, Supplier, PaymentMethod, PayablePaymentSplit } from '../../types';
import {
  Receipt,
  Search,
  Download,
  Plus,
  Building2,
  CheckCircle2,
  X,
  CreditCard,
  DollarSign,
  AlertCircle,
  Clock,
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
  Building,
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { SupplierCreditDetailModal } from './SupplierCreditDetailModal';
import { PayableItemsDetailModal } from './PayableItemsDetailModal';

export const AccountsPayableView: React.FC = () => {
  const {
    payables,
    suppliers,
    settings,
    registerPayablePayment,
    registerGlobalSupplierPayment,
    liquidateSupplierInvoice,
    liquidateSupplierTotalDebt,
    updateSupplierCredit,
    addSupplier,
  } = useApp();

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('todos'); // 'todos' | 'pendiente' | 'parcial' | 'liquidado' | 'vencido' | 'por_vencer'
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('todos');
  const [supplierFilter, setSupplierFilter] = useState<string>('todos'); // 'todos' | 'con_deuda' | 'en_mora' | 'con_credito'

  // Date range filters
  const [datePreset, setDatePreset] = useState<string>('todos');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateField, setDateField] = useState<'issuedDate' | 'dueDate'>('issuedDate');

  // Modals state
  const [selectedSupplierForDetail, setSelectedSupplierForDetail] = useState<Supplier | null>(null);
  const [selectedPayableForDetail, setSelectedPayableForDetail] = useState<PayableItem | null>(null);
  const [selectedPayableForPay, setSelectedPayableForPay] = useState<PayableItem | null>(null);

  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia_usd');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSplits, setPaymentSplits] = useState<PayablePaymentSplit[]>([]);

  // Supplier Add Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    rif: '',
    phone: '',
    email: '',
    contactName: '',
    address: '',
    creditDays: 30,
    creditLimitUSD: 5000,
  });

  // Supplier Credit Edit Modal
  const [editingSupplierCredit, setEditingSupplierCredit] = useState<Supplier | null>(null);
  const [creditFormData, setCreditFormData] = useState({
    creditDays: 30,
    creditLimitUSD: 5000,
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
    setSelectedSupplierId('todos');
    setDatePreset('todos');
    setStartDate('');
    setEndDate('');
    setSupplierFilter('todos');
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    paymentStatusFilter !== 'todos' ||
    selectedSupplierId !== 'todos' ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    supplierFilter !== 'todos';

  // Filtered payables calculation
  const filteredPayables = useMemo(() => {
    return payables.filter((p) => {
      // Search match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.supplierName.toLowerCase().includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.items?.some((it) => it.productName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Supplier filter
      if (selectedSupplierId !== 'todos' && p.supplierId !== selectedSupplierId) {
        return false;
      }

      // Payment Status filter match
      if (paymentStatusFilter === 'pendiente') {
        if (p.amountPaidUSD > 0 || p.balanceUSD <= 0.001) return false;
      } else if (paymentStatusFilter === 'parcial') {
        if (p.amountPaidUSD <= 0 || p.balanceUSD <= 0.001) return false;
      } else if (paymentStatusFilter === 'liquidado') {
        if (p.balanceUSD > 0.001) return false;
      } else if (paymentStatusFilter === 'vencido') {
        if (p.status !== 'vencido' || p.balanceUSD <= 0.001) return false;
      } else if (paymentStatusFilter === 'por_vencer') {
        if (p.status !== 'por_vencer' || p.balanceUSD <= 0.001) return false;
      } else if (paymentStatusFilter === 'al_dia') {
        if (p.status !== 'al_dia' || p.balanceUSD <= 0.001) return false;
      }

      // Date Range match
      const targetDate = dateField === 'issuedDate' ? p.issuedDate : p.dueDate;
      if (startDate && targetDate < startDate) return false;
      if (endDate && targetDate > endDate) return false;

      return true;
    });
  }, [payables, searchQuery, selectedSupplierId, paymentStatusFilter, startDate, endDate, dateField]);

  // Counts for filter pills
  const statusCounts = useMemo(() => {
    return {
      todos: payables.length,
      pendiente: payables.filter((p) => p.amountPaidUSD === 0 && p.balanceUSD > 0.001).length,
      parcial: payables.filter((p) => p.amountPaidUSD > 0 && p.balanceUSD > 0.001).length,
      liquidado: payables.filter((p) => p.balanceUSD <= 0.001).length,
      vencido: payables.filter((p) => p.status === 'vencido' && p.balanceUSD > 0.001).length,
      por_vencer: payables.filter((p) => p.status === 'por_vencer' && p.balanceUSD > 0.001).length,
    };
  }, [payables]);

  // Filtered suppliers for cards
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sup.name.toLowerCase().includes(q) ||
        sup.rif.toLowerCase().includes(q) ||
        (sup.phone && sup.phone.toLowerCase().includes(q)) ||
        (sup.contactName && sup.contactName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedSupplierId !== 'todos' && sup.id !== selectedSupplierId) {
        return false;
      }

      const supPendingPays = payables.filter((p) => p.supplierId === sup.id && p.balanceUSD > 0.001);
      const hasDebt = supPendingPays.length > 0;
      const hasOverdue = supPendingPays.some((p) => p.status === 'vencido');

      if (supplierFilter === 'con_deuda') return hasDebt;
      if (supplierFilter === 'en_mora') return hasOverdue;
      if (supplierFilter === 'con_credito') return (sup.creditDays || 0) > 0;
      return true;
    });
  }, [suppliers, payables, searchQuery, selectedSupplierId, supplierFilter]);

  // Financial KPIs
  const totalPayableUSD = payables.reduce((sum, p) => sum + p.balanceUSD, 0);
  const overdueUSD = payables.filter((p) => p.status === 'vencido').reduce((sum, p) => sum + p.balanceUSD, 0);
  const totalPaidUSD = payables.reduce((sum, p) => sum + p.amountPaidUSD, 0);

  // Filtered sums
  const filteredBalanceUSD = filteredPayables.reduce((sum, p) => sum + p.balanceUSD, 0);
  const filteredPaidUSD = filteredPayables.reduce((sum, p) => sum + p.amountPaidUSD, 0);

  const handleOpenPayment = (pay: PayableItem) => {
    setSelectedPayableForPay(pay);
    setPaymentAmount(pay.balanceUSD);
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentMethod('transferencia_usd');
    setPaymentSplits([{
      id: crypto.randomUUID(),
      method: 'transferencia_usd',
      currency: 'USD',
      amountUSD: pay.balanceUSD,
      amountBs: pay.balanceUSD * settings.bcvRate,
      reference: '',
      createdAt: new Date().toISOString(),
    }]);
  };

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayableForPay || paymentAmount <= 0) return;
    const normalizedTotal = paymentSplits.reduce(
      (sum, split) => sum + (split.currency === 'Bs' ? split.amountBs / settings.bcvRate : split.amountUSD),
      0
    );
    if (paymentSplits.length > 0 && Math.abs(normalizedTotal - paymentAmount) > 0.02) {
      return;
    }
    registerPayablePayment(selectedPayableForPay.id, paymentAmount, {
      paymentMethod,
      paymentSplits,
      reference: paymentReference,
      notes: paymentNotes,
      bcvRate: settings.bcvRate,
    });
    setSelectedPayableForPay(null);
  };

  const handleOpenCreditConfig = (sup: Supplier) => {
    setEditingSupplierCredit(sup);
    setCreditFormData({
      creditDays: sup.creditDays || 30,
      creditLimitUSD: sup.creditLimitUSD || 5000,
    });
  };

  const handleSaveCreditConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplierCredit) return;
    updateSupplierCredit(
      editingSupplierCredit.id,
      creditFormData.creditDays,
      creditFormData.creditLimitUSD
    );
    setEditingSupplierCredit(null);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    addSupplier(newSupplier);
    setIsSupplierModalOpen(false);
    setNewSupplier({
      name: '',
      rif: '',
      phone: '',
      email: '',
      contactName: '',
      address: '',
      creditDays: 30,
      creditLimitUSD: 5000,
    });
  };

  const handleExportCSV = () => {
    const rows = [
      ['REPORTE DE CUENTAS POR PAGAR (CxP) - FILTROS APLICADOS'],
      ['Fecha Generación', new Date().toLocaleString('es-VE')],
      ['Tasa BCV', `${formatPlainNumber(settings.bcvRate, 2)} Bs/USD`],
      ['Filtro Estado Pago', paymentStatusFilter.toUpperCase()],
      ['Rango de Fechas', startDate || endDate ? `${startDate || 'Inicio'} hasta ${endDate || 'Fin'}` : 'Todas'],
      [],
      ['N° Factura Compra', 'Proveedor', 'Concepto / Ítems', 'Fecha Emisión', 'Fecha Vencimiento', 'Plazo Días', 'Total USD', 'Abonado USD', 'Saldo Pendiente USD', 'Saldo Pendiente Bs', 'Estado'],
      ...filteredPayables.map((p) => [
        p.invoiceNumber,
        p.supplierName,
        p.description || (p.items?.map((it) => it.productName).join(', ') || 'Compra de inventario'),
        p.issuedDate,
        p.dueDate,
        p.creditDays,
        formatPlainNumber(p.totalAmountUSD, 6),
        formatPlainNumber(p.amountPaidUSD, 6),
        formatPlainNumber(p.balanceUSD, 6),
        formatPlainNumber(p.balanceUSD * settings.bcvRate, 6),
        p.status.toUpperCase(),
      ]),
    ];
    exportToCSV(`Cuentas_Por_Pagar_${new Date().toISOString().split('T')[0]}`, rows);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-purple-600" />
            Cuentas por Pagar (CxP) & Gestión de Proveedores
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tarjetas de proveedores con historial de compras, facturas detalladas con renglones, liquidación 100% y abonos globales en cascada (FIFO).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Exportar a Excel
          </button>

          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Deuda por Pagar (CxP)
          </span>
          <p className="text-2xl font-extrabold text-purple-700 mt-1 font-mono">
            {formatUSD(totalPayableUSD)} USD
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            ≈ {formatBs(totalPayableUSD * settings.bcvRate)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
            Compras Vencidas en Mora
          </span>
          <p className="text-2xl font-extrabold text-rose-600 mt-1 font-mono">
            {formatUSD(overdueUSD)} USD
          </p>
          <p className="text-[10px] text-rose-700 mt-0.5">
            Prioridad de pago a proveedores
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Total Pagado / Egresado
          </span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
            {formatUSD(totalPaidUSD)} USD
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            Egresos computados en compras
          </p>
        </div>
      </div>

      {/* SEARCH AND ADVANCED FILTERS BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">
              Búsqueda & Filtros de Movimientos Financieros (CxP)
            </h3>
            {hasActiveFilters && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
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

        {/* Row 1: Universal Search & Supplier Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por proveedor, RIF, factura, producto..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
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

          {/* Supplier Dropdown */}
          <div>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="todos">Todos los Proveedores ({suppliers.length})</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.rif})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Date Range Preset */}
          <div>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
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

        {/* Row 3: Payment Status Filter Tabs */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            Estado de Pago de Facturas de Compra:
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'todos', label: 'Todos', count: statusCounts.todos },
              { id: 'pendiente', label: 'Pendiente (Sin Abono)', count: statusCounts.pendiente },
              { id: 'parcial', label: 'Parcialmente Pagado', count: statusCounts.parcial },
              { id: 'liquidado', label: 'Liquidado / Pagado', count: statusCounts.liquidado },
              { id: 'por_vencer', label: 'Por Vencer', count: statusCounts.por_vencer },
              { id: 'vencido', label: 'Vencido (Mora)', count: statusCounts.vencido },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setPaymentStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  paymentStatusFilter === st.id
                    ? 'bg-purple-700 text-white shadow-xs'
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
              Mostrando <strong>{filteredPayables.length}</strong> de {payables.length} compras
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">
              <strong>{filteredSuppliers.length}</strong> de {suppliers.length} proveedores
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 font-sans">Saldo CxP Filtrado: </span>
              <strong className="text-purple-700 font-bold">{formatUSD(filteredBalanceUSD)}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-sans">Pagado Filtrado: </span>
              <strong className="text-emerald-700 font-bold">{formatUSD(filteredPaidUSD)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Tarjetas Personales de Proveedores */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-600" />
              Tarjetas de Proveedores & Condiciones Comerciales
            </h3>
            <p className="text-[11px] text-slate-500">
              Pulsa en <strong>DETALLES</strong> en cualquiera de los proveedores para consultar su estado de cuenta, ver los ítems de cada compra, abonar o liquidar facturas de forma individual o global (FIFO).
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'con_deuda', label: 'Con Saldo CxP' },
              { id: 'en_mora', label: 'En Mora' },
              { id: 'con_credito', label: 'A Crédito' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSupplierFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                  supplierFilter === f.id
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Supplier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((sup) => {
            const supPendingPays = payables.filter((p) => p.supplierId === sup.id && p.balanceUSD > 0.001);
            const supAllPays = payables.filter((p) => p.supplierId === sup.id);
            const totalSupDebt = supPendingPays.reduce((sum, p) => sum + p.balanceUSD, 0);
            const overdueSupPays = supPendingPays.filter((p) => p.status === 'vencido');
            const hasOverdue = overdueSupPays.length > 0;

            return (
              <div
                key={sup.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                  hasOverdue
                    ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                    : totalSupDebt > 0
                    ? 'bg-purple-50/30 border-purple-200 hover:border-purple-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Supplier Info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-slate-900 text-sm block leading-tight">
                        {sup.name}
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono">RIF: {sup.rif}</p>
                      {sup.phone && (
                        <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {sup.phone}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right space-y-1">
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                        {sup.creditDays || 30} DÍAS
                      </span>

                      {hasOverdue && (
                        <div>
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300">
                            {overdueSupPays.length} en Mora
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Deuda Actual (CxP):</span>
                      <strong className={`font-mono font-bold ${totalSupDebt > 0 ? 'text-purple-700' : 'text-emerald-700'}`}>
                        {formatUSD(totalSupDebt)}
                      </strong>
                    </div>

                    {totalSupDebt > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Contravalor Bs:</span>
                        <span className="text-slate-600 font-semibold">{formatBs(totalSupDebt * settings.bcvRate)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-500">Límite Otorgado:</span>
                      <strong className="font-mono text-slate-700">{formatUSD(sup.creditLimitUSD || 0)}</strong>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Facturas de compra:</span>
                      <span className="font-semibold text-slate-700">
                        {supPendingPays.length} pendientes • {supAllPays.length} total
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-2 border-t border-slate-200/70 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSupplierForDetail(sup)}
                    className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    DETALLES
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenCreditConfig(sup)}
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

      {/* SECTION 2: General Payables Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              Listado Detallado de Facturas por Pagar a Proveedores
            </h3>
            <p className="text-[11px] text-slate-500">
              Movimientos de compras y gastos a crédito con acceso al detalle de productos y registro de pagos.
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
                    ? 'bg-purple-600 text-white font-bold'
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
                <th className="py-3 px-4">Factura Compra</th>
                <th className="py-3 px-4">Proveedor</th>
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
              {filteredPayables.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No hay registros de compras por pagar con estos filtros.
                  </td>
                </tr>
              ) : (
                filteredPayables.map((pay) => {
                  const balanceBs = pay.balanceUSD * settings.bcvRate;
                  const matchingSupplier = suppliers.find((s) => s.id === pay.supplierId);
                  const isSettled = pay.balanceUSD <= 0.01;

                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/70 transition">
                      {/* Factura */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedPayableForDetail(pay)}
                          className="font-mono font-bold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 cursor-pointer"
                          title="Clic para ver detalle de productos comprados"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {pay.invoiceNumber}
                        </button>
                      </td>

                      {/* Proveedor */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => matchingSupplier && setSelectedSupplierForDetail(matchingSupplier)}
                          className="font-semibold text-slate-800 hover:text-purple-700 text-left hover:underline cursor-pointer block"
                        >
                          {pay.supplierName}
                        </button>
                        {matchingSupplier?.phone && (
                          <p className="text-[10px] text-slate-500 font-mono">{matchingSupplier.phone}</p>
                        )}
                      </td>

                      {/* Emisión */}
                      <td className="py-3 px-4 font-mono text-slate-600">{pay.issuedDate}</td>

                      {/* Vencimiento */}
                      <td className="py-3 px-4 font-mono">
                        <span className={pay.status === 'vencido' && !isSettled ? 'text-rose-700 font-bold' : 'text-slate-600'}>
                          {pay.dueDate}
                        </span>
                      </td>

                      {/* Plazo */}
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">
                        {pay.creditDays}d
                      </td>

                      {/* Monto Total */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {formatUSD(pay.totalAmountUSD)}
                      </td>

                      {/* Abonado */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatUSD(pay.amountPaidUSD)}
                      </td>

                      {/* Saldo USD */}
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-purple-700">
                        {formatUSD(pay.balanceUSD)}
                      </td>

                      {/* Saldo Bs */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatBs(balanceBs)}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 text-center">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Liquidado
                          </span>
                        ) : pay.amountPaidUSD > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            Parcial
                          </span>
                        ) : pay.status === 'vencido' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertCircle className="w-3 h-3" /> Vencido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" /> Pendiente
                          </span>
                        )}
                      </td>

                      {/* Acción */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPayableForDetail(pay)}
                            className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                            title="Ver detalle de factura y pagos"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {!isSettled && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayment(pay)}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] transition cursor-pointer shadow-2xs"
                              title="Registrar pago / abono"
                            >
                              Pagar
                            </button>
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

      {/* MODAL 1: Supplier Detail Modal */}
      {selectedSupplierForDetail && (
        <SupplierCreditDetailModal
          supplier={selectedSupplierForDetail}
          payables={payables}
          bcvRate={settings.bcvRate}
          onClose={() => setSelectedSupplierForDetail(null)}
          onRegisterPayablePayment={registerPayablePayment}
          onRegisterGlobalSupplierPayment={registerGlobalSupplierPayment}
          onLiquidateSupplierInvoice={liquidateSupplierInvoice}
          onLiquidateSupplierTotalDebt={liquidateSupplierTotalDebt}
          onOpenCreditConfig={handleOpenCreditConfig}
          onInspectPayable={(p) => setSelectedPayableForDetail(p)}
        />
      )}

      {/* MODAL 2: Payable Items & History Detail Modal */}
      {selectedPayableForDetail && (
        <PayableItemsDetailModal
          payable={selectedPayableForDetail}
          supplier={suppliers.find((s) => s.id === selectedPayableForDetail.supplierId)}
          bcvRate={settings.bcvRate}
          onClose={() => setSelectedPayableForDetail(null)}
          onPayOrLiquidate={(p) => handleOpenPayment(p)}
        />
      )}

      {/* MODAL 3: Direct Single Payment Modal */}
      {selectedPayableForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-purple-400" />
                <h4 className="font-bold text-sm">
                  Registrar Pago a Proveedor: {selectedPayableForPay.invoiceNumber}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayableForPay(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-purple-800 font-bold uppercase">Proveedor</p>
                  <p className="font-bold text-slate-900 text-xs">{selectedPayableForPay.supplierName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-purple-800 font-bold uppercase">Saldo Pendiente</p>
                  <strong className="font-mono text-purple-700 text-sm font-extrabold">
                    {formatUSD(selectedPayableForPay.balanceUSD)}
                  </strong>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  Monto a Pagar (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedPayableForPay.balanceUSD}
                  required
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  ≈ {formatBs((paymentAmount || 0) * settings.bcvRate)} (Tasa: {settings.bcvRate.toFixed(2)} Bs)
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  Método de Pago *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                >
                  <option value="transferencia_usd">Zelle / Transferencia USD</option>
                  <option value="transferencia_bs">Transferencia Bancaria Bs</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="divisas_efectivo">Efectivo Divisas</option>
                </select>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 uppercase block">Distribución del pago</label>
                  <button
                    type="button"
                    onClick={() => setPaymentSplits((prev) => [...prev, {
                      id: crypto.randomUUID(),
                      method: 'transferencia_usd',
                      currency: 'USD',
                      amountUSD: 0,
                      amountBs: 0,
                      reference: '',
                      createdAt: new Date().toISOString(),
                    }])}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200"
                  >
                    + Método
                  </button>
                </div>
                {paymentSplits.map((split, index) => (
                  <div key={split.id} className="grid grid-cols-12 gap-2 items-end">
                    <select
                      value={split.method}
                      onChange={(e) => setPaymentSplits((prev) => prev.map((s, i) => i === index ? { ...s, method: e.target.value as Exclude<PaymentMethod, 'mixto'> } : s))}
                      className="col-span-5 px-2 py-2 text-[11px] border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="efectivo_usd">Efectivo USD</option>
                      <option value="efectivo_bs">Efectivo Bs.</option>
                      <option value="zelle">Zelle</option>
                      <option value="transferencia_usd">Transferencia USD</option>
                      <option value="transferencia_bs">Transferencia Bs.</option>
                      <option value="pago_movil">Pago Móvil</option>
                      <option value="biopago">Biopago</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                    <select
                      value={split.currency}
                      onChange={(e) => setPaymentSplits((prev) => prev.map((s, i) => i === index ? { ...s, currency: e.target.value as 'Bs' | 'USD', amountUSD: 0, amountBs: 0 } : s))}
                      className="col-span-2 px-2 py-2 text-[11px] border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="USD">USD</option>
                      <option value="Bs">Bs.</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={split.currency === 'Bs' ? (split.amountBs || '') : (split.amountUSD || '')}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setPaymentSplits((prev) => prev.map((s, i) => i === index
                          ? { ...s, amountUSD: s.currency === 'Bs' ? value / settings.bcvRate : value, amountBs: s.currency === 'Bs' ? value : value * settings.bcvRate }
                          : s));
                      }}
                      className="col-span-4 px-2 py-2 text-[11px] font-mono border border-slate-300 rounded-lg"
                      placeholder="Monto"
                    />
                    {paymentSplits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPaymentSplits((prev) => prev.filter((_, i) => i !== index))}
                        className="col-span-1 p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Eliminar método"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-500">Aplicado: {formatUSD(paymentSplits.reduce((s, p) => s + (p.currency === 'Bs' ? p.amountBs / settings.bcvRate : p.amountUSD), 0))} USD</span>
                  <span className={Math.abs(paymentSplits.reduce((s, p) => s + (p.currency === 'Bs' ? p.amountBs / settings.bcvRate : p.amountUSD), 0) - paymentAmount) <= 0.02 ? 'text-emerald-600' : 'text-rose-600'}>
                    Objetivo: {formatUSD(paymentAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  N° de Referencia
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej. REF-987654"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Detalles sobre el pago..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedPayableForPay(null)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={paymentAmount <= 0}
                  className="px-4 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Supplier Credit Config Modal */}
      {editingSupplierCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-400" />
                <h4 className="font-bold text-sm">
                  Condiciones de Crédito: {editingSupplierCredit.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingSupplierCredit(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCreditConfig} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  Días de Crédito Otorgados
                </label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  required
                  value={creditFormData.creditDays}
                  onChange={(e) => setCreditFormData({ ...creditFormData, creditDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">
                  Límite de Crédito Autorizado (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={creditFormData.creditLimitUSD}
                  onChange={(e) => setCreditFormData({ ...creditFormData, creditLimitUSD: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSupplierCredit(null)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  Guardar Condiciones
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-purple-400" />
                <h4 className="font-bold text-sm">Registrar Nuevo Proveedor</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase block">Nombre / Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase block">RIF / Identificación *</label>
                  <input
                    type="text"
                    required
                    value={newSupplier.rif}
                    onChange={(e) => setNewSupplier({ ...newSupplier, rif: e.target.value })}
                    placeholder="J-12345678-9"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase block">Teléfono</label>
                  <input
                    type="text"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase block">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase block">Persona de Contacto</label>
                  <input
                    type="text"
                    value={newSupplier.contactName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase block">Días de Crédito</label>
                  <input
                    type="number"
                    value={newSupplier.creditDays}
                    onChange={(e) => setNewSupplier({ ...newSupplier, creditDays: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase block">Dirección Fiscal / Depósito</label>
                <input
                  type="text"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
