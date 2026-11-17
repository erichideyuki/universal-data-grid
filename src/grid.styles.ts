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

  .stripped .even {
    background-color: var(--_stripped-background-color);
  }

  thead {
    position: sticky;
    top: 0;
    background-color: var(--u-grid-header-background-color, var(--_background-color));
    z-index: 1;
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

  td, th {
    max-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
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

  .column-lines td:not(.group-column):not(:last-child),
  .column-lines th:not(.group-column):not(:last-child) {
    box-shadow: inset calc(var(--_column-lines-width) * -1) 0 0 0 var(--_border-color);
  }

  .column-lines .header,
  .group-row,
  thead,
  .row-lines tr:not(.last):not(:last-child),
  tr:has(+ .group-row) {
    box-shadow: inset 0 calc(var(--_row-lines-height) * -1) 0 0 var(--_border-color);
  }

  .hover tr:hover {
    background-color: color-mix(in srgb, currentColor var(--u-table-hover-opacity), transparent);
  }

  .group-column {
    width: 32px;
    min-width: 32px;
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
    outline: var(--u-grid-focus-ring-width, 2px) solid var(--u-grid-focus-ring-color, var(--u-color-primary, rgb(103, 80, 164)));
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
    white-space: nowrap;
    overflow: hidden;
    user-select: none;
    touch-action: none;
  }

  .header-text {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    min-width: 1px;
  }

  .grouping-cell {
    color: color-mix(in srgb, currentColor var(--u-grid-grouping-cell-emphasis, 80%), transparent);
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
`;
