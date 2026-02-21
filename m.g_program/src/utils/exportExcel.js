import * as XLSX from "xlsx";
import { apiUrl } from "./api";

export const exportToExcel = (data, fileName, sheetName = "Sheet1") => {
  try {
    // Remove the global_sequence field from each row if it exists
    const cleanData = data.map((row) => {
      const { global_sequence, ...rest } = row;
      return rest;
    });

    const worksheet = XLSX.utils.json_to_sheet(cleanData);

    // Auto-fit column widths
    const cols = [];
    const maxWidths = {};

    // Calculate max width for each column
    Object.keys(cleanData[0] || {}).forEach((key) => {
      maxWidths[key] = key.length;
      cleanData.forEach((row) => {
        const cellValue = String(row[key] || "");
        if (cellValue.length > maxWidths[key]) {
          maxWidths[key] = cellValue.length;
        }
      });
      cols.push({ wch: Math.min(maxWidths[key] + 2, 50) });
    });

    worksheet["!cols"] = cols;

    // Set RTL direction for all cells
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = {
            ...worksheet[cellAddress].s,
            alignment: {
              horizontal: "right",
              vertical: "center",
              readingOrder: 2, // RTL
            },
          };
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    // Set RTL (Right to Left) for Arabic text
    workbook.Workbook = { Views: [{ RTL: true }] };
    worksheet["!rtl"] = true;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(
      workbook,
      `${fileName}_${new Date().toISOString().split("T")[0]}.xlsx`
    );
    return true;
  } catch (error) {
    console.error("Export error:", error);
    return false;
  }
};

export const exportCustomersToExcel = (customers) => {
  // Create organized Excel structure for customers
  const excelData = [
    // Header section
    ["قائمة العملاء"],
    [],
    // Table headers
    ["اسم العميل", "رقم الهاتف", "تاريخ الإضافة"],
    // Customer data
    ...customers.map((customer) => [
      customer.name || "",
      customer.phone || "-",
      customer.date || "-",
    ]),
    [],
    // Summary
    ["ملخص إجمالي"],
    ["عدد العملاء:", customers.length],
  ];

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "العملاء");

  // Apply RTL to all cells
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          ...ws[cellAddress].s,
          alignment: {
            horizontal: "right",
            vertical: "center",
            readingOrder: 2, // RTL
          },
        };
      }
    }
  }

  // Set workbook to RTL
  wb.Workbook = { Views: [{ RTL: true }] };
  ws["!rtl"] = true;

  XLSX.writeFile(
    wb,
    `قائمة_العملاء_${new Date().toISOString().split("T")[0]}.xlsx`
  );
  return true;
};

export const exportSuppliersToExcel = (suppliers) => {
  // Create organized Excel structure for suppliers
  const excelData = [
    // Header section
    ["قائمة الموردين"],
    [],
    // Table headers
    ["اسم المورد", "رقم الهاتف", "تاريخ الإضافة"],
    // Supplier data
    ...suppliers.map((supplier) => [
      supplier.name || "",
      supplier.phone || "-",
      supplier.date || "-",
    ]),
    [],
    // Summary
    ["ملخص إجمالي"],
    ["عدد الموردين:", suppliers.length],
  ];

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الموردين");

  // Apply RTL to all cells
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          ...ws[cellAddress].s,
          alignment: {
            horizontal: "right",
            vertical: "center",
            readingOrder: 2, // RTL
          },
        };
      }
    }
  }

  // Set workbook to RTL
  wb.Workbook = { Views: [{ RTL: true }] };
  ws["!rtl"] = true;

  XLSX.writeFile(
    wb,
    `قائمة_الموردين_${new Date().toISOString().split("T")[0]}.xlsx`
  );
  return true;
};

