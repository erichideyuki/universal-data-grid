import { html, nothing, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { map } from 'lit/directives/map.js';

import type { GridColumnDef } from '../grid-column-def.js';

/** Um resumo pronto para exibir: texto visível e rótulo completo do leitor de tela. */
export interface SummaryText {
  /** `"Sum: 1,234"`. */
  text: string;
  /** `"Sum of Population: 1,234"`. */
  label: string;
}

/** O que uma célula de resumo precisa da coluna (classes e deslocamento das fixas). */
export interface SummaryColumnLayout {
  column: GridColumnDef;
  className: string;
  style: string;
}

/**
 * O nome acessível vem do conteúdo: texto visível escondido do leitor e o
 * rótulo completo ("Sum of Amount: 47") só para ele — `aria-label` com texto
 * visível diferente reprova no axe (`label-content-name-mismatch`, WCAG 2.5.3).
 *
 * Células das colunas a partir de `from` (índice em `layout`), com os
 * resumos de cada coluna; colunas sem resumo ficam vazias. `colOffset`:
 * colunas antes das comuns (caixas de seleção) no `aria-colindex`. Com
 * `tabIndexOf` (linhas de resumo navegáveis, frente 05) cada célula entra
 * no roving tabindex do grid (`data-col` = índice entre as navegáveis).
 */
export const renderSummaryCells = (
  layout: readonly SummaryColumnLayout[],
  texts: ReadonlyMap<GridColumnDef, SummaryText[]>,
  from = 0,
  separator = ', ',
  colOffset = 0,
  tabIndexOf?: (col: number) => 0 | -1,
): TemplateResult =>
  html`${map(layout.slice(from), (cell, index) => {
    const summaries = texts.get(cell.column);
    const col = colOffset + from + index;

    return summaries?.length
      ? html`<td
          part="summary-cell"
          class="summary-cell ${cell.className}"
          style=${cell.style}
          role="gridcell"
          aria-colindex=${col + 1}
          data-col=${ifDefined(tabIndexOf ? col : undefined)}
          tabindex=${ifDefined(tabIndexOf?.(col))}
          ><span aria-hidden="true">${map(summaries, summary => html`<span class="summary-item">${summary.text}</span>`)}</span><span
            class="visually-hidden">${summaries.map(summary => summary.label).join(separator)}</span></td>`
      : html`<td
          class="summary-cell ${cell.className}"
          style=${cell.style}
          role="gridcell"
          aria-colindex=${col + 1}
          data-col=${ifDefined(tabIndexOf ? col : undefined)}
          tabindex=${ifDefined(tabIndexOf?.(col))}></td>`;
  })}`;

/** Recuos das colunas de grupo (rodapés e linhas de dados). */
export const renderIndentCells = (groupColumns: number, groupColumnWidth: number): TemplateResult =>
  html`${map(Array.from({ length: groupColumns }), (_, index) => html`
    <td
      role="presentation"
      class="group-column sticky-cell"
      style="inset-inline-start: ${index * groupColumnWidth}px"></td>`)}`;

export interface TotalFooterContext {
  layout: readonly SummaryColumnLayout[];
  texts: ReadonlyMap<GridColumnDef, SummaryText[]>;
  groupColumns: number;
  groupColumnWidth: number;
  rowIndex: number;
  /** Separador de lista do idioma (rótulo de várias somas na mesma célula). */
  separator: string;
  /** Célula antes das colunas comuns (caixas de seleção). */
  leading?: TemplateResult | typeof nothing;
  /** Colunas antes das comuns no `aria-colindex`. */
  colOffset?: number;
  /** Roving tabindex do grid (ver `renderSummaryCells`). */
  tabIndexOf?: (col: number) => 0 | -1;
  /** Células depois das colunas comuns (coluna de botões da edição). */
  trailing?: TemplateResult | typeof nothing;
}

/** Rodapé de totais: `rowgroup` próprio, fixo embaixo (fora do virtualizador). */
export const renderTotalFooter = ({
  layout,
  texts,
  groupColumns,
  groupColumnWidth,
  rowIndex,
  separator,
  leading = nothing,
  trailing = nothing,
  colOffset = 0,
  tabIndexOf,
}: TotalFooterContext): TemplateResult => html`
  <tfoot class="total-footer" role="rowgroup">
    <tr class="summary-row total-row" part="summary-row total-row" role="row" aria-rowindex=${rowIndex}>
      ${groupColumns ? renderIndentCells(groupColumns, groupColumnWidth) : nothing}
      ${leading}
      ${renderSummaryCells(layout, texts, 0, separator, colOffset, tabIndexOf)}
      ${trailing}
    </tr>
  </tfoot>`;
