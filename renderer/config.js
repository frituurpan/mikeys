const { ipcRenderer } = require('electron')

const DEFAULTS = { volume: 0.6, instrumentIndex: 0 }
let _cfg = { ...DEFAULTS }

async function loadConfig() {
  try {
    _cfg = await ipcRenderer.invoke('get-config')
  } catch {
    _cfg = { ...DEFAULTS }
  }
  return _cfg
}

function getConfig() {
  return _cfg
}

async function saveConfig(patch) {
  _cfg = { ..._cfg, ...patch }
  try {
    await ipcRenderer.invoke('set-config', _cfg)
  } catch (e) {
    console.error('saveConfig failed:', e)
  }
  return _cfg
}

module.exports = { loadConfig, getConfig, saveConfig }
