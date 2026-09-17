import React, { useState, useEffect, useRef, useMemo } from 'react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Product, SystemSettings } from '../../types';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import {
  X,
  Barcode,
  Printer,
  FileDown,
  Settings2,
  Check,
  Search,
  Plus,
  Minus,
  RefreshCw,
  Building2,
  Layers,
  Sparkles,
  Loader2,
  Eye,
  Trash2,
  Sliders,
  CheckSquare,
  Square,
  DollarSign,
} from 'lucide-react';

export type LabelFormatType =
  | 'thermal_50x30' // 50mm x 30mm Roll
  | 'thermal_40x25' // 40mm x 25mm Roll
  | 'thermal_38x25' // 38mm x 25mm Roll
  | 'sheet_a4_24'   // A4 3 cols x 8 rows (24 per sheet - 70x37mm)
  | 'sheet_a4_30'   // A4 3 cols x 10 rows (30 per sheet - 70x29.7mm)
  | 'sheet_a4_40';  // A4 4 cols x 10 rows (40 per sheet - 52.5x29.7mm)

export interface LabelItem {
  product: Product;
  quantity: number;
}

interface BarcodeLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialSelectedProduct?: Product | null;
  settings: SystemSettings;
}

export const BarcodeLabelsModal: React.FC<BarcodeLabelsModalProps> = ({
  isOpen,
  onClose,
  products,
  initialSelectedProduct,
  settings,
}) => {
  // Label format selection
  const [labelFormat, setLabelFormat] = useState<LabelFormatType>('thermal_50x30');

  // Customization options
  const [showCompanyName, setShowCompanyName] = useState<boolean>(true);
  const [showProductName, setShowProductName] = useState<boolean>(true);
  const [showSkuCode, setShowSkuCode] = useState<boolean>(true);
  const [showCategory, setShowCategory] = useState<boolean>(false);
  const [priceDisplay, setPriceDisplay] = useState<'both' | 'usd' | 'bs' | 'none'>('both');
  const [showIvaBadge, setShowIvaBadge] = useState<boolean>(true);
  const [barcodeType, setBarcodeType] = useState<'CODE128' | 'EAN13'>('CODE128');

  // Product selection & label quantities
  const [labelItems, setLabelItems] = useState<{ [productId: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'products' | 'preview'>('preview');

  // Export / Print loading state
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Initialize selected products
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedProduct) {
        setLabelItems({ [initialSelectedProduct.id]: Math.max(1, Math.min(initialSelectedProduct.stock, 10) || 1) });
      } else {
        // Default: 1 of each product with stock > 0 (or first 10 products)
        const initialMap: { [id: string]: number } = {};
        products.slice(0, 12).forEach((p) => {
          initialMap[p.id] = 1;
        });
        setLabelItems(initialMap);
      }
      setActiveTab('preview');
    }
  }, [isOpen, initialSelectedProduct, products]);

  // Filter products for the selector list
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Flattened array of labels to render
  const selectedLabelList = useMemo(() => {
    const list: Product[] = [];
    Object.entries(labelItems).forEach(([prodId, rawQty]) => {
      const qty = Number(rawQty) || 0;
      const prod = products.find((p) => p.id === prodId);
      if (prod && qty > 0) {
        for (let i = 0; i < qty; i++) {
          list.push(prod);
        }
      }
    });
    return list;
  }, [labelItems, products]);

  const totalLabelsCount = selectedLabelList.length;

  // Handlers for adjusting product quantities
  const handleSetQuantity = (productId: string, qty: number) => {
    const safeQty = Math.max(0, Math.min(qty, 500));
    setLabelItems((prev) => ({
      ...prev,
      [productId]: safeQty,
    }));
  };

  const handleSetAllToStock = () => {
    const map: { [id: string]: number } = {};
    products.forEach((p) => {
      map[p.id] = Math.max(0, p.stock);
    });
    setLabelItems(map);
  };

  const handleSetAllToOne = () => {
    const map: { [id: string]: number } = {};
    products.forEach((p) => {
      map[p.id] = 1;
    });
    setLabelItems(map);
  };

  const handleClearAll = () => {
    setLabelItems({});
  };

  // Helper to render Barcode SVG into a canvas/dataURL or directly onto an SVG element
  const generateBarcodeDataUrl = (value: string, format: 'CODE128' | 'EAN13' = 'CODE128'): string => {
    try {
      const canvas = document.createElement('canvas');
      let sanitizedVal = value.trim();

      // For EAN13 ensure 12 or 13 numeric digits, fallback to CODE128 if invalid
      if (format === 'EAN13') {
        const isNumeric = /^\d{12,13}$/.test(sanitizedVal);
        if (!isNumeric) {
          JsBarcode(canvas, sanitizedVal || '000000', {
            format: 'CODE128',
            width: 1.6,
            height: 38,
            displayValue: false,
            margin: 2,
          });
          return canvas.toDataURL('image/png');
        }
      }

      JsBarcode(canvas, sanitizedVal || '000000', {
        format: format,
        width: 1.6,
        height: 38,
        displayValue: false,
        margin: 2,
      });
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.warn('Barcode generation fallback:', err);
      const canvas = document.createElement('canvas');
      try {
        JsBarcode(canvas, value.replace(/[^a-zA-Z0-9]/g, '') || 'ITEM', {
          format: 'CODE128',
          width: 1.5,
          height: 36,
          displayValue: false,
          margin: 2,
        });
        return canvas.toDataURL('image/png');
      } catch {
        return '';
      }
    }
  };

  // Generate and Download PDF for Barcode Labels
  const handleGeneratePDF = async () => {
    if (totalLabelsCount === 0) {
      alert('Seleccione al menos un producto para generar etiquetas.');
      return;
    }

    setIsGeneratingPDF(true);
    setStatusMessage('Generando documento PDF de etiquetas...');

    try {
      // Small pause to let UI update
      await new Promise((r) => setTimeout(r, 60));

      if (labelFormat.startsWith('thermal_')) {
        // Thermal Roll: 1 label per page
        let widthMm = 50;
        let heightMm = 30;

        if (labelFormat === 'thermal_40x25') {
          widthMm = 40;
          heightMm = 25;
        } else if (labelFormat === 'thermal_38x25') {
          widthMm = 38;
          heightMm = 25;
        }

        const pdf = new jsPDF({
          orientation: widthMm > heightMm ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [heightMm, widthMm], // [height, width] in landscape
        });

        for (let i = 0; i < selectedLabelList.length; i++) {
          if (i > 0) {
            pdf.addPage([heightMm, widthMm], widthMm > heightMm ? 'landscape' : 'portrait');
          }

          const product = selectedLabelList[i];
          const barcodeDataUrl = generateBarcodeDataUrl(product.code, barcodeType);

          // Margins
          const marginX = 2;
          let currentY = 3.5;

          // 1. Company Name
          if (showCompanyName) {
            pdf.setFontSize(6.5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(60, 60, 60);
            const compName = (settings.companyName || 'ERP COMERCIAL').toUpperCase();
            pdf.text(compName.substring(0, 26), widthMm / 2, currentY, { align: 'center' });
            currentY += 2.8;
          }

          // 2. Product Name
          if (showProductName) {
            pdf.setFontSize(heightMm <= 25 ? 7 : 7.8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(15, 23, 42);
            const splitName = pdf.splitTextToSize(product.name, widthMm - marginX * 2);
            pdf.text(splitName[0] || product.name, widthMm / 2, currentY, { align: 'center' });
            currentY += 3.2;
          }

          // 3. Barcode Image
          const barcodeHeight = heightMm <= 25 ? 8 : 10;
          const barcodeWidth = widthMm - marginX * 2 - 2;
          if (barcodeDataUrl) {
            pdf.addImage(
              barcodeDataUrl,
              'PNG',
              (widthMm - barcodeWidth) / 2,
              currentY,
              barcodeWidth,
              barcodeHeight
            );
            currentY += barcodeHeight + 2.2;
          }

          // 4. SKU Code under Barcode
          if (showSkuCode) {
            pdf.setFontSize(6.5);
            pdf.setFont('courier', 'bold');
            pdf.setTextColor(71, 85, 105);
            pdf.text(product.code, widthMm / 2, currentY, { align: 'center' });
            currentY += 2.8;
          }

          // 5. Price Section
          if (priceDisplay !== 'none') {
            const priceUSD = product.priceUSD;
            const priceBs = priceUSD * settings.bcvRate;

            pdf.setFont('helvetica', 'bold');

            if (priceDisplay === 'both') {
              pdf.setFontSize(8.5);
              pdf.setTextColor(15, 23, 42);
              const textUSD = formatUSD(priceUSD);
              const textBs = formatBs(priceBs);

              if (heightMm <= 25) {
                pdf.text(`${textUSD} / ${textBs}`, widthMm / 2, currentY, { align: 'center' });
              } else {
                pdf.text(textUSD, marginX + 2, currentY);
                pdf.setFontSize(7.5);
                pdf.setTextColor(5, 150, 105);
                pdf.text(textBs, widthMm - marginX - 2, currentY, { align: 'right' });
              }
            } else if (priceDisplay === 'usd') {
              pdf.setFontSize(9);
              pdf.setTextColor(15, 23, 42);
              pdf.text(`PVP: ${formatUSD(priceUSD)}`, widthMm / 2, currentY, { align: 'center' });
            } else if (priceDisplay === 'bs') {
              pdf.setFontSize(8.5);
              pdf.setTextColor(5, 150, 105);
              pdf.text(`PVP: ${formatBs(priceBs)}`, widthMm / 2, currentY, { align: 'center' });
            }
          }
        }

        const dateStr = new Date().toISOString().split('T')[0];
        pdf.save(`Etiquetas_Termicas_${labelFormat}_${dateStr}.pdf`);
      } else {
        // Sheet Grid (A4 / Letter Multi-label pages)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        let cols = 3;
        let rows = 8;
        if (labelFormat === 'sheet_a4_30') {
          cols = 3;
          rows = 10;
        } else if (labelFormat === 'sheet_a4_40') {
          cols = 4;
          rows = 10;
        }

        const labelsPerPage = cols * rows;
        const pageMarginX = 6;
        const pageMarginY = 10;
        const pageWidth = 210;
        const pageHeight = 297;
        const cellWidth = (pageWidth - pageMarginX * 2) / cols;
        const cellHeight = (pageHeight - pageMarginY * 2) / rows;

        for (let i = 0; i < selectedLabelList.length; i++) {
          const pageIndex = Math.floor(i / labelsPerPage);
          const indexOnPage = i % labelsPerPage;

          if (i > 0 && indexOnPage === 0) {
            pdf.addPage('a4', 'portrait');
          }

          const colIndex = indexOnPage % cols;
          const rowIndex = Math.floor(indexOnPage / cols);

          const x = pageMarginX + colIndex * cellWidth;
          const y = pageMarginY + rowIndex * cellHeight;

          // Draw subtle border guide for cutting/peeling
          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.15);
          pdf.rect(x + 0.8, y + 0.8, cellWidth - 1.6, cellHeight - 1.6);

          const product = selectedLabelList[i];
          const barcodeDataUrl = generateBarcodeDataUrl(product.code, barcodeType);

          const innerMargin = 2;
          let currentY = y + 4;
          const labelCenterX = x + cellWidth / 2;

          // 1. Company Name Header
          if (showCompanyName) {
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            const compName = (settings.companyName || 'ERP COMERCIAL').toUpperCase();
            pdf.text(compName.substring(0, 24), labelCenterX, currentY, { align: 'center' });
            currentY += 2.8;
          }

          // 2. Product Name
          if (showProductName) {
            pdf.setFontSize(cellHeight < 30 ? 7 : 7.8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(15, 23, 42);
            const splitName = pdf.splitTextToSize(product.name, cellWidth - innerMargin * 2);
            pdf.text(splitName[0] || product.name, labelCenterX, currentY, { align: 'center' });
            currentY += 3.2;
          }

          // 3. Barcode
          const barcodeH = cellHeight < 30 ? 7.5 : 9.5;
          const barcodeW = cellWidth - innerMargin * 2 - 4;
          if (barcodeDataUrl) {
            pdf.addImage(
              barcodeDataUrl,
              'PNG',
              x + (cellWidth - barcodeW) / 2,
              currentY,
              barcodeW,
              barcodeH
            );
            currentY += barcodeH + 2.2;
          }

          // 4. SKU code text
          if (showSkuCode) {
            pdf.setFontSize(6.5);
            pdf.setFont('courier', 'bold');
            pdf.setTextColor(71, 85, 105);
            pdf.text(product.code, labelCenterX, currentY, { align: 'center' });
            currentY += 2.8;
          }

          // 5. Price tag
          if (priceDisplay !== 'none') {
            const priceUSD = product.priceUSD;
            const priceBs = priceUSD * settings.bcvRate;

            pdf.setFont('helvetica', 'bold');

            if (priceDisplay === 'both') {
              pdf.setFontSize(8);
              pdf.setTextColor(15, 23, 42);
              pdf.text(formatUSD(priceUSD), x + innerMargin + 2, currentY);

              pdf.setFontSize(7.5);
              pdf.setTextColor(5, 150, 105);
              pdf.text(formatBs(priceBs), x + cellWidth - innerMargin - 2, currentY, { align: 'right' });
            } else if (priceDisplay === 'usd') {
              pdf.setFontSize(8.5);
              pdf.setTextColor(15, 23, 42);
              pdf.text(formatUSD(priceUSD), labelCenterX, currentY, { align: 'center' });
            } else if (priceDisplay === 'bs') {
              pdf.setFontSize(8);
              pdf.setTextColor(5, 150, 105);
              pdf.text(formatBs(priceBs), labelCenterX, currentY, { align: 'center' });
            }
          }
        }

        const dateStr = new Date().toISOString().split('T')[0];
        pdf.save(`Etiquetas_A4_Hoja_${labelFormat}_${dateStr}.pdf`);
      }

      setStatusMessage('¡Archivo PDF generado exitosamente!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Error al generar PDF de etiquetas:', err);
      alert('Ocurrió un error al generar el PDF. Por favor intente nuevamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Direct Browser Print
  const handleDirectPrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-sm">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Generador de Etiquetas de Código de Barras PDF
              </h2>
              <p className="text-xs text-slate-400">
                Imprima etiquetas adhesivas para rollos térmicos (Zebra / Xprinter) y hojas A4 / Carta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-2.5 py-1 bg-indigo-900/60 text-indigo-200 text-xs font-semibold rounded-lg border border-indigo-700/50">
              {totalLabelsCount} {totalLabelsCount === 1 ? 'etiqueta' : 'etiquetas'} seleccionadas
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 shrink-0 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'preview'
                ? 'border-indigo-600 text-indigo-600 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            Vista Previa de Etiquetas ({totalLabelsCount})
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'products'
                ? 'border-indigo-600 text-indigo-600 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Selección de Productos & Cantidades
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'config'
                ? 'border-indigo-600 text-indigo-600 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Configuración & Diseño de Etiqueta
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
          
          {/* TAB 1: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              
              {/* Top Quick Bar */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-slate-500 font-medium">Formato Activo: </span>
                    <span className="font-bold text-slate-900">
                      {labelFormat === 'thermal_50x30' && 'Rollo Térmico 50 x 30 mm'}
                      {labelFormat === 'thermal_40x25' && 'Rollo Térmico 40 x 25 mm'}
                      {labelFormat === 'thermal_38x25' && 'Rollo Térmico 38 x 25 mm'}
                      {labelFormat === 'sheet_a4_24' && 'Hoja A4 (24 etiquetas / página - 3x8)'}
                      {labelFormat === 'sheet_a4_30' && 'Hoja A4 (30 etiquetas / página - 3x10)'}
                      {labelFormat === 'sheet_a4_40' && 'Hoja A4 (40 etiquetas / página - 4x10)'}
                    </span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div>
                    <span className="text-slate-500 font-medium">Tasa BCV: </span>
                    <span className="font-bold text-indigo-600">{formatPlainNumber(settings.bcvRate, 2)} Bs/$</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('products')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                  >
                    Modificar Cantidades
                  </button>
                  <button
                    onClick={() => setActiveTab('config')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                  >
                    Ajustar Diseño
                  </button>
                </div>
              </div>

              {/* Printable / Preview Container */}
              {totalLabelsCount === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                  <Barcode className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                  <h3 className="text-sm font-bold text-slate-700">No hay etiquetas seleccionadas</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Seleccione productos y especifique la cantidad de etiquetas que desea imprimir.
                  </p>
                  <button
                    onClick={() => setActiveTab('products')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    Seleccionar Productos
                  </button>
                </div>
              ) : (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-indigo-600" />
                      Vista Previa de Renderizado Físico ({totalLabelsCount} etiquetas)
                    </p>
                    <span className="text-[11px] text-slate-400">
                      Escala 1:1 aproximada para previsualización
                    </span>
                  </div>

                  {/* Grid of label stickers */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {selectedLabelList.map((product, idx) => {
                      const barcodeUrl = generateBarcodeDataUrl(product.code, barcodeType);
                      const priceBs = product.priceUSD * settings.bcvRate;

                      return (
                        <div
                          key={`${product.id}-${idx}`}
                          className="bg-white p-2.5 rounded-lg border border-slate-300 shadow-xs flex flex-col justify-between items-center text-center relative hover:shadow-md transition overflow-hidden min-h-[140px]"
                          style={{
                            aspectRatio:
                              labelFormat === 'thermal_50x30'
                                ? '5 / 3'
                                : labelFormat === 'thermal_40x25' || labelFormat === 'thermal_38x25'
                                ? '4 / 2.5'
                                : '7 / 3.7',
                          }}
                        >
                          {/* Company */}
                          {showCompanyName && (
                            <p className="text-[9px] font-extrabold text-slate-600 uppercase tracking-tight truncate w-full">
                              {settings.companyName || 'ERP COMERCIAL'}
                            </p>
                          )}

                          {/* Product Name */}
                          {showProductName && (
                            <p className="text-[10px] font-black text-slate-900 leading-tight line-clamp-2 w-full mt-0.5">
                              {product.name}
                            </p>
                          )}

                          {/* Barcode Image */}
                          <div className="my-1 w-full flex items-center justify-center">
                            {barcodeUrl ? (
                              <img
                                src={barcodeUrl}
                                alt={product.code}
                                className="w-full h-8 object-contain"
                              />
                            ) : (
                              <div className="h-8 bg-slate-100 flex items-center justify-center text-[8px] text-slate-400 font-mono">
                                ||||||||||||||||||
                              </div>
                            )}
                          </div>

                          {/* SKU Text */}
                          {showSkuCode && (
                            <p className="text-[9px] font-mono font-bold text-slate-600 tracking-wider">
                              {product.code}
                            </p>
                          )}

                          {/* Prices */}
                          {priceDisplay !== 'none' && (
                            <div className="w-full mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                              {priceDisplay === 'both' && (
                                <>
                                  <span className="text-slate-900">{formatUSD(product.priceUSD)}</span>
                                  <span className="text-emerald-700 text-[9px]">{formatBs(priceBs)}</span>
                                </>
                              )}
                              {priceDisplay === 'usd' && (
                                <span className="text-slate-900 w-full text-center">
                                  PVP: {formatUSD(product.priceUSD)}
                                </span>
                              )}
                              {priceDisplay === 'bs' && (
                                <span className="text-emerald-700 w-full text-center">
                                  PVP: {formatBs(priceBs)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Index badge */}
                          <span className="absolute top-1 right-1 text-[8px] font-mono text-slate-300 font-bold">
                            #{idx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRODUCT SELECTION & QUANTITIES */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              
              {/* Quick Actions & Search Toolbar */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto por SKU o nombre..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSetAllToOne}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                    title="1 etiqueta por cada producto"
                  >
                    1 c/u
                  </button>
                  <button
                    onClick={handleSetAllToStock}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg transition"
                    title="Cantidad igual al Stock actual de cada producto"
                  >
                    Según Stock Físico
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg transition"
                    title="Desmarcar todos"
                  >
                    Limpiar Todo
                  </button>
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3 text-center">Stock</th>
                        <th className="py-2.5 px-3 text-right">PVP USD</th>
                        <th className="py-2.5 px-3 text-center">Etiquetas a Imprimir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((p) => {
                        const count = labelItems[p.id] || 0;
                        const isSelected = count > 0;

                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50 transition ${isSelected ? 'bg-indigo-50/40' : ''}`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={p.image}
                                  alt={p.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <div>
                                  <p className="font-bold text-slate-900 leading-tight">{p.name}</p>
                                  <p className="text-[10px] text-slate-400">{p.unit}</p>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                              {p.code}
                            </td>

                            <td className="py-2.5 px-3 text-slate-500 font-medium">
                              {p.category}
                            </td>

                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              <span className={p.stock <= 0 ? 'text-rose-600' : 'text-slate-800'}>
                                {p.stock}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatUSD(p.priceUSD)}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleSetQuantity(p.id, count - 1)}
                                  className="p-1 hover:bg-slate-100 text-slate-600 transition"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max="500"
                                  value={count}
                                  onChange={(e) => handleSetQuantity(p.id, parseInt(e.target.value) || 0)}
                                  className="w-12 text-center text-xs font-bold text-slate-900 py-1 focus:outline-hidden focus:bg-indigo-50"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSetQuantity(p.id, count + 1)}
                                  className="p-1 hover:bg-slate-100 text-slate-600 transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONFIGURATION & DESIGN */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Format & Dimensions */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Printer className="w-4 h-4 text-indigo-600" />
                  Formato de Impresión & Dimensiones
                </h3>

                <div className="space-y-2 text-xs">
                  <label className="block font-semibold text-slate-700">Tipo de Papel / Adhesivo</label>
                  
                  {/* Thermal Roll options */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Rollo Térmico Continuo (1 etiqueta por página)
                    </p>
                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="radio"
                        name="labelFormat"
                        checked={labelFormat === 'thermal_50x30'}
                        onChange={() => setLabelFormat('thermal_50x30')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-bold text-slate-900">50 mm x 30 mm (Estándar Comercial)</p>
                        <p className="text-[10px] text-slate-500">Zebra, Xprinter, Phomemo, TSC</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="radio"
                        name="labelFormat"
                        checked={labelFormat === 'thermal_40x25'}
                        onChange={() => setLabelFormat('thermal_40x25')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-bold text-slate-900">40 mm x 25 mm (Góndola / Estantería)</p>
                        <p className="text-[10px] text-slate-500">Compacto para mini estanterías</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="radio"
                        name="labelFormat"
                        checked={labelFormat === 'thermal_38x25'}
                        onChange={() => setLabelFormat('thermal_38x25')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-bold text-slate-900">38 mm x 25 mm (Joyería / Farmacia)</p>
                        <p className="text-[10px] text-slate-500">Ideal para productos pequeños</p>
                      </div>
                    </label>
                  </div>

                  {/* Sheet A4 options */}
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Hojas A4 / Carta (Impresora Láser o Inyección de Tinta)
                    </p>
                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="radio"
                        name="labelFormat"
                        checked={labelFormat === 'sheet_a4_24'}
                        onChange={() => setLabelFormat('sheet_a4_24')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-bold text-slate-900">A4 - 24 Etiquetas por Hoja (3x8)</p>
                        <p className="text-[10px] text-slate-500">Tamaño etiqueta: 70 x 37 mm</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="radio"
                        name="labelFormat"
                        checked={labelFormat === 'sheet_a4_30'}
                        onChange={() => setLabelFormat('sheet_a4_30')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-bold text-slate-900">A4 - 30 Etiquetas por Hoja (3x10)</p>
                        <p className="text-[10px] text-slate-500">Tamaño etiqueta: 70 x 29.7 mm (Tipo Avery 5160)</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="radio"
                        name="labelFormat"
                        checked={labelFormat === 'sheet_a4_40'}
                        onChange={() => setLabelFormat('sheet_a4_40')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="font-bold text-slate-900">A4 - 40 Etiquetas por Hoja (4x10 Mini)</p>
                        <p className="text-[10px] text-slate-500">Tamaño etiqueta: 52.5 x 29.7 mm</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Elements & Symbology Customization */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  Elementos Visibles en la Etiqueta
                </h3>

                <div className="space-y-3 text-xs">
                  
                  {/* Toggles */}
                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                      <span className="font-semibold text-slate-800">Nombre de la Empresa / Tienda</span>
                      <input
                        type="checkbox"
                        checked={showCompanyName}
                        onChange={(e) => setShowCompanyName(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                      <span className="font-semibold text-slate-800">Nombre del Producto</span>
                      <input
                        type="checkbox"
                        checked={showProductName}
                        onChange={(e) => setShowProductName(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                      <span className="font-semibold text-slate-800">Texto del Código SKU bajo las barras</span>
                      <input
                        type="checkbox"
                        checked={showSkuCode}
                        onChange={(e) => setShowSkuCode(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  {/* Price format selection */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Visualización de Precio</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPriceDisplay('both')}
                        className={`p-2 rounded-lg border font-bold text-center transition ${
                          priceDisplay === 'both'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        USD $ y Bs BCV
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceDisplay('usd')}
                        className={`p-2 rounded-lg border font-bold text-center transition ${
                          priceDisplay === 'usd'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        Solo USD ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceDisplay('bs')}
                        className={`p-2 rounded-lg border font-bold text-center transition ${
                          priceDisplay === 'bs'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        Solo Bolívares (Bs)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceDisplay('none')}
                        className={`p-2 rounded-lg border font-bold text-center transition ${
                          priceDisplay === 'none'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        Sin Precio
                      </button>
                    </div>
                  </div>

                  {/* Symbology */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Simbología del Código de Barras</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBarcodeType('CODE128')}
                        className={`p-2 rounded-lg border font-bold text-center transition ${
                          barcodeType === 'CODE128'
                            ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        CODE128 (Universal)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBarcodeType('EAN13')}
                        className={`p-2 rounded-lg border font-bold text-center transition ${
                          barcodeType === 'EAN13'
                            ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        EAN-13 (13 dígitos)
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {statusMessage ? (
              <span className="text-indigo-600 font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 animate-pulse" />
                {statusMessage}
              </span>
            ) : (
              <span>
                Total a imprimir: <b className="text-slate-900">{totalLabelsCount} etiquetas</b>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleDirectPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Imprimir Navegador</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPDF || totalLabelsCount === 0}
              onClick={handleGeneratePDF}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span>{isGeneratingPDF ? 'Generando PDF...' : 'Descargar Etiquetas PDF'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
