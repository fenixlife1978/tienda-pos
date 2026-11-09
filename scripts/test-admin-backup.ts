import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@libsql/client';
import handler from '../api/admin-backup.ts';

const dir = mkdtempSync(join(tmpdir(), 'tienda-pos-backup-'));
const dbPath = join(dir, 'backup-test.db');
process.env.TURSO_DATABASE_URL = 'file:' + dbPath;
process.env.TURSO_AUTH_TOKEN = 'local-test-token';
const sessionId = 'test-admin-session';
const client = createClient({ url: process.env.TURSO_DATABASE_URL, intMode: 'bigint' });

function response() {
  return {
    code: 200, data: undefined, headers: {},
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}
async function call(method, query = {}, body = undefined) {
  const res = response();
  await handler({ method, query, body, headers: { 'x-tienda-pos-session': sessionId } }, res);
  assert.ok(res.code >= 200 && res.code < 300, JSON.stringify(res.data));
  return res.data;
}

try {
  await client.execute('PRAGMA foreign_keys = ON');
  await client.execute(`CREATE TABLE system_users (
    id TEXT PRIMARY KEY, role TEXT NOT NULL, active INTEGER NOT NULL, display_name TEXT NOT NULL
  )`);
  await client.execute(`CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES system_users(id),
    revoked_at TEXT, expires_at TEXT NOT NULL
  )`);
  await client.execute('CREATE TABLE customer_sessions (id TEXT PRIMARY KEY, customer_id TEXT)');
  await client.execute('CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)');
  await client.execute(`CREATE TABLE inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL, quantity INTEGER NOT NULL, amount INTEGER NOT NULL,
    payload BLOB, doubled INTEGER GENERATED ALWAYS AS (quantity * 2) STORED
  )`);
  await client.execute('CREATE TABLE empty_records (id INTEGER PRIMARY KEY, note TEXT)');
  await client.execute({ sql: 'INSERT INTO system_users VALUES (?, ?, ?, ?)', args: ['admin-1', 'admin', 1, 'Administrador'] });
  await client.execute({ sql: 'INSERT INTO auth_sessions VALUES (?, ?, NULL, ?)', args: [sessionId, 'admin-1', new Date(Date.now() + 3600000).toISOString()] });
  await client.execute({ sql: 'INSERT INTO customer_sessions VALUES (?, ?)', args: ['customer-session-1', 'customer-1'] });
  await client.execute({ sql: 'INSERT INTO categories VALUES (?, ?)', args: [1, 'General'] });
  await client.execute({
    sql: 'INSERT INTO inventory (id, category_id, name, quantity, amount, payload) VALUES (?, ?, ?, ?, ?, ?)',
    args: [7, 1, 'Artículo de prueba', 4, 9007199254740993n, new Uint8Array([0, 255, 34, 10])],
  });
  await client.batch(Array.from({ length: 349 }, (_, i) => ({
    sql: 'INSERT INTO inventory (id, category_id, name, quantity, amount) VALUES (?, ?, ?, ?, ?)',
    args: [i + 8, 1, 'Artículo ' + (i + 1), i + 1, i + 100],
  })), 'write');

  const manifest = await call('GET', { action: 'manifest' });
  assert.ok(manifest.exportId);
  assert.ok(manifest.tables.some((t) => t.name === 'inventory' && !t.columns.includes('doubled')));
  assert.ok(!manifest.tables.some((t) => t.name.includes('_admin_backup_')));

  // Mutate live data after snapshot creation: exported pages must remain at the snapshot state.
  await client.execute('UPDATE inventory SET quantity=99 WHERE id=7');
  await client.execute({ sql: 'INSERT INTO inventory (category_id, name, quantity, amount) VALUES (?, ?, ?, ?)', args: [1, 'Posterior', 1, 2] });

  const tables = [];
  for (const table of manifest.tables) {
    const rows = [];
    for (let offset = 0; offset < table.rowCount; offset += manifest.pageSize) {
      const page = await call('GET', {
        action: 'page', exportId: manifest.exportId, table: table.name, offset: String(offset),
      });
      rows.push(...page.rows);
    }
    assert.equal(rows.length, table.rowCount);
    tables.push({ name: table.name, columns: table.columns, rows });
  }
  await call('POST', {}, { action: 'export-release', exportId: manifest.exportId });
  const backup = {
    format: manifest.format, version: manifest.version, createdAt: manifest.createdAt,
    source: manifest.source, tables,
  };
  const raw = JSON.stringify(backup);
  const bytes = Buffer.from(raw, 'utf8');
  const init = await call('POST', {}, {
    action: 'restore-init', totalChunks: 1, byteLength: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  await call('POST', {}, { action: 'restore-chunk', operationId: init.operationId, chunkIndex: 0, payload: raw });
  const restored = await call('POST', {}, { action: 'restore-commit', operationId: init.operationId });
  assert.equal(restored.success, true);

  const check = await client.execute('SELECT id, quantity, amount, payload, doubled FROM inventory ORDER BY id');
  assert.equal(check.rows.length, 350, 'restoration must remove rows added after the snapshot and restore all snapshot pages');
  assert.equal(Number(check.rows[0].quantity), 4);
  assert.equal(String(check.rows[0].amount), '9007199254740993');
  const blobValue = check.rows[0].payload;
  const blobBytes = blobValue instanceof ArrayBuffer ? Array.from(new Uint8Array(blobValue)) : Array.from(blobValue as unknown as Uint8Array);
  assert.deepEqual(blobBytes, [0, 255, 34, 10]);
  assert.equal(Number(check.rows[0].doubled), 8, 'generated column must be recomputed');
  const sessions = await client.execute('SELECT COUNT(*) AS n FROM auth_sessions');
  const customerSessions = await client.execute('SELECT COUNT(*) AS n FROM customer_sessions');
  assert.equal(Number(sessions.rows[0].n), 0);
  assert.equal(Number(customerSessions.rows[0].n), 0);
  const fk = await client.execute('PRAGMA foreign_key_check');
  assert.equal(fk.rows.length, 0, 'restored database must satisfy foreign keys');
  console.log('OK: instantánea estable, restauración, FK, BLOB, BigInt, columnas generadas, tablas vacías y revocación de sesiones.');
} finally {
  await client.close();
  rmSync(dir, { recursive: true, force: true });
}
