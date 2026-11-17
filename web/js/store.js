const PREFIX = 'imghacks:';

const backed = (storage) => ({
  get(key, fallback) {
    try {
      const raw = storage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      storage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {}
  },
});

export const store = backed(localStorage);
export const session = backed(sessionStorage);
