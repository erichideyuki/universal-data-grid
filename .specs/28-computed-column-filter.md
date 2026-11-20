# 28 — Filtrar colunas calculadas (`valueGetter` sem `path`)

## Objetivo

Deixar o usuário e o hospedeiro filtrarem colunas cujo valor vem só do
`valueGetter` (sem `path`): linha de filtro, filtro do cabeçalho (lista de
valores), painel de busca e `filterValue`/`getState`/`setState`.

Hoje `isColumnFilterable` exige `path`, e a condição `[campo, op, valor]`
só encontra a coluna pelo `path`. Quem tem coluna calculada (o pivô
usuário × documento do clickCompliance, colunas de situação composta e de
categoria) precisa achatar os dados num view model só para filtrar.

O que já funciona e não muda: coluna COM `path` e COM `valueGetter` já filtra
pelo valor do getter (o avaliador lê pelo `cellValueReader`, que prefere o
getter); a condição continua apontando o `path`.

## Referência medida

Medido em 2026-11-20.

**DevExtreme DataGrid 26.1.5** (grid montado na página das demos, dados
locais e `CustomStore` com `remoteOperations: true`):

- Coluna só com `calculateCellValue` (sem `dataField`, com `name`) nasce com
  `allowFiltering: false` e `allowSorting: false`; é opt-in.
- Com `allowFiltering: true`: `filterValue` aponta a coluna pelo **`name`**
  (`['full', 'contains', 'sil']`, `['sum', '>', 3]`, `['full', '=', null]`
  para vazio) e filtra pelo valor calculado; operações do tipo
  (`dataType: 'number'` → `=`, `<>`, `<`, `>`, `<=`, `>=`, `between`).
- A linha de filtro, com a sincronia ligada, grava `['full','contains','sil']`
  no `filterValue` (pelo `name`).
- O filtro do cabeçalho lista os valores distintos calculados, com
  "(Blanks)" para o vazio.
- O painel de busca procura nos valores calculados (também na coluna de
  número, sem `allowSearch` explícito: segue o `allowFiltering`).
- Remoto: a condição vai ao `load` do servidor **como está, pelo `name`**
  (`["full","contains","sil"]`); o grid não filtra localmente nem avisa.

**AG Grid Community** (API documentada; não medido no navegador — as
páginas lidas não detalham): filtro de coluna opt-in (`filter: true`); o
valor filtrado é o do `filterValueGetter`, senão o do `valueGetter`; o
modelo de filtro é indexado pelo `colId` (coluna sem `field` deve ter
`colId`); no server-side row model o modelo vai ao servidor pelo `colId`.

**MUI X DataGrid** (API documentada): toda coluna tem `field` (mesmo a
calculada); `filterable` é `true` por padrão e o filtro usa o
`valueGetter`; com `filterMode="server"` o modelo vai pelo `field`.

Conclusão: os três filtram pelo valor calculado e endereçam a coluna pelo
id dela (`name`/`colId`/`field`); no remoto, mandam a condição como está.
Divergem no padrão: DevExtreme e AG Grid exigem opt-in, MUI liga.

## Proposta de API (revisada pelos subagentes em 2026-11-20; aguarda aval)

Nenhum nome novo de propriedade, método, evento ou tipo. Mudam o sentido do
campo da condição, o padrão de `filterable` e o texto do cabeçalho de uma
coluna calculada sem `label`.

1. **Campo canônico da coluna**: `path ?? name` (`filterFieldOf`,
   `@internal`). É o que a linha de filtro, o filtro do cabeçalho e a busca
   gravam; `getState().filterValue` faz ida e volta sem normalizar nada.
2. **Resolução do campo da condição** (`GridFilterCondition[0]`; o rótulo
   da tupla passa de `path` para `field`), numa função só
   (`resolveFilterColumn(field, leaves)`), usada pelo avaliador E pelo
   estado da interface (`findColumnCondition`, `hasColumnCondition`,
   `replaceColumnCondition`, "coluna filtrada" do ARIA, `_distinctValues`):
   1. folha cujo `path` é o campo — como hoje;
   2. folha **sem `path`** cujo `name` é o campo;
   3. nenhuma: lê o caminho no item — como hoje.

   `sameField(field, column)` = `resolve(field) === column`. O passo 2 só
   vale sem `path`, então nenhuma expressão existente muda de sentido. A
   ordem é a inversa da do `GridColumnRef` (`name` primeiro); fica
   documentado no JSDoc, no `API.md` e na spec 15.
