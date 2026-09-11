import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { exportStatisticsToExcel } from '../utils/exportExcel'
import { formatNumber } from '../utils/format'
import { apiUrl } from '../utils/api'
import ConfirmDialog from '../components/ConfirmDialog'

function Statistics() {
  const { theme } = useTheme()
  const { addNotification } = useNotification()
  const [stats, setStats] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState({})
  const [topSellingSearch, setTopSellingSearch] = useState('')
  const [deleteSectionDialogOpen, setDeleteSectionDialogOpen] = useState(false)
  const [pendingDeleteSectionName, setPendingDeleteSectionName] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customProfitLoss, setCustomProfitLoss] = useState(null)
  const [customLoading, setCustomLoading] = useState(false)

  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))
  }

  useEffect(() => {
    fetchStatistics()
    
    const handleUpdateStatistics = () => {
      fetchStatistics()
    }
    window.addEventListener('updateStatistics', handleUpdateStatistics)
    
    return () => {
      window.removeEventListener('updateStatistics', handleUpdateStatistics)
    }
  }, [])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const response = await fetch(apiUrl('/api/statistics'))
      const data = await response.json()
      setStats(data)
    } catch (error) {
      addNotification('خطأ في تحميل الإحصائيات', 'error')
    } finally {
      setLoading(false)
    }
  }

  // تقرير الأرباح والخسائر لفترة مخصّصة — كل الحساب يتم في الـbackend
  const fetchCustomProfitLoss = async (from, to) => {
    if (!from || !to) return
    try {
      setCustomLoading(true)
      const params = new URLSearchParams({ from, to })
      const response = await fetch(apiUrl(`/api/profit-loss?${params.toString()}`))
      const data = await response.json()
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || 'فشل حساب الفترة المخصّصة')
      }
      setCustomProfitLoss(data)
    } catch (error) {
      setCustomProfitLoss(null)
      addNotification(error?.message || 'فشل حساب الفترة المخصّصة', 'error')
    } finally {
      setCustomLoading(false)
    }
  }

  useEffect(() => {
    if (selectedPeriod !== 'custom') return
    if (!customFrom || !customTo) return
    fetchCustomProfitLoss(customFrom, customTo)
  }, [selectedPeriod, customFrom, customTo])

  const handleExportExcel = () => {
    if (exportStatisticsToExcel(stats)) {
      addNotification('تم تصدير الإحصائيات لملف إكسل', 'success')
    } else {
      addNotification('فشل التصدير', 'error')
    }
  }

  const handleRefresh = () => {
    fetchStatistics()
    addNotification('تم تحديث الإحصائيات', 'success')
  }

  const requestDeleteTopSellingSection = (sectionName) => {
    const safeName = (sectionName || '').trim()
    if (!safeName) return

    setPendingDeleteSectionName(safeName)
    setDeleteSectionDialogOpen(true)
  }

  const handleDeleteTopSellingSection = async () => {
    const safeName = (pendingDeleteSectionName || '').trim()
    if (!safeName) return

    try {
      const response = await fetch(
        apiUrl(`/api/statistics/top-selling/section?name=${encodeURIComponent(safeName)}`),
        { method: 'DELETE' }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || 'فشل الحذف')
      }
      addNotification('تم حذف القسم من قائمة الأكثر مبيعاً', 'success')
      fetchStatistics()
    } catch (error) {
      addNotification(error?.message || 'فشل حذف القسم', 'error')
    } finally {
      setDeleteSectionDialogOpen(false)
      setPendingDeleteSectionName('')
    }
  }

  const getPeriodData = (period) => {
    if (!stats) return null

    const addGross = (s) => {
      const t = s || {}
      const total = t.total ?? 0
      const returned = t.returned ?? 0
      return { ...t, gross: (t.gross != null ? t.gross : total + returned), returned }
    }

    if (selectedYear !== 'all') {
      const byYear = stats?.statsByYear?.[selectedYear]
      const sales = addGross(byYear?.sales || { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 })
      return {
        sales: { ...sales, returned: sales.returned ?? 0 },
        expenses: byYear?.expenses || { count: 0, inside: 0, outside: 0 }
      }
    }
    
    switch (period) {
      case 'today': {
        const s = addGross(stats.salesPeriods?.today || { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 })
        return { sales: s, expenses: stats.expensesPeriods?.today || { count: 0, inside: 0, outside: 0 } }
      }
      case 'week': {
        const s = addGross(stats.salesPeriods?.week || { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 })
        return { sales: s, expenses: stats.expensesPeriods?.week || { count: 0, inside: 0, outside: 0 } }
      }
      case 'month': {
        const s = addGross(stats.salesPeriods?.month || { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 })
        return { sales: s, expenses: stats.expensesPeriods?.month || { count: 0, inside: 0, outside: 0 } }
      }
      case 'year': {
        const s = addGross(stats.salesPeriods?.year || { count: 0, total: 0, paid: 0, remaining: 0, returned: 0 })
        return { sales: s, expenses: stats.expensesPeriods?.year || { count: 0, inside: 0, outside: 0 } }
      }
      default:
        return {
          sales: { 
            count: stats.salesCount || 0, 
            total: stats.netSalesTotal ?? stats.salesTotal ?? 0, 
            gross: stats.salesTotal || 0,
            paid: stats.salesPaid || 0, 
            remaining: stats.salesRemaining || 0,
            returned: stats.returnedTotal || 0,
            returnedCount: stats.returnedCount || 0
          },
          expenses: {
            count: stats.expensesCount || 0,
            inside: stats.expensesInside || 0,
            outside: stats.expensesOutside || 0
          }
        }
    }
  }

  // تقرير الأرباح والخسائر الخاص بالفترة/السنة المختارة (مصدر واحد لكل الأرقام)
  const getActiveProfitLoss = () => {
    if (!stats) return null
    if (selectedYear !== 'all') {
      return stats?.statsByYear?.[selectedYear]?.profitLoss ?? null
    }
    if (selectedPeriod === 'custom') return customProfitLoss
    if (selectedPeriod === 'all') return stats?.profitLoss ?? null
    return stats?.profitLossPeriods?.[selectedPeriod] ?? null
  }

  const calculateNetProfit = (pl) => {
    if (!pl) return { netIncome: 0, netProfit: 0, netLoss: 0 }
    return {
      netIncome: pl.netProfit ?? 0,
      netProfit: (pl.netProfit ?? 0) > 0 ? pl.netProfit : 0,
      netLoss: pl.netLoss ?? 0,
    }
  }

  const StatCard = ({ title, value, subtitle, color = 'default', icon, trend }) => (
    <div className={`p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
      theme === 'dark' 
        ? 'bg-gray-900 border-gray-700 hover:border-gray-600' 
        : 'bg-white border-gray-200 hover:border-gray-300'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${
          color === 'green' ? 'bg-green-100 text-green-600' :
          color === 'red' ? 'bg-red-100 text-red-600' :
          color === 'blue' ? 'bg-blue-100 text-blue-600' :
          color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
          theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
        }`}>
          {icon}
        </div>
        {trend && (
          <div className={`text-sm font-medium ${
            trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'
          }`}>
            {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'} {Math.abs(trend)}%
          </div>
        )}
      </div>
      <h3 className={`text-sm font-medium mb-1 ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      }`}>
        {title}
      </h3>
      <p className={`text-3xl font-bold ${
        color === 'green' ? 'text-green-600' :
        color === 'red' ? 'text-red-600' :
        color === 'blue' ? 'text-blue-600' :
        color === 'yellow' ? 'text-yellow-600' :
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}>
        {value}
      </p>
      {subtitle && (
        <p className={`text-xs mt-1 ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
        }`}>
          {subtitle}
        </p>
      )}
    </div>
  )

  // عنوان قسم داخل قائمة الأرباح والخسائر
  const PLSectionLabel = ({ index, title, color = 'default' }) => {
    const palette = {
      green: 'text-green-600 border-green-500',
      orange: 'text-orange-600 border-orange-500',
      blue: 'text-blue-600 border-blue-500',
      red: 'text-red-600 border-red-500',
      emerald: 'text-emerald-600 border-emerald-500',
      teal: 'text-teal-600 border-teal-500',
      default: theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-400',
    }
    return (
      <div className={`flex items-center gap-3 pt-2 border-r-4 pr-3 ${palette[color] || palette.default}`}>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          {index}
        </span>
        <h3 className="text-base font-bold tracking-wide">{title}</h3>
      </div>
    )
  }

  const SectionHeader = ({ title, icon, description }) => (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${
          theme === 'dark' ? 'bg-camel/20 text-camel' : 'bg-brown/20 text-brown'
        }`}>
          {icon}
        </div>
        <h2 className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-camel' : 'text-brown'
        }`}>
          {title}
        </h2>
      </div>
      {description && (
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {description}
        </p>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${
            theme === 'dark' ? 'border-camel' : 'border-brown'
          }`}></div>
          <div className={`text-xl ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            جاري تحميل الإحصائيات...
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className={`text-xl ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          خطأ في تحميل البيانات
        </div>
      </div>
    )
  }

  const activePL = getActiveProfitLoss()
  const profitData = calculateNetProfit(activePL)

  // كل أرقام الصفحة تُشتق من نفس تقرير الفترة حتى لا تختلط الفترات
  const periodData = activePL
    ? {
        sales: {
          count: activePL.salesCount ?? 0,
          total: activePL.netSales ?? 0,
          gross: activePL.grossSales ?? 0,
          paid: activePL.collections ?? 0,
          remaining: activePL.accountsReceivable ?? 0,
          returned: activePL.salesReturns ?? 0,
          returnedCount: activePL.returnsCount ?? 0,
        },
        expenses: {
          count: (activePL.expensesCount ?? 0) + (activePL.otherIncomeCount ?? 0),
          inside: activePL.otherIncome ?? 0,
          outside: activePL.operatingExpenses ?? 0,
        },
      }
    : getPeriodData(selectedPeriod)

  // الحصول على البيانات المفلترة حسب السنة إذا تم اختيار سنة
  const yearData = selectedYear !== 'all' ? stats?.statsByYear?.[selectedYear] : null
  
  const salesTotal = periodData?.sales.total || 0
  const salesPaid = periodData?.sales.paid || 0
  const customersRemainingFromBackend = yearData?.customers?.remaining ?? stats?.customersRemaining ?? 0
  const customersCreditBackend = yearData?.customers?.creditTotal ?? stats?.customersCreditTotal ?? 0
  
  // بيانات العملاء حسب السنة
  const customersTotal = yearData?.customers?.total ?? stats?.customersTotal ?? 0
  const customersPaid = yearData?.customers?.paid ?? stats?.customersPaid ?? 0
  const customersRemaining = yearData?.customers?.remaining ?? stats?.customersRemaining ?? 0
  const customersCreditTotal = yearData?.customers?.creditTotal ?? stats?.customersCreditTotal ?? 0
  
  // بيانات الموردين حسب السنة
  const suppliersTotal = yearData?.suppliers?.total ?? stats?.suppliersTotal ?? 0
  const suppliersPaid = yearData?.suppliers?.paid ?? stats?.suppliersPaid ?? 0
  const suppliersRemaining = yearData?.suppliers?.remaining ?? stats?.suppliersRemaining ?? 0
  const suppliersCreditTotal = yearData?.suppliers?.creditTotal ?? stats?.suppliersCreditTotal ?? 0
  const suppliersOrdersCount = yearData?.suppliers?.ordersCount ?? stats?.suppliersOrdersCount ?? 0
  
  // أكثر الأصناف مبيعاً حسب السنة
  const topSelling = yearData?.topSelling ?? stats?.topSelling ?? []
  
  // بيانات الأرباح والخسائر (أساس الاستحقاق) للفترة/السنة المختارة
  const pl = activePL ?? {
    grossSales: 0, salesReturns: 0, netSales: 0,
    cogs: 0, returnedCogs: 0, netCogs: 0, cogsCoverageRate: null,
    actualReturnedCogs: 0, estimatedReturnedCogs: 0,
    grossProfit: 0, grossProfitMargin: null,
    operatingExpenses: 0, otherIncome: 0,
    netProfit: 0, netLoss: 0, netProfitMargin: null,
    collections: 0, collectionsFromSaleOrders: 0, collectionsFromSeparatePayments: 0,
    allocatedCollections: 0, unallocatedCollections: 0, accountsReceivable: 0,
    collectionRate: null, customersWithCredit: 0, customersWithReceivable: 0,
    reconciliationWarnings: [], missingCostSummary: { count: 0, salesValue: 0 },
    salesCount: 0, returnsCount: 0, expensesCount: 0, otherIncomeCount: 0,
  }
  const profitStats = {
    netIncome: pl.netProfit ?? 0,
    netProfit: (pl.netProfit ?? 0) > 0 ? pl.netProfit : 0,
    netLoss: pl.netLoss ?? 0,
    grossProfit: pl.grossProfit ?? 0,
    grossProfitMargin: pl.grossProfitMargin ?? 0,
    costOfSoldItems: pl.cogs ?? 0,
    costOfReturned: pl.returnedCogs ?? 0,
    netCostOfSoldItems: pl.netCogs ?? 0,
  }
  const periodLabel =
    selectedYear !== 'all'
      ? `سنة ${selectedYear}`
      : selectedPeriod === 'today' ? 'اليوم'
      : selectedPeriod === 'week' ? 'آخر أسبوع'
      : selectedPeriod === 'month' ? 'هذا الشهر'
      : selectedPeriod === 'year' ? 'هذه السنة'
      : selectedPeriod === 'custom'
        ? (customFrom && customTo ? `من ${customFrom} إلى ${customTo}` : 'فترة مخصّصة')
        : 'كل الفترات'

  // بيانات المبيعات الإجمالية للملخص المالي
  const salesTotalForSummary = pl.grossSales ?? 0
  const returnedTotal = pl.salesReturns ?? 0
  const returnedCount = pl.returnsCount ?? 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${
            theme === 'dark' ? 'bg-camel/20 text-camel' : 'bg-brown/20 text-brown'
          }`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          </div>
          <div>
            <h1 className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-camel' : 'text-brown'
            }`}>
              لوحة الإحصائيات
            </h1>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              نظرة شاملة على أداء العمل
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">جميع الفترات</option>
            <option value="today">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
            <option value="year">هذه السنة</option>
            <option value="custom">فترة مخصّصة</option>
          </select>

          {selectedPeriod === 'custom' && selectedYear === 'all' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>إلى</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          )}
          
          {/* Year Selector (للفترات الكاملة) */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">كل السنوات</option>
            {(stats?.years || []).map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
          
          {/* زر التحديث أُلغي حسب الطلب */}
          
          <button
            onClick={handleExportExcel}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105 ${
              theme === 'dark' 
                ? 'bg-camel text-black hover:bg-camel/90' 
                : 'bg-brown text-white hover:bg-brown/90'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            تصدير إكسل
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className={`relative p-6 rounded-lg shadow-sm border-l-4 ${
        theme === 'dark' 
          ? 'bg-yellow-900/20 border-yellow-400 border border-yellow-400/30' 
          : 'bg-yellow-50 border-yellow-500 border border-yellow-200'
      }`}>
        {/* Note-like pin effect */}
        <div className={`absolute -top-2 left-6 w-4 h-4 rotate-45 ${
          theme === 'dark' ? 'bg-yellow-400' : 'bg-yellow-500'
        }`}></div>
        
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-full ${
            theme === 'dark' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
          }`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold mb-2 ${
              theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'
            }`}>
              ملاحظة مهمة عن المكسب والخسارة
            </h3>
            <p className={`text-sm leading-relaxed ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              المكسب بيتحسب على <span className={`font-medium ${theme === 'dark' ? 'text-green-300' : 'text-green-600'}`}>قيمة الأوردر</span>،
              مش على المبلغ اللي اتحصّل من العميل.
              مثال: بعت بـ 1000 واتحصّلت 500 → اللي يدخل الحسبة 1000، والـ 500 الباقية فلوس عند العميل ومش بتقلل المكسب.
              <span className={`font-medium ${theme === 'dark' ? 'text-green-300' : 'text-green-600'}`}>
                {' '}صافي المكسب = مجموع قيمة الأوردرات ناقص الراجع ناقص تكلفة البضاعة ناقص المصاريف وزائد الفلوس الداخلة التانية
              </span>.
              الفلوس اللي اتحصّلت بتظهر في قسم لوحدها ومش بتزوّد المكسب ولا بتنقصه. 
              <span className={`font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                البضاعة اللي في المخزن بضاعتك ومش بتتشال من المكسب
              </span>، 
              <span className={`font-medium ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`}>
                والفلوس اللي بتدفعها للموردين سداد ديون ومش بتأثر على المكسب على طول
              </span>.
            </p>
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      <SectionHeader
        title="الملخص المالي"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        }
        description="نظرة سريعة على وضع الشغل"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard
          title="إجمالي المبيعات"
          value={formatNumber(salesTotalForSummary)}
          subtitle="قيمة الأوردرات كاملة، مش التحصيل"
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 15l3-3 4 4 6-6" />
            </svg>
          }
        />
        <StatCard
          title="إجمالي الأوردرات الراجعة"
          value={formatNumber(returnedTotal)}
          subtitle={returnedCount > 0 ? `${returnedCount} أوردر · من كشوف الحساب` : 'من كشوف الحساب'}
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
        <StatCard
          title="صافي المبيعات"
          value={formatNumber(periodData?.sales?.total || 0)}
          subtitle="قيمة الأوردرات بعد شيل الراجع — سواء اتحصّلت أو لأ"
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="الفلوس اللي اتحصّلت"
          value={formatNumber(pl.collections)}
          subtitle="حركة فلوس — مش مكسب"
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        {(pl.accountsReceivable || 0) > 0 && (
          <StatCard
            title="فلوس عند العملاء"
            value={formatNumber(pl.accountsReceivable)}
            subtitle="لسه متحصّلتش"
            color="red"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        )}
        <StatCard
          title="عدد العمليات"
          value={periodData?.sales.count || 0}
          subtitle="عملية"
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>

      {/* Customers & Suppliers Overview */}
      <SectionHeader
        title="العملاء والموردين"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
        description="تفاصيل العملاء والموردين مع أوردراتهم"
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customers Section */}
        <div className={`p-6 rounded-xl ${
          theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
              العملاء
          </h3>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  عدد العملاء
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats?.customersCount || 0}
              </p>
            </div>
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  عدد الأوردرات
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {periodData?.sales?.count ?? stats?.salesCount ?? 0}
                </p>
              </div>
            </div>
            
            
            <div className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}>
              <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                تفاصيل الأوردرات
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    إجمالي قيمة الأوردرات
                  </span>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                    {formatNumber(customersTotal)} ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    المدفوع من العملاء
                  </span>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                    {formatNumber(customersPaid)} ج.م
                  </span>
                </div>
                {customersRemaining > 0 && (
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      المتبقي من العملاء
                    </span>
                    <span className={`font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                      {formatNumber(customersRemaining)} ج.م
                    </span>
                  </div>
                )}
                {customersCreditTotal > 0 && (
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      إجمالي المبلغ الباقي للعملاء
                    </span>
                    <span className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      {formatNumber(customersCreditTotal)} ج.م
                    </span>
                  </div>
                )}
            </div>
            </div>
          </div>
        </div>

        {/* Suppliers Section */}
        <div className={`p-6 rounded-xl ${
          theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            </div>
            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}>
              الموردين
            </h3>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  عدد الموردين
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats?.suppliersCount || 0}
                </p>
            </div>
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  عدد الطلبات
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {suppliersOrdersCount}
                </p>
              </div>
            </div>
            
            <div className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
            }`}>
              <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                تفاصيل الطلبات
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    إجمالي قيمة الطلبات
                  </span>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                    {formatNumber(suppliersTotal)} ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    المدفوع للموردين
                  </span>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                    {formatNumber(suppliersPaid)} ج.م
                  </span>
                </div>
                {suppliersRemaining > 0 && (
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      المتبقي للموردين
                    </span>
                    <span className={`font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                      {formatNumber(suppliersRemaining)} ج.م
                    </span>
                  </div>
                )}
                {suppliersCreditTotal > 0 && (
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      المبلغ اللي عند الموردين لك
                    </span>
                    <span className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      {formatNumber(suppliersCreditTotal)} ج.م
                    </span>
                  </div>
                )}
                {suppliersCreditTotal > 0 && (
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    (المبلغ الزائد الذي دفعته للموردين)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Overview */}
      <SectionHeader
        title="المصاريف"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-4.418 0-8 1.79-8 4v4h16v-4c0-2.21-3.582-4-8-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        }
        description="المصاريف الخارجة والفلوس الداخلة"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="المصاريف الخارجة"
          value={formatNumber(periodData?.expenses.outside || 0)}
          subtitle="ج.م"
          color="red"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          }
        />
        
        <StatCard
          title="الفلوس الداخلة"
          value={formatNumber(periodData?.expenses.inside || 0)}
          subtitle="ج.م"
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        />
        
        <StatCard
          title="عدد المصاريف"
          value={periodData?.expenses.count || 0}
          subtitle="حركة"
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>


      {/* Detailed Profit Calculation */}
      <SectionHeader
        title="حساب المكسب والخسارة"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
        description={`الحسبة على قيمة الأوردر كاملة حتى لو العميل دفع جزء بس · ${periodLabel}`}
      />

      {selectedPeriod === 'custom' && selectedYear === 'all' && (!customFrom || !customTo) && (
        <div className={`p-4 rounded-lg border ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}>
          اختار تاريخ البداية وتاريخ النهاية علشان يظهرلك حساب الفترة.
        </div>
      )}
      {customLoading && selectedPeriod === 'custom' && (
        <div className={`p-4 rounded-lg border ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}>
          بيتم حساب الفترة المختارة...
        </div>
      )}

      <div className={`p-8 rounded-xl border-2 mb-8 ${
        theme === 'dark' 
          ? 'bg-gray-900 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="space-y-6">
          <PLSectionLabel index="1" title="المبيعات (قيمة الأوردرات)" color="green" />

          {/* المبيعات */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  إجمالي المبيعات
                </div>
                <div className="text-xs text-gray-500">مجموع قيمة الأوردر كاملة، سواء اتحصّلت أو لسه · {pl.salesCount} عملية</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-green-600">
              + {formatNumber(salesTotalForSummary)}
            </div>
          </div>

          {/* المرتجعات */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  الأوردرات الراجعة
                </div>
                <div className="text-xs text-gray-500">بتتشال من المبيعات · {returnedCount} أوردر</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600">
              − {formatNumber(returnedTotal)}
            </div>
          </div>

          {/* صافي الإيرادات / قيمة الأوردرات */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  صافي المبيعات
                </div>
                <div className="text-xs text-gray-500">إجمالي قيمة الأوردرات ناقص الراجع · مش مبلغ التحصيل. مثال: بيع 1000 وتحصيل 500 → الحسبة على 1000</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              = {formatNumber(periodData?.sales?.total ?? 0)}
            </div>
          </div>

          <PLSectionLabel index="2" title="تكلفة البضاعة اللي اتباعت" color="orange" />

          {/* تكلفة البضاعة المباعة الإجمالية */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  تكلفة البضاعة اللي اتباعت
                </div>
                <div className="text-xs text-gray-500">
                  سعر التكلفة المسجّل وقت البيع مضروب في الكمية
                  {pl.cogsCoverageRate != null && ` · متسجّل تكلفتها ${formatNumber(pl.cogsCoverageRate)}% من المبيعات`}
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {formatNumber(pl.cogs)}
            </div>
          </div>

          {/* تكلفة البضاعة المرتجعة */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  تكلفة البضاعة اللي رجعت (تتشال من التكلفة)
                </div>
                <div className="text-xs text-gray-500">
                  من كمية وتكلفة الصنف: {formatNumber(pl.actualReturnedCogs)}
                  {(pl.itemRatioReturnedCogs ?? 0) > 0 && ` · من نسبة تكلفة الصنف: ${formatNumber(pl.itemRatioReturnedCogs)}`}
                  {(pl.estimatedReturnedCogs ?? 0) > 0 && ` · بالتقريب: ${formatNumber(pl.estimatedReturnedCogs)}`}
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600">
              − {formatNumber(pl.returnedCogs)}
            </div>
          </div>

          {/* تكلفة البضاعة المباعة */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  صافي تكلفة البضاعة
                </div>
                <div className="text-xs text-gray-500">
                  تكلفة المباع ناقص تكلفة الراجع · وملهاش علاقة بالفلوس اللي اتحصّلت
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              = {formatNumber(pl.netCogs)}
            </div>
          </div>

          <PLSectionLabel index="3" title="المكسب قبل المصاريف" color="blue" />

          {/* الربح الإجمالي */}
          <div className={`flex items-center justify-between pb-4 border-b-2 ${
            theme === 'dark' ? 'border-gray-600' : 'border-gray-400'
          }`}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  المكسب قبل المصاريف
                </div>
                <div className="text-xs text-gray-500">
                  صافي المبيعات ناقص صافي تكلفة البضاعة
                  {pl.grossProfitMargin != null && ` · يعني ${formatNumber(pl.grossProfitMargin)}% من صافي المبيعات`}
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              = {formatNumber(pl.grossProfit)}
            </div>
          </div>

          <PLSectionLabel index="4" title="المصاريف اللي طلعت" color="red" />

          {/* المصروفات الخارجية */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100 text-red-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  المصاريف اللي طلعت (خارج)
                </div>
                <div className="text-xs text-gray-500">إيجار، كهربا، مرتبات، تصليحات، وهكذا.</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600">
              − {formatNumber(pl.operatingExpenses)}
            </div>
          </div>

          <PLSectionLabel index="5" title="فلوس داخلة تانية" color="emerald" />

          {/* المصروفات الداخلية */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-gray-600">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  فلوس داخلة تانية (داخل)
                </div>
                <div className="text-xs text-gray-500">الحركات المسجّلة «داخل»: دخل إضافي، مكافآت، عمولات.</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              + {formatNumber(pl.otherIncome)}
            </div>
          </div>

          <PLSectionLabel index="6" title="النتيجة في الآخر" color="green" />

          {/* صافي الربح/الخسارة */}
          <div className={`flex items-center justify-between pt-4 p-6 rounded-xl ${
            profitStats.netIncome >= 0 
              ? 'bg-green-50 dark:bg-green-900/20' 
              : 'bg-red-50 dark:bg-red-900/20'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-lg ${
                profitStats.netIncome >= 0 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-red-100 text-red-600'
              }`}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {profitStats.netIncome >= 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  )}
                </svg>
              </div>
              <div>
                <div className={`text-lg font-bold ${
                  profitStats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {profitStats.netIncome >= 0 ? 'صافي المكسب' : 'صافي الخسارة'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  محسوب على قيمة الأوردرات، مش على اللي اتحصّل من العميل
                  {pl.netProfitMargin != null && ` · يعني ${formatNumber(pl.netProfitMargin)}% من صافي المبيعات`}
                </div>
              </div>
            </div>
            <div className={`text-4xl font-bold ${
              profitStats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              = {formatNumber(Math.abs(profitStats.netIncome))} ج.م
            </div>
          </div>

          <PLSectionLabel index="7" title="الفلوس المحصّلة واللي لسه عند العملاء" color="teal" />

          <div className={`p-4 rounded-lg border-2 border-dashed ${
            theme === 'dark' ? 'border-teal-700 bg-teal-900/10' : 'border-teal-300 bg-teal-50/60'
          }`}>
            <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-teal-300' : 'text-teal-700'}`}>
              الأرقام دي <strong>حركة فلوس وأرصدة</strong> ومش داخلة في حسبة المكسب اللي فوق.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <div>
                  <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    إجمالي الفلوس اللي اتحصّلت
                  </div>
                  <div className="text-xs text-gray-500">
                    دفعات مع الأوردر {formatNumber(pl.collectionsFromSaleOrders)} · دفعات لوحدها {formatNumber(pl.collectionsFromSeparatePayments)}
                  </div>
                </div>
                <div className="text-xl font-bold text-teal-600">{formatNumber(pl.collections)}</div>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <div>
                  <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    فلوس متحصّلة في مقابل بيع فعلي
                  </div>
                  <div className="text-xs text-gray-500">
                    اتحصّل {pl.collectionRate != null ? `${formatNumber(pl.collectionRate)}%` : '—'} من صافي المبيعات
                  </div>
                </div>
                <div className="text-xl font-bold text-blue-600">{formatNumber(pl.allocatedCollections)}</div>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <div>
                  <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    فلوس زيادة عن قيمة البيع (ليك عند العميل)
                  </div>
                  <div className="text-xs text-gray-500">
                    مش بتتحسب مكسب · {pl.customersWithCredit || 0} عميل
                  </div>
                </div>
                <div className="text-xl font-bold text-amber-600">{formatNumber(pl.unallocatedCollections)}</div>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <div>
                  <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    فلوس لسه عند العملاء
                  </div>
                  <div className="text-xs text-gray-500">
                    صافي المبيعات ناقص اللي اتحصّل منها · {pl.customersWithReceivable || 0} عميل
                  </div>
                </div>
                <div className="text-xl font-bold text-red-600">{formatNumber(pl.accountsReceivable)}</div>
              </div>
            </div>
          </div>

          {/* معلومات إضافية */}
          <div className={`mt-6 p-4 rounded-lg ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
          }`}>
            <div className="flex items-start gap-3">
              <svg className={`w-5 h-5 mt-0.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <p className="font-semibold mb-2">الحسبة ماشية كده:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>صافي المبيعات = مجموع قيمة الأوردرات ناقص الأوردرات الراجعة (حتى لو العميل دفع جزء بس)</li>
                  <li>مثال: أوردر 1000 وتحصيل 500 → المبيعات 1000 والتحصيل 500 والباقي عند العميل 500</li>
                  <li>صافي تكلفة البضاعة = تكلفة اللي اتباع ناقص تكلفة اللي رجع (بسعر تكلفة الصنف نفسه)</li>
                  <li>المكسب قبل المصاريف = صافي المبيعات ناقص صافي تكلفة البضاعة</li>
                  <li>صافي المكسب = المكسب قبل المصاريف ناقص المصاريف وزائد الفلوس الداخلة التانية</li>
                  <li>الفلوس اللي اتحصّلت <strong>مش بتتحسب مكسب ولا بتقلّله</strong>، واللي لسه متحصّلش يبان كفلوس عند العملاء</li>
                  <li>نسبة المكسب قبل المصاريف: {pl.grossProfitMargin != null ? `${formatNumber(pl.grossProfitMargin)}%` : '—'} · نسبة صافي المكسب: {pl.netProfitMargin != null ? `${formatNumber(pl.netProfitMargin)}%` : '—'}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ملخص المكسب والخسارة */}
      <SectionHeader
        title="ملخص المكسب والخسارة"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
        description="نظرة سريعة على النتيجة"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="صافي المبيعات"
          value={formatNumber(pl.netSales ?? 0)}
          subtitle="قيمة الأوردرات بعد شيل الراجع"
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />

        <StatCard
          title="المكسب قبل المصاريف"
          value={formatNumber(profitStats.grossProfit)}
          subtitle="صافي المبيعات ناقص تكلفة البضاعة"
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />

        <StatCard
          title={profitData.netIncome >= 0 ? "صافي المكسب" : "صافي الخسارة"}
          value={formatNumber(Math.abs(profitData.netIncome))}
          subtitle="بعد المصاريف والفلوس الداخلة التانية"
          color={profitData.netIncome >= 0 ? 'green' : 'red'}
          icon={
            profitData.netIncome >= 0 ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            )
          }
        />
      </div>

      {/* Inventory Overview */}
      <SectionHeader
        title="المخزون"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
        description="إحصائيات المخزون والأقسام"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="عدد الأقسام"
          value={stats.sectionsCount || 0}
          subtitle="قسم"
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        
        <StatCard
          title="عدد الأصناف"
          value={stats.inventoryCount || 0}
          subtitle="صنف"
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        
        <StatCard
          title="إجمالي الأمتار"
          value={formatNumber(stats.inventoryTotalMeters || 0)}
          subtitle="متر"
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
            </svg>
          }
        />
        
        <StatCard
          title="إجمالي الكيلوهات"
          value={formatNumber(stats.inventoryTotalKilos || 0)}
          subtitle="كيلو"
          color="red"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          }
        />
            </div>

      {/* Top Selling Items - grouped by section */}
      {topSelling && topSelling.length > 0 && (() => {
        const searchQuery = (topSellingSearch || '').trim().toLowerCase()

        // Group by section_name
        const sectionMap = {}
        topSelling.forEach((item) => {
          const sec = (item.section_name || '').trim()
          if (!sec) return
          if (!sectionMap[sec]) sectionMap[sec] = []
          sectionMap[sec].push(item)
        })

        let sectionEntries = Object.entries(sectionMap).map(([sectionName, items]) => {
          if (!searchQuery) return [sectionName, items]

          const sectionMatches = sectionName.toLowerCase().includes(searchQuery)
          const filteredItems = items.filter((item) => {
            const itemLabel = `${item.item_name || ''} ${item.color_number || ''}`.trim().toLowerCase()
            return itemLabel.includes(searchQuery)
          })

          if (sectionMatches) return [sectionName, items]
          if (filteredItems.length > 0) return [sectionName, filteredItems]
          return null
        }).filter(Boolean)

        if (!sectionEntries.length && !searchQuery) return null

        return (
          <>
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    theme === 'dark' ? 'bg-camel/20 text-camel' : 'bg-brown/20 text-brown'
                  }`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <h2 className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-camel' : 'text-brown'
                  }`}>
                    أكثر الأصناف مبيعاً
                  </h2>
                </div>
                <div className="relative w-full sm:w-72">
                  <svg
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                  </svg>
                  <input
                    type="text"
                    value={topSellingSearch}
                    onChange={(e) => setTopSellingSearch(e.target.value)}
                    placeholder="بحث عن قسم أو صنف..."
                    className={`w-full pr-10 pl-3 py-2 rounded-lg border text-sm outline-none transition ${
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 focus:border-camel'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-brown'
                    }`}
                  />
                </div>
              </div>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                الأصناف اللي العملاء بيطلبوها أكتر — مقسّمة على الأقسام (بعد شيل الراجع)
              </p>
            </div>

            {sectionEntries.length === 0 ? (
              <div className={`rounded-xl border-2 px-5 py-8 text-center ${
                theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
              }`}>
                لا توجد نتائج مطابقة للبحث
              </div>
            ) : (
            <div className="space-y-3">
              {sectionEntries.map(([sectionName, items]) => {
                const isOpen = expandedSections[sectionName] ?? false
                const sectionTotal = items.reduce((s, i) => s + (i.total || 0), 0)
                const sectionQty = items.reduce((s, i) => s + (i.qty || 0), 0)

                return (
                  <div
                    key={sectionName}
                    className={`rounded-xl border-2 overflow-hidden transition-all ${
                      theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Section header / dropdown trigger */}
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionName)}
                      className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${
                        theme === 'dark'
                          ? 'bg-gray-800 hover:bg-gray-750 text-gray-100'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Chevron */}
                        <svg
                          className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'} ${
                            theme === 'dark' ? 'text-camel' : 'text-brown'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {items.length} صنف
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            إجمالي: <span className={`font-semibold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{formatNumber(sectionTotal)} ج.م</span>
                            &nbsp;•&nbsp;
                            كمية: <span className={`font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{formatNumber(sectionQty)}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-camel/20 text-camel' : 'bg-brown/20 text-brown'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <span className={`font-bold text-lg ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                            {sectionName}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              requestDeleteTopSellingSection(sectionName)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                e.stopPropagation()
                                requestDeleteTopSellingSection(sectionName)
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'text-red-300 hover:text-red-200 hover:bg-red-900/30'
                                : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                            title={`حذف قسم ${sectionName} من الأكثر مبيعاً`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Items table - collapsible */}
                    {isOpen && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                            <tr>
                              <th className={`px-5 py-3 text-right text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>الترتيب</th>
                              <th className={`px-5 py-3 text-right text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>اسم الصنف</th>
                              <th className={`px-5 py-3 text-right text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>الكمية المباعة</th>
                              <th className={`px-5 py-3 text-right text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>إجمالي المبيعات</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'}`}>
                            {items.map((item, index) => (
                              <tr
                                key={item.inventoryId}
                                className={`transition-colors ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
                              >
                                <td className={`px-5 py-3 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                    index === 1 ? 'bg-slate-100 text-slate-700' :
                                    index === 2 ? 'bg-orange-100 text-orange-700' :
                                    theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className={`px-5 py-3 text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                                  {item.item_name
                                    ? (item.color_number ? `${item.item_name} ${item.color_number}` : item.item_name)
                                    : 'غير محدد'}
                                </td>
                                <td className={`px-5 py-3 text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                                  {formatNumber(item.qty)}
                                </td>
                                <td className={`px-5 py-3 text-sm font-semibold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                                  {formatNumber(item.total)} ج.م
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            )}
          </>
        )
      })()}

      {/* Low Inventory Alert */}
      {stats.lowInventoryItems && stats.lowInventoryItems.length > 0 && (
        <>
          <SectionHeader
            title="تنبيه المخزون المنخفض"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            }
            description="أصناف محتاجة تتجدد"
          />
          
          <div className={`rounded-xl border-2 border-red-200 ${
            theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
          }`}>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.lowInventoryItems.slice(0, 6).map((item) => (
                  <div key={item.id} className={`p-4 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <h4 className={`font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                    }`}>
                      {item.item_name || 'صنف غير محدد'}
                    </h4>
                    <p className={`text-sm mt-1 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      الكمية المتبقية: <span className="font-medium text-red-500">
                        {formatNumber(item.total_meters)}
            </span>
                    </p>
            </div>
                ))}
            </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteSectionDialogOpen}
        title="تأكيد حذف القسم من الأكثر مبيعاً"
        message={
          <div className="text-right">
            <p className="mb-2">
              هل أنت متأكد من حذف قسم "{pendingDeleteSectionName}" من قائمة الأكثر مبيعاً؟
            </p>
            <p className="text-sm text-red-500">
              سيتم إخفاء هذا القسم من تقرير الأكثر مبيعاً ولن يتم حذف بيانات المبيعات نفسها.
            </p>
          </div>
        }
        confirmText="حذف من الأكثر مبيعاً"
        cancelText="إلغاء"
        onConfirm={handleDeleteTopSellingSection}
        onCancel={() => {
          setDeleteSectionDialogOpen(false)
          setPendingDeleteSectionName('')
        }}
      />
    </div>
  )
}

export default Statistics