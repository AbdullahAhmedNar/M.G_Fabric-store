const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let dbPath;

// تحديد مسار قاعدة البيانات بناءً على البيئة
function getDatabasePath() {
  try {
    const { app } = require("electron");
    
    if (app && app.isReady()) {
      // في بيئة Electron (تطوير أو إنتاج)
      const userDataPath = app.getPath("userData");
      const dbFilePath = path.join(userDataPath, "mg_fabric.db");
      
      console.log("بيئة Electron - userDataPath:", userDataPath);
      
      // إنشاء مجلد userData إذا لم يكن موجوداً
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
        console.log("تم إنشاء مجلد userData");
      }
      
      // نسخ قاعدة البيانات من resources إذا لم تكن موجودة في userData
      if (!fs.existsSync(dbFilePath)) {
        console.log("قاعدة البيانات غير موجودة في userData، البحث عن نسخة في resources...");
        
        // البحث في عدة مواقع محتملة
        const possiblePaths = [
          path.join(process.resourcesPath, "mg_fabric.db"),
          path.join(__dirname, "mg_fabric.db"),
          path.join(process.cwd(), "mg_fabric.db"),
          path.join(__dirname, "..", "mg_fabric.db"),
          path.join(process.cwd(), "server", "mg_fabric.db")
        ];
        
        let sourceDbPath = null;
        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            sourceDbPath = possiblePath;
            console.log("تم العثور على قاعدة البيانات في:", possiblePath);
            break;
          }
        }
        
        if (sourceDbPath) {
          try {
            fs.copyFileSync(sourceDbPath, dbFilePath);
            console.log("تم نسخ قاعدة البيانات بنجاح إلى:", dbFilePath);
          } catch (copyError) {
            console.error("خطأ في نسخ قاعدة البيانات:", copyError);
            return sourceDbPath; // استخدام المسار الأصلي كبديل
          }
        } else {
          console.error("لم يتم العثور على قاعدة البيانات في أي من المواقع المتوقعة");
          console.log("المواقع المفحوصة:", possiblePaths);
        }
      } else {
        console.log("قاعدة البيانات موجودة في userData:", dbFilePath);
      }
      
      return dbFilePath;
    } else {
      // في بيئة Node.js العادية (تطوير)
      const devPath = path.join(__dirname, "mg_fabric.db");
      console.log("بيئة التطوير - مسار قاعدة البيانات:", devPath);
      return devPath;
    }
  } catch (error) {
    console.error("خطأ في تحديد مسار قاعدة البيانات:", error);
    // مسار احتياطي
    const fallbackPath = path.join(__dirname, "mg_fabric.db");
    console.log("استخدام المسار الاحتياطي:", fallbackPath);
    return fallbackPath;
  }
}

dbPath = getDatabasePath();
console.log("مسار قاعدة البيانات:", dbPath);

class DatabaseManager {
  constructor() {
    try {
      console.log("محاولة الاتصال بقاعدة البيانات في:", dbPath);
      this.db = new Database(dbPath);
      console.log("تم الاتصال بقاعدة البيانات بنجاح");
      this.init();
    } catch (error) {
      console.error("خطأ في الاتصال بقاعدة البيانات:", error);
      console.error("مسار قاعدة البيانات:", dbPath);
      console.error("هل الملف موجود؟", fs.existsSync(dbPath));
      
      // محاولة إنشاء قاعدة بيانات جديدة إذا فشل الاتصال
      try {
        console.log("محاولة إنشاء قاعدة بيانات جديدة...");
        this.db = new Database(dbPath);
        console.log("تم إنشاء قاعدة بيانات جديدة");
        this.init();
      } catch (createError) {
        console.error("فشل في إنشاء قاعدة بيانات جديدة:", createError);
        throw createError;
      }
    }
  }

  tableExists = (tableName) => {
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
  };

  getMaxGlobalSequenceFrom(tableName) {
    try {
      if (!this.tableExists(tableName)) return 0;
      const row = this.db
        .prepare(
          `SELECT COALESCE(MAX(global_sequence), 0) as max_seq FROM ${tableName}`
        )
        .get();
      return row?.max_seq || 0;
    } catch {
      return 0;
    }
  }

  getNextGlobalSequence(scope, identifier) {
    try {
      if (!scope || !identifier) {
        console.warn("getNextGlobalSequence: Missing scope or identifier");
        return 1;
      }

      if (scope === "supplier") {
        let supplierOrdersMax = 0;
        try {
          const result = this.db
            .prepare(
              `SELECT COALESCE(MAX(global_sequence), 0) as max_seq FROM suppliers WHERE supplier_id = ?`
            )
            .get(identifier);
          supplierOrdersMax = result?.max_seq || 0;
        } catch (error) {
          console.warn("Error getting supplier orders max sequence:", error.message);
        }

        let supplierPaymentsMax = 0;
        try {
          const result = this.db
            .prepare(
              `SELECT COALESCE(MAX(global_sequence), 0) as max_seq FROM supplier_payments WHERE supplier_id = ?`
            )
            .get(identifier);
          supplierPaymentsMax = result?.max_seq || 0;
        } catch (error) {
          console.warn("Error getting supplier payments max sequence:", error.message);
        }

        return Math.max(supplierOrdersMax, supplierPaymentsMax) + 1;
      } else {
        let customerSalesMax = 0;
        try {
          const result = this.db
            .prepare(
              `SELECT COALESCE(MAX(global_sequence), 0) as max_seq FROM sales WHERE customer_id = ?`
            )
            .get(identifier);
          customerSalesMax = result?.max_seq || 0;
        } catch (error) {
          console.warn("Error getting customer sales max sequence:", error.message);
        }

        let customerPaymentsMax = 0;
        try {
          const result = this.db
            .prepare(
              `SELECT COALESCE(MAX(global_sequence), 0) as max_seq FROM payments WHERE customer_id = ?`
            )
            .get(identifier);
          customerPaymentsMax = result?.max_seq || 0;
        } catch (error) {
          console.warn("Error getting customer payments max sequence:", error.message);
        }

        let customerReturnedOrdersMax = 0;
        try {
          const result = this.db
            .prepare(
              `SELECT COALESCE(MAX(global_sequence), 0) as max_seq FROM returned_orders WHERE customer_id = ?`
            )
            .get(identifier);
          customerReturnedOrdersMax = result?.max_seq || 0;
        } catch (error) {
          console.warn("Error getting customer returned orders max sequence:", error.message);
        }

        return Math.max(customerSalesMax, customerPaymentsMax, customerReturnedOrdersMax) + 1;
      }
    } catch (error) {
      console.error("Error in getNextGlobalSequence:", error);
      return 1;
    }
  }

