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
- Eventos: `u-grid-loading` (cancelável: o hospedeiro pode impedir a
  carga), `u-grid-load`, `u-grid-load-error` (nomes pela regra da spec 15).

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

## API aprovada (2026-11-18, revisada pelo `webcomponent-api-reviewer`)
- `keyExpr: string | ((item) => GridRowKey) | null` ↔ `key-expr` (`path`
  com pontos; `GridRowKey = string | number`). Com ela, `selectedKeys`,
  `focusedRowKey`, `focusCell`, `isRowSelected` e `detail.rowKey` usam a
  chave. Trocar `keyExpr` converte a seleção (objeto → chave; o que não
  resolve sai, `u-grid-selection-change` `source: 'api'`). Chave duplicada
  ou vazia: `console.error` uma vez.
- `dataSource: GridDataSource | null` (só propriedade; com `items` junto =
  `console.error`, vence `dataSource`). `GridDataSource<TItem = any> {
  load(options: GridLoadOptions, signal: AbortSignal):
  Promise<GridLoadResult<TItem>> }`.
- `GridLoadOptions` (congelado, `readonly`): `skip?`, `take?`, `sort:
  GridLoadSort[]` (`{ path, order }`), `filter` (= `getCombinedFilter()`),
  `filterValue` (só colunas), `searchText`, `group: GridLoadGroup[]`
  (`{ path, order, expanded }`), `groupPath: GridGroupPath | null` (grupo
  aberto, igualdade exata), `requireTotalCount`, `requireGroupCount`,
  `totalSummary`/`groupSummary: GridLoadSummary[]` (`{ path, type:
  GridSummaryType, name? }`).
- `GridLoadResult<TItem>`: `data: TItem[] | GridLoadGroupResult[]`,
  `totalCount?`, `groupCount?`, `summary?` (ordem de `totalSummary`).
  `GridLoadGroupResult<TItem> { key, count, items: TItem[] |
  GridLoadGroupResult[] | null, summary? }`.
- `remoteOperations: boolean | GridRemoteOperations` (`{ filtering?,
  sorting?, paging?, grouping?, summary? }`) ↔ `remote-operations`
  (booleano). `false` = carrega tudo uma vez e processa no navegador.
  `paging`/`grouping` remotos forçam `filtering`/`sorting` (aviso). Com a
  operação remota ligada, ordenar/filtrar/agrupar exige `path` (sem
  `valueGetter`/`comparator`/`groupValueGetter`; aviso por coluna).
- `paging` ↔ `paging` (booleano), `pageSize` ↔ `page-size` (20),
  `pageIndex` ↔ `page-index` (0; limitado em silêncio),
  `pageSizeOptions` ↔ `page-size-options` (`[10, 20, 50, 100]`; atributo
  lista "10,20,50"; vazio esconde o seletor — exceção à regra de array
  registrada na spec 15).
- `scrollMode` ↔ `scroll-mode`: `'virtual' | 'infinite'` (`GridScrollMode`;
  `infinite` só com `dataSource`; com `paging`, `paging` vence com aviso).
- Métodos: `refresh(): Promise<void>`; `applyChanges(changes:
  GridDataChanges)` (`{ add?, update?, remove? }`, só com `dataSource` —
  com `items` avisa e não faz nada; `update`/`remove` exigem `keyExpr`);
  `getTotalCount(): number` (`-1` = desconhecido).
- Eventos (só com `dataSource`): `u-grid-loading` (cancelável; mantém os
  dados anteriores) `{ options }`, `u-grid-load` `{ options, result }`,
  `u-grid-load-error` `{ options, error }`; `u-grid-page-change` `{
  pageIndex, previousPageIndex, pageSize, previousPageSize, source }` (pager
  e correções automáticas; setter não dispara). Tipos `Grid*EventDetail`.
- Seleção remota: `selectAll`/`getSelectedItems` só nas linhas carregadas;
  "selecionar tudo" do cabeçalho some com paginação remota ou total
  desconhecido; `focusCell` de linha não carregada devolve `false`.
- Parts: `pager`, `pager-button`, `page-size-select`, `page-info`,
  `load-panel`, `skeleton-row`, `error-row`, `retry-button`. CSS:
  `--u-grid-load-panel-background-color`, `--u-grid-skeleton-row-color`,
  `--u-grid-pager-height`.
- i18n: `loading`, `loadError`, `retry`, `pageInfo` (`Page {page} of
  {pageCount} ({count} items)`), `pageInfoUnknownCount` (`Page {page}`),
  `pageSizeLabel`, `paginationLabel`, `firstPage`, `previousPage`,
  `nextPage`, `lastPage`.

## Decisões na implementação
- Arquivos: `data/data-source.ts` (tipos e normalização), `data/local-source.ts`
  (`LocalDataSource`: o contrato sobre um array — referência executável e o
  "servidor" dos testes), `data/remote-loader.ts` (gerações, blocos, LRU,
  grupos preguiçosos, `flattenRemote`). O pager e o painel de carga ficaram
  em `grid.ts` (`#renderPager`, `#renderLoadState`) — pouco código, muito
  estado do grid.
