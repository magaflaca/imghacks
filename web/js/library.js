const DATABASE = 'imghacks';
const VERSION = 2;
const STORES = { images: 'id', drafts: 'key' };

let opening;

function open() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

async function run(name, mode, action) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const request = action(database.transaction(name, mode).objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Biblioteca del navegador: las imagenes viven en este dispositivo aunque el servidor las borre.
export const library = {
  all: () => run('images', 'readonly', (store) => store.getAll()).then((items) => items.sort((a, b) => a.createdAt - b.createdAt)),
  remove: (id) => run('images', 'readwrite', (store) => store.delete(id)),
  clear: () => run('images', 'readwrite', (store) => store.clear()),
  async save({ id, url, prompt, aspect }) {
    const blob = await fetch(url).then((response) => response.blob());
    await run('images', 'readwrite', (store) => store.put({ id, blob, prompt, aspect, createdAt: Date.now() }));
  },
};

// Borradores pesados (las imagenes de referencia) que no caben en localStorage.
export const drafts = {
  get: (key) => run('drafts', 'readonly', (store) => store.get(key)).then((entry) => entry?.value),
  set: (key, value) => run('drafts', 'readwrite', (store) => store.put({ key, value })),
};
