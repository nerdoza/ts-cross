import { app, BrowserWindow } from 'electron'
import * as ElectronDebug from 'electron-debug'

if (process.env.NODE_ENV === 'development') {
  ElectronDebug({
    showDevTools: true,
    devToolsMode: 'detach'
  })
}

function createWindow () {
  let mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  const windowURL = process.env.ELECTRON_RENDERER_URL || 'file://index.html'
  void mainWindow.loadURL(windowURL)
}

app.on('ready', createWindow)
