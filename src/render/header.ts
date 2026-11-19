import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { type StyleInfo, styleMap } from 'lit/directives/style-map.js';

import type { GridColumnDef, GridSortOrder } from '../grid-column-def.js';

export type SortActivation = (column: GridColumnDef, event: MouseEvent | KeyboardEvent) => void;

export interface HeaderCellContext {
  column: GridColumnDef;
  /** Classes de alinhamento/quebra/fixação da coluna (as mesmas das células). */
  classes: Record<string, boolean>;
  /** `min-width` e o deslocamento `sticky` das colunas fixas. */
  styles: StyleInfo;
  /** `aria-colindex` (1-based, conta a coluna de caixas). */
  colIndex: number;
  /** Roving tabindex: `0` só na célula ativa do grid. */
  tabIndex: 0 | -1;
  /** O usuário pode ordenar por esta coluna (modo ≠ `none` e coluna ordenável). */
  sortable: boolean;
  order: GridSortOrder | undefined;
  /** Posição na ordenação (1-based); só aparece com mais de uma coluna. */
  sortIndex: number | undefined;
  onActivate: SortActivation;
  onPointerDown: () => void;
  /** Teclas além da ativação (Alt+←/→ redimensiona). */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** Conteúdo depois do rótulo (alça de redimensionar). */
  trailing?: TemplateResult | typeof nothing;
  /** Botão do filtro do cabeçalho (funil), depois da seta de ordenação. */
  filterButton?: TemplateResult | typeof nothing;
  /** Botão "⋮" do menu do cabeçalho, na ponta (depois do funil). */
  menuButton?: TemplateResult | typeof nothing;
  /** A coluna tem filtro (classe `filtered`). */
  filtered?: boolean;
  /** Descrição do cabeçalho (prioridade da ordenação, fixada, filtrada; spec 17, A14). */
  description?: string;
  /** `aria-keyshortcuts` com as teclas que valem nesta coluna (spec 17, A13). */
  keyShortcuts?: string;
  /** Clique direito: menu do cabeçalho (spec 17, A1). */
  onContextMenu?: (event: MouseEvent) => void;
  /** Conteúdo do rótulo (`headerRenderer`); padrão: `column.label`. */
  label?: unknown;
  /** Nível de baixo coberto pela célula (`data-level`, frente 13). */
  level?: number;
  /** Linhas cobertas (folha sem banda acima: até o último nível). */
  rowSpan?: number;
  /** Sufixo único dos ids (nível + coluna): banda e folha não repetem id. */
  idSuffix?: string;
  /** Identidade da coluna para o arrasto (`data-column-id`). */
  columnId?: number;
}

/** Banda do cabeçalho multinível (frente 13): sem ordenar, filtrar nem redimensionar. */
export interface BandHeaderCellContext {
  column: GridColumnDef;
  /** Classes de fixação e alinhamento. */
  classes: Record<string, boolean>;
  styles: StyleInfo;
  /** `aria-colindex` = primeira coluna renderizada sob a banda. */
  colIndex: number;
  colSpan: number;
  level: number;
  tabIndex: 0 | -1;
  idSuffix: string;
  columnId: number;
  description?: string;
  keyShortcuts?: string;
  onContextMenu?: (event: MouseEvent) => void;
  label?: unknown;
}

const ariaSort = (order: GridSortOrder | undefined): 'ascending' | 'descending' | 'none' =>
  order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : 'none';

const INTERACTIVE = 'a[href], button, input, select, textarea, [role="button"], [contenteditable=""], [contenteditable="true"]';

/**
 * O evento veio de um elemento interativo do conteúdo da célula (botão do
 * `headerRenderer`, funil): não ordena. Para no próprio `<th>`.
 */
export const fromInteractiveContent = (event: Event): boolean => {
  for (const node of event.composedPath()) {
    if (node === event.currentTarget) {
      return false;
    }

    if (node instanceof Element && node.matches(INTERACTIVE)) {
      return true;
    }
  }

  return false;
};

/** Enter/Espaço ativam como o clique (com os mesmos modificadores). */
export const isActivationKey = (event: KeyboardEvent): boolean =>
  event.key === 'Enter' || event.key === ' ';

/**
 * Layout do cabeçalho (como o AG Grid): início/centro `[texto][seta] …
 * [funil][⋮]`; fim (números) `[⋮][funil] … [seta][texto]` — o CSS inverte
 * pela direção lógica (RTL espelha sozinho). Os botões ficam sempre no
 * lugar (espaço reservado); o texto corta com reticências.
 */

