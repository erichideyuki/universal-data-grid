import type { GridRenderContextBase, GridRenderResult } from '../grid-column-def.js';
import type { DataGrid } from '../grid.js';

/**
 * Barra de ferramentas (frente 18): tipos públicos, composição (embutidos +
 * itens do hospedeiro, lado, recolhimento) e a medida do que cabe numa
 * linha. Sem DOM aqui além da medida; o render fica no `grid.ts`.
 */

/** Built-in toolbar items (each needs its feature on). */
export type GridToolbarItemName =
  | 'groupPanel'
  | 'searchPanel'
  | 'columnChooserButton'
  | 'exportButton'
  | 'addRowButton'
  | 'saveButton'
  | 'discardButton';

/** The automatic toolbar (`toolbarItems = null`), in order. Spread it to add your own items without losing future built-ins. */
export const GRID_DEFAULT_TOOLBAR_ITEMS: readonly GridToolbarItemName[] = Object.freeze([
  'groupPanel',
  'addRowButton',
  'saveButton',
  'discardButton',
  'exportButton',
  'columnChooserButton',
  'searchPanel',
] as const);

/** Options shared by built-in and host toolbar items. */
export interface GridToolbarItemOptions {
  /** Side of the bar. Default: `groupPanel` `start`; every other item `end`. */
  location?: 'start' | 'end';
  /**
   * When the item moves to the "More actions" menu: `auto` (when it does not
   * fit; default for built-in buttons), `always` or `never` (default for host
   * buttons). The group panel, the search panel and `renderer` items never move.
   */
  locateInMenu?: 'auto' | 'always' | 'never';
  /**
   * `in-menu`: only the icon on the bar (the text becomes the name and
   * tooltip; shown in the menu). Default `always`, except the built-in
   * `columnChooserButton` and `exportButton` (icon buttons: `in-menu`).
   */
  showText?: 'always' | 'in-menu';
  /** Shown and focusable, but does nothing (`aria-disabled`). */
  disabled?: boolean;
}

/** Configures a built-in item (`'searchPanel'` alone is the same as `{ name: 'searchPanel' }`). */
export interface GridBuiltInToolbarItem extends GridToolbarItemOptions {
  name: GridToolbarItemName;
  /** Replaces the translated label of a built-in button. */
  text?: string;
}

/** Context of a host button `action`. */
export interface GridToolbarItemActionContext {
  readonly toolbarItem: GridToolbarItem;
  readonly grid: DataGrid;
}

/** Context of a host `renderer` item (`signal` aborts when the item is removed or the grid disconnects). */
export interface GridToolbarItemRenderContext extends GridRenderContextBase {
  readonly toolbarItem: GridToolbarItem;
}

/** Renders host content into the bar (runs again when `toolbarItems` or the language change). */
export type GridToolbarItemRenderer = (context: GridToolbarItemRenderContext) => GridRenderResult;

/** A host button: `text` (its name) and `action`; `icon` is decorative. */
export interface GridToolbarButtonItem extends GridToolbarItemOptions {
  name?: never;
  /** Free id (never read by the grid). */
  id?: string;
  text: string;
  /** Decorative icon (`aria-hidden`): a `TemplateResult` (recommended) or text; an element is moved into the grid's shadow root. */
  icon?: GridRenderResult;
  action: (context: GridToolbarItemActionContext) => void;
  renderer?: never;
}

/**
 * Host content (`renderer`): its own Tab stop(s) outside the toolbar arrow
 * key navigation, at the start or the end of the bar (`location`); never
 * moves to the "More actions" menu.
 */
export interface GridToolbarContentItem extends Omit<GridToolbarItemOptions, 'locateInMenu' | 'showText' | 'disabled'> {
  name?: never;
  id?: string;
  renderer: GridToolbarItemRenderer;
  text?: string;
  icon?: never;
  action?: never;
}

/** A host toolbar item. */
export type GridHostToolbarItem = GridToolbarButtonItem | GridToolbarContentItem;

/** A toolbar item: built-in (`name`) or from the host. */
export type GridToolbarItem = GridBuiltInToolbarItem | GridHostToolbarItem;

const BUILT_IN_NAMES = new Set<string>(GRID_DEFAULT_TOOLBAR_ITEMS);

/** Embutidos que nunca vão ao "mais" e ficam fora do roving (avulsos) ou são o painel. */
const NEVER_IN_MENU = new Set<GridToolbarItemName>(['groupPanel', 'searchPanel']);

/** Item resolvido para o render. */
export type ToolbarEntry =
  | { kind: 'built-in'; key: string; name: GridToolbarItemName; item: GridBuiltInToolbarItem; location: 'start' | 'end'; inMenu: 'auto' | 'always' | 'never' }
  | { kind: 'button'; key: string; item: GridToolbarButtonItem; location: 'start' | 'end'; inMenu: 'auto' | 'always' | 'never' }
  | { kind: 'content'; key: string; item: GridToolbarContentItem; location: 'start' | 'end' };

export interface ResolvedToolbar {
  /** Avulsos (pontos de Tab próprios) antes do roving. */
  leading: ToolbarEntry[];
  /** Do roving, lado início (painel de grupos e botões). */
  start: ToolbarEntry[];
  /** Do roving, lado fim. */
  end: ToolbarEntry[];
  /** Avulsos depois do roving (busca, `renderer`). */
  trailing: ToolbarEntry[];
}

