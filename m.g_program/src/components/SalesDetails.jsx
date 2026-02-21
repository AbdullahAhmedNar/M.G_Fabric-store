import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { formatNumber } from '../utils/format'
import * as XLSX from 'xlsx'

function SalesDetails({ sale, onClose }) {
  const { theme } = useTheme()
  const { addNotification } = useNotification()

  const handleExportExcel = () => {
    try {
      const data = [
        ['اسم العميل', sale.customer_name],
        ['الوصف', sale.description || 'غير محدد'],
        ['الكمية', sale.quantity],
        ['الوحدة', sale.unit || 'متر'],
        ['السعر (بالمتر)', sale.price],
        ['الإجمالي', sale.total],
        ['المسدّد', sale.paid],
        [sale.remaining < 0 ? 'المبلغ المستحق له' : 'الباقي', Math.abs(sale.remaining)],
        ['التاريخ', sale.date],
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
      XLSX.utils.book_append_sheet(wb, ws, 'تفاصيل البيع')
      const fileName = `تفاصيل_البيع_${sale.customer_name}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      addNotification('تم تصدير تفاصيل البيع بنجاح', 'success')
    } catch (e) {
      addNotification('فشل تصدير البيانات', 'error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="sticky top-0 z-10 p-6 border-b border-gray-200 dark:border-gray-700 bg-inherit">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 15l3-3 4 4 6-6" />
              </svg>
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>تفاصيل عملية البيع</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportExcel} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${theme === 'dark' ? 'bg-camel text-black hover:bg-camel/90' : 'bg-brown text-white hover:bg-brown/90'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                تصدير Excel
              </button>
              <button onClick={onClose} className={`p-2 rounded-lg transition ${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>البيانات الأساسية</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>اسم العميل:</span><span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{sale.customer_name}</span></div>
                <div className="flex justify-between items-center"><span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الوصف:</span><span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{sale.description || 'غير محدد'}</span></div>
                <div className="flex justify-between items-center"><span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>التاريخ:</span><span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{sale.date}</span></div>
              </div>
            </div>

            <div className={`p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>التفاصيل المالية</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>الكمية:</span><span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{sale.quantity} {sale.unit || 'متر'}</span></div>
                <div className="flex justify-between items-center"><span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>السعر (بالمتر):</span><span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatNumber(sale.price)} ج.م</span></div>
                <div className="flex justify-between items-center"><span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>القيمة:</span><span className={`font-bold text-lg ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>{formatNumber((sale.quantity || 0) * (sale.price || 0))} ج.م</span></div>
                <div className="flex justify-between items-center"><span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>المسدّد:</span><span className={`font-bold text-lg text-green-500`}>{formatNumber(sale.paid)} ج.م</span></div>
                <div className="flex justify-between items-center">
                  <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    {sale.remaining < 0 ? 'المبلغ المستحق له:' : 'الرصيد (الباقي):'}
                  </span>
                  <span className={`font-bold text-lg ${sale.remaining < 0 ? 'text-blue-500' : 'text-red-500'}`}>
                    {formatNumber(Math.abs(sale.remaining))} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`mt-6 p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>ملخص العملية</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {sale.remaining < 0 ? 'له مبلغ' : 'الباقي'}
                </p>
                <p className={`text-2xl font-bold ${sale.remaining < 0 ? 'text-blue-500' : (sale.remaining > 0 ? 'text-red-500' : 'text-green-500')}`}>
                  {formatNumber(Math.abs(sale.remaining || 0))} ج.م
                </p>
              </div>
              <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>حالة العملية</p>
                <p className={`text-lg font-bold ${sale.remaining < 0 ? 'text-blue-500' : (sale.remaining > 0 ? 'text-red-500' : 'text-green-500')}`}>
                  {sale.remaining < 0 ? 'له مبلغ مستحق' : (sale.remaining > 0 ? 'يوجد باقي' : 'مسدّدة بالكامل')}
                </p>
              </div>
              <div className={`p-4 rounded-lg text-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>قيمة البيع</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>{formatNumber(sale.quantity * sale.price)} ج.م</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SalesDetails

