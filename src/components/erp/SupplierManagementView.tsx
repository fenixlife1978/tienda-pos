import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Supplier } from '../../types';
import { Building2, Plus, Search, Pencil, Trash2, X, Save } from 'lucide-react';

const EMPTY_FORM = { name: '', rif: '', phone: '', email: '', contactPerson: '', address: '', creditDays: '15', creditLimitUSD: '' };

export const SupplierManagementView: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || s.rif.toLowerCase().includes(q) || (s.contactPerson || '').toLowerCase().includes(q) || s.phone.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [suppliers, search]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setIsOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, rif: s.rif, phone: s.phone || '', email: s.email || '', contactPerson: s.contactPerson || s.contactName || '', address: s.address || '', creditDays: String(s.creditDays ?? 15), creditLimitUSD: s.creditLimitUSD != null ? String(s.creditLimitUSD) : '' });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim(), rif = form.rif.trim();
    if (!name || !rif) return;
    const payload = {
      name, rif, phone: form.phone.trim(), email: form.email.trim(),
      contactPerson: form.contactPerson.trim(), contactName: form.contactPerson.trim(),
      address: form.address.trim(), creditDays: Math.max(0, Number(form.creditDays) || 0),
      creditLimitUSD: Math.max(0, Number(form.creditLimitUSD.replace(',', '.')) || 0),
    };
    if (editing) updateSupplier({ ...editing, ...payload });
    else addSupplier(payload);
    setIsOpen(false);
  };

  const handleDelete = (s: Supplier) => {
    if (!window.confirm('¿Eliminar el proveedor "' + s.name + '"? Esta acción no elimina las compras históricas asociadas.')) return;
    const result = deleteSupplier(s.id);
    if (!result.success) window.alert(result.message);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2"><Building2 className="w-6 h-6 text-indigo-600" /> Proveedores</h1>
          <p className="text-sm text-slate-500 mt-1">Registro central de proveedores para productos, compras y CxP.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm"><Plus className="w-4 h-4" /> Nuevo proveedor</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por proveedor, RIF, contacto, teléfono o correo..." className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 border-b border-slate-200"><tr>
              <th className="text-left px-4 py-3">Proveedor</th><th className="text-left px-4 py-3">RIF</th><th className="text-left px-4 py-3">Contacto</th><th className="text-left px-4 py-3">Teléfono</th><th className="text-left px-4 py-3">Correo</th><th className="text-right px-4 py-3">Crédito</th><th className="text-right px-4 py-3">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td><td className="px-4 py-3 font-mono">{s.rif}</td><td className="px-4 py-3">{s.contactPerson || s.contactName || '—'}</td><td className="px-4 py-3">{s.phone || '—'}</td><td className="px-4 py-3">{s.email || '—'}</td>
                <td className="px-4 py-3 text-right">{s.creditDays} días{Number(s.creditLimitUSD || 0) > 0 ? ' · $' + Number(s.creditLimitUSD).toFixed(2) : ''}</td>
                <td className="px-4 py-3 text-right"><div className="inline-flex gap-1"><button onClick={() => openEdit(s)} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Editar"><Pencil className="w-4 h-4" /></button><button onClick={() => handleDelete(s)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50" title="Eliminar"><Trash2 className="w-4 h-4" /></button></div></td>
              </tr>)}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No hay proveedores registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && <div className="fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3">
        <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50"><div><h2 className="font-black text-lg text-slate-900">{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</h2><p className="text-xs text-slate-500">Disponible para productos, compras y CxP.</p></div><button type="button" onClick={() => setIsOpen(false)} className="p-2 rounded-lg hover:bg-slate-200"><X className="w-5 h-5" /></button></div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
            <label className="md:col-span-2 text-xs font-bold text-slate-700">Razón social / Nombre *<input required value={form.name} onChange={e => setForm({...form,name:e.target.value})} className="mt-1 w-full px-3 py-2.5 border rounded-xl" /></label>
            <label className="text-xs font-bold text-slate-700">RIF / Cédula *<input required value={form.rif} onChange={e => setForm({...form,rif:e.target.value})} className="mt-1 w-full px-3 py-2.5 border rounded-xl" /></label>
            <label className="text-xs font-bold text-slate-700">Persona de contacto<input value={form.contactPerson} onChange={e => setForm({...form,contactPerson:e.target.value})} className="mt-1 w-full px-3 py-2.5 border rounded-xl" /></label>
            <label className="text-xs font-bold text-slate-700">Teléfono<input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} className="mt-1 w-full px-3 py-2.5 border rounded-xl" /></label>
            <label className="text-xs font-bold text-slate-700">Correo<input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} className="mt-1 w-full px-3 py-2.5 border rounded-xl" /></label>
            <label className="md:col-span-2 text-xs font-bold text-slate-700">Dirección<input value={form.address} onChange={e => setForm({...form,address:e.target.value})} className="mt-1 w-full px-3 py-2.5 border rounded-xl" /></label>
            <label className="text-xs font-bold text-slate-700">Días de crédito<input type="number" min="0" value={form.creditDays} onChange={e => setForm({...form,creditDays:e.target.value})} className="mt-1 w-full px-3 py-2.5 border rounded-xl" /></label>
            <label className="text-xs font-bold text-slate-700">Límite de crédito (USD)<input type="text" inputMode="decimal" value={form.creditLimitUSD} onChange={e => setForm({...form,creditLimitUSD:e.target.value})} className="mt-1 w-full px-3 py-2.5 border rounded-xl" /></label>
          </div>
          <div className="px-5 py-4 border-t bg-slate-50 flex justify-end gap-2"><button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-xl border border-slate-300 font-bold">Cancelar</button><button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold inline-flex items-center gap-2"><Save className="w-4 h-4" /> Guardar proveedor</button></div>
        </form>
      </div>}
    </section>
  );
};
