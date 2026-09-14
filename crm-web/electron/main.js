const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')

let mainWindow = null
let tray = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const port = process.env.PORT || 3000

// Avoid Windows user-data cache permission locks during development
app.setPath('userData', path.join(app.getPath('temp'), 'mathsps-desktop-data'))

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'MathsPS Virtual HQ & Management Console',
    backgroundColor: '#0f172a',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  // Target live MathsPS cloud deployment
  const appURL = 'https://mathsps-lead-crm.vercel.app/login'

  const loadApp = () => {
    mainWindow.loadURL(appURL).catch((err) => {
      console.log('Retrying connection to MathsPS cloud...', err)
      setTimeout(loadApp, 1500)
    })
  }
  loadApp()

  // Open external links in user's default browser instead of the app window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// System Tray configuration
function createTray() {
  const iconPath = path.join(__dirname, '../public/brand-logo.jpg')
  let trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip('MathsPS CRM & Virtual Campus')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open MathsPS Console',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Application',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Bridge handlers
ipcMain.handle('app-version', () => app.getVersion())
ipcMain.handle('platform-info', () => process.platform)
