/**
 * Read-only audit + backup for the customer/supplier archive feature.
 *
 * - Copies the production database to _archive_audit/backup (never modifies the original)
 * - Runs integrity_check
 * - Dumps schema + foreign key definitions for every table
 * - Captures transaction counts and financial totals as a baseline
 *
 * Usage: node scripts/archive-baseline.js
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const ProfitLossService = require("../server/profitLoss");

const PROD_DB = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
  "mg-fabric-store",
  "mg_fabric.db"
);
const AUDIT_DIR = path.join(__dirname, "..", "_archive_audit");
const BACKUP_DIR = path.join(AUDIT_DIR, "backup");

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function tableExists(db, name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

function count(db, table, where = "") {
  if (!tableExists(db, table)) return null;
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table} ${where}`).get().c;
}

function sum(db, table, expr, where = "") {
  if (!tableExists(db, table)) return null;
  const row = db.prepare(`SELECT COALESCE(SUM(${expr}), 0) AS s FROM ${table} ${where}`).get();
  return Number(row.s || 0);
}

function main() {
  if (!fs.existsSync(PROD_DB)) {
    console.error("Production database not found:", PROD_DB);
    process.exit(1);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const backupPath = path.join(BACKUP_DIR, `mg_fabric-before-archive-${stamp()}.db`);
  fs.copyFileSync(PROD_DB, backupPath);
  console.log("Backup created:", backupPath);

  // Read the backup (identical content) so the live file is never touched by this script.
  const db = new DatabaseSync(backupPath, { readOnly: true });

  const integrity = db.prepare("PRAGMA integrity_check").get();
  const foreignKeysOn = db.prepare("PRAGMA foreign_keys").get();

  const tables = db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();

  const foreignKeys = {};
  const cascades = [];
  for (const t of tables) {
    const fks = db.prepare(`SELECT * FROM pragma_foreign_key_list('${t.name}')`).all();
    if (fks.length) {
      foreignKeys[t.name] = fks;
      for (const fk of fks) {
        if (String(fk.on_delete || "").toUpperCase() === "CASCADE") {
          cascades.push({ table: t.name, references: fk.table, on_delete: fk.on_delete });
        }
      }
    }
  }

  const indexes = db
    .prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name")
    .all();

  const counts = {
    customers: count(db, "customers"),
    suppliers_info: count(db, "suppliers_info"),
    sales: count(db, "sales"),
    payments: count(db, "payments"),
    returned_orders: count(db, "returned_orders"),
    supplier_orders: count(db, "suppliers"),
    supplier_payments: count(db, "supplier_payments"),
    supplier_transactions: count(db, "supplier_transactions"),
    expenses: count(db, "expenses"),
    inventory: count(db, "inventory"),
    inventory_sections: count(db, "inventory_sections"),
  };

  const totals = {
    salesTotal: sum(db, "sales", "total"),
    salesPaid: sum(db, "sales", "paid"),
    paymentsTotal: sum(db, "payments", "amount"),
    returnsValue: sum(db, "returned_orders", "COALESCE(quantity,0) * COALESCE(price,0)"),
    purchasesTotal: sum(db, "suppliers", "total"),
    purchasesPaid: sum(db, "suppliers", "paid"),
    supplierPaymentsTotal: sum(db, "supplier_payments", "amount"),
    expensesTotal: sum(db, "expenses", "amount"),
    inventoryValue: sum(db, "inventory", "COALESCE(total_meters,0) * COALESCE(purchase_price,0)"),
  };

  const pl = new ProfitLossService(db).calculateProfitLoss({ from: null, to: null, includeDetails: false });
  const profitLoss = {
    grossSales: pl.grossSales,
    salesReturns: pl.salesReturns,
    netSales: pl.netSales,
    cogs: pl.cogs,
    returnedCogs: pl.returnedCogs,
    netCogs: pl.netCogs,
    grossProfit: pl.grossProfit,
    operatingExpenses: pl.operatingExpenses,
    otherIncome: pl.otherIncome,
    netProfit: pl.netProfit,
    netLoss: pl.netLoss,
    collections: pl.collections,
    allocatedCollections: pl.allocatedCollections,
    unallocatedCollections: pl.unallocatedCollections,
    accountsReceivable: pl.accountsReceivable,
  };

  const hasIsActive = (table) =>
    db.prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('${table}') WHERE name IN ('is_active','archived_at','deleted_at')`).get().c;

  const report = {
    generatedAt: new Date().toISOString(),
    productionDatabase: path.basename(PROD_DB),
    backupFile: path.basename(backupPath),
    integrityCheck: integrity,
    foreignKeysPragma: foreignKeysOn,
    tablesCount: tables.length,
    tableSchemas: tables,
    foreignKeys,
    cascadeDeleteRelations: cascades,
    indexes,
    counts,
    totals,
    profitLoss,
    existingArchiveColumns: {
      customers: hasIsActive("customers"),
      suppliers_info: hasIsActive("suppliers_info"),
    },
  };

  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  const out = path.join(AUDIT_DIR, "archive-baseline.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  db.close();

  console.log("integrity_check:", JSON.stringify(integrity));
  console.log("foreign key relations:", Object.keys(foreignKeys).length);
  console.log("ON DELETE CASCADE relations:", cascades.length);
  console.log("counts:", JSON.stringify(counts));
  console.log("totals:", JSON.stringify(totals));
  console.log("netProfit:", profitLoss.netProfit, "netSales:", profitLoss.netSales, "cogs:", profitLoss.cogs);
  console.log("archive columns present:", JSON.stringify(report.existingArchiveColumns));
  console.log("Report written to:", out);
}

main();
