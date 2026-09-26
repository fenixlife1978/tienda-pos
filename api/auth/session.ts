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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionId = getCookie(req, 'tienda_pos_session');
    if (!sessionId) return res.status(401).json({ authenticated: false });

    const client = db();
    const result = await client.execute({
      sql: `SELECT u.*
            FROM auth_sessions s
            JOIN system_users u ON u.id=s.user_id
            WHERE s.id=? AND s.revoked_at IS NULL AND s.expires_at > ?
              AND u.active=1
            LIMIT 1`,
      args: [sessionId, new Date().toISOString()]
    });

    const row: any = result.rows[0];
    if (!row) return res.status(401).json({ authenticated: false });

    return res.status(200).json({
      authenticated: true,
      user: {
        id: String(row.id),
        name: String(row.name),
        email: String(row.email),
        role: String(row.role),
        avatar: row.avatar ? String(row.avatar) : undefined,
        active: Boolean(row.active),
        isInitialGeneric: Boolean(row.is_initial_generic),
        createdAt: String(row.created_at || new Date().toISOString())
      }
    });
  } catch (error: any) {
    console.error('[auth/session]', error);
    return res.status(500).json({ authenticated: false, error: error?.message || 'Error interno de sesión' });
  }
}
