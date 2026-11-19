import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { GridColumnDef, GridGroupPath } from '../grid-column-def.js';
import type { DataGrid, GridCellType } from '../grid.js';

/**
 * Menu de contexto (frente 18): tipos públicos, quais itens embutidos valem
 * em cada alvo e o toque longo (iOS não dispara `contextmenu` no toque).
 */

/**
 * Where a context menu opens: a column header (bands included), the group
 * panel (a chip or its empty area), a data row (any of its cells) or a group
 * row. May gain members in minor versions.
 */
export type GridContextMenuTarget = 'header' | 'group-panel' | 'row' | 'group-row';

/** Built-in context menu items (the grid runs their action). */
export type GridContextMenuItemName =
  | 'sortColumnAscending'
  | 'sortColumnDescending'
  | 'clearColumnSorting'
  | 'groupColumn'
  | 'fixColumn'
  | 'fixColumnStart'
  | 'fixColumnEnd'
  | 'unfixColumn'
  | 'moveLeft'
  | 'moveRight'
  | 'autoSizeColumn'
  | 'autoSizeAllColumns'
  | 'increaseColumnWidth'
  | 'decreaseColumnWidth'
  | 'openColumnChooser'
  | 'resetColumns'
  | 'ungroupColumn'
  | 'ungroupAll'
  | 'expandAllGroups'
  | 'collapseAllGroups'
  | 'copyCell'
  | 'copySelectedRows'
  | 'copySelectedCells'
  | 'paste'
  | 'extendSelectionToCell'
  | 'addCellToSelection'
  | 'exportSelectedCsv'
  | 'exportSelectedXlsx'
  | 'exportSelectedPdf'
  | 'editRow'
  | 'editCell'
  | 'removeRow'
  | 'restoreRow'
  | 'expandRow'
  | 'collapseRow'
  | 'expandNode'
  | 'collapseNode'
  | 'addChildRow'
  | 'expandGroup'
  | 'collapseGroup';

/**
 * A context menu item. Built-in (`name`): the grid runs it; `text` replaces
 * the translated label. Host (`id`): needs `text` and `action`. An item
 * without a name is skipped with a warning.
 *
 * The built-in `fixColumn` ("Pin column") is a submenu: its `items` hold
 * `fixColumnStart`, `fixColumnEnd` and `unfixColumn` (shown as radio items).
 * You may reorder or remove them, or move one to the top level, where it is
 * a plain item.
 */
export interface GridContextMenuItem<TItem = any> {
  /** Built-in item (see `GridContextMenuItemName`). */
  name?: GridContextMenuItemName;
  /** Host item id (free; never read by the grid). */
  id?: string;
  /** Label (required for host items; built-ins default to the translation). */
  text?: string;
  /** Shown and focusable, but does nothing (`aria-disabled`). A built-in that does not apply never acts, even with `disabled: false`. */
  disabled?: boolean;
  /** Separator line before the item. */
  separatorBefore?: boolean;
  /** Host action: runs after the menu closed and the focus went back to where the menu was opened. With it, `name` is ignored. */
  action?: (context: GridContextMenuItemActionContext<TItem>) => void;
  /**
   * Submenu items. Only the built-in `fixColumn` has them: its pin items
   * (`fixColumnStart`, `fixColumnEnd`, `unfixColumn`) and host items with
   * `action`; other built-ins there, and `items` on any other item, are
   * ignored with a console warning.
   */
  items?: GridContextMenuItem<TItem>[];
}

/** Fields shared by `u-grid-context-menu-opening` and the item actions. */
export interface GridContextMenuContext<TItem = any> {
  readonly target: GridContextMenuTarget;
  /**
   * Kind of the cell the menu was opened on (`row`: data, selection,
   * command, detail toggle, full-width; `header`: header; `group-row`:
   * group); `null` in the group panel. Fixed rows (`fixedTopItems`/
   * `fixedBottomItems`) have no context menu and fire no event.
   */
  readonly cellType: GridCellType | null;
  /**
   * `header`: the column or band; `group-panel`: the chip's column (`null`
   * in the empty area); `row`: the column of the cell (`null` in the
   * selection, detail toggle and buttons columns and in a full-width cell);
   * `group-row`: the grouped column.
   */
  readonly column: GridColumnDef<TItem> | null;
  /** `row`: the item; `null` elsewhere. */
  readonly item: TItem | null;
  /** `row`: the row key; `null` elsewhere. */
  readonly rowKey: unknown;
  /** `group-row`: the group path; `null` elsewhere. */
  readonly groupPath: GridGroupPath | null;
  readonly grid: DataGrid;
}

/** Context of a host item `action`. */
export interface GridContextMenuItemActionContext<TItem = any> extends GridContextMenuContext<TItem> {
  readonly menuItem: GridContextMenuItem<TItem>;
}

/**
 * `detail` of `u-grid-context-menu-opening`. The built-in items come as
 * `{ name, disabled, separatorBefore }` (their default state; `text` absent =
 * the translation); `fixColumn` also has `items` (its pin sides; the current
 * side comes enabled and only closes the menu). Change `menuItems` in place,
 * synchronously in the listener (add, remove, reorder, change `text`,
 * `disabled`, `separatorBefore`): the grid reads the array right after the
 * dispatch; later changes are ignored. Do not keep the reference.
 */
export interface GridContextMenuOpeningEventDetail<TItem = any> extends GridContextMenuContext<TItem> {
  readonly menuItems: GridContextMenuItem<TItem>[];
}

