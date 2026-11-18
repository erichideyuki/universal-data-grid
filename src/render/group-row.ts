import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import type { GroupRow } from '../row-model/types.js';

export interface GroupRowContext {
  row: GroupRow;
  /** Colunas de grupo + colunas comuns. */
  totalColumns: number;
  separator: string;
  /** Valor do grupo já formatado (`displayValue`/`format` da coluna). */
  valueText: string;
  /** Contagem e resumos `inline` já montados (`"(3, Sum of Population: 1,234)"`) ou vazio. */
  info?: string;
  /** Colunas cobertas pelo rótulo; padrão: até o fim da linha. */
  labelSpan?: number;
  /** Células depois do rótulo (resumos `display: 'column'`). */
  trailing?: TemplateResult | typeof nothing;
  /** Roving tabindex: `0` quando a linha é a ativa. */
  tabIndex: 0 | -1;
  /** Nome acessível da célula do rótulo quando há resumos em células à parte (a linha é um ponto só da navegação). */
  ariaLabel?: string;
  onToggle: (row: GroupRow) => void;
  /** Conteúdo do `groupRenderer` no lugar do rótulo e da contagem. */
  content?: unknown;
  /**
   * Com `content` e resumos alinhados: o texto deles (oculto) e o prefixo dos
   * ids — o nome da célula é o conteúdo seguido dos resumos (`aria-labelledby`).
   */
  alignedSummaries?: { text: string; id: string };
}

export const groupRowLabel = (row: GroupRow, separator: string, valueText: string): string =>
  `${row.column.label ?? ''}${separator}${valueText}`;

/** Células de uma linha de grupo: recuo, botão de expandir, o rótulo e os resumos alinhados. */
export const renderGroupRowCells = ({
  row,
  totalColumns,
  separator,
  valueText,
  info = '',
  tabIndex,
  ariaLabel,
  labelSpan,
  trailing = nothing,
  onToggle,
  content,
  alignedSummaries,
}: GroupRowContext): TemplateResult => {
  const label = groupRowLabel(row, separator, valueText);

  return html`
    ${row.level
      ? html`<td class="group-column sticky-cell" style="inset-inline-start: 0" role="presentation" colspan=${row.level}></td>`
      : nothing}
    <td
      class="group-column group-column-toggle sticky-cell ${classMap({ expanded: row.expanded })}"
      style="inset-inline-start: calc(${row.level} * var(--_group-column-width))"
      role="presentation">
      <button
        class="group-toggle"
        type="button"
        tabindex="-1"
        aria-hidden="true"
        aria-expanded=${row.expanded ? 'true' : 'false'}
        @mousedown=${(event: MouseEvent) => event.preventDefault()}
        @click=${(event: MouseEvent) => {
          // O botão fica fora da navegação (aria-hidden): o foco vai à célula
          // do rótulo, que vira a ativa, em vez de parar nele (spec 17).
          (event.currentTarget as HTMLElement).closest('tr')?.querySelector<HTMLElement>('.grouping-cell')
            ?.focus();
          onToggle(row);
        }}>
        <span class="toggle-icon">
          <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 -960 960 960" width="1em" fill="currentColor" aria-hidden="true">
            <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/>
          </svg>
        </span>
      </button>
    </td>
    <td
      class="grouping-cell"
      role="gridcell"
      aria-colindex="1"
      data-col="group"
      tabindex=${tabIndex}
      aria-keyshortcuts="Control+G Meta+G"
      aria-label=${ifDefined(ariaLabel)}
      aria-labelledby=${ifDefined(alignedSummaries ? `${alignedSummaries.id}-label ${alignedSummaries.id}-summaries` : undefined)}
      colspan=${Math.max(labelSpan ?? totalColumns - (row.level + 1), 1)}><span
        class="grouping-label"
        id=${ifDefined(alignedSummaries ? `${alignedSummaries.id}-label` : undefined)}
        style="inset-inline-start: calc(${row.level + 1} * var(--_group-column-width) + var(--_cell-inline-padding))">${content === undefined
          ? html`${label}${info
            ? html` <span class="group-info" part="group-count">${info}</span>`
            : nothing}`
          : content}</span>${alignedSummaries
          ? html`<span id="${alignedSummaries.id}-summaries" hidden>${alignedSummaries.text}</span>`
          : nothing}</td>
    ${trailing}
  `;
};
