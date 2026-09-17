import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, formatPaymentMethod } from '../../types';
import {
  Printer,
  Download,
  X,
  QrCode,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageCircle,
  ShieldAlert,
  FileText,
  Receipt,
  Layers,
  FileDown,
  Loader2,
} from 'lucide-react';
import { exportToCSV, printElement, exportElementToPDF } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { getInvoiceWhatsAppUrl } from '../../utils/whatsappUtils';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  defaultFormat?: 'a4' | 'thermal';
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  onClose,
  defaultFormat = 'a4',
}) => {
  const { settings } = useApp();
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>(defaultFormat);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  if (!invoice) return null;

  const isPendingCreditApproval = invoice.isCredit && !invoice.isCreditApproved;
  const isPaid = invoice.paymentStatus === 'pagado';
  const isCredit = invoice.isCredit || invoice.paymentStatus === 'a_credito';
  const isCreditPendingApproval = isCredit && !invoice.isCreditApproved;

  const handleExportCSV = () => {
    const documentTitle = isPendingCreditApproval
      ? 'ORDEN DE PEDIDO A CRÉDITO (PROVISIONAL)'
      : 'FACTURA COMERCIAL / FISCAL';

    const rows = [
      [documentTitle, invoice.invoiceNumber],
      ['Empresa', settings.companyName],
      ['RIF Empresa', settings.companyRif],
      ['Fecha de Emisión', new Date(invoice.createdAt).toLocaleDateString('es-VE')],
      ['Fecha de Vencimiento', invoice.dueDate || 'N/A'],
      ['Cliente', invoice.customerName],
      ['RIF/Cédula Cliente', invoice.customerRif],
      ['Dirección', invoice.customerAddress],
      ['Teléfono', invoice.customerPhone],
      ['Tasa BCV Aplicada', `${formatPlainNumber(invoice.bcvRate, 2)} Bs/USD`],
      [
        'Condición de Pago',
        invoice.isCredit
          ? `Crédito (${invoice.creditDays || 15} días)`
          : formatPaymentMethod(invoice.paymentMethod),
      ],
      ['Estado de Pago', invoice.paymentStatus.toUpperCase()],
      ['Estado Aprobación', isPendingCreditApproval ? 'EN ESPERA DE APROBACIÓN' : 'APROBADO / FACTURADO'],
      [],
      ['Producto', 'Cantidad', 'Precio Unitario (USD)', 'Subtotal (USD)', 'Subtotal (Bs)'],
      ...invoice.items.map((it) => [
        it.productName,
        it.quantity,
        formatPlainNumber(it.unitPriceUSD, 6),
        formatPlainNumber(it.subtotalUSD, 6),
        formatPlainNumber(it.subtotalUSD * invoice.bcvRate, 2),
      ]),
      [],
      ['Subtotal Base Imponible (USD)', formatPlainNumber(invoice.subtotalUSD, 6)],
      ['IVA (16%) (USD)', formatPlainNumber(invoice.taxUSD, 6)],
      ['TOTAL (USD)', formatPlainNumber(invoice.totalUSD, 6)],
      ['TOTAL (Bs)', formatPlainNumber(invoice.totalBs, 2)],
    ];
    exportToCSV(`${isPendingCreditApproval ? 'Orden_Credito' : 'Factura'}_${invoice.invoiceNumber}`, rows);
  };

  const handlePrintA4 = () => {
    printElement('printable-invoice-content', {
      format: 'a4',
      title: `Factura_${invoice.invoiceNumber}_A4`,
    });
  };

  const handlePrintThermal = () => {
    printElement('printable-thermal-invoice-content', {
      format: 'thermal80',
      title: `Ticket_${invoice.invoiceNumber}_80mm`,
    });
  };

  const handlePrintCurrent = () => {
    if (printFormat === 'thermal') {
      handlePrintThermal();
    } else {
      handlePrintA4();
    }
  };

  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    try {
      if (printFormat === 'thermal') {
        await exportElementToPDF(
          'printable-thermal-invoice-content',
          `Ticket_${invoice.invoiceNumber}_80mm`,
          { format: 'thermal80' }
        );
      } else {
        await exportElementToPDF(
          'printable-invoice-content',
          `Factura_${invoice.invoiceNumber}`,
          { format: 'a4', margin: 8 }
        );
      }
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden my-8 border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-base">
              {isCreditPendingApproval ? 'Orden de Pedido a Crédito' : 'Factura Fiscal'} #{invoice.invoiceNumber}
            </span>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> PAGADA
              </span>
            ) : isCreditPendingApproval ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                <Clock className="w-3.5 h-3.5 animate-pulse" /> EN ESPERA DE APROBACIÓN
              </span>
            ) : isCredit ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> CRÉDITO APROBADO ({invoice.creditDays || 15} DÍAS)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                <AlertTriangle className="w-3.5 h-3.5" /> PENDIENTE
              </span>
            )}
          </div>

          {/* Quick Format Switcher Tabs */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setPrintFormat('a4')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                printFormat === 'a4'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Formato Factura Fiscal Carta / A4"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Factura A4</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat('thermal')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                printFormat === 'thermal'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Formato Ticket Impresora Térmica 80mm (POS)"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Ticket Térmico (80mm)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 rounded-lg transition cursor-pointer shadow-2xs"
              title={`Descargar ${printFormat === 'thermal' ? 'Ticket Térmico' : 'Factura Fiscal'} en PDF`}
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white" />
              )}
              <span>{isExportingPDF ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>

            <button
              onClick={handlePrintCurrent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition cursor-pointer shadow-2xs"
              title={`Imprimir en formato ${printFormat === 'thermal' ? 'Ticket Térmico 80mm' : 'A4'}`}
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>{printFormat === 'thermal' ? 'Imprimir Ticket' : 'Imprimir A4'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
              title="Descargar Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Credit Approval Notice Banner if pending */}
        {isCreditPendingApproval && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 shrink-0">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-bold">Orden de Pedido en Espera de Aprobación Administrativa:</strong>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Esta orden a crédito se encuentra en revisión. La Factura Fiscal oficial y definitiva se habilitará para descarga directa una vez que el administrador valide el cupo y marque el pedido como <em>Recibido / Aprobado y Despachado</em>.
              </p>
            </div>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/70">

          {/* ================================================================= */}
          {/* FORMAT 1: THERMAL RECEIPT PREVIEW (80mm)                          */}
          {/* ================================================================= */}
          {printFormat === 'thermal' ? (
            <div className="flex flex-col items-center">
              <div className="text-center mb-3 text-xs text-slate-500 font-medium flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span>Vista Previa de Impresión Térmica Directa (Papel Continuo 80mm / 58mm)</span>
              </div>

              {/* Thermal Ticket Card Container */}
              <div className="w-full max-w-[340px] bg-white p-5 rounded-xl shadow-lg border border-slate-300 font-mono text-slate-900 select-none">
                
                {/* Visual Thermal Receipt Body */}
                <div id="printable-thermal-invoice-content" className="thermal-ticket-container text-[11px] leading-tight">
                  
                  {/* Store Header */}
                  <div className="text-center pb-2">
                    <p className="font-extrabold text-sm uppercase tracking-tight">{settings.companyName}</p>
                    <p className="font-bold text-[11px]">RIF: {settings.companyRif}</p>
                    <p className="text-[10px] text-slate-700">{settings.companyAddress}</p>
                    <p className="text-[10px]">TELF: {settings.companyPhone}</p>
                  </div>

                  <div className="thermal-ticket-divider-double my-2" />

                  {/* Document Metadata */}
                  <div className="text-center uppercase font-bold py-1">
                    <p className="text-xs">
                      {isCreditPendingApproval ? 'ORDEN DE PEDIDO A CRÉDITO' : 'FACTURA FISCAL'}
                    </p>
                    <p className="text-sm font-black tracking-wider text-indigo-900">
                      N° {invoice.invoiceNumber}
                    </p>
                  </div>

                  <div className="space-y-0.5 text-[10px] py-1 border-t border-dashed border-black">
                    <div className="flex justify-between">
                      <span>FECHA: {new Date(invoice.createdAt).toLocaleDateString('es-VE')}</span>
                      <span>HORA: {new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {invoice.dueDate && (
                      <div className="flex justify-between font-bold text-amber-900">
                        <span>VENCE CRÉDITO:</span>
                        <span>{invoice.dueDate}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>TASA BCV:</span>
                      <span className="font-bold">{formatPlainNumber(invoice.bcvRate, 2)} Bs/$</span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="py-1.5 border-t border-dashed border-black text-[10px] space-y-0.5">
                    <p className="font-bold uppercase">CLIENTE: {invoice.customerName}</p>
                    <p>RIF/CI: {invoice.customerRif}</p>
                    {invoice.customerPhone && <p>TELF: {invoice.customerPhone}</p>}
                    {invoice.customerAddress && <p className="truncate">DIR: {invoice.customerAddress}</p>}
                  </div>

                  <div className="thermal-ticket-divider-double my-1.5" />

                  {/* Itemized Table Header */}
                  <div className="flex justify-between font-bold text-[10px] uppercase pb-1 border-b border-black">
                    <span className="w-10">CANT</span>
                    <span className="flex-1 px-1">DESCRIPCIÓN</span>
                    <span className="w-16 text-right">TOTAL USD</span>
                  </div>

                  {/* Items list */}
                  <div className="divide-y divide-dashed divide-slate-300 py-1">
                    {invoice.items.map((item, idx) => (
                      <div key={idx} className="py-1 text-[10.5px]">
                        <div className="flex justify-between items-start font-bold">
                          <span className="w-8 shrink-0">{item.quantity} un.</span>
                          <span className="flex-1 px-1 leading-snug">{item.productName}</span>
                          <span className="w-16 text-right shrink-0">{formatUSD(item.subtotalUSD)}</span>
                        </div>
                        <div className="flex justify-between text-[9.5px] text-slate-600 pl-8">
                          <span>@{formatUSD(item.unitPriceUSD)} (Bs {formatPlainNumber(item.unitPriceUSD * invoice.bcvRate, 2)})</span>
                          <span>Bs {formatPlainNumber(item.subtotalUSD * invoice.bcvRate, 2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="thermal-ticket-divider my-1.5" />

                  {/* Financial Totals */}
                  <div className="space-y-1 text-[11px] pt-1">
                    <div className="flex justify-between">
                      <span>SUBTOTAL USD:</span>
                      <span>{formatUSD(invoice.subtotalUSD)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IVA (16%):</span>
                      <span>{formatUSD(invoice.taxUSD)}</span>
                    </div>
                    
                    <div className="thermal-ticket-divider-double my-1.5" />

                    <div className="flex justify-between font-black text-sm pt-0.5">
                      <span>TOTAL USD:</span>
                      <span>{formatUSD(invoice.totalUSD)}</span>
                    </div>
                    <div className="flex justify-between font-black text-xs">
                      <span>TOTAL BS:</span>
                      <span>{formatBs(invoice.totalBs)}</span>
                    </div>

                    <div className="thermal-ticket-divider my-1.5" />

                    {/* Payment Status & Details */}
                    <div className="text-[10px] space-y-0.5 pt-0.5">
                      <div className="flex justify-between">
                        <span>COND. PAGO:</span>
                        <span className="font-bold uppercase">
                          {invoice.isCredit ? `CRÉDITO (${invoice.creditDays || 15} DÍAS)` : formatPaymentMethod(invoice.paymentMethod)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>ESTADO:</span>
                        <span className="font-bold uppercase">
                          {invoice.paymentStatus.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="thermal-ticket-divider-double my-2" />

                  {/* Footer & Barcode/QR simulation */}
                  <div className="text-center text-[10px] space-y-1.5 pt-1">
                    <p className="font-bold">*** GRACIAS POR SU COMPRA ***</p>
                    <p className="text-[9px] text-slate-600">
                      Conserve este comprobante para cualquier cambio o soporte fiscal.
                    </p>
                    <div className="flex justify-center pt-1">
                      <QrCode className="w-12 h-12 text-black" />
                    </div>
                    <p className="text-[8.5px] font-mono text-slate-500">
                      CONTROL: {invoice.invoiceNumber} | BCV: {formatPlainNumber(invoice.bcvRate, 2)}
                    </p>
                  </div>

                </div>

              </div>

              {/* Thermal Print & PDF Action Callouts */}
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-md"
                >
                  {isExportingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <FileDown className="w-4 h-4 text-white" />
                  )}
                  <span>{isExportingPDF ? 'Generando PDF...' : 'Descargar Ticket PDF (80mm)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintThermal}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-md"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>Imprimir Ticket Térmico</span>
                </button>
              </div>
            </div>
          ) : (
            /* =============================================================== */
            /* FORMAT 2: STANDARD FISCAL SHEET / A4                            */
            /* =============================================================== */
            <div
              id="printable-invoice-content"
              className="p-8 bg-white text-slate-800 text-sm relative rounded-xl border border-slate-200 shadow-md max-w-2xl mx-auto"
            >
              
              {/* Watermark for pending credit orders */}
              {isCreditPendingApproval && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 select-none rotate-[-25deg]">
                  <span className="text-6xl font-black tracking-widest text-slate-900 uppercase">
                    EN ESPERA DE APROBACIÓN
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="flex justify-between items-start pb-6 border-b border-slate-200 mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 overflow-hidden">
                      <img
                        src={settings.companyLogo || '/logo.png'}
                        alt="Logo"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/logo.png';
                        }}
                      />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{settings.companyName}</h2>
                      <p className="text-xs text-slate-500 font-mono font-bold">RIF: {settings.companyRif}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 max-w-sm">{settings.companyAddress}</p>
                  <p className="text-xs text-slate-600">Telf: {settings.companyPhone}</p>
                  <p className="text-xs text-slate-600">{settings.companyEmail}</p>
                </div>

                <div className="text-right">
                  <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 inline-block text-left mb-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {isCreditPendingApproval ? 'Orden de Pedido' : 'Documento Fiscal'}
                    </p>
                    <p className="text-base font-mono font-extrabold text-indigo-700">{invoice.invoiceNumber}</p>
                  </div>
                  <p className="text-xs text-slate-600"><strong>Fecha Emisión:</strong> {new Date(invoice.createdAt).toLocaleDateString('es-VE')}</p>
                  {invoice.dueDate && (
                    <p className="text-xs text-amber-700 font-semibold">
                      <strong>Vencimiento Crédito:</strong> {invoice.dueDate}
                    </p>
                  )}
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-xs px-2.5 py-1 rounded-lg border border-blue-200 font-mono">
                    <span>Tasa BCV:</span>
                    <strong>{invoice.bcvRate.toFixed(2)} Bs/$</strong>
                  </div>
                </div>
              </div>

              {/* Customer and billing block */}
              <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 mb-1 tracking-wider">Facturado a (Cliente):</p>
                  <p className="font-bold text-slate-900 text-sm">{invoice.customerName}</p>
                  <p className="text-xs text-slate-600"><strong>RIF/Cédula:</strong> {invoice.customerRif}</p>
                  <p className="text-xs text-slate-600"><strong>Teléfono:</strong> {invoice.customerPhone}</p>
                  <p className="text-xs text-slate-600"><strong>Dirección:</strong> {invoice.customerAddress}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-500 mb-1 tracking-wider">Condiciones de Pago:</p>
                  <p className="font-semibold text-slate-800">
                    {formatPaymentMethod(invoice.paymentMethod)}
                  </p>
                  {isCredit && (
                    <p className="text-xs text-amber-700 mt-1">
                      Crédito comercial acordado a <strong>{invoice.creditDays || 15} días</strong>.
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Estado: <span className="font-bold text-slate-700 uppercase">{invoice.paymentStatus.replace('_', ' ')}</span>
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse mb-6">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-[11px] font-bold text-slate-700 uppercase">
                    <th className="py-2.5 px-2">Descripción del Producto</th>
                    <th className="py-2.5 px-2 text-center">Cant.</th>
                    <th className="py-2.5 px-2 text-right">Precio USD</th>
                    <th className="py-2.5 px-2 text-right">Precio Bs</th>
                    <th className="py-2.5 px-2 text-right">Total USD</th>
                    <th className="py-2.5 px-2 text-right">Total Bs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-2 font-medium text-slate-800">{item.productName}</td>
                      <td className="py-2.5 px-2 text-center">{item.quantity}</td>
                      <td className="py-2.5 px-2 text-right font-mono">{formatUSD(item.unitPriceUSD)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                        {formatBs(item.unitPriceUSD * invoice.bcvRate)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-900">
                        {formatUSD(item.subtotalUSD)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                        {formatBs(item.subtotalUSD * invoice.bcvRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Breakdown */}
              <div className="flex justify-between items-start border-t border-slate-200 pt-4">
                <div className="max-w-xs">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <QrCode className="w-12 h-12 text-slate-700 shrink-0" />
                    <div className="text-[11px] text-slate-500 leading-tight">
                      <p className="font-semibold text-slate-700">Comprobante Digital Verificado</p>
                      <p>Consulte la validez fiscal de este documento escaneando el código o ingresando el correlativo.</p>
                    </div>
                  </div>
                </div>

                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Subtotal Base Imponible:</span>
                    <span className="font-mono font-medium">{formatUSD(invoice.subtotalUSD)} USD</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">IVA (16%):</span>
                    <span className="font-mono font-medium">{formatUSD(invoice.taxUSD)} USD</span>
                  </div>
                  <div className="flex justify-between py-2 border-b-2 border-slate-300 font-bold text-slate-900 text-sm">
                    <span>Total Documento (USD):</span>
                    <span className="font-mono text-indigo-700">{formatUSD(invoice.totalUSD)}</span>
                  </div>
                  <div className="flex justify-between py-2 rounded-lg bg-slate-100 px-2.5 font-bold text-slate-900 text-sm">
                    <span>Total a Pagar (Bs):</span>
                    <span className="font-mono text-emerald-700">
                      {formatBs(invoice.totalBs)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer note */}
              <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
                <p>Gracias por su preferencia comercial. Documento emitido bajo normativa comercial y cambiaria de la República Bolivariana de Venezuela.</p>
              </div>
            </div>
          )}

          {/* Hidden containers for background printing to guarantee both formats always exist in DOM */}
          <div className="hidden">
            {printFormat !== 'thermal' && (
              <div id="printable-thermal-invoice-content" className="thermal-ticket-container text-[11px] leading-tight">
                {/* Store Header */}
                <div className="text-center pb-2">
                  <p className="font-extrabold text-sm uppercase tracking-tight">{settings.companyName}</p>
                  <p className="font-bold text-[11px]">RIF: {settings.companyRif}</p>
                  <p className="text-[10px] text-slate-700">{settings.companyAddress}</p>
                  <p className="text-[10px]">TELF: {settings.companyPhone}</p>
                </div>

                <div className="thermal-ticket-divider-double my-2" />

                <div className="text-center uppercase font-bold py-1">
                  <p className="text-xs">
                    {isCreditPendingApproval ? 'ORDEN DE PEDIDO A CRÉDITO' : 'FACTURA FISCAL'}
                  </p>
                  <p className="text-sm font-black tracking-wider text-indigo-900">
                    N° {invoice.invoiceNumber}
                  </p>
                </div>

                <div className="space-y-0.5 text-[10px] py-1 border-t border-dashed border-black">
                  <div className="flex justify-between">
                    <span>FECHA: {new Date(invoice.createdAt).toLocaleDateString('es-VE')}</span>
                    <span>HORA: {new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex justify-between font-bold text-amber-900">
                      <span>VENCE CRÉDITO:</span>
                      <span>{invoice.dueDate}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>TASA BCV:</span>
                    <span className="font-bold">{formatPlainNumber(invoice.bcvRate, 2)} Bs/$</span>
                  </div>
                </div>

                <div className="py-1.5 border-t border-dashed border-black text-[10px] space-y-0.5">
                  <p className="font-bold uppercase">CLIENTE: {invoice.customerName}</p>
                  <p>RIF/CI: {invoice.customerRif}</p>
                  {invoice.customerPhone && <p>TELF: {invoice.customerPhone}</p>}
                  {invoice.customerAddress && <p className="truncate">DIR: {invoice.customerAddress}</p>}
                </div>

                <div className="thermal-ticket-divider-double my-1.5" />

                <div className="flex justify-between font-bold text-[10px] uppercase pb-1 border-b border-black">
                  <span className="w-10">CANT</span>
                  <span className="flex-1 px-1">DESCRIPCIÓN</span>
                  <span className="w-16 text-right">TOTAL USD</span>
                </div>

                <div className="divide-y divide-dashed divide-slate-300 py-1">
                  {invoice.items.map((item, idx) => (
                    <div key={idx} className="py-1 text-[10.5px]">
                      <div className="flex justify-between items-start font-bold">
                        <span className="w-8 shrink-0">{item.quantity} un.</span>
                        <span className="flex-1 px-1 leading-snug">{item.productName}</span>
                        <span className="w-16 text-right shrink-0">{formatUSD(item.subtotalUSD)}</span>
                      </div>
                      <div className="flex justify-between text-[9.5px] text-slate-600 pl-8">
                        <span>@{formatUSD(item.unitPriceUSD)} (Bs {formatPlainNumber(item.unitPriceUSD * invoice.bcvRate, 2)})</span>
                        <span>Bs {formatPlainNumber(item.subtotalUSD * invoice.bcvRate, 2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="thermal-ticket-divider my-1.5" />

                <div className="space-y-1 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span>SUBTOTAL USD:</span>
                    <span>{formatUSD(invoice.subtotalUSD)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA (16%):</span>
                    <span>{formatUSD(invoice.taxUSD)}</span>
                  </div>
                  
                  <div className="thermal-ticket-divider-double my-1.5" />

                  <div className="flex justify-between font-black text-sm pt-0.5">
                    <span>TOTAL USD:</span>
                    <span>{formatUSD(invoice.totalUSD)}</span>
                  </div>
                  <div className="flex justify-between font-black text-xs">
                    <span>TOTAL BS:</span>
                    <span>{formatBs(invoice.totalBs)}</span>
                  </div>

                  <div className="thermal-ticket-divider my-1.5" />

                  <div className="text-[10px] space-y-0.5 pt-0.5">
                    <div className="flex justify-between">
                      <span>COND. PAGO:</span>
                      <span className="font-bold uppercase">
                        {invoice.isCredit ? `CRÉDITO (${invoice.creditDays || 15} DÍAS)` : formatPaymentMethod(invoice.paymentMethod)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ESTADO:</span>
                      <span className="font-bold uppercase">
                        {invoice.paymentStatus.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="thermal-ticket-divider-double my-2" />

                <div className="text-center text-[10px] space-y-1.5 pt-1">
                  <p className="font-bold">*** GRACIAS POR SU COMPRA ***</p>
                  <p className="text-[9px] text-slate-600">
                    Conserve este comprobante para cualquier cambio o soporte fiscal.
                  </p>
                  <div className="flex justify-center pt-1">
                    <QrCode className="w-12 h-12 text-black" />
                  </div>
                  <p className="text-[8.5px] font-mono text-slate-500">
                    CONTROL: {invoice.invoiceNumber} | BCV: {formatPlainNumber(invoice.bcvRate, 2)}
                  </p>
                </div>
              </div>
            )}

            {printFormat === 'thermal' && (
              <div id="printable-invoice-content" className="p-8 bg-white text-slate-800 text-sm">
                <div className="flex justify-between items-start pb-6 border-b border-slate-200 mb-6">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">{settings.companyName}</h2>
                    <p className="text-xs text-slate-500 font-mono font-bold">RIF: {settings.companyRif}</p>
                    <p className="text-xs text-slate-600 mt-1">{settings.companyAddress}</p>
                    <p className="text-xs text-slate-600">Telf: {settings.companyPhone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-mono font-extrabold text-indigo-700">{invoice.invoiceNumber}</p>
                    <p className="text-xs">Fecha: {new Date(invoice.createdAt).toLocaleDateString('es-VE')}</p>
                    <p className="text-xs font-mono">Tasa BCV: {invoice.bcvRate.toFixed(2)} Bs/$</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded mb-4 text-xs">
                  <p><strong>Cliente:</strong> {invoice.customerName} | <strong>RIF:</strong> {invoice.customerRif}</p>
                  <p><strong>Condición:</strong> {formatPaymentMethod(invoice.paymentMethod)} | <strong>Estado:</strong> {invoice.paymentStatus.toUpperCase()}</p>
                </div>

                <table className="w-full text-xs mb-4">
                  <thead>
                    <tr className="border-b font-bold">
                      <th className="py-2 text-left">Producto</th>
                      <th className="py-2 text-center">Cant</th>
                      <th className="py-2 text-right">Precio USD</th>
                      <th className="py-2 text-right">Total USD</th>
                      <th className="py-2 text-right">Total Bs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((it, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-1.5">{it.productName}</td>
                        <td className="py-1.5 text-center">{it.quantity}</td>
                        <td className="py-1.5 text-right font-mono">{formatUSD(it.unitPriceUSD)}</td>
                        <td className="py-1.5 text-right font-mono">{formatUSD(it.subtotalUSD)}</td>
                        <td className="py-1.5 text-right font-mono">{formatBs(it.subtotalUSD * invoice.bcvRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-right text-xs space-y-1">
                  <p>Subtotal: {formatUSD(invoice.subtotalUSD)}</p>
                  <p>IVA (16%): {formatUSD(invoice.taxUSD)}</p>
                  <p className="font-bold text-sm">TOTAL USD: {formatUSD(invoice.totalUSD)}</p>
                  <p className="font-bold text-xs text-emerald-700">TOTAL BS: {formatBs(invoice.totalBs)}</p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Bottom Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <a
            href={getInvoiceWhatsAppUrl(invoice, settings)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer shadow-xs"
            title="Enviar factura al equipo de ventas por WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Ventas ({settings.companyPhone || '+58 424-5751804'})</span>
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Descargar comprobante en formato PDF"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white" />
              )}
              <span>{isExportingPDF ? 'Generando...' : 'Descargar PDF'}</span>
            </button>
            <button
              onClick={handlePrintThermal}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ticket Térmico</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200/80 hover:bg-slate-300 rounded-xl transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

