import React from 'react';
import { formatBs, formatUSD } from '../../utils/formatUtils';

export interface CashReportLine {
  method: string;
  currency: 'Bs' | 'USD';
  amount: number;
}

export interface CashReportData {
  kind: 'X' | 'Z';
  terminalId: string;
  generatedAt: string;
  openedAt?: string;
  openedBy?: string;
  closedAt?: string;
  closedBy?: string;
  openingBs: number;
  openingUSD: number;
  salesUSD: number;
  salesByMethod: CashReportLine[];
  cxcByMethod: CashReportLine[];
  cxcCashSalesBs: number;
  cxcCashSalesUSD: number;
  expectedBs: number;
  expectedUSD: number;
  closingBs?: number;
  closingUSD?: number;
  differenceBs?: number;
  differenceUSD?: number;
  movementBs?: number;
  movementUSD?: number;
}

const methodLabel: Record<string, string> = {
  efectivo_bs: 'Efectivo Bs',
  efectivo_usd: 'Efectivo USD',
  divisas_efectivo: 'Efectivo USD',
  zelle: 'Zelle',
  pago_movil: 'Pago Móvil',
  transferencia_bs: 'Transferencia Bs',
  transferencia_usd: 'Transferencia USD',
  biopago: 'Biopago',
  tarjeta: 'Tarjeta',
  credito: 'Crédito',
};

const money = (currency: 'Bs' | 'USD', value: number) =>
  currency === 'Bs' ? formatBs(value) : formatUSD(value);

