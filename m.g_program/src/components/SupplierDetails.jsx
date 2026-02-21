import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { formatNumber, formatDateToDisplay, parseDisplayDateToISO } from "../utils/format";
import { apiUrl } from "../utils/api";
import * as XLSX from "xlsx";
import ConfirmDialog from "./ConfirmDialog";

function SupplierDetails({ supplier, onClose }) {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [orderFormData, setOrderFormData] = useState({
    description: "",
    quantity: "",
    unit: "متر",
    price: "",
    paid: "",
    date: new Date().toISOString().split("T")[0],
    section_id: "",
    inventory_item_id: "",
    color_number: "",
    rolls_count: "",
    add_to_inventory: false,
  });
  const [sections, setSections] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [showNewSectionInput, setShowNewSectionInput] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [orderItems, setOrderItems] = useState([]);
  const [orderDateInputValue, setOrderDateInputValue] = useState("");

  useEffect(() => {
    if (showOrderModal) setOrderDateInputValue(formatDateToDisplay(orderFormData.date));
  }, [orderFormData.date, showOrderModal]);

  useEffect(() => {
    if (supplier) {
      fetchSupplierData();
      fetchSections();
    }
  }, [supplier]);

  useEffect(() => {
    if (orderFormData.section_id) {
      fetchInventory(orderFormData.section_id);
    } else {
      setInventory([]);
    }
  }, [orderFormData.section_id]);

  // عند إضافة أوردر جديد فقط: مزامنة الوحدة + الوصف + السعر من الصنف عند اختيار صنف موجود.
  useEffect(() => {
    if (editingOrder) return;
    if (orderFormData.add_to_inventory && orderFormData.inventory_item_id && inventory.length > 0) {
      const selectedItem = inventory.find(
        item => item.id === parseInt(orderFormData.inventory_item_id, 10)
      );
      if (selectedItem) {
        setOrderFormData(prev => ({
          ...prev,
          unit: selectedItem.unit || "متر",
          description: selectedItem.item_name || prev.description,
          price: selectedItem.purchase_price != null && selectedItem.purchase_price !== ""
            ? String(selectedItem.purchase_price)
            : prev.price,
        }));
      }
    }
  }, [editingOrder, orderFormData.inventory_item_id, inventory, orderFormData.add_to_inventory]);

  const fetchSections = async () => {
    try {
      const res = await fetch(apiUrl('/api/inventory/sections'));
      const data = await res.json();
      setSections(data || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  const fetchInventory = async (sectionId) => {
    try {
      const res = await fetch(apiUrl(`/api/inventory/section/${sectionId}`));
      const data = await res.json();
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setInventory([]);
    }
  };

  const fetchSupplierData = async () => {
    try {
      const res = await fetch(
        apiUrl(
          `/api/suppliers/statement?supplier_id=${supplier.id}`
        )
      );
      const json = await res.json();
      const rows = json && json.success ? json.rows : [];

      // Map unified rows into UI shape (مع الحفاظ على حقول الربط بالمخزون)
      const transactions = (Array.isArray(rows) ? rows : []).map((r) => ({
        type: r.type,
        id: r.id, // id of unified table (insertion order)
        order_id: r.order_id, // ID from suppliers table
        payment_id: r.payment_id, // ID from supplier_payments table
        date: r.date,
        created_at: r.created_at,
        description: r.description || (r.type === "payment" ? "دفعة" : ""),
        quantity: r.quantity || 0,
        price: r.price || 0,
        total: r.total || 0,
        paid: r.paid || 0,
        amount: r.amount || 0,
        value: r.type === "order" ? r.total || 0 : 0,
        unit: r.unit || "متر",
        section_id: r.section_id ?? null,
        inventory_item_id: r.inventory_item_id != null ? r.inventory_item_id : null,
        color_number: r.color_number ?? null,
        rolls_count: r.rolls_count ?? null,
        add_to_inventory: r.add_to_inventory === 1 || r.add_to_inventory === true || r.add_to_inventory === "1" || false,
      }));

      // Sort transactions: prefer global_sequence if present, otherwise date then id
      const sorted = (transactions || []).slice().sort((a, b) => {
        const ga = a.global_sequence;
        const gb = b.global_sequence;
        if (ga != null && gb != null && ga !== gb) return ga - gb;
        const da = new Date(a.created_at || a.date).getTime() || 0;
        const db = new Date(b.created_at || b.date).getTime() || 0;
        if (da !== db) return da - db;
        return (a.id || 0) - (b.id || 0);
      });

      // Attach a per-account display index so numbering always starts at 1 for this supplier
      const withLocalIndex = sorted.map((t, i) => ({
        ...t,
        localIndex: i + 1,
      }));
      setAllTransactions(withLocalIndex);
    } catch (error) {
      console.error("Error fetching supplier data:", error);
      addNotification("خطأ في تحميل بيانات المورد", "error");
    }
  };

  const updateStatistics = async () => {
    try {
      // إرسال إشارة لتحديث الإحصائيات في جميع النوافذ المفتوحة
      window.dispatchEvent(new CustomEvent("updateStatistics"));
    } catch (error) {
      console.error("Error updating statistics:", error);
    }
  };

  const calculateRunningBalance = () => {
    let balance = 0;
    return (Array.isArray(allTransactions) ? allTransactions : []).map(
      (transaction) => {
        if (transaction.type === "order") {
          const totalValue =
            transaction.total != null
              ? transaction.total
              : transaction.value || 0;
          const paidValue = transaction.paid || 0;
          balance += totalValue;
          balance -= paidValue;
        } else if (transaction.type === "payment") {
          const pay = transaction.amount || transaction.paid || 0;
          balance -= pay;
        }
        return { ...transaction, runningBalance: balance };
      }
    );
  };

  const getAccountStatus = () => {
    const transactionsWithBalance = calculateRunningBalance();
    const finalBalance =
      Array.isArray(transactionsWithBalance) &&
      transactionsWithBalance.length > 0
        ? transactionsWithBalance[transactionsWithBalance.length - 1]
            .runningBalance
        : 0;

    const hasAny = Array.isArray(allTransactions) && allTransactions.length > 0;

    if (!hasAny) {
      return { status: "لا توجد معاملات", amount: 0, color: "text-gray-500" };
    }

    if (finalBalance > 0) {
      return {
        status: "له مبلغ متبقي",
        amount: finalBalance,
        color: "text-red-500",
      };
    } else if (finalBalance < 0) {
      return {
        status: "لك مبلغ عنده",
        amount: Math.abs(finalBalance),
        color: "text-blue-500",
      };
    } else {
      return { status: "مسدد بالكامل", amount: 0, color: "text-green-500" };
    }
  };

  const getTotals = () => {
    const orderTotal = (Array.isArray(allTransactions) ? allTransactions : [])
      .filter((t) => t.type === "order")
      .reduce((sum, t) => sum + (t.total || 0), 0);
    const ordersPaid = (Array.isArray(allTransactions) ? allTransactions : [])
      .filter((t) => t.type === "order")
      .reduce((sum, t) => sum + (t.paid || 0), 0);
    const paymentTotal = (Array.isArray(allTransactions) ? allTransactions : [])
      .filter((t) => t.type === "payment")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalPaid = ordersPaid + paymentTotal;
    const remaining = orderTotal - totalPaid;

    return {
      total: orderTotal,
      paid: totalPaid,
      remaining: remaining,
    };
  };

  const openPaymentModal = () => {
    setPaymentFormData({
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    });
    setEditingPayment(null);
    setShowPaymentModal(true);
  };

  const openEditPaymentModal = (payment) => {
    setPaymentFormData({
      amount: payment.amount.toString(),
      description: payment.description || "",
      date: payment.date,
    });
    setEditingPayment(payment);
    setShowEditPaymentModal(true);
  };

  const openOrderModal = (order = null) => {
    if (order) {
      // استخدام القيمة الفعلية من الطلب - إذا كان مرتبط بالمخزون
      const isLinkedToInventory = order.add_to_inventory === true || order.add_to_inventory === 1 || order.add_to_inventory === "1";
      setOrderFormData({
        description: order.description || "",
        quantity: order.quantity?.toString() || "",
        unit: order.unit || "متر",
        price: order.price?.toString() || "",
        paid: order.paid?.toString() || "",
        date: order.date,
        section_id: order.section_id != null ? String(order.section_id) : "",
        inventory_item_id: order.inventory_item_id != null ? String(order.inventory_item_id) : "",
        color_number: order.color_number || "",
        rolls_count: order.rolls_count != null ? String(order.rolls_count) : "",
        add_to_inventory: isLinkedToInventory,
      });
      setEditingOrder(order);
      if (order.section_id) {
        fetchInventoryBySection(order.section_id);
      }
    } else {
      setOrderFormData({
        description: "",
        quantity: "",
        unit: "متر",
        price: "",
        paid: "",
        date: new Date().toISOString().split("T")[0],
        section_id: "",
        inventory_item_id: "",
        color_number: "",
        rolls_count: "",
        add_to_inventory: false,
      });
      setEditingOrder(null);
    }
    setShowNewSectionInput(false);
    setNewSectionName("");
    setShowOrderModal(true);
  };
  
  const fetchInventoryBySection = async (sectionId) => {
    try {
      const response = await fetch(apiUrl(`/api/inventory/section/${sectionId}`));
      const data = await response.json();
      setInventory(data);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  };

  const addItemToOrder = () => {
    if (!orderFormData.description || !orderFormData.quantity || !orderFormData.price) {
      addNotification('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    const quantity = parseFloat(orderFormData.quantity) || 0;
    const price = parseFloat(orderFormData.price) || 0;
    const total = quantity * price;
    const paid = parseFloat(orderFormData.paid) || 0;

    const newItem = {
      description: orderFormData.description,
      quantity,
      price,
      total,
      paid,
      unit: orderFormData.unit,
      section_id: orderFormData.section_id,
      inventory_item_id: orderFormData.inventory_item_id,
      color_number: orderFormData.color_number,
      rolls_count: orderFormData.rolls_count,
      add_to_inventory: orderFormData.add_to_inventory,
      id: Date.now()
    };

    setOrderItems([...orderItems, newItem]);
    setOrderFormData({
      description: "",
      quantity: "",
      unit: "متر",
      price: "",
      paid: "",
      date: orderFormData.date,
      section_id: orderFormData.section_id,
      inventory_item_id: "",
      color_number: "",
      rolls_count: "",
      add_to_inventory: orderFormData.add_to_inventory,
    });
  };

  const removeItemFromOrder = (itemId) => {
    setOrderItems(orderItems.filter(item => item.id !== itemId));
  };

  const editItemFromOrder = (item) => {
    setOrderFormData({
      description: item.description,
      quantity: item.quantity.toString(),
      unit: item.unit,
      price: item.price.toString(),
      paid: item.paid != null ? String(item.paid) : "",
      date: orderFormData.date,
      section_id: item.section_id || "",
      inventory_item_id: item.inventory_item_id || "",
      color_number: item.color_number || "",
      rolls_count: item.rolls_count ? item.rolls_count.toString() : "",
      add_to_inventory: item.add_to_inventory || false,
    });
    setOrderItems(orderItems.filter(i => i.id !== item.id));
  };

  const getOrderTotal = () => {
    return orderItems.reduce((total, item) => total + (item.total || 0), 0);
  };

  const getOrderPaidTotal = () => {
    return orderItems.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(apiUrl("/api/supplier-payments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          supplier_phone: supplier.phone,
          amount: parseFloat(paymentFormData.amount),
          description: paymentFormData.description,
          date: paymentFormData.date,
        }),
      });

      if (response.ok) {
        addNotification("تم إضافة الدفعة بنجاح", "success");
        setShowPaymentModal(false);
        fetchSupplierData();
        // تحديث الإحصائيات بعد إضافة الدفعة
        updateStatistics();
      } else {
        addNotification("فشل في إضافة الدفعة", "error");
      }
    } catch (error) {
      addNotification("حدث خطأ أثناء إضافة الدفعة", "error");
    }
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      // استخدام payment_id من جدول الدفعات
      const paymentId = editingPayment.payment_id;
      if (!paymentId) {
        addNotification("خطأ: لم يتم العثور على معرف الدفعة", "error");
        return;
      }

      const response = await fetch(
        apiUrl(`/api/supplier-payments/${paymentId}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            supplier_phone: supplier.phone,
            amount: parseFloat(paymentFormData.amount),
            description: paymentFormData.description,
            date: paymentFormData.date,
          }),
        }
      );

      if (response.ok) {
        addNotification("تم تعديل الدفعة بنجاح", "success");
        setShowEditPaymentModal(false);
        fetchSupplierData();
        // تحديث الإحصائيات بعد تعديل الدفعة
        updateStatistics();
      } else {
        addNotification("فشل في تعديل الدفعة", "error");
      }
    } catch (error) {
      addNotification("حدث خطأ أثناء تعديل الدفعة", "error");
    }
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingOrder) {
        let sectionId = orderFormData.section_id;
        
        if (showNewSectionInput && newSectionName.trim()) {
          const sectionResponse = await fetch(apiUrl("/api/inventory/sections"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newSectionName.trim(), description: "" }),
          });
          
          if (sectionResponse.ok) {
            const result = await sectionResponse.json();
            sectionId = result.id;
            await fetchSections();
            addNotification("تم إنشاء القسم الجديد بنجاح", "success");
          } else {
            addNotification("فشل في إنشاء القسم الجديد", "error");
            return;
          }
        }

        const quantity = parseFloat(orderFormData.quantity) || 0;
        const price = parseFloat(orderFormData.price) || 0;
        const paid = parseFloat(orderFormData.paid) || 0;
        const total = quantity * price;
        const remaining = total - paid;

        // التأكد من إرسال البيانات الصحيحة للمخزون
        const inventoryItemId = orderFormData.inventory_item_id ? parseInt(orderFormData.inventory_item_id) : null;
        const sectionIdFinal = sectionId ? parseInt(sectionId) : null;
        
        const orderData = {
          supplier_id: supplier.id,
          name: supplier.name,
          phone: supplier.phone,
          description: orderFormData.description,
          quantity: quantity,
          unit: orderFormData.unit,
          price: price,
          total: total,
          paid: paid,
          remaining: remaining,
          date: orderFormData.date,
          section_id: sectionIdFinal,
          inventory_item_id: inventoryItemId,
          color_number: orderFormData.color_number || null,
          rolls_count: orderFormData.rolls_count ? parseInt(orderFormData.rolls_count, 10) : null,
          add_to_inventory: orderFormData.add_to_inventory === true || orderFormData.add_to_inventory === 1,
        };

        const url = apiUrl(`/api/supplier-orders/${editingOrder.order_id}`);
        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        if (response.ok) {
          addNotification("تم تعديل الأوردر بنجاح", "success");
          setShowOrderModal(false);
          setShowNewSectionInput(false);
          setNewSectionName("");
          fetchSupplierData();
          updateStatistics();
        } else {
          addNotification("فشل في حفظ الأوردر", "error");
        }
      } else {
        if (orderItems.length === 0) {
          addNotification('يرجى إضافة صنف واحد على الأقل', 'error');
          return;
        }

        const promises = orderItems.map(async (item) => {
          let sectionId = item.section_id;
          
          if (showNewSectionInput && newSectionName.trim() && !sectionId) {
            const sectionResponse = await fetch(apiUrl("/api/inventory/sections"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: newSectionName.trim(), description: "" }),
            });
            
            if (sectionResponse.ok) {
              const result = await sectionResponse.json();
              sectionId = result.id;
            }
          }

          const itemPaid = parseFloat(item.paid) || 0;
          const itemTotal = item.total || 0;
          const itemRemaining = itemTotal - itemPaid;

          const payload = {
            supplier_id: supplier.id,
            name: supplier.name,
            phone: supplier.phone,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            total: itemTotal,
            paid: itemPaid,
            remaining: itemRemaining,
            date: orderFormData.date,
            section_id: sectionId || null,
            inventory_item_id: item.inventory_item_id || null,
            color_number: item.color_number || null,
            rolls_count: item.rolls_count ? parseInt(item.rolls_count) : null,
            add_to_inventory: item.add_to_inventory || false,
          };

          const res = await fetch(apiUrl("/api/supplier-orders"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            throw new Error(`فشل في حفظ الصنف: ${item.description}`);
          }

          return res.json();
        });

        await Promise.all(promises);

        addNotification(`تم إضافة ${orderItems.length} أوردر`, "success");
        setShowOrderModal(false);
        setShowNewSectionInput(false);
        setNewSectionName("");
        setOrderItems([]);
        fetchSupplierData();
        updateStatistics();
      }
    } catch (error) {
      addNotification("حدث خطأ أثناء حفظ الأوردر: " + error.message, "error");
    }
  };

  const handleDeletePayment = (payment) => {
    setDeleteItem({ type: "payment", data: payment });
    setShowDeleteDialog(true);
  };

  const handleDeleteOrder = (order) => {
    setDeleteItem({ type: "order", data: order });
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      let response;
      if (deleteItem.type === "payment") {
        // استخدام payment_id من جدول الدفعات
        const paymentId = deleteItem.data.payment_id;
        if (!paymentId) {
          addNotification("خطأ: لم يتم العثور على معرف الدفعة", "error");
          return;
        }
        response = await fetch(apiUrl(`/api/supplier-payments/${paymentId}`), {
          method: "DELETE",
        });
      } else {
        // استخدام order_id من جدول الأوردرات
        const orderId = deleteItem.data.order_id;
        if (!orderId) {
          addNotification("خطأ: لم يتم العثور على معرف الأوردر", "error");
          return;
        }
        response = await fetch(apiUrl(`/api/supplier-orders/${orderId}`), {
          method: "DELETE",
        });
      }

      if (response.ok) {
        addNotification("تم الحذف بنجاح", "success");
        fetchSupplierData();
        // تحديث الإحصائيات بعد الحذف
        updateStatistics();
      } else {
        addNotification("فشل في الحذف", "error");
      }
    } catch (error) {
      addNotification("حدث خطأ أثناء الحذف", "error");
    } finally {
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setDeleteItem(null);
  };

  const exportToExcel = () => {
    const transactionsWithBalance = calculateRunningBalance();
    const accountStatus = getAccountStatus();
    const totals = getTotals();
    const orderCount = (
      Array.isArray(allTransactions) ? allTransactions : []
    ).filter((t) => t.type === "order").length;
    const paymentCount = (
      Array.isArray(allTransactions) ? allTransactions : []
    ).filter((t) => t.type === "payment").length;

    // Create organized Excel structure
    const excelData = [
      // Header section
      ["كشف حساب مورد"],
      [],
      ["اسم المورد:", supplier.name],
      ["حالة الحساب:", accountStatus.status],
      [],
      // Table headers
      [
        "#",
        "الرصيد",
        "المسدد",
        "القيمة",
        "السعر",
        "الكمية",
        "الوحدة",
        "البيان",
        "التاريخ",
      ],
      // Transaction data
      ...(Array.isArray(transactionsWithBalance)
        ? transactionsWithBalance
        : []
      ).map((transaction, idx) => [
        transaction.localIndex || idx + 1,
        Math.abs(transaction.runningBalance),
        transaction.type === "payment"
          ? transaction.amount
          : transaction.paid || 0,
        transaction.type === "order" ? transaction.total : "",
        transaction.type === "order" ? transaction.price : "",
        transaction.type === "order" ? transaction.quantity : "",
        transaction.type === "order" ? (transaction.unit || "متر") : "—",
        transaction.description ||
          (transaction.type === "payment" ? "دفعة" : "أوردر"),
        transaction.date,
      ]),
      [],
      // Summary section
      ["ملخص إجمالي"],
      ["عدد الأوردرات:", orderCount],
      ["عدد الدفعات:", paymentCount],
      ["إجمالي القيمة:", totals.total || 0],
      ["إجمالي المسدد:", totals.paid || 0],
      [
        totals.remaining < 0 ? "المبلغ المستحق له:" : "الرصيد النهائي:",
        Math.abs(totals.remaining || 0),
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // RTL support
    ws["!cols"] = Array(9).fill({ wch: 15 });

    // Set RTL direction for all cells
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

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف حساب المورد");

    // Set workbook to RTL
    wb.Workbook = { Views: [{ RTL: true }] };
    ws["!rtl"] = true;

    XLSX.writeFile(wb, `كشف_حساب_مورد_${supplier.name}.xlsx`);
    addNotification("تم تصدير كشف الحساب إلى Excel", "success");
  };

  const generatePDF = () => {
    const transactionsWithBalance = calculateRunningBalance();
    const accountStatus = getAccountStatus();

    const today = new Date().toISOString().split("T")[0];
    const fileName = `كشف حساب المورد - ${supplier.name} - ${today}`;

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${fileName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
          .print-title { text-align: center; padding: 10px 0; }
          .print-title h1 { color: #8b5e3c; font-size: 24px; margin-bottom: 5px; }
          .print-title h2 { font-size: 18px; }
          .print-info { padding: 8px 0 12px; font-size: 14px; }
          .print-info p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
          th { background-color: #8b5e3c; color: white; padding: 8px; border: 1px solid #ddd; }
          td { padding: 8px; border: 1px solid #ddd; text-align: right; }
          .red-border-row { border: 2px solid #ef4444 !important; box-shadow: inset 0 0 0 2px #ef4444; }
          .thead-header { vertical-align: top; border: none; padding: 0; background: #fff; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            thead { display: table-header-group; }
          }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <td colspan="8" class="thead-header">
                <div class="print-title">
                  <h1>M.G Fabric Store</h1>
                  <h2>كشف حساب المورد</h2>
                </div>
                <div class="print-info">
                  <p><strong>اسم المورد:</strong> ${supplier.name}</p>
                  <p><strong>حالة الحساب:</strong> ${accountStatus.status}${accountStatus.amount > 0 ? ` - ${formatNumber(accountStatus.amount)} ج.م` : ""}</p>
                  <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString("ar-EG")}</p>
                </div>
              </td>
            </tr>
            <tr>
              <th>الرصيد</th>
              <th>المسدد</th>
              <th>القيمة</th>
              <th>السعر</th>
              <th>الكمية</th>
              <th>الوحدة</th>
              <th>البيان</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsWithBalance.map((t) => `
              <tr class="${t.type === "payment" ? "red-border-row" : ""}">
                <td>${formatNumber(Math.abs(t.runningBalance))}</td>
                <td>${t.type === "payment" ? formatNumber(t.amount) : (t.paid ? formatNumber(t.paid) : "0")}</td>
                <td>${t.type === "order" ? formatNumber(t.total) : ""}</td>
                <td>${t.type === "order" ? formatNumber(t.price) : ""}</td>
                <td>${t.type === "order" ? t.quantity : ""}</td>
                <td>${t.type === "order" ? (t.unit || "متر") : "—"}</td>
                <td>${t.description || (t.type === "payment" ? "دفعة" : "أوردر")}</td>
                <td>${t.date}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const generatePDFForWhatsApp = () => {
    setShowWhatsAppModal(true);
  };

  const sendViaWhatsApp = async () => {
    if (!whatsappPhone || whatsappPhone.trim() === "") {
      addNotification("يرجى إدخال رقم الهاتف", "error");
      return;
    }

    const phoneNumber = whatsappPhone.replace(/\D/g, "");
    if (phoneNumber.length < 10) {
      addNotification("رقم الهاتف غير صحيح", "error");
      return;
    }

    const countryCode = "20";
    const fullPhoneNumber = countryCode + phoneNumber;
    
    const message = encodeURIComponent(
      `مرحباً، يرجى الاطلاع على كشف حسابك:\nاسم المورد: ${supplier.name}\nالتاريخ: ${new Date().toLocaleDateString("ar-EG")}`
    );

    const whatsappUrl = `whatsapp://send?phone=${fullPhoneNumber}&text=${message}`;
    
    if (window.api && window.api.openExternal) {
      await window.api.openExternal(whatsappUrl);
      addNotification("تم فتح واتساب", "success");
    } else {
      window.location.href = whatsappUrl;
      addNotification("تم فتح واتساب", "success");
    }
    
    setShowWhatsAppModal(false);
    setWhatsappPhone("");
  };

  const accountStatus = getAccountStatus();
  const totals = getTotals();
  const orderCount = (
    Array.isArray(allTransactions) ? allTransactions : []
  ).filter((t) => t.type === "order").length;
  const paymentCount = (
    Array.isArray(allTransactions) ? allTransactions : []
  ).filter((t) => t.type === "payment").length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-lg ${
          theme === "dark" ? "bg-gray-900" : "bg-white"
        }`}
      >
        <div className="p-6">
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 bg-inherit pb-4 mb-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-lg ${
                    theme === "dark"
                      ? "bg-camel/20 text-camel"
                      : "bg-brown/20 text-brown"
                  }`}
                >
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <div>
                  <h2
                    className={`text-2xl font-bold ${
                      theme === "dark" ? "text-camel" : "text-brown"
                    }`}
                  >
                    كشف حساب المورد
                  </h2>
                  <p
                    className={`text-lg ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {supplier.name}
                  </p>
                </div>
                {/* Close Button - Next to title */}
                <button
                  onClick={onClose}
                  className={`p-2 rounded-lg hover:bg-opacity-80 transition-colors ${
                    theme === "dark"
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                  title="إغلاق"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-4">
                {/* Color Legend */}
                <div
                  className={`p-1.5 rounded-lg ${
                    theme === "dark" ? "bg-gray-800" : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-1 bg-black rounded"></div>
                      <span
                        className={`text-xs font-medium ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        الرصيد
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-1 bg-blue-500 rounded"></div>
                      <span
                        className={`text-xs font-medium ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        له مبلغ
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-1 bg-red-500 rounded"></div>
                      <span
                        className={`text-xs font-medium ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        المسدد
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-1 bg-green-500 rounded"></div>
                      <span
                        className={`text-xs font-medium ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        السعر
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div
            className={`p-4 rounded-lg mb-6 ${
              theme === "dark" ? "bg-gray-800" : "bg-gray-100"
            }`}
          >
            <div className="flex justify-between items-center">
              <span
                className={`text-lg font-medium ${
                  theme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
              >
                حالة الحساب:
              </span>
              <span className={`text-xl font-bold ${accountStatus.color}`}>
                {accountStatus.status}{" "}
                {accountStatus.amount > 0 &&
                  `${formatNumber(accountStatus.amount)} ج.م`}
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div
              className={`p-4 rounded-lg ${
                theme === "dark" ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`font-medium ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  عدد الأوردرات:
                </span>
                <span
                  className={`font-bold ${
                    theme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  {orderCount}
                </span>
              </div>
            </div>
            <div
              className={`p-4 rounded-lg ${
                theme === "dark" ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`font-medium ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  الدفعات:
                </span>
                <span
                  className={`font-bold ${
                    theme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  {paymentCount}
                </span>
              </div>
            </div>
            <div
              className={`p-4 rounded-lg ${
                theme === "dark" ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`font-medium ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  إجمالي القيمة:
                </span>
                <span
                  className={`font-bold text-lg ${
                    theme === "dark" ? "text-camel" : "text-brown"
                  }`}
                >
                  {formatNumber(totals.total || 0)} ج.م
                </span>
              </div>
            </div>
            <div
              className={`p-4 rounded-lg ${
                theme === "dark" ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`font-medium ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  إجمالي المسدد:
                </span>
                <span
                  className={`font-bold text-lg ${
                    theme === "dark" ? "text-camel" : "text-brown"
                  }`}
                >
                  {formatNumber(totals.paid || 0)} ج.م
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={openPaymentModal}
              className={`px-4 py-2 rounded-lg font-semibold ${
                theme === "dark" ? "bg-camel text-black" : "bg-brown text-white"
              }`}
            >
              تسديد دفعة
            </button>
            <button
              onClick={() => openOrderModal()}
              className={`px-4 py-2 rounded-lg font-semibold ${
                theme === "dark" ? "bg-camel text-black" : "bg-brown text-white"
              }`}
            >
              إضافة أوردر جديد
            </button>
            <button
              onClick={exportToExcel}
              className={`px-4 py-2 rounded-lg font-semibold ${
                theme === "dark" ? "bg-camel text-black" : "bg-brown text-white"
              }`}
            >
              تصدير Excel
            </button>
            <button
              onClick={generatePDF}
              className={`px-4 py-2 rounded-lg font-semibold ${
                theme === "dark" ? "bg-camel text-black" : "bg-brown text-white"
              }`}
            >
              طباعة PDF
            </button>
            <button
              onClick={generatePDFForWhatsApp}
              className={`px-4 py-2 rounded-lg font-semibold ${
                theme === "dark" ? "bg-green-600 text-white" : "bg-green-500 text-white"
              }`}
            >
              إرسال عبر واتساب
            </button>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-semibold ${
                theme === "dark"
                  ? "bg-gray-600 text-white"
                  : "bg-gray-500 text-white"
              }`}
            >
              إغلاق
            </button>
          </div>

          {/* Transactions Table */}
          {calculateRunningBalance().length > 0 ? (
            <div className="overflow-x-auto">
              <table
                className={`w-full border ${
                  theme === "dark"
                    ? "bg-gray-900 border-gray-700"
                    : "bg-white border-gray-300"
                }`}
              >
                <thead
                  className={theme === "dark" ? "bg-gray-800" : "bg-gray-100"}
                >
                  <tr>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      #
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      الرصيد
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      المسدد
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      القيمة
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      السعر
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      الكمية
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      الوحدة
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      البيان
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      التاريخ
                    </th>
                    <th
                      className={`px-3 py-2 text-right border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calculateRunningBalance().map((transaction, index) => (
                    <tr 
                      key={`${transaction.type}-${transaction.id || index}`}
                      className={
                        transaction.type === "payment"
                          ? "border-2 border-red-500"
                          : ""
                      }
                      style={
                        transaction.type === "payment"
                          ? { boxShadow: "inset 0 0 0 2px #ef4444" }
                          : {}
                      }
                    >
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        } font-bold ${
                          theme === "dark" ? "text-camel" : "text-brown"
                        }`}
                      >
                        {transaction.localIndex || index + 1}
                      </td>
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        } text-black`}
                      >
                        {formatNumber(Math.abs(transaction.runningBalance))}
                      </td>
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        } text-red-500`}
                      >
                        {transaction.type === "payment"
                          ? formatNumber(transaction.amount)
                          : transaction.paid
                          ? formatNumber(transaction.paid)
                          : "0"}
                      </td>
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        } text-green-500`}
                      >
                        {transaction.type === "order"
                          ? formatNumber(transaction.total)
                          : ""}
                      </td>
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        }`}
                      >
                        {transaction.type === "order"
                          ? formatNumber(transaction.price)
                          : ""}
                      </td>
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        }`}
                      >
                        {transaction.type === "order"
                          ? formatNumber(transaction.quantity)
                          : ""}
                      </td>
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        }`}
                      >
                        {transaction.type === "order"
                          ? (transaction.unit || "متر")
                          : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        } max-w-32 overflow-x-auto whitespace-nowrap`}
                      >
                        <div className="min-w-0">
                          {transaction.description ||
                            (transaction.type === "payment" ? "دفعة" : "أوردر")}
                        </div>
                      </td>
                      <td
                        className={`px-3 py-2 border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        }`}
                      >
                        {transaction.date}
                      </td>
                      <td
                        className={`px-3 py-2 border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {transaction.type === "payment" ? (
                            <>
                              <button
                                onClick={() =>
                                  openEditPaymentModal(transaction)
                                }
                                className="p-2 rounded text-blue-500 hover:text-blue-600"
                                title="تعديل الدفعة"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeletePayment(transaction)}
                                className="p-2 rounded text-red-500 hover:text-red-600"
                                title="حذف الدفعة"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10"
                                  />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => openOrderModal(transaction)}
                                className="p-2 rounded text-blue-500 hover:text-blue-600"
                                title="تعديل الأوردر"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(transaction)}
                                className="p-2 rounded text-red-500 hover:text-red-600"
                                title="حذف الأوردر"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10"
                                  />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className={`text-center py-12 ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              <div
                className={`p-6 rounded-lg ${
                  theme === "dark" ? "bg-gray-800" : "bg-gray-100"
                }`}
              >
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h3 className="text-xl font-semibold mb-2">
                  لا توجد معاملات بعد
                </h3>
                <p className="text-sm mb-4">
                  هذا المورد جديد ولم يتم إضافة أي أوردرات أو دفعات بعد
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => openOrderModal()}
                    className={`px-4 py-2 rounded-lg font-semibold ${
                      theme === "dark"
                        ? "bg-camel text-black"
                        : "bg-brown text-white"
                    }`}
                  >
                    إضافة أول أوردر
                  </button>
                  <button
                    onClick={openPaymentModal}
                    className={`px-4 py-2 rounded-lg font-semibold ${
                      theme === "dark"
                        ? "bg-camel text-black"
                        : "bg-brown text-white"
                    }`}
                  >
                    تسديد دفعة
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div
            className={`p-6 rounded-lg w-96 ${
              theme === "dark" ? "bg-gray-900" : "bg-white"
            }`}
          >
            <h3
              className={`text-xl font-bold mb-4 ${
                theme === "dark" ? "text-camel" : "text-brown"
              }`}
            >
              تسديد دفعة جديدة
            </h3>
            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  المبلغ
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="المبلغ"
                  value={paymentFormData.amount}
                  onChange={(e) =>
                    setPaymentFormData({
                      ...paymentFormData,
                      amount: e.target.value,
                    })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  required
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  الوصف
                </label>
                <input
                  type="text"
                  placeholder="وصف الدفعة"
                  value={paymentFormData.description}
                  onChange={(e) =>
                    setPaymentFormData({
                      ...paymentFormData,
                      description: e.target.value,
                    })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  التاريخ
                </label>
                <input
                  type="date"
                  value={paymentFormData.date}
                  onChange={(e) =>
                    setPaymentFormData({
                      ...paymentFormData,
                      date: e.target.value,
                    })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded font-semibold ${
                    theme === "dark"
                      ? "bg-camel text-black"
                      : "bg-brown text-white"
                  }`}
                >
                  إضافة الدفعة
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2 bg-gray-600 text-white rounded font-semibold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div
            className={`p-6 rounded-lg w-96 ${
              theme === "dark" ? "bg-gray-900" : "bg-white"
            }`}
          >
            <h3
              className={`text-xl font-bold mb-4 ${
                theme === "dark" ? "text-camel" : "text-brown"
              }`}
            >
              تعديل الدفعة
            </h3>
            <form onSubmit={handleEditPaymentSubmit} className="space-y-3">
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  المبلغ
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="المبلغ"
                  value={paymentFormData.amount}
                  onChange={(e) =>
                    setPaymentFormData({
                      ...paymentFormData,
                      amount: e.target.value,
                    })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  required
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  الوصف
                </label>
                <input
                  type="text"
                  placeholder="وصف الدفعة"
                  value={paymentFormData.description}
                  onChange={(e) =>
                    setPaymentFormData({
                      ...paymentFormData,
                      description: e.target.value,
                    })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  التاريخ
                </label>
                <input
                  type="date"
                  value={paymentFormData.date}
                  onChange={(e) =>
                    setPaymentFormData({
                      ...paymentFormData,
                      date: e.target.value,
                    })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded font-semibold ${
                    theme === "dark"
                      ? "bg-camel text-black"
                      : "bg-brown text-white"
                  }`}
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditPaymentModal(false)}
                  className="flex-1 py-2 bg-gray-600 text-white rounded font-semibold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] overflow-y-auto py-4">
          <div
            className={`p-6 rounded-lg w-[550px] max-w-[90vw] max-h-[90vh] overflow-y-auto my-auto ${
              theme === "dark" ? "bg-gray-900" : "bg-white"
            }`}
          >
            <h3
              className={`text-xl font-bold mb-4 ${
                theme === "dark" ? "text-camel" : "text-brown"
              }`}
            >
              {editingOrder ? "تعديل الأوردر" : "إضافة أوردر جديد"}
            </h3>
            <form onSubmit={handleOrderSubmit} className="space-y-3">
              {/* ملخص المجموع: إجمالي الشراء | المسدد | المتبقي — بحجم أوضح وإطار بسيط */}
              {!editingOrder && orderItems.length > 0 && (
                <div className={`flex flex-wrap gap-4 justify-center py-3 px-4 rounded-xl border-2 ${theme === "dark" ? "bg-camel/10 border-camel/30" : "bg-brown/10 border-brown/30"}`}>
                  <span className={`flex items-center gap-1.5 text-sm ${theme === "dark" ? "text-camel" : "text-brown"}`}>
                    <span className="opacity-80">إجمالي الشراء:</span>
                    <span className="font-bold">{formatNumber(getOrderTotal())} ج.م</span>
                  </span>
                  <span className={`flex items-center gap-1.5 text-sm ${theme === "dark" ? "text-green-400" : "text-green-600"}`}>
                    <span className="opacity-80">المسدد:</span>
                    <span className="font-bold">{formatNumber(getOrderPaidTotal())} ج.م</span>
                  </span>
                  <span className={`flex items-center gap-1.5 text-sm ${theme === "dark" ? "text-amber-300" : "text-amber-600"}`}>
                    <span className="opacity-80">المتبقي:</span>
                    <span className="font-bold">{formatNumber(Math.max(0, getOrderTotal() - getOrderPaidTotal()))} ج.م</span>
                  </span>
                </div>
              )}
              {!editingOrder && orderItems.length > 0 && (
                <div className={`p-3 rounded ${theme === "dark" ? "bg-gray-800" : "bg-gray-100"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">الأصناف المضافة ({orderItems.length})</h4>
                    <div className={`px-3 py-1 rounded text-sm font-bold ${theme === "dark" ? "bg-camel/20 text-camel border border-camel/30" : "bg-brown/20 text-brown border border-brown/30"}`}>
                      الإجمالي: {formatNumber(getOrderTotal())} ج.م
                    </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {orderItems.map((item) => (
                      <div key={item.id} className={`flex justify-between items-center p-2 rounded ${theme === "dark" ? "bg-gray-700" : "bg-white"}`}>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.description}</div>
                          <div className="text-xs text-gray-500">
                            {item.quantity} {item.unit} × {formatNumber(item.price)} = {formatNumber(item.total)} ج.م
                            {(parseFloat(item.paid) || 0) > 0 && (
                              <span className={`mr-2 ${theme === "dark" ? "text-green-400" : "text-green-600"}`}> | مسدد: {formatNumber(item.paid)} ج.م</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => editItemFromOrder(item)}
                            className="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="تعديل"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItemFromOrder(item.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="حذف"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m-7-4h10" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  الوصف
                </label>
                <input
                  type="text"
                  placeholder="وصف الأوردر"
                  value={orderFormData.description}
                  onChange={(e) =>
                    setOrderFormData({...orderFormData, description: e.target.value})
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  required={editingOrder || orderItems.length === 0}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  الكمية والوحدة
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="الكمية"
                    value={orderFormData.quantity}
                    onChange={(e) =>
                      setOrderFormData({
                        ...orderFormData,
                        quantity: e.target.value,
                      })
                    }
                    className={`w-full px-3 py-2 rounded ${
                      theme === "dark"
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                    required={editingOrder || orderItems.length === 0}
                  />
                  <select
                    value={orderFormData.unit}
                    onChange={(e) =>
                      setOrderFormData({
                        ...orderFormData,
                        unit: e.target.value,
                      })
                    }
                    className={`w-full px-3 py-2 rounded ${
                      theme === "dark"
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <option value="متر">متر</option>
                    <option value="كيلو">كيلو</option>
                  </select>
                </div>
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  السعر
                </label>
                {!editingOrder && orderFormData.add_to_inventory && orderFormData.inventory_item_id && (
                  <p className={`text-[11px] mb-1 ${theme === "dark" ? "text-amber-300/80" : "text-amber-700/80"}`}>
                    سعر هذه الشحنة. غيّره إن شئت؛ سيصبح هو السعر الأساسي في المخزون (يستبدل القديم).
                  </p>
                )}
                <input
                  type="number"
                  step="0.01"
                  placeholder="السعر"
                  value={orderFormData.price}
                  onChange={(e) =>
                    setOrderFormData({
                      ...orderFormData,
                      price: e.target.value,
                    })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  required={editingOrder || orderItems.length === 0}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  السعر الإجمالي
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={
                    (parseFloat(orderFormData.quantity) || 0) *
                    (parseFloat(orderFormData.price) || 0)
                  }
                  readOnly
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  المسدد
                </label>
                {!editingOrder && (
                  <p className={`text-[11px] mb-1 opacity-75 ${theme === "dark" ? "text-amber-200/70" : "text-amber-800/70"}`}>
                    المسدد للصنف الحالي فقط. يُسجَّل ويظهر لكل أوردر على حدة في كشف الحساب.
                  </p>
                )}
                <input
                  type="number"
                  step="0.01"
                  placeholder="المبلغ المسدد"
                  value={orderFormData.paid}
                  onChange={(e) =>
                    setOrderFormData({ ...orderFormData, paid: e.target.value })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  المتبقي
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={
                    orderItems.length > 0
                      ? Math.max(0, getOrderTotal() - getOrderPaidTotal())
                      : (parseFloat(orderFormData.quantity) || 0) *
                          (parseFloat(orderFormData.price) || 0) -
                        (parseFloat(orderFormData.paid) || 0)
                  }
                  readOnly
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                />
              </div>
              {!editingOrder && (
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    إضافة للمخزون
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderFormData.add_to_inventory}
                      onChange={(e) =>
                        setOrderFormData({
                          ...orderFormData,
                          add_to_inventory: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className={`text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                      إضافة الأصناف المشتراة للمخزون
                    </span>
                  </label>
                </div>
              )}

              {!editingOrder && orderFormData.add_to_inventory && (
                <>
                  <div>
                    <label
                      className={`block text-sm font-semibold mb-1 ${
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      القسم
                    </label>
                    <div className="flex gap-2">
                      {!showNewSectionInput ? (
                        <>
                          <select
                            value={orderFormData.section_id}
                            onChange={(e) =>
                              setOrderFormData({
                                ...orderFormData,
                                section_id: e.target.value,
                                inventory_item_id: "",
                              })
                            }
                            className={`flex-1 px-3 py-2 rounded ${
                              theme === "dark"
                                ? "bg-gray-800 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                            required={orderFormData.add_to_inventory && !showNewSectionInput}
                          >
                            <option value="">اختر القسم</option>
                            {sections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewSectionInput(true);
                              setOrderFormData({...orderFormData, section_id: ""});
                            }}
                            className={`px-3 py-2 rounded font-semibold ${
                              theme === "dark" ? "bg-camel text-black" : "bg-brown text-white"
                            }`}
                            title="إضافة قسم جديد"
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            placeholder="اسم القسم الجديد"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            className={`flex-1 px-3 py-2 rounded ${
                              theme === "dark"
                                ? "bg-gray-800 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                            required={showNewSectionInput}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewSectionInput(false);
                              setNewSectionName("");
                            }}
                            className="px-3 py-2 rounded bg-gray-600 text-white font-semibold"
                            title="إلغاء"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {orderFormData.section_id && (
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-1 ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        الصنف (اختياري - اتركه فارغاً لإنشاء صنف جديد)
                      </label>
                      <select
                        value={orderFormData.inventory_item_id}
                        onChange={(e) =>
                          setOrderFormData({
                            ...orderFormData,
                            inventory_item_id: e.target.value,
                          })
                        }
                        className={`w-full px-3 py-2 rounded ${
                          theme === "dark"
                            ? "bg-gray-800 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <option value="">صنف جديد</option>
                        {inventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.item_name} {item.color_number ? `- رقم ${item.color_number}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {orderFormData.inventory_item_id && (() => {
                    const sel = inventory.find(
                      (i) => i.id === parseInt(orderFormData.inventory_item_id, 10)
                    );
                    if (!sel) return null;
                    return (
                      <div
                        className={`rounded-lg p-4 space-y-2 ${
                          theme === "dark" ? "bg-amber-900/20 border border-amber-600/50" : "bg-amber-50 border border-amber-300"
                        }`}
                      >
                        <div className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
                          بيانات الصنف المحدد (للمراجعة — يمكنك تغيير الوصف والسعر أدناه)
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>الاسم:</span>
                          <span className={theme === "dark" ? "text-gray-200" : "text-gray-900"}>{sel.item_name || "—"}</span>
                          <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>رقم اللون:</span>
                          <span className={theme === "dark" ? "text-gray-200" : "text-gray-900"}>{sel.color_number || "—"}</span>
                          <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>الوحدة:</span>
                          <span className={theme === "dark" ? "text-gray-200" : "text-gray-900"}>{sel.unit || "متر"}</span>
                          <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>الكمية الحالية (متر/كيلو):</span>
                          <span className={theme === "dark" ? "text-gray-200" : "text-gray-900"}>{formatNumber(sel.total_meters ?? 0)}</span>
                          <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>عدد الأتواب الحالي:</span>
                          <span className={theme === "dark" ? "text-gray-200" : "text-gray-900"}>{sel.rolls_count ?? "—"}</span>
                          <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>سعر الشراء الحالي:</span>
                          <span className={`font-semibold ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`}>
                            {formatNumber(sel.purchase_price ?? 0)} ج.م
                          </span>
                        </div>
                        <p className={`text-xs mt-2 ${theme === "dark" ? "text-amber-300/80" : "text-amber-700/80"}`}>
                          الوصف والسعر أعلاه مُعبَّآن من الصنف. غيّرهما إن شئت. عند الحفظ، سعر الأوردر يصبح السعر الأساسي في المخزون (يستبدل القديم).
                        </p>
                      </div>
                    );
                  })()}

                  {orderFormData.inventory_item_id && (
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-1 ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        عدد الأتواب (لصنف موجود - اختياري)
                      </label>
                      <input
                        type="number"
                        placeholder="عدد الأتواب"
                        value={orderFormData.rolls_count}
                        onChange={(e) =>
                          setOrderFormData({
                            ...orderFormData,
                            rolls_count: e.target.value,
                          })
                        }
                        className={`w-full px-3 py-2 rounded ${
                          theme === "dark"
                            ? "bg-gray-800 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                        min="0"
                      />
                    </div>
                  )}

                  {((orderFormData.section_id && !orderFormData.inventory_item_id) || showNewSectionInput) && (
                    <>
                      <div>
                        <label
                          className={`block text-sm font-semibold mb-1 ${
                            theme === "dark" ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          رقم اللون (اختياري)
                        </label>
                        <input
                          type="text"
                          placeholder="رقم اللون"
                          value={orderFormData.color_number}
                          onChange={(e) =>
                            setOrderFormData({
                              ...orderFormData,
                              color_number: e.target.value,
                            })
                          }
                          className={`w-full px-3 py-2 rounded ${
                            theme === "dark"
                              ? "bg-gray-800 text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-sm font-semibold mb-1 ${
                            theme === "dark" ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          عدد الأتواب (اختياري)
                        </label>
                        <input
                          type="number"
                          placeholder="عدد الأتواب"
                          value={orderFormData.rolls_count}
                          onChange={(e) =>
                            setOrderFormData({
                              ...orderFormData,
                              rolls_count: e.target.value,
                            })
                          }
                          className={`w-full px-3 py-2 rounded ${
                            theme === "dark"
                              ? "bg-gray-800 text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                          min="0"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  التاريخ
                </label>
                <input
                  type="text"
                  dir="rtl"
                  inputMode="numeric"
                  placeholder="2026/1/29"
                  value={orderDateInputValue}
                  onChange={(e) => {
                    setOrderDateInputValue(e.target.value);
                    const iso = parseDisplayDateToISO(e.target.value);
                    if (iso) setOrderFormData((prev) => ({ ...prev, date: iso }));
                    else if (e.target.value === "") setOrderFormData((prev) => ({ ...prev, date: "" }));
                  }}
                  onBlur={() => setOrderDateInputValue(formatDateToDisplay(orderFormData.date))}
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"
                  }`}
                  required
                />
              </div>
              <div className="flex gap-2">
                {!editingOrder && (
                  <button
                    type="button"
                    onClick={addItemToOrder}
                    className={`flex-1 py-1.5 rounded font-semibold border-2 transition-colors ${
                      theme === "dark"
                        ? "border-camel/50 bg-camel/10 text-camel hover:bg-camel/20"
                        : "border-brown/50 bg-brown/10 text-brown hover:bg-brown/20"
                    }`}
                  >
                    + إضافة للقائمة
                  </button>
                )}
                <button
                  type="submit"
                  className={`flex-1 py-1.5 rounded font-semibold ${
                    theme === "dark"
                      ? "bg-camel text-black"
                      : "bg-brown text-white"
                  }`}
                >
                  {editingOrder ? "حفظ" : (orderItems.length > 0 ? `حفظ ${orderItems.length} أوردر` : "إضافة")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOrderModal(false);
                    setOrderItems([]);
                  }}
                  className="flex-1 py-1.5 bg-gray-600 text-white rounded font-semibold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div
            className={`p-6 rounded-lg w-96 max-h-[90vh] overflow-y-auto ${
              theme === "dark" ? "bg-gray-900" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h3
                className={`text-xl font-bold ${
                  theme === "dark" ? "text-camel" : "text-brown"
                }`}
              >
                إرسال كشف حساب عبر واتساب
              </h3>
              <button
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setWhatsappPhone("");
                }}
                className={`p-2 rounded-lg transition ${
                  theme === "dark"
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  رقم الهاتف (بدون كود الدولة)
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-2 rounded ${
                      theme === "dark" ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    +20
                  </span>
                  <input
                    type="tel"
                    placeholder="01012345678"
                    value={whatsappPhone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setWhatsappPhone(value);
                    }}
                    className={`flex-1 px-3 py-2 rounded ${
                      theme === "dark"
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                    maxLength={11}
                  />
                </div>
                <p className={`text-xs mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  سيتم إضافة كود الدولة (+20) تلقائياً
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={sendViaWhatsApp}
                  disabled={!whatsappPhone}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                    !whatsappPhone
                      ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                      : theme === "dark"
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                >
                  إرسال عبر واتساب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowWhatsAppModal(false);
                    setWhatsappPhone("");
                  }}
                  className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف ${
          deleteItem?.type === "payment" ? "هذه الدفعة" : "هذا الأوردر"
        }؟ لا يمكن التراجع.`}
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}

export default SupplierDetails;
