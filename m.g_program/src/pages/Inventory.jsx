import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { exportInventoryToExcel } from '../utils/exportExcel'
import { formatNumber } from '../utils/format'
import InventoryDetails from '../components/InventoryDetails'

function Inventory() {
  const { theme } = useTheme()
  const { addNotification, removeNotification } = useNotification()
  const [sections, setSections] = useState([])
  const [inventory, setInventory] = useState([])
  const [selectedSection, setSelectedSection] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('sections') // 'sections' or 'items'
  const [showModal, setShowModal] = useState(false)
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [notificationThreshold, setNotificationThreshold] = useState(0)
  const [formData, setFormData] = useState({
    item_name: '',
    section_id: '',
    color_number: '',
    rolls_count: '',
    total_meters: '',
    unit: 'متر',
    purchase_price: ''
  })
  const [sectionFormData, setSectionFormData] = useState({
    name: '',
    description: ''
  })

  useEffect(() => {
    fetchSettings()
    fetchSections()
    const params = new URLSearchParams(window.location.search)
    const highlightId = params.get('highlightId')
    if (highlightId) {
      setTimeout(() => {
        const row = document.querySelector(`[data-row-id="${highlightId}"]`)
        if (row) {
          row.classList.add('flash-red')
          row.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => row.classList.remove('flash-red'), 1500)
        }
      }, 400)
    }
  }, [])

  // إعادة تحميل المخزون عند التعديل/الحذف من كشف حساب المورد أو غيره
  useEffect(() => {
    const onUpdate = () => {
      fetchSections()
      if (selectedSection) fetchInventory(selectedSection.id)
      else fetchInventory()
    }
    window.addEventListener('updateStatistics', onUpdate)
    return () => window.removeEventListener('updateStatistics', onUpdate)
  }, [selectedSection])

  useEffect(() => {
    checkTotalMeters(inventory)
  }, [notificationThreshold, inventory])

  const fetchSettings = async () => {
    try {
      const response = await fetch('http://localhost:3456/api/settings')
      const data = await response.json()
      setNotificationThreshold(data.notification_threshold || 0)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const fetchSections = async () => {
    try {
      const response = await fetch('http://localhost:3456/api/inventory/sections')
      const data = await response.json()
      setSections(data)
    } catch (error) {
      addNotification('خطأ في تحميل الأقسام', 'error')
    }
  }

  const fetchInventory = async (sectionId = null) => {
    try {
      const url = sectionId 
        ? `http://localhost:3456/api/inventory/section/${sectionId}`
        : 'http://localhost:3456/api/inventory'
      const response = await fetch(url)
      const data = await response.json()
      setInventory(data)
      setSelectedItem(prev => {
        if (!prev) return prev
        const updated = data.find(i => i.id === prev.id)
        return updated || prev
      })
      if (!sectionId) {
        checkTotalMeters(data)
      }
    } catch (error) {
      addNotification('خطأ في تحميل البيانات', 'error')
    }
  }

  const checkTotalMeters = (inventoryData) => {
    const totalMeters = inventoryData
      .filter(item => !item.unit || item.unit === 'متر')
      .reduce((sum, item) => sum + (parseFloat(item.total_meters) || 0), 0)
    
    const totalTons = inventoryData
      .filter(item => item.unit === 'كيلو')
      .reduce((sum, item) => sum + (parseFloat(item.total_meters) || 0), 0)
    
    const totalCombined = totalMeters + totalTons
    
    // تم إلغاء إشعار: "تحذير: إجمالي المخزون ..." بناءً على طلب المستخدم
    // ترك الدالة فقط لحساب المجاميع إن احتجنا لاحقاً
    if (notificationThreshold > 0 && totalCombined >= notificationThreshold) {
      removeNotification('low-total-stock')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.purchase_price || parseFloat(formData.purchase_price) <= 0) {
      addNotification('يجب إدخال سعر المتر/الكيلو للصنف', 'error')
      return
    }

    const data = {
      item_name: (formData.item_name && formData.item_name.trim()) || (selectedSection?.name || 'صنف'),
      section_id: selectedSection ? selectedSection.id : formData.section_id,
      color_number: formData.color_number,
      rolls_count: formData.rolls_count === '' ? null : (parseInt(formData.rolls_count) || 0),
      total_meters: parseFloat(formData.total_meters) || 0,
      unit: formData.unit || 'متر',
      purchase_price: parseFloat(formData.purchase_price) || 0
    }

    try {
      const url = editingId 
        ? `http://localhost:3456/api/inventory/${editingId}`
        : 'http://localhost:3456/api/inventory'
      
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (response.ok) {
        addNotification(editingId ? ' تم التعديل بنجاح' : ' تم إضافة الصنف بنجاح', 'success')
        if (selectedSection) {
          await fetchInventory(selectedSection.id)
        } else {
          await fetchInventory()
        }
        closeModal()
      } else if (result.message && result.message.includes('موجود بالفعل')) {
        addNotification(result.message + ' - يرجى حذفه أولاً أو التعديل عليه', 'error')
      } else {
        addNotification(result.message || 'حدث خطأ', 'error')
      }
    } catch (error) {
      addNotification('حدث خطأ', 'error')
    }
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [confirmSectionOpen, setConfirmSectionOpen] = useState(false)
  const [pendingDeleteSectionId, setPendingDeleteSectionId] = useState(null)

  
  const requestDelete = (id) => { setPendingDeleteId(id); setConfirmOpen(true) }
  const requestDeleteSection = (id) => { setPendingDeleteSectionId(id); setConfirmSectionOpen(true) }
  const handleDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await fetch(`http://localhost:3456/api/inventory/${pendingDeleteId}`, { method: 'DELETE' })
      addNotification(' تم حذف الصنف', 'info')
      if (selectedSection) {
        await fetchInventory(selectedSection.id)
      } else {
        await fetchInventory()
      }
    } catch (error) {
      addNotification(' فشل الحذف', 'error')
    } finally {
      setConfirmOpen(false)
      setPendingDeleteId(null)
    }
  }

  const handleDeleteSection = async () => {
    if (!pendingDeleteSectionId) return
    try {
      await fetch(`http://localhost:3456/api/inventory/sections/${pendingDeleteSectionId}`, { method: 'DELETE' })
      addNotification(' تم حذف القسم وجميع أصنافه', 'info')
      await fetchSections()
    } catch (error) {
      addNotification(' فشل حذف القسم', 'error')
    } finally {
      setConfirmSectionOpen(false)
      setPendingDeleteSectionId(null)
    }
  }

  const handleDeductRoll = async (item) => {
    if (!item.rolls_count || item.rolls_count <= 0) {
      addNotification(' لا توجد أتواب متاحة', 'warning')
      return
    }

    const metersPerRoll = item.total_meters / item.rolls_count
    const newRolls = item.rolls_count - 1
    const newMeters = newRolls * metersPerRoll

    try {
      await fetch(`http://localhost:3456/api/inventory/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          rolls_count: newRolls,
          total_meters: newMeters
        })
      })
      addNotification(` تم خصم توب واحد – المتبقي ${formatNumber(newMeters)} متر`, 'success')
      if (selectedSection) {
        await fetchInventory(selectedSection.id)
      } else {
        await fetchInventory()
      }

      if (newRolls <= 2) {
        addNotification(` تحذير: كمية ${item.item_name} رقم ${item.color_number} منخفضة`, 'warning')
      }
    } catch (error) {
      addNotification('حدث خطأ', 'error')
    }
  }

  const openModal = (item = null) => {
    if (item) {
      setEditingId(item.id)
      setFormData({
        item_name: item.item_name,
        section_id: item.section_id || '',
        color_number: item.color_number,
        rolls_count: item.rolls_count,
        total_meters: item.total_meters,
        unit: item.unit || 'متر',
        purchase_price: item.purchase_price || ''
      })
    } else {
      setEditingId(null)
      setFormData({
        item_name: '',
        section_id: selectedSection ? selectedSection.id : '',
        color_number: '',
        rolls_count: '',
        total_meters: '',
        unit: 'متر',
        purchase_price: ''
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
  }

  const openDetails = (item) => {
    setSelectedItem(item)
    setShowDetails(true)
  }

  const closeDetails = () => {
    setShowDetails(false)
    setSelectedItem(null)
  }

  const openSection = (section) => {
    setSelectedSection(section)
    setViewMode('items')
    fetchInventory(section.id)
  }

  const backToSections = () => {
    setViewMode('sections')
    setSelectedSection(null)
    setSearchTerm('')
    setInventory([])
  }

  const filteredInventory = inventory.filter(i => {
    const matchesSearch = i.item_name.includes(searchTerm) || i.color_number.includes(searchTerm)
    return matchesSearch
  })

  const handleExport = async () => {
    try {
      const success = await exportInventoryToExcel(inventory)
      if (success) {
      addNotification(' تم تصدير البيانات إلى Excel', 'success')
    } else {
        addNotification(' فشل التصدير', 'error')
      }
    } catch (error) {
      addNotification(' فشل التصدير', 'error')
    }
  }

  const openSectionModal = (section = null) => {
    if (section) {
      setEditingId(section.id)
      setSectionFormData({
        name: section.name,
        description: section.description || ''
      })
    } else {
      setEditingId(null)
      setSectionFormData({
        name: '',
        description: ''
      })
    }
    setShowSectionModal(true)
  }

  const closeSectionModal = () => {
    setShowSectionModal(false)
    setEditingId(null)
  }

  const handleSectionSubmit = async (e) => {
    e.preventDefault()
    
    if (!sectionFormData.name.trim()) {
      addNotification('اسم القسم مطلوب', 'error')
      return
    }

    try {
      const url = editingId 
        ? `http://localhost:3456/api/inventory/sections/${editingId}`
        : 'http://localhost:3456/api/inventory/sections'
      
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionFormData)
      })

      if (response.ok) {
        addNotification(editingId ? 'تم تعديل القسم بنجاح' : 'تم إضافة القسم بنجاح', 'success')
        fetchSections()
        closeSectionModal()
      } else {
        const errorData = await response.json()
        addNotification(errorData.message || 'فشل في حفظ القسم', 'error')
      }
    } catch (error) {
      addNotification('حدث خطأ', 'error')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {viewMode === 'items' && (
            <button
              onClick={backToSections}
              className={`p-2 rounded-lg transition ${
                theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
            {viewMode === 'sections' ? 'أقسام المخزون' : `مخزون ${selectedSection?.name}`}
          </h2>
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
          {viewMode === 'sections' ? (
            <button
              onClick={() => openSectionModal()}
              className={`px-6 py-3 rounded-lg font-semibold ${
                theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
              }`}
            >
              + إضافة قسم جديد
            </button>
          ) : (
          <button
            onClick={() => openModal()}
            className={`px-6 py-3 rounded-lg font-semibold ${
              theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
            }`}
          >
            + إضافة صنف جديد
          </button>
          )}
        </div>
      </div>

      {viewMode === 'sections' ? (
        <div className="mb-6">
          <div className="mb-4">
            <div className="relative max-w-sm">
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="ابحث عن قسم..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-4 py-3 pr-12 rounded-lg ${
                  theme === 'dark' 
                    ? 'bg-gray-900 border border-gray-700 text-white' 
                    : 'bg-gray-100 border border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>

          {sections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sections.filter(s => (s.name || '').includes(searchTerm)).map(section => (
                <div 
                  key={section.id} 
                  className={`p-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg relative ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border border-gray-700' 
                      : 'bg-gradient-to-br from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 border border-gray-200'
                  }`}
                >
                  {/* أزرار التعديل والحذف */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openSectionModal(section)
                      }}
                      className="p-1 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                      title="تعديل القسم"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        requestDeleteSection(section.id)
                      }}
                      className="p-1 rounded text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      title="حذف القسم"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                      </svg>
                    </button>
                  </div>

                  <div 
                    className="text-center cursor-pointer"
                    onClick={() => openSection(section)}
                  >
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                      theme === 'dark' ? 'bg-camel/20' : 'bg-brown/20'
                    }`}>
                      <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>{section.name}</h3>
                    {section.description && (
                      <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {section.description}
                      </p>
                    )}
                    <div className={`mt-4 text-xs px-3 py-1 rounded-full ${
                      theme === 'dark' ? 'bg-camel/20 text-camel' : 'bg-brown/20 text-brown'
                    }`}>
                      انقر للعرض
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-lg">لا توجد أقسام مخزون</p>
              <p className="text-sm">ابدأ بإضافة قسم جديد لتنظيم المخزون</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className={`grid grid-cols-2 gap-4 mb-6`}>
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
              <p className="text-sm text-gray-500">إجمالي الأمتار</p>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                {formatNumber(inventory.filter(i => !i.unit || i.unit === 'متر').reduce((sum, i) => sum + (parseFloat(i.total_meters) || 0), 0))}
              </p>
              <p className="text-xs text-gray-500">متر</p>
            </div>
            
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
              <p className="text-sm text-gray-500">عدد الأصناف</p>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                {inventory.length}
              </p>
              <p className="text-xs text-gray-500">صنف</p>
            </div>
          </div>

          <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              إحصائيات {selectedSection?.name}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">عدد الأصناف</p>
                <p className={`text-xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                  {filteredInventory.length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">إجمالي الأمتار</p>
                <p className={`text-xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                  {formatNumber(filteredInventory.filter(i => !i.unit || i.unit === 'متر').reduce((sum, i) => sum + (parseFloat(i.total_meters) || 0), 0))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">إجمالي الكيلوهات</p>
                <p className={`text-xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                  {formatNumber(filteredInventory.filter(i => i.unit === 'كيلو').reduce((sum, i) => sum + (parseFloat(i.total_meters) || 0), 0))}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">إجمالي الأتواب</p>
                <p className={`text-xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                  {filteredInventory.reduce((sum, i) => sum + (i.rolls_count ? parseInt(i.rolls_count) : 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex gap-4">
            <div className="flex-1 relative">
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="بحث بالاسم أو رقم اللون..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-3 pr-12 rounded-lg ${
            theme === 'dark' 
              ? 'bg-gray-900 border border-gray-700 text-white' 
              : 'bg-gray-100 border border-gray-300 text-gray-900'
          }`}
        />
            </div>
      </div>

      <div className="overflow-x-auto">
            <table className={`w-full table-fixed border ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
              <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}>
                <tr>
                  <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>البيان</th>
                  <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الكمية</th>
                  <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>عدد الأتواب</th>
                  <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الوحدة</th>
                  <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>سعر الوحدة</th>
                  <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الحالة</th>
                  <th className={`px-3 py-2 text-right border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map(item => {
              const meters = parseFloat(item.total_meters) || 0
              const status = meters <= 0 ? { text: 'منتهي', color: 'text-red-500' } : (meters <= notificationThreshold && notificationThreshold > 0 ? { text: 'منخفض', color: 'text-yellow-500' } : { text: 'متاح', color: 'text-green-500' })
              const displayName = `${item.item_name || 'صنف'}${item.color_number ? ' - رقم ' + item.color_number : ''}`
              return (
                <tr key={item.id} data-row-id={item.id}>
                  <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{displayName}</td>
                  <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{formatNumber(item.total_meters ?? 0)}</td>
                  <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{item.rolls_count ? formatNumber(item.rolls_count) : '-'}</td>
                  <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{item.unit || 'متر'}</td>
                  <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{formatNumber(item.purchase_price ?? 0)}</td>
                  <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'} ${status.color}`}>{status.text}</td>
                  <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDetails(item)}
                          className="p-2 rounded text-green-500 hover:text-green-600"
                          title="رؤية التفاصيل"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                    <button
                      onClick={() => openModal(item)}
                      className="p-2 rounded text-blue-500 hover:text-blue-600"
                      title="تعديل"
                      aria-label="تعديل"
                    >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" />
                      </svg>
                    </button>
                    <button
                          onClick={() => requestDelete(item.id)}
                      className="p-2 rounded text-red-500 hover:text-red-600"
                      title="حذف"
                      aria-label="حذف"
                    >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
        </div>
      )}

      {showSectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-96 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              {editingId ? 'تعديل القسم' : 'إضافة قسم جديد'}
            </h3>
            <form onSubmit={handleSectionSubmit} className="space-y-3">
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  اسم القسم
                </label>
                <input
                  type="text"
                  placeholder="اسم القسم"
                  value={sectionFormData.name}
                  onChange={(e) => setSectionFormData({...sectionFormData, name: e.target.value})}
                  className={`w-full px-3 py-2 rounded ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  وصف القسم
                </label>
                <textarea
                  placeholder="وصف القسم (اختياري)"
                  value={sectionFormData.description}
                  onChange={(e) => setSectionFormData({...sectionFormData, description: e.target.value})}
                  className={`w-full px-3 py-2 rounded ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded font-semibold ${
                    theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
                  }`}
                >
                  {editingId ? 'تعديل' : 'إضافة'}
                </button>
                <button
                  type="button"
                  onClick={closeSectionModal}
                  className={`flex-1 py-2 rounded font-semibold ${
                    theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'
                  }`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-96 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              {editingId ? 'تعديل صنف' : 'إضافة صنف جديد'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* تم حذف خانة اسم الصنف حسب الطلب */}
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  رقم اللون
                </label>
                <input
                  type="text"
                  placeholder="رقم اللون"
                  value={formData.color_number}
                  onChange={(e) => setFormData({...formData, color_number: e.target.value})}
                  className={`w-full px-3 py-2 rounded ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  عدد الأتواب
                </label>
                <input
                  type="number"
                  placeholder="عدد الأتواب (اختياري)"
                  value={formData.rolls_count}
                  onChange={(e) => {
                    const v = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0)
                    setFormData({...formData, rolls_count: v})
                  }}
                  className={`w-full px-3 py-2 rounded ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الكمية والوحدة</label>
                <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                    placeholder="الكمية"
                  value={formData.total_meters}
                  onChange={(e) => {
                    const v = Math.max(0, parseFloat(e.target.value) || 0)
                    setFormData({...formData, total_meters: v})
                  }}
                  className={`w-full px-3 py-2 rounded ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                  required
                />
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className={`w-full px-3 py-2 rounded ${
                      theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <option value="متر">متر</option>
                    <option value="كيلو">كيلو</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  سعر {formData.unit === 'كيلو' ? 'الكيلو' : 'المتر'} الواحد
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={`سعر ${formData.unit === 'كيلو' ? 'الكيلو' : 'المتر'}`}
                  value={formData.purchase_price}
                  onChange={(e) => {
                    const v = Math.max(0, parseFloat(e.target.value) || 0)
                    setFormData({...formData, purchase_price: v})
                  }}
                  className={`w-full px-3 py-2 rounded ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded font-semibold ${
                    theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
                  }`}
                >
                  {editingId ? 'حفظ التعديلات' : 'إضافة'}
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
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا الصنف؟ لا يمكن التراجع."
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={confirmSectionOpen}
        title="تأكيد حذف القسم"
        message="هل أنت متأكد من حذف هذا القسم؟ سيتم حذف جميع الأصناف الموجودة فيه أيضاً."
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={handleDeleteSection}
        onCancel={() => setConfirmSectionOpen(false)}
      />

      {showDetails && selectedItem && (
        <InventoryDetails
          item={selectedItem}
          onClose={closeDetails}
        />
      )}
    </div>
  )
}

export default Inventory

