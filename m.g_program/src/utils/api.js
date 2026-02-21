// API configuration
const API_BASE_URL = process.env.NODE_ENV === 'development' ? '' : 'http://localhost:3456'

export const apiUrl = (path) => {
  return `${API_BASE_URL}${path}`
}

export default apiUrl


