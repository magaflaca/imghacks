import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp(config);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: config.host });
