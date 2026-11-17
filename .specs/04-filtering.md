# 04 — Filtro

## Objetivo
Filtrar por linha de filtro, por busca global e por lista de valores no
cabeçalho, com uma expressão de filtro única exposta por API.

## Referência
DevExtreme: `filterRow` (editor por tipo + operador), `headerFilter` (lista
de valores com busca, datas por ano/mês), `searchPanel` (destaca o texto),
`filterPanel` + `filterBuilder`, `filterValue` (expressão em array:
`[['age','>',30],'and',['name','contains','an']]`), `applyFilter:
'auto'|'onClick'`. AG Grid: floating filters, quick filter.

## Escopo — API
- `<u-grid filter-row search-panel header-filter>` (booleanos, padrão off).
- Coluna: `filterable` (padrão `true`), `filterOperations` (lista permitida),
  `defaultFilterOperation`.
- Expressão: `FilterExpression` serializável igual à do DevExtreme
  (`[path, op, value]`, `and`/`or`, `!`), com operadores `=`, `<>`, `<`,
  `<=`, `>`, `>=`, `contains`, `notcontains`, `startswith`, `endswith`,
  `between`, `anyof`, `noneof`, `isblank`, `isnotblank`.
- `filterValue` (propriedade), `searchText`, `clearFilter()`,
  `getCombinedFilter()`.
- Eventos: `u-grid-filter-change`.

## Comportamento
- Linha de filtro: editor por `dataType` (texto, número, data, booleano em
  três estados), botão de operador com menu; aplica com debounce de 300 ms
  (texto) ou ao confirmar (data).
- Busca: case/acento-insensível (`Intl.Collator` sensitivity `base`) sobre o
  `displayValue` das colunas visíveis; destaque do trecho em `<mark>`
  (aplicado no texto, sem HTML do usuário).
- Filtro no cabeçalho: ícone no cabeçalho abre popover com valores distintos
  (com contagem), busca, "selecionar tudo"; datas agrupadas ano/mês/dia.
- Filtros combinam com `and`; grupos e totais recalculam sobre o resultado.
- Ícone de funil ativo nas colunas filtradas; "Limpar filtro".

## Acessibilidade
Editores com `aria-label` "Filter {column}"; popover com foco preso e Esc;
resultado anunciado ("{n} rows").

## i18n
Nomes dos operadores, `searchPlaceholder`, `filterRowPlaceholder`,
`selectAll`, `clearFilter`, `ok`, `cancel`, `blanks`, `rowsAnnouncement`.

## Fora de escopo
Construtor de filtro visual e painel de filtro (fase D), filtro remoto (08).

## Arquivos
`row-model/filter.ts` (avaliador da expressão), `features/filter-row.ts`,
`features/header-filter.ts`, `features/search.ts`, `render/header.ts`,
`grid-i18n.ts`. Popover próprio, leve (sem dependência nova).

## Testes
Avaliador da expressão (tabela de casos por operador e tipo); busca com
acento; valores distintos com nulos ("(Blanks)"); filtro + grupo + ordenação.

## Critério de pronto
Filtrar 100 mil linhas com digitação sem travar a UI (filtro em < 100 ms).

## Referência medida
(preencher)
