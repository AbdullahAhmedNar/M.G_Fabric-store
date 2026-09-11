"use strict";

/**
 * Validate archive behavior against a COPY of the real production database.
 * Never writes to the live file.
 *
 * Usage: node scripts/archive-realdb-validation.js
 */

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const AccountArchiveService = require("../server/accountArchive");
const ProfitLossService = require("../server/profitLoss");

const PROD_DB = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"),
  "mg-fabric-store",
  "mg_fabric.db"
);
const WORK_DIR = path.join(__dirname, "..", "_archive_audit");
const WORK_DB = path.join(WORK_DIR, "archive-validation-copy.db");

function snap(db) {
  const one = (sql) => db.prepare(sql).get();
  const pl = new ProfitLossService(db).calculateProfitLoss({
    from: null,
    to: null,
    includeDetails: false,
  });
  return {
    integrity: one("PRAGMA integrity_check").integrity_check,
    customers: one("SELECT COUNT(*) c FROM customers").c,
    suppliers: one("SELECT COUNT(*) c FROM suppliers_info").c,
    sales: one("SELECT COUNT(*) c FROM sales").c,
    payments: one("SELECT COUNT(*) c FROM payments").c,
    returns: one("SELECT COUNT(*) c FROM returned_orders").c,
    supplierOrders: one("SELECT COUNT(*) c FROM suppliers").c,
    supplierPayments: one("SELECT COUNT(*) c FROM supplier_payments").c,
    expenses: one("SELECT COUNT(*) c FROM expenses").c,
    inventory: one("SELECT COUNT(*) c FROM inventory").c,
    salesTotal: one("SELECT COALESCE(SUM(total),0) v FROM sales").v,
    paymentsTotal: one("SELECT COALESCE(SUM(amount),0) v FROM payments").v,
    returnsTotal: one("SELECT COALESCE(SUM(quantity*price),0) v FROM returned_orders").v,
    purchasesTotal: one("SELECT COALESCE(SUM(total),0) v FROM suppliers").v,
    supplierPaid: one("SELECT COALESCE(SUM(amount),0) v FROM supplier_payments").v,
    netSales: pl.netSales,
    cogs: pl.cogs,
    grossProfit: pl.grossProfit,
    netProfit: pl.netProfit,
    collections: pl.collections,
    accountsReceivable: pl.accountsReceivable,
  };
}

function equal(a, b) {
  return Number(a) === Number(b) || Math.abs(Number(a) - Number(b)) < 0.005;
}

