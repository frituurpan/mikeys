const { getInstruments, setInstrument, setVolume } = require('./synth.js')
const { getConfig, saveConfig } = require('./config.js')
const { showInstrumentOverlay } = require('./visuals.js')

let panelEl = null
let visible = false

function initPanel() {
  panelEl = buildPanel()
  document.body.appendChild(panelEl)
}

function togglePanel() {
  visible = !visible
  panelEl.style.display = visible ? 'flex' : 'none'
  if (visible) syncPanel()
}

function syncPanel() {
  const cfg = getConfig()
  const slider = panelEl.querySelector('#vol-slider')
  if (slider) slider.value = cfg.volume
}

function buildPanel() {
  const panel = document.createElement('div')
  panel.id = 'config-panel'
  Object.assign(panel.style, {
    display:        'none',
    position:       'fixed',
    inset:          '0',
    background:     'rgba(0,0,0,0.88)',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            '36px',
    zIndex:         '100',
    fontFamily:     'sans-serif',
    color:          '#fff',
  })

  const title = el('h1', 'Settings', { fontSize: '52px', margin: '0' })
  panel.appendChild(title)

  // Volume
  const volWrap = el('label', null, {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', fontSize: '28px'
  })
  volWrap.appendChild(document.createTextNode('Volume'))

  const slider = document.createElement('input')
  slider.type  = 'range'
  slider.id    = 'vol-slider'
  slider.min   = '0'
  slider.max   = '0.8'
  slider.step  = '0.05'
  slider.value = getConfig().volume
  Object.assign(slider.style, { width: '500px', height: '44px', cursor: 'default' })
  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value)
    setVolume(v)
    saveConfig({ volume: v })
  })
  volWrap.appendChild(slider)
  panel.appendChild(volWrap)

  // Instruments
  panel.appendChild(el('div', 'Instrument Preview', { fontSize: '28px' }))

  const instRow = el('div', null, { display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' })
  getInstruments().forEach((inst, i) => {
    const btn = document.createElement('button')
    btn.textContent = `${inst.icon} ${inst.name}`
    Object.assign(btn.style, {
      padding:      '18px 28px',
      fontSize:     '22px',
      borderRadius: '12px',
      border:       'none',
      cursor:       'default',
      background:   '#333',
      color:        '#fff',
    })
    btn.addEventListener('click', () => {
      setInstrument(i)
      showInstrumentOverlay(i)
      saveConfig({ instrumentIndex: i })
    })
    instRow.appendChild(btn)
  })
  panel.appendChild(instRow)

  // Close hint
  panel.appendChild(el('div', 'Ctrl+Shift+C to close', {
    fontSize: '18px', opacity: '0.55', marginTop: '10px'
  }))

  return panel
}

function el(tag, text, styles = {}) {
  const node = document.createElement(tag)
  if (text) node.textContent = text
  Object.assign(node.style, styles)
  return node
}

module.exports = { initPanel, togglePanel }
