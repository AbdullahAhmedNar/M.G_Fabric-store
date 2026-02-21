import { createContext, useContext, useState, useEffect } from 'react'
import { apiUrl } from '../utils/api'

const ThemeContext = createContext()

export const useTheme = () => useContext(ThemeContext)

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('dark')
  const [appName, setAppName] = useState('M.G – نظام إدارة محل الأقمشة')

  useEffect(() => {
    fetchSettings()
  }, [])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const fetchSettings = async () => {
    try {
      const response = await fetch(apiUrl('/api/settings'))
      const data = await response.json()
      setTheme(data.theme || 'dark')
      setAppName(data.app_name || 'M.G – نظام إدارة محل الأقمشة')
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    try {
      await fetch(apiUrl('/api/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: appName, theme: newTheme })
      })
    } catch (error) {
      console.error('Error updating theme:', error)
    }
  }

  const updateAppName = async (newName) => {
    setAppName(newName)
    try {
      await fetch(apiUrl('/api/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: newName, theme })
      })
    } catch (error) {
      console.error('Error updating app name:', error)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, appName, updateAppName }}>
      {children}
    </ThemeContext.Provider>
  )
}
















