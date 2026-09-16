import { Customer, Invoice, ReceivableItem, SystemSettings, AppNotification } from '../types';
import { formatUSD, formatBs } from '../utils/formatUtils';
import { extractCleanWhatsAppNumber } from '../utils/whatsappUtils';

export interface AutomatedReminderRecord {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  invoiceId?: string;
  invoiceNumber?: string;
  reminderType: 'overdue_invoice' | 'near_due_invoice' | 'credit_limit_near' | 'credit_limit_exceeded';
  channel: 'whatsapp' | 'email' | 'in_app';
  title: string;
  message: string;
  amountUSD: number;
  amountBs: number;
  dueDate?: string;
  whatsappUrl: string;
  status: 'sent' | 'pending';
  createdAt: string;
}

/**
 * Generates WhatsApp and email messages for credit reminders and overdue invoices.
 */
export const buildOverdueReminderWhatsApp = (
  customer: Customer,
  invoice: Invoice | ReceivableItem,
  settings: SystemSettings,
  daysOverdue: number
): string => {
  const amountUSD = 'balanceUSD' in invoice ? invoice.balanceUSD : invoice.totalUSD;
  const amountBs = amountUSD * settings.bcvRate;
  const invNumber = 'invoiceNumber' in invoice ? invoice.invoiceNumber : (invoice as Invoice).invoiceNumber || 'DOC-00';
  const dueDate = invoice.dueDate || 'N/A';

  const phoneDest = extractCleanWhatsAppNumber(customer.phone);

  const text = `🔔 *RECORDATORIO DE PAGO - ${settings.companyName.toUpperCase()}*

Estimado(a) *${customer.name}*,
Esperamos se encuentre bien. Le escribimos cordialmente de *${settings.companyName}* (RIF: ${settings.companyRif}) para recordarle que su factura a crédito presenta saldo pendiente:

📄 *Factura N°:* ${invNumber}
📅 *Fecha de Vencimiento:* ${dueDate} (${daysOverdue > 0 ? `⚠️ ${daysOverdue} día(s) vencida` : 'Hoy vence'})
💵 *Saldo Pendiente USD:* $${amountUSD.toFixed(2)}
🇻🇪 *Saldo en Bolívares (Tasa BCV ${settings.bcvRate.toFixed(2)}):* ${formatBs(amountBs)}

💳 *Cuentas disponibles para su pago:*
📱 *Pago Móvil:* Banco ${settings.pagoMovilBank || 'BDV'}, Telf: ${settings.pagoMovilPhone || settings.companyPhone}, RIF: ${settings.pagoMovilRif || settings.companyRif}
💵 *Zelle:* ${settings.zelleEmail || settings.companyEmail} (${settings.zelleBeneficiary || settings.companyName})
🏦 *Transferencia Bancaria:* ${settings.companyName}

Agradecemos nos comparta el comprobante de pago por esta vía para conciliar su cuenta y mantener activa su línea de crédito.

¡Muchas gracias por su preferencia!
📍 *${settings.companyName}* • Telf: ${settings.companyPhone}`;

  return `https://wa.me/${phoneDest}?text=${encodeURIComponent(text)}`;
};

export const buildCreditLimitNearWhatsApp = (
  customer: Customer,
  settings: SystemSettings,
  usagePercent: number
): string => {
  const availableUSD = Math.max(0, customer.creditLimitUSD - customer.currentDebtUSD);
  const availableBs = availableUSD * settings.bcvRate;
  const phoneDest = extractCleanWhatsAppNumber(customer.phone);

  const text = `⚠️ *AVISO DE LÍNEA DE CRÉDITO - ${settings.companyName.toUpperCase()}*

Estimado(a) *${customer.name}*,
Le informamos desde la administración de *${settings.companyName}* que su línea de crédito comercial ha alcanzado el *${usagePercent}%* de uso.

📊 *Límite Aprobado:* $${customer.creditLimitUSD.toFixed(2)}
💳 *Deuda Acumulada:* $${customer.currentDebtUSD.toFixed(2)}
🟢 *Cupo Disponible:* $${availableUSD.toFixed(2)} (≈ ${formatBs(availableBs)})

Para evitar interrupciones en el despacho de nuevos pedidos o solicitar una ampliación de cupo, le sugerimos abonar a sus facturas pendientes.

📞 Contacto directo de administración: ${settings.companyPhone}
¡Gracias por confiar en nosotros!`;

  return `https://wa.me/${phoneDest}?text=${encodeURIComponent(text)}`;
};

/**
 * Scan engine: detects customers needing reminders.
 */
