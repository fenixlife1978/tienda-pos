import { createClient } from '@libsql/client';

const EXCLUDED = new Set(['auth_sessions', 'customer_sessions', 'sqlite_sequence']);
const RESERVED = new Set(['sqlite_master', 'sqlite_schema', 'sqlite_temp_master', 'sqlite_temp_schema']);

function db() {
  const url = process.env.TURSO_DATABASE_URL || '';
  const authToken = process.env.TURSO_AUTH_TOKEN || '';
  if (!url || !authToken) throw new Error('Turso no está configurado en el servidor');
  return createClient({ url, authToken });
}

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
  const result = await client.execute(`SELECT name FROM sqlite_master
    WHERE type='table' ORDER BY name`);
  return result.rows.map((r: any) => String(r.name))
    .filter((name: string) => !EXCLUDED.has(name) && !RESERVED.has(name) && !name.startsWith('sqlite_'));
}

async function makeBackup(client: any) {
  const tables = await listTables(client);
  const contents: any[] = [];
  for (const table of tables) {
    const info = await client.execute(`PRAGMA table_info("${table.replace(/"/g, '""')}")`);
    const columns = info.rows.map((r: any) => String(r.name));
    const result = await client.execute(`SELECT * FROM "${table.replace(/"/g, '""')}"`);
    contents.push({ name: table, columns, rows: result.rows.map((row: any) => {
      const value: Record<string, unknown> = {};
      for (const column of columns) value[column] = row[column] === undefined ? null : row[column];
      return value;
    }) });
  }
  return {
    format: 'tienda-pos-global-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    source: 'Turso',
    tables: contents,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const client = db();
  try {
    const admin = await requireAdmin(req, client);
    if (!admin) return res.status(403).json({ error: 'Acceso exclusivo para administradores.' });

    if (req.method === 'GET') {
      const backup = await makeBackup(client);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('Content-Disposition', 'attachment; filename="TIENDA_POS_RESPALDO_GLOBAL.json"');
      return res.status(200).json(backup);
    }

    const backup = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!backup || backup.format !== 'tienda-pos-global-backup' || backup.version !== 1 || !Array.isArray(backup.tables)) {
      return res.status(400).json({ error: 'El archivo no es un respaldo global válido de tienda-pos.' });
    }

    const liveTables = await listTables(client);
    const liveSet = new Set(liveTables);
    const incoming = new Map<string, any>();
    for (const item of backup.tables) {
      if (!item || typeof item.name !== 'string' || !liveSet.has(item.name) || incoming.has(item.name) ||
          !Array.isArray(item.columns) || !Array.isArray(item.rows)) {
        return res.status(400).json({ error: 'El respaldo contiene tablas duplicadas, desconocidas o con estructura inválida.' });
      }
      const info = await client.execute(`PRAGMA table_info("${item.name.replace(/"/g, '""')}")`);
      const allowed = new Set(info.rows.map((r: any) => String(r.name)));
      if (item.columns.some((c: any) => typeof c !== 'string' || !allowed.has(c)) ||
          item.rows.some((row: any) => !row || typeof row !== 'object' || Array.isArray(row) ||
            Object.keys(row).some((key) => !item.columns.includes(key)))) {
        return res.status(400).json({ error: `La estructura de la tabla ${item.name} no coincide con esta versión del sistema.` });
      }
      incoming.set(item.name, item);
    }
    if (!incoming.has('system_users')) {
      return res.status(400).json({ error: 'El respaldo no contiene los usuarios del sistema.' });
    }

    // Guardamos un snapshot en memoria antes de modificar. Si falla cualquier
    // sentencia, la transacción se revierte íntegramente.
    const tx = await client.transaction('write');
    try {
      const now = new Date().toISOString();
      for (const table of [...liveTables].reverse()) {
        if (incoming.has(table)) await tx.execute(`DELETE FROM "${table.replace(/"/g, '""')}"`);
      }
      for (const table of liveTables) {
        const item = incoming.get(table);
        if (!item || !item.rows.length || !item.columns.length) continue;
        const names = item.columns.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(', ');
        const placeholders = item.columns.map(() => '?').join(', ');
        const sql = `INSERT INTO "${table.replace(/"/g, '""')}" (${names}) VALUES (${placeholders})`;
        for (const row of item.rows) {
          await tx.execute({ sql, args: item.columns.map((column: string) => row[column] === undefined ? null : row[column]) });
        }
      }
      // Las sesiones nunca se restauran: obliga a autenticar nuevamente.
      await tx.execute('DELETE FROM auth_sessions');
      await tx.execute('DELETE FROM customer_sessions');
      await tx.commit();
      return res.status(200).json({ success: true, restoredTables: incoming.size, restoredAt: now, sessionsReset: true });
    } catch (error) {
      try { await tx.rollback(); } catch {}
      throw error;
    }
  } catch (error: any) {
    console.error('[admin-backup]', error);
    return res.status(500).json({ error: error?.message || 'No se pudo completar la operación de respaldo.' });
  } finally {
    client.close();
  }
}
