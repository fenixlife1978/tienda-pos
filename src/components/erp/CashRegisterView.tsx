import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatBs, formatUSD } from '../../utils/formatUtils';
import { terminalIdentity } from '../../services/terminalIdentity';
import {
  WalletCards,
  LockKeyhole,
  UnlockKeyhole,
  Printer,
  FileText,
  Settings2,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

type CashMovementType = 'ingreso' | 'egreso' | 'retiro' | 'deposito';

interface CashSession {
  id: string;
  terminalId: string;
  openedAt: string;
  openedBy: string;
  openingBs: number;
  openingUSD: number;
  closedAt?: string;
  closedBy?: string;
  closingBs?: number;
  closingUSD?: number;
  expectedBs?: number;
  expectedUSD?: number;
  differenceBs?: number;
  differenceUSD?: number;
  status: 'open' | 'closed';
}

interface CashMovement {
  id: string;
  sessionId: string;
  terminalId: string;
  type: CashMovementType;
  currency: 'Bs' | 'USD';
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

const SESSION_KEY = 'omni_cash_session_v2';
const HISTORY_KEY = 'omni_cash_sessions_history_v2';
const MOVES_KEY = 'omni_cash_moves_v2';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const CashRegisterView: React.FC = () => {
  const { orders, currentUser, settings, updateSettings } = useApp();
  const terminalId = terminalIdentity.getId();

  const [session, setSession] = useState<CashSession | null>(() =>
    readJson<CashSession | null>(SESSION_KEY, null)
  );
  const [history, setHistory] = useState<CashSession[]>(() =>
    readJson<CashSession[]>(HISTORY_KEY, [])
  );
  const [movements, setMovements] = useState<CashMovement[]>(() =>
    readJson<CashMovement[]>(MOVES_KEY, [])
  );

  const [openingBs, setOpeningBs] = useState('');
  const [openingUSD, setOpeningUSD] = useState('');
  const [closingBs, setClosingBs] = useState('');
  const [closingUSD, setClosingUSD] = useState('');
  const [movementType, setMovementType] = useState<CashMovementType>('egreso');
  const [movementCurrency, setMovementCurrency] = useState<'Bs' | 'USD'>('Bs');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const persistSession = (next: CashSession | null) => {
    setSession(next);
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  };

  const persistHistory = (next: CashSession[]) => {
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 100)));
  };

  const persistMovements = (next: CashMovement[]) => {
    setMovements(next);
    localStorage.setItem(MOVES_KEY, JSON.stringify(next.slice(-500)));
  };

  const posOrders = useMemo(
    () =>
      session
        ? orders.filter(
            (o) =>
              o.channel === 'pos' &&
              o.createdAt >= session.openedAt &&
              o.createdAt <= (session.closedAt || new Date().toISOString()) &&
              !(o as any).isVoided
          )
        : [],
    [orders, session]
  );

  const salesByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    for (const order of posOrders) {
      if (order.paymentSplits?.length) {
        for (const split of order.paymentSplits) {
          map[split.method] = (map[split.method] || 0) + split.amountUSD;
        }
      } else {
        map[order.paymentMethod] = (map[order.paymentMethod] || 0) + order.totalUSD;
      }
    }
    return map;
  }, [posOrders]);

  const sessionMovements = useMemo(
    () => (session ? movements.filter((m) => m.sessionId === session.id) : []),
    [movements, session]
  );

  const { cashSalesUSD, cashSalesBs } = useMemo(() => {
    let usd = 0;
    let bs = 0;

    for (const order of posOrders) {
      if (order.paymentSplits?.length) {
        for (const split of order.paymentSplits) {
          if (split.method === 'efectivo_usd' || split.method === 'divisas_efectivo') {
            usd += split.amountUSD;
          }
          if (split.method === 'efectivo_bs') {
            // amountBs is the actual cash received in bolívares.
            bs += split.amountBs || split.amountUSD * order.bcvRate;
          }
        }
      } else if (order.paymentMethod === 'efectivo_usd' || order.paymentMethod === 'divisas_efectivo') {
        usd += order.totalUSD;
      } else if (order.paymentMethod === 'efectivo_bs') {
        bs += order.totalBs;
      }
    }

    return { cashSalesUSD: Number(usd.toFixed(2)), cashSalesBs: Number(bs.toFixed(2)) };
  }, [posOrders]);

  const refundCash = useMemo(() => {
    if (!session) return { usd: 0, bs: 0 };
    const refunds = readJson<Array<{ createdAt: string; refundSplits?: Array<{ method: string; amountUSD: number; amountBs: number }> }>>(
      'omni_sale_refunds_v1',
      []
    );
    let usd = 0;
    let bs = 0;
    for (const refund of refunds) {
      if (refund.createdAt < session.openedAt) continue;
      for (const split of refund.refundSplits || []) {
        if (split.method === 'efectivo_usd' || split.method === 'divisas_efectivo') usd += split.amountUSD;
        if (split.method === 'efectivo_bs') bs += split.amountBs;
      }
    }
    return { usd: Number(usd.toFixed(2)), bs: Number(bs.toFixed(2)) };
  }, [session, orders]);

  const movementCashUSD = sessionMovements
    .filter((m) => m.currency === 'USD')
    .reduce((sum, m) => sum + (m.type === 'ingreso' || m.type === 'deposito' ? m.amount : -m.amount), 0);

  const movementCashBs = sessionMovements
    .filter((m) => m.currency === 'Bs')
    .reduce((sum, m) => sum + (m.type === 'ingreso' || m.type === 'deposito' ? m.amount : -m.amount), 0);

  const expectedUSD = useMemo(
    () => (session?.openingUSD || 0) + cashSalesUSD + movementCashUSD + refundCash.usd,
    [session, cashSalesUSD, movementCashUSD, refundCash.usd]
  );

  const expectedBs = useMemo(
    () => (session?.openingBs || 0) + cashSalesBs + movementCashBs + refundCash.bs,
    [session, cashSalesBs, movementCashBs, refundCash.bs, settings.bcvRate]
  );

  const totalSalesUSD = posOrders.reduce((sum, order) => sum + order.totalUSD, 0);
  const printerMode = settings.printerMode || 'thermal';

  const open = () => {
    if (session) {
      alert('Ya existe una caja abierta en este terminal.');
      return;
    }

    const next: CashSession = {
      id: crypto.randomUUID(),
      terminalId,
      openedAt: new Date().toISOString(),
      openedBy: currentUser.name || 'Usuario',
      openingBs: Number(openingBs) || 0,
      openingUSD: Number(openingUSD) || 0,
      status: 'open',
    };

    persistSession(next);
    setOpeningBs('');
    setOpeningUSD('');
  };

  const addMovement = () => {
    if (!session) {
      alert('Primero debes abrir la caja.');
      return;
    }

    const amount = Number(movementAmount);
    const reason = movementReason.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Indica un monto válido mayor que cero.');
      return;
    }
    if (!reason) {
      alert('Indica el motivo del movimiento de caja.');
      return;
    }

    const movement: CashMovement = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      terminalId,
      type: movementType,
      currency: movementCurrency,
      amount: Number(amount.toFixed(2)),
      reason,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name || 'Usuario',
    };

    persistMovements([...movements, movement]);
    setMovementAmount('');
    setMovementReason('');
  };

  const close = () => {
    if (!session) return;

    const countedBs = Number(closingBs) || 0;
    const countedUSD = Number(closingUSD) || 0;
    const closedAt = new Date().toISOString();

    const closed: CashSession = {
      ...session,
      closedAt,
      closedBy: currentUser.name || 'Usuario',
      closingBs: countedBs,
      closingUSD: countedUSD,
      expectedBs: Number(expectedBs.toFixed(2)),
      expectedUSD: Number(expectedUSD.toFixed(2)),
      differenceBs: Number((countedBs - expectedBs).toFixed(2)),
      differenceUSD: Number((countedUSD - expectedUSD).toFixed(2)),
      status: 'closed',
    };

    persistHistory([closed, ...history]);
    persistSession(null);
    setClosingBs('');
    setClosingUSD('');
  };

  const printReport = (kind: 'X' | 'Z') => {
    localStorage.setItem(
      'omni_last_cash_report',
      JSON.stringify({
        kind,
        terminalId,
        generatedAt: new Date().toISOString(),
        session,
        salesUSD: totalSalesUSD,
        salesByMethod,
        expectedBs,
        expectedUSD,
        printerMode,
      })
    );
    window.print();
  };

  const lastClosed = history[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <WalletCards className="w-5 h-5 text-indigo-600" />
            Caja & Arqueo
          </h2>
          <p className="text-xs text-slate-500">
            Apertura, movimientos, conciliación de efectivo, Reporte X y cierre Z por terminal.
          </p>
        </div>
        <span
          className={session ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}
          style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800 }}
        >
          {session ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
        </span>
      </div>

      <div className="grid xl:grid-cols-4 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold flex items-center gap-2">
            {session ? (
              <UnlockKeyhole className="w-4 h-4 text-emerald-600" />
            ) : (
              <LockKeyhole className="w-4 h-4 text-slate-500" />
            )}
            {session ? 'Sesión activa' : 'Apertura de caja'}
          </h3>

          {!session ? (
            <>
              <input type="number" min="0" step="0.01" placeholder="Fondo inicial Bs." value={openingBs} onChange={(e) => setOpeningBs(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input type="number" min="0" step="0.01" placeholder="Fondo inicial USD" value={openingUSD} onChange={(e) => setOpeningUSD(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <button onClick={open} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 font-bold transition">
                Abrir Caja
              </button>
            </>
          ) : (
            <>
              <div className="text-xs space-y-1 text-slate-600">
                <div>Terminal: <b>{session.terminalId}</b></div>
                <div>Apertura: {new Date(session.openedAt).toLocaleString('es-VE')}</div>
                <div>Usuario: <b>{session.openedBy}</b></div>
                <div>Fondo: {formatBs(session.openingBs)} + {formatUSD(session.openingUSD)}</div>
              </div>
              <input type="number" min="0" step="0.01" placeholder="Conteo final Bs." value={closingBs} onChange={(e) => setClosingBs(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input type="number" min="0" step="0.01" placeholder="Conteo final USD" value={closingUSD} onChange={(e) => setClosingUSD(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <button onClick={close} className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-lg py-2 font-bold transition">
                Cerrar Caja / Arqueo Z
              </button>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold mb-3">Resumen de ventas</h3>
          <div className="text-2xl font-black text-indigo-700">{formatUSD(totalSalesUSD)}</div>
          <div className="text-xs text-slate-500 mb-3">Ventas POS de la sesión actual</div>
          <div className="space-y-1 text-xs">
            {Object.entries(salesByMethod).map(([method, value]) => (
              <div key={method} className="flex justify-between gap-2">
                <span>{method.replace(/_/g, ' ')}</span>
                <b>{formatUSD(value)}</b>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t text-xs space-y-1">
            <div className="flex justify-between"><span>Efectivo USD</span><b>{formatUSD(cashSalesUSD)}</b></div>
            <div className="flex justify-between"><span>Efectivo Bs</span><b>{formatBs(cashSalesBs)}</b></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><ArrowUpFromLine className="w-4 h-4 text-indigo-600" />Movimiento de caja</h3>
          <div className="grid grid-cols-2 gap-2">
            <select value={movementType} onChange={(e) => setMovementType(e.target.value as CashMovementType)} className="border border-slate-200 rounded-lg px-2 py-2 text-xs">
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
              <option value="retiro">Retiro</option>
              <option value="deposito">Depósito</option>
            </select>
            <select value={movementCurrency} onChange={(e) => setMovementCurrency(e.target.value as 'Bs' | 'USD')} className="border border-slate-200 rounded-lg px-2 py-2 text-xs">
              <option value="Bs">Bs.</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <input type="number" min="0" step="0.01" placeholder="Monto" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input type="text" placeholder="Motivo / referencia" value={movementReason} onChange={(e) => setMovementReason(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <button onClick={addMovement} disabled={!session} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg py-2 font-bold transition">
            Registrar movimiento
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><Settings2 className="w-4 h-4 text-indigo-600" />Conciliación</h3>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Esperado Bs.</span><b>{formatBs(expectedBs)}</b></div>
            <div className="flex justify-between"><span>Esperado USD</span><b>{formatUSD(expectedUSD)}</b></div>
            {session && (
              <div className="mt-2 pt-2 border-t text-[11px] text-slate-500">
                El resultado compara el efectivo contado al cierre con ventas en efectivo y movimientos registrados.
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => updateSettings({ printerMode: 'thermal', thermalPaperWidth: 80 })} className={`rounded-lg border p-2 text-xs font-bold ${printerMode === 'thermal' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white'}`}>
              Térmica 80mm
            </button>
            <button onClick={() => updateSettings({ printerMode: 'fiscal' })} className={`rounded-lg border p-2 text-xs font-bold ${printerMode === 'fiscal' ? 'bg-amber-50 border-amber-500 text-amber-800' : 'bg-white'}`}>
              Modo fiscal
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => printReport('X')} className="flex-1 border rounded-lg py-2 text-xs font-bold flex justify-center gap-1"><Printer className="w-3.5 h-3.5" />Reporte X</button>
            <button onClick={() => printReport('Z')} className="flex-1 border rounded-lg py-2 text-xs font-bold flex justify-center gap-1"><FileText className="w-3.5 h-3.5" />Reporte Z</button>
          </div>
        </div>
      </div>

      {session && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm">Movimientos de la sesión</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr><th className="text-left p-3">Fecha</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Motivo</th><th className="text-right p-3">Monto</th><th className="text-left p-3">Usuario</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionMovements.length === 0 ? (
                  <tr><td colSpan={5} className="p-5 text-center text-slate-400">Sin movimientos manuales registrados.</td></tr>
                ) : (
                  sessionMovements.slice().reverse().map((m) => (
                    <tr key={m.id}>
                      <td className="p-3">{new Date(m.createdAt).toLocaleString('es-VE')}</td>
                      <td className="p-3 font-semibold">{m.type.toUpperCase()}</td>
                      <td className="p-3">{m.reason}</td>
                      <td className="p-3 text-right font-mono">{m.currency === 'Bs' ? formatBs(m.amount) : formatUSD(m.amount)}</td>
                      <td className="p-3">{m.createdBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lastClosed && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            {Math.abs(lastClosed.differenceBs || 0) < 0.01 && Math.abs(lastClosed.differenceUSD || 0) < 0.01 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
            Último cierre: {new Date(lastClosed.closedAt || lastClosed.openedAt).toLocaleString('es-VE')}
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div>Esperado Bs.<b className="block">{formatBs(lastClosed.expectedBs || 0)}</b></div>
            <div>Contado Bs.<b className="block">{formatBs(lastClosed.closingBs || 0)}</b></div>
            <div>Esperado USD<b className="block">{formatUSD(lastClosed.expectedUSD || 0)}</b></div>
            <div>Contado USD<b className="block">{formatUSD(lastClosed.closingUSD || 0)}</b></div>
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-400">
        El modo térmico funciona sin impresora fiscal. El modo fiscal queda preparado para una integración de controlador fiscal; no se asume hardware fiscal instalado.
      </div>
    </div>
  </div>;
};