- Dois motores: **carga única** (`remoteOperations` sem `paging`/`grouping`:
  uma chamada sem `skip`/`take`; o resultado entra no pipeline local, que
  pula filtro/ordenação feitos no servidor) e **remoto** (`paging` ou
  `grouping` no servidor: `RowList` com blocos preguiçosos e grupos
  carregados ao expandir). `paging` remoto também liga `grouping` e
  `summary` (sem todas as linhas o grid não agrupa nem resume certo).
- `group` vai sempre com TODOS os níveis; o nível pedido é
  `groupPath.length` (grupos enquanto menor que `group.length`, linhas
  quando igual) — o servidor precisa dos `path` dos níveis do `groupPath`.
- Consulta nova = geração nova: o que estava em voo é abortado, a geração
  exibida continua na tela (e rolável) até a nova responder (painel de
  carga + `aria-busy`); a 1ª chamada da raiz traz `requireTotalCount` e
  `totalSummary`, as demais não. Pedidos de blocos saem 30 ms depois do
  último render (rolagem rápida pede só onde parou).
- Esqueleto: linha `role="row"` com células vazias navegáveis e
  `aria-busy="true"`; não é selecionável e o foco nela informa `rowKey: null`.
- Linha de erro: barra sobreposta ao pé da área de rolagem (`role="alert"`),
  não um `<tr>` — um `<tr>` a mais deslocaria a janela virtual.
- `applyChanges` na carga única não reordena nem refiltra (como o `push` da
  referência): `update` troca no lugar, `remove` tira, `add` vai ao fim; a
  máscara do filtro e a ordem são remapeadas (O(n), sem recalcular postos).
  1 milhão de linhas: ~200 ms no perfil fraco.
- `scrollMode = 'infinite'` só vale com paginação remota (sem ela não há o
  que carregar aos poucos): fora disso é ignorado com aviso.
- Página limitada: em silêncio quando veio do setter de `pageIndex`/
  `pageSize`; com `u-grid-page-change` (origem da causa) quando as linhas
  encolheram (dados, filtro, agrupamento, expansão). O gesto de filtro
  dispara `u-grid-filter-change` e depois `u-grid-page-change`.
- Part `error-row` mantido (nome aprovado), embora seja uma barra e não um
  `<tr>`.
- Revisão de acessibilidade na entrega (`a11y-reviewer`, sobre a main com a
  spec 17): painel de carga só visual (`aria-hidden`) e "Carregando…" pela
  região viva depois de 300 ms; anúncio do filtro só com a resposta da
  consulta nova; `page-info` sem `aria-live` (a troca pedida pelo usuário é
  anunciada); números do pager com nome "Page N" e o foco vai à página
  atual quando o número clicado muda de lugar ou a seta fica desabilitada;
  `scroll-padding` embaixo enquanto a barra de erro existe; esqueleto lido
  como "Loading…"; página atual não só por cor; borda do seletor com
  contraste; regras de `forced-colors`; sem animação com movimento
  reduzido; PageUp/PageDown na 1ª/última página caem na navegação comum.
  Ficaram para o usuário (mudam API): trocar `disabled` por
  `aria-disabled` nos botões do pager e uma chave i18n própria para o
  cabeçalho da coluna de seleção com fonte remota (hoje usa `selectRow`).
- Exportação (frente 12): `selectedOnly`/Ctrl+C filtram pela chave
  (`keyExpr`). Fonte de carga única exporta tudo, como `items`; com
  paginação ou grupos no servidor, só as linhas já carregadas, na ordem da
  tela, sem linhas de grupo (a coluna agrupada vira coluna) e com os totais
  do servidor — exportação completa é do servidor (README).
- `aria-rowindex` é o índice real (com a página), não reinicia por página
  como na referência; `aria-rowcount="-1"` na rolagem infinita até o fim.

## Referência medida
DevExtreme 26.1 (demos públicas "Paging" e "Remote Virtual Scrolling",
2026-11-18):
- Pager: `role="navigation"` com `aria-label` ("Page navigation"); seletor
  de tamanho como botões (`aria-label` "Items per page: N", com "All");
  texto "Page 2 of 10000 (100000 items)"; anterior/próxima e números de
  página com reticências (1…5 … 10000), página atual com
  `aria-current="page"`; botão desabilitado fica com `tabindex="-1"`.
- PageDown/PageUp numa célula com paginação troca de página (não rola).
- `aria-rowindex` recomeça em 1 a cada página (nós usamos o índice real,
  como pede a APG para conjuntos parciais). Contêiner com
  `aria-label` "Data grid with 1000000 rows and 6 columns".
- Remoto virtual: 1ª carga `skip=0&take=100&requireTotalCount=true`;
  rolar ao meio pede só a janela (`skip=499900&take=100`, sem
  `requireTotalCount`). Durante a carga: painel "Loading..." sobreposto e
  linhas virtuais vazias; nenhum `aria-busy` (nós pomos `aria-busy` na
  tabela).
