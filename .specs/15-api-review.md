# 15 — Revisão da API pública

Revisão de toda a API pública do `<u-grid>` / `<u-grid-column>` pelo
subagente `webcomponent-api-reviewer` (`.claude/agents/`), em 2026-11-17,
sobre a `main` em `98f3fce` (Fundação, 02, 03, 06 e 14). Os achados
principais foram conferidos no código.

**Estado: todas as 33 propostas aprovadas pelo usuário ("Aprovo todas") e
implementadas** no branch da revisão. O que quebra compatibilidade ganhou
alias com aviso de deprecação no console (uma vez por instância; por página
nas chaves de i18n) e `@deprecated` no JSDoc/CEM. A lista de nomes antigos →
novos está no README ("Deprecated names").

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
  (`u-grid-sorting`, `u-grid-saving`) — todo gerúndio é cancelável. No
  `detail`, o estado anterior inteiro (lista) é `previous` (`sorting` /
  `previous`, `grouping` / `previous`); o valor anterior de um campo de uma
  coluna é `previous<Campo>` (`previousWidth`, `previousIndex`,
  `previousFixed`). Eventos que também disparam por API levam
  `source: 'user' | 'api'`.

## Achados e propostas

| # | Item | Problema | Proposta | Quebra? | Sev. | Aval |
|---|---|---|---|---|---|---|
| 1 | `rowHeight`, `showRowLines`, `showColumnLines` (`grid.ts:330-335`) | Atributos minúsculos colados (`rowheight`, `showrowlines`, `showcolumnlines`) vs. kebab no resto | `row-height`, `show-row-lines`, `show-column-lines`; os antigos lidos com aviso | sim (alias) | ALTA || aprovado |
| 2 | `showGroupPanel`, `showColumnHeaders`, `showRowLines` (padrão `true`) | Não dá para desligar por HTML (`show-group-panel="false"` liga) | Conversor de booleano do `<u-grid-column>` em todos os booleanos do `<u-grid>`: `"false"` desliga | não | ALTA || aprovado |
| 3 | `<u-grid-column data-type>` (`grid-column.ts:75`) | `data-*` é do autor da página (vai para `dataset`) | Atributo `type` (propriedade segue `dataType`); `data-type` lido com aviso | sim (alias) | ALTA || aprovado |
| 4 | 25 membros `_` (`_groupColumns`, `_regularColumns`, `_columnChanged`, `_nativeColumnMap`, `_userSetFixed`…) | Aparecem nas `.d.ts` e no CEM como API | `/** @internal */` + `stripInternal`; tirar `implements ResizeHost` da declaração | não | ALTA || aprovado |
| 5 | `--u-grid-header-height` | Dois sentidos: barra de grupos (56px) e `<th>` (46px) | `--u-grid-toolbar-height` e `--u-grid-header-cell-height`; antigo como fallback da barra | sim (alias) | ALTA || aprovado |
| 6 | `--u-table-hover-opacity` | Documentado, mas sem efeito (classe `.hover` nunca aplicada; bloco `:root` morto no shadow) | Implementar hover de linha com `--u-grid-row-hover-opacity` (antigo como fallback) ou tirar do README | não | ALTA || aprovado |
| 7 | `--u-table-*`, `--u-td-*`, `--u-th-*` | Fora do prefixo `--u-grid-` | `--u-grid-cell-padding` (+`-block`/`-inline`), `--u-grid-toolbar-padding` (+`-block`/`-inline`), `--u-grid-cell-font-size`/`-weight`, `--u-grid-header-cell-font-size`/`-weight`; antigos como fallback | sim (alias) | ALTA || aprovado |
| 8 | `--u-group-*` (chip) | Fora do prefixo | `--u-grid-group-chip-{height,outline-color,outline-width,shape,padding,font-size,line-height,letter-spacing,font-weight}`; antigos como fallback | sim (alias) | ALTA || aprovado |
| 9 | Propriedade `sorting` (modo) | Mesmo nome do estado (`getSorting()`, `detail.sorting`, `u-grid-sorting`); a frente 11 vai precisar dele | `sortMode` / `sort-mode` (irmão de `resizeMode`), tipo `GridSortMode`; `sorting` como alias | sim (alias) | ALTA || aprovado |
| 10 | Classe `UmDataGridColumn` | Destoa de `DataGrid` e não é exportada | `DataGridColumn`, exportada; `UmDataGridColumn` como tipo `@deprecated` | não | MÉDIA || aprovado |
| 11 | `npm run analyze` (glob `src/**/*.ts`) | CEM inclui módulos internos e `u-grid-custom-cell` | Globs só dos 4 arquivos públicos; `@internal` no custom-cell | não | MÉDIA || aprovado |
| 12 | `items` com `type: Array` | Gera atributo JSON `items` no CEM; README diz "property only" | `attribute: false` | não | MÉDIA || aprovado |
| 13 | `<u-grid-column wrap>` | `wrap="false"` liga, ao contrário de `sortable`/`visible` | Mesmo conversor do #2 | não | MÉDIA || aprovado |
| 14 | `groupIndex` no `<u-grid-column>` | No elemento reagrupa ao mudar; no `GridColumnDef` é só inicial | Inicial nos dois; reagrupar por `groupColumn`/`ungroupColumn` (aviso ao detectar mudança) | sim (comportamento) | MÉDIA || aprovado |
| 15 | Fixar e agrupar | Sem evento (visibilidade tem); sem getter do agrupamento | `u-grid-column-fixed-change` `{column, fixed, previousFixed}`; `u-grid-group-change` `{grouping, previous}`; `getGrouping()` | não | MÉDIA || aprovado |
| 16 | Quando os eventos disparam | Ordenação dispara também por API; coluna só por gesto — não documentado | Documentar no README; `source: 'user' \| 'api'` no `GridSortEventDetail` | não | MÉDIA || aprovado |
| 17 | `showColumnChooser()` | Prefixo `show*` é das props booleanas; não há fechar | `openColumnChooser()` + `closeColumnChooser()`; `showColumnChooser` como alias | sim (alias) | MÉDIA || aprovado |
| 18 | JSDoc público | Em pt-BR (CEM sai em português); vários membros sem JSDoc | JSDoc em inglês em toda a superfície pública | não | MÉDIA || aprovado |
| 19 | CEM | Sem `cssProperties`/`cssParts`; eventos sem tipo do `detail` | `@cssprop`, `@csspart`, `@fires u-grid-x {CustomEvent<Detail>}` | não | MÉDIA || aprovado |
| 20 | `::part(cell)` | Só existe na célula de "sem dados" | `part="cell"` em toda célula de dados; vazio fica `no-data` | leve | MÉDIA || aprovado |
| 21 | `--u-grid-stripped-background-color` | Erro de grafia (como `stripped` → `striped`) | `--u-grid-striped-background-color`; antigo como fallback | sim (alias) | MÉDIA || aprovado |
| 22 | README | Diverge do código (padrão de `sortable`, exemplo com `rowheight`, custom properties faltando/mortas) | Atualizar junto com as mudanças aprovadas | não | MÉDIA || aprovado |
| 23 | `renderer` | Cria `<div slot>` no light DOM do hospedeiro (conflita com React/Vue/Angular que geram os filhos) | Documentar em "Custom cell rendering" e "Using with frameworks" (a frente 10 refaz o renderer) | não | MÉDIA || aprovado |
| 24 | `sortBy` | Destoa de "verbo + `Column`"; falta `ungroupColumn` | `sortColumn(column, order, {append})` com alias `sortBy`; `ungroupColumn(column)`; `groupColumn(column, targetIndex?)` | sim (alias) | BAIXA || aprovado |
| 25 | `--u-grid-drop-indicator-bg` | Abreviação; README já chama de "color" | `--u-grid-drop-indicator-color`; antigo como fallback | sim (alias) | BAIXA || aprovado |
| 26 | `--u-grid-borders-width`, `-row-lines-height`, `-column-lines-width`, `-border-opacity` | Plural/`height` para espessura, radicais misturados | `--u-grid-line-width`, `--u-grid-row-line-width`, `--u-grid-column-line-width`, `--u-grid-line-opacity`; antigos como fallback | sim (alias) | BAIXA || aprovado |
| 27 | `--u-grid-grouping-cell-emphasis`, `--u-grid-toggle-*` | Vaza classe interna; "toggle" de quê | `--u-grid-group-row-emphasis`, `--u-grid-group-toggle-color`/`-shape`; antigos como fallback | sim (alias) | BAIXA || aprovado |
| 28 | Chaves `GridI18n` `clearSorting`, `pinStart`/`pinEnd`/`unpin` | Anúncio com nome de método; `pin` vs. radical `fixed` | `sortClearedAnnouncement`, `fixStart`, `fixEnd`, `unfix`; `setGridTranslation` aceita as antigas com aviso | sim (alias) | BAIXA || aprovado |
| 29 | `detail` de `u-grid-column-reorder` | `fromIndex`/`toIndex` vs. `previous*` dos irmãos | Acrescentar `index`/`previousIndex`; antigos `@deprecated` | não | BAIXA || aprovado |
| 30 | `any` na superfície | `items: any[]`, callbacks `(item: any)` | `GridColumnDef<TItem = any>` genérico; `renderer` retorna `HTMLElement \| null` | não | BAIXA || aprovado |
| 31 | `path` no CEM | Aponta `src/*.ts` (não publicados) | Reescrever para `dist/*.js` no analyzer | não | BAIXA || aprovado |
| 32 | README "frameworks" | Sem exemplo de eventos; React 19 grava atributo se o elemento não estiver definido | Exemplos React/Angular/Vue de evento + nota de importar antes do 1º render | não | BAIXA || aprovado |
| 33 | Eventos previstos nas specs 08/09 (`u-grid-loaded`, `u-grid-saved`, `u-grid-edit-canceled`, `u-grid-editing-start`) | Fogem da regra de eventos | `u-grid-load`, `u-grid-save`, `u-grid-edit-cancel`, `u-grid-edit-start` (ajustar as specs) | não | BAIXA || aprovado |

