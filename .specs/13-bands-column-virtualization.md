# 13 — Cabeçalho em bandas e virtualização de colunas

## Objetivo
Cabeçalhos multinível e grids largos (centenas de colunas) sem perder
desempenho.

## Referência
DevExtreme: `columns[].columns` (bandas), `isBand`, `ownerBand`;
`scrolling.columnRenderingMode: 'virtual'`. AG Grid: column groups
(`children`, `marryChildren`), column virtualisation por padrão.

## Escopo — API
Nomes finais (revisados pelos subagentes; aguardando aval do usuário):
`GridColumnDef.columns` (banda), `<u-grid-column>` aninhado e
`columnRenderingMode` / `column-rendering-mode`. Virtualizador horizontal
próprio (sem `@tanstack/virtual-core`: a regra de dependências do
`CLAUDE.md` só admite `lit`, `@lit/context` e `interactjs`).

## Comportamento
- Cabeçalho com uma linha por nível; banda com `colspan` nativo calculado;
  arrastar uma coluna só reordena dentro da própria banda; arrastar a banda
  move o bloco.
- Fixar uma banda fixa os filhos (06); ocultar todos os filhos oculta a
  banda.
- Virtualização horizontal com as larguras conhecidas (06); colunas fixas
  sempre renderizadas.
- `<colgroup>` e `aria-colindex` coerentes com as colunas ausentes do DOM.

## Acessibilidade
Banda com `role="columnheader"` e `colspan` nativo; `aria-colcount` total.
Desenho completo em "Acessibilidade (desenho revisado)".

## Fora de escopo
Bandas no painel de grupos (só colunas folha agrupam). Redimensionar banda.
Linha de banda na exportação.

## Arquivos
`render/header.ts`, `row-model/columns.ts` (árvore, ordem e linhas do
cabeçalho), `render/column-window.ts` (janela horizontal).

## Testes
`colspan` com coluna oculta; reordenar dentro da banda; RTL; foco ao rolar
na horizontal; SSR; axe (3 níveis + caixa + agrupado + linha de filtro +
virtualização rolada ao meio); ids únicos; `aria-rowindex` 1..N+1;
`aria-colindex` real e espaçadoras sem índice; posição nativa de cada `th`
= a do `td` do corpo; um só `tabindex=0` no `thead`; roteiro ↑/↓/←/→
atravessando `rowspan`; Alt+Shift e menu na banda; ←/→ até coluna fora do
DOM (foco, rolagem, 2.4.11); caixa mista do seletor; vazamento; perf 300
colunas × 1 milhão de linhas rolando nos dois eixos (e sem regressão sem
bandas e com poucas colunas).

## API (revisada)

Bandas:
- `GridColumnDef.columns?: readonly GridColumnDef<TItem>[] | null` — banda
  = `columns` com pelo menos 1 item (`null`/`[]` = folha). Nome do
  DevExtreme; `children` sombrearia `Element.children` no `<u-grid-column>`.
- Na banda valem só `label`, `headerRenderer`, `alignment` (do rótulo;
  padrão `center`), `fixed`, `visible`, `showInChooser`, `columns`; o resto
  é ignorado (documentado, sem aviso). Profundidade livre.
- `fixed` só no nível de cima: banda fixa leva os filhos; `fixed` numa
  coluna aninhada é ignorado (as folhas herdam o da banda de cima, inclusive
  na descrição "fixada").
- Banda visível = `visible !== false` e algum filho visível. `visible:
  false` na banda oculta tudo; reexibir devolve os filhos ao estado que
  tinham.
- `<u-grid-column>` com `<u-grid-column>` filhos diretos é banda; propriedade
  `columns` só leitura (array congelado e estável, `null` sem filhos). A
  banda observa os filhos (`<slot>` + `slotchange`) e avisa o grid; mudança
  em coluna aninhada sobe até o `<u-grid>`. `label` = `textContent` sem as
  subárvores `<u-grid-column>` aninhadas (nada muda para folhas).
