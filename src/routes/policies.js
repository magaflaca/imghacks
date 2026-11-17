import { tooMany, unauthorized } from '../core/errors.js';
import { RateWindow } from '../core/limiter.js';

const HOUR = 3_600_000;

const assertCapacity = (jobs, owner, maxActive) => {
  if (jobs.activeCount(owner) >= maxActive) {
    throw tooMany(`Ya tienes ${maxActive} generaciones en curso; espera a que termine alguna`);
  }
};

const bearer = (request) => request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? request.headers['x-api-key'];

export function apiPolicy({ keys, jobs, limits }) {
  return {
    authenticate(request) {
      const entry = keys.verify(bearer(request));
      if (!entry) throw unauthorized();
      request.owner = `key:${entry.id}`;
    },
    admit: (request) => assertCapacity(jobs, request.owner, limits.activeJobs),
  };
}

export function webPolicy({ jobs, limits }) {
  const windows = new Map();
  const windowFor = (providerId) => windows.get(providerId) ?? windows.set(providerId, new RateWindow(HOUR)).get(providerId);

  return {
    authenticate(request) {
      request.owner = `ip:${request.headers['x-real-ip'] ?? request.ip}`;
    },
    admit(request, { model, params }) {
      assertCapacity(jobs, request.owner, limits.activeJobs);
      const quota = limits.perHour[model.provider.id];
      if (quota == null) return;
      const window = windowFor(model.provider.id);
      if (window.used(request.owner) + params.n > quota) {
        throw tooMany(`Limite por hora alcanzado para ${model.name} (${quota} imagenes). Prueba otro modelo o vuelve en un rato`);
      }
      window.hit(request.owner, params.n);
    },
  };
}
