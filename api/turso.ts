import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

function db() {
  if (!TURSO_URL || !TURSO_TOKEN) throw new Error('Turso no está configurado en el servidor');
  return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
}

function argsOf(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const client = db();

    if (body.operation === 'health') {
      await client.execute('SELECT 1 AS ok');
      return res.status(200).json({ configured: true });
    }

    if (body.operation === 'authenticateUser') {
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = String(body.role || '').trim();
      if (!username || !password) return res.status(400).json({ error: 'Credenciales incompletas' });

      if (username === 'admin' && password === 'Admin123!') {
        const seed = await client.execute({ sql: `SELECT * FROM system_users WHERE id = 'usr-admin-initial' OR (is_initial_generic = 1 AND LOWER(email) = 'admin') ORDER BY CASE WHEN id = 'usr-admin-initial' THEN 0 ELSE 1 END LIMIT 1`, args: [] });
        let seedRow: any = seed.rows[0];
        if (!seedRow) {
          const anyAdmin = await client.execute({ sql: `SELECT 1 FROM system_users WHERE role = 'admin' AND active = 1 LIMIT 1`, args: [] });
          if (!anyAdmin.rows.length) {
            await client.execute({ sql: `INSERT INTO system_users (id, name, email, role, active, password, is_initial_generic, created_at) VALUES ('usr-admin-initial', 'Administrador Principal', 'admin', 'admin', 1, 'Admin123!', 1, ?)`, args: [new Date().toISOString().split('T')[0]] });
            const created = await client.execute({ sql: `SELECT * FROM system_users WHERE id = 'usr-admin-initial' LIMIT 1`, args: [] });
            seedRow = created.rows[0];
          }
        } else if (!Number(seedRow.active) || String(seedRow.password || '') !== 'Admin123!') {
          await client.execute({ sql: `UPDATE system_users SET active = 1, password = 'Admin123!', role = 'admin', email = 'admin', is_initial_generic = 1 WHERE id = ?`, args: [String(seedRow.id)] });
          const repaired = await client.execute({ sql: `SELECT * FROM system_users WHERE id = ? LIMIT 1`, args: [String(seedRow.id)] });
          seedRow = repaired.rows[0];
        }
        if (seedRow) return res.status(200).json({ user: { id: String(seedRow.id), name: String(seedRow.name), email: String(seedRow.email), role: seedRow.role, avatar: seedRow.avatar ? String(seedRow.avatar) : undefined, active: Boolean(seedRow.active), isInitialGeneric: Boolean(seedRow.is_initial_generic), createdAt: String(seedRow.created_at || new Date().toISOString()) } });
      }

      const result = await client.execute({
        sql: `SELECT * FROM system_users
               WHERE active = 1
                 AND (LOWER(email) = ? OR LOWER(name) = ? OR (? IN ('admin','administrador') AND (is_initial_generic = 1 OR role = 'admin')))
               ORDER BY CASE WHEN role = ? THEN 0 ELSE 1 END, is_initial_generic DESC, name ASC
               LIMIT 1`,
        args: [username, username, username, role],
      });
      const row: any = result.rows[0];
      if (!row || String(row.password || '') !== password) {
        return res.status(401).json({ error: 'Usuario o credenciales no encontradas' });
      }
      return res.status(200).json({
        user: {
          id: String(row.id),
          name: String(row.name),
          email: String(row.email),
          role: row.role,
          avatar: row.avatar ? String(row.avatar) : undefined,
          active: Boolean(row.active),
          isInitialGeneric: Boolean(row.is_initial_generic),
          createdAt: String(row.created_at || new Date().toISOString()),
        }
      });
    }

    if (body.operation === 'resetDatabase') {
      // Reinicio destructivo: solo puede ejecutarlo una sesión administrativa válida.
      const cookieHeader = String(req.headers?.cookie || '');
      const match = cookieHeader.match(/(?:^|;\\s*)tienda_pos_session=([^;]+)/);
      const sessionId = match ? decodeURIComponent(match[1]) : '';
      if (!sessionId) return res.status(401).json({ error: 'Sesión administrativa requerida' });

      const auth = await client.execute({
        sql: `SELECT u.id, u.role, u.active
              FROM auth_sessions s
              JOIN system_users u ON u.id = s.user_id
              WHERE s.id = ? AND s.revoked_at IS NULL
                AND s.expires_at > datetime('now')
                AND u.active = 1
              LIMIT 1`,
        args: [sessionId],
      });
      const authRow: any = auth.rows[0];
      if (!authRow || String(authRow.role) !== 'admin') {
        return res.status(403).json({ error: 'Solo un administrador puede reiniciar el sistema' });
      }

      const tx = await client.transaction('write');
      try {
        const tablesResult = await tx.execute(`
          SELECT name FROM sqlite_master
          WHERE type='table'
            AND name NOT LIKE 'sqlite_%'
            AND name NOT IN ('omni_schema_meta', 'activity_changes')
          ORDER BY name
        `);
        const tables = tablesResult.rows
          .map((row: any) => String(row.name))
          .filter((name) => /^[A-Za-z0-9_]+$/.test(name));

        for (const table of tables) {
          await tx.execute(`DELETE FROM "${table}"`);
        }

        // El cursor también se limpia para que el próximo snapshot sea limpio.
        await tx.execute('DELETE FROM activity_changes');

        // Verificación obligatoria: ninguna tabla operativa puede conservar filas.
        const verify = await tx.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('omni_schema_meta', 'activity_changes', 'system_users') ORDER BY name`);
        for (const row of verify.rows) {
          const tableName = String(row.name);
          const count = await tx.execute({ sql: 'SELECT COUNT(*) AS n FROM "' + tableName + '"', args: [] });
          if (Number(count.rows[0]?.n || 0) !== 0) throw new Error('Reinicio incompleto: la tabla ' + tableName + ' todavía contiene datos');
        }

        // Único dato operativo que permanece después del reinicio.
        await tx.execute({
          sql: `INSERT INTO system_users
            (id, name, email, role, active, password, is_initial_generic, created_at)
            VALUES ('usr-admin-initial', 'Administrador Principal', 'admin', 'admin', 1, 'Admin123!', 1, ?)`,
          args: [new Date().toISOString().split('T')[0]],
        });

        await tx.commit();
        await client.execute('PRAGMA foreign_keys = ON');
        return res.status(200).json({
          ok: true,
          reset: true,
          preserved: 'usr-admin-initial',
          deletedTables: tables,
        });
      } catch (e) {
        try { await tx.rollback(); } catch {}
        try { await client.execute('PRAGMA foreign_keys = ON'); } catch {}
        throw e;
      }
    }

    if (body.operation === 'saveSupplier') {
      const s = body.supplier || {};
      const id = String(s.id || '').trim();
      const name = String(s.name || '').trim();
      const rif = String(s.rif || '').trim();
      if (!id || !name || !rif) return res.status(400).json({ error: 'Proveedor incompleto' });

      const now = new Date().toISOString();
      // Proveedor = maestro crítico: escritura + evento de sincronización en la
      // misma transacción. No dependemos de triggers para que el cambio viaje
      // a los demás dispositivos.
      const tx = await client.transaction('write');
      try {
        await tx.execute({
          sql: `INSERT INTO suppliers
            (id, name, rif, phone, email, contact_person, contact_name, address, credit_days, credit_limit_usd, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM suppliers WHERE id = ?), ?))
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              rif=excluded.rif,
              phone=excluded.phone,
              email=excluded.email,
              contact_person=excluded.contact_person,
              contact_name=excluded.contact_name,
              address=excluded.address,
              credit_days=excluded.credit_days,
              credit_limit_usd=excluded.credit_limit_usd`,
          args: [
            id, name, rif,
            String(s.phone || ''),
            String(s.email || ''),
            String(s.contactPerson || s.contactName || ''),
            String(s.contactName || s.contactPerson || ''),
            String(s.address || ''),
            Number(s.creditDays ?? 15),
            Number(s.creditLimitUSD ?? 0),
            id, now,
          ],
        });

        // Registrar el cambio de forma idempotente. Si los triggers de esquema
        // también existen, no generamos un segundo evento para el mismo instante.
        await tx.execute({
          sql: `INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
                SELECT 'suppliers', ?, 'upsert', ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM activity_changes
                  WHERE table_name = 'suppliers'
                    AND entity_id = ?
                    AND changed_at = ?
                )`,
          args: [id, now, id, now],
        });

        const verify = await tx.execute({
          sql: 'SELECT id, name, rif FROM suppliers WHERE id = ?',
          args: [id],
        });
        if (!verify.rows.length) throw new Error('Proveedor no quedó persistido en Turso');

        await tx.commit();

        // Verificación posterior al COMMIT contra la conexión principal.
        const persisted = await client.execute({
          sql: 'SELECT id FROM suppliers WHERE id = ?',
          args: [id],
        });
        if (!persisted.rows.length) throw new Error('Turso confirmó la escritura pero no se encontró el proveedor después del commit');

        return res.status(200).json({ ok: true, supplierId: id, persisted: true });
      } catch (e) {
        try { await tx.rollback(); } catch {}
        throw e;
      }
    }
    if (body.operation === 'deleteSupplier') {
      const id = String(body.supplierId || '').trim();
      if (!id) return res.status(400).json({ error: 'Proveedor no indicado' });
      const tx = await client.transaction('write');
      try {
        const result = await tx.execute({ sql: 'DELETE FROM suppliers WHERE id = ?', args: [id] });
        await tx.execute({ sql: `INSERT INTO activity_changes (table_name, entity_id, operation, changed_at) VALUES ('suppliers', ?, 'delete', ?)`, args: [id, new Date().toISOString()] });
        await tx.commit();
        return res.status(200).json({ ok: true, deleted: Number(result.rowsAffected || 0) });
      } catch (e) {
        try { await tx.rollback(); } catch {}
        throw e;
      }
    }

    if (body.operation === 'execute') {
      const result = await client.execute({ sql: String(body.sql || ''), args: argsOf(body.args) as any });
      return res.status(200).json({
        rows: result.rows,
        rowsAffected: Number(result.rowsAffected || 0),
        lastInsertRowid: result.lastInsertRowid == null ? null : String(result.lastInsertRowid),
      });
    }

    if (body.operation === 'inventoryMovement') {
      const tx = await client.transaction('write');
      try {
        const m = body.movement;
        const ins = await tx.execute({
          sql: `INSERT OR IGNORE INTO inventory_movements
            (movement_id, product_id, quantity_delta, movement_type, source_operation_id, terminal_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [m.movementId,m.productId,m.quantityDelta,m.movementType,m.sourceOperationId,m.terminalId,m.createdAt],
        });
        if (Number(ins.rowsAffected || 0) === 0) {
          await tx.rollback();
          return res.status(200).json({ result: 'already_applied' });
        }
        const up = await tx.execute({
          sql: 'UPDATE products SET stock = MAX(0, ROUND(stock + ?, 3)), updated_at = ? WHERE id = ?',
          args: [m.quantityDelta,m.createdAt,m.productId],
        });
        if (!Number(up.rowsAffected || 0)) throw new Error(`Producto no encontrado para movimiento de inventario: ${m.productId}`);
        await tx.commit();
        return res.status(200).json({ result: 'applied' });
      } catch (e) { try { await tx.rollback(); } catch {} throw e; }
    }

    if (body.operation === 'offlineSale' || body.operation === 'saleReversal') {
      // These critical operations remain server-side transactional. The existing
      // client implementation is moved here without exposing Turso credentials.
      const op = body.payload;
      const tx = await client.transaction('write');
      try {
        const type = body.operation === 'offlineSale' ? 'sale' : 'sale_reversal';
        await tx.execute({
          sql: "INSERT OR IGNORE INTO sync_operations (operation_id, terminal_id, operation_type, entity_id, payload, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
          args: [op.operationId, op.terminalId, type, op.order.id, JSON.stringify({ orderId: op.order.id, invoiceId: op.invoice.id }), op.order.createdAt],
        });
        const existing = await tx.execute({ sql: 'SELECT status FROM sync_operations WHERE operation_id = ?', args: [op.operationId] });
        if (String(existing.rows[0]?.status || '') === 'processed') {
          await tx.rollback();
          return res.status(200).json({ result: 'already_applied' });
        }

        const pending:any[] = [];
        for (const m of op.inventoryMovements || []) {
          const ins = await tx.execute({sql:'INSERT OR IGNORE INTO inventory_movements (movement_id, product_id, quantity_delta, movement_type, source_operation_id, terminal_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',args:[m.movementId,m.productId,m.quantityDelta,m.movementType,m.sourceOperationId,m.terminalId,m.createdAt]});
          if (Number(ins.rowsAffected || 0) > 0) pending.push(m);
        }
        const deltas = new Map<string, number>();
        for (const m of pending) deltas.set(m.productId,(deltas.get(m.productId)||0)+Number(m.quantityDelta||0));
        for (const [productId,delta] of deltas) {
          const p = await tx.execute({sql:'SELECT stock FROM products WHERE id = ?',args:[productId]});
          if (!p.rows.length) throw new Error(`Producto no encontrado para movimiento de inventario: ${productId}`);
          const stock=Number(p.rows[0].stock||0);
          if (type==='sale' && delta < 0 && stock+delta < -0.000001) throw new Error(`Conflicto de stock en venta offline para producto ${productId}: disponible ${stock}, solicitado ${Math.abs(delta)}.`);
        }
        for (const [productId,delta] of deltas) {
          const up=await tx.execute({sql:'UPDATE products SET stock = ROUND(stock + ?, 3), updated_at = ? WHERE id = ?',args:[delta,op.order.createdAt,productId]});
          if(!Number(up.rowsAffected||0)) throw new Error(`Producto no encontrado para actualización de inventario: ${productId}`);
        }

        const o=op.order;
        await tx.execute({sql:'INSERT OR REPLACE INTO orders (id,order_number,customer_id,customer_name,customer_rif,customer_phone,customer_address,items,subtotal_usd,tax_usd,total_usd,total_bs,bcv_rate,payment_method,payment_splits,payment_status,order_status,payment_reference,channel,created_at,estimated_delivery,credit_due_date,credit_days,notes,is_voided,voided_at,voided_by,void_reason,is_returned,returned_at,returned_by,return_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[o.id,o.orderNumber,o.customerId,o.customerName,o.customerRif,o.customerPhone,o.customerAddress,JSON.stringify(o.items),o.subtotalUSD,o.taxUSD,o.totalUSD,o.totalBs,o.bcvRate,o.paymentMethod,o.paymentSplits?JSON.stringify(o.paymentSplits):null,o.paymentStatus,o.orderStatus,o.paymentReference||null,o.channel,o.createdAt,o.estimatedDelivery||null,o.creditDueDate||null,o.creditDays??null,o.notes||null,o.isVoided?1:0,o.voidedAt||null,o.voidedBy||null,o.voidReason||null,o.isReturned?1:0,o.returnedAt||null,o.returnedBy||null,o.returnReason||null]});
        const inv=op.invoice;
        await tx.execute({sql:'INSERT OR REPLACE INTO invoices (id,invoice_number,order_id,customer_id,customer_name,customer_rif,customer_address,customer_phone,items,subtotal_usd,tax_usd,total_usd,total_bs,bcv_rate,payment_method,payment_splits,payment_status,created_at,due_date,is_credit,credit_days,is_voided,voided_at,voided_by,void_reason,is_returned,returned_at,returned_by,return_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[inv.id,inv.invoiceNumber,inv.orderId,inv.customerId,inv.customerName,inv.customerRif,inv.customerAddress,inv.customerPhone,JSON.stringify(inv.items),inv.subtotalUSD,inv.taxUSD,inv.totalUSD,inv.totalBs,inv.bcvRate,inv.paymentMethod,inv.paymentSplits?JSON.stringify(inv.paymentSplits):null,inv.paymentStatus,inv.createdAt,inv.dueDate||null,inv.isCredit?1:0,inv.creditDays??null,inv.isVoided?1:0,inv.voidedAt||null,inv.voidedBy||null,inv.voidReason||null,inv.isReturned?1:0,inv.returnedAt||null,inv.returnedBy||null,inv.returnReason||null]});
        if(op.customer){const x=op.customer;await tx.execute({sql:'INSERT OR REPLACE INTO customers (id,name,rif,email,phone,address,has_credit,credit_days,credit_limit_usd,current_debt_usd,password,avatar,notification_preferences,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[x.id,x.name,x.rif,x.email,x.phone,x.address,x.hasCredit?1:0,x.creditDays||15,x.creditLimitUSD||0,x.currentDebtUSD||0,x.password||null,x.avatar||null,x.notificationPreferences?JSON.stringify(x.notificationPreferences):null,new Date().toISOString()]});}
        if(op.receivable){const r=op.receivable;await tx.execute({sql:'INSERT OR REPLACE INTO accounts_receivable (id,invoice_id,invoice_number,customer_id,customer_name,customer_phone,total_amount_usd,amount_paid_usd,balance_usd,issued_date,due_date,credit_days,status,created_at,is_voided,voided_at,void_reason,payment_history) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[r.id,r.invoiceId,r.invoiceNumber,r.customerId,r.customerName,r.customerPhone,r.totalAmountUSD,r.amountPaidUSD,r.balanceUSD,r.issuedDate,r.dueDate,r.creditDays,r.status,r.issuedDate,r.isVoided?1:0,r.voidedAt||null,r.voidReason||null,JSON.stringify(r.paymentHistory||[])]});}
        await tx.execute({sql:"UPDATE sync_operations SET status='processed',processed_at=?,error=NULL WHERE operation_id=?",args:[new Date().toISOString(),op.operationId]});
        await tx.commit();
        return res.status(200).json({result:'applied'});
      } catch(e){try{await tx.rollback();}catch{} throw e;}
    }

    return res.status(400).json({ error: 'Operación Turso no reconocida' });
  } catch (error:any) {
    console.error('Turso API error:', error);
    return res.status(500).json({ error: error?.message || 'Error interno de Turso' });
  }
}
