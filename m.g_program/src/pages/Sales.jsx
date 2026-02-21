import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { exportSalesToExcel } from '../utils/exportExcel'
import ConfirmDialog from '../components/ConfirmDialog'
import { formatNumber, formatDateToDisplay, parseDisplayDateToISO } from '../utils/format'
import { apiUrl } from '../utils/api'
import SalesDetails from '../components/SalesDetails'

function Sales() {
  const { theme } = useTheme()
  const { addNotification } = useNotification()
  const location = useLocation()
  const [sales, setSales] = useState([])
  const [returnedOrders, setReturnedOrders] = useState([])
  const [paymentsTotalSum, setPaymentsTotalSum] = useState(0)
  const [customersBalance, setCustomersBalance] = useState({ remaining: 0, creditTotal: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [expandedCustomers, setExpandedCustomers] = useState(new Set())
  const [inventory, setInventory] = useState([])
  const [sections, setSections] = useState([])
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [formData, setFormData] = useState({
    customer_name: '',
    description: '',
    fromInventory: false,
    inventory_item_id: '',
    quantity: '',
    unit: 'متر',
    price: '',
    paid: '',
    date: new Date().toISOString().split('T')[0]
  })
  const [orderItems, setOrderItems] = useState([])
  const [currentItem, setCurrentItem] = useState({
    description: '',
    fromInventory: false,
    inventory_item_id: '',
    quantity: '',
    unit: 'متر',
    price: '',
    paid: ''
  })
  const [showInvoice, setShowInvoice] = useState(false)
  const [invoiceData, setInvoiceData] = useState(null)
  const [systemSettings, setSystemSettings] = useState({
    storeName: 'M.G Fabric Store',
    storeAddress: 'عنوان المتجر',
    storePhone: 'رقم الهاتف'
  })
  const [dateInputValue, setDateInputValue] = useState('')
  const { appName } = useTheme()

  useEffect(() => {
    setDateInputValue(formatDateToDisplay(formData.date))
  }, [formData.date])

  useEffect(() => {
    fetchSales()
    fetchReturnedOrders()
    fetchPayments()
    fetchCustomersBalance()
    fetchSections()
    fetchInventory()
    fetchSystemSettings()
  }, [])

  useEffect(() => {
    const handler = () => {
      fetchSales()
      fetchReturnedOrders()
      fetchPayments()
      fetchCustomersBalance()
    }
    window.addEventListener('updateStatistics', handler)
    return () => window.removeEventListener('updateStatistics', handler)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      const name = e?.detail?.customerName || ''
      setEditingId(null)
      setFormData(prev => ({
        ...prev,
        customer_name: name,
        description: '',
        fromInventory: false,
        inventory_item_id: '',
        quantity: '',
        unit: 'متر',
        price: '',
        paid: '',
        date: new Date().toISOString().split('T')[0]
      }))
      setShowModal(true)
    }
    window.addEventListener('navigateToSales', handler)
    return () => window.removeEventListener('navigateToSales', handler)
  }, [])

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch(apiUrl('/api/settings'))
      const data = await res.json()
      if (data) {
        setSystemSettings({
          storeName: data.app_name || appName || 'M.G Fabric Store',
          storeAddress: data.storeAddress || 'عنوان المتجر',
          storePhone: data.storePhone || 'رقم الهاتف'
        })
      }
    } catch (e) {
      console.error('خطأ في تحميل إعدادات النظام', e)
    }
  }

  useEffect(() => {
    const state = location?.state
    const selectedCustomer = sessionStorage.getItem('selectedCustomer')
    
    if (state && state.createForCustomer) {
      setEditingId(null)
      setFormData(prev => ({
        ...prev,
        customer_name: state.createForCustomer,
        description: '',
        fromInventory: false,
        inventory_item_id: '',
        quantity: '',
        unit: 'متر',
        price: '',
        paid: '',
        date: new Date().toISOString().split('T')[0]
      }))
      setShowModal(true)
    } else if (selectedCustomer) {
      // إذا كان هناك عميل محدد من sessionStorage
      setEditingId(null)
      setFormData(prev => ({
        ...prev,
        customer_name: selectedCustomer,
        description: '',
        fromInventory: false,
        inventory_item_id: '',
        quantity: '',
        unit: 'متر',
        price: '',
        paid: '',
        date: new Date().toISOString().split('T')[0]
      }))
      setShowModal(true)
      // مسح البيانات من sessionStorage بعد الاستخدام
      sessionStorage.removeItem('selectedCustomer')
    }
  }, [location?.state])

  useEffect(() => {
    if (formData.fromInventory && formData.inventory_item_id && inventory.length > 0) {
      const selectedItem = inventory.find(i => i.id == formData.inventory_item_id)
      if (selectedItem && selectedItem.unit) {
        setFormData(prev => ({ ...prev, unit: selectedItem.unit }))
      }
    }
  }, [formData.inventory_item_id, inventory, formData.fromInventory])

  useEffect(() => {
    if (currentItem.fromInventory && currentItem.inventory_item_id && inventory.length > 0) {
      const selectedItem = inventory.find(i => i.id == currentItem.inventory_item_id)
      if (selectedItem && selectedItem.unit) {
        setCurrentItem(prev => ({ ...prev, unit: selectedItem.unit }))
      }
    }
  }, [currentItem.inventory_item_id, inventory, currentItem.fromInventory])

  const fetchSales = async () => {
    try {
      const res = await fetch(apiUrl('/api/sales'))
      const data = await res.json()
      setSales(Array.isArray(data) ? data : [])
    } catch (e) {
      addNotification('خطأ في تحميل بيانات المبيعات', 'error')
    }
  }

  const fetchReturnedOrders = async () => {
    try {
      const res = await fetch(apiUrl('/api/returned-orders'))
      const json = await res.json()
      const rows = json?.success && Array.isArray(json.rows) ? json.rows : []
      setReturnedOrders(rows)
    } catch (e) {
      setReturnedOrders([])
    }
  }

  const fetchPayments = async () => {
    try {
      const res = await fetch(apiUrl('/api/payments'))
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      const sum = list.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      setPaymentsTotalSum(sum)
    } catch (e) {
      setPaymentsTotalSum(0)
    }
  }

  const fetchCustomersBalance = async () => {
    try {
      const res = await fetch(apiUrl('/api/customers-balance'))
      const data = await res.json()
      if (data?.success) {
        setCustomersBalance({
          remaining: data.remaining ?? 0,
          creditTotal: data.creditTotal ?? 0
        })
      }
    } catch (e) {
      setCustomersBalance({ remaining: 0, creditTotal: 0 })
    }
  }

  const fetchSections = async () => {
    try {
      const res = await fetch(apiUrl('/api/inventory/sections'))
      const data = await res.json()
      setSections(data || [])
    } catch (e) {
      console.error('خطأ في تحميل الأقسام', e)
    }
  }

  const fetchInventory = async () => {
    try {
      const res = await fetch(apiUrl('/api/inventory'))
      const data = await res.json()
      // استخدم فقط العناصر المرتبطة بأقسام المخزون
      setInventory((data || []).filter(i => i && i.section_id))
    } catch (e) {
      console.error('خطأ في تحميل المخزون', e)
    }
  }

  const openModal = (sale = null) => {
    if (sale) {
      setEditingId(sale.id)
      setFormData({
        customer_name: sale.customer_name || '',
        description: sale.description || '',
        fromInventory: !!sale.inventory_item_id,
        inventory_item_id: sale.inventory_item_id || '',
        quantity: sale.quantity,
        unit: sale.unit || 'متر',
        price: sale.price,
        paid: sale.paid,
        date: sale.date
      })
      
      // تحديد القسم المختار مسبقاً عند التعديل
      if (sale.inventory_item_id) {
        const selectedItem = inventory.find(i => i.id == sale.inventory_item_id)
        if (selectedItem && selectedItem.section_id) {
          setSelectedSectionId(selectedItem.section_id.toString())
        }
      }
      setOrderItems([])
      setCurrentItem({
        description: '',
        fromInventory: false,
        inventory_item_id: '',
        quantity: '',
        unit: 'متر',
        price: '',
        paid: ''
      })
    } else {
      setEditingId(null)
      setFormData({
        customer_name: '',
        description: '',
        fromInventory: false,
        inventory_item_id: '',
        quantity: '',
        unit: 'متر',
        price: '',
        paid: '',
        date: new Date().toISOString().split('T')[0]
      })
      setSelectedSectionId('')
      setOrderItems([])
      setCurrentItem({
        description: '',
        fromInventory: false,
        inventory_item_id: '',
        quantity: '',
        unit: 'متر',
        price: '',
        paid: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setSelectedSectionId('')
    setOrderItems([])
    setCurrentItem({
      description: '',
      fromInventory: false,
      inventory_item_id: '',
      quantity: '',
      unit: 'متر',
      price: '',
      paid: ''
    })
  }

  const openDetails = (sale) => {
    setSelectedSale(sale)
    setShowDetails(true)
  }

  const closeDetails = () => {
    setShowDetails(false)
    setSelectedSale(null)
  }

  const addItemToOrder = () => {
    if (!currentItem.description || !currentItem.quantity || !currentItem.price) {
      addNotification('يرجى ملء جميع الحقول المطلوبة', 'error')
      return
    }

    const quantity = parseFloat(currentItem.quantity) || 0
    const price = parseFloat(currentItem.price) || 0
    const total = quantity * price

    if (currentItem.fromInventory && currentItem.inventory_item_id) {
      const selectedItem = inventory.find(i => i.id == currentItem.inventory_item_id)
      if (!selectedItem || quantity > selectedItem.total_meters) {
        addNotification(`الكمية غير متوفرة في المخزون. المتاح: ${selectedItem?.total_meters || 0} ${selectedItem?.unit || 'متر'} فقط`, 'error')
        return
      }
    }

    const paid = parseFloat(currentItem.paid) || 0

    const newItem = {
      ...currentItem,
      quantity,
      price,
      total,
      paid,
      id: Date.now()
    }

    setOrderItems([...orderItems, newItem])
    setCurrentItem({
      description: '',
      fromInventory: false,
      inventory_item_id: '',
      quantity: '',
      unit: 'متر',
      price: '',
      paid: ''
    })
    setSelectedSectionId('')
  }

  const removeItemFromOrder = (itemId) => {
    setOrderItems(orderItems.filter(item => item.id !== itemId))
  }

  const getOrderTotal = () => {
    return orderItems.reduce((total, item) => total + (item.total || 0), 0)
  }

  const getOrderPaidTotal = () => {
    return orderItems.reduce((sum, item) => sum + (parseFloat(item.paid) || 0), 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('Sales handleSubmit called', formData)

    if (editingId) {
      // تعديل عملية بيع موجودة (الطريقة القديمة)
    const quantity = parseFloat(formData.quantity) || 0
    const price = parseFloat(formData.price) || 0
    const paid = parseFloat(formData.paid) || 0
    const total = quantity * price
      const remaining = total - paid

      if (formData.fromInventory && formData.inventory_item_id) {
      const oldSale = sales.find(s => s.id === editingId)
      const selectedItem = inventory.find(i => i.id == formData.inventory_item_id)
      
      const availableQuantity = (selectedItem?.total_meters || 0) + 
        (oldSale?.inventory_item_id === formData.inventory_item_id ? (oldSale?.quantity || 0) : 0)
      
      if (!selectedItem || quantity > availableQuantity) {
        addNotification(`الكمية غير متوفرة في المخزون. المتاح: ${availableQuantity.toFixed(2)} ${selectedItem?.unit || 'متر'} فقط`, 'error')
        return
      }
    }

    const payload = { ...formData, quantity, price, paid, total, remaining }
    console.log('Sales payload:', payload)

    try {
        const url = apiUrl(`/api/sales/${editingId}`)
      console.log('Sales URL:', url)
      const res = await fetch(url, {
          method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      console.log('Sales response:', res.status, res.ok)
      if (res.ok) {
          addNotification('تم تعديل عملية البيع', 'success')
        fetchSales()
        fetchInventory()
        window.dispatchEvent(new CustomEvent('updateStatistics'))
        closeModal()
      } else {
        addNotification('فشل الحفظ - كود الخطأ: ' + res.status, 'error')
      }
    } catch (e) {
      console.error('Sales error:', e)
      addNotification('حدث خطأ أثناء الحفظ: ' + e.message, 'error')
      }
    } else {
      // إضافة عمليات بيع جديدة (طريقة متعددة الأصناف)
      if (orderItems.length === 0) {
        addNotification('يرجى إضافة صنف واحد على الأقل', 'error')
        return
      }

      const paidAsTotal = parseFloat(formData.paid) || 0
      const n = orderItems.length

      try {
        // إذا وُجد مبلغ في "المبلغ المدفوع" يُوزَّع على الأصناف. وإلا نستخدم مسدد كل صنف على حدة.
        const paidPerItem = paidAsTotal > 0 ? paidAsTotal / n : 0

        const promises = orderItems.map(async (item, i) => {
          const itemPaid = paidAsTotal > 0
            ? (i === n - 1 ? paidAsTotal - paidPerItem * (n - 1) : paidPerItem)
            : (parseFloat(item.paid) || 0)
          const itemRemaining = (item.total || 0) - itemPaid

          const payload = {
            customer_name: formData.customer_name,
            description: item.description,
            fromInventory: item.fromInventory,
            inventory_item_id: item.inventory_item_id || null,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            paid: itemPaid,
            total: item.total,
            remaining: itemRemaining,
            date: formData.date
          }
          
          const res = await fetch(apiUrl('/api/sales'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          
          if (!res.ok) {
            throw new Error(`فشل في حفظ الصنف: ${item.description}`)
          }
          
          return res.json()
        })

        await Promise.all(promises)

        addNotification(`تم إضافة ${orderItems.length} عملية بيع`, 'success')
        fetchSales()
        fetchInventory()
        window.dispatchEvent(new CustomEvent('updateStatistics'))
        closeModal()
      } catch (e) {
        console.error('Sales error:', e)
        addNotification('حدث خطأ أثناء الحفظ: ' + e.message, 'error')
      }
    }
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const requestDelete = (id) => { setPendingDeleteId(id); setConfirmOpen(true) }
  const handleDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await fetch(apiUrl(`/api/sales/${pendingDeleteId}`), { method: 'DELETE' })
      addNotification('تم الحذف', 'info')
      fetchSales()
      window.dispatchEvent(new CustomEvent('updateStatistics'))
    } catch (e) {
      addNotification('فشل الحذف', 'error')
    } finally {
      setConfirmOpen(false)
      setPendingDeleteId(null)
    }
  }

  const filtered = sales.filter(s =>
    (s.customer_name || '').includes(searchTerm) || (s.date || '').includes(searchTerm)
  )

  // Group sales by customer name and sort by date (newest first)
  const groupedSales = filtered.reduce((acc, sale) => {
    const customerName = sale.customer_name
    if (!acc[customerName]) {
      acc[customerName] = []
    }
    acc[customerName].push(sale)
    return acc
  }, {})

  // Sort each customer's sales by date (newest first)
  Object.keys(groupedSales).forEach(customerName => {
    groupedSales[customerName].sort((a, b) => new Date(b.date) - new Date(a.date))
  })

  // Toggle customer expansion
  const toggleCustomerExpansion = (customerName) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(customerName)) {
      newExpanded.delete(customerName)
    } else {
      newExpanded.add(customerName)
    }
    setExpandedCustomers(newExpanded)
  }

  const grossTotals = sales.reduce((acc, s) => {
    const unitCost = s.unit_cost || 0
    const quantity = s.quantity || 0
    const itemCost = unitCost * quantity
    const itemProfit = (s.total || 0) - itemCost
    const hasNoCost = unitCost === 0 && s.inventory_item_id
    
    return {
      total: acc.total + (s.total || 0),
      cost: acc.cost + itemCost,
      profit: acc.profit + itemProfit,
      paid: acc.paid + (s.paid || 0),
      remaining: acc.remaining + (s.remaining || 0),
      itemsWithoutCost: acc.itemsWithoutCost + (hasNoCost ? 1 : 0)
    }
  }, { total: 0, cost: 0, profit: 0, paid: 0, remaining: 0, itemsWithoutCost: 0 })

  const returnedTotal = returnedOrders.reduce((s, r) => s + (r.quantity || 0) * (r.price || 0), 0)
  const netTotal = Math.max(0, grossTotals.total - returnedTotal)
  const costOfReturned = grossTotals.total > 0 ? returnedTotal * (grossTotals.cost / grossTotals.total) : 0
  const netCost = Math.max(0, grossTotals.cost - costOfReturned)
  // إجمالي المسدّد = مدفوعات الأوردرات + الدفعات المسجّلة في جدول الدفعات (كشف الحساب)
  const totalPaidIncludingPaymentsTable = grossTotals.paid + (paymentsTotalSum || 0)
  const totals = {
    ...grossTotals,
    total: netTotal,
    cost: netCost,
    profit: netTotal - netCost,
    paid: totalPaidIncludingPaymentsTable,
    remaining: netTotal - totalPaidIncludingPaymentsTable,
    returnedTotal,
    returnedCount: returnedOrders.length
  }

  const handleExport = () => {
    if (exportSalesToExcel(sales)) {
      addNotification('تم تصدير المبيعات إلى Excel', 'success')
    } else {
      addNotification('فشل التصدير', 'error')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
          <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 15l3-3 4 4 6-6" />
          </svg>
          <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>المبيعات</h2>
          </div>
          
          {/* Color Legend */}
          <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-1 bg-red-500 rounded"></div>
                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  الباقي عليه
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-1 bg-blue-500 rounded"></div>
                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  له باقي
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-1 bg-green-500 rounded"></div>
                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  المبلغ المسدد
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-3 bg-brown text-white rounded-lg font-semibold hover:brightness-110 transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            تصدير Excel
          </button>
          <button
            onClick={() => openModal()}
            className={`px-6 py-3 rounded-lg font-semibold ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}
          >
            + إضافة عملية بيع
          </button>
        </div>
      </div>

      <div className="mb-4 relative">
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="بحث بالاسم أو التاريخ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-3 pr-12 rounded-lg ${
            theme === 'dark' 
              ? 'bg-gray-900 border border-gray-700 text-white' 
              : 'bg-gray-100 border border-gray-300 text-gray-900'
          }`}
        />
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-4`}>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-500">إجمالي المبيعات</p>
          <p className="text-xs text-gray-400 mt-0.5">جملة كل الأوردرات (قبل أي خصم)</p>
          <p className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>{formatNumber(grossTotals.total)} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'} border ${totals.returnedCount > 0 ? (theme === 'dark' ? 'border-amber-600/50' : 'border-amber-400') : 'border-transparent'}`}>
          <p className="text-sm text-gray-500">إجمالي الأوردرات الراجعة</p>
          <p className="text-xs text-gray-400 mt-0.5">من كشوف حسابات العملاء</p>
          <p className={`text-2xl font-bold mt-1 ${totals.returnedCount > 0 ? 'text-amber-600' : (theme === 'dark' ? 'text-gray-500' : 'text-gray-600')}`}>
            {formatNumber(totals.returnedTotal)} ج.م
          </p>
          <p className="text-xs mt-1 text-gray-500">({totals.returnedCount} أوردر)</p>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-500">صافي المبيعات</p>
          <p className="text-xs text-gray-400 mt-0.5">إجمالي − مرتجعات</p>
          <p className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>{formatNumber(totals.total)} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm text-gray-500">التكلفة</p>
          </div>
          <p className="text-2xl font-bold text-orange-500">{formatNumber(totals.cost || 0)} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <p className="text-sm text-gray-500">الربح</p>
          </div>
          <p className="text-2xl font-bold text-blue-500">{formatNumber(totals.profit || 0)} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-500">المسدّد</p>
          <p className="text-2xl font-bold text-green-500">{formatNumber(totals.paid)} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-500">
            {customersBalance.remaining > 0 ? 'الباقي' : customersBalance.creditTotal > 0 ? 'له مبلغ' : 'الباقي'}
          </p>
          <p className={`text-2xl font-bold ${
            customersBalance.remaining > 0 ? 'text-red-500' : customersBalance.creditTotal > 0 ? 'text-blue-500' : (theme === 'dark' ? 'text-gray-500' : 'text-gray-600')
          }`}>
            {formatNumber(customersBalance.remaining > 0 ? customersBalance.remaining : customersBalance.creditTotal)} ج.م
          </p>
        </div>
      </div>
      {totals.returnedCount > 0 && (
        <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          <span className="text-amber-600 font-medium">ملاحظة:</span> المرتجعات مسجّلة في كشوف حسابات العملاء. صافي المبيعات = إجمالي المبيعات − المرتجعات (ملخص إجمالي فقط، وليس خصماً من كل أوردر في الجدول على حدة).
        </p>
      )}

      {totals.itemsWithoutCost > 0 && (
        <div className={`mb-4 p-4 rounded-lg border-2 ${
          theme === 'dark' 
            ? 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300' 
            : 'bg-yellow-50 border-yellow-300 text-yellow-800'
        }`}>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold mb-1">تنبيه: عمليات بدون تكلفة محددة</p>
              <p className="text-sm">
                يوجد <strong>{totals.itemsWithoutCost}</strong> عملية بيع من المخزون بدون تكلفة محددة. 
                لحساب الربح بدقة، يجب تحديد سعر التكلفة لهذه الأصناف في المخزون.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={`w-full table-fixed border ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
          <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}>
            <tr>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>العميل</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>البيان</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الكمية</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>السعر</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الإجمالي</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>المسدّد</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الرصيد</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>التاريخ</th>
              <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedSales).map(([customerName, customerSales]) => {
              const isExpanded = expandedCustomers.has(customerName)
              const hasMultipleOrders = customerSales.length > 1
              
              // Calculate totals for this customer
              const customerTotals = customerSales.reduce((acc, sale) => ({
                total: acc.total + (sale.total || 0),
                paid: acc.paid + (sale.paid || 0),
                remaining: acc.remaining + (sale.remaining || 0)
              }), { total: 0, paid: 0, remaining: 0 })
              
              return (
                <React.Fragment key={customerName}>
                  {/* Latest order row (first order) */}
                  <tr 
                    className={`${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'} ${hasMultipleOrders ? 'cursor-pointer hover:' + (theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100') : ''}`}
                    onClick={() => hasMultipleOrders && toggleCustomerExpansion(customerName)}
                  >
                    <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{customerName}</span>
                        {hasMultipleOrders && (
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
                          }`}>
                            {customerSales.length}
                          </span>
                        )}
                        {hasMultipleOrders && (
                          <svg 
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                      {customerSales[0].description}
                    </td>
                    <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                      {customerSales[0].quantity} {customerSales[0].unit || 'متر'}
                    </td>
                    <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                      {customerSales[0].price}
                    </td>
                    <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                      {formatNumber(customerSales[0].total)}
                    </td>
                    <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800 text-green-400' : 'border-gray-300 text-green-600'}`}>
                      {formatNumber(customerSales[0].paid)}
                    </td>
                    <td className={`px-3 py-2 text-center border ${(customerSales[0].remaining || 0) < 0 ? (theme === 'dark' ? 'border-gray-800 text-blue-400' : 'border-gray-300 text-blue-600') : (theme === 'dark' ? 'border-gray-800 text-red-400' : 'border-gray-300 text-red-600')}`}>
                      {formatNumber(Math.abs(customerSales[0].remaining || 0))}
                    </td>
                    <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                      {customerSales[0].date}
                    </td>
                    <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); openDetails(customerSales[0]) }} className="p-2 rounded text-green-500 hover:text-green-600" title="رؤية التفاصيل">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openModal(customerSales[0]) }} className="p-2 rounded text-blue-500 hover:text-blue-600" title="تعديل">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" />
                          </svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); requestDelete(customerSales[0].id) }} className="p-2 rounded text-red-500 hover:text-red-600" title="حذف">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded individual orders (skip the first one as it's shown in main row) */}
                  {isExpanded && hasMultipleOrders && customerSales.slice(1).map((sale) => (
                    <tr key={`${customerName}-${sale.id}`} className={`${theme === 'dark' ? 'bg-gray-900/30' : 'bg-gray-25'}`}>
                      <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                        {/* Empty cell for customer name column */}
                      </td>
                      <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'} pl-8`}>
                        <span className="text-sm text-gray-500">• {sale.description || 'بدون وصف'}</span>
                      </td>
                      <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                        {sale.quantity} {sale.unit || 'متر'}
                      </td>
                      <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                        {sale.price}
                      </td>
                      <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                        {formatNumber(sale.total || 0)}
                      </td>
                      <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800 text-green-400' : 'border-gray-300 text-green-600'}`}>
                        {formatNumber(sale.paid || 0)}
                      </td>
                      <td className={`px-3 py-2 text-center border ${(sale.remaining || 0) < 0 ? (theme === 'dark' ? 'border-gray-800 text-blue-400' : 'border-gray-300 text-blue-600') : (theme === 'dark' ? 'border-gray-800 text-red-400' : 'border-gray-300 text-red-600')}`}>
                        {formatNumber(Math.abs(sale.remaining || 0))}
                      </td>
                      <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                        {sale.date}
                      </td>
                <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                          <button onClick={() => openDetails(sale)} className="p-2 rounded text-green-500 hover:text-green-600" title="رؤية التفاصيل">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                    <button onClick={() => openModal(sale)} className="p-2 rounded text-blue-500 hover:text-blue-600" title="تعديل">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" />
                      </svg>
                    </button>
                          <button onClick={() => requestDelete(sale.id)} className="p-2 rounded text-red-500 hover:text-red-600" title="حذف">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-[45vw] max-w-2xl max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              {editingId ? 'تعديل عملية بيع' : 'إضافة عملية بيع'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* معلومات العميل */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>اسم العميل</label>
                  <input
                    type="text"
                    placeholder="اسم العميل"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>التاريخ</label>
                  <input
                    type="text"
                    dir="rtl"
                    inputMode="numeric"
                    placeholder="2026/1/29"
                    value={dateInputValue}
                    onChange={(e) => {
                      setDateInputValue(e.target.value)
                      const iso = parseDisplayDateToISO(e.target.value)
                      if (iso) setFormData((prev) => ({ ...prev, date: iso }))
                      else if (e.target.value === '') setFormData((prev) => ({ ...prev, date: '' }))
                    }}
                    onBlur={() => setDateInputValue(formatDateToDisplay(formData.date))}
                    className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                    required
                  />
                </div>
              </div>

              {/* إجماليات الطلب - تظهر فقط عند إضافة أصناف */}
              {!editingId && orderItems.length > 0 && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <h4 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>إجماليات الطلب</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">إجمالي الطلب</p>
                      <p className={`text-xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                        {formatNumber(getOrderTotal())} ج.م
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">المدفوع</p>
                      <p className="text-xl font-bold text-green-500">
                        {formatNumber(parseFloat(formData.paid) || 0)} ج.م
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">
                        {getOrderTotal() - (parseFloat(formData.paid) || 0) < 0 ? 'له مبلغ' : 'الباقي'}
                      </p>
                      <p className={`text-xl font-bold ${
                        getOrderTotal() - (parseFloat(formData.paid) || 0) < 0 ? 'text-blue-500' : 'text-red-500'
                      }`}>
                        {formatNumber(Math.abs(getOrderTotal() - (parseFloat(formData.paid) || 0)))} ج.م
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {editingId ? (
                // تعديل عملية بيع موجودة (الطريقة القديمة)
                <>
              {(() => {
                const q = parseFloat(formData.quantity) || 0
                const p = parseFloat(formData.price) || 0
                const paid = parseFloat(formData.paid) || 0
                const total = q * p
                const remaining = total - paid
                return (
                  <div className={`grid grid-cols-2 gap-2 mb-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className={`p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <span>الإجمالي</span>
                        <span className="font-bold">{Number(total.toFixed(2))} ج.م</span>
                      </div>
                    </div>
                    <div className={`p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <span>{remaining < 0 ? 'له مبلغ' : 'الباقي'}</span>
                        <span className={`font-bold ${remaining < 0 ? 'text-blue-500' : 'text-red-500'}`}>
                          {Number(Math.abs(remaining).toFixed(2))} ج.م
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الوصف</label>
              <input
                type="text"
                placeholder="الوصف"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
              />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fromInventory"
                  checked={formData.fromInventory}
                  onChange={(e) => setFormData({ ...formData, fromInventory: e.target.checked, inventory_item_id: '', quantity: '' })}
                  className="w-4 h-4"
                />
                <label htmlFor="fromInventory" className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  من المخزون
                </label>
              </div>
              {formData.fromInventory && (
                <>
                  <div>
                    <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>اختر القسم</label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => { setSelectedSectionId(e.target.value); setFormData({ ...formData, inventory_item_id: '', quantity: '' }) }}
                      className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                      required={formData.fromInventory}
                    >
                      <option value="">اختر القسم</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedSectionId && (
                  <div>
                    <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>اختر المنتج</label>
                  <select
                    value={formData.inventory_item_id}
                    onChange={(e) => setFormData({ ...formData, inventory_item_id: e.target.value, quantity: '' })}
                    className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                    required={formData.fromInventory}
                  >
                      <option value="">اختر المنتج من القسم</option>
                      {inventory.filter(i => String(i.section_id) === String(selectedSectionId)).map(item => (
                      <option key={item.id} value={item.id}>
                          {item.item_name || item.color_number} {item.color_number && item.item_name ? `- رقم ${item.color_number}` : ''} (متاح: {item.total_meters} {item.unit || 'متر'})
                      </option>
                    ))}
                  </select>
                  </div>
                  )}
                  {formData.inventory_item_id && (() => {
                    const selectedItem = inventory.find(i => i.id == formData.inventory_item_id)
                    const requestedQty = parseFloat(formData.quantity) || 0
                    const hasQuantity = formData.quantity && parseFloat(formData.quantity) > 0
                    const isAvailable = selectedItem && hasQuantity && requestedQty <= selectedItem.total_meters
                    const isInsufficient = selectedItem && hasQuantity && requestedQty > selectedItem.total_meters
                    
                    return (
                      <>
                        {!hasQuantity ? (
                          <div className={`p-2 rounded text-sm ${selectedItem && selectedItem.total_meters > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                            {selectedItem && selectedItem.total_meters > 0 
                              ? `المتاح: ${selectedItem.total_meters} ${selectedItem.unit || 'متر'} - أدخل الكمية المطلوبة`
                              : ` هذا المنتج غير متاح حالياً`
                            }
                          </div>
                        ) : isAvailable ? (
                          <div className="p-2 rounded text-sm bg-green-100 text-green-700">
                            ✓ الكمية متاحة
                          </div>
                        ) : (
                          <div className="p-2 rounded text-sm bg-red-100 text-red-700">
                             الكمية غير متوفرة - المتاح فقط: {selectedItem?.total_meters} {selectedItem?.unit || 'متر'}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الكمية والوحدة</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="الكمية"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                  required
                />
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  disabled={formData.fromInventory && formData.inventory_item_id}
                  className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} ${formData.fromInventory && formData.inventory_item_id ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="متر">متر</option>
                    <option value="كيلو">كيلو</option>
                </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>السعر (بالمتر)</label>
              <input
                type="number"
                step="0.01"
                placeholder="السعر"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                required
              />
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>المسدّد</label>
              <input
                type="number"
                step="0.01"
                placeholder="المسدّد"
                value={formData.paid}
                onChange={(e) => setFormData({ ...formData, paid: e.target.value })}
                className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                required
              />
              </div>
                </>
              ) : (
                // إضافة أصناف متعددة (الطريقة الجديدة)
                <>
                  {/* إضافة صنف جديد */}
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <h4 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>إضافة صنف جديد</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                        <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الوصف</label>
              <input
                          type="text"
                          placeholder="وصف الصنف"
                          value={currentItem.description}
                          onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                          className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="currentFromInventory"
                          checked={currentItem.fromInventory}
                          onChange={(e) => setCurrentItem({ ...currentItem, fromInventory: e.target.checked, inventory_item_id: '', quantity: '' })}
                          className="w-4 h-4"
                        />
                        <label htmlFor="currentFromInventory" className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                          من المخزون
                        </label>
                      </div>
                    </div>

                    {currentItem.fromInventory && (
                      <>
                        <div className="mt-3">
                          <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>اختر القسم</label>
                          <select
                            value={selectedSectionId}
                            onChange={(e) => { setSelectedSectionId(e.target.value); setCurrentItem({ ...currentItem, inventory_item_id: '', quantity: '' }) }}
                            className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                            required={currentItem.fromInventory}
                          >
                            <option value="">اختر القسم</option>
                            {sections.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        {selectedSectionId && (
                        <div className="mt-3">
                          <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>اختر المنتج</label>
                        <select
                          value={currentItem.inventory_item_id}
                          onChange={(e) => setCurrentItem({ ...currentItem, inventory_item_id: e.target.value, quantity: '' })}
                          className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                          required={currentItem.fromInventory}
                        >
                            <option value="">اختر المنتج من القسم</option>
                            {inventory.filter(i => String(i.section_id) === String(selectedSectionId)).map(item => (
                            <option key={item.id} value={item.id}>
                                {item.item_name || item.color_number} {item.color_number && item.item_name ? `- رقم ${item.color_number}` : ''} (متاح: {item.total_meters} {item.unit || 'متر'})
                            </option>
                          ))}
                        </select>
                        </div>
                        )}
                        {currentItem.inventory_item_id && (() => {
                          const selectedItem = inventory.find(i => i.id == currentItem.inventory_item_id)
                          const requestedQty = parseFloat(currentItem.quantity) || 0
                          const hasQuantity = currentItem.quantity && parseFloat(currentItem.quantity) > 0
                          const isAvailable = selectedItem && hasQuantity && requestedQty <= selectedItem.total_meters
                          
                          return (
                            <>
                              {!hasQuantity ? (
                                <div className={`p-2 rounded text-sm mt-2 ${selectedItem && selectedItem.total_meters > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                  {selectedItem && selectedItem.total_meters > 0 
                                    ? `المتاح: ${selectedItem.total_meters} ${selectedItem.unit || 'متر'} - أدخل الكمية المطلوبة`
                                    : ` هذا المنتج غير متاح حالياً`
                                  }
                                </div>
                              ) : isAvailable ? (
                                <div className="p-2 rounded text-sm mt-2 bg-green-100 text-green-700">
                                  ✓ الكمية متاحة
                                </div>
                              ) : (
                                <div className="p-2 rounded text-sm mt-2 bg-red-100 text-red-700">
                                   الكمية غير متوفرة - المتاح فقط: {selectedItem?.total_meters} {selectedItem?.unit || 'متر'}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                      <div>
                        <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الكمية</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="الكمية"
                          value={currentItem.quantity}
                          onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                          className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الوحدة</label>
                        <select
                          value={currentItem.unit}
                          onChange={(e) => setCurrentItem({ ...currentItem, unit: e.target.value })}
                          disabled={currentItem.fromInventory && currentItem.inventory_item_id}
                          className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} ${currentItem.fromInventory && currentItem.inventory_item_id ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="متر">متر</option>
                          <option value="كيلو">كيلو</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>السعر</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="السعر"
                          value={currentItem.price}
                          onChange={(e) => setCurrentItem({ ...currentItem, price: e.target.value })}
                          className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>المسدد (للصنف)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="المبلغ المسدد لهذا الصنف"
                          value={currentItem.paid}
                          onChange={(e) => setCurrentItem({ ...currentItem, paid: e.target.value })}
                          className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addItemToOrder}
                      className={`w-full mt-4 py-2 rounded font-semibold ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}
                    >
                      + إضافة الصنف للطلب
                    </button>
                  </div>

                  {/* قائمة الأصناف المضافة */}
                  {orderItems.length > 0 && (
                    <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`text-lg font-semibold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>أصناف الطلب ({orderItems.length})</h4>
                        <button 
                          type="button" 
                          onClick={() => {
                            const tot = getOrderTotal()
                            const p = (parseFloat(formData.paid) || 0) > 0 ? (parseFloat(formData.paid) || 0) : getOrderPaidTotal()
                            setInvoiceData({
                              customerName: formData.customer_name,
                              date: formData.date,
                              items: orderItems,
                              total: tot,
                              paid: p,
                              remaining: tot - p
                            })
                            setShowInvoice(true)
                          }}
                          className={`px-3 py-1 text-sm rounded font-semibold ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}
                        >
                          طباعة الفاتورة
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        {orderItems.map((item, index) => (
                          <div key={item.id} className={`p-3 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-semibold">{item.description}</div>
                                <div className="text-sm text-gray-500">
                                  {item.quantity} {item.unit} × {item.price} ج.م = {formatNumber(item.total)} ج.م
                                  {(parseFloat(item.paid) || 0) > 0 && (
                                    <span className={`mr-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}> | مسدد: {formatNumber(item.paid)} ج.م</span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItemFromOrder(item.id)}
                                className="p-1 text-red-500 hover:text-red-700"
                                title="حذف الصنف"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* إجمالي الطلب */}
                      <div className={`mt-4 p-3 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                        <div className="flex items-center justify-between text-lg font-bold">
                          <span>إجمالي الطلب:</span>
                          <span className={`${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                            {formatNumber(getOrderTotal())} ج.م
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* المبلغ المدفوع: إما إجمالي يُوزَّع على الأصناف، أو اتركه فارغاً واستخدم مسدد كل صنف */}
                  <div>
                    <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>المبلغ المدفوع (إجمالي — يُوزَّع على الأصناف)</label>
                    <p className={`text-[11px] mb-1 opacity-75 ${theme === 'dark' ? 'text-amber-200/70' : 'text-amber-800/70'}`}>
                      املأ هنا ليُقسَم على عدد الأصناف. أو اتركه فارغاً واستخدم «المسدد» في كل صنف عند الإضافة.
                    </p>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="المبلغ الإجمالي المسدد (يُوزَّع)"
                      value={formData.paid}
                      onChange={(e) => setFormData({ ...formData, paid: e.target.value })}
                      className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                    />
                    {orderItems.length > 0 && (() => {
                      const totalPaid = (parseFloat(formData.paid) || 0) > 0 ? (parseFloat(formData.paid) || 0) : getOrderPaidTotal()
                      const remaining = getOrderTotal() - totalPaid
                      return (
                        <div className={`mt-2 p-2 rounded text-sm ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                          <div className="flex justify-between">
                            <span>الباقي:</span>
                            <span className={`font-bold ${remaining < 0 ? 'text-blue-500' : 'text-red-500'}`}>
                              {formatNumber(Math.abs(remaining))} ج.م
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button type="submit" className={`flex-1 py-2 rounded font-semibold ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}>
                  {editingId ? 'حفظ التعديلات' : 'حفظ الطلب'}
                </button>
                {!editingId && (
                  <button 
                    type="button" 
                    onClick={() => {
                      if (orderItems.length === 0) {
                        // إذا لم تكن هناك أصناف، استخدم البيانات المملوءة في النموذج
                        if (!formData.customer_name || !formData.description || !formData.quantity || !formData.price) {
                          addNotification('يرجى ملء جميع البيانات المطلوبة قبل الطباعة', 'error')
                          return
                        }
                        
                        const quantity = parseFloat(formData.quantity) || 0
                        const price = parseFloat(formData.price) || 0
                        const total = quantity * price
                        const paid = parseFloat(formData.paid) || 0
                        const remaining = total - paid
                        
                        setInvoiceData({
                          customerName: formData.customer_name,
                          date: formData.date,
                          items: [{
                            description: formData.description,
                            quantity: quantity,
                            unit: formData.unit || 'متر',
                            price: price,
                            total: total
                          }],
                          total: total,
                          paid: paid,
                          remaining: remaining
                        })
                      } else {
                        // إذا كانت هناك أصناف، استخدم الأصناف المضافة
                        const tot = getOrderTotal()
                        const p = (parseFloat(formData.paid) || 0) > 0 ? (parseFloat(formData.paid) || 0) : getOrderPaidTotal()
                        setInvoiceData({
                          customerName: formData.customer_name,
                          date: formData.date,
                          items: orderItems,
                          total: tot,
                          paid: p,
                          remaining: tot - p
                        })
                      }
                      setShowInvoice(true)
                    }}
                    className={`px-4 py-2 rounded font-semibold ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}
                  >
                    طباعة الفاتورة
                  </button>
                )}
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-600 text-white rounded font-semibold">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع."
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      {showDetails && selectedSale && (
        <SalesDetails
          sale={selectedSale}
          onClose={closeDetails}
        />
      )}

      {/* صفحة الفاتورة */}
      {showInvoice && invoiceData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print-hide">
          <div className="bg-white p-0 w-[300px] max-h-[90vh] overflow-y-auto print-invoice">
            <div className="p-4 text-center">
              {/* عنوان المتجر */}
              <h1 className="text-lg font-bold text-brown mb-4">{systemSettings.storeName}</h1>
              
              {/* خط فاصل */}
              <div className="border-t border-gray-300 mb-4"></div>
              
              {/* تفاصيل الفاتورة */}
              <div className="text-right mb-4">
                <p className="text-sm font-semibold mb-1">فاتورة بيع</p>
                <p className="text-xs text-gray-600">التاريخ: {invoiceData.date}</p>
                <p className="text-xs text-gray-600">العميل: {invoiceData.customerName}</p>
              </div>
              
              {/* خط فاصل */}
              <div className="border-t border-gray-300 mb-3"></div>
              
              {/* قائمة الأصناف */}
              <div className="space-y-2 mb-4">
                {invoiceData.items.map((item, index) => (
                  <div key={index} className="text-right">
                    <div className="text-sm font-medium">{item.description}</div>
                    <div className="text-xs text-gray-600">
                      {item.quantity} {item.unit} × {item.price} ج.م = {formatNumber(item.total)} ج.م
                    </div>
                  </div>
                ))}
              </div>
              
              {/* خط فاصل */}
              <div className="border-t border-gray-300 mb-3"></div>
              
              {/* الإجماليات */}
              <div className="space-y-1 mb-4">
                <div className="flex justify-between text-sm">
                  <span>الإجمالي:</span>
                  <span className="font-bold">{formatNumber(invoiceData.total)} ج.م</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>المدفوع:</span>
                  <span className="font-bold text-green-600">{formatNumber(invoiceData.paid)} ج.م</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{invoiceData.remaining < 0 ? 'له مبلغ:' : 'الباقي:'}</span>
                  <span className={`font-bold ${invoiceData.remaining < 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatNumber(Math.abs(invoiceData.remaining))} ج.م
                  </span>
                </div>
              </div>
              
              {/* خط فاصل */}
              <div className="border-t border-gray-300 mb-4"></div>
              
              {/* آية قرآنية */}
              <div className="text-center mb-4">
                <p className="text-xs text-gray-700 leading-relaxed">
                  "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ"
                </p>
                <p className="text-xs text-gray-600 mt-1">سورة الطلاق - الآية 2-3</p>
              </div>
              
              {/* شكر */}
              <div className="text-center">
                <p className="text-sm font-medium text-brown">أهلاً وسهلاً بك</p>
                <p className="text-xs text-gray-600 mt-1">نتمنى لكم تجربة تسوق ممتعة</p>
              </div>
            </div>
            
            {/* أزرار التحكم */}
            <div className="p-4 bg-gray-50 border-t print-hide">
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className={`flex-1 py-2 px-4 rounded font-semibold text-white ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}
                >
                  طباعة
                </button>
                <button
                  onClick={() => setShowInvoice(false)}
                  className="flex-1 py-2 px-4 bg-gray-600 text-white rounded font-semibold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sales


