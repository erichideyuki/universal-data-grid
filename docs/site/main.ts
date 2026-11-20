import './tokens.css';
import './site.css';

import { highlight, inline } from './highlight.js';
import { NAV } from './nav.js';
import type { DocPage, ExampleCleanup, ExampleMeta, ExampleMount } from './types.js';

/**
 * Casca do site: menu, rota por hash (`#/página` ou `#/página/exemplo`),
 * cartões de exemplo montados quando chegam perto da tela e desmontados ao
 * trocar de página.
 */
const REPO = 'https://github.com/universal-material/data-grid';

const pageModules = import.meta.glob<{ default: DocPage }>('../pages/*.ts');
const exampleModules = import.meta.glob<{ default: ExampleMount; meta: ExampleMeta }>(['../examples/*/*.ts', '!../examples/shared/*.ts']);
const exampleSources = import.meta.glob<string>(['../examples/*/*.ts', '!../examples/shared/*.ts'], { query: '?raw', import: 'default' });

const pageKey = (id: string) => `../pages/${id}.ts`;
const exampleKey = (page: string, id: string) => `../examples/${page}/${id}.ts`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {}, ...children: (Node | string)[]) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
};

// ------------------------------------------------------------------ ícones

/** Ícone da fonte Material Symbols (a mesma do site do Universal Material). */
const icon = (name: string) => el('span', { className: 'icon', ariaHidden: 'true' }, name);

const SVG = 'http://www.w3.org/2000/svg';

const svg = (viewBox: string, ...paths: Record<string, string>[]) => {
  const node = document.createElementNS(SVG, 'svg');
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('aria-hidden', 'true');

  for (const attributes of paths) {
    const path = document.createElementNS(SVG, 'path');
    Object.entries(attributes).forEach(([name, value]) => path.setAttribute(name, value));
    node.append(path);
  }

  return node;
};

// Marca do Universal Material (o "U" do site principal).
const logo = () => el('span', { className: 'brand-logo' }, svg('0 0 24 24',
  { d: 'M5 5L5 17C5 19.7614 7.23858 22 10 22L14 22C16.7614 22 19 19.7614 19 17L19 5', stroke: 'white', 'stroke-opacity': '0.4', 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' },
  { d: 'M4 4V16C4 18.7614 6.23858 21 9 21L15 21C17.7614 21 20 18.7614 20 16V6L17 4V16C17 17.1046 16.1046 18 15 18L9 18C7.89543 18 7 17.1046 7 16V4H4Z', fill: 'white' },
  { d: 'M17 4L20 6L17 8V4Z', fill: 'white', 'fill-opacity': '0.5' }));

const githubMark = () => svg('0 0 24 24', {
  fill: 'currentColor',
  d: 'M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-1.93c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.28-1.67-1.28-1.67-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.97 10.97 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.8 1.18 1.82 1.18 3.08 0 4.42-2.7 5.39-5.27 5.68.41.35.78 1.04.78 2.11v3.13c0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z',
});

// ------------------------------------------------------------------ tema

const THEME_KEY = 'u-grid-docs-theme';
const themeButton = el('button', { className: 'icon-button', type: 'button' });

const applyTheme = (theme: string) => {
  document.documentElement.dataset['theme'] = theme;
  document.documentElement.style.colorScheme = theme;
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  themeButton.replaceChildren(icon(theme === 'dark' ? 'light_mode' : 'dark_mode'));
  themeButton.title = label;
  themeButton.ariaLabel = label;
};

applyTheme(localStorage.getItem(THEME_KEY) ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

// ------------------------------------------------------------------ layout

const API = `${REPO}/blob/main/API.md`;
const SPONSOR = 'https://github.com/sponsors/erichideyuki';
const nav = el('nav', { className: 'nav', ariaLabel: 'Documentation' });
const content = el('main', { className: 'content', id: 'content', tabIndex: -1 });
const filter = el('input', { type: 'search', className: 'nav-filter', placeholder: 'Filter pages…', ariaLabel: 'Filter pages' });
const menuButton = el('button', { className: 'icon-button menu-button', type: 'button', ariaLabel: 'Menu', ariaExpanded: 'false' }, icon('menu'));
const scrim = el('div', { className: 'scrim' });

themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset['theme'] === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

const setMenu = (open: boolean) => {
  document.body.classList.toggle('nav-open', open);
  menuButton.ariaExpanded = String(open);
};

menuButton.addEventListener('click', () => setMenu(!document.body.classList.contains('nav-open')));
scrim.addEventListener('click', () => setMenu(false));

document.body.append(
  el('a', { className: 'skip-link', href: '#content' }, 'Skip to content'),
  el('header', { className: 'topbar' },
    menuButton,
    el('a', { className: 'brand', href: '#/overview', ariaLabel: 'Universal Material Data Grid — overview' },
      logo(),
      el('span', { className: 'brand-text' },
        el('span', { className: 'brand-name' }, 'Universal'),
        el('span', { className: 'brand-name brand-accent' }, 'Material')),
      el('span', { className: 'brand-product' }, 'Data Grid')),
    el('span', { className: 'spacer' }),
    el('a', { className: 'sponsor-link', href: SPONSOR, target: '_blank', rel: 'noopener', title: 'Sponsor on GitHub', ariaLabel: 'Sponsor on GitHub' },
      icon('favorite'), el('span', { className: 'sponsor-text' }, 'Sponsor')),
    el('a', { className: 'top-link', href: API, target: '_blank', rel: 'noopener' }, 'API reference'),
    themeButton,
    el('a', { className: 'icon-button', href: REPO, target: '_blank', rel: 'noopener', title: 'View on GitHub', ariaLabel: 'View on GitHub' }, githubMark())),
  el('div', { className: 'layout' },
    el('aside', { className: 'sidebar' },
      el('div', { className: 'filter-field' }, icon('search'), filter),
      nav,
      el('a', { className: 'sidebar-footer', href: 'https://universal-material.github.io/', target: '_blank', rel: 'noopener' },
        icon('auto_awesome'),
        el('span', { className: 'sidebar-footer-text' },
          el('span', { className: 'sidebar-footer-title' }, 'Universal Material'),
          el('span', { className: 'sidebar-footer-sub' }, `data-grid v${__GRID_VERSION__} · MIT`)),
        icon('arrow_outward'))),
    scrim,
    content),
);

// O clique em "Skip to content" não pode virar rota.
document.querySelector('.skip-link')!.addEventListener('click', event => {
  event.preventDefault();
  content.focus();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
    setMenu(false);
    menuButton.focus();
  }
});

const titles = new Map<string, string>();

const buildNav = async () => {
  const ids = NAV.flatMap(section => section.pages).filter(id => pageModules[pageKey(id)]);
  const pages = await Promise.all(ids.map(async id => [id, (await pageModules[pageKey(id)]!()).default] as const));
  pages.forEach(([id, page]) => titles.set(id, page.title));

  for (const section of NAV) {
    const list = el('ul');

    for (const id of section.pages.filter(page => titles.has(page))) {
      list.append(el('li', {}, el('a', { href: `#/${id}` }, titles.get(id) ?? id)));
      (list.lastElementChild!.firstElementChild as HTMLElement).dataset['page'] = id;
    }

    nav.append(el('div', { className: 'nav-section' }, el('h2', {}, section.title), list));
  }
};

filter.addEventListener('input', () => {
  const query = filter.value.trim().toLowerCase();

  nav.querySelectorAll<HTMLElement>('.nav-section').forEach(section => {
    let any = false;

    section.querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
      const match = !query || link.textContent!.toLowerCase().includes(query);
      link.parentElement!.hidden = !match;
      any ||= match;
    });

    section.hidden = !any;
  });
});

