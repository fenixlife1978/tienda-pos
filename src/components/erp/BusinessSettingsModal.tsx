import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Shield,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  Save,
  AlertCircle,
  Eye,
  FileText,
  Calendar,
  DollarSign,
  Smartphone,
  Landmark,
  BellRing,
  MessageCircle,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { SystemSettings, AcceptedPaymentMethodsConfig } from '../../types';
import { formatUSD, formatBs } from '../../utils/formatUtils';
import { scanAndGenerateReminders, AutomatedReminderRecord } from '../../services/reminderService';

interface BusinessSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BusinessSettingsModal: React.FC<BusinessSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    settings,
    updateSettings,
    triggerPushNotification,
    customers,
    invoices,
    receivables,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'perfil' | 'credito' | 'metodos' | 'recordatorios'>('perfil');
  
  const [formData, setFormData] = useState<SystemSettings>({
    companyName: settings.companyName,
    companyRif: settings.companyRif,
    companyPhone: settings.companyPhone,
    companyEmail: settings.companyEmail,
    companyAddress: settings.companyAddress,
    companyLogo: settings.companyLogo || '/logo.png',
    bcvRate: settings.bcvRate,
    autoUpdateBcv: settings.autoUpdateBcv,
    lastBcvUpdate: settings.lastBcvUpdate,
    defaultCreditDays: settings.defaultCreditDays || 7,
    defaultCreditLimitUSD: settings.defaultCreditLimitUSD || 1000,
    ivaPercentage: settings.ivaPercentage || 16,
    acceptedPaymentMethods: settings.acceptedPaymentMethods || {
      pago_movil: true,
      zelle: true,
      transferencia_bs: true,
      credito: true,
      efectivo_usd: true,
      efectivo_bs: true,
      biopago: true,
    },
    pagoMovilBank: settings.pagoMovilBank || '',
    pagoMovilPhone: settings.pagoMovilPhone || '',
    pagoMovilRif: settings.pagoMovilRif || '',
    zelleEmail: settings.zelleEmail || '',
    zelleBeneficiary: settings.zelleBeneficiary || '',
    transferenciaBank: settings.transferenciaBank || '0102 - Banco de Venezuela',
    transferenciaAccountNumber: settings.transferenciaAccountNumber || '',
    transferenciaAccountType: settings.transferenciaAccountType || 'Cuenta Corriente',
    transferenciaBeneficiary: settings.transferenciaBeneficiary || '',
    transferenciaRif: settings.transferenciaRif || '',
    autoRemindersEnabled: settings.autoRemindersEnabled ?? true,
    creditReminderThresholdPercent: settings.creditReminderThresholdPercent || 80,
  });

  const [logoPreview, setLogoPreview] = useState<string>(settings.companyLogo || '/logo.png');
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('upload');
  const [logoUrlInput, setLogoUrlInput] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanResult, setScanResult] = useState<AutomatedReminderRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...settings,
        defaultCreditDays: settings.defaultCreditDays || 7,
        defaultCreditLimitUSD: settings.defaultCreditLimitUSD || 1000,
        companyLogo: settings.companyLogo || '/logo.png',
        acceptedPaymentMethods: settings.acceptedPaymentMethods || {
          pago_movil: true,
          zelle: true,
          transferencia_bs: true,
          credito: true,
          efectivo_usd: true,
          efectivo_bs: true,
          biopago: true,
        },
        autoRemindersEnabled: settings.autoRemindersEnabled ?? true,
        creditReminderThresholdPercent: settings.creditReminderThresholdPercent || 80,
      });
      setLogoPreview(settings.companyLogo || '/logo.png');
      setSaveSuccess(false);

      // Perform initial scan
      const { newReminders } = scanAndGenerateReminders(customers, invoices, receivables, settings);
      setScanResult(newReminders);
    }
  }, [isOpen, settings, customers, invoices, receivables]);

  if (!isOpen) return null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('La imagen seleccionada es demasiado grande. Por favor selecciona una imagen menor a 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        setFormData((prev) => ({ ...prev, companyLogo: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyLogoUrl = () => {
    if (!logoUrlInput.trim()) return;
    setLogoPreview(logoUrlInput.trim());
    setFormData((prev) => ({ ...prev, companyLogo: logoUrlInput.trim() }));
  };

  const handleRestoreDefaultLogo = () => {
    setLogoPreview('/logo.png');
    setFormData((prev) => ({ ...prev, companyLogo: '/logo.png' }));
  };

  const handleTogglePaymentMethod = (method: keyof AcceptedPaymentMethodsConfig) => {
    setFormData((prev) => ({
      ...prev,
      acceptedPaymentMethods: {
        ...prev.acceptedPaymentMethods,
        [method]: !prev.acceptedPaymentMethods[method],
      },
    }));
  };

  const handleRunManualScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const { newReminders, notificationsToPush } = scanAndGenerateReminders(
        customers,
        invoices,
        receivables,
        formData
      );
      setScanResult(newReminders);
      setIsScanning(false);
      triggerPushNotification({
        title: '🔔 Escaneo de Cobranzas y Límites Completado',
        message: `Se detectaron ${newReminders.length} alertas automáticas de crédito y facturas por cobrar.`,
        type: 'credit_alert',
        badge: 'Recordatorios',
      });
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      updateSettings({
        ...formData,
        companyLogo: logoPreview,
      });

      setSaveSuccess(true);
      triggerPushNotification({
        title: '⚙️ Configuración y Políticas Actualizadas',
        message: 'La información comercial, políticas de crédito y cuentas bancarias han sido guardadas y sincronizadas.',
        type: 'bcv_update',
        badge: 'Configuración ERP',
      });

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    } catch (err) {
      console.error('Error al guardar configuración:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight">
                Datos de la Empresa & Políticas Globales
              </h3>
              <p className="text-xs text-indigo-200">
                Configure RIF, razón social, logo, políticas de crédito, cuentas bancarias y recordatorios automatizados
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('perfil')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'perfil'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Perfil, Contacto & Logo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credito')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'credito'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Políticas Globales de Crédito</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metodos')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'metodos'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Métodos de Pago & Cuentas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recordatorios')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'recordatorios'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BellRing className="w-4 h-4" />
            <span>Servicio de Recordatorios ({scanResult.length})</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">
          
          {/* TAB 1: PERFIL, CONTACTO & LOGO */}
          {activeTab === 'perfil' && (
            <div className="space-y-5">
              
              {/* Logo Section with Live Preview */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Logo Oficial de la Distribuidora
                    </h4>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md">
                    Visible en Facturas, Landing Page y Comprobantes
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Logo Preview Box */}
                  <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <div className="w-28 h-28 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-2 overflow-hidden mb-2">
                      <img
                        src={logoPreview}
                        alt="Logo Distribuidora"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/logo.png';
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Vista Previa de Logo</span>
                  </div>

                  {/* Logo Upload / URL Controls */}
                  <div className="sm:col-span-8 space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setLogoMode('upload')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                          logoMode === 'upload'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Subir Archivo (PNG/JPG)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoMode('url')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                          logoMode === 'url'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Pegar URL
                      </button>
                      <button
                        type="button"
                        onClick={handleRestoreDefaultLogo}
                        className="ml-auto text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-semibold cursor-pointer"
                      >
                        Restaurar original
                      </button>
                    </div>

                    {logoMode === 'upload' ? (
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageFileChange}
                          accept="image/png, image/jpeg, image/webp, image/svg+xml"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-3 px-4 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Seleccionar imagen desde tu dispositivo</span>
                        </button>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Recomendado: Formato transparente PNG o SVG (máx. 2MB).
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://ejemplo.com/mi-logo.png"
                          value={logoUrlInput}
                          onChange={(e) => setLogoUrlInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={handleApplyLogoUrl}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition"
                        >
                          Aplicar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Razón Social y RIF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Razón Social / Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Ej. DISTRIBUIDORA LA GRAN BODEGA M&S C.A."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Aparece en el encabezado de las facturas y el portal de clientes.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    RIF Fiscal de la Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyRif}
                    onChange={(e) => setFormData({ ...formData, companyRif: e.target.value })}
                    placeholder="Ej. J-41258963-0"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Identificador tributario oficial SENIAT.</p>
                </div>
              </div>

              {/* Canales de Contacto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    Teléfono de Contacto / WhatsApp de Ventas *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyPhone}
                    onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                    placeholder="+58 424-5751804"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Número receptor donde los clientes envían pedidos y comprobantes por WhatsApp.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-indigo-600" />
                    Correo Electrónico de Contacto *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.companyEmail}
                    onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                    placeholder="ventas@lagranbodega.com"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-600" />
                  Dirección Fiscal y Centro de Distribución *
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyAddress}
                  onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                  placeholder="Av. 3 entre calles 21 y 22, Sector Monte Oscuro, San Felipe, Edo. Yaracuy"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

            </div>
          )}

          {/* TAB 2: POLÍTICAS GLOBALES DE CRÉDITO */}
          {activeTab === 'credito' && (
            <div className="space-y-4">
              
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-700" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                    Políticas Globales de Crédito Comercial para Clientes
                  </h4>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Establezca los valores predeterminados para nuevos clientes registrados. El administrador puede seleccionar y ajustar individualmente el cupo y los días de crédito de cada cliente, con un monto máximo predeterminado estándar de <strong>$1,000 USD</strong> y <strong>7 días de crédito</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Días de crédito por defecto */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Días de Crédito Predeterminados
                  </label>
                  <select
                    value={formData.defaultCreditDays}
                    onChange={(e) => setFormData({ ...formData, defaultCreditDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold text-indigo-700"
                  >
                    <option value={7}>7 Días (Estándar por defecto)</option>
                    <option value={15}>15 Días</option>
                    <option value={21}>21 Días</option>
                    <option value={30}>30 Días</option>
                    <option value={45}>45 Días</option>
                    <option value={60}>60 Días</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Plazo asignado automáticamente al crear o registrar un nuevo cliente.
                  </p>
                </div>

                {/* Límite predeterminado */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto Máximo Predeterminado (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      step={50}
                      value={formData.defaultCreditLimitUSD}
                      onChange={(e) => setFormData({ ...formData, defaultCreditLimitUSD: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Monto de crédito estándar ($1,000 USD predeterminado).
                  </p>
                </div>

                {/* IVA General */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alícuota IVA General (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formData.ivaPercentage}
                      onChange={(e) => setFormData({ ...formData, ivaPercentage: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Tributo fiscal SENIAT (16% estándar).
                  </p>
                </div>
              </div>

              {/* Políticas de Aprobación de Órdenes a Crédito */}
              <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-700" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-blue-900">
                    Flujo de Aprobación de Facturas a Crédito
                  </h4>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Cuando un cliente envía una compra a <strong>Crédito Comercial</strong> por la aplicación, el pedido se registra como <em>Orden de Pedido en espera de aprobación</em>. La factura fiscal definitiva solo se emitirá y estará disponible para descarga cuando el administrador marque el pedido como <em>Recibido / Aprobado y Despachado</em>.
                </p>
              </div>

              {/* Automatización de recordatorios */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-indigo-600" />
                    Recordatorios Automáticos de Límite y Facturas Vencidas
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Genera avisos automáticos por WhatsApp cuando un cliente llega al {formData.creditReminderThresholdPercent}% de su cupo o tiene facturas vencidas.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoRemindersEnabled}
                    onChange={(e) => setFormData({ ...formData, autoRemindersEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

            </div>
          )}

          {/* TAB 3: MÉTODOS DE PAGO ACEPTADOS & CUENTAS */}
          {activeTab === 'metodos' && (
            <div className="space-y-5">
              
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wider">
                  <Landmark className="w-4 h-4 text-emerald-700" />
                  Métodos de Pago Habilitados para Clientes de la Aplicación
                </div>
                <p className="text-xs text-emerald-800">
                  Por requerimiento de la distribuidora, los clientes al pagar por la aplicación tienen acceso exclusivo a: <strong>Pago Móvil</strong>, <strong>Zelle</strong>, <strong>Transferencia Bancaria</strong> y <strong>Crédito Comercial</strong>.
                </p>
              </div>

              {/* Grid of 4 accepted payment methods toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Pago Movil */}
                <div
                  onClick={() => handleTogglePaymentMethod('pago_movil')}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    formData.acceptedPaymentMethods.pago_movil
                      ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Smartphone className="w-5 h-5 text-sky-600" />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${formData.acceptedPaymentMethods.pago_movil ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {formData.acceptedPaymentMethods.pago_movil ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-bold text-slate-900">Pago Móvil</p>
                    <p className="text-[10px] text-slate-500">Tasa oficial BCV</p>
                  </div>
                </div>

                {/* Zelle */}
                <div
                  onClick={() => handleTogglePaymentMethod('zelle')}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    formData.acceptedPaymentMethods.zelle
                      ? 'border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${formData.acceptedPaymentMethods.zelle ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {formData.acceptedPaymentMethods.zelle ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-bold text-slate-900">Zelle (USD)</p>
                    <p className="text-[10px] text-slate-500">Dólares exactos</p>
                  </div>
                </div>

                {/* Transferencia Bancaria */}
                <div
                  onClick={() => handleTogglePaymentMethod('transferencia_bs')}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    formData.acceptedPaymentMethods.transferencia_bs
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Landmark className="w-5 h-5 text-blue-600" />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${formData.acceptedPaymentMethods.transferencia_bs ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {formData.acceptedPaymentMethods.transferencia_bs ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-bold text-slate-900">Transferencia</p>
                    <p className="text-[10px] text-slate-500">Cuentas nacionales</p>
                  </div>
                </div>

                {/* Credito Comercial */}
                <div
                  onClick={() => handleTogglePaymentMethod('credito')}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    formData.acceptedPaymentMethods.credito
                      ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <CreditCard className="w-5 h-5 text-amber-600" />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${formData.acceptedPaymentMethods.credito ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {formData.acceptedPaymentMethods.credito ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-bold text-slate-900">Crédito Comercial</p>
                    <p className="text-[10px] text-slate-500">Con cupo y plazo</p>
                  </div>
                </div>
              </div>

              {/* 1. Datos Pago Móvil */}
              <div className="p-4 bg-sky-50/50 rounded-2xl border border-sky-200 space-y-3">
                <p className="font-bold text-sky-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-sky-600" />
                  Datos de Pago Móvil Interbancario
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Banco Destino</label>
                    <input
                      type="text"
                      value={formData.pagoMovilBank}
                      onChange={(e) => setFormData({ ...formData, pagoMovilBank: e.target.value })}
                      placeholder="0102 - Banco de Venezuela"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono Pago Móvil</label>
                    <input
                      type="text"
                      value={formData.pagoMovilPhone}
                      onChange={(e) => setFormData({ ...formData, pagoMovilPhone: e.target.value })}
                      placeholder="0424-5751804"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cédula / RIF</label>
                    <input
                      type="text"
                      value={formData.pagoMovilRif}
                      onChange={(e) => setFormData({ ...formData, pagoMovilRif: e.target.value })}
                      placeholder="J-41258963-0"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Datos Zelle */}
              <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3">
                <p className="font-bold text-purple-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                  Datos de Cuenta Zelle (USD)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico Zelle</label>
                    <input
                      type="email"
                      value={formData.zelleEmail}
                      onChange={(e) => setFormData({ ...formData, zelleEmail: e.target.value })}
                      placeholder="pagos@empresa.com"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Titular o Razón Social Zelle</label>
                    <input
                      type="text"
                      value={formData.zelleBeneficiary}
                      onChange={(e) => setFormData({ ...formData, zelleBeneficiary: e.target.value })}
                      placeholder="La Gran Bodega M&S Inversiones LLC"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Datos Transferencia Bancaria */}
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-3">
                <p className="font-bold text-blue-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  Datos de Cuenta para Transferencia Bancaria Nacional
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Banco Receptor</label>
                    <input
                      type="text"
                      value={formData.transferenciaBank}
                      onChange={(e) => setFormData({ ...formData, transferenciaBank: e.target.value })}
                      placeholder="0102 - Banco de Venezuela"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Número de Cuenta (20 Dígitos)</label>
                    <input
                      type="text"
                      value={formData.transferenciaAccountNumber}
                      onChange={(e) => setFormData({ ...formData, transferenciaAccountNumber: e.target.value })}
                      placeholder="0102-0123-4500-0012-3456"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Cuenta</label>
                    <select
                      value={formData.transferenciaAccountType}
                      onChange={(e) => setFormData({ ...formData, transferenciaAccountType: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium"
                    >
                      <option value="Cuenta Corriente">Cuenta Corriente</option>
                      <option value="Cuenta de Ahorros">Cuenta de Ahorros</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Titular de la Cuenta / Beneficiario</label>
                    <input
                      type="text"
                      value={formData.transferenciaBeneficiary || formData.companyName}
                      onChange={(e) => setFormData({ ...formData, transferenciaBeneficiary: e.target.value })}
                      placeholder="DISTRIBUIDORA LA GRAN BODEGA M&S C.A."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">RIF del Titular</label>
                    <input
                      type="text"
                      value={formData.transferenciaRif || formData.companyRif}
                      onChange={(e) => setFormData({ ...formData, transferenciaRif: e.target.value })}
                      placeholder="J-41258963-0"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: SERVICIO DE RECORDATORIOS AUTOMÁTICOS */}
          {activeTab === 'recordatorios' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-2xl">
                <div>
                  <h4 className="text-sm font-extrabold flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-emerald-400" />
                    Cron Job & Bandeja de Recordatorios de Cobro
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Monitorea en segundo plano facturas vencidas y clientes con uso de cupo igual o mayor al {formData.creditReminderThresholdPercent}%.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunManualScan}
                  disabled={isScanning}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Escaneando...' : 'Ejecutar Escaneo Ahora'}</span>
                </button>
              </div>

              {scanResult.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800">¡Cartera de Crédito al Día!</p>
                  <p className="text-xs text-slate-500 mt-1">
                    No hay clientes con facturas vencidas ni consumos de crédito superiores al {formData.creditReminderThresholdPercent}%.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Alertas y Mensajes Listos para Envío ({scanResult.length}):
                  </p>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {scanResult.map((rem) => (
                      <div
                        key={rem.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-indigo-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                rem.reminderType === 'overdue_invoice'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {rem.reminderType === 'overdue_invoice' ? 'Factura Vencida' : 'Límite de Crédito'}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate">{rem.customerName}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {rem.message}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Tel: {rem.customerPhone} • {formatUSD(rem.amountUSD)} USD (≈ {formatBs(rem.amountBs)})
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={rem.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Enviar WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            {saveSuccess ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>¡Datos de la distribuidora y políticas de crédito guardadas exitosamente!</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">
                Los cambios se guardan y reflejan inmediatamente en encabezados de factura, WhatsApp y landing page.
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
