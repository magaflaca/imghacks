import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { launch } from 'puppeteer-core';

const GENERATOR_PAGE = 'https://perchance.org/ai-text-to-image-generator';
const IMAGE_ORIGIN = 'https://image-generation.perchance.org';
const CHANNEL = 'ai-text-to-image-generator';
const GENERATOR_FRAME = /^https:\/\/[0-9a-f]{16,}\.perchance\.org\//;
const RECOVERABLE = /context was destroyed|navigation|detached/i;

const BROWSER_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser(preferred) {
  const found = [preferred, ...BROWSER_CANDIDATES].filter(Boolean).find(existsSync);
  if (!found) throw new Error('No se encontro Chrome; define HACKS_BROWSER');
  return found;
}

// Perchance solo entrega imagenes a un navegador real que haya pasado su Turnstile:
// se carga la pagina oficial y se inyecta el iframe de generacion dentro de su propio
// frame, capturando el resultado por postMessage.
export class PerchanceClient {
  #browser = null;
  #page = null;

  constructor({ proxy, userDataDir, browserPath, loadTimeoutMs }) {
    this.proxy = proxy;
    this.userDataDir = userDataDir;
    this.browserPath = browserPath;
    this.loadTimeoutMs = loadTimeoutMs;
  }

  get started() {
    return Boolean(this.#page);
  }

  async start() {
    if (this.#page) return;
    this.#browser = await launch({
      executablePath: findBrowser(this.browserPath),
      headless: false,
      userDataDir: this.userDataDir,
      defaultViewport: null,
      protocolTimeout: 300_000,
      args: [
        '--window-size=1280,900',
        '--window-position=-2400,-2400',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader-webgl',
        ...(this.proxy ? [`--proxy-server=${this.proxy}`] : []),
      ],
    });
    this.#page = (await this.#browser.pages())[0] ?? (await this.#browser.newPage());
    await this.#page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await this.#page.goto(GENERATOR_PAGE, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await this.#generatorFrame();
  }

  async #generatorFrame() {
    const deadline = Date.now() + this.loadTimeoutMs;
    while (Date.now() < deadline) {
      const frame = this.#page.frames().find((candidate) => GENERATOR_FRAME.test(candidate.url()));
      const ready = await frame?.evaluate(() => document.body?.innerText.length > 100).catch(() => false);
      if (ready) return frame;
      await sleep(1000);
    }
    throw new Error('El generador de Perchance no cargo (challenge de Cloudflare atascado)');
  }

  async generate({ prompt, negativePrompt, resolution, guidance = 7, timeoutMs }) {
    await this.start();
    // seed debe ser el NUMERO -1: como string el backend lo fija en 0 y repite la imagen.
    const request = {
      saveChannel: CHANNEL,
      prompt,
      seed: -1,
      resolution,
      guidanceScale: Number(guidance),
      defaultGuidanceScale: 7,
      negativePrompt,
      requestId: randomUUID(),
      iframeId: `wrap-${randomUUID()}`,
      hideGalleryButtons: true,
    };

    for (let attempt = 1; ; attempt++) {
      try {
        const dataUrl = await this.#runEmbed(request, timeoutMs);
        return Buffer.from(dataUrl.split(',')[1], 'base64');
      } catch (err) {
        if (attempt >= 3 || !RECOVERABLE.test(String(err))) throw err;
      }
    }
  }

  async #runEmbed(request, timeoutMs) {
    const frame = await this.#generatorFrame();
    return frame.evaluate(
      ({ request, origin, timeoutMs }) =>
        new Promise((resolve, reject) => {
          const iframe = document.createElement('iframe');
          iframe.src = `${origin}/embed#${encodeURIComponent(JSON.stringify(request))}`;
          iframe.style.cssText = 'position:fixed;top:0;left:0;width:512px;height:600px;border:0;z-index:99999;background:white;';
          const cleanup = () => {
            window.removeEventListener('message', onMessage);
            iframe.remove();
          };
          const onMessage = ({ origin: from, data }) => {
            if (from !== origin || data?.type !== 'finished' || !data.dataUrl) return;
            cleanup();
            resolve(data.dataUrl);
          };
          window.addEventListener('message', onMessage);
          document.body.appendChild(iframe);
          setTimeout(() => {
            cleanup();
            reject(new Error('Perchance no entrego la imagen a tiempo'));
          }, timeoutMs);
        }),
      { request, origin: IMAGE_ORIGIN, timeoutMs },
    );
  }

  async close() {
    const browser = this.#browser;
    this.#browser = null;
    this.#page = null;
    await browser?.close().catch(() => {});
  }
}
