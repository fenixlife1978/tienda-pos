import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Product,
  PurchaseEntry,
  PurchaseEntryItem,
  PurchasePaymentCondition,
  Supplier,
} from '../../types';
import { ProductModal } from './ProductModal';
import {
  Truck,
  Plus,
  Search,
  Trash2,
  Calendar,
  Building2,
  Receipt,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Package,
  AlertCircle,
  Eye,
  Printer,
  History,
  X,
  Sparkles,
  HelpCircle,
  Info,
  RefreshCw,
  Calculator,
  ExternalLink,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

interface DraftPurchaseItem {
  id: string; // unique row id
  productId: string;
  productName: string;
  productCode: string;
  category: string;
  quantityStr: string;
  previousCostUSD: number;
  currentBaseCostStr: string; // USD
  additionalExpenseStr: string; // USD
  expenseConcept: string;
}

export const PurchasesEntryView: React.FC = () => {
  const {
    products,
    suppliers,
    settings,
    purchaseEntries,
    processPurchaseEntry,
    addSupplier,
    addProduct,
    currentUser,
  } = useApp();

  // Active view tab: 'new_entry' | 'history'
  const [activeTab, setActiveTab] = useState<'new_entry' | 'history'>('new_entry');

  // ==================== FORM STATE ====================
  const todayStr = new Date().toISOString().split('T')[0];
  const [entryDate, setEntryDate] = useState<string>(todayStr);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [bcvRateStr, setBcvRateStr] = useState<string>(
    settings.bcvRate ? settings.bcvRate.toString() : '842.21'
  );
  const [paymentCondition, setPaymentCondition] = useState<PurchasePaymentCondition>('contado');
  const [creditDaysStr, setCreditDaysStr] = useState<string>('15');
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  // Mixto payment inputs (free text editable)
  const [paidUSDStr, setPaidUSDStr] = useState<string>('');
  const [paidBsStr, setPaidBsStr] = useState<string>('');

  // Purchase items table
  const [items, setItems] = useState<DraftPurchaseItem[]>([]);
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');

  // Product search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierRif, setNewSupplierRif] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');
  const [newSupplierEmail, setNewSupplierEmail] = useState<string>('');
  const [newSupplierCreditDays, setNewSupplierCreditDays] = useState<number>(15);

  // History inspection modal & Success modal
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<PurchaseEntry | null>(null);
  const [completedEntry, setCompletedEntry] = useState<PurchaseEntry | null>(null);

  // History search and filters
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyConditionFilter, setHistoryConditionFilter] = useState<string>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState<string>('');
  const [historyDateTo, setHistoryDateTo] = useState<string>('');

  // Form error message
  const [formError, setFormError] = useState<string | null>(null);

  // Active numerical BCV rate parsed safely
  const activeBcvRate = useMemo(() => {
    const parsed = parseFloat(bcvRateStr.replace(',', '.'));
    return !isNaN(parsed) && parsed > 0 ? parsed : settings.bcvRate || 842.21;
  }, [bcvRateStr, settings.bcvRate]);

  // Sync supplier default credit days when supplier changes
  useEffect(() => {
    if (selectedSupplierId) {
      const sup = suppliers.find((s) => s.id === selectedSupplierId);
      if (sup) {
        const days = sup.creditDays || 15;
        setCreditDaysStr(days.toString());
        const d = new Date(entryDate || todayStr);
        d.setDate(d.getDate() + days);
        setCreditDueDate(d.toISOString().split('T')[0]);
      }
    }
  }, [selectedSupplierId, suppliers, entryDate]);

  // Handle credit days change -> auto update credit due date
  const handleCreditDaysChange = (val: string) => {
    setCreditDaysStr(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      const base = new Date(entryDate || todayStr);
      base.setDate(base.getDate() + num);
      setCreditDueDate(base.toISOString().split('T')[0]);
    }
  };

  // Handle credit due date change -> auto calculate days
  const handleCreditDueDateChange = (val: string) => {
    setCreditDueDate(val);
    if (val && entryDate) {
      const d1 = new Date(entryDate);
      const d2 = new Date(val);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (!isNaN(diffDays)) {
        setCreditDaysStr(Math.max(0, diffDays).toString());
      }
    }
  };

  // Calculate table items totals
  const calculatedItems = useMemo(() => {
    return items.map((it) => {
      const qty = parseFloat(it.quantityStr.replace(',', '.')) || 0;
      const baseCostUSD = parseFloat(it.currentBaseCostStr.replace(',', '.')) || 0;
      const addExpUSD = parseFloat(it.additionalExpenseStr.replace(',', '.')) || 0;
      const realCostUSD = baseCostUSD + addExpUSD;
      const subtotalUSD = qty * realCostUSD;

      const baseCostBs = baseCostUSD * activeBcvRate;
      const addExpBs = addExpUSD * activeBcvRate;
      const realCostBs = realCostUSD * activeBcvRate;
      const subtotalBs = subtotalUSD * activeBcvRate;

      return {
        ...it,
        qty,
        baseCostUSD,
        baseCostBs,
        addExpUSD,
        addExpBs,
        realCostUSD,
        realCostBs,
        subtotalUSD,
        subtotalBs,
      };
    });
  }, [items, activeBcvRate]);

  // Overall Invoice Totals
  const totalInvoiceUSD = useMemo(() => {
    return calculatedItems.reduce((sum, it) => sum + it.subtotalUSD, 0);
  }, [calculatedItems]);

  const totalInvoiceBs = useMemo(() => {
    return totalInvoiceUSD * activeBcvRate;
  }, [totalInvoiceUSD, activeBcvRate]);

  // Paid and Balance amounts based on Payment Condition
  const { paidUSD, paidBs, balanceUSD, balanceBs } = useMemo(() => {
    if (paymentCondition === 'contado') {
      return {
        paidUSD: totalInvoiceUSD,
        paidBs: totalInvoiceBs,
        balanceUSD: 0,
        balanceBs: 0,
      };
    }

    if (paymentCondition === 'credito') {
      return {
        paidUSD: 0,
        paidBs: 0,
        balanceUSD: totalInvoiceUSD,
        balanceBs: totalInvoiceBs,
      };
    }

    // Mixto: read from paid inputs
    const pUSD = parseFloat(paidUSDStr.replace(',', '.')) || 0;
    const pBs = pUSD * activeBcvRate;
    const balUSD = Math.max(0, totalInvoiceUSD - pUSD);
    const balBs = balUSD * activeBcvRate;

    return {
      paidUSD: pUSD,
      paidBs: pBs,
      balanceUSD: balUSD,
      balanceBs: balBs,
    };
  }, [paymentCondition, totalInvoiceUSD, totalInvoiceBs, paidUSDStr, activeBcvRate]);

  // Handle Paid in USD input (recalculates Bs)
  const handlePaidUSDChange = (val: string) => {
    setPaidUSDStr(val);
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num)) {
      setPaidBsStr((num * activeBcvRate).toFixed(2));
    } else {
      setPaidBsStr('');
    }
  };

  // Handle Paid in Bs input (recalculates USD)
  const handlePaidBsChange = (val: string) => {
    setPaidBsStr(val);
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num) && activeBcvRate > 0) {
      setPaidUSDStr((num / activeBcvRate).toFixed(4));
    } else {
      setPaidUSDStr('');
    }
  };

  // Filter products for intelligent search dropdown
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, searchQuery]);

  // Add product to purchase table
  const handleAddProductToTable = (product: Product) => {
    // Check if already in items
    const existingIndex = items.findIndex((i) => i.productId === product.id);
    if (existingIndex >= 0) {
      // Increment quantity
      setItems((prev) =>
        prev.map((it, idx) => {
          if (idx === existingIndex) {
            const currentQty = parseFloat(it.quantityStr.replace(',', '.')) || 1;
            return { ...it, quantityStr: (currentQty + 1).toString() };
          }
          return it;
        })
      );
    } else {
      const newItem: DraftPurchaseItem = {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        category: product.category,
        quantityStr: '1',
        previousCostUSD: product.costUSD || 0,
        currentBaseCostStr: (product.costUSD || 0).toString(),
        additionalExpenseStr: '0',
        expenseConcept: 'Flete / Otros',
      };
      setItems((prev) => [...prev, newItem]);
    }

    setSearchQuery('');
    setIsSearchDropdownOpen(false);
    setFormError(null);
  };

  // Handle item field updates
  const handleUpdateItem = (id: string, field: keyof DraftPurchaseItem, value: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  // Remove item row
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Clear entire form
  const handleResetForm = () => {
    setEntryDate(todayStr);
    setSelectedSupplierId('');
    setInvoiceNumber('');
    setBcvRateStr(settings.bcvRate ? settings.bcvRate.toString() : '842.21');
    setPaymentCondition('contado');
    setCreditDaysStr('15');
    setPaidUSDStr('');
    setPaidBsStr('');
    setItems([]);
    setPurchaseNotes('');
    setFormError(null);
  };

  // Submit and process purchase entry
  const handleSubmitPurchase = () => {
    setFormError(null);

    if (!selectedSupplierId) {
      setFormError('Por favor selecciona el proveedor de la compra.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setFormError('Por favor introduce el número de factura o nota de entrega.');
      return;
    }
    if (items.length === 0) {
      setFormError('Debes agregar al menos un producto en el detalle de la entrada.');
      return;
    }

    const supplierObj = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplierObj) {
      setFormError('El proveedor seleccionado no es válido.');
      return;
    }

    // Check invalid quantities or costs
    for (const it of calculatedItems) {
      if (it.qty <= 0) {
        setFormError(`La cantidad para el producto "${it.productName}" debe ser mayor a 0.`);
        return;
      }
      if (it.realCostUSD < 0) {
        setFormError(`El costo para el producto "${it.productName}" no puede ser negativo.`);
        return;
      }
    }

    const payloadItems: PurchaseEntryItem[] = calculatedItems.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      productCode: it.productCode,
      category: it.category,
      quantity: it.qty,
      previousCostUSD: it.previousCostUSD,
      currentBaseCostUSD: it.baseCostUSD,
      additionalExpenseUSD: it.addExpUSD,
      realCostUSD: it.realCostUSD,
      subtotalUSD: it.subtotalUSD,
      notes: it.expenseConcept,
    }));

    const creditDays = parseInt(creditDaysStr, 10) || 15;

    const result = processPurchaseEntry({
      date: entryDate,
      supplierId: supplierObj.id,
      supplierName: supplierObj.name,
      supplierRif: supplierObj.rif,
      invoiceNumber: invoiceNumber.trim(),
      bcvRate: activeBcvRate,
      paymentCondition,
      creditDays: paymentCondition !== 'contado' ? creditDays : undefined,
      creditDueDate: paymentCondition !== 'contado' ? creditDueDate : undefined,
      totalInvoiceUSD,
      totalInvoiceBs,
      amountPaidUSD: paidUSD,
      amountPaidBs: paidBs,
      balanceUSD,
      balanceBs,
      items: payloadItems,
      notes: purchaseNotes.trim() || undefined,
      registeredBy: currentUser.name || 'Admin',
    });

    if (result.success) {
      setCompletedEntry(result.purchaseEntry);
      handleResetForm();
    }
  };

  // Quick save new supplier
  const handleSaveQuickSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    const newSup: Omit<Supplier, 'id'> = {
      name: newSupplierName.trim(),
      rif: newSupplierRif.trim() || 'J-00000000-0',
      phone: newSupplierPhone.trim() || '+58 000-0000000',
      email: newSupplierEmail.trim() || 'proveedor@distribuidora.com',
      contactPerson: newSupplierName.trim(),
      creditDays: newSupplierCreditDays || 15,
      creditLimitUSD: 2000,
    };

    addSupplier(newSup);
    // Find or simulate selection
    setIsNewSupplierModalOpen(false);
    setNewSupplierName('');
    setNewSupplierRif('');
    setNewSupplierPhone('');
    setNewSupplierEmail('');
  };

  // Handle newly created product from ProductModal
  const handleProductCreated = (productData: Omit<Product, 'id'> | Product) => {
    // If it is new, create it in AppContext
    const newId = 'prod-' + Date.now();
    const newProduct: Product = {
      ...(productData as Omit<Product, 'id'>),
      id: newId,
    };
    addProduct(newProduct);
    // Automatically add to current items list
    handleAddProductToTable(newProduct);
    setIsProductModalOpen(false);
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return purchaseEntries.filter((pe) => {
      const matchSearch =
        pe.entryNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
        pe.supplierName.toLowerCase().includes(historySearch.toLowerCase()) ||
        pe.invoiceNumber.toLowerCase().includes(historySearch.toLowerCase());

      const matchCondition =
        historyConditionFilter === 'all' || pe.paymentCondition === historyConditionFilter;

      const matchDateFrom = !historyDateFrom || pe.date >= historyDateFrom;
      const matchDateTo = !historyDateTo || pe.date <= historyDateTo;

      return matchSearch && matchCondition && matchDateFrom && matchDateTo;
    });
  }, [purchaseEntries, historySearch, historyConditionFilter, historyDateFrom, historyDateTo]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                Módulo de Abastecimiento & Inventario
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">
                Afectación de Stock y Cuentas por Pagar (CxP)
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Entradas por Compras
            </h1>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            id="tab-new-entry"
            onClick={() => setActiveTab('new_entry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'new_entry'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            Nueva Entrada
          </button>
          <button
            id="tab-history"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Compras ({purchaseEntries.length})
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: NUEVA ENTRADA ==================== */}
      {activeTab === 'new_entry' && (
        <div className="space-y-6">
          {/* Top Form: Datos Generales */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  1. Datos Generales de la Compra / Proveedor
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 text-amber-500" />
                <span>Todos los campos con (*) son requeridos</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Fecha de Entrada */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Fecha de Entrada *
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Proveedor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Proveedor *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNewSupplierModalOpen(true)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    title="Registrar nuevo proveedor sin salir"
                  >
                    <Plus className="w-3 h-3" />
                    Nuevo
                  </button>
                </div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">-- Seleccionar Proveedor --</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.rif}) - {sup.creditDays || 15}d
                    </option>
                  ))}
                </select>
              </div>

              {/* N° Factura / Control Proveedor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  N° Factura / Control *
                </label>
                <input
                  type="text"
                  placeholder="Ej. FC-908234"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Tasa BCV Aplicada */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                    Tasa BCV Aplicada (Bs/$)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setBcvRateStr(settings.bcvRate ? settings.bcvRate.toString() : '842.21')
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    title="Restablecer a la tasa actual del sistema"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Actual
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={bcvRateStr}
                    onChange={(e) => setBcvRateStr(e.target.value)}
                    placeholder="842.21"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl pl-3.5 pr-14 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                    Bs/$
                  </span>
                </div>
              </div>
            </div>

            {/* Condiciones de Pago Section */}
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-4 h-4 text-indigo-600" />
                  Condiciones de Pago:
                </label>

                {/* Segmented Radio Options */}
                <div className="inline-flex bg-slate-200/70 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPaymentCondition('contado')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      paymentCondition === 'contado'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Contado (100% Pagado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentCondition('credito')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      paymentCondition === 'credito'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Crédito (100% CxP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentCondition('mixto')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      paymentCondition === 'mixto'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mixto (Parte Contado / Parte CxP)
                  </button>
                </div>
              </div>

              {/* Dynamic Sub-Fields for Crédito & Mixto */}
              {(paymentCondition === 'credito' || paymentCondition === 'mixto') && (
                <div className="pt-3 border-t border-slate-200/70 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
                  {/* Días de Crédito */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Días de Crédito:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={creditDaysStr}
                        onChange={(e) => handleCreditDaysChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-400 pointer-events-none">
                        días
                      </span>
                    </div>
                  </div>

                  {/* Fecha de Vencimiento */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Fecha de Vencimiento:
                    </label>
                    <input
                      type="date"
                      value={creditDueDate}
                      onChange={(e) => handleCreditDueDateChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Additional fields for MIXTO payment */}
                  {paymentCondition === 'mixto' && (
                    <>
                      {/* Monto Pagado en Bs. */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-emerald-600" />
                          Monto Pagado en Bs. (Contado):
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="0.00"
                            value={paidBsStr}
                            onChange={(e) => handlePaidBsChange(e.target.value)}
                            className="w-full bg-white border border-emerald-300 text-slate-900 text-sm font-semibold rounded-xl pl-3 pr-8 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-emerald-600 pointer-events-none">
                            Bs.
                          </span>
                        </div>
                      </div>

                      {/* Monto Pagado en USD */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          Monto Pagado en USD (Contado):
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="0.00"
                            value={paidUSDStr}
                            onChange={(e) => handlePaidUSDChange(e.target.value)}
                            className="w-full bg-white border border-emerald-300 text-slate-900 text-sm font-semibold rounded-xl pl-3 pr-8 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-emerald-600 pointer-events-none">
                            $
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Middle Form: Detalle de Productos & Mercancía */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-indigo-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    2. Renglones & Detalle de Mercancía
                  </h2>
                  <p className="text-xs text-slate-500">
                    Búsqueda inteligente por nombre/código, costos unitarios y gastos adicionales
                  </p>
                </div>
              </div>

              {/* Action Buttons: Add Existing or Create New Product */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-create-new-product"
                  onClick={() => setIsProductModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold shadow-sm transition-all"
                  title="Crear un nuevo producto que no esté actualmente en el catálogo sin perder los datos de la compra"
                >
                  <Plus className="w-4 h-4" />
                  Crear Nuevo Producto en Catálogo
                </button>
              </div>
            </div>

            {/* Search Input for Products */}
            <div className="relative">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre, código de barras o SKU para agregarlo a la entrada..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl pl-12 pr-10 py-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Intelligent Suggestions Dropdown */}
              {isSearchDropdownOpen && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {searchResults.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAddProductToTable(prod)}
                      className="w-full px-4 py-3 text-left hover:bg-indigo-50/60 flex items-center justify-between gap-4 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {prod.image ? (
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-600">
                            {prod.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono">{prod.code}</span>
                            <span>•</span>
                            <span>{prod.category}</span>
                            <span>•</span>
                            <span>Stock actual: {prod.stock || 0}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-900">
                          {formatUSD(prod.costUSD || 0)}
                        </p>
                        <p className="text-xs text-slate-400">Último Costo</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items Table */}
            {items.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">
                  No has agregado productos a esta entrada
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Usa la barra de búsqueda superior para seleccionar productos existentes, o pulsa el botón "Crear Nuevo Producto en Catálogo" si vas a registrar un producto nuevo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3 min-w-[200px]">Producto & Código</th>
                      <th className="py-3 px-3 text-center min-w-[90px]">Cantidad</th>
                      <th className="py-3 px-3 text-right min-w-[110px]">Costo Anterior</th>
                      <th className="py-3 px-3 min-w-[130px]">Costo Base Actual ($)</th>
                      <th className="py-3 px-3 min-w-[140px]">Gastos Adic. ($)</th>
                      <th className="py-3 px-3 text-right min-w-[120px]">Costo Real Unit.</th>
                      <th className="py-3 px-3 text-right min-w-[130px]">Subtotal</th>
                      <th className="py-3 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {calculatedItems.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Producto & Código */}
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 text-sm leading-snug">
                            {it.productName}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <span className="font-mono">{it.productCode}</span>
                            <span>•</span>
                            <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                              {it.category}
                            </span>
                          </div>
                        </td>

                        {/* Cantidad */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={it.quantityStr}
                            onChange={(e) =>
                              handleUpdateItem(it.id, 'quantityStr', e.target.value)
                            }
                            className="w-20 mx-auto text-center font-bold bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>

                        {/* Costo Anterior */}
                        <td className="py-3 px-3 text-right">
                          {it.previousCostUSD > 0 ? (
                            <div>
                              <span className="font-semibold text-slate-600">
                                {formatUSD(it.previousCostUSD)}
                              </span>
                              <p className="text-[10px] text-slate-400">
                                {formatBs(it.previousCostUSD * activeBcvRate)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              Nuevo
                            </span>
                          )}
                        </td>

                        {/* Costo Base Actual USD */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">
                                $
                              </span>
                              <input
                                type="text"
                                value={it.currentBaseCostStr}
                                onChange={(e) =>
                                  handleUpdateItem(it.id, 'currentBaseCostStr', e.target.value)
                                }
                                placeholder="0.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 font-bold text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 text-right">
                              ≈ {formatBs(it.baseCostBs)}
                            </p>
                          </div>
                        </td>

                        {/* Gastos Adicionales USD */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">
                                +$
                              </span>
                              <input
                                type="text"
                                value={it.additionalExpenseStr}
                                onChange={(e) =>
                                  handleUpdateItem(it.id, 'additionalExpenseStr', e.target.value)
                                }
                                placeholder="0.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-xs font-semibold text-amber-700 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                              />
                            </div>
                            <input
                              type="text"
                              value={it.expenseConcept}
                              onChange={(e) =>
                                handleUpdateItem(it.id, 'expenseConcept', e.target.value)
                              }
                              placeholder="Flete, IVA, etc."
                              className="w-full bg-transparent border-0 text-[10px] text-slate-400 italic focus:outline-none"
                            />
                          </div>
                        </td>

                        {/* Costo Real Unitario */}
                        <td className="py-3 px-3 text-right">
                          <p className="font-bold text-indigo-700 text-sm">
                            {formatUSD(it.realCostUSD)}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {formatBs(it.realCostBs)}
                          </p>
                        </td>

                        {/* Subtotal */}
                        <td className="py-3 px-3 text-right">
                          <p className="font-extrabold text-slate-900 text-sm">
                            {formatUSD(it.subtotalUSD)}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-500">
                            {formatBs(it.subtotalBs)}
                          </p>
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar renglón"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes Section */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-slate-700">
                Observaciones o Notas de la Entrada:
              </label>
              <textarea
                rows={2}
                value={purchaseNotes}
                onChange={(e) => setPurchaseNotes(e.target.value)}
                placeholder="Detalles sobre la recepción de mercancía, chofer, número de precinto, notas de calidad, etc..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* ==================== SUMMARY CARDS SECTION ==================== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Monto Total Factura */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900" />
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Monto Total Factura
                </span>
                <Receipt className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatUSD(totalInvoiceUSD)}
              </p>
              <p className="text-xs font-bold text-slate-600 mt-1">
                {formatBs(totalInvoiceBs)}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                {calculatedItems.length} renglones ({calculatedItems.reduce((s, i) => s + i.qty, 0)} unidades)
              </p>
            </div>

            {/* Card 2: Total Pagado (Contado) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200 relative overflow-hidden bg-gradient-to-b from-white to-emerald-50/20">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
              <div className="flex items-center justify-between text-emerald-700 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Total Pagado (Contado)
                </span>
                <Coins className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl lg:text-3xl font-extrabold text-emerald-700 tracking-tight">
                {formatUSD(paidUSD)}
              </p>
              <p className="text-xs font-bold text-emerald-800 mt-1">
                {formatBs(paidBs)}
              </p>
              <p className="text-[11px] text-emerald-600 mt-2">
                {paymentCondition === 'contado'
                  ? 'Liquidación 100% de contado'
                  : paymentCondition === 'mixto'
                  ? 'Anticipo / Abono de contado'
                  : 'Sin desembolso inicial'}
              </p>
            </div>

            {/* Card 3: Total Pendiente / Crédito (CxP) */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-200 relative overflow-hidden bg-gradient-to-b from-white to-rose-50/20">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600" />
              <div className="flex items-center justify-between text-rose-700 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Saldo Pendiente (CxP)
                </span>
                <Clock className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl lg:text-3xl font-extrabold text-rose-700 tracking-tight">
                {formatUSD(balanceUSD)}
              </p>
              <p className="text-xs font-bold text-rose-800 mt-1">
                {formatBs(balanceBs)}
              </p>
              <p className="text-[11px] text-rose-600 mt-2">
                {balanceUSD > 0
                  ? `Se registrará en CxP (Vence: ${creditDueDate})`
                  : 'Factura solvente sin saldo pendiente'}
              </p>
            </div>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <p className="text-sm font-semibold">{formError}</p>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Limpiar Formulario
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                id="btn-process-purchase-entry"
                onClick={handleSubmitPurchase}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-[0.99]"
              >
                <CheckCircle2 className="w-5 h-5" />
                Asentar y Procesar Entrada en Inventario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: HISTORIAL DE ENTRADAS ==================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por N° Entrada, Factura, Proveedor..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Payment Condition Filter */}
              <div>
                <select
                  value={historyConditionFilter}
                  onChange={(e) => setHistoryConditionFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="all">Todas las Condiciones de Pago</option>
                  <option value="contado">Contado</option>
                  <option value="credito">Crédito</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>

              {/* Date From */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Desde:</span>
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Date To */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Hasta:</span>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* History List */}
          {filteredHistory.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                No se encontraron registros de compras
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Intenta ajustando los filtros de búsqueda o registra una nueva entrada.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90 hover:border-indigo-300 transition-all flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header with Entry Number and Date */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        {entry.entryNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {entry.date}
                      </span>
                    </div>

                    {/* Supplier and Invoice */}
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">
                        {entry.supplierName}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Factura: <span className="text-slate-800 font-semibold">{entry.invoiceNumber}</span>
                      </p>
                    </div>

                    {/* Condition badge and BCV rate */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-full capitalize ${
                          entry.paymentCondition === 'contado'
                            ? 'bg-emerald-50 text-emerald-700'
                            : entry.paymentCondition === 'credito'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {entry.paymentCondition}
                      </span>
                      <span className="text-slate-500 font-medium">
                        Tasa: {entry.bcvRate.toFixed(2)} Bs/$
                      </span>
                    </div>

                    {/* Amounts breakdown */}
                    <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Factura:</span>
                        <span className="font-bold text-slate-900">{formatUSD(entry.totalInvoiceUSD)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Pagado:</span>
                        <span className="font-semibold">{formatUSD(entry.amountPaidUSD)}</span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>Saldo Crédito:</span>
                        <span className="font-semibold">{formatUSD(entry.balanceUSD)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryEntry(entry)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-bold rounded-xl transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver Detalles & Renglones ({entry.items.length})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: HISTORIAL / DETALLE DE COMPRA ==================== */}
      {selectedHistoryEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded">
                    {selectedHistoryEntry.entryNumber}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-300">Fecha: {selectedHistoryEntry.date}</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedHistoryEntry.supplierName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedHistoryEntry(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Meta information summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-slate-400">N° Factura:</p>
                  <p className="font-bold text-slate-900 font-mono text-sm">
                    {selectedHistoryEntry.invoiceNumber}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Condición de Pago:</p>
                  <p className="font-bold text-slate-900 capitalize text-sm">
                    {selectedHistoryEntry.paymentCondition}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Tasa BCV Aplicada:</p>
                  <p className="font-bold text-slate-900 text-sm">
                    {selectedHistoryEntry.bcvRate.toFixed(2)} Bs/$
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Registrado por:</p>
                  <p className="font-bold text-slate-900 text-sm">
                    {selectedHistoryEntry.registeredBy || 'Admin'}
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-3">
                  Productos Recibidos e Ingresados al Inventario
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-center">Cantidad</th>
                        <th className="py-2.5 px-3 text-right">Costo Anterior</th>
                        <th className="py-2.5 px-3 text-right">Costo Real Unit.</th>
                        <th className="py-2.5 px-3 text-right">Subtotal ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedHistoryEntry.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {it.productName}
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {it.productCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                            +{it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {it.previousCostUSD > 0 ? formatUSD(it.previousCostUSD) : 'Nuevo'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                            {formatUSD(it.realCostUSD)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatUSD(it.subtotalUSD)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">Total Factura:</p>
                  <p className="text-xl font-black text-white">
                    {formatUSD(selectedHistoryEntry.totalInvoiceUSD)}
                  </p>
                  <p className="text-xs text-slate-300 font-medium">
                    {formatBs(selectedHistoryEntry.totalInvoiceBs)}
                  </p>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-emerald-400">Pagado de Contado:</p>
                    <p className="text-base font-bold text-emerald-300">
                      {formatUSD(selectedHistoryEntry.amountPaidUSD)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-rose-400">Saldo a Crédito (CxP):</p>
                    <p className="text-base font-bold text-rose-300">
                      {formatUSD(selectedHistoryEntry.balanceUSD)}
                    </p>
                  </div>
                </div>
              </div>

              {selectedHistoryEntry.notes && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl">
                  <p className="font-bold text-xs">Observaciones:</p>
                  <p className="text-xs mt-0.5">{selectedHistoryEntry.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedHistoryEntry(null)}
                className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUCCESS RECEIPT MODAL ==================== */}
      {completedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">
                ¡Entrada Asentada Exitosamente!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Se actualizaron las existencias y costos en el inventario actual.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-left text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">N° de Entrada:</span>
                <span className="font-mono font-bold text-slate-900">{completedEntry.entryNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Proveedor:</span>
                <span className="font-semibold text-slate-900">{completedEntry.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">N° Factura:</span>
                <span className="font-mono font-semibold text-slate-900">{completedEntry.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Renglones Recibidos:</span>
                <span className="font-bold text-slate-900">{completedEntry.items.length} productos</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-700">Total Factura:</span>
                <span className="font-bold text-slate-900">{formatUSD(completedEntry.totalInvoiceUSD)}</span>
              </div>
              {completedEntry.balanceUSD > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span className="font-semibold">Registrado en CxP:</span>
                  <span className="font-bold">{formatUSD(completedEntry.balanceUSD)}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCompletedEntry(null)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all"
            >
              Aceptar y Continuar
            </button>
          </div>
        </div>
      )}

      {/* ==================== QUICK MODAL: REGISTRAR NUEVO PROVEEDOR ==================== */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveQuickSupplier}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-left animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Registrar Nuevo Proveedor
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Razón Social / Nombre *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Distribuidora Santa Elena C.A."
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">RIF</label>
                  <input
                    type="text"
                    placeholder="J-12345678-9"
                    value={newSupplierRif}
                    onChange={(e) => setNewSupplierRif(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Días de Crédito</label>
                  <input
                    type="number"
                    min="0"
                    value={newSupplierCreditDays}
                    onChange={(e) => setNewSupplierCreditDays(parseInt(e.target.value, 10) || 15)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Teléfono</label>
                <input
                  type="text"
                  placeholder="+58 414-0000000"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
              >
                Guardar Proveedor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== PRODUCT MODAL (CREAR PRODUCTO SIN PERDER DATOS) ==================== */}
      {isProductModalOpen && (
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          productToEdit={null}
          onSave={handleProductCreated}
        />
      )}
    </div>
  );
};
