import { ContextConsumer } from '@lit/context';

import { html, type HTMLTemplateResult, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { map } from 'lit/directives/map.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { VirtualizerController } from '@tanstack/lit-virtual';
import type { VirtualItem } from '@tanstack/virtual-core';

import { ColumnDragAndDropAdapter } from './features/column-dnd.js';
import { GroupDragAndDropAdapter } from './features/group-dnd.js';
import type { GridColumnDef } from './grid-column-def.js';
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
import { createComparer } from './row-model/compare.js';
import { flattenRows } from './row-model/flatten.js';
import { buildGroups } from './row-model/group.js';
import type { DataRow, GroupNode, GroupRow, Row } from './row-model/types.js';

import './grid-column.js';

export type { GridColumnDef } from './grid-column-def.js';
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
  }

  #groups: GroupNode[] = [];
  #rows: Row[] = [];
  #groupsDirty = true;
  #rowsDirty = true;
  #modelLanguage: string | undefined;
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

  // ----------------------------------------------------------- ciclo de vida

  override connectedCallback() {
    super.connectedCallback();
    this.#readDeclarativeColumns();
    this.#virtualizerController.hostConnected();
    this.#unobserveDocumentLanguage = observeDocumentLanguage(() => this.requestUpdate());
    this.#dragAndDropDirty = true;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#virtualizerController.hostDisconnected();
    this.#unobserveDocumentLanguage?.();
    this.#unobserveDocumentLanguage = undefined;
    this.#columnDragAndDrop.detach();
    this.#groupDragAndDrop.detach();
  }

  override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('autoExpandGroups')) {
      this.#rowsDirty = true;
    }
  }

  override updated(changed: PropertyValues<this>) {
    if (changed.has('rowHeight')) {
      this.#virtualizerController.getVirtualizer().measure();
    }

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

  /** Chamado por `<u-grid-column>` quando `width`/`group-index` mudam. */
  _columnChanged(column: GridColumnDef, change: 'width' | 'groupIndex'): void {

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
      this.#groups = buildGroups(this.#items, this._groupColumns, createComparer(language));
      this.#modelLanguage = language;
      this.#groupsDirty = false;
      this.#rowsDirty = true;
    }

    if (this.#rowsDirty) {
      this.#rows = flattenRows(this.#items, this.#groups, this.#isExpanded, rowKeyOf);
      this.#rowsDirty = false;
    }
  }

  readonly #toggleGroup = (row: GroupRow): void => {
    this.#expansion.set(row.groupKey, !row.expanded);
    this.#rowsDirty = true;
    this.requestUpdate();
  };

  // ----------------------------------------------------------------- render

  override render() {

    this.#ensureRows();

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
          <table>
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
          colStyles.width = `${column.width}px`;
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
          ${map(this._regularColumns, (column, index) => html`
            <th
              class="header-column"
              role="columnheader"
              aria-colindex="${index + 1}">${column.label}</th>`)}
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

    return repeat(
      virtualRows,
      virtualRow => virtualRow.key,
      (virtualRow, index) => this.#renderRow(virtualRow, index, this.#rows[virtualRow.index], headerRows),
    );
  }

  #renderRow(virtualRow: VirtualItem, index: number, row: Row, headerRows: number) {
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
        style="transform: translateY(${virtualRow.start - index * virtualRow.size}px); height: ${this.rowHeight}px;"
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
            onToggle: this.#toggleGroup,
          })
          : this.#renderDataRowCells(row)}
      </tr>
    `;
  }

  #renderDataRowCells(row: DataRow) {
    return html`
      ${map(this._groupColumns, () => html`<td role="presentation" class="group-column"></td>`)}
      ${map(this._regularColumns, (column, index) => html`
        <td
          role="gridcell"
          aria-colindex="${index + 1}">${renderDataCell(this, row, column, columnIdOf(column))}</td>`)}
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
