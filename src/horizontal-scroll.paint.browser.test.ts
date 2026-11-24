/**
 * Frente 30, pintura em pixel físico (relato do ClickCompliance na 0.5.0
 * local): em escala de 110% e com o grid num x fracionário, a faixa do
 * cabeçalho (`overflow-x: hidden`) era pintada num deslocamento fracionário e
 * a linha da coluna fixa saía 1 pixel físico fora da do corpo. As faixas
 * precisam cair no mesmo pixel. Mede no screenshot do CDP em pixel físico
 * (o do Playwright reamostra para CSS e esconde o defeito).
 */
import { afterEach, expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';

import type { GridColumnDef } from './grid-column-def.js';
import { settle } from './test/fixture.js';

import './grid.js';

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateScale: (factor: number | null) => Promise<void>;
    captureDevicePixels: () => Promise<string>;
  }
}

const cleanups: (() => void)[] = [];

afterEach(async () => {
  cleanups.splice(0).forEach(fn => fn());
  await commands.emulateScale(null);
  await page.viewport(414, 896);
});

/** Canal vermelho de um pixel físico, com (x, y) em px CSS relativos a `el`. */
const capture = async (el: HTMLElement) => {
  const image = new Image();
  image.src = `data:image/png;base64,${await commands.captureDevicePixels()}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, image.width, image.height).data;
  const frame = window.frameElement?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const box = el.getBoundingClientRect();
  const scale = image.width / window.top!.innerWidth;
  return {
    scale,
    /** Vermelho dos pixels físicos de `fromX` a `toX` (px CSS) na altura `y` (px CSS). */
    row: (fromX: number, toX: number, y: number) => {
      const py = Math.round((frame.top + box.top + y) * scale);
      const out: number[] = [];

      for (let px = Math.floor((frame.left + box.left + fromX) * scale); px <= Math.ceil((frame.left + box.left + toX) * scale); px++) {
        out.push(data[(py * image.width + px) * 4]);
      }

      return out;
    },
  };
};

/** Índice e valor do pixel mais escuro (a linha) num trecho. */
const darkest = (values: number[]) => values.reduce((best, value, index) => value < best.value ? { index, value } : best, { index: -1, value: 256 });

it('escala 110%, grid num x fracionário: a linha da coluna fixa cai no mesmo pixel físico no cabeçalho, nas bandas e no corpo', async () => {
  // Iframe que cabe na janela do orquestrador (sem redução) e escala de 110%.
  await page.viewport(400, 560);
  await commands.emulateScale(1.1);
  const box = document.createElement('div');
  box.id = 'paint-outer';
  box.style.cssText = 'width:300px;height:380px;overflow:auto;padding-left:5.81px;padding-top:3.3px;box-sizing:border-box;';
  const grid = document.createElement('u-grid');
  grid.setAttribute('scroll-container', 'paint-outer');
  grid.style.cssText = 'color:#000;--u-grid-line-opacity:100%;';
  grid.showColumnLines = true;
  const leaves: GridColumnDef[] = Array.from({ length: 8 }, (_, i) => ({ path: `c${i}`, label: `C${i}`, width: 90, fixed: i === 0 ? 'start' as const : undefined }));
  grid.columns = [leaves[0], { label: 'Band', columns: leaves.slice(1, 3) }, ...leaves.slice(3)];
  grid.items = Array.from({ length: 40 }, (_, r) => Object.fromEntries(leaves.map((__, c) => [`c${c}`, `${r}-${c}`])));
  box.append(grid);
  document.body.append(box);
  cleanups.push(() => box.remove());
  await settle(grid);
  await settle(grid);

  const root = grid.shadowRoot!;
  const th = (label: string) => [...root.querySelectorAll<HTMLElement>('th')].find(cell => cell.querySelector('.header-text')?.textContent?.trim() === label)!;
  const view = () => box.getBoundingClientRect();
  const seam = th('C0').getBoundingClientRect().right - view().left;
  const yOf = (el: Element) => el.getBoundingClientRect().top - view().top + 8;

  const check = async () => {
    const shot = await capture(box);
    expect(shot.scale).toBeCloseTo(1.1, 2);
    const at = (y: number) => darkest(shot.row(seam - 4, seam + 4, y));
    const band = at(yOf(th('Band')));
    const leaf = at(yOf(th('C1')));
    const body = at(yOf(root.querySelector('tbody tr[role=row]')!));

    // a mesma coluna de pixels nas três faixas, e nítida (não dividida entre dois pixels)
    expect([band.index, leaf.index]).toEqual([body.index, body.index]);
    expect(band.value).toBeLessThan(60);
    expect(body.value).toBeLessThan(60);
  };

  // a origem das faixas num pixel físico inteiro (camadas arredondadas juntas)
  const onDevicePixel = () => {
    const rect = root.querySelector('.grid-bands')!.getBoundingClientRect();
    return [rect.left, rect.top].map(v => Math.abs(v * devicePixelRatio - Math.round(v * devicePixelRatio)) < 0.02);
  };

  expect(onDevicePixel()).toEqual([true, true]);
  await check();

  // o grid se move no contêiner (outra largura do layout do hospedeiro): realinha
  box.style.paddingLeft = '7.13px';
  box.style.paddingTop = '1.71px';
  await settle(grid);
  await settle(grid);
  expect(onDevicePixel()).toEqual([true, true]);

  // rolar o contêiner para baixo (o cabeçalho gruda) e voltar ao zero (relato do usuário)
  for (const y of [40, 120, 200, 90, 0]) {
    box.scrollTop = y;
    await settle(grid);
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  await check();
});
