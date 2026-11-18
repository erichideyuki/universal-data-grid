# 25 — Dados em árvore

## Objetivo
Mostrar dados hierárquicos (pastas, organogramas, plano de contas, BOM) no
próprio `<u-grid>`: cada linha é um nó com recuo e botão de expandir na
"coluna da árvore", com filtro que preserva a hierarquia, ordenação dentro
de cada nível, resumos por nó, seleção recursiva, edição com "inserir
filho", exportação com nível, estado e carga sob demanda de filhos na fonte
remota — sem objeto por nó não visível (spec 16) e com o padrão `treegrid`
da APG.

## Referência
- **DevExtreme TreeList** (componente à parte que compartilha quase toda a
  API do DataGrid): `dataStructure: 'plain' | 'tree'` (`plain` = lista com
  `keyExpr` + `parentIdExpr`, raiz `rootValue` = 0, `null` ou `undefined`;
  `tree` = itens aninhados em `itemsExpr`, chaves geradas), `hasItemsExpr`
  (remoto: mostra o botão sem os filhos carregados; a carga pede
  `parentIds`), `autoExpandAll` (desliga as operações remotas e carrega
  tudo), `expandedRowKeys` (só as chaves listadas, ancestrais precisam
  estar lá), `filterMode: 'withAncestors' (padrão) | 'fullBranch' |
  'matchOnly'`, `expandNodesOnFiltering` (padrão `true`),
  `selection.recursive`, `addRow(parentId)`, `expandRow/collapseRow/
  isRowExpanded`, `onRowExpanding/Expanded/Collapsing/Collapsed`,
  `forEachNode`, `getNodeByKey`. Sem agrupamento e sem master-detail.
  Botão na 1ª coluna de dados.
- **AG Grid "Tree Data"** (Enterprise): `treeData: true` +
  `getDataPath` (caminho), `treeDataChildrenField` (aninhado) ou
  `treeDataParentIdField` (lista com pai); coluna automática
  (`autoGroupColumnDef`) com recuo e botão; `groupDefaultExpanded` (-1 =
  tudo); filtro mantém ancestrais e, por padrão, mostra os filhos de um pai
  que passa (`excludeChildrenWhenTreeDataFiltering` desliga); agregação nos
  pais (`aggFunc`, valor agregado no lugar do próprio); seleção
  `groupSelects: 'self' | 'descendants' | 'filteredDescendants'`;
  server-side com `isServerSideGroup`.

## Decisão: modo do `<u-grid>`, não `<u-tree-grid>`
**Recomendação: modo árvore do próprio `<u-grid>`** (propriedade
`treeMode`; os dois revisores concordam).
- **Reaproveitamento**: filtro, busca, ordenação, resumos, seleção, foco/
  teclado, edição, exportação, estado, colunas (fixar, bandas,
  virtualização), barra/menus, intervalo, linhas fixas, paginação,
  virtualizador, SSR e i18n já estão no `<u-grid>` e valem para a árvore
  sem cópia. Um `<u-tree-grid>` teria de herdar ou embrulhar o `DataGrid`
  inteiro (o `grid.ts` é um só componente) — duas tags para documentar,
  testar e manter em sincronia, e a mesma superfície duplicada no CEM.
- **Bundle**: um componente à parte não economiza bytes para ninguém (a
  subclasse carrega o grid inteiro); o modo custa só o módulo puro do row
  model (`src/row-model/tree.ts`) e o render do recuo/botão — estimativa
  < 6 KB minificado, medido na entrega (`npm run bundle:browser`).
- **Clareza**: o DevExtreme separa os componentes, mas o TreeList repete a
  API do DataGrid; o AG Grid usa o próprio grid (`treeData: true`). Aqui
  um atributo liga o modo; o que não combina com árvore (agrupamento,
  master-detail, linha inteira) fica declarado como exclusivo.

## Escopo
1. Entrada **aninhada** (`treeMode="nested"`, `childrenExpr`) e **plana**
   (`treeMode="flat"`, `keyExpr` + `parentKeyExpr`, raiz por
   `rootParentKey`).
2. Expandir/recolher por chave, tudo de uma vez, `*` (irmãos); estado no
   `GridState`; `autoExpandNodes`.
3. Filtro e busca com `treeFilterMode` (`with-ancestors` padrão,
   `full-branch`, `match-only`); ao mudar o filtro, os ancestrais dos nós
   que passam expandem (como `expandNodesOnFiltering: true`).
