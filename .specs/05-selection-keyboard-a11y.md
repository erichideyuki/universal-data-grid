# 05 — Seleção, teclado e acessibilidade

## Objetivo
Grid operável só por teclado e leitor de tela, com foco de célula e seleção
de linhas — pré-requisito da edição (09).

## Referência
WAI-ARIA APG, padrão "Data Grid" (fonte primária para teclado/ARIA).
DevExtreme: `focusedRowEnabled`, `selection.mode`
(`none|single|multiple`), `showCheckBoxesMode`, `selectAllMode`
(`page|allPages`), `selectedRowKeys`; navegação por setas, Tab entre
elementos internos, Ctrl+A. AG Grid: `rowSelection`, foco de célula.

## Escopo — teclado (célula focada, *roving tabindex*)
| Tecla | Ação |
|---|---|
| ←/→/↑/↓ | célula vizinha (←/→ invertidos em RTL) |
| Home/End | 1ª/última célula da linha; Ctrl+Home/End: do grid |
| PageUp/PageDown | uma página (virtualizador rola e mantém foco) |
| Enter / F2 | entra no conteúdo interativo da célula (ou edição, 09) |
| Esc | volta o foco à célula |
| Espaço | seleciona a linha (com seleção ligada) |
| Shift+↑/↓ / Shift+Espaço | estende a seleção |
| Ctrl+A | seleciona tudo (multiple) |
| → / ← na linha de grupo | expande / recolhe |
| Alt+Shift+←/→ no cabeçalho | move a coluna (equivalente ao arrasto) |
| Ctrl+G no cabeçalho | agrupa/desagrupa pela coluna (equivalente ao arrasto) |

## Escopo — seleção
- `selection-mode="none|single|multiple"`, `show-checkboxes` (coluna de
  caixas com "selecionar tudo" no cabeçalho, estado misto).
- `selectedKeys` (usa a chave da frente 08 ou o objeto), `selectRows()`,
  `deselectRows()`, `clearSelection()`, `getSelectedItems()`.
- Clique seleciona; Ctrl+clique alterna; Shift+clique estende.
- Seleção sobrevive a ordenação, filtro, agrupamento e troca de `items`
  (pela chave). Selecionar tudo = linhas filtradas.
- `focusedRowKey` + evento `u-grid-focus-change`.
- Eventos: `u-grid-selection-change` (`{ selectedKeys, added, removed }`).

## ARIA
`role="grid"` com `aria-multiselectable`, `aria-rowcount`/`aria-colcount`
totais (virtualização), `aria-rowindex`/`aria-colindex` reais,
`aria-selected` nas linhas, `aria-expanded` + `aria-level` nas linhas de
grupo (`role="row"` com `aria-level` = nível + 1), `aria-sort` (03),
foco visível com `:focus-visible` e `--u-grid-focus-ring-*`. Arrasto de
coluna/grupo com alternativa de teclado (WCAG 2.1.1 e 2.5.7).

## API aprovada (2026-11-18, revisada pelo `webcomponent-api-reviewer`)
- `selectionMode` ↔ `selection-mode`: `'none' | 'single' | 'multiple'`
  (padrão `none`; em `none` os métodos são no-op e o setter guarda as
  chaves sem renderizar; `multiple`→`single` mantém só a última, com evento
  `source: 'api'`).
- `showCheckboxes` ↔ `show-checkboxes` (`booleanAttribute(false)`; só em
  `multiple`). A coluna de caixas não é `GridColumnDef`: fica fora de
  `columns`, dos índices de coluna e do seletor; é fixa no início.
- `selectedKeys: readonly unknown[]` (só propriedade; array congelado, mesma
  instância até a próxima mudança; setter sem evento). Sem `keyExpr` (08) a
  chave é o objeto do item; chaves ausentes de `items` ficam guardadas.
- `focusedRowKey: unknown` (só propriedade; setter sem evento e sem roubar o
  foco do DOM; chave ausente é ignorada; `null` leva a célula ativa ao
  1º cabeçalho).
- Métodos: `selectRows(keys, { append })`, `deselectRows(keys)`,
  `selectAll()` / `deselectAll()` (linhas que passam no filtro; só
  `multiple`), `clearSelection()`, `isRowSelected(key)`,
  `getSelectedItems()`, `focusCell(rowKey, column?): boolean` (não expande
  grupos), `focus(options?)` leva o foco à célula ativa.
- Eventos: `u-grid-selection-change` `{ selectedKeys, previous, added,
  removed, source }`; `u-grid-focus-change` `{ rowKey, column,
  previousRowKey, previousColumn, cellType, source }` (`cellType`:
  `'header' | 'data' | 'selection' | 'group'`). Disparam por gesto e por
  método, nunca por setter.
- CSS: `::part(selected)`, `::part(selection-cell)`,
  `::part(selection-checkbox)`, `--u-grid-selected-row-background-color`.
- Recusados: `delegatesFocus` (levaria o foco ao 1º elemento da barra, não
  à célula ativa); tipo `GridRowKey` (fica para a 08).

## Decisões na implementação
- Agrupado, a tabela vira `role="treegrid"` (como o AG Grid): `aria-level` e
  `aria-expanded` em `row` só valem em treegrid (o axe acusa
  `aria-conditional-attr` em `grid`). Sem grupos segue `grid`.
