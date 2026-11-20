import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

/**
 * Site de documentação (`npm run docs:dev` / `npm run docs:build`).
 *
 * Os exemplos importam `@universal-material/data-grid` como o hospedeiro
 * faria; aqui o nome aponta para o código-fonte em `src/`, então o código
 * mostrado na página é o mesmo que roda.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Base relativa: o build funciona em qualquer subpasta (no GitHub Pages do
  // Universal Material ele fica em /data-grid/).
  base: './',
  define: {
    __GRID_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: [
      { find: /^@universal-material\/data-grid\/export-xlsx$/, replacement: src('export-xlsx/index.ts') },
      { find: /^@universal-material\/data-grid\/export-pdf$/, replacement: src('export-pdf/index.ts') },
      { find: /^@universal-material\/data-grid$/, replacement: src('grid.ts') },
    ],
  },
  server: {
    host: 'localhost',
    port: 5174,
  },
  build: {
    outDir: fileURLToPath(new URL('../dist-docs', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
  },
});
