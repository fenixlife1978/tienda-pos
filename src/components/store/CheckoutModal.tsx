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
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { cart, currentCustomer, settings, createOrder, setSelectedInvoiceForModal } = useApp();

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
      alert('Por favor ingrese el número de referencia del Pago Móvil realizado.');
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

      onClose();
      onSuccess(order.id);
      setSelectedInvoiceForModal(invoice);
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
                <span className="text-2xl font-extrabold text-blue-900 font-mono">${totalUSD.toFixed(2)} USD</span>
                <span className="text-xs font-semibold text-blue-800 font-mono">
                  ≈ {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('pago_movil')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'pago_movil'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Smartphone className="w-4 h-4 mb-1 text-blue-600" />
                <p className="font-semibold">Pago Móvil</p>
                <p className="text-[10px] text-slate-500">Tasa BCV oficial</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('transferencia_bs')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'transferencia_bs'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4 mb-1 text-indigo-600" />
                <p className="font-semibold">Transferencia Bs</p>
                <p className="text-[10px] text-slate-500">Banesco / BDV</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('zelle')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'zelle'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4 mb-1 text-purple-600" />
                <p className="font-semibold">Zelle USD</p>
                <p className="text-[10px] text-slate-500">Dólares electrónicos</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('efectivo_usd')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                  paymentMethod === 'efectivo_usd'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <DollarSign className="w-4 h-4 mb-1 text-emerald-600" />
                <p className="font-semibold">Efectivo USD</p>
                <p className="text-[10px] text-slate-500">Contra entrega</p>
              </button>

              <button
                type="button"
                disabled={!canUseCredit}
                onClick={() => setPaymentMethod('credito')}
                className={`p-2.5 rounded-xl border text-left text-xs transition ${
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
                  {currentCustomer?.creditDays || 15} días de plazo
                </p>
              </button>
            </div>

            {/* Payment method instructions */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              {paymentMethod === 'pago_movil' && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Datos para realizar el Pago Móvil:</p>
                  <p className="text-slate-600">
                    Banco: <strong>{settings.pagoMovilBank}</strong> | Teléfono: <strong>{settings.pagoMovilPhone}</strong> | RIF: <strong>{settings.pagoMovilRif}</strong>
                  </p>
                  <p className="text-blue-700 font-bold font-mono">
                    Monto a transferir: {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
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
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="Ej: 19827364"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'transferencia_bs' && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Datos de Cuenta Bancaria:</p>
                  <p className="text-slate-600">
                    Banesco Banco Universal | Cta Corriente: <strong>0134-0982-11-0001928374</strong>
                  </p>
                  <p className="text-slate-600">Titular: <strong>{settings.companyName}</strong> (RIF: {settings.companyRif})</p>
                  <p className="text-blue-700 font-bold font-mono">
                    Total a transferir: {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                  </p>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Número de Comprobante / Referencia
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="Ej: BAN-84729103"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'zelle' && (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-800">Datos para pago Zelle:</p>
                  <p className="text-slate-600">Correo: <strong>{settings.zelleEmail}</strong></p>
                  <p className="text-slate-600">Beneficiario: <strong>{settings.zelleBeneficiary}</strong></p>
                  <p className="text-purple-700 font-bold font-mono">Monto exacto: ${totalUSD.toFixed(2)} USD</p>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nombre del titular de la cuenta Zelle emisora
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'efectivo_usd' && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p>
                    Cancela en dólares en efectivo al recibir tu despacho o al retirar en tienda. Por favor indicar billetes con los que cancelará en las notas si requiere vuelto.
                  </p>
                </div>
              )}

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
