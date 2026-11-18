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

## Escopo — API (aprovada em 2026-11-18, revisada pelo `webcomponent-api-reviewer`)
- `<u-grid>`:
  - `summary: GridSummary | null` (só propriedade):
    `{ total?: GridSummaryItem[]; group?: GridGroupSummaryItem[] }`.
  - `GridSummaryItem = { column: GridColumnRef; type: GridSummaryType |
    GridSummaryAggregator; label?; format?: GridSummaryFormat | null; name? }`;
    `GridGroupSummaryItem` acrescenta `display?: 'inline' | 'column' |
    'footer'` (padrão `inline` = no texto da linha do grupo; `column` = sob a
    coluna, na linha do grupo; `footer` = rodapé do grupo).
  - `GridSummaryType = 'sum'|'min'|'max'|'avg'|'count'`;
    `GridSummaryAggregator = (values: readonly unknown[], items: readonly TItem[]) => unknown`;
    `GridSummaryFormat = Intl.NumberFormatOptions | Intl.DateTimeFormatOptions | ((value) => string)`;
    `GridColumnRef = string (path) | GridColumnDef`; `GridGroupPath = readonly unknown[]`.
  - `showGroupCount` / `show-group-count` (padrão `true`).
  - `groupPanelMenu` / `group-panel-menu` (padrão `true`).
  - `autoExpandGroups` mantido (NÃO vira `autoExpandAll`): vale no início;
    mudar limpa o estado de expansão.
- Métodos: `expandAllGroups(groupIndex?)`, `collapseAllGroups(groupIndex?)`,
  `expandGroup(groupPath)`, `collapseGroup(groupPath)`,
  `isGroupExpanded(groupPath)`, `getSummaryValues(groupPath?)` →
  `GridSummaryValue[]` (`{ item, value, text }`; sem `groupPath` = totais).
- Evento `u-grid-group-expansion-change`:
  `{ groupPath: GridGroupPath | null; groupIndex: number | null; expanded; source }`
  — gesto e API, só quando muda; `groupPath` nulo em `*AllGroups`.
- Coluna (`GridColumnDef` e `<u-grid-column>`): `groupValueGetter(item)` (só
  propriedade; ignora `dataType`/`comparator`/`format`/`displayValue` da
  coluna) e `groupable` (tri-estado; padrão `true` com `path`,
  `valueGetter` ou `groupValueGetter`; só limita o usuário).
- Parts: `summary-row`, `total-row`, `group-footer-row`, `summary-cell`,
  `group-count`, `group-panel-menu`. Custom properties:
  `--u-grid-summary-background-color`, `--u-grid-summary-cell-font-weight`.
- Recusado na revisão: renomear `type` para `aggregate` (fica o nome da spec).

## Comportamento
- Linha de grupo mostra `{coluna}: {valor} ({n})` e os resumos
  `display: 'column'` na própria linha; `display: 'footer'` cria linha de
  rodapé do grupo.
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
`summarySum`, `summaryMin`, `summaryMax`, `summaryAvg`, `summaryCount`,
`summaryText` (`{type}: {value}`), `summaryColumnText` (`{type} of {column}:
{value}`), `groupInfoText` (`({info})`), `ungroupColumn`, `ungroupAll`,
`expandAllGroups`, `collapseAllGroups`, `groupPanelMenu`.

## Fora de escopo
Resumos remotos (08), pivô (fase D).

## Arquivos
`row-model/summary.ts`, `row-model/group.ts`, `render/group-row.ts`,
`render/footer.ts`, `features/group-panel-menu.ts`.

## Testes
Agregações com nulos; média ignorando nulos; custom; resumos com filtro;
expansão preservada; `groupValue` por faixa.

## Referência medida
DevExtreme (demos "Group Summaries", "Total Summaries", "Record Grouping",
2026-11-18):
- Linha de grupo: `Employee: Jim Packard (3 orders)` — contagem só com
  resumo `count` no grupo (nós mostramos sempre, `showGroupCount`); resumos
  `alignByColumn` em células próprias da linha do grupo (a célula do rótulo
  vai até a coluna anterior ao 1º resumo alinhado), texto `Max: $20,500`.
- Rodapé do grupo (`showInGroupFooter`): linha `role="row"` depois dos itens,
  só com o grupo expandido; células vazias nas outras colunas.
- Rodapé de totais: fora da área rolável, sob as colunas; `Count: 39`,
  `Sum: $431,000`; alinhamento da coluna.
- Rótulo acessível de cada resumo: `"{coluna} {tipo}: {valor}"`
  (`aria-label="Sale Amount Sum: $431,000"`).
- Menu de contexto do chip no painel: Desagrupar, Desagrupar tudo, Mover à
  esquerda/direita (mover fica com a frente 05). Expandir/recolher tudo é
  nosso (spec).

Medido aqui no perfil de máquina fraca (`npm run test:perf`, cenário
`summaries-1m` da spec 16: 1 milhão de linhas × 24 colunas, 4 totais e 3
resumos de grupo, 2º nível por faixa): ligar os resumos ~300 ms, agrupar
~380 ms, agrupar por faixa ~630 ms, expandir tudo ~22 ms, recolher tudo
~15 ms, trocar `items` ~1 s (orçamento 1,5 s). `min`/`max` comparam por
chave numérica (texto ISO/número convertido uma vez por valor distinto) e
reagrupar não recalcula os totais — sem isso eram 1,4–2,2 s.
