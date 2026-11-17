# 06 — Recursos de coluna

## Objetivo
Redimensionar, fixar, ocultar (com seletor) e dimensionar automaticamente,
com o arrasto funcionando em RTL.

## Referência
DevExtreme: `allowColumnResizing` + `columnResizingMode`
(`nextColumn|widget`), `columnAutoWidth`, `columnMinWidth`, `fixed` +
`fixedPosition` (`left|right`, e `sticky` nas versões novas),
`columnChooser` (modo `dragAndDrop|select`), `visible`, `hidingPriority`.
AG Grid: `resizable`, `pinned`, `hide`, auto-size por duplo clique.

## Escopo — API
- Grid: `column-resizing` (booleano), `resize-mode="next-column|widget"`
  (padrão `widget`), `column-chooser` (booleano), `column-auto-width`.
- Coluna: `resizable`, `minWidth`, `maxWidth`, `fixed: 'start'|'end'|null`,
  `visible` (padrão `true`), `showInChooser`.
- Métodos: `setColumnWidth(column, px)`, `autoSizeColumn(column)`,
  `showColumnChooser()`.
- Eventos: `u-grid-column-resize` (ao soltar), `u-grid-column-visibility-
  change`, `u-grid-column-reorder` (já existe a ação; passa a ter evento).

## Comportamento
- Alça de 8 px na borda final do cabeçalho; duplo clique = auto-ajuste
  (mede cabeçalho + linhas visíveis). Teclado: Alt+←/→ no cabeçalho
  redimensiona de 16 em 16 px.
- Fixar usa `position: sticky` (cabeçalho, células, linha de grupo); sombra
  na borda quando há rolagem horizontal. Colunas fixas não entram na zona de
  arrasto das não fixas (reordena dentro do próprio bloco).
- Seletor: popover com lista de colunas e caixas; arrastar coluna para fora
  do cabeçalho até o seletor a oculta (modo `drag`).
- RTL: indicadores, alças e `fixed: 'start'` espelhados (`inset-inline-*`).

## Acessibilidade
Alça com `role="separator"`, `aria-orientation="vertical"`,
`aria-valuenow` = largura; seletor com caixas rotuladas.

## i18n
`columnChooser`, `hideColumn`, `showColumn`, `pinStart`, `pinEnd`,
`unpin`, `autoSize`.

## Fora de escopo
Bandas (13), menu da coluna completo (fase D), `hidingPriority` responsivo
(fase D).

## Arquivos
`features/resize.ts`, `features/column-chooser.ts`, `features/column-dnd.ts`,
`render/header.ts`, `render/cell.ts`, `grid.styles.ts`.

## Testes
Largura mínima respeitada; modo `next-column` conserva a soma; fixas com
rolagem horizontal; reordenar em RTL; ocultar a última coluna visível é
impedido.

## Critério de pronto
Demo com 30 colunas, 2 fixas à esquerda e 1 à direita, rolando liso.

## Referência medida
(preencher)