export const exportInventoryToExcel = async (inventory) => {
  try {
    // Fetch sections data
    const sectionsResponse = await fetch(apiUrl("/api/inventory/sections"));
    const sections = await sectionsResponse.json();
    // Always fetch items per section from the API to avoid relying on the current view/filter

    // Create organized Excel structure
    const excelData = [
      // Header section
      ["تقرير المخزون الشامل"],
      [],
      ["تاريخ التقرير:", new Date().toLocaleDateString("ar-EG")],
      [],
    ];

    // Add each section with its items
    const overallItems = [];
    for (const section of sections) {
      // Load items for this section explicitly
      let sectionItems = [];
      try {
        const itemsRes = await fetch(
          apiUrl(`/api/inventory/section/${section.id}`)
        );
        sectionItems = await itemsRes.json();
      } catch {
        sectionItems = [];
      }
      // Track for overall summary
      overallItems.push(...sectionItems);

      // Section header
      excelData.push([`قسم: ${section.name}`]);
      if (section.description) {
        excelData.push([`الوصف: ${section.description}`]);
      }
      excelData.push([]);

      if (sectionItems && sectionItems.length > 0) {
        // Items table headers
        excelData.push([
          "اسم الصنف",
          "رقم اللون",
          "عدد الأتواب",
          "إجمالي الأمتار",
          "الوحدة",
        ]);

        // Items data
        sectionItems.forEach((item) => {
          excelData.push([
            item.item_name || "",
            item.color_number || "",
            item.rolls_count || 0,
            item.total_meters || 0,
            item.unit || "متر",
          ]);
        });

        // Section summary
        const sectionTotalMeters = sectionItems.reduce(
          (sum, item) => sum + (parseFloat(item.total_meters) || 0),
          0
        );
        const sectionTotalRolls = sectionItems.reduce(
          (sum, item) => sum + (parseInt(item.rolls_count) || 0),
          0
        );

        excelData.push([]);
        excelData.push([`إجمالي القسم: ${section.name}`]);
        excelData.push([`عدد الأصناف: ${sectionItems.length}`]);
        excelData.push([`إجمالي الأتواب: ${sectionTotalRolls}`]);
        excelData.push([`إجمالي الأمتار: ${sectionTotalMeters}`]);
      } else {
        excelData.push(["لا توجد أصناف في هذا القسم"]);
      }

      excelData.push([]);
      excelData.push([]);
    }

    // Overall summary
    const totalItems = overallItems.length;
    const totalMeters = overallItems.reduce(
      (sum, item) => sum + (parseFloat(item.total_meters) || 0),
      0
    );
    const totalRolls = overallItems.reduce(
      (sum, item) => sum + (parseInt(item.rolls_count) || 0),
      0
    );

    excelData.push(["الملخص العام"]);
    excelData.push(["عدد الأقسام:", sections.length]);
    excelData.push(["عدد الأصناف:", totalItems]);
    excelData.push(["إجمالي الأتواب:", totalRolls]);
    excelData.push(["إجمالي الأمتار:", totalMeters]);

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المخزون");

    // Apply RTL to all cells
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            ...ws[cellAddress].s,
            alignment: {
              horizontal: "right",
              vertical: "center",
              readingOrder: 2, // RTL
            },
          };
        }
      }
    }

    // Set workbook to RTL
    wb.Workbook = { Views: [{ RTL: true }] };
    ws["!rtl"] = true;

    XLSX.writeFile(
      wb,
      `تقرير_المخزون_${new Date().toISOString().split("T")[0]}.xlsx`
    );
    return true;
  } catch (error) {
    console.error("Error exporting inventory:", error);
    return false;
  }
};

