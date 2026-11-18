# 19 — Intervalo de células

## Objetivo
Seleção retangular de células como numa planilha (um ou vários intervalos),
copiar e colar intervalos e resumo (contagem/soma/média) do selecionado,
sem custo por célula fora da janela visível e sem ambiguidade com a seleção
de linhas da frente 05.

## Referência
AG Grid Enterprise "Cell Selection" (`cellSelection`, `suppressMultiRanges`,
`CellRange`, `cellSelectionChanged`, `processCellFromClipboard`, barra de
status com agregação) e o comportamento de planilha (Excel/LibreOffice:
Shift+setas, Ctrl+Shift+setas, Shift+F8, colar em mosaico). O DevExtreme
DataGrid não tem seleção de intervalo (só foco de célula), então o oráculo
aqui é o AG Grid e, onde ele não cobre, a planilha.

## Escopo
- Modo de seleção de células independente do `selectionMode` (linhas).
- Gestos: clique, arrasto (com rolagem automática nas bordas), Shift+clique,
  Ctrl/Cmd+clique e Ctrl/Cmd+arrasto (vários intervalos), Shift+setas,
  Ctrl+Shift+setas, Shift+Home/End, Ctrl+Shift+Home/End, Shift+PageUp/Down,
  Ctrl+A, Shift+F8 (adicionar intervalo pelo teclado).
- Intervalo atravessando colunas fixas (início/meio/fim achatados na ordem
  de exibição), bandas (só folhas) e virtualização de linhas e colunas
  (intervalo é retângulo de índices; nada por célula).
- Copiar intervalo(s): TSV + HTML com a proteção contra fórmula da 12.
- Colar intervalo nas células editáveis pela edição da 09 (validação,
  `changes`), com evento cancelável.
- Resumo opcional (contagem, soma, média) numa barra abaixo do grid e por
  método.

## API (revisada pelo `webcomponent-api-reviewer` e pelo `a11y-reviewer` — aguardando aval)

### `<u-grid>` — propriedades
- `cellSelectionMode` ↔ `cell-selection-mode`: `'none' | 'single' |
  'multiple'` (tipo `GridCellSelectionMode`, padrão `'none'`; valor
  inválido = `'none'`). `single` = UM intervalo retangular (não uma
  célula); `multiple`: Ctrl/Cmd+clique, Ctrl/Cmd+arrasto e Shift+F8 somam
  intervalos. Trocar para `none` limpa; `multiple`→`single` fica só com o
  ativo. Com `none` nada muda em relação à 05/12.
- `showCellRangeSummary` ↔ `show-cell-range-summary`
  (`booleanAttribute(false)`): barra com contagem/soma/média quando a
  seleção tem 2+ células.
- `clipboardMode` ganha `'copy-paste'` (`'copy' | 'copy-paste' | 'none'`,
  padrão segue `'copy'`; "may gain members"): colar é opt-in e exige também
  `allowEditing` e coluna `editable`.

### Tipos
- `GridCellRange<TItem = any>` (congelado): `startRowIndex`, `endRowIndex`,
  `startColumn`, `endColumn` (`GridColumnDef` folha). Índice = posição no
  corpo exibido (página atual com paginação), contando linhas de grupo,
  detalhe e rodapé (que ficam fora da seleção); cabeçalho, linha de filtro e
  linhas fixas (frente 20) não contam. `start` é a âncora; `end` o canto que
  anda (pode vir antes da âncora).
- `GridCellRangeInit`: igual, com colunas `GridColumnRef`.
- `GridCellRangeSummary`: `{ count, numericCount, sum, avg, complete }`
  (`count`: células não vazias, cada uma uma vez mesmo com sobreposição;
  `sum`/`avg`: `null` sem número; `complete: false` quando linhas não
  carregadas — fonte remota — ficaram de fora).

### Métodos
- `getCellRanges(): GridCellRange[]` — cópia, na ordem de criação; o
  último é o ativo.
- `selectCellRange(range: GridCellRangeInit, options?: { append?: boolean
  }): boolean` — `false` sem mudança se o modo for `none`, a coluna não
  existir/não for de dados, o índice estiver fora ou o intervalo for 1×1 sem
  `append`; `append` em `single` substitui. Leva a célula ativa ao `end`
  (`u-grid-focus-change` com `source: 'api'`), sem roubar o foco do DOM.
