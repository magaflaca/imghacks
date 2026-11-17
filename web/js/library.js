const DATABASE = 'imghacks';
const STORE = 'images';

let opening;

function open() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

async function run(mode, action) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const request = action(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Biblioteca del navegador: las imagenes viven en este dispositivo aunque el servidor las borre.
export const library = {
  all: () => run('readonly', (store) => store.getAll()).then((items) => items.sort((a, b) => a.createdAt - b.createdAt)),
  remove: (id) => run('readwrite', (store) => store.delete(id)),
  clear: () => run('readwrite', (store) => store.clear()),
  async save({ id, url, prompt, aspect }) {
    const blob = await fetch(url).then((response) => response.blob());
    await run('readwrite', (store) => store.put({ id, blob, prompt, aspect, createdAt: Date.now() }));
  },
};
