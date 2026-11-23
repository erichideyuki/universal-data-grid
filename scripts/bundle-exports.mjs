/**
 * Bundles das exportações (specs 26 e 29), depois do `tsc`:
 *
 * - `workers`: `dist/export-{pdf,xlsx}/worker.js` num arquivo só (o worker
 *   não pode depender da resolução de módulos do hospedeiro), ao lado do
 *   `.wasm`; servem ao ESM (`dist/export-*\/index.js`) e ao bundle min.
 * - `min`: `dist/export-{pdf,xlsx}.min.js` autocontidos (para `/vendor` e
 *   CDN, como o `grid.min.js`), com os assets em `./export-*\/`.
 *
 * Confere no metafile que nenhum deles arrasta `lit`/`@lit/*`: só a API do
 * grid em runtime (o grid é o elemento passado), nunca o grid inteiro.
 *
 * Uso: `node scripts/bundle-exports.mjs workers|min|all`.
 */
import { copyFileSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

const which = process.argv[2] ?? 'all';
const FORBIDDEN = /node_modules[\\/](lit|lit-html|lit-element|@lit)[\\/]/;

const check = (metafile, out) => {
  const bad = Object.keys(metafile.inputs).filter(input => FORBIDDEN.test(input));

  if (bad.length) {
    throw new Error(`${out} must not bundle lit or @lit/*, but it pulls in:\n  ${bad.join('\n  ')}`);
  }
};

const bundle = async (entry, out, define = {}) => {
  const { metafile } = await build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2022',
    metafile: true,
    define,
    logLevel: 'warning',
  });
  check(metafile, out);
  const bytes = Object.values(metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
  console.log(`${out}  ${(bytes / 1024).toFixed(1)} KiB`);
};

for (const format of ['pdf', 'xlsx']) {
  if (which === 'workers' || which === 'all') {
    await bundle(`src/export-${format}/worker.ts`, `dist/export-${format}/worker.js`);
    // o mapa do `tsc` não descreve mais o arquivo empacotado
    rmSync(`dist/export-${format}/worker.js.map`, { force: true });
    copyFileSync(`src/export-${format}/grid-${format}.wasm`, `dist/export-${format}/grid-${format}.wasm`);
  }

  if (which === 'min' || which === 'all') {
    await bundle(`src/export-${format}/index.ts`, `dist/export-${format}.min.js`, { __U_GRID_ASSETS__: JSON.stringify(`./export-${format}/`) });
  }
}
