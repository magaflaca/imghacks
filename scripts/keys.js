#!/usr/bin/env node
import { config } from '../src/config.js';
import { KeyStore } from '../src/core/keys.js';

const keys = new KeyStore(config.paths.keys);
const [command, argument] = process.argv.slice(2);

const commands = {
  create() {
    if (!argument) throw new Error('Uso: keys create <nombre>');
    const { key, id } = keys.create(argument);
    console.log(`${argument} (${id})\n${key}\nGuardala ahora: no se vuelve a mostrar.`);
  },
  list() {
    console.table(keys.list());
  },
  revoke() {
    if (!argument) throw new Error('Uso: keys revoke <id|nombre>');
    console.log(`Revocadas: ${keys.revoke(argument)}`);
  },
};

try {
  if (!commands[command]) throw new Error('Uso: keys <create|list|revoke> [argumento]');
  commands[command]();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
