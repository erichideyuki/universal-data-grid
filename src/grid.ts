import { ContextConsumer } from '@lit/context';

import { html, type HTMLTemplateResult, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { map } from 'lit/directives/map.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { VirtualizerController } from '@tanstack/lit-virtual';

import { ColumnDragAndDropAdapter } from './column-drag-and-drop-adapter.js';
import type { GridColumnDef } from './grid-column-def.ts';
import { DEFAULT_GRID_LANGUAGE, type GridI18n, gridLanguageContext, resolveGridTranslation } from './grid-i18n.js';
import { styles } from './grid.styles.js';
import { GroupDragAndDropAdapter } from './group-drag-and-drop-adapter.js';

import './grid-column.js';
import './grid-custom-cell.js';

export type { GridColumnDef } from './grid-column-def.ts';
export { setGridLanguage, setGridTranslation, gridLanguageContext, type GridI18n } from './grid-i18n.js';

interface GroupRow {
  isGroup: true;
  expanded: boolean;
  level: number;
  rawValue: string;
  groups: GroupRow[];
  items: any[];
}

interface DataRow {
  isGroup: false;
  item: any;
}

type Row = GroupRow | DataRow;

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

@customElement('u-grid')
export class DataGrid extends LitElement {
  static override styles = [styles];

  #items: any[] = [];

  @property({ type: Boolean, attribute: 'auto-expand-groups' }) autoExpandGroups = false;

  @property({ type: Array })
  get items(): any[] {
    return this.#items;
  }

  set items(items: any[]) {
    this.#items = items;
    this.#setData();
  }

  readonly #groupsByLevel: GroupRow[][] = [];
  readonly #rows: Row[] = [];
  readonly _nativeColumnMap = new WeakMap<HTMLElement, GridColumnDef>();
  #sortedItems: any[] = [];

  protected _columns: GridColumnDef[] = [];
  @state() _groupColumns: GridColumnDef[] = [];
  @state() _regularColumns: GridColumnDef[] = [];

  @property({ attribute: false })
  get columns(): GridColumnDef[] {
    return this._columns;
  }

  set columns(value: GridColumnDef[]) {
    this._columns = value;
    this._resetGroupColumns();
  }

  @property({ type: Number }) rowHeight = 48;
  @property({ type: Boolean }) stripped = false;
  @property({ type: Boolean }) showHeader = true;
  @property({ type: Boolean }) showRowLines = true;
  @property({ type: Boolean }) showColumnLines = false;

  #explicitLanguage?: string;

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

  readonly _containerRef: Ref<HTMLDivElement> = createRef();
  readonly _scrollContainerRef: Ref<HTMLDivElement> = createRef();
  readonly _groupContainerRef: Ref<HTMLDivElement> = createRef();
  readonly #virtualizerController = new VirtualizerController(this, {
    getScrollElement: () => this._scrollContainerRef.value!,
    count: 0,
    estimateSize: () => this.rowHeight,
    overscan: 5,
  });

  readonly #columnDragAndDrop = new ColumnDragAndDropAdapter(this);
  readonly #groupDragAndDropAdapter = new GroupDragAndDropAdapter(this);

  override render() {

    const virtualizer = this.#virtualizerController.getVirtualizer();
    virtualizer.options.count = this.#rows.length;

    const virtualRows = virtualizer.getVirtualItems();
    const classes = {
      stripped: this.stripped,
      'row-lines': this.showRowLines,
      'column-lines': this.showColumnLines,
    };

    return html`
      <div
        class="container ${classMap(classes)}"
        ${ref(this._containerRef)}
        role="grid"
        aria-rowcount="${this.#rows.length}"
        aria-colcount="${this._regularColumns.length}">
        <div class="scroll-container" ${ref(this._scrollContainerRef)}>
          ${this.#renderHeader()}
          <table>
            <colgroup>${this.#renderColGroups()}</colgroup>
            <thead role="rowgroup">
              <tr id="header-columns-row" aria-rowindex="1">
                ${map(this._groupColumns, () => html`<th role="presentation"></th>`)}
                ${map(this._regularColumns, (column, index) =>
                  html`
                    <th
                      class="header-column"
                      role="columnheader"
                      aria-colindex="${index + 1}"
                      ${ref(el => {
                        if (!el) {
                          return;
                        }

                        this._nativeColumnMap.set(el as HTMLElement, column);
                        this.#columnDragAndDrop.attach(el as HTMLElement);
                      })}>
                      ${column.label}
                    </th>`)}
              </tr>
            </thead>
            <tbody role="rowgroup" style="height: ${virtualizer.getTotalSize()}px;">
              ${this.#renderBody(virtualRows)}
              <tr></tr>
            </tbody>
          </table>
        </div>
      </div>
      <slot hidden @slotchange=${this.#setColumns}></slot>
    `;
  }

  #renderColGroups(): HTMLTemplateResult {
    return html`
      ${map(this._groupColumns, () => html`
        <col class="group-column"/>`)}
      ${map(this._regularColumns, column => {
        const colStyles: Record<string, any> = {};

        if (!!column.width || column.width === 0) {
          colStyles.width = `${column.width}px`;
        }

        return html`
          <col style="${styleMap(colStyles)}"/>`;
      })}
    `;
  }

  #renderBody(virtualRows: any[]) {

    const columnCount = this._columns.length;

    if (!virtualRows.length) {
      return html`
        <tr>
          <td part="cell no-data" colspan="${columnCount}">${this.#translation.noData}</td>
        </tr>
      `;
    }

    const groupingCount = this._groupColumns.length;

    let oddEven: string | null = null;
    return html`
      ${repeat(
        virtualRows,
        virtualRow => virtualRow.key,
        (virtualRow, index) => {

          const row = this.#rows[virtualRow.index];
          oddEven = row.isGroup
            ? ''
            : oddEven === 'odd'
              ? 'even'
              : 'odd';

          return this.#renderItem(virtualRow, index, row, oddEven, groupingCount);
        })}
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#setColumns();
    this.#virtualizerController.hostConnected();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#virtualizerController.hostDisconnected();
    this.#columnDragAndDrop.detach();
    this.#groupDragAndDropAdapter.detach();
    this._columns.length = 0;
    this._groupColumns.length = 0;
    this._regularColumns.length = 0;
  }

  groupColumn(column: GridColumnDef, targetIndex: number): void {
    this.#moveColumnTo(this._groupColumns, column, targetIndex);
  }

  moveColumn(column: GridColumnDef, targetIndex: number): void {
    this.#moveColumnTo(this._regularColumns, column, targetIndex);
  }

  #moveColumnTo(targetList: GridColumnDef[], column: GridColumnDef, targetIndex: number): void {
    const targetColumn = targetList[targetIndex];

    if (targetColumn === column) {
      return;
    }

    const sourceList = this._regularColumns.includes(column)
      ? this._regularColumns
      : this._groupColumns;

    const sourceIndex = sourceList.indexOf(column);

    if (sourceList === targetList && sourceIndex === targetIndex - 1) {
      return;
    }

    sourceList.splice(sourceList.indexOf(column), 1);
    targetIndex = targetList.indexOf(targetColumn);

    if (targetIndex === -1) {
      targetIndex = targetList.length;
      targetList.push(column);
    } else {
      targetList.splice(targetIndex, 0, column);
    }

    this.#setColumnsOrder();

    if (sourceList === this._groupColumns || targetList === this._groupColumns) {
      const updateGroupingFromLevel = sourceList === this._groupColumns && targetList === this._groupColumns
        ? Math.min(sourceIndex, targetIndex)
        : sourceList === this._groupColumns
          ? sourceIndex
          : targetIndex;

      this.#rebuildGroupsFromLevel(updateGroupingFromLevel);
    }

    this.requestUpdate();
  }

  #renderItem(virtualRow: any, index: number, row: Row, oddEven: string, groupingCount: number) {
    const classes: Record<string, boolean> = {
      'group-row': row.isGroup,
      last: virtualRow.index === this.#rows.length - 1,
    };

    if (oddEven) {
      classes[oddEven] = true;
    }

    return html`
      <tr
        style="transform: translateY(${virtualRow.start - index * virtualRow.size}px); height: ${this.rowHeight}px;"
        role="row"
        aria-rowindex="${virtualRow.index + 2}"
        class="${classMap(classes)}"
        part="row ${row.isGroup ? 'group-row' : oddEven}">
        ${row.isGroup
          ? this.#renderGroupRowCells(row)
          : this.#renderDataRowCells(row, groupingCount)}
      </tr>
    `;
  }

  #renderDataRowCells(row: DataRow, groupingCount: number) {
    return html`
      ${map(new Array(groupingCount), () => html`<td role="presentation" class="group-column"></td>`)}
      ${map(this._regularColumns, (column, index) =>
        html`
          <td
            role="gridcell"
            aria-colindex="${index + 1}">${this.#renderCell(row, column, index)}</td>`)}
    `;
  }

  #renderGroupRowCells(row: GroupRow): HTMLTemplateResult {

    const classes = { expanded: row.expanded };
    const groupColumn = this._groupColumns[row.level];
    const displayValue = `${groupColumn.label ?? ''}${this.#translation.groupLabelSeparator}${row.rawValue}`;

    return html`
      ${row.level
        ? html`<td class="group-column" role="presentation" colspan=${row.level}></td>`
        : nothing}
      <td
        class="group-column group-column-toggle ${classMap(classes)}"
        role="gridcell"
        aria-colindex="1"
        @click=${() => this.#toggleGroup(row)}>
        <div class="toggle-icon">
          <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 -960 960 960" width="1em" fill="currentColor">
            <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/>
          </svg>
        </div>
      </td>
      <td
        class="grouping-cell"
        role="gridcell"
        aria-colindex="2"
        colspan="${this._columns.length - (row.level + 1)}">
        ${displayValue}
      </td>
    `;
  }

  #toggleGroup(row: Row): void {

    if (!row.isGroup) {
      return;
    }

    const index = this.#rows.indexOf(row);
    const nextRow = this.#rows[index + 1];

    if (!nextRow) {
      this.#expandGroup(index);
      return;
    }

    if (!nextRow.isGroup) {
      this.#collapseGroup(index);
      return;
    }

    if (nextRow.level > row.level) {
      this.#collapseGroup(index);
      return;
    }

    this.#expandGroup(index);
  }

  #collapseGroup(rowIndex: number): void {
    const group = this.#rows[rowIndex] as GroupRow;
    group.expanded = false;

    if (group.level + 1 === this._groupColumns.length) {
      this.#rows.splice(rowIndex + 1, group.items.length);
      this.requestUpdate();
      return;
    }

    const rowsAfter = this.#rows.slice(rowIndex + 1);

    let deleteRowCount = this.#rows
      .slice(rowIndex + 1)
      .findIndex(r => r.isGroup && r.level <= group.level);

    if (deleteRowCount === -1) {
      deleteRowCount = rowsAfter.length;
    }

    this.#rows.splice(rowIndex + 1, deleteRowCount);
    this.requestUpdate();
  }

  #expandGroup(rowIndex: number): void {
    const group = this.#rows[rowIndex] as GroupRow;
    group.expanded = true;

    const rows: Row[] = [];

    this.#setGroupRows(group, rows);

    this.#rows.splice(rowIndex + 1, 0, ...rows);
    this.requestUpdate();
  }

  #setGroupRows(group: GroupRow, target: Row[]): void {

    if (!group.expanded) {
      return;
    }

    if (group.level + 1 === this._groupColumns.length) {
      for (const item of group.items) {
        target.push({
          isGroup: false,
          item,
        });
      }

      return;
    }

    for (const subGroup of group.groups) {
      target.push(subGroup);
      this.#setGroupRows(subGroup, target);
    }
  }

  #buildGroups(): void;
  #buildGroups(startingLevel: number, items: any[], currentGroups: GroupRow[]): void;
  #buildGroups(startingLevel = 0, items: any[] = this.#sortedItems, currentGroups: GroupRow[] = []): void {

    if (!this._groupColumns.length) {
      return;
    }

    for (const item of items) {
      for (let i = startingLevel; i < this._groupColumns.length; i++) {
        this.#groupsByLevel[i] ??= [];
        const levelGroups = this.#groupsByLevel[i];

        const column = this._groupColumns[i];

        const value = this.#getValueByPath(item, column.path!);

        let group = currentGroups[i];

        if (group?.rawValue.toString() === value.toString()) {
          group.items.push(item);
          continue;
        }

        currentGroups.length = i;

        group = {
          isGroup: true,
          expanded: this.autoExpandGroups,
          level: i,
          rawValue: value,
          items: [item],
          groups: [],
        };

        currentGroups[i] = group;
        levelGroups.push(group);

        if (i !== 0) {
          const parent = currentGroups[i - 1];
          parent.groups.push(group);
        }
      }
    }
  }

  #resetGroups() {
    this.#rows.length = 0;
    this.#groupsByLevel.length = 0;

    this.#updateSorting();
    this.#buildGroups();
    this.#resetRows();
  }

  #resetRows(): void {
    if (!this.#groupsByLevel.length) {
      const rows = this.#sortedItems.map<DataRow>(item => ({
        isGroup: false,
        item,
      }));

      this.#rows.splice(0, 0, ...rows);
      return;
    }

    for (const group of this.#groupsByLevel[0]) {
      this.#rows.push(group);
      this.#setGroupRows(group, this.#rows);
    }
  }

  #rebuildGroupsFromLevel(level: number) {

    if (level === 0) {
      this.#resetGroups();
      return;
    }

    this.#rows.length = 0;
    this.#groupsByLevel.length = level;

    const levelGroups = this.#groupsByLevel[level - 1];

    for (const group of levelGroups) {
      group.groups.length = 0;
      const groupHierarchy = [];
      groupHierarchy[level - 1] = group;
      this.#buildGroups(level, group.items, groupHierarchy);
    }

    this.#updateSorting();
    this.#resetRows();
  }

  #getValueByPath(item: any, path: string) {
    return path.split('.').reduce((acc, key) => acc?.[key], item) ?? '';
  }

  #setColumns() {
    this._columns = Array.from(this.querySelectorAll('u-grid-column'));

    this._resetGroupColumns();
  }

  _resetGroupColumns() {
    const previousGroupColumns = this._groupColumns;

    this._groupColumns = this._columns
      .filter(c => !!c.groupIndex || c.groupIndex === 0)
      .sort((a, b) => a.groupIndex! - b.groupIndex!);

    this._regularColumns = this._columns
      .filter(c => !this._groupColumns.includes(c))
      .sort(c => (c._index ?? 0) - (c._index ?? 0));

    let changedColumnIndex = 0;

    for (changedColumnIndex; changedColumnIndex < previousGroupColumns.length; changedColumnIndex++) {
      if (previousGroupColumns[changedColumnIndex] !== this._groupColumns[changedColumnIndex]) {
        break;
      }
    }

    this.#setColumnsOrder();
    this.#setData(changedColumnIndex);
  }

  #updateSorting(): void {
    if (!this.items?.length) {
      this.#sortedItems = [];
      return;
    }

    if (!this._groupColumns.length) {
      this.#sortedItems = this.items;
      return;
    }

    this.#sortedItems = this.items.sort((a, b) => {

      for (const groupColumn of this._groupColumns) {
        const aValue = this.#getValueByPath(a, groupColumn.path!) ?? '';
        const bValue = this.#getValueByPath(b, groupColumn.path!) ?? '';

        const textComparison = aValue.toString().localeCompare(bValue.toString());

        if (textComparison !== 0) {
          return textComparison;
        }
      }

      return 0;
    });
  }

  #renderHeader() {
    if (!this.showHeader) {
      return nothing;
    }

    return html`
      <div class="header">
        ${this.#renderGroupContainer()}
      </div>
    `;
  }

  #setColumnsOrder() {
    for (let i = 0; i < this._regularColumns.length; i++) {
      const column = this._regularColumns[i];
      column._index = i;
    }

    for (let i = 0; i < this._groupColumns.length; i++) {
      const column = this._groupColumns[i];
      column._groupIndex = i;
    }
  }

  #setData(changedColumnIndex = 0) {
    this.#updateSorting();
    this.#rebuildGroupsFromLevel(changedColumnIndex);
  }

  #renderGroupContainer() {
    return html`
      <div class="group-container" ${ref(this._groupContainerRef)}>
        ${this._groupColumns.length
          ? this.#renderGroups()
          : html`
            <div
              class="drag-here"
              ${ref(el => {
                if (!el) {
                  return;
                }

                this.#groupDragAndDropAdapter.attachToGroupDropTarget(el as HTMLElement, 0);
              })}>${this.#translation.dragToGroup}
            </div>`}
      </div>`;
  }

  #renderGroups() {
    return html`
      ${map(this._groupColumns, (column, index) =>
        html`
          <div class="group" style="--_order: ${index}" ${ref(group => {

            if (!group) {
              return;
            }

            this._nativeColumnMap.set(group as HTMLElement, column);
            this.#groupDragAndDropAdapter.attach(group as HTMLElement);
          })}>${column.label}
          </div>`)}
      <div
        class="group-end-dropzone"
        ${ref(el => {
          if (!el) {
            return;
          }

          this.#groupDragAndDropAdapter.attachToGroupDropTarget(el as HTMLElement, 9998);
        })}></div>
    `;
  }

  #renderCell(row: DataRow, column: GridColumnDef, index: number) {

    if (!column.renderer) {
      return html`${this.#getValueByPath(row.item, column.path!)}`;
    }

    const rowIndex = this.#rows.indexOf(row);
    const slotName = `custom-cell-${rowIndex}-${index}`;

    return html`
      <slot name="${slotName}"></slot>
      <u-grid-custom-cell
        .grid=${this}
        .column=${column}
        .item=${row.item}
        .slotName=${slotName}></u-grid-custom-cell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'u-grid': DataGrid;
  }
}
