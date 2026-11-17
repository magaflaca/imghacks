import { api } from './api.js';
import { createComposer } from './composer.js';
import { installCursors } from './cursor.js';
import { createGallery } from './gallery.js';
import { createMascot } from './mascot.js';
import { icon, mountIcons, spriteCanvas } from './pixels.js';
import { startScene } from './scene.js';
import { sound } from './sound.js';
import { BUG_FRAMES, BUG_PALETTE } from './sprites.js';
import { theme } from './theme.js';

const $ = (id) => document.getElementById(id);

const EXAMPLE = `curl -X POST ${location.origin}/v1/generations \\
  -H "Authorization: Bearer TU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"nano-banana-pro","prompt":"un faro al atardecer","n":2,"aspect":"16:9"}'

curl ${location.origin}/v1/generations/ID \\
  -H "Authorization: Bearer TU_API_KEY"`;

installCursors();
mountIcons();
startScene($('scene'));
$('favicon').href = spriteCanvas(BUG_FRAMES.idle, BUG_PALETTE, 4).toDataURL();

const mascot = createMascot({ canvas: $('mascot'), perch: document.querySelector('.perch'), bubble: $('bubble') });
mascot.canvas.addEventListener('click', () => {
  sound.play('chirp');
  mascot.setMood('happy', 1400);
  mascot.say('hola.', 1800);
});

function bindToggle(button, iconFor, toggle) {
  const paint = () => button.replaceChildren(icon(iconFor()));
  button.addEventListener('click', () => {
    toggle();
    paint();
  });
  paint();
}

bindToggle($('sound-toggle'), () => (sound.muted ? 'mute' : 'sound'), () => sound.toggle());
bindToggle($('theme-toggle'), () => (theme.current === 'dark' ? 'sun' : 'moon'), () => {
  theme.toggle();
  sound.play('select');
});

$('example').textContent = EXAMPLE;
$('copy-example').addEventListener('click', async () => {
  await navigator.clipboard.writeText(EXAMPLE);
  sound.play('select');
  mascot.say('copiado.', 1800);
});

let active = 0;
const settle = (mood, line, tune) => {
  active = Math.max(0, active - 1);
  sound.play(tune);
  mascot.setMood(active ? 'working' : mood, active ? undefined : 2600);
  mascot.say(line, 6000);
};

const gallery = createGallery({
  root: $('gallery'),
  empty: $('empty'),
  lightbox: $('lightbox'),
  onEvent(kind, job) {
    if (kind === 'open') return sound.play('tap');
    if (kind === 'image') return sound.play('image');
    if (kind === 'done') return settle('happy', job.error ? 'listo, aunque alguna no salio.' : 'listo. que te parece', 'done');
    if (kind === 'failed') return settle('sad', job.error ?? 'no salio. prueba otra vez.', 'error');
  },
});

const FEEDBACK = {
  tap: () => sound.play('tap'),
  select: () => sound.play('select'),
  empty: () => {
    sound.play('error');
    mascot.say('primero cuentame que quieres ver.');
  },
  'adult-on': () => {
    sound.play('on');
    mascot.say('modo +18: uso el modelo hacks.');
  },
  'adult-off': () => sound.play('off'),
};

async function submit(payload) {
  const button = $('submit');
  button.disabled = true;
  try {
    const job = await api.generate(payload);
    active++;
    sound.play('start');
    mascot.setMood('working');
    mascot.say('voy. dame un momento.');
    gallery.follow(job);
    document.querySelector('.results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    sound.play('error');
    mascot.setMood('sad', 2600);
    mascot.say(error.message, 7000);
  } finally {
    button.disabled = false;
  }
}

try {
  createComposer({ models: await api.models(), onSubmit: submit, onFeedback: (kind) => FEEDBACK[kind]?.() });
  gallery.restore();
  mascot.say('hola. escribe algo y lo dibujo.', 5000);
} catch (error) {
  mascot.setMood('sad');
  mascot.say(error.message, 60_000);
}
