import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('./editor', import.meta.url));
const outDir = fileURLToPath(new URL('./dist/editor', import.meta.url));

export default defineConfig({
  root,
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
});
