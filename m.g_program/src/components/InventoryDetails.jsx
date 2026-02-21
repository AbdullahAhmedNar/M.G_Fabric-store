import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { formatNumber } from '../utils/format'
import * as XLSX from 'xlsx'

function InventoryDetails({ item, onClose }) {
  const { theme } = useTheme()
  const { addNotification } = useNotification()

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
      
      // RTL support
      ws['!cols'] = Array(2).fill({ wch: 20 })
      
      // Set RTL direction for all cells
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          if (ws[cellAddress]) {
            ws[cellAddress].s = {
              ...ws[cellAddress].s,
              alignment: {
                horizontal: 'right',
                vertical: 'center',
                readingOrder: 2 // RTL
              }
            }
          }
        }
      }
      
      const wb = XLSX.utils.book_new()
      wb.Workbook = { Views: [{ RTL: true }] }
      ws['!rtl'] = true
      XLSX.utils.book_append_sheet(wb, ws, 'تفاصيل المخزون')
      const fileName = `تفاصيل_المخزون_${item.item_name}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      addNotification('تم تصدير تفاصيل المخزون بنجاح', 'success')
    } catch (e) {
      addNotification('فشل تصدير البيانات', 'error')
    }
  }

  const getStatusColor = () => {
    if (!item.rolls_count) return 'text-gray-500'
    if (item.rolls_count <= 2) return 'text-red-500'
    if (item.rolls_count <= 5) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getStatusText = () => {
    if (!item.rolls_count) return 'غير محدد'
    if (item.rolls_count <= 2) return 'مخزون منخفض'
    if (item.rolls_count <= 5) return 'مخزون متوسط'
    return 'مخزون جيد'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="sticky top-0 z-10 p-6 border-b border-gray-200 dark:border-gray-700 bg-inherit">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                تفاصيل المخزون: {item.item_name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                  theme === 'dark' ? 'bg-camel text-black hover:bg-camel/90' : 'bg-brown text-white hover:bg-brown/90'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                تصدير Excel
              </button>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition ${
                  theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Simple stock overview only */}
          <div className={`p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              حالة المخزون
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>حالة المخزون</p>
                <p className={`text-lg font-bold ${getStatusColor()}`}>{getStatusText()}</p>
              </div>
              <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>نسبة الاستخدام</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                  {item.rolls_count && item.rolls_count > 0 ? Math.round((item.total_meters / (item.rolls_count * 100)) * 100) : 0}%
                </p>
              </div>
              <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>قيمة المخزون</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                  {formatNumber((parseFloat(item.total_meters) || 0) * (parseFloat(item.purchase_price) || 0))} ج.م
                </p>
                <p className="text-xs text-gray-500">{item.purchase_price ? `${formatNumber(item.purchase_price)} × ${formatNumber(item.total_meters)}` : 'لم يُحدد سعر الشراء'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InventoryDetails





