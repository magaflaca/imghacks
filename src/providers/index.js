import { createFlowProvider } from './flow.js';
import { createHacksProvider } from './hacks/index.js';
import { createMockProvider } from './mock.js';

const FACTORIES = {
  flow: (config) => createFlowProvider(config.flow),
  hacks: (config, log) => createHacksProvider(config.hacks, { profilesDir: config.paths.profiles, log }),
  mock: () => createMockProvider(),
};

export function createRegistry(config, log) {
  const providers = config.providers.map((id) => {
    if (!FACTORIES[id]) throw new Error(`Proveedor desconocido: ${id}`);
    return FACTORIES[id](config, log);
  });
  const models = new Map(providers.flatMap((provider) => provider.models.map((model) => [model.id, { ...model, provider }])));

  return {
    get: (id) => models.get(id),
    adultModel: () => [...models.values()].find((model) => model.adult),
    list: () =>
      [...models.values()].map(({ id, name, description, aspects, maxImages, adult, styles, provider }) => ({
        id,
        name,
        description,
        aspects,
        max_images: maxImages,
        adult,
        styles,
        queue: provider.queue.pending + provider.queue.active,
      })),
    start: () => Promise.all(providers.map((provider) => provider.start?.())),
    stop: () => Promise.all(providers.map((provider) => provider.stop?.())),
  };
}