3. **`filterable` (padrão)**: `true` com `path`, ou com `valueGetter` **e**
   `name` — exceto:
   - **colisão**: coluna sem `path` cujo `name` é o `path` de outra folha,
     ou repete o `name` de outra calculada (a primeira fica): não
     filtrável; `filterable: true` avisa uma vez. Nenhum controle rotulado
     com uma coluna filtra outra;
   - **sem `name` e sem `path`**: não filtrável; `filterable: true` avisa
     uma vez (hoje é ignorado em silêncio);
   - **remoto** (`dataSource` com `filtering` remoto) e sem `path`: `false`
     por padrão; `filterable: true` liga.

   O grid decide por um `#isFilterable(column)` (substitui as chamadas de
   `isColumnFilterable` no `grid.ts`), porque remoto e colisão dependem do
   grid. Divergência da referência: DevExtreme e AG Grid exigem opt-in; aqui
   segue `sortable`/`groupable`/`exportable` (que já ligam com
   `valueGetter`) e o MUI. **Mudança de comportamento** em grids que já têm
   coluna calculada com `name`: aparecem a célula da linha de filtro e o
   funil, e a busca passa a procurar no texto calculado. Vai como "Behavior
   change" no changelog da 0.3 e no `API.md`; quem não quiser,
   `filterable: false`.
4. **Busca**: as calculadas filtráveis entram (como no DevExtreme); o
   destaque segue.
5. **Filtro do cabeçalho**: lista os valores distintos do getter (o
   `distinctValues` já lê pelo `cellValueReader`), com vazio, contagem e
   árvore de datas. **No remoto, coluna sem `path` não tem funil** (só a
   linha de filtro): a lista sairia só das linhas carregadas.
6. **Remoto com `filterable: true`**: a condição vai ao `load` como está,
   pelo `name` (`filter` e `filterValue`; a busca também manda
   `[name, 'contains', texto]`), como o DevExtreme mede e o AG Grid SSRM
   faz; o `load` do hospedeiro traduz. Documentado no JSDoc de
   `GridLoadOptions.filter`/`filterValue`. Alternativa recusada (ponto de
   partida da coordenadora: tirar a condição da consulta e avisar): a linha
   de filtro mostraria um filtro que não filtra, e o filtro remoto da
   calculada já é opt-in explícito.
   Incoerência registrada, fora da frente: em remoto, `#remotePath` avisa e
   ignora ordenação/agrupamento da calculada, mas `sortable` segue ligado.
7. **Cabeçalho da calculada sem `label`** (achado ALTA do `a11y-reviewer`,
   conferido no código): `headerText` = `label || path`, então o `th` de
   `{ name: 'docA', valueGetter }` fica vazio e o `columnheader` focável
   fica sem nome (4.1.2) — e a frente liga o filtro justamente nela.
   Proposta: `headerText` cai no `name` quando a coluna tem `valueGetter`
   (o mesmo texto cru que menus e anúncios já usam via `columnText`);
   colunas só de `renderer` continuam com o cabeçalho vazio. O aviso de
   coluna sem rótulo passa a cobrir a calculada sem `label` e sem
   `headerRenderer` que é filtrável ou ordenável (o `name` costuma ser id,
   não rótulo — 2.4.6).
