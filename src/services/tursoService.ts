type TursoClient = any;
import {
  BcvHistoryEntry,
  Customer,
  Invoice,
  Order,
  PayableItem,
  Product,
  ProductCategory,
  ProductUnit,
  ReceivableItem,
  Supplier,
  SystemSettings,
  User,
  PurchaseEntry,
  Terminal,
  TerminalUserAssignment,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_INVOICES,
  INITIAL_ORDERS,
  INITIAL_PAYABLES,
  INITIAL_PRODUCTS,
  INITIAL_RECEIVABLES,
  INITIAL_SETTINGS,
  EMPTY_SYSTEM_SETTINGS,
  INITIAL_GENERIC_ADMIN,
  INITIAL_SUPPLIERS,
  INITIAL_UNITS,
  INITIAL_USERS,
} from '../data/initialData';

export interface TursoConfig {
  url: string;
  authToken: string;
}

export interface SyncOperationRecord {
  operationId: string;
  terminalId: string;
  operationType: string;
  entityId: string;
  payload?: unknown;
}

export interface TursoSyncState {
  isConnected: boolean;
  isSyncing: boolean;
  statusText: string;
  lastSyncTime: string | null;
  errorMessage: string | null;
  tablesCreated: string[];
  totalRecordsInCloud: number;
}

class TursoService {
  private client: TursoClient | null = null;
  private currentConfig: TursoConfig | null = null;

  constructor() {
    this.initFromEnv();
  }

  private async request(operation: string, payload: Record<string, unknown> = {}) {
    const response = await fetch('/api/turso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ operation, ...payload }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data.error || 'Error comunicando con Turso'));
    return data;
  }

  public getStoredConfig(): TursoConfig {
    return { url: 'server-side', authToken: 'server-side' };
  }

  private initFromEnv() {
    this.initClient({ url: 'server-side', authToken: 'server-side' });
  }

  public initClient(config: TursoConfig): TursoClient | null {
    this.client = {
      execute: async (statement: any) => this.request('execute', {
        sql: typeof statement === 'string' ? statement : statement.sql,
        args: typeof statement === 'string' ? [] : (statement.args || []),
      }),
      transaction: async () => {
        throw new Error('Las transacciones críticas deben ejecutarse mediante una operación server-side.');
      },
    };
    this.currentConfig = config;
    return this.client;
  }

  public getClient(): TursoClient | null {
    return this.client || this.initClient({ url: 'server-side', authToken: 'server-side' });
  }

  public isConfigured(): boolean {
    return true;
  }

  private async ensureTerminalSchema(client: TursoClient): Promise<void> {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS terminals (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS terminal_user_assignments (
        terminal_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        PRIMARY KEY (terminal_id, user_id)
      );
    `);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_terminal_assignments_user ON terminal_user_assignments(user_id)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_terminal_assignments_terminal ON terminal_user_assignments(terminal_id)`);
  }

  /**
   * Ejecuta automáticamente todas las sentencias DDL para crear las tablas si no existen.
   */
  public async autoBootstrapSchema(): Promise<{ success: boolean; tables: string[]; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, tables: [], error: 'Turso URL no configurada' };
    }

    await this.ensureTerminalSchema(client);

