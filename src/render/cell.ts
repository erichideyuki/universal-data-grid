import { html, type TemplateResult } from 'lit';

import type { GridColumnDef } from '../grid-column-def.js';
import type { DataGrid } from '../grid.js';
import { formatCell, type FormatContext } from '../row-model/format.js';
import type { DataRow } from '../row-model/types.js';

import '../grid-custom-cell.js';

/**
 * Conteúdo de uma célula de dados. Com `renderer`, o elemento do hospedeiro
 * vai para o light DOM do grid e é projetado por um slot nomeado pela CHAVE
 * da linha e pelo id da coluna — nunca por índices, que mudam ao expandir,
 * ordenar ou reordenar.
 */
export const renderDataCell = (
  grid: DataGrid,
  row: DataRow,
  column: GridColumnDef,
  columnId: number,
  format: FormatContext,
): TemplateResult | string => {

  if (!column.renderer) {
    return formatCell(row.item, column, format);
  }

  const slotName = `cell:${row.key}:${columnId}`;

  return html`
    <slot name=${slotName}></slot>
    <u-grid-custom-cell
      .grid=${grid}
      .column=${column}
      .item=${row.item}
      .slotName=${slotName}></u-grid-custom-cell>
  `;
};
