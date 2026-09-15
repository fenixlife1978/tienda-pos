import { Order, Invoice, SystemSettings, formatPaymentMethod } from '../types';
import { formatUSD, formatBs } from './formatUtils';

export const STORE_PHONE_DISPLAY = '+58 424-5751804';
export const STORE_PHONE_RAW = '584245751804';
export const STORE_EMAIL = 'lagranbodegams@gmail.com';
export const STORE_ADDRESS = 'Av. 3 entre calles 21 y 22, Sector Monte Oscuro, San Felipe, Edo. Yaracuy';

/**
 * Construye el mensaje formateado para enviar el pedido por WhatsApp al equipo de ventas
 */
export function buildOrderWhatsAppMessage(order: Order, settings?: SystemSettings): string {
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
    `🛒 *NUEVO PEDIDO - DISTRIBUIDORA LA GRAN BODEGA M&S*`,
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
    `🏢 *Distribuidora La Gran Bodega M&S*`,
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
  return `https://wa.me/${STORE_PHONE_RAW}?text=${encodeURIComponent(message)}`;
}

/**
 * Construye el mensaje formateado para enviar una factura comercial por WhatsApp
 */
export function buildInvoiceWhatsAppMessage(invoice: Invoice, settings?: SystemSettings): string {
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
    `*DISTRIBUIDORA LA GRAN BODEGA M&S*`,
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
  return `https://wa.me/${STORE_PHONE_RAW}?text=${encodeURIComponent(message)}`;
}