// ------------------------------------------------------------------ exemplos

let cleanups: (() => void)[] = [];
let observer: IntersectionObserver | null = null;

const unmountAll = () => {
  observer?.disconnect();
  observer = null;
  cleanups.forEach(cleanup => {
    try {
      cleanup();
    } catch (error) {
      console.error(error);
    }
  });
  cleanups = [];
};

const stripMeta = (source: string) => source.replace(/^export const meta[\s\S]*?^};\r?\n(\r?\n)?/m, '');

const codeBlock = (source: string) => {
  const pre = el('pre', { className: 'code' });
  const code = el('code');
  code.append(highlight(source));
  pre.append(code);

  const label = el('span', {}, 'Copy');
  const copy = el('button', { className: 'copy-button', type: 'button' }, icon('content_copy'), label);
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(source);
    label.textContent = 'Copied';
    setTimeout(() => (label.textContent = 'Copy'), 1500);
  });

  return el('div', { className: 'code-wrap' }, copy, pre);
};

const exampleCard = async (pageId: string, id: string) => {
  const key = exampleKey(pageId, id);
  const loader = exampleModules[key];

  if (!loader) {
    return el('section', { className: 'example missing' }, `Missing example: ${key}`);
  }

  const module = await loader();
  const anchor = `#/${pageId}/${id}`;
  const host = el('div', { className: 'demo' });
  const codeHost = el('div', { className: 'code-host' });
  const toggleLabel = el('span', {}, 'Show code');
  const toggle = el('button', { className: 'code-toggle', type: 'button', ariaExpanded: 'false' }, icon('code'), toggleLabel);
  let codeLoaded = false;

  toggle.addEventListener('click', async () => {
    const open = toggle.ariaExpanded !== 'true';
    toggle.ariaExpanded = String(open);
    toggleLabel.textContent = open ? 'Hide code' : 'Show code';

    if (open && !codeLoaded) {
      codeLoaded = true;
      codeHost.append(codeBlock(stripMeta(await exampleSources[key]!())));
    }

    codeHost.hidden = !open;
  });
  codeHost.hidden = true;

  const card = el('section', { className: 'example', id: `${pageId}--${id}` },
    el('h2', {}, el('a', { href: anchor, className: 'anchor' }, module.meta.title)),
    el('p', { className: 'description' }, inline(module.meta.description)),
    el('div', { className: 'example-block' },
      host,
      el('div', { className: 'example-actions' }, toggle,
        el('a', { className: 'source-link', href: `${REPO}/blob/main/docs/examples/${pageId}/${id}.ts`, target: '_blank', rel: 'noopener' }, 'Source on GitHub', icon('open_in_new'))),
      codeHost));

  let mounted = false;

  const mount = async () => {
    if (mounted) {
      return;
    }

    mounted = true;

    try {
      const cleanup = await module.default(host) as ExampleCleanup | void;
      cleanups.push(() => {
        cleanup?.();
        host.replaceChildren();
      });
    } catch (error) {
      console.error(error);
      host.replaceChildren(el('p', { className: 'error' }, `This example failed to start: ${String(error)}`));
    }
  };

  return Object.assign(card, { mountExample: mount });
};

