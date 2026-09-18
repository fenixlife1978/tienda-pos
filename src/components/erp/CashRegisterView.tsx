import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatBs, formatUSD } from '../../utils/formatUtils';
import { terminalIdentity } from '../../services/terminalIdentity';
import { WalletCards, LockKeyhole, UnlockKeyhole, Printer, FileText, Settings2 } from 'lucide-react';

interface CashSession { id:string; terminalId:string; openedAt:string; openedBy:string; openingBs:number; openingUSD:number; closedAt?:string; closedBy?:string; closingBs?:number; closingUSD?:number; }
const KEY='omni_cash_session_v1';
const MOVES='omni_cash_moves_v1';

export const CashRegisterView: React.FC = () => {
  const { orders, currentUser, settings, updateSettings } = useApp();
  const [session,setSession]=useState<CashSession|null>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}});
  const [openingBs,setOpeningBs]=useState(''),[openingUSD,setOpeningUSD]=useState(''),[closingBs,setClosingBs]=useState(''),[closingUSD,setClosingUSD]=useState('');

  const posOrders=useMemo(()=>orders.filter(o=>o.channel==='pos' && (!session || o.createdAt>=session.openedAt) && !(o as any).isVoided),[orders,session]);
  const salesByMethod=useMemo(()=>{const map:Record<string,number>={};for(const o of posOrders){if(o.paymentSplits?.length)for(const p of o.paymentSplits)map[p.method]=(map[p.method]||0)+p.amountUSD;else map[o.paymentMethod]=(map[o.paymentMethod]||0)+o.totalUSD;}return map;},[posOrders]);
  const totalSalesUSD=posOrders.reduce((s,o)=>s+o.totalUSD,0);
  const cashUSD=salesByMethod.efectivo_usd||0;
  const cashBsEquivalent=(salesByMethod.efectivo_bs||0);
  const expectedUSD=(session?.openingUSD||0)+cashUSD+(session?.openingBs||0)/settings.bcvRate+cashBsEquivalent;
  const printerMode=settings.printerMode||'thermal';

  const persist=(next:CashSession|null)=>{setSession(next);if(next)localStorage.setItem(KEY,JSON.stringify(next));else localStorage.removeItem(KEY);};
  const open=()=>{const s:CashSession={id:crypto.randomUUID(),terminalId:terminalIdentity.getId(),openedAt:new Date().toISOString(),openedBy:currentUser.name,openingBs:Number(openingBs)||0,openingUSD:Number(openingUSD)||0};persist(s);setOpeningBs('');setOpeningUSD('');};
  const close=()=>{if(!session)return;const s={...session,closedAt:new Date().toISOString(),closedBy:currentUser.name,closingBs:Number(closingBs)||0,closingUSD:Number(closingUSD)||0};localStorage.setItem(MOVES,JSON.stringify({lastClose:s}));persist(null);setClosingBs('');setClosingUSD('');alert('Caja cerrada. Arqueo Z registrado localmente.');};
  const printReport=(kind:'X'|'Z')=>{localStorage.setItem('omni_last_cash_report',JSON.stringify({kind,terminalId:terminalIdentity.getId(),generatedAt:new Date().toISOString(),salesUSD:totalSalesUSD,salesByMethod,printerMode}));window.print();};

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">Caja & Arqueo</h2><p className="text-xs text-slate-500">Apertura, control, Reporte X y cierre Z por terminal.</p></div><span className={session?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600'} style={{padding:'6px 10px',borderRadius:8,fontSize:12,fontWeight:800}}>{session?'CAJA ABIERTA':'CAJA CERRADA'}</span></div>
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><h3 className="font-bold flex items-center gap-2">{session?<UnlockKeyhole className="w-4 h-4 text-emerald-600"/>:<LockKeyhole className="w-4 h-4 text-slate-500"/>}{session?'Sesión activa':'Apertura de caja'}</h3>{!session?<><input type="number" step="0.01" placeholder="Fondo inicial Bs." value={openingBs} onChange={e=>setOpeningBs(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/><input type="number" step="0.01" placeholder="Fondo inicial USD" value={openingUSD} onChange={e=>setOpeningUSD(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/><button onClick={open} className="w-full bg-indigo-600 text-white rounded-lg py-2 font-bold">Abrir Caja</button></>:<><div className="text-xs space-y-1"><div>Terminal: <b>{session.terminalId}</b></div><div>Apertura: {new Date(session.openedAt).toLocaleString('es-VE')}</div><div>Fondo: {formatBs(session.openingBs)} + {formatUSD(session.openingUSD)}</div></div><input type="number" step="0.01" placeholder="Conteo final Bs." value={closingBs} onChange={e=>setClosingBs(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/><input type="number" step="0.01" placeholder="Conteo final USD" value={closingUSD} onChange={e=>setClosingUSD(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"/><button onClick={close} className="w-full bg-rose-600 text-white rounded-lg py-2 font-bold">Cerrar Caja / Arqueo Z</button></>}</div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5"><h3 className="font-bold mb-3">Resumen de ventas</h3><div className="text-2xl font-black text-indigo-700">{formatUSD(totalSalesUSD)}</div><div className="text-xs text-slate-500 mb-3">Ventas POS desde la apertura</div><div className="space-y-1 text-xs">{Object.entries(salesByMethod).map(([m,v])=><div key={m} className="flex justify-between"><span>{m.replace(/_/g,' ')}</span><b>{formatUSD(v)}</b></div>)}</div><div className="mt-3 pt-3 border-t text-xs"><div className="flex justify-between"><span>Efectivo USD</span><b>{formatUSD(cashUSD)}</b></div><div className="flex justify-between"><span>Efectivo Bs (USD equiv.)</span><b>{formatUSD(cashBsEquivalent)}</b></div><div className="flex justify-between font-black mt-1"><span>Esperado USD*</span><b>{formatUSD(expectedUSD)}</b></div></div></div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><h3 className="font-bold flex items-center gap-2"><Settings2 className="w-4 h-4 text-indigo-600"/>Impresión</h3><div className="text-xs text-slate-500">El POS puede operar con impresora térmica común; el modo fiscal queda separado para integraciones de controlador fiscal.</div><div className="grid grid-cols-2 gap-2"><button onClick={()=>updateSettings({printerMode:'thermal',thermalPaperWidth:80})} className={`rounded-lg border p-2 text-xs font-bold ${printerMode==='thermal'?'bg-indigo-50 border-indigo-500 text-indigo-700':'bg-white'}`}>Térmica 80mm</button><button onClick={()=>updateSettings({printerMode:'fiscal'})} className={`rounded-lg border p-2 text-xs font-bold ${printerMode==='fiscal'?'bg-amber-50 border-amber-500 text-amber-800':'bg-white'}`}>Modo fiscal</button></div><div className="flex gap-2"><button onClick={()=>printReport('X')} className="flex-1 border rounded-lg py-2 text-xs font-bold flex justify-center gap-1"><Printer className="w-3.5 h-3.5"/>Reporte X</button><button onClick={()=>printReport('Z')} className="flex-1 border rounded-lg py-2 text-xs font-bold flex justify-center gap-1"><FileText className="w-3.5 h-3.5"/>Reporte Z</button></div></div>
    </div><div className="text-[10px] text-slate-400">* Control operativo. El arqueo físico y la conciliación bancaria siguen siendo necesarios para el cierre contable.</div>
  </div>;
};
