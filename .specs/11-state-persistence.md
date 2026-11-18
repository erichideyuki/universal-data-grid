# 11 — Estado e persistência

## Objetivo
Salvar e restaurar o layout do usuário: ordem, largura, visibilidade e
fixação das colunas, ordenação, filtros, agrupamento, expansão, página,
seleção.

## Referência
DevExtreme: `stateStoring: { enabled, type: 'localStorage'|'sessionStorage'|
'custom', storageKey, customLoad, customSave, savingTimeout }`, `state()`
get/set. AG Grid: `getState()`/`initialState`, `onStateUpdated`.

## Escopo — API
- `getState(): GridState` e `setState(state, { partial })`.
- `GridState` versionado (`{ version: 1, columns: [{ id, width, visible,
  fixed, order, groupIndex, sortOrder, sortIndex, filter }], search,
  filterValue, expandedGroups, pageIndex, pageSize, selectedKeys }`).
- Coluna precisa de `id` estável (padrão: `path`; obrigatório sem `path`).
- `state-storing="local|session"` + `state-key`; ou `customLoad`/
  `customSave` (async).
- Evento `u-grid-state-change` com debounce (padrão 500 ms).

## API (revisada pelos subagentes; aprovada pelo usuário em 2026-11-18)

**Coluna**
- `GridColumnDef.name?: string` ↔ `<u-grid-column name>` (sem reflexão): id
  estável da coluna no estado. Padrão: `path`. Sem `name` nem `path`: fora
  do estado (aviso uma vez); `name` repetido: só a 1ª (aviso).
  `GridColumnRef` (string, ex. `summary.column`) passa a resolver por `name`
  antes de `path`.

**Métodos**
- `getState(): GridState` — cópia nova, serializável em JSON, sem dado de
  linha.
- `setState(state: GridState, options?: { partial?: boolean }): void` —
  valida antes de aplicar (inválido: aviso, nada muda); versão antiga
  migrada, desconhecida descartada (aviso). Sem `partial`, chave de 1º
  nível ausente volta ao inicial; com `partial: true`, só as presentes
  mudam. `columns` presente = layout inteiro: coluna fora da lista volta à
  definição e vai ao fim, na ordem da definição; em cada entrada só `name` é
  obrigatório. Não dispara os eventos de cada recurso (como os setters).
- `resetState(): void` — tudo ao inicial.
- "Inicial" = definições das colunas + propriedades do hospedeiro
  (`filterValue`, `searchText`, `pageIndex`, `pageSize`, `selectedKeys`)
  copiadas no 1º connect, antes de restaurar. Storage e `setState` vencem
  os atributos iniciais; um set posterior do hospedeiro vence o estado.

**Tipos exportados** (de `grid.ts`; chaves de linha = `GridRowKey`, que já
existe)
```ts
interface GridState {
  version: 1;
  /** Na ordem de `moveColumn` (índices das comuns, ocultas contam); agrupadas: ordem irrelevante. */
  columns?: GridColumnState[];
  filterValue?: GridFilterExpression | null;   // colunas por `path` (não `name`)
  searchText?: string;
  groupExpansion?: GridGroupExpansionState;
  /** Só com `keyExpr` e chaves string/número. */
  selectedKeys?: GridRowKey[];
  rowExpansion?: { expanded: GridRowKey[]; collapsed: GridRowKey[] };
  pageIndex?: number;
  pageSize?: number;
}
interface GridColumnState {
  name: string;
  width?: number | null;           // escolhida pelo usuário; null = a da definição
  visible?: boolean;
  fixed?: GridColumnFixed;
  groupIndex?: number | null;
  sortOrder?: GridSortOrder | null;
  sortIndex?: number | null;
}
type GridStateGroupPath = readonly (string | number | boolean | null)[];
interface GridGroupExpansionState {
  all: boolean | null;              // expand/collapseAllGroups() sem nível; null = autoExpandGroups
  levels: (boolean | null)[];       // expand/collapseAllGroups(n)
  expanded: GridStateGroupPath[];   // grupos que diferem do padrão do nível
  collapsed: GridStateGroupPath[];  // (datas como texto ISO; outro objeto fica fora)
}
interface GridStateStorage {
  load(): GridState | null | Promise<GridState | null>;
  save(state: GridState): void | Promise<void>;
}
type GridStateChangeSource = GridChangeSource | 'storage';
interface GridStateChangeEventDetail {
  state: GridState;
  /** Origens da rajada (união). */
  sources: readonly GridStateChangeSource[];
}
```

**Propriedades**
- `stateStorage: 'local' | 'session' | GridStateStorage | null` ↔
  `state-storage` (objeto só por propriedade). Padrão `null`. Lê ao
  conectar (e de novo se esta ou a chave mudar), antes do 1º render de
  dados; grava após cada mudança e, pendente, no disconnect/`pagehide`.
  String inválida: aviso, desligado. `setState` antes de conectar dispensa a
  leitura.
- `stateStorageKey: string` ↔ `state-storage-key`: obrigatória para
  `local`/`session` (sem ela: aviso, desligado).
- `stateChangeDelay: number` ↔ `state-change-delay`: atraso (ms) do evento e
  da gravação após a última mudança. Padrão `500`.

**Evento**
- `u-grid-state-change` `{ state, sources }` (`bubbles`, `composed`, não
  cancelável; também no `HTMLElementEventMap`): uma vez por rajada, só se
  o estado mudou — gesto, método, setter ou `setState`. A restauração do
  storage dispara com `['storage']` (sinal de "pronto") e não grava.
  `sources` em vez de `source` é exceção registrada na spec 15.

