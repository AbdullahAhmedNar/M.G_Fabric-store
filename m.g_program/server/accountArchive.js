/**
 * AccountArchiveService
 *
 * Archiving (soft delete) for customer and supplier master records.
 *
 * Accounting principle enforced here:
 *   Master data (customer / supplier) and financial history (sales, purchases,
 *   payments, returns) are separate concerns. Archiving an account only hides it
 *   from the active lists; it never touches a single financial row.
 *
 * This service therefore only ever writes to:
 *   customers.is_active / customers.archived_at
 *   suppliers_info.is_active / suppliers_info.archived_at
 *
 * Every other statement in this file is a read.
 *
 * The service is driver agnostic (better-sqlite3 in the app, node:sqlite in tests):
 * it only relies on db.prepare(...).get/all/run and db.exec.
 */

const CUSTOMER_TABLE = "customers";
const SUPPLIER_TABLE = "suppliers_info";

class AccountArchiveService {
  constructor(db) {
    this.db = db;
  }

  // ---------------------------------------------------------------- helpers

  tableExists(name) {
    try {
      return !!this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(name);
    } catch {
      return false;
    }
  }

  columnExists(table, column) {
    try {
      if (!this.tableExists(table)) return false;
      const row = this.db
        .prepare(`SELECT COUNT(*) AS c FROM pragma_table_info(?) WHERE name = ?`)
        .get(table, column);
      return Number(row?.c || 0) > 0;
    } catch {
      return false;
    }
  }

