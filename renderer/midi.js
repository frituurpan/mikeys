const { noteOn, noteOff, pitchBend, setInstrument, setVolume, controllerChange, setReverb, setChorus, MAX_VOLUME } = require('./synth.js')

// Program Change values sent by each ProKeys Sono 61 voice button.
// Order: Grand Piano, Bright Piano, Electric Piano, Organ, Clavinet buttons.
// Maps keyboard voice button → our app instrument index (0-4).
const PC_MAP = { 7: 0, 0: 1, 1: 2, 4: 3, 18: 4 }

const NOTE_ON  = 0x90
const NOTE_OFF = 0x80
const PITCH    = 0xE0
const CC       = 0xB0
const PC       = 0xC0

let _onNoteOn           = null
let _onNoteOff          = null
let _onInstrumentChange = null
let _onConnectionChange = null
let _onVolumeChange     = null
let _onReverbChange     = null
let _onChorusChange     = null

function onNoteOn(cb)           { _onNoteOn = cb }
function onNoteOff(cb)          { _onNoteOff = cb }
function onInstrumentChange(cb) { _onInstrumentChange = cb }
function onConnectionChange(cb) { _onConnectionChange = cb }
function onVolumeChange(cb)     { _onVolumeChange = cb }
function onReverbChange(cb)     { _onReverbChange = cb }
function onChorusChange(cb)     { _onChorusChange = cb }

async function initMidi() {
  let access
  try {
    access = await navigator.requestMIDIAccess({ sysex: false })
  } catch (e) {
    console.error('MIDI access denied:', e)
    _onConnectionChange?.(false)
    return null
  }

  function connectInputs() {
    const inputs = [...access.inputs.values()]
    console.log('MIDI inputs found:', inputs.length, inputs.map(i => `"${i.name}" [${i.state}]`).join(', ') || '(none)')
    for (const input of inputs) {
      input.onmidimessage = handleMessage
    }
    _onConnectionChange?.(inputs.length > 0)
  }

  connectInputs()
  access.onstatechange = () => connectInputs()

  return access
}

function handleMessage(event) {
  const [status, d1, d2] = event.data
  const cmd = status & 0xF0

  if (cmd === NOTE_ON && d2 > 0) {
    noteOn(d1, d2)
    _onNoteOn?.(d1, d2)
  } else if (cmd === NOTE_OFF || (cmd === NOTE_ON && d2 === 0)) {
    noteOff(d1)
    _onNoteOff?.(d1)
  } else if (cmd === PITCH) {
    pitchBend((d2 << 7) | d1)
  } else if (cmd === CC) {
    if (d1 === 7) {
      const vol = (d2 / 127) * MAX_VOLUME
      setVolume(vol)
      _onVolumeChange?.(vol)
    } else if (d1 === 91) {
      setReverb(d2 > 0)
      _onReverbChange?.(d2 > 0)
    } else if (d1 === 93) {
      setChorus(d2 > 0)
      _onChorusChange?.(d2 > 0)
    } else {
      controllerChange(d1, d2)
    }
  } else if (cmd === PC) {
    const idx = PC_MAP[d1]
    if (idx !== undefined) {
      setInstrument(idx)
      _onInstrumentChange?.(idx)
    }
  }
}

module.exports = { initMidi, onNoteOn, onNoteOff, onInstrumentChange, onConnectionChange, onVolumeChange, onReverbChange, onChorusChange }