  ensureSalesTable() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      global_sequence INTEGER,
      customer_name TEXT,
      description TEXT,
      inventory_item_id INTEGER,
      quantity REAL,
      unit TEXT,
      price REAL,
      total REAL,
      paid REAL,
      remaining REAL,
      date TEXT
    )`);
    const cols = this.db.pragma("table_info(sales)");
    const hasUnit = cols.some((c) => c.name === "unit");
    const hasInventoryId = cols.some((c) => c.name === "inventory_item_id");
    const hasGlobalSequence = cols.some((c) => c.name === "global_sequence");
    const hasUnitCost = cols.some((c) => c.name === "unit_cost");
    const hasCustomerId = cols.some((c) => c.name === "customer_id");
    if (!hasUnit) {
      this.db.exec('ALTER TABLE sales ADD COLUMN unit TEXT DEFAULT "متر"');
    }
    if (!hasInventoryId) {
      this.db.exec("ALTER TABLE sales ADD COLUMN inventory_item_id INTEGER");
    }
    if (!hasGlobalSequence) {
      this.db.exec("ALTER TABLE sales ADD COLUMN global_sequence INTEGER");
    }
    if (!hasUnitCost) {
      this.db.exec("ALTER TABLE sales ADD COLUMN unit_cost REAL DEFAULT 0");
    }
    if (!hasCustomerId) {
      this.db.exec("ALTER TABLE sales ADD COLUMN customer_id INTEGER");
    }
  }

  ensureReturnedOrdersTable() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS returned_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      global_sequence INTEGER,
      customer_name TEXT,
      description TEXT,
      quantity REAL,
      unit TEXT DEFAULT 'متر',
      price REAL,
      inventory_item_id INTEGER,
      section_id INTEGER,
      date TEXT
    )`);
    const cols = this.db.pragma("table_info(returned_orders)");
    const hasCustomerId = cols.some((c) => c.name === "customer_id");
    if (!hasCustomerId) {
      this.db.exec("ALTER TABLE returned_orders ADD COLUMN customer_id INTEGER");
    }
  }

  ensureExpensesTable() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      description TEXT,
      amount REAL,
      date TEXT,
      direction TEXT DEFAULT 'خارج'
    )`);
    const cols = this.db.pragma("table_info(expenses)");
    const hasDirection = cols.some((c) => c.name === "direction");
    if (!hasDirection) {
      this.db.exec(
        "ALTER TABLE expenses ADD COLUMN direction TEXT DEFAULT 'خارج'"
      );
    }
  }

  ensurePaymentsTable() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      global_sequence INTEGER,
      customer_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    const cols = this.db.pragma("table_info(payments)");
    const hasGlobalSequence = cols.some((c) => c.name === "global_sequence");
    const hasCustomerId = cols.some((c) => c.name === "customer_id");
    if (!hasGlobalSequence) {
      this.db.exec("ALTER TABLE payments ADD COLUMN global_sequence INTEGER");
    }
    if (!hasCustomerId) {
      this.db.exec("ALTER TABLE payments ADD COLUMN customer_id INTEGER");
    }
  }

  ensureSupplierPaymentsTable() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      global_sequence INTEGER,
      supplier_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    const cols = this.db.pragma("table_info(supplier_payments)");
    const hasGlobalSequence = cols.some((c) => c.name === "global_sequence");
    const hasSupplierId = cols.some((c) => c.name === "supplier_id");
    if (!hasGlobalSequence) {
      this.db.exec(
        "ALTER TABLE supplier_payments ADD COLUMN global_sequence INTEGER"
      );
    }
    if (!hasSupplierId) {
      this.db.exec("ALTER TABLE supplier_payments ADD COLUMN supplier_id INTEGER");
    }
  }

  async init() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      description TEXT,
      quantity REAL,
      price REAL,
      total REAL,
      paid REAL,
      remaining REAL,
      date TEXT,
      inventory_id INTEGER,
      used_meters REAL
    )`);

    // جدول الموردين (المعلومات الأساسية فقط)
    this.db.exec(`CREATE TABLE IF NOT EXISTS suppliers_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      date TEXT
    )`);

    // Migration: إزالة UNIQUE constraint من name في suppliers_info
    try {
      const suppliersInfoCols = this.db.pragma("table_info(suppliers_info)");
      const hasUniqueConstraint = this.db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='suppliers_info' AND sql LIKE '%UNIQUE%'
      `).get();
      
      if (hasUniqueConstraint) {
        // إنشاء جدول جديد بدون UNIQUE constraint
        this.db.exec(`
          CREATE TABLE suppliers_info_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            date TEXT
          );
          INSERT INTO suppliers_info_new (id, name, phone, date)
          SELECT id, name, phone, date FROM suppliers_info;
          DROP TABLE suppliers_info;
          ALTER TABLE suppliers_info_new RENAME TO suppliers_info;
        `);
      }
    } catch (e) {
      console.warn("Migration warning for suppliers_info:", e.message);
    }

    // جدول طلبات الموردين (الطلبات الفعلية)
    this.db.exec(`CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      global_sequence INTEGER,
      name TEXT NOT NULL,
      phone TEXT,
      description TEXT,
      quantity REAL,
      price REAL,
      total REAL,
      paid REAL,
      remaining REAL,
      date TEXT,
      unit TEXT DEFAULT 'متر',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    const suppliersCols = this.db.pragma("table_info(suppliers)");
    const hasSupplierUnit = suppliersCols.some((c) => c.name === "unit");
    const hasSupplierPhone = suppliersCols.some((c) => c.name === "phone");
    const hasSupplierGlobalSequence = suppliersCols.some(
      (c) => c.name === "global_sequence"
    );
    const hasSupplierCreatedAt = suppliersCols.some((c) => c.name === "created_at");
    const hasSupplierIdCol = suppliersCols.some((c) => c.name === "supplier_id");
    const hasSupplierSectionId = suppliersCols.some((c) => c.name === "section_id");
    const hasSupplierInventoryItemId = suppliersCols.some((c) => c.name === "inventory_item_id");
    const hasSupplierColorNumber = suppliersCols.some((c) => c.name === "color_number");
    const hasSupplierRollsCount = suppliersCols.some((c) => c.name === "rolls_count");
    const hasSupplierAddToInventory = suppliersCols.some((c) => c.name === "add_to_inventory");
    if (!hasSupplierUnit) {
      this.db.exec('ALTER TABLE suppliers ADD COLUMN unit TEXT DEFAULT "متر"');
    }
    if (!hasSupplierGlobalSequence) {
      this.db.exec("ALTER TABLE suppliers ADD COLUMN global_sequence INTEGER");
    }
    if (!hasSupplierPhone) {
      this.db.exec("ALTER TABLE suppliers ADD COLUMN phone TEXT");
    }
    if (!hasSupplierCreatedAt) {
      this.db.exec(
        "ALTER TABLE suppliers ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP"
      );
    }
    if (!hasSupplierIdCol) {
      this.db.exec("ALTER TABLE suppliers ADD COLUMN supplier_id INTEGER");
    }
    if (!hasSupplierSectionId) {
      this.db.exec("ALTER TABLE suppliers ADD COLUMN section_id INTEGER");
    }
    if (!hasSupplierInventoryItemId) {
      this.db.exec("ALTER TABLE suppliers ADD COLUMN inventory_item_id INTEGER");
    }
    if (!hasSupplierColorNumber) {
      this.db.exec("ALTER TABLE suppliers ADD COLUMN color_number TEXT");
    }
    if (!hasSupplierRollsCount) {
      this.db.exec("ALTER TABLE suppliers ADD COLUMN rolls_count INTEGER");
    }
    if (!hasSupplierAddToInventory) {
      this.db.exec("ALTER TABLE suppliers ADD COLUMN add_to_inventory INTEGER DEFAULT 0");
    }

    this.db.exec(`CREATE TABLE IF NOT EXISTS inventory_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    this.db.exec(`CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      section_id INTEGER,
      color_number TEXT,
      rolls_count INTEGER,
      total_meters REAL,
      unit TEXT DEFAULT 'متر',
      FOREIGN KEY (section_id) REFERENCES inventory_sections (id)
    )`);

    const inventoryCols = this.db.pragma("table_info(inventory)");
    const hasUnitCol = inventoryCols.some((c) => c.name === "unit");
    const hasSectionId = inventoryCols.some((c) => c.name === "section_id");
    const hasPurchasePrice = inventoryCols.some((c) => c.name === "purchase_price");
    const hasSupplierId = inventoryCols.some((c) => c.name === "supplier_id");
    if (!hasUnitCol) {
      this.db.exec('ALTER TABLE inventory ADD COLUMN unit TEXT DEFAULT "متر"');
    }
    if (!hasSectionId) {
      this.db.exec("ALTER TABLE inventory ADD COLUMN section_id INTEGER");
    }
    if (!hasPurchasePrice) {
      this.db.exec("ALTER TABLE inventory ADD COLUMN purchase_price REAL DEFAULT 0");
    }
    if (!hasSupplierId) {
      this.db.exec("ALTER TABLE inventory ADD COLUMN supplier_id INTEGER");
    }

    this.db.exec(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      app_name TEXT,
      theme TEXT,
      notification_threshold INTEGER DEFAULT 2
    )`);

    // sales: track revenue entries
    this.db.exec(`CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      description TEXT,
      quantity REAL,
      price REAL,
      total REAL,
      paid REAL,
      remaining REAL,
      date TEXT
    )`);

    // expenses: operational expenses like food, drinks, other
    this.db.exec(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      description TEXT,
      amount REAL,
      date TEXT
    )`);

    const settingsRow = this.db
      .prepare("SELECT COUNT(*) as count FROM settings")
      .get();
    if (settingsRow.count === 0) {
      this.db
        .prepare(
          `INSERT INTO settings (id, app_name, theme, notification_threshold) VALUES (1, ?, ?, ?)`
        )
        .run("M.G – نظام إدارة محل الأقمشة", "dark", 2);
    } else {
      const columns = this.db.pragma("table_info(settings)");
      const hasNotificationThreshold = columns.some(
        (col) => col.name === "notification_threshold"
      );
      if (!hasNotificationThreshold) {
        this.db.exec(
          "ALTER TABLE settings ADD COLUMN notification_threshold INTEGER DEFAULT 2"
        );
      }
    }

    this.ensureReturnedOrdersTable();

    const usersRow = this.db
      .prepare("SELECT COUNT(*) as count FROM users")
      .get();
    if (usersRow.count === 0) {
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      this.db
        .prepare("INSERT INTO users (username, password) VALUES (?, ?)")
        .run("admin", hashedPassword);
      console.log("تم إنشاء المستخدم الافتراضي: admin / admin123");
    }
  }

  getUserByUsername(username) {
    return this.db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username);
  }

  getAllUsers() {
    return this.db.prepare("SELECT id, username FROM users").all();
  }

  addUser(username, password) {
    const result = this.db
      .prepare("INSERT INTO users (username, password) VALUES (?, ?)")
      .run(username, password);
    return result.lastInsertRowid;
  }

  deleteUser(id) {
    this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }

  getAllCustomers() {
    return this.db.prepare("SELECT * FROM customers ORDER BY id DESC").all();
  }

  getCustomerByNameAndPhone(name, phone) {
    if (!phone || phone.trim() === '') {
      return this.db.prepare(
        "SELECT * FROM customers WHERE TRIM(LOWER(name)) = TRIM(LOWER(?)) AND (phone IS NULL OR phone = '') LIMIT 1"
      ).get(name);
    } else {
      return this.db.prepare(
        "SELECT * FROM customers WHERE TRIM(LOWER(name)) = TRIM(LOWER(?)) AND TRIM(phone) = TRIM(?) LIMIT 1"
      ).get(name, phone);
    }
  }

  getSupplierInfoByNameAndPhone(name, phone) {
    if (!phone || phone.trim() === '') {
      return this.db.prepare(
        "SELECT * FROM suppliers_info WHERE TRIM(LOWER(name)) = TRIM(LOWER(?)) AND (phone IS NULL OR phone = '') LIMIT 1"
      ).get(name);
    } else {
      return this.db.prepare(
        "SELECT * FROM suppliers_info WHERE TRIM(LOWER(name)) = TRIM(LOWER(?)) AND TRIM(phone) = TRIM(?) LIMIT 1"
      ).get(name, phone);
    }
  }

  // التحقق من وجود عميل بنفس الاسم أو رقم الهاتف
  checkDuplicateCustomer(name, phone, excludeId = null) {
    if (!name || !name.trim()) {
      return { exists: false };
    }

    // التحقق من تطابق الاسم والرقم معاً
    let query = "SELECT * FROM customers WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))";
    const params = [name];
    
    // إذا كان هناك رقم هاتف، نتحقق من تطابقه أيضاً
    if (phone && phone.trim()) {
      query += " AND TRIM(phone) = TRIM(?)";
      params.push(phone);
    } else {
      // إذا لم يكن هناك رقم، نتحقق من العملاء الذين ليس لديهم رقم أيضاً
      query += " AND (phone IS NULL OR phone = '')";
    }
    
    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }
    
    query += " LIMIT 1";
    const duplicate = this.db.prepare(query).get(...params);
    
    if (duplicate) {
      return {
        exists: true,
        customer: duplicate,
        hasPhone: !!(duplicate.phone && duplicate.phone.trim())
      };
    }

    return { exists: false };
  }

  addCustomer(data) {
    // migrate columns if missing
    const cols = this.db.pragma("table_info(customers)");
    const hasInv = cols.some((c) => c.name === "inventory_id");
    const hasUsed = cols.some((c) => c.name === "used_meters");
    const hasPhone = cols.some((c) => c.name === "phone");
    if (!hasInv)
      this.db.exec("ALTER TABLE customers ADD COLUMN inventory_id INTEGER");
    if (!hasUsed)
      this.db.exec("ALTER TABLE customers ADD COLUMN used_meters REAL");
    if (!hasPhone) this.db.exec("ALTER TABLE customers ADD COLUMN phone TEXT");

    const stmt = this.db.prepare(
      `INSERT INTO customers (name, phone, description, quantity, price, total, paid, remaining, date, inventory_id, used_meters) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      data.name,
      data.phone || null,
      data.description || null,
      data.quantity || null,
      data.price || null,
      data.total || null,
      data.paid || null,
      data.remaining || null,
      data.date || null,
      data.inventory_id || null,
      data.used_meters || null
    );
    return result.lastInsertRowid;
  }

  updateCustomer(id, data) {
    // ensure columns
    const cols = this.db.pragma("table_info(customers)");
    const hasInv = cols.some((c) => c.name === "inventory_id");
    const hasUsed = cols.some((c) => c.name === "used_meters");
    const hasPhone = cols.some((c) => c.name === "phone");
    if (!hasInv)
      this.db.exec("ALTER TABLE customers ADD COLUMN inventory_id INTEGER");
    if (!hasUsed)
      this.db.exec("ALTER TABLE customers ADD COLUMN used_meters REAL");
    if (!hasPhone) this.db.exec("ALTER TABLE customers ADD COLUMN phone TEXT");

    this.db
      .prepare(
        `UPDATE customers SET name=?, phone=?, description=?, quantity=?, price=?, total=?, paid=?, remaining=?, date=?, inventory_id=?, used_meters=? WHERE id=?`
      )
      .run(
        data.name,
        data.phone || null,
        data.description || null,
        data.quantity || null,
        data.price || null,
        data.total || null,
        data.paid || null,
        data.remaining || null,
        data.date || null,
        data.inventory_id || null,
        data.used_meters || null,
        id
      );
  }
  getCustomerById(id) {
    return this.db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  }

  getCustomerStats(id) {
    const customer = this.getCustomerById(id);
    if (!customer) return null;

    const customerName = customer.name;

    // عدد المبيعات
    const salesCount = this.db.prepare("SELECT COUNT(*) as count FROM sales WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?))").get(customerName)?.count || 0;

    // عدد الدفعات
    this.ensurePaymentsTable();
    const paymentsCount = this.db.prepare("SELECT COUNT(*) as count FROM payments WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?))").get(customerName)?.count || 0;

    // عدد الأوردرات الراجعة
    this.ensureReturnedOrdersTable();
    const returnedOrdersCount = this.db.prepare("SELECT COUNT(*) as count FROM returned_orders WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?))").get(customerName)?.count || 0;

    return {
      customer,
      salesCount,
      paymentsCount,
      returnedOrdersCount,
      totalRecords: salesCount + paymentsCount + returnedOrdersCount
    };
  }

  getInventoryById(id) {
    return this.db.prepare("SELECT * FROM inventory WHERE id = ?").get(id);
  }

  adjustInventoryMeters(inventoryId, deltaMeters) {
    const item = this.getInventoryById(inventoryId);
    if (!item) return;
    const currentMeters = item.total_meters || 0;
    const currentRolls = item.rolls_count || 0;
    const metersPerRoll = currentRolls > 0 ? currentMeters / currentRolls : 0;
    let newMeters = currentMeters + deltaMeters;
    if (newMeters < 0) newMeters = 0;
    let newRolls = currentRolls;
    if (metersPerRoll > 0) {
      newRolls = Math.max(0, Math.round(newMeters / metersPerRoll));
    }
    this.db
      .prepare(
        "UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?"
      )
      .run(newMeters, newRolls, inventoryId);
  }

  deleteCustomer(id) {
    // الحصول على بيانات العميل قبل الحذف
    const customer = this.getCustomerById(id);
    if (!customer) return;

    const customerName = customer.name;

    // حذف جميع البيانات المرتبطة بالعميل باستخدام transaction للأمان
    const deleteTransaction = this.db.transaction(() => {
      // حذف المبيعات
      this.db.prepare("DELETE FROM sales WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?))").run(customerName);
      
      // حذف الدفعات
      this.ensurePaymentsTable();
      this.db.prepare("DELETE FROM payments WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?))").run(customerName);
      
      // حذف الأوردرات الراجعة
      this.ensureReturnedOrdersTable();
      this.db.prepare("DELETE FROM returned_orders WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?))").run(customerName);
      
      // حذف العميل نفسه
      this.db.prepare("DELETE FROM customers WHERE id = ?").run(id);
    });

    deleteTransaction();
  }

  getAllSuppliers() {
    return this.db
      .prepare("SELECT * FROM suppliers_info ORDER BY id DESC")
      .all();
  }

  getSupplierById(id) {
    return this.db
      .prepare("SELECT * FROM suppliers_info WHERE id = ?")
      .get(id);
  }

  getSupplierStats(id) {
    const supplier = this.getSupplierById(id);
    if (!supplier) return null;

    const supplierName = supplier.name;

    const ordersCount = this.db.prepare("SELECT COUNT(*) as count FROM suppliers WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))").get(supplierName)?.count || 0;

    this.ensureSupplierPaymentsTable();
    const paymentsCount = this.db.prepare("SELECT COUNT(*) as count FROM supplier_payments WHERE TRIM(LOWER(supplier_name)) = TRIM(LOWER(?))").get(supplierName)?.count || 0;

    return {
      supplier,
      ordersCount,
      paymentsCount,
      totalRecords: ordersCount + paymentsCount
    };
  }

  checkDuplicateSupplier(name, phone, excludeId = null) {
    if (!name || !name.trim()) {
      return { exists: false };
    }

    // التحقق من تطابق الاسم والرقم معاً
    let query = "SELECT * FROM suppliers_info WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))";
    const params = [name];
    
    // إذا كان هناك رقم هاتف، نتحقق من تطابقه أيضاً
    if (phone && phone.trim()) {
      query += " AND TRIM(phone) = TRIM(?)";
      params.push(phone);
    } else {
      // إذا لم يكن هناك رقم، نتحقق من الموردين الذين ليس لديهم رقم أيضاً
      query += " AND (phone IS NULL OR phone = '')";
    }
    
    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }
    
    query += " LIMIT 1";
    const duplicate = this.db.prepare(query).get(...params);
    
    if (duplicate) {
      return {
        exists: true,
        supplier: duplicate,
        hasPhone: !!(duplicate.phone && duplicate.phone.trim())
      };
    }

    return { exists: false };
  }

  getAllSupplierOrders() {
    return this.db.prepare("SELECT * FROM suppliers ORDER BY id DESC").all();
  }

  getSupplierOrdersBySupplierId(supplierId) {
    return this.db
      .prepare(
        "SELECT * FROM suppliers WHERE supplier_id = ? ORDER BY COALESCE(global_sequence, id) ASC"
      )
      .all(supplierId);
  }

  getSuppliersByName(supplierName) {
    return this.db
      .prepare(
        "SELECT * FROM suppliers WHERE TRIM(LOWER(name)) = TRIM(LOWER(?)) ORDER BY COALESCE(global_sequence, id) ASC"
      )
      .all(supplierName);
  }

  addSupplier(data) {
    // إضافة مورد جديد في جدول suppliers_info (بدون طلب تلقائي)
    const stmt = this.db.prepare(
      `INSERT INTO suppliers_info (name, phone, date) VALUES (?, ?, ?)`
    );
    const result = stmt.run(data.name, data.phone || null, data.date);
    return result.lastInsertRowid;
  }

  addSupplierOrder(data) {
    try {
      if (!data.name || !data.description || !data.quantity || !data.price) {
        throw new Error("البيانات المطلوبة ناقصة");
      }

      let supplierId = data.supplier_id || null;
      if (!supplierId && data.name) {
        const supplier = this.getSupplierInfoByNameAndPhone(data.name, data.phone);
        if (supplier) {
          supplierId = supplier.id;
        }
      }

      const globalSequence = supplierId ? this.getNextGlobalSequence("supplier", supplierId) : 1;
      const tx = this.db.transaction(() => {
        const stmt = this.db.prepare(
          `INSERT INTO suppliers (global_sequence, supplier_id, name, phone, description, quantity, price, total, paid, remaining, date, unit, section_id, inventory_item_id, color_number, rolls_count, add_to_inventory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const result = stmt.run(
          globalSequence,
          supplierId,
          data.name,
          data.phone || null,
          data.description,
          data.quantity,
          data.price,
          data.total,
          data.paid,
          data.remaining,
          data.date,
          data.unit || "متر",
          data.section_id || null,
          data.inventory_item_id || null,
          data.color_number || null,
          data.rolls_count || null,
          data.add_to_inventory ? 1 : 0
        );

        try {
          this.ensureSupplierTransactionsTable();
          this.addSupplierTransaction({
            supplier_name: data.name,
            type: "order",
            order_id: result.lastInsertRowid,
            description: data.description,
            quantity: data.quantity,
            price: data.price,
            total: data.total,
            paid: data.paid,
            date: data.date,
          });
        } catch (transactionError) {
          console.warn("Warning: Could not add supplier transaction:", transactionError.message);
        }

        if (data.section_id && data.inventory_item_id && data.add_to_inventory) {
          const item = this.getInventoryById(data.inventory_item_id);
          if (item) {
            const oldQuantity = parseFloat(item.total_meters || 0);
            const newQuantityAdded = parseFloat(data.quantity || 0);
            const totalQuantity = oldQuantity + newQuantityAdded;

            const newPurchasePrice = parseFloat(data.price) || 0;

            const oldRollsCount = parseInt(item.rolls_count || 0);
            const newRollsCount = parseInt(data.rolls_count || 0);
            const totalRollsCount = oldRollsCount + newRollsCount;

            const supplierInfo = this.db.prepare("SELECT id FROM suppliers_info WHERE name = ?").get(data.name);
            const supplierId = supplierInfo ? supplierInfo.id : null;

            this.db.prepare(
              `UPDATE inventory SET total_meters = ?, purchase_price = ?, supplier_id = ?, rolls_count = ? WHERE id = ?`
            ).run(totalQuantity, newPurchasePrice, supplierId, totalRollsCount, data.inventory_item_id);
          }
        } else if (data.section_id && data.add_to_inventory && !data.inventory_item_id) {
          const supplierInfo = this.db.prepare("SELECT id FROM suppliers_info WHERE name = ?").get(data.name);
          const supplierId = supplierInfo ? supplierInfo.id : null;
          
          const inventoryStmt = this.db.prepare(
            `INSERT INTO inventory (item_name, section_id, color_number, total_meters, rolls_count, unit, purchase_price, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          );
          const invResult = inventoryStmt.run(
            data.description || 'صنف جديد',
            data.section_id,
            data.color_number || null,
            parseFloat(data.quantity || 0),
            parseInt(data.rolls_count || 0) || 0,
            data.unit || 'متر',
            parseFloat(data.price) || 0,
            supplierId
          );
          // ربط الطلب بالصنف الجديد في المخزون حتى يعمل التعديل والحذف لاحقاً
          this.db.prepare("UPDATE suppliers SET inventory_item_id = ? WHERE id = ?").run(
            invResult.lastInsertRowid,
            result.lastInsertRowid
          );
        }

        return result.lastInsertRowid;
      });
      
      const orderId = tx();
      console.log(`Successfully added supplier order for: ${data.name}`);
      return orderId;
    } catch (error) {
      console.error("Error in addSupplierOrder:", error);
      throw error;
    }
  }

  updateSupplier(id, data) {
    // تحديث معلومات المورد في جدول suppliers_info
    this.db
      .prepare(`UPDATE suppliers_info SET name=?, phone=?, date=? WHERE id=?`)
      .run(data.name, data.phone || null, data.date, id);
  }

  updateSupplierOrder(id, data) {
    const idNum = parseInt(String(id), 10);
    if (isNaN(idNum)) return;

    let supplierId = data.supplier_id || null;
    if (!supplierId && data.name) {
      const supplier = this.getSupplierInfoByNameAndPhone(data.name, data.phone);
      if (supplier) {
        supplierId = supplier.id;
      }
    }
    
    const oldOrder = this.db.prepare("SELECT * FROM suppliers WHERE id = ?").get(idNum);
    if (!oldOrder) return;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE suppliers SET supplier_id=?, name=?, phone=?, description=?, quantity=?, price=?, total=?, paid=?, remaining=?, date=?, unit=?, section_id=?, inventory_item_id=?, color_number=?, rolls_count=?, add_to_inventory=? WHERE id=?`
        )
        .run(
          supplierId,
          data.name,
          data.phone || null,
          data.description,
          data.quantity,
          data.price,
          data.total,
          data.paid,
          data.remaining,
          data.date,
          data.unit || "متر",
          data.section_id || null,
          data.inventory_item_id || null,
          data.color_number || null,
          data.rolls_count || null,
          data.add_to_inventory ? 1 : 0,
          idNum
        );

      const oldInventoryItemId = oldOrder.inventory_item_id != null ? parseInt(oldOrder.inventory_item_id, 10) : null;
      const newInventoryItemId = data.inventory_item_id != null && data.inventory_item_id !== '' ? parseInt(data.inventory_item_id, 10) : null;
      const wasLinked = oldInventoryItemId != null && (oldOrder.add_to_inventory === 1 || oldOrder.add_to_inventory === true);
      const isLinked = newInventoryItemId != null && (data.add_to_inventory === 1 || data.add_to_inventory === true || data.add_to_inventory === '1' || data.add_to_inventory === 'true');

      // Same pattern as customer/sales: delta on edit. Cases: same item (delta),
      // unlink (revert old), link (add new), switch item (revert old + add new).
      if (wasLinked && oldInventoryItemId === newInventoryItemId) {
        const item = this.getInventoryById(oldInventoryItemId);
        if (item) {
          const oldQuantity = parseFloat(oldOrder.quantity || 0);
          const newQuantity = parseFloat(data.quantity || 0);
          const quantityDiff = newQuantity - oldQuantity;

          const newOrderPrice = parseFloat(data.price || 0);

          const currentTotalMeters = parseFloat(item.total_meters || 0);
          const updatedTotalMeters = currentTotalMeters + quantityDiff;

          const oldRollsCount = parseInt(oldOrder.rolls_count || 0);
          const newRollsCount = parseInt(data.rolls_count || 0);
          const rollsDiff = newRollsCount - oldRollsCount;

          const currentRolls = parseInt(item.rolls_count || 0);
          const updatedRolls = Math.max(0, currentRolls + rollsDiff);

          this.db.prepare(
            `UPDATE inventory SET item_name = ?, color_number = ?, total_meters = ?, purchase_price = ?, rolls_count = ?, unit = ? WHERE id = ?`
          ).run(
            data.description || item.item_name || "صنف",
            data.color_number || null,
            Math.max(0, updatedTotalMeters),
            newOrderPrice,
            updatedRolls,
            data.unit || "متر",
            oldInventoryItemId
          );
        }
      } else if (wasLinked && !isLinked) {
        const item = this.getInventoryById(oldInventoryItemId);
        if (item) {
          const oldQuantity = parseFloat(oldOrder.quantity || 0);
          const oldRollsCount = parseInt(oldOrder.rolls_count || 0);
          const currentTotalMeters = parseFloat(item.total_meters || 0);
          const currentRolls = parseInt(item.rolls_count || 0);
          
          this.db.prepare(
            `UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?`
          ).run(Math.max(0, currentTotalMeters - oldQuantity), Math.max(0, currentRolls - oldRollsCount), oldInventoryItemId);
        }
      } else if (!wasLinked && isLinked) {
        const item = this.getInventoryById(newInventoryItemId);
        if (item) {
          const newQuantity = parseFloat(data.quantity || 0);
          const newPrice = parseFloat(data.price || 0);
          const newRollsCount = parseInt(data.rolls_count || 0);

          const currentTotalMeters = parseFloat(item.total_meters || 0);
          const updatedTotalMeters = currentTotalMeters + newQuantity;

          const currentRolls = parseInt(item.rolls_count || 0);

          this.db.prepare(
            `UPDATE inventory SET total_meters = ?, purchase_price = ?, rolls_count = ?, unit = ? WHERE id = ?`
          ).run(updatedTotalMeters, newPrice, currentRolls + newRollsCount, data.unit || "متر", newInventoryItemId);
        }
      } else if (wasLinked && isLinked && oldInventoryItemId !== newInventoryItemId) {
        const oldItem = this.getInventoryById(oldInventoryItemId);
        if (oldItem) {
          const oldQuantity = parseFloat(oldOrder.quantity || 0);
          const oldRollsCount = parseInt(oldOrder.rolls_count || 0);
          const currentTotalMeters = parseFloat(oldItem.total_meters || 0);
          const currentRolls = parseInt(oldItem.rolls_count || 0);
          
          this.db.prepare(
            `UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?`
          ).run(Math.max(0, currentTotalMeters - oldQuantity), Math.max(0, currentRolls - oldRollsCount), oldInventoryItemId);
        }
        
        const newItem = this.getInventoryById(newInventoryItemId);
        if (newItem) {
          const newQuantity = parseFloat(data.quantity || 0);
          const newPrice = parseFloat(data.price || 0);
          const newRollsCount = parseInt(data.rolls_count || 0);

          const currentTotalMeters = parseFloat(newItem.total_meters || 0);
          const updatedTotalMeters = currentTotalMeters + newQuantity;

          const currentRolls = parseInt(newItem.rolls_count || 0);

          this.db.prepare(
            `UPDATE inventory SET total_meters = ?, purchase_price = ?, rolls_count = ?, unit = ? WHERE id = ?`
          ).run(updatedTotalMeters, newPrice, currentRolls + newRollsCount, data.unit || "متر", newInventoryItemId);
        }
      }

      this.updateSupplierTransactionByOrderId(idNum, data);
    });
    
    tx();
  }

  deleteSupplier(id) {
    try {
      const supplier = this.db
        .prepare("SELECT name FROM suppliers_info WHERE id = ?")
        .get(id);
      
      if (!supplier) {
        throw new Error("المورد غير موجود");
      }

      const tx = this.db.transaction(() => {
        try {
          if (this.tableExists("supplier_transactions")) {
            this.db
              .prepare("DELETE FROM supplier_transactions WHERE supplier_name = ?")
              .run(supplier.name);
          }
        } catch (e) {
          console.warn("Could not delete supplier_transactions:", e.message);
        }

        try {
          this.db
            .prepare("DELETE FROM suppliers WHERE name = ?")
            .run(supplier.name);
        } catch (e) {
          console.warn("Could not delete supplier orders:", e.message);
        }

        try {
          this.db
            .prepare("DELETE FROM supplier_payments WHERE supplier_name = ?")
            .run(supplier.name);
        } catch (e) {
          console.warn("Could not delete supplier payments:", e.message);
        }

        try {
          this.db.prepare("DELETE FROM suppliers_info WHERE id = ?").run(id);
        } catch (e) {
          console.warn("Could not delete supplier info:", e.message);
          throw e;
        }
      });

      tx();
      console.log(`Successfully deleted supplier: ${supplier.name}`);
    } catch (error) {
      console.error("Error in deleteSupplier:", error);
      throw error;
    }
  }

  deleteSupplierOrder(id) {
    const idNum = parseInt(String(id), 10);
    if (isNaN(idNum)) return;

    const order = this.db.prepare("SELECT * FROM suppliers WHERE id = ?").get(idNum);
    if (!order) return;

    const tx = this.db.transaction(() => {
      const inventoryItemId = order.inventory_item_id != null ? parseInt(order.inventory_item_id, 10) : null;
      const isLinked = inventoryItemId != null && (order.add_to_inventory === 1 || order.add_to_inventory === true);

      if (isLinked) {
        const item = this.getInventoryById(inventoryItemId);
        if (item) {
          const orderQuantity = parseFloat(order.quantity || 0);
          const orderPrice = parseFloat(order.price || 0);

          const currentMeters = parseFloat(item.total_meters || 0);
          const currentPurchasePrice = parseFloat(item.purchase_price || 0);
          const currentValue = currentMeters * currentPurchasePrice;
          const orderValue = orderQuantity * orderPrice;

          const newMeters = currentMeters - orderQuantity;

          let newPurchasePrice = parseFloat(item.purchase_price) || 0;
          if (newMeters > 0) {
            const newTotalValue = currentValue - orderValue;
            newPurchasePrice = newTotalValue > 0 ? newTotalValue / newMeters : 0;
          }

          const orderRolls = parseInt(order.rolls_count || 0);
          const currentRolls = parseInt(item.rolls_count || 0);
          const newRolls = Math.max(0, currentRolls - orderRolls);

          // إذا أصبحت الكمية صفر أو أقل بعد إلغاء الطلب: احذف الصنف من المخزون
          if (newMeters <= 0) {
            this.db.prepare("DELETE FROM inventory WHERE id = ?").run(inventoryItemId);
          } else {
            this.db
              .prepare(
                "UPDATE inventory SET total_meters = ?, purchase_price = ?, rolls_count = ? WHERE id = ?"
              )
              .run(newMeters, newPurchasePrice, newRolls, inventoryItemId);
          }
        }
      }

      // حذف طلب مورد من جدول suppliers
      this.db.prepare("DELETE FROM suppliers WHERE id = ?").run(idNum);

      // حذف من جدول المعاملات الموحدة
      this.deleteSupplierTransactionByOrderId(idNum);
    });

    tx();
  }

  getSupplierStatistics() {
    const stats = {
      totalSuppliers: 0,
      totalTransactions: 0,
      totalPaid: 0,
      totalRemaining: 0,
    };

    // Get total number of active suppliers
    const suppliersCount = this.db
      .prepare("SELECT COUNT(*) as count FROM suppliers_info")
      .get();
    stats.totalSuppliers = suppliersCount.count;

    // Calculate totals from supplier_transactions if available
    if (this.tableExists("supplier_transactions")) {
      const transactionStats = this.db
        .prepare(
          `
        SELECT 
          COALESCE(SUM(CASE WHEN type='order' THEN total ELSE 0 END), 0) as totalTransactions,
          COALESCE(SUM(CASE WHEN type='order' THEN paid ELSE 0 END) + 
                  SUM(CASE WHEN type='payment' THEN amount ELSE 0 END), 0) as totalPaid
        FROM supplier_transactions
      `
        )
        .get();

      stats.totalTransactions = transactionStats.totalTransactions;
      stats.totalPaid = transactionStats.totalPaid;
    } else {
      // Fallback to old tables if supplier_transactions doesn't exist
      const orderTotals = this.db
        .prepare(
          "SELECT COALESCE(SUM(total), 0) as total, COALESCE(SUM(paid), 0) as paid FROM suppliers"
        )
        .get();
      const extraPayments = this.db
        .prepare(
          "SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments"
        )
        .get();

      stats.totalTransactions = orderTotals.total;
      stats.totalPaid = orderTotals.paid + extraPayments.total;
    }

    // Calculate remaining amount
    stats.totalRemaining = Math.max(
      0,
      stats.totalTransactions - stats.totalPaid
    );

    return stats;
  }

  getAllInventory() {
    return this.db
      .prepare(
        `
      SELECT i.*, s.name as section_name 
      FROM inventory i 
      LEFT JOIN inventory_sections s ON i.section_id = s.id 
      WHERE i.section_id IS NOT NULL 
      ORDER BY i.id DESC
    `
      )
      .all();
  }

  getInventoryBySection(sectionId) {
    return this.db
      .prepare(
        `
      SELECT i.*, s.name as section_name 
      FROM inventory i 
      LEFT JOIN inventory_sections s ON i.section_id = s.id 
      WHERE i.section_id = ? 
      ORDER BY i.id DESC
    `
      )
      .all(sectionId);
  }

  getAllSections() {
    return this.db
      .prepare("SELECT * FROM inventory_sections ORDER BY name")
      .all();
  }

  getSectionById(id) {
    return this.db
      .prepare("SELECT * FROM inventory_sections WHERE id = ?")
      .get(id);
  }

  addSection(data) {
    if (!data.name || !data.name.trim()) {
      throw new Error("اسم القسم مطلوب");
    }

    // التحقق من عدم تكرار الاسم
    const existingSection = this.db
      .prepare(
        "SELECT id FROM inventory_sections WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))"
      )
      .get(data.name.trim());
    if (existingSection) {
      throw new Error("اسم القسم موجود بالفعل، اختر اسماً مختلفاً");
    }

    const stmt = this.db.prepare(
      "INSERT INTO inventory_sections (name, description) VALUES (?, ?)"
    );
    const result = stmt.run(data.name.trim(), data.description || "");
    return result.lastInsertRowid;
  }

  updateSection(id, data) {
    if (!data.name || !data.name.trim()) {
      throw new Error("اسم القسم مطلوب");
    }

    // التحقق من عدم تكرار الاسم (باستثناء القسم الحالي)
    const existingSection = this.db
      .prepare(
        "SELECT id FROM inventory_sections WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?"
      )
      .get(data.name.trim(), id);
    if (existingSection) {
      throw new Error("اسم القسم موجود بالفعل، اختر اسماً مختلفاً");
    }

    this.db
      .prepare("UPDATE inventory_sections SET name=?, description=? WHERE id=?")
      .run(data.name.trim(), data.description || "", id);
  }

  deleteSection(id) {
    // حذف جميع الأصناف في القسم أولاً
    this.db.prepare("DELETE FROM inventory WHERE section_id = ?").run(id);
    // ثم حذف القسم
    this.db.prepare("DELETE FROM inventory_sections WHERE id = ?").run(id);
  }

  addInventoryItem(data) {
    const stmt = this.db.prepare(
      `INSERT INTO inventory (item_name, section_id, color_number, rolls_count, total_meters, unit, purchase_price) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      data.item_name,
      data.section_id,
      data.color_number,
      data.rolls_count || null,
      data.total_meters,
      data.unit || "متر",
      parseFloat(data.purchase_price) || 0
    );
    return result.lastInsertRowid;
  }

  updateInventoryItem(id, data) {
    this.db
      .prepare(
        `UPDATE inventory SET item_name=?, section_id=?, color_number=?, rolls_count=?, total_meters=?, unit=?, purchase_price=? WHERE id=?`
      )
      .run(
        data.item_name,
        data.section_id,
        data.color_number,
        data.rolls_count || null,
        data.total_meters,
        data.unit || "متر",
        parseFloat(data.purchase_price) || 0,
        id
      );
  }

  deleteInventoryItem(id) {
    this.db.prepare("DELETE FROM inventory WHERE id = ?").run(id);
  }

  // Sales CRUD
  getAllSales() {
    this.ensureSalesTable();
    return this.db.prepare("SELECT * FROM sales ORDER BY id DESC").all();
  }

  getSalesByCustomerId(customerId) {
    this.ensureSalesTable();
    return this.db
      .prepare(
        "SELECT * FROM sales WHERE customer_id = ? ORDER BY global_sequence ASC"
      )
      .all(customerId);
  }

  getSalesByCustomerName(customerName) {
    this.ensureSalesTable();
    return this.db
      .prepare(
        "SELECT * FROM sales WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?)) ORDER BY global_sequence ASC"
      )
      .all(customerName);
  }

  addSale(data) {
    this.ensureSalesTable();
    const qty = parseFloat(data.quantity) || 0;
    const price = parseFloat(data.price) || 0;
    const paid = parseFloat(data.paid) || 0;
    const total =
      data.total !== undefined ? parseFloat(data.total) : qty * price;
    const remaining =
      data.remaining !== undefined ? parseFloat(data.remaining) : total - paid;

    let unitCost = 0;
    if (data.inventory_item_id) {
      const item = this.getInventoryById(data.inventory_item_id);
      if (item) {
        unitCost = parseFloat(item.purchase_price || 0);
        const newMeters = (item.total_meters || 0) - qty;
        if (newMeters >= 0) {
          const currentRolls = item.rolls_count || 0;
          const metersPerRoll =
            currentRolls > 0 ? item.total_meters / currentRolls : 0;
          let newRolls = currentRolls;
          if (metersPerRoll > 0) {
            newRolls = Math.max(0, Math.round(newMeters / metersPerRoll));
          }
          this.db
            .prepare(
              "UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?"
            )
            .run(newMeters, newRolls, data.inventory_item_id);
        }
      }
    }

    let customerId = data.customer_id || null;
    if (!customerId && data.customer_name) {
      const customer = this.getCustomerByNameAndPhone(data.customer_name, data.customer_phone);
      if (customer) {
        customerId = customer.id;
      }
    }

    const globalSequence = customerId ? this.getNextGlobalSequence("customer", customerId) : 1;
    const stmt = this.db.prepare(
      `INSERT INTO sales (global_sequence, customer_id, customer_name, description, inventory_item_id, quantity, unit, price, total, paid, remaining, date, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      globalSequence,
      customerId,
      data.customer_name || null,
      data.description || "",
      data.inventory_item_id || null,
      qty,
      data.unit || "متر",
      price,
      total,
      paid,
      remaining,
      data.date,
      unitCost
    );
    return result.lastInsertRowid;
  }

  updateSale(id, data) {
    this.ensureSalesTable();
    const oldSale = this.db.prepare("SELECT * FROM sales WHERE id = ?").get(id);

    const qty = parseFloat(data.quantity) || 0;
    const price = parseFloat(data.price) || 0;
    const paid = parseFloat(data.paid) || 0;
    const total =
      data.total !== undefined ? parseFloat(data.total) : qty * price;
    const remaining =
      data.remaining !== undefined ? parseFloat(data.remaining) : total - paid;

    const targetInventoryId = data.inventory_item_id || (oldSale ? oldSale.inventory_item_id : null);

    if (oldSale && oldSale.inventory_item_id) {
      const item = this.getInventoryById(oldSale.inventory_item_id);
      if (item) {
        let restoredMeters = (item.total_meters || 0) + (oldSale.quantity || 0);
        const currentRolls = item.rolls_count || 0;
        const metersPerRoll =
          currentRolls > 0 ? item.total_meters / currentRolls : 0;
        let newRolls = currentRolls;
        if (metersPerRoll > 0) {
          newRolls = Math.max(0, Math.round(restoredMeters / metersPerRoll));
        }
        this.db
          .prepare(
            "UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?"
          )
          .run(restoredMeters, newRolls, oldSale.inventory_item_id);
      }
    }

    let unitCost = 0;
    if (targetInventoryId) {
      const item = this.getInventoryById(targetInventoryId);
      if (item) {
        unitCost = parseFloat(item.purchase_price || 0);
        const newMeters = (item.total_meters || 0) - qty;
        if (newMeters >= 0) {
          const currentRolls = item.rolls_count || 0;
          const metersPerRoll =
            currentRolls > 0 ? item.total_meters / currentRolls : 0;
          let newRolls = currentRolls;
          if (metersPerRoll > 0) {
            newRolls = Math.max(0, Math.round(newMeters / metersPerRoll));
          }
          this.db
            .prepare(
              "UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?"
            )
            .run(newMeters, newRolls, targetInventoryId);
        }
      }
    }

    this.db
      .prepare(
        `UPDATE sales SET customer_name=?, description=?, inventory_item_id=?, quantity=?, unit=?, price=?, total=?, paid=?, remaining=?, date=?, unit_cost=? WHERE id=?`
      )
      .run(
        data.customer_name || null,
        data.description || "",
        targetInventoryId || null,
        qty,
        data.unit || "متر",
        price,
        total,
        paid,
        remaining,
        data.date,
        unitCost,
        id
      );
  }

  deleteSale(id) {
    this.ensureSalesTable();
    const sale = this.db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
    if (sale && sale.inventory_item_id) {
      const item = this.getInventoryById(sale.inventory_item_id);
      if (item) {
        const restoredMeters = (item.total_meters || 0) + (sale.quantity || 0);
        const currentRolls = item.rolls_count || 0;
        const metersPerRoll = currentRolls > 0 ? item.total_meters / currentRolls : 0;
        let newRolls = currentRolls;
        if (metersPerRoll > 0) {
          newRolls = Math.max(0, Math.round(restoredMeters / metersPerRoll));
        }
        this.db.prepare("UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?").run(restoredMeters, newRolls, sale.inventory_item_id);
      }
    }
    this.db.prepare("DELETE FROM sales WHERE id = ?").run(id);
  }

  // Expenses CRUD
  getAllExpenses() {
    this.ensureExpensesTable();
    return this.db.prepare("SELECT * FROM expenses ORDER BY id DESC").all();
  }

  addExpense(data) {
    this.ensureExpensesTable();
    const amount = parseFloat(data.amount) || 0;
    const direction = data.direction === "داخل" ? "داخل" : "خارج";
    const stmt = this.db.prepare(
      `INSERT INTO expenses (category, description, amount, date, direction) VALUES (?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      data.category || null,
      data.description || "",
      amount,
      data.date,
      direction
    );
    return result.lastInsertRowid;
  }

  updateExpense(id, data) {
    this.ensureExpensesTable();
    const amount = parseFloat(data.amount) || 0;
    const direction = data.direction === "داخل" ? "داخل" : "خارج";
    this.db
      .prepare(
        `UPDATE expenses SET category=?, description=?, amount=?, date=?, direction=? WHERE id=?`
      )
      .run(
        data.category || null,
        data.description || "",
        amount,
        data.date,
        direction,
        id
      );
  }

  deleteExpense(id) {
    this.ensureExpensesTable();
    this.db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  }

  getAllReturnedOrders() {
    this.ensureReturnedOrdersTable();
    return this.db.prepare("SELECT * FROM returned_orders ORDER BY id DESC").all();
  }

  getReturnedOrdersByCustomerId(customerId) {
    this.ensureReturnedOrdersTable();
    return this.db
      .prepare(
        "SELECT * FROM returned_orders WHERE customer_id = ? ORDER BY global_sequence ASC"
      )
      .all(customerId);
  }

  getReturnedOrdersByCustomerName(customerName) {
    this.ensureReturnedOrdersTable();
    return this.db
      .prepare(
        "SELECT * FROM returned_orders WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?)) ORDER BY global_sequence ASC"
      )
      .all(customerName);
  }

  addReturnedOrder(data) {
    this.ensureReturnedOrdersTable();
    const qty = parseFloat(data.quantity) || 0;
    const price = parseFloat(data.price) || 0;
    
    let customerId = data.customer_id || null;
    if (!customerId && data.customer_name) {
      const customer = this.getCustomerByNameAndPhone(data.customer_name, data.customer_phone);
      if (customer) {
        customerId = customer.id;
      }
    }
    
    const globalSequence = customerId ? this.getNextGlobalSequence("customer", customerId) : 1;

    if (data.add_to_inventory && data.inventory_item_id) {
      const item = this.getInventoryById(data.inventory_item_id);
      if (item) {
        const newMeters = (item.total_meters || 0) + qty;
        const currentRolls = item.rolls_count || 0;
        const metersPerRoll = currentRolls > 0 ? item.total_meters / currentRolls : 0;
        let newRolls = currentRolls;
        if (metersPerRoll > 0) {
          newRolls = Math.max(0, Math.round(newMeters / metersPerRoll));
        } else {
          newRolls = currentRolls;
        }
        this.db
          .prepare("UPDATE inventory SET total_meters = ?, rolls_count = ?, unit = ? WHERE id = ?")
          .run(newMeters, newRolls, data.unit || "متر", data.inventory_item_id);
      }
    }

    const stmt = this.db.prepare(
      `INSERT INTO returned_orders (global_sequence, customer_id, customer_name, description, quantity, unit, price, inventory_item_id, section_id, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      globalSequence,
      customerId,
      data.customer_name || null,
      data.description || "",
      qty,
      data.unit || "متر",
      price,
      data.inventory_item_id || null,
      data.section_id || null,
      data.date
    );
    return result.lastInsertRowid;
  }

  updateReturnedOrder(id, data) {
    this.ensureReturnedOrdersTable();
    const oldReturned = this.db.prepare("SELECT * FROM returned_orders WHERE id = ?").get(id);

    const qty = parseFloat(data.quantity) || 0;
    const price = parseFloat(data.price) || 0;

    if (oldReturned && oldReturned.inventory_item_id) {
      const item = this.getInventoryById(oldReturned.inventory_item_id);
      if (item) {
        const restoredMeters = (item.total_meters || 0) - (oldReturned.quantity || 0);
        const currentRolls = item.rolls_count || 0;
        const metersPerRoll = currentRolls > 0 ? item.total_meters / currentRolls : 0;
        let newRolls = currentRolls;
        if (metersPerRoll > 0) {
          newRolls = Math.max(0, Math.round(restoredMeters / metersPerRoll));
        }
        this.db
          .prepare("UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?")
          .run(restoredMeters, newRolls, oldReturned.inventory_item_id);
      }
    }

    const targetInventoryId = data.inventory_item_id || (oldReturned ? oldReturned.inventory_item_id : null);

    if (targetInventoryId) {
      const item = this.getInventoryById(targetInventoryId);
      if (item) {
        const newMeters = (item.total_meters || 0) + qty;
        const currentRolls = item.rolls_count || 0;
        const metersPerRoll = currentRolls > 0 ? item.total_meters / currentRolls : 0;
        let newRolls = currentRolls;
        if (metersPerRoll > 0) {
          newRolls = Math.max(0, Math.round(newMeters / metersPerRoll));
        }
        this.db
          .prepare("UPDATE inventory SET total_meters = ?, rolls_count = ?, unit = ? WHERE id = ?")
          .run(newMeters, newRolls, data.unit || "متر", targetInventoryId);
      }
    }

    this.db
      .prepare(
        `UPDATE returned_orders SET customer_name=?, description=?, quantity=?, unit=?, price=?, inventory_item_id=?, section_id=?, date=? WHERE id=?`
      )
      .run(
        data.customer_name || null,
        data.description || "",
        qty,
        data.unit || "متر",
        price,
        targetInventoryId || null,
        data.section_id || null,
        data.date,
        id
      );
  }

  deleteReturnedOrder(id) {
    this.ensureReturnedOrdersTable();
    const returned = this.db.prepare("SELECT * FROM returned_orders WHERE id = ?").get(id);
    if (returned && returned.inventory_item_id) {
      const item = this.getInventoryById(returned.inventory_item_id);
      if (item) {
        const newMeters = (item.total_meters || 0) - (returned.quantity || 0);
        const currentRolls = item.rolls_count || 0;
        const metersPerRoll = currentRolls > 0 ? item.total_meters / currentRolls : 0;
        let newRolls = currentRolls;
        if (metersPerRoll > 0) {
          newRolls = Math.max(0, Math.round(newMeters / metersPerRoll));
        }
        this.db
          .prepare("UPDATE inventory SET total_meters = ?, rolls_count = ? WHERE id = ?")
          .run(newMeters, newRolls, returned.inventory_item_id);
      }
    }
    this.db.prepare("DELETE FROM returned_orders WHERE id = ?").run(id);
  }

  getSettings() {
    return (
      this.db.prepare("SELECT * FROM settings WHERE id = 1").get() || {
        app_name: "M.G – نظام إدارة محل الأقمشة",
        theme: "dark",
        notification_threshold: 2,
      }
    );
  }

  updateSettings(data) {
    const updates = [];
    const values = [];

    if (data.app_name !== undefined) {
      updates.push("app_name=?");
      values.push(data.app_name);
    }
    if (data.theme !== undefined) {
      updates.push("theme=?");
      values.push(data.theme);
    }
    if (data.notification_threshold !== undefined) {
      updates.push("notification_threshold=?");
      values.push(data.notification_threshold);
    }

    if (updates.length > 0) {
      values.push(1);
      this.db
        .prepare(`UPDATE settings SET ${updates.join(", ")} WHERE id=?`)
        .run(...values);
    }
  }

  resetDatabase() {
    try {
      // حذف البيانات من الجداول الموجودة فقط
      const tablesToReset = [
        "customers",
        "suppliers_info",
        "suppliers",
        "inventory",
        "inventory_sections",
        "sales",
        "expenses",
        "payments",
        "returned_orders",
        "supplier_payments",
        "users",
        "supplier_transactions",
      ];

      for (const tableName of tablesToReset) {
        if (this.tableExists(tableName)) {
          console.log(`Clearing table: ${tableName}`);
          this.db.prepare(`DELETE FROM ${tableName}`).run();

          // إعادة تعيين AUTO_INCREMENT للجداول التي لها تسلسل
          try {
            this.db
              .prepare(`DELETE FROM sqlite_sequence WHERE name="${tableName}"`)
              .run();
          } catch (seqError) {
            console.log(`No sequence to reset for table: ${tableName}`);
          }
        }
      }

      // تحديث الإعدادات إذا كان الجدول موجود
      if (this.tableExists("settings")) {
        console.log("Updating settings to defaults");
        this.db
          .prepare(
            "UPDATE settings SET app_name = ?, theme = ?, notification_threshold = ? WHERE id = 1"
          )
          .run("M.G – نظام إدارة محل الأقمشة", "dark", 2);
      }

      console.log("Database reset completed successfully");
    } catch (error) {
      console.error("Error during database reset:", error);
      throw error;
    }
  }

  getDefaultStatistics() {
    console.log("إرجاع إحصائيات افتراضية بسبب خطأ في قاعدة البيانات");
    return {
      customersCount: 0, suppliersCount: 0, inventoryCount: 0, sectionsCount: 0,
      customersTotal: 0, customersPaid: 0, customersRemaining: 0, customersCreditTotal: 0, customersWithRemaining: 0,
      suppliersTotal: 0, suppliersPaid: 0, suppliersRemaining: 0, suppliersCreditTotal: 0, suppliersOrdersCount: 0,
      inventoryTotalMeters: 0, inventoryTotalKilos: 0,
      salesCount: 0, salesTotal: 0, returnedTotal: 0, returnedCount: 0, netSalesTotal: 0, salesPaid: 0, salesRemaining: 0, salesHighest: 0, salesUniqueCustomers: 0,
      expensesCount: 0, expensesTotal: 0, expensesInside: 0, expensesOutside: 0, expensesAverage: 0, expensesHighest: 0,
      expensesToday: 0, expensesThisWeek: 0, expensesThisMonth: 0, expensesThisYear: 0,
      expensesPeriods: { today: { count: 0, inside: 0, outside: 0 }, week: { count: 0, inside: 0, outside: 0 }, month: { count: 0, inside: 0, outside: 0 }, year: { count: 0, inside: 0, outside: 0 } },
      salesPeriods: { today: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 }, week: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 }, month: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 }, year: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 } },
      netIncome: 0, netProfit: 0, netLoss: 0, costOfSoldItems: 0, costOfReturned: 0, netCostOfSoldItems: 0,
      totalSalesPaid: 0, totalSuppliersPaid: 0,
      lowInventoryItems: [], topSelling: [],
      averageSaleValue: 0, averageExpenseValue: 0, paymentRate: 0, profitMargin: 0, grossProfit: 0, grossProfitMargin: 0
    };
  }

  /**
   * حساب إجمالي المتبقي من العملاء بناءً على مسح كامل لكل كشف حساب
   * نفس منطق صفحة كشف الحساب: لكل عميل المستحق - المرتجعات - المسدد
   * يُجمع الباقي فقط لو balance > 0، ويُجمع له مبلغ لو balance < 0
   */
  getCustomersBalanceFromAccountStatements() {
    this.ensureSalesTable();
    this.ensurePaymentsTable();
    this.ensureReturnedOrdersTable();
    const distinctCustomerIds = this.db
      .prepare(
        `SELECT DISTINCT customer_id FROM (
          SELECT customer_id FROM sales WHERE customer_id IS NOT NULL
          UNION SELECT customer_id FROM payments WHERE customer_id IS NOT NULL
          UNION SELECT customer_id FROM returned_orders WHERE customer_id IS NOT NULL
        )`
      )
      .all()
      .map((r) => r.customer_id);
    const seenIds = new Set(distinctCustomerIds);
    let remaining = 0;
    let creditTotal = 0;
    let totalNet = 0;
    let withRemaining = 0;
    for (const customerId of seenIds) {
      const sales = this.getSalesByCustomerId(customerId);
      const payments = this.getPaymentsByCustomerId(customerId);
      const returnedOrders = this.getReturnedOrdersByCustomerId(customerId);
      let total = 0;
      let paid = 0;
      let returnedSum = 0;
      for (const o of sales) {
        total += o.total || 0;
        paid += o.paid || 0;
      }
      for (const p of payments) {
        paid += p.amount || 0;
      }
      for (const r of returnedOrders) {
        returnedSum += (r.quantity || 0) * (r.price || 0);
      }
      const totalOwed = total - returnedSum;
      totalNet += totalOwed;
      const balance = totalOwed - paid;
      if (balance > 0) {
        remaining += balance;
        withRemaining += 1;
      } else if (balance < 0) {
        creditTotal += Math.abs(balance);
      }
    }
    return { remaining, creditTotal, totalNet, withRemaining };
  }

  getStatistics() {
    try {
      // التحقق من وجود قاعدة البيانات والاتصال بها
      if (!this.db) {
        console.error("قاعدة البيانات غير متصلة");
        return this.getDefaultStatistics();
      }

      // التحقق من وجود الجداول الأساسية
      const requiredTables = ['customers', 'suppliers_info', 'inventory', 'inventory_sections', 'sales', 'payments'];
      for (const table of requiredTables) {
        if (!this.tableExists(table)) {
          console.error(`الجدول ${table} غير موجود`);
          return this.getDefaultStatistics();
        }
      }

      this.ensureSalesTable();
      this.ensureExpensesTable();
      this.ensurePaymentsTable();
      this.ensureReturnedOrdersTable();

      console.log("بدء حساب الإحصائيات...");
      
      const customersCount = this.db
        .prepare("SELECT COUNT(*) as count FROM customers")
        .get().count;
      // عدد الموردين من جدول suppliers_info
      const suppliersCount = this.db
        .prepare("SELECT COUNT(*) as count FROM suppliers_info")
        .get().count;
      const inventoryCount = this.db
        .prepare(
          "SELECT COUNT(*) as count FROM inventory WHERE section_id IS NOT NULL"
        )
        .get().count;
      const sectionsCount = this.db
        .prepare("SELECT COUNT(*) as count FROM inventory_sections")
        .get().count;

      // جلب بيانات العملاء من كشوفات العملاء الفعلية (payments + sales + مرتجعات)
      // إجمالي مستحقات العملاء = مبيعات − مرتجعات (يُحسب لاحقاً مع الرصيد)

      // المدفوع من العملاء (من المبيعات + الدفعات المنفصلة)
      const customersSalesPaidRow = this.db
        .prepare("SELECT SUM(paid) as sum FROM sales")
        .get();
      const paymentsPaidRow = this.db
        .prepare("SELECT SUM(amount) as sum FROM payments")
        .get();
      const customersPaid =
        (customersSalesPaidRow.sum || 0) + (paymentsPaidRow.sum || 0);

      // إجمالي المتبقي: اسكان كامل لكل كشف حساب عميل (نفس منطق صفحة كشف الحساب)
      const balanceResult = this.getCustomersBalanceFromAccountStatements();
      const customersRemaining = balanceResult.remaining;
      const customersWithRemaining = balanceResult.withRemaining;
      const customersCreditTotal = balanceResult.creditTotal;
      const customersTotal = balanceResult.totalNet;

      // عدد العملاء الذين لهم مبلغ متبقي
      // const customersWithRemainingRow = this.db.prepare('SELECT COUNT(DISTINCT customer_name) as count FROM sales WHERE remaining > 0').get()
      // const customersWithRemaining = customersWithRemainingRow.count || 0

      // إحصائيات الموردين: نفضّل الجدول الموحّد supplier_transactions إن وُجد لتفادي أي ازدواج
      let suppliersTotal = 0;
      let totalSuppliersPaid = 0;
      let suppliersOrdersCount = 0;

      // التحقق من وجود موردين فعليين أولاً
      const actualSuppliersCount =
        this.db.prepare("SELECT COUNT(*) as count FROM suppliers_info").get()
          .count || 0;

      if (actualSuppliersCount === 0) {
        // إذا لم توجد موردين، فجميع الإحصائيات يجب أن تكون 0
        suppliersTotal = 0;
        totalSuppliersPaid = 0;
        suppliersOrdersCount = 0;
      } else if (this.tableExists("supplier_transactions")) {
        const transactionCount =
          this.db
            .prepare("SELECT COUNT(*) as count FROM supplier_transactions")
            .get().count || 0;
        if (transactionCount > 0) {
          const row = this.db
            .prepare(
              `
            SELECT 
              COALESCE(SUM(CASE WHEN type='order' THEN total ELSE 0 END),0) AS orders_total,
              COALESCE(SUM(CASE WHEN type='order' THEN paid ELSE 0 END),0) AS orders_paid,
              COALESCE(SUM(CASE WHEN type='payment' THEN amount ELSE 0 END),0) AS payments_total,
              COALESCE(COUNT(CASE WHEN type='order' THEN 1 END),0) AS orders_count
            FROM supplier_transactions
          `
            )
            .get();
          suppliersTotal = row.orders_total || 0;
          totalSuppliersPaid = (row.orders_paid || 0) + (row.payments_total || 0);
          suppliersOrdersCount = row.orders_count || 0;
        } else {
          suppliersTotal = 0;
          totalSuppliersPaid = 0;
          suppliersOrdersCount = 0;
        }
      } else {
        const suppliersCount =
          this.db.prepare("SELECT COUNT(*) as count FROM suppliers").get()
            .count || 0;
        if (suppliersCount > 0) {
          const suppliersTotalRow = this.db
            .prepare("SELECT SUM(total) as sum FROM suppliers")
            .get();
          suppliersTotal = suppliersTotalRow.sum || 0;
          const suppliersPaidOrdersRow = this.db
            .prepare("SELECT SUM(paid) as sum FROM suppliers")
            .get();
          const supplierPaymentsRow = this.db
            .prepare("SELECT SUM(amount) as sum FROM supplier_payments")
            .get();
          totalSuppliersPaid =
            (suppliersPaidOrdersRow.sum || 0) + (supplierPaymentsRow.sum || 0);
          suppliersOrdersCount =
            this.db
              .prepare("SELECT COUNT(DISTINCT name) as count FROM suppliers")
              .get().count || 0;
        } else {
          suppliersTotal = 0;
          totalSuppliersPaid = 0;
          suppliersOrdersCount = 0;
        }
      }

      // المتبقي للموردين = إجمالي طلبات الموردين - جميع المدفوعات للموردين
      const suppliersRemaining = Math.max(0, suppliersTotal - totalSuppliersPaid);

      // المبلغ العند الموردين لك (إذا دفعت أكثر من إجمالي الطلبات)
      const suppliersCreditTotal = Math.max(
        0,
        totalSuppliersPaid - suppliersTotal
      );

      const inventoryTotalMetersRow = this.db
        .prepare(
          "SELECT SUM(total_meters) as sum FROM inventory WHERE (unit = 'متر' OR unit IS NULL) AND section_id IS NOT NULL"
        )
        .get();
      const inventoryTotalMeters = inventoryTotalMetersRow.sum || 0;

      const inventoryTotalKilosRow = this.db
        .prepare(
          "SELECT SUM(total_meters) as sum FROM inventory WHERE unit = 'كيلو' AND section_id IS NOT NULL"
        )
        .get();
      const inventoryTotalKilos = inventoryTotalKilosRow.sum || 0;

      let returnedTotal = 0;
      let returnedCount = 0;
      try {
        const returnedTotalRow = this.db
          .prepare(
            "SELECT COALESCE(SUM(quantity * price), 0) as sum, COUNT(*) as count FROM returned_orders"
          )
          .get();
        returnedTotal = returnedTotalRow?.sum || 0;
        returnedCount = returnedTotalRow?.count || 0;
      } catch (e) {
        console.warn("getStatistics: returnedTotal fallback", e?.message);
      }

      // Sales statistics
      const salesCountRow = this.db
        .prepare("SELECT COUNT(*) as count FROM sales")
        .get();
      const salesCount = salesCountRow.count || 0;

      const salesTotalRow = this.db
        .prepare("SELECT SUM(total) as sum FROM sales")
        .get();
      const salesTotal = salesTotalRow.sum || 0;

      const salesPaidRow = this.db
        .prepare("SELECT SUM(paid) as sum FROM sales")
        .get();
      const salesPaidFromOrdersAll = salesPaidRow.sum || 0;
      const paymentsPaidRowAll = this.db
        .prepare("SELECT SUM(amount) as sum FROM payments")
        .get();
      const paymentsPaidAll = paymentsPaidRowAll.sum || 0;
      const salesPaid = salesPaidFromOrdersAll + paymentsPaidAll;

      const netSalesTotal = Math.max(0, salesTotal - returnedTotal);
      const salesRemaining = Math.max(0, netSalesTotal - salesPaid);

      const salesHighestRow = this.db
        .prepare("SELECT MAX(total) as max FROM sales")
        .get();
      const salesHighest = salesHighestRow.max || 0;

      const salesUniqueCustomersRow = this.db
        .prepare("SELECT COUNT(DISTINCT customer_name) as count FROM sales")
        .get();
      const salesUniqueCustomers = salesUniqueCustomersRow.count || 0;

      // Expenses statistics
      const expensesCountRow = this.db
        .prepare("SELECT COUNT(*) as count FROM expenses")
        .get();
      const expensesCount = expensesCountRow.count || 0;

      const expensesTotalRow = this.db
        .prepare(
          "SELECT SUM(CASE WHEN direction='داخل' THEN -amount ELSE amount END) as sum FROM expenses"
        )
        .get();
      const expensesTotal = expensesTotalRow.sum || 0;

      const expensesHighestRow = this.db
        .prepare("SELECT MAX(amount) as max FROM expenses")
        .get();
      const expensesHighest = expensesHighestRow.max || 0;

      const expensesAverage =
        expensesCount > 0 ? expensesTotal / expensesCount : 0;

      // Expenses by time period
      const today = new Date().toISOString().split("T")[0];
      const expensesTodayRow = this.db
        .prepare("SELECT SUM(amount) as sum FROM expenses WHERE date = ?")
        .get(today);
      const expensesToday = expensesTodayRow.sum || 0;

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const expensesThisWeekRow = this.db
        .prepare("SELECT SUM(amount) as sum FROM expenses WHERE date >= ?")
        .get(oneWeekAgo);
      const expensesThisWeek = expensesThisWeekRow.sum || 0;

      const firstDayOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
        .toISOString()
        .split("T")[0];
      const expensesThisMonthRow = this.db
        .prepare("SELECT SUM(amount) as sum FROM expenses WHERE date >= ?")
        .get(firstDayOfMonth);
      const expensesThisMonth = expensesThisMonthRow.sum || 0;

      const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1)
        .toISOString()
        .split("T")[0];
      const expensesThisYearRow = this.db
        .prepare("SELECT SUM(amount) as sum FROM expenses WHERE date >= ?")
        .get(firstDayOfYear);
      const expensesThisYear = expensesThisYearRow.sum || 0;

    // Period summaries (simple): counts and inside/outside totals
    const expCountToday =
      this.db
        .prepare("SELECT COUNT(*) as c FROM expenses WHERE date = ?")
        .get(today).c || 0;
    const expInsideToday =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE date = ? AND direction='داخل'"
        )
        .get(today).s || 0;
    const expOutsideToday =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE date = ? AND direction='خارج'"
        )
        .get(today).s || 0;

    const expCountWeek =
      this.db
        .prepare("SELECT COUNT(*) as c FROM expenses WHERE date >= ?")
        .get(oneWeekAgo).c || 0;
    const expInsideWeek =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE date >= ? AND direction='داخل'"
        )
        .get(oneWeekAgo).s || 0;
    const expOutsideWeek =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE date >= ? AND direction='خارج'"
        )
        .get(oneWeekAgo).s || 0;

    const expCountMonth =
      this.db
        .prepare("SELECT COUNT(*) as c FROM expenses WHERE date >= ?")
        .get(firstDayOfMonth).c || 0;
    const expInsideMonth =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE date >= ? AND direction='داخل'"
        )
        .get(firstDayOfMonth).s || 0;
    const expOutsideMonth =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE date >= ? AND direction='خارج'"
        )
        .get(firstDayOfMonth).s || 0;

    const expCountYear =
      this.db
        .prepare("SELECT COUNT(*) as c FROM expenses WHERE date >= ?")
        .get(firstDayOfYear).c || 0;
    const expInsideYear =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE date >= ? AND direction='داخل'"
        )
        .get(firstDayOfYear).s || 0;
    const expOutsideYear =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as s FROM expenses WHERE date >= ? AND direction='خارج'"
        )
        .get(firstDayOfYear).s || 0;

    const salesCountToday =
      this.db
        .prepare("SELECT COUNT(*) as c FROM sales WHERE date = ?")
        .get(today).c || 0;
    const salesTotalToday =
      this.db
        .prepare("SELECT COALESCE(SUM(total),0) as s FROM sales WHERE date = ?")
        .get(today).s || 0;
    const salesPaidTodayFromOrders =
      this.db
        .prepare("SELECT COALESCE(SUM(paid),0) as s FROM sales WHERE date = ?")
        .get(today).s || 0;
    const paymentsPaidToday =
      this.db
        .prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE date = ?")
        .get(today).s || 0;
    const salesPaidToday = salesPaidTodayFromOrders + paymentsPaidToday;

    const salesCountWeek =
      this.db
        .prepare("SELECT COUNT(*) as c FROM sales WHERE date >= ?")
        .get(oneWeekAgo).c || 0;
    const salesTotalWeek =
      this.db
        .prepare("SELECT COALESCE(SUM(total),0) as s FROM sales WHERE date >= ?")
        .get(oneWeekAgo).s || 0;
    const salesPaidWeekFromOrders =
      this.db
        .prepare("SELECT COALESCE(SUM(paid),0) as s FROM sales WHERE date >= ?")
        .get(oneWeekAgo).s || 0;
    const paymentsPaidWeek =
      this.db
        .prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE date >= ?")
        .get(oneWeekAgo).s || 0;
    const salesPaidWeek = salesPaidWeekFromOrders + paymentsPaidWeek;

    const salesCountMonth =
      this.db
        .prepare("SELECT COUNT(*) as c FROM sales WHERE date >= ?")
        .get(firstDayOfMonth).c || 0;
    const salesTotalMonth =
      this.db
        .prepare("SELECT COALESCE(SUM(total),0) as s FROM sales WHERE date >= ?")
        .get(firstDayOfMonth).s || 0;
    const salesPaidMonthFromOrders =
      this.db
        .prepare("SELECT COALESCE(SUM(paid),0) as s FROM sales WHERE date >= ?")
        .get(firstDayOfMonth).s || 0;
    const paymentsPaidMonth =
      this.db
        .prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE date >= ?")
        .get(firstDayOfMonth).s || 0;
    const salesPaidMonth = salesPaidMonthFromOrders + paymentsPaidMonth;

    const salesCountYear =
      this.db
        .prepare("SELECT COUNT(*) as c FROM sales WHERE date >= ?")
        .get(firstDayOfYear).c || 0;
    const salesTotalYear =
      this.db
        .prepare("SELECT COALESCE(SUM(total),0) as s FROM sales WHERE date >= ?")
        .get(firstDayOfYear).s || 0;
    const salesPaidYearFromOrders =
      this.db
        .prepare("SELECT COALESCE(SUM(paid),0) as s FROM sales WHERE date >= ?")
        .get(firstDayOfYear).s || 0;
    const paymentsPaidYear =
      this.db
        .prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE date >= ?")
        .get(firstDayOfYear).s || 0;
    const salesPaidYear = salesPaidYearFromOrders + paymentsPaidYear;

    let returnedTotalToday = 0, returnedTotalWeek = 0, returnedTotalMonth = 0, returnedTotalYear = 0;
    try {
      const returnedTotalTodayRow = this.db
        .prepare("SELECT COALESCE(SUM(quantity * price), 0) as s FROM returned_orders WHERE date = ?")
        .get(today);
      returnedTotalToday = returnedTotalTodayRow?.s || 0;
      const returnedTotalWeekRow = this.db
        .prepare("SELECT COALESCE(SUM(quantity * price), 0) as s FROM returned_orders WHERE date >= ?")
        .get(oneWeekAgo);
      returnedTotalWeek = returnedTotalWeekRow?.s || 0;
      const returnedTotalMonthRow = this.db
        .prepare("SELECT COALESCE(SUM(quantity * price), 0) as s FROM returned_orders WHERE date >= ?")
        .get(firstDayOfMonth);
      returnedTotalMonth = returnedTotalMonthRow?.s || 0;
      const returnedTotalYearRow = this.db
        .prepare("SELECT COALESCE(SUM(quantity * price), 0) as s FROM returned_orders WHERE date >= ?")
        .get(firstDayOfYear);
      returnedTotalYear = returnedTotalYearRow?.s || 0;
    } catch (e) {
      console.warn("getStatistics: returned period fallback", e?.message);
    }

    const netSalesTotalToday = Math.max(0, salesTotalToday - returnedTotalToday);
    const netSalesTotalWeek = Math.max(0, salesTotalWeek - returnedTotalWeek);
    const netSalesTotalMonth = Math.max(0, salesTotalMonth - returnedTotalMonth);
    const netSalesTotalYear = Math.max(0, salesTotalYear - returnedTotalYear);

    const salesRemainingToday = Math.max(0, netSalesTotalToday - salesPaidToday);
    const salesRemainingWeek = Math.max(0, netSalesTotalWeek - salesPaidWeek);
    const salesRemainingMonth = Math.max(0, netSalesTotalMonth - salesPaidMonth);
    const salesRemainingYear = Math.max(0, netSalesTotalYear - salesPaidYear);

    // تجميع حسب السنة (مبيعات + مصروفات + موردين)
    let yearsQuery = `
      SELECT DISTINCT strftime('%Y', date) AS year FROM (
        SELECT date FROM sales
        UNION ALL
        SELECT date FROM payments
        UNION ALL
        SELECT date FROM expenses
        UNION ALL
        SELECT date FROM returned_orders`;
    
    if (this.tableExists('supplier_transactions')) {
      yearsQuery += `
        UNION ALL
        SELECT date FROM supplier_transactions`;
    } else if (this.tableExists('suppliers')) {
      yearsQuery += `
        UNION ALL
        SELECT date FROM suppliers`;
    }
    
    yearsQuery += `
      )
      WHERE year IS NOT NULL
      ORDER BY year DESC
    `;
    
    const yearsRows = this.db.prepare(yearsQuery).all() || [];

    const statsByYear = {};
    const years = [];

    for (const yr of yearsRows) {
      if (!yr.year) continue;
      years.push(yr.year);

      const salesYear = this.db
        .prepare(
          `
            SELECT 
              COUNT(*) AS count,
              COALESCE(SUM(total),0) AS total,
              COALESCE(SUM(paid),0) AS paid
            FROM sales
            WHERE strftime('%Y', date) = ?
          `
        )
        .get(yr.year);

      const returnedYear = this.db
        .prepare(
          "SELECT COALESCE(SUM(quantity * price), 0) AS sum FROM returned_orders WHERE strftime('%Y', date) = ?"
        )
        .get(yr.year);
      const returnedYearTotal = returnedYear?.sum || 0;
      const netSalesYear = Math.max(0, (salesYear.total || 0) - returnedYearTotal);

      const paymentsYear = this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) AS sum FROM payments WHERE strftime('%Y', date) = ?"
        )
        .get(yr.year);

      const salesPaidYearAgg = (salesYear.paid || 0) + (paymentsYear.sum || 0);
      const salesRemainingYearAgg = Math.max(0, netSalesYear - salesPaidYearAgg);

      // مصروفات السنة
      const expensesYear = this.db
        .prepare(
          `
            SELECT 
              COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN direction='داخل' THEN amount ELSE 0 END),0) AS inside,
              COALESCE(SUM(CASE WHEN direction='خارج' THEN amount ELSE 0 END),0) AS outside
            FROM expenses
            WHERE strftime('%Y', date) = ?
          `
        )
        .get(yr.year);

      // حساب بيانات العملاء حسب السنة: اسكان كامل لكل كشف حساب عميل له معاملات في السنة
      const distinctCustomerIdsYear = this.db
        .prepare(
          `SELECT DISTINCT customer_id FROM (
            SELECT customer_id FROM sales WHERE customer_id IS NOT NULL AND strftime('%Y', date) = ?
            UNION SELECT customer_id FROM payments WHERE customer_id IS NOT NULL AND strftime('%Y', date) = ?
            UNION SELECT customer_id FROM returned_orders WHERE customer_id IS NOT NULL AND strftime('%Y', date) = ?
          )`
        )
        .all(yr.year, yr.year, yr.year)
        .map((r) => r.customer_id);
      const seenIdsYear = new Set(distinctCustomerIdsYear);
      let customersRemainingYear = 0;
      let customersCreditTotalYear = 0;
      let customersTotalNetYear = 0;
      let customersPaidYear = 0;

      for (const customerId of seenIdsYear) {
        const salesYear = this.db
          .prepare("SELECT * FROM sales WHERE customer_id = ? AND strftime('%Y', date) = ?")
          .all(customerId, yr.year);
        const paymentsYear = this.db
          .prepare("SELECT * FROM payments WHERE customer_id = ? AND strftime('%Y', date) = ?")
          .all(customerId, yr.year);
        const returnedYear = this.db
          .prepare("SELECT * FROM returned_orders WHERE customer_id = ? AND strftime('%Y', date) = ?")
          .all(customerId, yr.year);

        let total = 0;
        let paid = 0;
        let returnedSum = 0;

        for (const o of salesYear) {
          total += o.total || 0;
          paid += o.paid || 0;
        }
        for (const p of paymentsYear) {
          paid += p.amount || 0;
        }
        for (const r of returnedYear) {
          returnedSum += (r.quantity || 0) * (r.price || 0);
        }

        const totalOwed = total - returnedSum;
        customersTotalNetYear += totalOwed;
        customersPaidYear += paid;
        const balance = totalOwed - paid;

        if (balance > 0) {
          customersRemainingYear += balance;
        } else if (balance < 0) {
          customersCreditTotalYear += Math.abs(balance);
        }
      }

      // حساب بيانات الموردين حسب السنة
      let suppliersTotalYear = 0;
      let totalSuppliersPaidYear = 0;
      let suppliersOrdersCountYear = 0;
      let suppliersRemainingYear = 0;
      let suppliersCreditTotalYear = 0;

      if (this.tableExists("supplier_transactions")) {
        const supplierYearRow = this.db
          .prepare(
            `
            SELECT 
              COALESCE(SUM(CASE WHEN type='order' THEN total ELSE 0 END),0) AS orders_total,
              COALESCE(SUM(CASE WHEN type='order' THEN paid ELSE 0 END),0) AS orders_paid,
              COALESCE(SUM(CASE WHEN type='payment' THEN amount ELSE 0 END),0) AS payments_total,
              COALESCE(COUNT(CASE WHEN type='order' THEN 1 END),0) AS orders_count
            FROM supplier_transactions
            WHERE strftime('%Y', date) = ?
          `
          )
          .get(yr.year);
        suppliersTotalYear = supplierYearRow.orders_total || 0;
        totalSuppliersPaidYear = (supplierYearRow.orders_paid || 0) + (supplierYearRow.payments_total || 0);
        suppliersOrdersCountYear = supplierYearRow.orders_count || 0;
      } else if (this.tableExists("suppliers")) {
        const suppliersYearTotalRow = this.db
          .prepare("SELECT SUM(total) as sum FROM suppliers WHERE strftime('%Y', date) = ?")
          .get(yr.year);
        suppliersTotalYear = suppliersYearTotalRow.sum || 0;
        const suppliersYearPaidRow = this.db
          .prepare("SELECT SUM(paid) as sum FROM suppliers WHERE strftime('%Y', date) = ?")
          .get(yr.year);
        const supplierPaymentsYearRow = this.db
          .prepare("SELECT SUM(amount) as sum FROM supplier_payments WHERE strftime('%Y', date) = ?")
          .get(yr.year);
        totalSuppliersPaidYear = (suppliersYearPaidRow.sum || 0) + (supplierPaymentsYearRow.sum || 0);
        suppliersOrdersCountYear = this.db
          .prepare("SELECT COUNT(DISTINCT name) as count FROM suppliers WHERE strftime('%Y', date) = ?")
          .get(yr.year).count || 0;
      }

      suppliersRemainingYear = Math.max(0, suppliersTotalYear - totalSuppliersPaidYear);
      suppliersCreditTotalYear = Math.max(0, totalSuppliersPaidYear - suppliersTotalYear);

      // أكثر الأصناف مبيعاً حسب السنة
      const topSellingYear = this.db
        .prepare(
          `
        SELECT s.inventory_item_id AS inventoryId,
               COALESCE(i.item_name,'') AS item_name,
               COALESCE(i.color_number,'') AS color_number,
               COALESCE(sec.name,'عام') AS section_name,
               SUM(s.quantity) AS qty,
               SUM(s.total) AS total
        FROM sales s
        LEFT JOIN inventory i ON i.id = s.inventory_item_id
        LEFT JOIN inventory_sections sec ON sec.id = i.section_id
        WHERE s.inventory_item_id IS NOT NULL AND strftime('%Y', s.date) = ?
        GROUP BY s.inventory_item_id
        ORDER BY qty DESC, total DESC
      `
        )
        .all(yr.year);

      // حساب الأرباح والخسائر حسب السنة
      const costOfSoldItemsYear = this.db
        .prepare(`
        SELECT COALESCE(SUM(s.unit_cost * s.quantity), 0) as cost
        FROM sales s
        WHERE s.unit_cost > 0 AND strftime('%Y', s.date) = ?
      `)
        .get(yr.year).cost || 0;

      const costOfReturnedYear = netSalesYear > 0
        ? returnedYearTotal * (costOfSoldItemsYear / (salesYear.total || 1))
        : 0;
      const netCostOfSoldItemsYear = Math.max(0, costOfSoldItemsYear - costOfReturnedYear);

      const grossProfitYear = netSalesYear - netCostOfSoldItemsYear;
      const grossProfitMarginYear = netSalesYear > 0 ? (grossProfitYear / netSalesYear) * 100 : 0;
      const netIncomeYear = netSalesYear - netCostOfSoldItemsYear - expensesYear.outside + expensesYear.inside;
      const netProfitYear = netIncomeYear > 0 ? netIncomeYear : 0;
      const netLossYear = netIncomeYear < 0 ? Math.abs(netIncomeYear) : 0;

      statsByYear[yr.year] = {
        sales: {
          count: salesYear.count || 0,
          total: netSalesYear,
          returned: returnedYearTotal,
          paid: salesPaidYearAgg,
          remaining: salesRemainingYearAgg,
        },
        expenses: {
          count: expensesYear.count || 0,
          inside: expensesYear.inside || 0,
          outside: expensesYear.outside || 0,
        },
        customers: {
          total: customersTotalNetYear,
          paid: customersPaidYear,
          remaining: customersRemainingYear,
          creditTotal: customersCreditTotalYear,
        },
        suppliers: {
          total: suppliersTotalYear,
          paid: totalSuppliersPaidYear,
          remaining: suppliersRemainingYear,
          creditTotal: suppliersCreditTotalYear,
          ordersCount: suppliersOrdersCountYear,
        },
        topSelling: topSellingYear,
        profit: {
          netIncome: netIncomeYear,
          netProfit: netProfitYear,
          netLoss: netLossYear,
          grossProfit: grossProfitYear,
          grossProfitMargin: grossProfitMarginYear,
          costOfSoldItems: costOfSoldItemsYear,
          costOfReturned: costOfReturnedYear,
          netCostOfSoldItems: netCostOfSoldItemsYear,
        },
      };
    }

    // Top selling items
    const topSelling = this.db
      .prepare(
        `
      SELECT s.inventory_item_id AS inventoryId,
             COALESCE(i.item_name,'') AS item_name,
             COALESCE(i.color_number,'') AS color_number,
             COALESCE(sec.name,'عام') AS section_name,
             SUM(s.quantity) AS qty,
             SUM(s.total) AS total
      FROM sales s
      LEFT JOIN inventory i ON i.id = s.inventory_item_id
      LEFT JOIN inventory_sections sec ON sec.id = i.section_id
      WHERE s.inventory_item_id IS NOT NULL
      GROUP BY s.inventory_item_id
      ORDER BY qty DESC, total DESC
    `
      )
      .all();

    const actualSalesPaid =
      this.db.prepare("SELECT COALESCE(SUM(paid),0) as sum FROM sales").get()
        .sum || 0;
    const paymentsPaid =
      this.db
        .prepare("SELECT COALESCE(SUM(amount),0) as sum FROM payments")
        .get().sum || 0;
    const totalSalesPaid = actualSalesPaid + paymentsPaid;

    const expensesInside =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as sum FROM expenses WHERE direction='داخل'"
        )
        .get().sum || 0;
    const expensesOutside =
      this.db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) as sum FROM expenses WHERE direction='خارج'"
        )
        .get().sum || 0;

    const costOfSoldItems = this.db.prepare(`
      SELECT COALESCE(SUM(s.unit_cost * s.quantity), 0) as cost
      FROM sales s
      WHERE s.unit_cost > 0
    `).get().cost || 0;

    const costOfReturned = salesTotal > 0
      ? returnedTotal * (costOfSoldItems / salesTotal)
      : 0;
    const netCostOfSoldItems = Math.max(0, costOfSoldItems - costOfReturned);

    if (!this.tableExists("supplier_transactions")) {
      const suppliersPaidActual =
        this.db
          .prepare("SELECT COALESCE(SUM(paid),0) as sum FROM suppliers")
          .get().sum || 0;
      const supplierPaymentsPaid =
        this.db
          .prepare(
            "SELECT COALESCE(SUM(amount),0) as sum FROM supplier_payments"
          )
          .get().sum || 0;
      totalSuppliersPaid = suppliersPaidActual + supplierPaymentsPaid;
    }

    const netIncome = netSalesTotal - netCostOfSoldItems - expensesOutside + expensesInside;
    const netProfit = netIncome > 0 ? netIncome : 0;
    const netLoss = netIncome < 0 ? Math.abs(netIncome) : 0;

    // Check for low inventory items
    const lowInventoryItems =
      this.db
        .prepare(
          "SELECT id, item_name, total_meters FROM inventory WHERE total_meters <= 10 ORDER BY total_meters ASC"
        )
        .all() || [];

    // Backward-compatible key expected by frontend
    const suppliersPaid = totalSuppliersPaid;

    return {
      customersCount,
      customersWithRemaining,
      // إجمالي مبالغ باقية للعملاء (كائتمان لصالحهم)
      customersCreditTotal,
      suppliersCount,
      suppliersOrdersCount,
      inventoryCount,
      customersTotal,
      customersPaid,
      customersRemaining,
      suppliersTotal,
      suppliersPaid,
      suppliersRemaining,
      suppliersCreditTotal,
      inventoryTotalMeters,
      inventoryTotalKilos,
      sectionsCount,
      salesCount,
      salesTotal,
      returnedTotal,
      returnedCount,
      netSalesTotal,
      salesPaid,
      salesRemaining,
      salesHighest,
      salesUniqueCustomers,
      expensesCount,
      expensesTotal: expensesOutside, // المصروفات الخارجية فقط
      expensesInside, // المصروفات الداخلية
      expensesAverage,
      expensesHighest,
      expensesToday,
      expensesThisWeek,
      expensesThisMonth,
      expensesThisYear,
      // simple period summaries
      expensesPeriods: {
        today: {
          count: expCountToday,
          inside: expInsideToday,
          outside: expOutsideToday,
        },
        week: {
          count: expCountWeek,
          inside: expInsideWeek,
          outside: expOutsideWeek,
        },
        month: {
          count: expCountMonth,
          inside: expInsideMonth,
          outside: expOutsideMonth,
        },
        year: {
          count: expCountYear,
          inside: expInsideYear,
          outside: expOutsideYear,
        },
      },
      salesPeriods: {
        today: {
          count: salesCountToday,
          total: netSalesTotalToday,
          paid: salesPaidToday,
          remaining: salesRemainingToday,
          returned: returnedTotalToday,
        },
        week: {
          count: salesCountWeek,
          total: netSalesTotalWeek,
          paid: salesPaidWeek,
          remaining: salesRemainingWeek,
          returned: returnedTotalWeek,
        },
        month: {
          count: salesCountMonth,
          total: netSalesTotalMonth,
          paid: salesPaidMonth,
          remaining: salesRemainingMonth,
          returned: returnedTotalMonth,
        },
        year: {
          count: salesCountYear,
          total: netSalesTotalYear,
          paid: salesPaidYear,
          remaining: salesRemainingYear,
          returned: returnedTotalYear,
        },
      },
      netIncome,
      netProfit,
      netLoss,
      costOfSoldItems,
      costOfReturned,
      netCostOfSoldItems,
      totalSalesPaid,
      totalSuppliersPaid,
      expensesInside,
      expensesOutside,
      lowInventoryItems,
      topSelling,
      years,
      statsByYear,
      // إحصائيات إضافية
      averageSaleValue: salesCount > 0 ? netSalesTotal / salesCount : 0,
      averageExpenseValue:
        expensesCount > 0
          ? (expensesInside + expensesOutside) / expensesCount
          : 0,
      paymentRate: netSalesTotal > 0 ? (salesPaid / netSalesTotal) * 100 : 0,
      profitMargin: netSalesTotal > 0 ? (netIncome / netSalesTotal) * 100 : 0,
      grossProfit: netSalesTotal - netCostOfSoldItems,
      grossProfitMargin: netSalesTotal > 0 ? ((netSalesTotal - netCostOfSoldItems) / netSalesTotal) * 100 : 0,
    };
    } catch (error) {
      console.error("Error in getStatistics:", error);
      return {
        customersCount: 0, suppliersCount: 0, inventoryCount: 0, sectionsCount: 0,
        customersTotal: 0, customersPaid: 0, customersRemaining: 0, customersCreditTotal: 0, customersWithRemaining: 0,
        suppliersTotal: 0, suppliersPaid: 0, suppliersRemaining: 0, suppliersCreditTotal: 0, suppliersOrdersCount: 0,
        inventoryTotalMeters: 0, inventoryTotalKilos: 0,
        salesCount: 0, salesTotal: 0, returnedTotal: 0, returnedCount: 0, netSalesTotal: 0, salesPaid: 0, salesRemaining: 0, salesHighest: 0, salesUniqueCustomers: 0,
        expensesCount: 0, expensesTotal: 0, expensesInside: 0, expensesOutside: 0, expensesAverage: 0, expensesHighest: 0,
        expensesToday: 0, expensesThisWeek: 0, expensesThisMonth: 0, expensesThisYear: 0,
        expensesPeriods: { today: { count: 0, inside: 0, outside: 0 }, week: { count: 0, inside: 0, outside: 0 }, month: { count: 0, inside: 0, outside: 0 }, year: { count: 0, inside: 0, outside: 0 } },
        salesPeriods: { today: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 }, week: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 }, month: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 }, year: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 } },
        netIncome: 0, netProfit: 0, netLoss: 0, costOfSoldItems: 0, costOfReturned: 0, netCostOfSoldItems: 0,
        totalSalesPaid: 0, totalSuppliersPaid: 0,
        lowInventoryItems: [], topSelling: [],
        averageSaleValue: 0, averageExpenseValue: 0, paymentRate: 0, profitMargin: 0, grossProfit: 0, grossProfitMargin: 0
      };
    }
  }

  // Payment management functions
  addPayment(customerName, amount, description, date, customerPhone = null, customerId = null) {
    this.ensurePaymentsTable();
    
    if (!customerId && customerName) {
      const customer = this.getCustomerByNameAndPhone(customerName, customerPhone);
      if (customer) {
        customerId = customer.id;
      }
    }
    
    const globalSequence = customerId ? this.getNextGlobalSequence("customer", customerId) : 1;
    const stmt = this.db.prepare(`
      INSERT INTO payments (global_sequence, customer_id, customer_name, amount, description, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(globalSequence, customerId, customerName, amount, description, date);
  }

  getPaymentsByCustomerId(customerId) {
    this.ensurePaymentsTable();
    return this.db
      .prepare(
        "SELECT * FROM payments WHERE customer_id = ? ORDER BY global_sequence ASC"
      )
      .all(customerId);
  }

  getPaymentsByCustomer(customerName) {
    this.ensurePaymentsTable();
    return this.db
      .prepare(
        "SELECT * FROM payments WHERE TRIM(LOWER(customer_name)) = TRIM(LOWER(?)) ORDER BY global_sequence ASC"
      )
      .all(customerName);
  }

  getAllPayments() {
    this.ensurePaymentsTable();
    return this.db
      .prepare("SELECT * FROM payments ORDER BY date DESC, id DESC")
      .all();
  }

  deletePayment(paymentId) {
    this.ensurePaymentsTable();
    return this.db.prepare("DELETE FROM payments WHERE id = ?").run(paymentId);
  }

  updatePayment(paymentId, customerName, amount, description, date) {
    this.ensurePaymentsTable();
    const stmt = this.db.prepare(`
      UPDATE payments 
      SET customer_name = ?, amount = ?, description = ?, date = ?
      WHERE id = ?
    `);
    return stmt.run(customerName, amount, description, date, paymentId);
  }

  // Supplier Payments functions
  addSupplierPayment(supplierName, amount, description, date, supplierPhone = null, supplierId = null) {
    this.ensureSupplierPaymentsTable();
    this.ensureSupplierTransactionsTable();
    
    if (!supplierId && supplierName) {
      const supplier = this.getSupplierInfoByNameAndPhone(supplierName, supplierPhone);
      if (supplier) {
        supplierId = supplier.id;
      }
    }
    
    const globalSequence = supplierId ? this.getNextGlobalSequence("supplier", supplierId) : 1;
    const stmt = this.db.prepare(`
      INSERT INTO supplier_payments (global_sequence, supplier_id, supplier_name, amount, description, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(globalSequence, supplierId, supplierName, amount, description, date);
  }

  ensureSupplierTransactionsTable() {
    // جدول موحد لكل عمليات المورد: أوردر/دفعة
    this.db.exec(`CREATE TABLE IF NOT EXISTS supplier_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'order' | 'payment'
      order_id INTEGER,
      payment_id INTEGER,
      description TEXT,
      quantity REAL,
      price REAL,
      total REAL,
      paid REAL,
      amount REAL,
      date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
  }

  addSupplierTransaction(row) {
    const stmt = this.db.prepare(
      `INSERT INTO supplier_transactions (supplier_name, type, order_id, payment_id, description, quantity, price, total, paid, amount, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const res = stmt.run(
      row.supplier_name,
      row.type,
      row.order_id || null,
      row.payment_id || null,
      row.description || "",
      row.quantity || null,
      row.price || null,
      row.total || null,
      row.paid || null,
      row.amount || null,
      row.date || null
    );
    return res.lastInsertRowid;
  }

  getSupplierStatement(name) {
    this.ensureSupplierTransactionsTable();
    return this.db
      .prepare(
        `SELECT * FROM supplier_transactions WHERE TRIM(LOWER(supplier_name)) = TRIM(LOWER(?)) ORDER BY id ASC`
      )
      .all(name);
  }

  backfillSupplierTransactions() {
    this.ensureSupplierTransactionsTable();
    // Only backfill if table is empty
    const cnt =
      this.db.prepare("SELECT COUNT(*) as c FROM supplier_transactions").get()
        .c || 0;
    if (cnt > 0) return;
    try {
      // Collect orders
      const orders =
        this.db
          .prepare(
            `SELECT id, name as supplier_name, description, quantity, price, total, paid, date, created_at FROM suppliers ORDER BY datetime(COALESCE(created_at, date)) ASC, id ASC`
          )
          .all() || [];
      // Collect payments
      const pays =
        this.db
          .prepare(
            `SELECT id, supplier_name, amount, description, date, created_at FROM supplier_payments ORDER BY datetime(COALESCE(created_at, date)) ASC, id ASC`
          )
          .all() || [];
      // Merge with markers
      const merged = [];
      for (const o of orders)
        merged.push({
          t: "order",
          r: o,
          ts: new Date(o.created_at || o.date || 0).getTime(),
          id: o.id,
        });
      for (const p of pays)
        merged.push({
          t: "payment",
          r: p,
          ts: new Date(p.created_at || p.date || 0).getTime(),
          id: p.id,
        });
      merged.sort((a, b) => (a.ts !== b.ts ? a.ts - b.ts : a.id - b.id));
      const insert = this.db.prepare(
        `INSERT INTO supplier_transactions (supplier_name, type, order_id, payment_id, description, quantity, price, total, paid, amount, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const tx = this.db.transaction(() => {
        for (const m of merged) {
          if (m.t === "order") {
            const o = m.r;
            insert.run(
              o.supplier_name || o.name,
              "order",
              o.id,
              null,
              o.description || "",
              o.quantity || null,
              o.price || null,
              o.total || null,
              o.paid || null,
              null,
              o.date || null
            );
          } else {
            const p = m.r;
            insert.run(
              p.supplier_name,
              "payment",
              null,
              p.id,
              p.description || "",
              null,
              null,
              null,
              null,
              p.amount || null,
              p.date || null
            );
          }
        }
      });
      tx();
    } catch {}
  }

  getSupplierPaymentsBySupplierId(supplierId) {
    this.ensureSupplierPaymentsTable();
    return this.db
      .prepare(
        "SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY COALESCE(global_sequence, id) ASC"
      )
      .all(supplierId);
  }

  getSupplierPaymentsBySupplier(supplierName) {
    this.ensureSupplierPaymentsTable();
    return this.db
      .prepare(
        "SELECT * FROM supplier_payments WHERE TRIM(LOWER(supplier_name)) = TRIM(LOWER(?)) ORDER BY COALESCE(global_sequence, id) ASC"
      )
      .all(supplierName);
  }

  getAllSupplierPayments() {
    this.ensureSupplierPaymentsTable();
    return this.db
      .prepare("SELECT * FROM supplier_payments ORDER BY date DESC, id DESC")
      .all();
  }

  deleteSupplierPayment(paymentId) {
    this.ensureSupplierPaymentsTable();
    const result = this.db
      .prepare("DELETE FROM supplier_payments WHERE id = ?")
      .run(paymentId);

    // حذف من جدول المعاملات الموحدة
    this.deleteSupplierTransactionByPaymentId(paymentId);

    return result;
  }

  updateSupplierPayment(paymentId, supplierName, amount, description, date, supplierPhone = null, supplierId = null) {
    this.ensureSupplierPaymentsTable();
    
    if (!supplierId && supplierName) {
      const supplier = this.getSupplierInfoByNameAndPhone(supplierName, supplierPhone);
      if (supplier) {
        supplierId = supplier.id;
      }
    }
    
    const stmt = this.db.prepare(`
      UPDATE supplier_payments 
      SET supplier_id = ?, supplier_name = ?, amount = ?, description = ?, date = ?
      WHERE id = ?
    `);
    const result = stmt.run(supplierId, supplierName, amount, description, date, paymentId);

    this.ensureSupplierTransactionsTable();
    this.db
      .prepare(
        `UPDATE supplier_transactions 
         SET supplier_name = ?, amount = ?, description = ?, date = ?
         WHERE type = 'payment' AND payment_id = ?`
      )
      .run(supplierName, amount, description, date, paymentId);

    return result;
  }

  deleteSupplierTransactionByOrderId(orderId) {
    this.ensureSupplierTransactionsTable();
    return this.db
      .prepare(
        "DELETE FROM supplier_transactions WHERE type = 'order' AND order_id = ?"
      )
      .run(orderId);
  }

  deleteSupplierTransactionByPaymentId(paymentId) {
    this.ensureSupplierTransactionsTable();
    return this.db
      .prepare(
        "DELETE FROM supplier_transactions WHERE type = 'payment' AND payment_id = ?"
      )
      .run(paymentId);
  }

  updateSupplierTransactionByOrderId(orderId, data) {
    this.ensureSupplierTransactionsTable();
    return this.db
      .prepare(
        `
      UPDATE supplier_transactions 
      SET supplier_name = ?, description = ?, quantity = ?, price = ?, total = ?, paid = ?, date = ?
      WHERE type = 'order' AND order_id = ?
    `
      )
      .run(
        data.name,
        data.description,
        data.quantity,
        data.price,
        data.total,
        data.paid,
        data.date,
        orderId
      );
  }

  getDbPath() {
    return dbPath;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }

  reopen() {
    this.close();
    this.db = new Database(dbPath);
  }
}

module.exports = DatabaseManager;
