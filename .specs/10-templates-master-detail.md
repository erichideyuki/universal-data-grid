# 10 — Templates e master-detail

## Objetivo
Personalizar cabeçalho, linha de grupo, estado vazio e linha de detalhe, e
dar ao `renderer` de célula um contrato sólido.

## Referência
DevExtreme: `cellTemplate`, `headerCellTemplate`, `groupCellTemplate`,
`dataRowTemplate`, `noDataText`/template, `masterDetail: { enabled,
autoExpandAll, template }`. AG Grid: `cellRenderer`, `headerComponent`,
`detailCellRenderer`, `fullWidthCellRenderer`.

## Decisão tomada (aval do usuário, 2026-11-18)
O renderer aceita os três retornos (opção 3 da proposta original):
`TemplateResult` (caminho recomendado) e `string` são renderizados direto
no shadow DOM do grid (rápidos, saem no SSR, estilo pelo `part="…"` que o
próprio template declara → `u-grid::part(x)`); `HTMLElement` segue no light
DOM do `<u-grid>`, projetado por slot (só no cliente; estilos da página
valem). Revisado pelo `webcomponent-api-reviewer` antes do aval; todos os
achados acatados.

## Escopo — API (aprovada)
- Tipos exportados: `GridRenderResult = TemplateResult | HTMLElement |
  string | typeof nothing | null | undefined`; contextos
  `GridCellRenderContext { item, value, text, column, rowKey, grid, signal }`,
  `GridHeaderRenderContext { column, grid, signal }`,
  `GridGroupRenderContext { column, value, text, groupPath, groupIndex,
  itemCount, expanded, summaries, defaultText, grid, signal }`,
  `GridDetailRenderContext { item, rowKey, grid, signal }`,
  `GridNoDataRenderContext { filtered, grid, signal }`; funções
  `GridCellRenderer`, `GridHeaderRenderer`, `GridGroupRenderer`,
  `GridDetailRenderer`, `GridNoDataRenderer`;
  `GridRowExpansionChangeEventDetail { rowKey, expanded, source }`.
- Coluna (`GridColumnDef` e `<u-grid-column>`, só propriedade):
  `renderer(item, ctx)` (o `item` segue 1º argumento: compatível),
  `headerRenderer(ctx)` (só o rótulo; seta, filtro e alça seguem do grid),
  `groupRenderer(ctx)` (rótulo + contagem; botão e resumos alinhados seguem).
- Grid: `noDataRenderer`, `detailRenderer` (com ele aparece a coluna de
  expansão), `autoExpandRows` ↔ `auto-expand-rows`, métodos
  `expandRow(rowKey)`, `collapseRow(rowKey)`, `isRowExpanded(rowKey)`,
  evento `u-grid-row-expansion-change` (gesto e métodos; não por
  `autoExpandRows`).
- `GridCellType` ganha `'detail-toggle'` e `'detail'`.
- Parts: `detail-toggle-cell`, `detail-toggle-button`, `detail-row` (com
  `row`), `detail-cell`, `expanded` (linha mestre aberta).
- Fora (podem entrar depois sem quebrar): `expandedRowKeys`,
  `expandAllRows`/`collapseAllRows`, objeto `masterDetail`, `rowIndex` no
  ctx (mudaria sem o item mudar), `isRowExpandable`.

## Comportamento
- `ctx.signal` (`AbortSignal`, criado sob demanda) é abortado quando o grid
  descarta aquele conteúdo (linha sai da janela, detalhe recolhido, coluna
  trocada, grid desconectado) — onde o hospedeiro desmonta raízes de
  framework.
- Renderer roda de novo quando o item, o objeto da coluna ou o idioma mudam
  e quando a linha volta à janela virtual; não ao selecionar, focar, ordenar
  nem quando o item é mutado. Nunca reaproveita conteúdo de outra linha.
- Toda chamada vai em try/catch: no servidor, exceção ou `HTMLElement` vira
  o placeholder do ramo slot (o mesmo template do cliente, para a
  hidratação); no cliente, `console.error` uma vez por coluna/tipo e célula
  vazia.
