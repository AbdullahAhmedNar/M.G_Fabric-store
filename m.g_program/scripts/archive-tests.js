"use strict";

/**
 * اختبارات أرشفة حسابات العملاء والموردين.
 * تُنفَّذ على قاعدة بيانات SQLite في الذاكرة بنفس بنية جداول المشروع،
 * ولا تلمس قاعدة البيانات الحقيقية إطلاقاً.
 *
 * الاستخدام: node scripts/archive-tests.js
 */

const { DatabaseSync } = require("node:sqlite");
const AccountArchiveService = require("../server/accountArchive");
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

// -------------------------------------------------------------- fixtures

function createDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT,
      description TEXT, quantity REAL, price REAL, total REAL, paid REAL,
      remaining REAL, date TEXT, inventory_id INTEGER, used_meters REAL
    );
    CREATE TABLE suppliers_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, date TEXT
    );
    CREATE TABLE sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT, global_sequence INTEGER,
      customer_id INTEGER, customer_name TEXT, description TEXT,
      inventory_item_id INTEGER, quantity REAL, unit TEXT, price REAL,
      total REAL, paid REAL, remaining REAL, unit_cost REAL, date TEXT
    );
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, global_sequence INTEGER,
      customer_id INTEGER, customer_name TEXT, amount REAL, description TEXT, date TEXT
    );
    CREATE TABLE returned_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, global_sequence INTEGER,
      customer_id INTEGER, customer_name TEXT, description TEXT,
      quantity REAL, unit TEXT, price REAL, inventory_item_id INTEGER,
      rolls_count INTEGER, date TEXT
    );
    CREATE TABLE suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, global_sequence INTEGER, supplier_id INTEGER,
      name TEXT, phone TEXT, description TEXT, quantity REAL, price REAL,
      total REAL, paid REAL, remaining REAL, date TEXT, unit TEXT,
      inventory_item_id INTEGER, add_to_inventory INTEGER, rolls_count INTEGER
    );
    CREATE TABLE supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, global_sequence INTEGER, supplier_id INTEGER,
      supplier_name TEXT, amount REAL, description TEXT, date TEXT
    );
    CREATE TABLE supplier_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_name TEXT, type TEXT,
      order_id INTEGER, payment_id INTEGER, description TEXT,
      quantity REAL, price REAL, total REAL, paid REAL, amount REAL, date TEXT
    );
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, description TEXT,
      amount REAL, date TEXT, direction TEXT DEFAULT 'خارج'
    );
    CREATE TABLE inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT, purchase_price REAL,
      total_meters REAL, rolls_count INTEGER, section_id INTEGER
    );
  `);
  db.prepare("INSERT INTO customers (id, name, phone, date) VALUES (1, ?, '0100', '2024-01-01')").run("عميل الأرشفة");
  db.prepare("INSERT INTO customers (id, name, phone, date) VALUES (2, ?, '0200', '2024-01-01')").run("عميل نشط");
  db.prepare("INSERT INTO suppliers_info (id, name, phone, date) VALUES (1, ?, '0300', '2024-01-01')").run("مورد الأرشفة");
  db.prepare("INSERT INTO suppliers_info (id, name, phone, date) VALUES (2, ?, '0400', '2024-01-01')").run("مورد نشط");
  db.prepare("INSERT INTO inventory (id, item_name, purchase_price, total_meters, rolls_count, section_id) VALUES (1, ?, 60, 1000, 10, 1)").run("قماش");

  const service = new AccountArchiveService(db);
  service.ensureSchema();
  return { db, service };
}

function addSale(db, { customerId = 1, customerName = "عميل الأرشفة", qty, price, paid, unitCost = 60, date = "2024-03-10" }) {
  const total = qty * price;
  db.prepare(
    `INSERT INTO sales (customer_id, customer_name, description, inventory_item_id,
       quantity, unit, price, total, paid, remaining, unit_cost, date)
     VALUES (?, ?, 'قماش', 1, ?, 'متر', ?, ?, ?, ?, ?, ?)`
  ).run(customerId, customerName, qty, price, total, paid, total - paid, unitCost, date);
}

function addPayment(db, { customerId = 1, customerName = "عميل الأرشفة", amount, date = "2024-03-11" }) {
  db.prepare(
    "INSERT INTO payments (customer_id, customer_name, amount, description, date) VALUES (?, ?, ?, 'دفعة', ?)"
  ).run(customerId, customerName, amount, date);
}

function addReturn(db, { customerId = 1, customerName = "عميل الأرشفة", qty, price, date = "2024-03-12" }) {
  db.prepare(
    `INSERT INTO returned_orders (customer_id, customer_name, description, quantity, unit, price, inventory_item_id, date)
     VALUES (?, ?, 'قماش', ?, 'متر', ?, 1, ?)`
  ).run(customerId, customerName, qty, price, date);
}

function addPurchase(db, { supplierId = 1, supplierName = "مورد الأرشفة", qty, price, paid, date = "2024-02-01" }) {
  const total = qty * price;
  db.prepare(
    `INSERT INTO suppliers (supplier_id, name, description, quantity, price, total, paid, remaining, date, unit)
     VALUES (?, ?, 'قماش', ?, ?, ?, ?, ?, ?, 'متر')`
  ).run(supplierId, supplierName, qty, price, total, paid, total - paid, date);
  db.prepare(
    `INSERT INTO supplier_transactions (supplier_name, type, description, quantity, price, total, paid, date)
     VALUES (?, 'order', 'قماش', ?, ?, ?, ?, ?)`
  ).run(supplierName, qty, price, total, paid, date);
}

function addSupplierPayment(db, { supplierId = 1, supplierName = "مورد الأرشفة", amount, date = "2024-02-05" }) {
  db.prepare(
    "INSERT INTO supplier_payments (supplier_id, supplier_name, amount, description, date) VALUES (?, ?, ?, 'دفعة', ?)"
  ).run(supplierId, supplierName, amount, date);
}

const FINANCIAL_TABLES = [
  "sales",
  "payments",
  "returned_orders",
  "suppliers",
  "supplier_payments",
  "supplier_transactions",
  "expenses",
  "inventory",
];

function snapshotFinancials(db) {
  const snapshot = {};
  for (const table of FINANCIAL_TABLES) {
    snapshot[table] = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
  }
  return JSON.stringify(snapshot);
}

function plSnapshot(db) {
  const pl = new ProfitLossService(db).calculateProfitLoss({ from: null, to: null, includeDetails: false });
  return {
    netSales: pl.netSales,
    cogs: pl.cogs,
    netCogs: pl.netCogs,
    grossProfit: pl.grossProfit,
    operatingExpenses: pl.operatingExpenses,
    otherIncome: pl.otherIncome,
    netProfit: pl.netProfit,
    collections: pl.collections,
    accountsReceivable: pl.accountsReceivable,
  };
}

function purchaseStats(db) {
  const orders = db.prepare("SELECT COALESCE(SUM(total),0) t, COALESCE(SUM(paid),0) p, COUNT(*) c FROM suppliers").get();
  const payments = db.prepare("SELECT COALESCE(SUM(amount),0) a FROM supplier_payments").get();
  return {
    purchasesTotal: Number(orders.t),
    purchasesPaid: Number(orders.p) + Number(payments.a),
    ordersCount: Number(orders.c),
  };
}

// ------------------------------------------------------------------ TEST 1

function test1() {
  const name = "TEST 1: أرشفة عميل رصيده صفر";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0 });   // 1000
  addPayment(db, { amount: 1000 });                // 1000

  const before = snapshotFinancials(db);
  const plBefore = plSnapshot(db);
  const summaryBefore = service.getCustomerAccountSummary(1);
  check(name, "الرصيد قبل الأرشفة", summaryBefore.balance, 0);

  const result = service.archiveCustomer(1);
  checkTrue(name, "تم وضع العميل في الأرشيف", result.isArchived === true);
  checkTrue(name, "تم تسجيل تاريخ الأرشفة", !!result.archivedAt);

  const active = service.listCustomers("active").map((c) => c.id);
  const archived = service.listCustomers("archived").map((c) => c.id);
  const all = service.listCustomers("all").map((c) => c.id);
  checkTrue(name, "اختفى من قائمة الحسابات النشطة", !active.includes(1));
  checkTrue(name, "ظهر في قائمة الأرشيف", archived.includes(1));
  checkTrue(name, "ما زال موجودًا في قائمة الكل", all.includes(1));
  checkTrue(name, "باقي العملاء لم يتأثروا", active.includes(2));

  const summaryAfter = service.getCustomerAccountSummary(1);
  check(name, "عدد المبيعات بعد الأرشفة", summaryAfter.salesCount, 1);
  check(name, "عدد الدفعات بعد الأرشفة", summaryAfter.paymentsCount, 1);
  check(name, "إجمالي المبيعات بعد الأرشفة", summaryAfter.salesTotal, 1000);
  check(name, "إجمالي التحصيل بعد الأرشفة", summaryAfter.collected, 1000);
  check(name, "الرصيد بعد الأرشفة", summaryAfter.balance, 0);

  const statementRows =
    db.prepare("SELECT COUNT(*) c FROM sales WHERE customer_id = 1").get().c +
    db.prepare("SELECT COUNT(*) c FROM payments WHERE customer_id = 1").get().c;
  check(name, "صفوف كشف الحساب باقية", statementRows, 2);

  checkTrue(name, "لم تتغير أي بيانات مالية", snapshotFinancials(db) === before);
  const plAfter = plSnapshot(db);
  checkTrue(
    name,
    "الأرباح والخسائر لم تتغير",
    JSON.stringify(plBefore) === JSON.stringify(plAfter),
    `${JSON.stringify(plBefore)} vs ${JSON.stringify(plAfter)}`
  );
  db.close();
}

// ------------------------------------------------------------------ TEST 2

function test2() {
  const name = "TEST 2: أرشفة مورد رصيده صفر";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addPurchase(db, { qty: 10, price: 100, paid: 0 }); // 1000
  addSupplierPayment(db, { amount: 1000 });

  const before = snapshotFinancials(db);
  const statsBefore = purchaseStats(db);
  const plBefore = plSnapshot(db);

  const summaryBefore = service.getSupplierAccountSummary(1);
  check(name, "الرصيد قبل الأرشفة", summaryBefore.balance, 0);

  const result = service.archiveSupplier(1);
  checkTrue(name, "تم وضع المورد في الأرشيف", result.isArchived === true);

  const active = service.listSuppliers("active").map((s) => s.id);
  const archived = service.listSuppliers("archived").map((s) => s.id);
  checkTrue(name, "اختفى من قائمة الموردين النشطين", !active.includes(1));
  checkTrue(name, "ظهر في أرشيف الموردين", archived.includes(1));
  checkTrue(name, "المورد الآخر لم يتأثر", active.includes(2));

  const summaryAfter = service.getSupplierAccountSummary(1);
  check(name, "عدد الأوردرات بعد الأرشفة", summaryAfter.ordersCount, 1);
  check(name, "عدد الدفعات بعد الأرشفة", summaryAfter.paymentsCount, 1);
  check(name, "إجمالي المشتريات بعد الأرشفة", summaryAfter.ordersTotal, 1000);
  check(name, "المدفوع بعد الأرشفة", summaryAfter.paid, 1000);
  check(name, "صفوف كشف حساب المورد باقية", summaryAfter.ledgerRowsCount, 1);

  const statsAfter = purchaseStats(db);
  check(name, "إحصائية المشتريات لم تتغير", statsAfter.purchasesTotal, statsBefore.purchasesTotal);
  check(name, "المدفوع للموردين لم يتغير", statsAfter.purchasesPaid, statsBefore.purchasesPaid);
  checkTrue(name, "لم تتغير أي بيانات مالية", snapshotFinancials(db) === before);
  checkTrue(
    name,
    "الأرباح والخسائر لم تتغير",
    JSON.stringify(plBefore) === JSON.stringify(plSnapshot(db))
  );
  db.close();
}

// ------------------------------------------------------------------ TEST 3

function test3() {
  const name = "TEST 3: عميل مؤرشف له عملية بيع 500 وتكلفة 300";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 5, price: 100, paid: 500, unitCost: 60 }); // total 500، تكلفة 300

  const plBefore = plSnapshot(db);
  check(name, "صافي المبيعات قبل", plBefore.netSales, 500);
  check(name, "تكلفة البضاعة قبل", plBefore.cogs, 300);
  check(name, "مجمل الربح قبل", plBefore.grossProfit, 200);

  service.archiveCustomer(1);

  const plAfter = plSnapshot(db);
  check(name, "صافي المبيعات بعد الأرشفة", plAfter.netSales, 500);
  check(name, "تكلفة البضاعة بعد الأرشفة", plAfter.cogs, 300);
  check(name, "مجمل الربح بعد الأرشفة", plAfter.grossProfit, 200);
  db.close();
}

// ------------------------------------------------------------------ TEST 4

function test4() {
  const name = "TEST 4: عميل مؤرشف بيع 500 وتحصيل 500";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 5, price: 100, paid: 0, unitCost: 60 });
  addPayment(db, { amount: 500 });

  const plBefore = plSnapshot(db);
  check(name, "الإيراد قبل", plBefore.netSales, 500);
  check(name, "التحصيل قبل", plBefore.collections, 500);
  check(name, "المستحق على العملاء قبل", plBefore.accountsReceivable, 0);

  service.archiveCustomer(1);

  const plAfter = plSnapshot(db);
  check(name, "الإيراد بعد الأرشفة", plAfter.netSales, 500);
  check(name, "التحصيل بعد الأرشفة", plAfter.collections, 500);
  check(name, "المستحق على العملاء بعد الأرشفة", plAfter.accountsReceivable, 0);
  check(name, "صافي الربح بعد الأرشفة", plAfter.netProfit, plBefore.netProfit);
  db.close();
}

// ------------------------------------------------------------------ TEST 5

function test5() {
  const name = "TEST 5: مورد مؤرشف له مشتريات 1000";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addPurchase(db, { qty: 10, price: 100, paid: 1000 });

  const before = purchaseStats(db);
  check(name, "المشتريات قبل", before.purchasesTotal, 1000);

  service.archiveSupplier(1);

  const after = purchaseStats(db);
  check(name, "المشتريات بعد الأرشفة", after.purchasesTotal, 1000);
  check(name, "عدد أوردرات الشراء بعد الأرشفة", after.ordersCount, before.ordersCount);
  check(
    name,
    "تكلفة المخزون بعد الأرشفة",
    db.prepare("SELECT COALESCE(SUM(total_meters * purchase_price),0) v FROM inventory").get().v,
    60000
  );
  db.close();
}

// ------------------------------------------------------------------ TEST 6

function test6() {
  const name = "TEST 6: عميل رصيده غير مسدد (باقي 300)";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 10, price: 100, paid: 0 }); // 1000
  addPayment(db, { amount: 700 });

  const before = snapshotFinancials(db);
  const summary = service.getCustomerAccountSummary(1);
  check(name, "الرصيد المستحق", summary.balance, 300);

  let blocked = false;
  let messageMentionsBalance = false;
  try {
    service.archiveCustomer(1);
  } catch (error) {
    blocked = error.code === "OUTSTANDING_BALANCE";
    messageMentionsBalance = String(error.message).includes("300");
  }
  checkTrue(name, "النظام رفض الأرشفة الصامتة", blocked);
  checkTrue(name, "الرسالة توضح المبلغ المتبقي", messageMentionsBalance);
  checkTrue(name, "العميل ما زال نشطًا", service.listCustomers("active").some((c) => c.id === 1));
  checkTrue(name, "لم تُحذف أو تُعدّل أي معاملة", snapshotFinancials(db) === before);
  check(name, "الرصيد لم يُعدّل ليصبح صفرًا", service.getCustomerAccountSummary(1).balance, 300);

  // أرشفة صريحة بموافقة المستخدم رغم وجود رصيد
  const forced = service.archiveCustomer(1, { allowOutstandingBalance: true });
  checkTrue(name, "الأرشفة الصريحة تعمل بعد التأكيد", forced.isArchived === true);
  check(name, "الرصيد بعد الأرشفة الصريحة كما هو", forced.balance, 300);
  checkTrue(name, "لا تغيير في البيانات المالية بعد الأرشفة الصريحة", snapshotFinancials(db) === before);
  db.close();
}

// ------------------------------------------------------------------ TEST 7

function test7() {
  const name = "TEST 7: الحذف النهائي ممنوع لحساب له معاملات";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 1, price: 100, paid: 100 });

  const summary = service.getCustomerAccountSummary(1);
  checkTrue(name, "النظام يعرف أن للحساب معاملات", summary.hasTransactions === true);
  checkTrue(name, "الحذف النهائي غير مسموح", summary.canHardDelete === false);

  const emptyCustomer = service.getCustomerAccountSummary(2);
  checkTrue(name, "حساب بدون معاملات يمكن حذفه نهائيًا", emptyCustomer.canHardDelete === true);

  const supplierWithData = (() => {
    addPurchase(db, { qty: 1, price: 100, paid: 100 });
    return service.getSupplierAccountSummary(1);
  })();
  checkTrue(name, "مورد له مشتريات لا يمكن حذفه نهائيًا", supplierWithData.canHardDelete === false);
  checkTrue(name, "مورد بدون معاملات يمكن حذفه", service.getSupplierAccountSummary(2).canHardDelete === true);
  db.close();
}

// ------------------------------------------------------------------ TEST 8

function test8() {
  const name = "TEST 8: منع تسجيل معاملة جديدة على حساب مؤرشف + الاسترجاع";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 1, price: 100, paid: 100 });
  service.archiveCustomer(1);

  let customerBlocked = false;
  try {
    service.assertCustomerActive(1, "عميل الأرشفة");
  } catch (error) {
    customerBlocked = error.code === "ARCHIVED_ACCOUNT";
  }
  checkTrue(name, "منع البيع لعميل مؤرشف", customerBlocked);

  let byNameBlocked = false;
  try {
    service.assertCustomerActive(null, "عميل الأرشفة");
  } catch (error) {
    byNameBlocked = error.code === "ARCHIVED_ACCOUNT";
  }
  checkTrue(name, "المنع يعمل بالاسم أيضًا", byNameBlocked);

  let activeAllowed = true;
  try {
    service.assertCustomerActive(2, "عميل نشط");
  } catch {
    activeAllowed = false;
  }
  checkTrue(name, "العميل النشط لم يتأثر", activeAllowed);

  service.archiveSupplier(1);
  let supplierBlocked = false;
  try {
    service.assertSupplierActive(1, "مورد الأرشفة");
  } catch (error) {
    supplierBlocked = error.code === "ARCHIVED_ACCOUNT";
  }
  checkTrue(name, "منع الشراء من مورد مؤرشف", supplierBlocked);

  const restored = service.restoreCustomer(1);
  checkTrue(name, "الاسترجاع يعيد العميل للنشطين", restored.isArchived === false);
  checkTrue(name, "تاريخ الأرشفة اتمسح بعد الاسترجاع", !restored.customer.archived_at);
  let afterRestore = true;
  try {
    service.assertCustomerActive(1, "عميل الأرشفة");
  } catch {
    afterRestore = false;
  }
  checkTrue(name, "البيع مسموح بعد الاسترجاع", afterRestore);
  check(name, "المعاملات القديمة كما هي بعد الاسترجاع", service.getCustomerAccountSummary(1).salesCount, 1);
  db.close();
}

// ------------------------------------------------------------------ TEST 9

function test9() {
  const name = "TEST 9: الهجرة آمنة ومتكررة (idempotent)";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 3, price: 100, paid: 300 });
  addPurchase(db, { qty: 2, price: 50, paid: 100 });

  const before = snapshotFinancials(db);
  const customersBefore = db.prepare("SELECT COUNT(*) c FROM customers").get().c;

  service.ensureSchema();
  service.ensureSchema();
  service.ensureSchema();

  checkTrue(name, "عمود is_active موجود للعملاء", service.columnExists("customers", "is_active"));
  checkTrue(name, "عمود archived_at موجود للعملاء", service.columnExists("customers", "archived_at"));
  checkTrue(name, "عمود is_active موجود للموردين", service.columnExists("suppliers_info", "is_active"));
  checkTrue(name, "لا تكرار ولا فقد في صفوف العملاء", db.prepare("SELECT COUNT(*) c FROM customers").get().c === customersBefore);
  checkTrue(name, "لا تغيير في البيانات المالية بعد الهجرة", snapshotFinancials(db) === before);
  check(
    name,
    "كل الحسابات القديمة نشطة افتراضيًا",
    db.prepare("SELECT COUNT(*) c FROM customers WHERE COALESCE(is_active,1) = 1").get().c,
    customersBefore
  );

  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
    .all()
    .map((r) => r.name);
  checkTrue(name, "فهرس customer_id على المبيعات موجود", indexes.includes("idx_sales_customer_id"));
  checkTrue(name, "فهرس supplier_id على الأوردرات موجود", indexes.includes("idx_supplier_orders_supplier_id"));
  db.close();
}

// ----------------------------------------------------------------- TEST 10

function test10() {
  const name = "TEST 10: الأرشفة لا تغيّر إحصائيات أو مرتجعات أو مصروفات";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 20, price: 100, paid: 500 });         // 2000
  addReturn(db, { qty: 2, price: 100 });                   // 200
  addPayment(db, { amount: 1300 });                        // 1800 محصّل
  addPurchase(db, { qty: 10, price: 50, paid: 500 });
  db.prepare("INSERT INTO expenses (category, description, amount, date, direction) VALUES ('عام','إيجار',400,'2024-03-15','خارج')").run();
  db.prepare("INSERT INTO expenses (category, description, amount, date, direction) VALUES ('عام','إيراد آخر',100,'2024-03-16','داخل')").run();

  const before = snapshotFinancials(db);
  const plBefore = plSnapshot(db);
  const purchasesBefore = purchaseStats(db);

  service.archiveCustomer(1, { allowOutstandingBalance: true });
  service.archiveSupplier(1, { allowOutstandingBalance: true });

  const plAfter = plSnapshot(db);
  for (const key of Object.keys(plBefore)) {
    check(name, `${key} لم يتغير`, plAfter[key], plBefore[key]);
  }
  check(name, "المشتريات لم تتغير", purchaseStats(db).purchasesTotal, purchasesBefore.purchasesTotal);
  checkTrue(name, "ولا صف مالي واحد اتغير", snapshotFinancials(db) === before);
  check(name, "المرتجعات باقية", db.prepare("SELECT COUNT(*) c FROM returned_orders").get().c, 1);
  check(name, "المصروفات باقية", db.prepare("SELECT COUNT(*) c FROM expenses").get().c, 2);
  db.close();
}

// ----------------------------------------------------------------- TEST 11

function test11() {
  const name = "TEST 11: الخدمة لا تكتب إلا في أعمدة الأرشفة";
  console.log(`\n${name}`);
  const { db, service } = createDb();
  addSale(db, { qty: 4, price: 100, paid: 400 });

  const customerBefore = db.prepare("SELECT * FROM customers WHERE id = 1").get();
  service.archiveCustomer(1);
  const customerAfter = db.prepare("SELECT * FROM customers WHERE id = 1").get();

  const changedColumns = Object.keys(customerAfter).filter(
    (key) => JSON.stringify(customerAfter[key]) !== JSON.stringify(customerBefore[key])
  );
  checkTrue(
    name,
    "الأعمدة المتغيرة هي is_active و archived_at فقط",
    changedColumns.every((c) => c === "is_active" || c === "archived_at"),
    `changed: ${changedColumns.join(", ")}`
  );

  const source = require("fs").readFileSync(require("path").join(__dirname, "..", "server", "accountArchive.js"), "utf8");
  checkTrue(name, "ملف الخدمة لا يحتوي على DELETE FROM", !/DELETE\s+FROM/i.test(source));
  checkTrue(name, "ملف الخدمة لا يحتوي على DROP", !/\bDROP\s+(TABLE|COLUMN|INDEX)/i.test(source));
  const updates = source.match(/UPDATE\s+\$\{?\w+\}?\s+SET\s+[^\n]*/gi) || [];
  checkTrue(
    name,
    "كل جمل UPDATE تخص أعمدة الأرشفة فقط",
    updates.every((u) => /is_active/.test(u) && !/(total|paid|amount|price|quantity)\s*=/.test(u)),
    updates.join(" | ")
  );
  db.close();
}

// --------------------------------------------------------------------- run

console.log("اختبارات أرشفة حسابات العملاء والموردين (قاعدة بيانات في الذاكرة)");
[test1, test2, test3, test4, test5, test6, test7, test8, test9, test10, test11].forEach((fn) => fn());

console.log("\n=======================================");
console.log(`إجمالي الناجح: ${passed}`);
console.log(`إجمالي الفاشل: ${failed}`);
if (failures.length) {
  console.log("\nالفشل:");
  failures.forEach((f) => console.log(" - " + f));
}
console.log("=======================================");
process.exit(failed === 0 ? 0 : 1);
