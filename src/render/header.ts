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
  /** `aria-colindex` (1-based). */
  colIndex: number;
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
  /** A coluna tem filtro (classe `filtered`). */
  filtered?: boolean;
}

const ariaSort = (order: GridSortOrder | undefined): 'ascending' | 'descending' | 'none' =>
  order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : 'none';

/** Enter/Espaço ativam como o clique (com os mesmos modificadores). */
export const isActivationKey = (event: KeyboardEvent): boolean =>
  event.key === 'Enter' || event.key === ' ';

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

export const renderHeaderCell = ({
  column,
  classes,
  styles,
  colIndex,
  sortable,
  order,
  sortIndex,
  onActivate,
  onPointerDown,
  onKeyDown,
  trailing = nothing,
  filterButton = nothing,
  filtered = false,
}: HeaderCellContext): TemplateResult => html`
  <th
    class="header-column ${classMap({ ...classes, sortable, sorted: !!order, filtered })}"
    style=${styleMap(styles)}
    part="header-cell"
    role="columnheader"
    aria-colindex="${colIndex}"
    aria-sort=${ifDefined(sortable || order ? ariaSort(order) : undefined)}
    tabindex=${ifDefined(sortable ? 0 : undefined)}
    @pointerdown=${sortable ? onPointerDown : nothing}
    @click=${sortable ? (event: MouseEvent) => onActivate(column, event) : nothing}
    @keydown=${sortable || onKeyDown
      ? (event: KeyboardEvent) => {
        onKeyDown?.(event);

        if (sortable && !event.defaultPrevented && isActivationKey(event) && !event.repeat) {
          event.preventDefault();
          onActivate(column, event);
        }
      }
      : nothing}>
    <span class="header-content"><span class="header-text">${column.label}</span>${renderSortIndicator(order, sortIndex)}${filterButton}</span>${trailing}
  </th>`;