4. Ordenação dentro de cada nível.
5. Resumos: totais como hoje; resumos por nó (`summary.node`).
6. Seleção: comum (por nó) e recursiva opcional (pais com estado misto).
7. Edição: como hoje; `addRow(data, { parentKey })` e "Add child row" no
   menu da linha.
8. Exportação com o nível do nó.
9. Fonte remota: carga sob demanda dos filhos (`hasChildrenExpr`).
10. Coluna da árvore (`treeColumn`) com recuo e botão.
11. ARIA `treegrid` e teclado da APG adaptado ao foco de célula; RTL; SSR.

## API (revisada; aguarda aval)

`<u-grid>` — propriedades novas:

| Propriedade | Atributo | Tipo | Padrão | Descrição |
|---|---|---|---|---|
| `treeMode` | `tree-mode` | `GridTreeMode = 'none' \| 'nested' \| 'flat'` | `'none'` | Lista comum, árvore de filhos aninhados ou árvore por chave do pai. |
| `childrenExpr` | `children-expr` | `GridChildrenExpr<TItem> = string \| ((item) => readonly TItem[] \| null \| undefined)` | `'children'` | Filhos (só `nested`). |
| `parentKeyExpr` | `parent-key-expr` | `GridParentKeyExpr<TItem> = string \| ((item) => GridRowKey \| null \| undefined)` | `null` | Chave do pai (só `flat`; exige `keyExpr`; sem os dois, aviso e lista comum). |
| `rootParentKey` | `root-parent-key` | `GridRowKey \| null` | `null` | Chave de pai dos nós de 1º nível (`null`/`undefined` e pai inexistente também são raiz). Compara pelo texto da chave (o atributo é texto). |
| `hasChildrenExpr` | `has-children-expr` | `GridHasChildrenExpr<TItem> \| null` (`string \| ((item) => boolean)`) | `null` | Fonte remota: o nó tem filhos ainda não carregados. |
| `treeColumn` | `tree-column` | `GridColumnRef \| null` | `null` (= 1ª coluna de dados visível) | Coluna com recuo e botão. |
| `treeFilterMode` | `tree-filter-mode` | `GridTreeFilterMode = 'with-ancestors' \| 'full-branch' \| 'match-only'` | `'with-ancestors'` | O que o filtro/busca mostra. |
| `autoExpandNodes` | `auto-expand-nodes` | `boolean` | `false` | Nós começam expandidos (como `autoExpandGroups`/`autoExpandRows`). |
| `recursiveSelection` | `recursive-selection` | `boolean` | `false` | Marcar um nó marca os descendentes; pai com parte marcada = misto. Exige `selectionMode="multiple"` e `showCheckboxes` (senão, aviso e desligada). |

`summary.node?: GridNodeSummaryItem[]` (mesma forma de
`GridGroupSummaryItem`): resumos de cada nó com filhos, sobre os
descendentes visíveis; `summary.group` é ignorado no modo árvore. Na fonte
remota, desligado (aviso: os filhos não carregados deixariam o valor
parcial).

Métodos novos (radical `Node`: `expandRow`/`collapseRow` são do
master-detail):

- `expandNode(rowKey): Promise<boolean>` — nunca rejeita: `true` =
  expandido com os filhos prontos; `false` = erro de carga (vai ao
  `u-grid-load-error`), abortado, folha ou chave inexistente. Local:
  resolve `true` na hora.
- `collapseNode(rowKey): void`, `isNodeExpanded(rowKey): boolean`.
- `expandAllNodes(): void` / `collapseAllNodes(): void` (remoto: o "tudo"
  só alcança nós já carregados e não pede carga — aviso uma vez; idem
  `autoExpandNodes`).
- `getNodeSummaryValues(rowKey): GridSummaryValue[]`.
- `addRow(data?, options?: GridAddRowOptions)` com
  `GridAddRowOptions { parentKey?: unknown }` — o nó expande e a linha
  nova é o 1º filho dele; no `flat` o item novo recebe a chave do pai
  (só `parentKeyExpr` texto).

Evento novo: `u-grid-node-expansion-change` `{ rowKey, expanded, source }`
(`GridNodeExpansionChangeEventDetail`; `rowKey: null` em
`expandAllNodes`/`collapseAllNodes`), por gesto e por método, disparado no
pedido (antes da carga remota); erro de carga que recolhe o nó dispara de
novo com `expanded: false, source: 'api'`; a expansão automática dos
ancestrais pelo filtro não dispara (como os `autoExpand*`), mas entra no
`u-grid-state-change`.

