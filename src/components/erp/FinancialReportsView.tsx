import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart3,
  Download,
  Printer,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  Calendar,
  FileSpreadsheet,
  HandCoins,
  Receipt,
  Boxes,
  FileDown,
  Loader2,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { exportToCSV, exportFinancialReportPDF } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { InventoryExecutiveReportModal } from './InventoryExecutiveReportModal';

export const FinancialReportsView: React.FC = () => {
  const { orders, products, receivables, payables, settings } = useApp();

  const [dateRange, setDateRange] = useState<'semana' | 'mes' | 'historico'>('mes');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isInventoryReportOpen, setIsInventoryReportOpen] = useState(false);

  // Calculations
  const completedOrders = orders.filter((o) => o.orderStatus !== 'cancelado');
  const totalSalesUSD = completedOrders.reduce((sum, o) => sum + o.totalUSD, 0);
  const totalSalesBs = totalSalesUSD * settings.bcvRate;

  // Approximate cost of goods sold
  const totalCostUSD = completedOrders.reduce((sum, o) => {
    return (
      sum +
      o.items.reduce((itemSum, it) => {
        const prod = products.find((p) => p.id === it.productId);
        return itemSum + (prod ? prod.costUSD * it.quantity : it.priceUSD * 0.7 * it.quantity);
      }, 0)
    );
  }, 0);

  const grossProfitUSD = Math.max(0, totalSalesUSD - totalCostUSD);
  const averageTicketUSD = completedOrders.length > 0 ? totalSalesUSD / completedOrders.length : 0;

  const totalReceivablesUSD = receivables.reduce((sum, r) => sum + r.balanceUSD, 0);
  const totalPayablesUSD = payables.reduce((sum, p) => sum + p.balanceUSD, 0);
  const totalInventoryUSD = products.reduce((sum, p) => sum + p.costUSD * p.stock, 0);

  // Chart data: Sales by day
  const salesByDayMap: { [date: string]: number } = {};
  completedOrders.forEach((o) => {
    const dateStr = new Date(o.createdAt).toLocaleDateString('es-VE', { month: 'short', day: 'numeric' });
    salesByDayMap[dateStr] = (salesByDayMap[dateStr] || 0) + o.totalUSD;
  });

  const salesTrendData = Object.keys(salesByDayMap).map((date) => ({
    date,
    ventasUSD: parseFloat(salesByDayMap[date].toFixed(2)),
  }));

  // Chart data: Sales by Category
  const categorySalesMap: { [cat: string]: number } = {};
  completedOrders.forEach((o) => {
    o.items.forEach((it) => {
      const prod = products.find((p) => p.id === it.productId);
      const cat = prod?.category || 'Otros';
      categorySalesMap[cat] = (categorySalesMap[cat] || 0) + it.priceUSD * it.quantity;
    });
  });

  const categoryChartData = Object.keys(categorySalesMap).map((cat) => ({
    name: cat,
    value: parseFloat(categorySalesMap[cat].toFixed(2)),
  }));

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  const handleExportFullFinancialCSV = () => {
    const rows = [
      ['ESTADO FINANCIERO Y REPORTES CONSOLIDADOS - ERP COMERCIAL'],
      ['Fecha de Emisión', new Date().toLocaleString('es-VE')],
      ['Tasa Oficial BCV Aplicada', `${formatPlainNumber(settings.bcvRate, 2)} Bs/USD`],
      [],
      ['INDICADOR FINANCIERO', 'MONTO (USD)', 'MONTO (BS BCV)'],
      ['Ventas Brutas Totales', formatPlainNumber(totalSalesUSD, 6), formatPlainNumber(totalSalesBs, 6)],
      ['Costo de Ventas (Mercancía)', formatPlainNumber(totalCostUSD, 6), formatPlainNumber(totalCostUSD * settings.bcvRate, 6)],
      ['Utilidad Bruta Operativa', formatPlainNumber(grossProfitUSD, 6), formatPlainNumber(grossProfitUSD * settings.bcvRate, 6)],
      ['Ticket Promedio por Venta', formatPlainNumber(averageTicketUSD, 6), formatPlainNumber(averageTicketUSD * settings.bcvRate, 6)],
      ['Cuentas por Cobrar Pendientes (CxC)', formatPlainNumber(totalReceivablesUSD, 6), formatPlainNumber(totalReceivablesUSD * settings.bcvRate, 6)],
      ['Cuentas por Pagar a Proveedores (CxP)', formatPlainNumber(totalPayablesUSD, 6), formatPlainNumber(totalPayablesUSD * settings.bcvRate, 6)],
      ['Valorización Total del Inventario', formatPlainNumber(totalInventoryUSD, 6), formatPlainNumber(totalInventoryUSD * settings.bcvRate, 6)],
      [],
      ['DETALLE DE VENTAS POR CATEGORÍA'],
      ['Categoría', 'Venta USD', 'Participación %'],
      ...categoryChartData.map((c) => [
        c.name,
        formatPlainNumber(c.value, 6),
        totalSalesUSD > 0 ? `${((c.value / totalSalesUSD) * 100).toFixed(1)}%` : '0%',
      ]),
    ];
    exportToCSV(`Reporte_Financiero_${new Date().toISOString().split('T')[0]}`, rows);
  };

  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    try {
      const ok = exportFinancialReportPDF(
        `Reporte_Ventas_Financiero_${new Date().toISOString().split('T')[0]}`,
        {
          companyName: settings.companyName || 'Distribuidora La Gran Bodega M&S',
          rif: settings.companyRif,
          phone: settings.companyPhone,
          bcvRate: settings.bcvRate,
          generatedAt: new Date().toISOString(),
          periodLabel: dateRange === 'semana' ? 'Período: última semana' : dateRange === 'mes' ? 'Período: mes actual' : 'Período: histórico',
          rows: [
            { label: 'Ventas brutas totales', usd: totalSalesUSD, bs: totalSalesBs },
            { label: 'Costo directo de mercancía vendida', usd: totalCostUSD, bs: totalCostUSD * settings.bcvRate },
            { label: 'Utilidad bruta estimada', usd: grossProfitUSD, bs: grossProfitUSD * settings.bcvRate },
            { label: 'Ticket promedio por venta', usd: averageTicketUSD, bs: averageTicketUSD * settings.bcvRate },
            { label: 'Cuentas por cobrar pendientes (CxC)', usd: totalReceivablesUSD, bs: totalReceivablesUSD * settings.bcvRate },
            { label: 'Cuentas por pagar a proveedores (CxP)', usd: totalPayablesUSD, bs: totalPayablesUSD * settings.bcvRate },
            { label: 'Inventario valorizado al costo', usd: totalInventoryUSD, bs: totalInventoryUSD * settings.bcvRate },
          ],
          categoryRows: categoryChartData.map((c) => ({
            name: c.name,
            usd: c.value,
            percentage: totalSalesUSD > 0 ? (c.value / totalSalesUSD) * 100 : 0,
          })),
        }
      );
      if (!ok) throw new Error('No fue posible generar el PDF profesional.');
    } catch (err) {
      console.error('Error al exportar reporte PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Reportes Financieros & Métricas Ejecutivas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Análisis de rentabilidad, ventas históricas multimoneda (USD / Bs BCV), flujo de caja y exportación contable.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsInventoryReportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer shadow-2xs"
            title="Generar informe gerencial exportable de inventario, existencias y valorización en PDF"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Reporte Inventario PDF</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl transition cursor-pointer shadow-2xs"
            title="Exportar informe de ventas consolidado a archivo PDF"
          >
            {isExportingPDF ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>{isExportingPDF ? 'Generando PDF...' : 'Exportar Ventas PDF'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Imprimir
          </button>

          <button
            onClick={handleExportFullFinancialCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* Printable / PDF Exportable Container */}
      <div id="financial-sales-report-printable" className="space-y-6 bg-slate-50/50 p-1 sm:p-2 rounded-2xl">
        {/* PDF Header Summary Banner (Visible in PDF / print) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                {settings.companyName || 'ERP Sistema Comercial'}
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">
                RIF: {settings.companyRif || 'J-50000000-0'} | Tel: {settings.companyPhone || '+58 424-5751804'}
              </p>
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100">
              Tasa Oficial BCV: {formatPlainNumber(settings.bcvRate, 2)} Bs/USD
            </span>
            <p className="text-[10px] text-slate-400 mt-1">
              Fecha de Emisión: {new Date().toLocaleDateString('es-VE')} {new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ventas Totales</span>
          <p className="text-lg font-extrabold text-slate-900 mt-1 font-mono">{formatUSD(totalSalesUSD)}</p>
          <p className="text-[10px] text-emerald-600 font-medium truncate">
            {formatBs(totalSalesBs)}
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Utilidad Bruta</span>
          <p className="text-lg font-extrabold text-emerald-700 mt-1 font-mono">{formatUSD(grossProfitUSD)}</p>
          <p className="text-[10px] text-slate-500 font-medium">Margen estimado</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ticket Promedio</span>
          <p className="text-lg font-extrabold text-slate-800 mt-1 font-mono">{formatUSD(averageTicketUSD)}</p>
          <p className="text-[10px] text-slate-400 font-medium">{completedOrders.length} transacciones</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Por Cobrar (CxC)</span>
          <p className="text-lg font-extrabold text-blue-700 mt-1 font-mono">{formatUSD(totalReceivablesUSD)}</p>
          <p className="text-[10px] text-slate-400 font-medium">Líneas de crédito</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Por Pagar (CxP)</span>
          <p className="text-lg font-extrabold text-rose-700 mt-1 font-mono">{formatUSD(totalPayablesUSD)}</p>
          <p className="text-[10px] text-slate-400 font-medium">A proveedores</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Stock Valorizado</span>
          <p className="text-lg font-extrabold text-purple-700 mt-1 font-mono">{formatUSD(totalInventoryUSD)}</p>
          <p className="text-[10px] text-slate-400 font-medium">Al costo de compra</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sales by Day Bar Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Ventas Diarias Consolidadas (USD)
              </h3>
              <p className="text-[11px] text-slate-500">Comportamiento de ingresos diarios (POS + Online)</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
              Tasa: {settings.bcvRate.toFixed(2)} Bs/$
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesTrendData.length > 0 ? salesTrendData : [{ date: 'Hoy', ventasUSD: totalSalesUSD }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                  formatter={(val: any) => [`$${Number(val).toFixed(2)} USD`, 'Ventas']}
                />
                <Bar dataKey="ventasUSD" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Chart (4 Cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-indigo-600" />
                Ventas por Categoría
              </h3>
              <p className="text-[11px] text-slate-500">Distribución porcentual</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(val: any) => [`$${Number(val).toFixed(2)} USD`, 'Total']}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-xs">Sin ventas registradas aún</p>
            )}
          </div>
        </div>

      </div>

      {/* Financial Statement Table (Estado de Resultados Operativo) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Estado de Resultados & Posición Financiera (Multimoneda)
            </h3>
            <p className="text-xs text-slate-500">
              Expresado en Dólares Estadounidenses (USD) y Bolívares (Bs) a tasa oficial del Banco Central de Venezuela.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">Período Fiscal Corriente</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex justify-between font-semibold text-slate-800">
            <span>(+) Ingresos por Ventas de Mercancía (Facturadas)</span>
            <span className="font-mono text-indigo-700 font-bold">
              {formatUSD(totalSalesUSD)} USD / {formatBs(totalSalesBs)}
            </span>
          </div>

          <div className="py-2.5 flex justify-between text-slate-600">
            <span>(-) Costo Directo de Mercancía Vendida (CMV)</span>
            <span className="font-mono text-rose-600">
              -{formatUSD(totalCostUSD)} USD / -{formatBs(totalCostUSD * settings.bcvRate)}
            </span>
          </div>

          <div className="py-3 flex justify-between font-extrabold text-emerald-800 text-sm bg-emerald-50/50 px-2 rounded-lg">
            <span>(=) UTILIDAD BRUTA ESTIMADA</span>
            <span className="font-mono">
              {formatUSD(grossProfitUSD)} USD / {formatBs(grossProfitUSD * settings.bcvRate)}
            </span>
          </div>

          <div className="py-2.5 flex justify-between text-slate-600">
            <span>Cartera Pendiente de Cobro (Activo Circulante CxC)</span>
            <span className="font-mono font-medium text-blue-700">
              {formatUSD(totalReceivablesUSD)} USD / {formatBs(totalReceivablesUSD * settings.bcvRate)}
            </span>
          </div>

          <div className="py-2.5 flex justify-between text-slate-600">
            <span>Obligaciones Comerciales con Proveedores (Pasivo CxP)</span>
            <span className="font-mono font-medium text-rose-700">
              {formatUSD(totalPayablesUSD)} USD / {formatBs(totalPayablesUSD * settings.bcvRate)}
            </span>
          </div>

          <div className="py-2.5 flex justify-between text-slate-600">
            <span>Valoración de Existencias Físicas en Almacén</span>
            <span className="font-mono font-medium text-purple-700">
              {formatUSD(totalInventoryUSD)} USD / {formatBs(totalInventoryUSD * settings.bcvRate)}
            </span>
          </div>
        </div>
      </div>

      {/* Modal: Executive Inventory PDF Report Generator */}
      <InventoryExecutiveReportModal
        isOpen={isInventoryReportOpen}
        onClose={() => setIsInventoryReportOpen(false)}
      />

    </div>
  </div>
  );
};
