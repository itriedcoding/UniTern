import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicDir = path.join(root, 'editor', 'public');
await mkdir(publicDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src', 'index.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'UniTern',
  target: 'es2020',
  outfile: path.join(publicDir, 'unitern.runtime.js'),
  logLevel: 'warning',
  legalComments: 'none',
});

await copyFile(path.join(root, 'templates', 'platformer', 'game.json'), path.join(publicDir, 'demo-scene.json'));

console.log('Prepared editor runtime and demo scene.');
