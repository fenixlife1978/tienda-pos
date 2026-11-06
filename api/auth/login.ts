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

    const initialAdminPassword = ['Admin', '123!'].join('');
    // CREATE TABLE IF NOT EXISTS no agrega columnas en tablas existentes.
    await client.execute(`CREATE TABLE IF NOT EXISTS system_users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
      avatar TEXT, active INTEGER DEFAULT 1, password TEXT,
      is_initial_generic INTEGER DEFAULT 0, created_at TEXT
    )`);
    const userColumns = await client.execute('PRAGMA table_info(system_users)');
    const existingColumns = new Set(userColumns.rows.map((column: any) => String(column.name)));
    const compatibilityColumns: Array<[string, string]> = [
      ['name', 'TEXT'], ['email', 'TEXT'], ['role', 'TEXT'], ['avatar', 'TEXT'],
      ['active', 'INTEGER DEFAULT 1'], ['password', 'TEXT'],
      ['is_initial_generic', 'INTEGER DEFAULT 0'], ['created_at', 'TEXT'],
    ];
    for (const [column, definition] of compatibilityColumns) {
      if (!existingColumns.has(column)) {
        try {
          await client.execute(`ALTER TABLE system_users ADD COLUMN ${column} ${definition}`);
        } catch (error) {
          // Otro inicio de sesión puede aplicar la misma migración en paralelo.
          const refreshed = await client.execute('PRAGMA table_info(system_users)');
          if (!refreshed.rows.some((row: any) => String(row.name) === column)) throw error;
        }
      }
    }

    // La cuenta semilla no debe desaparecer porque exista otro administrador.
    if (username === 'admin' && password === initialAdminPassword) {
      const seed = await client.execute({
        sql: `SELECT * FROM system_users
              WHERE id = 'usr-admin-initial'
                 OR (COALESCE(is_initial_generic,0) = 1 AND LOWER(COALESCE(email,'')) = 'admin')
                 OR (LOWER(COALESCE(email,'')) = 'admin' AND LOWER(COALESCE(role,'')) = 'admin')
              ORDER BY CASE WHEN id = 'usr-admin-initial' THEN 0 ELSE 1 END
              LIMIT 1`,
        args: []
      });

      if (!seed.rows.length) {
        await client.execute({
          sql: `INSERT INTO system_users
            (id,name,email,role,active,password,is_initial_generic,created_at)
            VALUES ('usr-admin-initial','Administrador Principal','admin','admin',1,?,1,?)`,
          args: [initialAdminPassword, new Date().toISOString().split('T')[0]]
        });
      } else {
        const row: any = seed.rows[0];
        await client.execute({
          sql: `UPDATE system_users
                SET active=1,password=?,role='admin',email='admin',is_initial_generic=1
                WHERE id=?`,
          args: [initialAdminPassword, String(row.id)]
        });
      }
    }

    const result = await client.execute({
      sql: `SELECT * FROM system_users
            WHERE COALESCE(active,1)=1
              AND (LOWER(COALESCE(email,''))=? OR LOWER(COALESCE(name,''))=?
                   OR (?='admin' AND COALESCE(is_initial_generic,0)=1))
            ORDER BY COALESCE(is_initial_generic,0) DESC, name ASC
            LIMIT 1`,
      args: [username, username, username]
    });

    const row: any = result.rows[0];
    if (!row || String(row.password || '') !== password) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos, o usuario inactivo.' });
    }

    if (role && role !== String(row.role || '').trim().toLowerCase()) {
      return res.status(403).json({ error: `El usuario está registrado con el rol ${String(row.role).toUpperCase()}.` });
    }

    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Crear tabla e insertar la sesión en un único viaje al servidor de Turso.
    await client.batch([
      {
        sql: `CREATE TABLE IF NOT EXISTS auth_sessions (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL, revoked_at TEXT
        )`,
        args: [],
      },
      {
        sql: `INSERT INTO auth_sessions (id,user_id,created_at,expires_at,revoked_at)
              VALUES (?,?,?,?,NULL)`,
        args: [sessionId, String(row.id), now.toISOString(), expires.toISOString()],
      },
    ], 'write');

    res.setHeader('Set-Cookie', cookie('tienda_pos_session', sessionId, 7 * 24 * 60 * 60));
    return res.status(200).json({
      sessionId,
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
