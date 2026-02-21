import { useTheme } from '../context/ThemeContext'

function ConfirmDialog({ open, title, message, confirmText = 'حذف', cancelText = 'إلغاء', onConfirm, onCancel }) {
  const { theme } = useTheme()

  if (!open) return null

  const baseBg = theme === 'dark' ? 'bg-gray-900' : 'bg-white'
  const baseText = theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
  const overlay = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  const panel = `w-[420px] rounded-lg p-5 ${baseBg} ${baseText} shadow-xl border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`
  const dangerBg = theme === 'dark' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'
  const neutralBg = theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
  const accent = theme === 'dark' ? 'text-camel' : 'text-brown'

  return (
    <div className={overlay} role="dialog" aria-modal="true">
      <div className={panel}>
        <div className="flex items-center gap-3 mb-3">
          <svg className={`w-6 h-6 ${accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M10.29 3.86l-7.4 12.8A2 2 0 004.6 20h14.8a2 2 0 001.71-3.34l-7.4-12.8a2 2 0 00-3.42 0z" />
          </svg>
          <h3 className="text-lg font-bold">{title || 'تأكيد الحذف'}</h3>
        </div>
        <div className="text-sm mb-5 leading-relaxed">{message || 'هل أنت متأكد من عملية الحذف؟ لا يمكن التراجع.'}</div>
        <div className="flex gap-3">
          <button onClick={onConfirm} className={`flex-1 py-2 rounded font-semibold text-white ${dangerBg}`}>{confirmText}</button>
          <button onClick={onCancel} className={`flex-1 py-2 rounded font-semibold ${neutralBg}`}>{cancelText}</button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog





















