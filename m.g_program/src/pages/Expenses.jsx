import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { exportExpensesToExcel } from '../utils/exportExcel'
import ConfirmDialog from '../components/ConfirmDialog'
import { formatNumber } from '../utils/format'

function Expenses() {
  const { theme } = useTheme()
  const { addNotification } = useNotification()
  const [expenses, setExpenses] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    direction: 'خارج',
    date: new Date().toISOString().split('T')[0]
  })
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [selectedDescription, setSelectedDescription] = useState('')

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      const res = await fetch('http://localhost:3456/api/expenses')
      const data = await res.json()
      setExpenses(data)
    } catch (e) {
      addNotification('خطأ في تحميل المصروفات', 'error')
    }
  }

  const openModal = (expense = null) => {
    if (expense) {
      setEditingId(expense.id)
      setFormData({
        description: expense.description || '',
        amount: expense.amount,
        direction: expense.direction || 'خارج',
        date: expense.date
      })
    } else {
      setEditingId(null)
      setFormData({ description: '', amount: '', direction: 'خارج', date: new Date().toISOString().split('T')[0] })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('handleSubmit called', formData)
    const amount = parseFloat(formData.amount) || 0
    if (amount <= 0) {
      addNotification('يرجى إدخال المبلغ', 'error')
      return
    }
    const payload = { ...formData, amount, direction: formData.direction === 'داخل' ? 'داخل' : 'خارج' }
    console.log('Sending payload:', payload)
    try {
      const url = editingId ? `http://localhost:3456/api/expenses/${editingId}` : 'http://localhost:3456/api/expenses'
      console.log('URL:', url)
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      console.log('Response:', res.status, res.ok)
      if (res.ok) {
        addNotification(editingId ? 'تم تعديل المصروف' : 'تم إضافة المصروف', 'success')
        fetchExpenses()
        closeModal()
      } else {
        addNotification('فشل الحفظ - كود الخطأ: ' + res.status, 'error')
      }
    } catch (e) {
      console.error('Error:', e)
      addNotification('حدث خطأ أثناء الحفظ: ' + e.message, 'error')
    }
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  const requestDelete = (id) => {
    setPendingDeleteId(id)
    setConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!pendingDeleteId) return
    try {
      await fetch(`http://localhost:3456/api/expenses/${pendingDeleteId}`, { method: 'DELETE' })
      addNotification('تم الحذف', 'info')
      fetchExpenses()
    } catch (e) {
      addNotification('فشل الحذف', 'error')
    } finally {
      setConfirmOpen(false)
      setPendingDeleteId(null)
    }
  }

  const filtered = expenses.filter(e => (e.description || '').includes(searchTerm) || (e.date || '').includes(searchTerm) || (e.direction || '').includes(searchTerm))
  const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0)
  const totalInside = expenses.filter(e => e.direction === 'داخل').reduce((acc, e) => acc + (e.amount || 0), 0)
  const totalOutside = expenses.filter(e => e.direction === 'خارج').reduce((acc, e) => acc + (e.amount || 0), 0)

  const handleExport = () => {
    if (exportExpensesToExcel(expenses)) {
      addNotification('تم تصدير المصروفات إلى Excel', 'success')
    } else {
      addNotification('فشل التصدير', 'error')
    }
  }

  const openDescriptionModal = (description) => {
    setSelectedDescription(description)
    setShowDescriptionModal(true)
  }

  const closeDescriptionModal = () => {
    setShowDescriptionModal(false)
    setSelectedDescription('')
  }

  const truncateText = (text, maxLength = 30) => {
    if (!text) return ''
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4 mb-6">
          <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-4.418 0-8 1.79-8 4v4h16v-4c0-2.21-3.582-4-8-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>المصروفات</h2>
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
            + إضافة مصروف
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
          placeholder="بحث بالتصنيف أو التاريخ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-3 pr-12 rounded-lg ${
            theme === 'dark' 
              ? 'bg-gray-900 border border-gray-700 text-white' 
              : 'bg-gray-100 border border-gray-300 text-gray-900'
          }`}
        />
      </div>

      <div className={`grid grid-cols-3 gap-4 mb-6`}>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-500">إجمالي الداخل</p>
          <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{formatNumber(totalInside)} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-500">إجمالي الخارج</p>
          <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{formatNumber(totalOutside)} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <p className="text-sm text-gray-500">عدد العمليات</p>
          <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>{filtered.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full table-fixed border ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
          <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}>
            <tr>
              <th className={`px-3 py-2 text-right border w-1/3 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الوصف</th>
              <th className={`px-3 py-2 text-right border w-20 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>النوع</th>
              <th className={`px-3 py-2 text-right border w-24 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>المبلغ</th>
              <th className={`px-3 py-2 text-right border w-32 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>التاريخ</th>
              <th className={`px-3 py-2 text-right border w-24 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(expense => (
              <tr key={expense.id}>
                <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                  <div 
                    className="cursor-pointer hover:text-blue-500 transition-colors"
                    onClick={() => openDescriptionModal(expense.description)}
                    title="انقر لعرض الوصف الكامل"
                  >
                    {truncateText(expense.description)}
                  </div>
                </td>
                <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{expense.direction || 'خارج'}</td>
                <td className={`px-3 py-2 text-center border ${theme === 'dark' ? 'border-gray-800 text-red-400' : 'border-gray-300 text-red-600'}`}>{formatNumber(expense.amount || 0)}</td>
                <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>{expense.date}</td>
                <td className={`px-3 py-2 border ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openModal(expense)} className="p-2 rounded text-blue-500 hover:text-blue-600" title="تعديل">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" />
                      </svg>
                    </button>
                    <button onClick={() => requestDelete(expense.id)} className="p-2 rounded text-red-500 hover:text-red-600" title="حذف">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-96 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              {editingId ? 'تعديل مصروف' : 'إضافة مصروف'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                placeholder="الوصف"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`w-full px-3 py-2 rounded resize-none ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                rows={4}
                style={{ 
                  minHeight: '80px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}
                required
              />
              <div>
                <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>النوع</label>
                <select
                  value={formData.direction}
                  onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                  className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                >
                  <option value="داخل">داخل</option>
                  <option value="خارج">خارج</option>
                </select>
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="المبلغ"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                required
              />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={`w-full px-3 py-2 rounded ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                required
              />
              <div className="flex gap-2">
                <button type="submit" className={`flex-1 py-2 rounded font-semibold ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}>
                  {editingId ? 'حفظ التعديلات' : 'إضافة'}
                </button>
                <button type="button" onClick={closeModal} className="flex-1 py-2 bg-gray-600 text-white rounded font-semibold">إلغاء</button>
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

      {/* Description Modal */}
      {showDescriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className={`p-6 rounded-lg w-96 max-w-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              الوصف الكامل
            </h3>
            <div 
              className={`w-full p-4 rounded border max-h-64 overflow-y-auto ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700 text-white' 
                  : 'bg-gray-100 border-gray-300 text-gray-900'
              }`}
              style={{ 
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}
            >
              {selectedDescription}
            </div>
            <div className="flex justify-end mt-4">
              <button 
                onClick={closeDescriptionModal}
                className={`px-4 py-2 rounded font-semibold ${theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'}`}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Expenses


