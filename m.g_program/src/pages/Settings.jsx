import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { apiUrl } from '../utils/api'

function Settings() {
  const { theme, toggleTheme, appName, updateAppName } = useTheme()
  const { addNotification } = useNotification()
  const [newAppName, setNewAppName] = useState(appName)
  const [hasChanges, setHasChanges] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])


  const loadSettings = async () => {
    try {
      const response = await fetch(apiUrl('/api/settings'))
      const data = await response.json()
      // يمكن إضافة إعدادات أخرى هنا إذا لزم الأمر
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const handleSaveAllSettings = async () => {
    try {
      if (newAppName !== appName) {
        await updateAppName(newAppName)
        addNotification('تم حفظ جميع التعديلات بنجاح', 'success')
        setHasChanges(false)
      }
    } catch (error) {
      addNotification('فشل حفظ التعديلات', 'error')
    }
  }

  const handleReset = async () => {
    try {
      const response = await fetch(apiUrl('/api/reset'), {
        method: 'POST'
      })
      if (response.ok) {
        addNotification('تم إعادة ضبط النظام بنجاح - سيتم إعادة تحميل الصفحة', 'success')
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (error) {
      addNotification('فشل إعادة الضبط', 'error')
    }
    setShowResetDialog(false)
  }

  const openResetDialog = () => {
    setShowResetDialog(true)
  }

  const handleDownloadBackup = async () => {
    addNotification('جاري تحميل النسخة الاحتياطية...', 'info')
    try {
      const response = await fetch(apiUrl('/api/backup/download'))
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `mg_fabric_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        addNotification('تم تنزيل النسخة الاحتياطية بنجاح', 'success')
      } else {
        addNotification('فشل تحميل النسخة الاحتياطية', 'error')
      }
    } catch (error) {
      addNotification('خطأ في تحميل النسخة الاحتياطية', 'error')
    }
  }

  const handleRestoreBackup = async () => {
    if (!confirm('هل أنت متأكد من استعادة النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية!')) return
    
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      
      // عرض حجم الملف للمستخدم
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(2)
      
      console.log(`حجم ملف النسخة الاحتياطية: ${fileSizeMB} ميجابايت`)
      
      // رسالة إعلامية بحسب حجم الملف (بدون حد أقصى)
      if (file.size > 1024 * 1024 * 1024) { // أكبر من 1 جيجا
        addNotification(`جاري استعادة النسخة (${fileSizeGB} جيجا) - قد يستغرق عدة دقائق...`, 'info')
      } else if (file.size > 100 * 1024 * 1024) { // أكبر من 100 ميجا
        addNotification(`جاري استعادة النسخة (${fileSizeMB} ميجا) - يرجى الانتظار...`, 'info')
      } else {
        addNotification('جاري استعادة النسخة الاحتياطية...', 'info')
      }
      
      try {
        const reader = new FileReader()
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target.result
            const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))
            
            console.log(`حجم البيانات بعد التحويل لـ base64: ${(base64.length / (1024 * 1024)).toFixed(2)} ميجابايت`)
            
            const response = await fetch(apiUrl('/api/backup/restore'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ backupData: base64 })
            })
            
            if (response.ok) {
              const result = await response.json()
              addNotification(result.message || 'تم استعادة النسخة الاحتياطية بنجاح', 'success')
              setTimeout(() => {
                window.location.reload()
              }, 2000)
            } else {
              const errorData = await response.json().catch(() => ({}))
              if (response.status === 413) {
                addNotification('خطأ غير متوقع في حجم الملف - يرجى إعادة المحاولة', 'error')
              } else {
                addNotification(errorData.message || 'فشل في استعادة النسخة الاحتياطية', 'error')
              }
              console.error('Restore failed:', response.status, errorData)
            }
          } catch (error) {
            console.error('Error during restore:', error)
            addNotification('خطأ في استعادة النسخة الاحتياطية: ' + error.message, 'error')
          }
        }
        reader.onerror = () => {
          addNotification('خطأ في قراءة الملف', 'error')
        }
        reader.readAsArrayBuffer(file)
      } catch (error) {
        console.error('Error reading file:', error)
        addNotification('خطأ في قراءة الملف: ' + error.message, 'error')
      }
    }
    input.click()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <svg className={`w-8 h-8 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>الإعدادات</h2>
        </div>
        <button
          onClick={handleSaveAllSettings}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all shadow-lg ${
            theme === 'dark' ? 'bg-camel text-black hover:bg-opacity-90' : 'bg-brown text-white hover:bg-opacity-90'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          حفظ التعديلات
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-8 rounded-xl shadow-lg ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>الثيم (السمة)</h3>
            </div>
            <button
              onClick={() => {
                toggleTheme()
                addNotification(`تم التبديل إلى الوضع ${theme === 'dark' ? 'الفاتح' : 'الداكن'}`, 'success')
              }}
              className={`relative w-16 h-9 rounded-full transition ${
                theme === 'dark' ? 'bg-gray-600' : 'bg-brown'
              }`}
              aria-label="Toggle theme"
            >
              <span className={`absolute top-1 left-1 w-7 h-7 rounded-full bg-white shadow transform transition ${
                theme === 'dark' ? 'translate-x-0' : 'translate-x-7'
              }`} />
            </button>
          </div>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>زر تشغيل/إيقاف للوضع الداكن والفاتح</p>
        </div>

        <div className={`p-8 rounded-xl shadow-lg ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-5">
            <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>تغيير اسم البرنامج</h3>
          </div>
          <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>الاسم الحالي: <span className="font-semibold">{appName}</span></p>
          <input
            type="text"
            value={newAppName}
            onChange={(e) => {
              setNewAppName(e.target.value)
              setHasChanges(true)
            }}
            className={`w-full px-4 py-3 rounded-lg border-2 transition-colors ${
              theme === 'dark' 
                ? 'bg-gray-900 border-gray-600 text-white focus:border-camel' 
                : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-brown'
            } focus:outline-none`}
            placeholder="أدخل الاسم الجديد"
          />
        </div>



        <div className={`p-8 rounded-xl shadow-lg ${theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-5">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>النسخ الاحتياطي</h3>
          </div>
          <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>حفظ واستعادة قاعدة البيانات</p>
          <div className="space-y-3">
            <button
              onClick={handleDownloadBackup}
              className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-semibold transition-all ${
                theme === 'dark' 
                  ? 'bg-camel text-black hover:bg-opacity-90' 
                  : 'bg-brown text-white hover:bg-opacity-90'
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              تنزيل نسخة احتياطية
            </button>
            <button
              onClick={handleRestoreBackup}
              className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-semibold transition-all ${
                theme === 'dark' 
                  ? 'bg-camel text-black hover:bg-opacity-90' 
                  : 'bg-brown text-white hover:bg-opacity-90'
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              استعادة نسخة احتياطية
            </button>
          </div>
        </div>

        <div className={`lg:col-span-2 p-8 rounded-xl shadow-lg border-2 ${
          theme === 'dark' ? 'bg-red-950/30 border-red-800' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3 mb-5">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>إعادة ضبط النظام</h3>
          </div>
          <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-red-900/20' : 'bg-red-100'}`}>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className={`text-sm ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                <strong>تحذير خطير:</strong> سيتم حذف جميع البيانات نهائياً (العملاء، الموردين، المخزون، المبيعات، المصروفات) وإعادة الإعدادات الافتراضية. هذا الإجراء لا يمكن التراجع عنه!
              </p>
            </div>
          </div>
          <button
            onClick={openResetDialog}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            إعادة ضبط النظام
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showResetDialog}
        title=" تحذير خطير: إعادة ضبط النظام"
        message="سيتم حذف جميع البيانات التالية نهائياً:
• جميع بيانات العملاء (الأسماء، الطلبات، المدفوعات)
• جميع بيانات الموردين
• جميع بيانات المخزون والأقسام
• جميع بيانات المبيعات
• جميع بيانات المصروفات
• جميع بيانات المستخدمين

 هذا الإجراء لا يمكن التراجع عنه!

هل أنت متأكد تماماً من المتابعة؟"
        confirmText="نعم، إعادة ضبط النظام"
        cancelText="إلغاء"
        onConfirm={handleReset}
        onCancel={() => setShowResetDialog(false)}
      />
    </div>
  )
}

export default Settings
