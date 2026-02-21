import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { exportSuppliersToExcel } from "../utils/exportExcel";
import ConfirmDialog from "../components/ConfirmDialog";
import { apiUrl } from "../utils/api";
import SupplierDetails from "../components/SupplierDetails";

function Suppliers() {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [statistics, setStatistics] = useState({
    totalSuppliers: 0,
    totalTransactions: 0,
    totalPaid: 0,
    totalRemaining: 0,
  });
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      // Get suppliers
      const suppliersResponse = await window.api.getAllSuppliers();
      if (suppliersResponse.success) {
        setSuppliers(suppliersResponse.data);
      } else {
        console.error("Failed to fetch suppliers:", suppliersResponse.error);
        setSuppliers([]);
        addNotification("فشل في جلب بيانات الموردين", "error");
      }

      // Get statistics separately
      try {
        const statsResponse = await window.api.getSupplierStatistics();
        if (statsResponse.success) {
          setStatistics(statsResponse.data);
        } else {
          console.error("Failed to fetch statistics:", statsResponse.error);
          setStatistics({
            totalSuppliers: suppliers.length || 0,
            totalTransactions: 0,
            totalPaid: 0,
            totalRemaining: 0,
          });
        }
      } catch (statsError) {
        console.error("Error fetching statistics:", statsError);
        setStatistics({
          totalSuppliers: suppliers.length || 0,
          totalTransactions: 0,
          totalPaid: 0,
          totalRemaining: 0,
        });
      }
    } catch (error) {
      console.error("Error in fetchSuppliers:", error);
      setSuppliers([]);
      addNotification("حدث خطأ أثناء جلب البيانات", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!/^[\u0600-\u06FF\s]+$/.test(formData.name)) {
      addNotification("الاسم يجب أن يحتوي على حروف عربية فقط", "error");
      return;
    }

    const data = {
      name: formData.name,
      phone: formData.phone || null,
      date: formData.date
    };

    try {
      const url = editingId
        ? apiUrl(`/api/suppliers/${editingId}`)
        : apiUrl("/api/suppliers");

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        addNotification(
          editingId ? "تم التعديل بنجاح" : "تم إضافة المورد بنجاح",
          "success"
        );
        fetchSuppliers();
        closeModal();
      } else {
        addNotification(result.message || "حدث خطأ", "error");
      }
    } catch (error) {
      console.error("Error submitting supplier:", error);
      addNotification("حدث خطأ", "error");
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteStats, setDeleteStats] = useState(null);

  const requestDelete = async (id) => {
    try {
      const response = await fetch(apiUrl(`/api/suppliers/${id}/stats`));
      const stats = await response.json();
      
      if (response.ok) {
        setPendingDeleteId(id);
        setDeleteStats(stats);
        setConfirmOpen(true);
      } else {
        addNotification('خطأ في جلب بيانات المورد', 'error');
      }
    } catch (error) {
      addNotification('خطأ في جلب بيانات المورد', 'error');
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await fetch(apiUrl(`/api/suppliers/${pendingDeleteId}`), {
        method: "DELETE",
      });
      addNotification("تم حذف المورد وجميع بياناته المرتبطة", "info");
      fetchSuppliers();
    } catch (error) {
      addNotification("فشل الحذف", "error");
    } finally {
      setConfirmOpen(false);
      setPendingDeleteId(null);
      setDeleteStats(null);
    }
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingId(supplier.id);
      setFormData({
        name: supplier.name,
        phone: supplier.phone || "",
        date: supplier.date,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        phone: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
    setShowModal(true);
  };

  const openDetails = (supplier) => {
    setSelectedSupplier(supplier);
    setShowDetails(true);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedSupplier(null);
    // Refresh suppliers list and statistics
    fetchSuppliers(); // This will fetch both suppliers and statistics
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.includes(searchTerm) ||
      s.date.includes(searchTerm) ||
      (s.phone && s.phone.includes(searchTerm))
  );

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) =>
    a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' })
  );

  const handleExport = () => {
    if (exportSuppliersToExcel(suppliers)) {
      addNotification("تم تصدير البيانات إلى Excel", "success");
    } else {
      addNotification("فشل التصدير", "error");
    }
  };

  return (
    <div>
      <div className="space-y-6 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <svg
              className={`w-8 h-8 ${
                theme === "dark" ? "text-camel" : "text-brown"
              }`}
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
            <h2
              className={`text-3xl font-bold ${
                theme === "dark" ? "text-camel" : "text-brown"
              }`}
            >
              الموردين
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-3 bg-brown text-white rounded-lg font-semibold hover:brightness-110 transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              تصدير Excel
            </button>
            <button
              onClick={() => openModal()}
              className={`px-6 py-3 rounded-lg font-semibold ${
                theme === "dark" ? "bg-camel text-black" : "bg-brown text-white"
              }`}
            >
              + إضافة مورد جديد
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`}>
          <div
            className={`p-4 rounded-lg ${
              theme === "dark" ? "bg-gray-800" : "bg-white shadow"
            }`}
          >
            <div className="text-sm text-gray-500">إجمالي الموردين</div>
            <div
              className={`text-2xl font-bold ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              {statistics.totalSuppliers}
            </div>
          </div>
          <div
            className={`p-4 rounded-lg ${
              theme === "dark" ? "bg-gray-800" : "bg-white shadow"
            }`}
          >
            <div className="text-sm text-gray-500">إجمالي الطلبات</div>
            <div
              className={`text-2xl font-bold ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              {statistics.totalTransactions.toLocaleString()} ج.م
            </div>
          </div>
          <div
            className={`p-4 rounded-lg ${
              theme === "dark" ? "bg-gray-800" : "bg-white shadow"
            }`}
          >
            <div className="text-sm text-gray-500">إجمالي المدفوع</div>
            <div className={`text-2xl font-bold text-green-500`}>
              {statistics.totalPaid.toLocaleString()} ج.م
            </div>
          </div>
          <div
            className={`p-4 rounded-lg ${
              theme === "dark" ? "bg-gray-800" : "bg-white shadow"
            }`}
          >
            <div className="text-sm text-gray-500">إجمالي المتبقي</div>
            <div className={`text-2xl font-bold text-red-500`}>
              {statistics.totalRemaining.toLocaleString()} ج.م
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 relative">
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-5 h-5 ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="بحث بالاسم أو التاريخ أو رقم الهاتف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-3 pr-12 rounded-lg ${
            theme === "dark"
              ? "bg-gray-900 border border-gray-700 text-white"
              : "bg-gray-100 border border-gray-300 text-gray-900"
          }`}
        />
      </div>

      <div className="overflow-x-auto">
        <table
          className={`w-full border ${
            theme === "dark"
              ? "bg-gray-900 border-gray-700"
              : "bg-white border-gray-300"
          }`}
        >
          <thead className={theme === "dark" ? "bg-gray-800" : "bg-gray-100"}>
            <tr>
              <th
                className={`px-3 py-2 text-right border w-auto min-w-0 ${
                  theme === "dark" ? "border-gray-700" : "border-gray-300"
                }`}
              >
                اسم المورد
              </th>
              <th
                className={`px-3 py-2 text-right border ${
                  theme === "dark" ? "border-gray-700" : "border-gray-300"
                }`}
              >
                رقم الهاتف
              </th>
              <th
                className={`px-3 py-2 text-right border ${
                  theme === "dark" ? "border-gray-700" : "border-gray-300"
                }`}
              >
                تاريخ الإضافة
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSuppliers.map((supplier) => (
              <tr key={supplier.id} className={theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}>
                <td
                  className={`px-3 py-2 border align-middle ${
                    theme === "dark" ? "border-gray-800" : "border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`flex-1 min-w-0 break-words font-medium ${theme === "dark" ? "text-gray-100" : "text-gray-900"}`}>{supplier.name}</span>
                    <div className={`flex items-center gap-1 flex-shrink-0 rounded-lg p-1.5 ${theme === "dark" ? "bg-white/10" : "bg-black/5"}`}>
                      <button
                        onClick={() => openDetails(supplier)}
                        className="p-2 rounded-md text-green-600 hover:bg-green-500/20 transition-colors"
                        title="رؤية كشف الحساب"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openModal(supplier)}
                        className="p-2 rounded-md text-blue-600 hover:bg-blue-500/20 transition-colors"
                        title="تعديل"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => requestDelete(supplier.id)}
                        className="p-2 rounded-md text-red-600 hover:bg-red-500/20 transition-colors"
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </td>
                <td
                  className={`px-3 py-2 border ${
                    theme === "dark" ? "border-gray-800" : "border-gray-300"
                  }`}
                >
                  {supplier.phone || "-"}
                </td>
                <td
                  className={`px-3 py-2 border ${
                    theme === "dark" ? "border-gray-800" : "border-gray-300"
                  }`}
                >
                  {supplier.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
              {editingId ? "تعديل مورد" : "إضافة مورد جديد"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  className={`block text-sm font-semibold mb-1 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  اسم المورد
                </label>
                <input
                  type="text"
                  placeholder="اسم المورد"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
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
                  رقم الهاتف (اختياري)
                </label>
                <input
                  type="tel"
                  placeholder="رقم الهاتف"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
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
                  تاريخ الإضافة
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
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
                  {editingId ? "حفظ التعديلات" : "إضافة"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 bg-gray-600 text-white rounded font-semibold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="تأكيد حذف المورد"
        message={
          deleteStats && deleteStats.totalRecords > 0 ? (
            <div className="text-right">
              <p className="mb-3 font-semibold">سيتم حذف المورد "{deleteStats.supplier.name}" وجميع بياناته:</p>
              <ul className={`list-disc list-inside space-y-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                {deleteStats.ordersCount > 0 && (
                  <li>{deleteStats.ordersCount} أوردر</li>
                )}
                {deleteStats.paymentsCount > 0 && (
                  <li>{deleteStats.paymentsCount} دفعة</li>
                )}
              </ul>
              <p className="mt-3 font-bold text-red-500">
                إجمالي السجلات: {deleteStats.totalRecords}
              </p>
              <p className="mt-2 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                هذا الإجراء لا يمكن التراجع عنه
              </p>
            </div>
          ) : (
            `هل أنت متأكد من حذف المورد "${deleteStats?.supplier?.name}"؟`
          )
        }
        confirmText="حذف نهائياً"
        cancelText="إلغاء"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setDeleteStats(null);
        }}
      />

      {showDetails && selectedSupplier && (
        <SupplierDetails supplier={selectedSupplier} onClose={closeDetails} />
      )}
    </div>
  );
}

export default Suppliers;
