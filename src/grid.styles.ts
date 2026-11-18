import { css } from 'lit';

export const styles = css`
  * {
    box-sizing: border-box;
  }

  :host {
    display: block;
    height: 100%;
    /* Cor do texto própria (spec 17, A4): numa página escura sem tema, não herda texto claro sobre o fundo claro do grid. */
    color: var(--u-grid-color, var(--u-color-on-surface, rgb(29, 27, 32)));
    --_background-color: var(--u-grid-background-color, var(--u-color-surface-container-lowest, rgb(255, 255, 255)));
    /* Nomes antigos (antes da spec 15) seguem como fallback dos novos. */
    --_striped-background-color: var(--u-grid-striped-background-color, var(--u-grid-stripped-background-color, color-mix(in srgb, var(--u-color-surface-container, rgb(243, 237, 247)) 80%, transparent)));
    --_border-color: color-mix(in srgb, currentColor var(--u-grid-line-opacity, var(--u-grid-border-opacity, 20%)), transparent);
    --_borders-width: var(--u-grid-line-width, var(--u-grid-borders-width, 1px));
    --_cell-block-padding: var(--u-grid-cell-block-padding, var(--u-table-cell-block-padding, 13px));
    --_cell-inline-padding: var(--u-grid-cell-inline-padding, var(--u-table-cell-inline-padding, 16px));
    --_cell-padding: var(--u-table-cell-padding, var(--_cell-block-padding) var(--_cell-inline-padding));
    --_header-padding: var(--u-grid-toolbar-padding, var(--u-table-header-padding, var(--u-grid-toolbar-block-padding, var(--u-table-header-block-padding, 8px)) var(--u-grid-toolbar-inline-padding, var(--u-table-header-inline-padding, var(--_cell-inline-padding)))));
    --_column-lines-width: var(--u-grid-column-line-width, var(--u-grid-column-lines-width, var(--_borders-width)));
    --_drop-indicator-width: var(--u-grid-drop-indicator-width, 3px);
    --_drop-indicator-color: var(--u-grid-drop-indicator-color, var(--u-grid-drop-indicator-bg, var(--u-color-primary, rgb(103, 80, 164))));
    --_row-lines-height: var(--u-grid-row-line-width, var(--u-grid-row-lines-height, var(--_borders-width)));
    --_header-height: var(--u-grid-toolbar-height, var(--u-grid-header-height, 56px));
    /* Ícones, bordas de caixas e placeholder: sem o tema, derivam da cor do texto (página escura; spec 17). */
    --_variant-color: var(--u-color-on-surface-variant, color-mix(in srgb, currentColor 80%, transparent));
    --_toggle-color: var(--u-grid-group-toggle-color, var(--u-grid-toggle-color, var(--_variant-color)));
    --_row-hover-opacity: var(--u-grid-row-hover-opacity, var(--u-table-hover-opacity, var(--u-state-layer-hover-opacity, 8%)));
    --_group-column-width: 32px;
    --_dir: 1;
    --_resize-handle-width: var(--u-grid-resize-handle-width, 24px);
    --_fixed-shadow-color: var(--u-grid-fixed-shadow-color, color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 22%, transparent));
    --_focus-ring: var(--u-grid-focus-ring-width, 2px) solid var(--u-grid-focus-ring-color, var(--u-color-primary, rgb(103, 80, 164)));
    --_selection-column-width: 48px;
    --_detail-toggle-width: 40px;
    --_selected-row-color: var(--u-grid-selected-row-background-color, color-mix(in srgb, var(--u-color-primary, rgb(103, 80, 164)) 12%, transparent));
  }

  :host(:dir(rtl)) {
    --_dir: -1;
  }

  .layout {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .layout > .container {
    flex: 1;
    min-height: 0;
  }

  /* Esperando o estado salvo (frente 11): nada do layout padrão aparece nem
     recebe foco/gesto até ele entrar; só o painel de carga. */
  .layout.state-loading .scroll-container,
  .layout.state-loading .pager {
    visibility: hidden;
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
    background-color: var(--_drop-indicator-color);
    width: var(--_drop-indicator-width);
    z-index: 20;
  }

  .container:has(.header).drop-target::after {
    top: var(--_toolbar-offset, var(--_header-height));
  }

  .scroll-container {
    height: 100%;
    overflow: auto;
  }

  /* Quebra linha em telas estreitas (WCAG 1.4.10, spec 17 A9). */
  .group-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-self: stretch;
    flex: 1 1 200px;
    gap: 8px;
    /* O que a barra reserva ao painel antes de recolher botões no "mais" (frente 18). */
    min-width: min(120px, 100%);
  }

  .group-container.drop-target::before {
    content: "";
    width: 3px;
    height: 100%;
    background-color: var(--_drop-indicator-color);
    order: var(--_drop-indicator-order, 0);
  }

  .group {
    line-height: var(--u-grid-group-chip-line-height, var(--u-group-label-line-height, var(--u-label-l-line-height, 1.25rem)));
    font-size: var(--u-grid-group-chip-font-size, var(--u-group-label-font-size, var(--u-label-l-font-size, 0.875rem)));
    letter-spacing: var(--u-grid-group-chip-letter-spacing, var(--u-group-label-letter-spacing, var(--u-label-l-letter-spacing, 0.0071428571rem)));
    font-weight: var(--u-grid-group-chip-font-weight, var(--u-group-label-font-weight, var(--u-label-l-font-weight, var(--u-font-weight-medium, 500))));
    display: flex;
    align-items: center;
    height: var(--u-grid-group-chip-height, var(--u-group-height, 32px));
    border: var(--u-grid-group-chip-outline-width, var(--u-group-outline-width, 1px)) solid var(--u-grid-group-chip-outline-color, var(--u-group-outline-color, var(--u-color-outline, rgb(121, 116, 126))));
    border-radius: var(--u-grid-group-chip-shape, var(--u-group-shape, var(--u-shape-corner-small, 8px)));
    padding-inline: var(--u-grid-group-chip-padding, var(--u-group-padding, 16px));
    order: var(--_order);
    user-select: none;
    touch-action: none;
  }

  tr:where(.grid-table > * > *) {
    --_row-tint: transparent;
  }

  .striped .even {
    --_row-tint: var(--_striped-background-color);
    background-color: var(--_row-tint);
  }

  thead:where(.grid-table > *) {
    position: sticky;
    top: 0;
    background-color: var(--u-grid-header-background-color, var(--_background-color));
    z-index: 2;
  }

  table:where(.grid-table) {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  /* Todas as larguras definidas: a tabela tem a soma exata e não estica. */
  table:where(.grid-table).fit {
    min-width: 0;
  }

  td:where(.grid-table > * > * > *), th:where(.grid-table > * > * > *) {
    max-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    --_col-line: 0 0 transparent;
    --_row-line: 0 0 transparent;
    --_edge-line: 0 0 transparent;
    --_edge-shadow: 0 0 transparent;
  }

  td:where(.grid-table > * > * > *) {
    border-collapse: separate;
    padding: var(--u-grid-cell-padding, var(--u-grid-data-cell-padding, var(--_cell-padding)));
    font-size: var(--u-grid-cell-font-size, var(--u-td-font-size, 0.875rem));
    font-weight: var(--u-grid-cell-font-weight, var(--u-td-font-weight));
    text-align: start;
  }

  th:where(.grid-table > * > * > *) {
    height: var(--u-grid-header-cell-height, 46px);
    padding: var(--u-grid-header-cell-padding, var(--_cell-padding));
    font-size: var(--u-grid-header-cell-font-size, var(--u-th-font-size, 0.8125rem));
    font-weight: var(--u-grid-header-cell-font-weight, var(--u-th-font-weight));
    color: color-mix(in srgb, currentColor var(--u-low-emphasis-opacity, 75%), transparent);
    text-align: start;
  }

  /* Alinhamento lógico: \`end\` vai para a esquerda em RTL. */
  td:where(.grid-table > * > * > *).align-center, th:where(.grid-table > * > * > *).align-center {
    text-align: center;
  }

  td:where(.grid-table > * > * > *).align-end, th:where(.grid-table > * > * > *).align-end {
    text-align: end;
  }

  .boolean-icon {
    display: inline-flex;
    vertical-align: middle;
  }

  .boolean-icon.false {
    color: color-mix(in srgb, currentColor var(--u-low-emphasis-opacity, 60%), transparent);
  }

  td:where(.grid-table > * > * > *).wrap {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .column-lines td:where(.grid-table > * > * > *):not(.group-column):not(:last-child),
  .column-lines th:where(.grid-table > * > * > *):not(.group-column):not(:last-child) {
    --_col-line: inset calc(var(--_column-lines-width) * -1 * var(--_dir)) 0 0 0 var(--_border-color);
    box-shadow: var(--_col-line), var(--_row-line), var(--_edge-line), var(--_edge-shadow);
  }

  .column-lines .header,
  .group-row,
  thead:where(.grid-table > *),
  .row-lines tr:where(.grid-table > * > *):not(.last):not(:last-child),
  tr:where(.grid-table > * > *):has(+ .group-row) {
    box-shadow: inset 0 calc(var(--_row-lines-height) * -1) 0 0 var(--_border-color);
  }

  /* Espaçadora do virtualizador (altura até a 1ª linha da janela): sem linha nem borda. */
  tr:where(.grid-table > * > *).spacer {
    box-shadow: none;
  }

  /* Realce da linha de dados sob o ponteiro (\`--u-grid-row-hover-opacity: 0%\` desliga). */
  tbody:where(.grid-table > *) tr:where(.grid-table > * > *)[role=row]:not(.group-row):not(.summary-row):not(.detail-row):hover {
    --_row-tint: color-mix(in srgb, currentColor var(--_row-hover-opacity), transparent);
    background-color: var(--_row-tint);
  }

  .group-column {
    width: var(--_group-column-width);
    min-width: var(--_group-column-width);
  }

  /* Linha selecionada (depois do realce do ponteiro: a seleção vence). */
  tbody:where(.grid-table > *) tr:where(.grid-table > * > *)[role=row].selected:not(.group-row) {
    --_row-tint: var(--_selected-row-color);
    background-color: var(--_row-tint);
  }

  /*
   * Seleção não só por cor (WCAG 1.4.1, spec 17 A2): barra no início da 1ª
   * célula da linha selecionada (dentro da cadeia de box-shadow da célula).
   */
  tbody tr[role=row].selected:not(.group-row) > td:first-child {
    --_select-line: inset calc(var(--u-grid-selected-row-indicator-width, 3px) * var(--_dir)) 0 0 0 var(--u-grid-selected-row-indicator-color, var(--u-color-primary, rgb(103, 80, 164)));
    box-shadow: var(--_select-line), var(--_col-line), var(--_row-line), var(--_edge-line), var(--_edge-shadow);
  }

  /* Célula ativa do teclado (roving tabindex); o clique não mostra o anel. */
  td:where(.grid-table > * > * > *)[tabindex]:focus,
  th:where(.grid-table > * > * > *)[tabindex]:focus {
    outline: none;
  }

  td:where(.grid-table > * > * > *)[tabindex]:focus-visible,
  th:where(.grid-table > * > * > *)[tabindex]:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: calc(var(--u-grid-focus-ring-width, 2px) * -1);
  }

  /*
   * Linha da célula ativa fora da janela virtual: fica no DOM (o foco não se
   * perde ao rolar) mas fora do fluxo e invisível.
   */
  tbody:where(.grid-table > *) tr:where(.grid-table > * > *).pinned {
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    height: 1px !important;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .selection-column,
  .selection-cell {
    width: var(--_selection-column-width);
    min-width: var(--_selection-column-width);
  }

  .selection-cell {
    padding: 0;
    text-align: center;
    cursor: pointer;
  }

  /* Master-detail: coluna de expansão e linha de detalhe de largura total. */
  .detail-toggle-column,
  .detail-toggle-cell {
    width: var(--_detail-toggle-width);
    min-width: var(--_detail-toggle-width);
  }

  .detail-toggle-cell {
    padding: 0;
    font-size: 24px;
    color: var(--_toggle-color);
  }

  .detail-toggle {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 24px;
    cursor: pointer;
    border-radius: var(--u-grid-group-toggle-shape, var(--u-grid-toggle-shape, 50%));
  }

  .detail-toggle:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  /*
   * Conteúdo do detalhe na largura da área visível (WCAG 1.4.10): preso ao
   * início na rolagem horizontal de uma tabela larga.
   */
  .detail-content {
    position: sticky;
    inset-inline-start: var(--_cell-inline-padding);
    max-inline-size: calc(var(--_viewport-inline-size, 100%) - 2 * var(--_cell-inline-padding));
  }

  :host(:dir(rtl)) tr:where(.grid-table > * > *):not(.expanded) > .detail-toggle-cell .toggle-icon {
    transform: scaleX(-1);
  }

  td:where(.grid-table > * > * > *).detail-cell {
    white-space: normal;
  }

  .selection-checkbox {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: 2px solid var(--_variant-color);
    border-radius: 2px;
    vertical-align: middle;
    color: var(--u-color-on-primary, rgb(255, 255, 255));
  }

  .selection-checkbox svg {
    visibility: hidden;
  }

  .selection-checkbox:is([aria-checked="true"], [aria-checked="mixed"]) {
    border-color: var(--u-color-primary, rgb(103, 80, 164));
    background-color: var(--u-color-primary, rgb(103, 80, 164));
  }

  .selection-checkbox:is([aria-checked="true"], [aria-checked="mixed"]) svg {
    visibility: visible;
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

  td:where(.grid-table > * > * > *).fixed,
  td:where(.grid-table > * > * > *).sticky-cell {
    background: linear-gradient(var(--_row-tint), var(--_row-tint)) var(--_background-color);
  }

  th:where(.grid-table > * > * > *).fixed,
  th:where(.grid-table > * > * > *).sticky-cell {
    background-color: var(--u-grid-header-background-color, var(--_background-color));
  }

  .row-lines tr:where(.grid-table > * > *):not(.last):not(:last-child) > :is(.fixed, .sticky-cell),
  tr:where(.grid-table > * > *):has(+ .group-row) > :is(.fixed, .sticky-cell),
  .group-row > .sticky-cell,
  thead:where(.grid-table > *) :is(.fixed, .sticky-cell) {
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
    background-color: var(--u-color-surface-container, rgb(243, 237, 247));
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
    color: var(--_toggle-color);
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
    border-radius: var(--u-grid-group-toggle-shape, var(--u-grid-toggle-shape, 50%));
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

  .header-column.fixed,
  .band-header.fixed {
    position: sticky;
  }

  /*
   * Banda (frente 13): o rótulo quebra linha (WCAG 1.4.12) e os limites
   * (fim e base) ficam sempre visíveis, com ou sem \`show-column-lines\`.
   */
  th:where(.grid-table > * > * > *).band-header {
    position: relative;
    /* \`clip\` (não \`hidden\`): não vira contêiner de rolagem e o rótulo \`sticky\` segue a área visível. */
    overflow: clip;
    white-space: normal;
    overflow-wrap: anywhere;
    user-select: none;
    touch-action: none;
    --_col-line: inset calc(var(--_column-lines-width) * -1 * var(--_dir)) 0 0 0 var(--_border-color);
    --_row-line: inset 0 calc(var(--_row-lines-height) * -1) 0 0 var(--_border-color);
    box-shadow: var(--_col-line), var(--_row-line), var(--_edge-line), var(--_edge-shadow);
  }

  .band-header .header-text {
    white-space: normal;
  }

  /*
   * O rótulo da banda fica na parte visível dela (banda larga com colunas
   * fora da tela, virtualização): preso entre as áreas fixas do início e do fim.
   */
  .band-header:not(.fixed) > .header-content {
    position: sticky;
    inset-inline-start: calc(var(--_fixed-start, 0px) + var(--_cell-inline-padding, 16px));
    inset-inline-end: calc(var(--_fixed-end, 0px) + var(--_cell-inline-padding, 16px));
  }

  /* Colunas fora do DOM (virtualização de colunas): só ocupam a largura. */
  :where(.grid-table) .column-spacer {
    padding: 0;
    box-shadow: none;
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

  /* Alvo de 24px (WCAG 2.5.8, spec 17 A3): o \`th\` reserva o espaço da alça no fim. */
  .header-column:has(> .resize-handle) {
    padding-inline-end: max(var(--_cell-inline-padding), var(--_resize-handle-width));
  }

  /* Barra junto à borda da coluna; opaca no hover/foco (≥ 3:1, WCAG 1.4.11). */
  .resize-handle::after {
    content: "";
    position: absolute;
    top: 25%;
    bottom: 25%;
    inset-inline-end: 1px;
    width: 2px;
    border-radius: 1px;
    background-color: var(--u-grid-resize-handle-color, var(--_toggle-color));
    opacity: 0;
    transition: opacity 120ms;
  }

  .header-column:hover .resize-handle::after,
  .resize-handle:focus-visible::after,
  .resizing .resize-handle:active::after {
    opacity: 1;
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
  .band-header:focus-visible,
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

  /* Só leva o \`lang\` dos textos da i18n (spec 17); não muda o layout. */
  .lang-scope {
    display: contents;
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
    color: color-mix(in srgb, currentColor var(--u-grid-group-row-emphasis, var(--u-grid-grouping-cell-emphasis, 80%)), transparent);
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
    flex-wrap: wrap;
    gap: 8px 0;
    padding: var(--_header-padding);
    /* \`--u-grid-toolbar-height\` é a altura mínima: a barra cresce ao quebrar linha. */
    min-height: var(--_header-height);
    z-index: 1;
  }

  .drag-here {
    line-height: var(--u-title-s-line-height);
    font-size: var(--u-title-s-font-size);
    letter-spacing: var(--u-title-s-letter-spacing);
    font-weight: var(--u-title-s-font-weight);
    display: flex;
    align-items: center;
    min-height: 32px;
    flex: 1;
    color: color-mix(in srgb, currentColor var(--u-low-emphasis-opacity, 75%), transparent);
  }

  .group-end-dropzone {
    display: flex;
    align-items: center;
    align-self: stretch;
    min-width: 24px;
    flex: 1;
    order: 9999;
  }

  .header + table:where(.grid-table) thead:where(.grid-table > *) {
    top: var(--_toolbar-offset, var(--_header-height));
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
    border-radius: 50%;
    font-size: 24px;
    cursor: pointer;
    color: var(--_toggle-color);
  }

  /*
   * Barra de ferramentas (frente 18): o roving (\`role="toolbar"\`) ocupa o
   * espaço entre os avulsos (busca, conteúdo do hospedeiro); os botões que não
   * cabem vão ao "mais". DOM na ordem visual (RTL só inverte as setas).
   */
  .toolbar-roving {
    display: flex;
    /* Largura dada pelo espaço (não pelo conteúdo): é o que a medida do "mais" usa. */
    flex: 1 1 200px;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: min(200px, 100%);
  }

  .toolbar-content {
    display: flex;
    align-items: center;
    flex: none;
    margin-inline-start: 8px;
  }

  .toolbar-button {
    all: unset;
    box-sizing: border-box;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 24px;
    min-height: 32px;
    padding-inline: 10px;
    border-radius: 16px;
    cursor: pointer;
    color: var(--u-color-primary, rgb(103, 80, 164));
    font-size: 0.875rem;
    font-weight: var(--u-font-weight-medium, 500);
    white-space: nowrap;
  }

  .toolbar-button.icon-only,
  .toolbar-button.column-chooser-button,
  .toolbar-button.export-button {
    width: auto;
    min-width: 40px;
    height: 40px;
    padding-inline: 8px;
    border-radius: 20px;
    color: var(--_toggle-color);
  }

  .toolbar-button.icon-only {
    width: 40px;
    padding: 0;
  }

  .toolbar-button:not([aria-disabled="true"]):hover,
  .toolbar-button[aria-expanded="true"] {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .toolbar-button:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  /* Desabilitado: o botão inteiro (ícone e texto) a 38%, como no Material — não só o matiz (WCAG 1.4.1). */
  .toolbar-button[aria-disabled="true"] {
    cursor: default;
    opacity: 0.38;
  }

  .toolbar-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-more-button::before {
    content: "";
    width: 24px;
    height: 24px;
    background-color: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z'/%3E%3C/svg%3E") center / contain no-repeat;
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

  /* Banda no seletor (frente 13): as colunas dela numa lista aninhada, recuada. */
  .column-chooser-band {
    flex-wrap: wrap;
  }

  .column-chooser-nested {
    flex-basis: 100%;
    margin: 0;
    padding: 0;
    padding-inline-start: 16px;
  }

  .column-chooser-nested .column-chooser-item {
    padding-inline-end: 0;
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

  /* ------------------------------------------------------------- resumos */

  /* Fundo opaco: o rodapé fixo cobre as linhas que rolam por baixo. */
  .summary-row {
    --_summary-background: var(--u-grid-summary-background-color, var(--u-grid-header-background-color, var(--_background-color)));
    background-color: var(--_summary-background);
  }

  .summary-row > td:where(.grid-table > * > * > *).fixed,
  .summary-row > td:where(.grid-table > * > * > *).sticky-cell {
    background: var(--_summary-background);
  }

  .summary-cell {
    font-weight: var(--u-grid-summary-cell-font-weight, var(--u-font-weight-medium, 500));
  }

  /* Na linha virtual a altura é fixa: vários resumos da mesma coluna lado a lado. */
  .summary-item + .summary-item {
    margin-inline-start: 12px;
  }

  /* No rodapé de totais (fora do virtualizador) um por linha, como na referência. */
  .total-footer .summary-item {
    display: block;
  }

  .total-footer .summary-item + .summary-item {
    margin-inline-start: 0;
  }

  .total-footer {
    position: sticky;
    bottom: 0;
    z-index: 2;
  }

  .total-row {
    box-shadow: inset 0 var(--_row-lines-height) 0 0 var(--_border-color);
  }

  .group-info {
    opacity: 0.8;
  }

  /* --------------------------------- menus: contexto e barra (motor único, frente 18) */

  .grid-menu {
    position: fixed;
    inset: auto;
    margin: 0;
    min-width: 200px;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    padding: 8px 0;
    border: none;
    border-radius: var(--u-grid-menu-shape, var(--u-shape-corner-extra-small, 4px));
    background-color: var(--u-grid-menu-background-color, var(--u-color-surface-container, rgb(243, 237, 247)));
    color: var(--u-color-on-surface, rgb(29, 27, 32));
    box-shadow: 0 2px 6px 2px color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 15%, transparent), 0 1px 2px color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 30%, transparent);
    font: inherit;
    z-index: 2100;
  }

  .group-panel-menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 40px;
    padding-inline: 16px;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .group-panel-menu-item:hover,
  .group-panel-menu-item:focus-visible {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .group-panel-menu-item:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  /* Item que não se aplica agora (limite do bloco): focável pelas setas, sem efeito. */
  .group-panel-menu-item[aria-disabled="true"] {
    cursor: default;
    color: color-mix(in srgb, currentColor 50%, transparent);
  }

  .group-panel-menu-item[aria-disabled="true"]:hover {
    background: none;
  }

  /*
   * Toque longo (frente 18): sem o balão nativo do iOS (seleção/"copiar") por
   * cima do menu do grid, só onde há menu.
   */
  .grid-table[data-row-menu] > tbody > tr > td,
  .grid-table > thead th,
  .group {
    -webkit-touch-callout: none;
  }

  .menu-separator {
    height: 0;
    margin-block: 8px;
    border-block-start: 1px solid var(--_border-color);
  }

  /* Toque: alvos maiores nos menus (WCAG 2.5.8 já atende com 40px; 48px é o do Material). */
  @media (pointer: coarse) {
    .menu-item {
      min-height: 48px;
    }
  }

  /*
   * Botão "⋮" do menu do cabeçalho (spec 17, A1): no fluxo, depois do funil
   * (não cobre a seta nem o funil); aparece no hover/foco e fica sempre
   * visível em telas de toque. Alvo de 24px (WCAG 2.5.8).
   */
  .column-header-menu-button {
    all: unset;
    box-sizing: border-box;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 1.125rem;
    cursor: pointer;
    color: var(--_toggle-color);
    opacity: 0;
  }

  .column-header-menu-button::before {
    content: "";
    width: 1em;
    height: 1em;
    background-color: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  :is(.header-column, .band-header):hover .column-header-menu-button,
  :is(.header-column, .band-header):focus-within .column-header-menu-button,
  .column-header-menu-button[aria-expanded="true"] {
    opacity: 1;
  }

  .column-header-menu-button:hover,
  .column-header-menu-button[aria-expanded="true"] {
    background-image: linear-gradient(color-mix(in srgb, currentColor 8%, transparent), color-mix(in srgb, currentColor 8%, transparent));
  }

  .column-header-menu-button:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  @media (hover: none) {
    .column-header-menu-button {
      opacity: 1;
    }
  }

  /* ------------------------------------------------------------- filtro */

  .toolbar-spacer {
    flex: 1;
  }

  .search-panel {
    flex: 0 1 240px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 120px;
    height: 40px;
    margin-inline-start: 8px;
    padding-inline: 12px;
    border-radius: 20px;
    background-color: color-mix(in srgb, currentColor 6%, transparent);
    color: var(--_toggle-color);
  }

  .search-panel:focus-within {
    outline: var(--_focus-ring);
  }

  .search-icon {
    flex: none;
  }

  .search-input,
  .header-filter-search {
    all: unset;
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    height: 100%;
    font: inherit;
    font-size: 0.875rem;
    color: var(--u-color-on-surface, rgb(29, 27, 32));
  }

  /* Único rótulo visível do campo: ≥ 4,5:1 sobre o fundo do campo (WCAG 1.4.3, spec 17). */
  .search-input::placeholder,
  .header-filter-search::placeholder {
    color: var(--_variant-color);
    opacity: 1;
  }

  .search-highlight {
    background-color: var(--u-grid-search-highlight-background-color, color-mix(in srgb, var(--u-color-primary, rgb(103, 80, 164)) 24%, transparent));
    color: var(--u-grid-search-highlight-color, inherit);
    border-radius: 2px;
  }

  .filter-row > td:where(.grid-table > * > * > *) {
    height: var(--u-grid-filter-row-height, var(--u-grid-header-cell-height, 46px));
    padding: 4px 8px;
    font-weight: normal;
    vertical-align: middle;
  }

  .filter-cell-content {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .filter-operation-button,
  .header-filter-button,
  .header-filter-expand {
    all: unset;
    box-sizing: border-box;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--_toggle-color);
  }

  .filter-operation-button:hover,
  .filter-operation-button[aria-expanded="true"],
  .header-filter-button:hover,
  .header-filter-button[aria-expanded="true"],
  .header-filter-expand:hover {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .filter-operation-button:focus-visible,
  .header-filter-button:focus-visible,
  .header-filter-expand:focus-visible,
  .filter-editor:focus-visible,
  .filter-menu-item:focus-visible,
  .header-filter-actions button:focus-visible,
  .header-filter-check input:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: 1px;
  }

  /* Item de largura total num menu com \`overflow\`: o anel fica para dentro (não é cortado). */
  .filter-menu-item:focus-visible {
    outline-offset: -2px;
  }

  .filter-editor {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 32px;
    padding-inline: 8px;
    border: none;
    /* Limite do campo ≥ 3:1 (WCAG 1.4.11, spec 17); as linhas da grade (20%) não bastam. */
    border-bottom: 1px solid var(--u-color-outline, rgb(121, 116, 126));
    border-radius: 4px 4px 0 0;
    background-color: color-mix(in srgb, currentColor 4%, transparent);
    font: inherit;
    font-size: 0.875rem;
    color: inherit;
  }

  .filter-between {
    display: flex;
    flex: 1;
    gap: 4px;
    min-width: 0;
  }

  .filter-no-value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8125rem;
    opacity: 0.75;
  }

  .header-filter-button {
    width: 24px;
    height: 24px;
    margin-inline-start: 2px;
    font-size: 1rem;
    opacity: 0.6;
  }

  .header-column:hover .header-filter-button,
  .header-filter-button:focus-visible,
  .header-filter-button[aria-expanded="true"],
  .header-filter-button.active {
    opacity: 1;
  }

  .header-filter-button.active {
    color: var(--u-grid-header-filter-button-active-color, var(--u-color-primary, rgb(103, 80, 164)));
  }

  .filter-menu,
  .header-filter {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    border: none;
    color: var(--u-color-on-surface, rgb(29, 27, 32));
    box-shadow: 0 2px 6px 2px color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 15%, transparent), 0 1px 2px color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 30%, transparent);
    font: inherit;
    z-index: 2100;
  }

  .filter-menu {
    min-width: 200px;
    max-height: min(420px, calc(100vh - 16px));
    overflow: auto;
    padding: 8px 0;
    border-radius: var(--u-shape-corner-extra-small, 4px);
    background-color: var(--u-color-surface-container, rgb(243, 237, 247));
  }

  .filter-menu-item {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 40px;
    padding-inline: 12px 16px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .filter-menu-item:hover,
  .filter-menu-item:focus-visible {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .filter-menu-item[aria-checked="true"] {
    color: var(--u-color-primary, rgb(103, 80, 164));
    font-weight: var(--u-font-weight-medium, 500);
  }

  .filter-menu-glyph {
    display: inline-flex;
    justify-content: center;
    width: 24px;
  }

  .filter-menu-separator {
    height: 1px;
    margin: 8px 0;
    background-color: var(--_border-color);
  }

  .header-filter {
    display: flex;
    flex-direction: column;
    width: min(300px, calc(100vw - 16px));
    max-height: min(480px, calc(100vh - 16px));
    padding: 12px 0 8px;
    border-radius: var(--u-grid-header-filter-shape, var(--u-shape-corner-medium, 12px));
    background-color: var(--u-grid-header-filter-background-color, var(--u-color-surface-container, rgb(243, 237, 247)));
  }

  .header-filter-search {
    flex: none;
    height: 36px;
    margin: 0 16px 8px;
    padding-inline: 12px;
    border-radius: 18px;
    background-color: color-mix(in srgb, currentColor 6%, transparent);
  }

  .header-filter-search:focus-visible {
    outline: var(--_focus-ring);
  }

  .header-filter-select-all {
    padding-inline: 16px;
    border-bottom: 1px solid var(--_border-color);
  }

  .header-filter-list {
    flex: 1;
    overflow: auto;
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }

  /* Item da árvore (spec 17, A10): a linha inteira marca; a caixa é só visual. */
  .header-filter-item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 36px;
    padding-inline: calc(16px + var(--_level, 0) * 20px) 16px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .header-filter-item:hover {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .header-filter-item:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  .header-filter-box {
    box-sizing: border-box;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: 2px solid var(--_variant-color);
    border-radius: 2px;
    color: var(--u-color-on-primary, rgb(255, 255, 255));
  }

  .header-filter-item:is([aria-checked="true"], [aria-checked="mixed"]) .header-filter-box {
    border-color: var(--u-color-primary, rgb(103, 80, 164));
    background-color: var(--u-color-primary, rgb(103, 80, 164));
  }

  .header-filter-note {
    margin: 0;
    padding: 4px 16px;
    font-size: 0.75rem;
  }

  .header-filter-expand {
    margin-inline-start: -6px;
    margin-inline-end: -8px;
  }

  .header-filter-expand svg {
    transform: scaleX(var(--_dir));
  }

  .header-filter-expand.expanded svg {
    transform: rotate(90deg);
  }

  .header-filter-check {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
    min-height: 36px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .header-filter-check input {
    flex: none;
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--u-color-primary, rgb(103, 80, 164));
  }

  .header-filter-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-filter-count {
    flex: none;
    font-size: 0.75rem;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .header-filter-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px 0;
    border-top: 1px solid var(--_border-color);
  }

  .header-filter-spacer {
    flex: 1;
  }

  .header-filter-actions button {
    all: unset;
    box-sizing: border-box;
    height: 36px;
    padding-inline: 12px;
    border-radius: 18px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: var(--u-font-weight-medium, 500);
    color: var(--u-color-primary, rgb(103, 80, 164));
  }

  .header-filter-actions button:hover {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  /* ------------------------------------------------ preferências do usuário */

  @media (prefers-reduced-motion: reduce) {
    .move-container::before,
    .move-container::after,
    .resize-handle::after {
      transition: none;
    }
  }

  /*
   * Alto contraste (forced-colors, spec 17): fundos e box-shadow somem, então
   * seleção, realces, linhas da grade, bordas das fixas e estados ganham
   * cores do sistema ou bordas reais.
   */
  @media (forced-colors: active) {
    tbody tr[role=row].selected:not(.group-row) > td,
    .search-highlight {
      forced-color-adjust: none;
      background: Highlight;
      color: HighlightText;
    }

    thead,
    .row-lines tbody tr[role=row]:not(.last) > td,
    .group-row > td {
      border-block-end: 1px solid CanvasText;
    }

    th.band-header {
      border-inline-end: 1px solid CanvasText;
      border-block-end: 1px solid CanvasText;
    }

    .column-lines td:not(.group-column):not(:last-child),
    .column-lines th:not(.group-column):not(:last-child),
    .fixed-start-edge {
      border-inline-end: 1px solid CanvasText;
    }

    .fixed-end-edge {
      border-inline-start: 1px solid CanvasText;
    }

    .total-row > td {
      border-block-start: 1px solid CanvasText;
    }

    .container.drop-target::after,
    .group-container.drop-target::before,
    .resize-handle::after {
      forced-color-adjust: none;
      background-color: Highlight;
    }

    .header-filter-button.active,
    .column-chooser-pin[aria-pressed="true"],
    .column-chooser-button[aria-expanded="true"],
    .filter-menu-item[aria-checked="true"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }

    .column-chooser,
    .grid-menu,
    .filter-menu,
    .header-filter {
      border: 1px solid CanvasText;
    }

    .group-panel-menu-item[aria-disabled="true"],
    .toolbar-button[aria-disabled="true"] {
      color: GrayText;
    }

    .menu-item:focus-visible {
      forced-color-adjust: none;
      background: Highlight;
      color: HighlightText;
    }

    /* Desabilitado e focado: segue GrayText (o estado não some no foco). */
    .menu-item[aria-disabled="true"]:focus-visible {
      background: Canvas;
      color: GrayText;
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }

    .menu-separator {
      border-block-start-color: CanvasText;
    }

    .toolbar-button[aria-expanded="true"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }

    .column-header-menu-button::before,
    .toolbar-more-button::before {
      forced-color-adjust: none;
      background-color: ButtonText;
    }

    .header-filter-item:is([aria-checked="true"], [aria-checked="mixed"]) .header-filter-box {
      forced-color-adjust: none;
      border-color: Highlight;
      background-color: Highlight;
      color: HighlightText;
    }

    .selection-checkbox:is([aria-checked="true"], [aria-checked="mixed"]) {
      forced-color-adjust: none;
      border-color: Highlight;
      background-color: Highlight;
      color: HighlightText;
    }

    .load-panel,
    .error-row {
      border: 1px solid CanvasText;
    }

    .pager-button[aria-current="page"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }

    .pager-button[disabled] {
      color: GrayText;
    }

    .load-spinner {
      forced-color-adjust: none;
      border-block-start-color: Highlight;
    }

    .skeleton {
      forced-color-adjust: none;
      background-color: GrayText;
    }
  }

  /* ------------------------------------------------ fonte de dados (08) */


  .load-panel {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    transform: translate(calc(-50% * var(--_dir)), -50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-radius: 12px;
    background-color: var(--u-grid-load-panel-background-color, var(--u-color-surface-container-high, rgb(236, 230, 240)));
    color: var(--u-color-on-surface, rgb(29, 27, 32));
    box-shadow: 0 1px 3px color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 30%, transparent);
    font-size: 0.875rem;
    pointer-events: none;
  }

  .load-spinner {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid color-mix(in srgb, var(--u-color-primary, rgb(103, 80, 164)) 25%, transparent);
    border-block-start-color: var(--u-color-primary, rgb(103, 80, 164));
    animation: u-grid-spin 0.8s linear infinite;
  }

  @keyframes u-grid-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-row {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px var(--_cell-inline-padding);
    background-color: var(--u-color-error-container, rgb(249, 222, 220));
    color: var(--u-color-on-error-container, rgb(65, 14, 11));
    font-size: 0.875rem;
  }

  .retry-button,
  .pager-button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    height: 40px;
    padding-inline: 12px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: var(--u-font-weight-medium, 500);
  }

  .retry-button {
    color: inherit;
    text-decoration: underline;
  }

  .retry-button:hover,
  .pager-button:not([disabled]):hover {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .retry-button:focus-visible,
  .pager-button:focus-visible,
  .page-size select:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  .skeleton {
    display: block;
    height: 0.75em;
    width: 70%;
    border-radius: 4px;
    background-color: var(--u-grid-skeleton-row-color, color-mix(in srgb, currentColor 12%, transparent));
  }

  .pager {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
    min-height: var(--u-grid-pager-height, 56px);
    padding-inline: var(--_cell-inline-padding);
    background-color: var(--_background-color);
    border-block-start: var(--_borders-width) solid var(--_border-color);
    font-size: 0.875rem;
  }

  .page-size {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .page-size select {
    font: inherit;
    color: inherit;
    background-color: transparent;
    border: 1px solid var(--_variant-color);
    border-radius: 4px;
    padding: 4px 8px;
  }

  .page-info {
    flex: 1;
  }

  .pager-buttons {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .pager-button {
    padding-inline: 8px;
  }

  .pager-button[disabled] {
    cursor: default;
    opacity: 0.38;
  }

  /* Página atual: não só por cor (peso e sublinhado). */
  .pager-button[aria-current="page"] {
    background-color: color-mix(in srgb, var(--u-color-primary, rgb(103, 80, 164)) 12%, transparent);
    color: var(--u-color-primary, rgb(103, 80, 164));
    font-weight: 700;
    box-shadow: inset 0 -2px 0 currentColor;
  }

  :host(:dir(rtl)) .pager-arrow svg {
    transform: scaleX(-1);
  }

  @media (prefers-reduced-motion: reduce) {
    .load-spinner {
      animation: none;
    }
  }

  /* ------------------------------------------------------- edição (09) */

  td:where(.grid-table > * > * > *).editing {
    /* O editor ocupa a célula; a mensagem de erro sai por baixo dela. */
    padding-block: 4px;
    padding-inline: max(4px, calc(var(--_cell-inline-padding) - 8px));
    overflow: visible;
  }

  td:where(.grid-table > * > * > *).show-message {
    overflow: visible;
  }

  td.editing:not(.fixed):not(.sticky-cell),
  td.show-message:not(.fixed):not(.sticky-cell) {
    position: relative;
  }

  td.show-message > .cell-text {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cell-editor {
    box-sizing: border-box;
    width: 100%;
    min-height: 32px;
    padding-inline: 8px;
    border: none;
    /* Limite do campo de 3:1 ou mais (WCAG 1.4.11), como a linha de filtro. */
    border-bottom: 1px solid var(--u-color-outline, rgb(121, 116, 126));
    border-radius: 4px 4px 0 0;
    background-color: color-mix(in srgb, currentColor 4%, transparent);
    font: inherit;
    color: inherit;
    text-align: inherit;
  }

  .cell-editor:focus {
    outline: var(--_focus-ring);
    outline-offset: 1px;
  }

  .cell-editor[aria-invalid="true"] {
    border-bottom: 2px solid var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30)));
  }

  /* Caixa do booleano: alvo de 24 px (WCAG 2.5.8). */
  .cell-editor-checkbox {
    width: 24px;
    height: 24px;
    min-height: 24px;
    margin: 0;
    padding: 0;
    accent-color: var(--u-color-primary, rgb(103, 80, 164));
  }

  /* Célula alterada (lote): fundo + marca no canto (não só cor, WCAG 1.4.1). */
  td:where(.grid-table > * > * > *).modified {
    background-color: var(--u-grid-modified-cell-background-color, color-mix(in srgb, var(--u-color-primary, rgb(103, 80, 164)) 10%, transparent));
  }

  td.modified:not(.fixed):not(.sticky-cell) {
    position: relative;
  }

  /* Triângulo no canto final (bordas: espelha em RTL e sobrevive ao forced-colors). */
  td.modified::after {
    content: '';
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    border-block-start: 8px solid var(--u-grid-modified-cell-indicator-color, var(--u-color-primary, rgb(103, 80, 164)));
    border-inline-start: 8px solid transparent;
    pointer-events: none;
  }

  /* Linha nova: barra no início (não só o fundo). */
  tbody tr[role=row].added > td:first-child {
    box-shadow: inset calc(3px * var(--_dir)) 0 0 0 var(--u-grid-modified-cell-indicator-color, var(--u-color-primary, rgb(103, 80, 164))), var(--_col-line), var(--_row-line), var(--_edge-line), var(--_edge-shadow);
  }

  /* Célula inválida: borda de erro (cor + espessura). */
  td:where(.grid-table > * > * > *).invalid {
    outline: 2px solid var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30)));
    outline-offset: -2px;
  }

  /* Foco numa célula inválida: anel + faixa clara + borda de erro (o anel não encosta no vermelho). */
  td:where(.grid-table > * > * > *).invalid[tabindex]:focus-visible {
    outline: var(--_focus-ring);
    box-shadow:
      inset 0 0 0 4px var(--u-color-surface, #fff),
      inset 0 0 0 6px var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30))),
      var(--_col-line),
      var(--_row-line);
  }

  /* Mensagem visível e persistente abaixo da célula (acima, na última linha). */
  .validation-message {
    position: absolute;
    inset-block-start: 100%;
    inset-inline-start: 0;
    z-index: 4;
    min-width: 100%;
    max-width: max(100%, 320px);
    width: max-content;
    padding: 6px 10px;
    border-inline-start: 4px solid var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30)));
    border-radius: 0 0 4px 4px;
    background-color: var(--u-color-error-container, rgb(249, 222, 220));
    color: var(--u-color-on-error-container, rgb(65, 14, 11));
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.4;
    white-space: normal;
    text-align: start;
    text-decoration: none;
    box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
  }

  .validation-message[hidden] {
    display: none;
  }

  tr.last > td > .validation-message {
    inset-block-start: auto;
    inset-block-end: 100%;
    border-radius: 4px 4px 0 0;
  }

  .validating-spinner {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    margin-inline-end: 6px;
    vertical-align: -0.1em;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-block-start-color: transparent;
    animation: u-grid-edit-spin 0.9s linear infinite;
  }

  @keyframes u-grid-edit-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Linha nova e linha marcada para remoção (lote). */
  tbody:where(.grid-table > *) tr:where(.grid-table > * > *).added {
    background-color: var(--u-grid-added-row-background-color, color-mix(in srgb, var(--u-color-primary, rgb(103, 80, 164)) 6%, transparent));
  }

  tbody:where(.grid-table > *) tr:where(.grid-table > * > *).removed > td:not(.command-cell) {
    opacity: var(--u-grid-removed-row-opacity, 0.7);
    text-decoration: line-through;
  }

  /* Coluna dos botões da linha. */
  .command-column {
    width: 176px;
  }

  td:where(.grid-table > * > * > *).command-cell,
  th:where(.grid-table > * > * > *).command-cell {
    padding-block: 0;
    padding-inline: 8px;
  }

  .command-button,
  .edit-bar-button,
  .dialog-button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 24px;
    min-height: 32px;
    padding-inline: 10px;
    border-radius: 16px;
    cursor: pointer;
    color: var(--u-color-primary, rgb(103, 80, 164));
    font-size: 0.875rem;
    font-weight: var(--u-font-weight-medium, 500);
    white-space: nowrap;
  }

  .command-button:hover,
  .edit-bar-button:not([aria-disabled="true"]):hover,
  .dialog-button:hover {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .command-button:focus-visible,
  .edit-bar-button:focus-visible,
  .dialog-button:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  .edit-bar-button[aria-disabled="true"] {
    cursor: default;
    color: color-mix(in srgb, currentColor 60%, transparent);
  }

  /* Na barra o desabilitado é pela opacidade (acima): a cor fica a do botão. */
  .toolbar-button.edit-bar-button[aria-disabled="true"] {
    color: var(--u-color-primary, rgb(103, 80, 164));
  }

  .edit-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin-inline-end: 8px;
  }

  .edit-status {
    padding: 4px 10px;
    border-inline-start: 4px solid var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30)));
    background-color: var(--u-color-error-container, rgb(249, 222, 220));
    color: var(--u-color-on-error-container, rgb(65, 14, 11));
    font-size: 0.8125rem;
  }

  .remove-dialog {
    max-width: min(420px, calc(100vw - 32px));
    padding: 24px;
    border: none;
    border-radius: var(--u-grid-column-chooser-shape, 12px);
    background-color: var(--u-grid-column-chooser-background-color, var(--u-color-surface-container-high, rgb(236, 230, 240)));
    color: var(--u-grid-color, var(--u-color-on-surface, rgb(29, 27, 32)));
    box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
  }

  .remove-dialog::backdrop {
    background-color: rgb(0 0 0 / 32%);
  }

  .remove-dialog-title {
    margin: 0 0 12px;
    font-size: 1.25rem;
    font-weight: 400;
  }

  .remove-dialog-message {
    margin: 0 0 20px;
    font-size: 0.875rem;
  }

  .remove-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .dialog-button.danger {
    color: var(--u-color-error, rgb(179, 38, 30));
  }

  @media (prefers-reduced-motion: reduce) {
    .validating-spinner {
      animation: none;
    }
  }

  @media (forced-colors: active) {
    td.modified::after {
      forced-color-adjust: none;
      border-block-start-color: CanvasText;
    }

    tbody tr[role=row].selected > td.modified::after {
      border-block-start-color: HighlightText;
    }

    tbody tr[role=row].added > td:first-child {
      border-inline-start: 3px solid CanvasText;
    }

    td.invalid,
    .cell-editor[aria-invalid="true"] {
      outline: 2px dashed CanvasText;
    }

    .validation-message,
    .edit-status,
    .remove-dialog,
    .cell-editor {
      border: 1px solid CanvasText;
    }

    .edit-bar-button[aria-disabled="true"] {
      color: GrayText;
    }
  }
`;
