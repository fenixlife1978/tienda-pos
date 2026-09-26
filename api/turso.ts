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
          password: row.password ? String(row.password) : undefined,
          isInitialGeneric: Boolean(row.is_initial_generic),
          createdAt: String(row.created_at || new Date().toISOString()),
        }
      });
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