Tipos e contratos que mudam:

- `GridLoadOptions.tree: GridLoadTree | null`, com
  `GridLoadTree { parentKeys: readonly (GridRowKey | null)[] | null }`:
  `tree: null` = lista comum; `parentKeys` = devolver os filhos desses nós
  (raiz = `[rootParentKey]`); `parentKeys: null` = filtro remoto ativo,
  devolver os nós que passam e os ancestrais deles, de uma vez.
- `GridState.nodeExpansion?: GridNodeExpansionState { all: boolean | null;
  expanded: GridRowKey[]; collapsed: GridRowKey[] }` (só com `keyExpr` e
  chaves string/number, como `rowExpansion`).
- `GridRowAddingEventDetail.parentKey: unknown` (`undefined` = raiz) e
  `GridEditChange.parentKey?: unknown` (inserção).
- `GridExportDataRow.level`: profundidade do nó (0 = raiz); a exportação
  leva o resumo por nó na coluna dele.
- Seleção: o setter de `selectedKeys` e `setState` aplicam as chaves como
  vêm (não propagam); gesto e métodos (`selectRows`…) propagam. Filhos
  remotos que chegam sob um pai marcado entram marcados e disparam
  `u-grid-selection-change` com `source: 'api'`.

CSS: `--u-grid-tree-indent` (recuo por nível, padrão `24px`),
`--u-grid-tree-toggle-color` (fallback `--u-grid-group-toggle-color`).
Parts: `tree-cell` (junto de `cell` no `<td>` da coluna da árvore),
`tree-toggle-button`; `expanded` passa a valer também na linha de nó
expandido.

i18n (14 idiomas): `expandNode` ("Expand"), `collapseNode` ("Collapse"),
`addChildRow` ("Add child row") — itens do menu da linha;
`childRowsLoadingAnnouncement` ("Loading child rows"),
`childRowsLoadedAnnouncement` ("Child rows loaded: {count}"),
`childRowsLoadErrorAnnouncement` ("Could not load child rows"),
`nodesExpandedAnnouncement` ("Expanded rows: {count}", para `*`).

Recusado: `expandAllNodes(level?)` com `levels` no estado (revisor de API,
BAIXA) — fica para depois, sem quebra.

## Comportamento

### Montagem
- `treeMode="flat"`: a chave vem de `keyExpr`, o pai de `parentKeyExpr`;
  `rootParentKey`, `null`, `undefined` ou pai inexistente = raiz (pai
  inexistente: aviso uma vez). Ciclo: o nó que fecha o ciclo vira raiz
  (aviso).
- `treeMode="nested"`: `items` são as raízes e `childrenExpr` dá os filhos;
  chave por `keyExpr` ou o próprio objeto; item repetido/ciclo é ignorado
  (aviso). O grid nunca muta os arrays do hospedeiro.
- Índice da árvore (puro, `src/row-model/tree.ts`): todos os nós num array
  (plana: o próprio `items`; aninhada: pré-ordem), pai/nível em
  `Int32Array`, chave → índice num `Map`. Filhos visíveis de cada nó em
  "compressed sparse rows" (`Int32Array`). Linhas = `RowList` com um
  segmento por trecho de irmãos (um por nó expandido), sem objeto por nó;
  o `DataRow` da janela visível ganha `tree: { node, level, posInSet,
  setSize }`.

### Expandir/recolher
- Clique no botão (o foco vai à célula da árvore da linha, que vira a
  ativa; `mousedown` não rouba o foco), teclado, `expandNode`/
  `collapseNode`, `expandAllNodes`/`collapseAllNodes`. Estado por chave
  (exceções sobre o padrão), mantido ao trocar `items`.
- Nó sem filhos visíveis (todos filtrados, ou remoto que respondeu 0) é
  folha: sem botão e sem `aria-expanded`.

### Filtro e busca
- O predicado (linha de filtro, filtro no cabeçalho, busca,
  `filterValue`) testa cada nó; `treeFilterMode`:
  - `with-ancestors` (padrão): nós que passam + ancestrais deles.
  - `full-branch`: + todos os descendentes dos nós que passam.
  - `match-only`: só os nós que passam; cada um fica sob o ancestral
    visível mais próximo (raiz se nenhum); recuo e `aria-level` seguem
    esse nível.
- Ao mudar o filtro/busca, os ancestrais dos nós que passam entram
  expandidos no estado; limpar o filtro não recolhe.
