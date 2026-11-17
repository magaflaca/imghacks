import { store } from './store.js';

const root = document.documentElement;
const listeners = new Set();

export const theme = {
  get current() {
    return root.dataset.theme;
  },
  toggle() {
    root.dataset.theme = this.current === 'dark' ? 'light' : 'dark';
    store.set('theme', this.current);
    listeners.forEach((listener) => listener(this.current));
    return this.current;
  },
  onChange(listener) {
    listeners.add(listener);
  },
};
