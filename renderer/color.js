// hue per chromatic note index (0=C, 1=C#, ... 11=B), pastel palette
const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
const BLACK_KEY_CHROMA = new Set([1, 3, 6, 8, 10]) // C# D# F# G# A#

function noteColor(midiNote) {
  const chroma = midiNote % 12
  return {
    hue: HUES[chroma],
    sat: 55,
    lightBase: BLACK_KEY_CHROMA.has(chroma) ? 55 : 70,
    isBlack: BLACK_KEY_CHROMA.has(chroma),
  }
}

function hsl(h, s, l, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`
}

module.exports = { noteColor, hsl }
