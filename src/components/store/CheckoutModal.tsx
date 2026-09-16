import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod } from '../../types';
import {
  X,
  CreditCard,
  Building2,
  DollarSign,
  Smartphone,
  Truck,
  Store,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileText,
  Landmark,
  CheckCircle2,
} from 'lucide-react';
import { formatUSD, formatBs } from '../../utils/formatUtils';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { cart, currentCustomer, settings, createOrder, setSelectedInvoiceForModal, setLastSuccessfulOrder } = useApp();

  const [name, setName] = useState(currentCustomer?.name || '');
  const [rif, setRif] = useState(currentCustomer?.rif || '');
  const [phone, setPhone] = useState(currentCustomer?.phone || '');
  const [address, setAddress] = useState(currentCustomer?.address || '');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  
  // Default to pago_movil or first available allowed method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pago_movil');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Calculate totals
  const subtotalUSD = cart.reduce((sum, item) => {
    const price = item.product.isOffer && item.product.discountPercentage
      ? item.product.priceUSD * (1 - item.product.discountPercentage / 100)
      : item.product.priceUSD;
    return sum + price * item.quantity;
  }, 0);

  const taxUSD = subtotalUSD * (settings.ivaPercentage / 100);
  const totalUSD = subtotalUSD + taxUSD;
  const totalBs = totalUSD * settings.bcvRate;

  // Credit validation
  const creditAvailableUSD = currentCustomer
    ? Math.max(0, currentCustomer.creditLimitUSD - currentCustomer.currentDebtUSD)
    : 0;

  const canUseCredit = Boolean(
    currentCustomer &&
    currentCustomer.hasCredit &&
    creditAvailableUSD >= totalUSD
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (paymentMethod === 'credito' && !canUseCredit) {
      alert('No dispone de suficiente crédito comercial disponible para esta orden.');
      return;
    }

    if (paymentMethod === 'pago_movil' && !paymentReference.trim()) {
      alert('Por favor ingrese el número de referencia del Pago Móvil.');
      return;
    }

    if (paymentMethod === 'transferencia_bs' && !paymentReference.trim()) {
      alert('Por favor ingrese el número de comprobante o referencia de la transferencia bancaria.');
      return;
    }

    if (paymentMethod === 'zelle' && !paymentReference.trim()) {
      alert('Por favor ingrese el titular o referencia del pago Zelle.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { order } = createOrder({
        customerId: currentCustomer?.id || 'cust-generic',
        customerName: name || 'Cliente Mostrador',
        customerRif: rif || 'V-00000000',
        customerPhone: phone || '0414-0000000',
        customerAddress: deliveryType === 'pickup' ? 'Retiro en Tienda Principal' : address,
        items: cart,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        channel: 'online',
        notes: `${deliveryType === 'delivery' ? 'Entrega a Domicilio' : 'Retiro en Tienda'} - ${notes}`,
        customCreditDays: currentCustomer?.creditDays || settings.defaultCreditDays,
      });

      setLastSuccessfulOrder(order);
      onClose();
      onSuccess(order.id);
    } catch (err) {
      console.error(err);
      alert('Hubo un error al procesar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Confirmar Pedido y Datos de Entrega</h3>
            <p className="text-xs text-slate-500">El pedido se enviará a nuestro equipo para validación y despacho inmediato.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
          
          {/* Order items preview summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex justify-between font-bold text-slate-700">
              <span>Resumen de Productos ({cart.length}):</span>
              <span className="font-mono text-indigo-700">{formatUSD(totalUSD)} USD</span>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-slate-600">
              {cart.map((it) => (
                <div key={it.id} className="flex justify-between items-center text-[11px]">
                  <span className="truncate max-w-[280px]">{it.quantity}x {it.product.name}</span>
                  <span className="font-mono font-medium">{formatUSD(it.unitPriceUSD * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-emerald-700">
              <span>Total en Bolívares (Tasa BCV {settings.bcvRate.toFixed(2)}):</span>
              <span className="font-mono">{formatBs(totalBs)}</span>
            </div>
          </div>

          {/* Delivery or Pickup selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDeliveryType('delivery')}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition cursor-pointer ${
                deliveryType === 'delivery'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>Despacho a Domicilio</span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition cursor-pointer ${
                deliveryType === 'pickup'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Store className="w-4 h-4 text-indigo-600" />
              <span>Retiro en Tienda</span>
            </button>
          </div>

          {/* Customer fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre o Razón Social *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej. Comercial Los Andes C.A."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">RIF o Cédula *</label>
              <input
                type="text"
                required
                value={rif}
                onChange={(e) => setRif(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej. J-40123456-7"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej. 0424-5751804"
              />
            </div>

            {deliveryType === 'delivery' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección Exacta de Entrega *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Calle, Galpón/Local, Punto de referencia..."
                />
              </div>
            )}
          </div>

          {/* Payment Method Selector: Only the 4 allowed online methods: Pago Móvil, Zelle, Transferencia, Crédito */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Método de Pago
              </h4>
              <span className="text-[10px] text-slate-500">
                4 Métodos disponibles para compras en línea
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* 1. Pago Móvil */}
              <button
                type="button"
                onClick={() => setPaymentMethod('pago_movil')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'pago_movil'
                    ? 'border-sky-600 bg-sky-50 text-sky-950 font-bold ring-2 ring-sky-500/20 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Smartphone className="w-4 h-4 mb-1 text-sky-600" />
                <p className="font-bold">Pago Móvil</p>
                <p className="text-[10px] text-slate-500">Tasa oficial BCV</p>
              </button>

              {/* 2. Zelle */}
              <button
                type="button"
                onClick={() => setPaymentMethod('zelle')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'zelle'
                    ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4 mb-1 text-purple-600" />
                <p className="font-bold">Zelle</p>
                <p className="text-[10px] text-slate-500">Dólares exactos</p>
              </button>

              {/* 3. Transferencia Bancaria */}
              <button
                type="button"
                onClick={() => setPaymentMethod('transferencia_bs')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'transferencia_bs'
                    ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Landmark className="w-4 h-4 mb-1 text-blue-600" />
                <p className="font-bold">Transferencia</p>
                <p className="text-[10px] text-slate-500">Bancos nacionales</p>
              </button>

              {/* 4. Crédito Comercial */}
              <button
                type="button"
                disabled={!canUseCredit}
                onClick={() => setPaymentMethod('credito')}
                className={`p-2.5 rounded-xl border text-left text-xs transition ${
                  !canUseCredit
                    ? 'opacity-40 bg-slate-100 cursor-not-allowed border-slate-200'
                    : paymentMethod === 'credito'
                    ? 'border-amber-600 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20 shadow-xs cursor-pointer'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer'
                }`}
              >
                <CreditCard className="w-4 h-4 mb-1 text-amber-600" />
                <p className="font-bold">Crédito Comercial</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {canUseCredit ? `${currentCustomer?.creditDays || 7} días (${formatUSD(creditAvailableUSD)} disp.)` : 'Sin cupo disponible'}
                </p>
              </button>
            </div>

            {/* Payment Method Details & Inputs */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              
              {/* Pago Móvil Details */}
              {paymentMethod === 'pago_movil' && (
                <div className="space-y-2.5">
                  <p className="font-bold text-slate-900">Datos Oficiales para Pago Móvil:</p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-slate-700">
                    <p>Banco: <strong className="text-slate-900 font-sans">{settings.pagoMovilBank || '0102 - Banco de Venezuela'}</strong></p>
                    <p>Teléfono: <strong className="text-slate-900">{settings.pagoMovilPhone || settings.companyPhone}</strong></p>
                    <p>RIF: <strong className="text-slate-900">{settings.pagoMovilRif || settings.companyRif}</strong></p>
                  </div>
                  <p className="text-sky-700 font-bold font-mono">
                    Monto a Transferir: {formatBs(totalBs)}
                  </p>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Número de Referencia del Pago Móvil *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
                      placeholder="Ej: 19827364 (Últimos 6 u 8 dígitos)"
                    />
                  </div>
                </div>
              )}

              {/* Zelle Details */}
              {paymentMethod === 'zelle' && (
                <div className="space-y-2.5">
                  <p className="font-bold text-slate-900">Datos de Cuenta Zelle:</p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 text-slate-700">
                    <p>Correo Zelle: <strong className="text-slate-900 font-mono">{settings.zelleEmail || settings.companyEmail}</strong></p>
                    <p>Titular Registrado: <strong className="text-slate-900">{settings.zelleBeneficiary || settings.companyName}</strong></p>
                  </div>
                  <p className="text-purple-700 font-bold font-mono">
                    Monto Exacto a Transferir: {formatUSD(totalUSD)} USD
                  </p>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nombre del Titular de la Cuenta Zelle emisora o Referencia *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Ej: Nombre Titular Zelle / Ref de envío"
                    />
                  </div>
                </div>
              )}

              {/* Transferencia Bancaria Details */}
              {paymentMethod === 'transferencia_bs' && (
                <div className="space-y-2.5">
                  <p className="font-bold text-slate-900">Datos para Transferencia Bancaria Nacional:</p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-slate-700">
                    <p>Banco: <strong className="text-slate-900 font-sans">{settings.transferenciaBank || '0102 - Banco de Venezuela'}</strong></p>
                    <p>Cuenta: <strong className="text-slate-900">{settings.transferenciaAccountNumber || '0102-0140-33-0000458921'}</strong> ({settings.transferenciaAccountType || 'Corriente'})</p>
                    <p>Titular: <strong className="text-slate-900 font-sans">{settings.transferenciaBeneficiary || settings.companyName}</strong> | RIF: <strong className="text-slate-900">{settings.transferenciaRif || settings.companyRif}</strong></p>
                  </div>
                  <p className="text-blue-700 font-bold font-mono">
                    Total a Transferir: {formatBs(totalBs)}
                  </p>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Número de Comprobante / Referencia Bancaria *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="Ej: BAN-84729103"
                    />
                  </div>
                </div>
              )}

              {/* Crédito Comercial Details */}
              {paymentMethod === 'credito' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Crédito Comercial Aprobado</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    Plazo asignado: <strong>{currentCustomer?.creditDays || settings.defaultCreditDays} días</strong>.
                    Cupo disponible: <strong className="font-mono text-emerald-700">{formatUSD(creditAvailableUSD)}</strong>.
                  </p>
                  <div className="p-2.5 bg-amber-100/70 border border-amber-300 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                    ⏳ <strong>Flujo de Aprobación:</strong> Este pedido se generará como <em>Orden de Pedido a Crédito (En espera de aprobación)</em>. El administrador validará tu cupo para marcarlo como aprobado y despachado, tras lo cual tu Factura Fiscal oficial estará lista para descarga.
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notas u Observaciones del Pedido (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales de entrega o despacho..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Volver al Carrito
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (paymentMethod === 'credito' && !canUseCredit)}
              className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Procesando...' : 'Confirmar y Enviar Pedido'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