- `expandRow`/`collapseRow` sem `detailRenderer` não fazem nada;
  `isRowExpanded` devolve `false`. Chave fora das linhas guarda o estado e
  dispara o evento (como `expandGroup`); retém a chave como `selectedKeys`.
- Linha de detalhe de largura total com altura medida — altura variável
  esparsa no virtualizador (exceções sobre a altura fixa), sem custo quando
  não há detalhe aberto.
- `headerRenderer`: clique/tecla vindos de elemento interativo do conteúdo
  não ordenam. `label` continua obrigatório (seletor, chips, anúncios).
- Grid aninhado no detalhe: o grid externo ignora teclado e eventos cujo
  `composedPath()[0]` não é dele (teclado isolado).

## Acessibilidade
Linha de detalhe com `aria-labelledby` da linha mestre; o botão da coluna de
expansão é `<button aria-expanded>` com nome fixo (`rowDetails`).

## i18n
`rowDetails` ("Row details"), 14 idiomas — o estado só no `aria-expanded`.

## Fora de escopo
`rowRenderer` de linha inteira (fase D).

## Arquivos
`render/content.ts` (conteúdo de renderer), `render/cell.ts`,
`grid-custom-cell.ts`, `features/master-detail.ts`, `render/header.ts`,
`render/group-row.ts`, `render/virtualizer.ts`.

## Testes
Renderer correto após expandir grupo / ordenar / rolar; detalhe com altura
variável e rolagem estável; grid aninhado; SSR; vazamento (detalhes, grids
aninhados, templates); perf de 1 milhão de linhas com detalhes abertos.

## Referência medida
DevExtreme, demo "Master-Detail View" (jQuery, 2026-11-18):
- Coluna de expansão é a 1ª, `role="gridcell"` focável no roving tabindex,
  com `aria-label="Expand"` e ícone (sem `<button>`); não seleciona a linha
  (`dx-selection-disabled`). Aqui: `<button aria-expanded>` dentro da célula
  (pedido da spec e da APG), nome fixo "Row details" e o estado no
  `aria-expanded` (o rótulo que alterna seria lido duas vezes).
- Linha de detalhe de largura total depois da mestre; altura do conteúdo.
- Teclas simuladas (eventos sintéticos e CDP com o painel oculto) não
  expandiram na demo — sem medida de teclado. Adotado o que o grid já faz
  na linha de grupo: Enter/Espaço na célula de expansão alternam; a linha
  de detalhe é uma célula só (↑/↓ entram e saem; Enter/F2 vão ao
  conteúdo; Esc volta), como o padrão "grid" da APG para conteúdo
  interativo de célula.

## Decisões da implementação
- Conteúdo de renderer numa diretiva única (`render/content.ts`, no lugar
  do `u-grid-custom-cell`): roda o renderer só quando as dependências
  mudam (item/coluna/renderer/idioma); `HTMLElement` num `<div slot>` do
  light DOM; aborta o `signal` e tira o `div` ao descartar (parte removida
  da janela, grid desconectado).
- Linhas de detalhe sem objeto por linha: o bloco de itens do `RowList`
  guarda as posições expandidas (ou, com `auto-expand-rows`, as exceções);
  `at()` acha a linha por busca binária. Achar as posições: `indexOf` por
  chave (até 16 chaves) ou uma passada com `Set`.
- Virtualizador: camada esparsa de alturas próprias (índices crescentes +
  Fenwick das diferenças), O(log k); sem detalhe aberto, aritmética pura.
  Linha medida acima da janela desloca a rolagem pela diferença (o que está
  na tela não pula). Alturas medidas por item (`WeakMap`; primitivos em LRU
  de 256); detalhe ainda não medido usa a última altura medida.
- A linha de detalhe tem `height: 1px` (mínima): sem altura declarada, a
  tabela daria a ela a sobra do `<tbody>` de altura virtual.
- `ResizeObserver` nas linhas de detalhe renderizadas (conteúdo que cresce
  depois: grid aninhado, imagens); desconectado no `disconnectedCallback`.