- `role` saiu do `<div>` contêiner para o `<table>`: a barra de grupos e o
  seletor de colunas ficam fora do grid (`role="toolbar"`, ponto de Tab
  próprio, roving entre os chips).
- Linha da célula ativa fora da janela virtual fica no DOM ("presa":
  `position: absolute`, invisível), antes/depois da janela na mesma ordem.
  O `keyedRows` passou a remover as partes que saem ANTES de inserir as
  novas, para não mover (e desfocar) a linha que fica.
- Botão de expandir do grupo: `tabindex="-1"` e `aria-hidden` (o foco e o
  estado estão na linha); a alça de redimensionar: `tabindex="-1"`, F2 no
  cabeçalho chega a ela.
- Revisão da implementação: célula ativa realocada (a linha/coluna saiu)
  não dispara `u-grid-focus-change` (nunca por setter, como aprovado);
  `single` na inicialização corta a seleção sem evento (só a troca
  `multiple`→`single` num grid renderizado dispara); o setter de
  `focusedRowKey` acerta as linhas antes (items trocados no mesmo tick).
  Recusados (API nova, sem aval): `previousCellType`, custom properties da
  caixa de seleção, part do "selecionar tudo", renomear
  `groupedAnnouncement`.
- Com a frente 07: rodapés de grupo e o rodapé de totais (`<tfoot>`, última
  linha da navegação) entram no roving tabindex; `GridCellType` ganhou
  `'summary'` (pendente de aval do usuário: tipo público). A linha de grupo
  continua um ponto só; os resumos alinhados às colunas entram no nome
  acessível dela. Células de resumo têm o nome pelo conteúdo (texto visível
  `aria-hidden` + rótulo completo `visually-hidden`), não por `aria-label`
  (axe `label-content-name-mismatch`, WCAG 2.5.3). Chips: Shift+F10/menu
  abrem o menu do painel; roving entre os chips.
- Com a frente 04: a linha de filtro é a 2ª linha do cabeçalho
  (`aria-rowindex` 2), fora do roving: os editores são pontos de Tab
  próprios (como no DevExtreme) e as setas ficam neles; ↓ do cabeçalho vai
  ao corpo. O funil do cabeçalho saiu da ordem de Tab (`tabindex="-1"`):
  F2 (funil, depois a alça) ou Alt+↓ (abre o popover); Esc fecha e volta ao
  funil, Esc de novo à célula. "Selecionar tudo" usa as linhas filtradas
  (`#sortedItems` já vem filtrado).
- Desempenho (spec 16): cenário `selection-1m` no `grid.perf.browser.test.ts`
  (Ctrl+A, limpar, ↓, PageDown, Ctrl+End com 1 milhão de linhas, no perfil
  de máquina fraca). Com o virtualizador próprio (escala acima de 15 M px),
  Ctrl+End chega à última linha.
- Com a `RowList` da spec 16 (sem objeto por linha), a célula ativa guarda
  a identidade da linha (item ou chave do grupo) e a acha por
  `RowList.indexOfItem`/`indexOfGroup`.

## i18n
`selectRow`, `selectAllRows` (não `selectAll`, que é da frente 04),
`columnMovedAnnouncement`, `groupedAnnouncement`, `ungroupedAnnouncement`,
`rowsSelectedAnnouncement` (sem plural: "Selected rows: {count}"). Sem
`groupExpanded`/`groupCollapsed`: o `aria-expanded` da linha já é lido.

## Fora de escopo
Seleção de intervalo de células (fase D).

## Arquivos
`features/keyboard.ts`, `features/selection.ts`, `render/*` (atributos ARIA),
`grid.styles.ts`, `grid-i18n.ts`.

## Testes
Navegação com virtualização (foco em linha que sai e volta da tela);
RTL; seleção por chave após ordenar/filtrar; checagem automática com
`axe-core` nos testes de navegador; roteiro manual com NVDA (Windows).

## Critério de pronto
Zero violações do axe; percorrer, agrupar, reordenar e selecionar sem mouse.

## Referência medida
DevExtreme 26.1, demo "Multiple Record Selection" (`showCheckBoxesMode:
always`, `selectAllMode: allPages`), 2026-11-18:
- Linhas com `role="row"`, `aria-selected="true|false"`, `aria-rowindex`;
  células `role="gridcell"` com `aria-colindex` (a coluna de caixas é a 1);
  caixas `role="checkbox"` com rótulos "Select row"/"Select all".
- Uma só célula com `tabindex="0"` (a focada); clicar numa célula só move o
  foco, não seleciona (modo `always`).
- Espaço na célula alterna a seleção da linha; a caixa do cabeçalho fica
  `aria-checked="mixed"` com seleção parcial.
- Divergência consciente: no DevExtreme (modo `always`) Shift+↓ só move o
  foco e Ctrl+A não seleciona; aqui seguimos a tabela da spec (APG):
  Shift+↑/↓ estende e Ctrl+A seleciona tudo em `multiple`.
APG "Data Grid": um ponto de Tab por grid (roving tabindex); Ctrl+Home/End
vão à 1ª/última célula da 1ª/última linha (o cabeçalho conta como linha).
