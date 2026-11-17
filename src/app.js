import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { HttpError } from './core/errors.js';
import { ImageStore } from './core/images.js';
import { JobStore } from './core/jobs.js';
import { KeyStore } from './core/keys.js';
import { createRegistry } from './providers/index.js';
import { generationRoutes } from './routes/generations.js';
import { openaiRoutes } from './routes/openai.js';
import { apiPolicy, webPolicy } from './routes/policies.js';

export async function buildApp(config) {
  const app = Fastify({ logger: { level: 'info' }, bodyLimit: 64 * 1024 });

  const images = new ImageStore({ dir: config.paths.images, ttlMs: config.imageTtlMs, publicUrl: config.publicUrl });
  const jobs = new JobStore({ ttlMs: config.jobTtlMs, images });
  const keys = new KeyStore(config.paths.keys);
  const registry = createRegistry(config, app.log);
  const context = { registry, jobs, images };

  await images.start();
  await registry.start();
  app.addHook('onClose', () => registry.stop());

  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof HttpError;
    const status = known ? error.status : (error.statusCode ?? 500);
    if (status >= 500) request.log.error(error);
    const message = known || status < 500 ? error.message : 'Error interno';
    reply.code(status).send({ error: { code: error.code ?? 'error', message } });
  });

  const api = apiPolicy({ keys, jobs, limits: config.limits.api });
  const web = webPolicy({ jobs, limits: config.limits.web });

  app.register(generationRoutes(context, api), { prefix: '/v1' });
  app.register(openaiRoutes(context, api), { prefix: '/v1' });
  app.register(generationRoutes(context, web), { prefix: '/web' });
  app.get('/health', () => ({ ok: true }));

  app.register(fastifyStatic, {
    root: config.paths.images,
    prefix: '/i/',
    index: false,
    maxAge: config.imageTtlMs,
    immutable: true,
  });
  app.register(fastifyStatic, { root: config.paths.web, prefix: '/', decorateReply: false });

  return app;
}
