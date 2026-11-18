import { html, nothing, type TemplateResult } from 'lit';
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
 * Células das colunas a partir de `from` (índice em `layout`), com os
 * resumos de cada coluna; colunas sem resumo ficam vazias.
 */
export const renderSummaryCells = (
  layout: readonly SummaryColumnLayout[],
  texts: ReadonlyMap<GridColumnDef, SummaryText[]>,
  from = 0,
  separator = ', ',
): TemplateResult =>
  html`${map(layout.slice(from), (cell, index) => {
    const summaries = texts.get(cell.column);
    const colIndex = from + index + 1;

    return summaries?.length
      ? html`<td
          part="summary-cell"
          class="summary-cell ${cell.className}"
          style=${cell.style}
          role="gridcell"
          aria-colindex=${colIndex}
          aria-label=${summaries.map(summary => summary.label).join(separator)}>${map(summaries, summary => html`<span class="summary-item">${summary.text}</span>`)}</td>`
      : html`<td class="summary-cell ${cell.className}" style=${cell.style} role="gridcell" aria-colindex=${colIndex}></td>`;
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
}

/** Rodapé de totais: `rowgroup` próprio, fixo embaixo (fora do virtualizador). */
export const renderTotalFooter = ({ layout, texts, groupColumns, groupColumnWidth, rowIndex, separator }: TotalFooterContext): TemplateResult => html`
  <tfoot class="total-footer" role="rowgroup">
    <tr class="summary-row total-row" part="summary-row total-row" role="row" aria-rowindex=${rowIndex}>
      ${groupColumns ? renderIndentCells(groupColumns, groupColumnWidth) : nothing}
      ${renderSummaryCells(layout, texts, 0, separator)}
    </tr>
  </tfoot>`;
