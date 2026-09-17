import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import {
  auditInventorySKUs,
  generateUniqueSKU,
  SKUStrategy,
  validateSKU,
} from '../../utils/skuGenerator';
import {
  X,
  Sparkles,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Wand2,
  Sliders,
  ShieldCheck,
  Check,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';

interface SkuAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdateProduct: (product: Product) => void;
}

export const SkuAuditModal: React.FC<SkuAuditModalProps> = ({
  isOpen,
  onClose,
  products,
  onUpdateProduct,
}) => {
  const [strategy, setStrategy] = useState<SKUStrategy>('category_name_seq');
  const [customPrefix, setCustomPrefix] = useState('SKU');
  const [digits, setDigits] = useState(4);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedCount, setAppliedCount] = useState(0);

  const audit = useMemo(() => {
    return auditInventorySKUs(products);
  }, [products]);

  const filteredClusters = useMemo(() => {
    if (!searchQuery.trim()) return audit.duplicateClusters;
    const q = searchQuery.toLowerCase();
    return audit.duplicateClusters.filter(
      (c) =>
        c.sku.toLowerCase().includes(q) ||
        c.products.some((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
  }, [audit, searchQuery]);

  // Fix individual duplicate product by assigning a new unique SKU
  const handleFixProductSKU = (product: Product) => {
    const newSku = generateUniqueSKU(
      {
        strategy,
        category: product.category,
        name: product.name,
        prefix: customPrefix,
        digits,
      },
      products,
      product.id
    );

    onUpdateProduct({
      ...product,
      code: newSku,
    });
    setAppliedCount((prev) => prev + 1);
  };

  // Mass standardize all duplicate products
  const handleFixAllDuplicates = () => {
    let updated = 0;
    const currentProducts = [...products];

    audit.duplicateClusters.forEach((cluster) => {
      // Keep first product as-is, regenerate for subsequent ones
      cluster.products.slice(1).forEach((prod) => {
        const newSku = generateUniqueSKU(
          {
            strategy,
            category: prod.category,
            name: prod.name,
            prefix: customPrefix,
            digits,
          },
          currentProducts,
          prod.id
        );

        onUpdateProduct({
          ...prod,
          code: newSku,
        });

        // Update local reference to prevent cross-generating
        const idx = currentProducts.findIndex((p) => p.id === prod.id);
        if (idx >= 0) {
          currentProducts[idx] = { ...prod, code: newSku };
        }
        updated++;
      });
    });

    setAppliedCount((prev) => prev + updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Auditor & Generador Masivo de SKUs Únicos
              </h2>
              <p className="text-xs text-slate-400">
                Detecta colisiones, códigos duplicados y estandariza los identificadores de inventario
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic KPI Metrics */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border-b border-slate-200 shrink-0 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Catálogo Total</p>
            <p className="text-xl font-mono font-black text-slate-900 mt-0.5">{audit.total} productos</p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase">SKUs Únicos & Válidos</p>
            <p className="text-xl font-mono font-black text-emerald-700 mt-0.5">{audit.validCount}</p>
          </div>

          <div className={`bg-white p-3 rounded-xl shadow-2xs border ${audit.duplicateClusters.length > 0 ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'}`}>
            <p className="text-[11px] font-semibold text-rose-700 uppercase">Colisiones / Duplicados</p>
            <p className="text-xl font-mono font-black text-rose-600 mt-0.5">{audit.duplicateClusters.length} grupos</p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-slate-100/50 text-xs">
          
          {/* Strategy Setting Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Estrategia de Generación Automática
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Formato de Nomenclatura</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as SKUStrategy)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="category_name_seq">Categoría + Nombre + Secuencia (VIV-HAR-0001)</option>
                  <option value="category_seq">Categoría + Secuencia (VIV-0042)</option>
                  <option value="prefix_seq">Prefijo Personalizado + Secuencia (SKU-0042)</option>
                  <option value="ean13">Código de Barras EAN-13 (7590001000427)</option>
                  <option value="date_random">Fecha / Año + Secuencia (SKU-2609-0001)</option>
                </select>
              </div>

              {strategy === 'prefix_seq' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Prefijo Personalizado</label>
                  <input
                    type="text"
                    value={customPrefix}
                    onChange={(e) => setCustomPrefix(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold uppercase"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dígitos de Secuencia</label>
                <select
                  value={digits}
                  onChange={(e) => setDigits(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value={3}>3 dígitos (001 - 999)</option>
                  <option value={4}>4 dígitos (0001 - 9999)</option>
                  <option value={5}>5 dígitos (00001 - 99999)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audit Results Section */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Barcode className="w-4 h-4 text-indigo-600" />
                Diagnóstico de Códigos SKU
              </h3>

              {audit.duplicateClusters.length > 0 && (
                <button
                  type="button"
                  onClick={handleFixAllDuplicates}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Corregir Todos los Duplicados Automáticamente
                </button>
              )}
            </div>

            {audit.duplicateClusters.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">¡Inventario 100% Validado!</h4>
                <p className="text-xs text-emerald-700 max-w-md mx-auto">
                  Todos los productos tienen códigos SKU válidos, formateados y sin duplicados ni colisiones.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Se encontraron {audit.duplicateClusters.length} código(s) repetidos asignados a múltiples productos:
                </p>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {filteredClusters.map((cluster) => (
                    <div key={cluster.sku} className="p-3 bg-slate-50/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-xs">
                          SKU Repetido: {cluster.sku}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {cluster.products.length} productos afectados
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cluster.products.map((prod, idx) => (
                          <div
                            key={prod.id}
                            className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{prod.name}</p>
                              <p className="text-[10px] text-slate-500">{prod.category} • Stock: {prod.stock}</p>
                            </div>

                            {idx === 0 ? (
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 font-semibold rounded text-[10px] whitespace-nowrap">
                                Conservar SKU
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleFixProductSKU(prod)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[10px] transition cursor-pointer whitespace-nowrap border border-indigo-200"
                              >
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                Generar Nuevo SKU
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {appliedCount > 0 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> {appliedCount} producto(s) actualizados con nuevos SKUs únicos.
              </span>
            ) : (
              'El generador garantiza identificadores únicos sin colisiones.'
            )}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Aceptar y Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