/** Embutidos de cada alvo (o hospedeiro pode tirar e repor; de outro alvo é ignorado com aviso). */
export const CONTEXT_MENU_ITEMS_BY_TARGET: Readonly<Record<GridContextMenuTarget, ReadonlySet<GridContextMenuItemName>>> = {
  header: new Set<GridContextMenuItemName>([
    'sortColumnAscending',
    'sortColumnDescending',
    'clearColumnSorting',
    'fixColumn',
    'fixColumnStart',
    'fixColumnEnd',
    'unfixColumn',
    'autoSizeColumn',
    'autoSizeAllColumns',
    'increaseColumnWidth',
    'decreaseColumnWidth',
    'moveLeft',
    'moveRight',
    'groupColumn',
    'openColumnChooser',
    'resetColumns',
  ]),
  'group-panel': new Set<GridContextMenuItemName>(['ungroupColumn', 'moveLeft', 'moveRight', 'ungroupAll', 'expandAllGroups', 'collapseAllGroups']),
  row: new Set<GridContextMenuItemName>([
    'copySelectedCells',
    'paste',
    'extendSelectionToCell',
    'addCellToSelection',
    'copyCell',
    'copySelectedRows',
    'exportSelectedCsv',
    'exportSelectedXlsx',
    'exportSelectedPdf',
    'editRow',
    'editCell',
    'removeRow',
    'restoreRow',
    'expandRow',
    'collapseRow',
    'expandNode',
    'collapseNode',
    'addChildRow',
  ]),
  'group-row': new Set<GridContextMenuItemName>(['expandGroup', 'collapseGroup', 'expandAllGroups', 'collapseAllGroups', 'ungroupColumn']),
};

/** Itens embutidos que só valem dentro do submenu "Fixar coluna" (ou soltos no nível de cima). */
export const FIX_COLUMN_ITEMS: ReadonlySet<GridContextMenuItemName> = new Set<GridContextMenuItemName>(['fixColumnStart', 'fixColumnEnd', 'unfixColumn']);

/** Espera do toque longo (como o AG Grid no cabeçalho). */
export const LONG_PRESS_MS = 500;
/** Movimento que cancela o toque longo (px). */
const LONG_PRESS_SLOP = 10;
/** Deslocamento do menu aberto pelo toque (não fica sob o dedo). */
export const LONG_PRESS_OFFSET = 24;

export interface LongPressHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
}

/**
 * Toque longo (500 ms, sem mover > 10 px) onde o navegador não dispara
 * `contextmenu` no toque (iOS). Escuta só pelos bindings do template
 * (`pointerdown` no alvo); o timer e os listeners do toque em curso saem no
 * `hostDisconnected` (spec 14). Se o navegador dispara `contextmenu` (Android)
 * antes do timer, o toque longo desiste (`cancel`). Depois de abrir, engole o
 * próximo `click` (não ativa o que está sob o dedo).
 */
export class LongPressController implements ReactiveController {
  #timer: ReturnType<typeof setTimeout> | undefined;
  #start: { x: number; y: number; pointerId: number } | undefined;
  #target: EventTarget | null = null;
  #swallowClick = false;
  /** Momento em que o toque longo abriu (o `contextmenu` tardio do Android é ignorado). */
  #firedAt = -Infinity;

  constructor(host: LongPressHost) {
    host.addController(this);
  }

  /** Timer pendente (diagnóstico de memória). */
  get timers(): number {
    return this.#timer === undefined ? 0 : 1;
  }

  /** O toque longo acabou de abrir um menu (o `contextmenu` do mesmo toque não abre outro). */
  get justFired(): boolean {
    return performance.now() - this.#firedAt < 1000;
  }

  /** `pointerdown` de toque num alvo com menu: arma o timer. */
  start(event: PointerEvent, open: (path: EventTarget[], x: number, y: number) => boolean): void {
    // Toque novo: o `click` do toque longo anterior (se nunca veio) não engole este.
    this.#swallowClick = false;

    if (event.pointerType !== 'touch' || !event.isPrimary) {
      // Segundo dedo (multitoque) cancela.
      if (event.pointerType === 'touch') {
        this.cancel();
      }

      return;
    }

    this.cancel();
    const path = event.composedPath();
    const target = event.currentTarget;
    this.#start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    this.#target = target;
    target?.addEventListener('pointermove', this.#onMove as EventListener);
    target?.addEventListener('pointerup', this.#onEnd);
    target?.addEventListener('pointercancel', this.#onEnd);
    target?.addEventListener('scroll', this.#onEnd, true);
    this.#timer = setTimeout(() => {
      const start = this.#start!;
      this.#release();

      // Só um menu aberto engole o clique e o \`contextmenu\` do mesmo toque
      // (sem menu, como numa linha fixa, fica o do navegador).
      if (open(path, start.x + LONG_PRESS_OFFSET, start.y + LONG_PRESS_OFFSET)) {
        this.#swallowClick = true;
        this.#firedAt = performance.now();
      }
    }, LONG_PRESS_MS);
  }

  /** O navegador disparou `contextmenu` (Android): o toque longo desiste. */
  cancel(): void {
    this.#release();
  }

  /** `click` (captura) depois do toque longo: engolido uma vez. */
  readonly onClickCapture = (event: Event): void => {
    if (this.#swallowClick) {
      this.#swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  readonly #onMove = (event: PointerEvent): void => {
    const start = this.#start;

    if (start?.pointerId === event.pointerId
      && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP) {
      this.#release();
    }
  };

  readonly #onEnd = (): void => {
    this.#release();
  };

  #release(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#start = undefined;

    const target = this.#target;
    this.#target = null;
    target?.removeEventListener('pointermove', this.#onMove as EventListener);
    target?.removeEventListener('pointerup', this.#onEnd);
    target?.removeEventListener('pointercancel', this.#onEnd);
    target?.removeEventListener('scroll', this.#onEnd, true);
  }

  hostDisconnected(): void {
    this.#release();
    this.#swallowClick = false;
  }
}
