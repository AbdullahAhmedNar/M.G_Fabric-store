import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { formatNumber } from "../utils/format";
import SearchableSelect from "./SearchableSelect";

function CustomerDetails({ customer, onClose }) {
  const { theme, appName } = useTheme();
  const { addNotification } = useNotification();
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [returnedOrders, setReturnedOrders] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showTransactionDetailsModal, setShowTransactionDetailsModal] =
    useState(false);
  const [selectedTransactionDetails, setSelectedTransactionDetails] =
    useState(null);
  const [showReturnedOrderModal, setShowReturnedOrderModal] = useState(false);
  const [editingReturnedOrder, setEditingReturnedOrder] = useState(null);
  const [sections, setSections] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [orderSelectedSectionId, setOrderSelectedSectionId] = useState("");
  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [orderFormData, setOrderFormData] = useState({
    customer_name: "",
    description: "",
    from_inventory: false,
    section_id: "",
    inventory_item_id: "",
    quantity: "",
    unit: "متر",
    price: "",
    paid: "",
    rolls_sold: "",
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
    rolls_count: "",
    add_to_inventory: false,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [showGroupOrderModal, setShowGroupOrderModal] = useState(false);
  const [selectedGroupTransaction, setSelectedGroupTransaction] = useState(null);
  const [editingGroupItemId, setEditingGroupItemId] = useState(null);
  const [groupItemEditForm, setGroupItemEditForm] = useState({});

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
  }, [customer?.id, customer?.name]);

  // إغلاق مودال فاتورة متعددة الأصناف إذا لم يتبقَّ أي صنف في المجموعة (بعد حذف الكل)
  useEffect(() => {
    if (!showGroupOrderModal || !selectedGroupTransaction?.groupIds?.length) return;
    const groupOrders = orders.filter((o) => selectedGroupTransaction.groupIds.includes(o.id));
    if (groupOrders.length === 0) {
      setShowGroupOrderModal(false);
      setSelectedGroupTransaction(null);
    }
  }, [orders, showGroupOrderModal, selectedGroupTransaction]);

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
                  <h1>${appName || 'M.G FASHION FABRIC'}</h1>
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
                <td>${t.type === "returned_order" ? `⟲ ${t.description || "أوردر راجع"}` : (t.isGrouped ? `📋 ${t.description || "أوردر"}` : (t.description || (t.type === "payment" ? "دفعة" : "أوردر")))}</td>
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

  const printGroupInvoice = (transaction, items) => {
    const totalValue  = items.reduce((s, o) => s + (o.quantity || 0) * (o.price || 0), 0);
    const totalPaid   = items.reduce((s, o) => s + (parseFloat(o.paid) || 0), 0);
    const remaining   = Math.max(0, totalValue - totalPaid);
    const invoiceDate = transaction.date || new Date().toISOString().split("T")[0];
    const sysName     = appName || "M.G FASHION FABRIC";

    const fmt = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const itemRows = items.map((o) => `
      <div class="item">
        <div class="item-name">${o.description || "صنف"}</div>
        <div class="item-calc">
          ${fmt(o.quantity)} ${o.unit || "متر"} × ${fmt(o.price)} ج.م = <strong>${fmt((o.quantity || 0) * (o.price || 0))} ج.م</strong>
        </div>
      </div>
    `).join('<div class="sep-dashed"></div>');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة - ${customer.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Cairo', Arial, sans-serif;
      direction: rtl;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      padding: 20px 0 40px;
    }

    .receipt {
      background: #fff;
      width: 300px;
      padding: 20px 18px 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.12);
    }

    /* ─── Store name ─── */
    .store-name {
      text-align: center;
      font-size: 18px;
      font-weight: 900;
      color: #8b5e3c;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
    }

    /* ─── Separators ─── */
    .sep-solid  { border-top: 1px solid #ccc; margin: 12px 0; }
    .sep-dashed { border-top: 1px dashed #ccc; margin: 8px 0; }

    /* ─── Invoice meta ─── */
    .meta { text-align: right; margin-bottom: 4px; }
    .meta .meta-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
    .meta .meta-row   { font-size: 11px; color: #555; margin: 2px 0; }

    /* ─── Item rows ─── */
    .item { margin: 4px 0; }
    .item-name { font-size: 13px; font-weight: 700; text-align: right; }
    .item-calc { font-size: 11px; color: #555; text-align: right; margin-top: 2px; }
    .item-calc strong { color: #333; font-weight: 700; }

    /* ─── Totals ─── */
    .totals { margin: 4px 0; }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 3px 0;
    }
    .total-label { font-size: 13px; color: #444; font-weight: 600; }
    .total-value { font-size: 22px; font-weight: 900; }
    .total-value.main  { color: #1a1a1a; }
    .total-value.paid  { color: #16a34a; }
    .total-value.rem   { color: #dc2626; }
    .total-unit { font-size: 13px; font-weight: 600; }

    /* ─── Quran verse ─── */
    .verse {
      text-align: center;
      font-size: 11px;
      color: #555;
      line-height: 1.7;
      margin: 4px 0 2px;
    }
    .verse-ref { font-size: 10px; color: #888; }

    /* ─── Footer ─── */
    .footer { text-align: center; }
    .footer .welcome { font-size: 14px; font-weight: 700; color: #8b5e3c; margin-bottom: 3px; }
    .footer .sub     { font-size: 11px; color: #888; }

    @media print {
      body { background: #fff; padding: 0; }
      .receipt { box-shadow: none; width: 100%; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="receipt">

    <!-- اسم المتجر -->
    <div class="store-name">${sysName}</div>
    <div class="sep-solid"></div>

    <!-- بيانات الفاتورة -->
    <div class="meta">
      <div class="meta-title">فاتورة بيع</div>
      <div class="meta-row">التاريخ: ${invoiceDate}</div>
      <div class="meta-row">العميل: ${customer.name}</div>
    </div>
    <div class="sep-dashed"></div>

    <!-- الأصناف -->
    ${itemRows}
    <div class="sep-solid"></div>

    <!-- الإجماليات -->
    <div class="totals">
      <div class="total-row">
        <span class="total-label">الإجمالي:</span>
        <span class="total-value main">${fmt(totalValue)} <span class="total-unit">ج.م</span></span>
      </div>
      <div class="total-row">
        <span class="total-label">المدفوع:</span>
        <span class="total-value paid">${fmt(totalPaid)} <span class="total-unit">ج.م</span></span>
      </div>
      <div class="total-row">
        <span class="total-label">${remaining > 0 ? "الباقي:" : "مسدد بالكامل"}</span>
        <span class="total-value rem">${remaining > 0 ? fmt(remaining) + ' <span class="total-unit">ج.م</span>' : "✓"}</span>
      </div>
    </div>
    <div class="sep-solid"></div>

    <!-- آية قرآنية -->
    <div class="verse">
      "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ"
      <div class="verse-ref">سورة الطلاق - الآية 2-3</div>
    </div>
    <div class="sep-dashed"></div>

    <!-- تذييل -->
    <div class="footer">
      <div class="welcome">أهلاً وسهلاً بك</div>
      <div class="sub">نتمنى لكم تجربة تسوق ممتعة</div>
    </div>

  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
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

  const handleDeleteOrder = (orderOrId) => {
    const id = typeof orderOrId === "object" ? orderOrId?.id : orderOrId;
    const groupIds = typeof orderOrId === "object" ? orderOrId?.groupIds : undefined;
    setDeleteItem({ type: "order", id, groupIds });
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      const idsToDelete =
        deleteItem.type === "order" && deleteItem.groupIds?.length
          ? deleteItem.groupIds
          : [deleteItem.id];

      let allOk = true;
      for (const id of idsToDelete) {
        const url =
          deleteItem.type === "payment"
            ? `http://localhost:3456/api/payments/${id}`
            : deleteItem.type === "returned_order"
            ? `http://localhost:3456/api/returned-orders/${id}`
            : `http://localhost:3456/api/sales/${id}`;
        const response = await fetch(url, { method: "DELETE" });
        if (!response.ok) allOk = false;
      }

      if (allOk) {
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
        from_inventory: !!order.inventory_item_id,
        section_id: order.section_id || "",
        inventory_item_id: order.inventory_item_id || "",
        quantity: order.quantity || "",
        unit: order.unit || "متر",
        price: order.price || "",
        paid: order.paid || "",
        rolls_sold: order.rolls_sold ?? "",
        date: order.date || new Date().toISOString().split("T")[0],
      });
      const selectedInventoryItem = order.inventory_item_id
        ? inventory.find((item) => item.id == order.inventory_item_id)
        : null;
      setOrderSelectedSectionId(
        order.section_id
          ? String(order.section_id)
          : selectedInventoryItem?.section_id
          ? String(selectedInventoryItem.section_id)
          : ""
      );
    } else {
      setEditingOrder(null);
      setOrderFormData({
        customer_name: customer.name,
        description: "",
        from_inventory: false,
        section_id: "",
        inventory_item_id: "",
        quantity: "",
        unit: "متر",
        price: "",
        paid: "",
        rolls_sold: "",
        date: new Date().toISOString().split("T")[0],
      });
      setOrderSelectedSectionId("");
    }
    setShowOrderModal(true);
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setEditingOrder(null);
    setOrderSelectedSectionId("");
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      const quantity = parseFloat(orderFormData.quantity) || 0;
      const price = parseFloat(orderFormData.price) || 0;
      const paid = parseFloat(orderFormData.paid) || 0;
      const rollsSoldVal =
        orderFormData.rolls_sold != null && orderFormData.rolls_sold !== ""
          ? parseInt(orderFormData.rolls_sold, 10)
          : null;
      const inventoryItemId =
        orderFormData.from_inventory && orderFormData.inventory_item_id
          ? orderFormData.inventory_item_id
          : null;
      const sectionId =
        orderFormData.from_inventory && orderFormData.section_id
          ? orderFormData.section_id
          : null;

      if (orderFormData.from_inventory && inventoryItemId) {
        const selectedItem = inventory.find((i) => i.id == inventoryItemId);
        if (
          orderFormData.rolls_sold === "" ||
          orderFormData.rolls_sold == null ||
          Number.isNaN(rollsSoldVal) ||
          rollsSoldVal <= 0
        ) {
          addNotification("عدد الأتواب مطلوب ولا يمكن تركه فارغًا", "error");
          return;
        }
        const availableQuantity =
          (selectedItem?.total_meters || 0) +
          (editingOrder?.inventory_item_id == inventoryItemId
            ? parseFloat(editingOrder?.quantity || 0)
            : 0);
        if (!selectedItem || quantity > availableQuantity) {
          addNotification(
            `الكمية غير متوفرة في المخزون. المتاح: ${formatNumber(
              availableQuantity
            )} ${selectedItem?.unit || "متر"} فقط`,
            "error"
          );
          return;
        }
        if (!Number.isNaN(rollsSoldVal) && rollsSoldVal > 0) {
          const availableRolls =
            (parseInt(selectedItem?.rolls_count, 10) || 0) +
            (editingOrder?.inventory_item_id == inventoryItemId
              ? parseInt(editingOrder?.rolls_sold, 10) || 0
              : 0);
          if (rollsSoldVal > availableRolls) {
            addNotification(
              `عدد الأتواب (${rollsSoldVal}) أكبر من المتاح (${availableRolls})`,
              "error"
            );
            return;
          }
        }
      }

      const url = editingOrder
        ? `http://localhost:3456/api/sales/${editingOrder.id}`
        : "http://localhost:3456/api/sales";

      const method = editingOrder ? "PUT" : "POST";

      const total = quantity * price;
      const remaining = total - paid;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: orderFormData.customer_name,
          description: orderFormData.description,
          quantity,
          unit: orderFormData.unit || "متر",
          price,
          total: total,
          paid: paid,
          remaining: remaining,
          date: orderFormData.date,
          inventory_item_id: inventoryItemId,
          section_id: sectionId,
          rolls_sold:
            !Number.isNaN(rollsSoldVal) && rollsSoldVal > 0
              ? rollsSoldVal
              : null,
          ...(editingOrder?.order_group_id
            ? { order_group_id: editingOrder.order_group_id }
            : {}),
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
          `http://localhost:3456/api/sales/by-customer?customer_id=${customer.id}`
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
      rolls_count: "",
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
      rolls_count: returnedOrder.rolls_count ?? "",
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
      rolls_count: "",
      add_to_inventory: false,
    });
    setSelectedSectionId("");
  };

  const handleReturnedOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      const quantity = parseFloat(returnedOrderFormData.quantity) || 0;
      const price = parseFloat(returnedOrderFormData.price) || 0;
      const rollsCountRaw = returnedOrderFormData.rolls_count;
      const parsedRollsCount =
        rollsCountRaw != null && rollsCountRaw !== ""
          ? parseInt(rollsCountRaw, 10)
          : null;
      const rollsCount =
        Number.isInteger(parsedRollsCount) && parsedRollsCount >= 0
          ? parsedRollsCount
          : null;

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
          rolls_count: rollsCount,
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

  const startGroupItemInlineEdit = (order) => {
    setEditingGroupItemId(order.id);
    setGroupItemEditForm({
      description: order.description || "",
      quantity: order.quantity || "",
      price: order.price || "",
      paid: order.paid || "",
      date: order.date || new Date().toISOString().split("T")[0],
      order_group_id: order.order_group_id,
      unit: order.unit || "متر",
      section_id: order.section_id ?? "",
      inventory_item_id: order.inventory_item_id ?? "",
      rolls_sold: order.rolls_sold ?? "",
      _original_quantity: order.quantity || 0,
      _original_rolls_sold: order.rolls_sold || 0,
    });
  };

  const cancelGroupItemInlineEdit = () => {
    setEditingGroupItemId(null);
    setGroupItemEditForm({});
  };

  const saveGroupItemInlineEdit = async (orderId) => {
    try {
      const quantity = parseFloat(groupItemEditForm.quantity) || 0;
      const price = parseFloat(groupItemEditForm.price) || 0;
      const total = quantity * price;
      const paid = parseFloat(groupItemEditForm.paid) || 0;
      const sectionId =
        groupItemEditForm.section_id !== "" && groupItemEditForm.section_id != null
          ? groupItemEditForm.section_id
          : null;
      const inventoryItemId =
        groupItemEditForm.inventory_item_id !== "" &&
        groupItemEditForm.inventory_item_id != null
          ? groupItemEditForm.inventory_item_id
          : null;
      const rollsSoldVal = groupItemEditForm.rolls_sold != null && groupItemEditForm.rolls_sold !== ""
        ? parseInt(groupItemEditForm.rolls_sold, 10) : null;
      if (inventoryItemId && (Number.isNaN(rollsSoldVal) || rollsSoldVal == null || rollsSoldVal <= 0)) {
        addNotification("عدد الأتواب مطلوب قبل حفظ تعديل الصنف", "error");
        return;
      }

      const orderGroupId =
        groupItemEditForm.order_group_id ||
        selectedGroupTransaction?.order_group_id ||
        orders.find((o) => o.id === orderId)?.order_group_id ||
        null;

      const response = await fetch(
        `http://localhost:3456/api/sales/${orderId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: customer.name,
            description: groupItemEditForm.description,
            quantity,
            price,
            total,
            paid,
            remaining: total - paid,
            date: groupItemEditForm.date,
            order_group_id: orderGroupId,
            unit: groupItemEditForm.unit || "متر",
            section_id: sectionId,
            inventory_item_id: inventoryItemId,
            rolls_sold: !isNaN(rollsSoldVal) && rollsSoldVal > 0 ? rollsSoldVal : null,
          }),
        }
      );

      if (response.ok) {
        addNotification("تم تعديل الصنف بنجاح", "success");
        cancelGroupItemInlineEdit();
        const ordersRes = await fetch(
          `http://localhost:3456/api/sales/by-customer?customer_id=${customer.id}`
        );
        const ordersJson = await ordersRes.json();
        if (ordersJson?.success && Array.isArray(ordersJson.rows)) {
          setOrders(ordersJson.rows);
          if (selectedGroupTransaction?.groupIds?.length) {
            const freshOrders = ordersJson.rows;
            const stillGrouped = freshOrders.filter((o) =>
              selectedGroupTransaction.groupIds.includes(o.id)
            );
            if (stillGrouped.length > 0) {
              const totalValue = stillGrouped.reduce(
                (s, o) => s + (o.quantity || 0) * (o.price || 0),
                0
              );
              const totalPaid = stillGrouped.reduce(
                (s, o) => s + (parseFloat(o.paid) || 0),
                0
              );
              const totalQuantity = stillGrouped.reduce(
                (s, o) => s + (parseFloat(o.quantity) || 0),
                0
              );
              setSelectedGroupTransaction((prev) => ({
                ...prev,
                value: totalValue,
                paid: totalPaid,
                quantity: totalQuantity,
              }));
            }
          }
        }
        window.dispatchEvent(new CustomEvent("updateStatistics"));
      } else {
        const errData = await response.json().catch(() => null);
        const errMsg = errData?.message || "فشل في تعديل الصنف";
        addNotification(errMsg, "error");
      }
    } catch {
      addNotification("فشل في تعديل الصنف", "error");
    }
  };

  // Calculate combined transactions (orders + payments + returned orders)
  const getAllTransactions = () => {
    const allTransactions = [];

    // Group orders by order_group_id (فواتير متعددة الأصناف تظهر كصف واحد)
    const orderGroups = {};
    const standaloneOrders = [];
    orders.forEach((order) => {
      const gid = order.order_group_id && String(order.order_group_id).trim();
      if (gid) {
        if (!orderGroups[gid]) orderGroups[gid] = [];
        orderGroups[gid].push(order);
      } else {
        standaloneOrders.push(order);
      }
    });

    // Add grouped orders as one row per group (قيمة إجمالية + إجمالي الكمية + سعر الوحدة + اسم القسم في البيان)
    Object.values(orderGroups).forEach((group) => {
      // لو الفاتورة فيها صنف واحد فقط، تعامل معها كأوردر عادي بدون علامة الفاتورة المتعددة
      if (group.length === 1) {
        const order = group[0];
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
        return;
      }

      const first = group[0];
      const totalValue = group.reduce((s, o) => s + ((o.quantity || 0) * (o.price || 0)), 0);
      const totalPaid = group.reduce((s, o) => s + (parseFloat(o.paid) || 0), 0);
      const totalQuantity = group.reduce((s, o) => s + (parseFloat(o.quantity) || 0), 0);
      const unitPrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;
      const sectionId = first.section_id;
      const sectionName = sectionId && sections.find((s) => s.id == sectionId)?.name;
      const description = sectionName || first.description || "أوردر";
      allTransactions.push({
        type: "order",
        id: first.id,
        order_group_id: first.order_group_id,
        global_sequence: first.global_sequence,
        date: first.date,
        description,
        quantity: totalQuantity,
        unit: first.unit || "متر",
        price: unitPrice,
        value: totalValue,
        paid: totalPaid,
        remaining: 0,
        inventory_item_id: null,
        outsideInventory: false,
        isGrouped: true,
        groupIds: group.map((o) => o.id),
      });
    });

    // Add standalone orders
    standaloneOrders.forEach((order) => {
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

  const groupOrders =
    showGroupOrderModal && selectedGroupTransaction?.groupIds?.length
      ? orders.filter((o) =>
          selectedGroupTransaction.groupIds.includes(o.id)
        )
      : [];
  const dynamicGroupTotal = groupOrders.reduce(
    (s, o) => s + (o.quantity || 0) * (o.price || 0),
    0
  );
  const dynamicGroupPaid = groupOrders.reduce(
    (s, o) => s + (parseFloat(o.paid) || 0),
    0
  );

  const orderCount = getAllTransactions().filter(
    (t) => t.type === "order"
  ).length;
  const returnedOrderCount = getAllTransactions().filter(
    (t) => t.type === "returned_order"
  ).length;
  const paymentCount = getAllTransactions().filter(
    (t) => t.type === "payment"
  ).length;
  const transactionsWithBalance = calculateRunningBalance();

  const selectedReturnedInventoryItem = returnedOrderFormData.inventory_item_id
    ? inventory.find(
        (item) =>
          String(item.id) === String(returnedOrderFormData.inventory_item_id)
      )
    : null;

  const handleReturnedQuantityChange = (value) => {
    setReturnedOrderFormData((prev) => ({ ...prev, quantity: value }));
  };

  const handleReturnedRollsChange = (value) => {
    setReturnedOrderFormData((prev) => ({ ...prev, rolls_count: value }));
  };

  const getSectionName = (sectionId) => {
    const section = sections.find((s) => String(s.id) === String(sectionId));
    return section?.name || "-";
  };

  const getInventoryItemName = (inventoryItemId) => {
    const item = inventory.find((i) => String(i.id) === String(inventoryItemId));
    if (!item) return "-";
    return item.color_number
      ? `رقم ${item.color_number}`
      : item.item_name || "صنف";
  };

  const getDetailRowIcon = (label) => {
    const iconClass = `w-5 h-5 shrink-0 ${theme === "dark" ? "text-camel" : "text-brown"}`;
    if (label.includes("التاريخ")) {
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z" />
        </svg>
      );
    }
    if (label.includes("الكمية") || label.includes("عدد الأتواب")) {
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
      );
    }
    if (label.includes("السعر") || label.includes("قيمة") || label.includes("المسدّد")) {
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.5 0-4 1-4 2s1.5 2 4 2 4 1 4 2-1.5 2-4 2m0-10V6m0 12v-2" />
        </svg>
      );
    }
    if (label.includes("القسم") || label.includes("الصنف")) {
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7l1 11a2 2 0 002 2h8a2 2 0 002-2l1-11M9 7V5a3 3 0 016 0v2" />
        </svg>
      );
    }
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    );
  };

  const openTransactionDetails = (transaction) => {
    if (transaction.type === "payment") {
      const payment = payments.find((p) => p.id === transaction.id) || transaction;
      setSelectedTransactionDetails({
        type: "payment",
        title: "تفاصيل الدفعة",
        printData: {
          customerName: customer.name,
          date: payment.date || "-",
          amount: parseFloat(payment.amount ?? payment.paid ?? 0) || 0,
          description: payment.description || "دفعة",
        },
        rows: [
          { label: "النوع", value: "دفعة" },
          { label: "سعر/قيمة الدفعة", value: `${formatNumber(payment.amount ?? payment.paid ?? 0)} ج.م` },
          { label: "تاريخ الدفع", value: payment.date || "-" },
          { label: "البيان", value: payment.description || "دفعة" },
        ],
      });
      setShowTransactionDetailsModal(true);
      return;
    }

    if (transaction.type === "returned_order") {
      const returned =
        returnedOrders.find((r) => r.id === transaction.id) || transaction;
      setSelectedTransactionDetails({
        type: "returned_order",
        title: "تفاصيل الأوردر الراجع",
        printData: {
          customerName: customer.name,
          date: returned.date || "-",
          description: returned.description || "أوردر راجع",
          quantity: parseFloat(returned.quantity || 0) || 0,
          unit: returned.unit || "متر",
          price: parseFloat(returned.price || 0) || 0,
          section: returned.section_id ? getSectionName(returned.section_id) : "-",
          item: returned.inventory_item_id ? getInventoryItemName(returned.inventory_item_id) : "-",
          rolls: returned.rolls_count != null && returned.rolls_count !== "" ? String(returned.rolls_count) : "-",
        },
        rows: [
          { label: "البيان", value: returned.description || "أوردر راجع" },
          { label: "القسم", value: returned.section_id ? getSectionName(returned.section_id) : "-" },
          { label: "الصنف", value: returned.inventory_item_id ? getInventoryItemName(returned.inventory_item_id) : "-" },
          { label: "الكمية", value: `${formatNumber(returned.quantity || 0)} ${returned.unit || "متر"}` },
          { label: "السعر", value: `${formatNumber(returned.price || 0)} ج.م` },
          { label: "عدد الأتواب", value: returned.rolls_count != null && returned.rolls_count !== "" ? String(returned.rolls_count) : "-" },
          { label: "التاريخ", value: returned.date || "-" },
        ],
      });
      setShowTransactionDetailsModal(true);
      return;
    }

    if (transaction.isGrouped && transaction.groupIds?.length) {
      const groupRows = orders.filter((o) =>
        transaction.groupIds.includes(o.id)
      );
      const normalizedItems = groupRows.map((o, index) => {
        const quantity = parseFloat(o.quantity) || 0;
        const price = parseFloat(o.price) || 0;
        const paid = parseFloat(o.paid) || 0;
        const total = quantity * price;
        return {
          idx: index + 1,
          description: o.description || "صنف",
          section: o.section_id ? getSectionName(o.section_id) : "-",
          item: o.inventory_item_id ? getInventoryItemName(o.inventory_item_id) : "-",
          quantity,
          unit: o.unit || "متر",
          price,
          total,
          paid,
          remaining: total - paid,
          rolls: o.rolls_sold != null && o.rolls_sold !== "" ? String(o.rolls_sold) : "-",
        };
      });
      const summary = normalizedItems.reduce(
        (acc, item) => ({
          itemsCount: acc.itemsCount + 1,
          total: acc.total + item.total,
          paid: acc.paid + item.paid,
          remaining: acc.remaining + item.remaining,
        }),
        { itemsCount: 0, total: 0, paid: 0, remaining: 0 }
      );
      setSelectedTransactionDetails({
        type: "group_order",
        title: "تفاصيل الأوردر",
        summary: {
          ...summary,
          date: transaction.date || "-",
        },
        items: normalizedItems,
        printData: {
          customerName: customer.name,
          date: transaction.date || "-",
        },
        rows: [
          { label: "عدد الأصناف", value: String(summary.itemsCount) },
          { label: "التاريخ", value: transaction.date || "-" },
        ],
      });
      setShowTransactionDetailsModal(true);
      return;
    }

    const order = orders.find((o) => o.id === transaction.id) || transaction;
    setSelectedTransactionDetails({
      type: "order",
      title: "تفاصيل الأوردر",
      printData: {
        customerName: customer.name,
        date: order.date || "-",
        description: order.description || "أوردر",
        quantity: parseFloat(order.quantity || 0) || 0,
        unit: order.unit || "متر",
        price: parseFloat(order.price || 0) || 0,
        paid: parseFloat(order.paid || 0) || 0,
        section: order.section_id ? getSectionName(order.section_id) : "-",
        item: order.inventory_item_id ? getInventoryItemName(order.inventory_item_id) : "-",
        rolls: order.rolls_sold != null && order.rolls_sold !== "" ? String(order.rolls_sold) : "-",
      },
      rows: [
        { label: "البيان", value: order.description || "أوردر" },
        { label: "القسم", value: order.section_id ? getSectionName(order.section_id) : "-" },
        { label: "الصنف", value: order.inventory_item_id ? getInventoryItemName(order.inventory_item_id) : "-" },
        { label: "الكمية", value: `${formatNumber(order.quantity || 0)} ${order.unit || "متر"}` },
        { label: "السعر", value: `${formatNumber(order.price || 0)} ج.م` },
        { label: "المسدّد", value: `${formatNumber(order.paid || 0)} ج.م` },
        { label: "عدد الأتواب", value: order.rolls_sold != null && order.rolls_sold !== "" ? String(order.rolls_sold) : "-" },
        { label: "التاريخ", value: order.date || "-" },
      ],
    });
    setShowTransactionDetailsModal(true);
  };

  const handlePrintTransactionPdf = () => {
    if (!selectedTransactionDetails) return;

    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const storeName = appName || "M.G FASHION FABRIC";
    const details = selectedTransactionDetails;
    const printData = details.printData || {};

    let title = "تفاصيل العملية";
    let bodyHtml = "";
    let total = 0;
    let paid = 0;
    let remaining = 0;

    if (details.type === "payment") {
      title = "إيصال دفعة";
      total = parseFloat(printData.amount || 0);
      paid = total;
      remaining = 0;
      bodyHtml = `
        <div class="item-name">${escapeHtml(printData.description || "دفعة")}</div>
        <div class="item-line">المبلغ: ${escapeHtml(formatNumber(total))} ج.م</div>
      `;
    } else if (details.type === "group_order" && Array.isArray(details.items)) {
      title = "فاتورة بيع";
      total = parseFloat(details.summary?.total || 0);
      paid = parseFloat(details.summary?.paid || 0);
      remaining = total - paid;
      bodyHtml = details.items
        .map(
          (item) => `
            <div class="item-name">صنف ${escapeHtml(item.idx)}: ${escapeHtml(item.description)}</div>
            <div class="item-line">${escapeHtml(formatNumber(item.quantity))} ${escapeHtml(item.unit)} × ${escapeHtml(formatNumber(item.price))} ج.م = ${escapeHtml(formatNumber(item.total))} ج.م</div>
            <div class="item-line">القسم: ${escapeHtml(item.section)} | الصنف: ${escapeHtml(item.item)} | الأتواب: ${escapeHtml(item.rolls)}</div>
            <div class="sep dashed"></div>
          `
        )
        .join("");
    } else {
      const quantity = parseFloat(printData.quantity || 0);
      const price = parseFloat(printData.price || 0);
      total = quantity * price;
      paid = parseFloat(printData.paid || 0);
      remaining = total - paid;
      title = details.type === "returned_order" ? "فاتورة أوردر راجع" : "فاتورة بيع";
      bodyHtml = `
        <div class="item-name">${escapeHtml(printData.description || "صنف")}</div>
        <div class="item-line">${escapeHtml(formatNumber(quantity))} ${escapeHtml(printData.unit || "متر")} × ${escapeHtml(formatNumber(price))} ج.م = ${escapeHtml(formatNumber(total))} ج.م</div>
        <div class="item-line">القسم: ${escapeHtml(printData.section || "-")}</div>
        <div class="item-line">الصنف: ${escapeHtml(printData.item || "-")}</div>
        <div class="item-line">عدد الأتواب: ${escapeHtml(printData.rolls || "-")}</div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; direction: rtl; background: #f5f5f5; display: flex; justify-content: center; padding: 20px 0; }
          .receipt { background: #fff; width: 300px; box-shadow: 0 2px 12px rgba(0,0,0,0.12); padding: 16px; }
          .store-name { text-align: center; font-size: 18px; font-weight: 800; color: #8b5e3c; margin-bottom: 12px; }
          .sep { border-top: 1px solid #d1d5db; margin: 10px 0; }
          .sep.dashed { border-top-style: dashed; margin: 8px 0; }
          .meta { text-align: right; }
          .meta p { font-size: 12px; color: #4b5563; margin: 2px 0; }
          .title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; }
          .item-name { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 4px; }
          .item-line { font-size: 12px; color: #4b5563; margin-bottom: 3px; }
          .row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
          .row .paid { color: #16a34a; font-weight: 700; }
          .row .remain-pos { color: #dc2626; font-weight: 700; }
          .row .remain-neg { color: #2563eb; font-weight: 700; }
          .thanks { text-align: center; margin-top: 12px; }
          .thanks p:first-child { color: #8b5e3c; font-weight: 700; font-size: 13px; }
          .thanks p:last-child { color: #6b7280; font-size: 11px; margin-top: 2px; }
          @media print { body { background: #fff; padding: 0; } .receipt { box-shadow: none; width: 300px; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="store-name">${escapeHtml(storeName)}</div>
          <div class="sep"></div>
          <div class="meta">
            <div class="title">${escapeHtml(title)}</div>
            <p>التاريخ: ${escapeHtml(printData.date || "-")}</p>
            <p>العميل: ${escapeHtml(printData.customerName || customer.name || "-")}</p>
          </div>
          <div class="sep"></div>
          ${bodyHtml}
          <div class="sep"></div>
          <div class="row"><span>الإجمالي:</span><span>${escapeHtml(formatNumber(total))} ج.م</span></div>
          <div class="row"><span>المدفوع:</span><span class="paid">${escapeHtml(formatNumber(paid))} ج.م</span></div>
          <div class="row"><span>${remaining < 0 ? "له مبلغ:" : "الباقي:"}</span><span class="${remaining < 0 ? "remain-neg" : "remain-pos"}">${escapeHtml(formatNumber(Math.abs(remaining)))} ج.م</span></div>
          <div class="sep"></div>
          <div class="thanks"><p>أهلاً وسهلاً بك</p><p>نتمنى لكم تجربة تسوق ممتعة</p></div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addNotification("تعذر فتح نافذة الطباعة", "error");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

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
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="أوردر متعدد الأصناف">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <span
                        className={`text-xs font-medium ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        أوردر متعدد الأصناف
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
          {transactionsWithBalance.length > 0 ? (
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
                  {transactionsWithBalance.map((transaction, index) => (
                    <tr 
                      key={`${transaction.type}-${transaction.id || index}`}
                      className={`${
                        theme === "dark" ? "hover:bg-gray-800/60" : "hover:bg-amber-50/70"
                      } ${
                        transaction.type === "payment"
                          ? theme === "dark"
                            ? "bg-emerald-900/20"
                            : "bg-emerald-50/60"
                          : transaction.type === "returned_order"
                          ? theme === "dark"
                            ? "bg-red-900/20"
                            : "bg-red-50/60"
                          : ""
                      }`}
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
                            ? "border-gray-800 text-amber-300"
                            : "border-gray-300 text-brown"
                        }`}
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
                        } max-w-[260px]`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              transaction.type === "payment"
                                ? "bg-emerald-100 text-emerald-700"
                                : transaction.type === "returned_order"
                                ? "bg-red-100 text-red-700"
                                : transaction.isGrouped
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {transaction.type === "payment"
                              ? "دفعة"
                              : transaction.type === "returned_order"
                              ? "مرتجع"
                              : transaction.isGrouped
                              ? "أوردر"
                              : "أوردر"}
                          </span>
                          {transaction.type === "returned_order" && (
                            <span className="text-red-500 font-bold" title="أوردر راجع">
                              ⟲
                            </span>
                          )}
                          {transaction.isGrouped && transaction.type === "order" && (
                            <span
                              className="p-1 rounded text-blue-600 cursor-default flex-shrink-0"
                              title="أوردر متعدد الأصناف"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                              </svg>
                            </span>
                          )}
                          <span
                            className="min-w-0 block truncate"
                            title={
                              transaction.description ||
                              (transaction.type === "payment"
                                ? "دفعة"
                                : transaction.type === "returned_order"
                                ? "أوردر راجع"
                                : "أوردر")
                            }
                          >
                            {transaction.description ||
                              (transaction.type === "payment"
                                ? "دفعة"
                                : transaction.type === "returned_order"
                                ? "أوردر راجع"
                                : "أوردر")}
                          </span>
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
                          {/* زر رؤية التفاصيل لجميع الأنواع */}
                          <button
                            onClick={() => openTransactionDetails(transaction)}
                            className="p-2 rounded text-emerald-500 hover:text-emerald-600"
                            title="رؤية التفاصيل"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
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
                                onClick={() => {
                                  if (transaction.isGrouped && transaction.groupIds?.length) {
                                    setSelectedGroupTransaction(transaction);
                                    setShowGroupOrderModal(true);
                                  } else {
                                    const o = orders.find((o) => o.id === transaction.id);
                                    if (o) openOrderModal(o);
                                  }
                                }}
                                className="p-2 rounded text-blue-500 hover:text-blue-600"
                                title={transaction.isGrouped ? "تعديل أصناف الأوردر" : "تعديل الأوردر"}
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
      {showTransactionDetailsModal && selectedTransactionDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4"
          style={{ zIndex: 1100 }}
        >
          <div
            className={`p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border ${
              theme === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${theme === "dark" ? "bg-camel/20 text-camel" : "bg-brown/10 text-brown"}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  </svg>
                </div>
                <h3
                  className={`text-xl font-bold ${
                    theme === "dark" ? "text-camel" : "text-brown"
                  }`}
                >
                  {selectedTransactionDetails.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintTransactionPdf}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition ${
                    theme === "dark"
                      ? "bg-camel text-black hover:bg-camel/90"
                      : "bg-brown text-white hover:bg-brown/90"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V4h12v5M6 18h12m-9 0v2h6v-2m-9 0H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                  </svg>
                  طباعة PDF
                </button>
                <button
                  onClick={() => {
                    setShowTransactionDetailsModal(false);
                    setSelectedTransactionDetails(null);
                  }}
                  className={`p-2 rounded-lg transition ${
                    theme === "dark"
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {selectedTransactionDetails.type === "group_order" && Array.isArray(selectedTransactionDetails.items) ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-xl border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-amber-50 border-amber-200"}`}>
                    <p className="text-xs text-gray-500 mb-1">عدد الأصناف</p>
                    <p className={`text-xl font-extrabold ${theme === "dark" ? "text-camel" : "text-brown"}`}>{selectedTransactionDetails.summary?.itemsCount || 0}</p>
                  </div>
                  <div className={`p-3 rounded-xl border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <p className="text-xs text-gray-500 mb-1">إجمالي الأوردر</p>
                    <p className={`text-xl font-extrabold ${theme === "dark" ? "text-camel" : "text-brown"}`}>{formatNumber(selectedTransactionDetails.summary?.total || 0)} ج.م</p>
                  </div>
                  <div className={`p-3 rounded-xl border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <p className="text-xs text-gray-500 mb-1">إجمالي المسدد</p>
                    <p className="text-xl font-extrabold text-green-600">{formatNumber(selectedTransactionDetails.summary?.paid || 0)} ج.م</p>
                  </div>
                  <div className={`p-3 rounded-xl border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <p className="text-xs text-gray-500 mb-1">التاريخ</p>
                    <p className={`text-lg font-bold ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>{selectedTransactionDetails.summary?.date || "-"}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedTransactionDetails.items.map((item) => (
                    <div
                      key={`group-item-${item.idx}-${item.description}`}
                      className={`p-4 rounded-xl border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className={`font-bold ${theme === "dark" ? "text-camel" : "text-brown"}`}>صنف {item.idx}: {item.description}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${theme === "dark" ? "bg-camel/20 text-camel" : "bg-brown/10 text-brown"}`}>
                          {item.section}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        <div className={`p-2 rounded ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>الصنف: <span className="font-semibold">{item.item}</span></div>
                        <div className={`p-2 rounded ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>الكمية: <span className="font-semibold">{formatNumber(item.quantity)} {item.unit}</span></div>
                        <div className={`p-2 rounded ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>السعر: <span className="font-semibold">{formatNumber(item.price)} ج.م</span></div>
                        <div className={`p-2 rounded ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>الإجمالي: <span className="font-semibold">{formatNumber(item.total)} ج.م</span></div>
                        <div className={`p-2 rounded ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>المسدد: <span className="font-semibold text-green-600">{formatNumber(item.paid)} ج.م</span></div>
                        <div className={`p-2 rounded ${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}>عدد الأتواب: <span className="font-semibold">{item.rolls}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedTransactionDetails.rows.map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className={`p-4 rounded-xl border ${
                      theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${
                          theme === "dark" ? "bg-camel/15" : "bg-brown/10"
                        }`}
                      >
                        {getDetailRowIcon(row.label)}
                      </span>
                      <p className={`text-xs font-semibold ${theme === "dark" ? "text-camel/90" : "text-brown/80"}`}>
                        {row.label}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold whitespace-pre-wrap leading-6 ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                  className={`p-4 rounded-xl border ${
                    theme === "dark" ? "bg-gray-800 border-camel/40" : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <svg className={`w-5 h-5 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                    <div className={`text-sm font-semibold ${theme === "dark" ? "text-camel" : "text-brown"}`}>
                      قيمة الأوردر
                    </div>
                  </div>
                  <div className={`text-2xl font-extrabold ${theme === "dark" ? "text-camel" : "text-brown"}`}>
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
                  <span className="inline-flex items-center gap-1.5">
                    <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                    البيان
                  </span>
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="orderFromInventory"
                  checked={!!orderFormData.from_inventory}
                  onChange={(e) =>
                    setOrderFormData({
                      ...orderFormData,
                      from_inventory: e.target.checked,
                      section_id: e.target.checked ? orderFormData.section_id : "",
                      inventory_item_id: e.target.checked
                        ? orderFormData.inventory_item_id
                        : "",
                      rolls_sold: e.target.checked ? orderFormData.rolls_sold : "",
                    })
                  }
                  className="w-4 h-4"
                />
                <label
                  htmlFor="orderFromInventory"
                  className={`text-sm font-semibold ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                    </svg>
                    من المخزون
                  </span>
                </label>
              </div>

              {orderFormData.from_inventory && (
                <>
                  <div>
                    <label
                      className={`block text-sm font-semibold mb-1 ${
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7l1 11a2 2 0 002 2h8a2 2 0 002-2l1-11M9 7V5a3 3 0 016 0v2" />
                        </svg>
                        القسم
                      </span>
                    </label>
                    <SearchableSelect
                      options={sections.map((s) => ({ value: s.id, label: s.name }))}
                      value={orderSelectedSectionId}
                      onChange={(v) => {
                        setOrderSelectedSectionId(v);
                        setOrderFormData({
                          ...orderFormData,
                          section_id: v,
                          inventory_item_id: "",
                          rolls_sold: "",
                        });
                      }}
                      placeholder="اختر القسم"
                      searchPlaceholder="بحث عن قسم..."
                      required={orderFormData.from_inventory}
                    />
                  </div>

                  {orderSelectedSectionId && (
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-1 ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                          </svg>
                          الصنف في المخزون
                        </span>
                      </label>
                      <SearchableSelect
                        options={inventory
                          .filter((item) => String(item.section_id) === String(orderSelectedSectionId))
                          .map((item) => ({
                            value: item.id,
                            label: `${item.color_number ? `رقم ${item.color_number}` : item.item_name || "صنف"} - الكمية المتاحة: ${item.total_meters} ${item.unit || "متر"}`,
                          }))}
                        value={orderFormData.inventory_item_id || ""}
                        onChange={(v) => {
                          const selectedItem = inventory.find(
                            (item) => String(item.id) === String(v)
                          );
                          setOrderFormData({
                            ...orderFormData,
                            inventory_item_id: v,
                            section_id: orderSelectedSectionId,
                            unit: selectedItem?.unit || orderFormData.unit || "متر",
                            description:
                              selectedItem?.item_name ||
                              selectedItem?.color_number ||
                              orderFormData.description ||
                              "",
                          });
                        }}
                        placeholder="اختر الصنف"
                        searchPlaceholder="بحث عن صنف..."
                        required={orderFormData.from_inventory}
                      />
                      {orderFormData.inventory_item_id && (
                        <p
                          className={`mt-1 text-xs ${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          عدد الأتواب الحالي بالمخزون:{" "}
                          {inventory.find(
                            (item) =>
                              String(item.id) ===
                              String(orderFormData.inventory_item_id)
                          )?.rolls_count ?? 0}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a3 3 0 016 0v6M6 21h12" />
                      </svg>
                      الكمية
                    </span>
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
                    <span className="inline-flex items-center gap-1.5">
                      <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.5 0-4 1-4 2s1.5 2 4 2 4 1 4 2-1.5 2-4 2m0-10V6m0 12v-2" />
                      </svg>
                      السعر
                    </span>
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
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h10" />
                      </svg>
                      الوحدة
                    </span>
                  </label>
                  <select
                    value={orderFormData.unit}
                    onChange={(e) =>
                      setOrderFormData({
                        ...orderFormData,
                        unit: e.target.value,
                      })
                    }
                    disabled={
                      orderFormData.from_inventory &&
                      !!orderFormData.inventory_item_id
                    }
                    className={`w-full px-3 py-2 rounded ${
                      theme === "dark"
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-900"
                    } ${
                      orderFormData.from_inventory &&
                      !!orderFormData.inventory_item_id
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    <option value="متر">متر</option>
                    <option value="كيلو">كيلو</option>
                  </select>
                </div>
              </div>

              {orderFormData.from_inventory && orderFormData.inventory_item_id && (
                <div>
                  <label
                    className={`block text-sm font-semibold mb-1 ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m-4-4h8" />
                      </svg>
                      عدد الأتواب
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="مطلوب"
                    value={orderFormData.rolls_sold}
                    onChange={(e) =>
                      setOrderFormData({
                        ...orderFormData,
                        rolls_sold: e.target.value,
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
              )}

              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                    السعر الإجمالي
                  </span>
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
                  <span className="inline-flex items-center gap-1.5">
                    <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2m-2 0h14a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1z" />
                    </svg>
                    المبلغ المسدد
                  </span>
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
                  <span className="inline-flex items-center gap-1.5">
                    <svg className={`w-4 h-4 ${theme === "dark" ? "text-camel" : "text-brown"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z" />
                    </svg>
                    التاريخ
                  </span>
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

      {/* تعديل فاتورة (أصناف متعددة) - يعرض كل أصناف الفاتورة */}
      {showGroupOrderModal && selectedGroupTransaction?.groupIds?.length && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
          style={{ zIndex: 1000 }}
        >
          <div
            className={`rounded-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl ${
              theme === "dark" ? "bg-gray-900" : "bg-white"
            }`}
          >
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b ${theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${theme === "dark" ? "bg-camel/20 text-camel" : "bg-brown/20 text-brown"}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${theme === "dark" ? "text-camel" : "text-brown"}`}>
                    تفاصيل الفاتورة
                  </h3>
                  <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    {customer.name} — {selectedGroupTransaction.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Print button */}
                <button
                  type="button"
                  onClick={() => printGroupInvoice(selectedGroupTransaction, groupOrders)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    theme === "dark"
                      ? "bg-camel text-black hover:bg-camel/80"
                      : "bg-brown text-white hover:bg-brown/80"
                  }`}
                  title="طباعة الفاتورة"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  طباعة
                </button>
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupOrderModal(false);
                    setSelectedGroupTransaction(null);
                    cancelGroupItemInlineEdit();
                  }}
                  className={`p-2 rounded-lg transition ${theme === "dark" ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Summary bar — enlarged */}
            <div className={`px-5 py-4 border-b ${theme === "dark" ? "border-gray-700 bg-gray-800" : "border-amber-100 bg-amber-50"}`}>
              <div className="flex items-center justify-around gap-2">
                <div className="text-center">
                  <div className={`text-xs font-semibold mb-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>الإجمالي</div>
                  <div className={`text-2xl font-black ${theme === "dark" ? "text-amber-400" : "text-amber-700"}`}>
                    {formatNumber(dynamicGroupTotal)} <span className="text-base font-semibold">ج.م</span>
                  </div>
                </div>
                <div className={`w-px h-12 ${theme === "dark" ? "bg-gray-600" : "bg-amber-200"}`} />
                <div className="text-center">
                  <div className={`text-xs font-semibold mb-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>المسدد</div>
                  <div className={`text-2xl font-black ${theme === "dark" ? "text-green-400" : "text-green-600"}`}>
                    {formatNumber(dynamicGroupPaid)} <span className="text-base font-semibold">ج.م</span>
                  </div>
                </div>
                <div className={`w-px h-12 ${theme === "dark" ? "bg-gray-600" : "bg-amber-200"}`} />
                <div className="text-center">
                  <div className={`text-xs font-semibold mb-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>الباقي</div>
                  <div className={`text-2xl font-black ${dynamicGroupTotal - dynamicGroupPaid > 0 ? "text-red-500" : "text-green-500"}`}>
                    {formatNumber(Math.max(0, dynamicGroupTotal - dynamicGroupPaid))} <span className="text-base font-semibold">ج.م</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items list */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className={`text-xs font-bold uppercase tracking-widest mb-3 text-right ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                الأصناف ({groupOrders.length})
              </div>
              <div className="space-y-2">
                {groupOrders.map((order) => (
                  <div key={order.id}>
                    {editingGroupItemId === order.id ? (
                      /* Inline edit form */
                      <div className={`rounded-xl border-2 p-4 ${theme === "dark" ? "border-camel/50 bg-gray-800" : "border-brown/40 bg-amber-50"}`}>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className={`block text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>القسم</label>
                            <SearchableSelect
                              options={sections.map((s) => ({ value: s.id, label: s.name }))}
                              value={groupItemEditForm.section_id || ""}
                              onChange={(v) =>
                                setGroupItemEditForm({
                                  ...groupItemEditForm,
                                  section_id: v,
                                  inventory_item_id: "",
                                  rolls_sold: "",
                                })
                              }
                              placeholder="اختر القسم"
                              searchPlaceholder="بحث عن قسم..."
                              className="py-3 text-base min-h-[48px]"
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>الصنف في المخزون</label>
                            <SearchableSelect
                              options={inventory
                                .filter((item) => String(item.section_id) === String(groupItemEditForm.section_id || ""))
                                .map((item) => ({
                                  value: item.id,
                                  label: `${item.color_number ? `رقم ${item.color_number}` : item.item_name || "صنف"} - الكمية المتاحة: ${item.total_meters} ${item.unit || "متر"}`,
                                }))}
                              value={groupItemEditForm.inventory_item_id || ""}
                              onChange={(v) => {
                                const selectedItem = inventory.find((item) => String(item.id) === String(v));
                                setGroupItemEditForm({
                                  ...groupItemEditForm,
                                  inventory_item_id: v,
                                  section_id: selectedItem?.section_id ?? groupItemEditForm.section_id ?? "",
                                  description:
                                    selectedItem?.item_name ||
                                    selectedItem?.color_number ||
                                    groupItemEditForm.description ||
                                    "",
                                  unit: selectedItem?.unit || groupItemEditForm.unit || "متر",
                                });
                              }}
                              placeholder={groupItemEditForm.section_id ? "اختر الصنف" : "اختر القسم أولا"}
                              searchPlaceholder="بحث عن صنف..."
                              disabled={!groupItemEditForm.section_id}
                              className="py-3 text-base min-h-[48px]"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className={`block text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>البيان</label>
                            <input
                              type="text"
                              value={groupItemEditForm.description}
                              onChange={(e) => setGroupItemEditForm({ ...groupItemEditForm, description: e.target.value })}
                              className={`w-full px-3 py-2 rounded-lg text-sm border ${theme === "dark" ? "bg-gray-700 text-white border-gray-600" : "bg-white text-gray-900 border-gray-300"}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>الكمية</label>
                            <input
                              type="number"
                              step="0.01"
                              value={groupItemEditForm.quantity}
                              onChange={(e) => setGroupItemEditForm({ ...groupItemEditForm, quantity: e.target.value })}
                              className={`w-full px-3 py-2 rounded-lg text-sm border ${theme === "dark" ? "bg-gray-700 text-white border-gray-600" : "bg-white text-gray-900 border-gray-300"}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>السعر</label>
                            <input
                              type="number"
                              step="0.01"
                              value={groupItemEditForm.price}
                              onChange={(e) => setGroupItemEditForm({ ...groupItemEditForm, price: e.target.value })}
                              className={`w-full px-3 py-2 rounded-lg text-sm border ${theme === "dark" ? "bg-gray-700 text-white border-gray-600" : "bg-white text-gray-900 border-gray-300"}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>المسدد</label>
                            <input
                              type="number"
                              step="0.01"
                              value={groupItemEditForm.paid}
                              onChange={(e) => setGroupItemEditForm({ ...groupItemEditForm, paid: e.target.value })}
                              className={`w-full px-3 py-2 rounded-lg text-sm border ${theme === "dark" ? "bg-gray-700 text-white border-gray-600" : "bg-white text-gray-900 border-gray-300"}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>التاريخ</label>
                            <input
                              type="date"
                              value={groupItemEditForm.date}
                              onChange={(e) => setGroupItemEditForm({ ...groupItemEditForm, date: e.target.value })}
                              className={`w-full px-3 py-2 rounded-lg text-sm border ${theme === "dark" ? "bg-gray-700 text-white border-gray-600" : "bg-white text-gray-900 border-gray-300"}`}
                            />
                          </div>
                          {groupItemEditForm.inventory_item_id && (
                            <div>
                              <label className={`block text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>عدد الأتواب</label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={groupItemEditForm.rolls_sold}
                                onChange={(e) => setGroupItemEditForm({ ...groupItemEditForm, rolls_sold: e.target.value })}
                                className={`w-full px-3 py-2 rounded-lg text-sm border ${theme === "dark" ? "bg-gray-700 text-white border-gray-600" : "bg-white text-gray-900 border-gray-300"}`}
                                required
                              />
                            </div>
                          )}
                        </div>
                        {(groupItemEditForm.quantity && groupItemEditForm.price) && (
                          <div className={`text-center text-sm font-bold mb-3 py-1 rounded ${theme === "dark" ? "text-amber-400 bg-gray-700" : "text-amber-700 bg-amber-100"}`}>
                            الإجمالي: {formatNumber((parseFloat(groupItemEditForm.quantity) || 0) * (parseFloat(groupItemEditForm.price) || 0))} ج.م
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveGroupItemInlineEdit(order.id)}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${theme === "dark" ? "bg-camel text-black hover:bg-camel/80" : "bg-brown text-white hover:bg-brown/80"}`}
                          >
                            حفظ
                          </button>
                          <button
                            type="button"
                            onClick={cancelGroupItemInlineEdit}
                            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-400 text-white hover:bg-gray-500"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Card display */
                      <div className={`flex items-center gap-3 p-3 rounded-xl border-r-4 ${theme === "dark" ? "bg-gray-800 border-r-camel" : "bg-gray-50 border-r-brown"}`}>
                        <div className="flex-1 text-right min-w-0">
                          <div className={`font-semibold truncate ${theme === "dark" ? "text-gray-100" : "text-gray-800"}`}>
                            {order.description || "صنف"}
                          </div>
                          <div className={`text-xs mt-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                            كمية: {formatNumber(order.quantity)} {order.unit || "متر"} &nbsp;•&nbsp; سعر: {formatNumber(order.price)} ج.م
                          </div>
                        </div>
                        <div className={`font-bold text-sm whitespace-nowrap ${theme === "dark" ? "text-camel" : "text-brown"}`}>
                          {formatNumber((order.quantity || 0) * (order.price || 0))} ج.م
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => startGroupItemInlineEdit(order)}
                            className="p-1.5 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                            title="تعديل هذا الصنف"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder({ id: order.id })}
                            className="p-1.5 rounded text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="حذف هذا الصنف"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className={`text-xs mt-4 text-center ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`}>
                يمكنك تعديل أو حذف أي صنف. الحذف يزيل الصنف فقط دون حذف الفاتورة كاملاً.
              </p>
            </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
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
                  onChange={(e) => handleReturnedQuantityChange(e.target.value)}
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
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  عدد الأتواب
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="أدخل عدد الأتواب"
                  value={returnedOrderFormData.rolls_count}
                  onChange={(e) => handleReturnedRollsChange(e.target.value)}
                  className={`w-full px-3 py-2 rounded ${
                    theme === "dark"
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  required={returnedOrderFormData.add_to_inventory}
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
                    <SearchableSelect
                      options={sections.map((s) => ({ value: s.id, label: s.name }))}
                      value={selectedSectionId}
                      onChange={(v) => {
                        setSelectedSectionId(v);
                        setReturnedOrderFormData({
                          ...returnedOrderFormData,
                          section_id: v,
                          inventory_item_id: "",
                          rolls_count: "",
                        });
                      }}
                      placeholder="اختر القسم"
                      searchPlaceholder="بحث عن قسم..."
                      required={returnedOrderFormData.add_to_inventory}
                    />
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
                      <SearchableSelect
                        options={inventory
                          .filter((item) => item.section_id == selectedSectionId)
                          .map((item) => ({
                            value: item.id,
                            label: `${item.color_number ? `رقم ${item.color_number}` : item.item_name || "صنف"} - الكمية المتاحة: ${item.total_meters} ${item.unit || "متر"}`
                          }))}
                        value={returnedOrderFormData.inventory_item_id}
                        onChange={(v) => {
                          const selectedItem = inventory.find(
                            (item) => String(item.id) === String(v)
                          );

                          setReturnedOrderFormData({
                            ...returnedOrderFormData,
                            inventory_item_id: v,
                            section_id: selectedSectionId,
                            unit: selectedItem?.unit || returnedOrderFormData.unit,
                          });
                        }}
                        placeholder="اختر الصنف"
                        searchPlaceholder="بحث عن صنف..."
                        required={returnedOrderFormData.add_to_inventory}
                      />
                      {returnedOrderFormData.inventory_item_id && (
                        <p
                          className={`mt-1 text-xs ${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          عدد الأتواب الحالي بالمخزون:{" "}
                          {selectedReturnedInventoryItem?.rolls_count ?? 0}
                        </p>
                      )}
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
