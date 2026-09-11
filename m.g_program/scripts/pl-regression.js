"use strict";

/**
 * اختبار انحدار على نسخة من قاعدة البيانات الحقيقية.
 * يتم العمل على ملف منسوخ داخل _pl_audit فقط — قاعدة البيانات الإنتاجية
 * لا تُفتح للكتابة ولا تتغير.
 *
 * الاستخدام: node scripts/pl-regression.js
 */

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const ProfitLossService = require("../server/profitLoss");

const prodPath = path.join(
  process.env.APPDATA || "",
  "mg-fabric-store",
  "mg_fabric.db"
);
const workDir = path.join(__dirname, "..", "_pl_audit");
const workPath = path.join(workDir, "regression-copy.db");

if (!fs.existsSync(prodPath)) {
  console.error("قاعدة البيانات الإنتاجية غير موجودة:", prodPath);
  process.exit(1);
}
fs.mkdirSync(workDir, { recursive: true });
fs.copyFileSync(prodPath, workPath);

const db = new DatabaseSync(workPath);
const service = new ProfitLossService(db);

let passed = 0;
let failed = 0;
const check = (label, actual, expected, tol = 0.02) => {
  const ok = Math.abs(Number(actual) - Number(expected)) <= tol;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
};

const TODAY = new Date().toISOString().split("T")[0];
const range = { from: null, to: null };
const snap = () => service.calculateProfitLoss({ ...range, includeDetails: false });

// عميل وصنف جديدان داخل النسخة فقط، حتى تكون النتائج حاسمة
// ولا تتأثر بأرصدة دائنة أو مرتجعات سابقة لبيانات قائمة.
db.prepare("INSERT INTO customers (name, phone) VALUES (?, ?)").run(
  "عميل اختبار الانحدار",
  "000"
);
const customer = db
  .prepare("SELECT id, name FROM customers WHERE name = ? ORDER BY id DESC LIMIT 1")
  .get("عميل اختبار الانحدار");
db.prepare(
  "INSERT INTO inventory (item_name, purchase_price, total_meters, rolls_count) VALUES (?, 60, 1000, 10)"
).run("صنف اختبار الانحدار");
const item = db
  .prepare("SELECT id FROM inventory WHERE item_name = ? ORDER BY id DESC LIMIT 1")
  .get("صنف اختبار الانحدار");

// عميل قائم لديه رصيد دائن (تحصيلات تفوق فواتيره) لاختبار التخصيص
const creditCustomer = db
  .prepare(
    `SELECT c.id, c.name,
            COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.customer_id = c.id), 0)
              - COALESCE((SELECT SUM(ro.quantity*ro.price) FROM returned_orders ro WHERE ro.customer_id = c.id), 0)
              AS owed,
            COALESCE((SELECT SUM(s.paid) FROM sales s WHERE s.customer_id = c.id), 0)
              + COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.customer_id = c.id), 0)
              AS collected
       FROM customers c
      ORDER BY (collected - owed) DESC
      LIMIT 1`
  )
  .get();

console.log("=".repeat(72));
console.log("REGRESSION على نسخة من قاعدة البيانات الحقيقية");
console.log("=".repeat(72));
console.log("النسخة:", workPath);
console.log("عميل الاختبار:", customer?.name, "| صنف:", item?.id, "\n");

const before = snap();
console.log("قبل أي إضافة:");
console.log(
  `  netSales=${before.netSales} netCogs=${before.netCogs} grossProfit=${before.grossProfit} netProfit=${before.netProfit} AR=${before.accountsReceivable} collections=${before.collections}`
);

