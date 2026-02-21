import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNotification } from '../context/NotificationContext'
import { formatNumber } from '../utils/format'
import { apiUrl } from '../utils/api'

function Header() {
  const { theme, toggleTheme } = useTheme()
  const notifApi = useNotification?.()
  const [time, setTime] = useState(new Date())
  const [lowStockItems, setLowStockItems] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifStyle, setNotifStyle] = useState({ top: 56, left: 16 })
  const [notificationThreshold, setNotificationThreshold] = useState(2)
  const notificationRef = useRef(null)
  const bellBtnRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // load settings threshold then fetch
    ;(async () => {
      try {
          const res = await fetch(apiUrl('/api/settings'))
        const s = await res.json()
        if (s && s.notification_threshold) setNotificationThreshold(s.notification_threshold)
      } catch {}
      fetchLowStockItems()
    })()
    const interval = setInterval(fetchLowStockItems, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchLowStockItems = async () => {
    try {
      const response = await fetch(apiUrl('/api/inventory'))
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      
      const lowStock = data.filter(item => {
        const meters = parseFloat(item.total_meters) || 0
        return meters <= notificationThreshold && meters > 0
      })
      
      setLowStockItems(lowStock)
      
      // نظام ذكي للإشعارات - لا تكرار ولا حذف تلقائي إلا إذا تم التجديد
      if (notifApi?.addNotification && notifApi?.removePersistentByItemId) {
        // 1) إشعار المخزون المنخفض (أعلى من الصفر)
        lowStock.forEach(item => {
          const itemNotifId = `low-stock-${item.id}`
          const message = `مخزون منخفض: ${item.item_name} - رقم ${item.color_number} (المتبقي: ${formatNumber(item.total_meters)} متر)`
          notifApi.addNotification(message, 'warning', true, itemNotifId)
        })

        // 1.ب) إشعار نفاد المخزون تمامًا (صفر)
        const zeroStock = data.filter(item => {
          const meters = parseFloat(item.total_meters) || 0
          return meters === 0
        })
        zeroStock.forEach(item => {
          const zeroNotifId = `out-stock-${item.id}`
          const colorPart = item.color_number ? ` - رقم ${item.color_number}` : ''
          const sectionPart = item.section_name ? ` في قسم ${item.section_name}` : ''
          const msg = `انتهى المخزون: ${item.item_name}${colorPart}${sectionPart}`
          notifApi.addNotification(msg, 'error', true, zeroNotifId)
        })
        
        // 2. حذف الإشعارات للأصناف التي تم تجديدها (أصبحت فوق الحد)
        const allItems = data
        allItems.forEach(item => {
          const meters = parseFloat(item.total_meters) || 0
          const lowId = `low-stock-${item.id}`
          const zeroId = `out-stock-${item.id}`
          // إذا الصنف أصبح فوق الحد المحدد، احذف إشعار المخزون المنخفض
          if (meters > notificationThreshold) {
            notifApi.removePersistentByItemId(lowId)
          }
          // إذا الصنف لم يعد صفراً (تمت إضافة مخزون)، احذف إشعار نفاد المخزون
          if (meters > 0) {
            notifApi.removePersistentByItemId(zeroId)
          }
        })
      }
      
      console.log('Low stock items:', lowStock)
    } catch (error) {
      console.error('Error fetching inventory:', error)
      setLowStockItems([])
    }
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 shadow-md ${theme === 'dark' ? 'bg-gray-900 border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
      <div className="px-5 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
            <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className={`text-lg font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                {formatTime(time)}
              </p>
            </div>
          </div>

          <div className={`flex-1 text-center px-5 py-2 mx-8 rounded-lg ${theme === 'dark' ? 'bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600' : 'bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border border-brown/20'}`}>
            <div className="flex items-center justify-center gap-2">
              <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-camel' : 'text-brown'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              <p className={`text-base font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                وَمِنْ أَصْوَافِهَا وَأَوْبَارِهَا وَأَشْعَارِهَا أَثَاثًا وَمَتَاعًا إِلَىٰ حِينٍ
                <span className={`mr-2 text-xs ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>- سورة النحل</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={notificationRef}>
              <button
                ref={bellBtnRef}
                onClick={() => {
                  const el = bellBtnRef.current
                  if (el) {
                    const rect = el.getBoundingClientRect()
                    const panelWidth = 384 // ~ w-96 (24rem)
                    const desiredLeft = rect.right + 8
                    const maxLeft = window.innerWidth - panelWidth - 16
                    const left = Math.min(desiredLeft, Math.max(16, maxLeft))
                    const top = Math.max(12, rect.top)
                    setNotifStyle({ top: Math.round(top), left: Math.round(left) })
                  }
                  setShowNotifications(!showNotifications)
                }}
                className={`relative p-2 rounded-lg transition ${
                  theme === 'dark' 
                    ? 'hover:bg-gray-800 text-gray-300' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {((lowStockItems?.length || 0) + ((notifApi?.getUnreadCount?.() || 0))) > 0 && (
                  <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                    {(lowStockItems?.length || 0) + (notifApi?.getUnreadCount?.() || 0)}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div style={{ position: 'fixed', top: notifStyle.top, left: notifStyle.left }} className={`w-96 max-h-[70vh] overflow-y-auto rounded-lg shadow-2xl border z-[100] ${
                  theme === 'dark' 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-white border-gray-200'
                }`}>
                  <div className={`p-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`font-bold ${theme === 'dark' ? 'text-camel' : 'text-brown'}`}>
                      الإشعارات
                    </h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => notifApi?.markAllAsRead?.()} className={`text-xs underline ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>تحديد كمقروء</button>
                      <button onClick={() => notifApi?.clearNotifications?.()} className={`text-xs underline ${theme === 'dark' ? 'text-red-300' : 'text-red-600'}`}>حذف الكل</button>
                    </div>
                  </div>
                  <div>
                    {lowStockItems.length === 0 && (!notifApi?.getAllNotifications || notifApi.getAllNotifications().length === 0) ? (
                      <div className="p-4 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>لا توجد إشعارات</p>
                      </div>
                    ) : (
                      <>
                        {lowStockItems.map((item, index) => (
                          <div 
                            key={`low-stock-${index}`} 
                            className={`p-3 border-b cursor-pointer ${theme === 'dark' ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'} transition`}
                            onClick={() => {
                              setShowNotifications(false)
                              const params = new URLSearchParams()
                              params.set('highlightId', item.id)
                              window.location.hash = `#/inventory?${params.toString()}`
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <div className="flex-1">
                                <p className={`font-semibold text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                                  {item.item_name} - رقم {item.color_number}
                                </p>
                                <p className="text-xs text-red-500">
                                  المتبقي: {formatNumber(item.total_meters || 0)} متر ({item.rolls_count} أتواب)
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {notifApi?.getAllNotifications && notifApi.getAllNotifications().map(n => (
                          <div key={n.id} className={`p-3 flex items-start gap-2 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'} ${n.read ? 'opacity-60' : ''}`}>
                            {n.type === 'success' ? (
                              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : n.type === 'error' ? (
                              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            ) : n.type === 'warning' ? (
                              <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                            )}
                            <div className="flex-1">
                              <p className={`text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{n.message}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs">
                                {!n.read && <button onClick={() => notifApi?.markAsRead?.(n.id)} className={`underline ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>تحديد كمقروء</button>}
                                <button onClick={() => notifApi?.removeNotification?.(n.id)} className={`underline ${theme === 'dark' ? 'text-red-300' : 'text-red-600'}`}>حذف</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition ${
                theme === 'dark' 
                  ? 'hover:bg-gray-800 text-camel' 
                  : 'hover:bg-gray-100 text-brown'
              }`}
              title={theme === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
            >
              {theme === 'dark' ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Header

