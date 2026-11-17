import { html, type TemplateResult } from 'lit';

import type { GridColumnDef } from '../grid-column-def.js';
import type { DataGrid } from '../grid.js';
import { booleanIconValue, formatCellValue, type FormatContext } from '../row-model/format.js';
import type { DataRow } from '../row-model/types.js';
import { getCellValue } from '../row-model/value.js';

import '../grid-custom-cell.js';

// Ícones Material Symbols (Apache 2.0): check e close.
const CHECK_PATH = 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z';
const CLOSE_PATH = 'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z';

/**
 * Booleano como ícone só leitura. O nome acessível é o texto traduzido
 * (`trueText`/`falseText`), então o leitor de tela lê o mesmo que o modo
 * texto. Ícones simétricos: nada a espelhar em RTL.
 */
const renderBooleanIcon = (value: boolean, format: FormatContext): TemplateResult => html`
  <span
    class="boolean-icon ${value ? 'true' : 'false'}"
    role="img"
    aria-label=${value ? format.trueText : format.falseText}><svg
      xmlns="http://www.w3.org/2000/svg"
      height="1.25em"
      width="1.25em"
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"><path d=${value ? CHECK_PATH : CLOSE_PATH}/></svg></span>`;

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
    const value = getCellValue(row.item, column);
    const icon = booleanIconValue(value, column, format);

    return icon === undefined
      ? formatCellValue(value, row.item, column, format)
      : renderBooleanIcon(icon, format);
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
