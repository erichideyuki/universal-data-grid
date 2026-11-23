import { css } from 'lit';

export const styles = css`
  * {
    box-sizing: border-box;
  }

  :host {
    display: block;
    /*
     * Bloco de contenção dos absolutos internos (região aria-live, textos só
     * para leitor de tela): sem isso, com a rolagem num contêiner externo
     * (spec 27), eles se posicionam num ancestral fora dele, escapam do
     * overflow e esticam a página até a altura do grid. O hospedeiro pode
     * trocar (\`u-grid { position: absolute }\` vence o \`:host\`).
     */
    position: relative;
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
    /*
     * Os longhands novos (--u-grid-cell-block/inline-padding) vencem os atalhos
     * antigos (--u-table-cell-padding, --u-grid-data-cell-padding): o tema do
     * Universal Material define --u-table-cell-padding no :root, e ele anulava o
     * longhand. Um var() sem fallback de variável não definida deixa a custom
     * property inválida (valor inicial), então --_cell-padding-longhand só existe
     * quando um dos dois longhands foi definido.
     */
    --_cell-padding-block-set: var(--u-grid-cell-block-padding) var(--_cell-inline-padding);
    --_cell-padding-inline-set: var(--_cell-block-padding) var(--u-grid-cell-inline-padding);
    --_cell-padding-longhand: var(--_cell-padding-block-set, var(--_cell-padding-inline-set));
    --_cell-padding: var(--_cell-padding-longhand, var(--u-table-cell-padding, var(--_cell-block-padding) var(--_cell-inline-padding)));
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
    --_resize-handle-width: var(--u-grid-resize-handle-width, 8px);
    --_fixed-shadow-color: var(--u-grid-fixed-shadow-color, color-mix(in srgb, var(--u-color-shadow, rgb(0, 0, 0)) 22%, transparent));
    --_focus-ring: var(--u-grid-focus-ring-width, 2px) solid var(--u-grid-focus-ring-color, var(--u-color-primary, rgb(103, 80, 164)));
    --_selection-column-width: 48px;
    --_detail-toggle-width: 40px;
    --_command-column-width: 176px;
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

  .container.drop-target::after,
  .container.resizing::after {
    content: "";
    position: absolute;
    top: 0;
    left: min(var(--_drop-indicator-left), 100% - var(--_drop-indicator-width));
    bottom: 0;
    background-color: var(--_drop-indicator-color);
    width: var(--_drop-indicator-width);
    z-index: 20;
  }

  .container:has(.header).drop-target::after,
  .container:has(.header).resizing::after {
    top: var(--_toolbar-offset, var(--_header-height));
  }

  /* Arrasto da borda da coluna: o mesmo separador de mover coluna, na borda nova (como a referência). */
  .container.resizing::after {
    left: min(var(--_resize-line-left, -100px), 100% - var(--_drop-indicator-width));
    background-color: var(--u-grid-resize-handle-color, var(--_drop-indicator-color));
  }

  .scroll-container {
    /*
     * Bloco de contenção dos absolutos da tabela (textos só para leitor de
     * tela nas linhas de grupo, linha ativa fora da janela): sem isso eles se
     * posicionam no \`.container\`, fora desta área, escapam do overflow e
     * alargam o grid e a página (relato de uso, celular).
     */
    position: relative;
    height: 100%;
    overflow: auto;
  }

  /*
   * Rolagem por contêiner externo (spec 27): o grid cresce com o conteúdo e
   * quem rola, nas duas direções, é o contêiner; tudo o que é sticky gruda
   * nele. O atributo cobre o SSR; o modo vindo só da propriedade (e a
   * anulação quando o contêiner não resolve) usa a folha da instância.
   * \`overflow-anchor: none\`: a âncora de rolagem do navegador não escolhe
   * linhas que o virtualizador troca (a posição é relida pelo
   * \`IntersectionObserver\`).
   */
  :host([scroll-container]:not([scroll-container=""])) {
    height: auto;
    overflow-anchor: none;
  }

  /* Tão larga quanto a tabela: a barra e a paginação grudam na borda inicial visível. */
  .layout.external-scroll {
    height: auto;
    inline-size: max-content;
    min-inline-size: 100%;
  }

  .external-scroll > .container,
  .external-scroll .scroll-container {
    height: auto;
    overflow: visible;
  }

  /*
   * Folga entre a borda visível do contêiner (depois do \`scroll-padding\`) e
   * o que gruda (\`--_port-mask-start/end\`, medida pelo grid, ex.: o padding
   * do hospedeiro em volta do grid): duas faixas sticky com o fundo do grid,
   * acima das células, escondem o conteúdo rolado que passaria ali. A
   * posição natural delas é fora da tabela; o corte da camada
   * (\`clip-path\` na área do grid) as esconde em repouso (a folga é do
   * hospedeiro) e mostra só a parte que o conteúdo rolado ocupa. O corte não
   * vai no \`.container\`: com milhões de linhas (15M px de altura) o
   * Chromium erra o hit-test das células. (Sombra na célula não serve: o
   * Chromium não pinta a sombra externa de \`<td>\` com \`border-collapse:
   * collapse\`, e um pseudo-elemento seria cortado pelo \`overflow\` da célula.)
   */
  .port-masks {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    pointer-events: none;
    clip-path: inset(0);
  }

  .port-mask {
    position: sticky;
    flex: none;
    background: var(--_background-color);
    pointer-events: auto;
  }

  .port-mask:first-child {
    inline-size: var(--_port-mask-start, 0px);
    margin-inline-start: calc(var(--_port-mask-start, 0px) * -1);
    inset-inline-start: calc(var(--_port-inset-start, 0px) - var(--_port-mask-start, 0px));
  }

  .port-mask:last-child {
    inline-size: var(--_port-mask-end, 0px);
    margin-inline: auto calc(var(--_port-mask-end, 0px) * -1);
    inset-inline-end: calc(var(--_port-inset-end, 0px) - var(--_port-mask-end, 0px));
  }

  /*
   * Barra e paginação: na largura da parte visível do grid, presas à borda
   * inicial. Sem entrar no \`max-content\` do layout (\`contain: inline-size\` e
   * largura em %): uma largura explícita aqui alargava a tabela até a parte
   * visível do contêiner, e a parte visível seguia larga — com o grid recuado
   * no contêiner, o responsivo nunca cabia (relato 0.3.3).
   */
  .external-scroll .header,
  .external-scroll > .pager {
    contain: inline-size;
    inline-size: 100%;
    max-inline-size: var(--_viewport-inline-size, 100%);
  }

  .external-scroll > .pager {
    position: sticky;
    inset-inline-start: var(--_port-inset-start, 0px);
  }

  /* O que o hospedeiro gruda no contêiner (\`scroll-padding\` dele) desloca o que o grid gruda. */
  .external-scroll .header,
  .external-scroll thead:where(.grid-table > *) {
    top: var(--_port-inset-top, 0px);
  }

  .external-scroll .header + table:where(.grid-table) thead:where(.grid-table > *) {
    top: calc(var(--_port-inset-top, 0px) + var(--_toolbar-offset, var(--_header-height)));
  }

  .external-scroll tbody:where(.grid-table > *).fixed-top-rows {
    top: calc(var(--_port-inset-top, 0px) + var(--_fixed-top-offset, 0px));
  }

  .external-scroll tbody:where(.grid-table > *).fixed-bottom-rows {
    bottom: calc(var(--_port-inset-bottom, 0px) + var(--_fixed-bottom-offset, 0px));
  }

  .external-scroll .total-footer {
    bottom: var(--_port-inset-bottom, 0px);
  }

  /* Barra de erro: no pé da parte visível, não no fim de um grid de milhões de linhas. */
  .external-scroll .error-row {
    position: sticky;
    bottom: var(--_port-inset-bottom, 0px);
    contain: inline-size;
    inline-size: 100%;
    max-inline-size: var(--_viewport-inline-size, 100%);
    inset-inline-start: var(--_port-inset-start, 0px);
  }

  /* Painel de carga: no centro da parte visível do grid (medido na rolagem). */
  .external-scroll .load-panel {
    inset-block-start: var(--_visible-block-center, 50%);
    inset-inline-start: var(--_visible-inline-center, 50%);
  }

  /*
   * Foco nativo (Tab de fora, controle de renderer) e \`scrollIntoView\` da
   * célula: não param sob o que o grid gruda (WCAG 2.4.11). As margens são
   * medidas pelo grid; o \`scroll-padding\` do contêiner o navegador já soma.
   */
  .external-scroll tbody:where(.grid-table > *).body-rows > tr > :is(td, th),
  .external-scroll tbody:where(.grid-table > *).body-rows > tr > :is(td, th) * {
    scroll-margin-block: var(--_reveal-top, 0px) var(--_reveal-bottom, 0px);
    scroll-margin-inline: var(--_reveal-start, 0px) var(--_reveal-end, 0px);
  }

  .external-scroll :is(thead, tfoot, tbody.fixed-rows):where(.grid-table > *) > tr > :is(td, th),
  .external-scroll :is(thead, tfoot, tbody.fixed-rows):where(.grid-table > *) > tr > :is(td, th) * {
    scroll-margin-inline: var(--_reveal-start, 0px) var(--_reveal-end, 0px);
  }

  /*
   * Eixo \`block\` (spec 30): o contêiner externo rola só na vertical; o grid
   * fica na largura que o hospedeiro dá e rola as colunas dentro dele, em
   * faixas (cabeçalho, corpo, rodapé) com o mesmo \`<colgroup>\`. O atributo
   * cobre o SSR (\`min-inline-size: 0\`: item de flex/grid não cresce até a
   * tabela); com a propriedade, a folha da instância.
   */
  :host([scroll-container]:not([scroll-container=""]):not([scroll-container-axis="both"])) {
    min-inline-size: 0;
  }

  .layout.external-scroll.axis-block {
    inline-size: auto;
    min-inline-size: 0;
  }

  .grid-bands {
    position: relative;
  }

  /*
   * As três faixas rolam na horizontal com \`auto\` e a barra oculta (a visível
   * é a própria, no rodapé). Cabeçalho e rodapé também \`auto\`, não
   * \`hidden\`: o Chromium pinta a área \`overflow: hidden\` num deslocamento
   * fracionário de pixel físico (escala de 110%, grid num x fracionário) e as
   * linhas dela saíam 1 px fora das do corpo (relato do ClickCompliance,
   * 0.5.0); com \`auto\` as três caem no mesmo pixel. Rolar o cabeçalho ou o
   * rodapé direto (toque, roda) chega ao corpo pela sincronização.
   */
  .band {
    /* Bloco de contenção dos absolutos da tabela (linha ativa fora da janela, textos do leitor), como o \`.scroll-container\`. */
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    /* Sem âncora de rolagem: o virtualizador troca as linhas (spec 27). */
    overflow-anchor: none;
  }

  .band::-webkit-scrollbar {
    display: none;
  }

  /*
   * Focáveis só por programa (\`tabindex="-1"\`: área rolável fora do Tab, que
   * o Chromium tornaria parada sem nome; o teclado é o das células). Clique
   * no vazio: sem anel; o foco visível é o das células.
   */
  .band:focus {
    outline: none;
  }

  /* Cabeçalho (rótulos, linha de filtro, fixas do topo) e rodapé (fixas do fundo, totais, barra) grudam na porta. */
  .band-head {
    position: sticky;
    top: var(--_port-inset-top, 0px);
    z-index: 2;
    background-color: var(--u-grid-header-background-color, var(--_background-color));
  }

  .header + .grid-bands > .band-head {
    top: calc(var(--_port-inset-top, 0px) + var(--_toolbar-offset, var(--_header-height)));
  }

  .band-foot {
    position: sticky;
    bottom: var(--_port-inset-bottom, 0px);
    z-index: 2;
    background-color: var(--_background-color);
  }

  /* Dentro das faixas o que grudava na vertical fica no fluxo: quem gruda é a faixa. */
  .grid-bands :is(thead, tfoot, tbody.fixed-rows):where(.grid-table > *) {
    position: relative;
    inset-block: auto;
  }

  /* Acima da metade da altura da porta (zoom, WCAG 1.4.10/2.4.11): as faixas rolam com o conteúdo. */
  .bands-scroll .band-head,
  .bands-scroll .band-foot {
    position: relative;
    inset-block: auto;
  }

  /*
   * Barra horizontal própria: espelho do \`scrollLeft\` do corpo. Oculta para o
   * leitor e fora do Tab (o teclado rola pela navegação de células). A área
   * operável é a da barra nativa (exceção de controle do agente de usuário,
   * 2.5.8); os 24px reservam o espaço com barra de sobreposição. A cor vem do
   * \`scrollbar-color\` herdado.
   */
  .hscroll {
    display: flex;
    align-items: flex-end;
    min-block-size: 24px;
    overflow-x: scroll;
    overflow-y: hidden;
  }

  .hscroll[hidden] {
    display: none;
  }

  .hscroll-spacer {
    flex: none;
    block-size: 1px;
  }

  /* Foco nativo e \`scrollIntoView\` nas faixas: as margens das fixas já estão no \`scroll-padding\` delas. */
  .axis-block tbody:where(.grid-table > *).body-rows > tr > :is(td, th),
  .axis-block tbody:where(.grid-table > *).body-rows > tr > :is(td, th) *,
  .axis-block :is(thead, tfoot, tbody.fixed-rows):where(.grid-table > *) > tr > :is(td, th),
  .axis-block :is(thead, tfoot, tbody.fixed-rows):where(.grid-table > *) > tr > :is(td, th) * {
    scroll-margin-inline: 0;
  }

  /* Alvo invisível do \`scrollIntoView\` de uma linha fora da janela virtual. */
  .reveal-probe {
    position: absolute;
    inline-size: 1px;
    pointer-events: none;
    visibility: hidden;
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
    padding: var(--u-grid-cell-padding, var(--_cell-padding-longhand, var(--u-grid-data-cell-padding, var(--_cell-padding))));
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
  .row-lines :is(tbody, tfoot) > tr:where(.grid-table > * > *):not(.last):not(:last-child),
  .row-lines thead > tr:where(.grid-table > * > *):has(+ .filter-row),
  tr:where(.grid-table > * > *):has(+ .group-row) {
    box-shadow: inset 0 calc(var(--_row-lines-height) * -1) 0 0 var(--_border-color);
  }

  /* Espaçadora do virtualizador (altura até a 1ª linha da janela): sem linha nem borda. */
  tr:where(.grid-table > * > *).spacer {
    box-shadow: none;
  }

  /*
   * Última linha do corpo: fica com a sobra da altura do \`<tbody>\` (a altura
   * virtual). Em %, a tabela dá a sobra só a ela — sem isso a sobra se divide
   * entre as linhas de altura automática, inclusive a da célula ativa fora da
   * janela (\`.pinned\`, fora do fluxo mas com vaga na grade), e as linhas
   * visíveis descem (revisão do site: master-detail e adicionar/cancelar).
   */
  tr:where(.grid-table > * > *).filler {
    height: 100%;
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
    inset-inline-start: calc(var(--_port-inset-start, 0px) + var(--_cell-inline-padding));
    max-inline-size: calc(var(--_viewport-inline-size, 100%) - 2 * var(--_cell-inline-padding));
  }

  :host(:dir(rtl)) tr:where(.grid-table > * > *):not(.expanded) > .detail-toggle-cell .toggle-icon {
    transform: scaleX(-1);
  }

  /* \`clip\` (não \`hidden\`): não vira contêiner de rolagem e o conteúdo sticky segue a área visível. */
  td:where(.grid-table > * > * > *).detail-cell {
    white-space: normal;
    overflow: clip;
  }

  /*
   * Linha adaptativa (spec 21): os valores das colunas ocultas por falta de
   * espaço, "Rótulo: valor"; o par quebra (valor sob o rótulo) quando não
   * cabe e o valor quebra em qualquer ponto (URL, e-mail) — WCAG 1.4.10.
   */
  .adaptive-fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding-block: 8px;
  }

  .adaptive-fields + * {
    margin-block-start: 8px;
  }

  .adaptive-field {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 4px;
    min-width: 0;
  }

  .adaptive-label {
    flex: none;
    max-width: 100%;
    margin: 0;
    color: var(--u-color-on-surface-variant, rgb(73, 69, 79));
    overflow-wrap: anywhere;
  }

  .adaptive-band {
    font-size: 0.875em;
  }

  .adaptive-mark {
    vertical-align: -0.125em;
    margin-inline-start: 4px;
  }

  .adaptive-sort.desc {
    transform: rotate(180deg);
  }

  .adaptive-value {
    position: relative;
    flex: 1 1 12em;
    min-width: 0;
    margin: 0;
    padding: 2px 4px;
    border-radius: 4px;
    overflow-wrap: anywhere;
  }

  /* Anel por dentro: a \`.detail-cell\` corta o que passa da borda (\`overflow: clip\`). */
  .adaptive-value:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  .adaptive-value.modified {
    background-color: var(--u-grid-modified-cell-background-color, color-mix(in srgb, var(--u-color-primary, rgb(103, 80, 164)) 10%, transparent));
    box-shadow: inset calc(3px * var(--_dir)) 0 0 0 var(--u-grid-modified-cell-indicator-color, var(--u-color-primary, rgb(103, 80, 164)));
  }

  .adaptive-value.invalid {
    outline: 2px solid var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30)));
    outline-offset: -2px;
  }

  .adaptive-value.invalid:focus-visible {
    outline: var(--_focus-ring);
    box-shadow: inset 0 0 0 4px var(--u-color-surface, #fff), inset 0 0 0 6px var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30)));
  }

  /* Mensagem de erro no fluxo (a linha adaptativa cresce; nada por cima de outra linha). */
  .adaptive-value > .validation-message {
    position: static;
    width: auto;
    min-width: 0;
    max-width: none;
    margin-block-start: 4px;
  }

  .adaptive-value.editing {
    padding: 0;
  }

  /* Marca na célula de expansão: há valor alterado/inválido nas ocultas com a linha fechada. */
  td:where(.grid-table > * > * > *).detail-toggle-cell.adaptive-invalid {
    outline: 2px solid var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30)));
    outline-offset: -2px;
  }

  /* Foco com erro: anel + faixa clara + borda de erro (o anel não some atrás do vermelho, 2.4.7). */
  td:where(.grid-table > * > * > *).detail-toggle-cell.adaptive-invalid[tabindex]:focus-visible {
    outline: var(--_focus-ring);
    box-shadow:
      inset 0 0 0 4px var(--u-color-surface, #fff),
      inset 0 0 0 6px var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30)));
  }

  td:where(.grid-table > * > * > *).detail-toggle-cell.adaptive-modified {
    box-shadow: inset calc(3px * var(--_dir)) 0 0 0 var(--u-grid-modified-cell-indicator-color, var(--u-color-primary, rgb(103, 80, 164)));
  }

  @media (forced-colors: active) {

    .adaptive-mark {
      color: CanvasText;
    }

    .adaptive-value:focus-visible {
      outline-color: Highlight;
    }

    .adaptive-value.invalid,
    td.detail-toggle-cell.adaptive-invalid {
      outline: 2px dashed CanvasText;
    }

    .adaptive-value.invalid:focus-visible,
    td.detail-toggle-cell.adaptive-invalid[tabindex]:focus-visible {
      outline: 2px solid Highlight;
    }

    .adaptive-value.modified,
    td.detail-toggle-cell.adaptive-modified {
      border-inline-start: 3px solid CanvasText;
    }
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
  th:where(.grid-table > * > * > *).sticky-cell,
  thead:where(.grid-table > *) td:where(.grid-table > * > * > *):is(.fixed, .sticky-cell) {
    /* Na linha de filtro (\`<td>\` no \`<thead>\`) também: o fundo é o do cabeçalho (revisão do site). */
    background: var(--u-grid-header-background-color, var(--_background-color));
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
    inset-inline-start: calc(var(--_port-inset-start, 0px) + var(--_fixed-start, 0px) + var(--_cell-inline-padding, 16px));
    inset-inline-end: calc(var(--_port-inset-end, 0px) + var(--_fixed-end, 0px) + var(--_cell-inline-padding, 16px));
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
    /* Nunca além do padding do fim: não cobre o "⋮" nem o texto. */
    width: min(var(--_resize-handle-width), var(--_cell-inline-padding));
    cursor: col-resize;
    touch-action: none;
    z-index: 1;
  }

  /*
   * Como a referência: a alça é invisível (só o cursor muda) e fica sobre o
   * padding do fim, sem reservar espaço — o texto do cabeçalho alinha com o
   * das células. Alvo menor que 24px pela exceção "equivalente" da WCAG
   * 2.5.8 (menu do cabeçalho: autoajustar, alargar/estreitar; Alt+←/→).
   */
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

  /* inline: o \`text-align\` do <th> (alinhamento da coluna, RTL) posiciona o conteúdo (banda). */
  .header-content {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    vertical-align: middle;
  }

  /*
   * Folha (como o AG Grid): início/centro \`[texto][seta] … [funil][⋮]\`, com o
   * "⋮" na ponta do fim; fim (números) \`[⋮][funil] … [seta][texto]\`. Direção
   * lógica: RTL espelha sozinho. Os botões ficam sempre no lugar (espaço
   * reservado, nada se desloca no hover); o texto corta com reticências.
   */
  .header-column > .header-content {
    display: flex;
    width: 100%;
    min-width: 0;
  }

  .header-column.align-end > .header-content {
    flex-direction: row-reverse;
  }

  /* Auto-ajuste (medição): o conteúdo no tamanho natural, sem a sobra entre o texto e os botões. */
  /* \`headerWrap\`: o rótulo quebra linha e a linha do cabeçalho cresce (WCAG 1.4.12, sem corte). */
  .header-column.header-wrap {
    white-space: normal;
  }

  /*
   * Quebra só entre palavras (hífen com \`hyphens: auto\` e o \`lang\` do
   * hospedeiro); uma palavra maior que a coluna fica com reticências na linha
   * dela. Com \`--u-grid-header-cell-max-lines\`, as linhas além do limite viram
   * reticências. O texto inteiro segue no nome acessível; quem enxerga e usa
   * teclado o lê alargando a coluna (Alt+→) ou pelo autoajuste do menu ⋮
   * (WCAG 1.4.12; spec 17). Só no rótulo padrão: conteúdo de
   * \`headerRenderer\` (pode ter controles focáveis) nunca é cortado.
   */
  .header-column.header-wrap > .header-content > .header-text {
    white-space: normal;
    overflow-wrap: normal;
    hyphens: auto;
  }

  /*
   * No Chromium, \`-webkit-box\` com \`line-clamp: none\` desliga as reticências
   * de TODAS as linhas (a palavra longa sai cortada no meio da letra); com um
   * número, cada linha que transborda ganha reticências, como na referência.
   * Sem limite = um número alto; \`none\` explícito vira bloco comum (que
   * também tem reticências por linha).
   */
  .header-column.header-wrap > .header-content > .header-text:not(:has(*)) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--u-grid-header-cell-max-lines, 9999);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @container style(--u-grid-header-cell-max-lines: none) {
    .header-column.header-wrap > .header-content > .header-text:not(:has(*)) {
      display: block;
    }
  }

  /* Auto-size mede o rótulo numa linha só (como o DevExtreme): senão a coluna encolhe até a maior palavra. */
  .header-column.measuring > .header-content > .header-text {
    white-space: nowrap;
  }

  /* Barra + cabeçalho acima da metade da altura visível: o cabeçalho rola com o conteúdo. */
  .header-rows-scroll thead:where(.grid-table > *) {
    position: static;
  }

  .header-column.measuring > .header-content {
    display: inline-flex;
    width: max-content;
    max-width: none;
  }

  .header-column > .header-content > .header-text {
    flex: 0 1 auto;
    min-width: 0;
  }

  /*
   * Botões e seta na altura da ÚLTIMA linha do rótulo (o rótulo da folha fica
   * no pé da célula): com \`header-wrap\`, um rótulo de 2 linhas centralizava
   * os botões entre elas e eles subiam em relação aos das outras colunas
   * (relato do usuário). O centro do alvo de 24px fica no centro da linha.
   */
  .header-column > .header-content > .header-buttons {
    align-self: flex-end;
    margin-block-end: calc((1lh - 24px) / 2);
  }

  .header-column > .header-content > .sort-indicator {
    align-self: flex-end;
    margin-block-end: calc((1lh - 1em) / 2);
  }

  /*
   * Funil e "⋮" lado a lado, sem espaço entre os alvos (cada um já tem 24px,
   * WCAG 2.5.8), e avançando sobre o padding do fim até a alça de
   * redimensionar (que fica sobre esse padding): ~10px a mais para o rótulo.
   */
  .header-buttons {
    display: flex;
    flex: none;
    align-items: center;
    gap: 0;
    margin-inline-start: auto;
    margin-inline-end: calc(min(var(--_resize-handle-width), var(--_cell-inline-padding)) - var(--_cell-inline-padding));
  }

  /*
   * Botões no começo (rótulo no fim): sem avanço sobre o padding do começo —
   * senão o "⋮" encosta no "⋮" da coluna anterior (16px entre eles).
   */
  .header-column.align-end .header-buttons {
    flex-direction: row-reverse;
    margin-inline: 0 auto;
  }

  /* Centro: texto e seta no meio do espaço que sobra antes dos botões. */
  .header-column.align-center > .header-content > .header-text {
    margin-inline-start: auto;
  }

  .header-column.align-center > .header-content:not(:has(> .header-buttons)) > :last-child {
    margin-inline-end: auto;
  }

  /*
   * Botão "⋮" do menu do cabeçalho: sempre visível, alvo de 24px (WCAG
   * 2.5.8), ícone na cor dos controles (≥ 3:1 com o fundo, WCAG 1.4.11).
   */
  .column-header-menu-button {
    all: unset;
    box-sizing: border-box;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--u-grid-column-header-menu-button-size, 24px);
    height: var(--u-grid-column-header-menu-button-size, 24px);
    border-radius: 50%;
    font-size: 1.125rem;
    cursor: pointer;
    color: var(--_toggle-color);
  }

  /* Três pontos (desenho próprio) em máscara: nenhum nó de SVG por cabeçalho (spec 16). */
  .column-header-menu-button::before {
    content: "";
    width: 1em;
    height: 1em;
    background-color: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='5.5' r='2'/%3E%3Ccircle cx='12' cy='12' r='2'/%3E%3Ccircle cx='12' cy='18.5' r='2'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  .column-header-menu-button:hover,
  .column-header-menu-button[aria-expanded="true"] {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  .column-header-menu-button:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: -2px;
  }

  .header-column.sortable,
  .group.sortable {
    cursor: pointer;
  }

  /*
   * Cabeçalho multinível: linhas verticais em todo o cabeçalho, com ou sem
   * \`show-column-lines\` (como a referência: o corpo segue a opção). A folha
   * que é a última da SUA \`<tr>\` (ex.: a última de uma banda, ao lado de uma
   * folha com rowspan) não está na borda do grid — leva a linha do fim; só a
   * da última posição (\`.last-column\`) fica sem (revisão do site).
   */
  thead:where(.grid-table > *):has(.band-header) th:where(.grid-table > * > * > *).header-column:not(.last-column) {
    --_col-line: inset calc(var(--_column-lines-width) * -1 * var(--_dir)) 0 0 0 var(--_border-color);
    box-shadow: var(--_col-line), var(--_row-line), var(--_edge-line), var(--_edge-shadow);
  }

  /* Cabeçalho multinível: o rótulo das folhas fica embaixo, junto das células. */
  /*
   * Folhas no pé da linha (fim na vertical, como pedido na revisão do site),
   * com ou sem bandas: numa linha em que um rótulo quebra (\`header-wrap\`), os
   * de uma linha e os botões ficam na altura da última linha dele.
   */
  thead:where(.grid-table > *) .header-column {
    vertical-align: bottom;
  }

  /* Realce sob o ponteiro (o mesmo tom da linha; \`--u-grid-row-hover-opacity: 0%\` desliga). */
  th:where(.grid-table > * > * > *):is(.header-column, .band-header):hover {
    background-image: linear-gradient(color-mix(in srgb, currentColor var(--_row-hover-opacity), transparent), color-mix(in srgb, currentColor var(--_row-hover-opacity), transparent));
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

  /*
   * A região \`aria-live\` (filha da raiz): presa ao canto inicial do host e
   * sem a margem negativa — na posição estática, em RTL, ela passava 1px da
   * borda e a página rolava na horizontal (spec 30).
   */
  .visually-hidden:where([role="status"]) {
    inset-block-start: 0;
    inset-inline-start: 0;
    margin: 0;
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
    inset-inline-start: var(--_port-inset-start, 0px);
    background-color: var(--u-grid-header-background-color, var(--_background-color));
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    /* Entre itens e entre linhas da barra (o conteúdo do hospedeiro não encosta no painel de grupos). */
    gap: var(--u-grid-toolbar-gap, 8px);
    padding: var(--_header-padding);
    /* \`--u-grid-toolbar-height\` é a altura mínima: a barra cresce ao quebrar linha. */
    min-height: var(--_header-height);
    /* Acima do cabeçalho (2) e das células sticky do corpo (recuos de grupo, expansão, fixas: 1). */
    z-index: 3;
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
    gap: var(--u-grid-toolbar-gap, 8px);
    min-width: min(200px, 100%);
  }

  /*
   * Conteúdo do hospedeiro: encolhe até a largura da barra (nunca além do
   * grid), para o \`flex-wrap\` dele quebrar linhas; o mínimo de cada filho
   * continua sendo o do próprio conteúdo (relato 0.3.2).
   */
  .toolbar-content {
    display: flex;
    align-items: center;
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
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
  .column-chooser-search:focus-visible,
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

  /* Busca (como o AG Grid): limite do campo ≥ 3:1 (WCAG 1.4.11). */
  .column-chooser-search {
    box-sizing: border-box;
    display: block;
    width: calc(100% - 32px);
    height: 36px;
    margin: 0 16px 4px;
    padding-inline: 12px;
    border: 1px solid var(--u-color-outline, rgb(121, 116, 126));
    border-radius: var(--u-shape-corner-extra-small, 4px);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.875rem;
  }

  .column-chooser-search:focus-visible {
    outline-offset: -1px;
  }

  /* "Mostrar todas": a caixa alinhada com as dos itens (depois da alça). */
  .column-chooser-all {
    min-height: 40px;
    padding-inline: 36px 16px;
    border-block-end: 1px solid var(--_border-color);
  }

  .column-chooser-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 40px;
    padding-inline: 8px 16px;
  }

  /* Sem alça (item único na lista): a caixa no mesmo lugar. */
  .column-chooser-row:not(:has(> .column-chooser-drag-handle)) {
    padding-inline-start: 36px;
  }

  /* Alça de arrasto (só ponteiro; o teclado usa Alt+Shift+↑/↓ na caixa). */
  .column-chooser-drag-handle {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: 18px;
    color: var(--u-color-on-surface-variant, rgb(73, 69, 79));
    cursor: grab;
    touch-action: none;
  }

  .column-chooser-item.dragging {
    opacity: 0.5;
  }

  .column-chooser-item.dragging .column-chooser-drag-handle {
    cursor: grabbing;
  }

  .column-chooser-item.drop-before > .column-chooser-row {
    box-shadow: inset 0 2px 0 var(--u-color-primary, rgb(103, 80, 164));
  }

  .column-chooser-item.drop-after > .column-chooser-row {
    box-shadow: inset 0 -2px 0 var(--u-color-primary, rgb(103, 80, 164));
  }

  /* Banda no seletor (frente 13): as colunas dela numa lista aninhada, recuada. */
  .column-chooser-nested {
    margin: 0;
    padding: 0;
    padding-inline-start: 16px;
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

  /* Coluna oculta por falta de espaço (spec 21): a dica numa linha própria, sob o rótulo. */
  .column-chooser-hint {
    display: block;
    padding-inline-start: 66px;
    padding-block-end: 6px;
    font-size: 0.75rem;
    color: var(--u-color-on-surface-variant, rgb(73, 69, 79));
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

  /* ------------------------------------------------------------- linhas fixas e linha inteira (frente 20) */

  /*
   * Linhas fixas: \`<tbody>\` sticky abaixo do cabeçalho / acima dos totais
   * (deslocamentos medidos pelo grid). Fundo opaco no \`<tbody>\` (a linha
   * põe só a tinta da listra/realce por cima): o corpo rola por baixo.
   */
  tbody:where(.grid-table > *).fixed-rows {
    --_fixed-row-background: var(--u-grid-fixed-row-background-color, var(--u-grid-header-background-color, var(--_background-color)));
    position: sticky;
    z-index: 2;
    background-color: var(--_fixed-row-background);
  }

  tbody:where(.grid-table > *).fixed-top-rows {
    top: var(--_fixed-top-offset, 0px);
  }

  tbody:where(.grid-table > *).fixed-bottom-rows {
    bottom: var(--_fixed-bottom-offset, 0px);
  }

  /* Zoom/reflow (WCAG 1.4.10/2.4.11): ocupando demais, as fixas rolam com o conteúdo. */
  .fixed-rows-scroll tbody:where(.grid-table > *).fixed-rows {
    position: static;
  }

  tbody.fixed-rows > tr > td:where(.grid-table > * > * > *):is(.fixed, .sticky-cell) {
    background: linear-gradient(var(--_row-tint), var(--_row-tint)) var(--_fixed-row-background);
  }

  /* Divisa entre as fixas e o corpo (e entre as do fundo e os totais). */
  tbody.fixed-top-rows > tr:where(.grid-table > * > *):last-child,
  tbody.fixed-top-rows > tr:where(.grid-table > * > *):last-child > :is(.fixed, .sticky-cell) {
    box-shadow: inset 0 calc(var(--_row-lines-height) * -2) 0 0 var(--u-grid-fixed-row-shadow-color, var(--_border-color));
  }

  tbody.fixed-bottom-rows > tr:where(.grid-table > * > *):first-child,
  tbody.fixed-bottom-rows > tr:where(.grid-table > * > *):first-child > :is(.fixed, .sticky-cell) {
    box-shadow: inset 0 calc(var(--_row-lines-height) * 2) 0 0 var(--u-grid-fixed-row-shadow-color, var(--_border-color));
  }

  /*
   * Linha inteira: o conteúdo fica na largura visível menos as células
   * iniciais (WCAG 1.4.10), preso ao início na rolagem horizontal.
   */
  td:where(.grid-table > * > * > *).full-width-cell {
    white-space: normal;
    padding-block: 0;
    overflow: clip;
  }

  .full-width-content {
    position: sticky;
    inset-inline-start: calc(var(--_port-inset-start, 0px) + var(--_full-width-start, 0px) + var(--_cell-inline-padding));
    max-inline-size: calc(var(--_viewport-inline-size, 100%) - var(--_full-width-start, 0px) - 2 * var(--_cell-inline-padding));
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
  :is(.grid-table[data-row-menu], [data-row-menu] .grid-table) > tbody > tr > td,
  .grid-table > thead th,
  .group {
    -webkit-touch-callout: none;
  }

  .menu-separator {
    height: 0;
    margin-block: 8px;
    border-block-start: 1px solid var(--_border-color);
  }

  /*
   * Submenu ("Fixar coluna ▸"): seta no fim do item pai, espelhada em RTL. O
   * espaço vai no texto, não na seta: padding no \`<svg>\` (border-box) deixava
   * 2px de desenho e a seta saía com 1×1 px, invisível (relato do usuário).
   */
  .menu-item-arrow {
    flex: none;
    margin-inline-start: auto;
  }

  .menu-item-parent > .menu-item-text {
    padding-inline-end: 16px;
  }

  .menu-item-arrow:dir(rtl) {
    transform: scaleX(-1);
  }

  .menu-item-parent[aria-expanded="true"] {
    background-color: color-mix(in srgb, currentColor 8%, transparent);
  }

  /* Itens de rádio: a marca do lado atual antes do texto (espaço reservado em todos). */
  .menu-item-check {
    flex: none;
    margin-inline: -4px 8px;
  }

  /* Nada anima nos menus; um tema que traga transição não a aplica com movimento reduzido. */
  @media (prefers-reduced-motion: reduce) {
    .grid-menu,
    .grid-menu .menu-item {
      transition: none;
    }
  }

  /* Toque: alvos maiores nos menus (WCAG 2.5.8 já atende com 40px; 48px é o do Material). */
  @media (pointer: coarse) {
    .menu-item {
      min-height: 48px;
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
  .header-filter-search::placeholder,
  .column-chooser-search::placeholder {
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

  /*
   * Célula da linha de filtro com o foco: linha de destaque embaixo (única
   * linha do campo), com a cor e a espessura do anel de foco (tokens do tema).
   */
  .filter-row > td:where(.grid-table > * > * > *):focus-within {
    --_row-line: inset 0 calc(var(--u-grid-focus-ring-width, 2px) * -1) 0 0 var(--u-grid-focus-ring-color, var(--u-color-primary, rgb(103, 80, 164)));
    box-shadow: var(--_col-line), var(--_row-line), var(--_edge-line), var(--_edge-shadow);
  }

  /*
   * O editor único da célula não leva anel próprio: a linha de destaque já
   * marca o foco. No "between" (dois campos) o anel fica, para mostrar qual.
   */
  .filter-cell-content > input.filter-editor:focus-visible {
    outline: none;
  }

  /* Sem botão de operação (uma operação só) nada marca o campo: fica a linha de baixo (≥ 3:1, WCAG 1.4.11). */
  .filter-cell-content:not(:has(> .filter-operation-button)) > input.filter-editor {
    border-block-end: 1px solid var(--u-color-outline, rgb(121, 116, 126));
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
    border-radius: 0;
    /*
     * Sem fundo nem linha (revisão do site, como o DevExtreme): a lupa/glifo
     * da operação marca o campo; a célula com o foco ganha a linha de
     * destaque de 2px (\`.filter-row > td:focus-within\`).
     */
    background: transparent;
    font: inherit;
    font-size: 0.875rem;
    color: inherit;
  }

  /* Ícone da operação (lupa, glifos) centrado no botão redondo. */
  .filter-operation-button > span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  /* Valor do filtro booleano: botão de menu com a cara dos outros campos (estilizável, tema escuro). */
  .filter-value-button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    text-align: start;
    cursor: pointer;
  }

  .filter-value-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-value-arrow {
    flex: none;
    width: 10px;
    height: 10px;
    background-color: var(--_toggle-color);
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M1 3h8L5 8z'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  .filter-value-button:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: 1px;
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

  /* Mesmo alvo do "⋮" (24px); ícone sem transparência (≥ 3:1 em repouso, WCAG 1.4.11). */
  .header-filter-button {
    width: var(--u-grid-column-header-menu-button-size, 24px);
    height: var(--u-grid-column-header-menu-button-size, 24px);
    font-size: 1rem;
  }

  .header-buttons > .header-filter-button:focus-visible {
    outline-offset: -2px;
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
    .move-container::after {
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

    /* Editor do filtro: o alto contraste tira o box-shadow da linha de foco; limite e anel em cores do sistema. */
    input.filter-editor {
      border-block-end: 1px solid CanvasText;
    }

    .filter-cell-content > input.filter-editor:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }

    .column-lines td:not(.group-column):not(:last-child),
    .column-lines th:not(.group-column):not(:last-child),
    thead:has(.band-header) th.header-column:not(.last-column),
    .fixed-start-edge {
      border-inline-end: 1px solid CanvasText;
    }

    .fixed-end-edge {
      border-inline-start: 1px solid CanvasText;
    }

    .total-row > td {
      border-block-start: 1px solid CanvasText;
    }

    tbody.fixed-top-rows > tr:last-child > td {
      border-block-end: 2px solid CanvasText;
    }

    /* Linha inteira selecionada: o conteúdo do hospedeiro segue as cores do sistema; a seleção é uma borda. */
    tbody tr[role=row].selected > td.full-width-cell {
      background: Canvas;
      color: CanvasText;
      border-inline-start: 4px solid Highlight;
    }

    td.full-width-cell .full-width-content {
      forced-color-adjust: auto;
    }

    tbody.fixed-bottom-rows > tr:first-child > td,
    tbody.fixed-bottom-rows + tfoot .total-row > td {
      border-block-start: 2px solid CanvasText;
    }

    .container.drop-target::after,
    .group-container.drop-target::before,
    .container.resizing::after {
      forced-color-adjust: none;
      background-color: Highlight;
    }

    .header-filter-button.active,
    .column-chooser-button[aria-expanded="true"],
    .column-header-menu-button[aria-expanded="true"],
    .menu-item-parent[aria-expanded="true"],
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

    /* Indicador de soltar do seletor (o alto contraste tira o box-shadow). */
    .column-chooser-item.drop-before > .column-chooser-row {
      border-block-start: 2px solid Highlight;
    }

    .column-chooser-item.drop-after > .column-chooser-row {
      border-block-end: 2px solid Highlight;
    }

    .toolbar-button[aria-expanded="true"] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }

    .toolbar-more-button::before,
    .column-header-menu-button::before,
    .filter-value-arrow {
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
    container: u-grid-pager / inline-size;
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
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    max-width: 100%;
  }

  /*
   * Paginador estreito (celular, painel lateral): só as setas — o número da
   * página já está no texto ("Página 1 de 14"). Sem isso, os 9 botões de 40px
   * (376px com os espaços) passavam da largura do grid e alargavam a página
   * (WCAG 1.4.10). A medida é a área de conteúdo do paginador (sem padding).
   */
  @container u-grid-pager (max-width: 375.98px) {
    .pager-number {
      display: none;
    }
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
    width: var(--_command-column-width);
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

  /*
   * Intervalo de células (frente 19): tinta de fundo + contorno de borda real
   * nas bordas externas de cada intervalo (não só cor, WCAG 1.4.1/1.4.11;
   * propriedades lógicas: espelha em RTL e sobrevive ao forced-colors).
   */
  .cell-range-mode td:where(.grid-table > tbody > tr > *)[data-col]:not(.editing) {
    user-select: none;
    -webkit-user-select: none;
  }

  td:where(.grid-table > * > * > *).in-range {
    background-color: var(--u-grid-selected-cell-background-color, color-mix(in srgb, var(--u-color-primary, rgb(103, 80, 164)) 14%, transparent));
  }

  /* Contexto de empilhamento próprio: o contorno não pinta por cima das colunas fixas ao rolar. */
  td.in-range:not(.fixed):not(.sticky-cell) {
    position: relative;
    z-index: 0;
  }

  td.in-range::before {
    --_range-border: var(--u-grid-cell-range-border-width, 2px) solid var(--u-grid-cell-range-border-color, var(--u-color-primary, rgb(103, 80, 164)));
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  td.in-range.range-top::before {
    border-block-start: var(--_range-border);
  }

  td.in-range.range-bottom::before {
    border-block-end: var(--_range-border);
  }

  td.in-range.range-start::before {
    border-inline-start: var(--_range-border);
  }

  td.in-range.range-end::before {
    border-inline-end: var(--_range-border);
  }

  /* A barra da linha selecionada (A2, spec 17) fica visível ao lado do contorno. */
  tbody tr[role=row].selected:not(.group-row) > td:first-child.range-start::before {
    inset-inline-start: var(--u-grid-selected-row-indicator-width, 3px);
  }

  /* Célula ativa dentro do intervalo: anel + faixa clara (o anel não se funde ao contorno; WCAG 2.4.7). */
  td:where(.grid-table > * > * > *).in-range[tabindex]:focus-visible {
    outline: var(--_focus-ring);
    outline-offset: calc(var(--u-grid-focus-ring-width, 2px) * -1);
    box-shadow:
      inset 0 0 0 calc(var(--u-grid-focus-ring-width, 2px) + 2px) var(--u-color-surface, #fff),
      var(--_col-line),
      var(--_row-line),
      var(--_edge-line),
      var(--_edge-shadow);
  }

  td.in-range[tabindex]:focus-visible::before {
    inset: calc(var(--u-grid-focus-ring-width, 2px) + 2px);
  }

  /* Inválida focada dentro do intervalo: anel, faixa clara e a borda de erro (não some). */
  td:where(.grid-table > * > * > *).in-range.invalid[tabindex]:focus-visible {
    box-shadow:
      inset 0 0 0 calc(var(--u-grid-focus-ring-width, 2px) + 2px) var(--u-color-surface, #fff),
      inset 0 0 0 calc(var(--u-grid-focus-ring-width, 2px) + 4px) var(--u-grid-invalid-cell-color, var(--u-color-error, rgb(179, 38, 30))),
      var(--_col-line),
      var(--_row-line),
      var(--_edge-line),
      var(--_edge-shadow);
  }

  td.in-range.invalid[tabindex]:focus-visible::before {
    inset: calc(var(--u-grid-focus-ring-width, 2px) + 4px);
  }

  .range-dragging {
    cursor: cell;
  }

  /* Barra abaixo do grid: modo "adicionar à seleção" e o resumo (contagem, soma, média). */
  .cell-range-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 16px;
    min-width: 0;
    font-size: 0.875rem;
    color: var(--u-color-on-surface, inherit);
  }

  .cell-range-bar.has-text {
    padding: 8px 16px;
    border-block-start: var(--_borders-width, 1px) solid var(--u-color-outline-variant, rgb(202, 196, 208));
  }

  .cell-range-adding {
    font-weight: 500;
    color: var(--u-color-primary, rgb(103, 80, 164));
  }

  .cell-range-summary {
    overflow-wrap: anywhere;
  }

  @media (forced-colors: active) {
    /* Sem fundo no alto contraste: marca pontilhada em toda célula do intervalo (o interior também). */
    td.in-range::before {
      --_range-border: var(--u-grid-cell-range-border-width, 2px) solid Highlight;
      forced-color-adjust: none;
      outline: 1px dotted Highlight;
      outline-offset: -3px;
    }

    tbody tr[role=row].selected > td.in-range::before {
      --_range-border: var(--u-grid-cell-range-border-width, 2px) solid HighlightText;
      outline-color: HighlightText;
    }

    td:where(.grid-table > * > * > *).in-range[tabindex]:focus-visible {
      outline: 2px solid CanvasText;
      outline-offset: -4px;
    }

    .cell-range-bar.has-text {
      border-block-start: 1px solid CanvasText;
    }
  }

  /* ------------------------------------------------------- árvore (frente 25) */

  /* Recuo por nível (lado inicial: espelha em RTL), botão e conteúdo cortado com reticências. */
  /* O botão de 24 px (WCAG 2.5.8) cabe na altura da linha: sem o respiro vertical da célula. */
  td.tree-cell {
    padding-block: 0;
  }

  .tree-node {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    /* Recuo com teto: o botão e 3 caracteres do conteúdo sempre cabem (WCAG 1.4.10). */
    padding-inline-start: min(calc(var(--_tree-level, 0) * var(--u-grid-tree-indent, 24px)), calc(100% - 24px - 3ch));
  }

  .tree-content {
    flex: 1 1 auto;
    /* Recuo profundo (WCAG 1.4.10): o texto não some de todo. */
    min-width: 3ch;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wrap .tree-content {
    white-space: normal;
  }

  .tree-toggle,
  .tree-toggle-spacer {
    flex: none;
    /* Alvo de 24×24 (WCAG 2.5.8). */
    inline-size: 24px;
    block-size: 24px;
    min-inline-size: 24px;
    min-block-size: 24px;
  }

  .tree-toggle {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 24px;
    block-size: 24px;
    font-size: 20px;
    cursor: pointer;
    border-radius: var(--u-grid-group-toggle-shape, 50%);
    color: var(--u-grid-tree-toggle-color, var(--_toggle-color));
  }

  .tree-toggle:hover {
    background: color-mix(in srgb, currentColor 8%, transparent);
  }

  :host(:dir(rtl)) .tree-toggle:not(.expanded) .toggle-icon {
    transform: scaleX(-1);
  }

  .tree-spinner {
    box-sizing: border-box;
    inline-size: 14px;
    block-size: 14px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, currentColor 25%, transparent);
    border-block-start-color: currentColor;
    animation: u-grid-spin 0.8s linear infinite;
  }

  .tree-summary {
    flex: none;
    margin-inline-start: 8px;
    opacity: 0.8;
  }

  .node-summary {
    font-weight: var(--u-grid-summary-cell-font-weight, 500);
  }

  @media (prefers-reduced-motion: reduce) {
    .tree-spinner {
      animation: none;
    }

    .tree-toggle .toggle-icon {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .tree-toggle {
      color: ButtonText;
    }

    .tree-spinner {
      border-color: CanvasText;
      border-block-start-color: transparent;
    }
  }
`;