// 1) إضافة عملية بيع
console.log("\n1) إضافة عملية بيع 1000 (تكلفة 600، مدفوع 0)");
db.prepare(
  `INSERT INTO sales (customer_id, customer_name, description, inventory_item_id,
                      quantity, unit, price, total, paid, remaining, unit_cost, date)
   VALUES (?, ?, 'اختبار انحدار', ?, 10, 'متر', 100, 1000, 0, 1000, 60, ?)`
).run(customer.id, customer.name, item.id, TODAY);
let after = snap();
check("صافي المبيعات +1000", after.netSales - before.netSales, 1000);
check("COGS +600", after.cogs - before.cogs, 600);
// إضافة بيع بتكلفة معلومة تغيّر نسبة التكلفة الموثوقة قليلاً، وهذه النسبة
// تُستخدم فقط لتقدير تكلفة المرتجعات غير المرتبطة بصنف؛ لذا يُحتسب هذا الأثر
// صراحةً بدل تجاهله أو إخفائه.
const estRipple1 = after.estimatedReturnedCogs - before.estimatedReturnedCogs;
console.log(`     (أثر تغيّر نسبة التكلفة على تقدير المرتجعات غير المرتبطة: ${estRipple1.toFixed(2)})`);
check("الربح الإجمالي +400", after.grossProfit - before.grossProfit, 400 + estRipple1);
check("صافي الربح +400", after.netProfit - before.netProfit, 400 + estRipple1);
check("المديونيات +1000 (عميل بلا رصيد دائن)", after.accountsReceivable - before.accountsReceivable, 1000);
check("التحصيلات بدون تغيير", after.collections - before.collections, 0);
const afterSale = after;

// 1ب) فاتورة لعميل لديه رصيد دائن: تُخصم من الرصيد الدائن ولا تزيد المديونية
console.log(
  `\n1ب) فاتورة 1000 لعميل لديه رصيد دائن (${creditCustomer?.name}): الرصيد الدائن يُستهلك`
);
db.prepare(
  `INSERT INTO sales (customer_id, customer_name, description, inventory_item_id,
                      quantity, unit, price, total, paid, remaining, unit_cost, date)
   VALUES (?, ?, 'اختبار انحدار رصيد دائن', ?, 10, 'متر', 100, 1000, 0, 1000, 60, ?)`
).run(creditCustomer.id, creditCustomer.name, item.id, TODAY);
let afterCredit = snap();
check("صافي المبيعات +1000", afterCredit.netSales - afterSale.netSales, 1000);
const estRipple2 = afterCredit.estimatedReturnedCogs - afterSale.estimatedReturnedCogs;
check("صافي الربح +400", afterCredit.netProfit - afterSale.netProfit, 400 + estRipple2);
check(
  "التحصيلات غير المخصّصة -1000 (استُهلكت في الفاتورة)",
  afterCredit.unallocatedCollections - afterSale.unallocatedCollections,
  -1000
);
check(
  "التحصيلات المخصّصة +1000",
  afterCredit.allocatedCollections - afterSale.allocatedCollections,
  1000
);
check(
  "المديونيات بدون تغيير (الفاتورة مغطاة برصيد دائن)",
  afterCredit.accountsReceivable - afterSale.accountsReceivable,
  0
);
check(
  "إجمالي التحصيلات لم يتغير بإضافة فاتورة",
  afterCredit.collections - afterSale.collections,
  0
);
after = afterCredit;

// 2) إضافة دفعة
console.log("\n2) إضافة دفعة 500 من عميل الاختبار");
const beforePayment = after;
db.prepare(
  `INSERT INTO payments (customer_id, customer_name, amount, description, date)
   VALUES (?, ?, 500, 'اختبار انحدار', ?)`
).run(customer.id, customer.name, TODAY);
after = snap();
check("صافي المبيعات بدون تغيير", after.netSales - beforePayment.netSales, 0);
check("صافي الربح بدون تغيير (الدفعة ليست إيراداً)", after.netProfit - beforePayment.netProfit, 0);
check("التحصيلات +500", after.collections - beforePayment.collections, 500);
check("المديونيات -500", after.accountsReceivable - beforePayment.accountsReceivable, -500);
const afterPayment = after;

// 3) إضافة مرتجع
console.log("\n3) إضافة مرتجع 2 متر بسعر 100 لنفس الصنف");
db.prepare(
  `INSERT INTO returned_orders (customer_id, customer_name, description, quantity,
                                unit, price, inventory_item_id, date)
   VALUES (?, ?, 'اختبار انحدار', 2, 'متر', 100, ?, ?)`
).run(customer.id, customer.name, item.id, TODAY);
after = snap();
check("مرتجعات المبيعات +200", after.salesReturns - afterPayment.salesReturns, 200);
check("صافي المبيعات -200", after.netSales - afterPayment.netSales, -200);
check(
  "تكلفة المرتجع زادت (تُخصم من التكلفة)",
  after.returnedCogs > afterPayment.returnedCogs ? 1 : 0,
  1
);
check(
  "الربح الإجمالي = صافي المبيعات - صافي التكلفة",
  after.grossProfit,
  after.netSales - after.netCogs
);
const afterReturn = after;

