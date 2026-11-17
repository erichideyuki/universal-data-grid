import { css } from 'lit';

export const styles = css`
  * {
    box-sizing: border-box;
  }

  :host {
    display: block;
    height: 100%;
    --_background-color: var(--u-grid-background-color, var(--u-color-surface-container-lowest, rgb(255, 255, 255)));
    --_stripped-background-color: var(--u-grid-stripped-background-color, color-mix(in srgb, var(--u-color-surface-container, rgb(243, 237, 247)) 80%, transparent));
    --_border-color: color-mix(in srgb, currentColor var(--u-grid-border-opacity, 20%), transparent);
    --_borders-width: var(--u-grid-borders-width, 1px);
    --_cell-block-padding: var(--u-table-cell-block-padding, 13px);
    --_cell-inline-padding: var(--u-table-cell-inline-padding, 16px);
    --_cell-padding: var(--u-table-cell-padding, var(--_cell-block-padding) var(--_cell-inline-padding));
    --_header-padding: var(--u-table-header-padding, var(--u-table-header-block-padding, 8px) var(--u-table-header-inline-padding, var(--_cell-inline-padding)));
    --_column-lines-width: var(--u-grid-column-lines-width, var(--_borders-width));
    --_drop-indicator-width: var(--u-grid-drop-indicator-width, 3px);
    --_row-lines-height: var(--u-grid-row-lines-height, var(--_borders-width));
    --_header-height: var(--u-grid-header-height, 56px);
    --_group-column-width: 32px;
    --_dir: 1;
    --_resize-handle-width: var(--u-grid-resize-handle-width, 8px);
    --_fixed-shadow-color: var(--u-grid-fixed-shadow-color, color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 22%, transparent));
    --_focus-ring: var(--u-grid-focus-ring-width, 2px) solid var(--u-grid-focus-ring-color, var(--u-color-primary, rgb(103, 80, 164)));
  }

  :host(:dir(rtl)) {
    --_dir: -1;
  }

  .container {
    position: relative;
    display: block;
    background-color: var(--_background-color);
    height: 100%;
  }

  .container.drop-target::after {
    content: "";
    position: absolute;
    top: 0;
    left: min(var(--_drop-indicator-left), 100% - var(--_drop-indicator-width));
    bottom: 0;
    background-color: var(--u-grid-drop-indicator-bg, var(--u-color-primary, rgb(103, 80, 164)));
    width: var(--_drop-indicator-width);
    z-index: 20;
  }

  .container:has(.header).drop-target::after {
    top: var(--_header-height);
  }

  .scroll-container {
    height: 100%;
    overflow: auto;
  }

  .group-container {
    display: flex;
    align-items: center;
    flex: 1;
    gap: 8px;
    height: 100%;
  }

  .group-container.drop-target::before {
    content: "";
    width: 3px;
    height: 100%;
    background-color: var(--u-grid-drop-indicator-bg, var(--u-color-primary, rgb(103, 80, 164)));
    order: var(--_drop-indicator-order, 0);
  }

  .group {
    line-height: var(--u-group-label-line-height, var(--u-label-l-line-height, 1.25rem));
    font-size: var(--u-group-label-font-size, var(--u-label-l-font-size, 0.875rem));
    letter-spacing: var(--u-group-label-letter-spacing, var(--u-label-l-letter-spacing, 0.0071428571rem));
    font-weight: var(--u-group-label-font-weight, var(--u-label-l-font-weight, var(--u-font-weight-medium, 500)));
    display: flex;
    align-items: center;
    height: var(--u-group-height, 32px);
    border: var(--u-group-outline-width, 1px) solid var(--u-group-outline-color, var(--u-color-outline, rgb(121, 116, 126)));
    border-radius: var(--u-group-shape, var(--u-shape-corner-small, 8px));
    padding-inline: var(--u-group-padding, 16px);
    order: var(--_order);
    user-select: none;
    touch-action: none;
  }

  tr {
    --_row-tint: transparent;
  }

  .stripped .even {
    --_row-tint: var(--_stripped-background-color);
    background-color: var(--_row-tint);
  }

  thead {
    position: sticky;
    top: 0;
    background-color: var(--u-grid-header-background-color, var(--_background-color));
    z-index: 2;
  }

  :root {
    --u-table-hover-opacity: var(--u-state-layer-hover-opacity);
    --u-table-cell-font-weight: var(--u-font-weight-medium, 500);
  }

  table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  /* Todas as larguras definidas: a tabela tem a soma exata e não estica. */
  table.fit {
    min-width: 0;
  }

  td, th {
    max-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    --_col-line: 0 0 transparent;
    --_row-line: 0 0 transparent;
    --_edge-line: 0 0 transparent;
    --_edge-shadow: 0 0 transparent;
  }

  td {
    border-collapse: separate;
    padding: var(--u-grid-data-cell-padding, var(--_cell-padding));
    font-size: var(--u-td-font-size, 0.875rem);
    font-weight: var(--u-td-font-weight, var(--u-table-cell-font-weight));
    text-align: start;
  }

  th {
    height: var(--u-grid-header-height, 46px);
    padding: var(--u-grid-header-cell-padding, var(--_cell-padding));
    font-size: var(--u-th-font-size, 0.8125rem);
    font-weight: var(--u-th-font-weight, var(--u-table-cell-font-weight));
    color: color-mix(in srgb, currentColor var(--u-low-emphasis-opacity, 75%), transparent);
    text-align: start;
  }

  /* Alinhamento lógico: \`end\` vai para a esquerda em RTL. */
  td.align-center, th.align-center {
    text-align: center;
  }

  td.align-end, th.align-end {
    text-align: end;
  }

  .boolean-icon {
    display: inline-flex;
    vertical-align: middle;
  }

  .boolean-icon.false {
    color: color-mix(in srgb, currentColor var(--u-low-emphasis-opacity, 60%), transparent);
  }

  td.wrap {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .column-lines td:not(.group-column):not(:last-child),
  .column-lines th:not(.group-column):not(:last-child) {
    --_col-line: inset calc(var(--_column-lines-width) * -1 * var(--_dir)) 0 0 0 var(--_border-color);
    box-shadow: var(--_col-line), var(--_row-line), var(--_edge-line), var(--_edge-shadow);
  }

  .column-lines .header,
  .group-row,
  thead,
  .row-lines tr:not(.last):not(:last-child),
  tr:has(+ .group-row) {
    box-shadow: inset 0 calc(var(--_row-lines-height) * -1) 0 0 var(--_border-color);
  }

  .hover tr:hover {
    --_row-tint: color-mix(in srgb, currentColor var(--u-table-hover-opacity), transparent);
    background-color: var(--_row-tint);
  }

  .group-column {
    width: var(--_group-column-width);
    min-width: var(--_group-column-width);
  }

  /*
   * Colunas fixas e recuos de grupo: sticky na rolagem horizontal. Precisam de
   * fundo opaco (a cor da linha por cima do fundo do grid) e desenham as
   * próprias linhas, que o fundo cobriria.
   */
  .fixed,
  .sticky-cell {
    position: sticky;
    z-index: 1;
    box-shadow: var(--_col-line), var(--_row-line), var(--_edge-line), var(--_edge-shadow);
  }

  td.fixed,
  td.sticky-cell {
    background: linear-gradient(var(--_row-tint), var(--_row-tint)) var(--_background-color);
  }

  th.fixed,
  th.sticky-cell {
    background-color: var(--u-grid-header-background-color, var(--_background-color));
  }

  .row-lines tr:not(.last):not(:last-child) > :is(.fixed, .sticky-cell),
  tr:has(+ .group-row) > :is(.fixed, .sticky-cell),
  .group-row > .sticky-cell,
  thead :is(.fixed, .sticky-cell) {
    --_row-line: inset 0 calc(var(--_row-lines-height) * -1) 0 0 var(--_border-color);
  }

  /* Borda do bloco fixo: linha sempre; sombra só com conteúdo rolado por baixo. */
  .fixed-start-edge {
    --_edge-line: inset calc(var(--_column-lines-width) * -1 * var(--_dir)) 0 0 0 var(--_border-color);
  }

  .fixed-end-edge {
    --_edge-line: inset calc(var(--_column-lines-width) * var(--_dir)) 0 0 0 var(--_border-color);
  }

  .scroll-start .fixed-start-edge {
    --_edge-shadow: calc(6px * var(--_dir)) 0 6px -4px var(--_fixed-shadow-color);
  }

  .scroll-end .fixed-end-edge {
    --_edge-shadow: calc(-6px * var(--_dir)) 0 6px -4px var(--_fixed-shadow-color);
  }

  .sortable-ghost ~ .swap-target::after {
    inset-inline-start: initial;
    inset-inline-end: 0;
  }

  .move-container {
    --u-elevation-level: 1;
    position: fixed;
    background-color: var(--u-color-surface-container);
    border-radius: 4px;
    z-index: 2000;
    --_level: 1;
    --_shadow-color: var(--u-color-shadow, rgb(0, 0, 0));
  }

  .move-container::before, .move-container::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    transition: box-shadow 150ms ease-in-out;
  }

  .move-container::before {
    box-shadow: 0 calc(1px * (clamp(0, var(--_level), 1) + clamp(0, var(--_level) - 3, 1) + 2 * clamp(0, var(--_level) - 4, 1))) calc(1px * (2 * clamp(0, var(--_level), 1) + clamp(0, var(--_level) - 2, 1) + clamp(0, var(--_level) - 4, 1))) 0 var(--_shadow-color);
    opacity: 0.3;
  }

  .move-container::after {
    box-shadow: 0 calc(1px * (clamp(0, var(--_level), 1) + clamp(0, var(--_level) - 1, 1) + 2 * clamp(0, var(--_level) - 2, 3))) calc(1px * (3 * clamp(0, var(--_level), 2) + 2 * clamp(0, var(--_level) - 2, 3))) calc(1px * (clamp(0, var(--_level), 4) + 2 * clamp(0, var(--_level) - 4, 1))) var(--_shadow-color);
    opacity: 0.15;
  }

  .group-column-toggle {
    font-size: 24px;
    padding: 0;
    padding-inline-start: 8px;
    color: var(--u-grid-toggle-color, var(--u-color-on-surface-variant, rgb(73, 69, 79)));
  }

  .group-toggle {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    cursor: pointer;
    border-radius: var(--u-grid-toggle-shape, 50%);
  }

  .group-toggle:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  :host(:dir(rtl)) .group-column-toggle:not(.expanded) .toggle-icon {
    transform: scaleX(-1);
  }

  .toggle-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .expanded .toggle-icon {
    transform: rotateZ(90deg);
    transform-origin: center;
  }

  .header-column {
    position: relative;
    white-space: nowrap;
    overflow: hidden;
    user-select: none;
    touch-action: none;
  }

  .header-column.fixed {
    position: sticky;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    inset-inline-end: 0;
    width: var(--_resize-handle-width);
    cursor: col-resize;
    touch-action: none;
    z-index: 1;
  }

  .resize-handle::after {
    content: "";
    position: absolute;
    top: 25%;
    bottom: 25%;
    inset-inline-end: calc(var(--_resize-handle-width) / 2 - 1px);
    width: 2px;
    border-radius: 1px;
    background-color: currentColor;
    opacity: 0;
    transition: opacity 120ms;
  }

  .header-column:hover .resize-handle::after,
  .resize-handle:focus-visible::after,
  .resizing .resize-handle:active::after {
    opacity: 0.5;
  }

  .resize-handle:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  .container.resizing {
    cursor: col-resize;
    user-select: none;
  }

  .header-text {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    min-width: 1px;
  }

  /* inline: o \`text-align\` do <th> (alinhamento da coluna, RTL) posiciona o conteúdo. */
  .header-content {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    vertical-align: middle;
  }

  .header-column.sortable,
  .group.sortable {
    cursor: pointer;
  }

  .header-column.sorted {
    color: var(--u-grid-sorted-header-color, currentColor);
  }

  .header-column:focus-visible,
  .group:focus-visible {
    outline: var(--u-grid-focus-ring-width, 2px) solid var(--u-grid-focus-ring-color, var(--u-color-primary, rgb(103, 80, 164)));
    outline-offset: -2px;
  }

  .sort-indicator {
    display: inline-flex;
    align-items: center;
    flex: none;
    font-size: var(--u-grid-sort-indicator-size, 1.125em);
  }

  .sort-indicator.desc svg {
    transform: rotate(180deg);
  }

  .sort-indicator[data-sort-index]::after {
    content: attr(data-sort-index);
    font-size: 0.6875rem;
    line-height: 1;
    margin-inline-start: 1px;
  }

  .group .sort-indicator {
    margin-inline-start: 4px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .grouping-cell {
    color: color-mix(in srgb, currentColor var(--u-grid-grouping-cell-emphasis, 80%), transparent);
    /* clip (não hidden): não vira contêiner de rolagem e o rótulo fica sticky. */
    overflow: clip;
  }

  .grouping-label {
    position: sticky;
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: top;
  }

  .header {
    position: sticky;
    top: 0;
    inset-inline-start: 0;
    background-color: var(--u-grid-header-background-color, var(--_background-color));
    display: flex;
    align-items: center;
    padding: var(--_header-padding);
    height: var(--_header-height);
    z-index: 1;
  }

  .drag-here {
    line-height: var(--u-title-s-line-height);
    font-size: var(--u-title-s-font-size);
    letter-spacing: var(--u-title-s-letter-spacing);
    font-weight: var(--u-title-s-font-weight);
    display: flex;
    align-items: center;
    height: 100%;
    flex: 1;
    color: color-mix(in srgb, currentColor var(--u-low-emphasis-opacity, 75%), transparent);
  }

  .group-end-dropzone {
    display: flex;
    align-items: center;
    height: 100%;
    flex: 1;
    order: 9999;
  }

  .header + table thead {
    top: var(--_header-height);
  }

  .column-chooser-button {
    all: unset;
    box-sizing: border-box;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-inline-start: auto;
    border-radius: 50%;
    font-size: 24px;
    cursor: pointer;
    color: var(--u-grid-toggle-color, var(--u-color-on-surface-variant, rgb(73, 69, 79)));
  }

  .column-chooser-button:hover,
  .column-chooser-button[aria-expanded="true"] {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .column-chooser-button:focus-visible,
  .column-chooser-pin:focus-visible,
  .column-chooser-check input:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: 2px;
  }

  .column-chooser {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    min-width: 240px;
    max-width: min(320px, calc(100vw - 16px));
    max-height: min(420px, calc(100vh - 16px));
    overflow: auto;
    padding: 4px 0 8px;
    border: none;
    border-radius: var(--u-grid-column-chooser-shape, var(--u-shape-corner-medium, 12px));
    background-color: var(--u-grid-column-chooser-background-color, var(--u-color-surface-container, rgb(243, 237, 247)));
    color: var(--u-color-on-surface, rgb(29, 27, 32));
    box-shadow: 0 2px 6px 2px color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 15%, transparent), 0 1px 2px color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 30%, transparent);
    font: inherit;
    z-index: 2100;
  }

  .column-chooser-title {
    padding: 12px 16px 8px;
    font-size: var(--u-title-s-font-size, 0.875rem);
    font-weight: var(--u-title-s-font-weight, var(--u-font-weight-medium, 500));
  }

  .column-chooser-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .column-chooser-item {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 40px;
    padding-inline: 16px 8px;
  }

  .column-chooser-check {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .column-chooser-check span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .column-chooser-check input {
    flex: none;
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--u-color-primary, rgb(103, 80, 164));
  }

  .column-chooser-pin {
    all: unset;
    box-sizing: border-box;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 18px;
    cursor: pointer;
    opacity: 0.55;
  }

  .column-chooser-pin:hover {
    opacity: 1;
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .column-chooser-pin[aria-pressed="true"] {
    opacity: 1;
    color: var(--u-color-primary, rgb(103, 80, 164));
    background-color: color-mix(in srgb, currentColor 12%, transparent);
  }

  :host(:dir(rtl)) .column-chooser-pin svg {
    transform: scaleX(-1);
  }

  .column-chooser-drop-hint {
    display: none;
  }

  .column-chooser.drop-target .column-chooser-drop-hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--u-color-primary, rgb(103, 80, 164));
    border-radius: inherit;
    background-color: color-mix(in srgb, var(--u-grid-column-chooser-background-color, var(--u-color-surface-container, rgb(243, 237, 247))) 85%, transparent);
    font-weight: var(--u-font-weight-medium, 500);
  }
`;
