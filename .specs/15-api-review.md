# 15 — Revisão da API pública

Revisão de toda a API pública do `<u-grid>` / `<u-grid-column>` pelo
subagente `webcomponent-api-reviewer` (`.claude/agents/`), em 2026-11-17,
sobre a `main` em `98f3fce` (Fundação, 02, 03, 06 e 14). Os achados
principais foram conferidos no código.

**Estado: propostas aguardando o aval do usuário.** Nada foi mudado na API
ainda. Coluna "Aval" é preenchida com a decisão; só o aprovado é
implementado, e o que quebra compatibilidade ganha alias com aviso de
deprecação no console (uma vez por instância) e `@deprecated` no JSDoc/CEM.

## Regras de nomenclatura (valem para as próximas frentes)

- Propriedade camelCase ↔ atributo kebab-case, sempre explícito no
  `@property` (`rowHeight` ↔ `row-height`). Função/objeto/array:
  `attribute: false`.
- Booleanos de atributo: sem atributo = padrão; `"false"` desliga; outro
  valor liga (conversor único, igual ao do `<u-grid-column>`).
- Nada de atributo `data-*`, nem nome que sombreie membro de `HTMLElement`.
- Membros `_x` são internos: `/** @internal */` (somem das `.d.ts` e do CEM).
- Custom properties só `--u-grid-<parte>-<propriedade>`; tokens do design
  system (`--u-color-*`, `--u-title-*`, …) só como fallback.
- Métodos de coluna: verbo + `Column` (`sortColumn`, `groupColumn`,
  `ungroupColumn`, `moveColumn`, `setColumnWidth`, `autoSizeColumn`);
  estado: `get*`/`clear*` (`getSorting`, `clearSorting`, `getGrouping`).
- Eventos `u-grid-<substantivo>-<verbo>`: depois = presente
  (`u-grid-sort-change`, `u-grid-column-resize`, `u-grid-load`,
  `u-grid-edit-cancel`); antes = gerúndio e `cancelable`
  (`u-grid-sorting`, `u-grid-saving`). No `detail`, o valor anterior é
  `previous<Campo>` (`previousWidth`, `previousIndex`).

## Achados e propostas

