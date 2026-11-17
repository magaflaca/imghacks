import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createQueue } from '../core/queue.js';

const ASPECTS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const IMAGE_FILE = /\.(png|jpe?g|webp)$/i;

const CATALOG = [
  { id: 'nano-banana-2.1', alias: 'nano2', name: 'Nano Banana 2.1', description: 'Gemini rapido y equilibrado' },
  { id: 'nano-banana-pro', alias: 'nano-pro', name: 'Nano Banana Pro', description: 'Gemini de maxima calidad y texto nitido' },
  { id: 'nano-banana-2-lite', alias: 'nano2-lite', name: 'Nano Banana 2 Lite', description: 'Gemini ligero, el mas veloz' },
];

const lastProblem = (output) => {
  const lines = output.split('\n').reverse();
  for (const line of lines) {
    if (!line.startsWith('{')) continue;
    try {
      const { problem } = JSON.parse(line);
      if (problem) return problem.detail ?? problem.title;
    } catch {}
  }
  return lines.find((line) => line.trim() && !line.startsWith('{'))?.trim();
};

function runCli(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GFLOW_CLI_UPDATE_CHECK: '0', GFLOW_CLI_LEASE_WAIT_SECONDS: '300' },
    });
    let output = '';
    const collect = (chunk) => {
      output = (output + chunk).slice(-20_000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

export function createFlowProvider({ bin, concurrency, timeoutMs }) {
  const queue = createQueue(concurrency);

  const provider = {
    id: 'flow',
    queue,
    models: CATALOG.map((model) => ({ ...model, aspects: ASPECTS, maxImages: 4, adult: false, styles: [] })),

    generate: ({ model, prompt, n, aspect }, hooks) =>
      queue.run(async () => {
        hooks.onStart();
        const outDir = await mkdtemp(path.join(os.tmpdir(), 'imghacks-flow-'));
        try {
          const args = ['image', 't2i', '--model', model.alias, '--aspect', aspect, '-n', String(n), '--out', outDir, '--', prompt];
          const { code, output } = await runCli(bin, args, timeoutMs);
          const files = (await readdir(outDir, { recursive: true })).filter((file) => IMAGE_FILE.test(file)).sort();
          for (const file of files) await hooks.onImage(await readFile(path.join(outDir, file)));
          if (!files.length) throw new Error(lastProblem(output) ?? `Flow termino sin imagenes (codigo ${code})`);
        } finally {
          await rm(outDir, { recursive: true, force: true });
        }
      }),
  };
  return provider;
}
