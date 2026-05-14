const { app, BrowserWindow, ipcMain, globalShortcut, session, protocol } = require('electron')

// Must run before app ready — makes file:// a secure context so AudioWorklet blob URLs load
protocol.registerSchemesAsPrivileged([
  { scheme: 'file', privileges: { secure: true, standard: true, allowServiceWorkers: true, supportFetchAPI: true } },
])
const path = require('path')
const fs   = require('fs')

const isDev = !!process.env.DEV_TOOLS

// Kiosk app — disable autoplay restriction so AudioContext starts without user gesture
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const ASSETS_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '..', 'assets')

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')
const DEFAULTS    = { volume: 0.6, instrumentIndex: 0 }

function readConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } }
  catch { return { ...DEFAULTS } }
}

function writeConfig(data) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2))
  } catch (e) { console.error('Config write failed:', e) }
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: !isDev,
    width:  isDev ? 1280 : undefined,
    height: isDev ? 800  : undefined,
    frame:          isDev,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration:  true,
      contextIsolation: false,
      webSecurity:      false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))

  mainWindow.webContents.on('did-finish-load', () => {
    if (!isDev) mainWindow.webContents.insertCSS('* { cursor: none !important; }')
  })

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('Renderer crashed:', details.reason, details.exitCode)
  })

  mainWindow.webContents.on('console-message', (event) => {
    console.log(`[renderer L${event.level}:${event.line}] ${event.message}`)
  })

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(() => {
  // Grant MIDI permission automatically (kiosk app, no user prompt needed)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'midi' || permission === 'midiSysex') {
      callback(true)
    } else {
      callback(false)
    }
  })

  createWindow()

  globalShortcut.register('Ctrl+Shift+C', () => {
    mainWindow?.webContents.send('toggle-config')
  })

  globalShortcut.register('Ctrl+Shift+Q', () => {
    app.quit()
  })
})

app.on('window-all-closed', () => app.quit())

ipcMain.handle('get-config',      ()     => readConfig())
ipcMain.handle('set-config',      (_, d) => writeConfig(d))
ipcMain.handle('get-assets-path', ()     => ASSETS_PATH)