8. **Docs**: JSDoc de `GridFilterCondition`, `GridColumnDef.filterable`,
   `<u-grid-column>.filterable` ("Default: `true` with a `path`, or with a
   `valueGetter` and a `name` (not with remote filtering)"),
   `src/state/grid-state.ts`, `GridLoadOptions`; `API.md` (campo,
   resolução, campo sem coluna é lido do item, mudança de comportamento);
   CEM regerado.

Exemplo:

```ts
grid.columns = [
  { path: 'user', label: 'User' },
  { name: 'docA', label: 'Policy A', valueGetter: row => statusOf(row, 'A') },
];
grid.filterValue = ['docA', 'anyof', ['pending', 'expired']];
```

## Comportamento

- Avaliação: valor do `valueGetter`; `dataType` informado ou inferido do
  getter; `displayValue`/`format` valem para texto e busca.
- `filterOperations`/`defaultFilterOperation` valem igual.
- Coluna oculta: a condição continua valendo.
- Campo sem coluna (coluna removida, ou `filterValue`/`setState`/
  `stateStorage` antes dos `<u-grid-column>` se definirem): lido do item,
  como hoje. A expressão é recompilada quando `columns`/slot mudam (com
  teste), sem anúncio de "0 resultados" no meio.
- O aviso remoto de `#remotePath` passa a usar `columnText(column)` (hoje
  sai `column ""` na calculada sem `label`).

## Desempenho

O getter já roda por linha na filtragem das colunas com `path` +
`valueGetter`; a frente não cria custo de natureza nova. Proposta: **sem
cache novo** de valores do getter (um cache por versão de `items` seria um
array de N valores por coluna — custo por linha). Os memorandos por valor
que o compilador já tem (`textTest`, `compileSet`, `memoizeStrings`) valem
para o getter. Cenário novo em `src/grid.perf.browser.test.ts`: filtrar por
coluna calculada (`contains` e `anyof`) e a busca com uma calculada a mais;
orçamento igual ao do filtro por `path`. Se estourar, cache limitado
(`LruCache`) com teste de vazamento.

## Acessibilidade

Nada novo na interface: a calculada ganha a mesma célula da linha de
filtro, o mesmo funil e a mesma entrada na busca das colunas com `path`,
com os mesmos papéis, teclado e anúncios (specs 04 e 17).

- Nome acessível do editor, do funil e do diálogo: `columnText` (`label`,
  senão `name` na calculada). Cabeçalho: item 7 da proposta.
- Estado "filtrado" (funil ativo, descrição "Filtrada", valor no editor)
  vem da mesma resolução do avaliador; na colisão a outra coluna não acende
  (1.3.1, 4.1.2).
- Calculada com `headerRenderer` e sem `label`: o funil usa o texto
  renderizado e o diálogo o `name` (decisão da spec 17); o aviso do console
  cobre o caso.
- Remoto: calculada não filtrável não tem controle de filtro (célula vazia,
  nada focável); com `filterable: true`, só a linha de filtro.
- Teclado, foco e RTL: sem mudança.

## i18n

Nenhuma chave nova.

## Revisão do desenho (2026-11-20)

`webcomponent-api-reviewer` e `a11y-reviewer` sobre a primeira versão.
Aceitos e aplicados acima: resolvedor único para avaliador e interface;
passo 2 só para coluna sem `path`; colisão de `name` não filtrável com
aviso; aviso para `filterable: true` sem `name`/`path`; `#isFilterable` do
grid no lugar da função pura; sem funil no remoto para a calculada;
cabeçalho com `name` na calculada sem `label`; docs que dizem "por `path`";
recompilar ao mudar colunas; `columnText` no aviso remoto; casos de teste
de ARIA. Recusado: nenhum.

## Fora de escopo

- `filterValueGetter` separado (AG Grid) e `calculateFilterExpression`
  (DevExtreme).
- Filtrar coluna sem `name` e sem `path`.
- Ordenação/agrupamento remoto da calculada (incoerência acima).
- Construtor de filtro (frente 24).

## Arquivos

- `src/grid-column-def.ts` — `isColumnFilterable`, `filterFieldOf`, JSDoc.
- `src/row-model/filter.ts` — `resolveFilterColumn`, `sameField`,
  `searchExpression`, funções de sincronia recebendo as folhas.
- `src/row-model/columns.ts` — `headerText` com `name` na calculada.
- `src/features/filter-row.ts`, `src/features/header-filter.ts` — gravar
  `filterFieldOf(column)`.
- `src/grid.ts` — `#isFilterable`, avisos, funil no remoto.
- `src/data/data-source.ts`, `src/state/grid-state.ts` — JSDoc.
- Testes: `src/row-model/filter.test.ts`, `src/filtering.browser.test.ts`,
  `src/grid.perf.browser.test.ts`.
- `API.md`, `docs/` (exemplo), `custom-elements.json`.

## Testes

- Row model: condição pelo `name` em cada operação; `path` antes de
  `name`; `name` de coluna com `path` cai no caminho do item; busca inclui
  a calculada; sincronia pelo `name`; colisão.
- Navegador: linha de filtro numa calculada grava `[name, …]` e filtra;
  filtro do cabeçalho lista os valores do getter e grava `anyof`; busca
  acha e destaca; `getState`/`setState` ida e volta; recompila quando os
  `<u-grid-column>` chegam depois do `filterValue`; remoto: padrão não
  filtrável (célula sem focável), `filterable: true` manda `[name, …]` ao
  `load` e não tem funil; avisos (sem `name`, colisão).
- `axe-core` e roteiro de teclado com calculada (linha de filtro e funil,
  LTR e RTL), inclusive sem `label`; foco volta ao funil após Esc/OK;
  "Filtrada" quando a condição vem por `filterValue` e por `setState`;
  colisão sem funil ativo na outra coluna.
- Sem cache novo, sem teste de vazamento novo (se entrar cache, entra).
- Perf: cenário novo, `npm run test:perf` sem piora.
