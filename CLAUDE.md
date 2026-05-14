# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run bundle   # esbuild: renderer/app.js → renderer/bundle.js (CJS, ~860KB)
npm start        # bundle + launch Electron (dev mode: windowed, DevTools open)
npm run build:win  # bundle + electron-builder → dist/ (portable .exe)
```

Dev mode is detected via `process.env.DEV_TOOLS`. Run with `DEV_TOOLS=1 electron .` to get a windowed frame with DevTools; omit for fullscreen kiosk.

`renderer/bundle.js` is generated — never edit it directly.

## Architecture

**Two-process Electron app.** Main process (`src/main.js`) is minimal: creates the fullscreen window, auto-grants MIDI permission, registers global shortcuts (Ctrl+Shift+C = config panel, Ctrl+Shift+Q = quit), and exposes three IPC handles (`get-config`, `set-config`, `get-assets-path`). All application logic lives in the renderer.

**Renderer module graph** (`renderer/app.js` is the entry point bundled by esbuild):

```
app.js
├── config.js      IPC wrapper for persistent JSON config (volume, instrumentIndex)
├── synth.js       Audio engine — spessasynth_lib WorkletSynthesizer + Web Audio gainNode + compressor
├── midi.js        Web MIDI API — routes MIDI messages, fires callbacks
├── visuals.js     Canvas 2D — 61 bars (MIDI 36–96), particles, breathing idle, instrument overlay
├── panel.js       DOM settings overlay (Ctrl+Shift+C) — volume slider, instrument buttons
├── hud.js         DOM HUD overlay (bottom-left) — instrument name, volume bar, REV/CHO pills
└── color.js       Pure util — chromatic hue + lightness per MIDI note
```

**Audio signal chain:**
```
SF2 soundfont (assets/sounds.sf2)
  → spessasynth WorkletSynthesizer (AudioWorklet)
  → DynamicsCompressorNode (threshold -18dBFS, ratio 4:1)
  → GainNode (user volume, 0–1.0)
  → AudioContext.destination
```

spessasynth requires `audioCtx.audioWorklet.addModule(processorUrl)` to be called *before* `new WorkletSynthesizer(audioCtx)`. The processor JS is loaded from disk via `fs.readFileSync` and turned into a blob URL — path resolves to `resources/spessasynth_processor.min.js` when packaged, or `node_modules/spessasynth_lib/dist/...` in dev.

**MIDI callback chain** (all wired in `app.js`):
- `noteOn/noteOff` → synth + visuals
- `instrumentChange` (PC message) → synth + visuals overlay + HUD + config save
- `volumeChange` (CC7) → synth gainNode + HUD bar
- `reverbChange` (CC91 > 0) → `synth.controllerChange(0, 91, val)` + `setMasterParameter('reverbGain', 1|0)` + HUD pill
- `chorusChange` (CC93 > 0) → same pattern with CC93 / `chorusGain`
- `connectionChange` → `#midi-status` DOM element visibility

## Key Constraints

**spessasynth v4 API** (not what old docs show):
- Class: `WorkletSynthesizer` (not `Synthetizer`)
- Load SF2: `synth.soundBankManager.addSoundBank(buffer, id)` (not `synth.addSoundBank`)
- Pitch: `synth.pitchWheel(ch, raw14bit)` — single value 0–16384, center = 8192
- Volume: `synth.setMasterParameter('masterGain', N)` for internal gain; CC7 default is 100/127 so call `synth.controllerChange(0, 7, 127)` after init to maximize channel volume
- Reverb/chorus: SF2 presets have `reverbEffectsSend=0` by default. Must call both `controllerChange(0, 91, val)` (to route signal into the bus) AND `setMasterParameter('reverbGain', val)` (to amplify wet). Neither alone is sufficient.

**esbuild bundling is required** because spessasynth_lib imports bare ESM specifier `spessasynth_core` which cannot resolve in Electron's renderer without bundling. All renderer modules use CommonJS (`require`/`module.exports`); esbuild outputs CJS with `--format=cjs`. `electron`, `path`, `fs`, `os` are externalized.

**File:// secure context** is required for AudioWorklet blob URLs. Registered via `protocol.registerSchemesAsPrivileged` in `src/main.js` before `app.ready`.

**Autoplay policy** must be disabled: `app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')` — otherwise AudioContext starts suspended with no way to resume (kiosk, no user gesture available).

## Hardware (M-Audio ProKeys Sono 61)

See `docs/hardware-mappings.md` for full MIDI mapping table. Key points:
- Voice buttons send PC 7/0/1/4/18 → mapped in `PC_MAP` in `midi.js`
- Voice vol rotary = CC7 (main volume slider is analog-only, sends no MIDI)
- Reverb/chorus are toggle buttons (CC91: 0↔20, CC93: 0↔36)
- Octave +/- buttons send no MIDI over USB
- Audio controls section (mic gain, inst gain, mono, direct monitor) are analog hardware, not MIDI

## Build Output

`electron-builder` target is `portable` (not NSIS) — avoids winCodeSign symlink failures on Windows without Developer Mode. Unsigned build: `signingHashAlgorithms: null`, `sign: null`. SF2 soundfont and spessasynth processor are copied to `resources/` via `extraResources` in `package.json`.