// ------------------------------------------------------------------ rotas

let renderToken = 0;
let currentPage: string | null = null;

const scrollToExample = async (pageId: string, exampleId: string | undefined) => {
  const target = exampleId ? document.getElementById(`${pageId}--${exampleId}`) : null;

  if (target) {
    await (target as HTMLElement & { mountExample?: () => Promise<void> }).mountExample?.();
    target.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
};

const render = async () => {
  const [, pageId = 'overview', exampleId] = location.hash.split('/');

  // Mesma página: só rola até o exemplo, sem desmontar as demos.
  if (pageId === currentPage) {
    await scrollToExample(pageId, exampleId);
    return;
  }

  const token = ++renderToken;
  currentPage = pageId;
  const loader = pageModules[pageKey(pageId)];

  unmountAll();
  setMenu(false);

  nav.querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
    if (link.dataset['page'] === pageId) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  if (!loader) {
    content.replaceChildren(el('div', { className: 'page' }, el('article', { className: 'article' },
      el('h1', {}, 'Page not found'), el('p', {}, el('a', { href: '#/overview' }, 'Back to the overview')))));
    return;
  }

  const page = (await loader()).default;
  const cards = await Promise.all(page.examples.map(id => exampleCard(pageId, id)));

  if (token !== renderToken) {
    return;
  }

  document.title = `${page.title} — u-grid`;

  const header = el('header', { className: 'page-header' },
    el('p', { className: 'eyebrow' }, NAV.find(section => section.pages.includes(pageId))?.title ?? ''),
    el('h1', {}, page.title),
    el('p', { className: 'intro' }, inline(page.intro)));

  if (page.readme) {
    header.append(el('p', { className: 'readme-link' },
      el('a', { href: `${API}${page.readme}`, target: '_blank', rel: 'noopener' }, 'Full API reference', icon('arrow_outward'))));
  }

  // Sumário: coluna à direita em telas largas, bloco no topo nas estreitas.
  const toc = el('nav', { className: 'toc', ariaLabel: 'On this page' }, el('h2', {}, icon('toc'), 'On this page'),
    el('ul', {}, ...cards.map(card => el('li', {}, el('a', { href: `#/${pageId}/${card.id.split('--')[1]}` }, card.querySelector('h2')!.textContent!)))));

  content.replaceChildren(el('div', { className: 'page' },
    el('article', { className: 'article' }, header, ...cards, pager(pageId)),
    ...(cards.length > 1 ? [toc] : [])));

  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer?.unobserve(entry.target);
        void (entry.target as HTMLElement & { mountExample?: () => Promise<void> }).mountExample?.();
      }
    }
  }, { rootMargin: '300px 0px' });
  cards.forEach(card => observer!.observe(card));

  await scrollToExample(pageId, exampleId);
};

const pager = (pageId: string) => {
  const order = NAV.flatMap(section => section.pages);
  const index = order.indexOf(pageId);
  const prev = order[index - 1];
  const next = order[index + 1];

  return el('nav', { className: 'pager', ariaLabel: 'Pages' },
    prev ? el('a', { href: `#/${prev}`, className: 'prev' }, icon('arrow_back'), el('span', {}, el('small', {}, 'Previous'), titles.get(prev) ?? prev)) : el('span'),
    next ? el('a', { href: `#/${next}`, className: 'next' }, el('span', {}, el('small', {}, 'Next'), titles.get(next) ?? next), icon('arrow_forward')) : el('span'));
};

window.addEventListener('hashchange', () => void render());
await buildNav();
await render();
