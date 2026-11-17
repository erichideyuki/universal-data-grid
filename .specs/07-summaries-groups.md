# 07 — Resumos e grupos completos

## Objetivo
Totais no rodapé e resumos por grupo, e completar o agrupamento (contagem,
expandir/recolher tudo, estado preservado, agrupar por intervalo).

## Referência
DevExtreme: `summary.totalItems` e `summary.groupItems` (`sum`, `min`,
`max`, `avg`, `count`, `custom`), `showInGroupFooter`,
`alignByColumn`, `displayFormat`; `grouping.contextMenuEnabled`,
`expandAll()`/`collapseAll(level)`, `autoExpandAll`, `column.groupCellTemplate`,
`calculateGroupValue`; `groupPanel.allowColumnDragging`.
AG Grid: `aggFunc`, `groupDisplayType`, `groupDefaultExpanded`.

## Escopo — API
- `summary: { total?: SummaryItem[]; group?: SummaryItem[] }` com
  `SummaryItem = { column, type: 'sum'|'min'|'max'|'avg'|'count'|((values,
  items) => unknown), format?, showInGroupFooter?, alignByColumn? }`.
- Coluna: `groupValue(item)` (agrupar por faixa, ex.: década, letra
  inicial), `allowGrouping` (padrão `true` se tiver valor).
- Métodos: `expandAll(level?)`, `collapseAll(level?)`, `expandGroup(path)`,
  `collapseGroup(path)`, `isGroupExpanded(path)`.
- `auto-expand-groups` continua (vira `autoExpandAll`, alias).
- Eventos: `u-grid-group-expand-change` (`{ path, expanded }`).

## Comportamento
- Linha de grupo mostra `{coluna}: {valor} ({n})` e os resumos
  `alignByColumn` na própria linha; `showInGroupFooter` cria linha de rodapé
  do grupo.
- Rodapé de totais fixo (`position: sticky; bottom: 0`) fora do
  virtualizador; recalcula com filtro.
- Menu de contexto no painel de grupos: desagrupar, desagrupar tudo,
  expandir/recolher tudo.
- Estado de expansão por caminho de chaves, preservado em troca de dados,
  ordenação e filtro (base vem da Fundação).
- Agregação incremental: resumos calculados no mesmo passo do agrupamento
  (uma passada).

## Acessibilidade
Rodapé `role="row"` dentro de um `rowgroup` próprio; resumo com rótulo
completo para leitor ("Sum of Population: 1,234").

## i18n
`sum`, `min`, `max`, `avg`, `count` (formatos com `{0}`), `ungroup`,
`ungroupAll`, `expandAll`, `collapseAll`.

## Fora de escopo
Resumos remotos (08), pivô (fase D).

## Arquivos
`row-model/summary.ts`, `row-model/group.ts`, `render/group-row.ts`,
`render/footer.ts`, `features/group-panel-menu.ts`.

## Testes
Agregações com nulos; média ignorando nulos; custom; resumos com filtro;
expansão preservada; `groupValue` por faixa.

## Referência medida
(preencher)
