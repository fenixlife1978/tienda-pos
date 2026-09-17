import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import {
  FileDown,
  Printer,
  X,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  DollarSign,
  TrendingUp,
  Filter,
  Layers,
  Sparkles,
  Download,
  Loader2,
  ArrowDownRight,
  ShieldAlert,
} from 'lucide-react';
import { exportElementToPDF, exportToCSV } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';

interface InventoryExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilter?: 'all' | 'low_stock' | 'out_of_stock';
}

export interface CategoryStat {
  itemsCount: number;
  units: number;
  costUSD: number;
  retailUSD: number;
  lowStockItems: number;
}

export const InventoryExecutiveReportModal: React.FC<InventoryExecutiveReportModalProps> = ({
  isOpen,
  onClose,
  initialFilter = 'all',
}) => {
  const { products, settings } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low_stock' | 'out_of_stock' | 'healthy'>(
    initialFilter === 'low_stock' ? 'low_stock' : 'all'
  );
  const [paperFormat, setPaperFormat] = useState<'a4' | 'letter'>('a4');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const reportContainerRef = useRef<HTMLDivElement | null>(null);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered Products for the Report
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // Stock status filter
      if (statusFilter === 'out_of_stock') {
        return p.stock <= 0;
      }
      if (statusFilter === 'low_stock') {
        return p.stock > 0 && p.stock <= p.minStock;
      }
      if (statusFilter === 'healthy') {
        return p.stock > p.minStock;
      }
      return true;
    });
  }, [products, selectedCategory, statusFilter]);

  // Executive Metrics Calculation
  const metrics = useMemo(() => {
    let totalUnits = 0;
    let totalCostUSD = 0;
    let totalRetailUSD = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let healthyStockCount = 0;

    // Category breakdown map
    const categoryStats: {
      [cat: string]: {
        itemsCount: number;
        units: number;
        costUSD: number;
        retailUSD: number;
        lowStockItems: number;
      };
    } = {};

    products.forEach((p) => {
      totalUnits += p.stock;
      const costVal = p.costUSD * p.stock;
      const retailVal = p.priceUSD * p.stock;
      totalCostUSD += costVal;
      totalRetailUSD += retailVal;

      if (p.stock <= 0) {
        outOfStockCount++;
      } else if (p.stock <= p.minStock) {
        lowStockCount++;
      } else {
        healthyStockCount++;
      }

      const cat = p.category || 'Sin Categoría';
      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          itemsCount: 0,
          units: 0,
          costUSD: 0,
          retailUSD: 0,
          lowStockItems: 0,
        };
      }
      categoryStats[cat].itemsCount += 1;
      categoryStats[cat].units += p.stock;
      categoryStats[cat].costUSD += costVal;
      categoryStats[cat].retailUSD += retailVal;
      if (p.stock <= p.minStock) {
        categoryStats[cat].lowStockItems += 1;
      }
    });

    const totalCostBs = totalCostUSD * settings.bcvRate;
    const totalRetailBs = totalRetailUSD * settings.bcvRate;
    const potentialMarginUSD = totalRetailUSD - totalCostUSD;
    const potentialMarginPercent = totalRetailUSD > 0 ? (potentialMarginUSD / totalRetailUSD) * 100 : 0;

    // Filtered selection totals
    let filteredUnits = 0;
    let filteredCostUSD = 0;
    let filteredRetailUSD = 0;

    filteredProducts.forEach((p) => {
      filteredUnits += p.stock;
      filteredCostUSD += p.costUSD * p.stock;
      filteredRetailUSD += p.priceUSD * p.stock;
    });

    return {
      totalProductsCount: products.length,
      totalUnits,
      totalCostUSD,
      totalCostBs,
      totalRetailUSD,
      totalRetailBs,
      potentialMarginUSD,
      potentialMarginPercent,
      outOfStockCount,
      lowStockCount,
      healthyStockCount,
      categoryStats,
      filteredUnits,
      filteredCostUSD,
      filteredCostBs: filteredCostUSD * settings.bcvRate,
      filteredRetailUSD,
      filteredRetailBs: filteredRetailUSD * settings.bcvRate,
    };
  }, [products, filteredProducts, settings.bcvRate]);

  // Export to PDF action
  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      await exportElementToPDF(
        'executive-inventory-pdf-printable',
        `Reporte_Gerencial_Inventario_${dateStr}`,
        {
          format: paperFormat,
          orientation: 'portrait',
          margin: 6,
          scale: 2.2,
        }
      );
    } catch (err) {
      console.error('Error al generar PDF de inventario:', err);
      alert('Hubo un error al compilar el PDF del inventario.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Export to Excel/CSV
  const handleExportCSV = () => {
    const headers = [
      'Código / SKU',
      'Producto',
      'Categoría',
      'Unidad',
      'Stock Actual',
      'Stock Mínimo',
      'Estado Stock',
      'Costo Unit USD',
      'Costo Unit Bs',
      'Precio Venta USD',
      'Precio Venta Bs',
      'Valorización Costo USD',
      'Valorización Costo Bs',
      'Valorización Venta USD',
      'Valorización Venta Bs',
    ];

    const rows = filteredProducts.map((p) => {
      const isCritical = p.stock <= 0;
      const isLow = p.stock > 0 && p.stock <= p.minStock;
      const statusText = isCritical ? 'AGOTADO' : isLow ? 'STOCK BAJO' : 'ÓPTIMO';

      return [
        p.code,
        p.name,
        p.category,
        p.unit,
        p.stock,
        p.minStock,
        statusText,
        p.costUSD.toFixed(2),
        (p.costUSD * settings.bcvRate).toFixed(2),
        p.priceUSD.toFixed(2),
        (p.priceUSD * settings.bcvRate).toFixed(2),
        (p.costUSD * p.stock).toFixed(2),
        (p.costUSD * p.stock * settings.bcvRate).toFixed(2),
        (p.priceUSD * p.stock).toFixed(2),
        (p.priceUSD * p.stock * settings.bcvRate).toFixed(2),
      ];
    });

    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(`Inventario_Gerencial_${dateStr}`, [headers, ...rows]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Top Control Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Reporte Ejecutivo de Inventario & Valorización
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-mono font-bold text-[10px] rounded-md border border-indigo-200">
                  Exportable PDF
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Detalle gerencial de existencias, semáforo de reorden, valorización en USD y Bolívares (Tasa BCV).
              </p>
            </div>
          </div>

          {/* Quick Action Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
              title="Descargar reporte oficial en formato PDF de alta resolución"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>{isExportingPDF ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
              title="Exportar listado a Excel CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs transition cursor-pointer"
              title="Imprimir directamente"
            >
              <Printer className="w-4 h-4 text-slate-600" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 sm:px-5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" /> Filtros:
            </span>

            {/* Category selector */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas las Categorías ({products.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({products.filter((p) => p.category === cat).length})
                </option>
              ))}
            </select>

            {/* Status Tabs */}
            <div className="inline-flex bg-white p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-1 rounded font-semibold transition ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('low_stock')}
                className={`px-2 py-1 rounded font-semibold transition flex items-center gap-1 ${
                  statusFilter === 'low_stock'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Stock Bajo ({metrics.lowStockCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('out_of_stock')}
                className={`px-2 py-1 rounded font-semibold transition flex items-center gap-1 ${
                  statusFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <XCircle className="w-3 h-3" />
                Agotados ({metrics.outOfStockCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('healthy')}
                className={`px-2 py-1 rounded font-semibold transition flex items-center gap-1 ${
                  statusFilter === 'healthy'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                Óptimos ({metrics.healthyStockCount})
              </button>
            </div>
          </div>

          {/* Paper format selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Formato PDF:</span>
            <select
              value={paperFormat}
              onChange={(e) => setPaperFormat(e.target.value as 'a4' | 'letter')}
              className="bg-white border border-slate-300 text-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
            >
              <option value="a4">A4 Estándar</option>
              <option value="letter">Carta (Letter)</option>
            </select>
          </div>
        </div>

        {/* Scrollable Printable Report Preview Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100/50">
          
          {/* Container with ID targeted by html2canvas & jsPDF */}
          <div
            id="executive-inventory-pdf-printable"
            ref={reportContainerRef}
            className="bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-slate-200 max-w-4xl mx-auto space-y-6 text-slate-800"
          >
            {/* 1. Official Report Header */}
            <div className="border-b-2 border-indigo-600 pb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                    {settings.companyName || 'ERP Sistema Comercial'}
                  </h1>
                  <p className="text-xs text-slate-500 font-mono">
                    RIF: {settings.companyRif || 'J-50000000-0'} | Tel: {settings.companyPhone || '+58 424-5751804'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Dirección: {settings.companyAddress || 'Av. Principal, Edificio Central'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 font-black text-xs rounded-lg uppercase tracking-wider">
                  INFORME GERENCIAL DE INVENTARIO
                </span>
                <p className="text-xs font-bold text-slate-700 mt-1">
                  Tasa Oficial BCV: <span className="font-mono text-indigo-700">{formatPlainNumber(settings.bcvRate, 2)} Bs/USD</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Fecha de Emisión: {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            {/* 2. Executive Financial Summary Cards (Valuation in USD and Bs) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Valorización al Costo (USD)</p>
                <p className="text-base font-black text-indigo-700 font-mono mt-0.5">
                  {formatUSD(metrics.totalCostUSD)}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold font-mono">
                  {formatBs(metrics.totalCostBs)}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Valorización a la Venta (PVP)</p>
                <p className="text-base font-black text-slate-900 font-mono mt-0.5">
                  {formatUSD(metrics.totalRetailUSD)}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold font-mono">
                  {formatBs(metrics.totalRetailBs)}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Margen Bruto Proyectado</p>
                <p className="text-base font-black text-emerald-600 font-mono mt-0.5">
                  +{metrics.potentialMarginPercent.toFixed(1)}%
                </p>
                <p className="text-[10px] text-emerald-700 font-medium font-mono">
                  Ganancia: {formatUSD(metrics.potentialMarginUSD)}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Volumen en Bodega</p>
                <p className="text-base font-black text-slate-800 mt-0.5 font-mono">
                  {metrics.totalUnits.toLocaleString('es-VE')} unid.
                </p>
                <p className="text-[10px] text-slate-500">
                  {metrics.totalProductsCount} referencias registradas
                </p>
              </div>
            </div>

            {/* 3. Stock Health Warning Bar (Semáforo de Reorden) */}
            <div className="p-3.5 bg-gradient-to-r from-amber-50 via-rose-50 to-emerald-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white/80 p-2 rounded-lg border border-rose-200 shadow-2xs">
                <p className="text-[10px] font-bold text-rose-700 uppercase flex items-center justify-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-600" /> Agotados (Stock 0)
                </p>
                <p className="text-lg font-black text-rose-600 font-mono mt-0.5">{metrics.outOfStockCount}</p>
                <p className="text-[9px] text-rose-500 font-semibold">Requiere reposición inmediata</p>
              </div>

              <div className="bg-white/80 p-2 rounded-lg border border-amber-200 shadow-2xs">
                <p className="text-[10px] font-bold text-amber-700 uppercase flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Stock Crítico / Bajo
                </p>
                <p className="text-lg font-black text-amber-600 font-mono mt-0.5">{metrics.lowStockCount}</p>
                <p className="text-[9px] text-amber-600 font-semibold">Por debajo del stock mínimo</p>
              </div>

              <div className="bg-white/80 p-2 rounded-lg border border-emerald-200 shadow-2xs">
                <p className="text-[10px] font-bold text-emerald-700 uppercase flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Stock Saludable
                </p>
                <p className="text-lg font-black text-emerald-600 font-mono mt-0.5">{metrics.healthyStockCount}</p>
                <p className="text-[9px] text-emerald-600 font-semibold">Niveles normales de operación</p>
              </div>
            </div>

            {/* 4. Category Breakdown Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Resumen de Valorización por Categoría
                </h3>
                <span className="text-[10px] text-slate-400">Desglose consolidado</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Categoría</th>
                      <th className="py-2 px-2 text-center">Productos</th>
                      <th className="py-2 px-2 text-center">Unidades</th>
                      <th className="py-2 px-3 text-right">Valor Costo (USD)</th>
                      <th className="py-2 px-3 text-right">Valor Costo (Bs)</th>
                      <th className="py-2 px-3 text-right">Valor Venta (USD)</th>
                      <th className="py-2 px-2 text-center">Alertas Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {(Object.entries(metrics.categoryStats) as [string, CategoryStat][]).map(([cat, stat]) => (
                      <tr key={cat} className="hover:bg-slate-50/80">
                        <td className="py-1.5 px-3 font-sans font-bold text-slate-800">{cat}</td>
                        <td className="py-1.5 px-2 text-center">{stat.itemsCount}</td>
                        <td className="py-1.5 px-2 text-center font-bold">{stat.units}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-indigo-700">{formatUSD(stat.costUSD)}</td>
                        <td className="py-1.5 px-3 text-right text-slate-600">{formatBs(stat.costUSD * settings.bcvRate)}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-900">{formatUSD(stat.retailUSD)}</td>
                        <td className="py-1.5 px-2 text-center">
                          {stat.lowStockItems > 0 ? (
                            <span className="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold text-[9px] rounded">
                              {stat.lowStockItems} alertas
                            </span>
                          ) : (
                            <span className="text-emerald-600 text-[9px] font-bold">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t border-slate-200 text-slate-900 font-mono">
                    <tr>
                      <td className="py-2 px-3 font-sans">TOTALES CONSOLIDADOS</td>
                      <td className="py-2 px-2 text-center">{metrics.totalProductsCount}</td>
                      <td className="py-2 px-2 text-center">{metrics.totalUnits}</td>
                      <td className="py-2 px-3 text-right text-indigo-700">{formatUSD(metrics.totalCostUSD)}</td>
                      <td className="py-2 px-3 text-right">{formatBs(metrics.totalCostBs)}</td>
                      <td className="py-2 px-3 text-right">{formatUSD(metrics.totalRetailUSD)}</td>
                      <td className="py-2 px-2 text-center text-amber-700 font-black">
                        {metrics.outOfStockCount + metrics.lowStockCount}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 5. Detailed Inventory List with Alerts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                  Detalle de Artículos ({filteredProducts.length} mostrados)
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  Total Filtrado: {formatUSD(metrics.filteredCostUSD)} / {formatBs(metrics.filteredCostBs)}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5">Código / SKU</th>
                      <th className="py-2 px-2">Descripción Producto</th>
                      <th className="py-2 px-2">Categoría</th>
                      <th className="py-2 px-2 text-center">Stock Actual</th>
                      <th className="py-2 px-2 text-center">Mínimo</th>
                      <th className="py-2 px-2 text-center">Estado</th>
                      <th className="py-2 px-2 text-right">Costo Unit ($)</th>
                      <th className="py-2 px-2 text-right">PVP ($)</th>
                      <th className="py-2 px-2.5 text-right">Valor Costo ($)</th>
                      <th className="py-2 px-2.5 text-right">Valor Costo (Bs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredProducts.map((p) => {
                      const isCritical = p.stock <= 0;
                      const isLow = p.stock > 0 && p.stock <= p.minStock;
                      const valCostUSD = p.costUSD * p.stock;
                      const valCostBs = valCostUSD * settings.bcvRate;

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50 ${
                            isCritical ? 'bg-rose-50/40' : isLow ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-1.5 px-2.5 font-bold text-slate-700">{p.code}</td>
                          <td className="py-1.5 px-2 font-sans font-medium text-slate-900 max-w-[180px] truncate">
                            {p.name}
                          </td>
                          <td className="py-1.5 px-2 font-sans text-slate-600">{p.category}</td>
                          <td className="py-1.5 px-2 text-center font-bold">
                            <span
                              className={`${
                                isCritical
                                  ? 'text-rose-700 font-black'
                                  : isLow
                                  ? 'text-amber-700 font-black'
                                  : 'text-slate-800'
                              }`}
                            >
                              {p.stock} {p.unit}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center text-slate-500">{p.minStock}</td>
                          <td className="py-1.5 px-2 text-center">
                            {isCritical ? (
                              <span className="inline-block px-1.5 py-0.2 bg-rose-600 text-white font-bold text-[8px] rounded uppercase">
                                Agotado
                              </span>
                            ) : isLow ? (
                              <span className="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold text-[8px] rounded border border-amber-300 uppercase">
                                Reorden
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[8px]">ÓPTIMO</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600">{formatUSD(p.costUSD)}</td>
                          <td className="py-1.5 px-2 text-right font-bold text-slate-800">{formatUSD(p.priceUSD)}</td>
                          <td className="py-1.5 px-2.5 text-right font-bold text-indigo-700">{formatUSD(valCostUSD)}</td>
                          <td className="py-1.5 px-2.5 text-right text-slate-600">{formatBs(valCostBs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. Signature Block for Management / Auditing */}
            <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500">
              <div>
                <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Elaborado por: Gerencia de Inventario</p>
                <p className="text-[9px]">Firma y Sello de Almacén</p>
              </div>

              <div>
                <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Revisado por: Auditoría / Administración</p>
                <p className="text-[9px]">Aprobación Gerencial</p>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Mostrando <strong>{filteredProducts.length}</strong> de <strong>{products.length}</strong> referencias registradas.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span>Generar Documento PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
