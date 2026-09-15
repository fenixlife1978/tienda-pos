import React from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, formatPaymentMethod } from '../../types';
import { Printer, Download, X, QrCode, Building2, CheckCircle2, Clock, AlertTriangle, MessageCircle } from 'lucide-react';
import { exportToCSV, printElement } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { getInvoiceWhatsAppUrl } from '../../utils/whatsappUtils';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, onClose }) => {
  const { settings } = useApp();

  if (!invoice) return null;

  const handleExportCSV = () => {
    const rows = [
      ['FACTURA COMERCIAL / FISCAL', invoice.invoiceNumber],
      ['Empresa', settings.companyName],
      ['RIF Empresa', settings.companyRif],
      ['Fecha de Emisión', new Date(invoice.createdAt).toLocaleDateString('es-VE')],
      ['Fecha de Vencimiento', invoice.dueDate || 'N/A'],
      ['Cliente', invoice.customerName],
      ['RIF/Cédula Cliente', invoice.customerRif],
      ['Dirección', invoice.customerAddress],
      ['Teléfono', invoice.customerPhone],
      ['Tasa BCV Aplicada', `${formatPlainNumber(invoice.bcvRate, 2)} Bs/USD`],
      ['Condición de Pago', invoice.isCredit ? `Crédito (${invoice.creditDays || 15} días)` : formatPaymentMethod(invoice.paymentMethod)],
      ['Estado de Pago', invoice.paymentStatus.toUpperCase()],
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
      ['TOTAL FACTURA (USD)', formatPlainNumber(invoice.totalUSD, 6)],
      ['TOTAL FACTURA (Bs)', formatPlainNumber(invoice.totalBs, 2)],
    ];
    exportToCSV(`Factura_${invoice.invoiceNumber}`, rows);
  };

  const handlePrint = () => {
    printElement('printable-invoice-content');
  };

  const isPaid = invoice.paymentStatus === 'pagado';
  const isCredit = invoice.isCredit || invoice.paymentStatus === 'a_credito';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden my-8 border border-slate-200">
        {/* Modal Top Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 text-lg">Factura Comercial #{invoice.invoiceNumber}</span>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> PAGADA
              </span>
            ) : isCredit ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                <Clock className="w-3.5 h-3.5" /> A CRÉDITO ({invoice.creditDays || 15} DÍAS)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                <AlertTriangle className="w-3.5 h-3.5" /> PENDIENTE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={getInvoiceWhatsAppUrl(invoice, settings)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer shadow-xs"
              title="Compartir factura por WhatsApp al equipo de ventas (+58 424-5751804)"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              title="Imprimir o Guardar en PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Imprimir / PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
              title="Descargar Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Exportar Excel
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Content */}
        <div id="printable-invoice-content" className="p-8 bg-white text-slate-800 text-sm">
          {/* Header */}
          <div className="flex justify-between items-start pb-6 border-b border-slate-200 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">{settings.companyName}</h2>
                  <p className="text-xs text-slate-500 font-mono">RIF: {settings.companyRif}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2 max-w-sm">{settings.companyAddress}</p>
              <p className="text-xs text-slate-600">Telf: {settings.companyPhone}</p>
              <p className="text-xs text-slate-600">{settings.companyEmail}</p>
            </div>

            <div className="text-right">
              <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 inline-block text-left mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Documento Fiscal</p>
                <p className="text-lg font-mono font-bold text-blue-700">{invoice.invoiceNumber}</p>
              </div>
              <p className="text-xs text-slate-600"><strong>Fecha Emisión:</strong> {new Date(invoice.createdAt).toLocaleDateString('es-VE')}</p>
              {invoice.dueDate && (
                <p className="text-xs text-amber-700 font-semibold">
                  <strong>Vencimiento Crédito:</strong> {invoice.dueDate}
                </p>
              )}
              <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-xs px-2.5 py-1 rounded border border-blue-200 font-mono">
                <span>Tasa BCV:</span>
                <strong>{invoice.bcvRate.toFixed(2)} Bs/$</strong>
              </div>
            </div>
          </div>

          {/* Customer and billing block */}
          <div className="grid grid-cols-2 gap-6 p-4 rounded-lg bg-slate-50 border border-slate-200 mb-6">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500 mb-1 tracking-wider">Facturado a (Cliente):</p>
              <p className="font-bold text-slate-900 text-base">{invoice.customerName}</p>
              <p className="text-xs text-slate-600"><strong>RIF/Cédula:</strong> {invoice.customerRif}</p>
              <p className="text-xs text-slate-600"><strong>Teléfono:</strong> {invoice.customerPhone}</p>
              <p className="text-xs text-slate-600"><strong>Dirección:</strong> {invoice.customerAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase text-slate-500 mb-1 tracking-wider">Condiciones de Pago:</p>
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
              <tr className="border-b-2 border-slate-300 text-xs font-bold text-slate-700 uppercase">
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
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <QrCode className="w-12 h-12 text-slate-700 shrink-0" />
                <div className="text-[11px] text-slate-500 leading-tight">
                  <p className="font-semibold text-slate-700">Comprobante Digital Verificado</p>
                  <p>Consulte la validez fiscal de esta factura escaneando el código o ingresando el correlativo.</p>
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
                <span>Total Factura (USD):</span>
                <span className="font-mono text-blue-700">{formatUSD(invoice.totalUSD)}</span>
              </div>
              <div className="flex justify-between py-2 rounded bg-slate-100 px-2 font-bold text-slate-900 text-sm">
                <span>Total a Pagar (Bs):</span>
                <span className="font-mono text-emerald-700">
                  {formatBs(invoice.totalBs)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
            <p>Gracias por su preferencia comercial. Factura emitida bajo normativa comercial y cambiaria de la República Bolivariana de Venezuela.</p>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <a
            href={getInvoiceWhatsAppUrl(invoice, settings)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer shadow-xs"
            title="Enviar factura al equipo de ventas por WhatsApp (+58 424-5751804)"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar al WhatsApp de Ventas ({settings.companyPhone || '+58 424-5751804'})</span>
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