export const CashReportPreview: React.FC<{
  data: CashReportData | null;
  open: boolean;
  onClose: () => void;
  onPrint: () => void;
}> = ({ data, open, onClose, onPrint }) => {
  if (!open || !data) return null;

  const salesBs = data.salesByMethod
    .filter((x) => x.currency === 'Bs')
    .reduce((s, x) => s + x.amount, 0);
  const salesUsd = data.salesByMethod
    .filter((x) => x.currency === 'USD')
    .reduce((s, x) => s + x.amount, 0);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[95vh] bg-slate-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-3 bg-white border-b flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">Vista previa — Reporte {data.kind}</h3>
            <p className="text-xs text-slate-500">Formato real de impresión térmica 80 mm</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg border text-xs font-bold bg-white">Cerrar</button>
            <button onClick={onPrint} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-black">Imprimir 80 mm</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div id="cash-report-thermal-preview" className="thermal-cash-report mx-auto bg-white text-black font-mono text-[10px] leading-[1.25] p-[7mm] shadow-xl" style={{ width: '80mm', minHeight: '80mm', boxSizing: 'border-box' }}>
            <div className="text-center font-black text-[13px] tracking-tight">
              {data.kind === 'X' ? 'REPORTE X' : 'REPORTE Z'}
            </div>
            <div className="text-center font-bold mt-0.5">CONTROL DE CAJA</div>
            <div className="border-t border-dashed border-black my-2" />

            <div className="text-center font-black">DISTRIBUIDORA LA GRAN BODEGA M&amp;S</div>
            <div className="text-center">CONTROL OPERATIVO DE CAJA</div>
            <div className="border-t border-dashed border-black my-2" />

            <div className="flex justify-between"><span>Terminal</span><b>{data.terminalId}</b></div>
            <div className="flex justify-between"><span>Usuario apertura</span><span>{data.openedBy || '—'}</span></div>
            <div className="flex justify-between"><span>Fecha emisión</span><span>{new Date(data.generatedAt).toLocaleString('es-VE')}</span></div>
            {data.openedAt && <div className="flex justify-between"><span>Apertura</span><span>{new Date(data.openedAt).toLocaleString('es-VE')}</span></div>}
            {data.closedAt && <div className="flex justify-between"><span>Cierre</span><span>{new Date(data.closedAt).toLocaleString('es-VE')}</span></div>}
            {data.closedBy && <div className="flex justify-between"><span>Usuario cierre</span><span>{data.closedBy}</span></div>}

            <div className="border-t border-dashed border-black my-2" />
            <div className="font-black">RESUMEN DE VENTAS</div>
            <div className="flex justify-between"><span>Ventas USD</span><b>{formatUSD(data.salesUSD)}</b></div>
            <div className="flex justify-between"><span>Ventas Bs</span><b>{formatBs(salesBs)}</b></div>
            <div className="flex justify-between"><span>Ventas USD por cobro</span><b>{formatUSD(salesUsd)}</b></div>

            <div className="border-t border-dashed border-black my-2" />
            <div className="font-black">MEDIOS DE PAGO</div>
            {data.salesByMethod.length === 0 ? (
              <div>Sin operaciones.</div>
            ) : data.salesByMethod.map((line) => (
              <div key={line.method + line.currency} className="flex justify-between gap-2">
                <span className="truncate">{methodLabel[line.method] || line.method}</span>
                <b>{money(line.currency, line.amount)}</b>
              </div>
            ))}

            <div className="border-t border-dashed border-black my-2" />
            <div className="font-black">COBROS CxC</div>
            {data.cxcByMethod.length === 0 ? (
              <div>Sin cobros registrados.</div>
            ) : data.cxcByMethod.map((line) => (
              <div key={'cxc-' + line.method + line.currency} className="flex justify-between gap-2">
                <span className="truncate">{methodLabel[line.method] || line.method}</span>
                <b>{money(line.currency, line.amount)}</b>
              </div>
            ))}

            <div className="border-t border-dashed border-black my-2" />
            <div className="font-black">EFECTIVO</div>
            <div className="flex justify-between"><span>Fondo inicial Bs</span><b>{formatBs(data.openingBs)}</b></div>
            <div className="flex justify-between"><span>Fondo inicial USD</span><b>{formatUSD(data.openingUSD)}</b></div>
            <div className="flex justify-between"><span>Ventas efectivo Bs</span><b>{formatBs(data.salesByMethod.filter(x => x.currency === 'Bs' && x.method === 'efectivo_bs').reduce((s,x)=>s+x.amount,0))}</b></div>
            <div className="flex justify-between"><span>Ventas efectivo USD</span><b>{formatUSD(data.salesByMethod.filter(x => x.currency === 'USD' && (x.method === 'efectivo_usd' || x.method === 'divisas_efectivo')).reduce((s,x)=>s+x.amount,0))}</b></div>
            <div className="flex justify-between"><span>Cobros CxC Bs</span><b>{formatBs(data.cxcCashSalesBs)}</b></div>
            <div className="flex justify-between"><span>Cobros CxC USD</span><b>{formatUSD(data.cxcCashSalesUSD)}</b></div>
            <div className="flex justify-between"><span>Movimientos Bs</span><b>{formatBs(data.movementBs || 0)}</b></div>
            <div className="flex justify-between"><span>Movimientos USD</span><b>{formatUSD(data.movementUSD || 0)}</b></div>
            <div className="flex justify-between font-black"><span>EFECTIVO ESPERADO Bs</span><b>{formatBs(data.expectedBs)}</b></div>
            <div className="flex justify-between font-black"><span>EFECTIVO ESPERADO USD</span><b>{formatUSD(data.expectedUSD)}</b></div>

            {data.kind === 'Z' && (
              <>
                <div className="border-t border-double border-black my-2" />
                <div className="font-black">CIERRE Y ARQUEO</div>
                <div className="flex justify-between"><span>Contado Bs</span><b>{formatBs(data.closingBs || 0)}</b></div>
                <div className="flex justify-between"><span>Diferencia Bs</span><b>{formatBs(data.differenceBs || 0)}</b></div>
                <div className="flex justify-between"><span>Contado USD</span><b>{formatUSD(data.closingUSD || 0)}</b></div>
                <div className="flex justify-between"><span>Diferencia USD</span><b>{formatUSD(data.differenceUSD || 0)}</b></div>
              </>
            )}

            <div className="border-t border-dashed border-black my-2" />
            <div className="text-center font-black">FIN DEL REPORTE {data.kind}</div>
            <div className="text-center text-[8px] mt-1">Documento operativo de control de caja</div>
          </div>
        </div>
      </div>
    </div>
  );
};
