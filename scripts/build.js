#!/usr/bin/env node
// Empaqueta la web para produccion: un solo JS y un solo CSS minificados con huella de
// contenido en el nombre, para servirlos con cache inmutable desde el borde de Cloudflare.
import { build } from 'esbuild';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'web');
const target = path.join(root, 'dist', 'web');
const BUNDLED = new Set(['js', 'css', 'index.html']);

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true, filter: (file) => !BUNDLED.has(path.relative(source, file).split(path.sep)[0]) });

const { metafile } = await build({
  entryPoints: { app: path.join(source, 'js/main.js'), style: path.join(source, 'css/style.css') },
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  outdir: path.join(target, 'assets'),
  entryNames: '[name]-[hash]',
  metafile: true,
  logLevel: 'warning',
});

const outputs = Object.entries(metafile.outputs).map(([file, { entryPoint }]) => ({
  url: `/${path.relative(target, path.resolve(root, file)).replaceAll(path.sep, '/')}`,
  entry: entryPoint && path.basename(entryPoint),
}));
const urlOf = (entry) => outputs.find((output) => output.entry === entry).url;

const html = (await readFile(path.join(source, 'index.html'), 'utf8'))
  .replace('/css/style.css', urlOf('style.css'))
  .replace('/js/main.js', urlOf('main.js'));
await writeFile(path.join(target, 'index.html'), html);

console.log(outputs.map(({ url }) => url).join('\n'));
