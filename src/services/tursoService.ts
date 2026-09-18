import { createClient, Client } from '@libsql/client/web';
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
  private client: Client | null = null;
  private currentConfig: TursoConfig | null = null;

  constructor() {
    this.purgeLocalCredentials();
    this.initFromEnv();
  }

  private purgeLocalCredentials() {
    try {
      localStorage.removeItem('TURSO_DATABASE_URL');
      localStorage.removeItem('TURSO_AUTH_TOKEN');
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  public getStoredConfig(): TursoConfig {
    const envUrl =
      (import.meta as any).env?.VITE_TURSO_DATABASE_URL ||
      (import.meta as any).env?.TURSO_DATABASE_URL ||
      '';
    const envToken =
      (import.meta as any).env?.VITE_TURSO_AUTH_TOKEN ||
      (import.meta as any).env?.TURSO_AUTH_TOKEN ||
      '';

    return {
      url: envUrl ? envUrl.trim() : '',
      authToken: envToken ? envToken.trim() : '',
    };
  }

  private initFromEnv() {
    const config = this.getStoredConfig();
    if (config.url) {
      this.initClient(config);
    }
  }

  private normalizeUrl(url: string): string {
    let clean = url.trim();
    if (clean.startsWith('libsql://')) {
      clean = clean.replace('libsql://', 'https://');
    }
    return clean;
  }

  public initClient(config: TursoConfig): Client | null {
    if (!config.url) {
      this.client = null;
      this.currentConfig = null;
      return null;
    }

    try {
      const httpUrl = this.normalizeUrl(config.url);
      this.client = createClient({
        url: httpUrl,
        authToken: config.authToken?.trim() || undefined,
      });
      this.currentConfig = config;
      return this.client;
    } catch (err) {
      console.error('Error initializing Turso client:', err);
      this.client = null;
      return null;
    }
  }

  public getClient(): Client | null {
    if (!this.client) {
      const config = this.getStoredConfig();
      if (config.url) {
        return this.initClient(config);
      }
    }
    return this.client;
  }

  public isConfigured(): boolean {
    const config = this.getStoredConfig();
    return Boolean(config.url && config.url.trim().length > 0);
  }

  /**
   * Ejecuta automáticamente todas las sentencias DDL para crear las tablas si no existen.
   */
  public async autoBootstrapSchema(): Promise<{ success: boolean; tables: string[]; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, tables: [], error: 'Turso URL no configurada' };
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
          created_at TEXT
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
          due_date TEXT,
          is_credit INTEGER DEFAULT 0,
          credit_days INTEGER
        );
      `);
      tablesCreated.push('invoices');

      // Idempotent migrations for mixed payments, per-warehouse stock and reversal audit fields.
      for (const sql of [
        "ALTER TABLE products ADD COLUMN warehouse_stocks TEXT",
        "ALTER TABLE orders ADD COLUMN payment_splits TEXT",
        "ALTER TABLE orders ADD COLUMN cash_session_id TEXT",

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

        "ALTER TABLE invoices ADD COLUMN is_voided INTEGER DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN voided_at TEXT",
        "ALTER TABLE invoices ADD COLUMN voided_by TEXT",
        "ALTER TABLE invoices ADD COLUMN void_reason TEXT",
        "ALTER TABLE invoices ADD COLUMN is_returned INTEGER DEFAULT 0",
        "ALTER TABLE invoices ADD COLUMN returned_at TEXT",
        "ALTER TABLE invoices ADD COLUMN returned_by TEXT",
        "ALTER TABLE invoices ADD COLUMN return_reason TEXT"
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
          created_at TEXT
        );
      `);
      tablesCreated.push('accounts_receivable');
      for (const sql of [
        "ALTER TABLE accounts_receivable ADD COLUMN is_voided INTEGER DEFAULT 0",
        "ALTER TABLE accounts_receivable ADD COLUMN voided_at TEXT",
        "ALTER TABLE accounts_receivable ADD COLUMN void_reason TEXT"
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

      // 14. cash_sessions / cash_movements — caja persistente por terminal
      await client.execute(`
        CREATE TABLE IF NOT EXISTS cash_sessions (
          id TEXT PRIMARY KEY, terminal_id TEXT NOT NULL, opened_at TEXT NOT NULL,
          opened_by TEXT NOT NULL, opening_bs REAL NOT NULL DEFAULT 0, opening_usd REAL NOT NULL DEFAULT 0,
          closed_at TEXT, closed_by TEXT, closing_bs REAL, closing_usd REAL,
          expected_bs REAL, expected_usd REAL, difference_bs REAL, difference_usd REAL, status TEXT NOT NULL
        );
      `);
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_cash_sessions_terminal_status ON cash_sessions(terminal_id,status)`);
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
          type TEXT NOT NULL,
          updated_by TEXT,
          previous_rate REAL,
          change_percent REAL
        );
      `);
      tablesCreated.push('bcv_history');

      return { success: true, tables: tablesCreated };
    } catch (err: any) {
      console.error('Error in Turso autoBootstrapSchema:', err);
      return { success: false, tables: tablesCreated, error: err.message || String(err) };
    }
  }

  /**
   * Verifica si la base de datos está vacía y siembra los datos iniciales
   */
  public async autoSeedIfEmpty(): Promise<{ seeded: boolean; message: string }> {
    const client = this.getClient();
    if (!client) return { seeded: false, message: 'Cliente Turso no disponible' };

    try {
      const prodCheck = await client.execute('SELECT count(*) as count FROM products');
      const count = Number(prodCheck.rows[0]?.count || 0);

      if (count > 0) {
        return { seeded: false, message: `La base de datos ya contiene ${count} productos.` };
      }

      console.log('Sembrando catálogo inicial y configuración en Turso DB...');

      // 1. Sembrar configuración
      await this.saveSettings(INITIAL_SETTINGS);

      // 2. Sembrar categorías
      for (const cat of INITIAL_CATEGORIES) {
        await client.execute({
          sql: `INSERT OR REPLACE INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)`,
          args: [cat.id, cat.name, cat.description || '', new Date().toISOString()],
        });
      }

      // 3. Sembrar unidades
      for (const unit of INITIAL_UNITS) {
        await client.execute({
          sql: `INSERT OR REPLACE INTO units (id, name, abbreviation, allow_decimals) VALUES (?, ?, ?, ?)`,
          args: [unit.id, unit.name, unit.abbreviation, unit.allowDecimals ? 1 : 0],
        });
      }

      // 4. Sembrar productos
      for (const prod of INITIAL_PRODUCTS) {
        await this.saveProduct(prod);
      }

      // 5. Sembrar clientes
      for (const cust of INITIAL_CUSTOMERS) {
        await this.saveCustomer(cust);
      }

      // 6. Sembrar proveedores
      for (const supp of INITIAL_SUPPLIERS) {
        await this.saveSupplier(supp);
      }

      // 7. Sembrar usuarios
      for (const user of INITIAL_USERS) {
        await this.saveUser(user);
      }

      // 8. Sembrar órdenes iniciales
      for (const order of INITIAL_ORDERS) {
        await this.saveOrder(order);
      }

      // 9. Sembrar facturas
      for (const inv of INITIAL_INVOICES) {
        await this.saveInvoice(inv);
      }

      // 10. Sembrar cuentas por cobrar
      for (const rec of INITIAL_RECEIVABLES) {
        await this.saveReceivable(rec);
      }

      // 11. Sembrar cuentas por pagar
      for (const pay of INITIAL_PAYABLES) {
        await this.savePayable(pay);
      }

      return { seeded: true, message: 'Datos maestros sembrados con éxito en Turso DB.' };
    } catch (err: any) {
      console.error('Error seeding Turso DB:', err);
      return { seeded: false, message: err.message || String(err) };
    }
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
      const res = await client.execute('SELECT * FROM customers ORDER BY name ASC');
      for (const row of res.rows) {
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
          creditDays: Number(row.credit_days || 15),
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
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO products (
          id, code, name, category, cost_usd, profit_margin_percent, price_usd,
          stock, min_stock, unit, image, is_offer, discount_percentage,
          warehouse_stocks, description, applies_iva, alternative_prices, presentations,
          suppliers_info, highest_supplier_cost, is_composite,
          composite_components, composite_virtual_stock, is_weighable,
          price_per_kg_usd, is_fractionable, fraction_unit, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        p.id,
        p.code,
        p.name,
        p.category,
        p.costUSD,
        p.profitMarginPercent ?? null,
        p.priceUSD,
        options?.preserveStock ? (
          // Preserve the authoritative global stock when replaying a master-data snapshot.
          // Inventory quantity is changed only through inventory_movements.
          Number((await client.execute({ sql: 'SELECT stock FROM products WHERE id = ?', args: [p.id] })).rows[0]?.stock ?? p.stock)
        ) : p.stock,
        p.minStock,
        p.unit,
        p.image || '',
        p.isOffer ? 1 : 0,
        p.discountPercentage ?? 0,
        p.warehouseStocks ? JSON.stringify(p.warehouseStocks) : null,
        p.description || '',
        p.appliesIva === false ? 0 : 1,
        p.alternativePrices ? JSON.stringify(p.alternativePrices) : null,
        p.presentations ? JSON.stringify(p.presentations) : null,
        p.suppliersInfo ? JSON.stringify(p.suppliersInfo) : null,
        p.highestSupplierCost ?? null,
        p.isComposite ? 1 : 0,
        p.compositeComponents ? JSON.stringify(p.compositeComponents) : null,
        p.compositeVirtualStock ?? null,
        p.isWeighable ? 1 : 0,
        p.pricePerKgUSD ?? null,
        p.isFractionable ? 1 : 0,
        p.fractionUnit ?? null,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    });
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
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [id],
    });
  }

  public async saveCustomer(c: Customer) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO customers (
          id, name, rif, email, phone, address, has_credit, credit_days,
          credit_limit_usd, current_debt_usd, password, avatar, notification_preferences, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        new Date().toISOString(),
      ],
    });
  }

  public async saveSupplier(s: Supplier) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO suppliers (
          id, name, rif, phone, email, contact_person, credit_days, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        s.id,
        s.name,
        s.rif,
        s.phone,
        s.email,
        s.contactPerson,
        s.creditDays || 15,
        new Date().toISOString(),
      ],
    });
  }

  public async saveOrder(o: Order) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO orders (
          id, order_number, customer_id, customer_name, customer_rif, customer_phone,
          customer_address, items, subtotal_usd, tax_usd, total_usd, total_bs,
          bcv_rate, payment_method, payment_splits, cash_session_id, payment_status, order_status, payment_reference,
          channel, created_at, estimated_delivery, credit_due_date, credit_days, notes,
          is_voided, voided_at, voided_by, void_reason, is_returned, returned_at, returned_by, return_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        o.paymentStatus,
        o.orderStatus,
        o.paymentReference || null,
        o.channel,
        o.createdAt,
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
          total_bs, bcv_rate, payment_method, payment_splits, cash_session_id, payment_status, created_at, due_date,
          is_credit, credit_days, is_voided, voided_at, voided_by, void_reason,
          is_returned, returned_at, returned_by, return_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        inv.paymentStatus,
        inv.createdAt,
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

  public async saveReceivable(r: ReceivableItem) {
    const client = this.getClient();
    if (!client) return;
    await client.execute({
      sql: `
        INSERT OR REPLACE INTO accounts_receivable (
          id, invoice_id, invoice_number, customer_id, customer_name,
          customer_phone, total_amount_usd, amount_paid_usd, balance_usd,
          issued_date, due_date, credit_days, status, created_at, is_voided, voided_at, void_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      ],
    });
  }

  public async applyInventoryMovement(movement: {
    movementId: string;
    productId: string;
    quantityDelta: number;
    movementType: string;
    sourceOperationId: string;
    terminalId: string;
    createdAt: string;
  }): Promise<'applied' | 'already_applied'> {
    const client = this.getClient();
    if (!client) throw new Error('Cliente Turso no configurado');

    const tx = await client.transaction('write');
    try {
      const insert = await tx.execute({
        sql: `INSERT OR IGNORE INTO inventory_movements
          (movement_id, product_id, quantity_delta, movement_type, source_operation_id, terminal_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          movement.movementId,
          movement.productId,
          movement.quantityDelta,
          movement.movementType,
          movement.sourceOperationId,
          movement.terminalId,
          movement.createdAt,
        ],
      });

      if (Number(insert.rowsAffected || 0) === 0) {
        await tx.rollback();
        return 'already_applied';
      }

      const updated = await tx.execute({
        sql: `UPDATE products
          SET stock = MAX(0, ROUND(stock + ?, 3)), updated_at = ?
          WHERE id = ?`,
        args: [movement.quantityDelta, movement.createdAt, movement.productId],
      });

      if (Number(updated.rowsAffected || 0) === 0) {
        throw new Error(`Producto no encontrado para movimiento de inventario: ${movement.productId}`);
      }

      await tx.commit();
      return 'applied';
    } catch (error) {
      try { await tx.rollback(); } catch {}
      throw error;
    }
  }

  /** Aplica una venta offline completa de forma atómica y con control de concurrencia.
   * Si varias terminales venden el mismo producto offline, la base central valida el stock
   * dentro de la misma transacción que registra los movimientos y la venta. */
  public async applyOfflineSale(operation: {
    operationId: string; terminalId: string; order: Order; invoice: Invoice;
    inventoryMovements: Array<{ movementId: string; productId: string; quantityDelta: number; movementType: string; sourceOperationId: string; terminalId: string; createdAt: string }>;
    receivable?: ReceivableItem; customer?: Customer;
  }): Promise<'applied' | 'already_applied'> {
    const client = this.getClient();
    if (!client) throw new Error('Cliente Turso no configurado');
    const tx = await client.transaction('write');
    try {
      await tx.execute({
        sql: "INSERT OR IGNORE INTO sync_operations (operation_id, terminal_id, operation_type, entity_id, payload, status, created_at) VALUES (?, ?, 'sale', ?, ?, 'pending', ?)",
        args: [operation.operationId, operation.terminalId, operation.order.id, JSON.stringify({ orderId: operation.order.id, invoiceId: operation.invoice.id, inventoryMovements: operation.inventoryMovements.length }), operation.order.createdAt],
      });
      const existing = await tx.execute({ sql: 'SELECT status FROM sync_operations WHERE operation_id = ?', args: [operation.operationId] });
      if (String(existing.rows[0]?.status || '') === 'processed') {
        await tx.rollback();
        return 'already_applied';
      }

      // Solo los movimientos que aún no fueron aplicados forman parte de este intento.
      const pendingMovements: typeof operation.inventoryMovements = [];
      for (const movement of operation.inventoryMovements) {
        const inserted = await tx.execute({
          sql: 'INSERT OR IGNORE INTO inventory_movements (movement_id, product_id, quantity_delta, movement_type, source_operation_id, terminal_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [movement.movementId, movement.productId, movement.quantityDelta, movement.movementType, movement.sourceOperationId, movement.terminalId, movement.createdAt],
        });
        if (Number(inserted.rowsAffected || 0) > 0) pendingMovements.push(movement);
      }

      // Agrupar por producto evita aceptar dos líneas que, en conjunto, exceden el stock.
      const deltas = new Map<string, number>();
      for (const movement of pendingMovements) {
        deltas.set(movement.productId, (deltas.get(movement.productId) || 0) + movement.quantityDelta);
      }
      for (const [productId, delta] of deltas) {
        const product = await tx.execute({ sql: 'SELECT stock FROM products WHERE id = ?', args: [productId] });
        if (!product.rows.length) throw new Error(`Producto no encontrado para movimiento de inventario: ${productId}`);
        const stock = Number(product.rows[0].stock || 0);
        if (delta < 0 && stock + delta < -0.000001) {
          throw new Error(`Conflicto de stock en venta offline para producto ${productId}: disponible ${stock}, solicitado ${Math.abs(delta)}.`);
        }
      }
      for (const [productId, delta] of deltas) {
        const updated = await tx.execute({
          sql: 'UPDATE products SET stock = ROUND(stock + ?, 3), updated_at = ? WHERE id = ?',
          args: [delta, operation.order.createdAt, productId],
        });
        if (!Number(updated.rowsAffected || 0)) throw new Error(`Producto no encontrado para actualización de inventario: ${productId}`);
      }

      const o = operation.order;
      await tx.execute({
        sql: 'INSERT OR REPLACE INTO orders (id,order_number,customer_id,customer_name,customer_rif,customer_phone,customer_address,items,subtotal_usd,tax_usd,total_usd,total_bs,bcv_rate,payment_method,payment_splits,cash_session_id,payment_status,order_status,payment_reference,channel,created_at,estimated_delivery,credit_due_date,credit_days,notes,is_voided,voided_at,voided_by,void_reason,is_returned,returned_at,returned_by,return_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        args: [o.id,o.orderNumber,o.customerId,o.customerName,o.customerRif,o.customerPhone,o.customerAddress,JSON.stringify(o.items),o.subtotalUSD,o.taxUSD,o.totalUSD,o.totalBs,o.bcvRate,o.paymentMethod,o.paymentSplits?JSON.stringify(o.paymentSplits):null,o.cashSessionId||null,o.paymentStatus,o.orderStatus,o.paymentReference||null,o.channel,o.createdAt,o.estimatedDelivery||null,o.creditDueDate||null,o.creditDays??null,o.notes||null,o.isVoided?1:0,o.voidedAt||null,o.voidedBy||null,o.voidReason||null,o.isReturned?1:0,o.returnedAt||null,o.returnedBy||null,o.returnReason||null],
      });
      const inv = operation.invoice;
      await tx.execute({
        sql: 'INSERT OR REPLACE INTO invoices (id,invoice_number,order_id,customer_id,customer_name,customer_rif,customer_address,customer_phone,items,subtotal_usd,tax_usd,total_usd,total_bs,bcv_rate,payment_method,payment_splits,cash_session_id,payment_status,created_at,due_date,is_credit,credit_days,is_voided,voided_at,voided_by,void_reason,is_returned,returned_at,returned_by,return_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        args: [inv.id,inv.invoiceNumber,inv.orderId,inv.customerId,inv.customerName,inv.customerRif,inv.customerAddress,inv.customerPhone,JSON.stringify(inv.items),inv.subtotalUSD,inv.taxUSD,inv.totalUSD,inv.totalBs,inv.bcvRate,inv.paymentMethod,inv.paymentSplits?JSON.stringify(inv.paymentSplits):null,inv.cashSessionId||null,inv.paymentStatus,inv.createdAt,inv.dueDate||null,inv.isCredit?1:0,inv.creditDays??null,inv.isVoided?1:0,inv.voidedAt||null,inv.voidedBy||null,inv.voidReason||null,inv.isReturned?1:0,inv.returnedAt||null,inv.returnedBy||null,inv.returnReason||null],
      });
      if (operation.customer) {
        const x = operation.customer;
        await tx.execute({
          sql: 'INSERT OR REPLACE INTO customers (id,name,rif,email,phone,address,has_credit,credit_days,credit_limit_usd,current_debt_usd,password,avatar,notification_preferences,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          args: [x.id,x.name,x.rif,x.email,x.phone,x.address,x.hasCredit?1:0,x.creditDays||15,x.creditLimitUSD||0,x.currentDebtUSD||0,x.password||null,x.avatar||null,x.notificationPreferences?JSON.stringify(x.notificationPreferences):null,new Date().toISOString()],
        });
      }
      if (operation.receivable) {
        const r = operation.receivable;
        await tx.execute({
          sql: 'INSERT OR REPLACE INTO accounts_receivable (id,invoice_id,invoice_number,customer_id,customer_name,customer_phone,total_amount_usd,amount_paid_usd,balance_usd,issued_date,due_date,credit_days,status,created_at,is_voided,voided_at,void_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          args: [r.id,r.invoiceId,r.invoiceNumber,r.customerId,r.customerName,r.customerPhone,r.totalAmountUSD,r.amountPaidUSD,r.balanceUSD,r.issuedDate,r.dueDate,r.creditDays,r.status,r.issuedDate,r.isVoided?1:0,r.voidedAt||null,r.voidReason||null],
        });
      }
      await tx.execute({ sql:"UPDATE sync_operations SET status='processed',processed_at=?,error=NULL WHERE operation_id=?", args:[new Date().toISOString(),operation.operationId] });
      await tx.commit();
      return 'applied';
    } catch (error) {
      try { await tx.rollback(); } catch {}
      throw error;
    }
  }

  /** Persiste una devolución/anulación y su inventario en una sola transacción. */
  public async applySaleReversal(operation: {
    operationId: string; terminalId: string; order: Order; invoice: Invoice;
    inventoryMovements: Array<{ movementId: string; productId: string; quantityDelta: number; movementType: string; sourceOperationId: string; terminalId: string; createdAt: string }>;
    receivable?: ReceivableItem; customer?: Customer;
  }): Promise<'applied' | 'already_applied'> {
    const client = this.getClient(); if (!client) throw new Error('Cliente Turso no configurado');
    const tx = await client.transaction('write');
    try {
      await tx.execute({ sql: "INSERT OR IGNORE INTO sync_operations (operation_id, terminal_id, operation_type, entity_id, payload, status, created_at) VALUES (?, ?, 'sale_reversal', ?, ?, 'pending', ?)", args: [operation.operationId, operation.terminalId, operation.order.id, JSON.stringify({ orderId: operation.order.id, invoiceId: operation.invoice.id }), operation.order.createdAt] });
      const existing = await tx.execute({ sql: 'SELECT status FROM sync_operations WHERE operation_id = ?', args: [operation.operationId] });
      if (String(existing.rows[0]?.status || '') === 'processed') { await tx.rollback(); return 'already_applied'; }
      for (const m of operation.inventoryMovements) {
        const ins = await tx.execute({ sql: 'INSERT OR IGNORE INTO inventory_movements (movement_id, product_id, quantity_delta, movement_type, source_operation_id, terminal_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [m.movementId,m.productId,m.quantityDelta,m.movementType,m.sourceOperationId,m.terminalId,m.createdAt] });
        if (Number(ins.rowsAffected || 0) > 0) {
          const up = await tx.execute({ sql: 'UPDATE products SET stock = MAX(0, ROUND(stock + ?, 3)), updated_at = ? WHERE id = ?', args: [m.quantityDelta,m.createdAt,m.productId] });
          if (!Number(up.rowsAffected || 0)) throw new Error('Producto no encontrado para movimiento de inventario: '+m.productId);
        }
      }
      const o=operation.order;
      await tx.execute({ sql: 'INSERT OR REPLACE INTO orders (id,order_number,customer_id,customer_name,customer_rif,customer_phone,customer_address,items,subtotal_usd,tax_usd,total_usd,total_bs,bcv_rate,payment_method,payment_splits,payment_status,order_status,payment_reference,channel,created_at,estimated_delivery,credit_due_date,credit_days,notes,is_voided,voided_at,voided_by,void_reason,is_returned,returned_at,returned_by,return_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', args: [o.id,o.orderNumber,o.customerId,o.customerName,o.customerRif,o.customerPhone,o.customerAddress,JSON.stringify(o.items),o.subtotalUSD,o.taxUSD,o.totalUSD,o.totalBs,o.bcvRate,o.paymentMethod,o.paymentSplits?JSON.stringify(o.paymentSplits):null,o.paymentStatus,o.orderStatus,o.paymentReference||null,o.channel,o.createdAt,o.estimatedDelivery||null,o.creditDueDate||null,o.creditDays??null,o.notes||null,o.isVoided?1:0,o.voidedAt||null,o.voidedBy||null,o.voidReason||null,o.isReturned?1:0,o.returnedAt||null,o.returnedBy||null,o.returnReason||null] });
      const inv=operation.invoice;
      await tx.execute({ sql: 'INSERT OR REPLACE INTO invoices (id,invoice_number,order_id,customer_id,customer_name,customer_rif,customer_address,customer_phone,items,subtotal_usd,tax_usd,total_usd,total_bs,bcv_rate,payment_method,payment_splits,payment_status,created_at,due_date,is_credit,credit_days,is_voided,voided_at,voided_by,void_reason,is_returned,returned_at,returned_by,return_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', args: [inv.id,inv.invoiceNumber,inv.orderId,inv.customerId,inv.customerName,inv.customerRif,inv.customerAddress,inv.customerPhone,JSON.stringify(inv.items),inv.subtotalUSD,inv.taxUSD,inv.totalUSD,inv.totalBs,inv.bcvRate,inv.paymentMethod,inv.paymentSplits?JSON.stringify(inv.paymentSplits):null,inv.paymentStatus,inv.createdAt,inv.dueDate||null,inv.isCredit?1:0,inv.creditDays??null,inv.isVoided?1:0,inv.voidedAt||null,inv.voidedBy||null,inv.voidReason||null,inv.isReturned?1:0,inv.returnedAt||null,inv.returnedBy||null,inv.returnReason||null] });
      if (operation.customer) { const x=operation.customer; await tx.execute({ sql:'UPDATE customers SET name=?,rif=?,email=?,phone=?,address=?,has_credit=?,credit_days=?,credit_limit_usd=?,current_debt_usd=?,password=?,avatar=?,notification_preferences=? WHERE id=?', args:[x.name,x.rif,x.email,x.phone,x.address,x.hasCredit?1:0,x.creditDays||15,x.creditLimitUSD||0,x.currentDebtUSD||0,x.password||null,x.avatar||null,x.notificationPreferences?JSON.stringify(x.notificationPreferences):null,x.id] }); }
      if (operation.receivable) { const r=operation.receivable; await tx.execute({ sql:'INSERT OR REPLACE INTO accounts_receivable (id,invoice_id,invoice_number,customer_id,customer_name,customer_phone,total_amount_usd,amount_paid_usd,balance_usd,issued_date,due_date,credit_days,status,created_at,is_voided,voided_at,void_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', args:[r.id,r.invoiceId,r.invoiceNumber,r.customerId,r.customerName,r.customerPhone,r.totalAmountUSD,r.amountPaidUSD,r.balanceUSD,r.issuedDate,r.dueDate,r.creditDays,r.status,r.issuedDate,r.isVoided?1:0,r.voidedAt||null,r.voidReason||null] }); }
      await tx.execute({ sql:"UPDATE sync_operations SET status='processed',processed_at=?,error=NULL WHERE operation_id=?", args:[new Date().toISOString(),operation.operationId] });
      await tx.commit(); return 'applied';
    } catch(error) { try { await tx.rollback(); } catch {} throw error; }
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

  public async saveCashSession(session: {
    id: string; terminalId: string; openedAt: string; openedBy: string; openingBs: number; openingUSD: number;
    closedAt?: string; closedBy?: string; closingBs?: number; closingUSD?: number;
    expectedBs?: number; expectedUSD?: number; differenceBs?: number; differenceUSD?: number; status: 'open'|'closed';
  }) {
    const client=this.getClient(); if(!client) return;
    await client.execute({sql:`INSERT OR REPLACE INTO cash_sessions
      (id,terminal_id,opened_at,opened_by,opening_bs,opening_usd,closed_at,closed_by,closing_bs,closing_usd,expected_bs,expected_usd,difference_bs,difference_usd,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,args:[session.id,session.terminalId,session.openedAt,session.openedBy,session.openingBs,session.openingUSD,session.closedAt||null,session.closedBy||null,session.closingBs??null,session.closingUSD??null,session.expectedBs??null,session.expectedUSD??null,session.differenceBs??null,session.differenceUSD??null,session.status]});
  }
  public async saveCashMovement(movement: {
    id:string; sessionId:string; terminalId:string; type:string; currency:'Bs'|'USD'; amount:number; reason:string; createdAt:string; createdBy:string;
  }) {
    const client=this.getClient(); if(!client) return;
    await client.execute({sql:`INSERT OR REPLACE INTO cash_movements
      (id,session_id,terminal_id,type,currency,amount,reason,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)`,args:[movement.id,movement.sessionId,movement.terminalId,movement.type,movement.currency,movement.amount,movement.reason,movement.createdAt,movement.createdBy]});
  }
  public async loadOpenCashSession(terminalId:string) {
    const client=this.getClient(); if(!client) return null;
    const r=await client.execute({sql:'SELECT * FROM cash_sessions WHERE terminal_id=? AND status=\'open\' ORDER BY opened_at DESC LIMIT 1',args:[terminalId]});
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

  public async saveUser(u: User) {
    const client = this.getClient();
    if (!client) return;
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
            id, rate, date, type, updated_by, previous_rate, change_percent
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          entry.id,
          entry.rate,
          entry.date,
          entry.type,
          entry.updatedBy,
          entry.previousRate !== undefined ? entry.previousRate : null,
          entry.changePercent !== undefined ? entry.changePercent : null,
        ],
      });
    } catch (err) {
      console.warn('Error saving bcv_history to Turso:', err);
    }
  }
}

export const tursoService = new TursoService();
