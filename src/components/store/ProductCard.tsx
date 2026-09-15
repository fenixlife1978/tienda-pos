import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { ShoppingCart, Plus, Minus, Check, Flame, Scale, Wine, Layers } from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, settings, triggerPushNotification, setPresentationModalProduct } = useApp();
  const [qty, setQty] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);

  const hasSpecialSalesMode = Boolean(
    (product.presentations && product.presentations.length > 0) ||
    product.isWeighable ||
    product.isFractionable
  );

  const effectivePriceUSD = product.isOffer && product.discountPercentage
    ? product.priceUSD * (1 - product.discountPercentage / 100)
    : product.priceUSD;

  const effectivePriceBs = effectivePriceUSD * settings.bcvRate;
  const isLowStock = product.stock > 0 && product.stock <= product.minStock;
  const isOutOfStock = product.stock <= 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;

    if (hasSpecialSalesMode) {
      setPresentationModalProduct(product);
      return;
    }

    addToCart(product, qty);
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1200);

    triggerPushNotification({
      title: 'Producto agregado al carrito',
      message: `${qty}x ${product.name} añadido correctamente.`,
      type: 'order_status',
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 p-3 flex flex-col justify-between group">
      {/* Product Image */}
      <div>
        <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-slate-100 mb-2.5">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            loading="lazy"
          />

          {/* Offer discount tag if on promotion */}
          {product.isOffer && product.discountPercentage && (
            <span className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-300" />
              -{product.discountPercentage}%
            </span>
          )}
        </div>

        {/* SKU code and Stock pill */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-[11px] text-slate-500 font-mono tracking-tight truncate">
            {product.code}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
              isOutOfStock
                ? 'bg-rose-100 text-rose-700'
                : isLowStock
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {isOutOfStock ? 'Agotado' : `Stock: ${product.stock}`}
          </span>
        </div>

        {/* Special sales badges (Peso, Fraccionado libre, Presentaciones) */}
        {hasSpecialSalesMode && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {product.isWeighable && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                <Scale className="w-2.5 h-2.5 text-amber-600" />
                Venta al peso
              </span>
            )}
            {product.isFractionable && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                <Wine className="w-2.5 h-2.5 text-blue-600" />
                Monto libre Bs
              </span>
            )}
            {product.presentations && product.presentations.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold">
                <Layers className="w-2.5 h-2.5 text-purple-600" />
                {product.presentations.length} Presentaciones
              </span>
            )}
          </div>
        )}

        {/* Product Title (Exactly matching the screenshot format) */}
        <h3
          onClick={() => hasSpecialSalesMode && setPresentationModalProduct(product)}
          className={`font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.25rem] ${
            hasSpecialSalesMode ? 'cursor-pointer hover:text-blue-600' : ''
          }`}
        >
          {product.name}
        </h3>
      </div>

      {/* Pricing & Add to cart Controls */}
      <div className="mt-3 pt-2 border-t border-slate-100 space-y-2">
        {/* Price Row: USD on left (bold blue), Bs on right (gray) */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold text-blue-700 font-mono">
              {formatUSD(effectivePriceUSD)}
            </span>
            {product.isWeighable && (
              <span className="text-[10px] text-amber-700 font-semibold">/kg</span>
            )}
            {product.isOffer && (
              <span className="text-[10px] line-through text-slate-400 font-mono">
                {formatUSD(product.priceUSD)}
              </span>
            )}
          </div>
          <span className="text-xs sm:text-sm font-medium text-slate-500 font-mono">
            {formatBs(effectivePriceBs)}
          </span>
        </div>

        {/* Add to Cart Stepper & Button or Presentation Picker Button */}
        {hasSpecialSalesMode ? (
          <button
            type="button"
            onClick={() => setPresentationModalProduct(product)}
            disabled={isOutOfStock}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : product.isWeighable
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : product.isFractionable
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isOutOfStock ? (
              'Agotado'
            ) : product.isWeighable ? (
              <>
                <Scale className="w-3.5 h-3.5" /> Pesar y Agregar
              </>
            ) : product.isFractionable ? (
              <>
                <Wine className="w-3.5 h-3.5" /> Comprar por Monto Bs
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5" /> Elegir Presentación
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQty((q) => Math.max(1, q - 1));
                }}
                disabled={isOutOfStock || qty <= 1}
                className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-1.5 text-xs font-bold font-mono text-slate-800">{qty}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQty((q) => Math.min(product.stock, q + 1));
                }}
                disabled={isOutOfStock || qty >= product.stock}
                className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={isOutOfStock}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs ${
                addedAnimation
                  ? 'bg-emerald-600 text-white'
                  : isOutOfStock
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {addedAnimation ? (
                <>
                  <Check className="w-3 h-3" /> ¡Listo!
                </>
              ) : isOutOfStock ? (
                'Agotado'
              ) : (
                <>
                  <ShoppingCart className="w-3 h-3" /> Agregar
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
