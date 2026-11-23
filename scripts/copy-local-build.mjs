// Copia o build local (dist/) para a pasta vendor de um app hospedeiro, para
// validar uma correção antes de publicar. Uso:
//   npm run build && npm run bundle:browser
//   node scripts/copy-local-build.mjs <pasta-destino>
// Para voltar à versão publicada, o hospedeiro recopia do node_modules (no
// ClickCompliance: `node copy-vendor-packages.mjs` em src/frontend).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destination = process.argv[2];

if (!destination) {
  console.error('usage: node scripts/copy-local-build.mjs <destination-folder>');
  process.exit(1);
}

const files = [
  'dist/grid.min.js',
  'dist/export-xlsx.min.js',
  'dist/export-xlsx/worker.js',
  'dist/export-xlsx/grid-xlsx.wasm',
  'LICENSE',
];

const missing = files.filter(file => !existsSync(join(root, file)));

if (missing.length) {
  console.error(`missing ${missing.join(', ')} — run "npm run build && npm run bundle:browser" first`);
  process.exit(1);
}

for (const file of files) {
  const target = join(resolve(destination), file.replace(/^dist\//, ''));
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, file), target);
  console.log(`copied ${file} -> ${target}`);
}
