const { contextBridge, ipcRenderer } = require('electron')

// Helper function to make API calls
const makeApiCall = async (endpoint) => {
  try {
    const response = await fetch(`http://localhost:3456${endpoint}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error)
    throw error
  }
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Suppliers API
  getAllSuppliers: () => makeApiCall('/api/suppliers'),
  getSupplierStatistics: () => makeApiCall('/api/suppliers/statistics'),
  
  // Customers API
  getAllCustomers: () => makeApiCall('/api/customers'),
  getCustomerStatistics: () => makeApiCall('/api/customers/statistics'),
  
  // Inventory API
  getAllInventory: () => makeApiCall('/api/inventory'),
  getInventoryStatistics: () => makeApiCall('/api/inventory/statistics'),
  
  // Sales API
  getAllSales: () => makeApiCall('/api/sales'),
  getSalesStatistics: () => makeApiCall('/api/sales/statistics'),
  
  // Expenses API
  getAllExpenses: () => makeApiCall('/api/expenses'),
  getExpenseStatistics: () => makeApiCall('/api/expenses/statistics'),
  
  // Users API
  getAllUsers: () => makeApiCall('/api/users'),
  
  // Statistics API
  getDashboardStatistics: () => makeApiCall('/api/statistics'),
  
  // Electron specific APIs
  savePDF: (fileName, pdfData) => ipcRenderer.invoke('save-pdf', { fileName, pdfData }),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
})

window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron app loaded')
})
























