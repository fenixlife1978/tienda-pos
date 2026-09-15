import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ReceivableItem, Customer } from '../../types';
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
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';

export const AccountsReceivableView: React.FC = () => {
  const {
    receivables,
    customers,
    settings,
    registerReceivablePayment,
    updateCustomerCredit,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modals state
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [editingCustomerCredit, setEditingCustomerCredit] = useState<Customer | null>(null);

  // Credit form
  const [creditFormData, setCreditFormData] = useState({
    hasCredit: true,
    creditDays: 15,
    creditLimitUSD: 2000,
  });

  const filteredReceivables = receivables.filter((r) => {
    const matchesSearch =
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Financial KPIs
  const totalReceivableUSD = receivables.reduce((sum, r) => sum + r.balanceUSD, 0);
  const overdueUSD = receivables.filter((r) => r.status === 'vencido').reduce((sum, r) => sum + r.balanceUSD, 0);
  const totalPaidUSD = receivables.reduce((sum, r) => sum + r.amountPaidUSD, 0);

  const handleOpenPayment = (rec: ReceivableItem) => {
    setSelectedReceivable(rec);
    setPaymentAmount(rec.balanceUSD);
  };

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable || paymentAmount <= 0) return;
    registerReceivablePayment(selectedReceivable.id, paymentAmount);
    setSelectedReceivable(null);
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
      ['REPORTE DE CUENTAS POR COBRAR (CxC) Y GESTIÓN DE CRÉDITOS'],
      ['Fecha Generación', new Date().toLocaleString('es-VE')],
      ['Tasa BCV', `${formatPlainNumber(settings.bcvRate, 2)} Bs/USD`],
      [],
      ['N° Factura', 'Cliente', 'Teléfono', 'Fecha Emisión', 'Fecha Vencimiento', 'Días Crédito', 'Monto Total USD', 'Abonado USD', 'Saldo Pendiente USD', 'Saldo Pendiente Bs', 'Estado'],
      ...receivables.map((r) => [
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
            Cuentas por Cobrar (CxC) & Líneas de Crédito
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de facturas a crédito, plazos de pago específicos por cliente (7, 15, 30 días) y registro de cobros.
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

      {/* Credit Terms Manager per Client */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Configuración de Días de Crédito por Cliente
            </h3>
            <p className="text-[11px] text-slate-500">
              Establezca los días de crédito (7, 15, 30 días) y límite máximo en dólares para cada cliente.
            </p>
          </div>
          <span className="text-[11px] text-slate-400">Plazo general por defecto: {settings.defaultCreditDays} días</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {customers.map((cust) => (
            <div
              key={cust.id}
              className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs truncate">{cust.name}</span>
                  {cust.hasCredit ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {cust.creditDays} DÍAS
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                      CONTADO
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">RIF: {cust.rif}</p>

                {cust.hasCredit && (
                  <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                    <p>Límite: <strong className="font-mono">{formatUSD(cust.creditLimitUSD)}</strong></p>
                    <p>Deuda actual: <strong className="font-mono text-amber-700">{formatUSD(cust.currentDebtUSD)}</strong></p>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleOpenCreditConfig(cust)}
                className="mt-3 w-full py-1.5 text-center text-xs font-semibold bg-white border border-slate-300 rounded-lg text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
              >
                Ajustar Crédito
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Receivables Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente o N° factura..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
            {['todos', 'al_dia', 'por_vencer', 'vencido', 'pagado'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status.replace('_', ' ')}
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
                    No hay registros de cuentas por cobrar en esta categoría.
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((rec) => {
                  const balanceBs = rec.balanceUSD * settings.bcvRate;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">{rec.invoiceNumber}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800">{rec.customerName}</p>
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
                      <td className="py-3 px-4 text-center">
                        {rec.balanceUSD > 0.01 ? (
                          <button
                            onClick={() => handleOpenPayment(rec)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] transition cursor-pointer"
                          >
                            Cobrar
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Listo
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Payment (Cobro de Factura) */}
      {selectedReceivable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                Registrar Cobro / Abono a Cuenta
              </h3>
              <button onClick={() => setSelectedReceivable(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-1 text-blue-900">
                <p>Factura: <strong>{selectedReceivable.invoiceNumber}</strong></p>
                <p>Cliente: <strong>{selectedReceivable.customerName}</strong></p>
                <p>Saldo Pendiente Actual: <strong className="font-mono text-sm">{formatUSD(selectedReceivable.balanceUSD)} USD</strong></p>
                <p className="text-[11px] text-blue-700">
                  ≈ {formatBs(selectedReceivable.balanceUSD * settings.bcvRate)}
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Monto a Cobrar (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedReceivable.balanceUSD}
                  min="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-base focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReceivable(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                >
                  Confirmar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Customer Credit Days & Limit */}
      {editingCustomerCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                Editar Crédito: {editingCustomerCredit.name}
              </h3>
              <button onClick={() => setEditingCustomerCredit(null)} className="text-slate-400 hover:text-slate-600">
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
