import path from 'node:path';

const env = process.env;
const num = (key, fallback) => (Number.isFinite(Number(env[key])) && env[key] !== '' && env[key] != null ? Number(env[key]) : fallback);
const bool = (key, fallback) => (env[key] == null ? fallback : /^(1|true|yes)$/i.test(env[key]));
const list = (key, fallback) => (env[key] ?? fallback).split(',').map((s) => s.trim()).filter(Boolean);
const minutes = (n) => n * 60_000;

const dataDir = path.resolve(env.DATA_DIR ?? './data');

export const config = {
  port: num('PORT', 8796),
  host: env.HOST ?? '127.0.0.1',
  publicUrl: (env.PUBLIC_URL ?? '').replace(/\/$/, ''),
  providers: list('PROVIDERS', 'flow,hacks'),

  paths: {
    data: dataDir,
    images: path.join(dataDir, 'images'),
    profiles: path.join(dataDir, 'profiles'),
    keys: path.join(dataDir, 'keys.json'),
    web: path.resolve(import.meta.dirname, '../web'),
  },

  imageTtlMs: minutes(num('IMAGE_TTL_MIN', 30)),
  jobTtlMs: minutes(num('JOB_TTL_MIN', 30)),

  flow: {
    bin: env.FLOW_BIN ?? 'gflow',
    concurrency: num('FLOW_CONCURRENCY', 1),
    timeoutMs: num('FLOW_TIMEOUT_MS', 300_000),
  },

  hacks: {
    workers: num('HACKS_WORKERS', 2),
    browser: env.HACKS_BROWSER ?? '',
    timeoutMs: num('HACKS_TIMEOUT_MS', 150_000),
    loadTimeoutMs: num('HACKS_LOAD_TIMEOUT_MS', 45_000),
    idleMs: num('HACKS_IDLE_MS', 180_000),
    attempts: num('HACKS_ATTEMPTS', 4),
    direct: bool('HACKS_DIRECT', true),
    proxy: {
      seed: env.HACKS_PROXY_SEED ?? '',
      target: num('PROXY_TARGET', 12),
      maxFails: num('PROXY_MAX_FAILS', 3),
      refreshMs: num('PROXY_REFRESH_MS', minutes(10)),
      validateTimeoutMs: num('PROXY_VALIDATE_TIMEOUT_MS', 12_000),
      sources: list(
        'PROXY_SOURCES',
        [
          'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
          'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
          'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
        ].join(','),
      ),
    },
  },

  limits: {
    web: {
      activeJobs: num('WEB_ACTIVE_JOBS', 2),
      perHour: { flow: num('WEB_FLOW_PER_HOUR', 12), hacks: num('WEB_HACKS_PER_HOUR', 80) },
    },
    api: { activeJobs: num('API_ACTIVE_JOBS', 8) },
  },
};
