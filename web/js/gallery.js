import { api } from './api.js';
import { library } from './library.js';
import { icon } from './pixels.js';
import { session } from './store.js';

const POLL_MS = 1800;
const FINAL = new Set(['done', 'failed']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const idOf = (url) => url.split('/').pop();
const fileName = (id) => `imghacks-${id}`;

export function createGallery({ root, empty, clearButton, lightbox, onEvent }) {
  const frame = { image: lightbox.querySelector('img'), prompt: lightbox.querySelector('p'), save: lightbox.querySelector('[download]') };
  const tracked = new Set(session.get('jobs', []));

  const remember = () => session.set('jobs', [...tracked]);
  const refreshEmpty = () => {
    empty.hidden = root.childElementCount > 0;
    clearButton.hidden = !root.querySelector('.tile:not(.is-loading)');
  };

  function open({ id, src, prompt }) {
    frame.image.src = src;
    frame.image.alt = prompt;
    frame.prompt.textContent = prompt;
    frame.save.href = src;
    frame.save.download = fileName(id);
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

  function action(tag, kind, label, glyph) {
    const control = document.createElement(tag);
    control.className = `tile-action tile-${kind} icon-btn px`;
    control.setAttribute('aria-label', label);
    control.append(icon(glyph));
    return control;
  }

  function reveal(tile, item) {
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'tile-image';
    view.setAttribute('aria-label', 'Ampliar imagen');
    const image = new Image();
    image.alt = item.prompt;
    image.src = item.src;
    view.append(image);
    view.addEventListener('click', () => open(item));

    const save = action('a', 'save', 'Descargar', 'download');
    save.href = item.src;
    save.download = fileName(item.id);

    const remove = action('button', 'remove', 'Borrar', 'close');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      library.remove(item.id).catch(() => {});
      tile.remove();
      refreshEmpty();
      onEvent('remove');
    });

    const edit = action('button', 'edit', 'Editar con un modelo Gemini', 'pencil');
    edit.type = 'button';
    edit.addEventListener('click', () => onEvent('edit', item));

    tile.classList.remove('is-loading');
    tile.replaceChildren(view, save, remove, edit);
    refreshEmpty();
  }

  function fail(tile, reason) {
    tile.classList.remove('is-loading');
    tile.classList.add('is-failed');
    tile.textContent = reason;
    refreshEmpty();
  }

  function paint(tiles, job, shown, skip) {
    job.images.slice(shown).forEach(({ url }, offset) => {
      const item = { id: idOf(url), src: url, prompt: job.prompt, aspect: job.aspect };
      reveal(tiles[shown - skip + offset], item);
      library.save({ ...item, url }).catch(() => {});
    });
    if (FINAL.has(job.status)) {
      tiles.slice(job.images.length - skip).forEach((tile) => fail(tile, job.error ?? 'no se pudo generar'));
    }
    return job.images.length;
  }

  // `skip` son las imagenes del trabajo que ya estaban en la biblioteca al recargar.
  async function follow(job, { quiet = false, skip = 0 } = {}) {
    const tiles = Array.from({ length: job.n - skip }, () => placeholder(job.aspect));
    root.prepend(...tiles);
    refreshEmpty();
    tracked.add(job.id);
    remember();

    let shown = paint(tiles, job, skip, skip);
    while (!FINAL.has(job.status)) {
      await sleep(POLL_MS);
      try {
        job = await api.job(job.id);
      } catch (error) {
        if (error.status !== 404) continue;
        job = { ...job, status: 'failed', error: 'la generacion expiro' };
      }
      const before = shown;
      shown = paint(tiles, job, shown, skip);
      if (shown > before && !FINAL.has(job.status)) onEvent('image', job);
    }
    tracked.delete(job.id);
    remember();
    if (!quiet) onEvent(job.images.length ? 'done' : 'failed', job);
    return job;
  }

  async function restore() {
    const saved = await library.all().catch(() => []);
    for (const { id, blob, prompt, aspect } of saved) {
      const tile = placeholder(aspect);
      root.prepend(tile);
      reveal(tile, { id, src: URL.createObjectURL(blob), prompt, aspect });
    }
    refreshEmpty();

    const known = new Set(saved.map(({ id }) => id));
    for (const id of [...tracked]) {
      tracked.delete(id);
      try {
        const job = await api.job(id);
        const skip = job.images.filter(({ url }) => known.has(idOf(url))).length;
        if (job.n > skip) follow(job, { quiet: true, skip });
      } catch {}
    }
    remember();
  }

  function clear() {
    library.clear().catch(() => {});
    root.querySelectorAll('.tile:not(.is-loading)').forEach((tile) => tile.remove());
    refreshEmpty();
    onEvent('remove');
  }

  refreshEmpty();
  return { follow, restore, clear };
}