export const scanAndGenerateReminders = (
  customers: Customer[],
  invoices: Invoice[],
  receivables: ReceivableItem[],
  settings: SystemSettings,
  existingReminders: AutomatedReminderRecord[] = []
): {
  newReminders: AutomatedReminderRecord[];
  notificationsToPush: Omit<AppNotification, 'id' | 'createdAt'>[];
} => {
  const newReminders: AutomatedReminderRecord[] = [];
  const notificationsToPush: Omit<AppNotification, 'id' | 'createdAt'>[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Cooldown tracker: don't generate duplicate reminder for same customer+type in last 12 hours
  const recentSent = new Set(
    existingReminders
      .filter((r) => {
        const diffHours = (now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
        return diffHours < 12;
      })
      .map((r) => `${r.customerId}_${r.reminderType}_${r.invoiceId || ''}`)
  );

  // 1. Check overdue invoices / receivables
  for (const rec of receivables) {
    if (rec.balanceUSD > 0.5 && rec.status === 'vencido') {
      const customer = customers.find((c) => c.id === rec.customerId);
      if (!customer) continue;

      const key = `${rec.customerId}_overdue_invoice_${rec.invoiceId}`;
      if (recentSent.has(key)) continue;

      const due = new Date(rec.dueDate);
      const diffTime = now.getTime() - due.getTime();
      const daysOverdue = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      const amountUSD = rec.balanceUSD;
      const amountBs = amountUSD * settings.bcvRate;
      const waUrl = buildOverdueReminderWhatsApp(customer, rec, settings, daysOverdue);

      const reminder: AutomatedReminderRecord = {
        id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email || settings.companyEmail,
        invoiceId: rec.invoiceId,
        invoiceNumber: rec.invoiceNumber,
        reminderType: 'overdue_invoice',
        channel: 'whatsapp',
        title: `Factura Vencida ${rec.invoiceNumber} (${daysOverdue}d)`,
        message: `Factura ${rec.invoiceNumber} por $${amountUSD.toFixed(2)} venció el ${rec.dueDate}. Recordatorio enviado a ${customer.name}.`,
        amountUSD,
        amountBs,
        dueDate: rec.dueDate,
        whatsappUrl: waUrl,
        status: 'sent',
        createdAt: now.toISOString(),
      };

      newReminders.push(reminder);
      notificationsToPush.push({
        title: `⚠️ Recordatorio de Cobro: ${customer.name}`,
        message: `Factura ${rec.invoiceNumber} por $${amountUSD.toFixed(2)} (${daysOverdue}d de mora). WhatsApp listo para enviar.`,
        type: 'credit_alert',
        targetCustomerId: customer.id,
        badge: 'Mora CxC',
        priority: 'high',
        read: false,
      });
      recentSent.add(key);
    }
  }

  // 2. Check customer credit limit usage
  for (const customer of customers) {
    if (customer.hasCredit && customer.creditLimitUSD > 0) {
      const usagePercent = Math.round((customer.currentDebtUSD / customer.creditLimitUSD) * 100);

      if (usagePercent >= 80) {
        const reminderType = usagePercent >= 100 ? 'credit_limit_exceeded' : 'credit_limit_near';
        const key = `${customer.id}_${reminderType}_`;
        if (recentSent.has(key)) continue;

        const waUrl = buildCreditLimitNearWhatsApp(customer, settings, usagePercent);
        const amountUSD = customer.currentDebtUSD;
        const amountBs = amountUSD * settings.bcvRate;

        const reminder: AutomatedReminderRecord = {
          id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email || settings.companyEmail,
          reminderType,
          channel: 'whatsapp',
          title: `Límite de Crédito al ${usagePercent}%`,
          message: `${customer.name} ha utilizado $${customer.currentDebtUSD.toFixed(2)} de su cupo ($${customer.creditLimitUSD.toFixed(2)}).`,
          amountUSD,
          amountBs,
          whatsappUrl: waUrl,
          status: 'sent',
          createdAt: now.toISOString(),
        };

        newReminders.push(reminder);
        notificationsToPush.push({
          title: `💳 Cupo de Crédito: ${customer.name} (${usagePercent}%)`,
          message: `El cliente ha utilizado $${customer.currentDebtUSD.toFixed(2)} de su límite de $${customer.creditLimitUSD.toFixed(2)}.`,
          type: 'credit_alert',
          targetCustomerId: customer.id,
          badge: `${usagePercent}% Cupo`,
          priority: usagePercent >= 100 ? 'urgent' : 'high',
          read: false,
        });
        recentSent.add(key);
      }
    }
  }

  return { newReminders, notificationsToPush };
};
