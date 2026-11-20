# 14 — Memória: nenhum vazamento

## Objetivo

O `<u-grid>` tem de sumir da memória quando o hospedeiro solta a última
referência a ele — junto com linhas, colunas e `items` — e um grid de vida
longa não pode crescer com o uso (renders, rolagem, reagrupar, trocar
`items`). Requisito do usuário, de extrema importância: planejado, medido e
testado.

## Referência

Não há comportamento de referência (DevExtreme/AG Grid) a copiar. A régua é
o heap do Chromium: `WeakRef` dos objetos + coleta forçada pelo CDP.

## Escopo

1. Inventário de tudo que pode reter o grid ou dados do hospedeiro (abaixo).
2. Helper reutilizável `src/test/leak.ts` para os testes de navegador.
3. Testes `src/grid.memory.browser.test.ts` (falhavam antes de cada
   correção), `src/render/keyed-rows.browser.test.ts` e
   `src/row-model/cache.test.ts`.
4. Correções, sem API pública nova.
5. Regra permanente no `CLAUDE.md` e no passo 8 do fluxo (`BACKLOG.md`).

## API

Nenhuma pública. Diagnóstico interno (prefixo `_`, fora do README):
`DataGrid._memoryStats`, `_pendingLanguageRequests()` (`grid-i18n.ts`),
`_formatterCacheSize()` (`row-model/format.ts`), `_collatorCacheSize()`
(`row-model/compare.ts`).

## Inventário

Legenda do risco: **V** = vazava (corrigido aqui) · **L** = limitado ·
**OK** = liberado pelo próprio ciclo de vida.

