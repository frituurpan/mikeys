const path = require('path')
const fs   = require('fs')

const INSTRUMENTS = [
  { name: 'Piano',        program: 0,  icon: '🎹' },
  { name: 'Marimba',      program: 12, icon: '🥁' },
  { name: 'Glockenspiel', program: 9,  icon: '🔔' },
  { name: 'Organ',        program: 19, icon: '🎸' },
  { name: 'Harp',         program: 46, icon: '🪈' },
]

let audioCtx  = null
let gainNode  = null
let synth     = null
let volume    = 0.6
let currentIdx = 0

// Oscillator fallback active notes
const activeOsc = new Map()

function getInstruments()     { return INSTRUMENTS }
function getInstrumentIndex() { return currentIdx }
function getCurrentInstrument() { return INSTRUMENTS[currentIdx] }

async function initSynth(sfBuffer, instrumentIndex = 0, vol = 0.6) {
  volume     = Math.min(vol, 1.2)
  currentIdx = instrumentIndex

  audioCtx = new AudioContext({ latencyHint: 'interactive' })
  gainNode = audioCtx.createGain()
  gainNode.gain.value = volume
  gainNode.connect(audioCtx.destination)

  if (!sfBuffer) {
    console.warn('No SF2 — oscillator fallback')
    return false
  }

  try {
    const mod = await import('spessasynth_lib')
    const WorkletSynthesizer = mod.WorkletSynthesizer ?? mod.default?.WorkletSynthesizer
    if (!WorkletSynthesizer) throw new Error('WorkletSynthesizer not found in spessasynth_lib')

    // Must call addModule() before instantiating WorkletSynthesizer.
    // Packaged: processor is in resources/. Dev: in node_modules.
    const packedPath = path.join(process.resourcesPath, 'spessasynth_processor.min.js')
    const devPath    = path.join(__dirname, '../node_modules/spessasynth_lib/dist/spessasynth_processor.min.js')
    const processorPath = fs.existsSync(packedPath) ? packedPath : devPath
    const processorCode = fs.readFileSync(processorPath, 'utf8')
    const processorBlob = new Blob([processorCode], { type: 'application/javascript' })
    const processorUrl  = URL.createObjectURL(processorBlob)
    await audioCtx.audioWorklet.addModule(processorUrl)

    synth = new WorkletSynthesizer(audioCtx)
    await synth.isReady

    const compressor = audioCtx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value      = 6
    compressor.ratio.value     = 4
    compressor.attack.value    = 0.003
    compressor.release.value   = 0.25
    synth.connect(compressor)
    compressor.connect(gainNode)

    await synth.soundBankManager.addSoundBank(sfBuffer, 'main')
    synth.programChange(0, INSTRUMENTS[instrumentIndex].program)
    synth.controllerChange(0, 7, 127)
    synth.setMasterParameter('masterGain', 2)

    console.log('spessasynth ready:', INSTRUMENTS[instrumentIndex].name)
    return true
  } catch (e) {
    console.warn('spessasynth failed, oscillator fallback:', e.message)
    synth = null
    return false
  }
}

function noteOn(midiNote, velocity) {
  if (audioCtx?.state === 'suspended') audioCtx.resume()

  if (synth) {
    try { synth.noteOn(0, midiNote, velocity) } catch (e) { console.error('noteOn:', e) }
    return
  }

  // Oscillator fallback
  _oscOff(midiNote)
  if (!audioCtx) return

  const freq = 440 * Math.pow(2, (midiNote - 69) / 12)
  const osc  = audioCtx.createOscillator()
  const env  = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(env)
  env.connect(gainNode)

  const v = (velocity / 127) * volume
  env.gain.setValueAtTime(0, audioCtx.currentTime)
  env.gain.linearRampToValueAtTime(v, audioCtx.currentTime + 0.01)
  osc.start()
  activeOsc.set(midiNote, { osc, env })
}

function noteOff(midiNote) {
  if (synth) {
    try { synth.noteOff(0, midiNote) } catch (e) { console.error('noteOff:', e) }
    return
  }
  _oscOff(midiNote)
}

function _oscOff(midiNote) {
  const n = activeOsc.get(midiNote)
  if (!n) return
  n.env.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08)
  n.osc.stop(audioCtx.currentTime + 0.5)
  activeOsc.delete(midiNote)
}

// value: raw MIDI 14-bit, 0-16384 (center 8192)
function pitchBend(value) {
  if (!synth) return
  try { synth.pitchWheel(0, value) } catch (e) { console.error('pitchWheel:', e) }
}

function setInstrument(index) {
  currentIdx = index
  if (synth) {
    try { synth.programChange(0, INSTRUMENTS[index].program) } catch (e) { console.error('programChange:', e) }
  }
}

function cycleInstrument(direction) {
  const next = (currentIdx + direction + INSTRUMENTS.length) % INSTRUMENTS.length
  setInstrument(next)
  return next
}

function setVolume(vol) {
  volume = Math.min(vol, 1.2)
  if (gainNode && audioCtx) {
    gainNode.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.02)
  }
}

function controllerChange(cc, value) {
  if (synth) {
    try { synth.controllerChange(0, cc, value) } catch (e) { console.error('controllerChange:', e) }
  }
}

function setReverb(on) {
  if (synth) {
    try {
      synth.controllerChange(0, 91, on ? 100 : 0)
      synth.setMasterParameter('reverbGain', on ? 1 : 0)
    } catch (e) { console.error('setReverb:', e) }
  }
}

function setChorus(on) {
  if (synth) {
    try {
      synth.controllerChange(0, 93, on ? 100 : 0)
      synth.setMasterParameter('chorusGain', on ? 1 : 0)
    } catch (e) { console.error('setChorus:', e) }
  }
}

module.exports = {
  getInstruments, getInstrumentIndex, getCurrentInstrument,
  initSynth, noteOn, noteOff, pitchBend,
  setInstrument, cycleInstrument, setVolume, controllerChange, setReverb, setChorus,
}
