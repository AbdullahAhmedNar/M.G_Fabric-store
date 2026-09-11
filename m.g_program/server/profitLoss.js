"use strict";

/**
 * ProfitLossService
 *
 * طبقة حساب الأرباح والخسائر على أساس الاستحقاق (Accrual Basis).
 *
 * قواعد ثابتة:
 * - الإيراد = المبيعات (sales.total) وليس التحصيل.
 * - التحصيلات (sales.paid + payments.amount) لا تدخل معادلة صافي الربح إطلاقاً.
 * - تكلفة البضاعة المباعة لا تتأثر بنسبة التحصيل.
 * - الخدمة للقراءة فقط: لا تنفّذ INSERT/UPDATE/DELETE على أي جدول.
 */

const ROUND = 2;

function round(value) {
  const n = Number(value) || 0;
  const factor = Math.pow(10, ROUND);
  return Math.round(n * factor) / factor;
}

function safeDivide(numerator, denominator) {
  const d = Number(denominator) || 0;
  if (d === 0) return null;
  return Number(numerator) / d;
}

class ProfitLossService {
  /**
   * @param {object} db كائن قاعدة بيانات يوفر prepare().get()/all() (better-sqlite3 أو متوافق)
   */
  constructor(db) {
    this.db = db;
  }

  // ---------------------------------------------------------------- utilities

