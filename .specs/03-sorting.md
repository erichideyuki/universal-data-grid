# 03 — Ordenação

## Objetivo
Ordenar por clique no cabeçalho, por várias colunas, e por API.

## Referência
DevExtreme: `sorting.mode` (`none|single|multiple`), clique alterna
asc → desc (sem voltar a "nenhum"); Ctrl+clique remove; Shift+clique
acrescenta (no modo multiple); menu de contexto "Sort Ascending/Descending/
Clear"; `column.sortOrder`, `sortIndex`, `allowSorting`, `sortingMethod`,
`calculateSortValue`; grupos ordenados por `sortOrder` da coluna de grupo.
AG Grid: ciclo asc → desc → nenhum (`sortingOrder`), Shift+clique multi.

## Escopo — API
- `<u-grid sorting="none|single|multiple">` (padrão `single`).
- Coluna: `sortable` (padrão `true` se tiver `path`/`valueGetter`),
  `sortOrder` (`'asc'|'desc'|null`, inicial), `sortIndex`, `comparator(a, b,
  itemA, itemB)`.
- Métodos: `sortBy(column, order, { append })`, `clearSorting()`,
  `getSorting(): { column, order }[]`.
- Eventos: `u-grid-sorting` (cancelável, antes) e `u-grid-sort-change`.

## Comportamento
- Clique no cabeçalho: asc → desc → asc (como o DevExtreme). Ctrl/Cmd+clique
  remove a ordenação da coluna. No modo `multiple`, Shift+clique acrescenta;
  clique simples substitui.
- Indicador: seta e, no multi, o número da ordem (só se > 1 coluna).
- Ordenação estável; comparador padrão de `row-model/compare.ts` (tipo da
  frente 02, `Intl.Collator` numérico).
- Coluna agrupada: o grupo segue a direção da ordenação da coluna; clicar
  no chip do grupo alterna asc/desc.
- Arrastar o cabeçalho não pode disparar ordenação (limiar de movimento do
  interactjs).

## Acessibilidade
`aria-sort="ascending|descending|none"` no `columnheader`; Enter/Espaço no
cabeçalho focado ordena (com Shift/Ctrl igual ao mouse). Anúncio em região
`aria-live` polite: "Sorted by {column}, ascending".

## i18n
`sortAscending`, `sortDescending`, `clearSorting`, `sortedAnnouncement`.

## Fora de escopo
Ordenação remota (vem com a frente 08 pelo contrato `DataSource`).

## Arquivos
`row-model/sort.ts`, `render/header.ts`, `features/sorting.ts`, `grid.ts`,
`grid-i18n.ts`, `grid.styles.ts`.

## Testes
Estabilidade; multi-coluna; nulos; comparador próprio; grupos seguindo a
direção; evento cancelado não ordena; clique após arrasto não ordena.

## Critério de pronto
100 mil linhas ordenando em < 200 ms no demo.

## Referência medida
(preencher)
