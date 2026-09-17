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

