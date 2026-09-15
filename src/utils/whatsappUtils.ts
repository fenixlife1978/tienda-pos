import { Order, Invoice, SystemSettings, formatPaymentMethod } from '../types';
import { formatUSD, formatBs } from './formatUtils';

export const STORE_PHONE_DISPLAY = '+58 424-5751804';
export const STORE_PHONE_RAW = '584245751804';
export const STORE_EMAIL = 'lagranbodegams@gmail.com';
export const STORE_ADDRESS = 'Av. 3 entre calles 21 y 22, Sector Monte Oscuro, San Felipe, Edo. Yaracuy';

/**
 * Extrae el número de teléfono limpio para el enlace wa.me/<numero>
 * Soporta múltiples números separados por slash, guión o coma.
 */
export function extractCleanWhatsAppNumber(phoneString?: string): string {
  if (!phoneString || typeof phoneString !== 'string' || !phoneString.trim()) {
    return STORE_PHONE_RAW;
  }

  // Si tiene varios números separados por / o coma, buscar preferentemente el móvil (412, 414, 424, 416, 426) o tomar el primero
  const parts = phoneString.split(/[\/,|]/).map((p) => p.trim()).filter(Boolean);
  
  // Buscar primero si alguna parte tiene código celular venezolano
  for (const part of parts) {
    const digitsOnly = part.replace(/\D/g, '');
    if (
      digitsOnly.includes('412') ||
      digitsOnly.includes('414') ||
      digitsOnly.includes('424') ||
      digitsOnly.includes('416') ||
      digitsOnly.includes('426')
    ) {
      if (digitsOnly.startsWith('0')) {
        return `58${digitsOnly.slice(1)}`;
      }
      if (digitsOnly.startsWith('58')) {
        return digitsOnly;
      }
      if (digitsOnly.length === 10) {
        return `58${digitsOnly}`;
      }
      return digitsOnly;
    }
  }

  // Si no se detectó código específico, tomar los dígitos de la primera parte válida
  for (const part of parts) {
    const digitsOnly = part.replace(/\D/g, '');
    if (digitsOnly.length >= 7) {
      if (digitsOnly.startsWith('0')) {
        return `58${digitsOnly.slice(1)}`;
      }
      if (digitsOnly.startsWith('58')) {
        return digitsOnly;
      }
      if (digitsOnly.length === 10) {
        return `58${digitsOnly}`;
      }
      return digitsOnly;
    }
  }

  const allDigits = phoneString.replace(/\D/g, '');
  return allDigits || STORE_PHONE_RAW;
}

/**
 * Construye el mensaje formateado para enviar el pedido por WhatsApp al equipo de ventas
 */
