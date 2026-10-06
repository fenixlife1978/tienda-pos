import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

function db() {
  if (!TURSO_URL || !TURSO_TOKEN) throw new Error('Turso no está configurado en el servidor');
  return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
}

function getTabSession(req: any) {
  return String(req.headers?.['x-tienda-pos-session'] || '').trim();
}

function getCookie(req: any, name: string) {
  const raw = String(req.headers?.cookie || '');
  const match = raw.split(';').map((v: string) => v.trim()).find((v: string) => v.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionId = getTabSession(req) || getCookie(req, 'tienda_pos_session');
    if (!sessionId) {
      res.setHeader('Set-Cookie', 'tienda_pos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure');
      return res.status(200).json({ ok: true, revoked: false });
    }

    const client = db();
    await client.execute({
      sql: 'UPDATE auth_sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL',
      args: [new Date().toISOString(), sessionId],
    });

    res.setHeader('Set-Cookie', 'tienda_pos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure');
    return res.status(200).json({ ok: true, revoked: true });
  } catch (error: any) {
    console.error('[auth/logout]', error);
    return res.status(500).json({ error: error?.message || 'Error interno al cerrar sesión' });
  }
}
