let fillEl, reverbEl, chorusEl, instrumentEl

function initHud() {
  const style = document.createElement('style')
  style.textContent = `
    #hud { position:fixed; bottom:18px; left:18px; z-index:150;
           background:rgba(10,10,20,0.75); border-radius:10px;
           padding:10px 16px; font-family:sans-serif; pointer-events:none;
           backdrop-filter:blur(4px); }
    #hud-instrument { color:#c8b8f0; font-size:15px; display:block; margin-bottom:8px; }
    #hud-row { display:flex; align-items:center; gap:10px; }
    #hud-vol-track { width:100px; height:6px; background:rgba(255,255,255,0.12); border-radius:3px; }
    #hud-vol-fill  { height:6px; background:#a0d4b0; border-radius:3px; transition:width 0.1s; }
    .hud-pill { font-size:11px; font-weight:600; padding:2px 7px; border-radius:10px;
                letter-spacing:0.05em; transition:background 0.15s, color 0.15s; }
    .hud-pill.on  { background:#6ecfa0; color:#0a0a0f; }
    .hud-pill.off { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.3); }
  `
  document.head.appendChild(style)

  const el = document.createElement('div')
  el.id = 'hud'
  el.innerHTML = `
    <span id="hud-instrument">— —</span>
    <div id="hud-row">
      <div id="hud-vol-track"><div id="hud-vol-fill" style="width:0"></div></div>
      <span id="hud-reverb" class="hud-pill off">REV</span>
      <span id="hud-chorus" class="hud-pill off">CHO</span>
    </div>
  `
  document.body.appendChild(el)
  fillEl       = document.getElementById('hud-vol-fill')
  reverbEl     = document.getElementById('hud-reverb')
  chorusEl     = document.getElementById('hud-chorus')
  instrumentEl = document.getElementById('hud-instrument')
}

function setHudInstrument(instrument) {
  if (instrumentEl) instrumentEl.textContent = `${instrument.icon} ${instrument.name}`
}

function setHudVolume(vol) {
  if (fillEl) fillEl.style.width = `${Math.round((vol / 0.8) * 100)}px`
}

function setHudReverb(on) {
  if (reverbEl) reverbEl.className = `hud-pill ${on ? 'on' : 'off'}`
}

function setHudChorus(on) {
  if (chorusEl) chorusEl.className = `hud-pill ${on ? 'on' : 'off'}`
}

module.exports = { initHud, setHudInstrument, setHudVolume, setHudReverb, setHudChorus }
