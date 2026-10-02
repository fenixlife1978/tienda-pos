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
  userId: string;
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

function readJson<T>(key: string, fallback: T, storage: Storage = localStorage): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const CashRegisterView: React.FC = () => {
  const { orders, receivables, currentUser, settings, updateSettings } = useApp();
  const terminalId = terminalIdentity.getAssignedId() || '';
  const sessionKey = terminalId ? `omni_cash_session_v3:${terminalId}` : '';
  const historyKey = terminalId ? `omni_cash_sessions_history_v3:${terminalId}` : '';
  const movesKey = terminalId ? `omni_cash_moves_v3:${terminalId}` : '';

  const [session, setSession] = useState<CashSession | null>(() =>
    sessionKey ? readJson<CashSession | null>(sessionKey, null, sessionStorage) : null
  );
  const [history, setHistory] = useState<CashSession[]>(() =>
    historyKey ? readJson<CashSession[]>(historyKey, []) : []
  );
  const [movements, setMovements] = useState<CashMovement[]>(() =>
    movesKey ? readJson<CashMovement[]>(movesKey, []) : []
  );

  const [openingBs, setOpeningBs] = useState('');
  const [openingUSD, setOpeningUSD] = useState('');
  const [closingBs, setClosingBs] = useState('');
  const [closingUSD, setClosingUSD] = useState('');
  const [movementType, setMovementType] = useState<CashMovementType>('egreso');
  const [movementCurrency, setMovementCurrency] = useState<'Bs' | 'USD'>('Bs');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  // Los reportes X/Z son efímeros: solo existen mientras el usuario los haya
  // invocado mediante su botón. Nunca se restauran desde localStorage.
  const [cashReportPreview, setCashReportPreview] = useState<CashReportData | null>(null);
  const [preZOpen, setPreZOpen] = useState(false);
  const [preZReal, setPreZReal] = useState<Record<string, string>>({});
  const [preZStatus, setPreZStatus] = useState<{ kind: 'ok' | 'positive' | 'negative'; bs: number; usd: number } | null>(null);
  const [historyBoxFilter, setHistoryBoxFilter] = useState('all');

  const arqueoMethods = [
    'efectivo_bs', 'efectivo_usd', 'zelle', 'pago_movil', 'transferencia_bs',
    'transferencia_usd', 'biopago', 'tarjeta', 'credito',
  ] as const;

  const sessionAllOrders = useMemo(() => {
    if (!session) return [];
    return orders.filter((o) =>
      (o.channel === 'pos' || (o.channel === 'online' && !!o.posRegisteredAt)) &&
      (o.cashSessionId === session.id ||
        (o.terminalId === terminalId && !o.cashSessionId &&
          o.createdAt >= session.openedAt &&
          o.createdAt <= new Date().toISOString()))
    );
  }, [orders, session, terminalId]);

  const openPreZ = () => {
    if (!session) {
      alert('Para ejecutar el corte Z primero debe abrirse una caja.');
      return;
    }
    setPreZReal({});
    setPreZStatus(null);
    setPreZOpen(true);
  };

  useEffect(() => {
    if (!tursoService.isConfigured() || !navigator.onLine) return;
    let cancelled = false;
    const hydrate = async () => {
      try {
        const [remoteSession, remoteHistory, remoteMovements] = await Promise.all([
          tursoService.loadOpenCashSession(terminalId, currentUser.id),
          tursoService.loadCashHistory(),
          tursoService.loadCashMovements(),
        ]);
        if (cancelled) return;
        if (remoteSession) {
          persistSession({
            id:String(remoteSession.id), terminalId:String(remoteSession.terminal_id), userId:String(remoteSession.user_id || currentUser.id), openedAt:String(remoteSession.opened_at),
            openedBy:String(remoteSession.opened_by), openingBs:Number(remoteSession.opening_bs||0), openingUSD:Number(remoteSession.opening_usd||0),
            status:'open',
          });
        }
        if (remoteHistory.length) persistHistory(remoteHistory.map((r:any)=>({
          id:String(r.id),terminalId:String(r.terminal_id),userId:String(r.user_id || ''),openedAt:String(r.opened_at),openedBy:String(r.opened_by),
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
    if (!sessionKey) return;
    if (next) sessionStorage.setItem(sessionKey, JSON.stringify(next));
    else sessionStorage.removeItem(sessionKey);
  };

  const persistHistory = (next: CashSession[]) => {
    setHistory(next);
    if (historyKey) localStorage.setItem(historyKey, JSON.stringify(next.slice(0, 100)));
  };

  const persistMovements = (next: CashMovement[]) => {
    setMovements(next);
    if (movesKey) localStorage.setItem(movesKey, JSON.stringify(next.slice(-500)));
  };

  const posOrders = useMemo(
    () =>
      session
        ? orders.filter(
            (o) =>
              (o.channel === 'pos' || (o.channel === 'online' && !!o.posRegisteredAt)) &&
              !(o as any).isVoided &&
              (o.terminalId === terminalId || o.cashSessionId === session.id || (!o.terminalId && o.documentSeries === terminalId)) &&
              // Las ventas nuevas tienen asociación explícita. El fallback histórico usa la serie
              // conserva compatibilidad con ventas históricas sin cashSessionId.
              (o.cashSessionId
                ? o.cashSessionId === session.id && o.customerId !== '__online__'
                : (o.terminalId === terminalId || o.documentSeries === terminalId) &&
                  o.createdAt >= session.openedAt &&
                  o.createdAt <= (session.closedAt || new Date().toISOString()))
          )
        : [],
    [orders, session, terminalId]
  );


  // Pedidos online aprobados se convierten en ventas contables al momento de la aprobación.
  // Se incluyen en ventas del período del arqueo aunque no pertenezcan físicamente a una caja POS.
  const approvedOnlineOrders = useMemo(
    () => {
      if (!session) return [];
      const from = new Date(session.openedAt).getTime();
      const to = new Date(session.closedAt || new Date().toISOString()).getTime();
      return orders.filter((o) =>
        o.channel === 'online' &&
        !o.cashSessionId &&
        o.orderStatus !== 'cancelado' &&
        !o.isVoided &&
        !!o.approvedAt &&
        new Date(o.approvedAt).getTime() >= from &&
        new Date(o.approvedAt).getTime() <= to
      );
    },
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

  const arqueoRows = useMemo(() => {
    const rows = arqueoMethods.map((method) => ({
      method,
      openingBs: method === 'efectivo_bs' ? Number(session?.openingBs || 0) : 0,
      openingUSD: method === 'efectivo_usd' ? Number(session?.openingUSD || 0) : 0,
      salesBs: 0, salesUSD: 0, cxcBs: 0, cxcUSD: 0,
      devAnuBs: 0, devAnuUSD: 0, plusBs: 0, plusUSD: 0, minusBs: 0, minusUSD: 0,
    }));

    const rowMap = new Map(rows.map((r) => [r.method, r]));
    const addSale = (order: any, sign = 1) => {
      const splits = order.paymentSplits?.length ? order.paymentSplits : [{
        method: order.paymentMethod, amountBs: order.totalBs, amountUSD: order.totalUSD,
      }];
      for (const split of splits) {
        const row = rowMap.get(split.method);
        if (!row) continue;
        const amountBs = Number(split.amountBs || 0);
        const amountUSD = Number(split.amountUSD || 0);
        if (sign < 0) {
          row.devAnuBs += amountBs;
          row.devAnuUSD += amountUSD;
        } else {
          row.salesBs += amountBs;
          row.salesUSD += amountUSD;
        }
      }
    };
    for (const order of sessionAllOrders) {
      if (order.isVoided || order.isReturned) addSale(order, -1);
      else addSale(order, 1);
    }
    for (const { p } of cxcPayments) {
      const splits = p.paymentSplits?.length ? p.paymentSplits : [{
        method: p.paymentMethod, currency: ['efectivo_bs','transferencia_bs','pago_movil','biopago','tarjeta'].includes(p.paymentMethod) ? 'Bs' : 'USD',
        amountBs: p.amountBs, amountUSD: p.amountUSD,
      }];
      for (const split of splits) {
        const row = rowMap.get(split.method);
        if (!row) continue;
        if (split.currency === 'Bs') row.cxcBs += Number(split.amountBs || 0);
        else row.cxcUSD += Number(split.amountUSD || 0);
      }
    }
    for (const movement of sessionMovements) {
      const method = movement.currency === 'Bs' ? 'efectivo_bs' : 'efectivo_usd';
      const row = rowMap.get(method);
      if (!row) continue;
      if (movement.type === 'ingreso' || movement.type === 'deposito') {
        if (movement.currency === 'Bs') row.plusBs += movement.amount;
        else row.plusUSD += movement.amount;
      } else {
        if (movement.currency === 'Bs') row.minusBs += movement.amount;
        else row.minusUSD += movement.amount;
      }
    }
    return rows.map((r) => {
      const currency = r.method === 'efectivo_bs' || r.method === 'pago_movil' || r.method === 'transferencia_bs' || r.method === 'biopago' || r.method === 'tarjeta'
        ? 'Bs' : 'USD';
      const system = currency === 'Bs'
        ? r.openingBs + r.salesBs + r.cxcBs + r.devAnuBs + r.plusBs - r.minusBs
        : r.openingUSD + r.salesUSD + r.cxcUSD + r.devAnuUSD + r.plusUSD - r.minusUSD;
      return { ...r, currency, system: Number(system.toFixed(2)) };
    });
  }, [session, sessionAllOrders, cxcPayments, sessionMovements]);

  const calculatePreZ = (values = preZReal) => {
    let bs = 0, usd = 0;
    for (const row of arqueoRows) {
      const raw = String(values[row.method] ?? '').trim().replace(',', '.');
      if (!raw) continue;
      const real = Number(raw);
      if (!Number.isFinite(real)) continue;
      const diff = real - row.system;
      if (row.currency === 'Bs') bs += diff;
      else usd += diff;
    }
    return { bs: Number(bs.toFixed(2)), usd: Number(usd.toFixed(2)) };
  };

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
  }, [posOrders, approvedOnlineOrders]);

  const sessionMovements = useMemo(
    () => (session ? movements.filter((m) => m.sessionId === session.id) : []),
    [movements, session]
  );

  const { cashSalesUSD, cashSalesBs } = useMemo(() => {
    let usd = 0;
    let bs = 0;

    for (const order of [...posOrders, ...approvedOnlineOrders]) {
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
  }, [posOrders, approvedOnlineOrders]);

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
    if (!terminalId) {
      alert('Esta sesión no tiene una caja/terminal asignada.');
      return;
    }
    if (session) {
      alert('Ya existe una caja abierta en este terminal.');
      return;
    }

    const next: CashSession = {
      id: crypto.randomUUID(),
      terminalId,
      openedAt: new Date().toISOString(),
      userId: currentUser.id,
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
    openPreZ();
  };

  const executeZ = () => {
    if (!session) return;
    const diff = calculatePreZ();
    setPreZStatus({
      kind: Math.abs(diff.bs) < 0.01 && Math.abs(diff.usd) < 0.01 ? 'ok' : (diff.bs > 0 || diff.usd > 0 ? 'positive' : 'negative'),
      bs: diff.bs,
      usd: diff.usd,
    });

    const realBs = Number(String(preZReal.efectivo_bs || '').replace(',', '.')) || 0;
    const realUSD = Number(String(preZReal.efectivo_usd || '').replace(',', '.')) || 0;
    const closedAt = new Date().toISOString();
    const closed: CashSession = {
      ...session,
      closedAt,
      closedBy: currentUser.name || 'Usuario',
      closingBs: realBs,
      closingUSD: realUSD,
      expectedBs: Number(expectedBs.toFixed(2)),
      expectedUSD: Number(expectedUSD.toFixed(2)),
      differenceBs: diff.bs,
      differenceUSD: diff.usd,
      status: 'closed',
    };
    // Z se ejecuta ahora: queda guardado en histórico aunque el reporte no se imprima.
    persistHistory([closed, ...history]);
    if (tursoService.isConfigured()) tursoService.saveCashSession(closed).catch(console.warn);

    const report: CashReportData = {
      kind: 'Z',
      terminalId: closed.terminalId,
      generatedAt: new Date().toISOString(),
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
    persistSession(null);
    setClosingBs('');
    setClosingUSD('');
    setPreZOpen(false);
    setCashReportPreview(report);
  };

  const buildCashReport = (kind: 'X' | 'Z', baseOverride?: CashSession): CashReportData | null => {
    const base = baseOverride || session || (kind === 'Z' ? lastClosed : null);
    if (!base) {
      alert(`No hay una sesión de caja abierta para generar el Reporte ${kind}.`);
      return null;
    }

    // X usa la sesión abierta en tiempo real. Z puede invocarse después del cierre;
    // en ese caso reconstruimos sus cifras desde la sesión cerrada y las ventas
    // persistidas, sin guardar el reporte en el navegador.
    if (kind === 'X' || (session && !baseOverride)) {
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
    }

    const reportOrders = orders.filter((o) =>
      (o.channel === 'pos' || (o.channel === 'online' && !!o.posRegisteredAt)) &&
      !o.isVoided &&
      (o.cashSessionId === base.id ||
        (o.terminalId === base.terminalId &&
          !o.cashSessionId &&
          o.createdAt >= base.openedAt &&
          o.createdAt <= (base.closedAt || new Date().toISOString())))
    );

    const reportSalesByMethod: Record<string, { method: string; currency: 'Bs' | 'USD'; amount: number }> = {};
    const reportCurrencyForMethod = (method: string): 'Bs' | 'USD' =>
      ['efectivo_usd', 'divisas_efectivo', 'zelle', 'transferencia_usd'].includes(method) ? 'USD' : 'Bs';
    const addReportSale = (method: string, amount: number, currency: 'Bs' | 'USD') => {
      if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return;
      const key = method + '__' + currency;
      reportSalesByMethod[key] ??= { method, currency, amount: 0 };
      reportSalesByMethod[key].amount += amount;
    };
    let reportCashUSD = 0;
    let reportCashBs = 0;
    for (const order of reportOrders) {
      if (order.isReturned) continue;
      if (order.paymentSplits?.length) {
        for (const split of order.paymentSplits) {
          const currency = reportCurrencyForMethod(split.method);
          addReportSale(split.method, currency === 'Bs' ? Number(split.amountBs || 0) : Number(split.amountUSD || 0), currency);
          if (split.method === 'efectivo_bs') reportCashBs += Number(split.amountBs || 0);
          if (split.method === 'efectivo_usd' || split.method === 'divisas_efectivo') reportCashUSD += Number(split.amountUSD || 0);
        }
      } else {
        const currency = reportCurrencyForMethod(order.paymentMethod);
        addReportSale(order.paymentMethod, currency === 'Bs' ? Number(order.totalBs || 0) : Number(order.totalUSD || 0), currency);
        if (order.paymentMethod === 'efectivo_bs') reportCashBs += Number(order.totalBs || 0);
        if (order.paymentMethod === 'efectivo_usd' || order.paymentMethod === 'divisas_efectivo') reportCashUSD += Number(order.totalUSD || 0);
      }
    }

    const reportCxc = receivables
      .flatMap(rec => (rec.paymentHistory || []).map(p => ({ rec, p })))
      .filter(({ p }) => p.cashSessionId === base.id);
    const reportCxcByMethod: Record<string, { method: string; currency: 'Bs' | 'USD'; amount: number }> = {};
    let reportCxcCashBs = 0;
    let reportCxcCashUSD = 0;
    for (const { p } of reportCxc) {
      if (p.paymentSplits?.length) {
        for (const split of p.paymentSplits) {
          const key = split.method + '__' + split.currency;
          reportCxcByMethod[key] ??= { method: split.method, currency: split.currency, amount: 0 };
          reportCxcByMethod[key].amount += split.currency === 'USD' ? Number(split.amountUSD || 0) : Number(split.amountBs || 0);
          if (split.method === 'efectivo_bs' && split.currency === 'Bs') reportCxcCashBs += Number(split.amountBs || 0);
          if ((split.method === 'efectivo_usd' || split.method === 'divisas_efectivo') && split.currency === 'USD') reportCxcCashUSD += Number(split.amountUSD || 0);
        }
      }
    }

    const reportMovementBs = movements
      .filter(m => m.sessionId === base.id && m.currency === 'Bs')
      .reduce((sum, m) => sum + (m.type === 'ingreso' || m.type === 'deposito' ? m.amount : -m.amount), 0);
    const reportMovementUSD = movements
      .filter(m => m.sessionId === base.id && m.currency === 'USD')
      .reduce((sum, m) => sum + (m.type === 'ingreso' || m.type === 'deposito' ? m.amount : -m.amount), 0);

    return {
      kind: 'Z',
      terminalId: base.terminalId,
      generatedAt: new Date().toISOString(),
      openedAt: base.openedAt,
      openedBy: base.openedBy,
      closedAt: base.closedAt,
      closedBy: base.closedBy,
      openingBs: base.openingBs || 0,
      openingUSD: base.openingUSD || 0,
      salesUSD: reportOrders.reduce((sum, order) => sum + Number(order.totalUSD || 0), 0),
      salesByMethod: Object.values(reportSalesByMethod).sort((a, b) => a.method.localeCompare(b.method)),
      cxcByMethod: Object.values(reportCxcByMethod).sort((a, b) => a.method.localeCompare(b.method)),
      cxcCashSalesBs: Number(reportCxcCashBs.toFixed(2)),
      cxcCashSalesUSD: Number(reportCxcCashUSD.toFixed(2)),
      expectedBs: Number(((base.openingBs || 0) + reportCashBs + reportCxcCashBs + reportMovementBs).toFixed(2)),
      expectedUSD: Number(((base.openingUSD || 0) + reportCashUSD + reportCxcCashUSD + reportMovementUSD).toFixed(2)),
      closingBs: base.closingBs,
      closingUSD: base.closingUSD,
      differenceBs: base.differenceBs,
      differenceUSD: base.differenceUSD,
      movementBs: reportMovementBs,
      movementUSD: reportMovementUSD,
    };
  };

  const printReport = (kind: 'X' | 'Z') => {
    const report = buildCashReport(kind);
    if (!report) return;
    // No persistimos X/Z: al cerrar el modal o recargar, desaparecen hasta
    // que el usuario vuelva a pulsar el botón correspondiente.
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
            <button onClick={openPreZ} disabled={!session} className="flex-1 border rounded-lg py-2 text-xs font-bold flex justify-center gap-1 disabled:opacity-40"><FileText className="w-3.5 h-3.5" />Vista previa Z</button>
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

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <div>
              <h3 className="font-bold text-sm">Historial de Cortes Z</h3>
              <p className="text-[11px] text-slate-500">Cortes cerrados conservados en Turso. Cada Z puede reimprimirse en 80 mm.</p>
            </div>
          </div>
          <select
            value={historyBoxFilter}
            onChange={(e) => setHistoryBoxFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold bg-white"
          >
            <option value="all">Todas las Cajas</option>
            {Array.from(new Set(history.map((z) => z.terminalId))).sort().map((box) => (
              <option key={box} value={box}>{box}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="text-left p-3">Fecha Z</th>
                <th className="text-left p-3">Caja</th>
                <th className="text-left p-3">Cajero</th>
                <th className="text-right p-3">Esperado Bs.</th>
                <th className="text-right p-3">Real Bs.</th>
                <th className="text-right p-3">DIF. Bs.</th>
                <th className="text-right p-3">Esperado USD</th>
                <th className="text-right p-3">Real USD</th>
                <th className="text-right p-3">DIF. USD</th>
                <th className="text-center p-3">Resultado</th>
                <th className="text-center p-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.filter((z) => historyBoxFilter === 'all' || z.terminalId === historyBoxFilter).length === 0 ? (
                <tr><td colSpan={11} className="p-6 text-center text-slate-400">No hay Cortes Z para el filtro seleccionado.</td></tr>
              ) : history
                .filter((z) => historyBoxFilter === 'all' || z.terminalId === historyBoxFilter)
                .map((z) => {
                  const dbs = Number(z.differenceBs || 0);
                  const dusd = Number(z.differenceUSD || 0);
                  const hasPositive = dbs > 0.01 || dusd > 0.01;
                  const hasNegative = dbs < -0.01 || dusd < -0.01;
                  const reconciled = !hasPositive && !hasNegative;
                  const result = reconciled ? 'CONCILIADO' : hasPositive && !hasNegative ? 'SOBRANTE' : hasNegative && !hasPositive ? 'FALTANTE' : 'DIFERENCIA MIXTA';
                  return (
                    <tr key={z.id}>
                      <td className="p-3 whitespace-nowrap">{new Date(z.closedAt || z.openedAt).toLocaleString('es-VE')}</td>
                      <td className="p-3 font-bold">{z.terminalId}</td>
                      <td className="p-3">{z.closedBy || z.openedBy || '—'}</td>
                      <td className="p-3 text-right font-mono">{formatBs(z.expectedBs || 0)}</td>
                      <td className="p-3 text-right font-mono">{formatBs(z.closingBs || 0)}</td>
                      <td className={`p-3 text-right font-mono ${Math.abs(dbs) < 0.01 ? 'text-slate-500' : dbs > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatBs(dbs)}</td>
                      <td className="p-3 text-right font-mono">{formatUSD(z.expectedUSD || 0)}</td>
                      <td className="p-3 text-right font-mono">{formatUSD(z.closingUSD || 0)}</td>
                      <td className={`p-3 text-right font-mono ${Math.abs(dusd) < 0.01 ? 'text-slate-500' : dusd > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatUSD(dusd)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${reconciled ? 'bg-emerald-100 text-emerald-800' : hasPositive && !hasNegative ? 'bg-amber-100 text-amber-800' : hasNegative && !hasPositive ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                          {reconciled ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {result}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            const report = buildCashReport('Z', z);
                            if (report) setCashReportPreview(report);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-black hover:bg-slate-50"
                        >
                          <Printer className="w-3.5 h-3.5" /> Reimprimir Z
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {preZOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-7xl max-h-[94vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div><h3 className="font-black text-lg">Arqueo previo al Corte Z</h3><p className="text-xs text-slate-500">Verifique cada medio de pago antes de guardar y ejecutar el cierre.</p></div>
              <button onClick={() => setPreZOpen(false)} className="px-3 py-2 rounded-lg border text-xs font-bold">Cancelar</button>
            </div>
            <div className="p-4 overflow-auto">
              <table className="min-w-[1250px] w-full text-xs border-collapse">
                <thead className="bg-slate-100"><tr>
                  {['Método de pago','Fondo Inicial Bs.','Fondo Inicial USD','Ventas','CxC (cobro)','Dev/Anu.','Mov. Caja (+)','Mov. Caja (-)','Total Monto Sistema','Monto Real','DIF. (+/-)'].map(h=><th key={h} className="p-2 border text-left">{h}</th>)}
                </tr></thead>
                <tbody>
                  {arqueoRows.map(row => {
                    const isBs = row.currency === 'Bs';
                    const system = row.system;
                    const raw = String(preZReal[row.method] ?? '');
                    const real = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
                    const diff = real === null || !Number.isFinite(real) ? null : Number((real-system).toFixed(2));
                    return <tr key={row.method}>
                      <td className="p-2 border font-bold">{formatPaymentMethod(row.method)}</td>
                      <td className="p-2 border text-right">{formatBs(row.openingBs)}</td>
                      <td className="p-2 border text-right">{formatUSD(row.openingUSD)}</td>
                      <td className="p-2 border text-right">{isBs ? formatBs(row.salesBs) : formatUSD(row.salesUSD)}</td>
                      <td className="p-2 border text-right">{isBs ? formatBs(row.cxcBs) : formatUSD(row.cxcUSD)}</td>
                      <td className="p-2 border text-right">{isBs ? formatBs(row.devAnuBs) : formatUSD(row.devAnuUSD)}</td>
                      <td className="p-2 border text-right">{isBs ? formatBs(row.plusBs) : formatUSD(row.plusUSD)}</td>
                      <td className="p-2 border text-right">{isBs ? formatBs(row.minusBs) : formatUSD(row.minusUSD)}</td>
                      <td className="p-2 border text-right font-black">{isBs ? formatBs(system) : formatUSD(system)}</td>
                      <td className="p-1 border"><input type="text" inputMode="decimal" value={raw} onChange={e=>setPreZReal(prev=>({...prev,[row.method]:e.target.value}))} placeholder={isBs ? 'Bs.' : 'USD'} className="w-32 px-2 py-1.5 border rounded-lg text-right" /></td>
                      <td className={`p-2 border text-right font-black ${diff === null ? 'text-slate-400' : diff > 0.005 ? 'text-emerald-600' : diff < -0.005 ? 'text-rose-600' : 'text-slate-700'}`}>{diff === null ? '—' : (isBs ? formatBs(diff) : formatUSD(diff))}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
              {(() => {
                const d = calculatePreZ();
                const label = Math.abs(d.bs) < 0.01 && Math.abs(d.usd) < 0.01 ? 'ARQUEO CONCILIADO' : d.bs > 0 || d.usd > 0 ? 'SOBRANTE' : 'FALTANTE';
                return <div className="mt-4 rounded-xl border p-4 bg-slate-50"><div className="font-black text-sm">{label}</div><div className="text-xs mt-1">Diferencia Bs.: <b>{formatBs(d.bs)}</b> · Diferencia USD: <b>{formatUSD(d.usd)}</b></div>{Math.abs(d.bs)<0.01&&Math.abs(d.usd)<0.01 ? <div className="text-xs text-emerald-700 mt-1">El arqueo previo está conciliado.</div> : <div className="text-xs mt-1">{d.bs>0||d.usd>0 ? 'Sobrante detectado' : 'Faltante detectado'} por los montos indicados.</div>}</div>;
              })()}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={()=>setPreZOpen(false)} className="px-4 py-2 rounded-lg border text-xs font-bold">Cancelar</button>
              <button onClick={executeZ} className="px-5 py-2 rounded-lg bg-rose-600 text-white text-xs font-black">Guardar y ejecutar Z</button>
            </div>
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
