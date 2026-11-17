import { icon } from './pixels.js';
import { store } from './store.js';

const $ = (id) => document.getElementById(id);
const RATIO_BOX = 16;

function ratioGlyph(aspect) {
  const [w, h] = aspect.split(':').map(Number);
  const glyph = document.createElement('span');
  glyph.className = 'ratio';
  glyph.style.width = `${Math.round(RATIO_BOX * Math.min(1, w / h))}px`;
  glyph.style.height = `${Math.round(RATIO_BOX * Math.min(1, h / w))}px`;
  return glyph;
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
  const adultModel = models.find((model) => model.adult);

  const saved = store.get('choices', {});
  const state = {
    model: models.some(({ id }) => id === saved.model) ? saved.model : models[0].id,
    aspect: saved.aspect,
    style: saved.style,
    n: saved.n ?? 1,
    adult: false,
  };
  let previousModel = state.model;

  const current = () => models.find(({ id }) => id === state.model);

  function reconcile() {
    const model = current();
    if (!model.aspects.includes(state.aspect)) state.aspect = model.aspects[0];
    if (!model.styles.some(({ id }) => id === state.style)) state.style = model.styles[0]?.id;
    state.n = Math.min(Math.max(state.n, 1), model.max_images);
    store.set('choices', { model: state.adult ? previousModel : state.model, aspect: state.aspect, style: state.style, n: state.n });
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

    $('count').textContent = state.n;
    $('less').disabled = state.n <= 1;
    $('more').disabled = state.n >= model.max_images;
    adultSwitch.checked = state.adult;
  }

  function update(changes, feedback) {
    Object.assign(state, changes);
    render();
    if (feedback) onFeedback(feedback);
  }

  function setAdult(enabled) {
    if (enabled) previousModel = state.model;
    update({ adult: enabled, model: enabled ? adultModel.id : previousModel }, enabled ? 'adult-on' : 'adult-off');
  }

  $('less').addEventListener('click', () => update({ n: state.n - 1 }, 'tap'));
  $('more').addEventListener('click', () => update({ n: state.n + 1 }, 'tap'));

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
    onSubmit({ model, prompt: text, n, aspect, ...(style && { style }), ...(adult && { nsfw: true }) });
  });

  $('less').replaceChildren(icon('minus'));
  $('more').replaceChildren(icon('plus'));
  render();
}
