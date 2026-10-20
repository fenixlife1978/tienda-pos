import React, { useMemo, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Search, ShieldCheck, Trash2, UserRound, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';

type AccountFilter = 'all' | 'active' | 'suspended' | 'deleted';

const statusLabel: Record<NonNullable<Customer['accountStatus']>, string> = {
  active: 'Activa',
  suspended: 'Suspendida',
  deleted: 'Eliminada',
};

export const CustomerAccountsManagementView: React.FC = () => {
  const { customers, currentUser, setCustomerAccountStatus } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AccountFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const accounts = useMemo(() => customers.filter((customer) => {
    const status = customer.accountStatus || 'active';
    if (filter !== 'all' && status !== filter) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [customer.name, customer.rif, customer.email, customer.phone, customer.tradeName || '']
      .some((value) => String(value || '').toLowerCase().includes(term));
  }), [customers, filter, search]);

  const counts = useMemo(() => ({
    active: customers.filter((c) => (c.accountStatus || 'active') === 'active').length,
    suspended: customers.filter((c) => c.accountStatus === 'suspended').length,
    deleted: customers.filter((c) => c.accountStatus === 'deleted').length,
  }), [customers]);

  const changeStatus = async (customer: Customer, status: 'active' | 'suspended' | 'deleted') => {
    if (currentUser?.role !== 'admin') {
      setFeedback({ type: 'error', text: 'Solo el administrador puede gestionar las cuentas de clientes.' });
      return;
    }
    const action = status === 'suspended' ? 'suspender' : status === 'deleted' ? 'eliminar' : 'reactivar';
    const warning = status === 'deleted'
      ? '\n\nLa cuenta quedará deshabilitada permanentemente para iniciar sesión. Los pedidos, facturas y deudas históricas se conservarán.'
      : status === 'suspended'
        ? '\n\nEl cliente no podrá iniciar sesión mientras esté suspendido. Sus registros históricos se conservarán.'
        : '\n\nEl cliente podrá volver a iniciar sesión.';
    if (!window.confirm(`¿Confirmas ${action} la cuenta de ${customer.name}?${warning}`)) return;
    setBusyId(customer.id);
    setFeedback(null);
    try {
      await setCustomerAccountStatus(customer.id, status);
      setFeedback({ type: 'success', text: `Cuenta de ${customer.name}: ${statusLabel[status].toLowerCase()}.` });
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'No se pudo guardar el cambio en Turso.' });
    } finally {
      setBusyId(null);
    }
  };

  if (currentUser?.role !== 'admin') {
    return <div className="max-w-5xl mx-auto p-6"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-800">Acceso restringido: solo el administrador puede gestionar las cuentas de clientes.</div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-700"><ShieldCheck className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Cuentas de clientes</h1>
            <p className="mt-1 text-sm text-slate-500">Administra el acceso de clientes sin borrar pedidos, facturas ni saldos históricos.</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={() => setFilter('active')} className={`rounded-xl border p-3 text-left ${filter === 'active' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <span className="block text-xs font-bold uppercase text-emerald-800">Activas</span><span className="mt-1 block text-2xl font-black text-slate-900">{counts.active}</span>
          </button>
          <button onClick={() => setFilter('suspended')} className={`rounded-xl border p-3 text-left ${filter === 'suspended' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <span className="block text-xs font-bold uppercase text-amber-800">Suspendidas</span><span className="mt-1 block text-2xl font-black text-slate-900">{counts.suspended}</span>
          </button>
          <button onClick={() => setFilter('deleted')} className={`rounded-xl border p-3 text-left ${filter === 'deleted' ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
            <span className="block text-xs font-bold uppercase text-rose-800">Eliminadas</span><span className="mt-1 block text-2xl font-black text-slate-900">{counts.deleted}</span>
          </button>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, RIF, correo o teléfono..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:bg-white" />
          </label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as AccountFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
            <option value="all">Todas las cuentas</option><option value="active">Activas</option><option value="suspended">Suspendidas</option><option value="deleted">Eliminadas</option>
          </select>
        </div>
      </header>

      {feedback && <div role="status" className={`rounded-xl border p-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{feedback.text}</div>}

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No hay cuentas que coincidan con estos filtros.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                <th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Estado de cuenta</th><th className="px-4 py-3 text-right">Acciones administrativas</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((customer) => {
                  const status = customer.accountStatus || 'active';
                  const busy = busyId === customer.id;
                  return <tr key={customer.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><UserRound className="h-5 w-5" /></div><div><div className="font-bold text-slate-900">{customer.name}</div><div className="text-xs text-slate-500">{customer.tradeName || customer.rif}</div><div className="font-mono text-[11px] text-slate-400">{customer.rif}</div></div></div></td>
                    <td className="px-4 py-4"><div>{customer.email || 'Sin correo'}</div><div className="text-xs text-slate-500">{customer.phone || 'Sin teléfono'}</div></td>
                    <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status === 'active' ? 'bg-emerald-50 text-emerald-800' : status === 'suspended' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'}`}>{status === 'active' ? <CheckCircle2 className="h-3.5 w-3.5" /> : status === 'suspended' ? <Ban className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}{statusLabel[status]}</span></td>
                    <td className="px-4 py-4"><div className="flex justify-end gap-2">
                      {status === 'active' && <button disabled={busy} onClick={() => void changeStatus(customer, 'suspended')} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"><Ban className="h-3.5 w-3.5" />Suspender</button>}
                      {status === 'suspended' && <button disabled={busy} onClick={() => void changeStatus(customer, 'active')} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Reactivar</button>}
                      {status !== 'deleted' && <button disabled={busy} onClick={() => void changeStatus(customer, 'deleted')} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Eliminar</button>}
                      {busy && <span className="self-center text-xs text-slate-500">Guardando…</span>}
                    </div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Eliminar una cuenta la deshabilita para iniciar sesión, pero no borra movimientos financieros ni pedidos asociados. Esta protección evita perder trazabilidad contable.</p></div>
    </div>
  );
};
