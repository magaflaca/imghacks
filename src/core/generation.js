import { badRequest } from './errors.js';
import { assertSafePrompt } from './guard.js';

const MAX_PROMPT = 2000;
const MAX_NEGATIVE = 500;

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
  };
  if (model.styles.length) params.style = oneOf(body.style, model.styles.map(({ id }) => id), 'style');

  return { model, params };
}
