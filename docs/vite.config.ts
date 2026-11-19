import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

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
  base: './',
  resolve: {
    alias: [
      { find: /^@universal-material\/data-grid\/export-xlsx$/, replacement: src('export-xlsx/index.ts') },
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