- Totais e "selecionar tudo" = nós que aparecem com o filtro.

### Ordenação
- Cada lista de irmãos é ordenada pelo mesmo comparador (estável) — uma
  ordenação global e os filhos de cada pai recolhidos nessa ordem, O(n).

### Resumos
- Totais: sobre os nós que aparecem com o filtro (não só os expandidos).
- `summary.node`: `inline` = texto depois do conteúdo da célula da árvore;
  `column` = no lugar do valor do nó naquela coluna, com estilo de resumo
  e rótulo completo `visually-hidden` (como as células de resumo), célula
  não editável; `footer` = linha de rodapé depois dos filhos do nó
  expandido (`aria-level` = nível dos filhos). Calculado só para os nós
  que aparecem (sob demanda, memorizado por reconstrução).

### Seleção
- Sem `recursiveSelection`: cada nó por si, como hoje.
- Com ela: marcar um nó marca os descendentes; um pai fica marcado quando
  todos os filhos estão, misto (caixa `aria-checked="mixed"`, linha
  `aria-selected="false"`) quando parte está. Espaço num nó misto marca a
  subárvore. `selectedKeys` lista todos os nós marcados.

### Edição
- Por nó, como hoje. "Add child row" (menu da linha, com `allowAdding`) e
  `addRow(data, { parentKey })`: o pai expande e a linha nova é o 1º filho
  dele, com o editor aberto; Esc/descartar devolve o foco à célula da
  árvore do pai. Excluir um nó com filhos marca só ele (cascata é do
  hospedeiro).

### Exportação
- O que o usuário vê (nós expandidos), na ordem; `level` = profundidade
  (o adaptador de Excel usa como recuo); CSV sem recuo.

### Fonte remota (`dataSource`)
- Exige `treeMode="flat"` (com `nested`, aviso e lista comum). A 1ª carga
  pede `tree: { parentKeys: [rootParentKey] }`; expandir um nó com
  `hasChildrenExpr` verdadeiro e filhos não carregados pede os dele
  (expansões do mesmo tick — `*`, várias `expandNode` — num pedido só).
  Enquanto carrega: indicador no botão, uma linha-esqueleto filha (fora
  do roving), `aria-busy` na linha. Erro: o nó volta a recolhido, anúncio
  de erro e `u-grid-load-error`.
- Ordenação/filtro com `remoteOperations.sorting/filtering`: enviados em
  cada pedido; trocar recarrega (a célula ativa volta pela chave ou vai ao
  ancestral visível mais próximo). Sem elas: no cliente, sobre os nós
  carregados. Paginação e agrupamento remotos não valem na árvore (aviso).
  Pedidos pendentes abortam ao trocar dados ou desconectar.

### Combinações
- **Agrupamento**: exclusivo. No modo árvore o painel de grupos some,
  `groupIndex`/`groupColumn` são ignorados (aviso uma vez); o agrupamento
  é preservado para quando o modo volta a `none`.
- **Master-detail** (`detailRenderer`) e **linha inteira** (`rowRenderer`):
  ignorados no modo árvore (aviso).
- Paginação local: por linhas visíveis (como o DevExtreme); `aria-setsize`
  é o do conjunto inteiro de irmãos mesmo que a página o corte.
- `scrollMode: 'infinite'`: ignorado na árvore (aviso).
- Linhas fixas, intervalo de células, colunas fixas/bandas, virtualização
  de colunas: valem sem mudança (fixas e rodapé de totais com nível 1).

## Acessibilidade
- Tabela com `role="treegrid"`. Linha de nó: `aria-level` (1 = raiz),
  `aria-setsize`/`aria-posinset` explícitos (irmãos da árvore exibida),
  `aria-expanded` só em nó com filhos (ou `hasChildren` remoto); o
  `aria-expanded` também no `gridcell` da coluna da árvore (como a célula
  de detalhe), para o leitor ler a mudança com o foco na célula. Rodapé
  por nó e esqueleto: `aria-level` dos filhos, sem `setsize`.
- Botão: `tabindex="-1"`, `aria-hidden="true"` (como o do grupo e o do AG
  Grid; o estado está na célula/linha); alvo ≥ 24×24 em CSS próprio
  (`rowHeight` < 24 quebra o 2.5.8 — documentado); acesso por voz: clicar
  na célula e dizer "seta direita" (documentado).
