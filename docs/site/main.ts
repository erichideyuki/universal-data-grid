import '../../docs/index.css';
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

// ------------------------------------------------------------------ tema

const THEME_KEY = 'u-grid-docs-theme';
const applyTheme = (theme: string) => {
  document.documentElement.dataset['theme'] = theme;
  document.documentElement.style.colorScheme = theme;
};

applyTheme(localStorage.getItem(THEME_KEY) ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

// ------------------------------------------------------------------ layout

const nav = el('nav', { className: 'nav', ariaLabel: 'Documentation' });
const content = el('main', { className: 'content', id: 'content', tabIndex: -1 });
const filter = el('input', { type: 'search', className: 'nav-filter', placeholder: 'Filter pages…', ariaLabel: 'Filter pages' });
const themeButton = el('button', { className: 'icon-button', type: 'button', title: 'Toggle dark theme', ariaLabel: 'Toggle dark theme' }, '◐');
const menuButton = el('button', { className: 'icon-button menu-button', type: 'button', ariaLabel: 'Menu', ariaExpanded: 'false' }, '☰');

themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset['theme'] === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

menuButton.addEventListener('click', () => {
  const open = document.body.classList.toggle('nav-open');
  menuButton.ariaExpanded = String(open);
});

document.body.append(
  el('a', { className: 'skip-link', href: '#content' }, 'Skip to content'),
  el('header', { className: 'topbar' },
    menuButton,
    el('a', { className: 'brand', href: '#/overview' }, el('span', { className: 'brand-mark' }, 'u'), 'u-grid'),
    el('span', { className: 'brand-sub' }, '@universal-material/data-grid'),
    el('span', { className: 'spacer' }),
    el('a', { className: 'top-link', href: `${REPO}#readme`, target: '_blank', rel: 'noopener' }, 'API reference'),
    el('a', { className: 'top-link', href: REPO, target: '_blank', rel: 'noopener' }, 'GitHub'),
    themeButton),
  el('div', { className: 'layout' }, el('aside', { className: 'sidebar' }, filter, nav), content),
);

// O cliente em "Skip to content" não pode virar rota.
document.querySelector('.skip-link')!.addEventListener('click', event => {
  event.preventDefault();
  content.focus();
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

  const copy = el('button', { className: 'copy-button', type: 'button' }, 'Copy');
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(source);
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy'), 1500);
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
  const toggle = el('button', { className: 'code-toggle', type: 'button', ariaExpanded: 'false' }, 'Show code');
  let codeLoaded = false;

  toggle.addEventListener('click', async () => {
    const open = toggle.ariaExpanded !== 'true';
    toggle.ariaExpanded = String(open);
    toggle.textContent = open ? 'Hide code' : 'Show code';

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
    host,
    el('div', { className: 'example-actions' }, toggle,
      el('a', { className: 'source-link', href: `${REPO}/blob/main/docs/examples/${pageId}/${id}.ts`, target: '_blank', rel: 'noopener' }, 'Source on GitHub')),
    codeHost);

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
  document.body.classList.remove('nav-open');
  menuButton.ariaExpanded = 'false';

  nav.querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
    if (link.dataset['page'] === pageId) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  if (!loader) {
    content.replaceChildren(el('h1', {}, 'Page not found'), el('p', {}, el('a', { href: '#/overview' }, 'Back to the overview')));
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
    header.append(el('p', { className: 'readme-link' }, el('a', { href: `${REPO}${page.readme}`, target: '_blank', rel: 'noopener' }, 'Full API in the README →')));
  }

  const toc = el('nav', { className: 'toc', ariaLabel: 'On this page' }, el('h2', {}, 'On this page'),
    el('ul', {}, ...cards.map(card => el('li', {}, el('a', { href: `#/${pageId}/${card.id.split('--')[1]}` }, card.querySelector('h2')!.textContent!)))));

  content.replaceChildren(header, ...(cards.length > 1 ? [toc] : []), ...cards, pager(pageId));

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
    prev ? el('a', { href: `#/${prev}`, className: 'prev' }, el('small', {}, 'Previous'), titles.get(prev) ?? prev) : el('span'),
    next ? el('a', { href: `#/${next}`, className: 'next' }, el('small', {}, 'Next'), titles.get(next) ?? next) : el('span'));
};

window.addEventListener('hashchange', () => void render());
await buildNav();
await render();
