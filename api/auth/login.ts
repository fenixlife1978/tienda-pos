import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

function db() {
  if (!TURSO_URL || !TURSO_TOKEN) throw new Error('Turso no está configurado en el servidor');
  return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const client = db();
    const body = req.body || {};
    const username = String(body.username || body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || '').trim().toLowerCase();

    if (!username || !password) return res.status(400).json({ error: 'Credenciales incompletas' });

    await client.execute(`CREATE TABLE IF NOT EXISTS system_users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
      avatar TEXT, active INTEGER DEFAULT 1, password TEXT,
      is_initial_generic INTEGER DEFAULT 0, created_at TEXT
    )`);

    // El administrador semilla se garantiza directamente en Turso antes de autenticar.
    if (username === 'admin' && password === 'Admin123!') {
      const seed = await client.execute({
        sql: `SELECT * FROM system_users
              WHERE id = 'usr-admin-initial'
                 OR (is_initial_generic = 1 AND LOWER(email) = 'admin')
              ORDER BY CASE WHEN id = 'usr-admin-initial' THEN 0 ELSE 1 END
              LIMIT 1`,
        args: []
      });

      if (!seed.rows.length) {
        await client.execute({
          sql: `INSERT INTO system_users
            (id,name,email,role,active,password,is_initial_generic,created_at)
            VALUES ('usr-admin-initial','Administrador Principal','admin','admin',1,'Admin123!',1,?)`,
          args: [new Date().toISOString().split('T')[0]]
        });
      } else {
        const row: any = seed.rows[0];
        await client.execute({
          sql: `UPDATE system_users
                SET active=1,password='Admin123!',role='admin',email='admin',is_initial_generic=1
                WHERE id=?`,
          args: [String(row.id)]
        });
      }
    }

    const result = await client.execute({
      sql: `SELECT * FROM system_users
            WHERE active=1
              AND (LOWER(email)=? OR LOWER(name)=?)
            ORDER BY is_initial_generic DESC, name ASC
            LIMIT 1`,
      args: [username, username]
    });

    const row: any = result.rows[0];
    if (!row || String(row.password || '') !== password) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos, o usuario inactivo.' });
    }

    if (role && role !== String(row.role || '').trim().toLowerCase()) {
      return res.status(403).json({ error: `El usuario está registrado con el rol ${String(row.role).toUpperCase()}.` });
    }

    const sessionId = crypto.randomUUID();
    await client.execute(`CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL, revoked_at TEXT
    )`);

    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await client.execute({
      sql: `INSERT INTO auth_sessions (id,user_id,created_at,expires_at,revoked_at)
             VALUES (?,?,?,?,NULL)`,
      args: [sessionId, String(row.id), now.toISOString(), expires.toISOString()]
    });

    res.setHeader('Set-Cookie', cookie('tienda_pos_session', sessionId, 7 * 24 * 60 * 60));
    return res.status(200).json({
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
    console.error('[auth/login]', error);
    return res.status(500).json({ error: error?.message || 'Error interno de autenticación' });
  }
}
