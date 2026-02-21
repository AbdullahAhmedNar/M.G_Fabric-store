import { createContext, useContext, useState, useRef, useEffect } from 'react'

const NotificationContext = createContext()

export const useNotification = () => useContext(NotificationContext)

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const [persistentNotifications, setPersistentNotifications] = useState([])
  const lastMessage = useRef('')
  const lastTime = useRef(0)

  useEffect(() => {
    const stored = localStorage.getItem('persistent_notifications')
    if (stored) {
      try {
        setPersistentNotifications(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load persistent notifications', e)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('persistent_notifications', JSON.stringify(persistentNotifications))
  }, [persistentNotifications])

  const addNotification = (message, type = 'success', persistent = false, itemId = null) => {
    const now = Date.now()
    if (!persistent && message === lastMessage.current && now - lastTime.current < 2000) {
      return
    }
    
    lastMessage.current = message
    lastTime.current = now
    
    const id = itemId || now
    
    if (persistent) {
      setPersistentNotifications(prev => {
        const exists = prev.find(n => n.id === id || n.message === message)
        if (exists) {
          // تحديث الإشعار الموجود
          return prev.map(n => 
            (n.id === id || n.message === message) 
              ? { ...n, message, type, time: now } 
              : n
          )
        }
        return [...prev, { id, message, type, read: false, time: now, persistent: true, itemId }]
      })
    } else {
      setNotifications(prev => [...prev, { id, message, type, read: false, time: now }])
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }, 3000)
    }
  }
  
  const removePersistentByItemId = (itemId) => {
    setPersistentNotifications(prev => prev.filter(n => n.itemId !== itemId))
  }

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    setPersistentNotifications(prev => prev.filter(n => n.id !== id))
  }

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setPersistentNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setPersistentNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const clearNotifications = () => {
    setNotifications([])
    setPersistentNotifications([])
  }
  
  const clearPersistentNotifications = () => {
    setPersistentNotifications([])
  }

  const getAllNotifications = () => {
    return [...persistentNotifications, ...notifications]
  }

  const getUnreadCount = () => {
    return persistentNotifications.filter(n => !n.read).length + notifications.filter(n => !n.read).length
  }

  const getIcon = (type) => {
    switch(type) {
      case 'success':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
      case 'error':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
      case 'warning':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      default:
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
    }
  }

  return (
    <NotificationContext.Provider value={{ 
      addNotification, 
      notifications, 
      persistentNotifications,
      removeNotification,
      removePersistentByItemId,
      markAsRead, 
      markAllAsRead, 
      clearNotifications,
      clearPersistentNotifications,
      getAllNotifications,
      getUnreadCount
    }}>
      {children}
      <div className="fixed top-4 left-4 z-50 space-y-2">
        {notifications.filter(n => !n.persistent).map(notif => (
          <div
            key={notif.id}
            className={`flex items-center gap-3 px-5 py-3 rounded-lg shadow-xl animate-slide-in ${
              notif.type === 'success' ? 'bg-green-500 text-white' :
              notif.type === 'error' ? 'bg-red-500 text-white' :
              notif.type === 'warning' ? 'bg-yellow-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            {getIcon(notif.type)}
            <p className="font-medium">{notif.message}</p>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </NotificationContext.Provider>
  )
}