/**
 * Seta da ordenação. O número da prioridade vem por CSS (`data-sort-index`)
 * para não entrar no texto do cabeçalho nem ser lido duas vezes — o leitor de
 * tela recebe a ordenação por `aria-sort`.
 */
export const renderSortIndicator = (order: GridSortOrder | undefined, sortIndex?: number): TemplateResult | typeof nothing =>
  order
    ? html`
      <span
        class="sort-indicator ${order}"
        part="sort-indicator"
        aria-hidden="true"
        data-sort-index=${sortIndex ?? nothing}>
        <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 -960 960 960" width="1em" fill="currentColor">
          <path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z"/>
        </svg>
      </span>`
    : nothing;

/** Descrição oculta do cabeçalho (lida por \`aria-describedby\`; spec 17, A14). */
const renderDescription = (idSuffix: string, description: string): TemplateResult | typeof nothing =>
  description ? html`<span id="header-description-${idSuffix}" hidden>${description}</span>` : nothing;

/**
 * Banda: `colspan` nativo (a ARIA manda usar o da linguagem numa `<table>`),
 * sem `aria-sort`; o rótulo quebra linha (WCAG 1.4.12).
 */
export const renderBandHeaderCell = ({
  column,
  classes,
  styles,
  colIndex,
  colSpan,
  level,
  tabIndex,
  idSuffix,
  columnId,
  description = '',
  keyShortcuts,
  onContextMenu,
  label = column.label,
}: BandHeaderCellContext): TemplateResult => html`
  <th
    class="band-header ${classMap(classes)}"
    style=${styleMap(styles)}
    part="header-cell band-header-cell"
    role="columnheader"
    colspan=${colSpan}
    aria-colindex="${colIndex}"
    aria-labelledby="header-text-${idSuffix}"
    aria-describedby=${ifDefined(description ? `header-description-${idSuffix}` : undefined)}
    aria-keyshortcuts=${ifDefined(keyShortcuts || undefined)}
    data-col=${colIndex - 1}
    data-level=${level}
    data-column-id=${columnId}
    tabindex=${tabIndex}
    @contextmenu=${onContextMenu ?? nothing}>
    <span class="header-content"><span class="header-text" id="header-text-${idSuffix}">${label}</span></span>${
      renderDescription(idSuffix, description)}
  </th>`;

export const renderHeaderCell = ({
  column,
  classes,
  styles,
  colIndex,
  tabIndex,
  sortable,
  order,
  sortIndex,
  onActivate,
  onPointerDown,
  onKeyDown,
  trailing = nothing,
  filterButton = nothing,
  menuButton = nothing,
  filtered = false,
  description = '',
  keyShortcuts,
  onContextMenu,
  label = column.label,
  level,
  rowSpan,
  idSuffix = String(colIndex),
  columnId,
}: HeaderCellContext): TemplateResult => html`
  <th
    class="header-column ${classMap({ ...classes, sortable, sorted: !!order, filtered })}"
    style=${styleMap(styles)}
    part="header-cell"
    role="columnheader"
    rowspan=${ifDefined(rowSpan && rowSpan > 1 ? rowSpan : undefined)}
    aria-colindex="${colIndex}"
    aria-labelledby="header-text-${idSuffix}"
    aria-sort=${ifDefined(sortable || order ? ariaSort(sortIndex === undefined || sortIndex === 1 ? order : undefined) : undefined)}
    aria-describedby=${ifDefined(description ? `header-description-${idSuffix}` : undefined)}
    aria-keyshortcuts=${ifDefined(keyShortcuts || undefined)}
    data-col=${colIndex - 1}
    data-level=${ifDefined(level)}
    data-column-id=${ifDefined(columnId)}
    tabindex=${tabIndex}
    @pointerdown=${sortable ? onPointerDown : nothing}
    @contextmenu=${onContextMenu ?? nothing}
    @click=${sortable ? (event: MouseEvent) => !fromInteractiveContent(event) && onActivate(column, event) : nothing}
    @keydown=${sortable || onKeyDown
      ? (event: KeyboardEvent) => {
        onKeyDown?.(event);

        if (sortable && !event.defaultPrevented && isActivationKey(event) && !event.repeat && !fromInteractiveContent(event)) {
          event.preventDefault();
          onActivate(column, event);
        }
      }
      : nothing}>
    <span class="header-content"><span class="header-text" id="header-text-${idSuffix}">${label}</span>${renderSortIndicator(order, sortIndex)}${
      filterButton === nothing && menuButton === nothing
        ? nothing
        : html`<span class="header-buttons">${filterButton}${menuButton}</span>`}</span>${trailing}${
      renderDescription(idSuffix, description)}
  </th>`;