export function buildOrderWhatsAppMessage(order: Order, settings?: SystemSettings): string {
  const companyName = settings?.companyName || 'DISTRIBUIDORA LA GRAN BODEGA M&S';
  const address = settings?.companyAddress || STORE_ADDRESS;
  const email = settings?.companyEmail || STORE_EMAIL;
  const phone = settings?.companyPhone || STORE_PHONE_DISPLAY;

  const itemsList = order.items
    .map((item) => {
      const lineTotalBs = item.subtotalUSD * order.bcvRate;
      return `  • *${item.quantity}x* ${item.productName} — ${formatUSD(item.subtotalUSD)} USD (${formatBs(lineTotalBs)})`;
    })
    .join('\n');

  const lines = [
    `🛒 *NUEVO PEDIDO - ${companyName.toUpperCase()}*`,
    `¡Hola equipo de ventas! Acabo de registrar el siguiente pedido desde la tienda online:`,
    ``,
    `📋 *N° de Pedido:* ${order.orderNumber}`,
    `📅 *Fecha:* ${new Date(order.createdAt).toLocaleDateString('es-VE')} ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    `👤 *Cliente / Razón Social:* ${order.customerName}`,
    `🆔 *RIF / Cédula:* ${order.customerRif}`,
    `📞 *Teléfono del Cliente:* ${order.customerPhone}`,
    `📍 *Despacho / Entrega:* ${order.customerAddress}`,
    `💳 *Método de Pago:* ${formatPaymentMethod(order.paymentMethod)}`,
    order.paymentReference ? `🔖 *Referencia / Comprobante:* ${order.paymentReference}` : '',
    order.notes ? `📝 *Observaciones / Notas:* ${order.notes}` : '',
    ``,
    `📦 *DETALLE DE PRODUCTOS:*`,
    itemsList,
    ``,
    `💵 *Subtotal Base Imponible:* ${formatUSD(order.subtotalUSD)} USD`,
    `📊 *IVA:* ${formatUSD(order.taxUSD)} USD`,
    `💰 *TOTAL PEDIDO (USD):* ${formatUSD(order.totalUSD)} USD`,
    `🇻🇪 *TOTAL A PAGAR EN BOLÍVARES:* ${formatBs(order.totalBs)}`,
    `📈 *Tasa BCV Aplicada:* ${order.bcvRate.toFixed(2)} Bs/USD`,
    ``,
    `🏢 *${companyName}*`,
    `📍 ${address}`,
    `✉️ ${email}`,
    `📱 Ventas: ${phone}`,
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * Genera el enlace de WhatsApp para compartir el pedido directamente al número del equipo de ventas
 */
export function getOrderWhatsAppUrl(order: Order, settings?: SystemSettings): string {
  const message = buildOrderWhatsAppMessage(order, settings);
  const targetPhone = extractCleanWhatsAppNumber(settings?.companyPhone);
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Construye el mensaje formateado para enviar una factura comercial por WhatsApp
 */
export function buildInvoiceWhatsAppMessage(invoice: Invoice, settings?: SystemSettings): string {
  const companyName = settings?.companyName || 'DISTRIBUIDORA LA GRAN BODEGA M&S';
  const address = settings?.companyAddress || STORE_ADDRESS;
  const email = settings?.companyEmail || STORE_EMAIL;
  const phone = settings?.companyPhone || STORE_PHONE_DISPLAY;

  const itemsList = invoice.items
    .map((item) => {
      const lineBs = item.subtotalUSD * invoice.bcvRate;
      return `  • *${item.quantity}x* ${item.productName} — ${formatUSD(item.subtotalUSD)} USD (${formatBs(lineBs)})`;
    })
    .join('\n');

  const lines = [
    `📄 *FACTURA COMERCIAL #${invoice.invoiceNumber}*`,
    `*${companyName.toUpperCase()}*`,
    ``,
    `📅 *Fecha de Emisión:* ${new Date(invoice.createdAt).toLocaleDateString('es-VE')}`,
    invoice.dueDate ? `⏳ *Fecha de Vencimiento:* ${invoice.dueDate}` : '',
    `👤 *Cliente:* ${invoice.customerName} (${invoice.customerRif})`,
    `📞 *Teléfono:* ${invoice.customerPhone}`,
    `📍 *Dirección:* ${invoice.customerAddress}`,
    `💳 *Condición de Pago:* ${invoice.isCredit ? `A Crédito (${invoice.creditDays || 15} días)` : formatPaymentMethod(invoice.paymentMethod)}`,
    `📊 *Estado:* ${invoice.paymentStatus.toUpperCase()}`,
    ``,
    `📦 *PRODUCTOS FACTURADOS:*`,
    itemsList,
    ``,
    `💵 *Subtotal:* ${formatUSD(invoice.subtotalUSD)} USD`,
    `📊 *IVA (16%):* ${formatUSD(invoice.taxUSD)} USD`,
    `💰 *TOTAL FACTURA (USD):* ${formatUSD(invoice.totalUSD)} USD`,
    `🇻🇪 *TOTAL FACTURA (Bs):* ${formatBs(invoice.totalBs)}`,
    `📈 *Tasa BCV:* ${invoice.bcvRate.toFixed(2)} Bs/USD`,
    ``,
    `📍 ${address}`,
    `✉️ ${email}`,
    `📱 ${phone}`,
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * Genera el enlace de WhatsApp para compartir una factura
 */
export function getInvoiceWhatsAppUrl(invoice: Invoice, settings?: SystemSettings): string {
  const message = buildInvoiceWhatsAppMessage(invoice, settings);
  const targetPhone = extractCleanWhatsAppNumber(settings?.companyPhone);
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
}
