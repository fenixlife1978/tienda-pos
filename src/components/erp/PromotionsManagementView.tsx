import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatUSD, formatBs } from '../../utils/formatUtils';
import { Product, PromotionConditionPreset, SlowMovingProductAnalysis } from '../../types';
import {
  Tag,
  Flame,
  TrendingDown,
  Send,
  Bell,
  MessageCircle,
  Clock,
  Calendar,
  DollarSign,
  CheckCircle2,
  Plus,
  Trash2,
  Edit3,
  Search,
  Filter,
  Users,
  Smartphone,
  Package,
  Eye,
  Check,
  Copy,
  X,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Percent,
  Sparkles,
} from 'lucide-react';
import { INITIAL_PROMOTION_CONDITIONS } from '../../data/initialData';

type ActiveTab = 'promotions' | 'broadcast' | 'slow_moving';
type SlowMovingPeriod = 30 | 60 | 90;

export const PromotionsManagementView: React.FC = () => {
  const {
    products,
    updateProduct,
    orders,
    customers,
    settings,
    triggerPushNotification,
    setStoreTab,
    setIsAdminActive,
  } = useApp();

  // Active view tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('promotions');

  // Condition Presets state with local storage fallback
  const [conditionPresets, setConditionPresets] = useState<PromotionConditionPreset[]>(() => {
    const saved = localStorage.getItem('omni_promo_conditions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Error parsing promo conditions', e);
      }
    }
    return INITIAL_PROMOTION_CONDITIONS;
  });

  const saveConditionPresets = (updated: PromotionConditionPreset[]) => {
    setConditionPresets(updated);
    try {
      localStorage.setItem('omni_promo_conditions', JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving promo conditions', e);
    }
  };

  const handleAddConditionPreset = (label: string) => {
    if (!label.trim()) return;
    const exists = conditionPresets.some((c) => c.label.toLowerCase() === label.trim().toLowerCase());
    if (exists) return;
    const newPreset: PromotionConditionPreset = {
      id: `cond-${Date.now()}`,
      label: label.trim(),
      isCustom: true,
    };
    const updated = [...conditionPresets, newPreset];
    saveConditionPresets(updated);
  };

  const handleDeleteConditionPreset = (id: string) => {
    const updated = conditionPresets.filter((c) => c.id !== id);
    saveConditionPresets(updated);
  };

  // Promotion Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(15);
  const [offerCondition, setOfferCondition] = useState<string>('Después de 6 artículos');
  const [offerBadgeText, setOfferBadgeText] = useState<string>('OFERTA ESPECIAL');
  const [newCustomCondition, setNewCustomCondition] = useState<string>('');
  const [searchPromoQuery, setSearchPromoQuery] = useState('');
  const [categoryPromoFilter, setCategoryPromoFilter] = useState('all');

  // Slow moving filters
  const [slowPeriod, setSlowPeriod] = useState<SlowMovingPeriod>(30);
  const [slowCategoryFilter, setSlowCategoryFilter] = useState('all');
  const [slowSearchQuery, setSlowSearchQuery] = useState('');
  const [slowStatusFilter, setSlowStatusFilter] = useState<'all' | 'sin_movimiento' | 'poco_movimiento'>('all');

  // Broadcast Notification State
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'verified' | 'credit'>('all');
  const [selectedPromoForBroadcast, setSelectedPromoForBroadcast] = useState<string>('all');
  const [customPushTitle, setCustomPushTitle] = useState('🔥 ¡Nuevas Promociones y Descuentos Exclusivos!');
  const [customPushMessage, setCustomPushMessage] = useState(
    'Aprovecha nuestros precios de oferta por volumen y combos especiales con tasa oficial BCV. ¡Haz tu pedido ahora!'
  );
  const [pushSentSuccess, setPushSentSuccess] = useState<number | null>(null);

  // WhatsApp Broadcast State
  const [waMessageTemplate, setWaMessageTemplate] = useState(
    '¡Hola {nombre}! 🛒 En Distribuidora OmniMayor tenemos ofertas activas: {resumen_ofertas}. Tasa BCV: {tasa_bcv} Bs/$. ¡Ahorra en tu compra mayorista! Escríbenos o visita nuestro catálogo web.'
  );
  const [waCopiedIndex, setWaCopiedIndex] = useState<number | null>(null);

  // Products currently with active offers
  const activeOfferProducts = useMemo(() => {
    return products.filter((p) => p.isOffer && (p.discountPercentage || 0) > 0);
  }, [products]);

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered promotions list
  const filteredOfferProducts = useMemo(() => {
    return activeOfferProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchPromoQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchPromoQuery.toLowerCase()) ||
        (p.offerCondition || '').toLowerCase().includes(searchPromoQuery.toLowerCase());
      const matchesCat = categoryPromoFilter === 'all' || p.category === categoryPromoFilter;
      return matchesSearch && matchesCat;
    });
  }, [activeOfferProducts, searchPromoQuery, categoryPromoFilter]);

  // Open modal to create or edit promotion
  const handleOpenPromoModal = (prod?: Product) => {
    if (prod) {
      setEditingProduct(prod);
      setSelectedProductId(prod.id);
      setDiscountPercent(prod.discountPercentage || 15);
      setOfferCondition(prod.offerCondition || 'Después de 6 artículos');
      setOfferBadgeText(prod.offerBadgeText || 'OFERTA ESPECIAL');
    } else {
      setEditingProduct(null);
      const firstAvailable = products.find((p) => !p.isOffer) || products[0];
      setSelectedProductId(firstAvailable ? firstAvailable.id : '');
      setDiscountPercent(15);
      setOfferCondition('Después de 6 artículos');
      setOfferBadgeText('OFERTA ESPECIAL');
    }
    setIsModalOpen(true);
  };

  // Target product in modal
  const targetModalProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || editingProduct;
  }, [products, selectedProductId, editingProduct]);

  // Calculated modal savings
  const modalCalculations = useMemo(() => {
    if (!targetModalProduct) return { promoPriceUSD: 0, promoPriceBs: 0, savingsUSD: 0, savingsBs: 0 };
    const origUSD = targetModalProduct.priceUSD;
    const disc = Math.max(1, Math.min(99, discountPercent));
    const promoUSD = origUSD * (1 - disc / 100);
    const savingsUSD = origUSD - promoUSD;
    const rate = settings.bcvRate;
    return {
      promoPriceUSD: promoUSD,
      promoPriceBs: promoUSD * rate,
      savingsUSD,
      savingsBs: savingsUSD * rate,
    };
  }, [targetModalProduct, discountPercent, settings.bcvRate]);

  // Save promotion on product
  const handleSavePromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModalProduct) return;

    const disc = Math.max(1, Math.min(99, Number(discountPercent)));
    const promoUSD = targetModalProduct.priceUSD * (1 - disc / 100);
    const savingsUSD = targetModalProduct.priceUSD - promoUSD;

    const updated: Product = {
      ...targetModalProduct,
      isOffer: true,
      discountPercentage: disc,
      offerCondition: offerCondition.trim() || 'A partir de 6 unidades',
      offerBadgeText: offerBadgeText.trim() || 'OFERTA ESPECIAL',
      promotionalPriceUSD: promoUSD,
      offerSavingsUSD: savingsUSD,
      offerSavingsBs: savingsUSD * settings.bcvRate,
    };

    updateProduct(updated);
    setIsModalOpen(false);

    triggerPushNotification({
      title: 'Promoción Activada en Catálogo',
      message: `${updated.name} ahora tiene un ${disc}% de descuento (${updated.offerCondition}). Ahorro: $${savingsUSD.toFixed(2)}.`,
      type: 'promotion',
      badge: 'Oferta Activada',
      sound: true,
    });
  };

  // Toggle or remove promotion
  const handleToggleOffer = (product: Product) => {
    const updated: Product = {
      ...product,
      isOffer: !product.isOffer,
    };
    updateProduct(updated);
    triggerPushNotification({
      title: updated.isOffer ? 'Oferta Activada' : 'Oferta Pausada',
      message: `La promoción para "${product.name}" ha sido ${updated.isOffer ? 'activada' : 'desactivada'}.`,
      type: 'promotion',
      badge: 'Gestión Ofertas',
    });
  };

  const handleRemoveOffer = (product: Product) => {
    const updated: Product = {
      ...product,
      isOffer: false,
      discountPercentage: undefined,
      offerCondition: undefined,
      offerBadgeText: undefined,
      promotionalPriceUSD: undefined,
      offerSavingsUSD: undefined,
      offerSavingsBs: undefined,
    };
    updateProduct(updated);
    triggerPushNotification({
      title: 'Promoción Eliminada',
      message: `Se removió la oferta del producto "${product.name}".`,
      type: 'inventory_alert',
      badge: 'Oferta Eliminada',
    });
  };

  // Slow Moving Inventory Calculation (30, 60, 90 days)
  const slowMovingAnalysis = useMemo<SlowMovingProductAnalysis[]>(() => {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - slowPeriod * 24 * 60 * 60 * 1000);

    // Map all sales from orders
    const productSalesMap = new Map<
      string,
      {
        unitsSold: number;
        revenueUSD: number;
        lastSaleDate: string | null;
      }
    >();

    // Initialize map for all products
    products.forEach((p) => {
      productSalesMap.set(p.id, {
        unitsSold: 0,
        revenueUSD: 0,
        lastSaleDate: null,
      });
    });

    // Traverse orders
    orders.forEach((ord) => {
      const orderDate = new Date(ord.createdAt);
      ord.items.forEach((item) => {
        const entry = productSalesMap.get(item.productId);
        if (entry) {
          // Check last sale overall
          if (!entry.lastSaleDate || new Date(ord.createdAt) > new Date(entry.lastSaleDate)) {
            entry.lastSaleDate = ord.createdAt;
          }

          // If within the selected period window, accumulate units and revenue
          if (orderDate >= cutoffDate) {
            entry.unitsSold += item.quantity;
            entry.revenueUSD += item.subtotalUSD;
          }
        }
      });
    });

    // Build analysis array
    return products.map((p) => {
      const data = productSalesMap.get(p.id) || { unitsSold: 0, revenueUSD: 0, lastSaleDate: null };
      const totalVal = p.stock * p.costUSD;

      let status: 'sin_movimiento' | 'poco_movimiento' | 'movimiento_normal' = 'movimiento_normal';
      if (data.unitsSold === 0) {
        status = 'sin_movimiento';
      } else if (data.unitsSold <= 5) {
        status = 'poco_movimiento';
      }

      let daysSinceLastSale: number | null = null;
      if (data.lastSaleDate) {
        const last = new Date(data.lastSaleDate);
        const diffMs = now.getTime() - last.getTime();
        daysSinceLastSale = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        category: p.category,
        stock: p.stock,
        costUSD: p.costUSD,
        priceUSD: p.priceUSD,
        totalValueUSD: totalVal,
        unitsSold: data.unitsSold,
        revenueUSD: data.revenueUSD,
        lastSaleDate: data.lastSaleDate,
        daysSinceLastSale,
        status,
      };
    });
  }, [products, orders, slowPeriod]);

  // Filtered slow moving analysis
  const filteredSlowMoving = useMemo(() => {
    return slowMovingAnalysis.filter((item) => {
      const matchesSearch =
        item.productName.toLowerCase().includes(slowSearchQuery.toLowerCase()) ||
        item.productCode.toLowerCase().includes(slowSearchQuery.toLowerCase());
      const matchesCat = slowCategoryFilter === 'all' || item.category === slowCategoryFilter;
      const matchesStatus = slowStatusFilter === 'all' || item.status === slowStatusFilter;
      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [slowMovingAnalysis, slowSearchQuery, slowCategoryFilter, slowStatusFilter]);

  // Quick stats for slow moving
  const slowMovingStats = useMemo(() => {
    const zeroMove = slowMovingAnalysis.filter((i) => i.status === 'sin_movimiento');
    const lowMove = slowMovingAnalysis.filter((i) => i.status === 'poco_movimiento');
    const totalImmobilizedUSD = zeroMove.reduce((acc, i) => acc + i.totalValueUSD, 0);
    const lowImmobilizedUSD = lowMove.reduce((acc, i) => acc + i.totalValueUSD, 0);

    return {
      zeroCount: zeroMove.length,
      zeroImmobilizedUSD: totalImmobilizedUSD,
      lowCount: lowMove.length,
      lowImmobilizedUSD: lowImmobilizedUSD,
      totalCount: slowMovingAnalysis.length,
    };
  }, [slowMovingAnalysis]);

  // Target customers for Push / WhatsApp
  const targetCustomersList = useMemo(() => {
    return customers.filter((c) => {
      if (broadcastTarget === 'verified') return c.verificationStatus === 'verified';
      if (broadcastTarget === 'credit') return c.hasCredit && c.creditStatus === 'approved';
      return true;
    });
  }, [customers, broadcastTarget]);

  // Send Push to all target customers
  const handleBroadcastPush = () => {
    let sentCount = 0;
    targetCustomersList.forEach((c) => {
      triggerPushNotification({
        title: customPushTitle,
        message: `Hola ${c.name}, ${customPushMessage}`,
        type: 'promotion',
        targetCustomerId: c.id,
        badge: 'OFERTAS ACTIVAS',
        sound: true,
      });
      sentCount++;
    });

    setPushSentSuccess(sentCount);
    setTimeout(() => {
      setPushSentSuccess(null);
    }, 5000);
  };

  // Generate WhatsApp Message for a customer
  const generateWaMessage = (customerName: string) => {
    const offerSummary =
      activeOfferProducts.length > 0
        ? activeOfferProducts
            .slice(0, 3)
            .map((p) => `*${p.name}* a solo $${(p.priceUSD * (1 - (p.discountPercentage || 0) / 100)).toFixed(2)} (${p.offerCondition})`)
            .join(', ')
        : 'Descuentos especiales por volumen';

    return waMessageTemplate
      .replace(/{nombre}/g, customerName)
      .replace(/{resumen_ofertas}/g, offerSummary)
      .replace(/{tasa_bcv}/g, formatBs(settings.bcvRate))
      .replace(/{cantidad_ofertas}/g, String(activeOfferProducts.length));
  };

  const handleOpenWhatsAppLink = (phone: string, customerName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone.replace(/^0/, '')}`;
    const text = encodeURIComponent(generateWaMessage(customerName));
    const url = `https://wa.me/${formattedPhone}?text=${text}`;
    window.open(url, '_blank');
  };

  const handleCopyWaMessage = (customerName: string, index: number) => {
    const text = generateWaMessage(customerName);
    navigator.clipboard.writeText(text);
    setWaCopiedIndex(index);
    setTimeout(() => setWaCopiedIndex(null), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/30 border border-rose-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Marketing & Inventario ERP
            </span>
            <span className="text-xs text-rose-200">| Tasa BCV: {formatBs(settings.bcvRate)} Bs/$</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Tag className="w-7 h-7 text-amber-400" />
            Gestión de Promociones, Ofertas & Rotación
          </h1>
          <p className="text-sm text-rose-100/90 max-w-2xl">
            Crea promociones con condiciones editables en texto libre, visualiza el ahorro del cliente en tiempo real, difunde por Push / WhatsApp y audita productos estancados a 30, 60 y 90 días.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsAdminActive(false);
              setStoreTab('offers');
            }}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition cursor-pointer backdrop-blur-xs"
          >
            <Eye className="w-4 h-4 text-amber-300" />
            Ver Muro de Ofertas
          </button>
          <button
            type="button"
            onClick={() => handleOpenPromoModal()}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg hover:shadow-amber-500/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Promoción
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('promotions')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'promotions'
              ? 'bg-white text-rose-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-600" />
          <span>Ofertas & Promociones Activas</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
            {activeOfferProducts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('broadcast')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'broadcast'
              ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Send className="w-4 h-4 text-emerald-600" />
          <span>Notificaciones Push & WhatsApp Masivo</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
            {customers.length} clientes
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('slow_moving')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'slow_moving'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Clock className="w-4 h-4 text-indigo-600" />
          <span>Auditoría de Rotación (30 / 60 / 90 Días)</span>
          {slowMovingStats.zeroCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
              {slowMovingStats.zeroCount} sin ventas
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PROMOTIONS & OFFERS */}
      {activeTab === 'promotions' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Ofertas Activas</span>
                <p className="text-xl font-black text-slate-900">{activeOfferProducts.length} productos</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Ahorro Promedio Cliente</span>
                <p className="text-xl font-black text-emerald-700">
                  {activeOfferProducts.length > 0
                    ? `${(
                        activeOfferProducts.reduce((sum, p) => sum + (p.discountPercentage || 0), 0) /
                        activeOfferProducts.length
                      ).toFixed(1)}% OFF`
                    : '0%'}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Stock Total en Oferta</span>
                <p className="text-xl font-black text-slate-900">
                  {activeOfferProducts.reduce((sum, p) => sum + p.stock, 0)} unidades
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Condiciones Registradas</span>
                <p className="text-xl font-black text-slate-900">{conditionPresets.length} condiciones</p>
              </div>
            </div>
          </div>

          {/* Condition Presets Management Strip */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600" />
                  Condiciones de Oferta / Promoción (Texto Libre & Predefinidos)
                </h3>
                <p className="text-xs text-slate-500">
                  Crea y elimina condiciones personalizadas aplicables a cualquier producto (ej: "Después de 6 artículos", "A partir de 12 unidades", etc.)
                </p>
              </div>

              {/* Add Custom Condition Form */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCustomCondition}
                  onChange={(e) => setNewCustomCondition(e.target.value)}
                  placeholder="Nueva condición libre..."
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCustomCondition.trim()) {
                      e.preventDefault();
                      handleAddConditionPreset(newCustomCondition);
                      setNewCustomCondition('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newCustomCondition.trim()) {
                      handleAddConditionPreset(newCustomCondition);
                      setNewCustomCondition('');
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
            </div>

            {/* Chips of conditions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {conditionPresets.map((cond) => (
                <div
                  key={cond.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium group hover:border-rose-300"
                >
                  <span className="text-rose-600 font-bold">•</span>
                  <span>{cond.label}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteConditionPreset(cond.id)}
                    title="Eliminar condición"
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded-sm transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Search and Category Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchPromoQuery}
                onChange={(e) => setSearchPromoQuery(e.target.value)}
                placeholder="Buscar por producto, código o condición..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={categoryPromoFilter}
                onChange={(e) => setCategoryPromoFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              >
                <option value="all">Todas las Categorías</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Offer Products Grid */}
          {filteredOfferProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Flame className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No hay productos en oferta con los filtros aplicados</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Activa promociones sobre tu catálogo para incrementar la rotación de inventario y atraer más clientes mayoristas.
              </p>
              <button
                type="button"
                onClick={() => handleOpenPromoModal()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Crear Primera Oferta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOfferProducts.map((product) => {
                const discount = product.discountPercentage || 0;
                const promoPriceUSD = product.priceUSD * (1 - discount / 100);
                const promoPriceBs = promoPriceUSD * settings.bcvRate;
                const savingsUSD = product.priceUSD - promoPriceUSD;
                const savingsBs = savingsUSD * settings.bcvRate;

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition duration-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Image and Badges */}
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                          <span className="bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-amber-300" />
                            -{discount}% OFF
                          </span>
                          {product.offerBadgeText && (
                            <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded shadow-sm tracking-wider uppercase">
                              {product.offerBadgeText}
                            </span>
                          )}
                        </div>

                        <div className="absolute top-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-md">
                          Stock: {product.stock} {product.unit}
                        </div>
                      </div>

                      {/* Product details */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-rose-600 uppercase tracking-wider">{product.category}</span>
                          <span className="font-mono">{product.code}</span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                          {product.name}
                        </h3>

                        {/* Condition Box */}
                        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[11px]">
                            <Tag className="w-3.5 h-3.5 text-amber-600" />
                            <span>Condición de la Promoción:</span>
                          </div>
                          <p className="font-semibold text-slate-800 pl-5">
                            {product.offerCondition || 'Aplicable a partir de 6 unidades'}
                          </p>
                        </div>

                        {/* Customer Savings Pill */}
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-800 flex items-center gap-1">
                            <TrendingDown className="w-4 h-4 text-emerald-600" />
                            Ahorro del Cliente:
                          </span>
                          <div className="text-right">
                            <p className="font-black text-emerald-700 font-mono">+{formatUSD(savingsUSD)}</p>
                            <p className="text-[10px] text-emerald-600 font-mono">+{formatBs(savingsBs)}</p>
                          </div>
                        </div>

                        {/* Pricing breakdown */}
                        <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 line-through font-mono block">
                              Reg: {formatUSD(product.priceUSD)}
                            </span>
                            <span className="text-lg font-black text-rose-600 font-mono">
                              {formatUSD(promoPriceUSD)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-700 font-mono block">
                              {formatBs(promoPriceBs)}
                            </span>
                            <span className="text-[10px] text-slate-400">Tasa Oficial BCV</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="p-4 pt-0 flex items-center gap-2 border-t border-slate-100 mt-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPromoModal(product)}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                        Editar Oferta
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveOffer(product)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition cursor-pointer"
                        title="Eliminar de promociones"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BROADCAST NOTIFICATIONS (PUSH & WHATSAPP) */}
      {activeTab === 'broadcast' && (
        <div className="space-y-6">
          {/* Top Banner Alert */}
          {pushSentSuccess !== null && (
            <div className="p-4 rounded-xl bg-emerald-600 text-white flex items-center justify-between shadow-lg animate-in fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-200" />
                <div>
                  <h4 className="font-bold text-sm">¡Notificación Push Masiva Enviada Exitosamente!</h4>
                  <p className="text-xs text-emerald-100">
                    Se enviaron alertas a {pushSentSuccess} clientes registrados con sus preferencias activadas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPushSentSuccess(null)}
                className="text-white hover:text-emerald-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Push Notification Broadcast */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Difusión Push a Clientes Registrados</h2>
                  <p className="text-xs text-slate-500">
                    Envía avisos emergentes y notificaciones a los dispositivos de todos los compradores.
                  </p>
                </div>
              </div>

              {/* Push Config Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Audiencia Objetivo ({targetCustomersList.length} Clientes)
                  </label>
                  <select
                    value={broadcastTarget}
                    onChange={(e) => setBroadcastTarget(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="all">Todos los Clientes Registrados ({customers.length})</option>
                    <option value="verified">Solo Clientes Verificados / Mayoristas</option>
                    <option value="credit">Solo Clientes con Línea de Crédito Activa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Título de la Notificación</label>
                  <input
                    type="text"
                    value={customPushTitle}
                    onChange={(e) => setCustomPushTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mensaje de la Oferta</label>
                  <textarea
                    rows={3}
                    value={customPushMessage}
                    onChange={(e) => setCustomPushMessage(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>

                {/* Device Preview Card */}
                <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                      Vista previa en Teléfono / Portal Cliente
                    </span>
                    <span>Ahora</span>
                  </div>
                  <div className="bg-slate-800/90 rounded-lg p-3 border border-slate-700/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-rose-500" />
                        {customPushTitle}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-black uppercase">
                        PROMO
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{customPushMessage}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBroadcastPush}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-rose-600/25 transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Enviar Notificación Push a Todos los Clientes ({targetCustomersList.length})
                </button>
              </div>
            </div>

            {/* Right Column: WhatsApp Broadcast */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Difusión Masiva por WhatsApp</h2>
                  <p className="text-xs text-slate-500">
                    Genera mensajes personalizados y envía ofertas a los números de WhatsApp de tus clientes.
                  </p>
                </div>
              </div>

              {/* WhatsApp Template Editor */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plantilla de Mensaje WhatsApp
                  </label>
                  <textarea
                    rows={4}
                    value={waMessageTemplate}
                    onChange={(e) => setWaMessageTemplate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] text-slate-500">
                    <span className="bg-slate-100 px-2 py-0.5 rounded">{`{nombre}`}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded">{`{resumen_ofertas}`}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded">{`{tasa_bcv}`}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded">{`{cantidad_ofertas}`}</span>
                  </div>
                </div>

                {/* Customer WhatsApp Dispatch List */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Directorio de Clientes ({targetCustomersList.length})</span>
                    <span className="text-[11px] text-slate-500 font-normal">Envío directo en 1 clic</span>
                  </h3>

                  <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                    {targetCustomersList.map((customer, idx) => (
                      <div
                        key={customer.id}
                        className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 truncate">{customer.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">({customer.rif})</span>
                          </div>
                          <p className="text-[11px] text-emerald-700 font-mono font-semibold flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            {customer.phone || 'Sin teléfono'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyWaMessage(customer.name, idx)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition cursor-pointer"
                            title="Copiar texto de mensaje"
                          >
                            {waCopiedIndex === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsAppLink(customer.phone, customer.name)}
                            disabled={!customer.phone}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SLOW MOVING INVENTORY (30, 60, 90 DAYS) */}
      {activeTab === 'slow_moving' && (
        <div className="space-y-6">
          {/* Period Selector Tabs */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Auditoría de Rotación y Productos Estancados
              </h2>
              <p className="text-xs text-slate-500">
                Consulta productos sin ventas o de muy baja rotación en periodos de 30, 60 y 90 días para aplicar promociones o liquidaciones.
              </p>
            </div>

            {/* 30, 60, 90 Days Pill Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setSlowPeriod(30)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  slowPeriod === 30
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                Últimos 30 Días
              </button>
              <button
                type="button"
                onClick={() => setSlowPeriod(60)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  slowPeriod === 60
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                Últimos 60 Días
              </button>
              <button
                type="button"
                onClick={() => setSlowPeriod(90)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  slowPeriod === 90
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                Últimos 90 Días
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-rose-700 font-semibold">Sin Movimiento ({slowPeriod}d)</span>
                <p className="text-xl font-black text-rose-900">{slowMovingStats.zeroCount} productos</p>
                <p className="text-[10px] text-rose-600 font-mono">0 unidades vendidas</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-amber-800 font-semibold">Poco Movimiento ({slowPeriod}d)</span>
                <p className="text-xl font-black text-amber-900">{slowMovingStats.lowCount} productos</p>
                <p className="text-[10px] text-amber-700 font-mono">≤ 5 unidades vendidas</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Capital Inmovilizado</span>
                <p className="text-xl font-black text-slate-900 font-mono">
                  {formatUSD(slowMovingStats.zeroImmobilizedUSD)}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {formatBs(slowMovingStats.zeroImmobilizedUSD * settings.bcvRate)}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">Total Productos Analizados</span>
                <p className="text-xl font-black text-slate-900">{slowMovingStats.totalCount} ítems</p>
                <p className="text-[10px] text-emerald-600">Catálogo general</p>
              </div>
            </div>
          </div>

          {/* Table Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={slowSearchQuery}
                onChange={(e) => setSlowSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={slowStatusFilter}
                onChange={(e) => setSlowStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="all">Todos los Estados</option>
                <option value="sin_movimiento">Solo Sin Movimiento (0 ventas)</option>
                <option value="poco_movimiento">Solo Poco Movimiento (≤ 5 ventas)</option>
              </select>

              <select
                value={slowCategoryFilter}
                onChange={(e) => setSlowCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="all">Todas las Categorías</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Slow Moving Products Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Producto & Código</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-center">Stock Actual</th>
                    <th className="py-3 px-4 text-center">Unid. Vendidas ({slowPeriod}d)</th>
                    <th className="py-3 px-4 text-center">Fecha Última Venta</th>
                    <th className="py-3 px-4 text-right">Capital Inmovilizado</th>
                    <th className="py-3 px-4 text-center">Estado de Rotación</th>
                    <th className="py-3 px-4 text-center">Acción Comercial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSlowMoving.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No se encontraron productos para los criterios seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredSlowMoving.map((item) => {
                      const prodObj = products.find((p) => p.id === item.productId);

                      return (
                        <tr key={item.productId} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{item.productName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{item.productCode}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                            {item.stock}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                                item.unitsSold === 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : item.unitsSold <= 5
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {item.unitsSold} un.
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.lastSaleDate ? (
                              <div>
                                <span className="font-medium text-slate-700">
                                  {new Date(item.lastSaleDate).toLocaleDateString('es-VE')}
                                </span>
                                {item.daysSinceLastSale !== null && (
                                  <span className="text-[10px] text-slate-400 block">
                                    Hace {item.daysSinceLastSale} días
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-rose-500 font-medium">Sin ventas registradas</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-bold font-mono text-slate-900 block">
                              {formatUSD(item.totalValueUSD)}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {formatBs(item.totalValueUSD * settings.bcvRate)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.status === 'sin_movimiento' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                Sin Movimiento
                              </span>
                            ) : item.status === 'poco_movimiento' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                                <TrendingDown className="w-3 h-3 text-amber-600" />
                                Poco Movimiento
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Rotación Normal
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {prodObj?.isOffer ? (
                              <button
                                type="button"
                                onClick={() => handleOpenPromoModal(prodObj)}
                                className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                              >
                                <Flame className="w-3 h-3 text-amber-600" />
                                Oferta Activa (-{prodObj.discountPercentage}%)
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (prodObj) {
                                    handleOpenPromoModal(prodObj);
                                    setOfferCondition('Liquidación de stock por baja rotación');
                                    setOfferBadgeText('OFERTA LIQUIDACIÓN');
                                    setDiscountPercent(20);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Crear Oferta
                              </button>
                            )}
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

      {/* MODAL: CREATE / EDIT PROMOTION */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingProduct ? 'Editar Oferta & Promoción' : 'Crear Nueva Promoción de Producto'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configura el descuento, el ahorro en USD/Bs y la condición libre editable.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromotion} className="space-y-4">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Seleccionar Producto</label>
                <select
                  value={selectedProductId}
                  disabled={!!editingProduct}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-medium"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Reg: {formatUSD(p.priceUSD)} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount and Badge row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Porcentaje de Descuento (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
                      className="w-full pl-3 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-mono font-bold"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Texto del Badge / Rótulo</label>
                  <input
                    type="text"
                    value={offerBadgeText}
                    onChange={(e) => setOfferBadgeText(e.target.value)}
                    placeholder="ej: MAYORISTA, COMBO, FLASH"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-bold text-rose-700 uppercase"
                  />
                </div>
              </div>

              {/* Condition (Editable free text with quick chip selection) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Condición de la Oferta (Texto Libre Editable)
                </label>
                <input
                  type="text"
                  value={offerCondition}
                  onChange={(e) => setOfferCondition(e.target.value)}
                  placeholder="ej: Después de 6 artículos, A partir de 12 unidades, etc."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-medium text-slate-900"
                  required
                />

                {/* Quick Presets selector */}
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">Sugerencias rápidas de condición:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {conditionPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setOfferCondition(preset.label)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition cursor-pointer border ${
                          offerCondition === preset.label
                            ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-Time Savings Summary Card */}
              {targetModalProduct && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Precio Regular Original:</span>
                    <span className="font-mono text-slate-600 line-through">
                      {formatUSD(targetModalProduct.priceUSD)} ({formatBs(targetModalProduct.priceUSD * settings.bcvRate)})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-rose-700">Precio de Oferta ({discountPercent}% OFF):</span>
                    <span className="font-mono text-rose-700 text-sm">
                      {formatUSD(modalCalculations.promoPriceUSD)} ({formatBs(modalCalculations.promoPriceBs)})
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-emerald-800 bg-emerald-50/80 p-2 rounded-lg">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                      Ahorro del Cliente por unidad:
                    </span>
                    <span className="font-mono text-emerald-700">
                      +{formatUSD(modalCalculations.savingsUSD)} ({formatBs(modalCalculations.savingsBs)})
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md hover:shadow-rose-600/25 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Guardar & Publicar Oferta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
