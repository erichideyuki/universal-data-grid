# 21 — Responsivo (colunas ocultas por prioridade e linha adaptativa)

## Objetivo
Quando a largura do PRÓPRIO grid não comporta as colunas, esconder colunas
por prioridade e mostrar os valores delas numa linha expansível abaixo da
linha de dados (rótulo: valor), sem perder informação, teclado, leitor de
tela, edição nem filtro — e com reflow em zoom de 400% (WCAG 1.4.10).

## Referência
DevExtreme: `columnHidingEnabled`, `columns[].hidingPriority`, coluna de
comando `adaptive` (botão "…" no fim da linha) e linha adaptativa
(`dx-adaptive-detail-row`, um `dxForm` com "Rótulo: valor"); métodos
`expandAdaptiveDetailRow(key)`, `collapseAdaptiveDetailRow()`,
`isAdaptiveDetailRowExpanded(key)`; evento `onAdaptiveDetailRowPreparing`.
AG Grid não tem (responsividade fica por conta do hospedeiro com
`setColumnsVisible`).

## Decisões de escopo
1. **Linha adaptativa = a linha de detalhe da spec 10.** Uma só linha
   expansível por linha de dados, um só botão (`Row details`), um só
   estado de expansão (`expandRow`/`collapseRow`/`isRowExpanded`,
   `u-grid-row-expansion-change`, `autoExpandRows`, estado da 11). A linha
   de detalhe mostra primeiro os campos das colunas ocultas por falta de
   espaço e depois o conteúdo do `detailRenderer` (se houver). A coluna de
   expansão aparece com `detailRenderer` OU quando há coluna oculta por
   falta de espaço. Por quê: (a) dois botões e duas linhas por item
   (detalhe + adaptativa, como no DevExtreme) dobram o custo do row model
   e do virtualizador e confundem o leitor de tela; (b) a infraestrutura de
   altura variável, foco, teclado e ARIA da linha de detalhe já existe e
   está auditada; (c) "ver mais desta linha" é o mesmo gesto. Divergência
   da referência: o DevExtreme abre UMA linha adaptativa por vez e põe o
   botão no fim da linha; aqui vale a regra do detalhe (várias abertas;
   botão no começo, sticky — continua à vista em tela estreita).
2. **Duas visibilidades.** "Oculta pelo usuário/hospedeiro" (`visible`,
   seletor, menu, `getState().columns[].visible`) é o que já existe.
   "Oculta por falta de espaço" é um estado de LAYOUT: não entra no
   estado da 11, não dispara `u-grid-column-visibility-change`, não tira a
   coluna da exportação, da cópia de linhas, da busca nem do filtro. Só o
   que é desenhado na tabela e navegado por teclado deixa de tê-la.
3. **Largura necessária** de cada coluna (o cálculo não lê o DOM das
   células): a largura escolhida (usuário > hospedeiro > auto-ajuste) ou,
   sem ela, `max(minWidth, 150 × fontSize/16)` px — a regra da virtualização de
   colunas (13), escalada pelo zoom de texto. Disponível = `clientWidth` do contêiner de rolagem
   (o próprio grid, não a janela) menos as colunas que nunca saem (fixas,
   recuos de grupo, caixa de seleção, expansão, comandos).

## API (revisada pelos subagentes; aprovada pelo usuário em 2026-11-18)

