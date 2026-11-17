# 08 — Fonte de dados, chaves e paginação

## Objetivo
Trabalhar com dados que não cabem no navegador: chave de linha, fonte remota
com operações no servidor, paginação e rolagem infinita, atualização
incremental.

## Referência
DevExtreme: `keyExpr`, `dataSource` (`CustomStore` com `load(loadOptions)`
recebendo `skip`, `take`, `sort`, `filter`, `group`, `requireTotalCount`,
`totalSummary`, `groupSummary`), `remoteOperations`, `paging` + `pager`,
`scrolling.mode = 'virtual'|'infinite'`, `loadPanel`, `refresh()`,
`push()` para mudanças. AG Grid: `getRowId`, Infinite / Server-Side Row
Model, transactions (`applyTransaction`).

## Escopo — API
- `keyExpr: string | ((item) => string|number)`.
- `dataSource: GridDataSource` (alternativa a `items`):
  ```ts
  interface GridDataSource<T> {
    load(options: LoadOptions, signal: AbortSignal): Promise<LoadResult<T>>;
  }
  interface LoadOptions { skip; take; sort; filter; group; search;
    requireTotalCount; totalSummary; groupSummary }
  interface LoadResult<T> { data: T[] | GroupResult[]; totalCount?;
    summary?; groupCount? }
  ```
  O formato de `filter`/`sort` é o mesmo das frentes 03/04, serializável
  (o servidor recebe exatamente a expressão).
- `remoteOperations: boolean | { sorting; filtering; grouping; paging;
  summary }`.
- `paging: { enabled; pageSize; pageIndex }` + pager embutido (seletor de
  tamanho, navegação, "Página x de y").
- `scrolling: 'standard'|'virtual'|'infinite'` — `virtual` com remoto busca
  janelas sob demanda (linhas-esqueleto enquanto carrega).
- `refresh()`, `applyChanges({ add, update, remove })` (por chave, sem
  reconstruir o modelo inteiro).
- Eventos: `u-grid-loading`, `u-grid-loaded`, `u-grid-load-error`.

## Comportamento
- Requisição anterior abortada (`AbortController`) quando sort/filter mudam.
- Painel de carregamento (sobreposição + `aria-busy`) e linha de erro com
  "Tentar de novo".
- Cache de páginas já carregadas no modo virtual (LRU por janela).
- `items` continua funcionando como hoje (fonte local); `dataSource` e
  `items` juntos = erro no console.

## Segurança
O grid nunca monta URL nem SQL: o hospedeiro recebe `LoadOptions` como dados
e faz a chamada. Documentar no README que `filter` vem do usuário e deve ser
validado no servidor (lista de campos permitidos).

## i18n
`loading`, `loadError`, `retry`, `pageInfo` (`Page {0} of {1} ({2} items)`),
`pageSize`, `firstPage`, `prevPage`, `nextPage`, `lastPage`.

## Fora de escopo
Adaptadores prontos para OData/REST/GraphQL (podem virar pacotes de exemplo).

## Arquivos
`data/data-source.ts`, `data/local-source.ts` (embrulha `items` no mesmo
contrato), `data/remote-loader.ts`, `render/pager.ts`, `render/load-panel.ts`.

## Testes
Fonte falsa com latência; abortar; erro; janelas no virtual; `applyChanges`
mantendo seleção, foco e expansão.

## Referência medida
(preencher)
