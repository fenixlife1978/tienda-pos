import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import {
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  CreditCard,
  Building2,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Download,
  Check,
  Sparkles,
  Info,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

export const CustomerRequestsManagementView: React.FC = () => {
  const {
    customers,
    settings,
    approveCustomerVerification,
    rejectCustomerVerification,
    approveCustomerCreditRequest,
    rejectCustomerCreditRequest,
    currentUser,
  } = useApp();

  // State filters
  const [activeStatusFilter, setActiveStatusFilter] = useState<
    'all' | 'pending' | 'credit_requested' | 'verified' | 'rejected'
  >('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals state
  const [approvingCustomer, setApprovingCustomer] = useState<Customer | null>(null);
  const [rejectingCustomer, setRejectingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Approval Form State
  const [enableCredit, setEnableCredit] = useState(true);
  const [creditLimitUSD, setCreditLimitUSD] = useState<number>(1000);
  const [creditDays, setCreditDays] = useState<number>(15);
  const [assignedPriceTier, setAssignedPriceTier] = useState<
    'publico' | 'mayorista' | 'distribuidor' | 'especial'
  >('mayorista');
  const [approvalNotes, setApprovalNotes] = useState('');

  // Rejection Form State
  const [rejectionReason, setRejectionReason] = useState('');
  const [presetReason, setPresetReason] = useState('');

  // Unique business types for filter dropdown
  const businessTypes = useMemo(() => {
    const types = new Set<string>();
    customers.forEach((c) => {
      if (c.businessType) types.add(c.businessType);
    });
    return Array.from(types);
  }, [customers]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      // Status Filter
      if (activeStatusFilter === 'pending') {
        const isPending =
          cust.verificationStatus === 'pending' ||
          (cust.isFirstTime && cust.verificationStatus !== 'verified' && cust.verificationStatus !== 'rejected') ||
          (cust.creditStatus === 'pending' && cust.verificationStatus !== 'rejected');
        if (!isPending) return false;
      } else if (activeStatusFilter === 'credit_requested') {
        if (cust.creditStatus !== 'pending' && (!cust.creditRequestedLimitUSD || cust.creditRequestedLimitUSD <= 0)) {
          return false;
        }
      } else if (activeStatusFilter === 'verified') {
        if (cust.verificationStatus !== 'verified') return false;
      } else if (activeStatusFilter === 'rejected') {
        if (cust.verificationStatus !== 'rejected' && cust.creditStatus !== 'rejected') return false;
      }

      // Business Type Filter
      if (selectedBusinessType !== 'all' && cust.businessType !== selectedBusinessType) {
        return false;
      }

      // Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = cust.name.toLowerCase().includes(term);
        const matchesTrade = (cust.tradeName || '').toLowerCase().includes(term);
        const matchesRif = cust.rif.toLowerCase().includes(term);
        const matchesPhone = cust.phone.toLowerCase().includes(term);
        const matchesEmail = cust.email.toLowerCase().includes(term);
        const matchesContact = (cust.contactPerson || '').toLowerCase().includes(term);
        const matchesAddress = (cust.address || '').toLowerCase().includes(term);
        if (
          !matchesName &&
          !matchesTrade &&
          !matchesRif &&
          !matchesPhone &&
          !matchesEmail &&
          !matchesContact &&
          !matchesAddress
        ) {
          return false;
        }
      }

      return true;
    });
  }, [customers, activeStatusFilter, selectedBusinessType, searchTerm]);

  // Metrics summary
  const metrics = useMemo(() => {
    const pendingCount = customers.filter(
      (c) =>
        c.verificationStatus === 'pending' ||
        (c.isFirstTime && c.verificationStatus !== 'verified' && c.verificationStatus !== 'rejected') ||
        c.creditStatus === 'pending'
    ).length;

    const creditRequestedCustomers = customers.filter(
      (c) => c.creditStatus === 'pending' || (c.creditRequestedLimitUSD && c.creditRequestedLimitUSD > 0)
    );

    const totalCreditRequestedUSD = creditRequestedCustomers.reduce(
      (acc, c) => acc + (c.creditRequestedLimitUSD || 0),
      0
    );

    const verifiedCount = customers.filter((c) => c.verificationStatus === 'verified').length;
    const totalCreditGrantedUSD = customers
      .filter((c) => c.hasCredit && c.verificationStatus === 'verified')
      .reduce((acc, c) => acc + (c.creditLimitUSD || 0), 0);

    const rejectedCount = customers.filter(
      (c) => c.verificationStatus === 'rejected' || c.creditStatus === 'rejected'
    ).length;

    return {
      pendingCount,
      creditRequestedCount: creditRequestedCustomers.length,
      totalCreditRequestedUSD,
      verifiedCount,
      totalCreditGrantedUSD,
      rejectedCount,
    };
  }, [customers]);

  // Open Approval Modal handler
  const handleOpenApprove = (cust: Customer) => {
    setApprovingCustomer(cust);
    // Suggest requested credit or system default
    const requestedUSD = cust.creditRequestedLimitUSD || settings.defaultCreditLimitUSD || 1000;
    const requestedDays = cust.creditRequestedDays || settings.defaultCreditDays || 15;
    setCreditLimitUSD(requestedUSD);
    setCreditDays(requestedDays);
    setEnableCredit(cust.creditStatus === 'pending' || (cust.creditRequestedLimitUSD ?? 0) > 0 || true);
    setAssignedPriceTier(cust.assignedPriceTier || 'mayorista');
    setApprovalNotes(cust.verificationNotes || 'Aprobado tras validación de datos comerciales.');
  };

  // Submit Approval
  const handleConfirmApproval = () => {
    if (!approvingCustomer) return;
    approveCustomerVerification(approvingCustomer.id, {
      hasCredit: enableCredit,
      creditLimitUSD: enableCredit ? creditLimitUSD : 0,
      creditDays: enableCredit ? creditDays : 0,
      assignedPriceTier,
      notes: approvalNotes,
    });
    setApprovingCustomer(null);
  };

  // Open Rejection Modal handler
  const handleOpenReject = (cust: Customer) => {
    setRejectingCustomer(cust);
    setRejectionReason('');
    setPresetReason('');
  };

  // Submit Rejection
  const handleConfirmRejection = () => {
    if (!rejectingCustomer) return;
    const finalReason = rejectionReason.trim() || presetReason || 'No cumple con las políticas de registro comercial.';
    rejectCustomerVerification(rejectingCustomer.id, finalReason);
    setRejectingCustomer(null);
  };

  // Quick 1-click default approval
  const handleQuickApprove = (cust: Customer) => {
    const defaultLimit = cust.creditRequestedLimitUSD || 1000;
    const defaultDays = cust.creditRequestedDays || 15;
    approveCustomerVerification(cust.id, {
      hasCredit: true,
      creditLimitUSD: defaultLimit,
      creditDays: defaultDays,
      assignedPriceTier: 'mayorista',
      notes: 'Aprobación rápida directa.',
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Razón Social',
      'Nombre Comercial',
      'RIF/Cédula',
      'Email',
      'Teléfono',
      'Dirección',
      'Tipo de Negocio',
      'Estado Verificación',
      'Crédito Solicitado (USD)',
      'Días Solicitados',
      'Crédito Asignado (USD)',
      'Días Aprobados',
      'Fecha Registro',
    ];

    const rows = filteredCustomers.map((c) => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.tradeName || '').replace(/"/g, '""')}"`,
      `"${c.rif}"`,
      `"${c.email}"`,
      `"${c.phone}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${c.businessType || 'General'}"`,
      `"${c.verificationStatus || 'Pendiente'}"`,
      c.creditRequestedLimitUSD || 0,
      c.creditRequestedDays || 0,
      c.hasCredit ? c.creditLimitUSD : 0,
      c.hasCredit ? c.creditDays : 0,
      c.registeredAt || 'N/D',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Solicitudes_Clientes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Gestión de Solicitudes y Verificación de Clientes
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Valida clientes registrados por primera vez, aprueba cuentas comerciales y autoriza límites de crédito iniciales.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer"
            title="Descargar lista de solicitudes en archivo CSV Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pending */}
        <div
          onClick={() => setActiveStatusFilter('pending')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeStatusFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pendientes de Aprobación</span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.pendingCount}</span>
            <span className="text-xs text-amber-700 font-medium">esperando revisión</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cuentas nuevas registradas por 1ra vez</p>
        </div>

        {/* Metric 2: Credit Requests */}
        <div
          onClick={() => setActiveStatusFilter('credit_requested')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeStatusFilter === 'credit_requested'
              ? 'bg-indigo-500/10 border-indigo-400 ring-2 ring-indigo-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Solicitudes de Crédito</span>
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-950 font-mono">
              {formatUSD(metrics.totalCreditRequestedUSD)}
            </span>
            <span className="text-xs font-bold text-indigo-600 font-mono">
              ({metrics.creditRequestedCount})
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Equiv. ~{formatBs(metrics.totalCreditRequestedUSD * settings.bcvRate)}
          </p>
        </div>

        {/* Metric 3: Verified */}
        <div
          onClick={() => setActiveStatusFilter('verified')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeStatusFilter === 'verified'
              ? 'bg-emerald-500/10 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Cuentas Verificadas</span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.verifiedCount}</span>
            <span className="text-xs text-emerald-700 font-medium">habilitadas</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Línea total otorgada: {formatUSD(metrics.totalCreditGrantedUSD)}
          </p>
        </div>

        {/* Metric 4: Rejected */}
        <div
          onClick={() => setActiveStatusFilter('rejected')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeStatusFilter === 'rejected'
              ? 'bg-rose-500/10 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Rechazadas / Denegadas</span>
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.rejectedCount}</span>
            <span className="text-xs text-rose-700 font-medium">solicitudes</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Histórico de rechazos con justificación</p>
        </div>
      </div>

      {/* Filter Toolbar & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Tabs Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-1">
            <button
              onClick={() => setActiveStatusFilter('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeStatusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Pendientes</span>
              {metrics.pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-amber-700 font-black">
                  {metrics.pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveStatusFilter('credit_requested')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeStatusFilter === 'credit_requested'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Con Solicitud de Crédito</span>
              {metrics.creditRequestedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-indigo-700 font-black">
                  {metrics.creditRequestedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveStatusFilter('verified')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeStatusFilter === 'verified'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Verificados ({metrics.verifiedCount})</span>
            </button>

            <button
              onClick={() => setActiveStatusFilter('rejected')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeStatusFilter === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Rechazados ({metrics.rejectedCount})</span>
            </button>

            <button
              onClick={() => setActiveStatusFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeStatusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Todos ({customers.length})</span>
            </button>
          </div>

          {/* View toggle (Cards vs Table) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tarjetas
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                viewMode === 'table' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tabla
            </button>
          </div>
        </div>

        {/* Search input & Business Type dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Razón Social, RIF, Teléfono, Nombre de Contacto o Dirección..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <select
              value={selectedBusinessType}
              onChange={(e) => setSelectedBusinessType(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition font-medium"
            >
              <option value="all">Todos los Tipos de Negocio</option>
              {businessTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* List / Cards Results */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <div className="w-14 h-14 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
            <UserCheck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No se encontraron solicitudes con este filtro</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {activeStatusFilter === 'pending'
              ? '¡Excelente trabajo! No hay clientes registrados por primera vez pendientes de aprobación.'
              : 'Modifica los parámetros de búsqueda o selecciona otra pestaña para visualizar clientes.'}
          </p>
          <button
            onClick={() => {
              setActiveStatusFilter('all');
              setSearchTerm('');
              setSelectedBusinessType('all');
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
          >
            Ver todos los clientes
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCustomers.map((cust) => {
            const isPending =
              cust.verificationStatus === 'pending' ||
              (cust.isFirstTime && cust.verificationStatus !== 'verified' && cust.verificationStatus !== 'rejected') ||
              cust.creditStatus === 'pending';
            const isVerified = cust.verificationStatus === 'verified';
            const isRejected = cust.verificationStatus === 'rejected' || cust.creditStatus === 'rejected';

            const requestedCreditUSD = cust.creditRequestedLimitUSD || 0;
            const requestedCreditDays = cust.creditRequestedDays || 0;

            return (
              <div
                key={cust.id}
                className={`bg-white rounded-2xl border transition shadow-xs flex flex-col justify-between overflow-hidden ${
                  isPending
                    ? 'border-amber-300 ring-1 ring-amber-200'
                    : isVerified
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                          isPending
                            ? 'bg-amber-100 text-amber-800'
                            : isVerified
                            ? 'bg-emerald-100 text-emerald-800'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cust.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                            {cust.name}
                          </h3>
                          {cust.isFirstTime && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                              1ra Vez
                            </span>
                          )}
                        </div>
                        {cust.tradeName && (
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            Local: <span className="text-slate-700 font-bold">{cust.tradeName}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {cust.rif}
                          </span>
                          {cust.businessType && (
                            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {cust.businessType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                          <span>Pendiente</span>
                        </span>
                      ) : isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Verificado</span>
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Rechazado</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Customer Contact & Location */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                    {cust.contactPerson && (
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          Contacto: <strong>{cust.contactPerson}</strong>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a
                        href={`tel:${cust.phone}`}
                        className="font-mono text-slate-800 hover:text-indigo-600 font-semibold truncate"
                      >
                        {cust.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-700">{cust.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:col-span-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-600">{cust.address}</span>
                    </div>
                  </div>

                  {/* Solicitud de Crédito Banner if requested */}
                  {requestedCreditUSD > 0 && (
                    <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-900 flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                          Solicita Línea de Crédito:
                        </span>
                        <span className="font-mono font-black text-indigo-700 text-sm">
                          {formatUSD(requestedCreditUSD)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-indigo-800 font-medium">
                        <span>Plazo solicitado: <strong>{requestedCreditDays} días</strong></span>
                        <span className="font-mono">
                          ~{formatBs(requestedCreditUSD * settings.bcvRate)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Document and Reference Badges */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1">
                    {cust.attachedDocRif && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium border border-slate-200">
                        <FileText className="w-3 h-3 text-slate-500" />
                        {cust.attachedDocRif}
                      </span>
                    )}
                    {cust.attachedCommercialRef && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium border border-slate-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        {cust.attachedCommercialRef}
                      </span>
                    )}
                  </div>

                  {/* Rejection / Verified Notes info */}
                  {isRejected && cust.rejectionReason && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                      <strong>Motivo de Rechazo:</strong> {cust.rejectionReason}
                    </div>
                  )}

                  {isVerified && cust.hasCredit && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                      <span>
                        Crédito Activo: <strong>{formatUSD(cust.creditLimitUSD)}</strong> ({cust.creditDays} días)
                      </span>
                      {cust.verifiedBy && (
                        <span className="text-[11px] text-emerald-700">Por: {cust.verifiedBy}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 sm:p-4 bg-slate-50 flex items-center justify-between gap-2 flex-wrap border-t border-slate-100">
                  <button
                    onClick={() => setViewingCustomer(cust)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-200/70 transition cursor-pointer"
                  >
                    Ver Expediente
                  </button>

                  <div className="flex items-center gap-2">
                    {/* If pending: show Approve & Reject buttons */}
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleOpenReject(cust)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Rechazar</span>
                        </button>

                        <button
                          onClick={() => handleOpenApprove(cust)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-2xs cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Aprobar & Asignar Crédito</span>
                        </button>
                      </>
                    ) : isVerified ? (
                      <button
                        onClick={() => handleOpenApprove(cust)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Ajustar Crédito</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenApprove(cust)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Reconsiderar / Aprobar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Mode */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Cliente / Razón Social</th>
                  <th className="py-3 px-3">RIF / Cédula</th>
                  <th className="py-3 px-3">Contacto / Teléfono</th>
                  <th className="py-3 px-3">Tipo de Negocio</th>
                  <th className="py-3 px-3">Solicitud de Crédito</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => {
                  const isPending =
                    cust.verificationStatus === 'pending' ||
                    (cust.isFirstTime && cust.verificationStatus !== 'verified' && cust.verificationStatus !== 'rejected') ||
                    cust.creditStatus === 'pending';
                  const isVerified = cust.verificationStatus === 'verified';
                  const isRejected = cust.verificationStatus === 'rejected' || cust.creditStatus === 'rejected';

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{cust.name}</div>
                        {cust.tradeName && <div className="text-[11px] text-slate-500 font-medium">{cust.tradeName}</div>}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700">{cust.rif}</td>
                      <td className="py-3 px-3 text-slate-700">
                        <div>{cust.contactPerson || 'N/D'}</div>
                        <div className="font-mono text-[11px] text-slate-500">{cust.phone}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium text-[11px]">
                          {cust.businessType || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {cust.creditRequestedLimitUSD && cust.creditRequestedLimitUSD > 0 ? (
                          <div>
                            <span className="font-bold text-indigo-900">{formatUSD(cust.creditRequestedLimitUSD)}</span>
                            <div className="text-[11px] text-slate-500 font-sans">
                              {cust.creditRequestedDays || 15} días
                            </div>
                          </div>
                        ) : cust.hasCredit ? (
                          <div className="text-emerald-700 font-bold">
                            {formatUSD(cust.creditLimitUSD)} ({cust.creditDays}d)
                          </div>
                        ) : (
                          <span className="text-slate-400">Contado (Sin crédito)</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            Pendiente
                          </span>
                        ) : isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Verificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            Rechazado
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenApprove(cust)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                        >
                          {isPending ? 'Aprobar' : 'Ajustar'}
                        </button>
                        {isPending && (
                          <button
                            onClick={() => handleOpenReject(cust)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs transition cursor-pointer"
                          >
                            Rechazar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: APROBAR CLIENTE Y ASIGNAR LÍMITE DE CRÉDITO */}
      {approvingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Aprobar Cuenta & Asignar Crédito</h3>
                  <p className="text-xs text-slate-500">Validación formal y asignación de condiciones comerciales</p>
                </div>
              </div>
              <button
                onClick={() => setApprovingCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Customer Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{approvingCustomer.name}</span>
                <span className="font-mono text-indigo-700">{approvingCustomer.rif}</span>
              </div>
              <p className="text-slate-600">{approvingCustomer.address}</p>
              <div className="flex items-center gap-3 text-slate-500 pt-1">
                <span>📞 {approvingCustomer.phone}</span>
                <span>✉️ {approvingCustomer.email}</span>
              </div>
              {approvingCustomer.creditRequestedLimitUSD && approvingCustomer.creditRequestedLimitUSD > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-indigo-900 font-semibold">
                  <span>Solicitó crédito de:</span>
                  <span className="font-mono font-bold">
                    {formatUSD(approvingCustomer.creditRequestedLimitUSD)} ({approvingCustomer.creditRequestedDays || 15} días)
                  </span>
                </div>
              )}
            </div>

            {/* Credit Toggle */}
            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-indigo-950 block">
                  Habilitar Línea de Crédito Comercial
                </label>
                <span className="text-[11px] text-indigo-700">
                  {enableCredit ? 'Permite despachar pedidos a crédito' : 'Solo ventas de contado'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableCredit}
                onChange={(e) => setEnableCredit(e.target.checked)}
                className="w-5 h-5 accent-indigo-600 cursor-pointer rounded-sm"
              />
            </div>

            {/* Credit Parameters if Enabled */}
            {enableCredit && (
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                {/* Límite de Crédito USD */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Límite de Crédito Inicial (USD)
                    </label>
                    <span className="font-mono font-black text-indigo-700 text-sm">
                      {formatUSD(creditLimitUSD)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={creditLimitUSD}
                    onChange={(e) => setCreditLimitUSD(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  {/* Preset Quick Chips */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[500, 1000, 1500, 2000, 3000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCreditLimitUSD(amt)}
                        className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition cursor-pointer ${
                          creditLimitUSD === amt
                            ? 'bg-indigo-600 text-white font-bold border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Equivalente aproximado: <strong className="font-mono text-slate-700">{formatBs(creditLimitUSD * settings.bcvRate)}</strong> (Tasa BCV: {settings.bcvRate.toFixed(2)} Bs/$)
                  </p>
                </div>

                {/* Plazo de Pago (Días de Crédito) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Plazo de Pago Acordado (Días)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[7, 15, 21, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setCreditDays(days)}
                        className={`py-2 text-xs rounded-xl font-bold border transition cursor-pointer ${
                          creditDays === days
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {days} días
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de Precios Asignada */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Lista de Precios Asignada
                  </label>
                  <select
                    value={assignedPriceTier}
                    onChange={(e: any) => setAssignedPriceTier(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="mayorista">Mayorista (Recomendado para Comercios)</option>
                    <option value="distribuidor">Distribuidor / Gran Mayor</option>
                    <option value="publico">Público / Detal</option>
                    <option value="especial">Lista Especial / Clave</option>
                  </select>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Notas de Auditoría y Verificación
              </label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Indica observaciones internas o soportes validados..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setApprovingCustomer(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmApproval}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Aprobación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RECHAZAR SOLICITUD DE CLIENTE */}
      {rejectingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Rechazar Solicitud de Registro</h3>
                  <p className="text-xs text-slate-500">Indica el motivo justificado de la denegación</p>
                </div>
              </div>
              <button
                onClick={() => setRejectingCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <strong className="text-slate-900">{rejectingCustomer.name}</strong>
              <div className="text-slate-500 font-mono mt-0.5">{rejectingCustomer.rif}</div>
            </div>

            {/* Quick Reason Presets */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Motivos Frecuentes
              </label>
              <div className="space-y-1.5">
                {[
                  'RIF fiscal o Cédula no coincide con el registro oficial del SENIAT',
                  'Dirección física o número telefónico no pudieron ser verificados',
                  'Referencias comerciales no confirmadas o con mora en el mercado',
                  'Inconsistencia en los datos de facturación suministrados',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setPresetReason(reason);
                      setRejectionReason(reason);
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs border transition cursor-pointer ${
                      presetReason === reason
                        ? 'bg-rose-50 text-rose-900 border-rose-300 font-medium'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    • {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Reason Textarea */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Motivo / Justificación Adicional
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Escribe el motivo detallado del rechazo..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRejectingCustomer(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRejection}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Confirmar Rechazo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EXPEDIENTE COMPLETO DEL CLIENTE */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-sm">
                  {viewingCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">{viewingCustomer.name}</h3>
                  <p className="text-xs text-indigo-700 font-mono font-bold">{viewingCustomer.rif}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Dossier info */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Tipo de Negocio</span>
                  <span className="font-bold text-slate-800">{viewingCustomer.businessType || 'Comercio General'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Nombre Comercial</span>
                  <span className="font-bold text-slate-800">{viewingCustomer.tradeName || 'N/D'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Persona de Contacto</span>
                  <span className="font-bold text-slate-800">{viewingCustomer.contactPerson || 'N/D'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Teléfono</span>
                  <span className="font-bold font-mono text-slate-800">{viewingCustomer.phone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[11px]">Dirección Fiscal y Despacho</span>
                  <span className="font-semibold text-slate-800">{viewingCustomer.address}</span>
                </div>
              </div>

              {/* Credit Status Box */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1">
                <span className="font-bold text-indigo-900 block text-xs">Estado Financiero & Crédito</span>
                <div className="flex items-center justify-between pt-1">
                  <span>Línea de Crédito:</span>
                  <strong className="font-mono text-indigo-950">
                    {viewingCustomer.hasCredit ? formatUSD(viewingCustomer.creditLimitUSD) : 'Sin crédito asignado'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Plazo de pago:</span>
                  <strong className="text-indigo-950">{viewingCustomer.creditDays || 0} días</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Deuda Actual:</span>
                  <strong className="font-mono text-rose-700">{formatUSD(viewingCustomer.currentDebtUSD)}</strong>
                </div>
              </div>

              {/* Documents */}
              {(viewingCustomer.attachedDocRif || viewingCustomer.attachedCommercialRef) && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-800 block">Soportes y Referencias</span>
                  {viewingCustomer.attachedDocRif && (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{viewingCustomer.attachedDocRif}</span>
                    </div>
                  )}
                  {viewingCustomer.attachedCommercialRef && (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{viewingCustomer.attachedCommercialRef}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setViewingCustomer(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  const target = viewingCustomer;
                  setViewingCustomer(null);
                  handleOpenApprove(target);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer"
              >
                Aprobar / Ajustar Crédito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