`<u-grid>`:
- `autoHideColumns: boolean` ↔ `auto-hide-columns` (padrão `false`,
  `booleanAttribute`) — liga o esconder automático. Irmão de
  `autoExpandRows`/`autoExpandGroups`; `columnHiding` foi recusado pelo
  revisor (na família `columnResizing`/`columnChooser` lê-se "o usuário
  pode ocultar", que já existe pelo seletor/menu).
- `getAdaptiveColumns(): GridColumnDef[]` — colunas ocultas agora por
  falta de espaço ("adaptive columns"), na ordem das colunas (cópia
  mutável, como `getGrouping`; `[]` desligado, antes do 1º layout e no
  servidor).
- Evento `u-grid-adaptive-columns-change`, `detail:
  GridAdaptiveColumnsChangeEventDetail { columns, previous }` (`readonly
  GridColumnDef[]`, congelados), depois do render (fora do callback do
  `ResizeObserver`), não cancelável, sem `source`. Dispara quando o
  conjunto muda: largura, colunas, setter `autoHideColumns` — exceção
  registrada na 15 (estado de layout: sem `source`, dispara por setter).
  No `HTMLElementEventMap` e em `@fires`.

`GridColumnDef` / `<u-grid-column>`:
- `hidingPriority?: number | null` ↔ `hiding-priority` (conversor numérico
  opcional: vazio/`NaN` = `null`). Se ALGUMA coluna tem `hidingPriority`,
  só essas saem, da menor para a maior (empate: a mais ao fim sai antes);
  as demais nunca saem. Se nenhuma tem, saem da última para a primeira.
  Ignorado em banda.

Contextos:
- `GridCellRenderContext.adaptive: boolean` (e no contexto do editor):
  `true` quando o renderer desenha o valor na linha adaptativa. A troca
  célula ↔ linha adaptativa aborta o `signal` (conteúdo descartado).

Expansão (reaproveitada da 10, sem nome novo): com `autoHideColumns` ligado
(ou com `detailRenderer`), `expandRow`, `collapseRow`, `isRowExpanded`,
`autoExpandRows` e `u-grid-row-expansion-change` operam SEMPRE sobre o
estado guardado ("is or would be") e o evento sempre dispara; só o desenho
da linha e do botão depende de haver coluna oculta (ou `detailRenderer`).
Abrir/fechar pela edição, validação, `focusCell`/`editCell` disparam o
evento nos dois sentidos com a `source` do gesto ou da API, e entram/saem
do `getState()`.

Foco e edição por API: `focusCell(rowKey, column)` e `editCell(rowKey,
column)` com coluna oculta por espaço abrem a linha (`source: 'api'`) e
vão ao valor. Na linha adaptativa, `u-grid-focus-change` leva `column` = a
coluna do valor focado (`cellType: 'detail'`; `null` na célula inteira).
Foco movido porque a coluna saiu: `source: 'api'` (como a limpeza de
intervalos da 19).

Parts novos (dentro da `detail-cell`): `adaptive-fields` (`<dl>`),
`adaptive-field` (par), `adaptive-label` (`<dt>`), `adaptive-value`
(`<dd>`, com os adjetivos da célula: `modified`, `invalid`).
Reaproveitados: `validation-message`, `search-highlight`, os `detail-*`.

i18n (14 idiomas, 4 chaves novas):
- `adaptiveColumnsAnnouncement` — "Columns in row details: {columns}"
  (`{columns}` = até 3 nomes juntados como lista do idioma, senão a
  contagem).
- `noAdaptiveColumnsAnnouncement` — "All columns in the table".
- `adaptiveColumnDescription` — "In row details" (seletor de colunas).
- `adaptiveLabelSeparator` — ": " (entre rótulo e valor; padrão igual ao
  `groupLabelSeparator` de cada idioma).

Mudança de comportamento da 20 (aprovada): linhas fixas ganham o
botão e a linha de detalhe/adaptativa dentro do próprio `rowgroup` (hoje a
célula de expansão delas é vazia) — sem isso, os valores ocultos das
fixas ficam inalcançáveis. Vale também para `detailRenderer`.

## Comportamento
- **Quando recalcula**: no `ResizeObserver` que o grid já tem no contêiner
  de rolagem (nenhum observer novo), e quando mudam colunas, larguras
  (usuário, hospedeiro, auto-ajuste), fixação, agrupamento,
  `autoHideColumns` ou a coluna de expansão. Só larguras em memória:
  O(colunas), nada por linha. Histerese de 1 px para não oscilar quando a
  barra de rolagem aparece/some.
- **Congelado** enquanto há editor aberto (célula, lote, linha de filtro)
  ou popover/menu ancorado em cabeçalho/célula (funil, menu de coluna,
  menu de contexto): o conjunto só é recalculado ao fechar (zoom ou girar
  a tela não apaga o que se digita).
- **Largura necessária**: a escolhida (usuário > hospedeiro > auto-ajuste)
  ou `max(minWidth, 150 × fontSize/16)` px (acompanha o zoom só de texto,
  1.4.4). A última coluna que sobra tem a largura escolhida como teto:
  encolhe até a disponível (sem rolagem horizontal em 320 px).
- **Ordem**: pela regra de `hidingPriority`; nunca saem colunas fixas
  (medido: o DevExtreme mantém a fixa e esconde a 1ª comum), agrupadas
  (não estão na tabela), nem a caixa de seleção, a expansão e a de
  comandos. Pelo menos UMA coluna de dados fica sempre.
- **Bandas**: o `colspan` da banda encolhe; banda sem folha exibida some do
  cabeçalho. Na linha adaptativa o rótulo mostra o caminho das bandas em
  estilo secundário (span à parte) antes do rótulo da coluna; nome
  acessível = os rótulos juntados por espaço ("Address City").
- **Virtualização de colunas**: as ocultas saem da conta da janela
  horizontal; o resto segue a 13.
- **Linha adaptativa** (detalhe): `<dl part="adaptive-fields">` com um
  `adaptive-field` por coluna oculta, na ordem das colunas, "Rótulo: valor"
  com o mesmo render da célula: formatação (02), `renderer` da coluna (10,
  `ctx.adaptive = true`), realce da busca (04), estado alterado/erro (09).
  No `<dt>`, ícones de ordenação e de filtro ativo da coluna (`aria-hidden`
  + texto oculto com `sortAscending`/`sortDescending`/`columnFiltered`).
  Depois, o conteúdo do `detailRenderer`. Só para linhas na janela (nada
  por linha não visível); altura medida como na 10. Par em `flex-wrap`
  (valor abaixo do rótulo quando não cabe), `overflow-wrap: anywhere` no
  valor.
- **Expansão**: ver API. Sem coluna oculta e sem `detailRenderer`, nada é
  desenhado, mas o estado guardado continua valendo (e no `getState`).
- **Foco** (se o foco está fora do grid, só realoca o `tabindex=0`;
  `u-grid-focus-change` com `source: 'api'`):
  - Coluna da célula ativa sai → célula de expansão da mesma linha; no
    cabeçalho → coluna exibida anterior (ou próxima); na linha de filtro
    → célula de filtro exibida anterior; nos rodapés → célula da última
    coluna exibida (que recebe o resumo).
  - Valor focado na linha adaptativa cuja coluna volta → célula dessa
    coluna na mestre.
  - Coluna de expansão some (todas voltaram, sem `detailRenderer`) com o
    foco nela ou na linha adaptativa → 1ª célula de dados da mestre.
- **Edição (09)**:
  - Modo célula/lote: Enter/F2/duplo clique num valor de coluna editável
    abre o editor no lugar do valor (`aria-labelledby` = o `<dt>`, id
    `adaptive-<linha>-<coluna>` único também nas fixas); Enter/Tab
    confirmam como na célula; Esc cancela e devolve o foco ao valor.
  - Modo linha: ao começar a editar uma linha com colunas ocultas, a linha
    adaptativa abre (evento) com os editores das ocultas; ordem de Tab:
    editores da mestre → editores da adaptativa → Salvar/Cancelar
    (comandos), como num formulário. Ao sair da edição ela fecha (evento)
    se foi aberta pela edição, e o foco vai à célula da mestre onde a
    edição começou.
  - Erro/alteração em coluna oculta com a linha fechada (lote, `setError`,
    colar): marca na célula de expansão (`invalid`/`modified`) com
    `aria-describedby` = 1º erro, como o erro da linha da 09; o erro da
    linha vai à 1ª célula EXIBIDA. Ao salvar com erro numa oculta: abre a
    linha e foca o editor.
  - `editCell`/`focusCell` com coluna oculta: abrem a linha e vão ao valor.
- **Menu e cópia**: clique direito e Shift+F10/tecla Menu num valor da
  linha adaptativa abrem o menu da célula daquela coluna (18); Ctrl+C
  copia o valor focado (como a célula).
- **Filtro (04)**: o filtro de coluna oculta continua valendo; a célula da
  linha de filtro e o funil saem com a coluna (limpar pelo menu/barra ou
  `clearFilter`); o `<dt>` mostra o filtro ativo.
- **Resumos (07)**: total de rodapé e resumo alinhado (`display:
  'column'`/`'footer'`) de coluna oculta vão para a célula da última
  coluna exibida com o texto completo ("Sum of Amount: 47"); essa célula
  quebra linha (`white-space: normal`, altura pelo conteúdo). Na linha de
  grupo entram no texto como os `inline`.
- **Seletor (06)**: coluna oculta por espaço continua marcada; a dica
  `adaptiveColumnDescription` vai em linha própria sob o rótulo, FORA do
  `<label>`, e entra no `aria-describedby` junto da descrição que já
  existe. Banda com todas as folhas ocultas por espaço também.
- **Intervalo de células (19)**: intervalo que perde coluna é limpo (regra
  da 19, `u-grid-cell-range-change` com `source: 'api'`).
- **Linhas fixas (20)**: ganham botão e linha de detalhe/adaptativa no
  próprio `rowgroup` (`aria-rowindex` na ordem visual); a regra dos 50% do
  sticky conta as linhas abertas. Linha inteira (`rowRenderer` com
  conteúdo) não tem linha adaptativa (não tem colunas).
- **SSR**: o servidor não sabe a largura: renderiza todas as colunas; o
  cliente esconde no 1º layout depois da hidratação (sem erro de
  hidratação; um ajuste visual). Documentado.
- **Reflow 400% (WCAG 1.4.10)**: grid de 320 px com colunas que podem sair
  → `scrollWidth <= clientWidth`. Colunas fixas deixam de ser sticky
  quando, com a expansão, passam de 50% da largura (como as linhas fixas
  da 20), para não cobrir o foco (2.4.11).
- **Memória**: nenhum listener/observer novo além do `ResizeObserver` que
  já existe (solto no `disconnectedCallback`); temporizador do anúncio
  limpo no `disconnect`. Nada guardado por coluna fora de `WeakMap`.

## Acessibilidade
- **Papéis**: inalterados da 10. Célula de expansão `gridcell` com
  `aria-expanded` e `<button aria-expanded aria-label="Row details">`
  (nome fixo; estado só no `aria-expanded`). Linha adaptativa `row` com
  `aria-labelledby` = id da linha mestre, uma `gridcell` com
  `aria-colspan` = colunas navegáveis. Dentro, `<dl>`/`<dt>`/`<dd>`; o
  separador visual (`adaptiveLabelSeparator`) é texto no `<dt>`; separador
  de lista visualmente oculto depois de cada `<dd>` (menos o último), para
  a leitura da célula inteira ter divisa entre pares.
- **`aria-colcount`** = colunas navegáveis EXIBIDAS (expansão, caixa,
  dados exibidos, comandos); colunas ocultas por espaço não estão na
  tabela, então não contam e o `aria-colindex` segue contínuo. Com
  virtualização, as fora do DOM continuam contando (13).
- **Teclado** (igual à linha de detalhe, LTR e RTL):
  - Célula de expansão: Enter/Espaço abrem/fecham (foco fica nela).
  - ↓ da linha mestre entra na linha adaptativa (célula única); ↑/↓ saem;
    ←/→ nela não fazem nada.
  - Enter/F2 na linha adaptativa entram no conteúdo: TODO valor é parada
    (`tabindex=-1`, `aria-labelledby` = `<dt>` + `<dd>`), além do conteúdo
    interativo do renderer; Tab/Shift+Tab circulam dentro (como o
    `cycleWithin` do detalhe); Esc volta à célula.
  - Valor focado: Enter/F2 editam (se editável); Esc cancela; Shift+F10
    abre o menu; Ctrl+C copia.
  - Todo gesto de mouse (clique no botão, duplo clique e clique direito no
    valor) tem esse equivalente.
- **Anúncio** (`aria-live` polite que o grid já tem): só quando o conjunto
  muda; espera de 1 s depois da última mudança (redimensionar arrastando
  anuncia uma vez); na hora de anunciar confere se o foco está dentro do
  grid (inclusive popovers dele); anuncia o resultado líquido —
  `adaptiveColumnsAnnouncement` com os nomes (até 3) ou a contagem, ou
  `noAdaptiveColumnsAnnouncement` quando volta a zero; nada se o conjunto
  final é igual ao de antes. Quem entra depois: o mesmo texto no
  `aria-describedby` do cabeçalho da coluna de expansão.
- **Foco visível**: célula de expansão sticky no começo (2.4.11); anel dos
  valores/editores com `outline-offset` negativo dentro da `.detail-cell`
  (que tem `overflow: clip`); `Highlight` em `forced-colors`.
- **Contraste**: `<dt>` com `--u-color-on-surface-variant` (≥ 7:1 medido
  na 17), nunca opacidade.
- **forced-colors / reduced-motion**: sem animação; ícones e separadores
  com `CanvasText`.
- **Toque**: alvo do botão ≥ 24×24 px (2.5.8), como hoje.

## i18n
Quatro chaves novas (ver API) nos 14 idiomas; `rowDetails`,
`sortAscending`/`sortDescending`, `columnFiltered` e o separador de lista
do idioma reaproveitados.

## Revisão do desenho (2026-11-18)
- API (`webcomponent-api-reviewer`): todos os achados acatados —
  `columnHiding` → `autoHideColumns`; expansão sempre sobre o estado
  guardado, com evento; aberturas automáticas com evento; `focusCell`/
  `editCell` e `column` no foco da linha adaptativa; `source: 'api'` no
  foco movido; exceção do evento registrada; `adaptiveLabelSeparator`
  próprio; adjetivos nos parts; `adaptiveColumnDescription`,
  `noAdaptiveColumnsAnnouncement`; tipos do `detail`; conversor numérico
  opcional; `ctx.adaptive`; JSDocs da 10 atualizados.
- A11y (`a11y-reviewer`): todos acatados — congelar com editor/popover;
  política de foco completa; linhas fixas com expansão (muda a 20: aval);
  todo valor é parada; ícones de ordenação/filtro no rótulo; marca de
  erro/alteração na célula de expansão; ordem de Tab do modo linha;
  resumos movidos quebram linha; teto da última coluna e regra dos 50%
  nas colunas fixas; quebra, foco visível, contraste, seletor, caminho de
  bandas, anúncio com nomes, menu/cópia no valor, ids, largura pelo
  `font-size`, testes extras.

## Fora de escopo
- Linha adaptativa separada da de detalhe e "uma aberta por vez"
  (`expandAdaptiveDetailRow` do DevExtreme).
- Pontos de quebra por largura (`hidingPriority` por faixa) e
  "colunas que viram cartão" (layout em cartões em tela estreita).
- Esconder no servidor (SSR não conhece a largura).
- Filtro de coluna oculta editável na linha adaptativa (fica para o
  construtor de filtro, 24).
- Evento "antes" (`u-grid-adaptive-columns-changing`): esconder por espaço
  não é cancelável.

## Arquivos
`src/features/adaptive.ts` (cálculo puro das ocultas: larguras + regra de
prioridade, testado em Node), `src/render/adaptive.ts` (campos da linha
adaptativa), `grid.ts` (lista exibida × visível, coluna de expansão,
resumos, foco, anúncio), `grid-column-def.ts`, `grid-column.ts`,
`features/column-chooser.ts` (dica), `grid-i18n.ts`, `grid.styles.ts`.

## Testes
- Unitário (Node): regra de prioridade (com e sem `hidingPriority`,
  empates, fixas, "sobra pelo menos uma", larguras padrão).
- Navegador em várias larguras (1200, 800, 600, 320 px): colunas exibidas,
  `aria-colcount`/`aria-colindex`, coluna de expansão aparece/some, campos
  da linha adaptativa com formatação, renderer, realce da busca, bandas,
  fixas, agrupado, virtualização de colunas, linhas fixas.
- Expansão: `expandRow` sem `detailRenderer`; estado guardado quando todas
  voltam; `getState` não muda com a largura; exportação e cópia de linhas
  incluem as ocultas.
- Edição: célula, linha e lote na linha adaptativa; validação.
- Roteiro de teclado (só teclado, conferindo o foco): expandir, ↓ para a
  adaptativa, Enter/F2, Tab, editar, Esc, ↑; coluna focada que some.
- RTL (`ar`), SSR (renderiza no `@lit-labs/ssr`; hidratação esconde sem
  erro), axe (fechado, aberto, editando, RTL, 320 px).
- Anúncio: uma vez por rajada, só com foco dentro, nada se líquido zero.
- Vazamento (`src/test/leak.ts`): grid com `autoHideColumns` redimensionado e
  removido é coletado; redimensionar muitas vezes num grid de vida longa
  não cresce.
- Desempenho: cenário novo "redimensionar o grid com 1 milhão de linhas"
  (largura alternando entre larguras que escondem/mostram colunas) no
  perfil fraco; sem regressão da linha de base.

## Decisões da implementação
- `_visibleColumns` passou a ser o que a tabela EXIBE (render, navegação,
  cabeçalho lógico, bandas — o `colspan` sai das folhas exibidas); o novo
  `_shownColumns` (visíveis pelo usuário, com as ocultas por espaço) serve à
  exportação, à cópia de linhas, à busca e ao seletor. Sem
  `autoHideColumns` os dois são iguais.
- Cálculo em `features/adaptive.ts` (função pura, teste em Node), chamado no
  `willUpdate` só quando a largura (o `ResizeObserver` do contêiner, que já
  existia), as colunas ou o layout mudam. A coluna de expansão só entra na
  conta quando algo precisa sair (sem `detailRenderer`). Folga de 24 px para
  uma coluna voltar.
- Conjunto congelado com editor aberto, menu de contexto/barra, funil aberto
  ou foco na linha de filtro; o `focusout` pede o recálculo.
- Linhas adaptativas = linhas de detalhe: o `RowList` já guardava as
  posições expandidas; `#detailsOf` só desenha com a coluna de expansão à
  vista (detalhe ou coluna oculta), a expansão continua guardada.
- Linhas fixas: as seções fixas ganharam linhas de detalhe intercaladas
  (`#fixedRows` com cache pela versão da expansão) e os índices internos
  contam as linhas das seções (`#fixedTopCount`/`#fixedBottomCount`); a
  referência ativa de um detalhe fixo leva `detail: true`. A mesma chave no
  corpo e numa fixa expande nas duas (a expansão é por chave).
- Valores da linha adaptativa são alvos de foco do grid
  (`.focus-target[tabindex=-1]`, reconhecidos pelo `cell-content-focus`);
  foco perdido num valor (linha recriada ao salvar) volta ao mesmo valor.
- Resumo de coluna oculta no rodapé de GRUPO não quebra linha (a linha está
  no virtualizador, altura fixa): só o rodapé de totais quebra.
- Linha inteira (`rowRenderer`) sem `detailRenderer` não tem botão (não há
  colunas para mostrar).
- Desempenho (`responsive-1m`, perfil fraco): estreitar ~13 ms, alargar
  ~9 ms, rolar com linhas adaptativas abertas no mesmo patamar do detalhe.

## Critério de pronto
`npm test`, `npm run test:perf`, `npm run typecheck`, `npm run lint`
verdes; README (seção "Responsive columns" + API reference) e
`custom-elements.json` (`npm run analyze`); revisores de API e a11y na
entrega.

## Referência medida
DevExtreme 26.1, demos "Columns Hiding Priority" e "Grid Adaptability
Overview" (jQuery, 2026-11-18):
- Com `hidingPriority` em algumas colunas, só elas saem, da menor para a
  maior (0: City, 1: State, 2: Order Date); as sem prioridade ficam.
- Sem `hidingPriority`: saem da última para a primeira conforme a largura
  (1200 px: todas; 800: sai a última; 600: duas; 400: quatro; 300: só a
  1ª fica). A 1ª nunca sai.
- Coluna fixa nunca sai: fixando a 2ª, ela fica e a 1ª comum sai; a
  coluna adaptativa vira fixa também.
- Coluna adaptativa (sem rótulo, ~52 px) no FIM, só quando há coluna
  oculta; célula `role="gridcell"` com `aria-label` que alterna "Display
  additional data" / "Hide additional data" (sem `aria-expanded`, sem
  `<button>`); no cabeçalho é uma `gridcell` vazia com `tabindex=0`.
- As ocultas continuam no DOM com largura 0 (`dx-datagrid-hidden-column`)
  e mantêm o `aria-colindex` — aqui saem do DOM (axe e leitor de tela não
  devem achar células invisíveis).
- Linha adaptativa: `role="row"` sem ligação com a mestre; uma `gridcell`
  com `colspan` e `aria-roledescription` próprio; dentro, `<label>` +
  valor focável (`tabindex=0`) por coluna oculta, rótulo "City:".
- Só UMA linha adaptativa aberta por vez (abrir outra fecha a anterior).
  Alargar o grid até caber tudo fecha a linha aberta; estreitar de novo
  não a reabre.
- Teclado não medido (como na 10, teclas simuladas não chegam na demo).
