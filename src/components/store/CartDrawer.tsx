import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShoppingCart, X, Trash2, Plus, Minus, ArrowRight, ShieldCheck } from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';
import { formatUSD, formatBs } from '../../utils/formatUtils';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    settings,
    setIsOrdersModalOpen,
  } = useApp();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  if (!isCartOpen) return null;

  const subtotalUSD = cart.reduce((sum, item) => {
    const price = item.product.isOffer && item.product.discountPercentage
      ? item.product.priceUSD * (1 - item.product.discountPercentage / 100)
      : item.product.priceUSD;
    return sum + price * item.quantity;
  }, 0);

  const taxUSD = subtotalUSD * (settings.ivaPercentage / 100);
  const totalUSD = subtotalUSD + taxUSD;
  const totalBs = totalUSD * settings.bcvRate;

  const handleCheckoutSuccess = () => {
    setIsCartOpen(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div
          onClick={() => setIsCartOpen(false)}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
            
            {/* Drawer Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Carrito de Compras</h3>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <p className="font-semibold text-slate-700 text-base">Tu carrito está vacío</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Explora nuestro catálogo y agrega productos para realizar tu pedido o compra rápida.
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Ver Catálogo
                  </button>
                </div>
              ) : (
                cart.map((item) => {
                  const effectivePriceUSD = item.product.isOffer && item.product.discountPercentage
                    ? item.product.priceUSD * (1 - item.product.discountPercentage / 100)
                    : item.product.priceUSD;

                  const lineTotalUSD = effectivePriceUSD * item.quantity;
                  const lineTotalBs = lineTotalUSD * settings.bcvRate;

                  return (
                    <div key={item.product.id} className="py-3 flex gap-3 items-center">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-slate-900 truncate">
                          {item.product.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {formatUSD(effectivePriceUSD)} USD c/u
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs font-bold text-blue-700 font-mono">
                            {formatUSD(lineTotalUSD)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({formatBs(lineTotalBs)})
                          </span>
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold font-mono text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary */}
            {cart.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-medium">{formatUSD(subtotalUSD)} USD</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA ({settings.ivaPercentage}%):</span>
                    <span className="font-mono font-medium">{formatUSD(taxUSD)} USD</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
                    <span>Total Estimado (USD):</span>
                    <span className="font-mono text-blue-700">{formatUSD(totalUSD)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold text-sm bg-emerald-50 px-2 py-1 rounded">
                    <span>Total Estimado (Bs):</span>
                    <span className="font-mono">
                      {formatBs(totalBs)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={clearCart}
                    className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
                  >
                    Vaciar
                  </button>
                  <button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Proceder al Pago</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={handleCheckoutSuccess}
      />
    </>
  );
};
