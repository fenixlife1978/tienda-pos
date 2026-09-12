import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import {
  X,
  UserCheck,
  Building2,
  Lock,
  Mail,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  Bell,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register';
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'login',
}) => {
  const { customers, currentCustomer, loginCustomer, registerCustomer, logoutCustomer } = useApp();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setLoginError('');
      setRegError('');
    }
  }, [isOpen, initialTab]);

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register state
  const [regType, setRegType] = useState<'empresa' | 'natural'>('empresa');
  const [regName, setRegName] = useState('');
  const [regRif, setRegRif] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRequestCredit, setRegRequestCredit] = useState(true);
  const [regCreditDays, setRegCreditDays] = useState(15);
  const [regCreditLimit, setRegCreditLimit] = useState(1000);
  const [regPushNotifications, setRegPushNotifications] = useState(true);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginIdentifier.trim()) {
      setLoginError('Ingresa tu correo o RIF');
      return;
    }

    const success = loginCustomer(loginIdentifier.trim(), loginPassword);
    if (success) {
      onClose();
    } else {
      setLoginError('No encontramos una cuenta con esos datos. Verifica o regístrate.');
    }
  };

  const handleQuickLogin = (cust: Customer) => {
    loginCustomer(cust.rif, cust.password || 'demo123');
    onClose();
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regName.trim() || !regRif.trim() || !regPhone.trim() || !regAddress.trim()) {
      setRegError('Por favor completa todos los campos obligatorios (*).');
      return;
    }

    // Check if RIF or email already exists
    const exists = customers.some(
      (c) =>
        c.rif.toLowerCase() === regRif.trim().toLowerCase() ||
        (regEmail && c.email.toLowerCase() === regEmail.trim().toLowerCase())
    );

    if (exists) {
      setRegError('Ya existe un cliente registrado con este RIF o Correo.');
      return;
    }

    const newCustomer = registerCustomer({
      name: regName.trim(),
      rif: regRif.trim().toUpperCase(),
      email: regEmail.trim(),
      phone: regPhone.trim(),
      address: regAddress.trim(),
      hasCredit: regRequestCredit,
      creditDays: regRequestCredit ? regCreditDays : 0,
      creditLimitUSD: regRequestCredit ? regCreditLimit : 0,
      currentDebtUSD: 0,
      password: regPassword || '123456',
      notificationPreferences: {
        orderStatus: regPushNotifications,
        promotions: regPushNotifications,
        creditAlerts: true,
        soundEnabled: true,
        channel: 'push',
      },
    });

    setRegSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15">
              <Building2 className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">Portal de Clientes & Comercios</h3>
              <p className="text-xs text-blue-200">Accede a tus precios mayoristas, crédito y pedidos online</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setLoginError('');
            }}
            className={`py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setRegError('');
            }}
            className={`py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Registrar Nuevo Cliente</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {activeTab === 'login' ? (
            /* LOGIN TAB */
            <div className="space-y-5">
              {currentCustomer ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-sm">Sesión Activa Actualmente</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Estás conectado como <span className="font-bold">{currentCustomer.name}</span> ({currentCustomer.rif}).
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Continuar Comprando
                    </button>
                    <button
                      type="button"
                      onClick={() => logoutCustomer()}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      RIF o Correo Electrónico *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="Ej. J-40123456-7 o cliente@empresa.com"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Contraseña *
                      </label>
                      <span className="text-[11px] text-blue-600 cursor-pointer hover:underline">
                        ¿Olvidaste tu clave?
                      </span>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder="Ingresa tu contraseña"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <span>Ingresar a Mi Cuenta</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Quick Login Presets for convenient testing */}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-[11px] uppercase font-bold text-slate-600 mb-2">
                  Cuentas de Clientes Registrados (Acceso Rápido Demo):
                </p>
                <div className="space-y-2">
                  {customers.slice(0, 3).map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => handleQuickLogin(cust)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between transition cursor-pointer text-left"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800">{cust.name}</p>
                        <p className="text-[10px] text-slate-600">RIF: {cust.rif} • {cust.hasCredit ? `Crédito: $${cust.creditLimitUSD} (${cust.creditDays}d)` : 'Contado'}</p>
                      </div>
                      <span className="text-xs font-semibold text-blue-600 hover:underline">
                        Conectar →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* REGISTER TAB */
            <form onSubmit={handleRegister} className="space-y-4">
              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>¡Registro exitoso! Conectando con tu cuenta...</span>
                </div>
              )}

              {/* Type selector */}
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRegType('empresa')}
                  className={`py-2 px-3 rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    regType === 'empresa'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Empresa / Comercio (RIF J-)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegType('natural')}
                  className={`py-2 px-3 rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    regType === 'natural'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Persona Natural (Cédula V-)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {regType === 'empresa' ? 'Razón Social *' : 'Nombre Completo *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={regType === 'empresa' ? 'Ej. Abasto San Juan C.A.' : 'Ej. Juan Pérez'}
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {regType === 'empresa' ? 'RIF Fiscal *' : 'Cédula de Identidad *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={regType === 'empresa' ? 'J-12345678-9' : 'V-12345678'}
                    value={regRif}
                    onChange={(e) => setRegRif(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    WhatsApp / Teléfono Móvil *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="+58 412-1234567"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">Para recibir alertas push de pedidos</span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="contacto@empresa.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-bold text-slate-700 mb-1">
                  Dirección de Entrega y Facturación *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    required
                    rows={2}
                    placeholder="Calle, Sector, Local/Piso, Punto de referencia para el repartidor"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Commercial Credit Request Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                  <input
                    type="checkbox"
                    checked={regRequestCredit}
                    onChange={(e) => setRegRequestCredit(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Solicitar Línea de Crédito Comercial</span>
                </label>

                {regRequestCredit && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-600 mb-1">Plazo Solicitado:</span>
                      <select
                        value={regCreditDays}
                        onChange={(e) => setRegCreditDays(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value={7}>7 días de crédito</option>
                        <option value={15}>15 días de crédito</option>
                        <option value={30}>30 días de crédito</option>
                        <option value={45}>45 días de crédito</option>
                      </select>
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-600 mb-1">Monto Límite USD:</span>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={regCreditLimit}
                        onChange={(e) => setRegCreditLimit(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Push notifications opt-in */}
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={regPushNotifications}
                  onChange={(e) => setRegPushNotifications(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                />
                <Bell className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                <span>
                  Activar <span className="font-semibold text-blue-700">Notificaciones Push en tiempo real</span> sobre el estado de mis pedidos, despachos en camino y promociones especiales.
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Crear Cuenta Comercial y Empezar</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Tus datos comerciales y pedidos están protegidos bajo cifrado local seguro.</span>
        </div>
      </div>
    </div>
  );
};