| # | O quê | Onde | Risco | Como é liberado |
|---|---|---|---|---|
| 1 | Interações do interactjs (`scope.interactions.list`, array global) guardam o último `pointerdown` de cada ponteiro (`downPointer.target` = o grid) até o próximo `pointerdown` na página. Bastava um clique ou arrasto no grid para ele ficar vivo depois de removido; removido no meio de um arrasto, a interação parada também ficava. | `features/drag-helper.ts` | **V** | `releaseInteractions(grid)` no `disconnectedCallback`, depois do `unset`: descarta (`interactions:destroy` + `destroy()` + remove da lista) as interações paradas que apontam para o grid; o interactjs cria outra quando precisa. |
| 2 | Elementos registrados no interactjs (`interact(el)` vai para `scope.interactables.list`) | `features/*-dnd.ts` | OK | `InteractRegistry.prune()` a cada sincronização (solta os que saíram do DOM) e `clear()` no `disconnectedCallback`. |
| 3 | `.move-container` (fantasma do arrasto) dentro do contêiner | `features/*-dnd.ts` | **V** (menor) | Removido no `end`; arrasto interrompido pela remoção do grid não tem `end` → o `disconnectedCallback` remove os que sobraram (senão reapareceria ao reconectar). |
| 4 | `repeat` do lit-html 3.3 (até 3.3.3): `removePart` apaga o conteúdo e o marcador de início da parte, mas deixa o marcador de fim (`<!---->`) no DOM. Cada linha que saía da janela virtual deixava um comentário no `<tbody>`, para sempre (~80 por rodada de rolagem; 6 mil+ num grid de vida longa). | `grid.ts` | **V** | Linhas renderizadas por `keyedRows` (`render/keyed-rows.ts`): lista com chave sobre os helpers públicos de `lit/directive-helpers.js`, que remove também o marcador de fim (e limpa a parte se ela mostrava outra coisa, ex. "sem dados"). |
| 5 | `elementsCache` do virtualizador (`<tr>` medidas com `wrap`) só solta elementos desconectados quando `measureElement` é chamado sem elemento. Com `wrap`, rolar retinha toda linha já vista e os itens dela (351 → 4.640 `<tr>` no teste). | `grid.ts` `updated()` | **V** | `virtualizer.measureElement(null)` a cada `updated()` (percorre só o cache, que fica do tamanho das linhas visíveis). |
| 6 | `itemSizeCache` do virtualizador (altura medida por chave de linha). Sem `keyExpr` a chave é o objeto: cada troca de `items` deixava as chaves antigas para sempre. | `grid.ts` `updated()` | **V** | Ao trocar `items` com coluna `wrap`, `virtualizer.measure()` zera o mapa; as visíveis são remedidas no mesmo `updated()`. |
| 7 | Observers/listeners do virtualizador (`ResizeObserver` e `scroll` no contêiner) | `render/virtualizer.ts` | OK | Desde a spec 16 o virtualizador é próprio (sai o `@tanstack/lit-virtual`): controller registrado no host, `hostDisconnected` solta o listener e o observer; não guarda `<tr>` nem chaves (itens 5 e 6 deixam de existir); alturas medidas (`wrap`) são por índice e zeram a cada troca de linhas. Teste em `render/virtualizer.browser.test.ts`. |
| 8 | `ContextRoot` do @lit/context no `body`: empilha cada pedido de context sem provedor (objeto + 2 `WeakRef`) e só esvazia quando surge um provedor. Página que cria/destrói grids sem `setGridLanguage` → cresce para sempre (103 entradas após 100 grids). | `grid-i18n.ts` | **V** | Substituído por `PendingLanguageRequests`: só o context do grid; descarta pedidos de elementos coletados ou desconectados (limpeza amortizada ao dobrar de tamanho, mínimo 16); provedor tardio redespacha os pedidos dos conectados. Continua uma instância por página (`Symbol.for`). |
| 9 | Provedor de `setGridLanguage(lang, host)` (`subscriptions` guarda o consumidor) | `grid-i18n.ts` | OK | `WeakMap` por host; o `ContextConsumer` do grid cancela a inscrição no `hostDisconnected`. Testado com provedor num host que continua na página. |
| 10 | `observeDocumentLanguage` (um `MutationObserver` + `Set` de listeners) | `grid-i18n.ts` | OK | Inscrição no `connectedCallback`, cancelada no `disconnectedCallback`; o observer desconecta quando o `Set` esvazia. |
| 11 | Cache de formatadores `Intl` (chave = tipo + idioma + opções do hospedeiro) | `row-model/format.ts` | **V** → **L** | `LruCache` de 128 entradas (`FORMATTER_CACHE_LIMIT`). |
| 12 | `Map` de collators por idioma | `row-model/compare.ts` | **V** → **L** | `LruCache` de 32 entradas (`COLLATOR_CACHE_LIMIT`). |
| 13 | `WeakMap`s de módulo: chave de linha por objeto (`objectKeys`) e id de coluna (`columnIds`); `_nativeColumnMap` por instância | `grid.ts` | OK | Fracas: somem com o item/coluna/elemento. Os contadores (`nextObjectKey`, `nextColumnId`) são números. |
| 14 | `div`s do light DOM dos renderers que devolvem `HTMLElement`, `AbortController` do `ctx.signal` | `render/content.ts` (frente 10; antes `grid-custom-cell.ts`) | OK | A diretiva (`AsyncDirective`) aborta o `signal` e tira o `div` quando descarta o conteúdo: dependências novas, parte removida da janela virtual (`removePart`) ou grid desconectado. Teste em `templates.memory.browser.test.ts`. |
| 14b | Estado de expansão do master-detail, alturas medidas dos detalhes, `ResizeObserver` das linhas de detalhe | `grid.ts` (frente 10) | OK | Expansão guarda só chaves fora do padrão (retém a chave até recolher, como `selectedKeys`); alturas num `WeakMap` por item (primitivos: LRU de 256); o observer acompanha só as linhas renderizadas e é desconectado no `disconnectedCallback`. |
| 15 | `#groups`/`#rows`/`#dataTypes`/`#columnViews` (seguram `items` e colunas) | `grid.ts` | OK | Refeitos no render seguinte à troca de `items`/`columns` (o Lit continua atualizando depois de desconectado); `#dataTypes` é limpo a cada troca. |
| 16 | `#expansion` (estado de expansão por chave de grupo, sobrevive à troca de dados — B14) | `grid.ts` | L | Frente 07: só guarda grupos fora do padrão do nível (voltar ao padrão apaga a entrada); `expandAllGroups`/`collapseAllGroups` limpam o nível (ou tudo) e mudar `autoExpandGroups` zera. Some com o grid. |
| 17 | `setGridTranslation` (tabela de traduções) | `grid-i18n.ts` | L | Só cresce quando o hospedeiro chama, com idiomas que ele escolhe. |
| 18 | Closures de eventos (`@pointerover`, `@slotchange`, `onToggle`, listeners do interactjs que capturam o grid) | vários | OK | Ficam em elementos do próprio grid ou em `Interactable`s soltos no `unset`. |
| 19 | Avisos de depreciação (`#warnedDeprecations`) | `grid.ts` | OK | Por instância. |
| 21 | Ordenação: `#sorting` (colunas) e `#rankCache` (`Int32Array` de postos por coluna, do tamanho de `items`) | `grid.ts` | L | Por instância; `#rankCache` é limpo ao trocar `items`, colunas ou idioma e só tem colunas ordenadas; colunas removidas saem de `#sorting` no `#syncColumns`. `_memoryStats.sortRanks`. Teste em `sorting.memory.browser.test.ts`. |
| 22 | Listener `down` do limiar de arrasto (`trackDragThreshold`) | `features/drag-helper.ts` | OK | Registrado no mesmo `Interactable` do cabeçalho/chip; sai no `unset` (itens 1–2). |
| 20 | Chromium: cada `<thead>` em shadow root deixa um `MediaQuerySet` no `StyleEngine` do documento (~0,6 KiB por grid criado; reproduz com `attachShadow` + `innerHTML`, sem Lit). | Blink | Externo | Fora do alcance do JS. Contornar exigiria trocar o `<thead>` por outro `<tbody>` (muda seletores do fixture e o cabeçalho que as frentes 03/06 estão mexendo) — pendência. |
| 21 | Frente 06: listener `pointerdown` (captura) no `document` do seletor de colunas | `features/column-chooser.ts` | OK | Só enquanto o seletor está aberto; removido ao fechar e no `hostDisconnected` (controller do host). |
| 22 | Frente 06: painel do seletor registrado como dropzone no interactjs; popover na top layer | `features/column-chooser.ts` | OK | `InteractRegistry` podado a cada update e limpo no `hostDisconnected` (antes do `releaseInteractions`); o popover sai da top layer ao sair do DOM. `_memoryStats.chooserDropzones`. |
| 23 | Frente 06: sessão de redimensionar (listeners na alça, captura do ponteiro, colunas) | `features/resize.ts` | OK | Solta no `pointerup`/`pointercancel` e em `cancel()`, chamado no `disconnectedCallback` antes do `super` (o `ref` do contêiner ainda existe). |
| 24 | Frente 06: `ResizeObserver` do contêiner de rolagem e listener de `scroll` (sombras das fixas) | `grid.ts` | OK | Observer desconectado no `disconnectedCallback` e recriado ao reconectar; o `scroll` fica no próprio shadow root. |
| 25 | Frente 06: estado por coluna (`#userWidths`, `#userVisible`, `#userFixed`, `#autoWidths`, `#renderedWidths`, `#hostOptions`) — seguram colunas | `grid.ts` | L | No máximo uma entrada por coluna definida; colunas que saem de `columns` são podadas em `#syncColumns`. `_memoryStats.columnState`. |
| 26 | Frente 07: listener `pointerdown` (captura) no `document` do menu do painel de grupos | `features/group-panel-menu.ts` | OK | Só com o menu aberto; removido ao fechar e no `hostDisconnected`. Teste em `summaries.memory.browser.test.ts` (grid removido com o menu aberto é coletado). |
| 27 | Frente 07: resumos (`#totalSpecs`/`#groupSpecs` seguram `summary`, colunas e funções próprias; `#totals` e `GroupNode.summaries` os valores) e o separador de lista do idioma | `grid.ts`, `row-model/summary.ts` | OK | Por instância; refeitos ao trocar `summary`, `items` ou colunas. O separador é uma entrada por instância (idioma atual). |
| 28 | Frente 04: timers de digitação (linha de filtro por coluna, busca) — 300 ms | `features/search.ts` (`Debouncer`) | OK | Controller do host: `clearTimeout` de todos no `hostDisconnected`; coluna removida cancela o seu no `prune`. `_memoryStats.filterTimers`. |
| 29 | Frente 04: filtragem em fatias (`MessageChannel`, máscara parcial, segura `items` e o predicado) | `features/filtering.ts` | OK | Cancelada (porta fechada) no `hostDisconnected` e a cada nova mudança de filtro; a máscara guardada é do tamanho de `items` e trocada com eles. |
| 30 | Frente 04: listener `pointerdown` (captura) no `document` do menu de operação e do popover do filtro do cabeçalho; valores distintos do popover | `features/filter-row.ts`, `features/header-filter.ts` | OK | Só enquanto aberto; removido ao fechar e no `hostDisconnected`; coluna removida fecha o popover/menu. `_memoryStats.headerFilterOpen`. |
| 31 | Frente 04: rascunho e operação escolhida por coluna da linha de filtro | `features/filter-row.ts` | L | No máximo uma entrada por coluna; podados em `#syncColumns`. `_memoryStats.filterRowState`. Testes em `filtering.memory.browser.test.ts`. |
| 32 | Frente 12: exportação em fatias (promessa pendente segura o instantâneo: `items`, grupos, colunas, formatadores) | `export/write.ts` | OK | Termina ou rejeita (`AbortError`) na próxima fatia depois do `signal`; nada de módulo. Grid removido com exportação abortada no meio é coletado (`export.memory.browser.test.ts`). |
| 33 | Frente 12: download (`URL.createObjectURL` + `setTimeout` de 1 s para revogar) e `<a download>` temporário | `export/download.ts` | OK | O `<a>` sai do DOM na hora; o timer só segura a URL (não o grid) e revoga o `Blob`. |
| 34 | Frente 12: Ctrl+C — listener `copy` na tabela (binding do Lit) | `grid.ts`, `features/clipboard.ts` | OK | Sai com o DOM do grid; sem listener no `document`. |
| 35 | Frente 08: pedidos à fonte em voo (`AbortController` + promessa da fonte) | `data/remote-loader.ts` | OK | Abortados ao trocar a consulta (ordenação, filtro, grupo, `refresh`), ao trocar `dataSource` e no `disconnectedCallback` (`RemoteLoader.dispose`); respostas tardias são descartadas. `_memoryStats.pendingLoads`. |
| 36 | Frente 08: temporizador dos pedidos de blocos (30 ms depois do render) | `grid.ts` | OK | `clearTimeout` no `disconnectedCallback` e a cada render. `_memoryStats.loadTimers`. |
| 37 | Frente 08: cache de blocos da fonte remota (segura itens do servidor) e grupos carregados | `data/remote-loader.ts` (`LruCache`) | L | Por geração (consulta): no máximo `BLOCK_CACHE_LIMIT` (200) blocos; a geração velha é solta quando a nova responde; trocar `dataSource` solta tudo. Grupos: só listas de grupos expandidos da geração atual. `_memoryStats.cachedBlocks`. Testes em `data-source.memory.browser.test.ts`. |
| 38 | Frente 08: `keyExpr` (função do hospedeiro) e seleção por chave | `grid.ts` | OK | Por instância. Com `keyExpr`, a seleção guarda as chaves (não os itens): trocar `items` solta os objetos velhos. |
| 39 | Nome do grid pelo hospedeiro: `MutationObserver` dos alvos do `aria-labelledby` e da raiz; `ariaLabelledByElements` da tabela (segura os alvos) | `features/host-label.ts` | OK | Alvos (texto) e a raiz (documento ou shadow root externo: só `childList` + `id`). No `disconnectedCallback` os observadores saem e a tabela solta os elementos; refeito ao reconectar (`_memoryStats.hostLabelObservers`). Teste em `host-label.browser.test.ts` (grid removido coletado com o alvo vivo; 2000 trocas sem crescer). |
| 40 | Frente 11: temporizador da rajada do estado (`stateChangeDelay`) | `grid.ts` | OK | Só agenda conectado; no `disconnectedCallback` a rajada pendente é avisada/gravada e o timer solto (render depois de desconectar não rearma). `_memoryStats.stateTimers`. |
| 41 | Frente 11: listener `pagehide` na `window` (grava a rajada pendente) | `grid.ts` | OK | Só conectado e com `stateStorage` válido; removido no `disconnectedCallback` e ao desligar o storage. `_memoryStats.pageHideListeners`. |
| 42 | Frente 11: `load()` assíncrono do storage pendente (a promessa segura o grid) e estados à espera de colunas | `grid.ts` | OK | Promessa do hospedeiro: um `load()` que nunca responde não impede a coleta (ciclo sem raiz). Resposta velha (outra leitura, `setState`) é descartada por geração. Estados à espera saem no 1º `willUpdate` com colunas. `_memoryStats.pendingStates`. Testes em `state.memory.browser.test.ts`. |
| 43 | Frente 09: mudanças pendentes (`EditStore`: item original, `data`, itens fundidos), linhas novas e o `WeakMap` item novo → chave provisória | `grid.ts`, `features/editing.ts` | OK | Por instância; saem ao salvar, descartar, trocar `items` sem a chave ou trocar `dataSource`. `_memoryStats.pendingEdits`/`addedRows`. |
| 44 | Frente 09: validações assíncronas (`AbortController` por célula, promessa do hospedeiro) e o temporizador "Salvando…" (1 s) | `grid.ts`, `features/validation.ts` | OK | Abortadas ao digitar de novo, ao cancelar e no `disconnectedCallback` (a espera corre contra o `abort`: promessa do hospedeiro que nunca responde não segura o grid); timer limpo no `disconnectedCallback` e não criado com o grid fora do DOM. `_memoryStats.validations`/`editTimers`. |
| 45 | Frente 09: editor `HTMLElement` (light DOM, pelo `rendererContent`) e a mensagem de erro no light DOM; diálogo de exclusão (`showModal`) | `grid.ts`, `render/content.ts` | OK | Editor e mensagem saem ao fechar o editor e no `disconnectedCallback`; o diálogo sai com o DOM do grid. Testes em `editing.memory.browser.test.ts` (removido com editor, validação e `waitUntil` pendentes e diálogo aberto é coletado; uso repetido não cresce). |

