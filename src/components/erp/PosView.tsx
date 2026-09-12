import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, PaymentMethod } from '../../types';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  Building2,
  Smartphone,
  Printer,
  CheckCircle,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

export const PosView: React.FC = () => {
  const {
    products,
    customers,
    settings,
    createOrder,
    setSelectedInvoiceForModal,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [ticketItems, setTicketItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo_usd');
  const [customCreditDays, setCustomCreditDays] = useState<number>(15);
  const [cashTenderedUSD, setCashTenderedUSD] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  const categories = useMemo(() => {
    const cats = ['Todos'];
    products.forEach((p) => {
      if (!cats.includes(p.category)) cats.push(p.category);
    });
    return cats;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const addToTicket = (product: Product) => {
    if (product.stock <= 0) {
      alert('Producto agotado.');
      return;
    }

    setTicketItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Stock insuficiente (${product.stock} disponibles).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateTicketQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setTicketItems((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (product && quantity > product.stock) {
      alert(`Stock máximo disponible: ${product.stock}`);
      return;
    }
    setTicketItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearTicket = () => {
    setTicketItems([]);
    setCashTenderedUSD('');
    setPaymentReference('');
  };

  // Ticket totals
  const subtotalUSD = ticketItems.reduce((sum, item) => sum + item.product.priceUSD * item.quantity, 0);
  const taxUSD = subtotalUSD * (settings.ivaPercentage / 100);
  const totalUSD = subtotalUSD + taxUSD;
  const totalBs = totalUSD * settings.bcvRate;

  // Change calculation
  const tendered = parseFloat(cashTenderedUSD) || 0;
  const changeUSD = Math.max(0, tendered - totalUSD);
  const changeBs = changeUSD * settings.bcvRate;

  // Credit eligibility
  const creditAvailableUSD = selectedCustomer
    ? Math.max(0, selectedCustomer.creditLimitUSD - selectedCustomer.currentDebtUSD)
    : 0;

  const canUseCredit = Boolean(
    selectedCustomer &&
    selectedCustomer.hasCredit &&
    creditAvailableUSD >= totalUSD
  );

  const handleChargeSale = () => {
    if (ticketItems.length === 0) return;

    if (paymentMethod === 'credito' && !canUseCredit) {
      alert('El cliente no posee suficiente cupo de crédito para esta venta.');
      return;
    }

    setIsProcessing(true);

    try {
      const { invoice } = createOrder({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerRif: selectedCustomer.rif,
        customerPhone: selectedCustomer.phone,
        customerAddress: selectedCustomer.address,
        items: ticketItems,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        channel: 'pos',
        customCreditDays: paymentMethod === 'credito' ? customCreditDays : undefined,
        notes: `Venta directa por caja POS. Atendido en mostrador.`,
      });

      setSelectedInvoiceForModal(invoice);
      clearTicket();
    } catch (err) {
      console.error(err);
      alert('Error al registrar la venta.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Product catalog and search (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* POS Header Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escanear código o escribir producto..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const priceBs = p.priceUSD * settings.bcvRate;
              const isOut = p.stock <= 0;

              return (
                <button
                  key={p.id}
                  onClick={() => !isOut && addToTicket(p)}
                  disabled={isOut}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition group relative ${
                    isOut
                      ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-indigo-500 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div>
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-100 mb-2">
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-600 font-semibold">{p.code}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          p.stock <= p.minStock ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        Stock: {p.stock}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 mt-1 leading-snug">
                      {p.name}
                    </h4>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-sm font-extrabold text-indigo-700 font-mono">
                      ${p.priceUSD.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-700 font-semibold">
                      {priceBs.toFixed(0)} Bs
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Active POS Ticket & Payment (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-md p-5 flex flex-col justify-between space-y-4">
          
          <div>
            {/* Ticket Header & Customer Selector */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Ticket de Venta Caja</h3>
              </div>
              <button
                onClick={clearTicket}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium"
              >
                Limpiar
              </button>
            </div>

            {/* Customer selector with Credit info */}
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                <span>Cliente Receptor de Factura:</span>
                <span className="text-[10px] font-mono text-slate-400">RIF: {selectedCustomer?.rif}</span>
              </label>

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.hasCredit ? `[Crédito: ${c.creditDays}d - Límite: $${c.creditLimitUSD}]` : '[Contado]'}
                  </option>
                ))}
              </select>

              {selectedCustomer?.hasCredit && (
                <div className="mt-2 text-[11px] text-emerald-700 font-medium flex items-center justify-between">
                  <span>Plazo de Crédito: {selectedCustomer.creditDays} días</span>
                  <span>Cupo disponible: ${creditAvailableUSD.toFixed(2)} USD</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mt-3 max-h-52 overflow-y-auto divide-y divide-slate-100 pr-1">
              {ticketItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Haga clic en los productos para agregarlos al ticket.
                </div>
              ) : (
                ticketItems.map((item) => (
                  <div key={item.product.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{item.product.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        ${item.product.priceUSD.toFixed(2)} x {item.quantity} = ${(item.product.priceUSD * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateTicketQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateTicketQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => updateTicketQuantity(item.product.id, 0)}
                        className="p-1 text-slate-400 hover:text-rose-600 ml-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals & Payment Checkout */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            {/* Totals Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Base Imponible:</span>
                <span className="font-mono font-medium">${subtotalUSD.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IVA ({settings.ivaPercentage}%):</span>
                <span className="font-mono font-medium">${taxUSD.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-slate-200">
                <span>Total Factura:</span>
                <span className="font-mono text-indigo-700">${totalUSD.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between font-bold text-sm bg-emerald-50 text-emerald-800 p-2 rounded-lg">
                <span>Total en Bolívares (BCV):</span>
                <span className="font-mono">
                  {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Método de Cobro en Mostrador:
              </label>

              <div className="grid grid-cols-4 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo_usd')}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                    paymentMethod === 'efectivo_usd'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold ring-1 ring-indigo-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mx-auto mb-0.5 text-emerald-600" />
                  <span className="text-[11px]">Efectivo $</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('pago_movil')}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                    paymentMethod === 'pago_movil'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold ring-1 ring-indigo-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-0.5 text-blue-600" />
                  <span className="text-[11px]">P. Móvil</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('transferencia_bs')}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                    paymentMethod === 'transferencia_bs'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-bold ring-1 ring-indigo-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-4 h-4 mx-auto mb-0.5 text-indigo-600" />
                  <span className="text-[11px]">Punto/Trans</span>
                </button>

                <button
                  type="button"
                  disabled={!canUseCredit}
                  onClick={() => setPaymentMethod('credito')}
                  className={`p-2 rounded-lg border text-center transition ${
                    !canUseCredit
                      ? 'opacity-40 bg-slate-100 cursor-not-allowed border-slate-200 text-slate-400'
                      : paymentMethod === 'credito'
                      ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold ring-1 ring-amber-500 cursor-pointer'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                  }`}
                  title={!canUseCredit ? 'Cliente sin línea de crédito activa o cupo excedido' : 'Venta a crédito'}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-0.5 text-amber-600" />
                  <span className="text-[11px]">A Crédito</span>
                </button>
              </div>
            </div>

            {/* If Cash, calculate change */}
            {paymentMethod === 'efectivo_usd' && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Monto recibido (USD):</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="0.00"
                    value={cashTenderedUSD}
                    onChange={(e) => setCashTenderedUSD(e.target.value)}
                    className="w-24 px-2 py-1 border border-slate-300 rounded font-mono text-right font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {tendered >= totalUSD && (
                  <div className="flex justify-between items-center text-xs font-bold text-emerald-800 pt-1 border-t border-slate-200">
                    <span>Cambio / Vuelto a entregar:</span>
                    <span className="font-mono text-sm">
                      ${changeUSD.toFixed(2)} ({changeBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* If Credit, choose credit days */}
            {paymentMethod === 'credito' && (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-2 text-amber-900">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Días de Crédito Otorgados:</span>
                  <select
                    value={customCreditDays}
                    onChange={(e) => setCustomCreditDays(Number(e.target.value))}
                    className="px-2 py-1 border border-amber-300 rounded bg-white font-bold"
                  >
                    <option value={7}>7 Días</option>
                    <option value={15}>15 Días</option>
                    <option value={21}>21 Días</option>
                    <option value={30}>30 Días</option>
                    <option value={45}>45 Días</option>
                  </select>
                </div>
                <p className="text-[11px] text-amber-800">
                  Esta venta se registrará automáticamente en <strong>Cuentas por Cobrar (CxC)</strong> con su vencimiento correspondiente.
                </p>
              </div>
            )}

            {/* Reference input for cards / pago movil */}
            {(paymentMethod === 'pago_movil' || paymentMethod === 'transferencia_bs') && (
              <div>
                <input
                  type="text"
                  placeholder="Referencia de pago / Lote de punto..."
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            )}

            {/* Charge Button */}
            <button
              onClick={handleChargeSale}
              disabled={ticketItems.length === 0 || isProcessing}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{isProcessing ? 'Registrando Venta...' : 'Completar Venta & Emitir Factura'}</span>
            </button>

          </div>

        </div>

      </div>
    </div>
  );
};