| # | Item | Problema | Proposta | Quebra? | Sev. | Aval |
|---|---|---|---|---|---|---|
| 1 | `rowHeight`, `showRowLines`, `showColumnLines` (`grid.ts:330-335`) | Atributos minúsculos colados (`rowheight`, `showrowlines`, `showcolumnlines`) vs. kebab no resto | `row-height`, `show-row-lines`, `show-column-lines`; os antigos lidos com aviso | sim (alias) | ALTA | |
| 2 | `showGroupPanel`, `showColumnHeaders`, `showRowLines` (padrão `true`) | Não dá para desligar por HTML (`show-group-panel="false"` liga) | Conversor de booleano do `<u-grid-column>` em todos os booleanos do `<u-grid>`: `"false"` desliga | não | ALTA | |
| 3 | `<u-grid-column data-type>` (`grid-column.ts:75`) | `data-*` é do autor da página (vai para `dataset`) | Atributo `type` (propriedade segue `dataType`); `data-type` lido com aviso | sim (alias) | ALTA | |
| 4 | 25 membros `_` (`_groupColumns`, `_regularColumns`, `_columnChanged`, `_nativeColumnMap`, `_userSetFixed`…) | Aparecem nas `.d.ts` e no CEM como API | `/** @internal */` + `stripInternal`; tirar `implements ResizeHost` da declaração | não | ALTA | |
| 5 | `--u-grid-header-height` | Dois sentidos: barra de grupos (56px) e `<th>` (46px) | `--u-grid-toolbar-height` e `--u-grid-header-cell-height`; antigo como fallback da barra | sim (alias) | ALTA | |
| 6 | `--u-table-hover-opacity` | Documentado, mas sem efeito (classe `.hover` nunca aplicada; bloco `:root` morto no shadow) | Implementar hover de linha com `--u-grid-row-hover-opacity` (antigo como fallback) ou tirar do README | não | ALTA | |
| 7 | `--u-table-*`, `--u-td-*`, `--u-th-*` | Fora do prefixo `--u-grid-` | `--u-grid-cell-padding` (+`-block`/`-inline`), `--u-grid-toolbar-padding` (+`-block`/`-inline`), `--u-grid-cell-font-size`/`-weight`, `--u-grid-header-cell-font-size`/`-weight`; antigos como fallback | sim (alias) | ALTA | |
| 8 | `--u-group-*` (chip) | Fora do prefixo | `--u-grid-group-chip-{height,outline-color,outline-width,shape,padding,font-size,line-height,letter-spacing,font-weight}`; antigos como fallback | sim (alias) | ALTA | |
| 9 | Propriedade `sorting` (modo) | Mesmo nome do estado (`getSorting()`, `detail.sorting`, `u-grid-sorting`); a frente 11 vai precisar dele | `sortMode` / `sort-mode` (irmão de `resizeMode`), tipo `GridSortMode`; `sorting` como alias | sim (alias) | ALTA | |
| 10 | Classe `UmDataGridColumn` | Destoa de `DataGrid` e não é exportada | `DataGridColumn`, exportada; `UmDataGridColumn` como tipo `@deprecated` | não | MÉDIA | |
| 11 | `npm run analyze` (glob `src/**/*.ts`) | CEM inclui módulos internos e `u-grid-custom-cell` | Globs só dos 4 arquivos públicos; `@internal` no custom-cell | não | MÉDIA | |
| 12 | `items` com `type: Array` | Gera atributo JSON `items` no CEM; README diz "property only" | `attribute: false` | não | MÉDIA | |
| 13 | `<u-grid-column wrap>` | `wrap="false"` liga, ao contrário de `sortable`/`visible` | Mesmo conversor do #2 | não | MÉDIA | |
| 14 | `groupIndex` no `<u-grid-column>` | No elemento reagrupa ao mudar; no `GridColumnDef` é só inicial | Inicial nos dois; reagrupar por `groupColumn`/`ungroupColumn` (aviso ao detectar mudança) | sim (comportamento) | MÉDIA | |
| 15 | Fixar e agrupar | Sem evento (visibilidade tem); sem getter do agrupamento | `u-grid-column-fixed-change` `{column, fixed, previousFixed}`; `u-grid-group-change` `{grouping, previous}`; `getGrouping()` | não | MÉDIA | |
| 16 | Quando os eventos disparam | Ordenação dispara também por API; coluna só por gesto — não documentado | Documentar no README; `source: 'user' \| 'api'` no `GridSortEventDetail` | não | MÉDIA | |
| 17 | `showColumnChooser()` | Prefixo `show*` é das props booleanas; não há fechar | `openColumnChooser()` + `closeColumnChooser()`; `showColumnChooser` como alias | sim (alias) | MÉDIA | |
| 18 | JSDoc público | Em pt-BR (CEM sai em português); vários membros sem JSDoc | JSDoc em inglês em toda a superfície pública | não | MÉDIA | |
| 19 | CEM | Sem `cssProperties`/`cssParts`; eventos sem tipo do `detail` | `@cssprop`, `@csspart`, `@fires u-grid-x {CustomEvent<Detail>}` | não | MÉDIA | |
| 20 | `::part(cell)` | Só existe na célula de "sem dados" | `part="cell"` em toda célula de dados; vazio fica `no-data` | leve | MÉDIA | |
| 21 | `--u-grid-stripped-background-color` | Erro de grafia (como `stripped` → `striped`) | `--u-grid-striped-background-color`; antigo como fallback | sim (alias) | MÉDIA | |
| 22 | README | Diverge do código (padrão de `sortable`, exemplo com `rowheight`, custom properties faltando/mortas) | Atualizar junto com as mudanças aprovadas | não | MÉDIA | |
| 23 | `renderer` | Cria `<div slot>` no light DOM do hospedeiro (conflita com React/Vue/Angular que geram os filhos) | Documentar em "Custom cell rendering" e "Using with frameworks" (a frente 10 refaz o renderer) | não | MÉDIA | |
| 24 | `sortBy` | Destoa de "verbo + `Column`"; falta `ungroupColumn` | `sortColumn(column, order, {append})` com alias `sortBy`; `ungroupColumn(column)`; `groupColumn(column, targetIndex?)` | sim (alias) | BAIXA | |
| 25 | `--u-grid-drop-indicator-bg` | Abreviação; README já chama de "color" | `--u-grid-drop-indicator-color`; antigo como fallback | sim (alias) | BAIXA | |
| 26 | `--u-grid-borders-width`, `-row-lines-height`, `-column-lines-width`, `-border-opacity` | Plural/`height` para espessura, radicais misturados | `--u-grid-line-width`, `--u-grid-row-line-width`, `--u-grid-column-line-width`, `--u-grid-line-opacity`; antigos como fallback | sim (alias) | BAIXA | |
| 27 | `--u-grid-grouping-cell-emphasis`, `--u-grid-toggle-*` | Vaza classe interna; "toggle" de quê | `--u-grid-group-row-emphasis`, `--u-grid-group-toggle-color`/`-shape`; antigos como fallback | sim (alias) | BAIXA | |
| 28 | Chaves `GridI18n` `clearSorting`, `pinStart`/`pinEnd`/`unpin` | Anúncio com nome de método; `pin` vs. radical `fixed` | `sortClearedAnnouncement`, `fixStart`, `fixEnd`, `unfix`; `setGridTranslation` aceita as antigas com aviso | sim (alias) | BAIXA | |
| 29 | `detail` de `u-grid-column-reorder` | `fromIndex`/`toIndex` vs. `previous*` dos irmãos | Acrescentar `index`/`previousIndex`; antigos `@deprecated` | não | BAIXA | |
| 30 | `any` na superfície | `items: any[]`, callbacks `(item: any)` | `GridColumnDef<TItem = any>` genérico; `renderer` retorna `HTMLElement \| null` | não | BAIXA | |
| 31 | `path` no CEM | Aponta `src/*.ts` (não publicados) | Reescrever para `dist/*.js` no analyzer | não | BAIXA | |
| 32 | README "frameworks" | Sem exemplo de eventos; React 19 grava atributo se o elemento não estiver definido | Exemplos React/Angular/Vue de evento + nota de importar antes do 1º render | não | BAIXA | |
| 33 | Eventos previstos nas specs 08/09 (`u-grid-loaded`, `u-grid-saved`, `u-grid-edit-canceled`, `u-grid-editing-start`) | Fogem da regra de eventos | `u-grid-load`, `u-grid-save`, `u-grid-edit-cancel`, `u-grid-edit-start` (ajustar as specs) | não | BAIXA | |