| 40 | Frente 13: `<slot>` + `slotchange` de cada `<u-grid-column>` (bandas declarativas) | `grid-column.ts` | OK | Binding do Lit no shadow root da coluna; sai com ela. |
| 41 | Frente 13: listener `scroll` horizontal (janela de colunas) e caches por render (irmãs, bandas visíveis, cabeçalho lógico) | `grid.ts` | OK | Listener no contêiner do próprio shadow root (sai com ele, como o das sombras); caches seguram só as colunas atuais e são trocados a cada mudança de ordem/árvore/visibilidade. |
| 42 | Frente 13: células com chave (virtualização de colunas) | `grid.ts`, `render/footer.ts` | OK | `keyedRows` em vez do `repeat` do Lit 3.3, que deixa um comentário por item removido (medido: +120 nós por rolagem horizontal). Testes em `bands.memory.browser.test.ts`. |
| 46 | Frente 21: responsivo — conjunto de colunas ocultas por falta de espaço, temporizador do anúncio (1 s), foco/editor da linha adaptativa | `grid.ts`, `features/adaptive.ts` | OK | Usa o `ResizeObserver` que o grid já tem no contêiner (solto no `disconnectedCallback`); timer do anúncio limpo no `disconnectedCallback`; guarda só as colunas atuais (sem objeto por linha). Conteúdo `HTMLElement` de renderer na linha adaptativa sai pelo `rendererContent` (slot próprio, `signal` abortado). `_memoryStats.adaptiveTimers`/`adaptiveColumns`. Testes em `responsive.memory.browser.test.ts`. |
| 47 | Frente 25: índice da árvore (nós, `Int32Array`s, chave → índice: tabela densa ou `Map`), visão filtrada e resumos por nó memorizados | `grid.ts`, `features/tree.ts`, `row-model/tree.ts` | OK | Por instância; trocados com `items`/expressões/filtro; os resumos memorizados só dos nós renderizados, limpos a cada reconstrução. Exceções de expansão retêm a chave (como `rowExpansion`). `_memoryStats.nodeSummaries`/`treeExpansion`. |
| 48 | Frente 25: cargas de filhos da árvore remota (`AbortController` por pedido em lote, promessas de `expandNode`, fila do microtask) e o temporizador "Carregando filhos" (1 s) | `grid.ts` | OK | Abortadas e resolvidas `false` ao recolher, trocar a fonte/consulta e no `disconnectedCallback`; timer limpo junto. `_memoryStats.treeLoads`/`treeTimers`. Testes em `tree.memory.browser.test.ts` (removido com cargas pendentes é coletado; uso repetido não cresce). |
| 49 | Frente 27: contêiner externo de rolagem — `scroll`/`scrollend` e `resize` no contêiner ou na janela (controller e virtualizador), `ResizeObserver` no contêiner, `IntersectionObserver` nas linhas renderizadas, `requestAnimationFrame` do 1º tamanho da janela, alvo auxiliar do `scrollIntoView` e folha adotada da instância | `features/scroll-port.ts`, `render/virtualizer.ts` | OK | Soltos ao trocar de contêiner, ao voltar para a rolagem interna e no `hostDisconnected` (esperas de `scrollend` terminam já, o quadro é cancelado); linhas observadas só as renderizadas (diff a cada render); o alvo sai no fim da rolagem. Teste em `parent-scroll.memory.browser.test.ts` (grid coletado com o contêiner vivo; trocar de contêiner 12× não cresce). |

