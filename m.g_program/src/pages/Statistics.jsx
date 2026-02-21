import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { exportStatisticsToExcel } from '../utils/exportExcel'
import { formatNumber } from '../utils/format'
import { apiUrl } from '../utils/api'

function Statistics() {
  const { theme } = useTheme()
  const { addNotification } = useNotification()
  const [stats, setStats] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [loading, setLoading] = useState(true)

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

  const handleExportExcel = () => {
    if (exportStatisticsToExcel(stats)) {
      addNotification('تم تصدير الإحصائيات إلى Excel', 'success')
    } else {
      addNotification('فشل التصدير', 'error')
    }
  }

  const handleRefresh = () => {
    fetchStatistics()
    addNotification('تم تحديث الإحصائيات', 'success')
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

  const calculateNetProfit = (periodData) => {
    if (!periodData) return { netIncome: 0, netProfit: 0, netLoss: 0 }
    
    // استخدام بيانات السنة المفلترة إذا كانت متاحة
    const yearData = selectedYear !== 'all' ? stats?.statsByYear?.[selectedYear] : null
    const profitStats = yearData?.profit ?? {
      netIncome: stats?.netIncome ?? 0,
      netProfit: stats?.netProfit ?? 0,
      netLoss: stats?.netLoss ?? 0,
    }
    
    return { 
      netIncome: profitStats.netIncome, 
      netProfit: profitStats.netProfit, 
      netLoss: profitStats.netLoss 
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

  const periodData = getPeriodData(selectedPeriod)
  const profitData = calculateNetProfit(periodData)

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
  
  // بيانات الأرباح والخسائر حسب السنة
  const profitStats = yearData?.profit ?? {
    netIncome: stats?.netIncome ?? 0,
    netProfit: stats?.netProfit ?? 0,
    netLoss: stats?.netLoss ?? 0,
    grossProfit: stats?.grossProfit ?? 0,
    grossProfitMargin: stats?.grossProfitMargin ?? 0,
    costOfSoldItems: stats?.costOfSoldItems ?? 0,
    costOfReturned: stats?.costOfReturned ?? 0,
    netCostOfSoldItems: stats?.netCostOfSoldItems ?? 0,
  }
  
  // بيانات المبيعات الإجمالية للملخص المالي
  const salesTotalForSummary = yearData ? (yearData.sales.total + yearData.sales.returned) : (stats?.salesTotal ?? 0)
  const returnedTotal = yearData?.sales?.returned ?? stats?.returnedTotal ?? 0
  const returnedCount = stats?.returnedCount ?? 0

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
          </select>
          
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
            تصدير Excel
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
              ملاحظة مهمة حول الأرباح والخسائر
            </h3>
            <p className={`text-sm leading-relaxed ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              يتم حساب صافي الربح حسب المعايير المحاسبية: 
              <span className={`font-medium ${theme === 'dark' ? 'text-green-300' : 'text-green-600'}`}>
                صافي الربح = المبيعات - تكلفة البضاعة المباعة - المصروفات الخارجية + المصروفات الداخلية
              </span>. 
              <span className={`font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                المخزون المتبقي يعتبر أصل ولا يُخصم من الأرباح
              </span>، 
              <span className={`font-medium ${theme === 'dark' ? 'text-purple-300' : 'text-purple-600'}`}>
                والمدفوعات للموردين هي سداد ديون ولا تؤثر مباشرة على الأرباح
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
        description="نظرة عامة على الوضع المالي للعمل"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard
          title="إجمالي المبيعات"
          value={formatNumber(salesTotalForSummary)}
          subtitle="جملة الأوردرات (قبل المرتجعات)"
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
          subtitle="بعد خصم المرتجعات"
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="إجمالي المبلغ المسدد"
          value={formatNumber(periodData?.sales.paid || 0)}
          subtitle="ج.م"
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        {customersRemainingFromBackend > 0 && (
          <StatCard
            title="إجمالي المبلغ المتبقي"
            value={formatNumber(customersRemainingFromBackend)}
            subtitle="ج.م"
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
        title="المصروفات"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-4.418 0-8 1.79-8 4v4h16v-4c0-2.21-3.582-4-8-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        }
        description="تحليل المصروفات الداخلية والخارجية"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="المصروفات الخارجية"
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
          title="المصروفات الداخلية"
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
          title="عدد المصروفات"
          value={periodData?.expenses.count || 0}
          subtitle="مصروف"
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
        title="تفاصيل حساب الربح والخسارة"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
        description="المعادلة المحاسبية الكاملة لحساب صافي الربح"
      />
      
      <div className={`p-8 rounded-xl border-2 mb-8 ${
        theme === 'dark' 
          ? 'bg-gray-900 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="space-y-6">
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
                  إجمالي المبيعات (إيرادات)
                </div>
                <div className="text-xs text-gray-500">إجمالي قيمة جميع عمليات البيع</div>
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
                  الأوردرات الراجعة (تطرح)
                </div>
                <div className="text-xs text-gray-500">من كشوف حسابات العملاء · {stats?.returnedCount ?? 0} أوردر</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600">
              − {formatNumber(returnedTotal)}
            </div>
          </div>

          {/* صافي الإيرادات */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  صافي الإيرادات
                </div>
                <div className="text-xs text-gray-500">المبيعات − المرتجعات</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              = {formatNumber(periodData?.sales?.total ?? 0)}
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
                  تكلفة البضاعة المباعة
                </div>
                <div className="text-xs text-gray-500">تكلفة الأصناف المباعة فقط (وليس كل المشتريات)</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              − {formatNumber(profitStats.netCostOfSoldItems)}
            </div>
          </div>

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
                  الربح الإجمالي (قبل المصروفات)
                </div>
                <div className="text-xs text-gray-500">صافي الإيرادات − تكلفة البضاعة المباعة</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              = {formatNumber(profitStats.grossProfit)}
            </div>
          </div>

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
                  المصروفات الخارجية (تطرح)
                </div>
                <div className="text-xs text-gray-500">إيجار، كهرباء، رواتب، صيانة، إلخ.</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600">
              - {formatNumber(periodData?.expenses?.outside ?? stats?.expensesOutside ?? 0)}
            </div>
          </div>

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
                  المصروفات الداخلية (تضاف)
                </div>
                <div className="text-xs text-gray-500">إيرادات إضافية، مكافآت، عمولات، إلخ.</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              + {formatNumber(periodData?.expenses?.inside ?? stats?.expensesInside ?? 0)}
            </div>
          </div>

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
                  {profitStats.netIncome >= 0 ? 'صافي الربح' : 'صافي الخسارة'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  الربح الإجمالي - المصروفات الخارجية + المصروفات الداخلية
                </div>
              </div>
            </div>
            <div className={`text-4xl font-bold ${
              profitStats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              = {formatNumber(Math.abs(profitStats.netIncome))} ج.م
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
                <p className="font-semibold mb-2">ملاحظة هامة:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>المرتجعات مسجّلة في <strong>كشوف حسابات العملاء</strong> وتُطرح من إجمالي المبيعات لحساب صافي الإيرادات</li>
                  <li>تكلفة البضاعة المباعة تحسب <strong>للأصناف المباعة فقط</strong> وليس لكل المشتريات</li>
                  <li>البضاعة المتبقية في المخزون لا تؤثر على الربح حتى يتم بيعها</li>
                  <li>هامش الربح الإجمالي: {formatNumber(profitStats.grossProfitMargin)}%</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profit & Loss Analysis */}
      <SectionHeader
        title="ملخص الأرباح والخسائر"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
        description="نظرة سريعة على النتائج المالية"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title={profitData.netIncome >= 0 ? "صافي الدخل" : "صافي الخسارة"}
          value={formatNumber(Math.abs(profitData.netIncome))}
          subtitle="ج.م"
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
        
        <StatCard
          title="صافي الأرباح"
          value={formatNumber(profitData.netProfit)}
          subtitle="ج.م"
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        
        <StatCard
          title={profitData.netIncome >= 0 ? "صافي المكسب" : "صافي الخسارة"}
          value={formatNumber(profitData.netIncome >= 0 ? profitData.netProfit : profitData.netLoss)}
          subtitle="ج.م"
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

      {/* Top Selling Items */}
      {topSelling && topSelling.length > 0 && (
        <>
          <SectionHeader
            title="أكثر الأصناف مبيعاً"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            description="الأصناف الأكثر طلباً من العملاء"
          />
          
          <div className={`rounded-xl border-2 ${
            theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <tr>
                    <th className={`px-6 py-4 text-right text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      الترتيب
                    </th>
                    <th className={`px-6 py-4 text-right text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      اسم الصنف
                    </th>
                    <th className={`px-6 py-4 text-right text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      القسم
                    </th>
                    <th className={`px-6 py-4 text-right text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      الكمية المباعة
                    </th>
                    <th className={`px-6 py-4 text-right text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      إجمالي المبيعات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topSelling.map((item, index) => (
                    <tr key={item.inventoryId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className={`px-6 py-4 text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                      }`}>
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                      }`}>
                        {item.item_name ? (item.color_number ? `${item.item_name} ${item.color_number}` : item.item_name) : 'غير محدد'}
                      </td>
                      <td className={`px-6 py-4 text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                      }`}>
                        {item.section_name || 'عام'}
                      </td>
                      <td className={`px-6 py-4 text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-900'
                      }`}>
                        {formatNumber(item.qty)}
                      </td>
                      <td className={`px-6 py-4 text-sm font-medium ${
                        theme === 'dark' ? 'text-green-400' : 'text-green-600'
                      }`}>
                        {formatNumber(item.total)} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

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
            description="أصناف تحتاج إلى إعادة تموين"
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
    </div>
  )
}

export default Statistics