export const exportStatisticsToExcel = (stats) => {
  try {
    // Create organized Excel structure for statistics
    const excelData = [
      // Header section
      ["تقرير الإحصائيات الشامل", "", "", ""],
      ["", "", "", ""],
      ["تاريخ التقرير:", new Date().toLocaleDateString("ar-EG"), "", ""],
      ["وقت التقرير:", new Date().toLocaleTimeString("ar-EG"), "", ""],
      ["", "", "", ""],

      // Customer statistics section
      ["إحصائيات العملاء", "", "", ""],
      ["", "", "", ""],
      ["عدد العملاء", stats.customersCount || 0, "عميل", ""],
      [
        "إجمالي مستحقات العملاء",
        (stats.customersTotal || 0).toFixed(2),
        "ج.م",
        "",
      ],
      ["المدفوع من العملاء", (stats.customersPaid || 0).toFixed(2), "ج.م", ""],
      [
        "المتبقي من العملاء",
        (stats.customersRemaining || 0).toFixed(2),
        "ج.م",
        "",
      ],
      ["", "", "", ""],

      // Supplier statistics section
      ["إحصائيات الموردين", "", "", ""],
      ["", "", "", ""],
      ["عدد الموردين", stats.suppliersCount || 0, "مورد", ""],
      [
        "إجمالي مستحقات الموردين",
        (stats.suppliersTotal || 0).toFixed(2),
        "ج.م",
        "",
      ],
      ["المدفوع للموردين", (stats.suppliersPaid || 0).toFixed(2), "ج.م", ""],
      [
        "المتبقي للموردين",
        (stats.suppliersRemaining || 0).toFixed(2),
        "ج.م",
        "",
      ],
      [
        "المبلغ اللي عند الموردين لك",
        (stats.suppliersCreditTotal || 0).toFixed(2),
        "ج.م",
        "",
      ],
      ["", "", "", ""],

      // Inventory statistics section
      ["إحصائيات المخزون", "", "", ""],
      ["", "", "", ""],
      ["عدد الأقسام", stats.sectionsCount || 0, "قسم", ""],
      ["عدد الأصناف", stats.inventoryCount || 0, "صنف", ""],
      [
        "إجمالي الأمتار",
        (stats.inventoryTotalMeters || 0).toFixed(2),
        "متر",
        "",
      ],
      [
        "إجمالي الكيلوجرامات",
        (stats.inventoryTotalKilos || 0).toFixed(2),
        "كيلو",
        "",
      ],
      ["", "", "", ""],

      // Sales statistics section
      ["إحصائيات المبيعات", "", "", ""],
      ["", "", "", ""],
      ["عدد المبيعات", stats.salesCount || 0, "عملية", ""],
      ["إجمالي المبيعات (قبل المرتجعات)", (stats.salesTotal || 0).toFixed(2), "ج.م", ""],
      ["إجمالي المرتجعات", (stats.returnedTotal || 0).toFixed(2), "ج.م", ""],
      ["صافي المبيعات (بعد المرتجعات)", (stats.netSalesTotal ?? stats.salesTotal ?? 0).toFixed(2), "ج.م", ""],
      ["المبيعات المسددة", (stats.salesPaid || 0).toFixed(2), "ج.م", ""],
      ["المبيعات المتبقية", (stats.salesRemaining || 0).toFixed(2), "ج.م", ""],
      ["", "", "", ""],

      // Expenses statistics section
      ["إحصائيات المصروفات", "", "", ""],
      ["", "", "", ""],
      ["عدد المصروفات", stats.expensesCount || 0, "مصروف", ""],
      [
        "إجمالي المصروفات الداخلية",
        (stats.expensesInside || 0).toFixed(2),
        "ج.م",
        "",
      ],
      [
        "إجمالي المصروفات الخارجية",
        (stats.expensesOutside || 0).toFixed(2),
        "ج.م",
        "",
      ],
      ["إجمالي المصروفات", (stats.expensesTotal || 0).toFixed(2), "ج.م", ""],
      ["", "", "", ""],

      // Financial summary section
      ["الملخص المالي الشامل", "", "", ""],
      ["", "", "", ""],
      ["صافي الأرباح", (stats.netProfit || 0).toFixed(2), "ج.م", ""],
      ["صافي الخسائر", (stats.netLoss || 0).toFixed(2), "ج.م", ""],
      ["صافي الدخل", (stats.netIncome || 0).toFixed(2), "ج.م", ""],
      ["", "", "", ""],

      // Additional metrics
      ["مؤشرات الأداء", "", "", ""],
      ["", "", "", ""],
      ["نسبة التحصيل", (stats.paymentRate || 0).toFixed(2), "%", ""],
      ["هامش الربح", (stats.profitMargin || 0).toFixed(2), "%", ""],
      [
        "متوسط قيمة المصروف",
        (stats.averageExpenseValue || 0).toFixed(2),
        "ج.م",
        "",
      ],
      [
        "متوسط قيمة المبيعة",
        (stats.averageSaleValue || 0).toFixed(2),
        "ج.م",
        "",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الإحصائيات");

    // Set column widths for better readability
    ws["!cols"] = [
      { wch: 35 }, // Column A - Arabic text (wider for long text)
      { wch: 20 }, // Column B - Numbers
      { wch: 8 }, // Column C - Units
      { wch: 5 }, // Column D - Empty
    ];

    // Apply styling and RTL to all cells
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellAddress]) {
          const cell = ws[cellAddress];

          // Style headers (section titles)
          if (
            col === 0 &&
            ((cell.v && cell.v.toString().includes("إحصائيات")) ||
              (cell.v && cell.v.toString().includes("الملخص")) ||
              (cell.v && cell.v.toString().includes("مؤشرات")))
          ) {
            cell.s = {
              font: { bold: true, size: 14, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "4472C4" } },
              alignment: {
                horizontal: "center",
                vertical: "center",
                readingOrder: 2,
                wrapText: true,
              },
              border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } },
              },
            };
          }
          // Style main title
          else if (row === 0 && col === 0) {
            cell.s = {
              font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "2F5597" } },
              alignment: {
                horizontal: "center",
                vertical: "center",
                readingOrder: 2,
                wrapText: true,
              },
              border: {
                top: { style: "medium", color: { rgb: "000000" } },
                bottom: { style: "medium", color: { rgb: "000000" } },
                left: { style: "medium", color: { rgb: "000000" } },
                right: { style: "medium", color: { rgb: "000000" } },
              },
            };
          }
          // Style data rows
          else if (col === 0 && cell.v && cell.v.toString().length > 0) {
            cell.s = {
              font: { bold: true, size: 11 },
              fill: { fgColor: { rgb: "F2F2F2" } },
              alignment: {
                horizontal: "right",
                vertical: "center",
                readingOrder: 2,
                wrapText: true,
              },
              border: {
                top: { style: "thin", color: { rgb: "CCCCCC" } },
                bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                left: { style: "thin", color: { rgb: "CCCCCC" } },
                right: { style: "thin", color: { rgb: "CCCCCC" } },
              },
            };
          }
          // Style numbers
          else if (col === 1 && cell.v !== undefined && cell.v !== "") {
            cell.s = {
              font: { size: 11 },
              alignment: {
                horizontal: "center",
                vertical: "center",
                readingOrder: 2,
              },
              border: {
                top: { style: "thin", color: { rgb: "CCCCCC" } },
                bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                left: { style: "thin", color: { rgb: "CCCCCC" } },
                right: { style: "thin", color: { rgb: "CCCCCC" } },
              },
            };
          }
          // Style units
          else if (col === 2 && cell.v && cell.v.toString().length > 0) {
            cell.s = {
              font: { size: 10, italic: true },
              alignment: {
                horizontal: "center",
                vertical: "center",
                readingOrder: 2,
              },
              border: {
                top: { style: "thin", color: { rgb: "CCCCCC" } },
                bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                left: { style: "thin", color: { rgb: "CCCCCC" } },
                right: { style: "thin", color: { rgb: "CCCCCC" } },
              },
            };
          }
          // Default styling
          else {
            cell.s = {
              alignment: {
                horizontal: "right",
                vertical: "center",
                readingOrder: 2,
              },
            };
          }
        }
      }
    }

    // Set workbook to RTL
    wb.Workbook = { Views: [{ RTL: true }] };
    ws["!rtl"] = true;

    // Generate filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");

    XLSX.writeFile(wb, `تقرير_الإحصائيات_${dateStr}_${timeStr}.xlsx`);
    return true;
  } catch (error) {
    console.error("Error exporting statistics:", error);
    return false;
  }
};