## Medição (`src/test/leak.ts`)

- `collectGarbage()`: duas passadas de `HeapProfiler.collectGarbage` pelo
  `cdp()` do `vitest/browser`, cada uma numa tarefa nova (o `WeakRef`
  criado na tarefa atual segura o alvo até o fim dela).
- `track({...})` + `expectCollected(tracked)` / `aliveAfterGc(tracked)`:
  `WeakRef` por nome; a falha lista o que não foi coletado.
- `measureHeap()`: `Runtime.getHeapUsage` (heap JS do isolate, inclui o
  orquestrador do Vitest) e `Performance.getMetrics` (`Nodes`,
  `JSEventListeners`, `Documents`); `heapDelta(before, after)`.
- Para achar o retentor: `HeapProfiler.takeHeapSnapshot` (chunks via
  `cdp().on('HeapProfiler.addHeapSnapshotChunk')`), gravar com
  `server.commands.writeFile` dentro do projeto e analisar em Node
  (retentores a partir de `(GC roots)`). Foi assim que saíram os itens 4 e 20.

Regras para escrever teste de vazamento: crie e use o grid dentro de uma
função `async` que devolve só `WeakRef`s; nada de guardar o grid em
variáveis do teste, `expect`, mocks ou closures que sobrevivam ao cenário.