- `clearCellRanges(): void`.
- `getCellRangeSummary(options?: { signal?: AbortSignal }):
  Promise<GridCellRangeSummary>` — foto dos intervalos na chamada, em
  fatias; só rejeita (`AbortError`) pelo `signal`.
- `getRowIndex(rowKey): number` (`-1` fora do corpo exibido/da página) e
  `getRowKey(rowIndex): unknown` (`undefined` em grupo, detalhe, rodapé ou
  linha não carregada) — ligam índice e chave para o hospedeiro.
- `focusCell(rowKey, column?)` e `editCell(rowKey, column)` passam a aceitar
  `GridColumnRef` (alargamento compatível; regra para métodos novos de
  coluna registrada na 15).

### Eventos (`bubbles`, `composed`)
- `u-grid-cell-range-change` `GridCellRangeChangeEventDetail { ranges,
  previous, source }` — por gesto e por método; no arrasto, uma vez ao
  soltar. Também quando o grid limpa por mudança de linhas/colunas (só se
  havia intervalo; um por ciclo, depois do evento da causa, nada se a causa
  foi cancelada): `source: 'user'` se a causa foi gesto, `'api'` para
  método ou setter (`items`, `columns`, `dataSource`, `cellSelectionMode`…)
  — exceção registrada na 15, como o ajuste de página.
- `u-grid-copying` (já existe): `detail` ganha `ranges: readonly
  GridCellRange[]` (vazio ao copiar linhas ou a célula ativa); com
  intervalos, `items` = linhas distintas na ordem de exibição e `columns` =
  união das colunas na ordem de exibição.
- `u-grid-pasting` (cancelável, só gesto, sem `source`)
  `GridPasteEventDetail { text, values: string[][], range: GridCellRange,
  clipboardData }` — antes de qualquer mudança. `values` é do grid e pode
  ser editado no ouvinte (contrato do `data` de `u-grid-row-adding`);
  `range` = área final escrita (depois do mosaico e do corte). Cancelado, o
  grid não altera nada nem chama `preventDefault` no `paste` nativo. Depois
  seguem os eventos da 09.

### CSS
- Parts: `selected` junto de `cell` (`::part(cell selected)`, espelho de
  `row selected`; README avisa que `::part(selected)` sozinho pega os dois),
  `cell-range-summary` (a barra).
- Custom properties: `--u-grid-selected-cell-background-color`,
  `--u-grid-cell-range-border-color`, `--u-grid-cell-range-border-width`.

### Menu da célula (2.5.7) — depende da frente 18
Alternativa de ponteiro único ao arrasto (Shift+clique depende do
teclado, não vale para o 2.5.7): itens "Estender seleção até esta célula"
e, em `multiple`, "Adicionar célula à seleção" no menu de contexto da
célula de dados (clique direito, Shift+F10, tecla Menu; Esc e as ações
devolvem o foco à célula). A frente 18 faz o menu de contexto: os itens
entram nele.

## Comportamento
- Intervalo = retângulo de índices (linha no corpo exibido × coluna de
  dados na ordem de exibição — fixas do início, meio e fixas do fim
  achatadas, como no AG Grid). Só células de dados: linhas de grupo,
  detalhe, rodapé e totais e as colunas de caixa, detalhe e comandos ficam
  fora (não marcadas, não copiadas, não coladas, fora do resumo).
- Um 1×1 só existe com mais de um intervalo (Ctrl+clique); sozinho não
  marca nada (navegação comum não vira seleção).
- Limpam os intervalos: ordenar, filtrar, agrupar, expandir/recolher,
  paginar, trocar `dataSource`, inserir/remover linha, mover/ocultar/fixar
  coluna, e trocar `items` com outra quantidade de linhas. Trocar `items`
  com a mesma quantidade (ex.: o `items` do `u-grid-save` reatribuído)
  mantém. Rolar não limpa.
- Foco: a célula ativa (roving tabindex) é sempre o `end`: Shift+setas,
  soltar o arrasto, Shift+clique e Ctrl+clique levam o foco a ele. Depois do
  Ctrl+A a ativa não muda; o 1º Shift+seta recomeça o intervalo com a
  âncora na ativa. Enter/F2 editam o `end`; seta sem Shift parte dele.
  (Divergência consciente do AG Grid, Excel e Sheets, que deixam a ativa na
  âncora: só a célula que recebe foco tem o "selecionado" lido.)
