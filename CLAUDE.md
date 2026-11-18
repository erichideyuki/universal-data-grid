# Data Grid — regras do repositório

`<u-grid>` (`@universal-material/data-grid`): web component de grid de dados
em Lit, com virtualização de linhas (própria, `src/render/virtualizer.ts`), agrupamento e
reordenação por arrasto (`interactjs`), i18n por Lit context e SSR
(`@lit-labs/ssr`).

## Onde está cada coisa

- **Backlog e fluxo de trabalho**: `BACKLOG.md` (lacunas frente ao DevExtreme
  DataGrid / AG Grid, estado de cada frente, fluxo combinado).
- **Specs**: `.specs/NN-*.md` — uma por frente. `00-overview.md` tem as
  convenções; `01-foundation.md` é a fase 0 (obrigatória antes das outras);
  `90-audit.md` é a auditoria de bugs e segurança.
- **README.md**: vitrine pública e referência da API, em inglês. API nova
  entra lá na mesma entrega.

## Convenções

- Docs de manutenção, specs e comentários em pt-BR; identificadores, README,
  textos da interface e mensagens de commit em inglês.
- ESM, imports com extensão `.js` dentro de `src/` (não `.ts`).
- Estado interno com `#private`; o que os adaptadores precisam enxergar usa
  prefixo `_` + `/** @internal */` (some das `.d.ts` e do
  `custom-elements.json`) e não é API pública (não documentar no README).
- JSDoc da API pública em inglês (vira o `custom-elements.json`): toda
  propriedade, método, evento (`@fires`), custom property (`@cssprop`) e
  part (`@csspart`).
- Nada de mutar dados do consumidor: `items`, `columns` e os objetos de
  `GridColumnDef` são do hospedeiro. O grid copia antes de ordenar/agrupar e
  guarda o próprio estado (ordem, largura, agrupamento) fora deles.
- Textos da interface sempre pela tabela de `src/grid-i18n.ts` — chave nova
  entra nos 14 idiomas no mesmo commit (o tipo `GridI18n` obriga).
- Todo valor do usuário é renderizado por binding de texto do Lit. Nunca
  `innerHTML`/`unsafeHTML` com dado de linha, rótulo ou tradução.
- Recurso visível precisa de: teclado, ARIA (padrão "grid" da WAI-ARIA APG),
  RTL (`dir="rtl"`, o árabe é idioma embutido) e SSR sem quebrar.

## Revisão de API pública

Toda API pública (propriedade/atributo, método, evento e `detail`, tipo
exportado, custom property `--u-grid-*`, `::part`) passa pelo subagente
`webcomponent-api-reviewer` (`.claude/agents/`) duas vezes: sobre a
proposta, ANTES de levá-la ao usuário (que recebe a versão já revisada), e
sobre a implementação, na entrega (passos 5 e 10 do fluxo no `BACKLOG.md`).
Decisões de nomenclatura já tomadas ficam em `.specs/15-api-review.md`.
Mudança de API pública só com aval do usuário; renomear exige alias com
aviso de deprecação.

## Comportamento de referência

O "oráculo" do projeto é o comportamento do **DevExtreme DataGrid** (demos
públicas) e, quando ele não cobre, do **AG Grid Community**. Copiamos
COMPORTAMENTO (o que acontece no clique, no teclado, na ordem, nos padrões),
nunca código, CSS, ícones ou textos — ambos são produtos comerciais. A frente
anota o que mediu na própria spec (seção "Referência medida").

## Testes

- `npm test` — Vitest em dois projetos: `node` (`src/**/*.test.ts`: row
  model e SSR) e `browser` (`src/**/*.browser.test.ts`, Chromium headless do
  Playwright — `npx playwright install chromium` na 1ª vez). Helpers em
  `src/test/fixture.ts`.
- `npm run lint` e `npm run typecheck` limpos (o typecheck cobre o build e os
  testes; o `tsconfig` de `src/` exclui os testes do `dist/`).
- `npm run test:perf` — projeto `perf` (`src/**/*.perf.browser.test.ts`), fora
  do `npm test`: perfil de máquina fraca (GPU desligada, CPU 4× mais lenta
  que o desktop de referência — trabalho medido × fator calibrado por
  micro-benchmark —, heap de 1 GiB, 1366×768), cenários de 100 mil a 5
  milhões de linhas. Harness em `src/test/perf.ts`; orçamentos,
  calibração e linha de base em `.specs/16-performance.md`. Não medir no
  painel de navegador do app — ele estrangula o `requestAnimationFrame`.
- Demo: `npm run dev` (dados sintéticos; `?rows=100000`, `?remote` para a API
  countriesnow.space).
- Bug corrigido entra com teste que falhava antes.
- **Memória (regra permanente, spec 14)**: todo recurso que registra
  listener, observer, timer, registro em biblioteca (interactjs, context) ou
  cache de módulo precisa liberar no `disconnectedCallback` — ou ser
  limitado (`LruCache` em `src/row-model/lru.ts`) — e ter teste de vazamento
  no navegador com `src/test/leak.ts` (`expectCollected`, `measureHeap`):
  grid usado com o recurso e removido é coletado, e o uso repetido num grid
  de vida longa não cresce. Inventário do que já existe em
  `.specs/14-memory.md`.
- **Desempenho (regra permanente, spec 16)**: toda frente que mexe em dados,
  render ou interação roda `npm run test:perf` no perfil fraco antes de
  entregar e não pode piorar a linha de base
  (`.specs/16-performance.baseline.json`) além da tolerância, nem estourar
  os orçamentos da spec 16. Recurso novo entra com cenário/métrica no
  `src/grid.perf.browser.test.ts`; linha de base só é regravada
  (`PERF_UPDATE_BASELINE=1`) no mesmo commit da mudança, com o porquê. Nada
  de custo por linha onde o custo pode ser por linha VISÍVEL (o row model
  guarda segmentos, `RowList`, não um objeto por item).

## Segurança e dependências

- Só o que o componente usa em runtime fica em `dependencies` (hoje `lit`,
  `@lit/context`, `interactjs`). Servidor de dev,
  SSR de demo e Material Web são `devDependencies`.
- O servidor de dev escuta só em `localhost`.
- `npm audit --omit=dev` precisa estar zerado para publicar.

## Fluxo em paralelo

Cada frente do `BACKLOG.md` roda numa sessão própria, em worktree próprio (as
specs são versionadas justamente para o worktree enxergá-las). A frente não
edita o `BACKLOG.md` nem o estado de outra frente: a sessão coordenadora faz
o merge na main, atualiza o estado e abre a próxima.
