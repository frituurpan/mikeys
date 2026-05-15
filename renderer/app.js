const { ipcRenderer } = require('electron')
const path            = require('path')
const fs              = require('fs')

const { loadConfig, saveConfig }                                  = require('./config.js')
const { initSynth, setVolume, setInstrument,
        getInstruments, getCurrentInstrument }                    = require('./synth.js')
const { initMidi, onNoteOn, onNoteOff,
        onInstrumentChange, onConnectionChange,
        onVolumeChange, onReverbChange, onChorusChange }          = require('./midi.js')
const { initVisuals, triggerNoteOn, triggerNoteOff,
        showInstrumentOverlay }                                   = require('./visuals.js')
const { initPanel, togglePanel, setPanelVolume }                  = require('./panel.js')
const { initHud, setHudInstrument, setHudVolume,
        setHudReverb, setHudChorus }                             = require('./hud.js')

;(async () => {
  const canvas = document.getElementById('canvas')
  initVisuals(canvas)

  const cfg        = await loadConfig()
  const assetsPath = await ipcRenderer.invoke('get-assets-path')
  const sfPath     = path.join(assetsPath, 'sounds.sf2')

  let sfBuffer = null
  try {
    const raw   = fs.readFileSync(sfPath)
    sfBuffer    = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  } catch (e) {
    console.warn('sounds.sf2 not found — oscillator fallback will be used')
    showStatus('⚠ sounds.sf2 missing in assets — using basic sounds')
  }

  const sfLoaded = await initSynth(sfBuffer, cfg.instrumentIndex, cfg.volume)
  if (!sfLoaded && sfBuffer) {
    showStatus('⚠ Soundfont load failed — using basic sounds')
  }

  initPanel()
  initHud()
  setHudInstrument(getCurrentInstrument())
  setHudVolume(cfg.volume)

  try {
    await initMidi()
  } catch (e) {
    console.error('MIDI init error:', e)
    showStatus('⚠ Keyboard not connected')
  }

  onNoteOn((note, vel) => {
    triggerNoteOn(note, vel)
  })

  onNoteOff((note) => {
    triggerNoteOff(note)
  })

  onInstrumentChange((idx) => {
    showInstrumentOverlay(idx)
    setHudInstrument(getInstruments()[idx])
    saveConfig({ instrumentIndex: idx })
  })

  onVolumeChange(vol => { setHudVolume(vol); setPanelVolume(vol) })
  onReverbChange(on  => setHudReverb(on))
  onChorusChange(on  => setHudChorus(on))

  onConnectionChange((connected) => {
    const el = document.getElementById('midi-status')
    el.style.display = connected ? 'none' : 'block'
  })

  ipcRenderer.on('toggle-config', () => togglePanel())
})().catch(err => {
  console.error('App init failed:', err)
  showStatus('⚠ App error: ' + err.message)
})

function showStatus(msg) {
  const el = document.getElementById('midi-status')
  el.textContent = msg
  el.style.display = 'block'
}
