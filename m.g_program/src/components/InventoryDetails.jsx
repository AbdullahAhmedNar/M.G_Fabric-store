import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { formatNumber } from '../utils/format'
import * as XLSX from 'xlsx'
import { apiUrl } from '../utils/api'

const TAB_SALES = 'sales'
const TAB_SUPPLIERS = 'suppliers'

function InventoryDetails({ item, onClose }) {
  const { theme } = useTheme()
  const { addNotification } = useNotification()
  const [activeTab, setActiveTab] = useState(TAB_SALES)
  const [salesRows, setSalesRows] = useState([])
  const [returnedRows, setReturnedRows] = useState([])
  const [supplierRows, setSupplierRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!item?.id) return
      setLoading(true)
      try {
        const [salesRes, returnedRes, supplierRes] = await Promise.all([
          fetch(apiUrl(`/api/inventory/${item.id}/sales`)),
          fetch(apiUrl(`/api/inventory/${item.id}/returned-orders`)),
          fetch(apiUrl(`/api/inventory/${item.id}/supplier-orders`))
        ])
        const salesJson = await salesRes.json()
        const returnedJson = await returnedRes.json()
        const supplierJson = await supplierRes.json()
        setSalesRows(salesJson?.rows ?? [])
        setReturnedRows(returnedJson?.rows ?? [])
        setSupplierRows(supplierJson?.rows ?? [])
      } catch (e) {
        console.error('Error loading inventory transactions:', e)
        addNotification('فشل تحميل معاملات الصنف', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [item?.id])

  const handleExportExcel = () => {
    try {
      const data = [
        ['اسم الصنف', item.item_name],
        ['نوع المنتج', item.product_type || 'عام'],
        ['رقم اللون', item.color_number || 'غير محدد'],
        ['عدد الأتواب', item.rolls_count || 'غير محدد'],
        ['الكمية', item.total_meters],
        ['الوحدة', item.unit || 'متر'],
        ['تاريخ الإضافة', new Date().toLocaleDateString('ar-EG')]
      ]
      const ws = XLSX.utils.aoa_to_sheet(data)

      ws['!cols'] = Array(2).fill({ wch: 20 })
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          if (ws[cellAddress]) {
            ws[cellAddress].s = { ...ws[cellAddress].s, alignment: { horizontal: 'right', vertical: 'center', readingOrder: 2 } }
          }
        }
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'تفاصيل المخزون')
      const fileName = `تفاصيل_المخزون_${item.item_name}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      addNotification('تم تصدير تفاصيل المخزون بنجاح', 'success')
    } catch (e) {
      addNotification('فشل تصدير البيانات', 'error')
    }
  }

  const displayName = `${item.item_name || 'صنف'}${item.color_number ? ' - رقم ' + item.color_number : ''}`

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="sticky top-0 z-10 p-6 border-b border-gray-200 dark:border-gray-700 bg-inherit">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                تفاصيل المخزون: {displayName}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${theme === 'dark' ? 'bg-camel text-black hover:bg-camel/90' : 'bg-brown text-white hover:bg-brown/90'}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                تصدير Excel
              </button>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition ${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Tabs: معاملات مبيعات | معاملات موردين */}
          <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab(TAB_SALES)}
              className={`px-4 py-2 rounded-t-lg font-semibold transition ${activeTab === TAB_SALES ? (theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white') : (theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}`}
            >
              معاملات مبيعات
            </button>
            <button
              onClick={() => setActiveTab(TAB_SUPPLIERS)}
              className={`px-4 py-2 rounded-t-lg font-semibold transition ${activeTab === TAB_SUPPLIERS ? (theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white') : (theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}`}
            >
              معاملات موردين
            </button>
          </div>

          {loading ? (
            <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>جاري التحميل...</div>
          ) : activeTab === TAB_SALES ? (
            <div className="space-y-6">
              <div>
                <h4 className={`text-md font-semibold mb-2 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>أوردرات مبيعات (عملاء)</h4>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className={`w-full text-right ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                    <thead className={theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}>
                      <tr>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">التاريخ</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">العميل</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">البيان</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">الكمية</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">السعر</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">الإجمالي</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">المسدّد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesRows.length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">لا توجد أوردرات مبيعات لهذا الصنف</td></tr>
                      ) : (
                        salesRows.map((row) => (
                          <tr key={`s-${row.id}`} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-3 py-2">{row.date}</td>
                            <td className="px-3 py-2">{row.customer_name}</td>
                            <td className="px-3 py-2">{row.description || '-'}</td>
                            <td className="px-3 py-2">{row.quantity} {row.unit || 'متر'}</td>
                            <td className="px-3 py-2">{formatNumber(row.price)}</td>
                            <td className="px-3 py-2">{formatNumber(row.total)}</td>
                            <td className="px-3 py-2 text-green-500">{formatNumber(row.paid)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 className={`text-md font-semibold mb-2 ${theme === 'dark' ? 'text-red-300' : 'text-red-600'}`}>أوردرات راجعة (مرتجعات)</h4>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className={`w-full text-right ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                    <thead className={theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}>
                      <tr>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">التاريخ</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">العميل</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">البيان</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">الكمية</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">السعر</th>
                        <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnedRows.length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">لا توجد أوردرات راجعة لهذا الصنف</td></tr>
                      ) : (
                        returnedRows.map((row) => (
                          <tr key={`r-${row.id}`} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="px-3 py-2">{row.date}</td>
                            <td className="px-3 py-2">{row.customer_name}</td>
                            <td className="px-3 py-2">{row.description || '-'}</td>
                            <td className="px-3 py-2">{row.quantity} {row.unit || 'متر'}</td>
                            <td className="px-3 py-2">{formatNumber(row.price)}</td>
                            <td className="px-3 py-2">{formatNumber((row.quantity || 0) * (row.price || 0))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h4 className={`text-md font-semibold mb-2 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>أوردرات الشراء من الموردين</h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className={`w-full text-right ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                  <thead className={theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}>
                    <tr>
                      <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">التاريخ</th>
                      <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">المورد</th>
                      <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">البيان</th>
                      <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">الكمية</th>
                      <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">السعر</th>
                      <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">الإجمالي</th>
                      <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">المسدّد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierRows.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">لا توجد أوردرات موردين لهذا الصنف</td></tr>
                    ) : (
                      supplierRows.map((row) => (
                        <tr key={`sup-${row.id}`} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">{row.description || '-'}</td>
                          <td className="px-3 py-2">{row.quantity} {row.unit || 'متر'}</td>
                          <td className="px-3 py-2">{formatNumber(row.price)}</td>
                          <td className="px-3 py-2">{formatNumber(row.total)}</td>
                          <td className="px-3 py-2 text-green-500">{formatNumber(row.paid)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InventoryDetails
