"use strict";

/**
 * سكربت تدقيق للقراءة فقط (Read-only) لقاعدة البيانات الحقيقية.
 *
 * يستخرج:
 * 1) Baseline من البيانات الخام قبل أي تغيير.
 * 2) نتيجة المعادلة القديمة (أساس نقدي) كما كانت في getStatistics.
 * 3) نتيجة ProfitLossService الجديدة (أساس الاستحقاق).
 * 4) مقارنة before/after مع تفسير الفرق.
 *
 * لا ينفّذ أي INSERT/UPDATE/DELETE. يفتح القاعدة بوضع readOnly.
 *
 * الاستخدام:
 *   node scripts/pl-baseline.js [dbPath] [--out=path.json]
 */

const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const ProfitLossService = require("../server/profitLoss");

function resolveDbPath(argPath) {
  if (argPath) return argPath;
  const appData =
    process.env.APPDATA ||
    (process.platform === "darwin"
      ? path.join(process.env.HOME || "", "Library", "Application Support")
      : path.join(process.env.HOME || "", ".config"));
  const candidates = [
    path.join(appData, "mg-fabric-store", "mg_fabric.db"),
    path.join(__dirname, "..", "server", "mg_fabric.db"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith("--out="));
const dbPath = resolveDbPath(args.find((a) => !a.startsWith("--")));

if (!fs.existsSync(dbPath)) {
  console.error("لم يتم العثور على قاعدة البيانات:", dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const one = (sql, ...params) => db.prepare(sql).get(...params) || {};

// ---------------------------------------------------------------- 1) baseline
const baseline = {
  salesCount: Number(one("SELECT COUNT(*) c FROM sales").c) || 0,
  salesTotal: Number(one("SELECT COALESCE(SUM(total),0) v FROM sales").v) || 0,
  salesPaidColumn:
    Number(one("SELECT COALESCE(SUM(paid),0) v FROM sales").v) || 0,
  salesRemainingColumn:
    Number(one("SELECT COALESCE(SUM(remaining),0) v FROM sales").v) || 0,
  paymentsCount: Number(one("SELECT COUNT(*) c FROM payments").c) || 0,
  paymentsTotal:
    Number(one("SELECT COALESCE(SUM(amount),0) v FROM payments").v) || 0,
  returnsCount: Number(one("SELECT COUNT(*) c FROM returned_orders").c) || 0,
  returnsTotal:
    Number(
      one("SELECT COALESCE(SUM(quantity*price),0) v FROM returned_orders").v
    ) || 0,
  expensesOutside:
    Number(
      one(
        "SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE direction IS NULL OR TRIM(direction) <> ?",
        "داخل"
      ).v
    ) || 0,
  expensesInside:
    Number(
      one(
        "SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE TRIM(direction) = ?",
        "داخل"
      ).v
    ) || 0,
  cogsRecorded:
    Number(
      one(
        "SELECT COALESCE(SUM(unit_cost*quantity),0) v FROM sales WHERE unit_cost > 0 AND quantity > 0"
      ).v
    ) || 0,
  salesWithCost:
    Number(one("SELECT COUNT(*) c FROM sales WHERE unit_cost > 0").c) || 0,
  salesWithoutCost:
    Number(
      one(
        "SELECT COUNT(*) c FROM sales WHERE (unit_cost IS NULL OR unit_cost <= 0) AND COALESCE(total,0) <> 0"
      ).c
    ) || 0,
  customersCount: Number(one("SELECT COUNT(*) c FROM customers").c) || 0,
};

baseline.collections = baseline.salesPaidColumn + baseline.paymentsTotal;
baseline.netSales = baseline.salesTotal - baseline.returnsTotal;

// ------------------------------------------------- 2) old (cash basis) formula
const oldSalesPaid = baseline.collections;
const oldNetSales = Math.max(0, baseline.salesTotal - baseline.returnsTotal);
const oldCostOfReturned =
  baseline.salesTotal > 0
    ? baseline.returnsTotal * (baseline.cogsRecorded / baseline.salesTotal)
    : 0;
const oldFullNetCost = baseline.cogsRecorded - oldCostOfReturned;
const oldRecognitionRate =
  oldNetSales > 0 ? Math.min(1, Math.max(0, oldSalesPaid / oldNetSales)) : 0;
const oldRecognizedCost = oldFullNetCost * oldRecognitionRate;
const oldNetIncome =
  oldSalesPaid -
  oldRecognizedCost -
  baseline.expensesOutside +
  baseline.expensesInside;

const oldFormula = {
  basis: "cash (before)",
  cashRevenue: oldSalesPaid,
  netSales: oldNetSales,
  recognitionRate: oldRecognitionRate,
  fullNetCostOfSoldItems: oldFullNetCost,
  recognizedCostOfSoldItems: oldRecognizedCost,
  grossProfit: oldSalesPaid - oldRecognizedCost,
  netIncome: oldNetIncome,
  netProfit: oldNetIncome > 0 ? oldNetIncome : 0,
  netLoss: oldNetIncome < 0 ? Math.abs(oldNetIncome) : 0,
  profitMargin: oldSalesPaid > 0 ? (oldNetIncome / oldSalesPaid) * 100 : 0,
};

// -------------------------------------------- 3) new (accrual) service result
const service = new ProfitLossService(db);
const newLifetime = service.calculateProfitLoss({ from: null, to: null });
const reconciliation = service.calculateReconciliation({});

const years = db
  .prepare(
    "SELECT DISTINCT strftime('%Y', date) y FROM sales WHERE date IS NOT NULL ORDER BY y DESC"
  )
  .all()
  .map((r) => r.y)
  .filter(Boolean);

const byYear = {};
for (const y of years) {
  byYear[y] = service.calculateProfitLoss({
    from: `${y}-01-01`,
    to: `${y}-12-31`,
    includeDetails: false,
  });
}

// -------------------------------------------------------------- 4) comparison
const comparison = {
  revenue: {
    before_cashRevenue: Math.round(oldFormula.cashRevenue * 100) / 100,
    after_netSales: newLifetime.netSales,
    difference:
      Math.round((newLifetime.netSales - oldFormula.cashRevenue) * 100) / 100,
    reason:
      "الإيراد أصبح مبنياً على المبيعات (بعد خصم المرتجعات) بدلاً من المبالغ المحصّلة.",
  },
  cogs: {
    before_recognizedCost: Math.round(oldFormula.recognizedCostOfSoldItems * 100) / 100,
    after_netCogs: newLifetime.netCogs,
    difference:
      Math.round((newLifetime.netCogs - oldFormula.recognizedCostOfSoldItems) * 100) /
      100,
    reason:
      "تكلفة البضاعة لم تعد مضروبة في نسبة التحصيل، وتكلفة المرتجع تُحسب من التكلفة التاريخية الفعلية.",
  },
  netProfit: {
    before: Math.round(oldFormula.netIncome * 100) / 100,
    after: newLifetime.netProfit,
    difference:
      Math.round((newLifetime.netProfit - oldFormula.netIncome) * 100) / 100,
    reason:
      "التحصيلات الزائدة عن الفواتير (والدفعات المكرّرة المحتملة) لم تعد تُضخّم الإيراد.",
  },
  cashSeparation: {
    collections: newLifetime.collections,
    allocatedCollections: newLifetime.allocatedCollections,
    unallocatedCollections: newLifetime.unallocatedCollections,
    accountsReceivable: newLifetime.accountsReceivable,
    collectionRate: newLifetime.collectionRate,
  },
};

// ------------------------------------------------------------- equation checks
const eq = (label, left, right) => ({
  label,
  left: Math.round(left * 100) / 100,
  right: Math.round(right * 100) / 100,
  ok: Math.abs(left - right) < 0.05,
});

const equationChecks = [
  eq(
    "Net Sales = Gross Sales - Sales Returns",
    newLifetime.netSales,
    newLifetime.grossSales - newLifetime.salesReturns
  ),
  eq(
    "Net COGS = COGS - Returned COGS",
    newLifetime.netCogs,
    newLifetime.cogs - newLifetime.returnedCogs
  ),
  eq(
    "Gross Profit = Net Sales - Net COGS",
    newLifetime.grossProfit,
    newLifetime.netSales - newLifetime.netCogs
  ),
  eq(
    "Net Profit = Gross Profit - Operating Expenses + Other Income",
    newLifetime.netProfit,
    newLifetime.grossProfit -
      newLifetime.operatingExpenses +
      newLifetime.otherIncome
  ),
  eq(
    "Collections = Allocated + Unallocated (as of today)",
    newLifetime.collections,
    newLifetime.allocatedCollections + newLifetime.unallocatedCollections
  ),
];

const report = {
  generatedAt: new Date().toISOString(),
  dbPath,
  readOnly: true,
  baseline,
  oldFormula,
  newProfitLoss: newLifetime,
  byYear,
  comparison,
  equationChecks,
  reconciliation: {
    collectionsVsRevenueDifference:
      reconciliation.collectionsVsRevenueDifference,
    warningsCount: reconciliation.warnings.length,
    warnings: reconciliation.warnings,
  },
};

const outPath = outArg
  ? outArg.replace("--out=", "")
  : path.join(__dirname, "..", "_pl_audit", "baseline-and-comparison.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

const money = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

console.log("=".repeat(72));
console.log("BASELINE (بيانات خام - قراءة فقط)");
console.log("=".repeat(72));
console.log("إجمالي المبيعات        :", money(baseline.salesTotal), `(${baseline.salesCount} عملية)`);
console.log("المرتجعات              :", money(baseline.returnsTotal), `(${baseline.returnsCount})`);
console.log("صافي المبيعات          :", money(baseline.netSales));
console.log("SUM(sales.paid)        :", money(baseline.salesPaidColumn));
console.log("SUM(payments.amount)   :", money(baseline.paymentsTotal), `(${baseline.paymentsCount})`);
console.log("إجمالي التحصيلات       :", money(baseline.collections));
console.log("COGS المسجّلة           :", money(baseline.cogsRecorded));
console.log("مبيعات بدون تكلفة      :", baseline.salesWithoutCost);
console.log("مصروفات خارج           :", money(baseline.expensesOutside));
console.log("إيرادات أخرى (داخل)    :", money(baseline.expensesInside));

console.log("\n" + "=".repeat(72));
console.log("BEFORE (أساس نقدي) مقابل AFTER (أساس استحقاق)");
console.log("=".repeat(72));
console.log("الإيراد   قبل:", money(oldFormula.cashRevenue), "| بعد:", money(newLifetime.netSales));
console.log("التكلفة   قبل:", money(oldFormula.recognizedCostOfSoldItems), "| بعد:", money(newLifetime.netCogs));
console.log("ربح إجمالي قبل:", money(oldFormula.grossProfit), "| بعد:", money(newLifetime.grossProfit));
console.log("صافي الربح قبل:", money(oldFormula.netIncome), "| بعد:", money(newLifetime.netProfit));
console.log("هامش الربح بعد:", newLifetime.netProfitMargin, "%");

console.log("\n" + "=".repeat(72));
console.log("CASH & RECEIVABLES (منفصلة عن الإيراد)");
console.log("=".repeat(72));
console.log("التحصيلات              :", money(newLifetime.collections));
console.log("المخصّصة على فواتير     :", money(newLifetime.allocatedCollections));
console.log("غير المخصّصة            :", money(newLifetime.unallocatedCollections));
console.log("المديونيات (AR)        :", money(newLifetime.accountsReceivable));
console.log("نسبة التحصيل           :", newLifetime.collectionRate, "%");

console.log("\n" + "=".repeat(72));
console.log("EQUATION CHECKS");
console.log("=".repeat(72));
for (const c of equationChecks) {
  console.log(c.ok ? "PASS" : "FAIL", "-", c.label, `(${c.left} = ${c.right})`);
}

console.log("\n" + "=".repeat(72));
console.log(`RECONCILIATION WARNINGS (${report.reconciliation.warningsCount})`);
console.log("=".repeat(72));
for (const w of report.reconciliation.warnings) {
  console.log(`[${w.severity}] ${w.code}: ${w.message}`);
  if (w.data) console.log("        ", JSON.stringify(w.data));
}

console.log("\nتم حفظ التقرير في:", outPath);
db.close();