/** Avulso: fora do roving (busca e conteúdo do hospedeiro). */
export const isStandalone = (entry: ToolbarEntry): boolean =>
  entry.kind === 'content' || (entry.kind === 'built-in' && entry.name === 'searchPanel');

/** Pode ir ao "mais" (`auto`/`always`). */
export const isCollapsible = (entry: ToolbarEntry): boolean =>
  entry.kind !== 'content' && entry.inMenu !== 'never';

/** Avisos já dados por lista (`toolbarItems`) e motivo: uma vez cada, mesmo renderizando de novo. */
const warned = new WeakMap<object, Set<string>>();

const warnOnce = (owner: object, key: string, message: string): void => {
  let keys = warned.get(owner);

  if (!keys) {
    keys = new Set();
    warned.set(owner, keys);
  }

  if (!keys.has(key)) {
    keys.add(key);
    console.warn(`<u-grid>: ${message}`);
  }
};

/**
 * Compõe a barra: `items` (ou a automática) → embutidos ligados + itens do
 * hospedeiro, separados em avulsos/roving por lado, na ordem da lista.
 * `enabled(name)` diz se o recurso do embutido está ligado. Avisos (uma vez
 * por lista): nome repetido, embutido desligado, item sem nome.
 */
export const resolveToolbar = (
  items: readonly (GridToolbarItemName | GridToolbarItem)[] | null,
  enabled: (name: GridToolbarItemName) => boolean,
): ResolvedToolbar => {
  const source = items ?? GRID_DEFAULT_TOOLBAR_ITEMS;
  const resolved: ResolvedToolbar = { leading: [], start: [], end: [], trailing: [] };
  const seen = new Set<string>();
  const explicit = items !== null;

  source.forEach((raw, index) => {
    const item: GridToolbarItem = typeof raw === 'string' ? { name: raw } : raw;

    if (!item || typeof item !== 'object') {
      return;
    }

    let entry: ToolbarEntry | undefined;

    if (typeof item.name === 'string') {
      const name = item.name;

      if (!BUILT_IN_NAMES.has(name)) {
        warnOnce(source, `unknown:${name}`, `unknown toolbar item "${name}" ignored (host items use \`id\`, \`text\` and \`action\`).`);
        return;
      }

      if (seen.has(name)) {
        warnOnce(source, `twice:${name}`, `toolbar item "${name}" listed twice; the first one is used.`);
        return;
      }

      seen.add(name);

      if (!enabled(name)) {
        if (explicit) {
          warnOnce(source, `off:${name}`, `toolbar item "${name}" is not shown: its feature is off.`);
        }

        return;
      }

      const location = item.location ?? (name === 'groupPanel' ? 'start' : 'end');
      const inMenu = NEVER_IN_MENU.has(name) ? 'never' : item.locateInMenu ?? 'auto';
      entry = { kind: 'built-in', key: `b:${name}`, name, item, location, inMenu };
    } else if (typeof item.renderer === 'function') {
      entry = { kind: 'content', key: `c:${index}`, item, location: item.location ?? 'end' };
    } else if (typeof item.text === 'string' && item.text.trim() && typeof item.action === 'function') {
      entry = {
        kind: 'button',
        key: `h:${index}`,
        item,
        location: item.location ?? 'end',
        inMenu: item.locateInMenu ?? 'never',
      };
    } else {
      // Botão sem nome (WCAG 4.1.2) ou sem ação: fora.
      warnOnce(source, `unnamed:${index}`, 'toolbar item without `text` and `action` (or `renderer`) ignored.');
      return;
    }

    if (isStandalone(entry)) {
      (entry.location === 'start' ? resolved.leading : resolved.trailing).push(entry);
    } else {
      (entry.location === 'start' ? resolved.start : resolved.end).push(entry);
    }
  });

  return resolved;
};

/**
 * Quais itens recolhíveis vão ao "mais": os `always` e, dos `auto`, os que
 * não cabem — mantém o prefixo que cabe, na ordem (sai primeiro o do fim,
 * como no DevExtreme). `widthOf` devolve a largura medida (com o espaço
 * entre itens) ou `undefined` se nunca foi medida (nesse caso o item fica:
 * será medido no próximo render).
 */
export const overflowKeys = (
  entries: readonly ToolbarEntry[],
  available: number,
  fixedWidth: number,
  moreWidth: number,
  widthOf: (key: string) => number | undefined,
): Set<string> => {
  const overflow = new Set<string>();
  const auto: ToolbarEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === 'content') {
      continue;
    }

    if (entry.inMenu === 'always') {
      overflow.add(entry.key);
    } else if (entry.inMenu === 'auto') {
      auto.push(entry);
    }
  }

  const total = auto.reduce((sum, entry) => sum + (widthOf(entry.key) ?? 0), 0);

  if (fixedWidth + total + (overflow.size ? moreWidth : 0) <= available) {
    return overflow;
  }

  // Não cabe tudo: o "mais" aparece e entra no espaço fixo.
  let used = fixedWidth + moreWidth;
  let cut = false;

  for (const entry of auto) {
    const width = widthOf(entry.key) ?? 0;

    if (!cut && used + width <= available) {
      used += width;
    } else {
      cut = true;
      overflow.add(entry.key);
    }
  }

  return overflow;
};
