import { drafts } from './library.js';
import { icon } from './pixels.js';
import { store } from './store.js';

const $ = (id) => document.getElementById(id);
const RATIO_BOX = 16;
const REFERENCE_SIDE = 1536;

function ratioGlyph(aspect) {
  const [w, h] = aspect.split(':').map(Number);
  const glyph = document.createElement('span');
  glyph.className = 'ratio';
  glyph.style.width = `${Math.round(RATIO_BOX * Math.min(1, w / h))}px`;
  glyph.style.height = `${Math.round(RATIO_BOX * Math.min(1, h / w))}px`;
  return glyph;
}

// Las referencias viajan como JPEG reducido: pesan poco y el modelo no necesita mas.
async function toReference(blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, REFERENCE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function renderOptions(host, items, selected, { onPick, build, disabled = () => false }) {
  host.replaceChildren(
    ...items.map((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option px';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(item.id === selected));
      button.disabled = disabled(item);
      build(button, item);
      button.addEventListener('click', () => item.id !== selected && onPick(item.id));
      return button;
    }),
  );
}

export function createComposer({ models, onSubmit, onFeedback }) {
  const form = $('composer');
  const prompt = $('prompt');
  const adultSwitch = $('adult');
  const gate = $('gate');
  const picker = $('reference-picker');
  const adultModel = models.find((model) => model.adult);
  const editingModel = models.find((model) => model.max_references > 0);

  // Todo lo que el usuario elige se recuerda en su navegador entre visitas.
  const saved = store.get('choices', {});
  const savedModel = models.some(({ id }) => id === saved.model) ? saved.model : models[0].id;
  const adult = Boolean(saved.adult && adultModel && store.get('adult-ok', false));
  const state = {
    model: adult ? adultModel.id : savedModel,
    aspect: saved.aspect,
    style: saved.style,
    n: saved.n ?? 1,
    adult,
    references: [],
  };
  let previousModel = savedModel;
  prompt.value = saved.prompt ?? '';

  const current = () => models.find(({ id }) => id === state.model);

  function reconcile() {
    const model = current();
    if (!model.aspects.includes(state.aspect)) state.aspect = model.aspects[0];
    if (model.styles.length && !model.styles.some(({ id }) => id === state.style)) state.style = model.styles[0].id;
    state.n = Math.min(Math.max(state.n, 1), model.max_images);
    persist();
  }

  function persist() {
    const { aspect, style, n, adult } = state;
    store.set('choices', { model: adult ? previousModel : state.model, aspect, style, n, adult, prompt: prompt.value });
  }

  function renderReferences(model) {
    const shown = state.references.slice(0, model.max_references);
    $('reference-field').hidden = !model.max_references;
    $('reference-add').hidden = shown.length >= model.max_references;
    $('references').replaceChildren(
      ...shown.map((source, index) => {
        const thumb = document.createElement('button');
        thumb.type = 'button';
        thumb.className = 'reference px';
        thumb.setAttribute('aria-label', 'Quitar imagen de referencia');
        const image = new Image();
        image.src = source;
        image.alt = '';
        thumb.append(image, icon('close'));
        thumb.addEventListener('click', () => update({ references: state.references.filter((_, at) => at !== index) }, 'tap'));
        return thumb;
      }),
    );
  }

  function render() {
    reconcile();
    const model = current();

    renderOptions($('models'), models, state.model, {
      disabled: (item) => state.adult && !item.adult,
      onPick: (id) => update({ model: id }, 'select'),
      build(button, item) {
        button.classList.add('option-model');
        if (item.adult) button.dataset.adult = '';
        const name = document.createElement('span');
        name.textContent = item.name;
        const note = document.createElement('small');
        note.textContent = item.description;
        button.append(name, note);
      },
    });

    renderOptions($('aspects'), model.aspects.map((id) => ({ id })), state.aspect, {
      onPick: (id) => update({ aspect: id }, 'select'),
      build: (button, { id }) => button.append(ratioGlyph(id), id),
    });

    $('style-field').hidden = !model.styles.length;
    renderOptions($('styles'), model.styles, state.style, {
      onPick: (id) => update({ style: id }, 'select'),
      build: (button, { name }) => button.append(name),
    });

    renderReferences(model);
    $('count').textContent = state.n;
    $('less').disabled = state.n <= 1;
    $('more').disabled = state.n >= model.max_images;
    adultSwitch.checked = state.adult;
  }

  function update(changes, feedback) {
    Object.assign(state, changes);
    if (changes.references) drafts.set('references', state.references).catch(() => {});
    render();
    if (feedback) onFeedback(feedback);
  }

  function setAdult(enabled) {
    if (enabled) previousModel = state.model;
    update({ adult: enabled, model: enabled ? adultModel.id : previousModel }, enabled ? 'adult-on' : 'adult-off');
  }

  async function addReferences(blobs) {
    const images = [...blobs].filter((blob) => blob.type.startsWith('image/'));
    if (!images.length || !editingModel) return;
    const usable = current().max_references > 0 && !state.adult;
    const added = await Promise.all(images.map(toReference));
    update(
      {
        references: [...state.references, ...added].slice(-editingModel.max_references),
        ...(!usable && { adult: false, model: editingModel.id }),
      },
      'reference',
    );
  }

  $('less').addEventListener('click', () => update({ n: state.n - 1 }, 'tap'));
  $('more').addEventListener('click', () => update({ n: state.n + 1 }, 'tap'));

  $('reference-add').addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    await addReferences(picker.files);
    picker.value = '';
  });
  // Ctrl+V con una imagen en el portapapeles la anade como referencia, este donde este el foco.
  document.addEventListener('paste', (event) => {
    const images = [...event.clipboardData.items]
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile());
    if (!images.length) return;
    event.preventDefault();
    addReferences(images);
  });
  form.addEventListener('dragover', (event) => event.preventDefault());
  form.addEventListener('drop', (event) => {
    event.preventDefault();
    addReferences(event.dataTransfer.files);
  });

  adultSwitch.closest('.switch').hidden = !adultModel;
  adultSwitch.addEventListener('change', () => {
    if (!adultSwitch.checked) return setAdult(false);
    if (store.get('adult-ok', false)) return setAdult(true);
    adultSwitch.checked = false;
    gate.showModal();
  });
  gate.addEventListener('close', () => {
    if (gate.returnValue !== 'yes') return;
    store.set('adult-ok', true);
    setAdult(true);
  });

  prompt.addEventListener('input', persist);
  prompt.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) form.requestSubmit();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = prompt.value.trim();
    if (!text) {
      prompt.focus();
      return onFeedback('empty');
    }
    const { model, aspect, style, n, adult } = state;
    const images = state.references.slice(0, current().max_references);
    const styled = current().styles.length > 0;
    onSubmit({ model, prompt: text, n, aspect, ...(styled && { style }), ...(adult && { nsfw: true }), ...(images.length && { images }) });
  });

  $('less').replaceChildren(icon('minus'));
  $('more').replaceChildren(icon('plus'));
  render();
  drafts
    .get('references')
    .then((references) => references?.length && update({ references }))
    .catch(() => {});

  return {
    async edit(blob) {
      await addReferences([blob]);
      prompt.focus();
    },
  };
}
