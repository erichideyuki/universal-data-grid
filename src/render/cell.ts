import { html, type TemplateResult } from 'lit';

import type { GridCellRenderContext, GridColumnDef } from '../grid-column-def.js';
import type { DataGrid } from '../grid.js';
import { booleanIconValue, formatCellValue, type FormatContext } from '../row-model/format.js';
import type { DataRow } from '../row-model/types.js';
import { getCellValue } from '../row-model/value.js';
import { rendererContent } from './content.js';

// Ícones Material Symbols (Apache 2.0): check e close.
const CHECK_PATH = 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z';
const CLOSE_PATH = 'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z';

/**
 * Booleano como ícone só leitura. O nome acessível é o texto traduzido
 * (`trueText`/`falseText`), então o leitor de tela lê o mesmo que o modo
 * texto. Ícones simétricos: nada a espelhar em RTL.
 */
const renderBooleanIcon = (value: boolean, format: FormatContext, checkOnly: boolean): TemplateResult => !value && checkOnly
  // `check`: o falso não desenha nada; o texto fica para o leitor de tela (a célula não é lida como vazia).
  ? html`<span class="boolean-icon false visually-hidden">${format.falseText}</span>`
  : html`
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

/** Texto que a célula nativa mostraria (o `ctx.text` do renderer; booleano em ícone vira o texto). */
export const cellText = (item: unknown, column: GridColumnDef, format: FormatContext): string => {
  const value = getCellValue(item, column);
  const icon = booleanIconValue(value, column, format);

  return icon === undefined
    ? formatCellValue(value, item, column, format)
    : icon ? format.trueText : format.falseText;
};

/**
 * Conteúdo de uma célula de dados. Com `renderer`, o resultado vai direto na
 * célula (`TemplateResult`/texto) ou, se for `HTMLElement`, para o light DOM
 * do grid, projetado por um slot nomeado pela CHAVE da linha e pelo id da
 * coluna — nunca por índices, que mudam ao expandir, ordenar ou reordenar.
 * `epoch` muda com o idioma (o renderer roda de novo). `adaptive`: o valor
 * vai na linha adaptativa (coluna oculta por falta de espaço, spec 21).
 */
export const renderDataCell = (
  grid: DataGrid,
  row: DataRow,
  column: GridColumnDef,
  columnId: number,
  format: FormatContext,
  epoch: unknown,
  adaptive = false,
): unknown => {
  const { renderer } = column;

  if (!renderer) {
    const value = getCellValue(row.item, column);
    const icon = booleanIconValue(value, column, format);

    return icon === undefined
      ? formatCellValue(value, row.item, column, format)
      : renderBooleanIcon(icon, format, column.booleanDisplay === 'check');
  }

  const { item } = row;

  return rendererContent({
    host: grid,
    // Linha adaptativa (spec 21): outro slot (a troca célula ↔ detalhe descarta o conteúdo).
    slotName: `u-grid-internal:${adaptive ? 'adaptive' : 'cell'}:${row.key}:${columnId}`,
    deps: [item, column, renderer, epoch],
    renderer,
    invoke: signal => {
      const ctx: GridCellRenderContext = {
        item,
        get value() {
          return getCellValue(item, column);
        },
        get text() {
          return cellText(item, column, format);
        },
        column,
        rowKey: item,
        adaptive,
        grid,
        get signal() {
          return signal();
        },
      };

      // `this` = a coluna, como no renderer antigo (`u-grid-custom-cell`).
      return renderer.call(column, item, ctx);
    },
  });
};
