import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatBs, formatUSD } from '../../utils/formatUtils';
import { formatPaymentMethod } from '../../types';
import { terminalIdentity } from '../../services/terminalIdentity';
import { tursoService } from '../../services/tursoService';
import { printElement } from '../../utils/exportUtils';
import { CashReportPreview } from './CashReportPreview';
import type { CashReportData } from './CashReportPreview';
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
  const { orders, receivables, currentUser, settings, updateSettings } = useApp();
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
  const [cashReportPreview, setCashReportPreview] = useState<CashReportData | null>(() => readJson<CashReportData | null>('omni_last_cash_report_v2', null));

  useEffect(() => {
    if (!tursoService.isConfigured() || !navigator.onLine) return;
    let cancelled = false;
    const hydrate = async () => {
      try {
        const [remoteSession, remoteHistory, remoteMovements] = await Promise.all([
          tursoService.loadOpenCashSession(terminalId),
          tursoService.loadCashHistory(terminalId),
          tursoService.loadCashMovements(terminalId),
        ]);
        if (cancelled) return;
        if (remoteSession) {
          persistSession({
            id:String(remoteSession.id), terminalId:String(remoteSession.terminal_id), openedAt:String(remoteSession.opened_at),
            openedBy:String(remoteSession.opened_by), openingBs:Number(remoteSession.opening_bs||0), openingUSD:Number(remoteSession.opening_usd||0),
            status:'open',
          });
        }
        if (remoteHistory.length) persistHistory(remoteHistory.map((r:any)=>({
          id:String(r.id),terminalId:String(r.terminal_id),openedAt:String(r.opened_at),openedBy:String(r.opened_by),
          openingBs:Number(r.opening_bs||0),openingUSD:Number(r.opening_usd||0),closedAt:r.closed_at||undefined,closedBy:r.closed_by||undefined,
          closingBs:r.closing_bs==null?undefined:Number(r.closing_bs),closingUSD:r.closing_usd==null?undefined:Number(r.closing_usd),
          expectedBs:r.expected_bs==null?undefined:Number(r.expected_bs),expectedUSD:r.expected_usd==null?undefined:Number(r.expected_usd),
          differenceBs:r.difference_bs==null?undefined:Number(r.difference_bs),differenceUSD:r.difference_usd==null?undefined:Number(r.difference_usd),
          status:'closed',
        })));
        if (remoteMovements.length) persistMovements(remoteMovements.map((r:any)=>({
          id:String(r.id),sessionId:String(r.session_id),terminalId:String(r.terminal_id),type:r.type,currency:r.currency,
          amount:Number(r.amount||0),reason:String(r.reason),createdAt:String(r.created_at),createdBy:String(r.created_by),
        })));
      } catch (error) { console.warn('No se pudo hidratar Caja desde Turso:', error); }
    };
    hydrate();
    return () => { cancelled = true; };
  }, [terminalId]);

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
              !(o as any).isVoided &&
              // Las ventas nuevas tienen asociación explícita. El fallback por fecha
              // conserva compatibilidad con ventas históricas sin cashSessionId.
              (o.cashSessionId
                ? o.cashSessionId === session.id && o.customerId !== '__online__'
                : o.createdAt >= session.openedAt &&
                  o.createdAt <= (session.closedAt || new Date().toISOString()))
          )
        : [],
    [orders, session]
  );

  const cxcPayments = useMemo(() => {
    if (!session) return [];
    const from = new Date(session.openedAt).getTime();
    const to = new Date(session.closedAt || new Date().toISOString()).getTime();
    return receivables.flatMap(rec => (rec.paymentHistory || []).map(p => ({ rec, p }))).filter(({p}) => {
      if (p.cashSessionId) return p.cashSessionId === session.id;
      const ts = new Date(p.date).getTime();
      return !p.cashSessionId && ts >= from && ts <= to;
    });
  }, [receivables, session]);

  const cxcByMethod = useMemo(() => {
    const map: Record<string,{method:string;currency:'Bs'|'USD';amount:number}> = {};
    const add=(method:string,currency:'Bs'|'USD',amount:number)=>{
      if (!Number.isFinite(amount)||Math.abs(amount)<0.005) return;
      const key=method+'__'+currency;
      map[key] ??= {method,currency,amount:0};
      map[key].amount += amount;
    };
    for (const {p} of cxcPayments) {
      if (p.paymentSplits?.length) {
        for (const s of p.paymentSplits) add(s.method,s.currency,s.currency==='USD'?s.amountUSD:s.amountBs);
      } else {
        const currency=['efectivo_bs','transferencia_bs','pago_movil','biopago','tarjeta'].includes(p.paymentMethod)?'Bs':'USD';
        add(p.paymentMethod,currency,currency==='USD'?p.amountUSD:p.amountBs);
      }
    }
    return Object.values(map).sort((a,b)=>a.method.localeCompare(b.method));
  },[cxcPayments]);

  const { cxcCashSalesUSD, cxcCashSalesBs } = useMemo(() => {
    let usd=0, bs=0;
    for (const {p} of cxcPayments) {
      if (p.paymentSplits?.length) for (const s of p.paymentSplits) {
        if ((s.method==='efectivo_usd'||s.method==='divisas_efectivo') && s.currency==='USD') usd += s.amountUSD || 0;
        if (s.method==='efectivo_bs' && s.currency==='Bs') bs += s.amountBs || 0;
      } else {
        if ((p.paymentMethod==='efectivo_usd'||p.paymentMethod==='divisas_efectivo')) usd += p.amountUSD || 0;
        if (p.paymentMethod==='efectivo_bs') bs += p.amountBs || 0;
      }
    }
    return {cxcCashSalesUSD:Number(usd.toFixed(2)),cxcCashSalesBs:Number(bs.toFixed(2))};
  },[cxcPayments]);

  const salesByMethod = useMemo(() => {
    const map: Record<string, { method: string; currency: 'Bs' | 'USD'; amount: number }> = {};

    // En arqueo NO se convierten los medios de pago a una moneda común:
    // cada método se muestra en la moneda en la que se recibió originalmente.
    const currencyForMethod = (method: string): 'Bs' | 'USD' => {
      switch (method) {
        case 'efectivo_usd':
        case 'divisas_efectivo':
        case 'zelle':
        case 'transferencia_usd':
          return 'USD';
        default:
          return 'Bs';
      }
    };

    const add = (method: string, amount: number, currency: 'Bs' | 'USD') => {
      if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return;
      const key = `${method}__${currency}`;
      map[key] ??= { method, currency, amount: 0 };
      map[key].amount += amount;
    };

    for (const order of posOrders) {
      if (order.isReturned) continue;
      if (order.paymentSplits?.length) {
        for (const split of order.paymentSplits) {
          const currency = currencyForMethod(split.method);
          // amountBs / amountUSD contienen la equivalencia; para arqueo
          // tomamos exclusivamente el importe de la moneda original.
          add(
            split.method,
            currency === 'Bs' ? (split.amountBs || 0) : (split.amountUSD || 0),
            currency
          );
        }
      } else {
        const currency = currencyForMethod(order.paymentMethod);
        add(
          order.paymentMethod,
          currency === 'Bs' ? (order.totalBs || 0) : (order.totalUSD || 0),
          currency
        );
      }
    }

    return Object.values(map).sort((a, b) => a.method.localeCompare(b.method));
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
    let usd = 0;
    let bs = 0;
    for (const order of posOrders) {
      if (!order.isReturned || order.paymentStatus === 'a_credito') continue;
      if (order.paymentSplits?.length) {
        for (const split of order.paymentSplits) {
          if (split.method === 'efectivo_usd' || split.method === 'divisas_efectivo') usd -= split.amountUSD || 0;
          if (split.method === 'efectivo_bs') bs -= split.amountBs || (split.amountUSD || 0) * order.bcvRate;
        }
      } else if (order.paymentMethod === 'efectivo_usd' || order.paymentMethod === 'divisas_efectivo') {
        usd -= order.totalUSD;
      } else if (order.paymentMethod === 'efectivo_bs') {
        bs -= order.totalBs || 0;
      }
    }
    return { usd: Number(usd.toFixed(2)), bs: Number(bs.toFixed(2)) };
  }, [posOrders, session]);

  const movementCashUSD = sessionMovements
    .filter((m) => m.currency === 'USD')
    .reduce((sum, m) => sum + (m.type === 'ingreso' || m.type === 'deposito' ? m.amount : -m.amount), 0);

  const movementCashBs = sessionMovements
    .filter((m) => m.currency === 'Bs')
    .reduce((sum, m) => sum + (m.type === 'ingreso' || m.type === 'deposito' ? m.amount : -m.amount), 0);

  const expectedUSD = useMemo(
    () => (session?.openingUSD || 0) + cashSalesUSD + cxcCashSalesUSD + movementCashUSD + refundCash.usd,
    [session, cashSalesUSD, cxcCashSalesUSD, movementCashUSD, refundCash.usd]
  );

  const expectedBs = useMemo(
    () => (session?.openingBs || 0) + cashSalesBs + cxcCashSalesBs + movementCashBs + refundCash.bs,
    [session, cashSalesBs, cxcCashSalesBs, movementCashBs, refundCash.bs]
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
    if (tursoService.isConfigured()) tursoService.saveCashSession(next).catch(console.warn);
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
    if (tursoService.isConfigured()) tursoService.saveCashMovement(movement).catch(console.warn);
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

    const zReport: CashReportData = {
      kind: 'Z',
      terminalId: closed.terminalId,
      generatedAt: closedAt,
      openedAt: closed.openedAt,
      openedBy: closed.openedBy,
      closedAt: closed.closedAt,
      closedBy: closed.closedBy,
      openingBs: closed.openingBs,
      openingUSD: closed.openingUSD,
      salesUSD: totalSalesUSD,
      salesByMethod,
      cxcByMethod,
      cxcCashSalesBs,
      cxcCashSalesUSD,
      expectedBs: closed.expectedBs || 0,
      expectedUSD: closed.expectedUSD || 0,
      closingBs: closed.closingBs,
      closingUSD: closed.closingUSD,
      differenceBs: closed.differenceBs,
      differenceUSD: closed.differenceUSD,
      movementBs: movementCashBs,
      movementUSD: movementCashUSD,
    };
    localStorage.setItem('omni_last_cash_report_v2', JSON.stringify(zReport));
    localStorage.setItem('omni_last_cash_report', JSON.stringify(zReport));
    persistHistory([closed, ...history]);
    if (tursoService.isConfigured()) tursoService.saveCashSession(closed).catch(console.warn);
    persistSession(null);
    setClosingBs('');
    setClosingUSD('');
  };

  const buildCashReport = (kind: 'X' | 'Z'): CashReportData | null => {
    const stored = readJson<CashReportData | null>('omni_last_cash_report_v2', null);
    if (!session && kind === 'Z' && stored?.kind === 'Z') return stored;
    const base = session || (kind === 'Z' ? lastClosed : null);
    if (!base) {
      alert(`No hay una sesión de caja abierta para generar el Reporte ${kind}.`);
      return null;
    }
    return {
      kind,
      terminalId: base.terminalId,
      generatedAt: new Date().toISOString(),
      openedAt: base.openedAt,
      openedBy: base.openedBy,
      closedAt: kind === 'Z' ? base.closedAt : undefined,
      closedBy: kind === 'Z' ? base.closedBy : undefined,
      openingBs: base.openingBs || 0,
      openingUSD: base.openingUSD || 0,
      salesUSD: totalSalesUSD,
      salesByMethod,
      cxcByMethod,
      cxcCashSalesBs,
      cxcCashSalesUSD,
      expectedBs,
      expectedUSD,
      closingBs: kind === 'Z' ? base.closingBs : undefined,
      closingUSD: kind === 'Z' ? base.closingUSD : undefined,
      differenceBs: kind === 'Z' ? base.differenceBs : undefined,
      differenceUSD: kind === 'Z' ? base.differenceUSD : undefined,
      movementBs: movementCashBs,
      movementUSD: movementCashUSD,
    };
  };

  const printReport = (kind: 'X' | 'Z') => {
    const report = buildCashReport(kind);
    if (!report) return;
    localStorage.setItem('omni_last_cash_report_v2', JSON.stringify(report));
    localStorage.setItem('omni_last_cash_report', JSON.stringify(report));
    setCashReportPreview(report);
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
            {salesByMethod.length === 0 ? (
              <div className="text-slate-400">Sin ventas cobradas en esta sesión.</div>
            ) : (
              salesByMethod.map(({ method, currency, amount }) => (
                <div key={`${method}-${currency}`} className="flex justify-between gap-2">
                  <span>{formatPaymentMethod(method)}</span>
                  <b>{currency === 'Bs' ? formatBs(amount) : formatUSD(amount)}</b>
                </div>
              ))
            )}
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
            <button onClick={() => printReport('X')} disabled={!session} className="flex-1 border rounded-lg py-2 text-xs font-bold flex justify-center gap-1 disabled:opacity-40"><Printer className="w-3.5 h-3.5" />Vista previa X</button>
            <button onClick={() => printReport('Z')} className="flex-1 border rounded-lg py-2 text-xs font-bold flex justify-center gap-1"><FileText className="w-3.5 h-3.5" />Vista previa Z</button>
          </div>
          <div className="text-[10px] text-slate-500">
            Ambos reportes se preparan en ancho real de 80 mm para impresión térmica.
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

      <CashReportPreview
        data={cashReportPreview}
        open={!!cashReportPreview}
        onClose={() => setCashReportPreview(null)}
        onPrint={() => printElement('cash-report-thermal-preview', { format: 'thermal80', title: `Reporte ${cashReportPreview?.kind || ''} - Caja` })}
      />

      <div className="text-[10px] text-slate-400">
        El modo térmico funciona sin impresora fiscal. El modo fiscal queda preparado para una integración de controlador fiscal; no se asume hardware fiscal instalado.
      </div>
    </div>
  );
};