- Convivência com a 05 (os dois modos ligados): nas células de dados,
  clique/arrasto/Shift/Ctrl/Ctrl+A são do intervalo e não mudam a seleção
  de linhas; linhas pela coluna de caixas (clique, Shift+↑/↓/PageUp/Down e
  Ctrl+A nela continuam da 05) e por Espaço/Shift+Espaço nas células. Sem
  `showCheckboxes` nesse caso: `console.warn` uma vez recomendando.
- Ctrl/Cmd+C (de célula navegável): com intervalo → intervalos; senão
  linhas selecionadas; senão célula ativa (regra da 12 mantida). Vários
  intervalos saem empilhados na vertical, na ordem de criação (AG Grid).
  Limite de células (`MAX_COPY_CELLS`, interno, medido no perfil fraco):
  acima, não copia e anuncia; quem quiser mais usa `getExportData`. Linhas
  não carregadas no intervalo: não copia e anuncia.
- Colar (Ctrl/Cmd+V, `paste` nativo, `text/plain` TSV com aspas como o
  Excel gera): destino = intervalo ativo (canto superior esquerdo) ou célula
  ativa. Bloco 1×1 preenche o intervalo; intervalo múltiplo exato do bloco →
  mosaico; senão o bloco a partir do canto, cortado na borda (não cria
  linhas). Pula não editáveis, removidas (lote) e não carregadas. Tira o `'`
  que a 12 põe antes de `= + - @` (ida e volta). Converte pelo tipo da
  coluna no idioma (parser dos editores) e valida pelas regras: no lote fica
  pendente; em célula/linha salva de uma vez (um `u-grid-saving`); inválidos
  ficam pendentes marcados, foco no 1º, anúncio da 09. Mesmo limite da
  cópia. Com editor aberto o `paste` é do editor.
- Resumo: soma/média só de valores numéricos (o valor, não o texto),
  formatados no idioma (`Intl.NumberFormat`); contagem de não vazias. Em
  fatias, cancelado a cada mudança; linhas não carregadas ficam fora.
- Arrasto: botão principal do mouse/caneta, captura de ponteiro, rolagem
  automática perto das bordas (linhas e colunas virtualizadas). Não começa
  em editor, caixa, botão ou alça. Toque rola (não há arrasto de toque a
  substituir).

## Acessibilidade (desenho revisado)
Teclado (foco numa célula de dados, modo ≠ `none`; ← → espelhados em RTL):

| Tecla | Ação |
|---|---|
| Shift+←/→/↑/↓ | estende o intervalo ativo uma célula (pula linhas e colunas que não são de dados) |
| Ctrl+Shift+setas | estende até a borda do grid |
| Shift+Home/End | até a 1ª/última coluna de dados da linha |
| Ctrl+Shift+Home/End | até a 1ª/última célula de dados do grid |
| Shift+PageUp/PageDown | estende uma página |
| Ctrl+A | todas as células de dados (um intervalo); na coluna de caixas, todas as linhas (05) |
| Shift+F8 (Mac: Fn+Shift+F8) | liga/desliga "adicionar à seleção" (`multiple`): setas andam sem desfazer, o próximo Shift+seta começa outro intervalo. Desliga com Esc, Shift+F8, foco saindo do grid ou troca de modo |
| Setas, Home/End, PageUp/Down sem Shift | movem a ativa e desfazem os intervalos (fora do modo "adicionar") |
| Espaço / Shift+Espaço | seleção de linhas (05), com `selectionMode` ≠ `none` |
| Ctrl/Cmd+C, Ctrl/Cmd+V | copiar / colar |

- ARIA: `aria-multiselectable="true"` no `<table>` com modo ≠ `none`;
  `aria-selected` nas células de dados renderizadas (só a janela). Se o
  NVDA/JAWS lerem "não selecionado" a cada seta, só `true` é emitido (como
  o AG Grid) — conferir no roteiro manual da 17, junto com "linha
  selecionada + intervalo".
