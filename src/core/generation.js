import { badRequest } from './errors.js';
import { assertSafePrompt } from './guard.js';
import { sniffFormat } from './images.js';

const MAX_PROMPT = 2000;
const MAX_NEGATIVE = 500;
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

const text = (value, max, field) => {
  if (value == null) return '';
  if (typeof value !== 'string') throw badRequest(`"${field}" debe ser texto`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`"${field}" supera los ${max} caracteres`);
  return trimmed;
};

const oneOf = (value, allowed, field) => {
  if (value == null) return allowed[0];
  if (!allowed.includes(value)) throw badRequest(`"${field}" debe ser uno de: ${allowed.join(', ')}`);
  return value;
};

function references(value, model) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw badRequest('"images" debe ser una lista de imagenes en base64 o data URL');
  }
  if (value.length > model.maxReferences) {
    throw badRequest(
      model.maxReferences
        ? `${model.id} admite como maximo ${model.maxReferences} imagenes de referencia`
        : `${model.id} no admite imagenes de referencia; usa un modelo Gemini`,
      'references_unsupported',
    );
  }
  return value.map((item, index) => {
    const data = Buffer.from(item.replace(/^data:[^,]*,/, ''), 'base64');
    const format = sniffFormat(data);
    if (!format) throw badRequest(`"images[${index}]" no es PNG, JPEG ni WebP`);
    if (data.length > MAX_REFERENCE_BYTES) throw badRequest(`"images[${index}]" supera los 8 MB`);
    return { data, ext: format.ext };
  });
}

export function parseGeneration(body, registry) {
  if (!body || typeof body !== 'object') throw badRequest('Se esperaba un cuerpo JSON');

  const model = body.nsfw ? registry.adultModel() : registry.get(body.model ?? registry.list()[0]?.id);
  if (!model) throw badRequest(`Modelo desconocido: ${body.model}`, 'unknown_model');

  const prompt = text(body.prompt, MAX_PROMPT, 'prompt');
  if (!prompt) throw badRequest('Falta "prompt"');
  assertSafePrompt(prompt, model);

  const n = body.n ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > model.maxImages) {
    throw badRequest(`"n" debe ser un entero entre 1 y ${model.maxImages} para ${model.id}`);
  }

  const params = {
    prompt,
    n,
    aspect: oneOf(body.aspect, model.aspects, 'aspect'),
    negative: text(body.negative, MAX_NEGATIVE, 'negative'),
    references: references(body.images, model),
  };
  if (model.styles.length) params.style = oneOf(body.style, model.styles.map(({ id }) => id), 'style');

  return { model, params };
}