- Teclado (foco de célula), `→`/`←` trocados em RTL:
  - Célula da árvore: `→` num nó recolhido expande (o foco fica); num
    expandido ou folha, vai à célula seguinte. `←` num expandido recolhe;
    num recolhido/folha vai à célula da árvore do pai; numa raiz, à célula
    anterior. (Células à esquerda da árvore: Home ou ↑/↓ — documentado.)
  - Outras células: `←`/`→` como hoje.
  - `*` (`event.key === '*'`, sem editor aberto, mesmo com
    `editOnKeyPress`): expande os irmãos do nó; anúncio "Expanded rows:
    {count}". Nota no README: o `*` do teclado numérico é clique direito
    no NVDA/JAWS (layout desktop); Shift+8 funciona.
  - Enter na célula da árvore alterna só se a célula não edita e não tem
    focáveis do `renderer`; senão o Enter de hoje. F2 sempre edita/entra.
  - ↑/↓/Home/End/PageUp/PageDown/Ctrl+Home/Ctrl+End como hoje.
- Foco: recolher um nó com a célula ativa num descendente → célula da
  árvore do nó; `collapseNode`/`collapseAllNodes` com o foco fora do grid
  só realocam a célula ativa (nunca roubam o foco); recarga remota → pela
  chave ou ancestral visível; nunca ao `<body>`.
- Anúncios (`aria-live="polite"`): carga remota — "Loading child rows" só
  passando de 1 s; depois "Child rows loaded: {count}" (soma de um pedido
  em lote; 0 = vira folha) ou o erro (sempre, mesmo rápido).
  Expandir/recolher local não anuncia (o `aria-expanded` na célula basta).
- RTL: recuo pelo `padding-inline-start`; seta espelhada só recolhida
  (como o grupo). `forced-colors`: seta e indicador com `CanvasText`/
  `ButtonText`; `prefers-reduced-motion`: sem giro (reaproveita a regra
  do `.load-spinner`). Recuo profundo: largura mínima do conteúdo e nome
  acessível completo mesmo cortado.

## i18n
Chaves da seção API, nos 14 idiomas.

## Fora de escopo
- Master-detail e linha inteira em árvore; arrastar nós (frente 22).
- Carga remota paginada dos filhos (filhos de um nó vêm de uma vez).
- `getDataPath` (caminho, AG Grid) — dá para montar com `parentKeyExpr`.
- Nós "preenchedores" (pais que faltam, AG Grid).

## Arquivos
- `src/row-model/tree.ts` (+ `tree.test.ts`): índice, filtro por modo,
  ordenação por nível, resumos por nó, achatamento em `RowList`.
- `src/row-model/flatten.ts`: bloco de índices (trecho de irmãos).
- `src/grid.ts`: propriedades, pipeline, render da célula da árvore,
  teclado, seleção recursiva, remoto, estado, exportação.
- `src/grid-i18n.ts`, `src/grid.styles.ts`, `src/state/grid-state.ts`,
  `src/data/data-source.ts`, `src/export/*`.
- Testes: `src/tree.browser.test.ts`, `src/tree.memory.browser.test.ts`,
  cenário no `src/grid.perf.browser.test.ts`, SSR em `grid.ssr.test.ts`.

## Testes
- Unitários (Node): índice plano/aninhado, raiz, órfãos, ciclos;
  achatamento com expansão; filtro nos três modos; ordenação por nível;
  resumos por nó; seleção recursiva (estado misto).
- Navegador: render, botão, teclado (roteiro APG: →, ←, *, Enter, RTL),
  `axe-core` (recolhido, expandido, filtrado, RTL, esqueleto com
  `aria-busy`), `setsize` no `match-only` e com paginação, foco depois de
  recolher a partir de um descendente / Esc no "Add child row" / erro
  remoto, seleção recursiva, addRow filho, exportação, estado, remoto
  (carga, erro, aborto), `forced-colors` e movimento reduzido emulados.
- Manual: `aria-expanded` lido na célula (NVDA/JAWS) — roteiro na spec 17.
- SSR: árvore renderiza no `@lit-labs/ssr`.
- Vazamento: grid com árvore e carga remota pendente removido é coletado;
  expandir/recolher repetido não cresce.
- Desempenho (perfil fraco): 1 milhão de nós em 6 níveis — montar,
  expandir tudo, filtrar, rolar.

## Critério de pronto
`npm test`, `npm run test:perf`, `typecheck`, `lint` verdes; README e
`custom-elements.json`; revisores na entrega.

## Referência medida
(preenchida na implementação)