export const exportSalesToExcel = (sales) => {
  // Create organized Excel structure for sales
  const excelData = [
    // Header section
    ["قائمة المبيعات"],
    [],
    // Table headers
    [
      "اسم العميل",
      "الوصف",
      "الكمية",
      "الوحدة",
      "السعر",
      "الإجمالي",
      "المسدّد",
      "الباقي",
      "التاريخ",
    ],
    // Sales data
    ...sales.map((sale) => [
      sale.customer_name || "",
      sale.description || "",
      sale.quantity || 0,
      sale.unit || "متر",
      sale.price || 0,
      (sale.total || 0).toFixed(2),
      (sale.paid || 0).toFixed(2),
      (sale.remaining || 0).toFixed(2),
      sale.date || "",
    ]),
    [],
    // Summary
    ["ملخص إجمالي"],
    ["عدد المبيعات:", sales.length],
    [
      "إجمالي المبيعات:",
      sales
        .reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0)
        .toFixed(2),
    ],
    [
      "إجمالي المسدد:",
      sales
        .reduce((sum, sale) => sum + (parseFloat(sale.paid) || 0), 0)
        .toFixed(2),
    ],
    [
      "إجمالي الباقي:",
      sales
        .reduce((sum, sale) => sum + (parseFloat(sale.remaining) || 0), 0)
        .toFixed(2),
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المبيعات");

  // Apply RTL to all cells
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          ...ws[cellAddress].s,
          alignment: {
            horizontal: "right",
            vertical: "center",
            readingOrder: 2, // RTL
          },
        };
      }
    }
  }

  // Set workbook to RTL
  wb.Workbook = { Views: [{ RTL: true }] };
  ws["!rtl"] = true;

  XLSX.writeFile(
    wb,
    `قائمة_المبيعات_${new Date().toISOString().split("T")[0]}.xlsx`
  );
  return true;
};

