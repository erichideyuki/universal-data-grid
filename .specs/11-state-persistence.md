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
`state/grid-state.ts`, `state/storage.ts`, `grid.ts`.

## Testes
Ida e volta completa; estado corrompido; coluna removida; migração de
versão; `setState` parcial.

## Referência medida
(preencher)
