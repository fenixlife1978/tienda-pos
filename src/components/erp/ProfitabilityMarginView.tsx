import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, PurchaseEntry } from '../../types';
import {
  TrendingUp,
  Percent,
  DollarSign,
  Package,
  Layers,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Printer,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  PieChart as PieIcon,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  RefreshCw,
  Eye,
  Sliders,
  X,
  Truck,
  Building2,
  Calendar,
  Coins,
  FileSpreadsheet,
  Info,
  ChevronRight,
  Award,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
  PieChart,
  Pie,
} from 'recharts';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { exportToCSV } from '../../utils/exportUtils';

export type MarginCalculationMode = 'markup' | 'margin_on_sale';
export type SortOption =
  | 'margin_percent_desc'
  | 'margin_percent_asc'
  | 'unit_profit_desc'
  | 'total_profit_desc'
  | 'sales_profit_desc'
  | 'cost_increase_desc'
  | 'name_asc'
  | 'stock_desc';

export const ProfitabilityMarginView: React.FC = () => {
  const { products, purchaseEntries, invoices, orders, settings } = useApp();

  // Active Main Tab: 'by_product' | 'by_category' | 'cost_impact'
  const [activeTab, setActiveTab] = useState<'by_product' | 'by_category' | 'cost_impact'>('by_product');

  // Margin calculation mode: Markup over cost vs Margin on sale price
  const [calculationMode, setCalculationMode] = useState<MarginCalculationMode>('markup');

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [marginRangeFilter, setMarginRangeFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [costSourceFilter, setCostSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('total_profit_desc');

  // Interactive Simulator / Detail Modal
  const [selectedProductForSimulation, setSelectedProductForSimulation] = useState<Product | null>(null);
  const [simulatedMarginPercent, setSimulatedMarginPercent] = useState<number>(35);
  const [simulatedPriceUSD, setSimulatedPriceUSD] = useState<string>('');

  // Rate active
  const bcvRate = settings.bcvRate || 842.21;

  // Extract unique categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Map purchase entries by productId for fast lookup
  const productPurchaseHistoryMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalPurchases: number;
        lastEntryDate: string;
        lastSupplierName: string;
        lastInvoiceNumber: string;
        lastBaseCostUSD: number;
        lastAdditionalExpenseUSD: number;
        lastRealCostUSD: number;
        allEntries: {
          entryNumber: string;
          invoiceNumber: string;
          date: string;
          supplierName: string;
          quantity: number;
          baseCostUSD: number;
          addExpenseUSD: number;
          realCostUSD: number;
        }[];
      }
    >();

    // Sort purchaseEntries by date ascending so last is most recent
    const sortedEntries = [...purchaseEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedEntries.forEach((pe) => {
      pe.items.forEach((item) => {
        const existing = map.get(item.productId) || {
          totalPurchases: 0,
          lastEntryDate: pe.date,
          lastSupplierName: pe.supplierName,
          lastInvoiceNumber: pe.invoiceNumber,
          lastBaseCostUSD: item.currentBaseCostUSD,
          lastAdditionalExpenseUSD: item.additionalExpenseUSD || 0,
          lastRealCostUSD: item.realCostUSD,
          allEntries: [],
        };

        existing.totalPurchases += 1;
        existing.lastEntryDate = pe.date;
        existing.lastSupplierName = pe.supplierName;
        existing.lastInvoiceNumber = pe.invoiceNumber;
        existing.lastBaseCostUSD = item.currentBaseCostUSD;
        existing.lastAdditionalExpenseUSD = item.additionalExpenseUSD || 0;
        existing.lastRealCostUSD = item.realCostUSD;

        existing.allEntries.unshift({
          entryNumber: pe.entryNumber,
          invoiceNumber: pe.invoiceNumber,
          date: pe.date,
          supplierName: pe.supplierName,
          quantity: item.quantity,
          baseCostUSD: item.currentBaseCostUSD,
          addExpenseUSD: item.additionalExpenseUSD || 0,
          realCostUSD: item.realCostUSD,
        });

        map.set(item.productId, existing);
      });
    });

    return map;
  }, [purchaseEntries]);

  // Historical Sales & Realized Profit per product from completed orders & invoices
  const productSalesMap = useMemo(() => {
    const map = new Map<
      string,
      {
        unitsSold: number;
        totalRevenueUSD: number;
        totalCostOfGoodsSoldUSD: number;
        realizedGrossProfitUSD: number;
      }
    >();

    const completedOrders = orders.filter((o) => o.orderStatus !== 'cancelado');
    completedOrders.forEach((o) => {
      o.items.forEach((it) => {
        const existing = map.get(it.productId) || {
          unitsSold: 0,
          totalRevenueUSD: 0,
          totalCostOfGoodsSoldUSD: 0,
          realizedGrossProfitUSD: 0,
        };

        const prod = products.find((p) => p.id === it.productId);
        const unitCost = prod?.realCostUSD || prod?.costUSD || it.unitPriceUSD * 0.7;

        existing.unitsSold += it.quantity;
        existing.totalRevenueUSD += it.subtotalUSD;
        existing.totalCostOfGoodsSoldUSD += unitCost * it.quantity;
        existing.realizedGrossProfitUSD += Math.max(0, it.subtotalUSD - unitCost * it.quantity);

        map.set(it.productId, existing);
      });
    });

    return map;
  }, [orders, products]);

  // Master product analysis dataset
  const analyzedProducts = useMemo(() => {
    return products.map((prod) => {
      const purchaseInfo = productPurchaseHistoryMap.get(prod.id);
      const salesInfo = productSalesMap.get(prod.id) || {
        unitsSold: 0,
        totalRevenueUSD: 0,
        totalCostOfGoodsSoldUSD: 0,
        realizedGrossProfitUSD: 0,
      };

      // Effective cost from product or latest purchase
      const effectiveRealCostUSD = prod.realCostUSD && prod.realCostUSD > 0
        ? prod.realCostUSD
        : prod.costUSD || 0;

      const baseCostUSD = prod.costUSD || 0;
      const additionalExpenseUSD = Math.max(0, effectiveRealCostUSD - baseCostUSD);
      const previousCostUSD = prod.lastCostUSD || 0;

      // Cost variation calculation
      let costChangePercent = 0;
      let costChangeDirection: 'up' | 'down' | 'equal' = 'equal';
      if (previousCostUSD > 0 && effectiveRealCostUSD > 0) {
        costChangePercent = ((effectiveRealCostUSD - previousCostUSD) / previousCostUSD) * 100;
        if (costChangePercent > 0.5) costChangeDirection = 'up';
        else if (costChangePercent < -0.5) costChangeDirection = 'down';
      }

      // Selling price
      const priceUSD = prod.priceUSD || 0;
      const stock = prod.stock || 0;

      // Unit Gross Margin in USD
      const unitGrossProfitUSD = priceUSD - effectiveRealCostUSD;
      const unitGrossProfitBs = unitGrossProfitUSD * bcvRate;

      // Percentage Margins:
      // 1. Markup on Cost: ((Price - Cost) / Cost) * 100
      const markupPercent = effectiveRealCostUSD > 0
        ? ((priceUSD - effectiveRealCostUSD) / effectiveRealCostUSD) * 100
        : priceUSD > 0 ? 100 : 0;

      // 2. Margin on Sale Price: ((Price - Cost) / Price) * 100
      const marginOnSalePercent = priceUSD > 0
        ? ((priceUSD - effectiveRealCostUSD) / priceUSD) * 100
        : 0;

      const displayMarginPercent =
        calculationMode === 'markup' ? markupPercent : marginOnSalePercent;

      // Total Potential Profit in Stock
      const totalCostValueUSD = effectiveRealCostUSD * stock;
      const totalRetailValueUSD = priceUSD * stock;
      const totalPotentialProfitUSD = Math.max(0, unitGrossProfitUSD * stock);
      const totalPotentialProfitBs = totalPotentialProfitUSD * bcvRate;

      // Margin health status
      let marginStatus: 'high' | 'good' | 'moderate' | 'low' | 'negative' = 'good';
      if (displayMarginPercent >= 45) marginStatus = 'high';
      else if (displayMarginPercent >= 30) marginStatus = 'good';
      else if (displayMarginPercent >= 15) marginStatus = 'moderate';
      else if (displayMarginPercent >= 0) marginStatus = 'low';
      else marginStatus = 'negative';

      // Margin compression alert: if cost went up recently and margin is now tight
      const isMarginCompressed =
        costChangeDirection === 'up' && (displayMarginPercent < 25 || costChangePercent > 10);

      return {
        ...prod,
        effectiveRealCostUSD,
        baseCostUSD,
        additionalExpenseUSD,
        previousCostUSD,
        costChangePercent,
        costChangeDirection,
        unitGrossProfitUSD,
        unitGrossProfitBs,
        markupPercent,
        marginOnSalePercent,
        displayMarginPercent,
        totalCostValueUSD,
        totalRetailValueUSD,
        totalPotentialProfitUSD,
        totalPotentialProfitBs,
        marginStatus,
        isMarginCompressed,
        purchaseInfo,
        salesInfo,
      };
    });
  }, [products, productPurchaseHistoryMap, productSalesMap, bcvRate, calculationMode]);

  // Master Category level aggregation
  const analyzedCategories = useMemo(() => {
    const catMap = new Map<
      string,
      {
        category: string;
        skuCount: number;
        totalStockUnits: number;
        totalCostValueUSD: number;
        totalRetailValueUSD: number;
        totalPotentialProfitUSD: number;
        totalRealizedProfitUSD: number;
        products: typeof analyzedProducts;
      }
    >();

    analyzedProducts.forEach((p) => {
      const cat = p.category || 'Sin Categoría';
      const existing = catMap.get(cat) || {
        category: cat,
        skuCount: 0,
        totalStockUnits: 0,
        totalCostValueUSD: 0,
        totalRetailValueUSD: 0,
        totalPotentialProfitUSD: 0,
        totalRealizedProfitUSD: 0,
        products: [],
      };

      existing.skuCount += 1;
      existing.totalStockUnits += p.stock || 0;
      existing.totalCostValueUSD += p.totalCostValueUSD;
      existing.totalRetailValueUSD += p.totalRetailValueUSD;
      existing.totalPotentialProfitUSD += p.totalPotentialProfitUSD;
      existing.totalRealizedProfitUSD += p.salesInfo.realizedGrossProfitUSD;
      existing.products.push(p);

      catMap.set(cat, existing);
    });

    return Array.from(catMap.values()).map((cat) => {
      // Weighted Margin Percent on Cost
      const weightedMarkupPercent = cat.totalCostValueUSD > 0
        ? ((cat.totalRetailValueUSD - cat.totalCostValueUSD) / cat.totalCostValueUSD) * 100
        : 0;

      // Weighted Margin on Sale
      const weightedMarginOnSalePercent = cat.totalRetailValueUSD > 0
        ? ((cat.totalRetailValueUSD - cat.totalCostValueUSD) / cat.totalRetailValueUSD) * 100
        : 0;

      const displayWeightedMargin =
        calculationMode === 'markup' ? weightedMarkupPercent : weightedMarginOnSalePercent;

      // Find top profitable product in this category
      const topProduct = [...cat.products].sort(
        (a, b) => b.totalPotentialProfitUSD - a.totalPotentialProfitUSD
      )[0];

      // Find high margin and low margin counts
      const highMarginCount = cat.products.filter((p) => p.displayMarginPercent >= 40).length;
      const lowMarginCount = cat.products.filter((p) => p.displayMarginPercent < 18).length;
      const costIncreaseCount = cat.products.filter((p) => p.costChangeDirection === 'up').length;

      return {
        ...cat,
        weightedMarkupPercent,
        weightedMarginOnSalePercent,
        displayWeightedMargin,
        topProduct,
        highMarginCount,
        lowMarginCount,
        costIncreaseCount,
      };
    });
  }, [analyzedProducts, calculationMode]);

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    return analyzedProducts
      .filter((p) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q);
          if (!match) return false;
        }

        // Category filter
        if (selectedCategory !== 'all' && p.category !== selectedCategory) {
          return false;
        }

        // Margin Range filter
        if (marginRangeFilter === 'high' && p.displayMarginPercent < 45) return false;
        if (marginRangeFilter === 'good' && (p.displayMarginPercent < 30 || p.displayMarginPercent >= 45)) return false;
        if (marginRangeFilter === 'moderate' && (p.displayMarginPercent < 15 || p.displayMarginPercent >= 30)) return false;
        if (marginRangeFilter === 'low' && (p.displayMarginPercent < 0 || p.displayMarginPercent >= 15)) return false;
        if (marginRangeFilter === 'negative' && p.displayMarginPercent >= 0) return false;
        if (marginRangeFilter === 'compressed' && !p.isMarginCompressed) return false;

        // Stock filter
        if (stockFilter === 'in_stock' && (p.stock || 0) <= 0) return false;
        if (stockFilter === 'out_of_stock' && (p.stock || 0) > 0) return false;

        // Cost Source filter
        if (costSourceFilter === 'has_purchases' && (!p.purchaseInfo || p.purchaseInfo.totalPurchases === 0)) return false;
        if (costSourceFilter === 'cost_increased' && p.costChangeDirection !== 'up') return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'margin_percent_desc') return b.displayMarginPercent - a.displayMarginPercent;
        if (sortBy === 'margin_percent_asc') return a.displayMarginPercent - b.displayMarginPercent;
        if (sortBy === 'unit_profit_desc') return b.unitGrossProfitUSD - a.unitGrossProfitUSD;
        if (sortBy === 'total_profit_desc') return b.totalPotentialProfitUSD - a.totalPotentialProfitUSD;
        if (sortBy === 'sales_profit_desc') return b.salesInfo.realizedGrossProfitUSD - a.salesInfo.realizedGrossProfitUSD;
        if (sortBy === 'cost_increase_desc') return b.costChangePercent - a.costChangePercent;
        if (sortBy === 'stock_desc') return (b.stock || 0) - (a.stock || 0);
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [
    analyzedProducts,
    searchQuery,
    selectedCategory,
    marginRangeFilter,
    stockFilter,
    costSourceFilter,
    sortBy,
  ]);

  // Overall Global Statistics
  const globalStats = useMemo(() => {
    const totalCostValueUSD = analyzedProducts.reduce((sum, p) => sum + p.totalCostValueUSD, 0);
    const totalRetailValueUSD = analyzedProducts.reduce((sum, p) => sum + p.totalRetailValueUSD, 0);
    const totalPotentialProfitUSD = Math.max(0, totalRetailValueUSD - totalCostValueUSD);
    const totalPotentialProfitBs = totalPotentialProfitUSD * bcvRate;

    const weightedMarkupPercent = totalCostValueUSD > 0
      ? (totalPotentialProfitUSD / totalCostValueUSD) * 100
      : 0;

    const weightedMarginOnSalePercent = totalRetailValueUSD > 0
      ? (totalPotentialProfitUSD / totalRetailValueUSD) * 100
      : 0;

    const topMostProfitableProduct = [...analyzedProducts].sort(
      (a, b) => b.totalPotentialProfitUSD - a.totalPotentialProfitUSD
    )[0];

    const highMarginProductsCount = analyzedProducts.filter(
      (p) => p.displayMarginPercent >= 40
    ).length;

    const lowMarginProductsCount = analyzedProducts.filter(
      (p) => p.displayMarginPercent < 18
    ).length;

    const costIncreasedProductsCount = analyzedProducts.filter(
      (p) => p.costChangeDirection === 'up'
    ).length;

    return {
      totalCostValueUSD,
      totalRetailValueUSD,
      totalPotentialProfitUSD,
      totalPotentialProfitBs,
      weightedMarkupPercent,
      weightedMarginOnSalePercent,
      topMostProfitableProduct,
      highMarginProductsCount,
      lowMarginProductsCount,
      costIncreasedProductsCount,
    };
  }, [analyzedProducts, bcvRate]);

  // Chart Data: Top 8 Categories by Potential Gross Profit
  const categoryChartData = useMemo(() => {
    return [...analyzedCategories]
      .sort((a, b) => b.totalPotentialProfitUSD - a.totalPotentialProfitUSD)
      .slice(0, 8)
      .map((cat) => ({
        name: cat.category.length > 14 ? cat.category.substring(0, 12) + '...' : cat.category,
        fullName: cat.category,
        utilidadUSD: parseFloat(cat.totalPotentialProfitUSD.toFixed(2)),
        margenPct: parseFloat(cat.displayWeightedMargin.toFixed(1)),
        costoUSD: parseFloat(cat.totalCostValueUSD.toFixed(2)),
      }));
  }, [analyzedCategories]);

  // Chart Data: Top 7 Most Profitable Products
  const topProductsChartData = useMemo(() => {
    return [...analyzedProducts]
      .sort((a, b) => b.totalPotentialProfitUSD - a.totalPotentialProfitUSD)
      .slice(0, 7)
      .map((p) => ({
        name: p.name.length > 16 ? p.name.substring(0, 14) + '...' : p.name,
        fullName: p.name,
        utilidadUSD: parseFloat(p.totalPotentialProfitUSD.toFixed(2)),
        margenPct: parseFloat(p.displayMarginPercent.toFixed(1)),
      }));
  }, [analyzedProducts]);

  // Chart Colors
  const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6'];

  // Handle open simulation modal
  const handleOpenSimulation = (prod: Product) => {
    setSelectedProductForSimulation(prod);
    const effectiveCost = prod.realCostUSD || prod.costUSD || 1;
    const currentMargin =
      effectiveCost > 0 ? ((prod.priceUSD - effectiveCost) / effectiveCost) * 100 : 35;
    setSimulatedMarginPercent(Math.max(5, Math.min(200, Math.round(currentMargin))));
    setSimulatedPriceUSD(prod.priceUSD ? prod.priceUSD.toFixed(2) : '0.00');
  };

  // Recalculate price when slider changes
  const handleSliderMarginChange = (margin: number) => {
    setSimulatedMarginPercent(margin);
    if (selectedProductForSimulation) {
      const cost = selectedProductForSimulation.realCostUSD || selectedProductForSimulation.costUSD || 0;
      const newPrice = cost * (1 + margin / 100);
      setSimulatedPriceUSD(newPrice.toFixed(2));
    }
  };

  // Recalculate margin when price input changes
  const handlePriceInputChange = (val: string) => {
    setSimulatedPriceUSD(val);
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num) && selectedProductForSimulation) {
      const cost = selectedProductForSimulation.realCostUSD || selectedProductForSimulation.costUSD || 0;
      if (cost > 0) {
        const calculatedMargin = ((num - cost) / cost) * 100;
        setSimulatedMarginPercent(Math.max(0, Math.min(300, Math.round(calculatedMargin))));
      }
    }
  };

  // Export full profitability report to CSV
  const handleExportCSV = () => {
    const rows = [
      ['REPORTE EJECUTIVO DE MARGEN DE UTILIDAD BRUTA & RENTABILIDAD'],
      ['Fecha de Emisión', new Date().toLocaleString('es-VE')],
      ['Tasa Oficial BCV', `${formatPlainNumber(bcvRate, 2)} Bs/USD`],
      ['Modo de Cálculo', calculationMode === 'markup' ? 'Markup sobre Costo Real' : 'Margen sobre Precio de Venta'],
      [],
      [
        'Código SKU',
        'Nombre del Producto',
        'Categoría',
        'Stock Actual',
        'Costo Base Compra ($)',
        'Gastos Adic. Flete ($)',
        'Costo Real Unitario ($)',
        'Costo Real Unitario (Bs)',
        'Precio Venta ($)',
        'Precio Venta (Bs)',
        'Ganancia Unitaria ($)',
        'Margen Utilidad (%)',
        'Valor Total Costo ($)',
        'Valor Total Venta ($)',
        'Utilidad Potencial Total ($)',
        'Utilidad Potencial Total (Bs)',
        'Compras Registradas',
        'Último Proveedor',
        'Última Factura Compra',
        'Unidades Vendidas',
        'Utilidad Realizada ($)',
      ],
      ...filteredProducts.map((p) => [
        p.code,
        p.name,
        p.category,
        p.stock || 0,
        formatPlainNumber(p.baseCostUSD, 4),
        formatPlainNumber(p.additionalExpenseUSD, 4),
        formatPlainNumber(p.effectiveRealCostUSD, 4),
        formatPlainNumber(p.effectiveRealCostUSD * bcvRate, 2),
        formatPlainNumber(p.priceUSD, 2),
        formatPlainNumber(p.priceUSD * bcvRate, 2),
        formatPlainNumber(p.unitGrossProfitUSD, 2),
        `${formatPlainNumber(p.displayMarginPercent, 1)}%`,
        formatPlainNumber(p.totalCostValueUSD, 2),
        formatPlainNumber(p.totalRetailValueUSD, 2),
        formatPlainNumber(p.totalPotentialProfitUSD, 2),
        formatPlainNumber(p.totalPotentialProfitBs, 2),
        p.purchaseInfo?.totalPurchases || 0,
        p.purchaseInfo?.lastSupplierName || 'N/A',
        p.purchaseInfo?.lastInvoiceNumber || 'N/A',
        p.salesInfo.unitsSold,
        formatPlainNumber(p.salesInfo.realizedGrossProfitUSD, 2),
      ]),
    ];

    exportToCSV(`reporte_margen_rentabilidad_${new Date().toISOString().split('T')[0]}`, rows);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ==================== TOP BANNER / HEADER ==================== */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-100">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                Auditoría de Costos & Rentabilidad
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">
                Alimentado con Costos Reales de Entradas por Compras
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Margen de Utilidad Bruto & Artículos Más Rentables
            </h1>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Formula Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setCalculationMode('markup')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                calculationMode === 'markup'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Margen = (Precio - Costo) / Costo × 100 (Markup comercial)"
            >
              Markup sobre Costo
            </button>
            <button
              onClick={() => setCalculationMode('margin_on_sale')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                calculationMode === 'margin_on_sale'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Margen = (Precio - Costo) / Precio × 100 (Margen sobre venta)"
            >
              Margen sobre Venta
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar Excel (CSV)
          </button>
        </div>
      </div>

      {/* ==================== 4 EXECUTIVE KPI CARDS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Margen Bruto Promedio Ponderado */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600" />
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Margen Ponderado Catálogo
            </span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatPlainNumber(
              calculationMode === 'markup'
                ? globalStats.weightedMarkupPercent
                : globalStats.weightedMarginOnSalePercent,
              1
            )}
            %
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {calculationMode === 'markup' ? 'Markup Global Sólido' : 'Margen Comercial'}
            </span>
            <span className="text-[11px] text-slate-400">
              {products.length} productos analizados
            </span>
          </div>
        </div>

        {/* Card 2: Utilidad Bruta Potencial en Stock */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden bg-gradient-to-b from-white to-emerald-50/20">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Utilidad Potencial en Stock
            </span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-700 tracking-tight">
            {formatUSD(globalStats.totalPotentialProfitUSD)}
          </p>
          <p className="text-xs font-bold text-emerald-800 mt-1">
            {formatBs(globalStats.totalPotentialProfitBs)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Ganancia al liquidar existencias actuales
          </p>
        </div>

        {/* Card 3: Valorización de Inventario (Costo vs Venta) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900" />
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Valorización de Inventario
            </span>
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Inversión Costo:</span>
              <span className="text-sm font-bold text-slate-900">
                {formatUSD(globalStats.totalCostValueUSD)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Retorno PVP:</span>
              <span className="text-sm font-bold text-indigo-600">
                {formatUSD(globalStats.totalRetailValueUSD)}
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  (globalStats.totalPotentialProfitUSD / (globalStats.totalRetailValueUSD || 1)) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Card 4: Artículos Estrella vs Alertas */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Salud del Portafolio
            </span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2 mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Margen Alto (&gt;40%):
              </span>
              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                {globalStats.highMarginProductsCount} SKUs
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                Margen Bajo (&lt;18%):
              </span>
              <span className="font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                {globalStats.lowMarginProductsCount} SKUs
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-amber-600" />
                Alza Costo Compra:
              </span>
              <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                {globalStats.costIncreasedProductsCount} SKUs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== VIEW TABS SWITCHER ==================== */}
      <div className="flex items-center border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('by_product')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'by_product'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            Rentabilidad por Producto ({filteredProducts.length})
          </button>

          <button
            onClick={() => setActiveTab('by_category')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'by_category'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Margen por Categoría ({analyzedCategories.length})
          </button>

          <button
            onClick={() => setActiveTab('cost_impact')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'cost_impact'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            Auditoría de Costos de Compras ({purchaseEntries.length} Entradas)
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: RENTABILIDAD POR PRODUCTO ==================== */}
      {activeTab === 'by_product' && (
        <div className="space-y-6">
          {/* Top Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Top 7 Most Profitable Products */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Top Artículos con Mayor Utilidad Potencial ($)
                  </h3>
                </div>
                <span className="text-xs text-slate-400">Ganancia en Stock</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" angle={-25} textAnchor="end" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(val: number) => [`$${val.toFixed(2)} USD`, 'Utilidad Potencial']}
                      labelFormatter={(label, items) => {
                        const item = items?.[0]?.payload;
                        return item?.fullName || label;
                      }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="utilidadUSD" radius={[6, 6, 0, 0]}>
                      {topProductsChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Top Categories Contribution */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Utilidad Bruta por Categoría de Producto ($)
                  </h3>
                </div>
                <span className="text-xs text-slate-400">Aporte Global</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" angle={-25} textAnchor="end" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(val: number) => [`$${val.toFixed(2)} USD`, 'Utilidad Total']}
                      labelFormatter={(label, items) => {
                        const item = items?.[0]?.payload;
                        return item?.fullName || label;
                      }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="utilidadUSD" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Filtering Bar */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar producto, código, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Todas las Categorías ({categoriesList.length})</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Margin Range Filter */}
              <div>
                <select
                  value={marginRangeFilter}
                  onChange={(e) => setMarginRangeFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Todos los Rangos de Margen</option>
                  <option value="high">Margen Alto (&gt;= 45%)</option>
                  <option value="good">Margen Bueno (30% - 44%)</option>
                  <option value="moderate">Margen Moderado (15% - 29%)</option>
                  <option value="low">Margen Bajo (0% - 14%)</option>
                  <option value="negative">Margen Negativo / Pérdida (&lt; 0%)</option>
                  <option value="compressed">Alerta Compresión de Margen</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="total_profit_desc">Mayor Utilidad Total en Stock ($)</option>
                  <option value="margin_percent_desc">Mayor % Margen de Utilidad</option>
                  <option value="margin_percent_asc">Menor % Margen (Identificar Riesgo)</option>
                  <option value="unit_profit_desc">Mayor Ganancia Unitaria ($)</option>
                  <option value="sales_profit_desc">Mayor Ganancia Realizada (Ventas)</option>
                  <option value="cost_increase_desc">Mayor Aumento Reciente de Costo</option>
                  <option value="stock_desc">Mayor Stock Disponible</option>
                  <option value="name_asc">Nombre del Producto (A - Z)</option>
                </select>
              </div>
            </div>

            {/* Sub-Filters / Quick Chips */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Filtro Rápido:</span>
                <button
                  onClick={() => setCostSourceFilter(costSourceFilter === 'has_purchases' ? 'all' : 'has_purchases')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    costSourceFilter === 'has_purchases'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Con Compras Registradas ({analyzedProducts.filter((p) => p.purchaseInfo?.totalPurchases).length})
                </button>
                <button
                  onClick={() => setMarginRangeFilter(marginRangeFilter === 'high' ? 'all' : 'high')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    marginRangeFilter === 'high'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Artículos Más Rentables (&gt;45%)
                </button>
                <button
                  onClick={() => setMarginRangeFilter(marginRangeFilter === 'compressed' ? 'all' : 'compressed')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    marginRangeFilter === 'compressed'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Riesgo por Aumento de Costo ({analyzedProducts.filter((p) => p.isMarginCompressed).length})
                </button>
              </div>

              <div className="text-slate-500 font-medium">
                Mostrando <strong className="text-slate-900">{filteredProducts.length}</strong> de{' '}
                {products.length} productos
              </div>
            </div>
          </div>

          {/* Master Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 min-w-[220px]">Producto & Categoría</th>
                    <th className="py-3.5 px-3 text-center min-w-[70px]">Stock</th>
                    <th className="py-3.5 px-3 text-right min-w-[120px]">Costo Real Compra</th>
                    <th className="py-3.5 px-3 text-right min-w-[110px]">Precio Venta</th>
                    <th className="py-3.5 px-3 text-right min-w-[110px]">Ganancia Unit.</th>
                    <th className="py-3.5 px-3 text-center min-w-[130px]">
                      {calculationMode === 'markup' ? 'Margen (Markup)' : 'Margen Comercial'}
                    </th>
                    <th className="py-3.5 px-3 text-right min-w-[130px]">Utilidad en Stock</th>
                    <th className="py-3.5 px-3 text-center min-w-[110px]">Última Compra</th>
                    <th className="py-3.5 px-3 text-center w-12">Simulador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No se encontraron productos con los filtros seleccionados</p>
                        <p className="text-[11px] mt-1">Prueba cambiando los criterios de búsqueda o categoría.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((prod, idx) => {
                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors group">
                          {/* Producto & Código */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {prod.image ? (
                                  <img
                                    src={prod.image}
                                    alt={prod.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Package className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-sm leading-snug group-hover:text-indigo-600 transition-colors">
                                  {prod.name}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                  <span className="font-mono text-slate-500">{prod.code}</span>
                                  <span>•</span>
                                  <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-medium">
                                    {prod.category}
                                  </span>
                                  {prod.isMarginCompressed && (
                                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded text-[10px] font-bold flex items-center gap-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Alza Costo
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Stock Actual */}
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`inline-block font-extrabold px-2 py-0.5 rounded-lg text-xs ${
                                (prod.stock || 0) > 10
                                  ? 'bg-slate-100 text-slate-800'
                                  : (prod.stock || 0) > 0
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {prod.stock || 0}
                            </span>
                          </td>

                          {/* Costo Real de Compra */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="font-bold text-slate-900 text-sm">
                              {formatUSD(prod.effectiveRealCostUSD)}
                            </div>
                            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                              <span>≈ {formatBs(prod.effectiveRealCostUSD * bcvRate)}</span>
                              {prod.additionalExpenseUSD > 0 && (
                                <span className="text-amber-600 font-semibold" title={`Gastos adic.: +$${prod.additionalExpenseUSD.toFixed(2)}`}>
                                  (+${prod.additionalExpenseUSD.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Precio de Venta Actual */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="font-bold text-indigo-700 text-sm">
                              {formatUSD(prod.priceUSD)}
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {formatBs(prod.priceUSD * bcvRate)}
                            </p>
                          </td>

                          {/* Ganancia Unitaria Bruta */}
                          <td className="py-3.5 px-3 text-right">
                            <div
                              className={`font-extrabold text-sm ${
                                prod.unitGrossProfitUSD >= 0 ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {formatUSD(prod.unitGrossProfitUSD)}
                            </div>
                            <p className="text-[10px] font-semibold text-emerald-600">
                              {formatBs(prod.unitGrossProfitBs)}
                            </p>
                          </td>

                          {/* Margen de Utilidad % Badge */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-black tracking-tight ${
                                  prod.displayMarginPercent >= 45
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/60'
                                    : prod.displayMarginPercent >= 30
                                    ? 'bg-teal-100 text-teal-800 border border-teal-300/60'
                                    : prod.displayMarginPercent >= 15
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300/60'
                                    : prod.displayMarginPercent >= 0
                                    ? 'bg-orange-100 text-orange-800 border border-orange-300/60'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300/60'
                                }`}
                              >
                                {formatPlainNumber(prod.displayMarginPercent, 1)}%
                              </span>
                              <span className="text-[9px] text-slate-400 mt-0.5">
                                {prod.marginStatus === 'high'
                                  ? 'Muy Rentable'
                                  : prod.marginStatus === 'good'
                                  ? 'Buen Margen'
                                  : prod.marginStatus === 'moderate'
                                  ? 'Aceptable'
                                  : prod.marginStatus === 'low'
                                  ? 'Margen Ajustado'
                                  : 'Pérdida'}
                              </span>
                            </div>
                          </td>

                          {/* Utilidad Total en Stock */}
                          <td className="py-3.5 px-3 text-right">
                            <p className="font-extrabold text-slate-900 text-sm">
                              {formatUSD(prod.totalPotentialProfitUSD)}
                            </p>
                            <p className="text-[10px] font-bold text-emerald-700">
                              {formatBs(prod.totalPotentialProfitBs)}
                            </p>
                          </td>

                          {/* Historial de Compra */}
                          <td className="py-3.5 px-3 text-center">
                            {prod.purchaseInfo ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {prod.purchaseInfo.lastEntryDate}
                                </span>
                                <p className="text-[10px] text-slate-400 truncate max-w-[120px] mx-auto mt-0.5" title={prod.purchaseInfo.lastSupplierName}>
                                  {prod.purchaseInfo.lastSupplierName}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Sin compras registradas
                              </span>
                            )}
                          </td>

                          {/* Acción / Simulador */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              onClick={() => handleOpenSimulation(prod)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Abrir Simulador de Precios y Margen"
                            >
                              <Calculator className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: MARGEN POR CATEGORÍA ==================== */}
      {activeTab === 'by_category' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {analyzedCategories.map((cat) => (
              <div
                key={cat.category}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                        Categoría
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                        {cat.category}
                      </h3>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black rounded-full">
                      {formatPlainNumber(cat.displayWeightedMargin, 1)}% Margen
                    </span>
                  </div>

                  {/* Category Core Numbers */}
                  <div className="grid grid-cols-2 gap-3 py-4 border-b border-slate-100">
                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-bold">
                        Utilidad en Stock
                      </p>
                      <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                        {formatUSD(cat.totalPotentialProfitUSD)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatBs(cat.totalPotentialProfitUSD * bcvRate)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] text-slate-400 uppercase font-bold">
                        Inversión en Costo
                      </p>
                      <p className="text-base font-bold text-slate-800 mt-0.5">
                        {formatUSD(cat.totalCostValueUSD)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        PVP: {formatUSD(cat.totalRetailValueUSD)}
                      </p>
                    </div>
                  </div>

                  {/* Category Breakdown stats */}
                  <div className="py-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Total de SKUs en Catálogo:</span>
                      <span className="font-bold text-slate-900">{cat.skuCount} artículos</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Unidades Totales en Inventario:</span>
                      <span className="font-bold text-slate-900">{cat.totalStockUnits} uds</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Artículos de Alta Ganancia (&gt;40%):</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded">
                        {cat.highMarginCount} SKUs
                      </span>
                    </div>

                    {cat.topProduct && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5 text-amber-600 font-bold text-[11px] mb-1">
                          <Award className="w-3.5 h-3.5" />
                          <span>Artículo Más Rentable de la Categoría:</span>
                        </div>
                        <p className="font-bold text-slate-900 truncate">
                          {cat.topProduct.name}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                          <span>Ganancia unit.: {formatUSD(cat.topProduct.unitGrossProfitUSD)}</span>
                          <span className="font-extrabold text-emerald-700">
                            {formatPlainNumber(cat.topProduct.displayMarginPercent, 1)}% Margen
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setSelectedCategory(cat.category);
                      setActiveTab('by_product');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                  >
                    <span>Ver todos los {cat.skuCount} productos de {cat.category}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: AUDITORÍA DE COSTOS DE COMPRAS ==================== */}
      {activeTab === 'cost_impact' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Historial de Recepción de Costos desde Módulo de Compras
                </h3>
                <p className="text-xs text-slate-500">
                  Monitoreo de variaciones de costo base, fletes imputados y su repercusión directa en los márgenes de ganancia
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                  {purchaseEntries.length} Facturas de Compra Auditadas
                </span>
              </div>
            </div>

            {purchaseEntries.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h4 className="text-sm font-bold text-slate-700">Aún no hay entradas por compras registradas</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Registra compras en la pestaña "Entradas por Compras" para que los costos reales de los proveedores alimenten esta auditoría automáticamente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3 min-w-[120px]">N° Entrada / Factura</th>
                      <th className="py-3 px-3 min-w-[100px]">Fecha</th>
                      <th className="py-3 px-3 min-w-[180px]">Proveedor</th>
                      <th className="py-3 px-3 text-center min-w-[80px]">Renglones</th>
                      <th className="py-3 px-3 text-right min-w-[120px]">Total Factura ($)</th>
                      <th className="py-3 px-3 text-center min-w-[100px]">Condición</th>
                      <th className="py-3 px-3 min-w-[250px]">Productos Ingresados & Costo Real</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {purchaseEntries.map((pe) => (
                      <tr key={pe.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{pe.entryNumber}</p>
                          <p className="text-[11px] font-mono text-slate-500">FC: {pe.invoiceNumber}</p>
                        </td>

                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {pe.date}
                        </td>

                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{pe.supplierName}</p>
                          <p className="text-[10px] text-slate-400">{pe.supplierRif || 'N/A'}</p>
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-slate-800">
                          {pe.items.length} items
                        </td>

                        <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                          <div>{formatUSD(pe.totalInvoiceUSD)}</div>
                          <p className="text-[10px] text-slate-400">{formatBs(pe.totalInvoiceBs)}</p>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              pe.paymentCondition === 'contado'
                                ? 'bg-emerald-100 text-emerald-800'
                                : pe.paymentCondition === 'credito'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {pe.paymentCondition}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {pe.items.map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2 py-1 rounded"
                              >
                                <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                                  {it.productName} ({it.quantity} un)
                                </span>
                                <span className="font-bold text-indigo-700">
                                  {formatUSD(it.realCostUSD)}/u
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== INTERACTIVE SIMULATION / DETAIL MODAL ==================== */}
      {selectedProductForSimulation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Calculator className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Simulador de Precios y Margen de Utilidad
                  </h3>
                  <p className="text-xs text-slate-300">
                    {selectedProductForSimulation.name} ({selectedProductForSimulation.code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductForSimulation(null)}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Cost Breakdown from Module */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Estructura de Costo Actual
                </span>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Costo Base Compra</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {formatUSD(selectedProductForSimulation.costUSD || 0)}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Gastos / Flete</p>
                    <p className="text-sm font-bold text-amber-700 mt-0.5">
                      +
                      {formatUSD(
                        Math.max(
                          0,
                          (selectedProductForSimulation.realCostUSD || selectedProductForSimulation.costUSD || 0) -
                            (selectedProductForSimulation.costUSD || 0)
                        )
                      )}
                    </p>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                    <p className="text-[10px] text-indigo-700 uppercase font-bold">Costo Real Unitario</p>
                    <p className="text-base font-extrabold text-indigo-700 mt-0.5">
                      {formatUSD(
                        selectedProductForSimulation.realCostUSD || selectedProductForSimulation.costUSD || 0
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Simulation Controls */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Margen de Utilidad Objetivo (%)
                  </label>
                  <span className="text-base font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                    {simulatedMarginPercent}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="150"
                  step="1"
                  value={simulatedMarginPercent}
                  onChange={(e) => handleSliderMarginChange(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                />

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Precio de Venta Simulado ($ USD):
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="text"
                        value={simulatedPriceUSD}
                        onChange={(e) => handlePriceInputChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Equivalente en Bolívares (Bs.):
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        value={formatBs((parseFloat(simulatedPriceUSD) || 0) * bcvRate)}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Result Comparison Box */}
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900 uppercase">
                  <span>Resultado Proyectado de Ganancia</span>
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-emerald-700 font-medium">Ganancia Unitaria:</p>
                    <p className="text-lg font-black text-emerald-800">
                      {formatUSD(
                        Math.max(
                          0,
                          (parseFloat(simulatedPriceUSD) || 0) -
                            (selectedProductForSimulation.realCostUSD || selectedProductForSimulation.costUSD || 0)
                        )
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-emerald-700 font-medium">Ganancia en Bs/ud:</p>
                    <p className="text-sm font-bold text-emerald-800">
                      {formatBs(
                        Math.max(
                          0,
                          (parseFloat(simulatedPriceUSD) || 0) -
                            (selectedProductForSimulation.realCostUSD || selectedProductForSimulation.costUSD || 0)
                        ) * bcvRate
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-emerald-700 font-medium">
                      Ganancia Stock Total ({selectedProductForSimulation.stock || 0} uds):
                    </p>
                    <p className="text-base font-extrabold text-emerald-900">
                      {formatUSD(
                        Math.max(
                          0,
                          (parseFloat(simulatedPriceUSD) || 0) -
                            (selectedProductForSimulation.realCostUSD || selectedProductForSimulation.costUSD || 0)
                        ) * (selectedProductForSimulation.stock || 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedProductForSimulation(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Cerrar Simulador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
