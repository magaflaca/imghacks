import { drawSprite } from './pixels.js';
import { BUG_FRAMES, BUG_PALETTE } from './sprites.js';

const TICK_MS = 180;
const GAZE_DISTANCE = 90;
const MOOD_CLASS = { happy: 'is-hopping', sad: 'is-drooping' };

export function createMascot({ canvas, perch, bubble }) {
  const ctx = canvas.getContext('2d');
  let mood = 'idle';
  let gaze = 'idle';
  let tick = 0;
  let moodTimer;
  let bubbleTimer;

  const frameName = () => {
    if (mood === 'working') return tick % 2 ? 'walkA' : 'walkB';
    if (mood !== 'idle') return mood;
    if (tick % 23 === 0) return 'blink';
    if (tick % 41 > 38) return 'wiggle';
    return gaze;
  };

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSprite(ctx, BUG_FRAMES[frameName()], BUG_PALETTE);
  };

  setInterval(() => {
    tick++;
    draw();
  }, TICK_MS);
  draw();

  addEventListener('pointermove', ({ clientX }) => {
    const { left, width } = canvas.getBoundingClientRect();
    const offset = clientX - (left + width / 2);
    gaze = offset < -GAZE_DISTANCE ? 'left' : offset > GAZE_DISTANCE ? 'right' : 'idle';
  });

  const mascot = {
    canvas,
    setMood(next, forMs) {
      clearTimeout(moodTimer);
      mood = next;
      canvas.classList.remove(...Object.values(MOOD_CLASS));
      void canvas.offsetWidth;
      if (MOOD_CLASS[next]) canvas.classList.add(MOOD_CLASS[next]);
      const walking = next === 'working';
      perch.style.setProperty('--stroll', `${-Math.min(150, perch.parentElement.clientWidth * 0.28)}px`);
      perch.classList.toggle('is-walking', walking);
      if (forMs) moodTimer = setTimeout(() => mascot.setMood('idle'), forMs);
      draw();
    },
    say(text, forMs = 4500) {
      clearTimeout(bubbleTimer);
      bubble.textContent = text;
      bubble.hidden = false;
      bubble.style.animation = 'none';
      void bubble.offsetWidth;
      bubble.style.animation = '';
      bubbleTimer = setTimeout(() => (bubble.hidden = true), forMs);
    },
  };
  return mascot;
}