Depois da revisão (aval do usuário em 2026-11-18): chave `GridI18n`
`groupPanelMenu` → `groupPanelMenuLabel` (mesmo nome da propriedade
booleana `groupPanelMenu`; sufixo `Label` dos nomes acessíveis), alias em
`setGridTranslation` com aviso, como #28. Como em #28, quebra só de tipo
para quem declara um objeto `GridI18n` completo (a chave some do tipo).

## Decisões tomadas na implementação

- #2/#13: conversor `booleanAttribute(padrão)` em `src/attribute-converters.ts`
  — sem atributo = padrão, `"false"` = `false`, outro valor = `true`. O
  tri-estado do `<u-grid-column>` (`optionalBooleanAttribute`) mudou-se para
  o mesmo arquivo. Os aliases de atributo (#1, #3) são atributos observados
  extras repassados ao atributo novo em `attributeChangedCallback`.
- #4: `stripInternal` no `src/tsconfig.json`; o CEM é gerado por
  `custom-elements-manifest.config.mjs` (só os 4 módulos públicos; tira
  `@internal` e `#private`; caminhos em `dist/`, #11/#31).
  `DataGridCustomCell` fica sem `@internal` (o `HTMLElementTagNameMap`
  precisa dela nas `.d.ts`), mas fora do CEM.
- #6: o realce de linha passou a existir (linhas de dados sob o ponteiro);
  `--u-grid-row-hover-opacity: 0%` desliga. Era documentado e não
  funcionava.
- #7: `--u-grid-cell-padding` vale só para as células de dados;
  `--u-grid-cell-block-padding`/`-inline-padding` valem para dados e
  cabeçalho (como os `--u-table-*` antigos).
- #14: o aviso sai uma vez por grid na primeira mudança de `groupIndex`
  de uma coluna já renderizada; a reação continua.
- #15/#16: `u-grid-group-change` dispara por gesto e por API (como a
  ordenação), não por troca das definições (nem pelo `groupIndex` mudado
  numa coluna renderizada); os de coluna seguem só por
  gesto. `source` também no `detail` do agrupamento.
- #24: `ungroupColumn` devolve a coluna ao fim das comuns.
- Revisão da implementação (passo 10): aliases de atributo entram no CEM
  como atributos `deprecated` (plugin do analyzer); descrições do CEM com
  `\n` (fontes em CRLF); `exports` do CEM só com módulos do manifesto.
- Frente 08: `pageSizeOptions` ↔ `page-size-options` é exceção registrada à
  regra "array = `attribute: false`": o atributo é uma lista de números
  (`"10, 20, 50"`, conversor `numberListAttribute`, só leitura, sem
  reflexão). `remoteOperations` aceita objeto por propriedade; o atributo
  `remote-operations` é só booleano (tudo ou nada).
- Frente 11: `u-grid-state-change` leva `sources: readonly GridStateChangeSource[]`
  (`'user' | 'api' | 'storage'`) em vez de `source` — exceção registrada: o
  evento sai uma vez por rajada (debounce) e uma rajada mistura origens.
  Dispara também por setter e `setState` (só se o estado mudou de fato).
  `GridColumnRef` (string) procura `name` antes de `path`. Tipos com nome
  `GridRowExpansionState` e `GridGroupExpansionState` (em vez de em linha).
- Frente 09: `allowEditing`/`allowRemoving` aceitam `boolean | (item) =>
  boolean` só por propriedade; os atributos `allow-editing`/`allow-removing`
  são só booleanos (como `remote-operations`; tipo do atributo no CEM pelo
  `ATTRIBUTE_TYPES`). Radicais únicos: `add`, `remove` (`removeRow`,
  `restoreRow`, `allowRemoving`, `confirmRemove`), `edit` (`allowEditing`).
- #33: `u-grid-loading` (08) e `u-grid-row-validating` (09) marcados
  canceláveis pela regra do gerúndio. Na spec 09, `u-grid-editing-start` é cancelável, então pela regra
  virou `u-grid-edit-starting` (não `u-grid-edit-start`).

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
