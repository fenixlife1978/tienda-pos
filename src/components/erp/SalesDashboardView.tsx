import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Package,
  Award,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieIcon,
  Download,
  FileDown,
  Loader2,
  Building2,
  Store,
  CreditCard,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import { exportToCSV, exportElementToPDF } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { formatPaymentMethod } from '../../types';
import { D3SalesAnalyticsPanel } from './D3SalesAnalyticsPanel';
import { InventoryExecutiveReportModal } from './InventoryExecutiveReportModal';
import { Boxes } from 'lucide-react';

export const SalesDashboardView: React.FC = () => {
  const { orders, products, settings } = useApp();

  const [activeAnalyticsView, setActiveAnalyticsView] = useState<'d3' | 'overview'>('d3');
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '14days' | '30days' | 'all'>('7days');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'BS'>('USD');
  const [topSortBy, setTopSortBy] = useState<'revenue' | 'units'>('revenue');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isInventoryReportOpen, setIsInventoryReportOpen] = useState(false);

  // Filter completed / non-cancelled orders based on selected time range
  const filteredOrders = useMemo(() => {
    const validOrders = orders.filter((o) => o.orderStatus !== 'cancelado');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (timeRange === 'today') {
      return validOrders.filter((o) => new Date(o.createdAt) >= todayStart);
    }
    if (timeRange === '7days') {
      const past7 = new Date(todayStart);
      past7.setDate(past7.getDate() - 6);
      return validOrders.filter((o) => new Date(o.createdAt) >= past7);
    }
    if (timeRange === '14days') {
      const past14 = new Date(todayStart);
      past14.setDate(past14.getDate() - 13);
      return validOrders.filter((o) => new Date(o.createdAt) >= past14);
    }
    if (timeRange === '30days') {
      const past30 = new Date(todayStart);
      past30.setDate(past30.getDate() - 29);
      return validOrders.filter((o) => new Date(o.createdAt) >= past30);
    }
    return validOrders;
  }, [orders, timeRange]);

  // Aggregate Key Metrics
  const metrics = useMemo(() => {
    const totalSalesUSD = filteredOrders.reduce((sum, o) => sum + o.totalUSD, 0);
    const totalSalesBs = totalSalesUSD * settings.bcvRate;
    const orderCount = filteredOrders.length;
    const averageTicketUSD = orderCount > 0 ? totalSalesUSD / orderCount : 0;
    const averageTicketBs = averageTicketUSD * settings.bcvRate;

    let totalUnitsSold = 0;
    let totalCostUSD = 0;

    filteredOrders.forEach((o) => {
      o.items.forEach((it) => {
        totalUnitsSold += it.quantity;
        const prod = products.find((p) => p.id === it.productId);
        const unitCost = prod ? prod.costUSD : it.unitPriceUSD * 0.7;
        totalCostUSD += unitCost * it.quantity;
      });
    });

    const grossProfitUSD = Math.max(0, totalSalesUSD - totalCostUSD);
    const grossProfitBs = grossProfitUSD * settings.bcvRate;
    const marginPercent = totalSalesUSD > 0 ? (grossProfitUSD / totalSalesUSD) * 100 : 0;

    return {
      totalSalesUSD,
      totalSalesBs,
      orderCount,
      averageTicketUSD,
      averageTicketBs,
      totalUnitsSold,
      grossProfitUSD,
      grossProfitBs,
      marginPercent,
    };
  }, [filteredOrders, products, settings.bcvRate]);

  // Daily Sales Trends Data for Recharts AreaChart
  const dailySalesTrendData = useMemo(() => {
    // Generate dates based on timeRange
    const dataMap: { [dateKey: string]: { dateStr: string; label: string; salesUSD: number; salesBs: number; ordersCount: number; unitsCount: number } } = {};

    // Sort orders by timestamp ascending
    const sorted = [...filteredOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    sorted.forEach((order) => {
      const d = new Date(order.createdAt);
      const dateKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('es-VE', { month: 'short', day: 'numeric' });

      if (!dataMap[dateKey]) {
        dataMap[dateKey] = {
          dateStr: dateKey,
          label,
          salesUSD: 0,
          salesBs: 0,
          ordersCount: 0,
          unitsCount: 0,
        };
      }

      dataMap[dateKey].salesUSD += order.totalUSD;
      dataMap[dateKey].salesBs += order.totalUSD * settings.bcvRate;
      dataMap[dateKey].ordersCount += 1;
      order.items.forEach((it) => {
        dataMap[dateKey].unitsCount += it.quantity;
      });
    });

    const result = Object.values(dataMap).map((entry) => ({
      ...entry,
      salesUSD: parseFloat(entry.salesUSD.toFixed(2)),
      salesBs: parseFloat(entry.salesBs.toFixed(2)),
      displaySales: currencyMode === 'USD' ? parseFloat(entry.salesUSD.toFixed(2)) : parseFloat(entry.salesBs.toFixed(2)),
    }));

    return result;
  }, [filteredOrders, settings.bcvRate, currencyMode]);

  // Top-Performing Products Data
  const topProductsData = useMemo(() => {
    const productAggMap: {
      [id: string]: {
        id: string;
        name: string;
        category: string;
        image: string;
        priceUSD: number;
        costUSD: number;
        unitsSold: number;
        totalRevenueUSD: number;
        totalRevenueBs: number;
        totalProfitUSD: number;
      };
    } = {};

    filteredOrders.forEach((o) => {
      o.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const prodId = item.productId || item.productName;
        const name = item.productName || prod?.name || 'Producto';
        const category = prod?.category || 'General';
        const image = prod?.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=60';
        const unitCost = prod ? prod.costUSD : item.unitPriceUSD * 0.7;
        const subtotal = item.subtotalUSD || item.unitPriceUSD * item.quantity;
        const profit = Math.max(0, subtotal - unitCost * item.quantity);

        if (!productAggMap[prodId]) {
          productAggMap[prodId] = {
            id: prodId,
            name,
            category,
            image,
            priceUSD: item.unitPriceUSD,
            costUSD: unitCost,
            unitsSold: 0,
            totalRevenueUSD: 0,
            totalRevenueBs: 0,
            totalProfitUSD: 0,
          };
        }

        productAggMap[prodId].unitsSold += item.quantity;
        productAggMap[prodId].totalRevenueUSD += subtotal;
        productAggMap[prodId].totalRevenueBs += subtotal * settings.bcvRate;
        productAggMap[prodId].totalProfitUSD += profit;
      });
    });

    const list = Object.values(productAggMap);

    // Sort by revenue or units
    if (topSortBy === 'revenue') {
      list.sort((a, b) => b.totalRevenueUSD - a.totalRevenueUSD);
    } else {
      list.sort((a, b) => b.unitsSold - a.unitsSold);
    }

    return list;
  }, [filteredOrders, products, settings.bcvRate, topSortBy]);

  // Top 6 for BarChart visualization
  const topProductsChartData = useMemo(() => {
    return topProductsData.slice(0, 6).map((item) => ({
      name: item.name.length > 18 ? item.name.substring(0, 16) + '...' : item.name,
      fullName: item.name,
      revenueUSD: parseFloat(item.totalRevenueUSD.toFixed(2)),
      revenueBs: parseFloat(item.totalRevenueBs.toFixed(2)),
      displayRevenue: currencyMode === 'USD' ? parseFloat(item.totalRevenueUSD.toFixed(2)) : parseFloat(item.totalRevenueBs.toFixed(2)),
      unitsSold: item.unitsSold,
      profitUSD: parseFloat(item.totalProfitUSD.toFixed(2)),
    }));
  }, [topProductsData, currencyMode]);

  // Sales by Channel (POS vs Online)
  const channelData = useMemo(() => {
    let posTotal = 0;
    let onlineTotal = 0;
    filteredOrders.forEach((o) => {
      if (o.channel === 'pos' || (!o.channel && o.orderNumber?.startsWith('POS-'))) {
        posTotal += o.totalUSD;
      } else {
        onlineTotal += o.totalUSD;
      }
    });

    const total = posTotal + onlineTotal;
    return [
      {
        name: 'Punto de Venta (POS)',
        value: parseFloat(posTotal.toFixed(2)),
        percent: total > 0 ? (posTotal / total) * 100 : 0,
        color: '#4f46e5',
      },
      {
        name: 'Tienda Online',
        value: parseFloat(onlineTotal.toFixed(2)),
        percent: total > 0 ? (onlineTotal / total) * 100 : 0,
        color: '#06b6d4',
      },
    ].filter((c) => c.value > 0);
  }, [filteredOrders]);

  // Payment Methods Breakdown
  const paymentMethodsData = useMemo(() => {
    const map: { [method: string]: number } = {};
    filteredOrders.forEach((o) => {
      const method = o.paymentMethod || 'efectivo_usd';
      map[method] = (map[method] || 0) + o.totalUSD;
    });

    const palette = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6'];
    return Object.entries(map).map(([method, amount], idx) => ({
      name: formatPaymentMethod(method),
      value: parseFloat(amount.toFixed(2)),
      color: palette[idx % palette.length],
    }));
  }, [filteredOrders]);

  // Top category distribution
  const categoryData = useMemo(() => {
    const map: { [cat: string]: number } = {};
    filteredOrders.forEach((o) => {
      o.items.forEach((it) => {
        const prod = products.find((p) => p.id === it.productId);
        const cat = prod?.category || 'General';
        map[cat] = (map[cat] || 0) + it.unitPriceUSD * it.quantity;
      });
    });

    const palette = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    return Object.entries(map)
      .map(([name, value], idx) => ({
        name,
        value: parseFloat(value.toFixed(2)),
        color: palette[idx % palette.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredOrders, products]);

  // Handle PDF Export of the Dashboard
  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    try {
      await exportElementToPDF(
        'erp-sales-dashboard-printable',
        `Dashboard_Ventas_ERP_${timeRange}_${new Date().toISOString().split('T')[0]}`,
        {
          format: 'a4',
          orientation: 'portrait',
          margin: 8,
          scale: 2.2,
        }
      );
    } catch (err) {
      console.error('Error al exportar dashboard PDF:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Handle CSV Export of Top Products & Sales Trend
  const handleExportCSV = () => {
    const rows = [
      ['DASHBOARD ANALÍTICO DE VENTAS Y RENDIMIENTO DE PRODUCTOS - ERP COMERCIAL'],
      ['Fecha de Emisión', new Date().toLocaleString('es-VE')],
      ['Rango Seleccionado', timeRange.toUpperCase()],
      ['Tasa Oficial BCV Aplicada', `${formatPlainNumber(settings.bcvRate, 2)} Bs/USD`],
      [],
      ['INDICADORES CLAVE DE DESEMPEÑO'],
      ['Ventas Brutas Totales (USD)', formatPlainNumber(metrics.totalSalesUSD, 2)],
      ['Ventas Brutas Totales (Bs)', formatPlainNumber(metrics.totalSalesBs, 2)],
      ['Transacciones / Pedidos', metrics.orderCount.toString()],
      ['Ticket Promedio (USD)', formatPlainNumber(metrics.averageTicketUSD, 2)],
      ['Unidades Vendidas', metrics.totalUnitsSold.toString()],
      ['Utilidad Bruta Estimada (USD)', formatPlainNumber(metrics.grossProfitUSD, 2)],
      ['Margen de Ganancia %', `${formatPlainNumber(metrics.marginPercent, 2)}%`],
      [],
      ['TOP PRODUCTOS MÁS VENDIDOS EN EL PERIODO'],
      ['Posición', 'Producto', 'Categoría', 'Unidades Vendidas', 'Ingresos USD', 'Ingresos Bs BCV', 'Margen Estimado USD'],
      ...topProductsData.map((item, idx) => [
        `#${idx + 1}`,
        item.name,
        item.category,
        item.unitsSold.toString(),
        formatPlainNumber(item.totalRevenueUSD, 2),
        formatPlainNumber(item.totalRevenueBs, 2),
        formatPlainNumber(item.totalProfitUSD, 2),
      ]),
      [],
      ['HISTÓRICO DIARIO DE VENTAS'],
      ['Fecha', 'Ventas USD', 'Ventas Bs BCV', 'Pedidos', 'Unidades'],
      ...dailySalesTrendData.map((entry) => [
        entry.dateStr,
        formatPlainNumber(entry.salesUSD, 2),
        formatPlainNumber(entry.salesBs, 2),
        entry.ordersCount.toString(),
        entry.unitsCount.toString(),
      ]),
    ];

    exportToCSV(`Dashboard_Ventas_${new Date().toISOString().split('T')[0]}`, rows);
  };

  const topPerformer = topProductsData[0] || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header and Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Dashboard de Ventas & Rendimiento
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Visualización en tiempo real de tendencias diarias y productos más vendidos
              </p>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'today' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setTimeRange('7days')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === '7days' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setTimeRange('14days')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === '14days' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              14 Días
            </button>
            <button
              onClick={() => setTimeRange('30days')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === '30days' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Días
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'all' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Histórico
            </button>
          </div>

          {/* Currency Toggle */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setCurrencyMode('USD')}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                currencyMode === 'USD' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Mostrar montos en Dólares ($)"
            >
              USD $
            </button>
            <button
              onClick={() => setCurrencyMode('BS')}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                currencyMode === 'BS' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`Mostrar montos en Bolívares (Tasa BCV: ${formatPlainNumber(settings.bcvRate, 2)} Bs/$)`}
            >
              Bs BCV
            </button>
          </div>

          {/* Export Actions */}
          <button
            onClick={() => setIsInventoryReportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl transition cursor-pointer shadow-2xs"
            title="Generar informe gerencial de inventario y stock crítico en PDF"
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-600" />
            <span>Inventario PDF</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl transition cursor-pointer shadow-2xs"
            title="Exportar gráficos y analítica a documento PDF"
          >
            {isExportingPDF ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>{isExportingPDF ? 'Generando...' : 'Exportar PDF'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-2xs"
            title="Descargar datos tabulares a Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Exportable Printable Wrapper */}
      <div id="erp-sales-dashboard-printable" className="space-y-6">
        
        {/* PDF Header Summary Banner (Visible in PDF printouts) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                {settings.companyName || 'ERP Sistema Comercial'}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                RIF: {settings.companyRif || 'J-50000000-0'} | Reporte Analítico de Ventas
              </p>
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100">
              Tasa BCV: {formatPlainNumber(settings.bcvRate, 2)} Bs/USD
            </span>
            <p className="text-[10px] text-slate-400 mt-1">
              Periodo: {timeRange.toUpperCase()} | Fecha: {new Date().toLocaleDateString('es-VE')}
            </p>
          </div>
        </div>

        {/* Executive KPI Stats Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Sales */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ventas Totales</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {currencyMode === 'USD' ? formatUSD(metrics.totalSalesUSD) : formatBs(metrics.totalSalesBs)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {currencyMode === 'USD' ? formatBs(metrics.totalSalesBs) : formatUSD(metrics.totalSalesUSD)}
            </p>
          </div>

          {/* Orders / Transactions Count */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transacciones</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">{metrics.orderCount}</p>
            <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 mt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              Facturas emitidas
            </p>
          </div>

          {/* Average Ticket */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ticket Promedio</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {currencyMode === 'USD' ? formatUSD(metrics.averageTicketUSD) : formatBs(metrics.averageTicketBs)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Por transacción</p>
          </div>

          {/* Units Sold */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unidades Vendidas</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">{metrics.totalUnitsSold}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Ítems despachados</p>
          </div>

          {/* Top Performer Hero Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Producto Estrella</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs font-bold text-slate-900 truncate" title={topPerformer?.name || 'N/A'}>
              {topPerformer?.name || 'Sin ventas'}
            </p>
            <p className="text-[10px] text-purple-600 font-semibold mt-0.5">
              {topPerformer ? `${topPerformer.unitsSold} unidades` : '-'}
            </p>
          </div>

          {/* Gross Margin */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-200 transition">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Margen Bruto</span>
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {formatPlainNumber(metrics.marginPercent, 1)}%
            </p>
            <p className="text-[10px] text-teal-700 font-semibold mt-0.5">
              {currencyMode === 'USD' ? formatUSD(metrics.grossProfitUSD) : formatBs(metrics.grossProfitBs)} utilidad
            </p>
          </div>
        </div>

        {/* Analytics Engine Selector Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 px-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Módulo Gráfico:</span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setActiveAnalyticsView('d3')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeAnalyticsView === 'd3'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Panel Analítico D3.js (Multimoneda)</span>
              </button>
              <button
                onClick={() => setActiveAnalyticsView('overview')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeAnalyticsView === 'overview'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Vista Clásica / Desglose por Canal</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            {activeAnalyticsView === 'd3'
              ? '📊 Gráficos interactivos D3.js con curvas duales USD/Bs, medias móviles y comparativa mensual'
              : '📈 Resumen de canales, medios de pago y categorías'}
          </div>
        </div>

        {/* Render D3.js Dedicated Analytics Panel */}
        {activeAnalyticsView === 'd3' && (
          <div className="animate-in fade-in duration-300">
            <D3SalesAnalyticsPanel />
          </div>
        )}

        {/* Primary Visualizations Section: Sales Trend & Top Products BarChart */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${activeAnalyticsView === 'd3' ? 'pt-2' : ''}`}>
          
          {/* Main Chart: Daily Sales Trend (AreaChart) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Tendencia Diaria de Ventas
                </h3>
                <p className="text-xs text-slate-500">
                  Evolución diaria de facturación ({currencyMode === 'USD' ? 'USD $' : 'Bs BCV'}) y volumen de pedidos
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg self-start sm:self-auto">
                Total: {currencyMode === 'USD' ? formatUSD(metrics.totalSalesUSD) : formatBs(metrics.totalSalesBs)}
              </span>
            </div>

            <div className="h-72 w-full">
              {dailySalesTrendData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <TrendingUp className="w-8 h-8 stroke-1 text-slate-300 mb-2" />
                  No hay transacciones registradas en este periodo
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySalesTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => (currencyMode === 'USD' ? `$${val}` : `${val}Bs`)}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
                              <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">
                                {data.dateStr}
                              </p>
                              <p className="text-emerald-400 font-extrabold text-sm">
                                {formatUSD(data.salesUSD)} / {formatBs(data.salesBs)}
                              </p>
                              <div className="flex justify-between gap-4 text-[11px] text-slate-300">
                                <span>Pedidos: <b>{data.ordersCount}</b></span>
                                <span>Unidades: <b>{data.unitsCount}</b></span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="displaySales"
                      name={currencyMode === 'USD' ? 'Ventas USD' : 'Ventas Bs'}
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#salesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top-Performing Products Chart (BarChart) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  Top Productos Destacados
                </h3>
                <p className="text-xs text-slate-500">Ranking por ingresos generados ({currencyMode === 'USD' ? 'USD' : 'Bs'})</p>
              </div>

              {/* Sort Toggle for Top Products */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold border border-slate-200">
                <button
                  onClick={() => setTopSortBy('revenue')}
                  className={`px-2 py-1 rounded-md transition ${
                    topSortBy === 'revenue' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  $ Ingreso
                </button>
                <button
                  onClick={() => setTopSortBy('units')}
                  className={`px-2 py-1 rounded-md transition ${
                    topSortBy === 'units' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Unidades
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              {topProductsChartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <Package className="w-8 h-8 stroke-1 text-slate-300 mb-2" />
                  No hay productos vendidos en este periodo
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topProductsChartData}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => (topSortBy === 'revenue' ? (currencyMode === 'USD' ? `$${val}` : `${val}Bs`) : `${val}u`)}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      width={100}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
                              <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">
                                {data.fullName}
                              </p>
                              <p className="text-purple-400 font-extrabold text-sm">
                                Ingresos: {formatUSD(data.revenueUSD)} / {formatBs(data.revenueBs)}
                              </p>
                              <p className="text-slate-300">
                                Unidades Vendidas: <b>{data.unitsSold} un.</b>
                              </p>
                              <p className="text-emerald-400 text-[11px]">
                                Ganancia Bruta: {formatUSD(data.profitUSD)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey={topSortBy === 'revenue' ? 'displayRevenue' : 'unitsSold'}
                      fill="#8b5cf6"
                      radius={[0, 6, 6, 0]}
                    >
                      {topProductsChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? '#7c3aed' : index === 1 ? '#8b5cf6' : index === 2 ? '#a78bfa' : '#c4b5fd'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Leaderboard Table of Top Performing Products */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Tabla Detallada de Rendimiento por Producto
              </h3>
              <p className="text-xs text-slate-500">
                Ranking de ventas, unidades comercializadas, márgenes de ganancia e impacto en facturación
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Mostrando <b>{topProductsData.length}</b> productos vendidos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-center">Unidades</th>
                  <th className="py-3 px-4 text-right">Precio Unit.</th>
                  <th className="py-3 px-4 text-right">Total Facturado</th>
                  <th className="py-3 px-4 text-right">Utilidad Est.</th>
                  <th className="py-3 px-4 text-right">% Facturación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProductsData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No se han registrado ventas de productos en este periodo.
                    </td>
                  </tr>
                ) : (
                  topProductsData.map((item, idx) => {
                    const revShare = metrics.totalSalesUSD > 0 ? (item.totalRevenueUSD / metrics.totalSalesUSD) * 100 : 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-black">
                          {idx === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs shadow-2xs font-extrabold">
                              🥇
                            </span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs shadow-2xs font-extrabold">
                              🥈
                            </span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/10 text-amber-900 text-xs shadow-2xs font-extrabold">
                              🥉
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold pl-1.5">#{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{item.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">ID: {item.id.substring(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[10px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900">
                          {item.unitsSold} <span className="text-[10px] font-normal text-slate-400">un.</span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-700">
                          {formatUSD(item.priceUSD)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <p className="font-black text-slate-900">
                            {currencyMode === 'USD' ? formatUSD(item.totalRevenueUSD) : formatBs(item.totalRevenueBs)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {currencyMode === 'USD' ? formatBs(item.totalRevenueBs) : formatUSD(item.totalRevenueUSD)}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-emerald-700">
                            +{formatUSD(item.totalProfitUSD)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-bold text-slate-700 text-[11px]">{formatPlainNumber(revShare, 1)}%</span>
                            <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, revShare)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Secondary Analytical Cards (Channel, Payment Methods & Categories) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Sales Channels Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Store className="w-4 h-4 text-indigo-600" />
              Canales de Venta
            </h3>
            <p className="text-xs text-slate-500 mb-4">POS Mostrador vs Tienda Online</p>

            <div className="h-44 w-full">
              {channelData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Sin registros
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={4}
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`${currencyMode === 'USD' ? formatUSD(val) : formatBs(val * settings.bcvRate)}`, 'Total']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-2 mt-2 pt-2 border-t border-slate-100 text-xs">
              {channelData.map((c) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-slate-600 font-medium">{c.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatPlainNumber(c.percent, 1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Métodos de Pago
            </h3>
            <p className="text-xs text-slate-500 mb-4">Distribución de cobros por modalidad</p>

            <div className="h-44 w-full">
              {paymentMethodsData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Sin registros
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodsData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {paymentMethodsData.map((entry, index) => (
                        <Cell key={`cell-pm-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`${currencyMode === 'USD' ? formatUSD(val) : formatBs(val * settings.bcvRate)}`, 'Monto']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-100 text-xs max-h-24 overflow-y-auto pr-1">
              {paymentMethodsData.map((pm) => (
                <div key={pm.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pm.color }} />
                    <span className="text-slate-600 truncate">{pm.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">{formatUSD(pm.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Performance */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-amber-500" />
              Categorías Principales
            </h3>
            <p className="text-xs text-slate-500 mb-4">Ventas por departamento</p>

            <div className="h-44 w-full">
              {categoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Sin registros
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(val: number) => [`${formatUSD(val)}`, 'Ventas']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-cat-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-100 text-xs">
              {categoryData.slice(0, 3).map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 truncate">{cat.name}</span>
                  <span className="font-bold text-slate-900">{formatUSD(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Modal: Executive Inventory PDF Report Generator */}
      <InventoryExecutiveReportModal
        isOpen={isInventoryReportOpen}
        onClose={() => setIsInventoryReportOpen(false)}
      />
    </div>
  );
};