## Testes

`src/grid.memory.browser.test.ts`:

- grid usado (grupos em 2–3 níveis, renderer, coluna `wrap`, formato
  `Intl`, rolagem, `language`, provedor de `setGridLanguage`, `<html lang>`,
  reagrupar pela API e por arrasto real do interactjs) e removido → grid,
  `items`, item, colunas, linha e `div` de célula customizada coletados;
- grid nunca conectado → coletado;
- trocar `items` → itens antigos coletados;
- remover no meio de um arrasto → coletado, sem fantasma, e o próximo grid
  arrasta normalmente;
- 100 grids sem provedor de idioma → pedidos pendentes < 20; provedor
  tardio ainda alcança o grid conectado;
- 300 colunas com formatos diferentes → cache de formatadores ≤ 128;
- 50 ciclos de criar/usar/destruir → nós e listeners voltam à linha de
  base (< 30), heap < 512 KiB;
- grid de vida longa (37 rodadas: troca de `items`, expandir, 5 rolagens,
  reagrupar, 20 renders) → registros internos constantes, `<tr>` retidas ≤
  linhas no DOM, alturas medidas não acumulam, sem comentários soltos no
  `<tbody>`, nós/listeners na base, heap < 512 KiB, `items` da 1ª rodada
  coletados.