  runInTransaction(fn) {
    // Avoid nesting: better-sqlite3 exposes inTransaction, node:sqlite does not.
    const alreadyOpen = this.db.inTransaction === true;
    if (alreadyOpen) return fn();
    this.db.exec("BEGIN");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // ignore rollback failure, the original error matters
      }
      throw error;
    }
  }

  /**
   * Idempotent, additive, non-destructive migration.
   * Adds the archive flags and the indexes the archive/statement queries need.
   * No DROP, no DELETE, no data rewrite.
   */
  ensureSchema() {
    const statements = [];

    for (const table of [CUSTOMER_TABLE, SUPPLIER_TABLE]) {
      if (!this.tableExists(table)) continue;
      if (!this.columnExists(table, "is_active")) {
        statements.push(`ALTER TABLE ${table} ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`);
      }
      if (!this.columnExists(table, "archived_at")) {
        statements.push(`ALTER TABLE ${table} ADD COLUMN archived_at TEXT`);
      }
    }

    const indexes = [
      ["sales", "customer_id", "idx_sales_customer_id"],
      ["payments", "customer_id", "idx_payments_customer_id"],
      ["returned_orders", "customer_id", "idx_returned_orders_customer_id"],
      ["suppliers", "supplier_id", "idx_supplier_orders_supplier_id"],
      ["supplier_payments", "supplier_id", "idx_supplier_payments_supplier_id"],
      ["supplier_transactions", "supplier_name", "idx_supplier_transactions_name"],
      [CUSTOMER_TABLE, "is_active", "idx_customers_is_active"],
      [SUPPLIER_TABLE, "is_active", "idx_suppliers_info_is_active"],
    ];

    if (statements.length) {
      this.runInTransaction(() => {
        for (const sql of statements) this.db.exec(sql);
      });
    }

    for (const [table, column, indexName] of indexes) {
      try {
        if (!this.tableExists(table)) continue;
        if (!this.columnExists(table, column)) continue;
        this.db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`);
      } catch (error) {
        console.warn(`تعذر إنشاء الفهرس ${indexName}:`, error.message);
      }
    }

    // Defensive backfill of the flag column only (never financial data).
    for (const table of [CUSTOMER_TABLE, SUPPLIER_TABLE]) {
      try {
        if (this.columnExists(table, "is_active")) {
          this.db.exec(`UPDATE ${table} SET is_active = 1 WHERE is_active IS NULL`);
        }
      } catch (error) {
        console.warn(`تعذر ضبط حالة التفعيل في ${table}:`, error.message);
      }
    }

    return true;
  }

  static normalizeStatus(status) {
    const value = String(status || "active").toLowerCase();
    if (value === "archived" || value === "inactive") return "archived";
    if (value === "all") return "all";
    return "active";
  }

  statusClause(status, alias = "") {
    const prefix = alias ? `${alias}.` : "";
    if (status === "archived") return `WHERE COALESCE(${prefix}is_active, 1) = 0`;
    if (status === "all") return "";
    return `WHERE COALESCE(${prefix}is_active, 1) = 1`;
  }

  // -------------------------------------------------------------- customers

  listCustomers(status = "active") {
    const normalized = AccountArchiveService.normalizeStatus(status);
    if (!this.columnExists(CUSTOMER_TABLE, "is_active")) {
      return this.db.prepare(`SELECT * FROM ${CUSTOMER_TABLE} ORDER BY id DESC`).all();
    }
    const where = this.statusClause(normalized);
    return this.db
      .prepare(`SELECT * FROM ${CUSTOMER_TABLE} ${where} ORDER BY id DESC`)
      .all();
  }

  getCustomer(id) {
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(numericId)) return null;
    return this.db.prepare(`SELECT * FROM ${CUSTOMER_TABLE} WHERE id = ?`).get(numericId) || null;
  }

  isCustomerArchived(id) {
    const customer = this.getCustomer(id);
    if (!customer) return false;
    return Number(customer.is_active ?? 1) === 0;
  }

  /**
   * Transactions are matched by customer_id, plus legacy rows that carry the
   * customer name but no id. Matching both ways means an account is never
   * treated as "empty" while historical rows still point at it.
   */
  getCustomerAccountSummary(id) {
    const customer = this.getCustomer(id);
    if (!customer) return null;

    const name = customer.name || "";
    const numericId = Number(customer.id);
    const args = [numericId, name];
    const linked = (table, nameColumn) =>
      `${table}.customer_id = ? OR (${table}.customer_id IS NULL AND TRIM(LOWER(${table}.${nameColumn})) = TRIM(LOWER(?)))`;

    let salesCount = 0;
    let salesTotal = 0;
    let salesPaid = 0;
    if (this.tableExists("sales")) {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS c,
                  COALESCE(SUM(total), 0) AS total,
                  COALESCE(SUM(paid), 0) AS paid
             FROM sales
            WHERE ${linked("sales", "customer_name")}`
        )
        .get(...args);
      salesCount = Number(row?.c || 0);
      salesTotal = Number(row?.total || 0);
      salesPaid = Number(row?.paid || 0);
    }

    let paymentsCount = 0;
    let paymentsTotal = 0;
    if (this.tableExists("payments")) {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS total
             FROM payments
            WHERE ${linked("payments", "customer_name")}`
        )
        .get(...args);
      paymentsCount = Number(row?.c || 0);
      paymentsTotal = Number(row?.total || 0);
    }

    let returnedOrdersCount = 0;
    let returnsValue = 0;
    if (this.tableExists("returned_orders")) {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS c,
                  COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(price, 0)), 0) AS total
             FROM returned_orders
            WHERE ${linked("returned_orders", "customer_name")}`
        )
        .get(...args);
      returnedOrdersCount = Number(row?.c || 0);
      returnsValue = Number(row?.total || 0);
    }

    const netSales = salesTotal - returnsValue;
    const collected = salesPaid + paymentsTotal;
    const balance = netSales - collected;
    const totalRecords = salesCount + paymentsCount + returnedOrdersCount;

    return {
      customer,
      isArchived: Number(customer.is_active ?? 1) === 0,
      archivedAt: customer.archived_at || null,
      salesCount,
      paymentsCount,
      returnedOrdersCount,
      totalRecords,
      hasTransactions: totalRecords > 0,
      salesTotal,
      returnsValue,
      netSales,
      collected,
      balance,
      balanceLabel: balance > 0 ? "باقي عليه" : balance < 0 ? "له مبلغ" : "مسدد بالكامل",
      canHardDelete: totalRecords === 0,
    };
  }

  archiveCustomer(id, options = {}) {
    return this.setCustomerActiveState(id, false, options);
  }

  restoreCustomer(id) {
    return this.setCustomerActiveState(id, true, {});
  }

  setCustomerActiveState(id, active, options = {}) {
    this.ensureSchema();
    const summary = this.getCustomerAccountSummary(id);
    if (!summary) {
      const error = new Error("العميل غير موجود");
      error.code = "NOT_FOUND";
      throw error;
    }

    if (!active) {
      const tolerance = 0.009;
      const hasBalance = Math.abs(summary.balance) > tolerance;
      if (hasBalance && !options.allowOutstandingBalance) {
        const error = new Error(
          `لا يمكن أرشفة العميل "${summary.customer.name}" لأن حسابه غير مسدد (${summary.balanceLabel}: ${Math.abs(summary.balance)}).`
        );
        error.code = "OUTSTANDING_BALANCE";
        error.summary = summary;
        throw error;
      }
    }

    const archivedAt = active ? null : new Date().toISOString();
    this.db
      .prepare(`UPDATE ${CUSTOMER_TABLE} SET is_active = ?, archived_at = ? WHERE id = ?`)
      .run(active ? 1 : 0, archivedAt, Number(summary.customer.id));

    return { ...this.getCustomerAccountSummary(id), archivedAt };
  }

  // ------------------------------------------------- guards for new entries

  findCustomerByIdOrName(id, name) {
    const byId = this.getCustomer(id);
    if (byId) return byId;
    const text = String(name || "").trim();
    if (!text) return null;
    const matches = this.db
      .prepare(`SELECT * FROM ${CUSTOMER_TABLE} WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))`)
      .all(text);
    return matches.length === 1 ? matches[0] : null;
  }

  findSupplierByIdOrName(id, name) {
    const byId = this.getSupplier(id);
    if (byId) return byId;
    const text = String(name || "").trim();
    if (!text) return null;
    const matches = this.db
      .prepare(`SELECT * FROM ${SUPPLIER_TABLE} WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))`)
      .all(text);
    return matches.length === 1 ? matches[0] : null;
  }

  /**
   * يمنع تسجيل معاملة جديدة على حساب مؤرشف.
   * لا يمنع أبدًا قراءة أو عرض المعاملات القديمة.
   */
  assertCustomerActive(id, name) {
    const customer = this.findCustomerByIdOrName(id, name);
    if (!customer) return true;
    if (Number(customer.is_active ?? 1) === 0) {
      const error = new Error(
        `العميل "${customer.name}" موجود في الأرشيف. استرجعه أولًا قبل تسجيل معاملة جديدة.`
      );
      error.code = "ARCHIVED_ACCOUNT";
      throw error;
    }
    return true;
  }

  assertSupplierActive(id, name) {
    const supplier = this.findSupplierByIdOrName(id, name);
    if (!supplier) return true;
    if (Number(supplier.is_active ?? 1) === 0) {
      const error = new Error(
        `المورد "${supplier.name}" موجود في الأرشيف. استرجعه أولًا قبل تسجيل معاملة جديدة.`
      );
      error.code = "ARCHIVED_ACCOUNT";
      throw error;
    }
    return true;
  }

  // -------------------------------------------------------------- suppliers

  listSuppliers(status = "active") {
    const normalized = AccountArchiveService.normalizeStatus(status);
    if (!this.columnExists(SUPPLIER_TABLE, "is_active")) {
      return this.db.prepare(`SELECT * FROM ${SUPPLIER_TABLE} ORDER BY id DESC`).all();
    }
    const where = this.statusClause(normalized);
    return this.db
      .prepare(`SELECT * FROM ${SUPPLIER_TABLE} ${where} ORDER BY id DESC`)
      .all();
  }

  getSupplier(id) {
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(numericId)) return null;
    return this.db.prepare(`SELECT * FROM ${SUPPLIER_TABLE} WHERE id = ?`).get(numericId) || null;
  }

  isSupplierArchived(id) {
    const supplier = this.getSupplier(id);
    if (!supplier) return false;
    return Number(supplier.is_active ?? 1) === 0;
  }

  getSupplierAccountSummary(id) {
    const supplier = this.getSupplier(id);
    if (!supplier) return null;

    const name = supplier.name || "";
    const numericId = Number(supplier.id);
    const args = [numericId, name];

    let ordersCount = 0;
    let ordersTotal = 0;
    let ordersPaid = 0;
    if (this.tableExists("suppliers")) {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS c,
                  COALESCE(SUM(total), 0) AS total,
                  COALESCE(SUM(paid), 0) AS paid
             FROM suppliers
            WHERE suppliers.supplier_id = ?
               OR (suppliers.supplier_id IS NULL AND TRIM(LOWER(suppliers.name)) = TRIM(LOWER(?)))`
        )
        .get(...args);
      ordersCount = Number(row?.c || 0);
      ordersTotal = Number(row?.total || 0);
      ordersPaid = Number(row?.paid || 0);
    }

    let paymentsCount = 0;
    let paymentsTotal = 0;
    if (this.tableExists("supplier_payments")) {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS total
             FROM supplier_payments
            WHERE supplier_payments.supplier_id = ?
               OR (supplier_payments.supplier_id IS NULL AND TRIM(LOWER(supplier_payments.supplier_name)) = TRIM(LOWER(?)))`
        )
        .get(...args);
      paymentsCount = Number(row?.c || 0);
      paymentsTotal = Number(row?.total || 0);
    }

    let transactionsCount = 0;
    if (this.tableExists("supplier_transactions")) {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS c FROM supplier_transactions
            WHERE TRIM(LOWER(supplier_name)) = TRIM(LOWER(?))`
        )
        .get(name);
      transactionsCount = Number(row?.c || 0);
    }

    const paid = ordersPaid + paymentsTotal;
    const balance = ordersTotal - paid;
    const totalRecords = ordersCount + paymentsCount;

    return {
      supplier,
      isArchived: Number(supplier.is_active ?? 1) === 0,
      archivedAt: supplier.archived_at || null,
      ordersCount,
      paymentsCount,
      ledgerRowsCount: transactionsCount,
      totalRecords,
      hasTransactions: totalRecords > 0 || transactionsCount > 0,
      ordersTotal,
      paid,
      balance,
      balanceLabel: balance > 0 ? "مستحق للمورد" : balance < 0 ? "مدفوع زيادة" : "مسدد بالكامل",
      canHardDelete: totalRecords === 0 && transactionsCount === 0,
    };
  }

  archiveSupplier(id, options = {}) {
    return this.setSupplierActiveState(id, false, options);
  }

  restoreSupplier(id) {
    return this.setSupplierActiveState(id, true, {});
  }

  setSupplierActiveState(id, active, options = {}) {
    this.ensureSchema();
    const summary = this.getSupplierAccountSummary(id);
    if (!summary) {
      const error = new Error("المورد غير موجود");
      error.code = "NOT_FOUND";
      throw error;
    }

    if (!active) {
      const tolerance = 0.009;
      const hasBalance = Math.abs(summary.balance) > tolerance;
      if (hasBalance && !options.allowOutstandingBalance) {
        const error = new Error(
          `لا يمكن أرشفة المورد "${summary.supplier.name}" لأن حسابه غير مسدد (${summary.balanceLabel}: ${Math.abs(summary.balance)}).`
        );
        error.code = "OUTSTANDING_BALANCE";
        error.summary = summary;
        throw error;
      }
    }

    const archivedAt = active ? null : new Date().toISOString();
    this.db
      .prepare(`UPDATE ${SUPPLIER_TABLE} SET is_active = ?, archived_at = ? WHERE id = ?`)
      .run(active ? 1 : 0, archivedAt, Number(summary.supplier.id));

    return { ...this.getSupplierAccountSummary(id), archivedAt };
  }
}

module.exports = AccountArchiveService;
