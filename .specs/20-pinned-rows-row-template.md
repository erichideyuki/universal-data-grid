# 20 — Linhas fixas e template de linha inteira

## Objetivo
Linhas presas no topo e no rodapé da área de rolagem (comparação, metas,
totais próprios do hospedeiro) e um `rowRenderer` que troca as células de
uma linha de dados por um conteúdo de largura total (cartão, faixa,
aviso), sem perder seleção, foco, teclado, master-detail, colunas fixas,
virtualização de colunas e altura variável.

## Referência
- AG Grid "Row Pinning": `pinnedTopRowData`/`pinnedBottomRowData` (dados
  próprios, fora de ordenação/filtro/grupo, não selecionáveis, o usuário
  não muda) ou, desde a v33, `enableRowPinning`/`isRowPinned` (linhas do
  conjunto, que CONTINUAM no corpo; ordenação e filtro valem; seleção
  espelha a original; fixar pelo menu de contexto, Enterprise).
- AG Grid "Full Width Rows": `isFullWidthRow(params)` +
  `fullWidthCellRenderer` (sem `value`/`column`, recebe a linha inteira);
  ocupa a largura toda por cima das colunas fixas e não rola na horizontal;
  altura por `getRowHeight`; foco vai à linha inteira, o conteúdo cuida do
  próprio Tab; não muda ordenação/filtro; vale também em linha fixa.
- DevExtreme `dataRowTemplate`: troca TODAS as linhas de dados; recebe
  `data`, `key`, `rowIndex`, `isSelected`, `isExpanded`…; sem colunas
  fixas, agrupamento, coluna de comandos; seleção, edição, master-detail e
  linha focada ficam por conta do autor. DevExtreme não tem linhas fixas.