- `moveColumn(column, targetIndex)`: aceita banda; índice entre os IRMÃOS
  (mesma banda ou nível de cima) não agrupados, ocultos contam. Sem bandas é
  o de hoje.
- `u-grid-column-reorder`: `column` pode ser banda; `index`/`previousIndex`
  entre irmãos; campo novo `band: GridColumnDef | null` (banda que contém a
  coluna).
- `u-grid-column-visibility-change`: um evento por coluna cujo estado
  PRÓPRIO mudou (banda primeiro, depois cada filho reexibido); banda que some
  por não ter filho visível não dispara.
- `u-grid-column-fixed-change`: `column` pode ser banda.
- `u-grid-focus-change` e `GridHeaderRenderContext`: no cabeçalho de banda,
  `cellType: 'header'` e `column` = a banda (documentado).
- `sortColumn`/`groupColumn`/`setColumnWidth` com banda: nada;
  `focusCell(key, banda)` devolve `false`; `autoSizeColumn(banda)` ajusta as
  folhas visíveis dela.
- `::part(band-header-cell)` além de `header-cell`; espaçadoras sem `part`.
- Agrupar: só folhas. A folha agrupada sai da banda no cabeçalho e volta ao
  fim da própria banda ao desagrupar.
- Exportação e resumos: só folhas, sem linha de banda.

Virtualização de colunas:
- `columnRenderingMode: 'auto' | 'virtual' | 'standard'` ↔
  `column-rendering-mode`, padrão `'auto'` (virtual com mais de 50 folhas
  DEFINIDAS — visíveis, ocultas e agrupadas —, para o modo não mudar ao
  ocultar uma coluna). Tipo `GridColumnRenderingMode`. Valor desconhecido:
  aviso uma vez e `auto`.
- Virtual: coluna sem `width` usa a largura do auto-ajuste ou
  `max(minWidth, 150)` px (JSDoc de `width` e README); a tabela fica na soma
  exata.
- Sempre no DOM: fixas, caixa/detalhe e a coluna da célula ativa. Fora do
  DOM viram `<col>` + célula espaçadora (`role="presentation"`, sem
  `aria-colindex`, sem `part`); até 2 por lado (coluna ativa longe da
  janela).
- SSR e 1º render: as primeiras colunas que cabem em 1920 px, igual no
  cliente (hidratação).

## Acessibilidade (desenho revisado)

ARIA:
- Uma `<tr role="row">` por nível (`aria-rowindex` 1..N); linha de filtro
  N+1; corpo e rodapé deslocados por N; `aria-rowcount` conta os N.
- Banda: `<th role="columnheader">` com `colspan` NATIVO (= folhas
  renderizadas sob ela; a ARIA manda usar o atributo da linguagem numa
  `<table>`), `aria-colindex` = 1ª folha renderizada, sem `aria-sort`.
  Folha sem banda acima: `rowspan` nativo até o fim (como o DevExtreme).
- Toda linha ocupa as mesmas posições nativas: recuos de grupo, caixa,
  detalhe e espaçadoras com `rowspan=N` no 1º nível; espaçadoras também na
  linha de filtro, no rodapé e nas linhas de grupo/detalhe/"sem dados", cujos
  `colspan` contam as colunas do DOM com espaçadoras.
- `aria-colcount` = navegáveis totais; `aria-colindex` sempre o real.
- Ids do cabeçalho com nível + índice (`header-text-{nível}-{col}`).
- `aria-keyshortcuts` da banda: `Alt+Shift+ArrowLeft Alt+Shift+ArrowRight
  Shift+F10` (+`F2` com o ⋮).
- Rótulo da banda quebra linha (1.4.12) e a banda tem borda visível
  (`CanvasText` em `forced-colors`).

