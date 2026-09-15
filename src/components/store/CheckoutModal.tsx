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
  Banknote,
  Fingerprint,
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
      alert('Por favor ingrese el número de comprobante o referencia de la transferencia.');
      return;
    }

    if (paymentMethod === 'zelle' && !paymentReference.trim()) {
      alert('Por favor ingrese el titular o confirmación del pago Zelle.');
      return;
    }

    if (paymentMethod === 'biopago' && !paymentReference.trim()) {
      alert('Por favor ingrese el número de cédula del titular o código de aprobación Biopago.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { order, invoice } = createOrder({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Confirmar Pedido y Datos de Entrega</h3>
            <p className="text-xs text-slate-500">El pedido se enviará en estado "En trámite" para validación y despacho inmediato.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Order Summary banner */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 font-medium">Total a Pagar ({cart.length} productos):</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-blue-900 font-mono">{formatUSD(totalUSD)} USD</span>
                <span className="text-xs font-semibold text-blue-800 font-mono">
                  ≈ {formatBs(totalBs)}
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-blue-600">
              <p>Tasa BCV: <strong>{settings.bcvRate.toFixed(2)} Bs/$</strong></p>
              <p>IVA (16%) Incluido</p>
            </div>
          </div>

          {/* Customer Data */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Datos del Cliente / Facturación
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="Ej: Bodegón La Sultana"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  RIF o Cédula de Identidad *
                </label>
                <input
                  type="text"
                  required
                  value={rif}
                  onChange={(e) => setRif(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  placeholder="Ej: J-40982314-5"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Teléfono de Contacto *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  placeholder="Ej: 0414-1234567"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de Despacho
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      deliveryType === 'delivery'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" /> Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      deliveryType === 'pickup'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" /> Retiro Tienda
                  </button>
                </div>
              </div>
            </div>

            {deliveryType === 'delivery' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dirección Exacta de Entrega *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="Calle, Edificio/Local, Punto de referencia..."
                />
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Método de Pago
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Efectivo Bs. */}
              <button
                type="button"
                onClick={() => setPaymentMethod('efectivo_bs')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'efectivo_bs'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-semibold ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Banknote className="w-4 h-4 mb-1 text-emerald-600" />
                <p className="font-semibold">Efectivo Bs.</p>
                <p className="text-[10px] text-slate-500">Tasa BCV oficial</p>
              </button>

              {/* Biopago */}
              <button
                type="button"
                onClick={() => setPaymentMethod('biopago')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'biopago'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Fingerprint className="w-4 h-4 mb-1 text-indigo-600" />
                <p className="font-semibold">Biopago</p>
                <p className="text-[10px] text-slate-500">BDV / Huella</p>
              </button>

              {/* Transferencia */}
              <button
                type="button"
                onClick={() => setPaymentMethod('transferencia_bs')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'transferencia_bs'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4 mb-1 text-blue-600" />
                <p className="font-semibold">Transferencia</p>
                <p className="text-[10px] text-slate-500">Banesco / BDV</p>
              </button>

              {/* Zelle */}
              <button
                type="button"
                onClick={() => setPaymentMethod('zelle')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'zelle'
                    ? 'border-purple-600 bg-purple-50/70 text-purple-900 font-semibold ring-1 ring-purple-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4 mb-1 text-purple-600" />
                <p className="font-semibold">Zelle</p>
                <p className="text-[10px] text-slate-500">Dólares exactos</p>
              </button>

              {/* Pago Móvil */}
              <button
                type="button"
                onClick={() => setPaymentMethod('pago_movil')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'pago_movil'
                    ? 'border-sky-600 bg-sky-50/70 text-sky-900 font-semibold ring-1 ring-sky-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Smartphone className="w-4 h-4 mb-1 text-sky-600" />
                <p className="font-semibold">Pago Móvil</p>
                <p className="text-[10px] text-slate-500">Tasa BCV oficial</p>
              </button>

              {/* Efectivo USD */}
              <button
                type="button"
                onClick={() => setPaymentMethod('efectivo_usd')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'efectivo_usd'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-semibold ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4 mb-1 text-emerald-600" />
                <p className="font-semibold">Efectivo USD</p>
                <p className="text-[10px] text-slate-500">Contra entrega ($)</p>
              </button>

              {/* Crédito Comercial */}
              <button
                type="button"
                disabled={!canUseCredit}
                onClick={() => setPaymentMethod('credito')}
                className={`p-2.5 rounded-xl border text-left text-xs transition sm:col-span-2 ${
                  !canUseCredit
                    ? 'opacity-40 bg-slate-100 cursor-not-allowed border-slate-200'
                    : paymentMethod === 'credito'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-semibold ring-1 ring-amber-500 cursor-pointer'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer'
                }`}
              >
                <CreditCard className="w-4 h-4 mb-1 text-amber-600" />
                <p className="font-semibold">Crédito Comercial</p>
                <p className="text-[10px] text-slate-500">
                  {currentCustomer?.creditDays || 15} días de plazo ({canUseCredit ? 'Disponible' : 'Cupo no disponible'})
                </p>
              </button>
            </div>

            {/* Payment method instructions & data */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              {/* Efectivo Bs. */}
              {paymentMethod === 'efectivo_bs' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Pago en Efectivo Bolívares (Tasa Oficial BCV)</span>
                  </div>
                  <p className="text-slate-600">
                    Total a cancelar en Bolívares: <strong className="text-emerald-700 font-mono text-sm">{formatBs(totalBs)}</strong> (Tasa: {settings.bcvRate.toFixed(2)} Bs/USD).
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Cancela en efectivo al recibir tu despacho o al retirar en tienda. Si requieres vuelto, por favor especifica en las notas con qué denominación de billetes pagarás.
                  </p>
                </div>
              )}

              {/* Biopago */}
              {paymentMethod === 'biopago' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-indigo-800 font-bold">
                    <Fingerprint className="w-4 h-4 text-indigo-600" />
                    <span>Terminal Biopago BDV / Débito</span>
                  </div>
                  <p className="text-slate-600">
                    Total a debitar: <strong className="text-indigo-700 font-mono text-sm">{formatBs(totalBs)}</strong> (Tasa oficial BCV: {settings.bcvRate.toFixed(2)} Bs/USD).
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    El cobro se procesa a través de la plataforma Biopago con huella dactilar o tarjeta de débito registrada en BDV u otros bancos afiliados.
                  </p>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Cédula de Identidad del Titular o Nro. de Aprobación Biopago *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="Ej: V-12345678 o Código Operación"
                    />
                  </div>
                </div>
              )}

              {/* Transferencia */}
              {paymentMethod === 'transferencia_bs' && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Datos para Transferencia Bancaria:</p>
                  <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-200">
                    <p className="text-slate-600">
                      <strong>Banesco:</strong> Cuenta Corriente 0134-0982-11-0001928374
                    </p>
                    <p className="text-slate-600">
                      <strong>Banco de Venezuela:</strong> Cuenta Corriente 0102-0140-33-0000458921
                    </p>
                    <p className="text-slate-600">
                      Titular: <strong>{settings.companyName}</strong> | RIF: <strong>{settings.companyRif}</strong>
                    </p>
                  </div>
                  <p className="text-blue-700 font-bold font-mono">
                    Total a transferir: {formatBs(totalBs)}
                  </p>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Número de Comprobante / Referencia Bancaria *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="Ej: BAN-84729103"
                    />
                  </div>
                </div>
              )}

              {/* Zelle */}
              {paymentMethod === 'zelle' && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Datos para pago en Zelle:</p>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-0.5">
                    <p className="text-slate-600">Correo Electrónico: <strong className="text-slate-900">{settings.zelleEmail}</strong></p>
                    <p className="text-slate-600">Beneficiario Registrado: <strong className="text-slate-900">{settings.zelleBeneficiary}</strong></p>
                  </div>
                  <p className="text-purple-700 font-bold font-mono">Monto exacto a transferir: {formatUSD(totalUSD)} USD</p>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nombre del Titular de la cuenta Zelle emisora o Referencia *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Ej: Juan Pérez / Zelle Ref"
                    />
                  </div>
                </div>
              )}

              {/* Pago Móvil */}
              {paymentMethod === 'pago_movil' && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Datos para realizar el Pago Móvil:</p>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-0.5">
                    <p className="text-slate-600">
                      Banco: <strong>{settings.pagoMovilBank}</strong> | Teléfono: <strong>{settings.pagoMovilPhone}</strong> | RIF: <strong>{settings.pagoMovilRif}</strong>
                    </p>
                  </div>
                  <p className="text-sky-700 font-bold font-mono">
                    Monto a transferir: {formatBs(totalBs)}
                  </p>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Número de Referencia del Pago Móvil *
                    </label>
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
                      placeholder="Ej: 19827364"
                    />
                  </div>
                </div>
              )}

              {/* Efectivo USD */}
              {paymentMethod === 'efectivo_usd' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <p>
                      Cancela en dólares en efectivo al recibir tu despacho o al retirar en tienda. Monto total a entregar: <strong className="font-mono text-emerald-700 font-bold">{formatUSD(totalUSD)} USD</strong>.
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Por favor indicar en las notas del pedido la denominación de los billetes con los que cancelará si requiere cambio/vuelto.
                  </p>
                </div>
              )}

              {/* Crédito Comercial */}
              {paymentMethod === 'credito' && (
                <div className="space-y-1 text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Línea de Crédito Comercial Aprobada</span>
                  </div>
                  <p className="text-xs">
                    Plazo de pago asignado: <strong>{currentCustomer?.creditDays || 15} días continuos</strong>.
                  </p>
                  <p className="text-xs">
                    Se generará factura a crédito y se sumará a sus Cuentas por Cobrar con fecha de vencimiento.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notas u Observaciones del Pedido (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              placeholder="Ej: Entregar antes de las 4pm, timbre 2B, etc."
            />
          </div>

          {/* Submit Button */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>{isSubmitting ? 'Procesando Pedido...' : 'Enviar Pedido y Generar Factura'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
