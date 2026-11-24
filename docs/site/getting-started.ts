/**
 * Topo do Overview: o comando de instalação (com copiar) e a tabela de
 * navegadores. A tabela é a mesma do README e do API.md ("Browser support"),
 * medida no BrowserStack em 2026-11-24 — mudou o mínimo ou a lista testada,
 * atualizar os três.
 *
 * Logos: simple-icons (CC0), só as marcas que o pacote tem; o Edge saiu do
 * simple-icons a pedido da Microsoft e fica com um ícone neutro.
 */
import { siAndroid, siApple, siFirefoxbrowser, siGooglechrome, siSafari } from 'simple-icons';

interface Brand {
  title: string;
  path: string;
  hex: string;
}

interface Support {
  browser: string;
  /** Sistema, quando não é o desktop. */
  platform?: string;
  logo: Brand | null;
  platformLogo?: Brand;
  minimum: string;
  tested: string;
}

const SUPPORT: readonly Support[] = [
  { browser: 'Chrome', logo: siGooglechrome, minimum: '114', tested: '114 and 158 on Windows' },
  { browser: 'Edge', logo: null, minimum: '114', tested: '114 and 157 on Windows' },
  { browser: 'Firefox', logo: siFirefoxbrowser, minimum: '125', tested: '125 and 160 on Windows' },
  { browser: 'Safari', platform: 'macOS', logo: siSafari, platformLogo: siApple, minimum: '17', tested: '17.3 and 27' },
  { browser: 'Safari', platform: 'iOS and iPadOS', logo: siSafari, platformLogo: siApple, minimum: '17', tested: 'iOS 26 on an iPhone 17' },
  { browser: 'Chrome', platform: 'Android', logo: siGooglechrome, platformLogo: siAndroid, minimum: '114', tested: 'Android 15 on a Galaxy S25' },
];

const INSTALL = 'npm i @universal-material/data-grid';

const SVG = 'http://www.w3.org/2000/svg';

const html = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]) => {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
};

/** Logo decorativo (o nome do navegador está no texto ao lado). Preto vira a cor do texto (tema escuro). */
const logo = (brand: Brand | null, small = false) => {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add(small ? 'browser-platform-logo' : 'browser-logo');

  if (!brand) {
    // Edge: um globo neutro (sem logo de marca disponível)
    svg.classList.add('browser-logo-generic');
    const circle = document.createElementNS(SVG, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '9.5');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', 'M2.5 12h19M12 2.5c2.6 2.6 3.8 6 3.8 9.5s-1.2 6.9-3.8 9.5c-2.6-2.6-3.8-6-3.8-9.5s1.2-6.9 3.8-9.5Z');
    svg.append(circle, path);
    return svg;
  }

  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', brand.path);
  svg.append(path);

  if (brand.hex !== '000000') {
    svg.style.fill = `#${brand.hex}`;
  }

  return svg;
};

const installBlock = (copyLabel: () => HTMLElement) => {
  const label = html('span', '', 'Copy');
  const copy = html('button', 'copy-button install-copy', copyLabel(), label);
  copy.type = 'button';
  copy.setAttribute('aria-label', `Copy ${INSTALL}`);
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(INSTALL);
    label.textContent = 'Copied';
    setTimeout(() => (label.textContent = 'Copy'), 1500);
  });

  const prompt = html('span', 'install-prompt', '$');
  prompt.setAttribute('aria-hidden', 'true');
  return html('div', 'install', html('code', 'install-command', prompt, INSTALL), copy);
};

const supportTable = () => {
  const head = html('thead', '', html('tr', '',
    ...['Browser', 'Minimum version', 'Tested on real browsers'].map(text => {
      const th = html('th', '', text);
      th.scope = 'col';
      return th;
    })));

  const body = html('tbody', '', ...SUPPORT.map(row => {
    const name = html('span', 'browser-name', row.browser);
    const platform = row.platform
      ? html('span', 'browser-platform', ...row.platformLogo ? [logo(row.platformLogo, true)] : [], row.platform)
      : html('span', 'browser-platform', 'Desktop');
    const th = html('th', '', html('div', 'browser-cell', logo(row.logo), html('span', 'browser-text', name, platform)));
    th.scope = 'row';
    return html('tr', '', th, html('td', 'browser-minimum', html('span', 'version-chip', `${row.minimum}+`)), html('td', 'browser-tested', row.tested));
  }));

  const caption = html('caption', 'visually-hidden', 'Minimum browser versions');
  return html('div', 'support-wrap', html('table', 'support-table', caption, head, body));
};

/** Bloco do topo do Overview; `copyIcon` = o ícone do site (Material Symbols). */
export const gettingStarted = (copyIcon: () => HTMLElement): HTMLElement => {
  const note = html('p', 'support-note',
    'Each version renders the grid, exports to Excel and PDF, and groups and sorts a million rows with no console errors. Chrome and Edge 114 to 119 need ',
    html('strong', '', '0.7.0'),
    ' or later. Internet Explorer and legacy Edge are not supported.');

  return html('section', 'page-lead',
    html('div', 'lead-block', html('h2', 'lead-title', 'Install'), installBlock(copyIcon)),
    html('div', 'lead-block', html('h2', 'lead-title', 'Browser support'), supportTable(), note));
};
