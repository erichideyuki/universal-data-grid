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
DevExtreme 26.1, demos jQuery `ColumnResizing`, `FixedAndStickyColumns` e
`ColumnChooser` (Material Blue Light), medidas em 2026-11-17.

- **Redimensionar, `nextColumn`**: arrastar a borda de "Company Name" (225 px)
  128 px para a esquerda deu 97/304 — a vizinha absorve e a soma (401 → 400)
  se mantém. Arrastando além, parou em 50 px (`columnMinWidth: 50`) com a
  vizinha em 350: o mínimo vale e a soma continua.
- **Redimensionar, `widget`**: encolher "City" de 350 para 144 encolheu a
  tabela (887 → 679 px) e deixou espaço vazio no fim; as outras colunas não
  mudaram. Ao redimensionar, todas as colunas passam a ter largura em px.
- **Duplo clique** na borda não faz nada no DevExtreme (o auto-ajuste por
  duplo clique é do AG Grid; seguimos o AG Grid aqui, como pede a spec).
- **Alça/ARIA**: o DevExtreme usa um separador único sobreposto, sem papel
  ARIA e sem foco; cabeçalhos têm `tabindex=0`. Nós: alça por coluna com
  `role="separator"` focável (setas/Enter) + Alt+←/→ no cabeçalho.
- **`columnAutoWidth`**: colunas com a largura do conteúdo e o que sobra
  distribuído (a tabela ocupa a largura do grid).
- **Fixas**: `position: sticky` com `left`/`right` calculados; a coluna fixa
  vai para a ponta mesmo declarada no meio ("Department", `fixedPosition:
  'right'`, aparece por último). A borda do bloco fixo tem uma linha.
  Fixar/desafixar fica no menu de contexto do cabeçalho ("Fix → To the
  left/right", "Unfix"); como o menu da coluna é da fase D, os botões de
  fixar ficam no nosso seletor.
- **Seletor**: popup `role="dialog"` com `aria-label` "Column Chooser",
  ancorado no canto final do botão da barra (my "right top" / at "right
  bottom"), lista com caixas, busca e "selecionar tudo" (busca e selecionar
  tudo ficam fora daqui). No modo `dragAndDrop` o painel diz "arraste uma
  coluna aqui para ocultá-la".

Decisões: a última coluna visível não pode ser ocultada (pedido da spec);
eventos só para ações do usuário (API não dispara); mudar uma opção na
definição da coluna (ex.: `width`) vence a escolha do usuário para aquela
opção. O cabeçalho continua no `grid.ts` (sem `render/header.ts`): o layout
das colunas é calculado uma vez por render e usado no cabeçalho e nas
linhas.
