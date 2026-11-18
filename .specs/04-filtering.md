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

## Escopo — API (aprovada pelo usuário em 2026-11-18, revisada pelo `webcomponent-api-reviewer`)
- `<u-grid>`: `showFilterRow`/`show-filter-row`, `showSearchPanel`/`show-search-panel`,
  `headerFilter`/`header-filter` (booleanos, padrão `false`; nomes no padrão
  `show*` para regiões e substantivo para recurso com botão, como
  `columnChooser`).
- `filterValue` (só propriedade, `GridFilterExpression | null`) e
  `searchText`/`search-text`. Atribuir NÃO dispara evento (evita laço em
  ligação nos dois sentidos); o grid guarda cópia congelada e atualiza a
  propriedade quando o usuário filtra (estado não controlado).
- Coluna: `filterable` (tri-estado; padrão `true` quando há `path`),
  `filterOperations` (só restringe o menu da linha de filtro; atributo
  `filter-operations` separado por espaço, só leitura, token desconhecido
  avisa) e `defaultFilterOperation`/`default-filter-operation` (fora da lista
  → o 1º da lista).
- Expressão: `GridFilterCondition = [path, operação, valor?]` (o 1º elemento é
  SEMPRE o `path` em texto: serializável e sem prender o elemento da coluna;
  coluna só com `valueGetter` precisa de `path` para filtrar), `['!', expr]`,
  grupos com `'and'`/`'or'`. Operadores: `=`, `<>`, `<`, `<=`, `>`, `>=`,
  `contains`, `notcontains`, `startswith`, `endswith`, `between`, `anyof`,
  `noneof`, `isblank`, `isnotblank`. Tipos exportados `GridFilterOperation`,
  `GridFilterCondition`, `GridFilterExpression`, `GridFilterEventDetail`.
- Métodos: `clearFilter()` (dispara com `source: 'api'`), `getCombinedFilter()`.
  `filterColumn()` ficou de fora (sem regra clara com `or`/aninhamento).
- Evento: `u-grid-filter-change` `{ filterValue, previousFilterValue,
  searchText, previousSearchText, source }`. `u-grid-filtering` fica
  reservado para um cancelável futuro (cancelar devolveria o editor ao
  `filterValue`).
- Parts: `filter-row`, `filter-cell`, `filter-editor`,
  `filter-operation-button`, `search-input`, `header-filter-button`,
  `header-filter`, `search-highlight`. Custom properties:
  `--u-grid-filter-row-height`, `--u-grid-search-highlight-background-color`,
  `--u-grid-search-highlight-color`, `--u-grid-header-filter-button-active-color`,
  `--u-grid-header-filter-background-color`, `--u-grid-header-filter-shape`.

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
resultado anunciado ("Rows: {n}" — rótulo sem plural, para não sair "1 rows").

