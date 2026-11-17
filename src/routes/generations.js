import { notFound } from '../core/errors.js';
import { parseGeneration } from '../core/generation.js';
import { presentJob } from '../core/jobs.js';

export const submitGeneration = ({ registry, jobs }, policy, request, body = request.body) => {
  const spec = parseGeneration(body, registry);
  policy.admit(request, spec);
  return jobs.create({ ...spec, owner: request.owner });
};

export const generationRoutes = (context, policy) => async (app) => {
  const { registry, jobs } = context;

  app.addHook('onRequest', async (request) => policy.authenticate(request));

  app.get('/models', () => ({ data: registry.list() }));

  app.post('/generations', (request, reply) => {
    const job = submitGeneration(context, policy, request);
    reply.code(202);
    return presentJob(job);
  });

  app.get('/generations/:id', (request) => {
    const job = jobs.get(request.params.id);
    if (!job || job.owner !== request.owner) throw notFound('Generacion no encontrada o expirada');
    return presentJob(job);
  });
};
