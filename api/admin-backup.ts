import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';

const FORMAT = 'tienda-pos-global-backup';
const VERSION = 1;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const MAX_CHUNK_CHARS = 300 * 1024;
const PAGE_SIZE = 150;
const EXCLUDED = new Set(['auth_sessions', 'customer_sessions', 'sqlite_sequence', '_admin_backup_staging']);
const RESERVED = new Set(['sqlite_master', 'sqlite_schema', 'sqlite_temp_master', 'sqlite_temp_schema']);

function db() {
  const url = process.env.TURSO_DATABASE_URL || '';
  const authToken = process.env.TURSO_AUTH_TOKEN || '';
  if (!url || !authToken) throw new Error('Turso no está configurado en el servidor');
  return createClient({ url, authToken });
}
const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"';

async function requireAdmin(req: any, client: any) {
  const sessionId = String(req.headers?.['x-tienda-pos-session'] || '').trim();
  if (!sessionId) return null;
  const result = await client.execute({
    sql: `SELECT u.id, u.role FROM auth_sessions s
      JOIN system_users u ON u.id=s.user_id
      WHERE s.id=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.active=1 LIMIT 1`,
    args: [sessionId, new Date().toISOString()],
  });
  const user: any = result.rows[0];
  return user && String(user.role || '').trim().toLowerCase() === 'admin' ? user : null;
}
async function listTables(client: any) {
  const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  return result.rows.map((r: any) => String(r.name))
    .filter((name: string) => !EXCLUDED.has(name) && !RESERVED.has(name) && !name.startsWith('sqlite_'));
}
async function tableInfo(client: any, table: string) {
  const result = await client.execute(`PRAGMA table_info(${quote(table)})`);
  return result.rows.map((r: any) => String(r.name));
}
function encodeValue(value: any): any {
  if (value instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
    return { __tienda_pos_type: 'blob', base64: Buffer.from(value).toString('base64') };
  }
  if (value === undefined) return null;
  if (typeof value === 'bigint') return { __tienda_pos_type: 'bigint', value: value.toString() };
  return value;
}
function decodeValue(value: any): any {
  if (value && typeof value === 'object' && !Array.isArray(value) && value.__tienda_pos_type === 'blob' &&
      typeof value.base64 === 'string' && Object.keys(value).length === 2) {
    return new Uint8Array(Buffer.from(value.base64, 'base64'));
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && value.__tienda_pos_type === 'bigint' &&
      typeof value.value === 'string' && Object.keys(value).length === 2) {
    return BigInt(value.value);
  }
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  throw new Error('El respaldo contiene un valor no compatible.');
}
async function ensureStage(client: any) {
  await client.execute(`CREATE TABLE IF NOT EXISTS _admin_backup_staging (
    operation_id TEXT NOT NULL, admin_id TEXT NOT NULL, chunk_index INTEGER NOT NULL,
    payload TEXT NOT NULL, expires_at TEXT NOT NULL,
    PRIMARY KEY(operation_id, chunk_index)
  )`);
}
async function cleanExpired(client: any) {
  await client.execute({ sql: 'DELETE FROM _admin_backup_staging WHERE expires_at < ?', args: [new Date().toISOString()] });
}
function parseBody(req: any) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
}
async function exportManifest(client: any) {
  const tables = await listTables(client);
  const result = [];
  for (const name of tables) {
    const columns = await tableInfo(client, name);
    const count = await client.execute(`SELECT COUNT(*) AS total FROM ${quote(name)}`);
    result.push({ name, columns, rowCount: Number(count.rows[0]?.total || 0) });
  }
  return { format: FORMAT, version: VERSION, createdAt: new Date().toISOString(), source: 'Turso', pageSize: PAGE_SIZE, tables: result };
}
async function validateBackup(client: any, backup: any) {
  if (!backup || backup.format !== FORMAT || backup.version !== VERSION || !Array.isArray(backup.tables)) {
    throw new Error('El archivo no es un respaldo global válido de tienda-pos.');
  }
  const liveTables = await listTables(client);
  if (backup.tables.length !== liveTables.length) throw new Error('El respaldo no contiene exactamente las tablas de esta instalación.');
  const incoming = new Map<string, any>();
  for (const item of backup.tables) {
    if (!item || typeof item.name !== 'string' || !liveTables.includes(item.name) || incoming.has(item.name) ||
        !Array.isArray(item.columns) || !Array.isArray(item.rows)) {
      throw new Error('El respaldo contiene tablas duplicadas, desconocidas o con estructura inválida.');
    }
    const actualColumns = await tableInfo(client, item.name);
    if (item.columns.length !== actualColumns.length || item.columns.some((c: any, i: number) => c !== actualColumns[i])) {
      throw new Error(`La estructura de la tabla ${item.name} no coincide con esta versión del sistema.`);
    }
    for (const row of item.rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
          Object.keys(row).some((key) => !item.columns.includes(key)) ||
          item.columns.some((column: string) => !Object.prototype.hasOwnProperty.call(row, column))) {
        throw new Error(`Hay registros con columnas inválidas en ${item.name}.`);
      }
      for (const column of item.columns) decodeValue(row[column]);
    }
    incoming.set(item.name, item);
  }
  if (liveTables.some((name) => !incoming.has(name)) || !incoming.has('system_users')) {
    throw new Error('El respaldo está incompleto o no contiene los usuarios del sistema.');
  }
  return { liveTables, incoming };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const client = db();
  try {
    const admin = await requireAdmin(req, client);
    if (!admin) return res.status(403).json({ error: 'Acceso exclusivo para administradores.' });
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    if (req.method === 'GET') {
      const action = String(req.query?.action || 'manifest');
      if (action === 'manifest') return res.status(200).json(await exportManifest(client));
      if (action === 'page') {
        const table = String(req.query?.table || '');
        const offset = Number(req.query?.offset || 0);
        if (!Number.isSafeInteger(offset) || offset < 0 || !table || !(await listTables(client)).includes(table)) {
          return res.status(400).json({ error: 'Página de respaldo inválida.' });
        }
        const columns = await tableInfo(client, table);
        const result = await client.execute({
          sql: `SELECT * FROM ${quote(table)} LIMIT ? OFFSET ?`,
          args: [PAGE_SIZE, offset],
        });
        const rows = result.rows.map((row: any) => Object.fromEntries(columns.map((column) => [column, encodeValue(row[column])])));
        return res.status(200).json({ table, offset, rows, done: rows.length < PAGE_SIZE });
      }
      return res.status(400).json({ error: 'Acción de exportación desconocida.' });
    }

    const body = parseBody(req);
    await ensureStage(client);
    await cleanExpired(client);
    const action = String(body.action || '');

    if (action === 'restore-init') {
      const totalChunks = Number(body.totalChunks);
      const byteLength = Number(body.byteLength);
      const digest = String(body.sha256 || '').toLowerCase();
      if (!Number.isSafeInteger(totalChunks) || totalChunks < 1 || totalChunks > 200 ||
          !Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > MAX_BACKUP_BYTES ||
          !/^[a-f0-9]{64}$/.test(digest)) {
        return res.status(400).json({ error: 'El tamaño o la integridad declarada del respaldo no es válida (máximo 25 MB).' });
      }
      const operationId = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await client.execute({
        sql: 'INSERT INTO _admin_backup_staging (operation_id, admin_id, chunk_index, payload, expires_at) VALUES (?, ?, -1, ?, ?)',
        args: [operationId, String(admin.id), JSON.stringify({ totalChunks, byteLength, digest }), expiresAt],
      });
      return res.status(200).json({ operationId, totalChunks, expiresAt });
    }
    if (action === 'restore-chunk') {
      const operationId = String(body.operationId || '');
      const chunkIndex = Number(body.chunkIndex);
      const payload = String(body.payload || '');
      if (!operationId || !Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || payload.length < 1 || payload.length > MAX_CHUNK_CHARS) {
        return res.status(400).json({ error: 'Bloque de restauración inválido.' });
      }
      const op = await client.execute({
        sql: "SELECT payload FROM _admin_backup_staging WHERE operation_id=? AND admin_id=? AND chunk_index=-1 AND expires_at>?",
        args: [operationId, String(admin.id), new Date().toISOString()],
      });
      if (!op.rows.length) return res.status(404).json({ error: 'La operación de restauración venció o no existe.' });
      const meta = JSON.parse(String(op.rows[0].payload));
      if (chunkIndex >= meta.totalChunks) return res.status(400).json({ error: 'Índice de bloque fuera de rango.' });
      await client.execute({
        sql: 'INSERT OR REPLACE INTO _admin_backup_staging (operation_id, admin_id, chunk_index, payload, expires_at) VALUES (?, ?, ?, ?, ?)',
        args: [operationId, String(admin.id), chunkIndex, payload, new Date(Date.now() + 60 * 60 * 1000).toISOString()],
      });
      return res.status(200).json({ received: chunkIndex });
    }
    if (action === 'restore-abort') {
      await client.execute({ sql: 'DELETE FROM _admin_backup_staging WHERE operation_id=? AND admin_id=?', args: [String(body.operationId || ''), String(admin.id)] });
      return res.status(200).json({ success: true });
    }
    if (action === 'restore-commit') {
      const operationId = String(body.operationId || '');
      const staged = await client.execute({
        sql: 'SELECT chunk_index, payload FROM _admin_backup_staging WHERE operation_id=? AND admin_id=? ORDER BY chunk_index',
        args: [operationId, String(admin.id)],
      });
      if (!staged.rows.length || Number(staged.rows[0].chunk_index) !== -1) return res.status(404).json({ error: 'No se encontró la operación de restauración.' });
      const meta = JSON.parse(String(staged.rows[0].payload));
      const chunks = staged.rows.filter((row: any) => Number(row.chunk_index) >= 0);
      if (chunks.length !== meta.totalChunks || chunks.some((row: any, i: number) => Number(row.chunk_index) !== i)) {
        return res.status(400).json({ error: 'Faltan bloques del respaldo. No se modificó ningún dato.' });
      }
      const raw = chunks.map((row: any) => String(row.payload)).join('');
      if (Buffer.byteLength(raw, 'utf8') !== meta.byteLength ||
          createHash('sha256').update(raw, 'utf8').digest('hex') !== meta.digest) {
        return res.status(400).json({ error: 'La verificación SHA-256 falló. No se modificó ningún dato.' });
      }
      const backup = JSON.parse(raw);
      const { liveTables, incoming } = await validateBackup(client, backup);
      const tx = await client.transaction('write');
      try {
        await tx.execute('PRAGMA defer_foreign_keys = ON');
        for (const table of [...liveTables].reverse()) await tx.execute(`DELETE FROM ${quote(table)}`);
        for (const table of liveTables) {
          const item = incoming.get(table);
          if (!item.rows.length) continue;
          const names = item.columns.map(quote).join(', ');
          const placeholders = item.columns.map(() => '?').join(', ');
          const sql = `INSERT INTO ${quote(table)} (${names}) VALUES (${placeholders})`;
          for (const row of item.rows) {
            await tx.execute({ sql, args: item.columns.map((column: string) => decodeValue(row[column])) });
          }
        }
        const sessions = await tx.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('auth_sessions','customer_sessions')");
        const sessionTables = new Set(sessions.rows.map((row: any) => String(row.name)));
        if (sessionTables.has('auth_sessions')) await tx.execute('DELETE FROM auth_sessions');
        if (sessionTables.has('customer_sessions')) await tx.execute('DELETE FROM customer_sessions');
        await tx.commit();
      } catch (error) {
        try { await tx.rollback(); } catch {}
        throw error;
      }
      await client.execute({ sql: 'DELETE FROM _admin_backup_staging WHERE operation_id=?', args: [operationId] });
      return res.status(200).json({ success: true, restoredTables: incoming.size, sessionsReset: true, restoredAt: new Date().toISOString() });
    }
    return res.status(400).json({ error: 'Acción de restauración desconocida.' });
  } catch (error: any) {
    console.error('[admin-backup]', error);
    return res.status(500).json({ error: error?.message || 'No se pudo completar la operación de respaldo.' });
  } finally {
    client.close();
  }
}