  tableExists(tableName) {
    try {
      const row = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        )
        .get(tableName);
      return !!row;
    } catch {
      return false;
    }
  }

  columnExists(tableName, columnName) {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM pragma_table_info(?)`)
        .all(tableName);
      return rows.some((r) => r.name === columnName);
    } catch {
      return false;
    }
  }

  /**
   * شرط الفترة الزمنية على عمود تاريخ نصي بصيغة YYYY-MM-DD.
   * from/to اختياريان: null يعني بدون حد.
   */
  periodClause(dateExpr, from, to) {
    const parts = [];
    const params = [];
    if (from) {
      parts.push(`date(${dateExpr}) >= date(?)`);
      params.push(from);
    }
    if (to) {
      parts.push(`date(${dateExpr}) <= date(?)`);
      params.push(to);
    }
    return {
      sql: parts.length ? ` AND ${parts.join(" AND ")}` : "",
      params,
    };
  }

  get(sql, params = []) {
    return this.db.prepare(sql).get(...params) || {};
  }

  all(sql, params = []) {
    return this.db.prepare(sql).all(...params) || [];
  }

  // ------------------------------------------------------------------ revenue

  /** إجمالي المبيعات خلال الفترة (أساس استحقاق) */
  calculateRevenue({ from = null, to = null } = {}) {
    if (!this.tableExists("sales")) {
      return { grossSales: 0, salesCount: 0 };
    }
    const p = this.periodClause("s.date", from, to);
    const row = this.get(
      `SELECT COALESCE(SUM(s.total), 0) AS total, COUNT(*) AS count
       FROM sales s WHERE 1=1${p.sql}`,
      p.params
    );
    return {
      grossSales: Number(row.total) || 0,
      salesCount: Number(row.count) || 0,
    };
  }

  /** إجمالي المرتجعات خلال الفترة */
  calculateReturns({ from = null, to = null } = {}) {
    if (!this.tableExists("returned_orders")) {
      return { salesReturns: 0, returnsCount: 0 };
    }
    const p = this.periodClause("ro.date", from, to);
    const row = this.get(
      `SELECT COALESCE(SUM(ro.quantity * ro.price), 0) AS total, COUNT(*) AS count
       FROM returned_orders ro WHERE 1=1${p.sql}`,
      p.params
    );
    return {
      salesReturns: Number(row.total) || 0,
      returnsCount: Number(row.count) || 0,
    };
  }

  // --------------------------------------------------------------------- cogs

  /**
   * تكلفة البضاعة المباعة من التكلفة المسجّلة وقت البيع (sales.unit_cost).
   * لا تُستخدم أسعار الشراء الحالية حتى لا يتغير التاريخ المحاسبي.
   */
  calculateCOGS({ from = null, to = null } = {}) {
    if (!this.tableExists("sales") || !this.columnExists("sales", "unit_cost")) {
      return {
        cogs: 0,
        salesWithCostCount: 0,
        salesValueWithCost: 0,
        missingCostCount: 0,
        missingCostSalesValue: 0,
      };
    }

    const p = this.periodClause("s.date", from, to);

    const withCost = this.get(
      `SELECT COALESCE(SUM(s.unit_cost * s.quantity), 0) AS cost,
              COALESCE(SUM(s.total), 0) AS sales_value,
              COUNT(*) AS count
       FROM sales s
       WHERE s.unit_cost > 0 AND s.quantity > 0${p.sql}`,
      p.params
    );

    const missing = this.get(
      `SELECT COUNT(*) AS count, COALESCE(SUM(s.total), 0) AS sales_value
       FROM sales s
       WHERE (s.unit_cost IS NULL OR s.unit_cost <= 0)
         AND COALESCE(s.total, 0) <> 0${p.sql}`,
      p.params
    );

    return {
      cogs: Number(withCost.cost) || 0,
      salesWithCostCount: Number(withCost.count) || 0,
      salesValueWithCost: Number(withCost.sales_value) || 0,
      missingCostCount: Number(missing.count) || 0,
      missingCostSalesValue: Number(missing.sales_value) || 0,
    };
  }

  /** قائمة المبيعات بدون تكلفة مسجّلة (للتدقيق فقط، بدون أي تعديل) */
  listMissingCostSales({ from = null, to = null, limit = 100 } = {}) {
    if (!this.tableExists("sales") || !this.columnExists("sales", "unit_cost")) {
      return [];
    }
    const p = this.periodClause("s.date", from, to);
    return this.all(
      `SELECT s.id, s.date, s.customer_name, s.description, s.quantity,
              s.price, s.total, s.inventory_item_id
       FROM sales s
       WHERE (s.unit_cost IS NULL OR s.unit_cost <= 0)
         AND COALESCE(s.total, 0) <> 0${p.sql}
       ORDER BY date(s.date) DESC, s.id DESC
       LIMIT ${Number(limit) || 100}`,
      p.params
    );
  }

  /**
   * تكلفة البضاعة المرتجعة.
   *
   * ترتيب الأولويات لكل سطر مرتجع:
   * 1) الكمية × تكلفة الوحدة التاريخية الفعلية لنفس الصنف
   *    (تُستخدم فقط إذا كان سعر الوحدة المسجّل في المرتجع متوافقاً مع سعر بيع
   *     الصنف تاريخياً، أي أن الكمية والسعر في السطر متماسكان).
   * 2) قيمة المرتجع × نسبة التكلفة التاريخية الفعلية لنفس الصنف
   *    (تُستخدم عندما يكون سطر المرتجع مسجّلاً بسعر وحدة غير متوافق مع تاريخ
   *     الصنف، فلا يمكن الاعتماد على الكمية؛ ومع ذلك التكلفة تبقى مشتقّة من
   *     تكلفة الصنف الحقيقية وليست تقديراً عاماً). يُرفع تحذير بذلك.
   * 3) قيمة المرتجع × نسبة التكلفة العامة الموثوقة — تقدير صريح ومُعلَن
   *    (فقط عند عدم وجود أي ربط بصنف أو أي تكلفة تاريخية له).
   */
  calculateReturnedCOGS({ from = null, to = null } = {}, fallbackCostRatio = 0) {
    const empty = {
      returnedCogs: 0,
      actualReturnedCogs: 0,
      estimatedReturnedCogs: 0,
      estimatedReturnsCount: 0,
      actualReturnsCount: 0,
      itemRatioReturnedCogs: 0,
      itemRatioReturnsCount: 0,
      mismatchedUnitPriceCount: 0,
    };
    if (!this.tableExists("returned_orders")) return empty;

    const hasUnitCost = this.columnExists("sales", "unit_cost");
    const hasInventoryLink = this.columnExists(
      "returned_orders",
      "inventory_item_id"
    );

    const p = this.periodClause("ro.date", from, to);

    const histCostExpr =
      hasUnitCost && hasInventoryLink
        ? `COALESCE(
             (SELECT CASE WHEN SUM(s.quantity) > 0
                          THEN SUM(s.unit_cost * s.quantity) / SUM(s.quantity) END
                FROM sales s
               WHERE s.unit_cost > 0 AND s.quantity > 0
                 AND s.inventory_item_id = ro.inventory_item_id
                 AND date(s.date) <= date(ro.date)),
             (SELECT CASE WHEN SUM(s.quantity) > 0
                          THEN SUM(s.unit_cost * s.quantity) / SUM(s.quantity) END
                FROM sales s
               WHERE s.unit_cost > 0 AND s.quantity > 0
                 AND s.inventory_item_id = ro.inventory_item_id)
           )`
        : `NULL`;

    const histPriceExpr = hasInventoryLink
      ? `(SELECT CASE WHEN SUM(s.quantity) > 0
                      THEN SUM(s.total) / SUM(s.quantity) END
            FROM sales s
           WHERE s.quantity > 0
             AND s.inventory_item_id = ro.inventory_item_id)`
      : `NULL`;

    const histRatioExpr =
      hasUnitCost && hasInventoryLink
        ? `(SELECT CASE WHEN SUM(s.total) > 0
                        THEN SUM(s.unit_cost * s.quantity) / SUM(s.total) END
              FROM sales s
             WHERE s.unit_cost > 0 AND s.quantity > 0
               AND s.inventory_item_id = ro.inventory_item_id)`
        : `NULL`;

    const rows = this.all(
      `SELECT ro.id,
              COALESCE(ro.quantity, 0) AS quantity,
              COALESCE(ro.price, 0) AS price,
              ${histCostExpr} AS hist_unit_cost,
              ${histPriceExpr} AS hist_unit_price,
              ${histRatioExpr} AS hist_cost_ratio
       FROM returned_orders ro
       WHERE 1=1${p.sql}`,
      p.params
    );

    // حد التوافق بين سعر الوحدة في المرتجع وسعر البيع التاريخي للصنف
    const PRICE_TOLERANCE = 0.4;

    let actualFromQuantity = 0;
    let actualFromItemRatio = 0;
    let estimated = 0;
    let actualCount = 0;
    let itemRatioCount = 0;
    let estimatedCount = 0;
    let mismatchedUnitPriceCount = 0;

    const num = (v) => (v == null ? null : Number(v));

    for (const r of rows) {
      const qty = Number(r.quantity) || 0;
      const price = Number(r.price) || 0;
      const returnValue = qty * price;
      const unitCost = num(r.hist_unit_cost);
      const histPrice = num(r.hist_unit_price);
      const costRatio = num(r.hist_cost_ratio);

      const hasUsableUnitCost =
        unitCost != null && Number.isFinite(unitCost) && unitCost > 0;
      const priceIsConsistent =
        price > 0 &&
        histPrice != null &&
        Number.isFinite(histPrice) &&
        histPrice > 0 &&
        Math.abs(price - histPrice) / histPrice <= PRICE_TOLERANCE;

      if (hasUsableUnitCost && priceIsConsistent) {
        actualFromQuantity += qty * unitCost;
        actualCount += 1;
        continue;
      }

      if (hasUsableUnitCost && !priceIsConsistent) {
        mismatchedUnitPriceCount += 1;
      }

      if (
        costRatio != null &&
        Number.isFinite(costRatio) &&
        costRatio > 0 &&
        returnValue !== 0
      ) {
        actualFromItemRatio += returnValue * costRatio;
        itemRatioCount += 1;
        continue;
      }

      if (returnValue !== 0) {
        estimated += returnValue * (Number(fallbackCostRatio) || 0);
        estimatedCount += 1;
      }
    }

    return {
      returnedCogs: actualFromQuantity + actualFromItemRatio + estimated,
      actualReturnedCogs: actualFromQuantity,
      itemRatioReturnedCogs: actualFromItemRatio,
      estimatedReturnedCogs: estimated,
      actualReturnsCount: actualCount,
      itemRatioReturnsCount: itemRatioCount,
      estimatedReturnsCount: estimatedCount,
      mismatchedUnitPriceCount,
    };
  }

  calculateGrossProfit(netSales, netCogs) {
    return (Number(netSales) || 0) - (Number(netCogs) || 0);
  }

  // ----------------------------------------------------- expenses/other income

  /** المصروفات التشغيلية: expenses.direction = 'خارج' */
  calculateExpenses({ from = null, to = null } = {}) {
    if (!this.tableExists("expenses")) {
      return { operatingExpenses: 0, expensesCount: 0 };
    }
    const hasDirection = this.columnExists("expenses", "direction");
    const p = this.periodClause("e.date", from, to);
    const directionFilter = hasDirection
      ? `AND (e.direction IS NULL OR TRIM(e.direction) <> 'داخل')`
      : "";
    const row = this.get(
      `SELECT COALESCE(SUM(e.amount), 0) AS total, COUNT(*) AS count
       FROM expenses e WHERE 1=1 ${directionFilter}${p.sql}`,
      p.params
    );
    return {
      operatingExpenses: Number(row.total) || 0,
      expensesCount: Number(row.count) || 0,
    };
  }

  /** الإيرادات الأخرى: expenses.direction = 'داخل' (دخل وليس مصروف) */
  calculateOtherIncome({ from = null, to = null } = {}) {
    if (!this.tableExists("expenses") || !this.columnExists("expenses", "direction")) {
      return { otherIncome: 0, otherIncomeCount: 0 };
    }
    const p = this.periodClause("e.date", from, to);
    const row = this.get(
      `SELECT COALESCE(SUM(e.amount), 0) AS total, COUNT(*) AS count
       FROM expenses e WHERE TRIM(e.direction) = 'داخل'${p.sql}`,
      p.params
    );
    return {
      otherIncome: Number(row.total) || 0,
      otherIncomeCount: Number(row.count) || 0,
    };
  }

  /** بنود مصروفات غير مصنّفة (تُعامل كتشغيلية افتراضياً مع تحذير) */
  countUnclassifiedExpenses({ from = null, to = null } = {}) {
    if (!this.tableExists("expenses") || !this.columnExists("expenses", "direction")) {
      return { count: 0, total: 0 };
    }
    const p = this.periodClause("e.date", from, to);
    const row = this.get(
      `SELECT COUNT(*) AS count, COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       WHERE (e.direction IS NULL OR TRIM(e.direction) NOT IN ('داخل','خارج'))${p.sql}`,
      p.params
    );
    return { count: Number(row.count) || 0, total: Number(row.total) || 0 };
  }

  calculateNetProfit(grossProfit, operatingExpenses, otherIncome) {
    return (
      (Number(grossProfit) || 0) -
      (Number(operatingExpenses) || 0) +
      (Number(otherIncome) || 0)
    );
  }

  // -------------------------------------------------------------- collections

  /**
   * التحصيلات النقدية خلال الفترة (ليست إيراداً).
   * تشمل: sales.paid (دفعات على الأوردر) + payments.amount (دفعات منفصلة).
   */
  calculateCollections({ from = null, to = null } = {}) {
    let fromSales = 0;
    let fromPayments = 0;
    let paymentsCount = 0;

    if (this.tableExists("sales")) {
      const p = this.periodClause("s.date", from, to);
      const row = this.get(
        `SELECT COALESCE(SUM(s.paid), 0) AS total
         FROM sales s WHERE 1=1${p.sql}`,
        p.params
      );
      fromSales = Number(row.total) || 0;
    }

    if (this.tableExists("payments")) {
      const p = this.periodClause("pay.date", from, to);
      const row = this.get(
        `SELECT COALESCE(SUM(pay.amount), 0) AS total, COUNT(*) AS count
         FROM payments pay WHERE 1=1${p.sql}`,
        p.params
      );
      fromPayments = Number(row.total) || 0;
      paymentsCount = Number(row.count) || 0;
    }

    return {
      collections: fromSales + fromPayments,
      collectionsFromSaleOrders: fromSales,
      collectionsFromSeparatePayments: fromPayments,
      paymentsCount,
    };
  }

  /**
   * توزيع التحصيلات على كل عميل حتى تاريخ معين (asOf) لاستخراج:
   * - Allocated Collections: ما يقابل مبيعات فعلية (لا يمكن تخصيص نقد أكثر من قيمة الفواتير)
   * - Unallocated Collections / Customer Credit: الزائد عن الفواتير
   * - Accounts Receivable: الفواتير غير المحصّلة
   *
   * المنطق مطابق لمنطق كشف حساب العميل الموجود بالنظام
   * (المستحق = المبيعات − المرتجعات، الرصيد = المستحق − المدفوع).
   */
  calculateAccountsReceivable({ asOf = null } = {}) {
    if (!this.tableExists("sales")) {
      return {
        accountsReceivable: 0,
        allocatedCollections: 0,
        unallocatedCollections: 0,
        customersWithCredit: 0,
        customersWithReceivable: 0,
        unlinkedCollections: 0,
        customerBreakdownCount: 0,
      };
    }

    const hasPayments = this.tableExists("payments");
    const hasReturns = this.tableExists("returned_orders");

    const keyExpr = (alias) =>
      `CASE WHEN ${alias}.customer_id IS NOT NULL THEN 'id:' || ${alias}.customer_id
            ELSE 'name:' || LOWER(TRIM(COALESCE(${alias}.customer_name, ''))) END`;

    const salesRange = this.periodClause("s.date", null, asOf);
    const parts = [];
    const params = [];

    parts.push(`SELECT ${keyExpr("s")} AS ckey,
                       COALESCE(s.total, 0) AS sale_total,
                       0 AS return_total,
                       COALESCE(s.paid, 0) AS collected
                FROM sales s WHERE 1=1${salesRange.sql}`);
    params.push(...salesRange.params);

    if (hasReturns) {
      const r = this.periodClause("ro.date", null, asOf);
      parts.push(`SELECT ${keyExpr("ro")} AS ckey,
                         0 AS sale_total,
                         COALESCE(ro.quantity, 0) * COALESCE(ro.price, 0) AS return_total,
                         0 AS collected
                  FROM returned_orders ro WHERE 1=1${r.sql}`);
      params.push(...r.params);
    }

    if (hasPayments) {
      const pay = this.periodClause("pay.date", null, asOf);
      parts.push(`SELECT ${keyExpr("pay")} AS ckey,
                         0 AS sale_total,
                         0 AS return_total,
                         COALESCE(pay.amount, 0) AS collected
                  FROM payments pay WHERE 1=1${pay.sql}`);
      params.push(...pay.params);
    }

    const rows = this.all(
      `SELECT ckey,
              SUM(sale_total) AS sales_total,
              SUM(return_total) AS returns_total,
              SUM(collected) AS collected
       FROM (${parts.join(" UNION ALL ")})
       GROUP BY ckey`,
      params
    );

    let accountsReceivable = 0;
    let allocatedCollections = 0;
    let unallocatedCollections = 0;
    let customersWithCredit = 0;
    let customersWithReceivable = 0;
    let unlinkedCollections = 0;

    for (const row of rows) {
      const netOwed =
        (Number(row.sales_total) || 0) - (Number(row.returns_total) || 0);
      const collected = Number(row.collected) || 0;

      // لا يمكن تخصيص نقد أكثر من قيمة ما تم بيعه فعلاً لهذا العميل
      const allocated = Math.max(0, Math.min(netOwed, collected));
      const unallocated = collected - allocated;
      const receivable = netOwed - allocated;

      allocatedCollections += allocated;
      if (unallocated > 0) {
        unallocatedCollections += unallocated;
        customersWithCredit += 1;
      }
      if (receivable > 0) {
        accountsReceivable += receivable;
        customersWithReceivable += 1;
      }

      const key = String(row.ckey || "");
      if (key === "name:" || key === "name" || key === "name:null") {
        unlinkedCollections += collected;
      }
    }

    return {
      accountsReceivable,
      allocatedCollections,
      unallocatedCollections,
      customersWithCredit,
      customersWithReceivable,
      unlinkedCollections,
      customerBreakdownCount: rows.length,
    };
  }

  // ------------------------------------------------------------ data integrity

  /** دفعات لا يمكن ربطها بعميل معروف */
  findPaymentsWithoutRelation({ from = null, to = null, limit = 50 } = {}) {
    if (!this.tableExists("payments")) return { count: 0, total: 0, samples: [] };
    const p = this.periodClause("pay.date", from, to);
    const hasCustomers = this.tableExists("customers");
    const unlinked = hasCustomers
      ? `(pay.customer_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM customers c
                            WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(COALESCE(pay.customer_name,'')))))`
      : `pay.customer_id IS NULL`;

    const agg = this.get(
      `SELECT COUNT(*) AS count, COALESCE(SUM(pay.amount),0) AS total
       FROM payments pay WHERE ${unlinked}${p.sql}`,
      p.params
    );
    const samples = this.all(
      `SELECT pay.id, pay.date, pay.customer_name, pay.amount, pay.description
       FROM payments pay WHERE ${unlinked}${p.sql}
       ORDER BY date(pay.date) DESC, pay.id DESC
       LIMIT ${Number(limit) || 50}`,
      p.params
    );
    return {
      count: Number(agg.count) || 0,
      total: Number(agg.total) || 0,
      samples,
    };
  }

  /**
   * كشف الدفعات المكرّرة المحتملة (بدون أي حذف أو خصم):
   * 1) نفس العميل + نفس المبلغ + نفس التاريخ داخل جدول payments.
   * 2) دفعة منفصلة تطابق قيمة sales.paid لنفس العميل ونفس التاريخ
   *    (احتمال تسجيل نفس السداد مرتين).
   */
  findPotentialDuplicatePayments({ from = null, to = null, limit = 50 } = {}) {
    const result = {
      withinPaymentsCount: 0,
      withinPaymentsAmount: 0,
      againstSalePaidCount: 0,
      againstSalePaidAmount: 0,
      samples: [],
    };
    if (!this.tableExists("payments")) return result;

    const p = this.periodClause("pay.date", from, to);
    const groups = this.all(
      `SELECT LOWER(TRIM(COALESCE(pay.customer_name,''))) AS customer,
              pay.customer_id AS customer_id,
              date(pay.date) AS pay_date,
              pay.amount AS amount,
              COUNT(*) AS occurrences
       FROM payments pay
       WHERE COALESCE(pay.amount,0) <> 0${p.sql}
       GROUP BY customer, pay.customer_id, pay_date, pay.amount
       HAVING COUNT(*) > 1
       ORDER BY (COUNT(*) - 1) * pay.amount DESC
       LIMIT ${Number(limit) || 50}`,
      p.params
    );

    for (const g of groups) {
      const extra = (Number(g.occurrences) || 1) - 1;
      result.withinPaymentsCount += extra;
      result.withinPaymentsAmount += extra * (Number(g.amount) || 0);
      result.samples.push({
        type: "duplicate_within_payments",
        customer: g.customer,
        date: g.pay_date,
        amount: Number(g.amount) || 0,
        occurrences: Number(g.occurrences) || 0,
      });
    }

    if (this.tableExists("sales")) {
      const ps = this.periodClause("pay.date", from, to);
      const matches = this.all(
        `SELECT pay.id AS payment_id, pay.date AS pay_date,
                pay.customer_name AS customer_name, pay.amount AS amount,
                s.id AS sale_id
         FROM payments pay
         JOIN sales s
           ON date(s.date) = date(pay.date)
          AND LOWER(TRIM(COALESCE(s.customer_name,''))) = LOWER(TRIM(COALESCE(pay.customer_name,'')))
          AND COALESCE(s.paid,0) = COALESCE(pay.amount,0)
         WHERE COALESCE(pay.amount,0) <> 0${ps.sql}
         ORDER BY pay.amount DESC
         LIMIT ${Number(limit) || 50}`,
        ps.params
      );
      for (const m of matches) {
        result.againstSalePaidCount += 1;
        result.againstSalePaidAmount += Number(m.amount) || 0;
        result.samples.push({
          type: "payment_matches_sale_paid",
          customer: m.customer_name,
          date: m.pay_date,
          amount: Number(m.amount) || 0,
          paymentId: m.payment_id,
          saleId: m.sale_id,
        });
      }
    }

    return result;
  }

  /** أوردرات مدفوعة أكثر من قيمتها */
  findOverpaidSales({ from = null, to = null } = {}) {
    if (!this.tableExists("sales")) return { count: 0, total: 0 };
    const p = this.periodClause("s.date", from, to);
    const row = this.get(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(COALESCE(s.paid,0) - COALESCE(s.total,0)), 0) AS total
       FROM sales s
       WHERE COALESCE(s.paid,0) > COALESCE(s.total,0)${p.sql}`,
      p.params
    );
    return { count: Number(row.count) || 0, total: Number(row.total) || 0 };
  }

  /** أصناف مرتجعة بكمية أكبر من الكمية المباعة */
  findReturnsExceedingSales() {
    if (!this.tableExists("returned_orders") || !this.tableExists("sales")) {
      return { count: 0, items: [] };
    }
    if (!this.columnExists("returned_orders", "inventory_item_id")) {
      return { count: 0, items: [] };
    }
    const items = this.all(
      `SELECT ro.inventory_item_id AS itemId,
              SUM(COALESCE(ro.quantity,0)) AS returnedQty,
              COALESCE((SELECT SUM(COALESCE(s.quantity,0)) FROM sales s
                         WHERE s.inventory_item_id = ro.inventory_item_id), 0) AS soldQty
       FROM returned_orders ro
       WHERE ro.inventory_item_id IS NOT NULL
       GROUP BY ro.inventory_item_id
       HAVING returnedQty > soldQty`
    );
    return { count: items.length, items };
  }

  /** تواريخ غير قياسية أو مستقبلية قد تُخرج حركات من تقرير الفترة */
  findDateAnomalies() {
    const today = new Date().toISOString().split("T")[0];
    const checks = [
      { table: "sales", column: "date" },
      { table: "payments", column: "date" },
      { table: "returned_orders", column: "date" },
      { table: "expenses", column: "date" },
    ];
    let invalidDates = 0;
    let futureDated = 0;
    for (const c of checks) {
      if (!this.tableExists(c.table)) continue;
      const invalid = this.get(
        `SELECT COUNT(*) AS count FROM ${c.table}
         WHERE ${c.column} IS NOT NULL AND date(${c.column}) IS NULL`
      );
      invalidDates += Number(invalid.count) || 0;
      const future = this.get(
        `SELECT COUNT(*) AS count FROM ${c.table}
         WHERE date(${c.column}) > date(?)`,
        [today]
      );
      futureDated += Number(future.count) || 0;
    }
    return { invalidDates, futureDated };
  }

  // ---------------------------------------------------------------- assembler

  /**
   * تقرير الأرباح والخسائر الكامل للفترة.
   * @param {{from?: string|null, to?: string|null, includeDetails?: boolean}} options
   */
  calculateProfitLoss({ from = null, to = null, includeDetails = true } = {}) {
    const range = { from, to };
    const asOf = to || new Date().toISOString().split("T")[0];

    // 1) الإيراد
    const { grossSales, salesCount } = this.calculateRevenue(range);
    const { salesReturns, returnsCount } = this.calculateReturns(range);
    const netSales = grossSales - salesReturns;

    // 2) تكلفة البضاعة
    const costInfo = this.calculateCOGS(range);
    const cogs = costInfo.cogs;

    // نسبة التكلفة الاحتياطية تُشتق من المبيعات التي لها تكلفة موثوقة فقط
    const fallbackCostRatio =
      costInfo.salesValueWithCost > 0
        ? cogs / costInfo.salesValueWithCost
        : 0;

    const returnedCostInfo = this.calculateReturnedCOGS(range, fallbackCostRatio);
    const returnedCogs = returnedCostInfo.returnedCogs;
    const netCogs = cogs - returnedCogs;

    // 3) الربح الإجمالي
    const grossProfit = this.calculateGrossProfit(netSales, netCogs);
    const grossProfitMarginRatio = safeDivide(grossProfit, netSales);

    // 4) المصروفات والإيرادات الأخرى
    const { operatingExpenses, expensesCount } = this.calculateExpenses(range);
    const { otherIncome, otherIncomeCount } = this.calculateOtherIncome(range);
    const unclassifiedExpenses = this.countUnclassifiedExpenses(range);

    // 5) النتيجة
    const netProfitValue = this.calculateNetProfit(
      grossProfit,
      operatingExpenses,
      otherIncome
    );
    const netProfit = netProfitValue;
    const netLoss = netProfitValue < 0 ? -netProfitValue : 0;
    const netProfitMarginRatio = safeDivide(netProfitValue, netSales);

    // 6) النقد والمديونيات (منفصلة تماماً عن الإيراد)
    const collectionsInfo = this.calculateCollections(range);
    const arInfo = this.calculateAccountsReceivable({ asOf });
    const collectionRateRatio = safeDivide(arInfo.allocatedCollections, netSales);

    // 7) تحذيرات التسوية
    const overpaidSales = this.findOverpaidSales(range);
    const duplicates = this.findPotentialDuplicatePayments(range);
    const unrelatedPayments = this.findPaymentsWithoutRelation(range);
    const returnsExceeding = this.findReturnsExceedingSales();
    const dateAnomalies = this.findDateAnomalies();

    const warnings = [];
    const warn = (code, severity, message, data) =>
      warnings.push({ code, severity, message, data: data ?? null });

    if (collectionsInfo.collections > netSales) {
      warn(
        "COLLECTIONS_GT_NET_SALES",
        "high",
        "التحصيلات أكبر من صافي المبيعات في هذه الفترة. الفرق لا يُعتبر إيراداً ولا يزيد الربح.",
        {
          collections: round(collectionsInfo.collections),
          netSales: round(netSales),
          difference: round(collectionsInfo.collections - netSales),
        }
      );
    }
    if (arInfo.unallocatedCollections > 0) {
      warn(
        "UNALLOCATED_COLLECTIONS",
        "high",
        "توجد تحصيلات غير مخصّصة على فواتير (رصيد دائن للعملاء أو دفعات تحتاج تسوية).",
        { amount: round(arInfo.unallocatedCollections), customers: arInfo.customersWithCredit }
      );
    }
    if (costInfo.missingCostCount > 0) {
      warn(
        "MISSING_UNIT_COST",
        "high",
        "توجد مبيعات بدون تكلفة وحدة مسجّلة، لذلك تكلفة البضاعة المباعة غير مكتملة والربح قد يكون أعلى من الحقيقة.",
        {
          salesCount: costInfo.missingCostCount,
          salesValue: round(costInfo.missingCostSalesValue),
        }
      );
    }
    if (returnedCostInfo.estimatedReturnsCount > 0) {
      warn(
        "ESTIMATED_RETURNED_COGS",
        "medium",
        "تعذّر إيجاد التكلفة التاريخية لبعض المرتجعات (غير مرتبطة بصنف)، فتم تقدير تكلفتها بنسبة التكلفة الموثوقة.",
        {
          returnsCount: returnedCostInfo.estimatedReturnsCount,
          estimatedAmount: round(returnedCostInfo.estimatedReturnedCogs),
        }
      );
    }
    if (returnedCostInfo.mismatchedUnitPriceCount > 0) {
      warn(
        "RETURN_UNIT_PRICE_MISMATCH",
        "medium",
        "توجد مرتجعات سعر الوحدة المسجّل بها لا يتوافق مع سعر بيع الصنف تاريخياً، فلا يمكن الاعتماد على الكمية؛ تم اشتقاق تكلفتها من نسبة التكلفة الفعلية لنفس الصنف. يُفضّل مراجعة الكمية والسعر في هذه السطور.",
        {
          returnsCount: returnedCostInfo.mismatchedUnitPriceCount,
          amount: round(returnedCostInfo.itemRatioReturnedCogs),
        }
      );
    }
    if (overpaidSales.count > 0) {
      warn(
        "SALE_PAID_GT_TOTAL",
        "medium",
        "توجد أوردرات مسجّل بها مدفوع أكبر من قيمة الأوردر.",
        { salesCount: overpaidSales.count, amount: round(overpaidSales.total) }
      );
    }
    if (duplicates.withinPaymentsCount > 0) {
      warn(
        "POTENTIAL_DUPLICATE_PAYMENTS",
        "high",
        "توجد دفعات متطابقة (نفس العميل والمبلغ والتاريخ) قد تكون مسجّلة أكثر من مرة.",
        {
          extraEntries: duplicates.withinPaymentsCount,
          amount: round(duplicates.withinPaymentsAmount),
        }
      );
    }
    if (duplicates.againstSalePaidCount > 0) {
      warn(
        "PAYMENT_MATCHES_SALE_PAID",
        "medium",
        "توجد دفعات منفصلة تطابق المدفوع داخل أوردر بنفس التاريخ ونفس العميل، ويُحتمل تسجيل نفس السداد مرتين.",
        {
          entries: duplicates.againstSalePaidCount,
          amount: round(duplicates.againstSalePaidAmount),
        }
      );
    }
    if (unrelatedPayments.count > 0) {
      warn(
        "PAYMENTS_WITHOUT_RELATION",
        "medium",
        "توجد دفعات لا يمكن ربطها بعميل معروف؛ لا تدخل في الإيراد.",
        { count: unrelatedPayments.count, amount: round(unrelatedPayments.total) }
      );
    }
    if (returnsExceeding.count > 0) {
      warn(
        "RETURNS_EXCEED_SALES",
        "medium",
        "توجد أصناف كمية مرتجعاتها أكبر من الكمية المباعة.",
        { items: returnsExceeding.count }
      );
    }
    if (unclassifiedExpenses.count > 0) {
      warn(
        "UNCLASSIFIED_EXPENSES",
        "low",
        "توجد بنود مصروفات بدون تصنيف داخل/خارج، وتم اعتبارها مصروفات تشغيلية.",
        {
          count: unclassifiedExpenses.count,
          amount: round(unclassifiedExpenses.total),
        }
      );
    }
    if (dateAnomalies.invalidDates > 0) {
      warn(
        "INVALID_DATES",
        "medium",
        "توجد حركات بتواريخ غير صالحة قد تُستبعد من تقارير الفترات.",
        { count: dateAnomalies.invalidDates }
      );
    }
    if (dateAnomalies.futureDated > 0) {
      warn(
        "FUTURE_DATED_RECORDS",
        "low",
        "توجد حركات بتواريخ مستقبلية لا تدخل في تقارير الفترات المنتهية اليوم.",
        { count: dateAnomalies.futureDated }
      );
    }
    if (arInfo.accountsReceivable < 0) {
      warn(
        "NEGATIVE_ACCOUNTS_RECEIVABLE",
        "high",
        "إجمالي المديونيات جاء سالباً، وهو مؤشر على خلل في بيانات الفواتير أو التحصيلات ويحتاج مراجعة.",
        { amount: round(arInfo.accountsReceivable) }
      );
    }
    if (netSales < 0) {
      warn(
        "NEGATIVE_NET_SALES",
        "medium",
        "صافي المبيعات في هذه الفترة سالب لأن قيمة المرتجعات تجاوزت قيمة المبيعات المسجّلة داخل الفترة.",
        { grossSales: round(grossSales), salesReturns: round(salesReturns) }
      );
    }
    if (arInfo.unlinkedCollections > 0) {
      warn(
        "COLLECTIONS_WITHOUT_CUSTOMER_KEY",
        "medium",
        "توجد تحصيلات بدون اسم أو معرّف عميل واضح.",
        { amount: round(arInfo.unlinkedCollections) }
      );
    }

    const result = {
      period: { from: from || null, to: to || null, asOf },

      // REVENUE
      grossSales: round(grossSales),
      salesReturns: round(salesReturns),
      netSales: round(netSales),
      salesCount,
      returnsCount,

      // COGS
      cogs: round(cogs),
      returnedCogs: round(returnedCogs),
      netCogs: round(netCogs),
      actualReturnedCogs: round(returnedCostInfo.actualReturnedCogs),
      itemRatioReturnedCogs: round(returnedCostInfo.itemRatioReturnedCogs),
      estimatedReturnedCogs: round(returnedCostInfo.estimatedReturnedCogs),
      returnedCogsBasis: {
        fromActualQuantityAndCost: {
          amount: round(returnedCostInfo.actualReturnedCogs),
          returnsCount: returnedCostInfo.actualReturnsCount,
        },
        fromItemActualCostRatio: {
          amount: round(returnedCostInfo.itemRatioReturnedCogs),
          returnsCount: returnedCostInfo.itemRatioReturnsCount,
        },
        estimated: {
          amount: round(returnedCostInfo.estimatedReturnedCogs),
          returnsCount: returnedCostInfo.estimatedReturnsCount,
        },
      },
      cogsCoverageRate:
        grossSales !== 0
          ? round((costInfo.salesValueWithCost / grossSales) * 100)
          : null,

      // GROSS PROFIT
      grossProfit: round(grossProfit),
      grossProfitMargin:
        grossProfitMarginRatio == null ? null : round(grossProfitMarginRatio * 100),

      // EXPENSES / OTHER INCOME
      operatingExpenses: round(operatingExpenses),
      otherIncome: round(otherIncome),
      expensesCount,
      otherIncomeCount,

      // NET RESULT
      netProfit: round(netProfit),
      netLoss: round(netLoss),
      netProfitMargin:
        netProfitMarginRatio == null ? null : round(netProfitMarginRatio * 100),

      // CASH & RECEIVABLES (ليست إيراداً)
      collections: round(collectionsInfo.collections),
      collectionsFromSaleOrders: round(collectionsInfo.collectionsFromSaleOrders),
      collectionsFromSeparatePayments: round(
        collectionsInfo.collectionsFromSeparatePayments
      ),
      allocatedCollections: round(arInfo.allocatedCollections),
      unallocatedCollections: round(arInfo.unallocatedCollections),
      accountsReceivable: round(arInfo.accountsReceivable),
      collectionRate:
        collectionRateRatio == null ? null : round(collectionRateRatio * 100),
      customersWithCredit: arInfo.customersWithCredit,
      customersWithReceivable: arInfo.customersWithReceivable,

      // AUDIT
      reconciliationWarnings: warnings,
      missingCostItems: includeDetails
        ? this.listMissingCostSales({ from, to, limit: 100 })
        : [],
      missingCostSummary: {
        count: costInfo.missingCostCount,
        salesValue: round(costInfo.missingCostSalesValue),
      },
      potentialDuplicatePayments: {
        withinPaymentsCount: duplicates.withinPaymentsCount,
        withinPaymentsAmount: round(duplicates.withinPaymentsAmount),
        againstSalePaidCount: duplicates.againstSalePaidCount,
        againstSalePaidAmount: round(duplicates.againstSalePaidAmount),
        samples: includeDetails ? duplicates.samples : [],
      },
      unrelatedPayments: {
        count: unrelatedPayments.count,
        total: round(unrelatedPayments.total),
        samples: includeDetails ? unrelatedPayments.samples : [],
      },
      basis: "accrual",
    };

    return result;
  }

  /** ملخّص تسوية بين الإيراد والتحصيل */
  calculateReconciliation({ from = null, to = null } = {}) {
    const pl = this.calculateProfitLoss({ from, to, includeDetails: true });
    return {
      period: pl.period,
      revenue: {
        grossSales: pl.grossSales,
        salesReturns: pl.salesReturns,
        netSales: pl.netSales,
      },
      cash: {
        collections: pl.collections,
        allocatedCollections: pl.allocatedCollections,
        unallocatedCollections: pl.unallocatedCollections,
        accountsReceivable: pl.accountsReceivable,
      },
      cost: {
        cogs: pl.cogs,
        returnedCogs: pl.returnedCogs,
        netCogs: pl.netCogs,
      },
      operations: {
        operatingExpenses: pl.operatingExpenses,
        otherIncome: pl.otherIncome,
      },
      result: {
        grossProfit: pl.grossProfit,
        netProfit: pl.netProfit,
        netLoss: pl.netLoss,
      },
      collectionsVsRevenueDifference: round(pl.collections - pl.netSales),
      warnings: pl.reconciliationWarnings,
    };
  }
}

module.exports = ProfitLossService;
module.exports.ProfitLossService = ProfitLossService;
