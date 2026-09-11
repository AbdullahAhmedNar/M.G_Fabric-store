import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { formatNumber } from '../utils/format'
import { apiUrl } from '../utils/api'
import CustomerDetails from '../components/CustomerDetails'

function Customers() {
  const { theme, appName } = useTheme()
  const { addNotification } = useNotification()
  const [customers, setCustomers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [autoOpenOrder, setAutoOpenOrder] = useState(false)
  const [orderOnly, setOrderOnly] = useState(false)
  const [accountStatus, setAccountStatus] = useState('active')
  const [archivedCount, setArchivedCount] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchCustomers(accountStatus)
  }, [accountStatus])

  const fetchArchivedCount = async () => {
    try {
      const response = await fetch(apiUrl('/api/customers?status=archived'))
      const data = await response.json()
      setArchivedCount(Array.isArray(data) ? data.length : 0)
    } catch {
      // keep last known count
    }
  }

  const fetchCustomers = async (status = accountStatus) => {
    try {
      const response = await fetch(apiUrl(`/api/customers?status=${status}`))
      const data = await response.json()
      setCustomers(Array.isArray(data) ? data : [])
      await fetchArchivedCount()
    } catch (error) {
      addNotification('خطأ في تحميل البيانات', 'error')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!/^[\u0600-\u06FF\s]+$/.test(formData.name)) {
      addNotification('الاسم يجب أن يحتوي على حروف عربية فقط', 'error')
      return
    }

    const data = {
      name: formData.name,
      phone: formData.phone || null,
      date: formData.date || new Date().toISOString().split('T')[0]
    }

    try {
      const urlPath = editingId 
        ? `/api/customers/${editingId}`
        : '/api/customers'
      
      const response = await fetch(apiUrl(urlPath), {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (response.ok) {
        addNotification(editingId ? 'تم التعديل بنجاح' : 'تم إضافة العميل بنجاح', 'success')
        fetchCustomers()
        closeModal()
      } else {
        addNotification(result.message || 'حدث خطأ', result.archived ? 'warning' : 'error')
      }
    } catch (error) {
      addNotification('حدث خطأ', 'error')
    }
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMode, setConfirmMode] = useState('archive')
  const [pendingAccountId, setPendingAccountId] = useState(null)
  const [accountSummary, setAccountSummary] = useState(null)

  const loadAccountSummary = async (id) => {
    const response = await fetch(apiUrl(`/api/customers/${id}/stats`))
    if (!response.ok) return null
    return response.json()
  }

  const requestArchive = async (id) => {
    try {
      const summary = await loadAccountSummary(id)
      if (!summary) {
        addNotification('خطأ في جلب بيانات العميل', 'error')
        return
      }
      setPendingAccountId(id)
      setAccountSummary(summary)
      setConfirmMode('archive')
      setConfirmOpen(true)
    } catch (error) {
      addNotification('خطأ في جلب بيانات العميل', 'error')
    }
  }

  const requestDelete = async (id) => {
    try {
      const summary = await loadAccountSummary(id)
      if (!summary) {
        addNotification('خطأ في جلب بيانات العميل', 'error')
        return
      }
      setPendingAccountId(id)
      setAccountSummary(summary)
      setConfirmMode(summary.hasTransactions ? 'archive' : 'delete')
      setConfirmOpen(true)
    } catch (error) {
      addNotification('خطأ في جلب بيانات العميل', 'error')
    }
  }

  const closeConfirm = () => {
    setConfirmOpen(false)
    setPendingAccountId(null)
    setAccountSummary(null)
  }

  const handleArchive = async () => {
    if (!pendingAccountId) return
    const hasBalance = Math.abs(accountSummary?.balance || 0) > 0.009
    try {
      const response = await fetch(apiUrl(`/api/customers/${pendingAccountId}/archive`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowOutstandingBalance: hasBalance })
      })
      const result = await response.json()
      if (response.ok && result.success) {
        addNotification('تم نقل العميل للأرشيف، وكل معاملاته وكشف حسابه محفوظين زي ما هما', 'success')
        fetchCustomers()
      } else {
        addNotification(result.message || 'فشلت الأرشفة', 'error')
      }
    } catch (error) {
      addNotification('فشلت الأرشفة', 'error')
    } finally {
      closeConfirm()
    }
  }

  const handleRestore = async (id) => {
    try {
      const response = await fetch(apiUrl(`/api/customers/${id}/restore`), { method: 'POST' })
      const result = await response.json()
      if (response.ok && result.success) {
        addNotification('تم استرجاع العميل للحسابات النشطة', 'success')
        fetchCustomers()
      } else {
        addNotification(result.message || 'فشل الاسترجاع', 'error')
      }
    } catch (error) {
      addNotification('فشل الاسترجاع', 'error')
    }
  }

  const handleDelete = async () => {
    if (!pendingAccountId) return
    try {
      const response = await fetch(apiUrl(`/api/customers/${pendingAccountId}`), { method: 'DELETE' })
      const result = await response.json().catch(() => ({}))
      if (response.ok && result.success) {
        addNotification('تم حذف بيانات العميل (مكانش عليه أي معاملات)', 'info')
        fetchCustomers()
      } else {
        addNotification(result.message || 'فشل الحذف', 'error')
      }
    } catch (error) {
      addNotification('فشل الحذف', 'error')
    } finally {
      closeConfirm()
    }
  }

  const openModal = (customer = null) => {
    if (customer) {
      setEditingId(customer.id)
      setFormData({
        name: customer.name,
        phone: customer.phone || '',
        date: customer.date || new Date().toISOString().split('T')[0]
      })
    } else {
      setEditingId(null)
      setFormData({
        name: '',
        phone: '',
        date: new Date().toISOString().split('T')[0]
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
  }

  const openDetails = (customer, options = {}) => {
    setSelectedCustomer(customer)
    setAutoOpenOrder(!!options.openOrder)
    setOrderOnly(!!options.orderOnly)
    setShowDetails(true)
  }

  const closeDetails = () => {
    setShowDetails(false)
    setSelectedCustomer(null)
    setAutoOpenOrder(false)
    setOrderOnly(false)
  }

  const filteredCustomers = customers.filter(c => 
    c.name.includes(searchTerm) || (c.phone && c.phone.includes(searchTerm))
  )

  const sortedCustomers = [...filteredCustomers].sort((a, b) =>
    a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' })
  )

  const getCustomerAccountStatus = async (customer) => {
    const ordersRequest = fetch(
      apiUrl(`/api/sales/by-customer?customer_id=${customer.id}`)
    )
    const paymentsRequest = fetch(
      apiUrl(`/api/payments/customer/${encodeURIComponent(customer.name)}?customer_id=${customer.id}`)
    )
    const returnedOrdersRequest = fetch(
      apiUrl(`/api/returned-orders/customer/${encodeURIComponent(customer.name)}?customer_id=${customer.id}`)
    )

    const [ordersRes, paymentsRes, returnedOrdersRes] = await Promise.all([
      ordersRequest,
      paymentsRequest,
      returnedOrdersRequest
    ])

    const [ordersJson, paymentsJson, returnedOrdersJson] = await Promise.all([
      ordersRes.json(),
      paymentsRes.json(),
      returnedOrdersRes.json()
    ])

    const orders = ordersJson?.success && Array.isArray(ordersJson.rows) ? ordersJson.rows : []
    const payments = paymentsJson?.success && Array.isArray(paymentsJson.rows) ? paymentsJson.rows : []
    const returnedOrders = returnedOrdersJson?.success && Array.isArray(returnedOrdersJson.rows) ? returnedOrdersJson.rows : []

    const orderTotal = orders.reduce(
      (sum, order) => sum + (parseFloat(order.quantity) || 0) * (parseFloat(order.price) || 0),
      0
    )
    const orderPaid = orders.reduce((sum, order) => sum + (parseFloat(order.paid) || 0), 0)
    const paymentsTotal = payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0)
    const returnedTotal = returnedOrders.reduce(
      (sum, returnedOrder) => sum + (parseFloat(returnedOrder.quantity) || 0) * (parseFloat(returnedOrder.price) || 0),
      0
    )

    const remaining = orderTotal - returnedTotal - orderPaid - paymentsTotal
    const hasTransactions = orders.length > 0 || payments.length > 0 || returnedOrders.length > 0

    if (!hasTransactions) {
      return { status: 'لا توجد معاملات', code: 0, amount: 0 }
    }

    if (remaining > 0) {
      return { status: 'يوجد باقي', code: 1, amount: remaining }
    }

    if (remaining < 0) {
      return { status: 'له مبلغ', code: 2, amount: Math.abs(remaining) }
    }

    return { status: 'مسدد بالكامل', code: 3, amount: 0 }
  }

  const handleExportPdf = async () => {
    if (!customers.length) {
      addNotification('لا توجد بيانات عملاء للتصدير', 'warning')
      return
    }

    setIsGeneratingPdf(true)
    try {
      const customersToExport = [...customers].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' })
      )

      const customersWithStatus = await Promise.all(
        customersToExport.map(async (customer) => {
          const accountStatus = await getCustomerAccountStatus(customer)
          return { ...customer, accountStatus }
        })
      )

      const today = new Date().toLocaleDateString('ar-EG')
      const fileName = `قائمة العملاء - ${new Date().toISOString().split('T')[0]}`
      const printableRows = customersWithStatus
        .map((customer, index) => {
          const statusText = customer.accountStatus.status
          const amountText = formatNumber(customer.accountStatus.amount || 0)
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${customer.name || '-'}</td>
              <td>${statusText} - ${amountText}</td>
            </tr>
          `
        })
        .join('')

      const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
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
            tbody tr:nth-child(even) { background-color: #f9f9f9; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              thead { display: table-header-group; }
            }
          </style>
        </head>
        <body>
          <div class="print-title">
            <h1>${appName || 'M.G FASHION FABRIC'}</h1>
            <h2>تقرير العملاء</h2>
          </div>
          <div class="print-info">
            <p><strong>تاريخ التقرير:</strong> ${today}</p>
            <p><strong>عدد العملاء:</strong> ${customersWithStatus.length}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم العميل</th>
                <th>حالة الحساب</th>
              </tr>
            </thead>
            <tbody>
              ${printableRows}
            </tbody>
          </table>
        </body>
        </html>
      `

      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('تعذر فتح نافذة الطباعة')
      }

      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 250)

      addNotification('تم تجهيز ملف PDF للطباعة بنجاح', 'success')
    } catch (error) {
      addNotification('حدث خطأ أثناء تجهيز ملف PDF', 'error')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
          <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>العملاء</h2>
          </div>
          
          {/* Color Legend */}
          <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-1 bg-red-500 rounded"></div>
                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الباقي عليه</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-1 bg-blue-500 rounded"></div>
                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>له باقي</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-1 bg-green-500 rounded"></div>
                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>المبلغ المسدد</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-4 py-3 bg-brown text-white rounded-lg font-semibold hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            {isGeneratingPdf ? 'جاري تجهيز PDF...' : 'تحميل PDF'}
          </button>
          <button
            onClick={() => openModal()}
            className={`px-6 py-3 rounded-lg font-semibold ${
              theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
            }`}
          >
            + إضافة عميل جديد
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {[
          { key: 'active', label: 'الحسابات النشطة' },
          { key: 'archived', label: 'الأرشيف' },
          { key: 'all', label: 'الكل' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setAccountStatus(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              accountStatus === tab.key
                ? (theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white')
                : (theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }`}
          >
            {tab.label}
            {tab.key === 'archived' && (
              <span className={`mr-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                accountStatus === 'archived'
                  ? (theme === 'dark' ? 'bg-black/20 text-black' : 'bg-white/25 text-white')
                  : (theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800')
              }`}>
                {archivedCount}
              </span>
            )}
          </button>
        ))}
        <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          الأرشفة بتشيل الحساب من القايمة النشطة بس، والمعاملات وكشف الحساب بيفضلوا زي ما هما.
        </span>
      </div>

      <div className="mb-4 relative">
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-3 pr-12 rounded-lg ${
            theme === 'dark' 
              ? 'bg-gray-900 border border-gray-700 text-white' 
              : 'bg-gray-100 border border-gray-300 text-gray-900'
          }`}
        />
      </div>


      <div className="overflow-x-auto">
        <table className={`w-full border ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
          <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}>
            <tr>
              <th className={`px-3 py-2 text-right border w-auto min-w-0 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>اسم العميل</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>رقم الهاتف</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>تاريخ الإضافة</th>
            </tr>
          </thead>
          <tbody>
            {sortedCustomers.map(customer => {
              const isArchived = Number(customer.is_active ?? 1) === 0
              return (
              <tr key={customer.id} className={`${theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}>
                <td className={`px-3 py-2 border align-middle ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`flex-1 min-w-0 break-words font-medium ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                      {customer.name}
                    </span>
                    <div className={`flex items-center gap-1 flex-shrink-0 rounded-lg p-1.5 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/5'}`}>
                      {!isArchived && (
                        <button onClick={() => openDetails(customer, { openOrder: true, orderOnly: true })} className="p-2 rounded-md text-camel hover:bg-camel/20 transition-colors" title="إضافة أوردر">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                      )}
                      <button onClick={() => openDetails(customer)} className="p-2 rounded-md text-green-600 hover:bg-green-500/20 transition-colors" title={isArchived ? 'كشف حساب الأرشيف' : 'رؤية التفاصيل'}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      {!isArchived && (
                        <button onClick={() => openModal(customer)} className="p-2 rounded-md text-blue-600 hover:bg-blue-500/20 transition-colors" title="تعديل">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" /></svg>
                        </button>
                      )}
                      {isArchived ? (
                        <button onClick={() => handleRestore(customer.id)} className="p-2 rounded-md text-emerald-600 hover:bg-emerald-500/20 transition-colors" title="استرجاع للحسابات النشطة">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                      ) : (
                        <button onClick={() => requestArchive(customer.id)} className="p-2 rounded-md text-amber-600 hover:bg-amber-500/20 transition-colors" title="أرشفة الحساب">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        </button>
                      )}
                      <button onClick={() => requestDelete(customer.id)} className="p-2 rounded-md text-red-600 hover:bg-red-500/20 transition-colors" title="حذف نهائي (للحساب اللي مفيهوش معاملات)">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" /></svg>
                      </button>
                    </div>
                  </div>
                </td>
                <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{customer.phone || '-'}</td>
                <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{customer.date || '-'}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-96 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              {editingId ? 'تعديل عميل' : 'إضافة عميل جديد'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>اسم العميل</label>
                <input type="text" placeholder="اسم العميل" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`} required />
                      </div>
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>رقم الهاتف (اختياري)</label>
                <input type="tel" placeholder="رقم الهاتف" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`} />
                    </div>
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>تاريخ الإضافة</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className={`flex-1 py-2 rounded font-semibold ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}>{editingId ? 'حفظ التعديلات' : 'إضافة'}</button>
                <button type="button" onClick={closeModal} className="flex-1 py-2 bg-gray-600 text-white rounded font-semibold">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={confirmMode === 'delete' ? 'تأكيد حذف بيانات العميل' : 'تأكيد أرشفة الحساب'}
        message={
          confirmMode === 'delete' ? (
            <div className="text-right">
              <p className="mb-2 font-semibold">
                العميل "{accountSummary?.customer?.name}" مفيهوش أي معاملة مسجّلة.
              </p>
              <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                هيتشال من قايمة العملاء نهائيًا. مفيش أي بيانات مالية هتتأثر.
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="mb-3 font-semibold">
                هيتنقل العميل "{accountSummary?.customer?.name}" للأرشيف.
              </p>
              {accountSummary?.totalRecords > 0 && (
                <>
                  <p className={`mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>المعاملات المحفوظة:</p>
                  <ul className={`list-disc list-inside space-y-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    {accountSummary.salesCount > 0 && <li>{accountSummary.salesCount} عملية بيع</li>}
                    {accountSummary.paymentsCount > 0 && <li>{accountSummary.paymentsCount} دفعة</li>}
                    {accountSummary.returnedOrdersCount > 0 && <li>{accountSummary.returnedOrdersCount} أوردر راجع</li>}
                  </ul>
                </>
              )}
              {Math.abs(accountSummary?.balance || 0) > 0.009 && (
                <p className="mt-3 font-bold text-red-500">
                  تنبيه: الحساب لسه {accountSummary.balanceLabel} بمبلغ {formatNumber(Math.abs(accountSummary.balance))} ج.م — الرصيد مش هيتغير.
                </p>
              )}
              <p className="mt-3 text-sm text-green-600 font-semibold">
                الأرشفة بتشيل الحساب من العملاء النشطين بس، وكل المبيعات والدفعات والمرتجعات وكشف الحساب والإحصائيات بتفضل زي ما هي.
              </p>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                تقدر ترجّعه في أي وقت من تبويب "الأرشيف".
              </p>
            </div>
          )
        }
        confirmText={confirmMode === 'delete' ? 'حذف نهائياً' : 'أرشفة الحساب'}
        cancelText="إلغاء"
        onConfirm={confirmMode === 'delete' ? handleDelete : handleArchive}
        onCancel={closeConfirm}
      />

      {showDetails && selectedCustomer && (
        <CustomerDetails
          customer={selectedCustomer}
          onClose={closeDetails}
          autoOpenOrder={autoOpenOrder}
          orderOnly={orderOnly}
        />
      )}
    </div>
  )
}

export default Customers