// 4) إضافة مصروف تشغيلي وإيراد آخر
console.log("\n4) إضافة مصروف تشغيلي 300 وإيراد آخر 100");
db.prepare(
  "INSERT INTO expenses (category, description, amount, date, direction) VALUES ('اختبار','انحدار',300,?, 'خارج')"
).run(TODAY);
db.prepare(
  "INSERT INTO expenses (category, description, amount, date, direction) VALUES ('اختبار','انحدار',100,?, 'داخل')"
).run(TODAY);
after = snap();
check("المصروفات التشغيلية +300", after.operatingExpenses - afterReturn.operatingExpenses, 300);
check("الإيرادات الأخرى +100", after.otherIncome - afterReturn.otherIncome, 100);
check("صافي الربح -200", after.netProfit - afterReturn.netProfit, -200);

// 5) تماسك المعادلات بعد كل التغييرات
console.log("\n5) تماسك المعادلات بعد كل الحركات");
check("Net Sales = Gross - Returns", after.netSales, after.grossSales - after.salesReturns);
check("Net COGS = COGS - Returned COGS", after.netCogs, after.cogs - after.returnedCogs);
check("Gross Profit = Net Sales - Net COGS", after.grossProfit, after.netSales - after.netCogs);
check(
  "Net Profit = Gross Profit - OpEx + Other Income",
  after.netProfit,
  after.grossProfit - after.operatingExpenses + after.otherIncome
);
check(
  "Collections = Allocated + Unallocated",
  after.collections,
  after.allocatedCollections + after.unallocatedCollections
);

// 6) فلاتر الفترات
console.log("\n6) فلاتر الفترات");
const todayPl = service.calculateProfitLoss({ from: TODAY, to: TODAY, includeDetails: false });
check("فترة اليوم: صافي المبيعات يشمل عملية الاختبار", todayPl.netSales >= 800 ? 1 : 0, 1);
const emptyPl = service.calculateProfitLoss({
  from: "1990-01-01",
  to: "1990-12-31",
  includeDetails: false,
});
check("فترة بلا حركات: صافي المبيعات = 0", emptyPl.netSales, 0);
check("فترة بلا حركات: صافي الربح = 0", emptyPl.netProfit, 0);
check("فترة بلا حركات: التحصيلات = 0", emptyPl.collections, 0);

// 7) سلامة قاعدة البيانات الإنتاجية
console.log("\n7) سلامة قاعدة البيانات الإنتاجية");
db.close();
const prod = new DatabaseSync(prodPath, { readOnly: true });
const prodSales = prod.prepare("SELECT COUNT(*) c, COALESCE(SUM(total),0) t FROM sales").get();
const prodPayments = prod.prepare("SELECT COUNT(*) c, COALESCE(SUM(amount),0) t FROM payments").get();
const prodReturns = prod.prepare("SELECT COUNT(*) c FROM returned_orders").get();
const prodExpenses = prod.prepare("SELECT COUNT(*) c FROM expenses").get();
console.log(
  `  الإنتاج: sales=${prodSales.c} (${prodSales.t}) payments=${prodPayments.c} (${prodPayments.t}) returns=${prodReturns.c} expenses=${prodExpenses.c}`
);
check("عدد المبيعات في الإنتاج لم يتغير (117)", prodSales.c, 117);
check("عدد الدفعات في الإنتاج لم يتغير (89)", prodPayments.c, 89);
check("عدد المرتجعات في الإنتاج لم يتغير (11)", prodReturns.c, 11);
check("عدد المصروفات في الإنتاج لم يتغير (48)", prodExpenses.c, 48);
prod.close();

fs.unlinkSync(workPath);

console.log("\n" + "=".repeat(72));
console.log(`REGRESSION RESULT: ${passed} passed, ${failed} failed`);
console.log("=".repeat(72));
process.exit(failed === 0 ? 0 : 1);