`src/render/keyed-rows.browser.test.ts`: janela deslizante sem sobra de
marcadores, reaproveitamento por chave, chaves repetidas e troca com outro
conteúdo. `src/row-model/cache.test.ts`: LRU e limites dos caches.

Cada teste foi conferido falhando com a correção desligada (itens 1, 3, 4,
5, 6, 8, 11, 12).

## Critério de pronto

`npm test`, `npm run typecheck`, `npm run lint` verdes; regra permanente no
`CLAUDE.md` e no passo 8 do `BACKLOG.md`.

## Referência medida (Chromium headless do Playwright, 2026-11-17)

| Medida | Antes | Depois |
|---|---|---|
| Grid clicado/arrastado e removido | retido pelo interactjs | coletado |
| Grid removido no meio de um arrasto | retido (grid, itens, cabeçalho, fantasma) | coletado |
| Grid de vida longa, `<tr>` no `elementsCache` (`wrap`) | 351 → 4.640 | ≤ linhas no DOM (14) |
| Grid de vida longa, alturas medidas após 37 trocas de `items` | 4.130 | ~110 (uma rodada) |
| Comentários soltos no `<tbody>` | +80 por rodada de rolagem (6.817 no fim) | constante |
| Nós DOM após 37 rodadas | +6.337 | 0 |
| Pedidos de idioma pendentes após 100 grids | 103 | < 20 |
| 50 ciclos criar/destruir: nós / listeners | — | 0 / 0 |
| 50 ciclos criar/destruir: heap | — | +180–330 KiB (aquecimento; 150 ciclos ≈ +390 KiB) |
| Grid de vida longa: heap | — | +180 KiB |

## Fora de escopo / pendências

- Item 20 (Chromium, `<thead>` em shadow root): reportar ao Chromium e,
  depois das frentes 03/06, decidir se troca o `<thead>` por `<tbody>`.
- Item 4: reportar ao Lit (`removePart` não remove `endNode`); quando
  corrigido, `keyedRows` pode voltar a ser `repeat`.
- `#expansion` sem `keyExpr` (frente 08) e API de expansão (frente 07).
