import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { ProductModal } from './ProductModal';
import { BarcodeLabelsModal } from './BarcodeLabelsModal';
import { SkuAuditModal } from './SkuAuditModal';
import { InventoryExecutiveReportModal } from './InventoryExecutiveReportModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
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
  Barcode,
  Printer,
  FileDown,
  Wand2,
  Sparkles,
  Camera,
  Scan,
} from 'lucide-react';
import { auditInventorySKUs } from '../../utils/skuGenerator';
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

  // Barcode Scanner Modal state
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  // Barcode Labels Modal state
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeSelectedProduct, setBarcodeSelectedProduct] = useState<Product | null>(null);

  // SKU Auditor & Generator Modal state
  const [isSkuAuditModalOpen, setIsSkuAuditModalOpen] = useState(false);

  // Executive Inventory PDF Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  // SKU health audit
  const skuAudit = useMemo(() => {
    return auditInventorySKUs(products);
  }, [products]);

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

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsScannerModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer shadow-xs animate-pulse"
            title="Escanear código de barras o SKU con la cámara del dispositivo para consulta o ajuste"
          >
            <Camera className="w-4 h-4" />
            <span>Escanear Barcode / SKU</span>
          </button>

          <button
            onClick={() => {
              setReportFilter('all');
              setIsReportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition cursor-pointer shadow-2xs"
            title="Generar reporte gerencial en PDF con valorización multimoneda y niveles de stock"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Reporte PDF Gerencial</span>
          </button>

          <button
            onClick={() => setIsSkuAuditModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer shadow-2xs border ${
              skuAudit.duplicateClusters.length > 0
                ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            }`}
            title="Auditor y generador masivo de códigos SKU únicos para el catálogo"
          >
            <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Auditor SKUs</span>
            {skuAudit.duplicateClusters.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white">
                {skuAudit.duplicateClusters.length} repetidos
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setBarcodeSelectedProduct(null);
              setIsBarcodeModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer shadow-2xs"
            title="Generar etiquetas adhesivas de código de barras para imprimir o descargar en PDF"
          >
            <Barcode className="w-3.5 h-3.5 text-indigo-600" />
            Etiquetas Barcode PDF
          </button>

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
        <div className="relative w-full md:max-w-sm flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código SKU, nombre, EAN..."
            className="w-full pl-9 pr-24 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setIsScannerModalOpen(true)}
            className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[11px] font-bold flex items-center gap-1 border border-indigo-200 transition cursor-pointer"
            title="Abrir lector de cámara"
          >
            <Camera className="w-3.5 h-3.5 text-indigo-600" />
            <span>Escanear</span>
          </button>
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

      {/* Products */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Producto / SKU</th><th className="py-3 px-4">Categoría</th><th className="py-3 px-4 text-center">Stock Actual</th><th className="py-3 px-4 text-center">Stock Mínimo</th><th className="py-3 px-4 text-right">Costo (USD)</th><th className="py-3 px-4 text-right">PVP (USD)</th><th className="py-3 px-4 text-right">PVP (Bs BCV)</th><th className="py-3 px-4 text-center">Estado</th><th className="py-3 px-4 text-center min-w-[190px]">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isOut=p.stock<=0,isLow=p.stock>0&&p.stock<=p.minStock,priceBs=p.priceUSD*settings.bcvRate;
                const margin=p.profitMarginPercent??(p.costUSD>0?Number((((p.priceUSD-p.costUSD)/p.costUSD)*100).toFixed(1)):0);
                const ivaRate=p.ivaRate??(p.appliesIva?16:0);
                return <tr key={p.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4"><div className="flex items-center gap-3"><img src={p.image} alt={p.name} className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"/><div><div className="flex items-center gap-1.5 flex-wrap"><p className="font-bold text-slate-900">{p.name}</p>{p.isComposite&&<span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[10px] font-black">Kit/Combo</span>}<span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${ivaRate>0?'bg-amber-100 text-amber-900':'bg-emerald-100 text-emerald-800'}`}>{ivaRate>0?`IVA ${ivaRate}%`:'Exento'}</span></div><div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500"><span className="font-mono font-medium">{p.code}</span>{p.location&&<span>📍 {p.location}</span>}{p.suppliersInfo?.length>0&&<span className="inline-flex items-center gap-0.5 text-blue-600"><Truck className="w-2.5 h-2.5"/>{p.suppliersInfo.length} prov.</span>}{p.presentations?.length>0&&<span className="inline-flex items-center gap-0.5 text-amber-600"><Layers className="w-2.5 h-2.5"/>{p.presentations.length} pres.</span>}</div></div></div></td>
                  <td className="py-3 px-4 text-slate-600 font-medium">{p.category}</td><td className="py-3 px-4 text-center font-mono font-bold text-sm">{p.stock} <span className="text-[10px] font-normal text-slate-400">{p.unit}</span></td><td className="py-3 px-4 text-center font-mono text-slate-500">{p.minStock} {p.unit}</td><td className="py-3 px-4 text-right font-mono text-slate-600">{formatUSD(p.costUSD)}</td><td className="py-3 px-4 text-right font-mono font-bold">{formatUSD(p.priceUSD)}<div className="text-[9px] text-indigo-600">+{margin}% mg</div></td><td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">{formatBs(priceBs)}</td>
                  <td className="py-3 px-4 text-center">{isOut?<span className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Agotado</span>:isLow?<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"><AlertTriangle className="w-3.5 h-3.5"/>Reabastecer</span>:<span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Normal</span>}</td>
                  <td className="py-3 px-4"><div className="flex items-center justify-center gap-1.5">
                    <button onClick={()=>{setBarcodeSelectedProduct(p);setIsBarcodeModalOpen(true)}} className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100" title="Imprimir etiquetas" aria-label={`Imprimir etiquetas de ${p.name}`}><Barcode className="w-5 h-5"/></button>
                    <button onClick={()=>{setAdjustingProduct(p);setAdjustQuantity(10);setAdjustType('in')}} className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200" title="Ajustar stock" aria-label={`Ajustar stock de ${p.name}`}><ArrowUpDown className="w-5 h-5"/></button>
                    <button onClick={()=>handleOpenEdit(p)} className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200" title="Editar producto" aria-label={`Editar ${p.name}`}><Edit2 className="w-5 h-5"/></button>
                    <button onClick={()=>{if(confirm(`¿Eliminar ${p.name}?`))deleteProduct(p.id)}} className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-rose-700 bg-rose-50 border border-rose-100 hover:bg-rose-100" title="Eliminar producto" aria-label={`Eliminar ${p.name}`}><Trash2 className="w-5 h-5"/></button>
                  </div></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden divide-y divide-slate-200">
          {filteredProducts.map((p)=>{
            const isOut=p.stock<=0,isLow=p.stock>0&&p.stock<=p.minStock,priceBs=p.priceUSD*settings.bcvRate;
            const margin=p.profitMarginPercent??(p.costUSD>0?Number((((p.priceUSD-p.costUSD)/p.costUSD)*100).toFixed(1)):0),ivaRate=p.ivaRate??(p.appliesIva?16:0);
            return <article key={p.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3"><img src={p.image} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-extrabold text-base leading-tight break-words">{p.name}</h3><p className="font-mono text-xs text-slate-500 mt-1">{p.code}</p></div>{isOut?<span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Agotado</span>:isLow?<span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800"><AlertTriangle className="w-3.5 h-3.5"/>Bajo</span>:<span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Normal</span>}</div><div className="flex flex-wrap gap-1.5 mt-2">{p.isComposite&&<span className="px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">Kit/Combo</span>}<span className={`px-2 py-1 rounded-md text-[10px] font-bold ${ivaRate>0?'bg-amber-100 text-amber-900':'bg-emerald-100 text-emerald-800'}`}>{ivaRate>0?`IVA ${ivaRate}%`:'Exento'}</span><span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">{p.category}</span></div></div></div>
              <div className="grid grid-cols-2 gap-2 mt-4"><div className="rounded-lg bg-slate-50 border p-3"><div className="text-[10px] text-slate-500">Stock actual</div><div className="font-mono font-extrabold text-base mt-0.5">{p.stock} <span className="text-[10px] font-normal">{p.unit}</span></div></div><div className="rounded-lg bg-slate-50 border p-3"><div className="text-[10px] text-slate-500">Stock mínimo</div><div className="font-mono font-bold text-base mt-0.5">{p.minStock} {p.unit}</div></div><div className="rounded-lg bg-slate-50 border p-3"><div className="text-[10px] text-slate-500">Costo</div><div className="font-mono font-bold text-sm mt-0.5">{formatUSD(p.costUSD)}</div></div><div className="rounded-lg bg-slate-50 border p-3"><div className="text-[10px] text-slate-500">PVP USD</div><div className="font-mono font-extrabold text-sm mt-0.5">{formatUSD(p.priceUSD)} <span className="text-[10px] text-indigo-600">+{margin}%</span></div></div><div className="col-span-2 rounded-lg bg-emerald-50 border border-emerald-100 p-3"><div className="text-[10px] text-emerald-700">PVP Bs BCV</div><div className="font-mono font-extrabold text-base text-emerald-800 mt-0.5">{formatBs(priceBs)}</div></div></div>
              {(p.location||p.suppliersInfo?.length||p.presentations?.length)&&<div className="flex flex-wrap gap-2 mt-3 text-xs">{p.location&&<span>Ubicación: {p.location}</span>}{p.suppliersInfo?.length>0&&<span className="inline-flex items-center gap-1 text-blue-600"><Truck className="w-3.5 h-3.5"/>{p.suppliersInfo.length} proveedores</span>}{p.presentations?.length>0&&<span className="inline-flex items-center gap-1 text-amber-600"><Layers className="w-3.5 h-3.5"/>{p.presentations.length} presentaciones</span>}</div>}
              <div className="mt-4 pt-4 border-t border-slate-200"><div className="text-xs font-extrabold mb-2">Acciones del producto</div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button onClick={()=>{setBarcodeSelectedProduct(p);setIsBarcodeModalOpen(true)}} className="min-h-[56px] rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 flex flex-col items-center justify-center gap-1.5 font-bold text-[11px]" title="Imprimir etiquetas"><Barcode className="w-6 h-6"/><span>Etiquetas</span></button>
                <button onClick={()=>{setAdjustingProduct(p);setAdjustQuantity(10);setAdjustType('in')}} className="min-h-[56px] rounded-xl border border-slate-200 bg-slate-50 text-slate-800 flex flex-col items-center justify-center gap-1.5 font-bold text-[11px]" title="Ajustar stock"><ArrowUpDown className="w-6 h-6"/><span>Ajustar stock</span></button>
                <button onClick={()=>handleOpenEdit(p)} className="min-h-[56px] rounded-xl border border-slate-200 bg-slate-50 text-slate-800 flex flex-col items-center justify-center gap-1.5 font-bold text-[11px]" title="Editar producto"><Edit2 className="w-6 h-6"/><span>Editar</span></button>
                <button onClick={()=>{if(confirm(`¿Eliminar ${p.name}?`))deleteProduct(p.id)}} className="min-h-[56px] rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex flex-col items-center justify-center gap-1.5 font-bold text-[11px]" title="Eliminar producto"><Trash2 className="w-6 h-6"/><span>Eliminar</span></button>
              </div></div>
            </article>
          })}
          {filteredProducts.length===0&&<div className="p-10 text-center text-sm text-slate-400">No hay productos que coincidan con los filtros.</div>}
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

      {/* Modal: Barcode Labels Generator & PDF Export */}
      <BarcodeLabelsModal
        isOpen={isBarcodeModalOpen}
        onClose={() => {
          setIsBarcodeModalOpen(false);
          setBarcodeSelectedProduct(null);
        }}
        products={products}
        initialSelectedProduct={barcodeSelectedProduct}
        settings={settings}
      />

      {/* Modal: SKU Catalog Audit & Bulk Generator */}
      <SkuAuditModal
        isOpen={isSkuAuditModalOpen}
        onClose={() => setIsSkuAuditModalOpen(false)}
        products={products}
        onUpdateProduct={updateProduct}
      />

      {/* Modal: Executive Inventory PDF Report Generator */}
      <InventoryExecutiveReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialFilter={reportFilter}
      />

      {/* Modal: Live Camera Barcode & SKU Scanner Utility */}
      <BarcodeScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        products={products}
        settings={settings}
        onAdjustStock={adjustProductStock}
        onEditProduct={handleOpenEdit}
        onOpenBarcodeLabels={(prod) => {
          setBarcodeSelectedProduct(prod);
          setIsBarcodeModalOpen(true);
        }}
      />

    </div>
  );
};