function main() {
  if (!fs.existsSync(PROD_DB)) {
    console.error("قاعدة الإنتاج غير موجودة");
    process.exit(1);
  }
  fs.mkdirSync(WORK_DIR, { recursive: true });
  fs.copyFileSync(PROD_DB, WORK_DB);

  const db = new DatabaseSync(WORK_DB);
  const service = new AccountArchiveService(db);
  const before = snap(db);
  console.log("قبل الهجرة:", JSON.stringify(before, null, 2));

  service.ensureSchema();
  const afterSchema = snap(db);

  let passed = 0;
  let failed = 0;
  const check = (label, ok) => {
    if (ok) {
      passed += 1;
      console.log("  PASS  " + label);
    } else {
      failed += 1;
      console.log("  FAIL  " + label);
    }
  };

  console.log("\nبعد إضافة أعمدة الأرشفة:");
  for (const key of Object.keys(before)) {
    if (key === "integrity") continue;
    const same =
      typeof before[key] === "string"
        ? before[key] === afterSchema[key]
        : equal(before[key], afterSchema[key]);
    check(`${key} لم يتغير بعد الهجرة`, same);
  }
  check("integrity_check = ok", afterSchema.integrity === "ok");
  check("عمود is_active على العملاء", service.columnExists("customers", "is_active"));
  check("عمود is_active على الموردين", service.columnExists("suppliers_info", "is_active"));

  const allCustomers = service.listCustomers("all");
  const summaries = allCustomers.map((c) => service.getCustomerAccountSummary(c.id));
  const zeroBalance = summaries.find((s) => s.hasTransactions && Math.abs(s.balance) <= 0.009);
  const withBalance = summaries.find((s) => s.hasTransactions && Math.abs(s.balance) > 0.009);

  if (zeroBalance) {
    console.log(`\nأرشفة عميل رصيده صفر على النسخة: ${zeroBalance.customer.name}`);
    const salesBefore = db.prepare("SELECT COUNT(*) c FROM sales").get().c;
    service.archiveCustomer(zeroBalance.customer.id);
    const afterArchive = snap(db);
    check("اختفى من النشطين", !service.listCustomers("active").some((c) => c.id === zeroBalance.customer.id));
    check("ظهر في الأرشيف", service.listCustomers("archived").some((c) => c.id === zeroBalance.customer.id));
    check("عدد المبيعات لم يتغير", afterArchive.sales === salesBefore);
    check("صافي المبيعات لم يتغير", equal(afterArchive.netSales, before.netSales));
    check("التكلفة لم تتغير", equal(afterArchive.cogs, before.cogs));
    check("صافي الربح لم يتغير", equal(afterArchive.netProfit, before.netProfit));
    check("التحصيلات لم تتغير", equal(afterArchive.collections, before.collections));
    check("كشف الحساب ما زال يُحسب", service.getCustomerAccountSummary(zeroBalance.customer.id).salesCount === zeroBalance.salesCount);
    service.restoreCustomer(zeroBalance.customer.id);
    check("الاسترجاع يعيده للنشطين", service.listCustomers("active").some((c) => c.id === zeroBalance.customer.id));
  } else {
    console.log("\nلا يوجد عميل برصيد صفر ومعاملات في النسخة — تم تخطي أرشفة عميل حقيقي.");
  }

  if (withBalance) {
    console.log(`\nمحاولة أرشفة عميل عليه رصيد بدون سماحية: ${withBalance.customer.name}`);
    let blocked = false;
    try {
      service.archiveCustomer(withBalance.customer.id);
    } catch (error) {
      blocked = error.code === "OUTSTANDING_BALANCE";
    }
    check("الأرشفة بدون سماحية مرفوضة", blocked);
    check("الرصيد لم يُصفَّر", Math.abs(service.getCustomerAccountSummary(withBalance.customer.id).balance) > 0.009);
    check("العميل ما زال نشطًا", service.listCustomers("active").some((c) => c.id === withBalance.customer.id));
  }

  const allSuppliers = service.listSuppliers("all");
  const supplierSummaries = allSuppliers.map((s) => service.getSupplierAccountSummary(s.id));
  const zeroSupplier = supplierSummaries.find((s) => s.hasTransactions && Math.abs(s.balance) <= 0.009);
  if (zeroSupplier) {
    console.log(`\nأرشفة مورد رصيده صفر على النسخة: ${zeroSupplier.supplier.name}`);
    service.archiveSupplier(zeroSupplier.supplier.id);
    const after = snap(db);
    check("المشتريات لم تتغير", equal(after.purchasesTotal, before.purchasesTotal));
    check("دفعات الموردين لم تتغير", equal(after.supplierPaid, before.supplierPaid));
    check("صافي الربح بعد أرشفة المورد لم يتغير", equal(after.netProfit, before.netProfit));
    service.restoreSupplier(zeroSupplier.supplier.id);
  }

  const finalSnap = snap(db);
  check("integrity_check النهائي ok", finalSnap.integrity === "ok");
  check("عدد العملاء النهائي مطابق", finalSnap.customers === before.customers);

  db.close();
  fs.unlinkSync(WORK_DB);

  console.log("\n=======================================");
  console.log(`ناجح: ${passed}  |  فاشل: ${failed}`);
  console.log("=======================================");
  process.exit(failed === 0 ? 0 : 1);
}

main();
