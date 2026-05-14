# M-Audio ProKeys Sono 61 — MIDI Mappings & Decisions

## Voice Buttons → Instruments

The keyboard sends Program Change (0xC0) when a voice button is pressed, along with a burst of CC messages that set reverb/chorus/bank for that voice preset. We intercept the PC value and map to our own GM instruments.

| Physical Button | PC Value | App Instrument | GM Program |
|----------------|----------|----------------|------------|
| Grand Piano    | 7        | Piano          | 0          |
| Bright Piano   | 0        | Marimba        | 12         |
| Electric Piano | 1        | Glockenspiel   | 9          |
| Organ          | 4        | Organ          | 19         |
| Clavinet       | 18       | Harp           | 46         |

Each voice button press also sends: CC0 (bank MSB=0), CC32 (bank LSB=0), CC80, CC81, CC91 (reverb preset), CC93 (chorus preset). These are ignored except CC91/CC93 which drive our reverb/chorus state.

## Continuous Controllers

| CC  | Physical Control       | Wired To              | Notes                                      |
|-----|------------------------|-----------------------|--------------------------------------------|
| CC7 | Voice vol rotary       | `setVolume()`         | Main volume slider is analog-only, no MIDI |
| CC1 | Mod wheel              | `controllerChange(0, 1, val)` | Passed through to SF2 engine        |
| CC91| Reverb on/off toggle   | `setReverb(d2 > 0)`   | Keyboard sends 0 (off) or 20 (on)         |
| CC93| Chorus on/off toggle   | `setChorus(d2 > 0)`   | Keyboard sends 0 (off) or 36 (on)         |

## Pitch / Pitch Bend

| Message | Physical Control | Wired To            |
|---------|-----------------|---------------------|
| 0xE0    | Pitch wheel     | `synth.pitchWheel(0, val)` where val = `(d2<<7)\|d1` |

## NOT MIDI (analog hardware / no output)

| Control         | Reason                                          |
|-----------------|-------------------------------------------------|
| Main volume slider | Analog hardware — controls USB audio interface level only |
| Mic gain rotary    | USB audio interface analog input mixer          |
| Inst gain rotary   | USB audio interface analog input mixer          |
| Mono toggle        | USB audio interface                             |
| Direct monitor rotary | USB audio interface                        |
| Edit mode toggle   | Controls keyboard LCD only — no MIDI output     |
| Octave +/- buttons | Do NOT send any MIDI over USB                  |
| Sustain pedal jack | CC64 — no pedal connected, not wired           |

## Piano Reset Button

Sends a full reset burst: CC121 (reset all controllers), CC123 (all notes off), CC0+CC32 (bank select), PC0 (Grand Piano), CC80/81/91/93 (voice preset), pitch wheel center, CC64=0 (sustain off). This naturally resets the app to Piano via the PC0 handler.

## Key Decisions

### spessasynth_lib API (v4.2.15)
- `WorkletSynthesizer` is the correct class name (not `Synthetizer`)
- `synth.soundBankManager.addSoundBank(buffer, id)` — method moved to sub-manager in v4
- `synth.pitchWheel(ch, value)` — value is raw 14-bit (0–16384), NOT separate MSB/LSB
- Must call `audioCtx.audioWorklet.addModule(processorUrl)` before `new WorkletSynthesizer(audioCtx)`
- `synth.getSnapshot()` returns `SynthesizerSnapshot` with `channelSnapshots[0].patch.{program, name}`

### Volume Chain
- CC7 default in spessasynth = 100/127 (~78%) — fixed by calling `synth.controllerChange(0, 7, 127)` after init
- gainNode cap raised from 0.8 → 1.0
- `masterGain` set to 2 via `synth.setMasterParameter('masterGain', 2)`
- `DynamicsCompressorNode` inserted between synth and gainNode (threshold -18dBFS, ratio 4:1) to prevent clipping on chord clusters

### Reverb / Chorus
- SF2 presets have `reverbEffectsSend=0` by default → `setMasterParameter('reverbGain', N)` alone has no effect
- Must also call `synth.controllerChange(0, 91, 100)` to route signal into the reverb bus
- `reverbGain=1` / `chorusGain=1` at masterParameter level — higher values cause volume jump
- Toggle: ON = `controllerChange(91, 100)` + `setMasterParameter('reverbGain', 1)`, OFF = both to 0
