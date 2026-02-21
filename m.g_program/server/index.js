const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
const Database = require("./database");
const BackupManager = require("./backup");

const app = express();
const PORT = 3456;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3456",
      "http://localhost:*",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Origin",
      "X-Requested-With",
      "Accept",
    ],
  })
);

// Handle preflight requests
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Origin, X-Requested-With, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

// حد حجم طلبات النسخ الاحتياطي (1 تيرا)
app.use(express.json({ limit: '1tb' }));
app.use(express.urlencoded({ limit: '1tb', extended: true }));

let db;
try {
  db = new Database();
  if (!db) {
    throw new Error("Failed to initialize database");
  }
} catch (error) {
  console.error("Database initialization error:", error);
  process.exit(1);
}

// استخدم مسار قاعدة البيانات الفعلي من مدير القاعدة (قد يكون داخل userData في Electron)
const backupManager = new BackupManager(
  db.getDbPath ? db.getDbPath() : path.join(__dirname, "mg_fabric.db")
);

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.getUserByUsername(username);
    if (!user) {
      return res
        .status(401)
        .json({
          success: false,
          message: "اسم المستخدم أو كلمة المرور غير صحيحة",
        });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({
          success: false,
          message: "اسم المستخدم أو كلمة المرور غير صحيحة",
        });
    }
    res.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

app.get("/api/users", (req, res) => {
  const users = db.getAllUsers();
  res.json(users.map((u) => ({ id: u.id, username: u.username })));
});

app.post("/api/users", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = db.addUser(username, hashedPassword);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل إضافة المستخدم" });
  }
});

app.delete("/api/users/:id", (req, res) => {
  try {
    const users = db.getAllUsers();
    if (!users || users.length <= 1) {
      return res
        .status(400)
        .json({ success: false, message: "لا يمكن حذف آخر مستخدم في النظام" });
    }
    db.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/customers", (req, res) => {
  res.json(db.getAllCustomers());
});

app.post("/api/customers", (req, res) => {
  try {
    const payload = req.body;
    
    // التحقق من وجود عميل مكرر بنفس الاسم والرقم
    const duplicateCheck = db.checkDuplicateCustomer(payload.name, payload.phone);
    
    if (duplicateCheck.exists) {
      const customer = duplicateCheck.customer;
      let message = `يوجد عميل بنفس البيانات: "${customer.name}"`;
      
      if (duplicateCheck.hasPhone && payload.phone) {
        message += ` - الهاتف: ${customer.phone}`;
      } else if (!duplicateCheck.hasPhone && !payload.phone) {
        message += ' (بدون رقم هاتف)';
      }
      
      message += '. يرجى تغيير الاسم أو رقم الهاتف لتجنب التكرار.';
      
      return res.status(400).json({
        success: false,
        duplicate: true,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone
        },
        message: message
      });
    }

    const id = db.addCustomer(payload);

    // فقط إذا كانت هناك بيانات مخزون
    if (payload.inventory_id && payload.used_meters) {
      db.adjustInventoryMeters(
        payload.inventory_id,
        -Math.abs(payload.used_meters)
      );
    }

    res.json({ success: true, id });
  } catch (error) {
    console.error("Error adding customer:", error);
    res.status(500).json({ success: false, message: "خطأ في إضافة العميل" });
  }
});

app.put("/api/customers/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const prev = db.getCustomerById(id);
  const payload = req.body;
  db.updateCustomer(id, payload);
  // adjust inventory delta if linked
  if (payload.inventory_id) {
    const prevUsed = prev?.used_meters || 0;
    const newUsed = Math.abs(payload.used_meters || 0);
    const delta = prevUsed - newUsed; // if increased usage, delta negative
    db.adjustInventoryMeters(payload.inventory_id, delta);
  }
  res.json({ success: true });
});

app.get("/api/customers/:id/stats", (req, res) => {
  try {
    const stats = db.getCustomerStats(parseInt(req.params.id));
    if (!stats) {
      return res.status(404).json({ success: false, message: "العميل غير موجود" });
    }
    res.json(stats);
  } catch (error) {
    console.error("Error getting customer stats:", error);
    res.status(500).json({ success: false, message: "خطأ في جلب البيانات" });
  }
});