## Inventário (antes da revisão)

**`<u-grid>` (`DataGrid`)** — propriedade → atributo → padrão: `items` →
`items` (JSON, não intencional) → `[]`; `columns` → — → `[]`; `language` →
`language` → automático; `autoExpandGroups` → `auto-expand-groups` →
`false`; `sorting` → `sorting` → `'single'`; `rowHeight` → `rowheight` →
`48`; `striped` → `striped` → `false`; `showGroupPanel` →
`show-group-panel` → `true`; `showColumnHeaders` → `show-column-headers` →
`true`; `showRowLines` → `showrowlines` → `true`; `showColumnLines` →
`showcolumnlines` → `false`; `columnResizing` → `column-resizing` →
`false`; `resizeMode` → `resize-mode` → `'widget'`; `columnChooser` →
`column-chooser` → `false`; `columnAutoWidth` → `column-auto-width` →
`false`. Deprecados: `stripped`, `showHeader`.

**`<u-grid-column>` (`UmDataGridColumn`)**: `path`, `label` (texto),
`width`, `min-width`, `max-width`, `group-index`, `data-type`, `format`*,
`alignment`, `valueGetter`*, `displayValue`*, `boolean-display`, `wrap`,
`empty-text`, `renderer`*, `resizable`, `fixed`, `visible`,
`show-in-chooser`, `sortable`, `sort-order`, `sort-index`, `comparator`*
(* só propriedade).

**Métodos**: `sortBy(column, order, {append?})`, `clearSorting()`,
`getSorting()`, `groupColumn(column, targetIndex)`,
`moveColumn(column, targetIndex)`, `setColumnWidth(column, width)`,
`autoSizeColumn(column)`, `showColumnChooser()`.

**Eventos** (`bubbles` + `composed`): `u-grid-sorting` (cancelável) e
`u-grid-sort-change` `{sorting, previous}` — usuário e API;
`u-grid-column-resize` `{column, width, previousWidth, nextColumn?,
nextColumnWidth?}`, `u-grid-column-visibility-change` `{column, visible}`,
`u-grid-column-reorder` `{column, fromIndex, toIndex}` — só usuário.

**Parts**: `row`, `group-row`, `odd`/`even`, `cell` + `no-data` (só vazio),
`header-cell`, `sort-indicator`, `group-chip`, `column-chooser`.
