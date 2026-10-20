import { createClient } from '@libsql/client';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const URL = process.env.TURSO_DATABASE_URL || '';
const TOKEN = process.env.TURSO_AUTH_TOKEN || '';

function db() {
  if (!URL || !TOKEN) throw new Error('Turso no está configurado en el servidor');
  return createClient({ url: URL, authToken: TOKEN });
}

async function ensurePasswordHashColumn(client: any) {
  const schema = await client.execute('PRAGMA table_info("customers")');
  if (!schema.rows.length) throw new Error('La tabla de clientes no está inicializada');
  for (const [column, sql] of [
    ['password_hash', 'ALTER TABLE customers ADD COLUMN password_hash TEXT'],
    ['account_status', "ALTER TABLE customers ADD COLUMN account_status TEXT DEFAULT 'active'"],
  ]) {
    const current = await client.execute('PRAGMA table_info("customers")');
    if (!current.rows.some((row: any) => String(row.name) === column)) {
      try {
        await client.execute(sql);
      } catch (error) {
        const check = await client.execute('PRAGMA table_info("customers")');
        if (!check.rows.some((row: any) => String(row.name) === column)) throw error;
      }
    }
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt-v1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [version, saltText, hashText] = encoded.split('$');
  if (version !== 'scrypt-v1' || !saltText || !hashText) return false;
  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (!salt.length || expected.length !== 64) return false;
    const actual = await scrypt(password, salt, expected.length) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function publicCustomer(row: any) {
  const extra = row.extra_data ? JSON.parse(String(row.extra_data)) : {};
  return {
    id: String(row.id), name: String(row.name), rif: String(row.rif),
    email: String(row.email || ''), phone: String(row.phone || ''), address: String(row.address || ''),
    hasCredit: Boolean(row.has_credit), creditDays: Number(row.credit_days || 15),
    creditLimitUSD: Number(row.credit_limit_usd || 0), currentDebtUSD: Number(row.current_debt_usd || 0),
    avatar: row.avatar ? String(row.avatar) : undefined,
    notificationPreferences: row.notification_preferences ? JSON.parse(String(row.notification_preferences)) : undefined,
    verificationStatus: String(row.verification_status || 'pending'),
    accountStatus: String(row.account_status || 'active'),
    isFirstTime: row.is_first_time !== undefined && row.is_first_time !== null ? Boolean(row.is_first_time) : true,
    registeredAt: String(row.registered_at || row.created_at || new Date().toISOString()),
    businessType: row.business_type ? String(row.business_type) : undefined,
    tradeName: row.trade_name ? String(row.trade_name) : undefined,
    contactPerson: row.contact_person ? String(row.contact_person) : undefined,
    creditStatus: String(row.credit_status || 'none'),
    creditRequestedLimitUSD: Number(row.credit_requested_limit_usd || 0),
    creditRequestedDays: Number(row.credit_requested_days || 0),
    creditRequestedAt: row.credit_requested_at ? String(row.credit_requested_at) : undefined,
    assignedPriceTier: row.assigned_price_tier ? String(row.assigned_price_tier) : 'mayorista',
    verificationNotes: row.verification_notes ? String(row.verification_notes) : undefined,
    attachedDocRif: extra.attachedDocRif, attachedCommercialRef: extra.attachedCommercialRef,
    rejectionReason: extra.rejectionReason, verifiedAt: extra.verifiedAt, verifiedBy: extra.verifiedBy,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const body = req.body || {};
  const operation = String(body.operation || '');
  const identifier = String(body.identifier || '').trim();
  const password = String(body.password || '');
  if (!['login', 'register'].includes(operation)) return res.status(400).json({ error: 'Operación no válida' });
  if (!password || (operation === 'register' && password.length < 8)) {
    return res.status(400).json({ error: operation === 'register' ? 'La contraseña debe tener al menos 8 caracteres' : 'Credenciales incompletas' });
  }

  try {
    const client = db();
    await ensurePasswordHashColumn(client);
    if (operation === 'register') {
      const customer = body.customer || {};
      const name = String(customer.name || '').trim();
      const rif = String(customer.rif || '').trim().toUpperCase();
      const email = String(customer.email || '').trim().toLowerCase();
      const phone = String(customer.phone || '').trim();
      const address = String(customer.address || '').trim();
      if (!name || !rif || !email || !phone || !address) return res.status(400).json({ error: 'Completa los datos obligatorios del cliente' });
      const duplicate = await client.execute({
        sql: 'SELECT id FROM customers WHERE UPPER(TRIM(rif)) = ? OR (LOWER(TRIM(email)) = ? AND ? <> \'\') LIMIT 1',
        args: [rif, email, email],
      });
      if (duplicate.rows.length) return res.status(409).json({ error: 'Ya existe un cliente con ese RIF o correo' });
      const id = `cust-${randomBytes(12).toString('hex')}`;
      const registeredAt = new Date().toISOString();
      const hash = await hashPassword(password);
      const prefs = customer.notificationPreferences || { orderStatus: true, promotions: true, creditAlerts: true, soundEnabled: true, channel: 'push' };
      const extra = JSON.stringify({
        attachedDocRif: customer.attachedDocRif, attachedCommercialRef: customer.attachedCommercialRef,
        rejectionReason: customer.rejectionReason, verifiedAt: customer.verifiedAt, verifiedBy: customer.verifiedBy,
      });
      await client.execute({
        sql: `INSERT INTO customers
          (id,name,rif,email,phone,address,has_credit,credit_days,credit_limit_usd,current_debt_usd,password,password_hash,avatar,notification_preferences,
           verification_status,is_first_time,registered_at,business_type,trade_name,contact_person,credit_status,credit_requested_limit_usd,
           credit_requested_days,credit_requested_at,assigned_price_tier,verification_notes,extra_data,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [id,name,rif,email,phone,address,0,0,0,0,null,hash,customer.avatar || null,JSON.stringify(prefs),'pending',1,registeredAt,
          customer.businessType || null,customer.tradeName || null,customer.contactPerson || null,customer.creditStatus || 'none',
          Number(customer.creditRequestedLimitUSD || 0),Number(customer.creditRequestedDays || 0),customer.creditRequestedAt || null,
          customer.assignedPriceTier || 'mayorista',customer.verificationNotes || null,extra,registeredAt],
      });
      const saved = await client.execute({ sql: 'SELECT * FROM customers WHERE id = ? LIMIT 1', args: [id] });
      return res.status(201).json({ customer: publicCustomer(saved.rows[0]) });
    }

    if (!identifier) return res.status(400).json({ error: 'Indica correo, RIF o teléfono' });
    const normalized = identifier.toLowerCase();
    const digits = identifier.replace(/\D/g, '');
    const result = await client.execute({
      sql: `SELECT * FROM customers
        WHERE LOWER(TRIM(COALESCE(rif,''))) = ? OR LOWER(TRIM(COALESCE(email,''))) = ?
        OR (? <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone,''),' ',''),'-',''),'(',''),')','') = ?)
        LIMIT 1`,
      args: [normalized, normalized, digits.length >= 7 ? digits : '', digits],
    });
    const row: any = result.rows[0];
    if (!row) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const accountStatus = String(row.account_status || 'active');
    if (accountStatus === 'suspended') return res.status(403).json({ error: 'Esta cuenta está suspendida. Contacta al administrador.' });
    if (accountStatus === 'deleted') return res.status(403).json({ error: 'Esta cuenta fue eliminada y no puede iniciar sesión.' });
    let valid = false;
    const storedHash = String(row.password_hash || '');
    const legacyPassword = String(row.password || '');
    if (storedHash) valid = await verifyPassword(password, storedHash);
    else if (legacyPassword) {
      valid = legacyPassword === password;
      if (valid) {
        const migrated = await hashPassword(password);
        await client.execute({ sql: 'UPDATE customers SET password_hash = ?, password = NULL WHERE id = ?', args: [migrated, String(row.id)] });
      }
    }
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    return res.status(200).json({ customer: publicCustomer(row) });
  } catch (error: any) {
    console.error('Customer auth error:', error);
    return res.status(500).json({ error: 'No se pudo completar la autenticación del cliente' });
  }
}