app.delete("/api/customers/:id", (req, res) => {
  try {
    db.deleteCustomer(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ success: false, message: "خطأ في حذف العميل" });
  }
});

// API endpoints للموردين (المعلومات الأساسية)
app.get("/api/suppliers", (req, res) => {
  try {
    const suppliers = db.getAllSuppliers();
    if (!suppliers) {
      throw new Error("Failed to fetch suppliers");
    }
    res.json({ success: true, data: suppliers });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch suppliers",
      details: error.message,
    });
  }
});

app.get("/api/suppliers/statistics", (req, res) => {
  try {
    const stats = db.getSupplierStatistics();
    if (!stats) {
      throw new Error("Failed to fetch supplier statistics");
    }
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching supplier statistics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch supplier statistics",
      details: error.message,
    });
  }
});

app.post("/api/suppliers", (req, res) => {
  try {
    const payload = req.body;
    
    // التحقق من وجود مورد مكرر بنفس الاسم والرقم
    const duplicateCheck = db.checkDuplicateSupplier(payload.name, payload.phone);
    
    if (duplicateCheck.exists) {
      const supplier = duplicateCheck.supplier;
      let message = `يوجد مورد بنفس البيانات: "${supplier.name}"`;
      
      if (duplicateCheck.hasPhone && payload.phone) {
        message += ` - الهاتف: ${supplier.phone}`;
      } else if (!duplicateCheck.hasPhone && !payload.phone) {
        message += ' (بدون رقم هاتف)';
      }
      
      message += '. يرجى تغيير الاسم أو رقم الهاتف لتجنب التكرار.';
      
      return res.status(400).json({
        success: false,
        duplicate: true,
        supplier: {
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone
        },
        message: message
      });
    }
    
    const supplierData = {
      name: payload.name,
      phone: payload.phone || null,
      date: payload.date
    };
    
    const id = db.addSupplier(supplierData);
    res.json({ success: true, id });
  } catch (error) {
    console.error("Error adding supplier:", error);
    if (error.message && error.message.includes("موجود بالفعل")) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: "خطأ في إضافة المورد" });
    }
  }
});

app.put("/api/suppliers/:id", (req, res) => {
  db.updateSupplier(req.params.id, req.body);
  res.json({ success: true });
});

app.get("/api/suppliers/:id/stats", (req, res) => {
  try {
    const stats = db.getSupplierStats(parseInt(req.params.id));
    if (!stats) {
      return res.status(404).json({ success: false, message: "المورد غير موجود" });
    }
    res.json(stats);
  } catch (error) {
    console.error("Error getting supplier stats:", error);
    res.status(500).json({ success: false, message: "خطأ في جلب البيانات" });
  }
});