    // Fast path: la base ya fue inicializada. En cada recarga no debemos
    // repetir decenas de CREATE/ALTER/DROP/TRIGGER contra Turso porque eso
    // bloqueaba la entrada durante varios segundos. El marcador vive en Turso,
    // por lo que funciona igual para todos los dispositivos.
    const schemaMarker = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='omni_schema_meta' LIMIT 1`
    );
    if (schemaMarker.rows.length > 0) {
      const versionRow = await client.execute(
        `SELECT version FROM omni_schema_meta WHERE id='main' LIMIT 1`
      );
      if (versionRow.rows.length > 0) {
        // Garantía de compatibilidad: bases creadas con versiones anteriores
        // pueden tener la tabla suppliers pero no su cursor de actividad.
        // Reinstalamos únicamente estos 3 triggers livianos; no ejecutamos
        // nuevamente todo el bootstrap del esquema.
        // Compatibilidad de esquema: todas las columnas utilizadas por el
        // formulario de Proveedores deben existir también en bases ya creadas.
        // ALTER TABLE es idempotente mediante captura del error "duplicate column".
        const compatibilityMigrations = [
          'ALTER TABLE orders ADD COLUMN payment_splits TEXT',
          'ALTER TABLE orders ADD COLUMN approved_at TEXT',
          'ALTER TABLE orders ADD COLUMN estimated_delivery TEXT',
          'ALTER TABLE orders ADD COLUMN credit_due_date TEXT',
          'ALTER TABLE orders ADD COLUMN credit_days INTEGER',
          'ALTER TABLE orders ADD COLUMN notes TEXT',
          'ALTER TABLE orders ADD COLUMN cash_session_id TEXT',
          'ALTER TABLE orders ADD COLUMN document_series TEXT',
          'ALTER TABLE orders ADD COLUMN document_sequence INTEGER',
          'ALTER TABLE orders ADD COLUMN return_number TEXT',
          'ALTER TABLE orders ADD COLUMN void_number TEXT',
          'ALTER TABLE orders ADD COLUMN is_voided INTEGER DEFAULT 0',
          'ALTER TABLE orders ADD COLUMN voided_at TEXT',
          'ALTER TABLE orders ADD COLUMN voided_by TEXT',
          'ALTER TABLE orders ADD COLUMN void_reason TEXT',
          'ALTER TABLE orders ADD COLUMN is_returned INTEGER DEFAULT 0',
          'ALTER TABLE orders ADD COLUMN returned_at TEXT',
          'ALTER TABLE orders ADD COLUMN returned_by TEXT',
          'ALTER TABLE orders ADD COLUMN return_reason TEXT',
          'ALTER TABLE invoices ADD COLUMN payment_splits TEXT',
          'ALTER TABLE invoices ADD COLUMN cash_session_id TEXT',
          'ALTER TABLE invoices ADD COLUMN document_series TEXT',
          'ALTER TABLE invoices ADD COLUMN document_sequence INTEGER',
          'ALTER TABLE invoices ADD COLUMN return_number TEXT',
          'ALTER TABLE invoices ADD COLUMN void_number TEXT',
          'ALTER TABLE invoices ADD COLUMN is_voided INTEGER DEFAULT 0',
          'ALTER TABLE invoices ADD COLUMN voided_at TEXT',
          'ALTER TABLE invoices ADD COLUMN voided_by TEXT',
          'ALTER TABLE invoices ADD COLUMN void_reason TEXT',
          'ALTER TABLE invoices ADD COLUMN is_returned INTEGER DEFAULT 0',
          'ALTER TABLE invoices ADD COLUMN returned_at TEXT',
          'ALTER TABLE invoices ADD COLUMN returned_by TEXT',
          'ALTER TABLE invoices ADD COLUMN return_reason TEXT',
          'ALTER TABLE suppliers ADD COLUMN phone TEXT',
          'ALTER TABLE suppliers ADD COLUMN email TEXT',
          'ALTER TABLE suppliers ADD COLUMN contact_person TEXT',
          'ALTER TABLE suppliers ADD COLUMN contact_name TEXT',
          'ALTER TABLE suppliers ADD COLUMN address TEXT',
          'ALTER TABLE suppliers ADD COLUMN credit_days INTEGER DEFAULT 15',
          'ALTER TABLE suppliers ADD COLUMN credit_limit_usd REAL DEFAULT 0',
          'ALTER TABLE suppliers ADD COLUMN created_at TEXT',
          'ALTER TABLE bcv_history ADD COLUMN effective_date TEXT',
          'ALTER TABLE bcv_history ADD COLUMN source TEXT',
          'ALTER TABLE bcv_history ADD COLUMN currencies TEXT',
          'ALTER TABLE products ADD COLUMN offer_condition TEXT',
          'ALTER TABLE products ADD COLUMN offer_badge_text TEXT',
          'ALTER TABLE products ADD COLUMN offer_savings_usd REAL',
          'ALTER TABLE products ADD COLUMN offer_savings_bs REAL',
          'ALTER TABLE products ADD COLUMN offer_min_quantity REAL',
          'ALTER TABLE products ADD COLUMN promotional_price_usd REAL',
          'ALTER TABLE products ADD COLUMN offer_start_date TEXT',
          'ALTER TABLE products ADD COLUMN offer_end_date TEXT',
          'ALTER TABLE cash_sessions ADD COLUMN user_id TEXT',
          'ALTER TABLE accounts_payable ADD COLUMN items_json TEXT'
        ];
        for (const sql of compatibilityMigrations) {
          try { await client.execute(sql); } catch {}
        }

        // El marcador de esquema nunca debe considerarse válido si faltan
        // columnas críticas de orders. Esto evita el fallo histórico "no such
        // column: approved_at" en bases antiguas que ya tenían omni_schema_meta.
        const orderColumns = await client.execute('PRAGMA table_info(orders)');
        const requiredOrderColumns = [
          'approved_at', 'payment_splits', 'estimated_delivery', 'credit_due_date',
          'credit_days', 'notes', 'cash_session_id', 'document_series',
          'document_sequence', 'return_number', 'void_number', 'is_voided',
          'voided_at', 'voided_by', 'void_reason', 'is_returned', 'returned_at',
          'returned_by', 'return_reason'
        ];
        const missingOrderColumns = requiredOrderColumns.filter(
          (column) => !orderColumns.rows.some((row: any) => String(row.name) === column)
        );
        if (missingOrderColumns.length > 0) {
          throw new Error(
            `Migración de Turso incompleta: faltan columnas en orders: ${missingOrderColumns.join(', ')}`
          );
        }

        // Reparar los triggers de actividad en bases existentes. Es crítico que
        // orders/invoices también generen actividad: de lo contrario el pedido puede
        // quedar insertado en Turso pero los demás dispositivos no reciben el cambio.
        const activityDefinitions = [
          { table: 'system_settings', id: "'main'", oldId: "'main'" },
          { table: 'categories', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'units', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'products', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'customers', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'suppliers', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'orders', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'invoices', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'accounts_receivable', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'accounts_payable', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'purchase_entries', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'inventory_movements', id: 'NEW.movement_id', oldId: 'OLD.movement_id' },
          { table: 'cash_sessions', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'cash_movements', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'system_users', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'bcv_history', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'system_notifications', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'terminals', id: 'NEW.id', oldId: 'OLD.id' },
          { table: 'terminal_user_assignments', id: "NEW.terminal_id || ':' || NEW.user_id", oldId: "OLD.terminal_id || ':' || OLD.user_id" },
        ];
        try {
          for (const { table, id, oldId } of activityDefinitions) {
            await client.execute(`DROP TRIGGER IF EXISTS activity_${table}_insert`);
            await client.execute(`DROP TRIGGER IF EXISTS activity_${table}_update`);
            await client.execute(`DROP TRIGGER IF EXISTS activity_${table}_delete`);
            await client.execute(`
              CREATE TRIGGER activity_${table}_insert
              AFTER INSERT ON ${table}
              BEGIN
                INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
                VALUES ('${table}', ${id}, 'insert', datetime('now'));
              END;
            `);
            await client.execute(`
              CREATE TRIGGER activity_${table}_update
              AFTER UPDATE ON ${table}
              BEGIN
                INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
                VALUES ('${table}', ${id}, 'update', datetime('now'));
              END;
            `);
            await client.execute(`
              CREATE TRIGGER activity_${table}_delete
              AFTER DELETE ON ${table}
              BEGIN
                INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
                VALUES ('${table}', ${oldId}, 'delete', datetime('now'));
              END;
            `);
          }
        } catch (triggerError) {
          console.warn('No se pudieron reparar los triggers de actividad:', triggerError);
        }
        return { success: true, tables: ['schema_ready', 'supplier_sync_ready'] };
      }
    }

    // Compatibilidad con bases creadas antes del marcador. Si el esquema
    // operativo ya existe, solo registramos el marcador y evitamos repetir el
    // bootstrap completo en el primer dispositivo que se conecte tras esta versión.
    const coreSchema = await client.execute(`
      SELECT COUNT(*) AS n
      FROM sqlite_master
      WHERE type='table'
        AND name IN ('products','system_users','activity_changes','cash_sessions','cash_movements','system_notifications')
    `);
    if (Number(coreSchema.rows[0]?.n || 0) >= 6) {
      // Una base antigua puede tener el esquema operativo pero no haber pasado
      // por el bootstrap original. Antes de crear omni_schema_meta debemos
      // aplicar las mismas migraciones críticas que usa el fast path.
      const legacyMigrations = [
        'ALTER TABLE orders ADD COLUMN payment_splits TEXT',
        'ALTER TABLE orders ADD COLUMN approved_at TEXT',
        'ALTER TABLE orders ADD COLUMN estimated_delivery TEXT',
        'ALTER TABLE orders ADD COLUMN credit_due_date TEXT',
        'ALTER TABLE orders ADD COLUMN credit_days INTEGER',
        'ALTER TABLE orders ADD COLUMN notes TEXT',
        'ALTER TABLE orders ADD COLUMN cash_session_id TEXT',
        'ALTER TABLE orders ADD COLUMN document_series TEXT',
        'ALTER TABLE orders ADD COLUMN document_sequence INTEGER',
        'ALTER TABLE orders ADD COLUMN return_number TEXT',
        'ALTER TABLE orders ADD COLUMN void_number TEXT',
        'ALTER TABLE orders ADD COLUMN is_voided INTEGER DEFAULT 0',
        'ALTER TABLE orders ADD COLUMN voided_at TEXT',
        'ALTER TABLE orders ADD COLUMN voided_by TEXT',
        'ALTER TABLE orders ADD COLUMN void_reason TEXT',
        'ALTER TABLE orders ADD COLUMN is_returned INTEGER DEFAULT 0',
        'ALTER TABLE orders ADD COLUMN returned_at TEXT',
        'ALTER TABLE orders ADD COLUMN returned_by TEXT',
        'ALTER TABLE orders ADD COLUMN return_reason TEXT',
        'ALTER TABLE invoices ADD COLUMN payment_splits TEXT',
        'ALTER TABLE invoices ADD COLUMN cash_session_id TEXT',
        'ALTER TABLE invoices ADD COLUMN document_series TEXT',
        'ALTER TABLE invoices ADD COLUMN document_sequence INTEGER',
        'ALTER TABLE invoices ADD COLUMN return_number TEXT',
        'ALTER TABLE invoices ADD COLUMN void_number TEXT',
        'ALTER TABLE invoices ADD COLUMN is_voided INTEGER DEFAULT 0',
        'ALTER TABLE invoices ADD COLUMN voided_at TEXT',
        'ALTER TABLE invoices ADD COLUMN voided_by TEXT',
        'ALTER TABLE invoices ADD COLUMN void_reason TEXT',
        'ALTER TABLE invoices ADD COLUMN is_returned INTEGER DEFAULT 0',
        'ALTER TABLE invoices ADD COLUMN returned_at TEXT',
        'ALTER TABLE invoices ADD COLUMN returned_by TEXT',
        'ALTER TABLE invoices ADD COLUMN return_reason TEXT',
        'ALTER TABLE products ADD COLUMN offer_condition TEXT',
        'ALTER TABLE products ADD COLUMN offer_badge_text TEXT',
        'ALTER TABLE products ADD COLUMN offer_savings_usd REAL',
        'ALTER TABLE products ADD COLUMN offer_savings_bs REAL',
        'ALTER TABLE products ADD COLUMN offer_min_quantity REAL',
        'ALTER TABLE products ADD COLUMN promotional_price_usd REAL',
        'ALTER TABLE products ADD COLUMN offer_start_date TEXT',
        'ALTER TABLE products ADD COLUMN offer_end_date TEXT',
        'ALTER TABLE accounts_payable ADD COLUMN items_json TEXT'
      ];
      for (const sql of legacyMigrations) {
        try { await client.execute(sql); } catch {}
      }

      const orderColumns = await client.execute('PRAGMA table_info(orders)');
      const requiredOrderColumns = [
        'approved_at', 'payment_splits', 'estimated_delivery', 'credit_due_date',
        'credit_days', 'notes', 'cash_session_id', 'document_series',
        'document_sequence', 'return_number', 'void_number', 'is_voided',
        'voided_at', 'voided_by', 'void_reason', 'is_returned', 'returned_at',
        'returned_by', 'return_reason'
      ];
      const missingOrderColumns = requiredOrderColumns.filter(
        (column) => !orderColumns.rows.some((row: any) => String(row.name) === column)
      );
      if (missingOrderColumns.length > 0) {
        throw new Error(
          `Migración de Turso incompleta antes de marcar el esquema: faltan columnas en orders: ${missingOrderColumns.join(', ')}`
        );
      }

      await client.execute(
        `CREATE TABLE IF NOT EXISTS omni_schema_meta (id TEXT PRIMARY KEY, version TEXT NOT NULL, updated_at TEXT NOT NULL)`
      );
      await client.execute({
        sql: `INSERT OR REPLACE INTO omni_schema_meta (id, version, updated_at) VALUES ('main', ?, ?)`,
        args: ['realtime-sync-v2', new Date().toISOString()],
      });
      return { success: true, tables: ['schema_ready', 'legacy_schema_migrated'] };
    }

    const tablesCreated: string[] = [];

    try {
      // 1. system_settings
      await client.execute(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at TEXT
        );
      `);
      tablesCreated.push('system_settings');

      // 2. categories
      await client.execute(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT,
          payment_history TEXT
        );
      `);
      tablesCreated.push('categories');

      // 3. units
      await client.execute(`
        CREATE TABLE IF NOT EXISTS units (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          abbreviation TEXT NOT NULL,
          allow_decimals INTEGER DEFAULT 0
        );
      `);
      tablesCreated.push('units');

      // 4. products
      await client.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          cost_usd REAL NOT NULL,
          profit_margin_percent REAL,
          price_usd REAL NOT NULL,
          stock REAL NOT NULL,
          min_stock REAL NOT NULL,
          unit TEXT NOT NULL,
          image TEXT,
          is_offer INTEGER DEFAULT 0,
          discount_percentage REAL DEFAULT 0,
          offer_condition TEXT,
          offer_badge_text TEXT,
          offer_savings_usd REAL,
          offer_savings_bs REAL,
          offer_min_quantity REAL,
          promotional_price_usd REAL,
          offer_start_date TEXT,
          offer_end_date TEXT,
          description TEXT,
          applies_iva INTEGER DEFAULT 1,
          alternative_prices TEXT,
          presentations TEXT,
          suppliers_info TEXT,
          highest_supplier_cost REAL,
          is_composite INTEGER DEFAULT 0,
          composite_components TEXT,
          composite_virtual_stock REAL,
          is_weighable INTEGER DEFAULT 0,
          price_per_kg_usd REAL,
          is_fractionable INTEGER DEFAULT 0,
          fraction_unit TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      tablesCreated.push('products');

      // 5. customers
      await client.execute(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          rif TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          has_credit INTEGER DEFAULT 0,
          credit_days INTEGER DEFAULT 15,
          credit_limit_usd REAL DEFAULT 0,
          current_debt_usd REAL DEFAULT 0,
          password TEXT,
          avatar TEXT,
          notification_preferences TEXT,
          verification_status TEXT DEFAULT 'pending',
          is_first_time INTEGER DEFAULT 1,
          registered_at TEXT,
          business_type TEXT,
          trade_name TEXT,
          contact_person TEXT,
          credit_status TEXT DEFAULT 'none',
          credit_requested_limit_usd REAL DEFAULT 0,
          credit_requested_days INTEGER DEFAULT 0,
          credit_requested_at TEXT,
          assigned_price_tier TEXT,
          verification_notes TEXT,
          extra_data TEXT,
          created_at TEXT
        );
      `);
      tablesCreated.push('customers');

      // 6. suppliers
      await client.execute(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          rif TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          contact_person TEXT,
          credit_days INTEGER DEFAULT 15,
          created_at TEXT
        );
      `);
      tablesCreated.push('suppliers');
      try { await client.execute('ALTER TABLE suppliers ADD COLUMN contact_name TEXT'); } catch {}
      try { await client.execute('ALTER TABLE suppliers ADD COLUMN address TEXT'); } catch {}
      try { await client.execute('ALTER TABLE suppliers ADD COLUMN credit_limit_usd REAL DEFAULT 0'); } catch {}


      // 7. orders
      await client.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          order_number TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_rif TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          customer_address TEXT NOT NULL,
          items TEXT NOT NULL,
          subtotal_usd REAL NOT NULL,
          tax_usd REAL NOT NULL,
          total_usd REAL NOT NULL,
          total_bs REAL NOT NULL,
          bcv_rate REAL NOT NULL,
          payment_method TEXT NOT NULL,
          payment_status TEXT NOT NULL,
          order_status TEXT NOT NULL,
          payment_reference TEXT,
          channel TEXT NOT NULL,
          created_at TEXT NOT NULL,
          approved_at TEXT,
          document_series TEXT,
          document_sequence INTEGER,
          return_number TEXT,
          void_number TEXT,
          estimated_delivery TEXT,
          credit_due_date TEXT,
          credit_days INTEGER,
          notes TEXT
        );
      `);
      tablesCreated.push('orders');

      // 8. invoices
      await client.execute(`
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number TEXT NOT NULL,
          order_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_rif TEXT NOT NULL,
          customer_address TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          items TEXT NOT NULL,
          subtotal_usd REAL NOT NULL,
          tax_usd REAL NOT NULL,
          total_usd REAL NOT NULL,
          total_bs REAL NOT NULL,
          bcv_rate REAL NOT NULL,
          payment_method TEXT NOT NULL,
          payment_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          approved_at TEXT,
          document_series TEXT,
          document_sequence INTEGER,
          return_number TEXT,
          void_number TEXT,
          due_date TEXT,
          is_credit INTEGER DEFAULT 0,
          credit_days INTEGER
        );
      `);
      tablesCreated.push('invoices');
      for (const sql of [
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number)',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_return_number ON orders(return_number)',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_void_number ON orders(void_number)'
      ]) { try { await client.execute(sql); } catch {} }

      // Idempotent migrations for mixed payments, per-warehouse stock and reversal audit fields.
      for (const sql of [
        "ALTER TABLE products ADD COLUMN warehouse_stocks TEXT",
        "ALTER TABLE orders ADD COLUMN payment_splits TEXT",
        "ALTER TABLE orders ADD COLUMN cash_session_id TEXT",
        "ALTER TABLE orders ADD COLUMN terminal_id TEXT",
        "ALTER TABLE orders ADD COLUMN document_series TEXT",
        "ALTER TABLE orders ADD COLUMN document_sequence INTEGER",
        "ALTER TABLE orders ADD COLUMN return_number TEXT",
        "ALTER TABLE orders ADD COLUMN void_number TEXT",

        "ALTER TABLE orders ADD COLUMN is_voided INTEGER DEFAULT 0",
        "ALTER TABLE orders ADD COLUMN voided_at TEXT",
        "ALTER TABLE orders ADD COLUMN voided_by TEXT",
        "ALTER TABLE orders ADD COLUMN void_reason TEXT",
        "ALTER TABLE orders ADD COLUMN is_returned INTEGER DEFAULT 0",
        "ALTER TABLE orders ADD COLUMN returned_at TEXT",
        "ALTER TABLE orders ADD COLUMN returned_by TEXT",
        "ALTER TABLE orders ADD COLUMN return_reason TEXT",
        "ALTER TABLE invoices ADD COLUMN payment_splits TEXT",
        "ALTER TABLE invoices ADD COLUMN cash_session_id TEXT",
        "ALTER TABLE invoices ADD COLUMN terminal_id TEXT",
        "ALTER TABLE invoices ADD COLUMN document_series TEXT",
        "ALTER TABLE invoices ADD COLUMN document_sequence INTEGER",
        "ALTER TABLE invoices ADD COLUMN return_number TEXT",
        "ALTER TABLE invoices ADD COLUMN void_number TEXT",

        "ALTER TABLE invoices ADD COLUMN is_voided INTEGER DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN voided_at TEXT",
        "ALTER TABLE invoices ADD COLUMN voided_by TEXT",
        "ALTER TABLE invoices ADD COLUMN void_reason TEXT",
        "ALTER TABLE invoices ADD COLUMN is_returned INTEGER DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN returned_at TEXT",
        "ALTER TABLE invoices ADD COLUMN returned_by TEXT",
        "ALTER TABLE invoices ADD COLUMN return_reason TEXT",

        "ALTER TABLE customers ADD COLUMN verification_status TEXT DEFAULT 'pending'",
        "ALTER TABLE customers ADD COLUMN is_first_time INTEGER DEFAULT 1",
        "ALTER TABLE customers ADD COLUMN registered_at TEXT",
        "ALTER TABLE customers ADD COLUMN business_type TEXT",
        "ALTER TABLE customers ADD COLUMN trade_name TEXT",
        "ALTER TABLE customers ADD COLUMN contact_person TEXT",
        "ALTER TABLE customers ADD COLUMN credit_status TEXT DEFAULT 'none'",
        "ALTER TABLE customers ADD COLUMN credit_requested_limit_usd REAL DEFAULT 0",
        "ALTER TABLE customers ADD COLUMN credit_requested_days INTEGER DEFAULT 0",
        "ALTER TABLE customers ADD COLUMN credit_requested_at TEXT",
        "ALTER TABLE customers ADD COLUMN assigned_price_tier TEXT",
        "ALTER TABLE customers ADD COLUMN verification_notes TEXT",
        "ALTER TABLE customers ADD COLUMN extra_data TEXT"
      ]) {
        try { await client.execute(sql); } catch {}
      }

      // 9. accounts_receivable
      await client.execute(`
        CREATE TABLE IF NOT EXISTS accounts_receivable (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          invoice_number TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          total_amount_usd REAL NOT NULL,
          amount_paid_usd REAL NOT NULL,
          balance_usd REAL NOT NULL,
          issued_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          credit_days INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT,
          payment_history TEXT
        );
      `);
      tablesCreated.push('accounts_receivable');
      for (const sql of [
        "ALTER TABLE accounts_receivable ADD COLUMN is_voided INTEGER DEFAULT 0",
        "ALTER TABLE accounts_receivable ADD COLUMN voided_at TEXT",
        "ALTER TABLE accounts_receivable ADD COLUMN void_reason TEXT",
        "ALTER TABLE accounts_receivable ADD COLUMN payment_history TEXT"
      ]) {
        try { await client.execute(sql); } catch {}
      }

      // 10. accounts_payable
      await client.execute(`
        CREATE TABLE IF NOT EXISTS accounts_payable (
          id TEXT PRIMARY KEY,
          supplier_id TEXT NOT NULL,
          supplier_name TEXT NOT NULL,
          invoice_number TEXT NOT NULL,
          description TEXT NOT NULL,
          total_amount_usd REAL NOT NULL,
          amount_paid_usd REAL NOT NULL,
          balance_usd REAL NOT NULL,
          issued_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT
        );
      `);
      tablesCreated.push('accounts_payable');
      try { await client.execute("ALTER TABLE accounts_payable ADD COLUMN payment_history TEXT"); } catch {}
      try { await client.execute("ALTER TABLE accounts_payable ADD COLUMN items_json TEXT"); } catch {}

      // 11. purchase_entries
      await client.execute(`
        CREATE TABLE IF NOT EXISTS purchase_entries (
          id TEXT PRIMARY KEY,
          entry_number TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      tablesCreated.push('purchase_entries');

      // 12. sync_operations — idempotencia para operaciones offline
      await client.execute(`
        CREATE TABLE IF NOT EXISTS sync_operations (
          operation_id TEXT PRIMARY KEY,
          terminal_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          payload TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          processed_at TEXT,
          error TEXT
        );
      `);
      tablesCreated.push('sync_operations');

      // 13. inventory_movements — movimientos append-only para inventario multi-caja/offline
      await client.execute(`
        CREATE TABLE IF NOT EXISTS inventory_movements (
          movement_id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          quantity_delta REAL NOT NULL,
          movement_type TEXT NOT NULL,
          source_operation_id TEXT NOT NULL,
          terminal_id TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
        ON inventory_movements(product_id);
      `);
      tablesCreated.push('inventory_movements');

      // 13b. activity_changes — señal centralizada de cambios para sincronización
      // en tiempo casi real entre todos los navegadores/equipos.
      await client.execute(`
        CREATE TABLE IF NOT EXISTS activity_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          entity_id TEXT,
          operation TEXT NOT NULL,
          changed_at TEXT NOT NULL
        );
      `);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_activity_changes_id ON activity_changes(id)`);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_activity_changes_changed_at ON activity_changes(changed_at)`);

      const activityTables = [
        'system_settings', 'categories', 'units', 'products', 'customers', 'suppliers',
        'orders', 'invoices', 'accounts_receivable', 'accounts_payable', 'purchase_entries',
        'inventory_movements', 'cash_sessions', 'cash_movements', 'system_users', 'bcv_history'
      ];
      for (const table of activityTables) {
        const idColumn = table === 'system_settings' ? "'main'" : 'NEW.id';
        const oldIdColumn = table === 'system_settings' ? "'main'" : 'OLD.id';
        try {
          await client.execute(`
            CREATE TRIGGER IF NOT EXISTS activity_${table}_insert
            AFTER INSERT ON ${table}
            BEGIN
              INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
              VALUES ('${table}', ${idColumn}, 'insert', datetime('now'));
            END;
          `);
        } catch {}
        try {
          await client.execute(`
            CREATE TRIGGER IF NOT EXISTS activity_${table}_update
            AFTER UPDATE ON ${table}
            BEGIN
              INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
              VALUES ('${table}', ${idColumn}, 'update', datetime('now'));
            END;
          `);
        } catch {}
        try {
          await client.execute(`
            CREATE TRIGGER IF NOT EXISTS activity_${table}_delete
            AFTER DELETE ON ${table}
            BEGIN
              INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
              VALUES ('${table}', ${oldIdColumn}, 'delete', datetime('now'));
            END;
          `);
        } catch {}
      }
      tablesCreated.push('activity_changes');

      // 14. cash_sessions / cash_movements — caja persistente por terminal
      await client.execute(`
        CREATE TABLE IF NOT EXISTS cash_sessions (
          id TEXT PRIMARY KEY, terminal_id TEXT NOT NULL, user_id TEXT,
          opened_at TEXT NOT NULL,
          opened_by TEXT NOT NULL, opening_bs REAL NOT NULL DEFAULT 0, opening_usd REAL NOT NULL DEFAULT 0,
          closed_at TEXT, closed_by TEXT, closing_bs REAL, closing_usd REAL,
          expected_bs REAL, expected_usd REAL, difference_bs REAL, difference_usd REAL, status TEXT NOT NULL
        );
      `);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_cash_sessions_terminal_user_status ON cash_sessions(terminal_id,user_id,status)`);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS cash_movements (
          id TEXT PRIMARY KEY, session_id TEXT NOT NULL, terminal_id TEXT NOT NULL,
          type TEXT NOT NULL, currency TEXT NOT NULL, amount REAL NOT NULL, reason TEXT NOT NULL,
          created_at TEXT NOT NULL, created_by TEXT NOT NULL
        );
      `);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id)`);
      tablesCreated.push('cash_sessions','cash_movements');

      // 14. system_users
      await client.execute(`
        CREATE TABLE IF NOT EXISTS system_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          avatar TEXT,
          active INTEGER DEFAULT 1,
          password TEXT,
          is_initial_generic INTEGER DEFAULT 0,
          created_at TEXT
        );
      `);
      tablesCreated.push('system_users');

      // 15. bcv_history
      await client.execute(`
        CREATE TABLE IF NOT EXISTS bcv_history (
          id TEXT PRIMARY KEY,
          rate REAL NOT NULL,
          date TEXT NOT NULL,
          effective_date TEXT,
          type TEXT NOT NULL,
          updated_by TEXT,
          source TEXT,
          previous_rate REAL,
          change_percent REAL,
          currencies TEXT
        );
      `);
      tablesCreated.push('bcv_history');

      // 16. system_notifications
      await client.execute(`
        CREATE TABLE IF NOT EXISTS system_notifications (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL,
          target_role TEXT,
          target_customer_id TEXT,
          related_order_id TEXT,
          read INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);
      tablesCreated.push('system_notifications');

      // Reinstalar los triggers de actividad con las columnas reales de cada tabla.
      // Algunas tablas históricas no usan una columna llamada "id" (por ejemplo
      // system_settings.key e inventory_movements.movement_id). Los triggers
      // anteriores podían quedar creados con NEW.id y romper cualquier escritura.
      const activityDefinitions = [
        { table: 'system_settings', id: "'main'", oldId: "'main'" },
        { table: 'categories', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'units', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'products', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'customers', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'suppliers', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'orders', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'invoices', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'accounts_receivable', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'accounts_payable', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'purchase_entries', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'inventory_movements', id: 'NEW.movement_id', oldId: 'OLD.movement_id' },
        { table: 'cash_sessions', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'cash_movements', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'system_users', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'bcv_history', id: 'NEW.id', oldId: 'OLD.id' },
        { table: 'system_notifications', id: 'NEW.id', oldId: 'OLD.id' },
      ];

      for (const { table, id, oldId } of activityDefinitions) {
        // El DROP es intencional: corrige triggers antiguos que ya existan en Turso.
        await client.execute(`DROP TRIGGER IF EXISTS activity_${table}_insert`);
        await client.execute(`DROP TRIGGER IF EXISTS activity_${table}_update`);
        await client.execute(`DROP TRIGGER IF EXISTS activity_${table}_delete`);

        await client.execute(`
          CREATE TRIGGER activity_${table}_insert
          AFTER INSERT ON ${table}
          BEGIN
            INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
            VALUES ('${table}', ${id}, 'insert', datetime('now'));
          END;
        `);

        await client.execute(`
          CREATE TRIGGER activity_${table}_update
          AFTER UPDATE ON ${table}
          BEGIN
            INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
            VALUES ('${table}', ${id}, 'update', datetime('now'));
          END;
        `);

        await client.execute(`
          CREATE TRIGGER activity_${table}_delete
          AFTER DELETE ON ${table}
          BEGIN
            INSERT INTO activity_changes (table_name, entity_id, operation, changed_at)
            VALUES ('${table}', ${oldId}, 'delete', datetime('now'));
          END;
        `);
      }
      tablesCreated.push('activity_triggers');

      // Marca la versión de esquema ya inicializada. Las siguientes cargas de
      // cualquier dispositivo usarán el fast path y no repetirán el bootstrap.
      await client.execute(
        `CREATE TABLE IF NOT EXISTS omni_schema_meta (id TEXT PRIMARY KEY, version TEXT NOT NULL, updated_at TEXT NOT NULL)`
      );
      await client.execute({
        sql: `INSERT OR REPLACE INTO omni_schema_meta (id, version, updated_at) VALUES ('main', ?, ?)`,
        args: ['realtime-sync-v1', new Date().toISOString()],
      });

      return { success: true, tables: tablesCreated };
    } catch (err: any) {
      console.error('Error in Turso autoBootstrapSchema:', err);
      return { success: false, tables: tablesCreated, error: err.message || String(err) };
    }
  }

  /**
   * Verifica si la base de datos está vacía y siembra los datos iniciales
   */
  /**
   * Inicializa una base Turso vacía únicamente con configuración vacía y
   * el administrador semilla. Nunca inserta datos de demostración.
   */
  public async autoSeedIfEmpty(): Promise<{ seeded: boolean; message: string }> {
    const client = this.getClient();
    if (!client) return { seeded: false, message: 'Cliente Turso no disponible' };

    try {
      const userCheck = await client.execute('SELECT count(*) as count FROM system_users');
      const userCount = Number(userCheck.rows[0]?.count || 0);

      if (userCount > 0) {
        return { seeded: false, message: 'La base de datos ya tiene usuarios configurados.' };
      }

      await this.saveUser(INITIAL_GENERIC_ADMIN);

      return {
        seeded: true,
        message: 'Base de datos inicializada sin datos demo. Solo se creó el administrador semilla.',
      };
    } catch (err: any) {
      console.error('Error initializing clean Turso DB:', err);
      return { seeded: false, message: err.message || String(err) };
    }
  }

  /** Reinicio total de datos: Turso queda vacío salvo el administrador semilla. */
  public async resetDatabase(): Promise<{ ok: boolean; deletedTables: string[] }> {
    const response = await fetch('/api/turso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ operation: 'resetDatabase' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      throw new Error(String(data?.error || 'No se pudo reiniciar Turso'));
    }
    return {
      ok: true,
      deletedTables: Array.isArray(data.deletedTables) ? data.deletedTables.map(String) : [],
    };
  }

  // --- CRUD METHODS FOR ENTITIES ---

  public async loadAllData(): Promise<{
    settings: SystemSettings | null;
    categories: ProductCategory[];
    units: ProductUnit[];
    products: Product[];
    customers: Customer[];
    suppliers: Supplier[];
    orders: Order[];
    invoices: Invoice[];
    receivables: ReceivableItem[];
    payables: PayableItem[];
    purchaseEntries: PurchaseEntry[];
    users: User[];
    notifications: AppNotification[];
  }> {
    const client = this.getClient();
    if (!client) {
      throw new Error('Cliente Turso no configurado');
    }

    // 1. Settings
    let settings: SystemSettings | null = null;
    try {
      const res = await client.execute("SELECT data FROM system_settings WHERE key = 'main'");
      if (res.rows.length > 0 && res.rows[0].data) {
        settings = JSON.parse(res.rows[0].data as string);
      }
    } catch (e) {
      console.warn('Error fetching settings from Turso:', e);
    }

    // 2. Categories
    const categories: ProductCategory[] = [];
    try {
      const res = await client.execute('SELECT * FROM categories ORDER BY name ASC');
      for (const row of res.rows) {
        categories.push({
          id: String(row.id),
          name: String(row.name),
          description: row.description ? String(row.description) : undefined,
        });
      }
    } catch (e) {
      console.warn('Error fetching categories from Turso:', e);
    }

    // 3. Units
    const units: ProductUnit[] = [];
    try {
      const res = await client.execute('SELECT * FROM units ORDER BY name ASC');
      for (const row of res.rows) {
        units.push({
          id: String(row.id),
          name: String(row.name),
          abbreviation: String(row.abbreviation),
          allowDecimals: Boolean(row.allow_decimals),
        });
      }
    } catch (e) {
      console.warn('Error fetching units from Turso:', e);
    }

    // 4. Products
    const products: Product[] = [];
    try {
      const res = await client.execute('SELECT * FROM products ORDER BY name ASC');
      for (const row of res.rows) {
        products.push({
          id: String(row.id),
          code: String(row.code),
          name: String(row.name),
          category: String(row.category),
          costUSD: Number(row.cost_usd),
          profitMarginPercent: row.profit_margin_percent ? Number(row.profit_margin_percent) : undefined,
          priceUSD: Number(row.price_usd),
          stock: Number(row.stock),
          minStock: Number(row.min_stock),
          unit: String(row.unit),
          warehouseStocks: row.warehouse_stocks ? JSON.parse(String(row.warehouse_stocks)) : undefined,
          image: String(row.image || ''),
          isOffer: Boolean(row.is_offer),
          discountPercentage: row.discount_percentage ? Number(row.discount_percentage) : undefined,
          offerCondition: row.offer_condition ? String(row.offer_condition) : undefined,
          offerBadgeText: row.offer_badge_text ? String(row.offer_badge_text) : undefined,
          offerSavingsUSD: row.offer_savings_usd !== null && row.offer_savings_usd !== undefined ? Number(row.offer_savings_usd) : undefined,
          offerSavingsBs: row.offer_savings_bs !== null && row.offer_savings_bs !== undefined ? Number(row.offer_savings_bs) : undefined,
          offerMinQuantity: row.offer_min_quantity !== null && row.offer_min_quantity !== undefined ? Number(row.offer_min_quantity) : undefined,
          promotionalPriceUSD: row.promotional_price_usd !== null && row.promotional_price_usd !== undefined ? Number(row.promotional_price_usd) : undefined,
          offerStartDate: row.offer_start_date ? String(row.offer_start_date) : undefined,
          offerEndDate: row.offer_end_date ? String(row.offer_end_date) : undefined,
          description: row.description ? String(row.description) : undefined,
          appliesIva: row.applies_iva !== undefined && row.applies_iva !== null ? Boolean(row.applies_iva) : true,
          alternativePrices: row.alternative_prices ? JSON.parse(String(row.alternative_prices)) : undefined,
          presentations: row.presentations ? JSON.parse(String(row.presentations)) : undefined,
          suppliersInfo: row.suppliers_info ? JSON.parse(String(row.suppliers_info)) : undefined,
          highestSupplierCost: row.highest_supplier_cost ? Number(row.highest_supplier_cost) : undefined,
          isComposite: Boolean(row.is_composite),
          compositeComponents: row.composite_components ? JSON.parse(String(row.composite_components)) : undefined,
          compositeVirtualStock: row.composite_virtual_stock ? Number(row.composite_virtual_stock) : undefined,
          isWeighable: Boolean(row.is_weighable),
          pricePerKgUSD: row.price_per_kg_usd ? Number(row.price_per_kg_usd) : undefined,
          isFractionable: Boolean(row.is_fractionable),
          fractionUnit: row.fraction_unit ? String(row.fraction_unit) : undefined,
        });
      }
    } catch (e) {
      console.warn('Error fetching products from Turso:', e);
    }

    // 5. Customers
    const customers: Customer[] = [];
    try {
      const res = await client.execute('SELECT * FROM customers ORDER BY created_at DESC');
      for (const row of res.rows) {
        const extra = row.extra_data ? JSON.parse(String(row.extra_data)) : {};
        customers.push({
          id: String(row.id),
          name: String(row.name),
          rif: String(row.rif),
          email: String(row.email || ''),
          phone: String(row.phone || ''),
          address: String(row.address || ''),
          hasCredit: Boolean(row.has_credit),
          creditDays: Number(row.credit_days || 15),
          creditLimitUSD: Number(row.credit_limit_usd || 0),
          currentDebtUSD: Number(row.current_debt_usd || 0),
          password: row.password ? String(row.password) : undefined,
          avatar: row.avatar ? String(row.avatar) : undefined,
          notificationPreferences: row.notification_preferences ? JSON.parse(String(row.notification_preferences)) : undefined,
          verificationStatus: (row.verification_status ? String(row.verification_status) : 'pending') as any,
          isFirstTime: row.is_first_time !== undefined && row.is_first_time !== null ? Boolean(row.is_first_time) : true,
          registeredAt: String(row.registered_at || row.created_at || new Date().toISOString()),
          businessType: row.business_type ? String(row.business_type) : undefined,
          tradeName: row.trade_name ? String(row.trade_name) : undefined,
          contactPerson: row.contact_person ? String(row.contact_person) : undefined,
          creditStatus: (row.credit_status ? String(row.credit_status) : 'none') as any,
          creditRequestedLimitUSD: row.credit_requested_limit_usd ? Number(row.credit_requested_limit_usd) : 0,
          creditRequestedDays: row.credit_requested_days ? Number(row.credit_requested_days) : 0,
          creditRequestedAt: row.credit_requested_at ? String(row.credit_requested_at) : undefined,
          assignedPriceTier: row.assigned_price_tier ? String(row.assigned_price_tier) as any : 'mayorista',
          verificationNotes: row.verification_notes ? String(row.verification_notes) : undefined,
          attachedDocRif: extra.attachedDocRif,
          attachedCommercialRef: extra.attachedCommercialRef,
          rejectionReason: extra.rejectionReason,
          verifiedAt: extra.verifiedAt,
          verifiedBy: extra.verifiedBy,
        });
      }
    } catch (e) {
      console.warn('Error fetching customers from Turso:', e);
    }

    // 6. Suppliers
    const suppliers: Supplier[] = [];
    try {
      const res = await client.execute('SELECT * FROM suppliers ORDER BY name ASC');
      for (const row of res.rows) {
        suppliers.push({
          id: String(row.id),
          name: String(row.name),
          rif: String(row.rif),
          phone: String(row.phone || ''),
          email: String(row.email || ''),
          contactPerson: String(row.contact_person || ''),
          contactName: String(row.contact_name || row.contact_person || ''),
          address: String(row.address || ''),
          creditDays: Number(row.credit_days || 15),
          creditLimitUSD: Number(row.credit_limit_usd || 0),
        });
      }
    } catch (e) {
      console.warn('Error fetching suppliers from Turso:', e);
    }

    // 7. Orders
    const orders: Order[] = [];
    try {
      const res = await client.execute('SELECT * FROM orders ORDER BY created_at DESC');
      for (const row of res.rows) {
        orders.push({
          id: String(row.id),
          orderNumber: String(row.order_number),
          customerId: String(row.customer_id),
          customerName: String(row.customer_name),
          customerRif: String(row.customer_rif || ''),
          customerPhone: String(row.customer_phone || ''),
          customerAddress: String(row.customer_address || ''),
          items: JSON.parse(String(row.items || '[]')),
          subtotalUSD: Number(row.subtotal_usd),
          taxUSD: Number(row.tax_usd),
          totalUSD: Number(row.total_usd),
          totalBs: Number(row.total_bs),
          bcvRate: Number(row.bcv_rate),
          paymentMethod: row.payment_method as any,
          cashSessionId: row.cash_session_id ? String(row.cash_session_id) : undefined,
          documentSeries: row.document_series ? String(row.document_series) : undefined,
          documentSequence: row.document_sequence != null ? Number(row.document_sequence) : undefined,
          returnNumber: row.return_number ? String(row.return_number) : undefined,
          voidNumber: row.void_number ? String(row.void_number) : undefined,
          paymentSplits: row.payment_splits ? JSON.parse(String(row.payment_splits)) : undefined,
          paymentStatus: row.payment_status as any,
          orderStatus: row.order_status as any,
          paymentReference: row.payment_reference ? String(row.payment_reference) : undefined,
          channel: row.channel as any,
          createdAt: String(row.created_at),
          estimatedDelivery: row.estimated_delivery ? String(row.estimated_delivery) : undefined,
          creditDueDate: row.credit_due_date ? String(row.credit_due_date) : undefined,
          creditDays: row.credit_days ? Number(row.credit_days) : undefined,
          notes: row.notes ? String(row.notes) : undefined,
          isVoided: Boolean(row.is_voided),
          voidedAt: row.voided_at ? String(row.voided_at) : undefined,
          voidedBy: row.voided_by ? String(row.voided_by) : undefined,
          voidReason: row.void_reason ? String(row.void_reason) : undefined,
          isReturned: Boolean(row.is_returned),
          returnedAt: row.returned_at ? String(row.returned_at) : undefined,
          returnedBy: row.returned_by ? String(row.returned_by) : undefined,
          returnReason: row.return_reason ? String(row.return_reason) : undefined,
        });
      }
    } catch (e) {
      console.warn('Error fetching orders from Turso:', e);
    }

    // 8. Invoices
    const invoices: Invoice[] = [];
    try {
      const res = await client.execute('SELECT * FROM invoices ORDER BY created_at DESC');
      for (const row of res.rows) {
        invoices.push({
          id: String(row.id),
          invoiceNumber: String(row.invoice_number),
          orderId: String(row.order_id),
          customerId: String(row.customer_id),
          customerName: String(row.customer_name),
          customerRif: String(row.customer_rif),
          customerAddress: String(row.customer_address),
          customerPhone: String(row.customer_phone),
          items: JSON.parse(String(row.items || '[]')),
          subtotalUSD: Number(row.subtotal_usd),
          taxUSD: Number(row.tax_usd),
          totalUSD: Number(row.total_usd),
          totalBs: Number(row.total_bs),
          bcvRate: Number(row.bcv_rate),
          paymentMethod: row.payment_method as any,
          cashSessionId: row.cash_session_id ? String(row.cash_session_id) : undefined,
          paymentSplits: row.payment_splits ? JSON.parse(String(row.payment_splits)) : undefined,
          paymentStatus: row.payment_status as any,
          createdAt: String(row.created_at),
          dueDate: row.due_date ? String(row.due_date) : undefined,
          isCredit: Boolean(row.is_credit),
          creditDays: row.credit_days ? Number(row.credit_days) : undefined,
          isVoided: Boolean(row.is_voided),
          voidedAt: row.voided_at ? String(row.voided_at) : undefined,
          voidedBy: row.voided_by ? String(row.voided_by) : undefined,
          voidReason: row.void_reason ? String(row.void_reason) : undefined,
          isReturned: Boolean(row.is_returned),
          returnedAt: row.returned_at ? String(row.returned_at) : undefined,
          returnedBy: row.returned_by ? String(row.returned_by) : undefined,
          returnReason: row.return_reason ? String(row.return_reason) : undefined,
        });
      }
    } catch (e) {
      console.warn('Error fetching invoices from Turso:', e);
    }

    // 9. Accounts Receivable
    const receivables: ReceivableItem[] = [];
    try {
      const res = await client.execute('SELECT * FROM accounts_receivable ORDER BY due_date ASC');
      for (const row of res.rows) {
        receivables.push({
          id: String(row.id),
          invoiceId: String(row.invoice_id),
          invoiceNumber: String(row.invoice_number),
          customerId: String(row.customer_id),
          customerName: String(row.customer_name),
          customerPhone: String(row.customer_phone || ''),
          totalAmountUSD: Number(row.total_amount_usd),
          amountPaidUSD: Number(row.amount_paid_usd),
          balanceUSD: Number(row.balance_usd),
          issuedDate: String(row.issued_date),
          dueDate: String(row.due_date),
          creditDays: Number(row.credit_days || 15),
          status: row.status as any,
          isVoided: Boolean(row.is_voided),
          voidedAt: row.voided_at ? String(row.voided_at) : undefined,
          voidReason: row.void_reason ? String(row.void_reason) : undefined,
          paymentHistory: row.payment_history ? JSON.parse(String(row.payment_history)) : [],
        });
      }
    } catch (e) {
      console.warn('Error fetching receivables from Turso:', e);
    }

    // 10. Accounts Payable
    const payables: PayableItem[] = [];
    try {
      const res = await client.execute('SELECT * FROM accounts_payable ORDER BY due_date ASC');
      for (const row of res.rows) {
        payables.push({
          id: String(row.id),
          supplierId: String(row.supplier_id),
          supplierName: String(row.supplier_name),
          invoiceNumber: String(row.invoice_number),
          description: String(row.description),
          totalAmountUSD: Number(row.total_amount_usd),
          amountPaidUSD: Number(row.amount_paid_usd),
          balanceUSD: Number(row.balance_usd),
          issuedDate: String(row.issued_date),
          dueDate: String(row.due_date),
          status: row.status as any,
          paymentHistory: row.payment_history ? JSON.parse(String(row.payment_history)) : [],
          items: row.items_json ? JSON.parse(String(row.items_json)) : undefined,
        });
      }
    } catch (e) {
      console.warn('Error fetching payables from Turso:', e);
    }

    // 11. Purchase entries
    const purchaseEntries: PurchaseEntry[] = [];
    try {
      const res = await client.execute('SELECT data FROM purchase_entries ORDER BY created_at DESC');
      for (const row of res.rows) {
        if (row.data) purchaseEntries.push(JSON.parse(String(row.data)));
      }
    } catch (e) {
      console.warn('Error fetching purchase entries from Turso:', e);
    }

    // Recuperación de renglones de CxP históricos: las entradas de compra
    // son la fuente completa del detalle y permiten reconstruir facturas
    // creadas antes de existir items_json en accounts_payable.
    if (purchaseEntries.length > 0 && payables.some((p) => !p.items?.length)) {
      const byInvoice = new Map<string, PurchaseEntry>();
      for (const entry of purchaseEntries) {
        if (entry.invoiceNumber) byInvoice.set(entry.invoiceNumber.trim(), entry);
      }
      for (const payable of payables) {
        if (payable.items?.length) continue;
        const entry = byInvoice.get((payable.invoiceNumber || '').trim());
        if (!entry?.items?.length) continue;
        payable.items = entry.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPriceUSD: item.realCostUSD,
          subtotalUSD: item.subtotalUSD,
        }));
      }
    }

    // 12. Users
    const users: User[] = [];
    try {
      const res = await client.execute('SELECT * FROM system_users ORDER BY name ASC');
      for (const row of res.rows) {
        users.push({
          id: String(row.id),
          name: String(row.name),
          email: String(row.email),
          role: row.role as any,
          avatar: row.avatar ? String(row.avatar) : undefined,
          active: Boolean(row.active),
          password: row.password ? String(row.password) : undefined,
          isInitialGeneric: Boolean(row.is_initial_generic),
          createdAt: String(row.created_at || new Date().toISOString()),
        });
      }
    } catch (e) {
      console.warn('Error fetching users from Turso:', e);
    }

    // 12. BCV History from table (merge if available)
    try {
      const bcvRes = await client.execute('SELECT * FROM bcv_history ORDER BY date DESC LIMIT 500');
      if (bcvRes.rows.length > 0 && settings) {
        const tableEntries: BcvHistoryEntry[] = bcvRes.rows.map((row) => ({
          id: String(row.id),
          rate: Number(row.rate),
          date: String(row.date),
          type: (row.type as 'manual' | 'automatic') || 'automatic',
          updatedBy: String(row.updated_by || 'BCV'),
          previousRate: row.previous_rate !== null ? Number(row.previous_rate) : undefined,
          changePercent: row.change_percent !== null ? Number(row.change_percent) : undefined,
          source: 'https://bcv.today/api/rate.json',
        }));
        // Merge with settings.bcvHistory avoiding duplicates
        const existingIds = new Set((settings.bcvHistory || []).map((h) => h.id));
        const merged = [...(settings.bcvHistory || [])];
        for (const item of tableEntries) {
          if (!existingIds.has(item.id)) {
            merged.push(item);
            existingIds.add(item.id);
          }
        }
        settings.bcvHistory = merged.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      }
    } catch (e) {
      console.warn('Error fetching bcv_history from Turso:', e);
    }

    // 13. Notifications
    const notifications: AppNotification[] = [];
    try {
      const res = await client.execute(
        "SELECT * FROM system_notifications WHERE title != 'Sesión Finalizada' ORDER BY created_at DESC LIMIT 200"
      );
      for (const row of res.rows) {
        notifications.push({
          id: String(row.id),
          title: String(row.title),
          message: String(row.message),
          type: row.type as any,
          read: Boolean(row.read),
          createdAt: String(row.created_at || new Date().toISOString()),
          targetRole: row.target_role ? (String(row.target_role) as any) : undefined,
          targetCustomerId: row.target_customer_id ? String(row.target_customer_id) : undefined,
          relatedOrderId: row.related_order_id ? String(row.related_order_id) : undefined,
        });
      }
    } catch (e) {
      console.warn('Error fetching notifications from Turso:', e);
    }

    return {
      settings,
      categories,
      units,
      products,
      customers,
      suppliers,
      orders,
      invoices,
      receivables,
      payables,
      purchaseEntries,
      users,
      notifications,
    };
  }

  // Token monotónico de cambios centralizados. El navegador solo descarga
  // el estado completo cuando este token cambia.
  public async getCloudChangeToken(): Promise<number> {
    const client = this.getClient();
    if (!client) throw new Error('Cliente Turso no configurado');
    try {
      const res = await client.execute(`
        SELECT COALESCE(MAX(id), 0) AS max_act FROM activity_changes
      `);
      const maxAct = Number(res.rows[0]?.max_act || 0);

      const countRes = await client.execute(`
        SELECT (
          (SELECT COUNT(*) FROM customers) +
          (SELECT COUNT(*) FROM system_users) +
          (SELECT COUNT(*) FROM system_notifications) +
          (SELECT COUNT(*) FROM orders) +
          (SELECT COUNT(*) FROM products) +
          (SELECT COUNT(*) FROM invoices) +
          (SELECT COUNT(*) FROM accounts_receivable) +
          (SELECT COUNT(*) FROM accounts_payable)
        ) AS total_count
      `);
      const totalCount = Number(countRes.rows[0]?.total_count || 0);

      return maxAct * 1000000 + totalCount;
    } catch {
      const res = await client.execute('SELECT COALESCE(MAX(id), 0) AS token FROM activity_changes');
      return Number(res.rows[0]?.token || 0);
    }
  }

  public async hasCloudChangesSince(token: number): Promise<{ changed: boolean; token: number }> {
    const currentToken = await this.getCloudChangeToken();
    return { changed: currentToken !== token, token: currentToken };
  }

  /**
   * Cursor global de cambios, siguiendo el patrón probado de sistema-gestion.
   * Solo consulta el último ID de activity_changes; no depende de contadores
   * de tablas ni de estado/localStorage del navegador.
   */
  public async readCloudSyncVersion(since = 0): Promise<{ changed: boolean; latestId: number }> {
    const response = await fetch('/api/sync?since=' + encodeURIComponent(String(Math.max(0, since))), {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(data.error || 'Sincronización cloud no disponible'));
    }
    return {
      changed: Boolean(data.changed),
      latestId: Number(data.latest_id || 0),
    };
  }

  // --- SAVE INDIVIDUAL ENTITIES ---

  public async saveSettings(settings: SystemSettings) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `INSERT OR REPLACE INTO system_settings (key, data, updated_at) VALUES ('main', ?, ?)`,
      args: [JSON.stringify(settings), new Date().toISOString()],
    });
  }

  public async saveProduct(p: Product, options?: { preserveStock?: boolean }) {
    // Maestro de productos: escritura autoritativa en Turso mediante una
    // operación server-side transaccional. No usamos snapshots/localStorage
    // para reconstruir el maestro.
    const response = await this.request('saveProduct', {
      product: p,
      preserveStock: Boolean(options?.preserveStock),
    });
    if (!response?.persisted) {
      throw new Error(String(response?.error || 'Turso no confirmó la escritura del producto'));
    }
  }

  /**
   * Persiste datos maestros del producto sin tocar stock.
   * Stock es propiedad exclusiva de inventory_movements para evitar lost updates
   * cuando varias cajas trabajan offline y reconectan después.
   */
  public async saveProductMaster(p: Product) {
    const client = this.getClient();
    if (!client) return;

    // If the product is new, create it once with its local initial stock.
    await client.execute({
      sql: `
        INSERT OR IGNORE INTO products (
          id, code, name, category, cost_usd, profit_margin_percent, price_usd,
          stock, min_stock, unit, image, is_offer, discount_percentage,
          description, applies_iva, alternative_prices, presentations,
          suppliers_info, highest_supplier_cost, is_composite,
          composite_components, composite_virtual_stock, is_weighable,
          price_per_kg_usd, is_fractionable, fraction_unit, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        p.id, p.code, p.name, p.category, p.costUSD, p.profitMarginPercent ?? null,
        p.priceUSD, p.stock, p.minStock, p.unit, p.image || '', p.isOffer ? 1 : 0,
        p.discountPercentage ?? 0, p.description || '', p.appliesIva === false ? 0 : 1,
        p.alternativePrices ? JSON.stringify(p.alternativePrices) : null,
        p.presentations ? JSON.stringify(p.presentations) : null,
        p.suppliersInfo ? JSON.stringify(p.suppliersInfo) : null,
        p.highestSupplierCost ?? null, p.isComposite ? 1 : 0,
        p.compositeComponents ? JSON.stringify(p.compositeComponents) : null,
        p.compositeVirtualStock ?? null, p.isWeighable ? 1 : 0,
        p.pricePerKgUSD ?? null, p.isFractionable ? 1 : 0, p.fractionUnit ?? null,
        new Date().toISOString(), new Date().toISOString(),
      ],
    });

    // Update only master/product attributes. Stock is deliberately excluded.
    await client.execute({
      sql: `
        UPDATE products SET
          code = ?, name = ?, category = ?, cost_usd = ?, profit_margin_percent = ?,
          price_usd = ?, min_stock = ?, unit = ?, image = ?, is_offer = ?,
          discount_percentage = ?, description = ?, applies_iva = ?,
          alternative_prices = ?, presentations = ?, suppliers_info = ?,
          highest_supplier_cost = ?, is_composite = ?, composite_components = ?,
          composite_virtual_stock = ?, is_weighable = ?, price_per_kg_usd = ?,
          is_fractionable = ?, fraction_unit = ?, updated_at = ?
        WHERE id = ?
      `,
      args: [
        p.code, p.name, p.category, p.costUSD, p.profitMarginPercent ?? null,
        p.priceUSD, p.minStock, p.unit, p.image || '', p.isOffer ? 1 : 0,
        p.discountPercentage ?? 0, p.description || '', p.appliesIva === false ? 0 : 1,
        p.alternativePrices ? JSON.stringify(p.alternativePrices) : null,
        p.presentations ? JSON.stringify(p.presentations) : null,
        p.suppliersInfo ? JSON.stringify(p.suppliersInfo) : null,
        p.highestSupplierCost ?? null, p.isComposite ? 1 : 0,
        p.compositeComponents ? JSON.stringify(p.compositeComponents) : null,
        p.compositeVirtualStock ?? null, p.isWeighable ? 1 : 0,
        p.pricePerKgUSD ?? null, p.isFractionable ? 1 : 0, p.fractionUnit ?? null,
        new Date().toISOString(), p.id,
      ],
    });
  }

  public async deleteProduct(id: string) {
    const response = await this.request('deleteProduct', { productId: id });
    if (!response?.persisted) {
      throw new Error(String(response?.error || 'Turso no confirmó la eliminación del producto'));
    }
  }

  public async saveCustomer(c: Customer) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO customers (
          id, name, rif, email, phone, address, has_credit, credit_days,
          credit_limit_usd, current_debt_usd, password, avatar, notification_preferences,
          verification_status, is_first_time, registered_at, business_type, trade_name,
          contact_person, credit_status, credit_requested_limit_usd, credit_requested_days,
          credit_requested_at, assigned_price_tier, verification_notes, extra_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        c.id,
        c.name,
        c.rif,
        c.email,
        c.phone,
        c.address,
        c.hasCredit ? 1 : 0,
        c.creditDays || 15,
        c.creditLimitUSD || 0,
        c.currentDebtUSD || 0,
        c.password || null,
        c.avatar || null,
        c.notificationPreferences ? JSON.stringify(c.notificationPreferences) : null,
        c.verificationStatus || 'pending',
        c.isFirstTime !== false ? 1 : 0,
        c.registeredAt || new Date().toISOString(),
        c.businessType || null,
        c.tradeName || null,
        c.contactPerson || null,
        c.creditStatus || 'none',
        c.creditRequestedLimitUSD || 0,
        c.creditRequestedDays || 0,
        c.creditRequestedAt || null,
        c.assignedPriceTier || 'mayorista',
        c.verificationNotes || null,
        JSON.stringify({
          attachedDocRif: c.attachedDocRif,
          attachedCommercialRef: c.attachedCommercialRef,
          rejectionReason: c.rejectionReason,
          verifiedAt: c.verifiedAt,
          verifiedBy: c.verifiedBy,
        }),
        c.registeredAt || new Date().toISOString(),
      ],
    });
  }

  public async saveSupplier(s: Supplier) {
    await this.request('saveSupplier', { supplier: s });
  }

  public async deleteSupplier(supplierId: string) {
    await this.request('deleteSupplier', { supplierId });
  }

  public async reserveTerminalDocuments(terminalId: string, documentTypes: string[]): Promise<Record<string, number>> {
    const data = await this.request('reserveTerminalDocuments', { terminalId, documentTypes });
    return (data.sequences || {}) as Record<string, number>;
  }

  public async saveOrder(o: Order) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO orders (
          id, order_number, customer_id, customer_name, customer_rif, customer_phone,
          customer_address, items, subtotal_usd, tax_usd, total_usd, total_bs,
          bcv_rate, payment_method, payment_splits, cash_session_id, terminal_id, document_series, document_sequence, return_number, void_number, payment_status, order_status, payment_reference,
          channel, created_at, approved_at, estimated_delivery, credit_due_date, credit_days, notes,
          is_voided, voided_at, voided_by, void_reason, is_returned, returned_at, returned_by, return_reason
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      args: [
        o.id,
        o.orderNumber,
        o.customerId,
        o.customerName,
        o.customerRif,
        o.customerPhone,
        o.customerAddress,
        JSON.stringify(o.items),
        o.subtotalUSD,
        o.taxUSD,
        o.totalUSD,
        o.totalBs,
        o.bcvRate,
        o.paymentMethod,
        o.paymentSplits ? JSON.stringify(o.paymentSplits) : null,
        o.cashSessionId || null,
        o.terminalId || null,
        o.documentSeries || null,
        o.documentSequence ?? null,
        o.returnNumber || null,
        o.voidNumber || null,
        o.paymentStatus,
        o.orderStatus,
        o.paymentReference || null,
        o.channel,
        o.createdAt,
        o.approvedAt || null,
        o.estimatedDelivery || null,
        o.creditDueDate || null,
        o.creditDays ?? null,
        o.notes || null,
        o.isVoided ? 1 : 0,
        o.voidedAt || null,
        o.voidedBy || null,
        o.voidReason || null,
        o.isReturned ? 1 : 0,
        o.returnedAt || null,
        o.returnedBy || null,
        o.returnReason || null,
      ],
    });
  }

  public async saveInvoice(inv: Invoice) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO invoices (
          id, invoice_number, order_id, customer_id, customer_name, customer_rif,
          customer_address, customer_phone, items, subtotal_usd, tax_usd, total_usd,
          total_bs, bcv_rate, payment_method, payment_splits, cash_session_id, terminal_id, document_series, document_sequence, return_number, void_number, payment_status, created_at, approved_at, due_date,
          is_credit, credit_days, is_voided, voided_at, voided_by, void_reason,
          is_returned, returned_at, returned_by, return_reason
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      args: [
        inv.id,
        inv.invoiceNumber,
        inv.orderId,
        inv.customerId,
        inv.customerName,
        inv.customerRif,
        inv.customerAddress,
        inv.customerPhone,
        JSON.stringify(inv.items),
        inv.subtotalUSD,
        inv.taxUSD,
        inv.totalUSD,
        inv.totalBs,
        inv.bcvRate,
        inv.paymentMethod,
        inv.paymentSplits ? JSON.stringify(inv.paymentSplits) : null,
        inv.cashSessionId || null,
        inv.terminalId || null,
        inv.documentSeries || null,
        inv.documentSequence ?? null,
        inv.returnNumber || null,
        inv.voidNumber || null,
        inv.paymentStatus,
        inv.createdAt,
        inv.approvedAt || null,
        inv.dueDate || null,
        inv.isCredit ? 1 : 0,
        inv.creditDays ?? null,
        inv.isVoided ? 1 : 0,
        inv.voidedAt || null,
        inv.voidedBy || null,
        inv.voidReason || null,
        inv.isReturned ? 1 : 0,
        inv.returnedAt || null,
        inv.returnedBy || null,
        inv.returnReason || null,
      ],
    });
  }

  /** Idempotent customer payment report: one paymentId can be persisted only once. */
  public async reportCustomerReceivablePayment(receivable: ReceivableItem, paymentId: string, customerName: string): Promise<{ duplicate: boolean }> {
    const result = await this.request('reportCustomerReceivablePayment', { receivable, paymentId, customerName });
    return { duplicate: Boolean(result.duplicate) };
  }

  public async saveReceivable(r: ReceivableItem) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO accounts_receivable (
          id, invoice_id, invoice_number, customer_id, customer_name,
          customer_phone, total_amount_usd, amount_paid_usd, balance_usd,
          issued_date, due_date, credit_days, status, created_at, is_voided, voided_at, void_reason, payment_history
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        r.id,
        r.invoiceId,
        r.invoiceNumber,
        r.customerId,
        r.customerName,
        r.customerPhone,
        r.totalAmountUSD,
        r.amountPaidUSD,
        r.balanceUSD,
        r.issuedDate,
        r.dueDate,
        r.creditDays,
        r.status,
        new Date().toISOString(),
        r.isVoided ? 1 : 0,
        r.voidedAt || null,
        r.voidReason || null,
        JSON.stringify(r.paymentHistory || []),
      ],
    });
  }

  public async savePayable(p: PayableItem) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO accounts_payable (
          id, supplier_id, supplier_name, invoice_number, description,
          total_amount_usd, amount_paid_usd, balance_usd, issued_date, due_date,
          status, created_at, payment_history, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        p.id,
        p.supplierId,
        p.supplierName,
        p.invoiceNumber,
        p.description,
        p.totalAmountUSD,
        p.amountPaidUSD,
        p.balanceUSD,
        p.issuedDate,
        p.dueDate,
        p.status,
        new Date().toISOString(),
        JSON.stringify(p.paymentHistory || []),
        JSON.stringify(p.items || []),
      ],
    });
  }

  public async applyInventoryMovement(movement: {
    movementId: string; productId: string; quantityDelta: number; movementType: string;
    sourceOperationId: string; terminalId: string; createdAt: string;
  }): Promise<'applied' | 'already_applied'> {
    const result = await this.request('inventoryMovement', { movement });
    return result.result as 'applied' | 'already_applied';
  }


  public async applyOfflineSale(operation: any): Promise<'applied' | 'already_applied'> {
    const result = await this.request('offlineSale', { payload: operation });
    return result.result as 'applied' | 'already_applied';
  }


  public async applySaleReversal(operation: any): Promise<'applied' | 'already_applied'> {
    const result = await this.request('saleReversal', { payload: operation });
    return result.result as 'applied' | 'already_applied';
  }


  public async beginSyncOperation(operation: SyncOperationRecord): Promise<'new' | 'processed'> {
    const client = this.getClient();
    if (!client) throw new Error('Cliente Turso no configurado');

    await client.execute({
      sql: `INSERT OR IGNORE INTO sync_operations
        (operation_id, terminal_id, operation_type, entity_id, payload, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      args: [
        operation.operationId,
        operation.terminalId,
        operation.operationType,
        operation.entityId,
        operation.payload === undefined ? null : JSON.stringify(operation.payload),
        new Date().toISOString(),
      ],
    });

    const result = await client.execute({
      sql: 'SELECT status FROM sync_operations WHERE operation_id = ?',
      args: [operation.operationId],
    });
    return String(result.rows[0]?.status || 'pending') === 'processed' ? 'processed' : 'new';
  }

  public async completeSyncOperation(operationId: string) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `UPDATE sync_operations
        SET status = 'processed', processed_at = ?, error = NULL
        WHERE operation_id = ?`,
      args: [new Date().toISOString(), operationId],
    });
  }

  public async failSyncOperation(operationId: string, error: unknown) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `UPDATE sync_operations SET status = 'pending', error = ? WHERE operation_id = ?`,
      args: [String(error instanceof Error ? error.message : error), operationId],
    });
  }

  public async listTerminals(activeOnly = false): Promise<Terminal[]> {
    const client = this.getClient(); if (!client) return [];
    const r = await client.execute({
      sql: activeOnly ? 'SELECT * FROM terminals WHERE active = 1 ORDER BY code ASC' : 'SELECT * FROM terminals ORDER BY code ASC',
      args: [],
    });
    return r.rows.map((row: any) => ({
      id: String(row.id), code: String(row.code), name: String(row.name),
      active: Boolean(row.active), createdAt: String(row.created_at),
    }));
  }

  public async createTerminal(input: { code: string; name: string }): Promise<Terminal> {
    const client = this.getClient(); if (!client) throw new Error('Cliente Turso no configurado');
    const id = `terminal-${crypto.randomUUID()}`;
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) throw new Error('Código y nombre de caja son obligatorios.');
    const createdAt = new Date().toISOString();
    await client.execute({
      sql: 'INSERT INTO terminals (id, code, name, active, created_at) VALUES (?, ?, ?, 1, ?)',
      args: [id, code, name, createdAt],
    });
    return { id, code, name, active: true, createdAt };
  }

  public async updateTerminal(terminal: Terminal): Promise<void> {
    const client = this.getClient(); if (!client) return;
    await client.execute({
      sql: 'UPDATE terminals SET code = ?, name = ?, active = ? WHERE id = ?',
      args: [terminal.code.trim().toUpperCase(), terminal.name.trim(), terminal.active ? 1 : 0, terminal.id],
    });
  }

  public async listUserTerminals(userId: string, activeOnly = true): Promise<Terminal[]> {
    const client = this.getClient(); if (!client) return [];
    // La sesión puede intentar cargar las cajas antes de que termine el bootstrap
    // global (o cuando el marcador local ya existía). Garantizamos aquí el
    // esquema mínimo para que el login nunca dependa del orden de inicialización.
    await this.ensureTerminalSchema(client);
    const r = await client.execute({
      sql: `SELECT t.* FROM terminals t
            INNER JOIN terminal_user_assignments a ON a.terminal_id = t.id
            WHERE a.user_id = ? ${activeOnly ? 'AND t.active = 1' : ''}
            ORDER BY t.code ASC`,
      args: [userId],
    });
    return r.rows.map((row: any) => ({
      id: String(row.id), code: String(row.code), name: String(row.name),
      active: Boolean(row.active), createdAt: String(row.created_at),
    }));
  }

  public async listTerminalAssignments(terminalId?: string): Promise<TerminalUserAssignment[]> {
    const client = this.getClient(); if (!client) return [];
    const r = terminalId
      ? await client.execute({ sql: 'SELECT * FROM terminal_user_assignments WHERE terminal_id = ?', args: [terminalId] })
      : await client.execute({ sql: 'SELECT * FROM terminal_user_assignments ORDER BY terminal_id, user_id', args: [] });
    return r.rows.map((row: any) => ({
      terminalId: String(row.terminal_id),
      userId: String(row.user_id),
      assignedAt: String(row.assigned_at),
    }));
  }

  public async setTerminalUserAssignments(terminalId: string, userIds: string[]): Promise<void> {
    const client = this.getClient(); if (!client) return;
    const unique = Array.from(new Set(userIds.map(String).filter(Boolean)));
    await client.execute({ sql: 'DELETE FROM terminal_user_assignments WHERE terminal_id = ?', args: [terminalId] });
    for (const userId of unique) {
      await client.execute({
        sql: 'INSERT INTO terminal_user_assignments (terminal_id, user_id, assigned_at) VALUES (?, ?, ?)',
        args: [terminalId, userId, new Date().toISOString()],
      });
    }
  }

  public async saveCashSession(session: {
    id: string; terminalId: string; userId: string; openedAt: string; openedBy: string; openingBs: number; openingUSD: number;
    closedAt?: string; closedBy?: string; closingBs?: number; closingUSD?: number;
    expectedBs?: number; expectedUSD?: number; differenceBs?: number; differenceUSD?: number; status: 'open'|'closed';
  }) {
    const client=this.getClient(); if(!client) return;
    await client.execute({sql:`INSERT OR REPLACE INTO cash_sessions
      (id,terminal_id,user_id,opened_at,opened_by,opening_bs,opening_usd,closed_at,closed_by,closing_bs,closing_usd,expected_bs,expected_usd,difference_bs,difference_usd,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,args:[session.id,session.terminalId,session.userId,session.openedAt,session.openedBy,session.openingBs,session.openingUSD,session.closedAt||null,session.closedBy||null,session.closingBs??null,session.closingUSD??null,session.expectedBs??null,session.expectedUSD??null,session.differenceBs??null,session.differenceUSD??null,session.status]});
  }
  public async saveCashMovement(movement: {
    id:string; sessionId:string; terminalId:string; type:string; currency:'Bs'|'USD'; amount:number; reason:string; createdAt:string; createdBy:string;
  }) {
    const client=this.getClient(); if(!client) return;
    await client.execute({sql:`INSERT OR REPLACE INTO cash_movements
      (id,session_id,terminal_id,type,currency,amount,reason,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)`,args:[movement.id,movement.sessionId,movement.terminalId,movement.type,movement.currency,movement.amount,movement.reason,movement.createdAt,movement.createdBy]});
  }
  public async loadOpenCashSession(terminalId:string, userId?: string) {
    const client=this.getClient(); if(!client) return null;
    const r=await client.execute({sql:userId ? 'SELECT * FROM cash_sessions WHERE terminal_id=? AND user_id=? AND status=\'open\' ORDER BY opened_at DESC LIMIT 1' : 'SELECT * FROM cash_sessions WHERE terminal_id=? AND status=\'open\' ORDER BY opened_at DESC LIMIT 1',args:userId ? [terminalId,userId] : [terminalId]});
    return r.rows[0] || null;
  }
  public async loadCashHistory(terminalId:string, limit=100) {
    const client=this.getClient(); if(!client) return [];
    const r=await client.execute({sql:'SELECT * FROM cash_sessions WHERE terminal_id=? AND status=\'closed\' ORDER BY closed_at DESC LIMIT ?',args:[terminalId,limit]});
    return r.rows;
  }
  public async loadCashMovements(terminalId:string, limit=500) {
    const client=this.getClient(); if(!client) return [];
    const r=await client.execute({sql:'SELECT * FROM cash_movements WHERE terminal_id=? ORDER BY created_at DESC LIMIT ?',args:[terminalId,limit]});
    return r.rows;
  }

  public async savePurchaseEntry(entry: PurchaseEntry) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `INSERT OR REPLACE INTO purchase_entries (id, entry_number, data, created_at) VALUES (?, ?, ?, ?)`,
      args: [entry.id, entry.entryNumber, JSON.stringify(entry), entry.createdAt],
    });
  }

  public async checkServerHealth(): Promise<boolean> {
    try {
      await this.request({ operation: 'health' });
      return true;
    } catch {
      return false;
    }
  }

  public async authenticateUser(username: string, password: string, role: string): Promise<User | null> {
    // 1. Intentar autenticación mediante endpoint de servidor si está disponible
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password, role }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.user) {
        if (typeof window !== 'undefined' && data?.sessionId) {
          sessionStorage.setItem('tienda_pos_tab_session', String(data.sessionId));
          sessionStorage.setItem('tienda_pos_admin_user', JSON.stringify(data.user));
        }
        return data.user;
      }
    } catch (error) {
      console.warn('Endpoint /api/auth/login falló o no disponible, ejecutando validación directa en Turso DB:', error);
    }

    // 2. Fallback de autenticación directa contra la base de datos Turso
    try {
      const client = this.getClient();
      if (!client) return null;

      const normUser = username.trim().toLowerCase();

      // Garantizar usuario administrador semilla si se intenta ingresar con admin / Admin123!
      if (normUser === 'admin' && password === 'Admin123!') {
        const seedCheck = await client.execute({
          sql: `SELECT * FROM system_users WHERE id = 'usr-admin-initial' OR (is_initial_generic = 1 AND LOWER(email) = 'admin') LIMIT 1`,
          args: [],
        });
        if (!seedCheck.rows.length) {
          await client.execute({
            sql: `INSERT INTO system_users (id, name, email, role, active, password, is_initial_generic, created_at) VALUES ('usr-admin-initial', 'Administrador Principal', 'admin', 'admin', 1, 'Admin123!', 1, ?)`,
            args: [new Date().toISOString().split('T')[0]],
          });
        } else {
          const row: any = seedCheck.rows[0];
          if (!Number(row.active) || String(row.password || '') !== 'Admin123!') {
            await client.execute({
              sql: `UPDATE system_users SET active = 1, password = 'Admin123!', role = 'admin', email = 'admin', is_initial_generic = 1 WHERE id = ?`,
              args: [String(row.id)],
            });
          }
        }
      }

      // Buscar usuario activo en Turso DB
      const res = await client.execute({
        sql: `SELECT * FROM system_users
              WHERE active = 1
                AND (LOWER(email) = ? OR LOWER(name) = ? OR (? IN ('admin','administrador') AND (is_initial_generic = 1 OR role = 'admin')))
              ORDER BY is_initial_generic DESC, name ASC
              LIMIT 1`,
        args: [normUser, normUser, normUser],
      });

      const row: any = res.rows[0];
      if (!row || String(row.password || '') !== password) {
        return null;
      }

      return {
        id: String(row.id),
        name: String(row.name),
        email: String(row.email),
        role: row.role as any,
        avatar: row.avatar ? String(row.avatar) : undefined,
        active: Boolean(row.active),
        isInitialGeneric: Boolean(row.is_initial_generic),
        createdAt: String(row.created_at || new Date().toISOString()),
      };
    } catch (directErr) {
      console.error('Error en autenticación directa contra Turso DB:', directErr);
      return null;
    }
  }

  /** Contabiliza una aprobación de pedido como una venta real, de forma idempotente. */
  public async approveCustomerReceivablePayment(receivable: ReceivableItem, paymentId: string, approvedBy: string) {
    return this.request('approveCustomerReceivablePayment', { receivable, paymentId, approvedBy });
  }

  public async approveOrderFinancially(order: Order, invoice: Invoice, approvedBy: string) {
    return this.request('approveOrderFinancially', { order, invoice, approvedBy });
  }

  public async clearSellerNotifications(): Promise<void> {
    const response = await this.request('clearSellerNotifications');
    if (!response?.ok) {
      throw new Error(String(response?.error || 'Turso no confirmó la limpieza de notificaciones administrativas'));
    }
  }

  public async saveNotification(n: AppNotification) {
    const client = this.getClient();
    if (!client) throw new Error('Cliente Turso no configurado');
    const tx = await client.transaction('write');
    try {
      await tx.execute({
        sql: `INSERT OR REPLACE INTO system_notifications
          (id, title, message, type, target_role, target_customer_id, related_order_id, read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          n.id,
          n.title,
          n.message,
          n.type,
          n.targetRole || null,
          n.targetCustomerId || null,
          n.relatedOrderId || null,
          n.read ? 1 : 0,
          n.createdAt || new Date().toISOString(),
        ],
      });
      await tx.execute({
        sql: "INSERT INTO activity_changes (table_name, entity_id, operation, changed_at) VALUES ('system_notifications', ?, 'upsert', ?)",
        args: [n.id, new Date().toISOString()],
      });
      await tx.commit();
      const verify = await client.execute({
        sql: 'SELECT id FROM system_notifications WHERE id = ? LIMIT 1',
        args: [n.id],
      });
      if (!verify.rows.length) throw new Error('Turso no confirmó la notificación');
    } catch (e) {
      try { await tx.rollback(); } catch {}
      throw e;
    }
  }

  public async loadUsers(): Promise<User[]> {
    const client = this.getClient();
    if (!client) throw new Error('Cliente Turso no configurado');
    const res = await client.execute('SELECT * FROM system_users ORDER BY name ASC');
    return res.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: row.role as any,
      avatar: row.avatar ? String(row.avatar) : undefined,
      active: Boolean(row.active),
      password: row.password ? String(row.password) : undefined,
      isInitialGeneric: Boolean(row.is_initial_generic),
      createdAt: String(row.created_at || new Date().toISOString()),
    }));
  }

  public async saveUser(u: User): Promise<User> {
    const client = this.getClient();
    if (!client) throw new Error('Cliente Turso no configurado');
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO system_users (
          id, name, email, role, avatar, active, password, is_initial_generic, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        u.id,
        u.name,
        u.email,
        u.role,
        u.avatar || null,
        u.active ? 1 : 0,
        u.password || null,
        u.isInitialGeneric ? 1 : 0,
        u.createdAt || new Date().toISOString(),
      ],
    });
    const verified = await client.execute({
      sql: 'SELECT * FROM system_users WHERE id = ?',
      args: [u.id],
    });
    if (!verified.rows.length) {
      throw new Error(`Turso no confirmó la creación del usuario ${u.name}`);
    }
    return {
      ...u,
      active: Boolean(verified.rows[0].active),
      createdAt: String(verified.rows[0].created_at || u.createdAt),
    };
  }

  public async deleteUser(id: string) {
    const client = this.getClient();
    if (!client) throw new Error('Cliente Turso no configurado');
    await client.execute({ sql: 'DELETE FROM system_users WHERE id = ?', args: [id] });
    const verified = await client.execute({
      sql: 'SELECT 1 FROM system_users WHERE id = ?',
      args: [id],
    });
    if (verified.rows.length) {
      throw new Error(`Turso no confirmó la eliminación del usuario ${id}`);
    }
  }

  public async saveCategory(c: ProductCategory) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `INSERT OR REPLACE INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)`,
      args: [c.id, c.name, c.description || null, new Date().toISOString()],
    });
  }

  public async deleteCategory(id: string) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: 'DELETE FROM categories WHERE id = ?',
      args: [id],
    });
  }

  public async saveUnit(u: ProductUnit) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `INSERT OR REPLACE INTO units (id, name, abbreviation, allow_decimals) VALUES (?, ?, ?, ?)`,
      args: [u.id, u.name, u.abbreviation, u.allowDecimals ? 1 : 0],
    });
  }

  public async deleteUnit(id: string) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: 'DELETE FROM units WHERE id = ?',
      args: [id],
    });
  }

  public async saveBcvHistoryEntry(entry: BcvHistoryEntry) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.execute({
        sql: `
          INSERT OR REPLACE INTO bcv_history (
            id, rate, date, effective_date, type, updated_by, source, previous_rate, change_percent, currencies
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          entry.id,
          entry.rate,
          entry.date,
          entry.effectiveDate || entry.date,
          entry.type,
          entry.updatedBy,
          entry.source || null,
          entry.previousRate !== undefined ? entry.previousRate : null,
          entry.changePercent !== undefined ? entry.changePercent : null,
          entry.currencies ? JSON.stringify(entry.currencies) : null,
        ],
      });
    } catch (err) {
      console.warn('Error saving bcv_history to Turso:', err);
    }
  }
}

export const tursoService = new TursoService();
