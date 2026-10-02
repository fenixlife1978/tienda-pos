import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatBs, formatUSD } from '../../utils/formatUtils';
import { formatPaymentMethod, Order } from '../../types';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  ShoppingCart,
  WalletCards,
  CreditCard,
  Package,
  BarChart3,
} from 'lucide-react';

type Period = 'hoy' | 'ayer' | 'mes' | 'mes_anterior' | 'custom';

const localDateKey = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dateInputValue = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isCountableSale = (o: Order) =>
  o.channel === 'pos' || (o.channel === 'online' && !!o.posRegisteredAt);

export const SalesManagementView: React.FC = () => {
  const { orders, users } = useApp();
  const now = new Date();
  const [period, setPeriod] = useState<Period>('hoy');
  const [fromDate, setFromDate] = useState(dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(dateInputValue(now));
  const [terminalFilter, setTerminalFilter] = useState('all');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const terminals = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (isCountableSale(o) && o.terminalId) map.set(o.terminalId, o.terminalId);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders, refreshKey]);

  const cashiers = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach((o) => {
      if (isCountableSale(o) && o.posRegisteredBy) ids.add(o.posRegisteredBy);
    });
    return Array.from(ids).map((id) => ({
      id,
      name: users.find((u) => u.id === id)?.name || id,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, users, refreshKey]);

  const periodRange = useMemo(() => {
    const d = new Date();
    if (period === 'hoy') {
      const key = dateInputValue(d);
      return { from: key, to: key };
    }
    if (period === 'ayer') {
      d.setDate(d.getDate() - 1);
      const key = dateInputValue(d);
      return { from: key, to: key };
    }
    if (period === 'mes') {
      return {
        from: dateInputValue(new Date(d.getFullYear(), d.getMonth(), 1)),
        to: dateInputValue(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      };
    }
    if (period === 'mes_anterior') {
      return {
        from: dateInputValue(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
        to: dateInputValue(new Date(d.getFullYear(), d.getMonth(), 0)),
      };
    }
    return { from: fromDate, to: toDate };
  }, [period, fromDate, toDate, refreshKey]);

  const filteredSales = useMemo(() => {
    const from = periodRange.from;
    const to = periodRange.to;
    const q = search.trim().toLowerCase();

    return orders
      .filter(isCountableSale)
      .filter((o) => {
        const day = localDateKey(o.posRegisteredAt || o.createdAt);
        if (!day || day < from || day > to) return false;
        if (terminalFilter !== 'all' && o.terminalId !== terminalFilter) return false;
        if (cashierFilter !== 'all' && o.posRegisteredBy !== cashierFilter) return false;
        if (paymentFilter !== 'all' && o.paymentMethod !== paymentFilter) return false;
        if (statusFilter === 'vigentes' && (o.isVoided || o.isReturned)) return false;
        if (statusFilter === 'anuladas' && !o.isVoided) return false;
        if (statusFilter === 'devueltas' && !o.isReturned) return false;
        if (q) {
          const haystack = [
            o.orderNumber,
            o.id,
            o.customerName,
            o.customerRif,
            o.terminalId,
            o.posRegisteredBy,
            ...o.items.map((i) => i.productName),
          ].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.posRegisteredAt || b.createdAt).getTime() - new Date(a.posRegisteredAt || a.createdAt).getTime());
  }, [orders, periodRange, terminalFilter, cashierFilter, paymentFilter, statusFilter, search, refreshKey]);

  const summary = useMemo(() => {
    const active = filteredSales.filter((o) => !o.isVoided && !o.isReturned);
    return {
      count: active.length,
      grossUSD: active.reduce((s, o) => s + Number(o.totalUSD || 0), 0),
      grossBs: active.reduce((s, o) => s + Number(o.totalBs || 0), 0),
      creditUSD: active.filter((o) => o.paymentMethod === 'credito' || o.paymentStatus === 'a_credito').reduce((s, o) => s + Number(o.totalUSD || 0), 0),
      cashUSD: active.reduce((s, o) => s + (o.paymentSplits || []).filter((p) => p.method === 'efectivo_usd' || p.method === 'divisas_efectivo').reduce((a, p) => a + Number(p.amountUSD || 0), 0), 0),
      cashBs: active.reduce((s, o) => s + (o.paymentSplits || []).filter((p) => p.method === 'efectivo_bs').reduce((a, p) => a + Number(p.amountBs || 0), 0), 0),
      voided: filteredSales.filter((o) => o.isVoided).length,
      returned: filteredSales.filter((o) => o.isReturned).length,
    };
  }, [filteredSales]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; usd: number }>();
    filteredSales.filter((o) => !o.isVoided && !o.isReturned).forEach((o) => {
      const key = o.paymentMethod || 'sin método';
      const current = map.get(key) || { count: 0, usd: 0 };
      current.count += 1;
      current.usd += Number(o.totalUSD || 0);
      map.set(key, current);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].usd - a[1].usd);
  }, [filteredSales]);

  const productSummary = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; usd: number }>();
    filteredSales.filter((o) => !o.isVoided && !o.isReturned).forEach((o) => o.items.forEach((item) => {
      const current = map.get(item.productId) || { name: item.productName, qty: 0, usd: 0 };
      current.qty += Number(item.quantity || 0);
      current.usd += Number(item.subtotalUSD || 0) + Number(item.taxUSD || 0);
      map.set(item.productId, current);
    }));
    return Array.from(map.values()).sort((a, b) => b.usd - a.usd).slice(0, 12);
  }, [filteredSales]);

  const clearFilters = () => {
    setTerminalFilter('all');
    setCashierFilter('all');
    setPaymentFilter('all');
    setStatusFilter('all');
    setSearch('');
    setPeriod('hoy');
  };

  const setQuickPeriod = (p: Period) => {
    setPeriod(p);
    if (p === 'custom') return;
  };

  return (
    <section className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              Gestión de Ventas
            </h1>
            <p className="text-xs text-slate-500 mt-1">Historial detallado de ventas realmente registradas en POS y confirmadas en caja.</p>
          </div>
          <button onClick={() => setRefreshKey((v) => v + 1)} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {([
              ['hoy', 'Hoy'], ['ayer', 'Ayer'], ['mes', 'Este mes'], ['mes_anterior', 'Mes anterior'], ['custom', 'Desde / Hasta'],
            ] as [Period, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setQuickPeriod(id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${period === id ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex flex-wrap items-end gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
              <label className="text-xs font-bold text-slate-600">Desde<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="block mt-1 px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white" /></label>
              <label className="text-xs font-bold text-slate-600">Hasta<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="block mt-1 px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white" /></label>
              <CalendarDays className="w-4 h-4 text-slate-400 mb-2" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Venta, cliente, producto, caja..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
            <select value={terminalFilter} onChange={(e) => setTerminalFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
              <option value="all">Todas las cajas</option>
              {terminals.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <select value={cashierFilter} onChange={(e) => setCashierFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
              <option value="all">Todos los cajeros</option>
              {cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
              <option value="all">Todos los pagos</option>
              {Array.from(new Set(filteredSales.map((o) => o.paymentMethod))).map((m) => <option key={m} value={m}>{formatPaymentMethod(m)}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
              <option value="all">Todos los estados</option>
              <option value="vigentes">Solo vigentes</option>
              <option value="anuladas">Anuladas</option>
              <option value="devueltas">Devueltas</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button onClick={clearFilters} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"><Filter className="w-3.5 h-3.5" /> Limpiar filtros</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          ['Ventas', summary.count, ''],
          ['Total USD', formatUSD(summary.grossUSD), ''],
          ['Total Bs', formatBs(summary.grossBs), ''],
          ['Crédito', formatUSD(summary.creditUSD), ''],
          ['Efectivo', `${formatUSD(summary.cashUSD)} / ${formatBs(summary.cashBs)}`, ''],
          ['Anul./Dev.', `${summary.voided} / ${summary.returned}`, ''],
        ].map(([label, value], i) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <div className="text-[10px] uppercase tracking-wide font-bold text-slate-400">{label}</div>
            <div className="mt-1 text-sm font-black text-slate-900 truncate">{value}</div>
            {i === 1 && <WalletCards className="w-4 h-4 text-emerald-500 mt-2" />}
            {i === 3 && <CreditCard className="w-4 h-4 text-amber-500 mt-2" />}
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-black text-sm text-slate-900">Historial detallado <span className="text-slate-400 font-medium">({filteredSales.length})</span></div>
          <div className="text-[11px] text-slate-500">{periodRange.from} → {periodRange.to}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="w-8"></th><th className="text-left px-3 py-2">Fecha / Hora</th><th className="text-left px-3 py-2">Venta</th><th className="text-left px-3 py-2">Cliente</th><th className="text-left px-3 py-2">Caja</th><th className="text-left px-3 py-2">Método</th><th className="text-right px-3 py-2">Total USD</th><th className="text-right px-3 py-2">Total Bs</th><th className="text-left px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => {
                const isOpen = expanded === sale.id;
                const cashier = users.find((u) => u.id === sale.posRegisteredBy)?.name || sale.posRegisteredBy || '—';
                return (
                  <React.Fragment key={sale.id}>
                    <tr className={`hover:bg-slate-50 ${sale.isVoided || sale.isReturned ? 'opacity-60' : ''}`}>
                      <td className="px-2"><button onClick={() => setExpanded(isOpen ? null : sale.id)} className="p-1 rounded hover:bg-slate-200">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button></td>
                      <td className="px-3 py-3 whitespace-nowrap">{new Date(sale.posRegisteredAt || sale.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-3 font-bold">{sale.orderNumber}</td>
                      <td className="px-3 py-3">{sale.customerName || 'Cliente general'}</td>
                      <td className="px-3 py-3"><div className="font-semibold">{sale.terminalId || '—'}</div><div className="text-[10px] text-slate-400">{cashier}</div></td>
                      <td className="px-3 py-3">{formatPaymentMethod(sale.paymentMethod)}</td>
                      <td className="px-3 py-3 text-right font-bold">{formatUSD(Number(sale.totalUSD || 0))}</td>
                      <td className="px-3 py-3 text-right">{formatBs(Number(sale.totalBs || 0))}</td>
                      <td className="px-3 py-3">{sale.isVoided ? <span className="text-rose-600 font-bold">ANULADA</span> : sale.isReturned ? <span className="text-amber-600 font-bold">DEVUELTA</span> : <span className="text-emerald-600 font-bold">REGISTRADA</span>}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={9} className="px-5 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                            <div><span className="text-[10px] text-slate-400 uppercase">BCV</span><div className="font-bold">{Number(sale.bcvRate || 0).toFixed(2)} Bs/USD</div></div>
                            <div><span className="text-[10px] text-slate-400 uppercase">Sesión</span><div className="font-bold">{sale.cashSessionId || '—'}</div></div>
                            <div><span className="text-[10px] text-slate-400 uppercase">IVA</span><div className="font-bold">{formatUSD(Number(sale.taxUSD || 0))}</div></div>
                            <div><span className="text-[10px] text-slate-400 uppercase">Subtotal</span><div className="font-bold">{formatUSD(Number(sale.subtotalUSD || 0))}</div></div>
                            <div><span className="text-[10px] text-slate-400 uppercase">Referencia</span><div className="font-bold">{sale.paymentReference || '—'}</div></div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead><tr className="text-left text-[10px] uppercase text-slate-400"><th className="py-2">Producto</th><th className="py-2 text-right">Cantidad</th><th className="py-2 text-right">Precio unit.</th><th className="py-2 text-right">Subtotal</th><th className="py-2 text-right">IVA</th><th className="py-2 text-right">Total</th></tr></thead>
                              <tbody className="divide-y divide-slate-200">
                                {sale.items.map((item, idx) => (
                                  <tr key={`${sale.id}-${idx}`}><td className="py-2 font-semibold">{item.productName}{item.presentationName ? ` · ${item.presentationName}` : ''}</td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">{formatUSD(Number(item.unitPriceUSD || 0))}</td><td className="py-2 text-right">{formatUSD(Number(item.subtotalUSD || 0))}</td><td className="py-2 text-right">{formatUSD(Number(item.taxUSD || 0))}</td><td className="py-2 text-right font-bold">{formatUSD(Number(item.subtotalUSD || 0) + Number(item.taxUSD || 0))}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {!!sale.paymentSplits?.length && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {sale.paymentSplits.map((p) => <span key={p.id} className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px]"><b>{formatPaymentMethod(p.method)}</b>: {formatUSD(Number(p.amountUSD || 0))}{p.amountBs ? ` · ${formatBs(Number(p.amountBs))}` : ''}{p.reference ? ` · Ref. ${p.reference}` : ''}</span>)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!filteredSales.length && <tr><td colSpan={9} className="py-12 text-center text-slate-400">No hay ventas que coincidan con los filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <h2 className="font-black text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-600" /> Distribución por método de pago</h2>
          <div className="mt-3 space-y-2">
            {paymentBreakdown.map(([method, value]) => <div key={method} className="flex items-center justify-between text-xs"><span>{formatPaymentMethod(method)} <span className="text-slate-400">({value.count})</span></span><b>{formatUSD(value.usd)}</b></div>)}
            {!paymentBreakdown.length && <div className="text-xs text-slate-400">Sin datos.</div>}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <h2 className="font-black text-sm flex items-center gap-2"><Package className="w-4 h-4 text-indigo-600" /> Productos más vendidos</h2>
          <div className="mt-3 space-y-2">
            {productSummary.map((p) => <div key={p.name} className="flex items-center justify-between text-xs gap-3"><span className="truncate">{p.name} <span className="text-slate-400">× {p.qty}</span></span><b className="whitespace-nowrap">{formatUSD(p.usd)}</b></div>)}
            {!productSummary.length && <div className="text-xs text-slate-400">Sin datos.</div>}
          </div>
        </div>
      </div>
    </section>
  );
};
