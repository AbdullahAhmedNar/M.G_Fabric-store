"use strict";

/**
 * اختبارات ProfitLossService.
 * تُنفَّذ على قاعدة بيانات SQLite في الذاكرة بنفس بنية جداول المشروع،
 * ولا تلمس قاعدة البيانات الحقيقية إطلاقاً.
 *
 * الاستخدام: node scripts/pl-tests.js
 */

const { DatabaseSync } = require("node:sqlite");
const ProfitLossService = require("../server/profitLoss");

let passed = 0;
let failed = 0;
const failures = [];

function approx(actual, expected, tolerance = 0.01) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function check(testName, label, actual, expected) {
  if (approx(actual, expected)) {
    passed += 1;
    console.log(`  PASS  ${label}: ${actual}`);
  } else {
    failed += 1;
    failures.push(`${testName} → ${label}: expected ${expected}, got ${actual}`);
    console.log(`  FAIL  ${label}: expected ${expected}, got ${actual}`);
  }
}

function checkTrue(testName, label, condition, details = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(`${testName} → ${label} ${details}`);
    console.log(`  FAIL  ${label} ${details}`);
  }
}

function createDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT);
    CREATE TABLE sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER, customer_name TEXT, description TEXT,
      inventory_item_id INTEGER, quantity REAL, unit TEXT, price REAL,
      total REAL, paid REAL, remaining REAL, unit_cost REAL, date TEXT
    );
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER, customer_name TEXT, amount REAL, description TEXT, date TEXT
    );
    CREATE TABLE returned_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER, customer_name TEXT, description TEXT,
      quantity REAL, unit TEXT, price REAL, inventory_item_id INTEGER,
      rolls_count INTEGER, date TEXT
    );
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT, description TEXT, amount REAL, date TEXT, direction TEXT DEFAULT 'خارج'
    );
    CREATE TABLE inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT, purchase_price REAL
    );
  `);
  db.prepare("INSERT INTO customers (id, name) VALUES (1, ?)").run("عميل تجربة");
  db.prepare("INSERT INTO inventory (id, item_name, purchase_price) VALUES (1, ?, 60)").run("قماش");
  return db;
}

function addSale(db, { qty, price, paid, unitCost, date, itemId = 1, customerId = 1 }) {
  const total = qty * price;
  db.prepare(
    `INSERT INTO sales
       (customer_id, customer_name, description, inventory_item_id, quantity, unit,
        price, total, paid, remaining, unit_cost, date)
     VALUES (?, ?, ?, ?, ?, 'متر', ?, ?, ?, ?, ?, ?)`
  ).run(
    customerId,
    "عميل تجربة",
    "قماش",
    itemId,
    qty,
    price,
    total,
    paid,
    total - paid,
    unitCost,
    date
  );
}

function addPayment(db, { amount, date, customerId = 1 }) {
  db.prepare(
    "INSERT INTO payments (customer_id, customer_name, amount, description, date) VALUES (?, ?, ?, ?, ?)"
  ).run(customerId, "عميل تجربة", amount, "دفعة", date);
}

function addReturn(db, { qty, price, date, itemId = 1, customerId = 1 }) {
  db.prepare(
    `INSERT INTO returned_orders
       (customer_id, customer_name, description, quantity, unit, price, inventory_item_id, date)
     VALUES (?, ?, ?, ?, 'متر', ?, ?, ?)`
  ).run(customerId, "عميل تجربة", "قماش", qty, price, itemId, date);
}

function addExpense(db, { amount, date, direction = "خارج" }) {
  db.prepare(
    "INSERT INTO expenses (category, description, amount, date, direction) VALUES (?, ?, ?, ?, ?)"
  ).run("عام", "بند", amount, date, direction);
}

const D = "2024-03-10";
const RANGE = { from: "2024-01-01", to: "2024-12-31" };

// ---------------------------------------------------------------------- TEST 1
function test1() {
  const name = "TEST 1: Sales=1000, Paid=0, COGS=600";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0, unitCost: 60, date: D });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Revenue (Net Sales)", pl.netSales, 1000);
  check(name, "COGS", pl.cogs, 600);
  check(name, "Gross Profit", pl.grossProfit, 400);
  check(name, "Collections", pl.collections, 0);
  check(name, "Accounts Receivable", pl.accountsReceivable, 1000);
  db.close();
}

// ---------------------------------------------------------------------- TEST 2
function test2() {
  const name = "TEST 2: Sales=1000, Paid=500, COGS=600";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 500, unitCost: 60, date: D });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Revenue (Net Sales)", pl.netSales, 1000);
  check(name, "COGS", pl.cogs, 600);
  check(name, "Gross Profit", pl.grossProfit, 400);
  check(name, "Collections", pl.collections, 500);
  check(name, "Accounts Receivable", pl.accountsReceivable, 500);
  db.close();
}

// ---------------------------------------------------------------------- TEST 3
function test3() {
  const name = "TEST 3: Sales=1000, Collections=1500";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0, unitCost: 60, date: D });
  addPayment(db, { amount: 1500, date: D });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Revenue (Net Sales)", pl.netSales, 1000);
  check(name, "Collections", pl.collections, 1500);
  check(name, "Allocated Collections", pl.allocatedCollections, 1000);
  check(name, "Unallocated Collections", pl.unallocatedCollections, 500);
  check(name, "Accounts Receivable", pl.accountsReceivable, 0);
  // الزيادة 500 يجب ألا تزيد الربح
  check(name, "Gross Profit (بدون الزيادة)", pl.grossProfit, 400);
  check(name, "Net Profit (بدون الزيادة)", pl.netProfit, 400);
  checkTrue(
    name,
    "تحذير UNALLOCATED_COLLECTIONS موجود",
    pl.reconciliationWarnings.some((w) => w.code === "UNALLOCATED_COLLECTIONS")
  );
  checkTrue(
    name,
    "تحذير COLLECTIONS_GT_NET_SALES موجود",
    pl.reconciliationWarnings.some((w) => w.code === "COLLECTIONS_GT_NET_SALES")
  );
  db.close();
}

// ---------------------------------------------------------------------- TEST 4
function test4() {
  const name = "TEST 4: Sales=1000, Returns=200, COGS=600, ReturnedCOGS=120";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0, unitCost: 60, date: "2024-03-01" });
  addReturn(db, { qty: 2, price: 100, date: "2024-03-15" });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Gross Sales", pl.grossSales, 1000);
  check(name, "Sales Returns", pl.salesReturns, 200);
  check(name, "Net Sales", pl.netSales, 800);
  check(name, "COGS", pl.cogs, 600);
  check(name, "Returned COGS (تكلفة تاريخية فعلية)", pl.returnedCogs, 120);
  check(name, "Actual Returned COGS", pl.actualReturnedCogs, 120);
  check(name, "Estimated Returned COGS", pl.estimatedReturnedCogs, 0);
  check(name, "Net COGS", pl.netCogs, 480);
  check(name, "Gross Profit", pl.grossProfit, 320);
  db.close();
}

// ---------------------------------------------------------------------- TEST 5
function test5() {
  const name = "TEST 5: Sales=0, Expenses=1000";
  console.log(`\n${name}`);
  const db = createDb();
  addExpense(db, { amount: 1000, date: D });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Net Sales", pl.netSales, 0);
  check(name, "Operating Expenses", pl.operatingExpenses, 1000);
  check(name, "Net Profit", pl.netProfit, -1000);
  check(name, "Net Loss", pl.netLoss, 1000);
  db.close();
}

// ---------------------------------------------------------------------- TEST 6
function test6() {
  const name = "TEST 6: Sales=1000, COGS=600, Expenses=200, OtherIncome=100";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0, unitCost: 60, date: D });
  addExpense(db, { amount: 200, date: D, direction: "خارج" });
  addExpense(db, { amount: 100, date: D, direction: "داخل" });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Gross Profit", pl.grossProfit, 400);
  check(name, "Operating Expenses", pl.operatingExpenses, 200);
  check(name, "Other Income", pl.otherIncome, 100);
  check(name, "Net Profit", pl.netProfit, 300);
  check(name, "Net Loss", pl.netLoss, 0);
  db.close();
}

// ---------------------------------------------------------------------- TEST 7
function test7() {
  const name = "TEST 7: Sales=1000, Paid=1000, COGS=600";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 1000, unitCost: 60, date: D });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Revenue (Net Sales)", pl.netSales, 1000);
  check(name, "COGS", pl.cogs, 600);
  check(name, "Gross Profit", pl.grossProfit, 400);
  check(name, "Collections", pl.collections, 1000);
  check(name, "Accounts Receivable", pl.accountsReceivable, 0);
  check(name, "Collection Rate", pl.collectionRate, 100);
  db.close();
}

// ---------------------------------------------------------------------- TEST 8
function test8() {
  const name = "TEST 8: Sales=1000, Paid=500 ثم دفعة لاحقة 500";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 500, unitCost: 60, date: "2024-01-10" });
  addPayment(db, { amount: 500, date: "2024-02-15" });
  const service = new ProfitLossService(db);

  const p1 = service.calculateProfitLoss({ from: "2024-01-01", to: "2024-01-31" });
  const p2 = service.calculateProfitLoss({ from: "2024-02-01", to: "2024-02-29" });
  const lifetime = service.calculateProfitLoss({ from: null, to: null });

  check(name, "الفترة 1 - Revenue", p1.netSales, 1000);
  check(name, "الفترة 1 - Collections", p1.collections, 500);
  check(name, "الفترة 1 - AR", p1.accountsReceivable, 500);
  check(name, "الفترة 1 - Net Profit", p1.netProfit, 400);

  check(name, "الفترة 2 - Collections", p2.collections, 500);
  check(name, "الفترة 2 - Revenue", p2.netSales, 0);
  check(name, "الفترة 2 - AR", p2.accountsReceivable, 0);

  check(name, "الإجمالي - Collections", lifetime.collections, 1000);
  check(name, "الإجمالي - Revenue", lifetime.netSales, 1000);
  check(name, "الإجمالي - Net Profit = 400 (وليس 900 أو 1500)", lifetime.netProfit, 400);
  db.close();
}

// -------------------------------------------------------- اختبارات قواعد إضافية
function testMissingCost() {
  const name = "EXTRA: مبيعات بدون unit_cost لا تُعامل كتكلفة صفر بصمت";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0, unitCost: 60, date: D });
  addSale(db, { qty: 5, price: 100, paid: 0, unitCost: null, date: D, itemId: 2 });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Gross Sales", pl.grossSales, 1500);
  check(name, "COGS (المسجّلة فقط)", pl.cogs, 600);
  check(name, "عدد المبيعات بدون تكلفة", pl.missingCostSummary.count, 1);
  check(name, "قيمة المبيعات بدون تكلفة", pl.missingCostSummary.salesValue, 500);
  checkTrue(
    name,
    "تحذير MISSING_UNIT_COST موجود",
    pl.reconciliationWarnings.some((w) => w.code === "MISSING_UNIT_COST")
  );
  checkTrue(
    name,
    "تفاصيل الأصناف الناقصة التكلفة متاحة للتدقيق",
    Array.isArray(pl.missingCostItems) && pl.missingCostItems.length === 1
  );
  db.close();
}

function testCollectionRateDoesNotAffectCogs() {
  const name = "EXTRA: نسبة التحصيل لا تؤثر على COGS ولا على الربح الإجمالي";
  console.log(`\n${name}`);
  const dbA = createDb();
  addSale(dbA, { qty: 10, price: 100, paid: 0, unitCost: 60, date: D });
  const a = new ProfitLossService(dbA).calculateProfitLoss(RANGE);

  const dbB = createDb();
  addSale(dbB, { qty: 10, price: 100, paid: 1000, unitCost: 60, date: D });
  const b = new ProfitLossService(dbB).calculateProfitLoss(RANGE);

  check(name, "COGS متساوية", b.cogs, a.cogs);
  check(name, "Net COGS متساوية", b.netCogs, a.netCogs);
  check(name, "Gross Profit متساوٍ", b.grossProfit, a.grossProfit);
  check(name, "Net Profit متساوٍ", b.netProfit, a.netProfit);
  checkTrue(
    name,
    "نسبة التحصيل مختلفة بين الحالتين",
    a.collectionRate === 0 && b.collectionRate === 100,
    `(a=${a.collectionRate}, b=${b.collectionRate})`
  );
  dbA.close();
  dbB.close();
}

function testDuplicatePaymentDetection() {
  const name = "EXTRA: كشف الدفعات المكرّرة بدون حذف أو خصم";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0, unitCost: 60, date: D });
  addPayment(db, { amount: 300, date: D });
  addPayment(db, { amount: 300, date: D });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Collections كما هي في البيانات", pl.collections, 600);
  check(name, "الدفعات المكرّرة المحتملة", pl.potentialDuplicatePayments.withinPaymentsCount, 1);
  check(name, "قيمة التكرار المحتمل", pl.potentialDuplicatePayments.withinPaymentsAmount, 300);
  check(name, "Net Profit لم يتأثر بالتكرار", pl.netProfit, 400);
  db.close();
}

function testEquations() {
  const name = "EXTRA: تماسك المعادلات المحاسبية";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 12, price: 250, paid: 900, unitCost: 140, date: "2024-05-05" });
  addSale(db, { qty: 4, price: 300, paid: 0, unitCost: 200, date: "2024-06-06" });
  addReturn(db, { qty: 1, price: 250, date: "2024-06-10" });
  addPayment(db, { amount: 700, date: "2024-07-01" });
  addExpense(db, { amount: 350, date: "2024-07-02", direction: "خارج" });
  addExpense(db, { amount: 120, date: "2024-07-03", direction: "داخل" });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);

  check(name, "Net Sales = Gross - Returns", pl.netSales, pl.grossSales - pl.salesReturns);
  check(name, "Net COGS = COGS - Returned COGS", pl.netCogs, pl.cogs - pl.returnedCogs);
  check(name, "Gross Profit = Net Sales - Net COGS", pl.grossProfit, pl.netSales - pl.netCogs);
  check(
    name,
    "Net Profit = Gross Profit - OpEx + Other Income",
    pl.netProfit,
    pl.grossProfit - pl.operatingExpenses + pl.otherIncome
  );
  check(
    name,
    "Collections = Allocated + Unallocated",
    pl.collections,
    pl.allocatedCollections + pl.unallocatedCollections
  );
  check(
    name,
    "Gross Margin على صافي المبيعات",
    pl.grossProfitMargin,
    (pl.grossProfit / pl.netSales) * 100
  );
  check(
    name,
    "Net Margin على صافي المبيعات",
    pl.netProfitMargin,
    (pl.netProfit / pl.netSales) * 100
  );
  checkTrue(name, "الأساس المحاسبي accrual", pl.basis === "accrual", `(${pl.basis})`);
  db.close();
}

function testEstimatedReturnedCogsFlagged() {
  const name = "EXTRA: تقدير تكلفة المرتجع يُصنَّف بوضوح عند غياب التكلفة التاريخية";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0, unitCost: 60, date: D });
  addReturn(db, { qty: 2, price: 100, date: D, itemId: 999 });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "Actual Returned COGS", pl.actualReturnedCogs, 0);
  check(name, "Estimated Returned COGS", pl.estimatedReturnedCogs, 120);
  checkTrue(
    name,
    "تحذير ESTIMATED_RETURNED_COGS موجود",
    pl.reconciliationWarnings.some((w) => w.code === "ESTIMATED_RETURNED_COGS")
  );
  db.close();
}

function testInconsistentReturnLine() {
  const name = "EXTRA: مرتجع بسعر وحدة غير متوافق لا يضخّم تكلفة المرتجع";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0, unitCost: 60, date: "2024-03-01" });
  // سطر مرتجع مسجّل بكمية كبيرة وسعر وحدة = 1 (تعارض واضح مع سعر بيع الصنف)
  addReturn(db, { qty: 1000, price: 1, date: "2024-03-20" });
  const pl = new ProfitLossService(db).calculateProfitLoss(RANGE);
  check(name, "قيمة المرتجع كما هي في البيانات", pl.salesReturns, 1000);
  check(name, "لم تُستخدم الكمية × التكلفة (60,000)", pl.actualReturnedCogs, 0);
  check(name, "التكلفة من نسبة تكلفة الصنف الفعلية", pl.itemRatioReturnedCogs, 600);
  check(name, "Returned COGS", pl.returnedCogs, 600);
  check(name, "Net COGS", pl.netCogs, 0);
  check(name, "Gross Profit", pl.grossProfit, 0);
  checkTrue(
    name,
    "تحذير RETURN_UNIT_PRICE_MISMATCH موجود",
    pl.reconciliationWarnings.some((w) => w.code === "RETURN_UNIT_PRICE_MISMATCH")
  );
  db.close();
}

function testReadOnly() {
  const name = "EXTRA: الخدمة للقراءة فقط (لا تعدّل أي بيانات)";
  console.log(`\n${name}`);
  const db = createDb();
  addSale(db, { qty: 10, price: 100, paid: 300, unitCost: 60, date: D });
  addPayment(db, { amount: 400, date: D });
  addExpense(db, { amount: 50, date: D });
  const snapshot = () =>
    JSON.stringify({
      sales: db.prepare("SELECT * FROM sales ORDER BY id").all(),
      payments: db.prepare("SELECT * FROM payments ORDER BY id").all(),
      returns: db.prepare("SELECT * FROM returned_orders ORDER BY id").all(),
      expenses: db.prepare("SELECT * FROM expenses ORDER BY id").all(),
    });
  const before = snapshot();
  const service = new ProfitLossService(db);
  service.calculateProfitLoss(RANGE);
  service.calculateReconciliation(RANGE);
  service.calculateProfitLoss({});
  const after = snapshot();
  checkTrue(name, "البيانات لم تتغير بعد تنفيذ كل الحسابات", before === after);
  db.close();
}

console.log("=".repeat(72));
console.log("PROFIT & LOSS SERVICE TESTS");
console.log("=".repeat(72));

test1();
test2();
test3();
test4();
test5();
test6();
test7();
test8();
testMissingCost();
testCollectionRateDoesNotAffectCogs();
testDuplicatePaymentDetection();
testEquations();
testEstimatedReturnedCogsFlagged();
testInconsistentReturnLine();
testReadOnly();

console.log("\n" + "=".repeat(72));
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log("=".repeat(72));
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(" - " + f);
}
process.exit(failed === 0 ? 0 : 1);
