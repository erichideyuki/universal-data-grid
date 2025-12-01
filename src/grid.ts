import { html, HTMLTemplateResult, LitElement, nothing } from 'lit';
import { customElement, property, query, queryAll, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { map } from 'lit/directives/map.js';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';

import { VirtualizerController } from '@tanstack/lit-virtual';

import { styles as baseStyles } from '../shared/base.styles.js';
import { ColumnDragAndDropAdapter } from './column-drag-and-drop-adapter.js';
import { UmDataGridColumn } from './grid-column.js';
import { styles } from './grid.styles.js';
import { GroupDragAndDropAdapter } from './group-drag-and-drop-adapter.js';

import './grid-column.js';
import './grid-custom-cell.js';

interface GroupRow {
  isGroup: true;
  expanded: boolean;
  level: number;
  rawValue: string;
  displayValue: string;
  groups: GroupRow[];
  items: any[];
}

interface DataRow {
  isGroup: false;
  item: any;
}

type Row = GroupRow | DataRow;

@customElement('u-grid')
export class UmDataGrid extends LitElement {
  static override styles = [baseStyles, styles];

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
  readonly _nativeColumnMap = new WeakMap<HTMLElement, UmDataGridColumn>();
  #sortedItems: any[] = [];

  protected _columns: UmDataGridColumn[] = [];
  @state() _groupColumns: UmDataGridColumn[] = [];
  @state() _regularColumns: UmDataGridColumn[] = [];

  @queryAll('#header-columns-row .header-column') readonly _headerColumns!: HTMLElement[];
  @query('.group-container') readonly _groupContainer!: HTMLElement;

  @property({ type: Number }) rowHeight = 48;
  @property({ type: Number }) stripped = false;
  @property({ type: Boolean }) showHeader = true;
  @property({ type: Boolean }) showRowLines = true;
  @property({ type: Boolean }) showColumnLines = false;

  readonly _containerRef: Ref<HTMLDivElement> = createRef();
  readonly _groupContainerRef: Ref<HTMLDivElement> = createRef();
  readonly #virtualizerController = new VirtualizerController(this, {
    getScrollElement: () => this._containerRef.value!,
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
        class="container ${classMap(classes)}" ${ref(this._containerRef)}
        role="grid"
        aria-rowcount="${this.#rows.length}"
        aria-colcount="${this._regularColumns.length}">
        <div>
          ${this.#renderHeader()}
          <table style="height: ${virtualizer.getTotalSize()}px;">
            <thead role="rowgroup">
              <tr id="header-columns-row" aria-rowindex="1">
                ${map(this._groupColumns, () => html`<th role="presentation" class="group-column"></th>`)}
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
                      ${column.textContent}
                    </th>`)}
              </tr>
            </thead>
            <tbody role="rowgroup">
              ${this.#renderBody(virtualRows)}
              <tr></tr>
            </tbody>
          </table>
        </div>
      </div>
      <slot hidden @slotchange=${this.#setColumns}></slot>
    `;
  }

  #renderBody(virtualRows: any[]) {

    const columnCount = this._columns.length;

    if (!virtualRows.length) {
      return html`
        <tr>
          <td part="cell no-data" colspan="${columnCount}">No data</td>
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

  groupColumn(column: UmDataGridColumn, targetIndex: number): void {
    this.#moveColumnTo(this._groupColumns, column, targetIndex);
  }

  moveColumn(column: UmDataGridColumn, targetIndex: number): void {
    this.#moveColumnTo(this._regularColumns, column, targetIndex);
  }

  #moveColumnTo(targetList: UmDataGridColumn[], column: UmDataGridColumn, targetIndex: number): void {
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

    this._setRegularColumnsOrder();

    if (sourceList === this._groupColumns || targetList === this._groupColumns) {
      this.#rebuildGroupsFromLevel(sourceList === this._groupColumns
        ? sourceIndex
        : targetIndex);
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
        colspan="${this._columns.length - row.level + 1}">
        ${row.displayValue}
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

        const value = this.#getValueByPath(item, column.path);

        let group = currentGroups[i];

        if (group?.rawValue === value) {
          group.items.push(item);
          continue;
        }

        currentGroups.length = i;

        const rowValue = `${column.textContent}: ${value}`;
        group = {
          isGroup: true,
          expanded: this.autoExpandGroups,
          level: i,
          rawValue: value,
          displayValue: rowValue,
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

    this.#resetRows();
  }

  #getValueByPath(item: any, path: string) {
    return path.split('.').reduce((acc, key) => acc?.[key], item) ?? '';
  }

  #setColumns() {
    this._columns = Array.from(this.querySelectorAll('u-grid-column'));
    this._groupColumns = this._columns
      .filter(c => !!c.groupIndex || c.groupIndex === 0)
      .sort((a, b) => a.groupIndex! - b.groupIndex!);
    this._regularColumns = this._columns
      .filter(c => !this._groupColumns.includes(c))
      .sort(c => (c._index ?? 0) - (c._index ?? 0));
    this._setRegularColumnsOrder();
    this.#setData();
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
        const aValue = this.#getValueByPath(a, groupColumn.path) ?? '';
        const bValue = this.#getValueByPath(b, groupColumn.path) ?? '';

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

  _setRegularColumnsOrder() {
    for (let i = 0; i < this._regularColumns.length; i++) {
      const column = this._regularColumns[i];
      column._index = i;
    }

    for (let i = 0; i < this._groupColumns.length; i++) {
      const column = this._groupColumns[i];
      column.groupIndex = i;
    }
  }

  #setData() {
    this.#updateSorting();
    this.#resetGroups();
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
              })}>Drag a column header here to group by it
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
          })}>${column.textContent}
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

  #renderCell(row: DataRow, column: UmDataGridColumn, index: number) {

    if (!column.renderer) {
      return html`${this.#getValueByPath(row.item, column.path)}`;
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
    'u-grid': UmDataGrid;
  }
}