## Decisões de escopo
1. **Linhas fixas = dados próprios do hospedeiro** (`fixedTopItems` /
   `fixedBottomItems`), como o `pinnedTopRowData` do AG Grid — e não
   "fixar linhas de `items` por chave". Por quê: (a) a frente pede que elas
   fiquem FORA de ordenação/filtro/grupo, o que só é coerente com dados
   fora do pipeline (no modelo por chave do AG Grid o filtro esconde a
   fixada e ela continua no corpo); (b) custo zero no row model (nada por
   item, nada a procurar a cada rebuild); (c) fixar um item do conjunto
   continua possível: o hospedeiro põe o mesmo objeto em `fixedTopItems`
   (ele segue também no corpo, como no AG Grid). Fixar pelo usuário
   (menu de contexto) fica para a frente 18 por cima desta API. Radical
   `fixed` (decisão #28 da spec 15); o README cita "pinned rows".
2. **Linha inteira por item** (aval do usuário, 2026-11-18): só
   `rowRenderer`; devolver `false` = aquela linha é normal (com colunas).
   Cobre o modelo `dataRowTemplate` (nunca devolve `false`) e o do AG
   Grid (decide por item) sem uma 2ª propriedade. `null`/`undefined`/`''`
   continuam "conteúdo vazio", como nos outros renderers. O grid só sabe
   se a linha é inteira ao renderizá-la: o renderer deve decidir no
   começo (devolver `false` antes de montar conteúdo). Nada por linha não
   visível; o teclado que cai numa linha fora da janela usa a coluna
   lembrada e, se ela vier inteira, o foco passa à célula única.

## API (aprovada pelo usuário em 2026-11-18)

`<u-grid>` (todas só propriedade, `attribute: false`):

- `fixedTopItems: readonly TItem[]` (padrão `[]`) — linhas presas logo
  abaixo do cabeçalho.
- `fixedBottomItems: readonly TItem[]` (padrão `[]`) — linhas presas logo
  ACIMA do rodapé de totais (o rodapé continua a última linha).
- `rowRenderer: GridRowRenderer | null` (padrão `null`) — só linhas de
  dados e fixas; devolver `false` deixa a linha normal.
- `focusCell(rowKey, column?, options?: { rowFixed?: GridRowFixed })` —
  opção nova para focar a linha fixa (sem ela: só o corpo, como hoje).

Tipos exportados:

- `type GridRowFixed = 'top' | 'bottom' | null` (como `GridColumnFixed`).
- `interface GridRowRenderContext<TItem> { item; rowKey; fixed:
  GridRowFixed; grid; signal }` (mesmo contrato dos contextos da spec 10:
  sem `rowIndex`/`selected`/`expanded`, que mudam sem o item mudar).
- `type GridRowRenderer<TItem> = (item: TItem, ctx:
  GridRowRenderContext<TItem>) => GridRenderResult | false`.
- `GridCellType` ganha `'full-width'` (JSDoc de `column` no foco: `null`
  nela).
- `GridFocusChangeEventDetail` ganha `rowFixed: GridRowFixed` e
  `previousRowFixed`; `focusedRowKey` devolve `null` quando a célula ativa
  está numa linha fixa (como no cabeçalho).
- `GridExportOptions.includeFixedRows?: boolean` (padrão `true`;
  `selectedOnly: true` tem precedência e as deixa de fora);
  `GridExportDataRow` ganha `fixed: GridRowFixed` (`null` no corpo; as
  fixas saem com `level: 0`).

i18n (14 idiomas): `fixedTopRowsLabel` ("Pinned rows at top") e
`fixedBottomRowsLabel` ("Pinned rows at bottom"), `aria-label` dos
`rowgroup`s.

Parts: no `<tr>` `row fixed-row fixed-top-row` / `row fixed-row
fixed-bottom-row` (com `odd`/`even` e realce sob o ponteiro; nunca
`selected`); no `<tbody>` `fixed-top-row-group` / `fixed-bottom-row-group`;
linha inteira: `full-width-row` no `<tr>` (junto de `row`, `odd`/`even`,
`selected`, `expanded`) e `full-width-cell` no `<td>`.
Custom properties: `--u-grid-fixed-row-background-color` (padrão
`var(--u-grid-header-background-color)`, como os totais) e
`--u-grid-fixed-row-shadow-color` (borda/sombra entre fixas e corpo).

## Comportamento

### Linhas fixas
- Renderizadas em `<tbody>` próprios, `position: sticky` abaixo do
  cabeçalho (topo) e acima do rodapé de totais (fundo), com o deslocamento
  MEDIDO (thead/tfoot crescem com zoom de texto); fora do virtualizador:
  não rolam na vertical, rolam na horizontal com as colunas (as colunas
  fixas continuam fixas nelas).
- Zoom/reflow (WCAG 1.4.10/2.4.11): se barra + cabeçalho + fixas + totais
  passam de 50% da altura da área de rolagem, as fixas deixam de ser
  sticky e rolam com o conteúdo, na mesma ordem.
- Mesmas colunas, formatação, `renderer` de célula e `rowRenderer` do
  corpo. NÃO entram em ordenação, filtro, busca (sem realce), agrupamento,
  paginação (aparecem em toda página), contagem (`getTotalCount`) nem em
  totais/resumos.
- Não selecionáveis (sem `aria-selected`; célula da coluna de caixas vazia
  e navegável, como no rodapé de totais); sem detalhe (célula de expansão
  vazia); não editáveis (`editCell`/`editRow` não as acham; coluna de
  botões vazia). `keyExpr` vale (`rowKey` nos eventos).
- Teclado: fazem parte da sequência de linhas — cabeçalho → fixas do topo
  → corpo → fixas do fundo → totais (mesma ordem no DOM, na tela e no
  `aria-rowindex`). ↑/↓ andam uma linha (↓ na última fixa do topo vai à
  1ª do corpo, rolando o corpo ao começo; corpo vazio: à 1ª do fundo).
  PageUp/PageDown: passo = linhas do corpo que cabem; um bloco nunca é
  atravessado de uma vez (última do corpo → 1ª fixa do fundo → totais);
  do cabeçalho ou das fixas do topo, PageDown vai à última linha visível do
  corpo (PageUp é o simétrico); com `paging`, PageUp/PageDown numa fixa não
  trocam de página. Ctrl+Home/Ctrl+End como hoje (cabeçalho / última
  linha). Andar pelas fixas não muda a rolagem vertical do corpo (só a
  horizontal); a rolagem até uma célula do corpo desconta a altura das
  fixas (o foco nunca para debaixo delas, WCAG 2.4.11).
- Seleção por intervalo (Shift+setas/clique/Espaço) e a âncora só com
  linhas do corpo.
- Foco: a fixa focada que some (troca de `fixedTopItems`/
  `fixedBottomItems`) passa o foco à mesma posição da sequência (fixa
  seguinte, senão a vizinha no corpo).
- Ctrl+C numa célula fixa copia como numa célula de dados.
- Exportação: fixas do topo antes das linhas do corpo, as do fundo antes
  dos totais.

### Linha inteira
- Linha de dados (ou fixa) cujo `rowRenderer` não devolve `false`:
  as células iniciais continuam reais (recuos de grupo, célula de expansão
  com `aria-expanded`, caixa de seleção) e UMA `gridcell` de largura total
  cobre as colunas comuns e a de botões (`colspan` = colunas do DOM,
  inclusive espaçadores da virtualização). Conteúdo num `<div>` sticky
  limitado à largura visível menos as células iniciais (não rola na
  horizontal, WCAG 1.4.10).
- Altura: a do conteúdo, no mínimo `rowHeight`; medida e guardada por item
  na camada esparsa do virtualizador (como o detalhe); antes de medir,
  `rowHeight`.
- Continua linha de dados: seleção (clique fora de conteúdo interativo,
  caixa, Espaço com anúncio, Shift, Ctrl+A), `aria-selected`, barra de
  linha selecionada e `Highlight` em `forced-colors`, listra, `id`
  `row-N` (alvo do `aria-labelledby` do detalhe), master-detail pela
  célula de expansão, `removeRow` (part `removed`), exportação com os
  valores das colunas (o template é só visual, como na referência).
  Espaço/Enter dentro do conteúdo (depois de F2) são do conteúdo.
- Não editável (`editCell`/`editRow` devolvem `false`); linha nova
  (`addRow`) pendente nunca é linha inteira (precisa dos editores).
- Não se aplica a linhas de grupo, rodapés, detalhe e esqueletos.
- Foco: a célula ativa numa coluna comum de uma linha que vira inteira vai
  à célula única; quando deixa de ser, volta à coluna lembrada.
- Renderer: mesmas regras da spec 10 (diretiva `render/content.ts`, roda
  de novo quando item, `rowRenderer` ou idioma mudam (a decisão
  `false` fica guardada com o resultado);
  `ctx.signal` abortado ao sair da janela/grid desconectado; exceção →
  `console.error` uma vez e célula vazia; `HTMLElement` por slot no light
  DOM).

## Acessibilidade
- Linhas fixas: cada lado num `<tbody role="rowgroup" aria-label>` (nome
  pela i18n; 🔎 conferir se algum leitor lê; se nenhum, o conteúdo da fixa
  deve se identificar — documentado). Nada de `aria-live` nem texto por
  célula. `aria-rowindex` contínuo: fixas do topo `headerRows + 1…`;
  corpo `index + 1 + headerRows + top + offset`; fundo depois de todas as
  linhas; totais `allRows + headerRows + top + bottom + 1`;
  `aria-rowcount` soma as fixas. No `treegrid`, `aria-level="1"`.
- Linha inteira: `<tr role="row">`; a `gridcell` de largura total tem
  `aria-colindex = colunas iniciais + 1` e `aria-colspan` = colunas
  visíveis (+ botões). ←/→ entre as células iniciais e ela; ↑/↓ mudam de
  linha (a coluna lembrada volta nas linhas comuns); Enter/F2 levam ao 1º
  focável do conteúdo; Tab circula no conteúdo; Esc volta à célula (como a
  linha de detalhe). Conteúdo rebaixado da ordem de Tab (A12). Nome: o
  conteúdo.
- RTL: sticky por `inset-inline-start`; setas espelhadas como no resto.
- `forced-colors`: borda entre fixas e corpo e entre fixas do fundo e
  totais (não só por fundo). A classe interna `.pinned` (linha ativa fora
  da janela) não é reaproveitada.

## i18n
`fixedTopRowsLabel`, `fixedBottomRowsLabel` (14 idiomas).

## Fora de escopo
Fixar/desafixar pelo usuário (menu de contexto: frente 18 por cima desta
API); fixar linhas de `items` por chave com ordenação/filtro; `rowRenderer`
em linhas de grupo/rodapé; altura própria por função (`getRowHeight`);
`fixedTopItems` no `GridState`; edição de linhas fixas; linha inteira
dividida por seção de colunas fixas (`embedFullWidthRows`).

## Arquivos
`grid.ts` (propriedades, sequência de linhas, foco), `render/fixed-rows.ts`
(tbody fixo), `render/full-width-row.ts`, `features/keyboard.ts`
(sequência com fixas), `render/virtualizer.ts`, `export/*` (fixas),
`grid.styles.ts`, `grid-i18n.ts`.

## Testes
Navegador: fixas presas ao rolar, fora de ordenação/filtro/grupo/página,
com totais, colunas fixas, virtualização de colunas e RTL; linha inteira
com `false` em parte das linhas, seleção (com e sem caixas), detalhe, altura medida e
rolagem estável, colunas fixas/virtualizadas, grupo. Roteiro de teclado
(entra e sai das fixas e da linha inteira, Enter/F2/Esc, PageUp/PageDown
por blocos; com 3+3 fixas e totais, `elementFromPoint` no centro da célula
ativa devolve a própria célula; andar pelas fixas não muda o `scrollTop`;
remover a fixa focada; área de 256 px sem sticky; Tab numa linha inteira
mais alta que a área). `axe-core` (fixas, linha inteira com caixas,
`treegrid`, RTL). SSR. Exportação/Ctrl+C. Vazamento (renderers e `signal`
de linhas inteiras e fixas, grid de vida longa). Desempenho: 1 milhão de
linhas com 3+3 fixas e linhas inteiras (1 a cada 50), perfil fraco, sem
regressão da linha de base.

## Critério de pronto
`npm test`, `npm run test:perf`, `typecheck`, `lint` verdes; README e
`custom-elements.json`.

## Referência medida
Docs do AG Grid v36 "Row Pinning" e "Full Width Rows" e API do DevExtreme
`dataRowTemplate` (2026-11-18), ver "Referência". AG Grid não documenta
teclado nas fixas; a sequência adotada segue a ordem visual e o
`aria-rowindex`.

Revisão do desenho (`webcomponent-api-reviewer` e `a11y-reviewer`): todos
os achados acatados (`isFullWidthRow` → `fullWidthRows`, depois
trocado pelo `false` do próprio `rowRenderer` a pedido do usuário; `rowFixed` no
foco; `GridRowFixed` com `null`; parts com sufixo `-row`/`-row-group`;
`focusCell` com `rowFixed`; células iniciais reais na linha inteira; fixas
sem sticky quando ocupam demais; nomes dos `rowgroup`s).
