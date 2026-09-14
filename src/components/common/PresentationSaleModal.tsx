import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, ProductPresentation } from '../../types';
import {
  Scale,
  Wine,
  Package,
  Check,
  Plus,
  Minus,
  DollarSign,
  TrendingUp,
  X,
  Layers,
  Sparkles,
  ShoppingBag,
  Info,
} from 'lucide-react';

export const PresentationSaleModal: React.FC = () => {
  const {
    presentationModalProduct: product,
    setPresentationModalProduct,
    addToCartWithPresentation,
    presentationCallback,
    settings,
  } = useApp();

  // Mode: 'presentations' | 'weight' | 'fractional'
  const [activeMode, setActiveMode] = useState<'presentations' | 'weight' | 'fractional'>('presentations');

  // Presentation selection state
  const [selectedPresentation, setSelectedPresentation] = useState<ProductPresentation | null>(null);
  const [presQuantity, setPresQuantity] = useState<number>(1);

  // Weight mode state (e.g. Cheese, Meats)
  const [weightKgInput, setWeightKgInput] = useState<string>('0.350');
  const [weightUnitMode, setWeightUnitMode] = useState<'kg' | 'g'>('kg');

  // Fractional mode state (e.g. Liquor by Bs. amount)
  const [amountBsInput, setAmountBsInput] = useState<string>('150');
  const [amountCurrency, setAmountCurrency] = useState<'bs' | 'usd'>('bs');

  // Initialize modes when product changes
  useEffect(() => {
    if (product) {
      if (product.isWeighable && (!product.presentations || product.presentations.length === 0)) {
        setActiveMode('weight');
      } else if (product.isFractionable && (!product.presentations || product.presentations.length === 0)) {
        setActiveMode('fractional');
      } else {
        setActiveMode('presentations');
      }

      if (product.presentations && product.presentations.length > 0) {
        setSelectedPresentation(product.presentations[0]);
      } else {
        setSelectedPresentation(null);
      }
      setPresQuantity(1);
      setWeightKgInput('0.350');
      setAmountBsInput('150');
    }
  }, [product]);

  if (!product) return null;

  const bcvRate = settings.bcvRate;

  // Weight calculations (Cheese, Cold cuts)
  const parsedWeightKg = parseFloat(weightKgInput) || 0;
  const effectiveWeightKg = weightUnitMode === 'g' ? parsedWeightKg / 1000 : parsedWeightKg;
  const pricePerKgUSD = product.pricePerKgUSD || product.priceUSD;
  const pricePerKgBs = pricePerKgUSD * bcvRate;
  const weightTotalUSD = effectiveWeightKg * pricePerKgUSD;
  const weightTotalBs = weightTotalUSD * bcvRate;

  // Fractional calculations (Liquor, bulk)
  const referencePriceUSD = product.priceUSD; // Price per full unit/liter
  const referencePriceBs = referencePriceUSD * bcvRate;
  const parsedAmount = parseFloat(amountBsInput) || 0;

  let fractionalAmountUSD = 0;
  let fractionalAmountBs = 0;
  let quantityToDispatch = 0; // In product.unit (e.g. liters)

  if (amountCurrency === 'bs') {
    fractionalAmountBs = parsedAmount;
    fractionalAmountUSD = bcvRate > 0 ? parsedAmount / bcvRate : 0;
  } else {
    fractionalAmountUSD = parsedAmount;
    fractionalAmountBs = parsedAmount * bcvRate;
  }

  if (referencePriceUSD > 0) {
    quantityToDispatch = fractionalAmountUSD / referencePriceUSD;
  }

  // Handlers
  const handleAddPresentation = () => {
    const isStandard = !selectedPresentation;
    const unitPriceUSD = isStandard ? product.priceUSD : selectedPresentation.priceUSD;
    const saleMode = isStandard ? 'standard' : 'presentation';

    if (presentationCallback) {
      presentationCallback({
        product,
        presentation: selectedPresentation || undefined,
        quantity: presQuantity,
        saleMode,
        unitPriceUSD,
      });
    } else {
      if (isStandard) {
        addToCartWithPresentation(product, {
          quantity: presQuantity,
          saleMode: 'standard',
          unitPriceUSD: product.priceUSD,
        });
      } else {
        addToCartWithPresentation(product, {
          presentation: selectedPresentation,
          quantity: presQuantity,
          saleMode: 'presentation',
          unitPriceUSD: selectedPresentation.priceUSD,
        });
      }
    }
    setPresentationModalProduct(null);
  };

  const handleAddWeight = () => {
    if (effectiveWeightKg <= 0) {
      alert('Por favor ingrese un peso válido mayor a 0.');
      return;
    }

    const weightKg = Number(effectiveWeightKg.toFixed(3));
    const unitPriceUSD = Number(weightTotalUSD.toFixed(2));
    const note = `Pesaje Balanza: ${effectiveWeightKg.toFixed(3)} Kg (${Math.round(effectiveWeightKg * 1000)}g) @ $${pricePerKgUSD.toFixed(2)}/Kg`;

    if (presentationCallback) {
      presentationCallback({
        product,
        quantity: 1,
        saleMode: 'weight',
        weightKg,
        unitPriceUSD,
        customNote: note,
      });
    } else {
      addToCartWithPresentation(product, {
        saleMode: 'weight',
        weightKg,
        unitPriceUSD,
        customNote: note,
      });
    }
    setPresentationModalProduct(null);
  };

  const handleAddFractional = () => {
    if (fractionalAmountUSD <= 0) {
      alert('Por favor ingrese un monto válido a despachar.');
      return;
    }

    const unitName = product.fractionUnit || product.unit || 'Litro';
    const volumeMl = Math.round(quantityToDispatch * 1000);
    const dispatchDescription =
      unitName.toLowerCase().includes('litro') || unitName.toLowerCase().includes('l')
        ? `${(quantityToDispatch).toFixed(3)} L (${volumeMl} ml)`
        : `${(quantityToDispatch).toFixed(3)} ${unitName}`;

    const amountBs = Number(fractionalAmountBs.toFixed(2));
    const amountUSD = Number(fractionalAmountUSD.toFixed(2));
    const qty = Number(quantityToDispatch.toFixed(3));
    const note = `Despacho por Monto: ${fractionalAmountBs.toFixed(2)} Bs. ($${fractionalAmountUSD.toFixed(2)} USD) -> Cantidad: ${dispatchDescription}`;

    if (presentationCallback) {
      presentationCallback({
        product,
        quantity: qty,
        saleMode: 'custom_amount',
        customAmountBs: amountBs,
        customAmountUSD: amountUSD,
        unitPriceUSD: amountUSD,
        customNote: note,
      });
    } else {
      addToCartWithPresentation(product, {
        saleMode: 'custom_amount',
        customAmountBs: amountBs,
        customAmountUSD: amountUSD,
        unitPriceUSD: amountUSD,
        quantity: qty,
        customNote: note,
      });
    }
    setPresentationModalProduct(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header with Product Information */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={product.image}
              alt={product.name}
              className="w-12 h-12 rounded-xl object-cover bg-white p-0.5 border border-white/20 shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight line-clamp-1">
                  {product.name}
                </h3>
              </div>
              <p className="text-xs text-indigo-200 flex items-center gap-2 mt-0.5">
                <span>SKU: {product.code}</span>
                <span>•</span>
                <span>{product.category}</span>
                <span>•</span>
                <span className="font-mono text-emerald-300 font-bold">
                  BCV: {bcvRate.toFixed(2)} Bs.
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPresentationModalProduct(null)}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (Presentaciones, Peso/Balanza, Monto Libre) */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 pt-2">
          {/* Option 1: Standard / Packaging Presentations */}
          <button
            type="button"
            onClick={() => setActiveMode('presentations')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeMode === 'presentations'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Presentaciones ({product.presentations?.length || 1})</span>
          </button>

          {/* Option 2: Weighable / Balanza (Queso, Jamón, Carnicería) */}
          {(product.isWeighable || product.unit.toLowerCase().includes('kg') || product.presentations?.some(p => p.saleType === 'weight')) && (
            <button
              type="button"
              onClick={() => setActiveMode('weight')}
              className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeMode === 'weight'
                  ? 'border-amber-600 text-amber-800 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-amber-700 hover:text-amber-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-amber-600" />
              <span>Venta por Peso / Balanza (Queso)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-100 text-amber-800 font-extrabold">
                Balanza
              </span>
            </button>
          )}

          {/* Option 3: Fractional Amount in Bs. (Licor al Gusto, Granel) */}
          {(product.isFractionable || product.presentations?.some(p => p.saleType === 'fractional_amount')) && (
            <button
              type="button"
              onClick={() => setActiveMode('fractional')}
              className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeMode === 'fractional'
                  ? 'border-purple-600 text-purple-800 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-purple-700 hover:text-purple-900'
              }`}
            >
              <Wine className="w-3.5 h-3.5 text-purple-600" />
              <span>Monto Libre en Bs. (Licor)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-100 text-purple-800 font-extrabold">
                Fraccionado
              </span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          
          {/* ======================================================== */}
          {/* TAB 1: PRESENTACIONES (BULTO, CAJA, SIXPACK, UNIDAD)   */}
          {/* ======================================================== */}
          {activeMode === 'presentations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Seleccione la presentación deseada:</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  Existencia base: {product.stock} {product.unit}
                </span>
              </div>

              {/* Grid of Available Presentations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Base Unit Option */}
                <div
                  onClick={() => setSelectedPresentation(null)}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    selectedPresentation === null
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-extrabold text-slate-900 text-xs">
                          {product.unit} Individual (Base)
                        </h4>
                        {selectedPresentation === null && (
                          <span className="p-0.5 bg-indigo-600 text-white rounded-full">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Factor: 1 unidad base</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="font-mono font-extrabold text-sm text-slate-900">
                        ${product.priceUSD.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono ml-1">USD</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 text-xs">
                      {(product.priceUSD * bcvRate).toFixed(2)} Bs.
                    </span>
                  </div>
                </div>

                {/* Additional Packaging Presentations */}
                {product.presentations?.map((pres) => {
                  const isSelected = selectedPresentation?.id === pres.id;
                  const unitEquivalentCostUSD = pres.factor > 0 ? pres.priceUSD / pres.factor : pres.priceUSD;
                  const savingsVsBase =
                    product.priceUSD > 0
                      ? Math.round(((product.priceUSD - unitEquivalentCostUSD) / product.priceUSD) * 100)
                      : 0;

                  return (
                    <div
                      key={pres.id}
                      onClick={() => setSelectedPresentation(pres)}
                      className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-slate-900 text-xs">{pres.name}</h4>
                            {isSelected && (
                              <span className="p-0.5 bg-indigo-600 text-white rounded-full">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Contiene: {pres.factor} {product.unit}s
                          </p>
                        </div>
                        {savingsVsBase > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Ahorro {savingsVsBase}%
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="font-mono font-extrabold text-sm text-slate-900">
                            ${pres.priceUSD.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono ml-1">USD</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 text-xs">
                          {(pres.priceUSD * bcvRate).toFixed(2)} Bs.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quantity Selector */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-xs block">Cantidad a Despachar</span>
                  <span className="text-[10px] text-slate-400">
                    {selectedPresentation ? selectedPresentation.name : `${product.unit} individual`}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPresQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center font-mono font-extrabold text-base text-slate-900">
                    {presQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPresQuantity((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Total Summary */}
              {(() => {
                const effectiveUSD = selectedPresentation
                  ? selectedPresentation.priceUSD * presQuantity
                  : product.priceUSD * presQuantity;
                const effectiveBs = effectiveUSD * bcvRate;

                return (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-900">
                    <div>
                      <span className="text-[11px] text-emerald-800">Total a Pagar ({presQuantity}x):</span>
                      <p className="text-base font-black font-mono text-emerald-900">
                        ${effectiveUSD.toFixed(2)} USD
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-700">En Bolívares (Tasa BCV {bcvRate.toFixed(2)}):</span>
                      <p className="text-base font-black font-mono text-emerald-800">
                        {effectiveBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                      </p>
                    </div>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleAddPresentation}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                Agregar Presentación al Carrito
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: VENTA POR PESO / BALANZA DIGITAL (QUESO, JAMON)   */}
          {/* ======================================================== */}
          {activeMode === 'weight' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                    <Scale className="w-4 h-4 text-amber-700" />
                    <span>Venta de Producto al Peso (Báscula Digital)</span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                    Precio por Kilogramo
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-lg font-black font-mono text-amber-950">
                      ${pricePerKgUSD.toFixed(2)} USD
                    </span>
                    <span className="text-xs text-amber-800 ml-1">/ Kg</span>
                  </div>
                  <span className="font-mono font-bold text-amber-900 text-xs">
                    {pricePerKgBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs. / Kg
                  </span>
                </div>
              </div>

              {/* Weight Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    Ingrese el peso pesado en balanza:
                  </label>
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        if (weightUnitMode === 'g') {
                          setWeightKgInput((parsedWeightKg / 1000).toFixed(3));
                        }
                        setWeightUnitMode('kg');
                      }}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                        weightUnitMode === 'kg' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Kilogramos (Kg)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (weightUnitMode === 'kg') {
                          setWeightKgInput(Math.round(parsedWeightKg * 1000).toString());
                        }
                        setWeightUnitMode('g');
                      }}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                        weightUnitMode === 'g' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Gramos (g)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step={weightUnitMode === 'kg' ? '0.001' : '1'}
                    min="0.001"
                    value={weightKgInput}
                    onChange={(e) => setWeightKgInput(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-amber-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 rounded-xl font-mono text-xl font-extrabold text-slate-900 transition"
                    placeholder={weightUnitMode === 'kg' ? '0.350' : '350'}
                  />
                  <span className="absolute right-4 top-3.5 font-mono text-sm font-bold text-slate-500">
                    {weightUnitMode === 'kg' ? 'Kg' : 'Gramos'}
                  </span>
                </div>

                {/* Quick Weight Presets */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 font-medium block mb-1.5">
                    Botones de acceso rápido para despachos frecuentes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '150 g', kg: 0.15 },
                      { label: '250 g (1/4 Kg)', kg: 0.25 },
                      { label: '350 g', kg: 0.35 },
                      { label: '500 g (1/2 Kg)', kg: 0.5 },
                      { label: '750 g (3/4 Kg)', kg: 0.75 },
                      { label: '1.000 Kg (1 Kg)', kg: 1.0 },
                      { label: '1.500 Kg', kg: 1.5 },
                      { label: '2.000 Kg', kg: 2.0 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setWeightUnitMode('kg');
                          setWeightKgInput(preset.kg.toFixed(3));
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                          Math.abs(effectiveWeightKg - preset.kg) < 0.001
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Exact Calculated Values Ribbon */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Corte Calculado:</span>
                  <span className="font-mono font-extrabold text-slate-900">
                    {effectiveWeightKg.toFixed(3)} Kg ({Math.round(effectiveWeightKg * 1000)} gramos)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Precio de Venta en Dólares:</span>
                  <span className="font-mono font-extrabold text-indigo-700 text-sm">
                    ${weightTotalUSD.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200">
                  <span className="font-bold text-slate-800">Total en Bolívares (BCV {bcvRate.toFixed(2)}):</span>
                  <span className="font-mono font-black text-emerald-800 text-base">
                    {weightTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddWeight}
                disabled={effectiveWeightKg <= 0}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Scale className="w-4 h-4" />
                Agregar Corte de {effectiveWeightKg.toFixed(3)} Kg ({weightTotalBs.toFixed(2)} Bs.)
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: VENTA POR MONTO LIBRE EN BS (LICOR, GRANEL)       */}
          {/* ======================================================== */}
          {activeMode === 'fractional' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs">
                    <Wine className="w-4 h-4 text-purple-700" />
                    <span>Venta Fraccionada por Monto Libre en Bolívares</span>
                  </div>
                  <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                    {product.fractionUnit || product.unit || 'Litro'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-lg font-black font-mono text-purple-950">
                      ${referencePriceUSD.toFixed(2)} USD
                    </span>
                    <span className="text-xs text-purple-800 ml-1">/ {product.unit || 'Litro'}</span>
                  </div>
                  <span className="font-mono font-bold text-purple-900 text-xs">
                    {referencePriceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs. / {product.unit || 'Litro'}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    Monto en Bolívares (Bs.) que el cliente desea comprar:
                  </label>
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAmountCurrency('bs')}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                        amountCurrency === 'bs' ? 'bg-purple-700 text-white shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      En Bolívares (Bs.)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountCurrency('usd')}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                        amountCurrency === 'usd' ? 'bg-purple-700 text-white shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      En Dólares ($)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amountBsInput}
                    onChange={(e) => setAmountBsInput(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-purple-300 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-xl font-mono text-xl font-extrabold text-slate-900 transition"
                    placeholder="150.00"
                  />
                  <span className="absolute right-4 top-3.5 font-mono text-sm font-bold text-slate-500">
                    {amountCurrency === 'bs' ? 'Bs.' : 'USD'}
                  </span>
                </div>

                {/* Quick Bs. Presets */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 font-medium block mb-1.5">
                    Montos frecuentes de compra rápida:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(amountCurrency === 'bs'
                      ? [50, 100, 150, 200, 300, 500, 1000]
                      : [2, 5, 10, 15, 20, 50]
                    ).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmountBsInput(val.toString())}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                          parsedAmount === val
                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {amountCurrency === 'bs' ? `${val} Bs.` : `$${val}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Automatic Dispatch Quantity Resolution Indicator */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-300 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 font-medium">Monto Pagado por el Cliente:</span>
                  <span className="font-mono font-black text-purple-900 text-sm">
                    {fractionalAmountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                    <span className="text-[11px] text-slate-500 font-normal ml-1">
                      (${fractionalAmountUSD.toFixed(2)} USD)
                    </span>
                  </span>
                </div>

                {/* Meter visual / calculated dispatch volume */}
                <div className="p-2.5 bg-white rounded-lg border border-purple-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wine className="w-5 h-5 text-purple-600" />
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">
                        CANTIDAD DETERMINADA A DESPACHAR:
                      </span>
                      <span className="text-base font-black font-mono text-purple-900">
                        {quantityToDispatch.toFixed(3)} {product.fractionUnit || product.unit || 'Litros'}
                        <span className="text-xs text-indigo-700 ml-1.5 font-bold">
                          ({Math.round(quantityToDispatch * 1000)} ml)
                        </span>
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800">
                    Medida Exacta
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddFractional}
                disabled={fractionalAmountUSD <= 0}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Wine className="w-4 h-4" />
                Despachar {Math.round(quantityToDispatch * 1000)} ml por {fractionalAmountBs.toFixed(2)} Bs.
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-slate-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Al agregar, el inventario se ajustará de forma proporcional al corte/despacho.</span>
          </div>
          <button
            type="button"
            onClick={() => setPresentationModalProduct(null)}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
};