- Anúncio (região polite do grid, só o último depois de 500 ms sem
  mudança; cancelado por outro anúncio, ao limpar e no
  `disconnectedCallback`): "Selected cells: {cells}. Rows: {rows},
  columns: {columns}" (números com `Intl.NumberFormat`); com vários,
  "Selected ranges: {count}. Cells: {cells}". Nada ao limpar (o "Copied
  cells: 1" seguinte mostra o efeito). Shift+F8 anuncia ligado/desligado.
  Copiar/colar anunciam a contagem (colar: "Skipped: {skipped}" quando há).
- Barra (`part="cell-range-summary"`, fora do `<table>`): `role="status"`
  + `aria-atomic`, texto trocado só ao fim dos mesmos 500 ms e do cálculo;
  `lang` da tradução; quebra de linha a 320 px (1.4.10). Também mostra,
  visível, "Adicionando à seleção" enquanto Shift+F8 está ligado (mesmo sem
  `showCellRangeSummary`).
- Visual: tinta de fundo + contorno de borda real (`::after`, propriedades
  lógicas) nas bordas externas de cada intervalo. Célula ativa dentro do
  intervalo: anel + faixa clara (`box-shadow: inset 0 0 0 4px surface`,
  como a inválida) para não se fundir ao contorno (2.4.7, 1.4.11).
  `forced-colors`: contorno `Highlight` (`HighlightText` em linha
  selecionada), anel `CanvasText` com `outline-offset: -4px`.

## i18n
`cellRangeSelectedAnnouncement`, `cellRangesSelectedAnnouncement`,
`addToSelectionOnAnnouncement`, `addToSelectionOffAnnouncement`,
`addingToSelection` (texto visível), `cellsCopiedAnnouncement`,
`cellsPastedAnnouncement`, `cellsSkippedAnnouncement`,
`copyLimitExceededAnnouncement`, `pasteLimitExceededAnnouncement`,
`rowsNotLoadedAnnouncement`, `cellRangeSummaryLabel`,
`extendSelectionToCell`, `addCellToSelection` (itens do menu da 18) — nos
14 idiomas. Contagem/soma/média reaproveitam `summaryCount`/`summarySum`/
`summaryAvg`.

## Fora de escopo
Selecionar coluna/linha inteira pelo cabeçalho; desmarcar parte de um
intervalo com Ctrl; alça de preenchimento, Ctrl+D, Ctrl+Enter, Delete para
limpar; colar criando linhas; desfazer (outra frente); intervalos no
`GridState` (11); linhas fixas (frente 20) dentro dos intervalos;
`copySelection()` por API e o menu de contexto em si (frente 18).

## Arquivos
`row-model/cell-range.ts` (retângulos, união por linha, mosaico de colagem,
TSV de entrada), `features/cell-range.ts` (controller: gestos, arrasto,
rolagem automática, anúncios), `features/clipboard.ts` (copiar/colar),
`render/*` (atributos e classes nas células), `grid.ts`, `grid.styles.ts`,
`grid-i18n.ts`.

## Testes
Unitários dos retângulos/união/mosaico/parse TSV; navegador: gestos de
mouse e teclado, LTR/RTL, fixas, bandas, virtualização (intervalo que sai e
volta da janela), copiar (TSV/HTML/fórmula), colar (lote/célula, validação,
cancelamento), resumo, convivência com a 05; axe; roteiro de teclado
(Shift+F8 → seta → Shift+seta → Esc, foco e anúncios; foco no `end` após
arrasto, Shift+clique e Ctrl+A; Shift+↑/↓ na coluna de caixas); anel ≠
contorno pela cor computada; `forced-colors` com linha selecionada +
intervalo; SSR; vazamento (`leak.ts`); perf `cell-range-1m` (1 milhão × 300
colunas, perfil fraco: Ctrl+A, Shift+setas, copiar o maior intervalo
permitido, resumo).

## Critério de pronto
`npm test`, `npm run test:perf`, `typecheck`, `lint` verdes; axe sem
violações; README e `custom-elements.json`.

## Referência medida
AG Grid 36.3 (Enterprise, exemplo "Cell Selection › Range Selection",
2026-11-18):
- `role="grid"` com `aria-multiselectable="true"`; células selecionadas com
  `aria-selected="true"`, as demais SEM o atributo; linhas sem
  `aria-selected`. Nenhum anúncio de intervalo (a região viva só tem
  "Loading...").
- Shift+↓↓ + Shift+→: intervalo 3×2; o FOCO FICA NA ÂNCORA.
- Ctrl+clique: adiciona intervalo; foco vai à célula clicada.
- Ctrl+A: todas as células; foco não muda.
- Shift+PageDown e Shift+End: só movem o foco, sem intervalo (a planilha
  estende — seguimos a planilha, como pede o escopo).
- Docs: vários intervalos copiados empilhados na vertical; colar: começa
  na célula ativa; intervalo maior que o bloco repete se couber exato,
  senão cola só o bloco no início; intervalo atravessa fixas sem lacunas
  ("achatar" o grid).