## i18n
Nomes dos operadores (`filterEquals` … `filterIsNotBlank`), `filterReset`,
`filterEditorLabel`, `filterOperationLabel`, `headerFilterLabel`,
`filterBetweenStart`/`filterBetweenEnd`, `filterAll`, `filterBlanks`,
`filterClear`, `searchPlaceholder`, `selectAll`, `ok`, `cancel`,
`filteredAnnouncement` (sem nome de método nas chaves, regra da spec 15 #28).

## Fora de escopo
Construtor de filtro visual e painel de filtro (fase D), filtro remoto (08).

## Arquivos
`row-model/filter.ts` (avaliador da expressão), `row-model/fold.ts` (texto
sem caixa/acento por `RegExp`), `row-model/distinct.ts` (valores distintos),
`features/filtering.ts` (estado + máscara + fatias), `features/filter-row.ts`,
`features/header-filter.ts`, `features/search.ts`, `render/header.ts`,
`grid-i18n.ts`. Popover próprio, leve (sem dependência nova).

## Testes
Avaliador da expressão (tabela de casos por operador e tipo); busca com
acento; valores distintos com nulos ("(Blanks)"); filtro + grupo + ordenação.

## Critério de pronto
Filtrar 100 mil linhas com digitação sem travar a UI (filtro em < 100 ms).

## Decisões de implementação
- Pipeline: a ordenação é calculada sobre TODOS os `items` (índices, postos em
  cache) e o filtro é uma máscara alinhada a `items`; mudar o filtro não
  reordena. Resultado igual a filtrar antes (ordenação estável). Os índices
  só ficam guardados com filtro ativo (sem filtro, mesma memória de antes —
  linha de base `lean-5m`).
- Texto sem caixa/acento: em vez de dobrar cada célula (1 milhão × colunas de
  cópias), o termo vira uma `RegExp` com as variantes de cada letra
  (`e` → `[eéèêë…]`) + marcas combinantes opcionais, testada no texto
  original. Colunas de texto sem `displayValue`/`format` não alocam nada; as
  formatadas memorizam o resultado por valor primitivo durante a passada.
- Busca em muitas colunas (spec 16, cenários `filter-*`): `path` quebrado uma
  vez por compilação (`cellValueReader`); memo por valor nas colunas de texto
  enquanto há repetição; e o "alfabeto" do texto formatado
  (`displayAlphabet`: amostras do `Intl` com dígitos, sinais, meses, AM/PM)
  descarta a coluna de número/data/booleano inteira quando o termo tem um
  caractere que o formatado nunca tem e todo valor converte (o grid guarda
  isso por `items`). Valor que não converte cai no texto cru, como na célula.
- `=` em texto compara o texto exibido (como os de texto); `anyof`/`noneof`
  comparam o valor (o filtro do cabeçalho grava valores). `date` compara o
  dia; `datetime`, o instante — menos com valor só-data (`aaaa-mm-dd`), que
  compara o dia (é o que a linha e o cabeçalho gravam).
- Até 200 mil linhas o filtro roda de uma vez; acima, em fatias de ~8 ms
  (`MessageChannel`: `setTimeout(0)` aninhado espera ≥ 4 ms), mantendo o
  resultado anterior na tela; `updateComplete`
  espera a fatia final. Troca de `items`/colunas/idioma recalcula na hora.
- Valores distintos do cabeçalho vêm das linhas que passam pelos OUTROS
  filtros (sem a condição do próprio cabeçalho). Lista plana desenhada até
  500 itens (a busca do popover estreita); OK grava o menor entre `anyof` e
  `noneof`; todos marcados tira a condição.
- Formas abreviadas do DevExtreme aceitas (compatibilidade, revisão da
  entrega): `[path, valor]` = `=` e duas expressões seguidas sem conector =
  `and`. Condição de 3 elementos com operador desconhecido é inválida
  (aviso + filtro ignorado).
- Mudança por API (`filterValue`, `searchText`, `clearFilter`) descarta o
  texto digitado e os timers da linha de filtro e da busca (o debounce não
  reaplica o rascunho por cima).
- A linha de filtro e o cabeçalho só editam as condições da coluna no nível
  de cima ligadas por `and`; uma expressão com `or` no topo fica intacta.
- Memória (spec 14): timers de digitação (`Debouncer`), fatia pendente e
  listeners de documento do menu/popover soltos no `hostDisconnected`; estado
  por coluna podado em `#syncColumns`. Diagnóstico em `_memoryStats`
  (`filterRowState`, `filterTimers`, `headerFilterOpen`).

## Referência medida
DevExtreme (demo DataGrid › Filtering, jQuery, 2026-11-18):
- Linha de filtro: `role=row`; célula `role=gridcell` com `aria-label` "Filter
  cell"; o operador é um `menubar`/`menuitem` "Search box" com
  `aria-haspopup`; o menu abre ao passar o mouse/clicar. Texto: Contains,
  Does not contain, Starts with, Ends with, Equals, Does not equal + Reset.
  Número e data: Equals, Does not equal, Less than, Greater than, Less than or
  equal to, Greater than or equal to, Between + Reset. Número é `spinbutton`;
  data é combobox com calendário.
- Busca: `input` com `aria-label` "Search in the data grid", placeholder
  "Search..."; destaque em `<span class="dx-datagrid-search-text">` (o nosso
  usa `<mark>`); procura o valor cru em números ("11800" acha, "11,800" não —
  o nosso procura o texto exibido, como pede a spec); status com
  "Data grid with N rows".
- Filtro do cabeçalho: botão `role=button` com `aria-label` "Show filter
  options for column '{x}'" e `aria-haspopup=dialog`; popover `role=dialog`
  "Filter options"; foco vai para "Select All" (`role=checkbox`); lista
  `role=listbox` multisseleção (datas: `role=tree` ano → mês → dia); OK /
  Cancel. Sem busca nem contagem por padrão (o nosso tem, como o set filter
  do AG Grid).
- `getCombinedFilter()` devolve a busca como `[campo, 'contains', texto]`
  ligados por `or` (com funções como campo; o nosso usa o `path`).
- `filterSyncEnabled: 'auto'` só sincroniza a linha com `filterValue` quando
  há painel de filtro; o nosso sincroniza sempre (fonte única).
