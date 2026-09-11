import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { formatNumber } from '../utils/format'

function SalesDetails({ sale, sections = [], inventory = [], onClose }) {
  const { theme, appName } = useTheme()
  const { addNotification } = useNotification()
  const isFromInventory = !!sale?.inventory_item_id
  const sectionName =
    sections.find((section) => String(section.id) === String(sale?.section_id))?.name || '-'
  const inventoryItem =
    inventory.find((item) => String(item.id) === String(sale?.inventory_item_id)) || null
  const inventoryItemName =
    (inventoryItem?.item_name || inventoryItem?.color_number || '').toString().trim() || '-'
  const totalValue = (sale?.quantity || 0) * (sale?.price || 0)
  const remainingValue = sale?.remaining || 0

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const handlePrintPdf = () => {
    try {
      const total = totalValue || 0
      const paid = parseFloat(sale?.paid) || 0
      const remaining = total - paid
      const today = sale?.date || new Date().toISOString().split('T')[0]
      const storeName = appName || 'M.G FASHION FABRIC'
      const description = sale?.description || 'صنف'
      const quantity = parseFloat(sale?.quantity) || 0
      const unit = sale?.unit || 'متر'
      const price = parseFloat(sale?.price) || 0

      const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>فاتورة بيع - ${escapeHtml(sale?.customer_name || '')}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              direction: rtl;
              background: #f5f5f5;
              display: flex;
              justify-content: center;
              padding: 20px 0;
            }
            .receipt {
              background: #fff;
              width: 300px;
              box-shadow: 0 2px 12px rgba(0,0,0,0.12);
              padding: 16px;
            }
            .store-name {
              text-align: center;
              font-size: 18px;
              font-weight: 800;
              color: #8b5e3c;
              margin-bottom: 12px;
            }
            .sep { border-top: 1px solid #d1d5db; margin: 10px 0; }
            .meta { text-align: right; }
            .meta p { font-size: 12px; color: #4b5563; margin: 2px 0; }
            .title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; }
            .item-name { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 4px; }
            .item-line { font-size: 12px; color: #4b5563; margin-bottom: 3px; }
            .totals { margin-top: 8px; }
            .row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
            .row .paid { color: #16a34a; font-weight: 700; }
            .row .remain-pos { color: #dc2626; font-weight: 700; }
            .row .remain-neg { color: #2563eb; font-weight: 700; }
            .thanks { text-align: center; margin-top: 12px; }
            .thanks p:first-child { color: #8b5e3c; font-weight: 700; font-size: 13px; }
            .thanks p:last-child { color: #6b7280; font-size: 11px; margin-top: 2px; }
            @media print {
              body { background: #fff; padding: 0; }
              .receipt { box-shadow: none; width: 300px; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="store-name">${escapeHtml(storeName)}</div>
            <div class="sep"></div>
            <div class="meta">
              <div class="title">فاتورة بيع</div>
              <p>التاريخ: ${escapeHtml(today)}</p>
              <p>العميل: ${escapeHtml(sale?.customer_name || '-')}</p>
            </div>
            <div class="sep"></div>
            <div class="item-name">${escapeHtml(description)}</div>
            <div class="item-line">${escapeHtml(formatNumber(quantity))} ${escapeHtml(unit)} × ${escapeHtml(formatNumber(price))} ج.م = ${escapeHtml(formatNumber(total))} ج.م</div>
            <div class="item-line">القسم: ${escapeHtml(sectionName)}</div>
            <div class="item-line">الصنف: ${escapeHtml(inventoryItemName)}</div>
            <div class="item-line">عدد الأتواب: ${escapeHtml(sale?.rolls_sold ?? '-')}</div>
            <div class="sep"></div>
            <div class="totals">
              <div class="row"><span>الإجمالي:</span><span>${escapeHtml(formatNumber(total))} ج.م</span></div>
              <div class="row"><span>المدفوع:</span><span class="paid">${escapeHtml(formatNumber(paid))} ج.م</span></div>
              <div class="row"><span>${remaining < 0 ? 'له مبلغ:' : 'الباقي:'}</span><span class="${remaining < 0 ? 'remain-neg' : 'remain-pos'}">${escapeHtml(formatNumber(Math.abs(remaining)))} ج.م</span></div>
            </div>
            <div class="sep"></div>
            <div class="thanks">
              <p>أهلاً وسهلاً بك</p>
              <p>نتمنى لكم تجربة تسوق ممتعة</p>
            </div>
          </div>
        </body>
        </html>
      `

      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        addNotification('تعذر فتح نافذة الطباعة', 'error')
        return
      }
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 250)
      addNotification('تم تجهيز PDF للطباعة', 'success')
    } catch (e) {
      addNotification('فشل تجهيز ملف PDF', 'error')
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
              <button onClick={handlePrintPdf} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${theme === 'dark' ? 'bg-camel text-black hover:bg-camel/90' : 'bg-brown text-white hover:bg-brown/90'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V4h12v5M6 18h12m-9 0v2h6v-2m-9 0H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                </svg>
                طباعة PDF
              </button>
              <button onClick={onClose} className={`p-2 rounded-lg transition ${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-camel/30' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <svg className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4m2 8H7a2 2 0 01-2-2V6a2 2 0 012-2h6l6 6v8a2 2 0 01-2 2z" />
                </svg>
                <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>إجمالي الأوردر</p>
              </div>
              <p className={`text-2xl font-extrabold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>{formatNumber(totalValue)} ج.م</p>
            </div>
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-camel/20' : 'bg-stone-50 border-stone-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <svg className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2m-2 0h14a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9a1 1 0 011-1z" />
                </svg>
                <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>المسدّد</p>
              </div>
              <p className={`text-2xl font-extrabold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>{formatNumber(sale.paid || 0)} ج.م</p>
            </div>
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <svg className={`w-5 h-5 shrink-0 ${remainingValue < 0 ? 'text-blue-500' : remainingValue > 0 ? 'text-red-500' : (theme === 'dark' ? 'text-camel' : 'text-brown')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h5M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
                <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  {remainingValue < 0 ? 'له مبلغ' : 'الباقي'}
                </p>
              </div>
              <p className={`text-2xl font-extrabold ${remainingValue < 0 ? 'text-blue-500' : remainingValue > 0 ? 'text-red-500' : (theme === 'dark' ? 'text-camel' : 'text-brown')}`}>
                {formatNumber(Math.abs(remainingValue))} ج.م
              </p>
            </div>
          </div>

          <div className={`p-5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>بيانات الأوردر</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={`p-3 rounded-lg flex items-start gap-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <svg className={`w-5 h-5 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 6.197M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div className="min-w-0"><p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>العميل</p><p className="font-semibold">{sale.customer_name || '-'}</p></div>
              </div>
              <div className={`p-3 rounded-lg flex items-start gap-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <svg className={`w-5 h-5 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-13 9h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg>
                <div className="min-w-0"><p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>التاريخ</p><p className="font-semibold">{sale.date || '-'}</p></div>
              </div>
              <div className={`p-3 rounded-lg flex items-start gap-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <svg className={`w-5 h-5 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h8l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>
                <div className="min-w-0"><p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>البيان</p><p className="font-semibold">{sale.description || 'غير محدد'}</p></div>
              </div>
              <div className={`p-3 rounded-lg flex items-start gap-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <svg className={`w-5 h-5 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-3m-6 0H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2h-3m-6 0H6a2 2 0 01-2-2v-4m16 0H4" /></svg>
                <div className="min-w-0"><p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>مصدر البيع</p><p className="font-semibold">{isFromInventory ? 'من المخزون' : 'بدون مخزون'}</p></div>
              </div>
              <div className={`p-3 rounded-lg flex items-start gap-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <svg className={`w-5 h-5 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7l1 11a2 2 0 002 2h8a2 2 0 002-2l1-11M9 7V5a3 3 0 016 0v2" /></svg>
                <div className="min-w-0"><p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>القسم</p><p className="font-semibold">{isFromInventory ? sectionName : '-'}</p></div>
              </div>
              <div className={`p-3 rounded-lg flex items-start gap-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <svg className={`w-5 h-5 mt-0.5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4m16 0l-3-3m3 3l-3 3M4 12l3-3m-3 3l3 3" /></svg>
                <div className="min-w-0"><p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>الصنف</p><p className="font-semibold">{isFromInventory ? inventoryItemName : '-'}</p></div>
              </div>
            </div>
          </div>

          <div className={`p-5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>الكميات والتسعير</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a3 3 0 016 0v6M6 21h12" /></svg>
                  <p className="text-xs text-gray-500">الكمية</p>
                </div>
                <p className="font-bold">{formatNumber(sale.quantity || 0)}</p>
              </div>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h10" /></svg>
                  <p className="text-xs text-gray-500">الوحدة</p>
                </div>
                <p className="font-bold">{sale.unit || 'متر'}</p>
              </div>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m-4-4h8" /></svg>
                  <p className="text-xs text-gray-500">عدد الأتواب</p>
                </div>
                <p className="font-bold">{sale.rolls_sold ?? '-'}</p>
              </div>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.5 0-4 1-4 2s1.5 2 4 2 4 1 4 2-1.5 2-4 2m0-10V6m0 12v-2" /></svg>
                  <p className="text-xs text-gray-500">السعر / الوحدة</p>
                </div>
                <p className="font-bold">{formatNumber(sale.price || 0)} ج.م</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SalesDetails

