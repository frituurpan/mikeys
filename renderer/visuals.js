const { noteColor, hsl } = require('./color.js')
const { getInstruments } = require('./synth.js')

const MIDI_MIN   = 36   // C2 — first key on 61-key keyboard
const NOTE_COUNT = 61

const bars = Array.from({ length: NOTE_COUNT }, (_, i) => ({
  midiNote: MIDI_MIN + i,
  active: false,
  brightness: 0,
  velocity: 0,
}))

let particles = []
let breathPhase = 0
let instrumentOverlay = null
let canvas, ctx2d, lastTime = 0

function initVisuals(canvasEl) {
  canvas = canvasEl
  ctx2d = canvas.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
  requestAnimationFrame(renderLoop)
}

function resize() {
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
}

function triggerNoteOn(midiNote, velocity) {
  const idx = midiNote - MIDI_MIN
  if (idx < 0 || idx >= NOTE_COUNT) return
  bars[idx].active    = true
  bars[idx].brightness = 1.0
  bars[idx].velocity  = velocity / 127
  spawnParticles(idx, velocity)
}

function triggerNoteOff(midiNote) {
  const idx = midiNote - MIDI_MIN
  if (idx < 0 || idx >= NOTE_COUNT) return
  bars[idx].active = false
}

function showInstrumentOverlay(instrumentIndex) {
  const inst = getInstruments()[instrumentIndex]
  instrumentOverlay = { icon: inst.icon, name: inst.name, alpha: 1.5 }
}

function spawnParticles(barIndex, velocity) {
  const bw    = canvas.width / NOTE_COUNT
  const bx    = barIndex * bw + bw / 2
  const count = Math.round(6 + (velocity / 127) * 14)
  const color = noteColor(MIDI_MIN + barIndex)

  for (let i = 0; i < count; i++) {
    particles.push({
      x:     bx + (Math.random() - 0.5) * bw * 1.5,
      y:     canvas.height - 5,
      vx:    (Math.random() - 0.5) * 1.8,
      vy:    -(2.5 + Math.random() * 4.5),
      life:  1.0,
      decay: 0.004 + Math.random() * 0.007,
      size:  4 + Math.random() * 8 + (velocity / 127) * 10,
      hue:   color.hue,
      sat:   color.sat,
    })
  }
}

function renderLoop(ts) {
  const dt = Math.min(ts - lastTime, 50)
  lastTime = ts
  update(dt)
  draw()
  requestAnimationFrame(renderLoop)
}

function update(dt) {
  breathPhase = (breathPhase + dt / 10000) % 1

  const fadeRate = dt / 300
  for (const bar of bars) {
    if (bar.active) {
      bar.brightness = Math.min(1, bar.brightness + fadeRate * 4)
    } else {
      bar.brightness = Math.max(0, bar.brightness - fadeRate)
    }
  }

  for (const p of particles) {
    p.x    += p.vx
    p.y    += p.vy
    p.vy   += 0.06  // slight downward pull
    p.life -= p.decay
    p.size *= 0.997
  }
  particles = particles.filter(p => p.life > 0)

  if (instrumentOverlay) {
    instrumentOverlay.alpha -= dt / 1000
    if (instrumentOverlay.alpha <= 0) instrumentOverlay = null
  }
}

function draw() {
  const w  = canvas.width
  const h  = canvas.height
  const bw = w / NOTE_COUNT

  ctx2d.fillStyle = '#0a0a0f'
  ctx2d.fillRect(0, 0, w, h)

  for (let i = 0; i < NOTE_COUNT; i++) {
    const bar   = bars[i]
    const color = noteColor(bar.midiNote)

    const breathVal = (Math.sin(breathPhase * Math.PI * 2 + i * 0.15) + 1) * 0.5
    const idleBright = breathVal * 0.08 + 0.02
    const eff = Math.max(bar.brightness, idleBright)
    if (eff < 0.015) continue

    const x  = i * bw
    const bh = eff * h
    const l  = color.lightBase

    const grad = ctx2d.createLinearGradient(x, h - bh, x, h)
    grad.addColorStop(0, hsl(color.hue, color.sat, l, eff))
    grad.addColorStop(1, hsl(color.hue, color.sat, l * 0.4, eff * 0.2))
    ctx2d.fillStyle = grad
    ctx2d.fillRect(x, h - bh, bw - 1, bh)

    if (bar.brightness > 0.4) {
      ctx2d.save()
      ctx2d.shadowColor = hsl(color.hue, 90, 75, bar.brightness)
      ctx2d.shadowBlur  = 24 * bar.brightness
      ctx2d.fillStyle   = hsl(color.hue, color.sat, l, bar.brightness * 0.25)
      ctx2d.fillRect(x, h - bh, bw - 1, bh)
      ctx2d.restore()
    }
  }

  // Particles
  for (const p of particles) {
    ctx2d.globalAlpha = Math.max(0, p.life)
    ctx2d.fillStyle   = hsl(p.hue, p.sat, 78, 1)
    ctx2d.beginPath()
    ctx2d.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2)
    ctx2d.fill()
  }
  ctx2d.globalAlpha = 1

  // Instrument overlay
  if (instrumentOverlay && instrumentOverlay.alpha > 0) {
    const a      = Math.min(instrumentOverlay.alpha, 1)
    const fsize  = Math.min(w, h) * 0.18
    ctx2d.globalAlpha = a
    ctx2d.textAlign    = 'center'
    ctx2d.textBaseline = 'middle'
    ctx2d.font         = `bold ${fsize}px sans-serif`
    ctx2d.fillStyle    = '#ffffff'
    ctx2d.fillText(instrumentOverlay.icon, w / 2, h * 0.38)
    ctx2d.font      = `bold ${fsize * 0.4}px sans-serif`
    ctx2d.fillStyle = 'rgba(255,255,255,0.85)'
    ctx2d.fillText(instrumentOverlay.name, w / 2, h * 0.62)
    ctx2d.globalAlpha = 1
  }
}

module.exports = { initVisuals, triggerNoteOn, triggerNoteOff, showInstrumentOverlay }