Foco e teclado (padrão espacial da APG; início/fim lógicos, espelham em RTL):
- Posição = (nível, coluna), com nível E coluna lembrados; um só
  `tabindex=0` no `thead`; a coluna da ação vem da célula (banda ou folha).
- ←/→, Home/End percorrem as células que cobrem o nível lembrado (pulando o
  `colspan` inteiro); célula com `rowspan` não muda o nível lembrado.
- ↑/↓ mudam o nível: ↑ da folha vai à banda que a cobre; ↓ da banda vai ao
  filho sob a coluna lembrada (vindo pelo fim, o último; pelo início, o 1º);
  ↓ do último nível vai à 1ª linha; ↑ da 1ª linha vai ao último nível.
- Ctrl+Home: 1ª célula do 1º nível.
- Alt+Shift+←/→: move entre os irmãos visíveis do mesmo bloco (folha não
  sai da banda); na banda, move o bloco; anuncia a posição entre irmãos.
- Shift+F10 / ⋮ na banda: "Mover para a esquerda/direita". Enter/Espaço/
  Ctrl+G na banda: nada.
- Arrastar banda = bloco; folha só dentro da banda. O menu é a alternativa
  de ponteiro único (2.5.7).
- Guarda de foco: banda ocultada ou folha agrupada com o foco → a célula do
  nível mais próximo que existir na mesma coluna.
- Virtualização: ←/→ até coluna fora do DOM → ela entra no render como
  ativa, recebe o foco, `scrollIntoView` com o `scroll-padding-inline` das
  fixas, a rolagem traz a janela; o foco nunca cai no `<body>`.

Seletor de colunas:
- Banda: caixa nativa tri-state (`.checked` = todos visíveis,
  `.indeterminate` = parte); o clique segue a APG: misto → todos visíveis →
  banda oculta → todos visíveis. Filhos numa `<ul>` aninhada com
  `aria-labelledby` = rótulo da banda; a caixa do filho mostra o estado
  efetivo (banda oculta = desmarcado); marcar um filho com a banda oculta
  mostra a banda. Fixar só no nível de cima. Não oculta a última folha
  visível.

i18n: sem chave nova (reusa `moveLeft`/`moveRight`,
`columnMovedAnnouncement`, `columnFixedStart`/`End`).

Achados recusados (uma linha cada):
- Propriedade/atributo `label` no `<u-grid-column>` (API): fora do escopo;
  o texto já serve.
- Avisos no console para campos ignorados na banda e métodos com banda
  (API): só documentar, sem ruído.
- Chave `columnMovedInBandAnnouncement` e anúncio no limite da banda (a11y):
  mantém o comportamento atual (📌 da spec 17).
- Chave `bandColumnCount` (a11y): NVDA/JAWS já leem o `colspan`; VoiceOver
  vai ao roteiro manual da spec 17 (🔎).

## Referência medida

DevExtreme 26.1, demos jQuery (2026-11-18):
- Bandas (`MultiRowHeadersBands`): uma `<tr>` por nível; banda `<td
  role="columnheader" colspan>`; folha sem banda com `rowspan` até o último
  nível; `aria-colindex` relativo à linha (erro: "Total" no 2º nível tem
  `aria-colindex=1`). Arrastar banda move os filhos juntos; folha só dentro
  da banda; banda vai ao seletor e oculta os filhos. Setas do corpo não
  sobem ao cabeçalho (cabeçalho só por Tab).
- Virtualização (`HorizontalVirtualScrolling`, 500 colunas × 100 px):
  ~10 colunas no DOM + uma célula espaçadora por lado com a largura somada
  (em todas as linhas e no `<colgroup>`); `aria-colindex` real (201..210
  rolado a 20 000 px); sem overscan visível; `role="grid"` sem
  `aria-colcount`.
- AG Grid (documentação): grupos de colunas com setas ↑/↓ entre níveis,
  `aria-colindex` absoluto e `aria-colspan`; virtualização de colunas
  ligada por padrão.
