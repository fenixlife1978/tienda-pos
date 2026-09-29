import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

function db() {
  if (!TURSO_URL || !TURSO_TOKEN) throw new Error('Turso no está configurado en el servidor');
  return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
}

function getCookie(req: any, name: string) {
  const raw = String(req.headers?.cookie || '');
  const match = raw.split(';').map((v: string) => v.trim()).find((v: string) => v.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // El cursor de cambios solo expone un número incremental; no expone
    // datos, credenciales ni registros. Debe ser consultable también desde
    // el portal cliente para que la sincronización sea realmente automática.
    const client = db();
    const since = Math.max(0, Number(req.query?.since || 0));
    const result = await client.execute('SELECT COALESCE(MAX(id), 0) AS latest_id FROM activity_changes');
    const latestId = Number(result.rows[0]?.latest_id || 0);

    return res.status(200).json({
      ok: true,
      changed: latestId > since,
      latest_id: latestId,
      server_time: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[turso-sync]', error);
    return res.status(500).json({ ok: false, error: error?.message || 'No se pudo consultar la sincronización' });
  }
}
