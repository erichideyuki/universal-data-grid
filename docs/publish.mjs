/**
 * Copia o site de documentação já construído (`dist-docs/`, `npm run
 * docs:build`) para a subpasta `data-grid/` do repositório do GitHub Pages do
 * Universal Material (universal-material.github.io), que publica em
 * https://universal-material.github.io/data-grid/.
 *
 *   npm run docs:publish                 # destino padrão: ../universal-material.github.io/data-grid
 *   npm run docs:publish -- <pasta>      # outro checkout do repositório do Pages
 *
 * Só escreve arquivos: commit e push no repositório do Pages ficam com quem
 * publica. O destino é apagado antes da cópia, então tem de terminar em
 * `data-grid` (trava contra apagar a raiz do site por engano).
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = resolve(root, 'dist-docs');
const target = resolve(process.argv[2] ?? resolve(root, '../universal-material.github.io/data-grid'));

if (!existsSync(resolve(source, 'index.html'))) {
  console.error(`Build not found in ${source}. Run "npm run docs:build" first.`);
  process.exit(1);
}

if (basename(target) !== 'data-grid') {
  console.error(`Refusing to replace ${target}: the target folder must be named "data-grid".`);
  process.exit(1);
}

if (!existsSync(resolve(target, '..'))) {
  console.error(`Parent folder not found: ${resolve(target, '..')}. Clone universal-material.github.io next to this repository or pass its data-grid folder.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Docs copied to ${target}`);
