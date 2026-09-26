import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, User as UserIcon, X, AlertCircle, Eye, EyeOff, LogIn, Shield } from 'lucide-react';
import { Role } from '../../types';
import { tursoService } from '../../services/tursoService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const { users, setCurrentUser, setIsAdminActive, setMode } = useApp();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // El administrador semilla siempre usa estas credenciales centralizadas.
      // No depender de users/localStorage: la sincronización con Turso puede cambiar
      // esa lista mientras el modal está abierto y no debe alterar lo que escribe el usuario.
      setUsername('admin');
      setPassword('');
      setSelectedRole('admin');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = password;

    if (!trimmedUser) {
      setError('Por favor ingresa tu usuario o correo.');
      return;
    }
    if (!trimmedPass) {
      setError('Por favor ingresa tu contraseña.');
      return;
    }

    // Authentication is verified against centralized Turso, not this browser's cached users.
    const cloudUser = await tursoService.authenticateUser(trimmedUser, trimmedPass, selectedRole);
    if (!cloudUser) {
      setError('Usuario o contraseña incorrectos, o usuario inactivo.');
      return;
    }
    const matchedUser = cloudUser;


    setCurrentUser(matchedUser);
    setIsAdminActive(true);
    setMode('erp');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        
        {/* Header con Logo Oficial */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white p-1 border border-slate-700 shadow-xs flex items-center justify-center shrink-0">
              <img
                src="./logo.png"
                alt="Distribuidora La Gran Bodega M&S"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm">Acceso Administrativo / ERP</h3>
              <p className="text-[11px] text-slate-400">Distribuidora La Gran Bodega M&S</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario solo con USUARIO, CONTRASEÑA Y ROL (SELECTOR) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Campo: USUARIO */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Usuario:
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario o correo"
                className="w-full pl-9 pr-3 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Campo: CONTRASEÑA */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Contraseña:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                className="w-full pl-9 pr-10 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Campo: ROL (SELECTOR) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Rol (Selector):
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedRole}
                onChange={(e) => {
                  const newRole = e.target.value as Role;
                  setSelectedRole(newRole);
                  // Cambiar el rol no debe sobrescribir usuario ni contraseña.
                  // La autenticación siempre se valida contra Turso en el servidor.
                }}
                className="w-full pl-9 pr-8 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-slate-50/50 text-slate-800 cursor-pointer"
              >
                <option value="admin">Administrador</option>
                <option value="gerente">Gerente</option>
                <option value="cajero">Cajero</option>
                <option value="despachador">Despachador</option>
              </select>
            </div>
          </div>

          {/* Botones de acción para ingresar */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Ingresar al Sistema</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
