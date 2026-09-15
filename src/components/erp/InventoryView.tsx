import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { ProductModal } from './ProductModal';
import {
  Boxes,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  Download,
  CheckCircle,
  X,
  PackagePlus,
  Layers,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';

export const InventoryView: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, adjustProductStock, settings } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<string>('Entrada por compra a proveedor');
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');

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
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      const matchesLowStock = !onlyLowStock || p.stock <= p.minStock;

      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [products, searchQuery, selectedCategory, onlyLowStock]);

  // Inventory stats
  const totalItems = products.length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const totalValueUSD = products.reduce((sum, p) => sum + p.costUSD * p.stock, 0);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setIsCreateModalOpen(true);
  };

  const handleSaveProduct = (productData: Omit<Product, 'id'> | Product) => {
    if ('id' in productData && productData.id) {
      updateProduct(productData as Product);
    } else {
      addProduct(productData);
    }
    setIsCreateModalOpen(false);
    setEditingProduct(null);
  };

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    const delta = adjustType === 'in' ? Math.abs(adjustQuantity) : -Math.abs(adjustQuantity);
    adjustProductStock(adjustingProduct.id, delta, adjustReason);
    setAdjustingProduct(null);
  };

  const handleExportCSV = () => {
    const rows = [
      ['REPORTE DE INVENTARIO Y VALORIZACIÓN EN TIEMPO REAL'],
      ['Fecha', new Date().toLocaleString('es-VE')],
      ['Tasa BCV', `${formatPlainNumber(settings.bcvRate, 2)} Bs/USD`],
      [],
      ['SKU', 'Producto', 'Categoría', 'Stock Físico', 'Stock Mínimo', 'Unidad', 'Costo USD', 'Precio USD', 'Precio Bs', 'Valor Costo Total USD'],
      ...products.map((p) => [
        p.code,
        p.name,
        p.category,
        p.stock,
        p.minStock,
        p.unit,
        formatPlainNumber(p.costUSD, 6),
        formatPlainNumber(p.priceUSD, 6),
        formatPlainNumber(p.priceUSD * settings.bcvRate, 2),
        formatPlainNumber(p.costUSD * p.stock, 6),
      ]),
    ];
    exportToCSV(`Inventario_${new Date().toISOString().split('T')[0]}`, rows);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-indigo-600" />
            Control de Inventarios en Tiempo Real
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoreo en vivo de existencias, ajustes de stock (kardex) y valorización de mercancía.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Exportar a Excel
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total SKUs</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">{totalItems}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Productos activos</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Stock Crítico</span>
          <p className="text-2xl font-extrabold text-amber-600 mt-1 font-mono">{lowStockCount}</p>
          <p className="text-[10px] text-amber-700 mt-0.5">Por debajo del mínimo</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Agotados</span>
          <p className="text-2xl font-extrabold text-rose-600 mt-1 font-mono">{outOfStockCount}</p>
          <p className="text-[10px] text-rose-700 mt-0.5">Sin unidades físicas</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Valor Inventario (Costo)</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">{formatUSD(totalValueUSD)}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            ≈ {formatBs(totalValueUSD * settings.bcvRate)}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código SKU, nombre o categoría..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          {/* Category pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={(e) => setOnlyLowStock(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>Solo Bajo Stock</span>
          </label>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Producto / SKU</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-center">Stock Actual</th>
                <th className="py-3 px-4 text-center">Stock Mínimo</th>
                <th className="py-3 px-4 text-right">Costo (USD)</th>
                <th className="py-3 px-4 text-right">PVP (USD)</th>
                <th className="py-3 px-4 text-right">PVP (Bs BCV)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isOut = p.stock <= 0;
                const isLow = p.stock > 0 && p.stock <= p.minStock;
                const priceBs = p.priceUSD * settings.bcvRate;
                const margin = p.profitMarginPercent ?? (p.costUSD > 0 ? Number((((p.priceUSD - p.costUSD) / p.costUSD) * 100).toFixed(1)) : 0);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-900">{p.name}</p>
                            {p.isComposite && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[10px] font-black tracking-tight">
                                Kit/Combo
                              </span>
                            )}
                            {(p.ivaRate ?? (p.appliesIva ? 16 : 0)) > 0 ? (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                                IVA {p.ivaRate ?? (p.appliesIva ? 16 : 0)}%
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                Exento
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                            <span className="font-mono text-slate-500 font-medium">{p.code}</span>
                            {p.location && (
                              <span className="text-slate-400 font-medium">📍 {p.location}</span>
                            )}
                            {p.suppliersInfo && p.suppliersInfo.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-blue-600 font-semibold">
                                <Truck className="w-2.5 h-2.5" />
                                {p.suppliersInfo.length} prov.
                              </span>
                            )}
                            {p.presentations && p.presentations.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                                <Layers className="w-2.5 h-2.5" />
                                {p.presentations.length} pres.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-medium">{p.category}</td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-sm">
                      {p.stock} <span className="text-[10px] font-normal text-slate-400">{p.unit}</span>
                      {p.isComposite && (
                        <span className="block text-[9px] text-purple-700 font-semibold">virtual</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-slate-500">
                      {p.minStock} {p.unit}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      <div>{formatUSD(p.costUSD)}</div>
                      {p.highestSupplierCost && (
                        <div className="text-[9px] text-blue-600 font-semibold">Regla Max</div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      <div>{formatUSD(p.priceUSD)}</div>
                      <div className="text-[9px] text-indigo-600 font-semibold">+{margin}% mg</div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                      {formatBs(priceBs)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isOut ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Agotado
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Reabastecer
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Normal
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setAdjustingProduct(p);
                            setAdjustQuantity(10);
                            setAdjustType('in');
                          }}
                          className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                          title="Ajuste rápido de Stock (Entrada/Salida)"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          title="Editar producto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar ${p.name}?`)) deleteProduct(p.id);
                          }}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create or Edit Product (Full advanced modal with Cost, Profit Margin, Alternative Prices, Suppliers, Presentations, Composite Kit, Camera & Upload) */}
      <ProductModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingProduct(null);
        }}
        productToEdit={editingProduct}
        onSave={handleSaveProduct}
      />

      {/* Modal: Adjust Stock (Kardex) */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                Ajuste de Stock: {adjustingProduct.name}
              </h3>
              <button onClick={() => setAdjustingProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyAdjustment} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between">
                <span>Stock Actual en Almacén:</span>
                <span className="font-mono font-bold text-slate-900">{adjustingProduct.stock} {adjustingProduct.unit}</span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Tipo de Movimiento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('in')}
                    className={`py-2 text-center rounded-lg font-bold border transition cursor-pointer ${
                      adjustType === 'in'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    + Entrada (Compra / Devolución)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('out')}
                    className={`py-2 text-center rounded-lg font-bold border transition cursor-pointer ${
                      adjustType === 'out'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    - Salida (Merma / Ajuste)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Cantidad de Unidades *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Motivo o Justificación del Ajuste *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej: Recepción factura POL-99214, rotura en flete, etc."
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
