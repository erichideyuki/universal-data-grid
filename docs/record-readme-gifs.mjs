/**
 * Grava os GIFs do README (`.github/readme/*.gif`) a partir do site de
 * documentação rodando em modo dev.
 *
 *   npm run docs:dev                       # em outro terminal (porta 5174)
 *   node docs/record-readme-gifs.mjs       # todas as cenas
 *   node docs/record-readme-gifs.mjs grouping filtering
 *
 * Precisa do Chromium do Playwright (`npx playwright install chromium`) e do
 * `ffmpeg` no PATH. Cada cena captura quadros (screenshots) recortados no
 * cartão do exemplo, e os quadros viram um GIF com paleta própria.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const BASE = process.env.DOCS_URL ?? 'http://localhost:5174/';
const OUT = resolve(fileURLToPath(new URL('..', import.meta.url)), '.github/readme');
const VIEWPORT = { width: 1800, height: 1000 };
const pause = ms => new Promise(r => setTimeout(r, ms));

/** Arrasta com passos pequenos (o interactjs precisa de vários pointermove). */
const drag = async (page, from, to, steps = 30) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 4, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps });
  await pause(250);
  await page.mouse.up();
};

const center = async locator => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const scenes = {
  grouping: {
    route: 'grouping/drag-to-group',
    async play(page, card) {
      const header = card.locator('[part~="header-cell"]', { hasText: 'Product' }).first();
      const chip = card.locator('[part~="group-chip"]').last();
      const chipBox = await chip.boundingBox();
      await pause(600);
      await drag(page, await center(header), { x: chipBox.x + chipBox.width + 90, y: chipBox.y + chipBox.height / 2 });
      await pause(1200);
      // Recolhe e reabre o primeiro grupo.
      const groupRow = card.locator('[role="row"][aria-expanded]').first();
      await groupRow.click({ position: { x: 24, y: 20 } });
      await pause(900);
      await groupRow.click({ position: { x: 24, y: 20 } });
      await pause(1200);
    },
  },
  filtering: {
    route: 'filtering/filter-ui',
    async play(page, card) {
      const search = card.locator('[part~="search-input"]').first();
      await pause(600);
      await search.click();
      await page.keyboard.type('joao', { delay: 220 });
      await pause(1600);
      await search.fill('');
      await page.keyboard.type('brazil', { delay: 160 });
      await pause(1600);
    },
  },
  'big-data': {
    route: 'big-data/million-local',
    async play(page, card) {
      await card.locator('[part~="cell"]').first().waitFor();
      await pause(800);

      // Roda do mouse acelerando, depois saltos para o meio e para o fim do milhão.
      const { x, y } = await center(card.locator('u-grid'));
      await page.mouse.move(x, y);

      for (let i = 0; i < 14; i++) {
        await page.mouse.wheel(0, 600 + i * 500);
        await pause(90);
      }

      await pause(600);

      for (const fraction of [0.37, 0.71, 1]) {
        await card.locator('u-grid').evaluate((grid, f) => {
          const scroller = grid.shadowRoot.querySelector('.scroll-container');
          scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * f;
        }, fraction);
        await pause(900);
      }
      await card.getByRole('button', { name: 'Group by country' }).click();
      await pause(1800);
    },
  },
  editing: {
    route: 'editing/modes',
    async play(page, card) {
      const cell = (row, column) => card.locator('[role="row"]').nth(row).locator('[role="gridcell"]').nth(column);
      await pause(700);

      for (const [row, column, text] of [[2, 1, 'Ada Lovelace'], [2, 2, '42'], [4, 1, 'Grace Hopper']]) {
        await cell(row, column).dblclick();
        await pause(300);
        await page.keyboard.press('Control+A');
        await page.keyboard.type(text, { delay: 90 });
        await page.keyboard.press('Enter');
        await pause(700);
      }

      await pause(1200);
    },
  },
  'real-time': {
    route: 'real-time/ticker',
    async play() {
      await pause(5000);
    },
  },
};

/**
 * Captura quadros com page.screenshot (recortado no cartão) enquanto a cena
 * roda. O vídeo do Playwright (screencast) não serve: ele perde as linhas do
 * grid quando o scrollTop passa da casa dos milhões, embora a tela pinte.
 */
const record = async (name, scene) => {
  const dir = mkdtempSync(join(tmpdir(), `u-grid-${name}-`));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('u-grid-docs-theme', 'light'));
  await page.goto(`${BASE}#/${scene.route}`);

  const [pageId, exampleId] = scene.route.split('/');
  const card = page.locator(`#${pageId}--${exampleId}`);
  await card.locator('u-grid').waitFor();
  await page.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'start' }), `${pageId}--${exampleId}`);
  await page.evaluate(() => window.scrollBy(0, -16));
  await pause(1500);

  // Recorte: dos controles da demo até o fim do grid (sem o log de eventos).
  const demo = await card.locator('.demo').boundingBox();
  const grid = await card.locator('u-grid').first().boundingBox();
  const clip = { x: demo.x, y: demo.y, width: demo.width, height: Math.min(grid.y + grid.height + 16, VIEWPORT.height) - demo.y };

  const frames = [];
  let playing = true;
  const capture = (async () => {
    while (playing) {
      const file = join(dir, `${String(frames.length).padStart(4, '0')}.png`);
      await page.screenshot({ path: file, clip, animations: 'allow', caret: 'initial' });
      frames.push({ file, time: Date.now() });
    }
  })();

  await scene.play(page, card);
  playing = false;
  await capture;
  await browser.close();

  // Cada quadro dura até o próximo (concat do ffmpeg); o último segura 1 s.
  const entry = file => `file '${file.replaceAll('\\', '/')}'`;
  const list = frames.map((frame, index) => {
    const next = frames[index + 1];
    const duration = next ? (next.time - frame.time) / 1000 : 1;
    return `${entry(frame.file)}\nduration ${duration.toFixed(3)}`;
  });
  const listFile = join(dir, 'frames.txt');
  writeFileSync(listFile, `${list.join('\n')}\n${entry(frames.at(-1).file)}\n`);

  const output = join(OUT, `${name}.gif`);
  const filter = 'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', filter, '-loop', '0', output]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${output} (${frames.length} frames)`);
};

mkdirSync(OUT, { recursive: true });
const names = process.argv.slice(2);

for (const name of names.length ? names : Object.keys(scenes)) {
  await record(name, scenes[name]);
}
