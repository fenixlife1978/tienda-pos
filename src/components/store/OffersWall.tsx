import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import {
  Sparkles,
  Flame,
  Tag,
  ShoppingCart,
  Check,
  Percent,
  Clock,
  ArrowRight,
  TrendingDown,
  ShieldCheck,
  ChevronRight,
  Plus,
  Minus,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

export const OffersWall: React.FC = () => {
  const { products, settings, addToCart, triggerPushNotification, lastStockUpdateEvent } = useApp();
  const [addedProductIds, setAddedProductIds] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Filter products on offer
  const offerProducts = useMemo(() => {
    return products.filter((p) => Boolean(p.isOffer && p.discountPercentage && p.discountPercentage > 0));
  }, [products]);

  const categories = useMemo(() => {
    const cats = ['Todos'];
    offerProducts.forEach((p) => {
      if (!cats.includes(p.category)) {
        cats.push(p.category);
      }
    });
    return cats;
  }, [offerProducts]);

  const filteredOffers = useMemo(() => {
    if (selectedCategory === 'Todos') return offerProducts;
    return offerProducts.filter((p) => p.category === selectedCategory);
  }, [offerProducts, selectedCategory]);

  const handleAddToCart = (product: Product) => {
    const qty = quantities[product.id] || 1;
    addToCart(product, qty);

    setAddedProductIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedProductIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1500);

    triggerPushNotification({
      title: '¡Oferta añadida al carrito!',
      message: `Agregaste ${qty}x ${product.name} con ${product.discountPercentage}% de descuento.`,
      type: 'promotion',
      badge: 'Descuento',
    });
  };

  const handleUpdateQty = (productId: string, delta: number, maxStock: number) => {
    const current = quantities[productId] || 1;
    const next = Math.max(1, Math.min(maxStock, current + delta));
    setQuantities((prev) => ({ ...prev, [productId]: next }));
  };

  return (
    <div className="space-y-6">
      {/* Banner Hero of Offers Wall */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-rose-700 text-white p-6 sm:p-8 shadow-md border border-rose-500">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-extrabold uppercase tracking-wider text-rose-100">
              <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
              Muro Exclusivo de Promociones
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ofertas Flash & Precios de Oportunidad
            </h2>
            <p className="text-xs sm:text-sm text-rose-100 leading-relaxed">
              Descuentos especiales con conversión en tiempo real a tasa oficial BCV ({settings.bcvRate.toFixed(2)} Bs/$). ¡Precios mayoristas y al detal por tiempo y unidades limitadas!
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shrink-0 flex items-center gap-4 text-center">
            <div className="px-3">
              <span className="block text-2xl font-black text-amber-300">{offerProducts.length}</span>
              <span className="text-[11px] font-semibold text-rose-100">Ofertas Activas</span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="px-3">
              <span className="block text-2xl font-black text-white">Hasta -30%</span>
              <span className="text-[11px] font-semibold text-rose-100">Ahorro Máximo</span>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Category Pills inside Offers Wall */}
      {categories.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Offers Grid - In pairs of 2 as requested */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredOffers.map((product) => {
          const discount = product.discountPercentage || 0;
          const discountedPriceUSD = product.priceUSD * (1 - discount / 100);
          const discountedPriceBs = discountedPriceUSD * settings.bcvRate;
          const originalPriceBs = product.priceUSD * settings.bcvRate;
          const savingsUSD = product.priceUSD - discountedPriceUSD;
          const savingsBs = savingsUSD * settings.bcvRate;
          const qty = quantities[product.id] || 1;
          const isAdded = Boolean(addedProductIds[product.id]);
          const isOutOfStock = product.stock <= 0;
          const isRecentlyUpdated = Boolean(
            lastStockUpdateEvent &&
              lastStockUpdateEvent.productIds.includes(product.id) &&
              Date.now() - lastStockUpdateEvent.timestamp < 7000
          );
          const safeQty = Math.max(1, Math.min(product.stock > 0 ? product.stock : 1, qty));

          return (
            <div
              key={product.id}
              className={`bg-white rounded-2xl border-2 transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                isRecentlyUpdated
                  ? 'border-emerald-500 ring-2 ring-emerald-200 shadow-md animate-pulse'
                  : 'border-rose-100 hover:border-rose-300 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Top part: Image, badge, tags */}
              <div>
                <div className="relative aspect-16/10 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />

                  {/* Mega discount badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-300" />
                      -{discount}% OFF
                    </span>
                  </div>

                  {/* Real-time stock countdown pill */}
                  <div className="absolute top-2.5 right-2.5 bg-slate-900/85 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                    {!isOutOfStock ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    ) : (
                      <Clock className="w-3 h-3 text-rose-400" />
                    )}
                    <span>{isOutOfStock ? 'Agotado' : `Quedan ${product.stock} ${product.unit}`}</span>
                  </div>

                  {/* Real-time live update badge */}
                  {isRecentlyUpdated && (
                    <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      Stock en tiempo real
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="uppercase font-bold tracking-wider text-rose-600">{product.category}</span>
                    <span className="font-mono">SKU: {product.code}</span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                    {product.name}
                  </h3>

                  {product.description && (
                    <p className="text-xs text-slate-600 line-clamp-1">
                      {product.description}
                    </p>
                  )}

                  {/* Savings callout badge */}
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-between text-[11px]">
                    <span className="text-amber-900 font-semibold flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                      ¡Tu Ahorro por unidad!
                    </span>
                    <span className="font-bold text-emerald-700 font-mono">
                      +{formatUSD(savingsUSD)} ({formatBs(savingsBs)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom part: Pricing and Add to cart */}
              <div className="p-4 pt-0 space-y-3">
                <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-blue-700 font-mono">
                        {formatUSD(discountedPriceUSD)}
                      </span>
                      <span className="text-xs line-through text-slate-400 font-mono">
                        {formatUSD(product.priceUSD)}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 text-xs text-slate-600 font-mono font-medium">
                      <span>{formatBs(discountedPriceBs)}</span>
                      <span className="text-[10px] line-through text-slate-400">
                        {formatBs(originalPriceBs)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quantity and CTA Button */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(product.id, -1, product.stock)}
                      disabled={isOutOfStock || safeQty <= 1}
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 text-xs font-bold font-mono text-slate-900">{safeQty}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(product.id, 1, product.stock)}
                      disabled={isOutOfStock || safeQty >= product.stock}
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    disabled={isOutOfStock}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                      isAdded
                        ? 'bg-emerald-600 text-white'
                        : isOutOfStock
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-4 h-4" /> ¡En el carrito!
                      </>
                    ) : isOutOfStock ? (
                      'Agotado'
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" /> ¡Aprovechar Oferta!
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
