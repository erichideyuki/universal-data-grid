# Specs de desenvolvimento — visão geral

> Diretório VERSIONADO (diferente do Universal Office): as frentes rodam em
> worktrees criados a partir da `main`, e só enxergam o que está commitado.
> Estado das frentes: `BACKLOG.md`. Regras do repositório: `CLAUDE.md`.

## Ordem

1. **01-foundation** — sequencial e obrigatória. Nada da Fase A começa antes
   dela estar na `main`.
2. **Fase A** (02–06) — até 3 em paralelo. Sugestão de primeiras levas:
   `02 + 03 + 06` (pastas diferentes), depois `04 + 05`.
3. **Fase B** (07–10) — `07` depende de `02`/`03`; `09` depende de `05`;
   `10` pode correr junto com qualquer uma.
4. **Fase C** (11–13) — `11` depende de tudo que tem estado (03, 04, 06, 07).

## Arquitetura-alvo (sai da Fundação)

```
src/
  grid.ts                 # orquestra: propriedades, ciclo de vida, compõe o resto
  grid-column.ts          # <u-grid-column> (declarativo)
  grid-column-def.ts      # GridColumnDef (público)
  grid-i18n.ts            # textos + context de idioma
  grid.styles.ts
  row-model/              # FUNÇÕES PURAS, sem DOM, testadas em Node
    pipeline.ts           # items → filter → sort → group → summarize → flatten
    group.ts  sort.ts  filter.ts  summary.ts  flatten.ts  value.ts  compare.ts
  render/                 # templates Lit sem estado
    header.ts  body.ts  group-row.ts  cell.ts  group-panel.ts
  features/               # ReactiveControllers com estado de interação
    column-dnd.ts  group-dnd.ts  keyboard.ts  selection.ts  resize.ts ...
  test/                   # helpers de teste de componente
```

Contrato do row model: entrada imutável (`items`, colunas, estado de
ordenação/filtro/grupo/expansão), saída `RowModel { rows: Row[]; totals;
groups }`. O grid nunca altera `items` nem os objetos de coluna do hospedeiro;
o estado do usuário (ordem, largura, grupo, ordenação, filtro, expansão) vive
num `GridState` interno (base da frente 11).

Identidade de linha: chave estável por `keyExpr` (frente 08) ou, sem ela, o
próprio objeto (`WeakMap`). O virtualizador recebe `getItemKey` por essa
chave — nunca pelo índice (causa do B1).

## Convenções obrigatórias

- pt-BR em specs/comentários; inglês em identificadores, README e interface.
- API pública nova: propriedade com atributo kebab-case explícito quando for
  primitivo; `attribute: false` para função/objeto/array. Booleano de
  atributo pelo conversor `booleanAttribute` (`src/attribute-converters.ts`):
  `"false"` desliga. Eventos `u-grid-<substantivo>-<verbo>` (ex.:
  `u-grid-sort-change`), `bubbles: true, composed: true`; os de "antes" no
  gerúndio e `cancelable` (`u-grid-sorting`). Regras completas de
  nomenclatura (métodos, `detail`, custom properties, `@internal`) em
  `15-api-review.md`; o subagente `webcomponent-api-reviewer` confere.
- Nada de quebrar API existente sem alias e aviso de deprecação no console
  (uma vez por instância).
- Cada spec tem: Objetivo · Referência · Escopo · API · Comportamento ·
  Acessibilidade · i18n · Fora de escopo · Arquivos · Testes · Critério de
  pronto · Referência medida (preenchida pela frente).

## Critério de pronto global (toda frente)

- `npm test`, `npm run lint`, `npx tsc --noEmit -p src` verdes.
- SSR do demo renderiza sem erro; conferido em `en`, `pt` e `ar` (RTL).
- Teclado e leitor de tela cobrem o recurso (sem gesto só de mouse).
- 100 mil linhas no demo continuam rolando sem travar (medir no DevTools:
  nenhum frame longo > 50 ms ao rolar).
- `API.md` + `custom-elements.json` atualizados.