app.delete("/api/suppliers/:id", (req, res) => {
  try {
    const id = req.params.id;
    console.log(`Attempting to delete supplier with ID: ${id}`);
    
    // Check if supplier exists first
    const supplier = db.getSupplierById(id);
    if (!supplier) {
      return res.status(404).json({ 
        success: false, 
        message: "المورد غير موجود" 
      });
    }
    
    db.deleteSupplier(id);
    console.log(`Successfully deleted supplier: ${supplier.name}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في حذف المورد",
      error: error.message 
    });
  }
});

// API endpoints لطلبات الموردين
app.get("/api/supplier-orders", (req, res) => {
  res.json(db.getAllSupplierOrders());
});

app.post("/api/supplier-orders", (req, res) => {
  try {
    console.log("Adding supplier order:", req.body);
    const id = db.addSupplierOrder(req.body);
    console.log("Successfully added supplier order with ID:", id);
    res.json({ success: true, id });
  } catch (error) {
    console.error("Error adding supplier order:", error);
    res.status(500).json({ 
      success: false, 
      message: "خطأ في إضافة طلب المورد",
      error: error.message 
    });
  }
});

app.put("/api/supplier-orders/:id", (req, res) => {
  try {
    db.updateSupplierOrder(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating supplier order:", error);
    res.status(500).json({ success: false, message: error.message || "خطأ في تعديل الطلب" });
  }
});

app.delete("/api/supplier-orders/:id", (req, res) => {
  try {
    db.deleteSupplierOrder(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting supplier order:", error);
    res.status(500).json({ success: false, message: error.message || "خطأ في حذف الطلب" });
  }
});

app.get("/api/suppliers/by-name/:name", (req, res) => {
  const { name } = req.params;
  res.json(db.getSuppliersByName(decodeURIComponent(name)));
});

// Unified supplier statement (orders + payments merged and ordered)
app.get("/api/suppliers/statement", (req, res) => {
  try {
    const { name, supplier_id } = req.query;
    
    if (supplier_id) {
      db.backfillSupplierTransactions();
      const supplierInfo = db.getSupplierById(parseInt(supplier_id));
      if (!supplierInfo) {
        return res.status(404).json({ success: false, message: "Supplier not found" });
      }
      
      // Get orders and payments using supplier_id
      const orders = db.getSupplierOrdersBySupplierId(parseInt(supplier_id));
      const payments = db.getSupplierPaymentsBySupplierId(parseInt(supplier_id));
      
      // Combine and sort
      const rows = [];
      orders.forEach(order => {
        rows.push({
          type: 'order',
          order_id: order.id,
          ...order
        });
      });
      payments.forEach(payment => {
        rows.push({
          type: 'payment',
          payment_id: payment.id,
          ...payment
        });
      });
      
      rows.sort((a, b) => {
        const dateA = new Date(a.created_at || a.date);
        const dateB = new Date(b.created_at || b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA - dateB;
        }
        return (a.id || 0) - (b.id || 0);
      });
      
      return res.json({ success: true, rows });
    }
    
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "name or supplier_id is required" });
    }
    
    db.backfillSupplierTransactions();
    const rows = db.getSupplierStatement(name);
    res.json({ success: true, rows });
  } catch (e) {
    console.error("Error fetching supplier statement:", e);
    res.status(500).json({ success: false });
  }
});

app.get("/api/inventory", (req, res) => {
  res.json(db.getAllInventory());
});

app.get("/api/inventory/sections", (req, res) => {
  res.json(db.getAllSections());
});

app.get("/api/inventory/section/:sectionId", (req, res) => {
  const { sectionId } = req.params;
  res.json(db.getInventoryBySection(sectionId));
});

app.get("/api/inventory/sections/:id", (req, res) => {
  const { id } = req.params;
  res.json(db.getSectionById(id));
});

app.get("/api/inventory/check-color/:colorNumber/:sectionId", (req, res) => {
  const { colorNumber, sectionId } = req.params;
  const existingItem = db.checkColorExists(colorNumber, sectionId);
  res.json({ exists: !!existingItem, item: existingItem });
});

app.post("/api/inventory", (req, res) => {
  try {
    const id = db.addInventoryItem(req.body);
    res.json({ success: true, id });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put("/api/inventory/:id", (req, res) => {
  try {
    db.updateInventoryItem(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete("/api/inventory/:id", (req, res) => {
  db.deleteInventoryItem(req.params.id);
  res.json({ success: true });
});

app.post("/api/inventory/sections", (req, res) => {
  try {
    const id = db.addSection(req.body);
    res.json({ success: true, id });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: error.message || "فشل في إضافة القسم" });
  }
});

app.put("/api/inventory/sections/:id", (req, res) => {
  try {
    db.updateSection(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: error.message || "فشل في تعديل القسم" });
  }
});

app.delete("/api/inventory/sections/:id", (req, res) => {
  try {
    db.deleteSection(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في حذف القسم" });
  }
});

app.get("/api/settings", (req, res) => {
  res.json(db.getSettings());
});

app.put("/api/settings", (req, res) => {
  db.updateSettings(req.body);
  res.json({ success: true });
});

// Backup APIs
app.get("/api/backups", (req, res) => {
  try {
    res.json({ success: true, files: backupManager.getBackups() });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/backups/create", (req, res) => {
  try {
    const result = backupManager.createBackup();
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/backups/restore", (req, res) => {
  try {
    // support both { data } and { backupData } keys (frontend uses backupData)
    const payload = req.body;
    const base64 = payload && (payload.backupData || payload.data);
    if (!base64)
      return res.status(400).json({ success: false, message: "no data" });

    // Attempt to restore using the BackupManager which handles before-restore backup
    const result = backupManager.restoreBackup(base64);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    // Close and reopen the database connection
    try {
      db.reopen();
    } catch (err) {
      console.error("Failed to re-open DB after restore:", err);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to re-open database after restore",
          error: err.message,
        });
    }

    res.json({ success: true, message: "تم استعادة النسخة الاحتياطية بنجاح" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post("/api/reset", async (req, res) => {
  try {
    console.log("Starting database reset...");

    // إعادة ضبط قاعدة البيانات
    db.resetDatabase();

    // إضافة المستخدم الافتراضي
    try {
      const hashedPassword = await bcrypt.hash("admin", 10);
      db.addUser("admin", hashedPassword);
      console.log("Default admin user created successfully");
    } catch (userError) {
      console.log(
        "Admin user might already exist or error creating user:",
        userError.message
      );
    }

    console.log("Database reset completed successfully");
    res.json({ success: true, message: "تم إعادة ضبط قاعدة البيانات بنجاح" });
  } catch (error) {
    console.error("Error during database reset:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إعادة ضبط قاعدة البيانات",
      error: error.message,
      details: error.stack,
    });
  }
});

app.get("/api/statistics", (req, res) => {
  try {
    const stats = db.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error("/api/statistics failed:", error?.message || error);
    if (error?.stack) console.error(error.stack);
    // Return safe defaults so the app doesn't break in packed builds
    res.status(200).json({
      customersCount: 0,
      suppliersCount: 0,
      inventoryCount: 0,
      sectionsCount: 0,
      salesCount: 0,
      salesTotal: 0,
      salesPaid: 0,
      salesRemaining: 0,
      expensesCount: 0,
      expensesTotal: 0,
      expensesInside: 0,
      expensesOutside: 0,
      customersTotal: 0,
      customersPaid: 0,
      customersRemaining: 0,
      suppliersTotal: 0,
      suppliersPaid: 0,
      suppliersRemaining: 0,
      customersCreditTotal: 0,
      suppliersOrdersCount: 0,
      expensesPeriods: {},
      salesPeriods: {},
      lowInventoryItems: [],
      topSelling: [],
      netIncome: 0,
      netProfit: 0,
      netLoss: 0,
      costOfSoldItems: 0,
      costOfReturned: 0,
      netCostOfSoldItems: 0,
      returnedTotal: 0,
      returnedCount: 0,
      netSalesTotal: 0,
      grossProfit: 0,
      grossProfitMargin: 0,
      inventoryTotalMeters: 0,
      inventoryTotalKilos: 0,
      years: [],
      statsByYear: {},
      salesPeriods: {
        today: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 },
        week: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 },
        month: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 },
        year: { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 },
      },
    });
  }
});

// إجمالي المتبقي/له مبلغ من العملاء (نفس منطق الإحصائيات - مسح كامل لكل كشف حساب)
app.get("/api/customers-balance", (req, res) => {
  try {
    const result = db.getCustomersBalanceFromAccountStatements();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("/api/customers-balance failed:", error?.message || error);
    res.status(500).json({ success: false, remaining: 0, creditTotal: 0 });
  }
});

// Sales API
app.get("/api/sales/by-customer", (req, res) => {
  try {
    const { name, customer_id } = req.query;
    
    if (customer_id) {
      const rows = db.getSalesByCustomerId(parseInt(customer_id));
      return res.json({ success: true, rows });
    }
    
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "name or customer_id is required" });
    }
    
    const rows = db.getSalesByCustomerName(name);
    res.json({ success: true, rows });
  } catch (e) {
    console.error("Error fetching sales by customer:", e);
    res.status(500).json({ success: false });
  }
});
app.get("/api/sales", (req, res) => {
  res.json(db.getAllSales());
});

app.post("/api/sales", (req, res) => {
  try {
    const id = db.addSale(req.body);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.put("/api/sales/:id", (req, res) => {
  try {
    db.updateSale(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.delete("/api/sales/:id", (req, res) => {
  try {
    db.deleteSale(parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// Returned Orders API
app.get("/api/returned-orders", (req, res) => {
  try {
    const rows = db.getAllReturnedOrders();
    res.json({ success: true, rows });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/returned-orders/customer/:name", (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const customerId = req.query.customer_id;
    
    let rows;
    if (customerId) {
      rows = db.getReturnedOrdersByCustomerId(parseInt(customerId));
    } else {
      if (!name)
        return res
          .status(400)
          .json({ success: false, message: "name or customer_id is required" });
      rows = db.getReturnedOrdersByCustomerName(name);
    }
    
    res.json({ success: true, rows });
  } catch (e) {
    console.error("Error fetching returned orders:", e);
    res.status(500).json({ success: false });
  }
});

app.post("/api/returned-orders", (req, res) => {
  try {
    const id = db.addReturnedOrder(req.body);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.put("/api/returned-orders/:id", (req, res) => {
  try {
    db.updateReturnedOrder(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.delete("/api/returned-orders/:id", (req, res) => {
  try {
    db.deleteReturnedOrder(parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// Expenses API
app.get("/api/expenses", (req, res) => {
  res.json(db.getAllExpenses());
});

app.post("/api/expenses", (req, res) => {
  try {
    const id = db.addExpense(req.body);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.put("/api/expenses/:id", (req, res) => {
  try {
    db.updateExpense(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.delete("/api/expenses/:id", (req, res) => {
  try {
    db.deleteExpense(parseInt(req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/backup", (req, res) => {
  const result = backupManager.createBackup();
  if (result.success) {
    res.json({
      success: true,
      message: "تم إنشاء النسخة الاحتياطية بنجاح",
      path: result.path,
    });
  } else {
    res.status(500).json({ success: false, message: result.error });
  }
});

app.get("/api/backups", (req, res) => {
  const backups = backupManager.getBackups();
  res.json(backups);
});

app.get("/api/backup/download", async (req, res) => {
  // First close the database to ensure a complete backup
  try {
    db.close();
    console.log("Database closed for backup");

    const result = backupManager.createBackup();

    // Reopen the database immediately after backup
    try {
      db.reopen();
      console.log("Database reopened after backup");
    } catch (reopenError) {
      console.error("Error reopening database after backup:", reopenError);
      return res
        .status(500)
        .json({
          success: false,
          message: "Error reopening database after backup",
        });
    }

    if (result.success) {
      res.download(result.path, path.basename(result.path), (err) => {
        if (err) {
          console.error("Error during backup download:", err);
          res
            .status(500)
            .json({ success: false, message: "فشل تنزيل النسخة الاحتياطية" });
        }
      });
    } else {
      console.error("Backup creation failed:", result.error);
      res.status(500).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error("Error during backup process:", error);
    res
      .status(500)
      .json({ success: false, message: "خطأ في إنشاء النسخة الاحتياطية" });

    // Ensure DB is reopened even if backup fails
    try {
      db.reopen();
      console.log("Database reopened after backup error");
    } catch (reopenError) {
      console.error(
        "Error reopening database after backup error:",
        reopenError
      );
    }
  }
});

app.post("/api/backup/restore", async (req, res) => {
  try {
    const { backupData } = req.body;
    if (!backupData) {
      return res
        .status(400)
        .json({
          success: false,
          message: "لم يتم إرسال بيانات النسخة الاحتياطية",
        });
    }

    // Log backup data size for monitoring
    const dataSizeMB = (backupData.length / (1024 * 1024)).toFixed(2);
    console.log(`Received backup data size: ${dataSizeMB} MB (base64 encoded)`);

    // Close database before restore
    try {
      db.close();
      console.log("Database closed for restore");
    } catch (closeError) {
      console.error("Error closing database before restore:", closeError);
      return res
        .status(500)
        .json({
          success: false,
          message: "Error closing database before restore",
        });
    }

    const result = backupManager.restoreBackup(backupData);

    // Always try to reopen the database, even if restore failed
    try {
      db.reopen();
      console.log("Database reopened after restore attempt");
    } catch (reopenError) {
      console.error("Failed to re-open DB after restore:", reopenError);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to re-open database after restore",
          error: reopenError.message,
        });
    }

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    // Verify database is usable by making a simple query
    try {
      const settings = db.getSettings();
      if (!settings) {
        throw new Error("Could not read from restored database");
      }
      console.log("Successfully verified restored database");
    } catch (verifyError) {
      console.error("Error verifying restored database:", verifyError);
      return res
        .status(500)
        .json({ success: false, message: "Error verifying restored database" });
    }

    res.json({ success: true, message: "تم استعادة النسخة الاحتياطية بنجاح" });
  } catch (error) {
    console.error("Restore error:", error);
    // One final attempt to reopen DB if it failed in the try block
    try {
      db.reopen();
    } catch (finalReopenError) {
      console.error("Final reopen attempt failed:", finalReopenError);
    }
    res
      .status(500)
      .json({ success: false, message: "خطأ في استعادة النسخة الاحتياطية" });
  }
});

// Payment endpoints
app.get("/api/payments", (req, res) => {
  try {
    const payments = db.getAllPayments();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في تحميل المدفوعات" });
  }
});

app.get("/api/payments/customer/:name", (req, res) => {
  try {
    const customerName = decodeURIComponent(req.params.name);
    const customerId = req.query.customer_id;
    
    let payments;
    if (customerId) {
      payments = db.getPaymentsByCustomerId(parseInt(customerId));
    } else {
      payments = db.getPaymentsByCustomer(customerName);
    }
    
    res.json({ success: true, rows: payments });
  } catch (error) {
    console.error("Error fetching customer payments:", error);
    res
      .status(500)
      .json({ success: false, message: "خطأ في تحميل مدفوعات العميل" });
  }
});

app.post("/api/payments", (req, res) => {
  try {
    const { customer_name, amount, description, date } = req.body;
    const result = db.addPayment(customer_name, amount, description, date);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في إضافة المدفوعات" });
  }
});

app.put("/api/payments/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, amount, description, date } = req.body;
    db.updatePayment(id, customer_name, amount, description, date);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في تحديث المدفوعات" });
  }
});

app.delete("/api/payments/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.deletePayment(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في حذف المدفوعات" });
  }
});

// Supplier Payment endpoints
app.get("/api/supplier-payments", (req, res) => {
  try {
    const payments = db.getAllSupplierPayments();
    res.json(payments);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "خطأ في تحميل مدفوعات الموردين" });
  }
});

app.get("/api/supplier-payments/supplier/:name", (req, res) => {
  try {
    const supplierName = decodeURIComponent(req.params.name);
    const payments = db.getSupplierPaymentsBySupplier(supplierName);
    res.json({ success: true, rows: payments });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "خطأ في تحميل مدفوعات المورد" });
  }
});

app.post("/api/supplier-payments", (req, res) => {
  try {
    const { supplier_name, supplier_phone, supplier_id, amount, description, date } = req.body;
    const result = db.addSupplierPayment(
      supplier_name,
      amount,
      description,
      date,
      supplier_phone,
      supplier_id
    );
    try {
      db.addSupplierTransaction({
        supplier_name,
        type: "payment",
        payment_id: result.lastInsertRowid,
        description,
        amount,
        date,
      });
    } catch {}
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "خطأ في إضافة مدفوعات المورد" });
  }
});

app.put("/api/supplier-payments/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_name, supplier_phone, supplier_id, amount, description, date } = req.body;
    db.updateSupplierPayment(id, supplier_name, amount, description, date, supplier_phone, supplier_id);
    res.json({ success: true });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "خطأ في تحديث مدفوعات المورد" });
  }
});

app.delete("/api/supplier-payments/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.deleteSupplierPayment(id);
    res.json({ success: true });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "خطأ في حذف مدفوعات المورد" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
