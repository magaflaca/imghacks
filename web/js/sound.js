import { store } from './store.js';

const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G4: 392, E4: 329.63, A4: 440 };
const STEP = 0.075;

// Cada sonido es una secuencia de [nota, pasos de duracion].
const TUNES = {
  tap: [['E5', 1]],
  select: [['C5', 1], ['G5', 1]],
  on: [['G5', 1], ['C6', 1.5]],
  off: [['G5', 1], ['C5', 1.5]],
  start: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 2]],
  image: [['A5', 1], ['E6', 2]],
  done: [['G5', 1], ['C6', 1], ['E6', 1], ['C6', 1], ['E6', 3]],
  error: [['A4', 1.5], ['E4', 3]],
  chirp: [['E6', 0.6], ['C6', 0.6], ['E6', 1]],
};

let context = null;
let muted = store.get('muted', false);

function tone(frequency, at, duration) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.11, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, at + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

export const sound = {
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    store.set('muted', muted);
    if (!muted) this.play('on');
    return muted;
  },
  play(name) {
    if (muted) return;
    try {
      context ??= new AudioContext();
      if (context.state === 'suspended') context.resume();
      let at = context.currentTime + 0.01;
      for (const [note, steps] of TUNES[name]) {
        tone(NOTE[note], at, steps * STEP * 2.2);
        at += steps * STEP;
      }
    } catch {}
  },
};
