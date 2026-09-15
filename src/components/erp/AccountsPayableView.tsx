import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PayableItem, Supplier } from '../../types';
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
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';

export const AccountsPayableView: React.FC = () => {
  const { payables, suppliers, settings, registerPayablePayment, addSupplier } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modals state
  const [selectedPayable, setSelectedPayable] = useState<PayableItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    rif: '',
    phone: '',
    email: '',
    contactPerson: '',
    creditDays: 30,
  });

  const filteredPayables = payables.filter((p) => {
    const matchesSearch =
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPayableUSD = payables.reduce((sum, p) => sum + p.balanceUSD, 0);
  const totalPaidUSD = payables.reduce((sum, p) => sum + p.amountPaidUSD, 0);

  const handleOpenPayment = (pay: PayableItem) => {
    setSelectedPayable(pay);
    setPaymentAmount(pay.balanceUSD);
  };

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable || paymentAmount <= 0) return;
    registerPayablePayment(selectedPayable.id, paymentAmount);
    setSelectedPayable(null);
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
      contactPerson: '',
      creditDays: 30,
    });
  };

  const handleExportCSV = () => {
    const rows = [
      ['REPORTE DE CUENTAS POR PAGAR (CxP) A PROVEEDORES'],
      ['Fecha Generación', new Date().toLocaleString('es-VE')],
      ['Tasa BCV', `${formatPlainNumber(settings.bcvRate, 2)} Bs/USD`],
      [],
      ['N° Factura Compra', 'Proveedor', 'Concepto', 'Fecha Emisión', 'Fecha Vencimiento', 'Total USD', 'Abonado USD', 'Saldo Pendiente USD', 'Saldo Pendiente Bs', 'Estado'],
      ...payables.map((p) => [
        p.invoiceNumber,
        p.supplierName,
        p.description,
        p.issuedDate,
        p.dueDate,
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
            <Receipt className="w-6 h-6 text-indigo-600" />
            Cuentas por Pagar (CxP) & Proveedores
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Control de compras a crédito, deudas comerciales con proveedores y registro de pagos.
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
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
            Total Pasivo por Pagar (CxP)
          </span>
          <p className="text-2xl font-extrabold text-rose-700 mt-1 font-mono">
            {formatUSD(totalPayableUSD)} USD
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            ≈ {formatBs(totalPayableUSD * settings.bcvRate)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Pagos Realizados a Proveedores
          </span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
            {formatUSD(totalPaidUSD)} USD
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            Amortizaciones de compras
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">
            Proveedores Comerciales
          </span>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1 font-mono">
            {suppliers.length}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Fabricantes y distribuidores registrados
          </p>
        </div>
      </div>

      {/* Payables Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por proveedor o factura..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
            {['todos', 'por_vencer', 'vencido', 'pagado'].map((status) => (
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
                <th className="py-3 px-4">Factura / Compra</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">Concepto / Lote</th>
                <th className="py-3 px-4">Emisión</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-right">Total Factura</th>
                <th className="py-3 px-4 text-right">Abonado</th>
                <th className="py-3 px-4 text-right">Saldo por Pagar</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayables.map((pay) => {
                const balanceBs = pay.balanceUSD * settings.bcvRate;

                return (
                  <tr key={pay.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{pay.invoiceNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{pay.supplierName}</td>
                    <td className="py-3 px-4 text-slate-600">{pay.description}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{pay.issuedDate}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{pay.dueDate}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{formatUSD(pay.totalAmountUSD)}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">{formatUSD(pay.amountPaidUSD)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                      {formatUSD(pay.balanceUSD)}
                      <span className="block text-[10px] text-slate-400">
                        {formatBs(balanceBs)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {pay.status === 'por_vencer' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Por Vencer
                        </span>
                      )}
                      {pay.status === 'vencido' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Vencido
                        </span>
                      )}
                      {pay.status === 'pagado' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Pagado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {pay.balanceUSD > 0.01 ? (
                        <button
                          onClick={() => handleOpenPayment(pay)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] transition cursor-pointer"
                        >
                          Pagar
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Al Día
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Payment to Supplier */}
      {selectedPayable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                Registrar Pago a Proveedor
              </h3>
              <button onClick={() => setSelectedPayable(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p>Proveedor: <strong>{selectedPayable.supplierName}</strong></p>
                <p>Factura: <strong>{selectedPayable.invoiceNumber}</strong></p>
                <p>Saldo Pendiente: <strong className="font-mono text-sm text-rose-700">{formatUSD(selectedPayable.balanceUSD)} USD</strong></p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Monto a Cancelar (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedPayable.balanceUSD}
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
                  onClick={() => setSelectedPayable(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                >
                  Registrar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Supplier */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                Registrar Nuevo Proveedor
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nombre o Razón Social *</label>
                <input
                  type="text"
                  required
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">RIF Empresa *</label>
                  <input
                    type="text"
                    required
                    value={newSupplier.rif}
                    onChange={(e) => setNewSupplier({ ...newSupplier, rif: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                    placeholder="J-00000000-0"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Teléfono *</label>
                  <input
                    type="text"
                    required
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Persona de Contacto</label>
                <input
                  type="text"
                  value={newSupplier.contactPerson}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Días de Crédito Habituales</label>
                <input
                  type="number"
                  value={newSupplier.creditDays}
                  onChange={(e) => setNewSupplier({ ...newSupplier, creditDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
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
