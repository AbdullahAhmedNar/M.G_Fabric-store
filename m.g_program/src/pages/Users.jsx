import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import ConfirmDialog from '../components/ConfirmDialog'
import jsPDF from 'jspdf'

function Users() {
  const { theme } = useTheme()
  const { addNotification } = useNotification()
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3456/api/users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      addNotification('خطأ في تحميل البيانات', 'error')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.username || !formData.password) {
      addNotification('الرجاء إدخال جميع البيانات', 'error')
      return
    }

    if (formData.password.length < 4) {
      addNotification('كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'error')
      return
    }

    try {
      const response = await fetch('http://localhost:3456/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        addNotification('تم إضافة المستخدم بنجاح', 'success')
        fetchUsers()
        closeModal()
      }
    } catch (error) {
      addNotification('حدث خطأ', 'error')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()

    if (!formData.username) {
      addNotification('الرجاء إدخال اسم المستخدم', 'error')
      return
    }

    try {
      addNotification('تم تحديث بيانات المستخدم بنجاح', 'success')
      fetchUsers()
      closeModal()
    } catch (error) {
      addNotification('حدث خطأ', 'error')
    }
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  const requestDelete = (id) => {
    setPendingDeleteId(id)
    setConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (users.length <= 1) {
      addNotification('لا يمكن حذف آخر مستخدم', 'warning')
      return
    }
    try {
      const resp = await fetch(`http://localhost:3456/api/users/${pendingDeleteId}`, { method: 'DELETE' })
      if (!resp.ok) {
        let msg = 'فشل الحذف'
        try {
          const data = await resp.json()
          if (data && data.message) msg = data.message
        } catch {}
        addNotification(msg, 'warning')
      } else {
        addNotification('تم حذف المستخدم', 'info')
        fetchUsers()
      }
    } catch (error) {
      addNotification('فشل الحذف', 'error')
    } finally {
      setConfirmOpen(false)
      setPendingDeleteId(null)
    }
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    
    doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal')
    
    doc.setFontSize(20)
    doc.setTextColor(139, 94, 60)
    doc.text('Users Report', 105, 20, { align: 'center' })
    
    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated: ${new Date().toLocaleDateString('ar-EG')}`, 105, 30, { align: 'center' })
    
    doc.setDrawColor(139, 94, 60)
    doc.setLineWidth(0.5)
    doc.line(20, 35, 190, 35)
    
    let yPosition = 50
    
    users.forEach((user, index) => {
      doc.setFillColor(245, 245, 245)
      doc.rect(20, yPosition - 5, 170, 15, 'F')
      
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text(`${index + 1}. Username: ${user.username}`, 25, yPosition)
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`ID: ${user.id}`, 25, yPosition + 6)
      
      yPosition += 20
      
      if (yPosition > 270) {
        doc.addPage()
        yPosition = 20
      }
    })
    
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text(`Total Users: ${users.length}`, 105, 285, { align: 'center' })
    
    doc.save('users-report.pdf')
    addNotification('تم تحميل ملف PDF بنجاح', 'success')
  }

  const openModal = () => {
    setEditingUser(null)
    setFormData({ username: '', password: '' })
    setShowModal(true)
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setFormData({ username: user.username, password: '' })
    setShowModal(true)
  }

  const openDetailsModal = (user) => {
    setSelectedUser(user)
    setShowDetailsModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setShowDetailsModal(false)
    setEditingUser(null)
    setSelectedUser(null)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4 mb-6">
          <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>المستخدمين</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openModal}
            className={`px-6 py-3 rounded-lg font-semibold ${
              theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
            }`}
          >
            + إضافة مستخدم جديد
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {users.map(user => (
          <div
            key={user.id}
            className={`p-6 rounded-lg flex justify-between items-center ${
              theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                theme === 'dark' ? 'bg-camel' : 'bg-brown'
              }`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className={`font-bold text-lg ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                  {user.username}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openDetailsModal(user)}
                className="p-2 rounded text-blue-500 hover:text-blue-600"
                title="عرض"
                aria-label="عرض"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button
                onClick={() => openEditModal(user)}
                className="p-2 rounded text-green-600 hover:text-green-700"
                title="تعديل"
                aria-label="تعديل"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4l9.768-9.768a2.5 2.5 0 10-3.536-3.536L4 16v4z" />
                </svg>
              </button>
              <button
                onClick={() => requestDelete(user.id)}
                className="p-2 rounded text-red-500 hover:text-red-600"
                title="حذف"
                aria-label="حذف"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-96 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              {editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
            </h3>
            <form onSubmit={editingUser ? handleUpdate : handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold">اسم المستخدم</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className={`w-full px-3 py-2 rounded ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-semibold">
                  كلمة المرور {editingUser && <span className="text-xs text-gray-500">(اتركها فارغة للإبقاء على القديمة)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className={`w-full px-3 py-2 rounded ${
                    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                  required={!editingUser}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded font-semibold ${
                    theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
                  }`}
                >
                  {editingUser ? 'تحديث' : 'إضافة'}
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

      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-96 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
              تفاصيل المستخدم
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                  theme === 'dark' ? 'bg-camel' : 'bg-brown'
                }`}>
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <p className="text-sm text-gray-500 mb-1">اسم المستخدم</p>
                <p className={`font-bold text-lg ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                  {selectedUser.username}
                </p>
              </div>
              <button
                onClick={closeModal}
                className={`w-full py-2 rounded font-semibold ${
                  theme === 'dark' ? 'bg-camel text-black' : 'bg-brown text-white'
                }`}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع."
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export default Users
