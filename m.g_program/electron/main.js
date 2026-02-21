const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const express = require('express')
const { createServer } = require('http')
const fs = require('fs')

let mainWindow
let staticServer

// Create static server for serving dist files
function createStaticServer() {
  return new Promise((resolve, reject) => {
    const app = express()
    const distPath = path.join(__dirname, '../dist')
    
    app.use(express.static(distPath))
    
    // Handle React Router routes - serve index.html for all routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
    
    staticServer = createServer(app)
    staticServer.listen(0, () => {
      const port = staticServer.address().port
      console.log(`Static server running on port ${port}`)
      resolve(port)
    })
    
    staticServer.on('error', reject)
  })
}

async function createWindow() {
  const isDev = false // Force production mode
  // استخدام الأيقونة من مجلد الصور
  const iconPath = path.join(__dirname, '../src/images/A.NAR.png')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: iconPath,
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      enableRemoteModule: true,
      experimentalFeatures: true,
      preload: path.join(__dirname, 'preload.js')
    },
  })

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Create static server and load from it
  try {
    const port = await createStaticServer()
    const url = `http://localhost:${port}`
    console.log('Loading from:', url)
    
    await mainWindow.loadURL(url)
    console.log('Successfully loaded from static server')
  } catch (err) {
    console.error('Error loading from static server:', err)
    console.log('Falling back to dev server...')
    // Fallback to dev server if static server doesn't work
    try {
      await mainWindow.loadURL('http://localhost:5173')
    } catch (fallbackErr) {
      console.error('Dev server also failed:', fallbackErr)
      // Last resort: try to load file directly
      const indexPath = path.join(__dirname, '../dist/index.html')
      await mainWindow.loadFile(indexPath)
    }
  }

  // Handle page load events
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading')
    
    // Enable CORS and other security settings for API calls
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['Origin'] = null
      details.requestHeaders['User-Agent'] = 'Electron'
      callback({ requestHeaders: details.requestHeaders })
    })
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription)
  })

  // Open DevTools only in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }
  
  // Add additional security settings for API calls
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'http://localhost:3456') {
      callback(true)
    } else {
      callback(false)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC handlers
ipcMain.handle('save-pdf', async (event, { fileName, pdfData }) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ ملف PDF',
      defaultPath: path.join(app.getPath('documents'), fileName),
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    })
    
    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }
    
    // Convert base64 to buffer
    const buffer = Buffer.from(pdfData.split(',')[1], 'base64')
    fs.writeFileSync(filePath, buffer)
    
    return { success: true, filePath }
  } catch (error) {
    console.error('Error saving PDF:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (error) {
    console.error('Error opening external URL:', error)
    return { success: false, error: error.message }
  }
})

app.whenReady().then(async () => {
  // Start the server first
  require('../server/index.js')
  
  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Then create the window
  await createWindow()
})

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})


