import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Terminal } from '../../types';
import { tursoService } from '../../services/tursoService';
import { Boxes, Check, Edit2, Plus, RefreshCw, Save, Users, X } from 'lucide-react';

export const TerminalManagementView: React.FC = () => {
  const { users, currentUser } = useApp();
  const canManage = currentUser.role === 'admin' || currentUser.role === 'gerente';
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<Terminal | null>(null);
  const [form, setForm] = useState({ code: '', name: '' });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [rows, links] = await Promise.all([
        tursoService.listTerminals(false),
        tursoService.listTerminalAssignments(),
      ]);
      const map: Record<string, string[]> = {};
      for (const link of links) (map[link.terminalId] ??= []).push(link.userId);
      setTerminals(rows);
      setAssignments(map);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ code: '', name: '' });
    setSelectedUsers([]);
    setMessage('');
  };

  const openEdit = (terminal: Terminal) => {
    setEditing(terminal);
    setForm({ code: terminal.code, name: terminal.name });
    setSelectedUsers(assignments[terminal.id] || []);
    setMessage('');
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setMessage('Indica código y nombre de la caja.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      let terminal: Terminal;
      if (editing) {
        terminal = { ...editing, code: form.code.trim().toUpperCase(), name: form.name.trim() };
        await tursoService.updateTerminal(terminal);
      } else {
        terminal = await tursoService.createTerminal(form);
      }
      await tursoService.setTerminalUserAssignments(terminal.id, selectedUsers);
      await load();
      setEditing(terminal);
      setMessage('Caja guardada y asignaciones confirmadas en Turso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (terminal: Terminal) => {
    try {
      const next = { ...terminal, active: !terminal.active };
      await tursoService.updateTerminal(next);
      await load();
      if (editing?.id === terminal.id) setEditing(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const assignedNames = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u.name]));
    return (ids: string[]) => ids.map((id) => byId.get(id) || id);
  }, [users]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-600" />
            Cajas / Terminales
          </h2>
          <p className="text-xs text-slate-500">
            Cada terminal tiene su propia sesión, caja, correlativos y actividad POS. Un terminal puede estar asignado a varios usuarios.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="px-3 py-2 border rounded-xl text-xs font-bold flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
          {canManage && <button onClick={openNew} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Nueva caja
          </button>}
        </div>
      </div>

      {message && <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">{message}</div>}

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white border rounded-2xl overflow-hidden">
          <div className="p-4 border-b bg-slate-50 text-xs font-black uppercase text-slate-600">Terminales registradas</div>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Cargando cajas…</div>
          ) : terminals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No hay cajas configuradas.</div>
          ) : (
            <div className="divide-y">
              {terminals.map((terminal) => (
                <div key={terminal.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{terminal.code}</span>
                      <span className={terminal.active ? 'px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold' : 'px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500 font-bold'}>{terminal.active ? 'ACTIVA' : 'INACTIVA'}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{terminal.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1 flex gap-1 items-center">
                      <Users className="w-3 h-3" /> {assignedNames(assignments[terminal.id] || []).join(', ') || 'Sin usuarios asignados'}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canManage && <>
                    <button onClick={() => openEdit(terminal)} className="p-2 rounded-lg border hover:bg-slate-50" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => void toggleActive(terminal)} className="p-2 rounded-lg border hover:bg-slate-50 text-xs font-bold">
                      {terminal.active ? 'Desactivar' : 'Activar'}
                    </button>
                    </>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white border rounded-2xl p-5 space-y-4">
          {!canManage ? <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">Solo Administrador o Gerente puede crear, editar y asignar cajas.</div> : <>
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm">{editing ? 'Editar caja' : 'Crear caja'}</h3>
            {editing && <button onClick={openNew} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>}
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Código / número de caja</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CAJA-01" className="w-full border rounded-xl px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Caja principal" className="w-full border rounded-xl px-3 py-2 text-sm" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <label className="text-xs font-bold">Usuarios autorizados</label>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-xl divide-y">
              {users.filter((u) => u.active).map((user) => {
                const checked = selectedUsers.includes(user.id);
                return (
                  <button type="button" key={user.id} onClick={() => toggleUser(user.id)} className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-50">
                    <span><b className="text-xs">{user.name}</b><span className="block text-[10px] text-slate-400">{user.role}</span></span>
                    <span className={checked ? 'w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center' : 'w-5 h-5 rounded-md border'}>{checked && <Check className="w-3.5 h-3.5" />}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={() => void save()} disabled={saving} className="w-full bg-indigo-600 disabled:bg-indigo-300 text-white rounded-xl py-2.5 font-bold text-xs flex items-center justify-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Guardar caja y asignaciones'}
          </button>
          </>}
        </div>
      </div>
    </div>
  );
};
