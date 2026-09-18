import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRightLeft, Package, History, CheckCircle2 } from 'lucide-react';
import { Product } from '../../types';
import { formatPlainNumber } from '../../utils/formatUtils';

interface TransferRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  from: string;
  to: string;
  user: string;
}

const TRANSFER_KEY = 'omni_inventory_transfers_v1';
const DEFAULT_WAREHOUSES = ['Principal', 'Secundario', 'Depósito'];

function readTransfers(): TransferRecord[] {
  try {
    const raw = localStorage.getItem(TRANSFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function warehouseMap(product: Product): Record<string, number> {
  if (product.warehouseStocks && Object.keys(product.warehouseStocks).length) {
    return { ...product.warehouseStocks };
  }
  return { [product.warehouse || 'Principal']: product.stock };
}

export const InventoryTransfersView: React.FC = () => {
  const { products, updateProduct, currentUser } = useApp();
  const [productId, setProductId] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('Principal');
  const [toWarehouse, setToWarehouse] = useState('Secundario');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');
  const [transfers, setTransfers] = useState<TransferRecord[]>(readTransfers);

  const selectedProduct = products.find((p) => p.id === productId);

  const warehouses = useMemo(() => {
    const names = new Set(DEFAULT_WAREHOUSES);
    products.forEach((p) => {
      if (p.warehouse) names.add(p.warehouse);
      Object.keys(p.warehouseStocks || {}).forEach((w) => names.add(w));
    });
    return Array.from(names);
  }, [products]);

  const balances = selectedProduct ? warehouseMap(selectedProduct) : {};
  const availableAtSource = balances[fromWarehouse] || 0;

  const executeTransfer = () => {
    setMessage('');
    if (!selectedProduct) {
      setMessage('Selecciona un producto.');
      return;
    }
    if (fromWarehouse === toWarehouse) {
      setMessage('El almacén origen y destino deben ser diferentes.');
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('Indica una cantidad mayor que cero.');
      return;
    }
    if (qty > availableAtSource + 0.000001) {
      setMessage(`Stock insuficiente en ${fromWarehouse}: ${formatPlainNumber(availableAtSource, 3)} disponibles.`);
      return;
    }

    const nextBalances = warehouseMap(selectedProduct);
    nextBalances[fromWarehouse] = Number(((nextBalances[fromWarehouse] || 0) - qty).toFixed(3));
    nextBalances[toWarehouse] = Number(((nextBalances[toWarehouse] || 0) + qty).toFixed(3));

    const totalByWarehouse = Object.values(nextBalances).reduce((sum, value) => sum + value, 0);
    const nextProduct: Product = {
      ...selectedProduct,
      warehouseStocks: nextBalances,
      stock: Number(totalByWarehouse.toFixed(3)),
      warehouse: selectedProduct.warehouse || 'Principal',
    };

    updateProduct(nextProduct);

    const record: TransferRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: Number(qty.toFixed(3)),
      from: fromWarehouse,
      to: toWarehouse,
      user: currentUser.name || 'Usuario',
    };

    const nextTransfers = [record, ...transfers].slice(0, 200);
    setTransfers(nextTransfers);
    localStorage.setItem(TRANSFER_KEY, JSON.stringify(nextTransfers));
    setQuantity('');
    setMessage(`Transferencia registrada: ${formatPlainNumber(qty, 3)} ${selectedProduct.unit} de ${fromWarehouse} → ${toWarehouse}.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
          Almacenes y Transferencias
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Distribuye existencias entre almacenes sin alterar el stock total del producto.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-700">
              Producto
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar producto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Cantidad a transferir
              <input type="number" min="0" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.000" />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Almacén origen
              <select value={fromWarehouse} onChange={(e) => setFromWarehouse(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {warehouses.map((w) => <option key={w}>{w}</option>)}
              </select>
              <span className="text-[10px] text-slate-400">Disponible: {formatPlainNumber(availableAtSource, 3)} {selectedProduct?.unit || ''}</span>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Almacén destino
              <select value={toWarehouse} onChange={(e) => setToWarehouse(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {warehouses.map((w) => <option key={w}>{w}</option>)}
              </select>
            </label>
          </div>

          <button onClick={executeTransfer} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 font-bold flex items-center justify-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Registrar transferencia
          </button>

          {message && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {message}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-sm flex items-center gap-2"><Package className="w-4 h-4 text-indigo-600" /> Existencias por almacén</h3>
          {!selectedProduct ? (
            <p className="text-xs text-slate-400 mt-4">Selecciona un producto para consultar sus existencias distribuidas.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {Object.entries(balances).map(([warehouse, stock]) => (
                <div key={warehouse} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs">
                  <span className="font-semibold">{warehouse}</span>
                  <b>{formatPlainNumber(stock, 3)} {selectedProduct.unit}</b>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t text-xs flex justify-between font-black">
                <span>Stock total</span>
                <span>{formatPlainNumber(selectedProduct.stock, 3)} {selectedProduct.unit}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-sm">Historial de transferencias</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Producto</th><th className="p-3 text-right">Cantidad</th><th className="p-3 text-left">Origen</th><th className="p-3 text-left">Destino</th><th className="p-3 text-left">Usuario</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfers.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">Aún no hay transferencias registradas.</td></tr>
              ) : transfers.map((t) => (
                <tr key={t.id}>
                  <td className="p-3">{new Date(t.date).toLocaleString('es-VE')}</td>
                  <td className="p-3 font-semibold">{t.productName}</td>
                  <td className="p-3 text-right font-mono">{formatPlainNumber(t.quantity, 3)}</td>
                  <td className="p-3">{t.from}</td>
                  <td className="p-3">{t.to}</td>
                  <td className="p-3">{t.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