export const exportExpensesToExcel = (expenses) => {
  // Create organized Excel structure for expenses
  const excelData = [
    // Header section
    ["قائمة المصروفات"],
    [],
    // Table headers
    ["التصنيف", "الوصف", "المبلغ", "النوع", "التاريخ"],
    // Expenses data
    ...expenses.map((expense) => [
      expense.category || "",
      expense.description || "",
      (expense.amount || 0).toFixed(2),
      expense.direction || "",
      expense.date || "",
    ]),
    [],
    // Summary
    ["ملخص إجمالي"],
    ["عدد المصروفات:", expenses.length],
    [
      "إجمالي المصروفات:",
      expenses
        .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0)
        .toFixed(2),
    ],
    [
      "المصروفات الداخلية:",
      expenses
        .filter((e) => e.direction === "داخل")
        .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0)
        .toFixed(2),
    ],
    [
      "المصروفات الخارجية:",
      expenses
        .filter((e) => e.direction === "خارج")
        .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0)
        .toFixed(2),
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المصروفات");

  // Apply RTL to all cells
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          ...ws[cellAddress].s,
          alignment: {
            horizontal: "right",
            vertical: "center",
            readingOrder: 2, // RTL
          },
        };
      }
    }
  }

  // Set workbook to RTL
  wb.Workbook = { Views: [{ RTL: true }] };
  ws["!rtl"] = true;

  XLSX.writeFile(
    wb,
    `قائمة_المصروفات_${new Date().toISOString().split("T")[0]}.xlsx`
  );
  return true;
};
