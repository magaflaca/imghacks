import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError, badRequest } from '../core/errors.js';
import { submitGeneration } from './generations.js';

const ASPECT_BY_SIZE = {
  '1024x1024': '1:1',
  '512x512': '1:1',
  '1024x1792': '9:16',
  '1792x1024': '16:9',
  '1024x1536': '3:4',
  '1536x1024': '4:3',
};

// Compatibilidad con clientes de OpenAI: POST /v1/images/generations espera a que termine.
export const openaiRoutes = (context, policy) => async (app) => {
  app.addHook('onRequest', async (request) => policy.authenticate(request));

  app.post('/images/generations', async (request) => {
    const { size, response_format: format = 'url', ...rest } = request.body ?? {};
    if (size && !ASPECT_BY_SIZE[size]) throw badRequest(`"size" debe ser uno de: ${Object.keys(ASPECT_BY_SIZE).join(', ')}`);

    const job = await submitGeneration(context, policy, request, { ...rest, aspect: rest.aspect ?? ASPECT_BY_SIZE[size] }).done;
    if (job.status === 'failed') throw new HttpError(502, 'generation_failed', job.error);

    const data = await Promise.all(
      job.images.map(async ({ url, name }) =>
        format === 'b64_json'
          ? { b64_json: (await readFile(path.join(context.images.dir, name))).toString('base64') }
          : { url },
      ),
    );
    return { created: Math.floor(job.createdAt / 1000), data };
  });
};
