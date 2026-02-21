import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { formatNumber } from "../utils/format";

function CustomerDetails({ customer, onClose }) {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [returnedOrders, setReturnedOrders] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showReturnedOrderModal, setShowReturnedOrderModal] = useState(false);
  const [editingReturnedOrder, setEditingReturnedOrder] = useState(null);
  const [sections, setSections] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [orderFormData, setOrderFormData] = useState({
    customer_name: "",
    description: "",
    quantity: "",
    price: "",
    paid: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [returnedOrderFormData, setReturnedOrderFormData] = useState({
    customer_name: "",
    description: "",
    quantity: "",
    unit: "متر",
    price: "",
    date: new Date().toISOString().split("T")[0],
    section_id: "",
    inventory_item_id: "",
    add_to_inventory: false,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        // Load orders
        const ordersRes = await fetch(
          `http://localhost:3456/api/sales/by-customer?customer_id=${customer.id}`
        );
        const ordersJson = await ordersRes.json();
        console.log("CustomerDetails - Orders API Response:", ordersJson);
        if (
          ordersJson &&
          ordersJson.success &&
          Array.isArray(ordersJson.rows)
        ) {
          setOrders(ordersJson.rows);
        } else {
          setOrders([]);
        }

        // Load payments
        const paymentsRes = await fetch(
          `http://localhost:3456/api/payments/customer/${encodeURIComponent(
            customer.name
          )}?customer_id=${customer.id}`
        );
        const paymentsJson = await paymentsRes.json();
        console.log("CustomerDetails - Payments API Response:", paymentsJson);
        if (
          paymentsJson &&
          paymentsJson.success &&
          Array.isArray(paymentsJson.rows)
        ) {
          setPayments(paymentsJson.rows);
        } else {
          setPayments([]);
        }

        // Load returned orders
        const returnedRes = await fetch(
          `http://localhost:3456/api/returned-orders/customer/${encodeURIComponent(
            customer.name
          )}?customer_id=${customer.id}`
        );
        const returnedJson = await returnedRes.json();
        if (
          returnedJson &&
          returnedJson.success &&
          Array.isArray(returnedJson.rows)
        ) {
          setReturnedOrders(returnedJson.rows);
        } else {
          setReturnedOrders([]);
        }

        // Load sections
        const sectionsRes = await fetch("http://localhost:3456/api/inventory/sections");
        const sectionsJson = await sectionsRes.json();
        if (sectionsJson && Array.isArray(sectionsJson)) {
          setSections(sectionsJson);
        }

        // Load inventory
        const inventoryRes = await fetch("http://localhost:3456/api/inventory");
        const inventoryJson = await inventoryRes.json();
        if (inventoryJson && Array.isArray(inventoryJson)) {
          setInventory(inventoryJson);
        }
      } catch (e) {
        setOrders([]);
        setPayments([]);
        setReturnedOrders([]);
      }
    };
    load();
  }, [customer?.name]);

  const generatePDF = () => {
    const accountStatus = getAccountStatus();
    const transactionsWithBalance = calculateRunningBalance();

    const today = new Date().toISOString().split("T")[0];
    const fileName = `كشف حساب العميل - ${customer.name} - ${today}`;

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
              <td colspan="7" class="thead-header">
                <div class="print-title">
                  <h1>M.G Fabric Store</h1>
                  <h2>كشف حساب العميل</h2>
                </div>
                <div class="print-info">
                  <p><strong>اسم العميل:</strong> ${customer.name}</p>
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
              <th>البيان</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsWithBalance.map((t) => `
              <tr class="${t.type === "payment" || t.type === "returned_order" ? "red-border-row" : ""}">
                <td>${formatNumber(Math.abs(t.runningBalance))}</td>
                <td>${t.type === "payment" ? formatNumber(t.paid) : (t.paid ? formatNumber(t.paid) : "0")}</td>
                <td>${t.type === "order" || t.type === "returned_order" ? formatNumber(Math.abs(t.value)) : ""}</td>
                <td>${t.type === "order" || t.type === "returned_order" ? formatNumber(t.price) : ""}</td>
                <td>${t.type === "order" || t.type === "returned_order" ? `${t.quantity} ${t.unit || "متر"}` : ""}</td>
                <td>${t.type === "returned_order" ? `⟲ ${t.description || "أوردر راجع"}` : (t.description || (t.type === "payment" ? "دفعة" : "أوردر"))}</td>
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
      `مرحباً، يرجى الاطلاع على كشف حسابك:\nاسم العميل: ${customer.name}\nالتاريخ: ${new Date().toLocaleDateString("ar-EG")}`
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

  const openPaymentModal = () => {
    // إضافة دفعة جديدة
    setEditingPayment(null);
    setPaymentFormData({
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    });
    setShowPaymentModal(true);
  };

  const openEditPaymentModal = (payment) => {
    // تعديل دفعة موجودة
    setEditingPayment(payment);
    setPaymentFormData({
      amount: payment.amount ? payment.amount.toString() : "",
      description: payment.description || "",
      date: payment.date || new Date().toISOString().split("T")[0],
    });
    setShowEditPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setEditingPayment(null);
  };

  const closeEditPaymentModal = () => {
    setShowEditPaymentModal(false);
    setEditingPayment(null);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:3456/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customer.name,
          amount: parseFloat(paymentFormData.amount),
          description: paymentFormData.description,
          date: paymentFormData.date,
        }),
      });

      if (response.ok) {
        addNotification("تم تسجيل الدفعة بنجاح", "success");
        closePaymentModal();
        // Reload data
        const paymentsRes = await fetch(
          `http://localhost:3456/api/payments/customer/${encodeURIComponent(
            customer.name
          )}`
        );
        const paymentsJson = await paymentsRes.json();
        if (
          paymentsJson &&
          paymentsJson.success &&
          Array.isArray(paymentsJson.rows)
        ) {
          setPayments(paymentsJson.rows);
        }
        window.dispatchEvent(new CustomEvent("updateStatistics"));
      } else {
        addNotification("فشل في تسجيل الدفعة", "error");
      }
    } catch (error) {
      addNotification("فشل في تسجيل الدفعة", "error");
    }
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `http://localhost:3456/api/payments/${editingPayment.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: customer.name,
            amount: parseFloat(paymentFormData.amount),
            description: paymentFormData.description,
            date: paymentFormData.date,
          }),
        }
      );

      if (response.ok) {
        addNotification("تم تعديل الدفعة بنجاح", "success");
        closeEditPaymentModal();
        // Reload data
        const paymentsRes = await fetch(
          `http://localhost:3456/api/payments/customer/${encodeURIComponent(
            customer.name
          )}`
        );
        const paymentsJson = await paymentsRes.json();
        if (
          paymentsJson &&
          paymentsJson.success &&
          Array.isArray(paymentsJson.rows)
        ) {
          setPayments(paymentsJson.rows);
        }
        window.dispatchEvent(new CustomEvent("updateStatistics"));
      } else {
        addNotification("فشل في تعديل الدفعة", "error");
      }
    } catch (error) {
      addNotification("فشل في تعديل الدفعة", "error");
    }
  };

  const handleDeletePayment = (paymentId) => {
    setDeleteItem({ type: "payment", id: paymentId });
    setShowDeleteDialog(true);
  };

  const handleDeleteOrder = (orderId) => {
    setDeleteItem({ type: "order", id: orderId });
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      const url =
        deleteItem.type === "payment"
          ? `http://localhost:3456/api/payments/${deleteItem.id}`
          : deleteItem.type === "returned_order"
          ? `http://localhost:3456/api/returned-orders/${deleteItem.id}`
          : `http://localhost:3456/api/sales/${deleteItem.id}`;

      const response = await fetch(url, {
        method: "DELETE",
      });

      if (response.ok) {
        addNotification(
          `تم حذف ${
            deleteItem.type === "payment" 
              ? "الدفعة" 
              : deleteItem.type === "returned_order"
              ? "الأوردر الراجع"
              : "الأوردر"
          } بنجاح`,
          "success"
        );

        // Reload data
        if (deleteItem.type === "payment") {
          const paymentsRes = await fetch(
            `http://localhost:3456/api/payments/customer/${encodeURIComponent(
              customer.name
            )}`
          );
          const paymentsJson = await paymentsRes.json();
          if (
            paymentsJson &&
            paymentsJson.success &&
            Array.isArray(paymentsJson.rows)
          ) {
            setPayments(paymentsJson.rows);
          }
        } else if (deleteItem.type === "returned_order") {
          const returnedRes = await fetch(
            `http://localhost:3456/api/returned-orders/customer/${encodeURIComponent(
              customer.name
            )}`
          );
          const returnedJson = await returnedRes.json();
          if (
            returnedJson &&
            returnedJson.success &&
            Array.isArray(returnedJson.rows)
          ) {
            setReturnedOrders(returnedJson.rows);
          }
        } else {
          const ordersRes = await fetch(
            `http://localhost:3456/api/sales/by-customer?name=${encodeURIComponent(
              customer.name
            )}`
          );
          const ordersJson = await ordersRes.json();
          if (
            ordersJson &&
            ordersJson.success &&
            Array.isArray(ordersJson.rows)
          ) {
            setOrders(ordersJson.rows);
          }
        }
        window.dispatchEvent(new CustomEvent("updateStatistics"));
      } else {
        addNotification(
          `فشل في حذف ${
            deleteItem.type === "payment" 
              ? "الدفعة" 
              : deleteItem.type === "returned_order"
              ? "الأوردر الراجع"
              : "الأوردر"
          }`,
          "error"
        );
      }
    } catch (error) {
      addNotification(
        `فشل في حذف ${
          deleteItem.type === "payment" 
            ? "الدفعة" 
            : deleteItem.type === "returned_order"
            ? "الأوردر الراجع"
            : "الأوردر"
        }`,
        "error"
      );
    }

    setShowDeleteDialog(false);
    setDeleteItem(null);
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setDeleteItem(null);
  };

  const openOrderModal = (order = null) => {
    if (order) {
      setEditingOrder(order);
      setOrderFormData({
        customer_name: order.customer_name || customer.name,
        description: order.description || "",
        quantity: order.quantity || "",
        price: order.price || "",
        paid: order.paid || "",
        date: order.date || new Date().toISOString().split("T")[0],
      });
    } else {
      setEditingOrder(null);
      setOrderFormData({
        customer_name: customer.name,
        description: "",
        quantity: "",
        price: "",
        paid: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
    setShowOrderModal(true);
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setEditingOrder(null);
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingOrder
        ? `http://localhost:3456/api/sales/${editingOrder.id}`
        : "http://localhost:3456/api/sales";

      const method = editingOrder ? "PUT" : "POST";

      const total =
        parseFloat(orderFormData.quantity) * parseFloat(orderFormData.price);
      const paid = parseFloat(orderFormData.paid) || 0;
      const remaining = total - paid;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: orderFormData.customer_name,
          description: orderFormData.description,
          quantity: parseFloat(orderFormData.quantity),
          price: parseFloat(orderFormData.price),
          total: total,
          paid: paid,
          remaining: remaining,
          date: orderFormData.date,
        }),
      });

      if (response.ok) {
        addNotification(
          editingOrder ? "تم تعديل الأوردر بنجاح" : "تم إضافة الأوردر بنجاح",
          "success"
        );
        closeOrderModal();
        // Reload data
        const ordersRes = await fetch(
          `http://localhost:3456/api/sales/by-customer?name=${encodeURIComponent(
            customer.name
          )}`
        );
        const ordersJson = await ordersRes.json();
        if (
          ordersJson &&
          ordersJson.success &&
          Array.isArray(ordersJson.rows)
        ) {
          setOrders(ordersJson.rows);
        }
        window.dispatchEvent(new CustomEvent("updateStatistics"));
      } else {
        addNotification(
          editingOrder ? "فشل في تعديل الأوردر" : "فشل في إضافة الأوردر",
          "error"
        );
      }
    } catch (error) {
      addNotification(
        editingOrder ? "فشل في تعديل الأوردر" : "فشل في إضافة الأوردر",
        "error"
      );
    }
  };

  const openReturnedOrderModal = () => {
    setReturnedOrderFormData({
      customer_name: customer.name,
      description: "",
      quantity: "",
      unit: "متر",
      price: "",
      date: new Date().toISOString().split("T")[0],
      section_id: "",
      inventory_item_id: "",
      add_to_inventory: false,
    });
    setSelectedSectionId("");
    setShowReturnedOrderModal(true);
  };

  const openEditReturnedOrderModal = (returnedOrder) => {
    setEditingReturnedOrder(returnedOrder);
    setReturnedOrderFormData({
      customer_name: returnedOrder.customer_name || customer.name,
      description: returnedOrder.description || "",
      quantity: returnedOrder.quantity || "",
      unit: returnedOrder.unit || "متر",
      price: returnedOrder.price || "",
      date: returnedOrder.date || new Date().toISOString().split("T")[0],
      section_id: returnedOrder.section_id || "",
      inventory_item_id: returnedOrder.inventory_item_id || "",
      add_to_inventory: !!returnedOrder.inventory_item_id,
    });
    if (returnedOrder.section_id) {
      setSelectedSectionId(returnedOrder.section_id.toString());
    }
    setShowReturnedOrderModal(true);
  };

  const closeReturnedOrderModal = () => {
    setShowReturnedOrderModal(false);
    setEditingReturnedOrder(null);
    setReturnedOrderFormData({
      customer_name: "",
      description: "",
      quantity: "",
      unit: "متر",
      price: "",
      date: new Date().toISOString().split("T")[0],
      section_id: "",
      inventory_item_id: "",
      add_to_inventory: false,
    });
    setSelectedSectionId("");
  };

  const handleReturnedOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      const quantity = parseFloat(returnedOrderFormData.quantity) || 0;
      const price = parseFloat(returnedOrderFormData.price) || 0;

      const url = editingReturnedOrder
        ? `http://localhost:3456/api/returned-orders/${editingReturnedOrder.id}`
        : "http://localhost:3456/api/returned-orders";

      const method = editingReturnedOrder ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: returnedOrderFormData.customer_name,
          description: returnedOrderFormData.description,
          quantity: quantity,
          unit: returnedOrderFormData.unit,
          price: price,
          date: returnedOrderFormData.date,
          section_id: returnedOrderFormData.section_id || null,
          inventory_item_id: returnedOrderFormData.inventory_item_id || null,
          add_to_inventory: returnedOrderFormData.add_to_inventory,
        }),
      });

      if (response.ok) {
        addNotification(
          editingReturnedOrder ? "تم تعديل الأوردر المرتجع بنجاح" : "تم إضافة الأوردر المرتجع بنجاح",
          "success"
        );
        closeReturnedOrderModal();
        // Reload returned orders
        const returnedRes = await fetch(
          `http://localhost:3456/api/returned-orders/customer/${encodeURIComponent(
            customer.name
          )}`
        );
        const returnedJson = await returnedRes.json();
        if (
          returnedJson &&
          returnedJson.success &&
          Array.isArray(returnedJson.rows)
        ) {
          setReturnedOrders(returnedJson.rows);
        }
        // Reload inventory if item was added
        if (returnedOrderFormData.add_to_inventory) {
          const inventoryRes = await fetch("http://localhost:3456/api/inventory");
          const inventoryJson = await inventoryRes.json();
          if (inventoryJson && Array.isArray(inventoryJson)) {
            setInventory(inventoryJson);
          }
        }
        window.dispatchEvent(new CustomEvent("updateStatistics"));
      } else {
        addNotification(
          editingReturnedOrder ? "فشل في تعديل الأوردر المرتجع" : "فشل في إضافة الأوردر المرتجع",
          "error"
        );
      }
    } catch (error) {
      addNotification(
        editingReturnedOrder ? "فشل في تعديل الأوردر المرتجع" : "فشل في إضافة الأوردر المرتجع",
        "error"
      );
    }
  };

  const handleDeleteReturnedOrder = async (id) => {
    setDeleteItem({ type: "returned_order", id });
    setShowDeleteDialog(true);
  };

  // Calculate combined transactions (orders + payments + returned orders)
  const getAllTransactions = () => {
    const allTransactions = [];

    // Add orders
    orders.forEach((order) => {
      allTransactions.push({
        type: "order",
        id: order.id,
        global_sequence: order.global_sequence,
        date: order.date,
        description: order.description || "",
        quantity: order.quantity || 0,
        unit: order.unit || "متر",
        price: order.price || 0,
        value: (order.quantity || 0) * (order.price || 0),
        paid: order.paid || 0,
        remaining: 0,
        inventory_item_id: order.inventory_item_id ?? null,
        outsideInventory: !(order.inventory_item_id != null && order.inventory_item_id !== ""),
      });
    });

    // Add returned orders (negative value)
    returnedOrders.forEach((returned) => {
      const returnedValue = (returned.quantity || 0) * (returned.price || 0);
      allTransactions.push({
        type: "returned_order",
        id: returned.id,
        global_sequence: returned.global_sequence,
        date: returned.date,
        description: returned.description || "",
        quantity: returned.quantity || 0,
        unit: returned.unit || "متر",
        price: returned.price || 0,
        value: -returnedValue,
        paid: returnedValue, // القيمة تظهر في عمود المسدد لأن الأوردرات الراجعة تقلل الرصيد
        remaining: 0,
      });
    });

    // Add payments
    payments.forEach((payment) => {
      allTransactions.push({
        type: "payment",
        id: payment.id,
        global_sequence: payment.global_sequence,
        date: payment.date,
        description: payment.description || "دفعة",
        quantity: 0,
        unit: "",
        price: 0,
        value: 0,
        paid: payment.amount,
        remaining: 0,
      });
    });

    // Sort unified: prefer global_sequence; fallback to date then id
    const sortedTransactions = allTransactions.sort((a, b) => {
      const ga = a.global_sequence;
      const gb = b.global_sequence;
      if (ga != null && gb != null && ga !== gb) return ga - gb;
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      if (da !== db) return da - db;
      return (a.id || 0) - (b.id || 0);
    });
    console.log("CustomerDetails - getAllTransactions:", {
      orders: orders,
      payments: payments,
      returnedOrders: returnedOrders,
      allTransactions: sortedTransactions,
    });
    // Attach a per-account display index so numbering starts at 1 for this customer
    return sortedTransactions.map((t, i) => ({ ...t, localIndex: i + 1 }));
  };

  const getAccountStatus = () => {
    const allTransactions = getAllTransactions();
    const totals = allTransactions.reduce(
      (acc, transaction) => {
        if (transaction.type === "order") {
          acc.total += transaction.value;
          acc.paid += transaction.paid;
        } else if (transaction.type === "returned_order") {
          // الأوردرات الراجعة تقلل من إجمالي القيمة (تلغي الأوردرات)
          acc.returned += Math.abs(transaction.value);
          // لا نضيف paid للأوردرات الراجعة في حساب remaining لأنها ليست دفعة فعلية
          // لكن paid يظهر في الجدول للعرض فقط
        } else if (transaction.type === "payment") {
          acc.paid += transaction.paid;
        }
        return acc;
      },
      { total: 0, paid: 0, returned: 0 }
    );
    // الحساب الصحيح: الإجمالي - الأوردرات الراجعة - الدفعات الفعلية
    totals.remaining = totals.total - totals.returned - totals.paid;
    if (allTransactions.length === 0) {
      totals.total = (customer.quantity || 0) * (customer.price || 0);
      totals.paid = customer.paid || 0;
      totals.remaining = totals.total - totals.paid;
    }
    const hasAny = allTransactions.length > 0;
    if (!hasAny) {
      return { status: "لا توجد معاملات", amount: 0, color: "text-gray-500" };
    }
    if (totals.remaining > 0) {
      return {
        status: "يوجد باقي",
        amount: totals.remaining,
        color: "text-red-500",
      };
    } else if (totals.remaining < 0) {
      return {
        status: "له مبلغ",
        amount: Math.abs(totals.remaining),
        color: "text-blue-500",
      };
    } else {
      return { status: "مسدد بالكامل", amount: 0, color: "text-green-500" };
    }
  };

  const getTotals = () => {
    const allTransactions = getAllTransactions();
    const totals = allTransactions.reduce(
      (acc, transaction) => {
        if (transaction.type === "order") {
          acc.total += transaction.value;
          acc.paid += transaction.paid;
        } else if (transaction.type === "returned_order") {
          // الأوردرات الراجعة تقلل من إجمالي القيمة (تلغي الأوردرات)
          acc.returned += Math.abs(transaction.value);
          // لا نضيف paid للأوردرات الراجعة في حساب remaining لأنها ليست دفعة فعلية
          // لكن paid يظهر في الجدول للعرض فقط
        } else if (transaction.type === "payment") {
          acc.paid += transaction.paid;
        }
        return acc;
      },
      { total: 0, paid: 0, returned: 0 }
    );
    // الحساب الصحيح: الإجمالي - الأوردرات الراجعة - الدفعات الفعلية
    totals.remaining = totals.total - totals.returned - totals.paid;
    if (allTransactions.length === 0) {
      totals.total = (customer.quantity || 0) * (customer.price || 0);
      totals.paid = customer.paid || 0;
      totals.remaining = totals.total - totals.paid;
    }
    return totals;
  };

  const calculateRunningBalance = () => {
    let balance = 0;
    const allTransactions = getAllTransactions();
    return allTransactions.map((transaction) => {
      if (transaction.type === "order") {
        balance += transaction.value;
        balance -= transaction.paid;
      } else if (transaction.type === "returned_order") {
        balance += transaction.value;
      } else if (transaction.type === "payment") {
        balance -= transaction.paid;
      }
      return { ...transaction, runningBalance: balance };
    });
  };

  const accountStatus = getAccountStatus();
  const totals = getTotals();
  const orderCount = getAllTransactions().filter(
    (t) => t.type === "order"
  ).length;
  const returnedOrderCount = getAllTransactions().filter(
    (t) => t.type === "returned_order"
  ).length;
  const paymentCount = getAllTransactions().filter(
    (t) => t.type === "payment"
  ).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        id="customer-details-content"
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h2
                    className={`text-2xl font-bold ${
                      theme === "dark" ? "text-camel" : "text-brown"
                    }`}
                  >
                    كشف حساب العميل
                  </h2>
                  <p
                    className={`text-lg ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {customer.name}
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
                        له باقي
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
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="أوردرات خارج المخزون">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span
                        className={`text-xs font-medium ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        أوردرات خارج المخزون
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-6">
            <div
              className={`p-2 rounded-lg text-sm ${
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
              className={`p-2 rounded-lg text-sm ${
                theme === "dark" ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`font-medium ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  الأوردرات الراجعة:
                </span>
                <span
                  className={`font-bold ${
                    theme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  {returnedOrderCount}
                </span>
              </div>
            </div>
            <div
              className={`p-2 rounded-lg text-sm ${
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
              className={`p-2 rounded-lg text-sm ${
                theme === "dark" ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`font-medium ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                  title="الأوردرات الخارجة"
                >
                  إجمالي القيمة (الأوردرات الخارجة):
                </span>
                <span
                  className={`font-bold ${
                    theme === "dark" ? "text-camel" : "text-brown"
                  }`}
                >
                  {formatNumber(totals.total || 0)}
                </span>
              </div>
            </div>
            <div
              className={`p-2 rounded-lg text-sm ${
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
                  className={`font-bold ${
                    theme === "dark" ? "text-camel" : "text-brown"
                  }`}
                >
                  {formatNumber(totals.paid || 0)}
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
              onClick={() => {
                onClose();
                sessionStorage.setItem('selectedCustomer', customer.name);
                window.dispatchEvent(new CustomEvent('navigateToSales', { 
                  detail: { customerName: customer.name } 
                }));
                if (window.location.pathname !== '/sales') {
                  window.history.pushState({}, '', '/sales');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              className={`px-4 py-2 rounded-lg font-semibold ${
                theme === "dark" ? "bg-camel text-black" : "bg-brown text-white"
              }`}
            >
              إضافة أوردر جديد
            </button>
            <button
              onClick={openReturnedOrderModal}
              className={`px-4 py-2 rounded-lg font-semibold ${
                theme === "dark" ? "bg-red-600 text-white" : "bg-red-500 text-white"
              }`}
            >
              أوردر مرتجع
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
                style={{ borderCollapse: "separate", borderSpacing: 0 }}
              >
                <thead>
                  <tr
                    className={`${
                      theme === "dark"
                        ? "text-gray-300 bg-gray-800"
                        : "text-gray-700 bg-gray-100"
                    }`}
                  >
                    <th
                      className={`text-right p-2 border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      #
                    </th>
                    <th
                      className={`text-right p-2 border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      الرصيد
                    </th>
                    <th
                      className={`text-right p-2 border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      المسدد
                    </th>
                    <th
                      className={`text-right p-2 border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      القيمة
                    </th>
                    <th
                      className={`text-right p-2 border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      السعر
                    </th>
                    <th
                      className={`text-right p-2 border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      الكمية
                    </th>
                    <th
                      className={`text-right p-2 border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      البيان
                    </th>
                    <th
                      className={`text-right p-2 border ${
                        theme === "dark" ? "border-gray-700" : "border-gray-300"
                      }`}
                    >
                      التاريخ
                    </th>
                    <th
                      className={`text-right p-2 border ${
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
                        transaction.type === "returned_order" || transaction.type === "payment"
                          ? "border-2 border-red-500"
                          : ""
                      }
                      style={
                        transaction.type === "returned_order" || transaction.type === "payment"
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
                          ? formatNumber(transaction.paid)
                          : transaction.paid
                          ? formatNumber(transaction.paid)
                          : "0"}
                      </td>
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        } ${transaction.type === "returned_order" ? "text-red-500" : "text-green-500"}`}
                      >
                        {transaction.type === "order" || transaction.type === "returned_order"
                          ? formatNumber(Math.abs(transaction.value))
                          : ""}
                      </td>
                      <td
                        className={`px-3 py-2 text-center border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        }`}
                      >
                        {transaction.type === "order" || transaction.type === "returned_order"
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
                        {transaction.type === "order" || transaction.type === "returned_order"
                          ? `${formatNumber(transaction.quantity)} ${transaction.unit || "متر"}`
                          : ""}
                      </td>
                      <td
                        className={`px-3 py-2 border ${
                          theme === "dark"
                            ? "border-gray-800"
                            : "border-gray-300"
                        } max-w-32 overflow-x-auto whitespace-nowrap`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          {transaction.type === "returned_order" && (
                            <span className="text-red-500 font-bold" title="أوردر راجع">
                              ⟲
                            </span>
                          )}
                          {transaction.description ||
                            (transaction.type === "payment" 
                              ? "دفعة" 
                              : transaction.type === "returned_order" 
                              ? "أوردر راجع" 
                              : "أوردر")}
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
                                onClick={() => handleDeletePayment(transaction.id)}
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
                          ) : transaction.type === "returned_order" ? (
                            <>
                              <button
                                onClick={() => openEditReturnedOrderModal(transaction)}
                                className="p-2 rounded text-blue-500 hover:text-blue-600"
                                title="تعديل الأوردر الراجع"
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
                                onClick={() => handleDeleteReturnedOrder(transaction.id)}
                                className="p-2 rounded text-red-500 hover:text-red-600"
                                title="حذف الأوردر الراجع"
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
                              {transaction.outsideInventory && (
                                <span
                                  className="p-1.5 rounded text-amber-500 cursor-default"
                                  title="أوردر خارج المخزون"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                </span>
                              )}
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
                                onClick={() => handleDeleteOrder(transaction.id)}
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
                  هذا العميل جديد ولم يتم إضافة أي أوردرات أو دفعات بعد
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      onClose();
                      sessionStorage.setItem('selectedCustomer', customer.name);
                      window.dispatchEvent(new CustomEvent('navigateToSales', { 
                        detail: { customerName: customer.name } 
                      }));
                      if (window.location.pathname !== '/sales') {
                        window.history.pushState({}, '', '/sales');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }
                    }}
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
          style={{ zIndex: 1000 }}
        >
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
                تسديد دفعة - {customer.name}
              </h3>
              <button
                onClick={closePaymentModal}
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

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
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
                  placeholder="مبلغ الدفعة"
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
                  الوصف (اختياري)
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
                  تاريخ الدفعة
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

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                    theme === "dark"
                      ? "bg-camel text-black hover:bg-camel/90"
                      : "bg-brown text-white hover:bg-brown/90"
                  }`}
                >
                  تسجيل الدفعة
                </button>
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
          style={{ zIndex: 1000 }}
        >
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
                تعديل دفعة - {customer.name}
              </h3>
              <button
                onClick={closeEditPaymentModal}
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

            <form onSubmit={handleEditPaymentSubmit} className="space-y-4">
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
                  placeholder="مبلغ الدفعة"
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
                  الوصف (اختياري)
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

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                    theme === "dark"
                      ? "bg-camel text-black hover:bg-camel/90"
                      : "bg-brown text-white hover:bg-brown/90"
                  }`}
                >
                  تحديث الدفعة
                </button>
                <button
                  type="button"
                  onClick={closeEditPaymentModal}
                  className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
          style={{ zIndex: 1000 }}
        >
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
                {editingOrder ? "تعديل أوردر" : "إضافة أوردر"} - {customer.name}
              </h3>
              <button
                onClick={closeOrderModal}
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

            <form onSubmit={handleOrderSubmit} className="space-y-4">
              {/* Total Value Display */}
              {(orderFormData.quantity && orderFormData.price) && (
                <div
                  className={`p-4 rounded-lg text-center ${
                    theme === "dark" ? "bg-green-900/20 border-2 border-green-500" : "bg-green-50 border-2 border-green-400"
                  }`}
                >
                  <div className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    قيمة الأوردر
                  </div>
                  <div className="text-2xl font-bold text-green-500">
                    {formatNumber(
                      (parseFloat(orderFormData.quantity) || 0) *
                        (parseFloat(orderFormData.price) || 0)
                    )}{" "}
                    ج.م
                  </div>
                </div>
              )}

              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  البيان
                </label>
                <input
                  type="text"
                  placeholder="وصف الأوردر"
                  value={orderFormData.description}
                  onChange={(e) =>
                    setOrderFormData({
                      ...orderFormData,
                      description: e.target.value,
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    الكمية
                  </label>
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
                    required
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    السعر
                  </label>
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
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  السعر الإجمالي
                </label>
                <div
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-700 text-white"
                      : "bg-gray-200 text-gray-900"
                  } border`}
                >
                  {orderFormData.quantity && orderFormData.price
                    ? `${formatNumber(
                        parseFloat(orderFormData.quantity) *
                          parseFloat(orderFormData.price)
                      )} ج.م`
                    : "0 ج.م"}
                </div>
              </div>

              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  المبلغ المسدد
                </label>
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
                  التاريخ
                </label>
                <input
                  type="date"
                  value={orderFormData.date}
                  onChange={(e) =>
                    setOrderFormData({ ...orderFormData, date: e.target.value })
                  }
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                    theme === "dark"
                      ? "bg-camel text-black hover:bg-camel/90"
                      : "bg-brown text-white hover:bg-brown/90"
                  }`}
                >
                  {editingOrder ? "تحديث الأوردر" : "إضافة الأوردر"}
                </button>
                <button
                  type="button"
                  onClick={closeOrderModal}
                  className="flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
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
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4">
          <div
            className={`p-6 rounded-lg w-96 max-w-md ${
              theme === "dark" ? "bg-gray-900" : "bg-white"
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div
                className={`p-3 rounded-full ${
                  theme === "dark" ? "bg-red-900" : "bg-red-100"
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    theme === "dark" ? "text-red-400" : "text-red-600"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div>
                <h3
                  className={`text-lg font-semibold ${
                    theme === "dark" ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  تأكيد الحذف
                </h3>
                <p
                  className={`text-sm ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  هل أنت متأكد من حذف{" "}
                  {deleteItem?.type === "payment"
                    ? "هذه الدفعة"
                    : "هذا الأوردر"}
                  ؟
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
              >
                حذف
              </button>
              <button
                onClick={cancelDelete}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                  theme === "dark"
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Returned Order Modal */}
      {showReturnedOrderModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
          style={{ zIndex: 1000 }}
        >
          <div
            className={`p-6 rounded-lg w-96 max-h-[90vh] overflow-y-auto ${
              theme === "dark" ? "bg-gray-900" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <h3
                className={`text-xl font-bold ${
                  theme === "dark" ? "text-red-400" : "text-red-600"
                }`}
              >
                {editingReturnedOrder ? "تعديل أوردر راجع" : "إضافة أوردر راجع"} - {customer.name}
              </h3>
              <button
                onClick={closeReturnedOrderModal}
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

            <form onSubmit={handleReturnedOrderSubmit} className="space-y-4">
              {/* Total Value Display */}
              {(returnedOrderFormData.quantity && returnedOrderFormData.price) && (
                <div
                  className={`p-4 rounded-lg text-center ${
                    theme === "dark" ? "bg-red-900/20 border-2 border-red-500" : "bg-red-50 border-2 border-red-400"
                  }`}
                >
                  <div className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    قيمة الإرجاع
                  </div>
                  <div className="text-2xl font-bold text-red-500">
                    {formatNumber(
                      (parseFloat(returnedOrderFormData.quantity) || 0) *
                        (parseFloat(returnedOrderFormData.price) || 0)
                    )}{" "}
                    ج.م
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
                  placeholder="وصف الصنف المرتجع"
                  value={returnedOrderFormData.description}
                  onChange={(e) =>
                    setReturnedOrderFormData({
                      ...returnedOrderFormData,
                      description: e.target.value,
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
                  الكمية
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="الكمية"
                  value={returnedOrderFormData.quantity}
                  onChange={(e) =>
                    setReturnedOrderFormData({
                      ...returnedOrderFormData,
                      quantity: e.target.value,
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
                  الوحدة
                </label>
                <select
                  value={returnedOrderFormData.unit}
                  onChange={(e) =>
                    setReturnedOrderFormData({
                      ...returnedOrderFormData,
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

              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  السعر
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="السعر"
                  value={returnedOrderFormData.price}
                  onChange={(e) =>
                    setReturnedOrderFormData({
                      ...returnedOrderFormData,
                      price: e.target.value,
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
                  التاريخ
                </label>
                <input
                  type="date"
                  value={returnedOrderFormData.date}
                  onChange={(e) =>
                    setReturnedOrderFormData({
                      ...returnedOrderFormData,
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

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={returnedOrderFormData.add_to_inventory}
                    onChange={(e) =>
                      setReturnedOrderFormData({
                        ...returnedOrderFormData,
                        add_to_inventory: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span
                    className={`text-sm font-semibold ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    إضافة الكمية للمخزون
                  </span>
                </label>
              </div>

              {returnedOrderFormData.add_to_inventory && (
                <>
                  <div>
                    <label
                      className={`block text-sm font-semibold mb-1 ${
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      القسم
                    </label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      className={`w-full px-3 py-2 rounded ${
                        theme === "dark"
                          ? "bg-gray-800 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                      required={returnedOrderFormData.add_to_inventory}
                    >
                      <option value="">اختر القسم</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSectionId && (
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-1 ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        الصنف في المخزون
                      </label>
                      <select
                        value={returnedOrderFormData.inventory_item_id}
                        onChange={(e) =>
                          setReturnedOrderFormData({
                            ...returnedOrderFormData,
                            inventory_item_id: e.target.value,
                            section_id: selectedSectionId,
                          })
                        }
                        className={`w-full px-3 py-2 rounded ${
                          theme === "dark"
                            ? "bg-gray-800 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                        required={returnedOrderFormData.add_to_inventory}
                      >
                        <option value="">اختر الصنف</option>
                        {inventory
                          .filter(
                            (item) =>
                              item.section_id == selectedSectionId
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.color_number} - {item.total_meters}{" "}
                              {item.unit || "متر"}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg font-semibold ${
                    theme === "dark"
                      ? "bg-red-600 text-white"
                      : "bg-red-500 text-white"
                  }`}
                >
                  إضافة
                </button>
                <button
                  type="button"
                  onClick={closeReturnedOrderModal}
                  className={`flex-1 py-2 rounded-lg font-semibold ${
                    theme === "dark"
                      ? "bg-gray-600 text-white"
                      : "bg-gray-500 text-white"
                  }`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDetails;
