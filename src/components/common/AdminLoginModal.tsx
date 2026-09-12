import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Lock, UserCheck, X, AlertCircle } from 'lucide-react';
import { User } from '../../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const { users, currentUser, setCurrentUser, setIsAdminActive, setMode } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    return currentUser.id || users.find(u => u.role === 'admin')?.id || users[0]?.id || '';
  });
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const defaultAdmin = users.find(u => u.isInitialGeneric || u.role === 'admin') || users[0];
      if (defaultAdmin) {
        setSelectedUserId(defaultAdmin.id);
        setPassword(defaultAdmin.password || 'admin');
        setError('');
      }
    }
  }, [isOpen, users]);

  if (!isOpen) return null;

  const targetUser = users.find((u) => u.id === selectedUserId);
  const isGenericAdmin = targetUser?.isInitialGeneric || targetUser?.id === 'usr-admin-initial';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!targetUser) {
      setError('Usuario no seleccionado o no encontrado.');
      return;
    }

    // Check user password or fallback
    const validPasswords = [targetUser.password, 'admin', 'admin123', '123', '123456'].filter(Boolean);
    if (password && !validPasswords.includes(password.trim())) {
      setError(`Contraseña incorrecta para ${targetUser.name}. (Clave demo: ${targetUser.password || 'admin'})`);
      return;
    }

    setCurrentUser(targetUser);
    setIsAdminActive(true);
    setMode('erp');
    onClose();
  };

  const handleAutofillPassword = () => {
    setPassword(targetUser?.password || (isGenericAdmin ? 'admin' : 'admin123'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Acceso Administrativo / ERP</h3>
              <p className="text-[11px] text-slate-400">Distribuidora La Gran Bodega M&S</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Módulo exclusivo para el personal autorizado (Administración, Gerencia, Caja y Despacho).
          </p>

          {isGenericAdmin && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Primer Administrador del Sistema (Genérico)</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Al ingresar por primera vez podrás registrar tus propios administradores en el panel de control y luego eliminar de forma segura este usuario genérico.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Seleccionar Funcionario / Usuario:
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {users.map((u) => {
                const isGeneric = u.isInitialGeneric || u.id === 'usr-admin-initial';
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                      selectedUserId === u.id
                        ? 'border-blue-600 bg-blue-50/60 font-bold text-blue-900 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="adminUser"
                        value={u.id}
                        checked={selectedUserId === u.id}
                        onChange={() => {
                          setSelectedUserId(u.id);
                          setError('');
                        }}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{u.name}</span>
                          {isGeneric && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-1.5 py-0.2 rounded-full">
                              Genérico Inicial
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">{u.email}</p>
                      </div>
                    </div>
                    <span className={`uppercase text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-200/70 text-slate-700'
                    }`}>
                      {u.role}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Contraseña de Acceso:
              </label>
              <button
                type="button"
                onClick={handleAutofillPassword}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Auto-completar clave ({targetUser?.password || (isGenericAdmin ? 'admin' : 'admin123')})
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Contraseña (ej: ${targetUser?.password || (isGenericAdmin ? 'admin' : 'admin123')})`}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              Ingresar al ERP
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
