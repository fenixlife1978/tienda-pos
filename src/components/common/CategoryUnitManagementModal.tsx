import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ProductCategory, ProductUnit } from '../../types';
import {
  FolderTree,
  Ruler,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';

export const CategoryUnitManagementModal: React.FC = () => {
  const {
    categories,
    addCategory,
    deleteCategory,
    units,
    addUnit,
    deleteUnit,
    products,
    isCategoryUnitModalOpen,
    setIsCategoryUnitModalOpen,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'categories' | 'units'>('categories');

  // New category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // New unit form state
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');
  const [newUnitAllowDecimals, setNewUnitAllowDecimals] = useState(false);

  // Status feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isCategoryUnitModalOpen) return null;

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', text: 'El nombre de la categoría es obligatorio.' });
      return;
    }

    const exists = categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setFeedback({ type: 'error', text: `La categoría "${trimmed}" ya se encuentra registrada.` });
      return;
    }

    addCategory({
      name: trimmed,
      description: newCatDesc.trim() || undefined,
    });

    setNewCatName('');
    setNewCatDesc('');
    setFeedback({ type: 'success', text: `Categoría "${trimmed}" creada exitosamente.` });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleDeleteCategory = (cat: ProductCategory) => {
    const res = deleteCategory(cat.id);
    if (!res.success) {
      setFeedback({ type: 'error', text: res.message });
    } else {
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = newUnitName.trim();
    const abbrTrimmed = newUnitAbbr.trim();

    if (!nameTrimmed || !abbrTrimmed) {
      setFeedback({ type: 'error', text: 'Nombre y abreviatura de la unidad son obligatorios.' });
      return;
    }

    const exists = units.some(
      (u) =>
        u.name.toLowerCase() === nameTrimmed.toLowerCase() ||
        u.abbreviation.toLowerCase() === abbrTrimmed.toLowerCase()
    );

    if (exists) {
      setFeedback({ type: 'error', text: `Ya existe una unidad con ese nombre o abreviatura.` });
      return;
    }

    addUnit({
      name: nameTrimmed,
      abbreviation: abbrTrimmed,
      allowDecimals: newUnitAllowDecimals,
    });

    setNewUnitName('');
    setNewUnitAbbr('');
    setNewUnitAllowDecimals(false);
    setFeedback({ type: 'success', text: `Unidad de medida "${nameTrimmed} (${abbrTrimmed})" creada.` });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleDeleteUnit = (u: ProductUnit) => {
    const res = deleteUnit(u.id);
    if (!res.success) {
      setFeedback({ type: 'error', text: res.message });
    } else {
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950/50 rounded-xl border border-indigo-400/30">
              <FolderTree className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Gestión de Categorías y Unidades de Medida
              </h3>
              <p className="text-xs text-indigo-200">
                Creación, visualización y eliminación de categorías de productos y unidades de pesaje/empaque.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCategoryUnitModalOpen(false)}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('categories');
              setFeedback(null);
            }}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'categories'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Categorías de Productos ({categories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('units');
              setFeedback(null);
            }}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'units'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Unidades de Medida ({units.length})</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          
          {/* ======================= TAB 1: CATEGORÍAS ======================= */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Form to Add New Category */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
                <h4 className="font-extrabold text-slate-900 text-xs mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  Crear Nueva Categoría
                </h4>

                <form onSubmit={handleAddCategory} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                      Nombre de la Categoría *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Ej: Embutidos y Charcutería"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                      Descripción / Uso (Opcional)
                    </label>
                    <input
                      type="text"
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      placeholder="Ej: Jamones, salchichas y quesos duros"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-700"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="submit"
                      className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Guardar Categoría
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Categories Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-xs">
                    Categorías Registradas ({categories.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Solo pueden eliminarse categorías que no tengan productos asociados
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nombre</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-center">Productos Asignados</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map((cat) => {
                        const productCount = products.filter(
                          (p) => p.category.toLowerCase().trim() === cat.name.toLowerCase().trim()
                        ).length;

                        return (
                          <tr key={cat.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                              <Package className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              {cat.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {cat.description || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] ${
                                  productCount > 0
                                    ? 'bg-blue-100 text-blue-800 font-bold'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {productCount} productos
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                title={
                                  productCount > 0
                                    ? `Tiene ${productCount} producto(s) asociados. No puede eliminarse.`
                                    : 'Eliminar categoría'
                                }
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  productCount > 0
                                    ? 'text-slate-300 hover:text-slate-400 hover:bg-slate-100 cursor-not-allowed'
                                    : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================= TAB 2: UNIDADES DE MEDIDA ======================= */}
          {activeTab === 'units' && (
            <div className="space-y-6">
              {/* Form to Add New Unit */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
                <h4 className="font-extrabold text-slate-900 text-xs mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  Crear Nueva Unidad de Medida
                </h4>

                <form onSubmit={handleAddUnit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                      Nombre de la Unidad *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="Ej: Galón, Paquete, Saco"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                      Abreviatura *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUnitAbbr}
                      onChange={(e) => setNewUnitAbbr(e.target.value)}
                      placeholder="Ej: gal, pqt, sco"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900"
                    />
                  </div>

                  <div className="flex items-center pb-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newUnitAllowDecimals}
                        onChange={(e) => setNewUnitAllowDecimals(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] font-bold text-slate-700">
                        Permite Decimales (Balanza/Peso)
                      </span>
                    </label>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Guardar Unidad
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Units Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-xs">
                    Unidades de Medida Registradas ({units.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Disponibles en el formulario de creación de productos y presentaciones
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Unidad de Medida</th>
                        <th className="py-2.5 px-3">Abreviatura</th>
                        <th className="py-2.5 px-3 text-center">Permite Decimales (Pesaje)</th>
                        <th className="py-2.5 px-3 text-center">Productos Asignados</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {units.map((u) => {
                        const productCount = products.filter(
                          (p) =>
                            p.unit.toLowerCase().trim() === u.name.toLowerCase().trim() ||
                            p.unit.toLowerCase().trim() === u.abbreviation.toLowerCase().trim()
                        ).length;

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                              <Ruler className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              {u.name}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                              {u.abbreviation}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  u.allowDecimals
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {u.allowDecimals ? 'Sí (Decimales / Báscula)' : 'Solo Enteros'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] ${
                                  productCount > 0
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {productCount} productos
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteUnit(u)}
                                title={
                                  productCount > 0
                                    ? `Tiene ${productCount} producto(s) asignados. No puede eliminarse.`
                                    : 'Eliminar unidad'
                                }
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  productCount > 0
                                    ? 'text-slate-300 hover:text-slate-400 hover:bg-slate-100 cursor-not-allowed'
                                    : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Los cambios se guardan de forma permanente y se reflejan al instante en todo el sistema.
          </p>
          <button
            type="button"
            onClick={() => setIsCategoryUnitModalOpen(false)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer text-xs"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
