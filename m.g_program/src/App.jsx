import { useState, useEffect, useCallback } from 'react'
import { useNotification } from './context/NotificationContext'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { NotificationProvider } from './context/NotificationContext'
import { ThemeProvider } from './context/ThemeContext'

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const { addNotification } = useNotification()

  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated')
    const savedUser = localStorage.getItem('user')
    if (savedAuth === 'true' && savedUser) {
      setIsAuthenticated(true)
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = (userData) => {
    setIsAuthenticated(true)
    setUser(userData)
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const handleLogout = useCallback(() => {
    const logoutTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    addNotification(`تم تسجيل الخروج - ${logoutTime}`, 'info', true, 'logout-notification')
    setIsAuthenticated(false)
    setUser(null)
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('user')
  }, [addNotification])

  return (
    <Router>
      <NavBridge />
      <Routes>
        <Route
          path="/login"
          element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />}
        />
        <Route
          path="/*"
          element={isAuthenticated ? <Dashboard onLogout={handleLogout} user={user} /> : <Navigate to="/login" />}
        />
      </Routes>
    </Router>
  )
}

function NavBridge() {
  const navigate = useNavigate()
  // expose navigate globally for programmatic navigation from non-route components
  if (typeof window !== 'undefined') {
    window.__navigate = navigate
  }
  return null
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App





