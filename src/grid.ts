import { ContextConsumer } from '@lit/context';

import { html, type HTMLTemplateResult, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { map } from 'lit/directives/map.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';

import { VirtualizerController } from '@tanstack/lit-virtual';
import type { VirtualItem } from '@tanstack/virtual-core';

import { ColumnDragAndDropAdapter } from './features/column-dnd.js';
import { releaseInteractions } from './features/drag-helper.js';
import { GroupDragAndDropAdapter } from './features/group-dnd.js';
import type { GridColumnDataType, GridColumnDef } from './grid-column-def.js';
import {
  DEFAULT_GRID_LANGUAGE,
  type GridI18n,
  gridLanguageContext,
  observeDocumentLanguage,
  resolveGridTranslation,
} from './grid-i18n.js';
import { styles } from './grid.styles.js';
import { renderDataCell } from './render/cell.js';
import { renderGroupRowCells } from './render/group-row.js';
import { keyedRows } from './render/keyed-rows.js';
import { createComparer } from './row-model/compare.js';
import { flattenRows } from './row-model/flatten.js';
import { type FormatContext, formatCellValue, resolveAlignment, resolveDataType } from './row-model/format.js';
import { buildGroups } from './row-model/group.js';
import type { DataRow, GroupNode, GroupRow, Row } from './row-model/types.js';

import './grid-column.js';

export type {
  GridColumnAlignment,
  GridColumnDataType,
  GridColumnDef,
  GridColumnFormat,
  GridColumnFormatter,
} from './grid-column-def.js';
export { setGridLanguage, setGridTranslation, gridLanguageContext, type GridI18n } from './grid-i18n.js';

/** Linhas renderizadas antes de o virtualizador medir o contêiner (1º render, SSR). */
const INITIAL_RENDER_ROWS = 30;

const getDocumentLanguage = (): string | undefined => {

  if (typeof document === 'undefined') {
    return undefined;
  }

  const htmlLang = document.documentElement.lang;

  if (htmlLang) {
    return htmlLang;
  }

  const meta = document.querySelector('meta[http-equiv="content-language" i]');

  return meta?.getAttribute('content')?.split(',')[0].trim() || undefined;
};

const getBrowserLanguage = (): string | undefined =>
  typeof navigator === 'undefined'
    ? undefined
    : navigator.language || undefined;

const sameItems = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

let nextObjectKey = 0;
const objectKeys = new WeakMap<object, number>();

/** Chave de linha sem `keyExpr`: a identidade do objeto. */
const rowKeyOf = (item: unknown): string => {
  if (item !== null && (typeof item === 'object' || typeof item === 'function')) {
    let key = objectKeys.get(item);

    if (key === undefined) {
      key = nextObjectKey++;
      objectKeys.set(item, key);
    }

    return `o${key}`;
  }

  return `${typeof item}:${String(item)}`;
};

/** O que o render de uma coluna comum precisa, calculado uma vez por render. */
interface ColumnView {
  column: GridColumnDef;
  id: number;
  format: FormatContext;
  /** Classes da célula e do cabeçalho: alinhamento e quebra de linha. */
  classes: Record<string, boolean>;
  /** `min-width` das células (com `table-layout: fixed` só o cabeçalho conta). */
  minWidth: string | undefined;
}

let nextColumnId = 0;
const columnIds = new WeakMap<GridColumnDef, number>();

const columnIdOf = (column: GridColumnDef): number => {
  let id = columnIds.get(column);

  if (id === undefined) {
    id = nextColumnId++;
    columnIds.set(column, id);
  }

  return id;
};

@customElement('u-grid')
export class DataGrid extends LitElement {
  static override styles = [styles];

  // ---------------------------------------------------------------- dados

  #items: readonly any[] = [];

  @property({ type: Boolean, attribute: 'auto-expand-groups' }) autoExpandGroups = false;

  /** Dados das linhas. O grid nunca altera este array nem os itens. */
  @property({ type: Array })
  get items(): any[] {
    return this.#items as any[];
  }

  set items(items: readonly any[] | null | undefined) {
    this.#items = items ?? [];
    this.#groupsDirty = true;
    this.#itemsReplaced = true;
    this.#dataTypes.clear();
  }

  #groups: GroupNode[] = [];
  #rows: Row[] = [];
  #groupsDirty = true;
  #rowsDirty = true;
  #itemsReplaced = false;
  #modelLanguage: string | undefined;
  /** `dataType` efetivo (informado ou inferido dos itens) por coluna. */
  readonly #dataTypes = new Map<GridColumnDef, GridColumnDataType | undefined>();
  #columnViews: ColumnView[] = [];
  #hasWrap = false;
  #measuredWrap = false;
  /** Expansão escolhida pelo usuário, por chave de grupo (sobrevive a troca de dados). */
  readonly #expansion = new Map<string, boolean>();

  // -------------------------------------------------------------- colunas

  /** Colunas por propriedade; `undefined` = usar os `<u-grid-column>` filhos. */
  #columnsProperty: GridColumnDef[] | undefined;
  #declarativeColumns: GridColumnDef[] = [];

  readonly _nativeColumnMap = new WeakMap<HTMLElement, GridColumnDef>();

  /** Ordem atual (do usuário) das colunas comuns e de grupo — estado do grid. */
  @state() _groupColumns: GridColumnDef[] = [];
  @state() _regularColumns: GridColumnDef[] = [];

  /**
   * Definições de coluna. Por propriedade têm precedência sobre os
   * `<u-grid-column>` filhos. O grid não altera o array nem os objetos.
   */
  @property({ attribute: false })
  get columns(): GridColumnDef[] {
    return this.#columnsProperty ?? this.#declarativeColumns;
  }

  set columns(value: GridColumnDef[] | null | undefined) {
    this.#columnsProperty = value ?? undefined;
    this.#syncColumns();
  }

  // ------------------------------------------------------------ aparência

  @property({ type: Number }) rowHeight = 48;
  @property({ type: Boolean }) striped = false;
  @property({ type: Boolean, attribute: 'show-group-panel' }) showGroupPanel = true;
  @property({ type: Boolean, attribute: 'show-column-headers' }) showColumnHeaders = true;
  @property({ type: Boolean }) showRowLines = true;
  @property({ type: Boolean }) showColumnLines = false;

  /** @deprecated Use `striped`. */
  @property({ type: Boolean })
  get stripped(): boolean {
    return this.striped;
  }

  set stripped(value: boolean) {
    this.#deprecated('stripped', 'striped');
    this.striped = value;
  }

  /** @deprecated Use `showGroupPanel` (o nome antigo só controlava o painel de grupos). */
  @property({ type: Boolean })
  get showHeader(): boolean {
    return this.showGroupPanel;
  }

  set showHeader(value: boolean) {
    this.#deprecated('showHeader', 'showGroupPanel');
    this.showGroupPanel = value;
  }

  readonly #warnedDeprecations = new Set<string>();

  #deprecated(name: string, replacement: string): void {
    if (this.#warnedDeprecations.has(name)) {
      return;
    }

    this.#warnedDeprecations.add(name);
    console.warn(`<u-grid>: "${name}" is deprecated, use "${replacement}" instead.`);
  }

  // ------------------------------------------------------------------ i18n

  #explicitLanguage?: string;
  #unobserveDocumentLanguage?: () => void;

  readonly #languageConsumer = new ContextConsumer(this, {
    context: gridLanguageContext,
    subscribe: true,
  });

  /**
   * Language used to resolve the built-in translations. When not set on the
   * component it is resolved, in order, from the Lit context, the document
   * (`<html lang>` / content-language meta) and finally the browser.
   */
  @property()
  get language(): string {
    return this.#effectiveLanguage ?? DEFAULT_GRID_LANGUAGE;
  }

  set language(value: string | null | undefined) {
    this.#explicitLanguage = value || undefined;
  }

  get #effectiveLanguage(): string | undefined {
    return this.#explicitLanguage
      ?? this.#languageConsumer.value
      ?? getDocumentLanguage()
      ?? getBrowserLanguage();
  }

  get #translation(): GridI18n {
    return resolveGridTranslation(this.#effectiveLanguage);
  }

  // ------------------------------------------------------- refs/controllers

  readonly _containerRef: Ref<HTMLDivElement> = createRef();
  readonly _scrollContainerRef: Ref<HTMLDivElement> = createRef();
  readonly _groupContainerRef: Ref<HTMLDivElement> = createRef();

  readonly #virtualizerController = new VirtualizerController(this, {
    getScrollElement: () => this._scrollContainerRef.value ?? null,
    count: 0,
    estimateSize: () => this.rowHeight,
    getItemKey: index => this.#rows[index]?.key ?? index,
    overscan: 5,
  });

  readonly #columnDragAndDrop = new ColumnDragAndDropAdapter(this);
  readonly #groupDragAndDrop = new GroupDragAndDropAdapter(this);
  #dragAndDropDirty = true;

  /** Quantos elementos estão registrados no interactjs (diagnóstico/testes). */
  get _dragAndDropRegistrations(): number {
    return this.#columnDragAndDrop.size + this.#groupDragAndDrop.size;
  }

  /**
   * Tamanho dos registros internos que crescem com o uso (diagnóstico e
   * testes de vazamento, spec 14). Num grid de vida longa têm de ficar
   * estáveis.
   */
  get _memoryStats(): Record<string, number> {
    const virtualizer = this.#virtualizerController.getVirtualizer();

    return {
      dragAndDrop: this._dragAndDropRegistrations,
      measuredElements: virtualizer.elementsCache.size,
      // privado no tipo do virtual-core; só leitura para diagnóstico
      measuredSizes: (virtualizer as unknown as { itemSizeCache: Map<unknown, number> }).itemSizeCache.size,
      dataTypes: this.#dataTypes.size,
      expansion: this.#expansion.size,
    };
  }

  // ----------------------------------------------------------- ciclo de vida

  override connectedCallback() {
    super.connectedCallback();
    this.#readDeclarativeColumns();
    this.#unobserveDocumentLanguage = observeDocumentLanguage(() => this.requestUpdate());
    this.#dragAndDropDirty = true;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#unobserveDocumentLanguage?.();
    this.#unobserveDocumentLanguage = undefined;
    this.#columnDragAndDrop.detach();
    this.#groupDragAndDrop.detach();
    releaseInteractions(this);
    // Arrasto interrompido (o `unset` para a interação sem o evento `end`):
    // o fantasma não pode reaparecer se o grid for reconectado.
    this.renderRoot?.querySelectorAll('.move-container').forEach(ghost => ghost.remove());
  }

  override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('autoExpandGroups')) {
      this.#rowsDirty = true;
    }
  }

  override updated(changed: PropertyValues<this>) {
    const virtualizer = this.#virtualizerController.getVirtualizer();

    if (changed.has('rowHeight')) {
      virtualizer.measure();
    }

    // Com `wrap` a linha pode crescer: mede as renderizadas (o virtualizador
    // observa o tamanho delas daí em diante).
    if (this.#hasWrap !== this.#measuredWrap) {
      this.#measuredWrap = this.#hasWrap;

      if (!this.#hasWrap) {
        virtualizer.measure();
      }
    }

    // Alturas medidas são por chave de linha: com itens novos as chaves
    // antigas nunca mais voltam (sem `keyExpr` a chave é o objeto) e o mapa
    // cresceria a cada troca de `items`.
    if (this.#itemsReplaced) {
      this.#itemsReplaced = false;

      if (this.#hasWrap) {
        virtualizer.measure();
      }
    }

    if (this.#hasWrap) {
      this.renderRoot.querySelectorAll<HTMLElement>('tbody tr[data-index]')
        .forEach(row => virtualizer.measureElement(row));
    }

    // O virtualizador guarda cada `<tr>` medida e só solta as que saíram do
    // DOM quando chamado sem elemento: sem isso, rolar retém toda linha já
    // vista (e os itens dela).
    virtualizer.measureElement(null);

    if (
      this.#dragAndDropDirty
      || changed.has('_regularColumns')
      || changed.has('_groupColumns')
      || changed.has('showColumnHeaders')
      || changed.has('showGroupPanel')
    ) {
      this.#dragAndDropDirty = false;
      this.#syncDragAndDrop();
    }
  }

  // ------------------------------------------------------------------ API

  groupColumn(column: GridColumnDef, targetIndex: number): void {
    this.#moveColumnTo(true, column, targetIndex);
  }

  moveColumn(column: GridColumnDef, targetIndex: number): void {
    this.#moveColumnTo(false, column, targetIndex);
  }

  /**
   * Chamado por `<u-grid-column>` quando uma propriedade muda: `value` =
   * muda o valor das células (`path`, `valueGetter`, `dataType`); `display`
   * = só a exibição.
   */
  _columnChanged(column: GridColumnDef, change: 'width' | 'groupIndex' | 'value' | 'display'): void {

    const grouped = this._groupColumns.includes(column);

    if (!grouped && !this._regularColumns.includes(column)) {
      return;
    }

    if (change === 'groupIndex') {
      const groupIndex = column.groupIndex;

      if (groupIndex === null || groupIndex === undefined) {
        if (grouped) {
          this.moveColumn(column, this._regularColumns.length);
        }
      } else {
        this.groupColumn(column, groupIndex);
      }
    }

    if (change === 'value') {
      this.#dataTypes.delete(column);
      this.#groupsDirty ||= grouped;
    }

    this.requestUpdate();
  }

  // ------------------------------------------------------------- colunas

  readonly #readDeclarativeColumns = (): void => {
    if (this.#columnsProperty) {
      return;
    }

    const columns: GridColumnDef[] = Array.from(this.querySelectorAll('u-grid-column'))
      .filter(column => column.parentElement === this);

    if (sameItems(columns, this.#declarativeColumns)) {
      return;
    }

    this.#declarativeColumns = columns;
    this.#syncColumns();
  };

  /**
   * Concilia as definições com a ordem atual: colunas já conhecidas mantêm a
   * posição e o agrupamento escolhidos pelo usuário; novas entram pelo
   * `groupIndex` (inicial) ou na posição da definição.
   */
  #syncColumns(): void {
    const definitions = this.columns;
    const defined = new Set(definitions);
    const known = new Set([...this._regularColumns, ...this._groupColumns]);

    const regular = this._regularColumns.filter(c => defined.has(c));
    const group = this._groupColumns.filter(c => defined.has(c));
    const newGroupColumns: GridColumnDef[] = [];

    definitions.forEach((column, index) => {
      if (known.has(column)) {
        return;
      }

      if (column.groupIndex === null || column.groupIndex === undefined) {
        regular.splice(Math.min(index, regular.length), 0, column);
      } else {
        newGroupColumns.push(column);
      }
    });

    newGroupColumns
      .sort((a, b) => a.groupIndex! - b.groupIndex!)
      .forEach(column => group.splice(Math.min(column.groupIndex!, group.length), 0, column));

    this.#setColumnState(regular, group);
  }

  #moveColumnTo(toGroup: boolean, column: GridColumnDef, targetIndex: number): void {
    const regular = [...this._regularColumns];
    const group = [...this._groupColumns];
    const source = regular.includes(column) ? regular : group.includes(column) ? group : null;

    if (!source) {
      return;
    }

    const target = toGroup ? group : regular;
    const targetColumn = target[targetIndex];

    if (targetColumn === column) {
      return;
    }

    source.splice(source.indexOf(column), 1);

    const insertAt = targetColumn ? target.indexOf(targetColumn) : target.length;
    target.splice(insertAt, 0, column);

    this.#setColumnState(regular, group);
  }

  #setColumnState(regular: GridColumnDef[], group: GridColumnDef[]): void {
    this.#dataTypes.clear();

    if (!sameItems(group, this._groupColumns)) {
      this._groupColumns = group;
      this.#groupsDirty = true;
    }

    if (!sameItems(regular, this._regularColumns)) {
      this._regularColumns = regular;
    }

    this.requestUpdate();
  }

  // -------------------------------------------------------------- row model

  readonly #isExpanded = (key: string): boolean =>
    this.#expansion.get(key) ?? this.autoExpandGroups;

  #ensureRows(): void {
    const language = this.#effectiveLanguage;

    if (this.#groupsDirty || (this._groupColumns.length && language !== this.#modelLanguage)) {
      this.#groups = buildGroups(this.#items, this._groupColumns, column => createComparer(language, column.dataType));
      this.#modelLanguage = language;
      this.#groupsDirty = false;
      this.#rowsDirty = true;
    }

    if (this.#rowsDirty) {
      this.#rows = flattenRows(this.#items, this.#groups, this.#isExpanded, rowKeyOf);
      this.#rowsDirty = false;
    }
  }

  #dataTypeOf(column: GridColumnDef): GridColumnDataType | undefined {
    if (!this.#dataTypes.has(column)) {
      this.#dataTypes.set(column, resolveDataType(this.#items, column));
    }

    return this.#dataTypes.get(column);
  }

  #formatContext(column: GridColumnDef): FormatContext {
    const { trueText, falseText } = this.#translation;

    return { language: this.language, dataType: this.#dataTypeOf(column), trueText, falseText };
  }

  #columnView(column: GridColumnDef): ColumnView {
    const format = this.#formatContext(column);
    const alignment = resolveAlignment(column, format.dataType);
    const minWidth = column.minWidth ?? null;

    return {
      column,
      id: columnIdOf(column),
      format,
      classes: {
        'align-center': alignment === 'center',
        'align-end': alignment === 'end',
        wrap: !!column.wrap,
      },
      minWidth: minWidth === null ? undefined : `${minWidth}px`,
    };
  }

  #groupValueText(row: GroupRow): string {
    return formatCellValue(row.value, row.firstItem, row.column, this.#formatContext(row.column));
  }

  /**
   * Dica com o texto completo só na célula truncada (reticências), calculada
   * ao passar o mouse — medir todas as células a cada render custaria caro.
   */
  readonly #updateCellHint = (event: Event): void => {
    const cell = (event.target as Element | null)?.closest?.('td.truncate');

    if (!(cell instanceof HTMLElement)) {
      return;
    }

    if (cell.scrollWidth > cell.clientWidth) {
      cell.title = cell.textContent.trim();
    } else {
      cell.removeAttribute('title');
    }
  };

  readonly #toggleGroup = (row: GroupRow): void => {
    this.#expansion.set(row.groupKey, !row.expanded);
    this.#rowsDirty = true;
    this.requestUpdate();
  };

  // ----------------------------------------------------------------- render

  override render() {

    this.#ensureRows();
    this.#columnViews = this._regularColumns.map(column => this.#columnView(column));
    this.#hasWrap = this._regularColumns.some(column => column.wrap);

    const rows = this.#rows;
    const virtualizer = this.#virtualizerController.getVirtualizer();

    if (virtualizer.options.count !== rows.length) {
      virtualizer.setOptions({ ...virtualizer.options, count: rows.length });
    }

    let virtualRows: VirtualItem[] = virtualizer.getVirtualItems();

    // Antes de medir (1º render, SSR, contêiner sem altura) o virtualizador
    // não devolve nada: mostra as primeiras linhas em vez de "sem dados".
    if (!virtualRows.length && rows.length) {
      virtualRows = rows.slice(0, INITIAL_RENDER_ROWS).map((row, index) => ({
        key: row.key,
        index,
        start: index * this.rowHeight,
        end: (index + 1) * this.rowHeight,
        size: this.rowHeight,
        lane: 0,
      }));
    }

    const headerRows = this.showColumnHeaders ? 1 : 0;
    const classes = {
      stripped: this.striped,
      'row-lines': this.showRowLines,
      'column-lines': this.showColumnLines,
    };

    return html`
      <div
        class="container ${classMap(classes)}"
        ${ref(this._containerRef)}
        role="grid"
        aria-rowcount="${rows.length + headerRows}"
        aria-colcount="${this._regularColumns.length}">
        <div class="scroll-container" ${ref(this._scrollContainerRef)}>
          ${this.#renderGroupPanel()}
          <table @pointerover=${this.#updateCellHint}>
            <colgroup>${this.#renderColGroups()}</colgroup>
            ${this.#renderColumnHeaders()}
            <tbody role="rowgroup" style="height: ${virtualizer.getTotalSize() || virtualRows.length * this.rowHeight}px;">
              ${this.#renderBody(virtualRows, headerRows)}
              <tr></tr>
            </tbody>
          </table>
        </div>
      </div>
      <slot hidden @slotchange=${this.#readDeclarativeColumns}></slot>
    `;
  }

  #renderColGroups(): HTMLTemplateResult {
    return html`
      ${map(this._groupColumns, () => html`
        <col class="group-column"/>`)}
      ${map(this._regularColumns, column => {
        const colStyles: { width?: string } = {};

        if (!!column.width || column.width === 0) {
          colStyles.width = `${Math.max(column.width, column.minWidth ?? 0)}px`;
        }

        return html`
          <col style="${styleMap(colStyles)}"/>`;
      })}
    `;
  }

  #renderColumnHeaders() {
    if (!this.showColumnHeaders) {
      return nothing;
    }

    return html`
      <thead role="rowgroup">
        <tr id="header-columns-row" role="row" aria-rowindex="1">
          ${map(this._groupColumns, () => html`<th role="presentation"></th>`)}
          ${map(this.#columnViews, (view, index) => html`
            <th
              class="header-column ${classMap(view.classes)}"
              style=${styleMap({ minWidth: view.minWidth })}
              role="columnheader"
              aria-colindex="${index + 1}">${view.column.label}</th>`)}
        </tr>
      </thead>
    `;
  }

  #renderBody(virtualRows: VirtualItem[], headerRows: number) {

    if (!this.#rows.length) {
      return html`
        <tr>
          <td part="cell no-data" colspan="${Math.max(this._groupColumns.length + this._regularColumns.length, 1)}">${this.#translation.noData}</td>
        </tr>
      `;
    }

    // As linhas ficam no fluxo da tabela, uma após a outra: todas descem o
    // início da 1ª linha virtual (vale também com alturas diferentes, `wrap`).
    const offset = virtualRows[0]?.start ?? 0;

    return keyedRows(
      virtualRows,
      virtualRow => virtualRow.key,
      virtualRow => this.#renderRow(virtualRow, offset, this.#rows[virtualRow.index], headerRows),
    );
  }

  #renderRow(virtualRow: VirtualItem, offset: number, row: Row, headerRows: number) {
    const parity = row.isGroup
      ? ''
      : row.index % 2 === 0 ? 'odd' : 'even';

    const classes: Record<string, boolean> = {
      'group-row': row.isGroup,
      last: virtualRow.index === this.#rows.length - 1,
    };

    if (parity) {
      classes[parity] = true;
    }

    return html`
      <tr
        style="transform: translateY(${offset}px); height: ${this.rowHeight}px;"
        data-index=${virtualRow.index}
        role="row"
        aria-rowindex="${virtualRow.index + 1 + headerRows}"
        aria-level=${row.isGroup ? row.level + 1 : nothing}
        class="${classMap(classes)}"
        part="row ${row.isGroup ? 'group-row' : parity}">
        ${row.isGroup
          ? renderGroupRowCells({
            row,
            totalColumns: this._groupColumns.length + this._regularColumns.length,
            separator: this.#translation.groupLabelSeparator,
            valueText: this.#groupValueText(row),
            onToggle: this.#toggleGroup,
          })
          : this.#renderDataRowCells(row)}
      </tr>
    `;
  }

  #renderDataRowCells(row: DataRow) {
    return html`
      ${map(this._groupColumns, () => html`<td role="presentation" class="group-column"></td>`)}
      ${map(this.#columnViews, (view, index) => html`
        <td
          class=${classMap({ ...view.classes, truncate: !view.column.wrap && !view.column.renderer })}
          role="gridcell"
          aria-colindex="${index + 1}">${renderDataCell(this, row, view.column, view.id, view.format)}</td>`)}
    `;
  }

  #renderGroupPanel() {
    if (!this.showGroupPanel) {
      return nothing;
    }

    return html`
      <div class="header">
        <div class="group-container" ${ref(this._groupContainerRef)}>
          ${this._groupColumns.length
            ? html`
              ${map(this._groupColumns, (column, index) => html`
                <div class="group" style="--_order: ${index}">${column.label}</div>`)}
              <div class="group-end-dropzone"></div>`
            : html`<div class="drag-here">${this.#translation.dragToGroup}</div>`}
        </div>
      </div>
    `;
  }

  /**
   * Liga os elementos do cabeçalho e do painel de grupos ao arrasto. Roda só
   * quando colunas/painéis mudam (não a cada render de rolagem) e é
   * idempotente: o mesmo elemento nunca é registrado duas vezes, e os que
   * saíram do DOM são soltos.
   */
  #syncDragAndDrop(): void {
    const root = this.renderRoot;

    this.#columnDragAndDrop.prune();
    this.#groupDragAndDrop.prune();

    root.querySelectorAll<HTMLElement>('th.header-column').forEach((th, index) => {
      const column = this._regularColumns[index];

      if (column) {
        this._nativeColumnMap.set(th, column);
        this.#columnDragAndDrop.attach(th);
      }
    });

    root.querySelectorAll<HTMLElement>('.group').forEach((chip, index) => {
      const column = this._groupColumns[index];

      if (column) {
        this._nativeColumnMap.set(chip, column);
        this.#groupDragAndDrop.attach(chip);
      }
    });

    const dragHere = root.querySelector<HTMLElement>('.drag-here');

    if (dragHere) {
      this.#groupDragAndDrop.attachToGroupDropTarget(dragHere, 0);
    }

    const endZone = root.querySelector<HTMLElement>('.group-end-dropzone');

    if (endZone) {
      this.#groupDragAndDrop.attachToGroupDropTarget(endZone, 9998);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid': DataGrid;
  }
}
