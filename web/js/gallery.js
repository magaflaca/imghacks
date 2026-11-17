import { api } from './api.js';
import { icon } from './pixels.js';
import { session } from './store.js';

const POLL_MS = 1800;
const FINAL = new Set(['done', 'failed']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fileName = (url) => `imghacks-${url.split('/').pop()}`;

export function createGallery({ root, empty, lightbox, onEvent }) {
  const frame = { image: lightbox.querySelector('img'), prompt: lightbox.querySelector('p'), save: lightbox.querySelector('[download]') };
  const tracked = new Set(session.get('jobs', []));

  const remember = () => session.set('jobs', [...tracked].slice(-24));
  const refreshEmpty = () => (empty.hidden = root.childElementCount > 0);

  function open(url, prompt) {
    frame.image.src = url;
    frame.image.alt = prompt;
    frame.prompt.textContent = prompt;
    frame.save.href = url;
    frame.save.download = fileName(url);
    lightbox.showModal();
    onEvent('open');
  }

  lightbox.addEventListener('click', (event) => event.target === lightbox && lightbox.close());
  lightbox.querySelector('#lightbox-close').addEventListener('click', () => lightbox.close());

  function placeholder(aspect) {
    const tile = document.createElement('figure');
    tile.className = 'tile px is-loading';
    tile.style.aspectRatio = aspect.replace(':', ' / ');
    return tile;
  }

  function reveal(tile, { url }, prompt) {
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'tile-image';
    view.setAttribute('aria-label', 'Ampliar imagen');
    const image = new Image();
    image.alt = prompt;
    image.loading = 'lazy';
    image.src = url;
    view.append(image);
    view.addEventListener('click', () => open(url, prompt));

    const save = document.createElement('a');
    save.className = 'tile-save icon-btn px';
    save.href = url;
    save.download = fileName(url);
    save.setAttribute('aria-label', 'Descargar');
    save.append(icon('download'));

    tile.classList.remove('is-loading');
    tile.replaceChildren(view, save);
  }

  function fail(tile, reason) {
    tile.classList.remove('is-loading');
    tile.classList.add('is-failed');
    tile.textContent = reason;
  }

  function paint(tiles, job, shown) {
    job.images.slice(shown).forEach((image, offset) => reveal(tiles[shown + offset], image, job.prompt));
    if (FINAL.has(job.status)) {
      tiles.slice(job.images.length).forEach((tile) => fail(tile, job.error ?? 'no se pudo generar'));
    }
    return job.images.length;
  }

  async function follow(job, { quiet = false } = {}) {
    const tiles = Array.from({ length: job.n }, () => placeholder(job.aspect));
    root.prepend(...tiles);
    refreshEmpty();
    tracked.add(job.id);
    remember();

    let shown = paint(tiles, job, 0);
    while (!FINAL.has(job.status)) {
      await sleep(POLL_MS);
      try {
        job = await api.job(job.id);
      } catch (error) {
        if (error.status !== 404) continue;
        job = { ...job, status: 'failed', error: 'la generacion expiro' };
      }
      const before = shown;
      shown = paint(tiles, job, shown);
      if (shown > before && !FINAL.has(job.status)) onEvent('image', job);
    }
    if (!quiet) onEvent(job.images.length ? 'done' : 'failed', job);
    return job;
  }

  async function restore() {
    for (const id of [...tracked]) {
      try {
        const job = await api.job(id);
        if (job.images.length || !FINAL.has(job.status)) follow(job, { quiet: true });
        else tracked.delete(id);
      } catch {
        tracked.delete(id);
      }
    }
    remember();
  }

  refreshEmpty();
  return { follow, restore };
}
