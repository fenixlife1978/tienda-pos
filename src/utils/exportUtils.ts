import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function exportToCSV(filename: string, rows: (string | number)[][]) {
  const processRow = (row: (string | number)[]) => {
    return row
      .map((val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(';'); // Semicolon for Excel compatibility in Spanish locale
  };

  const csvContent = '\uFEFF' + rows.map(processRow).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface PDFExportOptions {
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number; // in mm
  scale?: number;
}

/**
 * Directly captures any DOM container and saves it as a high-resolution PDF file.
 */
export async function exportElementToPDF(
  elementId: string,
  filename: string,
  options?: PDFExportOptions
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID '${elementId}' not found for PDF export.`);
    return false;
  }

  try {
    const isThermal =
      options?.format === 'thermal' ||
      options?.format === 'thermal80' ||
      options?.format === 'thermal58';

    const canvas = await html2canvas(element, {
      scale: options?.scale || 2.2, // Crisp retina-quality rendering
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: isThermal ? 400 : 1200,
    });

    const imgData = canvas.toDataURL('image/png');

    if (isThermal) {
      const is58mm = options?.format === 'thermal58';
      const paperWidth = is58mm ? 58 : 80;
      const pdfHeight = (canvas.height * paperWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [paperWidth, Math.max(pdfHeight + 4, 60)],
      });

      pdf.addImage(imgData, 'PNG', 0, 2, paperWidth, pdfHeight);
      const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      pdf.save(cleanFilename);
      return true;
    }

    // Standard A4 or Letter
    const orientation = options?.orientation || 'portrait';
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: options?.format === 'letter' ? 'letter' : 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = options?.margin !== undefined ? options.margin : 8;

    const printableWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * printableWidth) / canvas.width;
    const maxPageContentHeight = pageHeight - margin * 2;

    if (contentHeight <= maxPageContentHeight) {
      // Single Page Document
      pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, contentHeight);
    } else {
      // Multi-page document handling
      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, printableWidth, contentHeight);
      heightLeft -= maxPageContentHeight;

      while (heightLeft > 0) {
        position = position - maxPageContentHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, printableWidth, contentHeight);
        heightLeft -= maxPageContentHeight;
      }
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
}


export interface FinancialPDFRow {
  label: string;
  usd?: number;
  bs?: number;
  note?: string;
}

export interface FinancialPDFData {
  companyName: string;
  rif?: string;
  phone?: string;
  bcvRate: number;
  generatedAt: string;
  periodLabel: string;
  rows: FinancialPDFRow[];
  categoryRows: { name: string; usd: number; percentage: number }[];
}

export function exportFinancialReportPDF(
  filename: string,
  data: FinancialPDFData
): boolean {
  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 14;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = 16;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 14) {
        pdf.addPage();
        y = 16;
      }
    };

    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageWidth, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(data.companyName || 'ERP Comercial', margin, 13);
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`RIF: ${data.rif || 'No registrado'}  |  Tel: ${data.phone || 'No registrado'}`, margin, 19);
    pdf.setFont('helvetica', 'bold');
    pdf.text('REPORTE FINANCIERO EJECUTIVO', pageWidth - margin, 13, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.periodLabel, pageWidth - margin, 19, { align: 'right' });
    pdf.setTextColor(30, 41, 59);
    y = 39;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('CONTROL DEL REPORTE', margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(`Emisión: ${new Date(data.generatedAt).toLocaleString('es-VE')}`, margin, y + 5);
    pdf.text(`Tasa oficial BCV aplicada: ${data.bcvRate.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Bs/USD`, margin, y + 10);
    y += 18;

    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y, pageWidth - margin * 2, 9, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('INDICADOR', margin + 3, y + 6);
    pdf.text('USD', pageWidth - 68, y + 6, { align: 'right' });
    pdf.text('BS.', pageWidth - 35, y + 6, { align: 'right' });
    y += 11;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    for (const row of data.rows) {
      ensureSpace(9);
      const label = row.label.length > 62 ? row.label.slice(0, 59) + '...' : row.label;
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + 4, pageWidth - margin, y + 4);
      pdf.text(label, margin + 2, y);
      if (row.usd !== undefined) pdf.text(formatPdfMoney(row.usd, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

), pageWidth - 68, y, { align: 'right' });
      if (row.bs !== undefined) pdf.text(formatPdfMoney(row.bs, 'Bs'), pageWidth - 35, y, { align: 'right' });
      y += 8;
    }

    y += 6;
    ensureSpace(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('VENTAS POR CATEGORÍA', margin, y);
    y += 6;
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    pdf.setFontSize(8);
    pdf.text('CATEGORÍA', margin + 3, y + 5.5);
    pdf.text('VENTA USD', pageWidth - 58, y + 5.5, { align: 'right' });
    pdf.text('%', pageWidth - 25, y + 5.5, { align: 'right' });
    y += 10;
    pdf.setFont('helvetica', 'normal');
    for (const row of data.categoryRows) {
      ensureSpace(8);
      const label = row.name.length > 55 ? row.name.slice(0, 52) + '...' : row.name;
      pdf.text(label, margin + 2, y);
      pdf.text(formatPdfMoney(row.usd, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

), pageWidth - 58, y, { align: 'right' });
      pdf.text(`${row.percentage.toFixed(1)}%`, pageWidth - 25, y, { align: 'right' });
      y += 7;
    }

    ensureSpace(24);
    y += 5;
    pdf.setDrawColor(15, 23, 42);
    pdf.line(margin, y, pageWidth - margin, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text('Documento generado por el módulo financiero del sistema. Los valores Bs. se expresan según la tasa BCV indicada.', margin, y + 6);
    pdf.text(`Página ${pdf.getNumberOfPages()}`, pageWidth - margin, y + 6, { align: 'right' });

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Error generating professional financial PDF:', error);
    return false;
  }
}

function formatPdfMoney(value: number, currency: '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

 | 'Bs'): string {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = safe.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

 ? `${formatted}` : `Bs ${formatted}`;
}


export interface InventoryPDFRow {
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  status: string;
  costUSD: number;
  retailUSD: number;
  valueCostUSD: number;
  valueCostBs: number;
}

export interface InventoryPDFData {
  companyName: string;
  rif?: string;
  phone?: string;
  address?: string;
  bcvRate: number;
  generatedAt: string;
  totalProducts: number;
  totalUnits: number;
  totalCostUSD: number;
  totalCostBs: number;
  totalRetailUSD: number;
  totalRetailBs: number;
  potentialMarginPercent: number;
  outOfStockCount: number;
  lowStockCount: number;
  healthyStockCount: number;
  categoryRows: { name: string; products: number; units: number; costUSD: number; costBs: number; retailUSD: number; alerts: number }[];
  detailRows: InventoryPDFRow[];
}

export function exportInventoryExecutivePDF(filename: string, data: InventoryPDFData): boolean {
  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = 14;

    const header = () => {
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, 24, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text(data.companyName || 'ERP Comercial', margin, 10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.text(`RIF: ${data.rif || 'No registrado'} | Tel: ${data.phone || 'No registrado'} | ${data.address || 'Dirección no registrada'}`, margin, 16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('INFORME GERENCIAL DE INVENTARIO', pageWidth - margin, 10, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Emisión: ${new Date(data.generatedAt).toLocaleString('es-VE')}`, pageWidth - margin, 16, { align: 'right' });
      pdf.setTextColor(30, 41, 59);
      y = 31;
    };

    const page = () => {
      pdf.addPage();
      header();
    };

    const ensure = (height: number) => {
      if (y + height > pageHeight - 10) page();
    };

    const money = (v: number, prefix: '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

 | 'Bs') => {
      const safe = Number.isFinite(v) ? v : 0;
      return `${prefix}${safe.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    header();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('RESUMEN EJECUTIVO', margin, y);
    y += 6;

    const cards = [
      ['Costo inventario', money(data.totalCostUSD, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

)],
      ['Costo inventario Bs', money(data.totalCostBs, 'Bs ')],
      ['PVP inventario', money(data.totalRetailUSD, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

)],
      ['Margen proyectado', `${data.potentialMarginPercent.toFixed(1)}%`],
      ['Unidades', data.totalUnits.toLocaleString('es-VE')],
      ['Referencias', String(data.totalProducts)],
    ];
    const cardW = (pageWidth - margin * 2 - 10) / 6;
    cards.forEach(([label, value], i) => {
      const x = margin + i * (cardW + 2);
      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(x, y, cardW, 15, 2, 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.text(label, x + 2, y + 5);
      pdf.setFontSize(8);
      pdf.text(value, x + 2, y + 11);
    });
    y += 22;

    pdf.setFontSize(8);
    pdf.text(`Estado de stock: ${data.outOfStockCount} agotados  |  ${data.lowStockCount} bajos  |  ${data.healthyStockCount} óptimos  |  Tasa BCV: ${money(data.bcvRate, 'Bs ')} / USD`, margin, y);
    y += 8;

    const tableHeader = (cols: { text: string; x: number; align?: 'left'|'right'|'center' }[]) => {
      pdf.setFillColor(226, 232, 240);
      pdf.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      cols.forEach(col => pdf.text(col.text, col.x, y, { align: col.align || 'left' }));
      y += 5;
      pdf.setFont('helvetica', 'normal');
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('VALORIZACIÓN POR CATEGORÍA', margin, y);
    y += 6;
    tableHeader([
      {text:'Categoría',x:margin+2},{text:'Productos',x:100,align:'center'},{text:'Unidades',x:122,align:'center'},
      {text:'Costo USD',x:165,align:'right'},{text:'Costo Bs',x:205,align:'right'},{text:'PVP USD',x:245,align:'right'},{text:'Alertas',x:282,align:'right'}
    ]);
    data.categoryRows.forEach(row => {
      ensure(7);
      pdf.setFontSize(6.8);
      pdf.text(row.name.slice(0, 42), margin + 2, y);
      pdf.text(String(row.products), 100, y, {align:'center'});
      pdf.text(String(row.units), 122, y, {align:'center'});
      pdf.text(money(row.costUSD, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

), 165, y, {align:'right'});
      pdf.text(money(row.costBs, 'Bs '), 205, y, {align:'right'});
      pdf.text(money(row.retailUSD, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

), 245, y, {align:'right'});
      pdf.text(String(row.alerts), 282, y, {align:'right'});
      y += 5.5;
    });

    y += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    ensure(15);
    pdf.text(`DETALLE DE ARTÍCULOS (${data.detailRows.length})`, margin, y);
    y += 6;
    const detailHeader = () => tableHeader([
      {text:'SKU',x:margin+1},{text:'Producto',x:38},{text:'Categoría',x:105},{text:'Stock',x:145,align:'center'},
      {text:'Mín.',x:158,align:'center'},{text:'Estado',x:175},{text:'Costo',x:211,align:'right'},
      {text:'PVP',x:236,align:'right'},{text:'Valor costo USD',x:263,align:'right'},{text:'Valor costo Bs',x:288,align:'right'}
    ]);
    detailHeader();
    data.detailRows.forEach(row => {
      ensure(7);
      if (y < 32) detailHeader();
      pdf.setFontSize(6.1);
      pdf.text(row.code.slice(0, 18), margin + 1, y);
      pdf.text(row.name.slice(0, 40), 38, y);
      pdf.text(row.category.slice(0, 22), 105, y);
      pdf.text(`${row.stock} ${row.unit}`, 145, y, {align:'center'});
      pdf.text(String(row.minStock), 158, y, {align:'center'});
      pdf.text(row.status, 175, y);
      pdf.text(money(row.costUSD, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

), 211, y, {align:'right'});
      pdf.text(money(row.retailUSD, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

), 236, y, {align:'right'});
      pdf.text(money(row.valueCostUSD, '
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

), 263, y, {align:'right'});
      pdf.text(money(row.valueCostBs, 'Bs '), 288, y, {align:'right'});
      y += 5.5;
    });

    ensure(16);
    y += 4;
    pdf.setDrawColor(148, 163, 184);
    pdf.line(margin, y, pageWidth - margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.text('Documento generado por el módulo de inventario. Los valores Bs. corresponden a la tasa BCV indicada en el encabezado.', margin, y + 5);
    pdf.text(`Páginas: ${pdf.getNumberOfPages()}`, pageWidth - margin, y + 5, {align:'right'});

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Error generating professional inventory PDF:', error);
    return false;
  }
}

export interface PrintOptions {
  format?: 'a4' | 'thermal' | 'thermal80' | 'thermal58';
  title?: string;
}

export function printElement(elementId: string, options?: PrintOptions) {
  const printContents = document.getElementById(elementId)?.innerHTML;
  if (!printContents) return;

  const format = options?.format || 'a4';
  const isThermal = format === 'thermal' || format === 'thermal80' || format === 'thermal58';
  const paperWidth = format === 'thermal58' ? '54mm' : '76mm';
  const pageSize = format === 'thermal58' ? '58mm auto' : '80mm auto';
  const docTitle = options?.title || (isThermal ? 'Ticket Fiscal Térmico POS' : 'Impresión Fiscal / Reporte');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const thermalStyles = `
    @page {
      size: ${pageSize};
      margin: 0mm;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace;
      width: ${paperWidth};
      margin: 0 auto;
      padding: 3mm 2mm 8mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000000;
    }
    * {
      color: #000000 !important;
      background: transparent !important;
      box-shadow: none !important;
      text-shadow: none !important;
      font-family: 'Courier New', Courier, Monaco, Consolas, 'Lucida Console', monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th, td {
      padding: 3px 1px;
      vertical-align: top;
      font-size: 10.5px;
    }
    tr, .item-row {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .divider, hr {
      border: 0;
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border: 0;
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .divider-solid {
      border: 0;
      border-top: 1px solid #000000;
      margin: 6px 0;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9.5px; }
    .text-lg { font-size: 13px; font-weight: bold; }
    .text-xl { font-size: 15px; font-weight: bold; }
    img {
      filter: grayscale(100%) contrast(200%);
      max-width: 100%;
      height: auto;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const standardA4Styles = `
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle}</title>
        <meta charset="utf-8">
        <style>
          ${isThermal ? thermalStyles : standardA4Styles}
        </style>
      </head>
      <body>
        ${printContents}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

