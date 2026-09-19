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


function pdfMoney(value: number | undefined, currency: 'USD' | 'Bs'): string {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  const formatted = safe.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'USD' ? '$' + formatted : 'Bs ' + formatted;
}
function pdfText(value: unknown): string {
  return String(value ?? '').replace(/[^\x20-\x7EÀ-ÿ]/g, ' ');
}
export interface FinancialPDFRow { label: string; usd?: number; bs?: number; note?: string; }
export interface FinancialPDFData {
  companyName: string; rif?: string; phone?: string; bcvRate: number; generatedAt: string; periodLabel: string;
  rows: FinancialPDFRow[]; categoryRows: { name: string; usd: number; percentage: number }[];
}
export function exportFinancialReportPDF(filename: string, data: FinancialPDFData): boolean {
  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const margin = 14;
    let y = 16;
    const header = () => {
      pdf.setFillColor(15,23,42); pdf.rect(0,0,pageWidth,30,'F'); pdf.setTextColor(255,255,255);
      pdf.setFont('helvetica','bold'); pdf.setFontSize(14); pdf.text(pdfText(data.companyName || 'ERP Comercial'),margin,12);
      pdf.setFont('helvetica','normal'); pdf.setFontSize(8);
      pdf.text('RIF: '+pdfText(data.rif || 'No registrado')+' | Tel: '+pdfText(data.phone || 'No registrado'),margin,18);
      pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.text('REPORTE FINANCIERO EJECUTIVO',pageWidth-margin,12,{align:'right'});
      pdf.setFont('helvetica','normal'); pdf.text(pdfText(data.periodLabel),pageWidth-margin,18,{align:'right'}); pdf.setTextColor(30,41,59);
    };
    const ensure=(needed:number)=>{ if(y+needed>pageHeight-14){pdf.addPage();header();y=38;} };
    header(); y=39; pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.text('CONTROL DEL REPORTE',margin,y);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.text('Emisión: '+new Date(data.generatedAt).toLocaleString('es-VE'),margin,y+5);
    pdf.text('Tasa oficial BCV aplicada: '+pdfMoney(data.bcvRate,'Bs')+' / USD',margin,y+10); y+=18;
    pdf.setFillColor(241,245,249); pdf.rect(margin,y,pageWidth-margin*2,8,'F'); pdf.setFont('helvetica','bold'); pdf.setFontSize(8);
    pdf.text('INDICADOR',margin+3,y+5.5); pdf.text('USD',pageWidth-62,y+5.5,{align:'right'}); pdf.text('BS.',pageWidth-27,y+5.5,{align:'right'}); y+=10;
    pdf.setFont('helvetica','normal');
    for(const row of data.rows){ ensure(8); pdf.setDrawColor(226,232,240); pdf.line(margin,y+3,pageWidth-margin,y+3); pdf.text(pdfText(row.label).slice(0,75),margin+2,y);
      if(row.usd!==undefined) pdf.text(pdfMoney(row.usd,'USD'),pageWidth-62,y,{align:'right'}); if(row.bs!==undefined) pdf.text(pdfMoney(row.bs,'Bs'),pageWidth-27,y,{align:'right'}); y+=7; }
    y+=7; ensure(18); pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.text('VENTAS POR CATEGORÍA',margin,y); y+=6;
    pdf.setFillColor(241,245,249); pdf.rect(margin,y,pageWidth-margin*2,8,'F'); pdf.setFontSize(8);
    pdf.text('CATEGORÍA',margin+3,y+5.5); pdf.text('VENTA USD',pageWidth-58,y+5.5,{align:'right'}); pdf.text('%',pageWidth-25,y+5.5,{align:'right'}); y+=10;
    pdf.setFont('helvetica','normal'); for(const row of data.categoryRows){ensure(7);pdf.text(pdfText(row.name).slice(0,55),margin+2,y);pdf.text(pdfMoney(row.usd,'USD'),pageWidth-58,y,{align:'right'});pdf.text(row.percentage.toFixed(1)+'%',pageWidth-25,y,{align:'right'});y+=7;}
    pdf.save(filename.endsWith('.pdf')?filename:filename+'.pdf'); return true;
  } catch(error){ console.error('Error generando PDF financiero:',error); return false; }
}
export interface InventoryPDFCategoryRow { name:string; products:number; units:number; costUSD:number; costBs:number; retailUSD:number; alerts:number; }
export interface InventoryPDFDetailRow { code:string; name:string; category:string; stock:number; minStock:number; unit:string; status:string; costUSD:number; retailUSD:number; valueCostUSD:number; valueCostBs:number; }
export interface InventoryExecutivePDFData {
  companyName:string; rif?:string; phone?:string; address?:string; bcvRate:number; generatedAt:string; totalProducts:number; totalUnits:number;
  totalCostUSD:number; totalCostBs:number; totalRetailUSD:number; totalRetailBs:number; potentialMarginPercent:number;
  outOfStockCount:number; lowStockCount:number; healthyStockCount:number; categoryRows:InventoryPDFCategoryRow[]; detailRows:InventoryPDFDetailRow[];
}
export function exportInventoryExecutivePDF(filename:string,data:InventoryExecutivePDFData):boolean{
  try{
    const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}); const pageWidth=pdf.internal.pageSize.getWidth(); const pageHeight=pdf.internal.pageSize.getHeight(); const margin=10; let y=15;
    const header=()=>{pdf.setFillColor(15,23,42);pdf.rect(0,0,pageWidth,25,'F');pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(13);pdf.text(pdfText(data.companyName||'ERP Comercial'),margin,10);pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);pdf.text('RIF: '+pdfText(data.rif||'No registrado')+' | Tel: '+pdfText(data.phone||'No registrado')+' | '+pdfText(data.address||''),margin,16);pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.text('REPORTE GERENCIAL DE INVENTARIO',pageWidth-margin,10,{align:'right'});pdf.setFont('helvetica','normal');pdf.text('BCV '+pdfMoney(data.bcvRate,'Bs')+'/USD',pageWidth-margin,16,{align:'right'});pdf.setTextColor(30,41,59);};
    const ensure=(needed:number)=>{if(y+needed>pageHeight-10){pdf.addPage();header();y=33;}};
    header(); y=33; pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.text('Emisión: '+new Date(data.generatedAt).toLocaleString('es-VE'),margin,y);y+=6;
    const cards=[['PRODUCTOS',String(data.totalProducts)],['UNIDADES',data.totalUnits.toLocaleString('de-DE')],['COSTO',pdfMoney(data.totalCostUSD,'USD')],['VENTA POTENCIAL',pdfMoney(data.totalRetailUSD,'USD')],['MARGEN',data.potentialMarginPercent.toFixed(1)+'%'],['ALERTAS',data.outOfStockCount+' agotados / '+data.lowStockCount+' reorden']];
    const cardW=(pageWidth-margin*2-10)/3;
    cards.forEach((card,i)=>{const row=Math.floor(i/3),col=i%3,x=margin+col*(cardW+5),yy=y+row*15;pdf.setDrawColor(203,213,225);pdf.roundedRect(x,yy,cardW,12,1.5,1.5,'S');pdf.setFont('helvetica','bold');pdf.setFontSize(6.5);pdf.text(card[0],x+3,yy+4.5);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.text(card[1],x+3,yy+9.5);});
    y+=38; pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text('RESUMEN POR CATEGORÍA',margin,y);y+=5;pdf.setFillColor(241,245,249);pdf.rect(margin,y,pageWidth-margin*2,7,'F');pdf.setFontSize(7);
    pdf.text('CATEGORÍA',margin+2,y+4.8);pdf.text('PRODUCTOS',105,y+4.8,{align:'right'});pdf.text('UNIDADES',135,y+4.8,{align:'right'});pdf.text('COSTO USD',175,y+4.8,{align:'right'});pdf.text('COSTO BS.',215,y+4.8,{align:'right'});pdf.text('VENTA USD',250,y+4.8,{align:'right'});pdf.text('ALERTAS',285,y+4.8,{align:'right'});y+=9;
    pdf.setFont('helvetica','normal'); for(const row of data.categoryRows){ensure(7);pdf.text(pdfText(row.name).slice(0,42),margin+2,y);pdf.text(String(row.products),105,y,{align:'right'});pdf.text(row.units.toLocaleString('de-DE'),135,y,{align:'right'});pdf.text(pdfMoney(row.costUSD,'USD'),175,y,{align:'right'});pdf.text(pdfMoney(row.costBs,'Bs'),215,y,{align:'right'});pdf.text(pdfMoney(row.retailUSD,'USD'),250,y,{align:'right'});pdf.text(String(row.alerts),285,y,{align:'right'});y+=6;}
    y+=5;ensure(12);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text('DETALLE DE INVENTARIO',margin,y);y+=5;pdf.setFillColor(241,245,249);pdf.rect(margin,y,pageWidth-margin*2,7,'F');pdf.setFontSize(6.5);
    const cols=[margin+2,35,110,150,170,188,205,225,248,270];['CÓDIGO','PRODUCTO','CATEGORÍA','STOCK','MÍN.','UNIDAD','ESTADO','COSTO','PVP','VALOR COSTO'].forEach((h,i)=>pdf.text(h,cols[i],y+4.8));y+=9;
    pdf.setFont('helvetica','normal'); for(const row of data.detailRows){ensure(7);pdf.text(pdfText(row.code).slice(0,15),cols[0],y);pdf.text(pdfText(row.name).slice(0,32),cols[1],y);pdf.text(pdfText(row.category).slice(0,18),cols[2],y);pdf.text(String(row.stock),cols[3],y,{align:'right'});pdf.text(String(row.minStock),cols[4],y,{align:'right'});pdf.text(pdfText(row.unit).slice(0,8),cols[5],y);pdf.text(pdfText(row.status).slice(0,9),cols[6],y);pdf.text(pdfMoney(row.costUSD,'USD'),cols[7],y,{align:'right'});pdf.text(pdfMoney(row.retailUSD,'USD'),cols[8],y,{align:'right'});pdf.text(pdfMoney(row.valueCostUSD,'USD'),cols[9],y,{align:'right'});y+=6;}
    pdf.save(filename.endsWith('.pdf')?filename:filename+'.pdf'); return true;
  }catch(error){console.error('Error generando PDF de inventario:',error);return false;}
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
    .thermal-cash-report {
      width: 76mm !important;
      max-width: 76mm !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 3mm 2mm 8mm 2mm !important;
      box-shadow: none !important;
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