**Fora do estado**: foco/célula ativa, rolagem, rascunhos da linha de
filtro, larguras auto-medidas, opções do hospedeiro.

## Acessibilidade (revisada)
- Restaurar nunca move o foco do DOM nem a célula ativa por conta própria;
  linha/coluna ativa que some usa a realocação existente (spec 17).
  Popovers (funil, menu da linha de filtro, seletor, menus) cuja coluna
  saiu de vista fecham; foco que estava neles vai à célula ativa.
- Nenhum anúncio na restauração: zera `#announceFilter`, cancela os
  temporizadores da busca e da linha de filtro. `setState` chamado por um
  botão do hospedeiro: quem anuncia é o hospedeiro (README).
- Storage assíncrono: tabela com `aria-busy="true"`, `aria-rowcount="-1"`,
  sem linhas nem "Sem dados", conteúdo oculto e inerte (nenhum gesto antes
  do estado chegar); painel de carga imediato (como a 08); "Carregando" na
  região viva só aos 300 ms e no máximo uma vez por carga inicial (estado +
  1ª consulta da fonte). `load()` que rejeita/lança ou JSON inválido: aviso
  no console, estado inicial, render normal (sem `role=alert`).
- SSR com `stateStorage`: o servidor renderiza o mesmo "carregando estado"
  (painel, `aria-busy`, região viva vazia); a hidratação casa e o estado
  entra no render seguinte.
- Editor da linha de filtro focado durante `setState`: mantém foco e
  cursor; valor só muda se diferente.

**Recusados**: `GridStateInput` para estados antigos no tipo do `setState`
(o JSON lido já é `any`; a migração é em tempo de execução). Prazo para
`load()` que nunca responde (como a fonte de dados da 08: o hospedeiro
resolve).

## Comportamento
- Estado restaurado antes do 1º render de dados (sem piscar).
- Estado com coluna que não existe mais é ignorado sem erro; versão antiga
  é migrada ou descartada.
- Nada de dado de linha no estado (só chaves).

## Segurança
`JSON.parse` do storage dentro de `try`; validar formato antes de aplicar
(storage é controlável pelo usuário/extensões); nunca `eval`.

## Fora de escopo
Sincronizar estado entre abas.

## Arquivos
`state/grid-state.ts` (tipos, `parseGridState`, migrações, limites),
`state/storage.ts` (`localStorage`/`sessionStorage` em `try`),
`state/versioned.ts` (`Map`/`Set` com versão), `grid.ts`.

## Decisões da implementação
- Mudança detectada por assinatura (identidades e versões de cada parte) no
  `updated()`, sem marcar cada ponto que escreve: frentes novas que guardam
  estado entram na assinatura e no `getState`. A origem da rajada vem dos
  eventos de mudança disparados (`dispatchEvent`); sem evento = `api`.
- O estado é aplicado direto nas estruturas internas (sem passar pelos
  métodos públicos): nenhum evento por recurso, nenhum anúncio, nenhum foco.
- Esperando o storage: o render não calcula as linhas (1 milhão de linhas
  não pagam o layout padrão antes do restaurado); `.state-loading` oculta a
  área de rolagem e o pager (`visibility: hidden`: fora do foco e da árvore
  de acessibilidade); só o painel de carga.
- SSR: o servidor (sem `connectedCallback`) usa `isServer` para renderizar
  "carregando estado"; o cliente detecta a hidratação (shadow root
  declarativo antes do 1º update) e lê o storage no `firstUpdated`.
- Expansão de grupos guarda o caminho de valores junto da chave interna;
  `getState` só exporta as entradas do agrupamento atual.
- `GridRowExpansionState` exportado com nome (o aprovado tinha o tipo em
  linha em `GridState.rowExpansion`), par de `GridGroupExpansionState`.
  `GridChangeSource` foi para `src/change-source.ts` (reexportado de
  `grid.ts`) e `GridStateChangeSource = GridChangeSource | 'storage'`.
- Avisos de coluna sem id/repetida só quando o hospedeiro usa o estado
  (storage, `getState`/`setState`/`resetState`).
- Limites do que vem de fora em `STATE_LIMITS` (colunas, chaves, grupos,
  profundidade/tamanho do filtro, textos, página). Estado inválido é
  recusado inteiro.

## Testes
`state/grid-state.test.ts` (validação, limites, protótipo, getter hostil,
migração); `state.browser.test.ts` (ida e volta completa, master-detail,
sem `keyExpr`, coluna removida, `partial`, `resetState`, inválido,
`pageSize`, `name`, evento, storage local/session/próprio síncrono e
assíncrono, corrompido/malicioso, storage que lança, chave trocada,
`setState` antes de conectar, foco e anúncios, popover);
`state.memory.browser.test.ts`; SSR (`grid.ssr.test.ts`) e hidratação
(`grid.hydration.browser.test.ts`, cenário `stored`); desempenho
(`grid.perf.browser.test.ts`, cenário `state-1m`).

## Referência medida
Pela documentação pública (sem abrir as demos nesta sessão): DevExtreme
`stateStoring` lê ao iniciar e grava após `savingTimeout` (padrão 2000 ms);
`state()` sem argumento lê, com objeto aplica, com `null` volta ao inicial.
AG Grid: `getState()`, `initialState` (só na criação) e `onStateUpdated`
com `sources`. Adotamos: leitura antes do 1º render, atraso padrão 500 ms
(spec), `resetState()` no lugar de `state(null)` e `sources` como o AG
Grid.