- `detailRenderer` que devolve `null` renderiza linha de detalhe vazia
  (saber antes exigiria rodar o renderer ao montar as linhas).
- CSS do grid restrito à própria tabela (`table.grid-table` e seus filhos
  diretos, por `:where()` — mesma especificidade): os seletores de
  `table`/`td`/`th` não pegam mais nas tabelas dos templates.
- Slots internos com prefixo `u-grid-internal:`; `this` do renderer de célula,
  de cabeçalho e de grupo = a coluna (como no `u-grid-custom-cell`).

## Acessibilidade na entrega (a11y-reviewer, spec 17)
- Conteúdo de renderer rebaixado da ordem de Tab (A12) na diretiva, depois
  do commit da parte; exceção: o estado vazio (fora da navegação), cujo
  conteúdo fica no Tab. F2 no cabeçalho percorre o conteúdo do
  `headerRenderer` antes do funil/menu/alça; F2 na linha de grupo entra no
  conteúdo do `groupRenderer`.
- Célula de expansão com `aria-expanded` (além do botão); clique no botão
  deixa o foco na célula (`mousedown` sem foco, como o botão de grupo).
- Linha de detalhe: `aria-labelledby` = `id` da mestre pelo índice
  (`row-N`, válido e único), `aria-level` da mestre no `treegrid`,
  `aria-colspan` = colunas navegáveis; conteúdo em `.detail-content`
  sticky, limitado à largura visível (WCAG 1.4.10).
- `groupRenderer` com resumos alinhados: nome = conteúdo + resumos
  (`aria-labelledby` com texto oculto).
- Aprovado (2026-11-18) e implementado: `aria-label`/`aria-labelledby` do
  `<u-grid>` nomeiam a tabela (`grid`/`treegrid`), também em grid aninhado
  no detalhe (`features/host-label.ts`). Como IDREF não atravessa o shadow
  root, os ids do `aria-labelledby` são resolvidos na raiz do hospedeiro
  (documento, ou o shadow root do grid externo para o aninhado) e os alvos
  vão para a tabela em `ariaLabelledByElements` (referência do shadow root
  para fora é válida: o navegador calcula o accname de verdade — conferido
  pela árvore de acessibilidade via CDP) e, como reserva (SSR, navegador
  sem a reflexão), o TEXTO deles no `aria-label` da tabela (accname
  aproximado: `aria-label` do alvo, senão o texto da árvore achatada, sem
  `aria-hidden`/não renderizado, com `aria-label`/`alt` de descendentes;
  alvo oculto conta inteiro; vários ids juntados por espaço;
  `aria-labelledby` vence o `aria-label`, alvo vazio cai nele). Um
  `MutationObserver` observa o texto dos alvos e a raiz (`childList` +
  atributo `id`, callback só compara `getElementById`: pega alvo que
  aparece, sai, muda de id ou cujo ancestral foi trocado); solto no
  `disconnect`, quando a tabela também solta os elementos
  (`_memoryStats.hostLabelObservers`). Alvo que é o hospedeiro ou o contém:
  só o `aria-label` dele, aviso no console (senão o nome seria o grid
  inteiro e cada render acordaria o observador). Na hidratação o Lit não
  grava o valor do cliente (`noCommit`): o `aria-label` é garantido no
  `updated` (teste de hidratação com `aria-labelledby`). `grid.ariaLabel`
  (reflexão ARIA) funciona por ser o atributo. No SSR só o `aria-label` (o
  Lit não chama o `attributeChangedCallback` do elemento no servidor: lido
  no `willUpdate`). O hospedeiro mantém os atributos (o autor/framework é
  dono deles); o axe não acusa nem deixa `incomplete` por isso — ler com
  VoiceOver se o hospedeiro vira "grupo" com nome repetido (🔎 na spec 17).
  Fora: `ariaLabelledByElements` posto no `<u-grid>` e `aria-describedby`
  (documentado).
- Conteúdo inserido depois do render não é rebaixado (documentado no README).
