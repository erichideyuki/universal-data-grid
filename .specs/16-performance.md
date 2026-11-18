# 16 — Desempenho em máquina fraca

## Objetivo

O `<u-grid>` tem de ser fluido com volume absurdo de dados (1 a 5 milhões de
linhas) numa máquina MAIS FRACA que a de desenvolvimento — a máquina do
usuário (desktop recente) não serve de parâmetro. Requisito do usuário:
medir num perfil de máquina fraca reproduzível, com orçamentos e linha de
base, e não deixar nenhuma frente piorar.

## Perfil de máquina fraca

Projeto `perf` do `vitest.config.ts` (Chromium headless do Playwright) +
harness `src/test/perf.ts`.

| Item | Decisão | Por quê |
|---|---|---|
| GPU | `--disable-gpu --disable-gpu-compositing` | raster e composição por software, como em máquina sem GPU útil |
| CPU | fator **4×** sobre o desktop do usuário, **calibrado** por micro-benchmark (abaixo) | o que mais pesa numa máquina fraca é a CPU de um núcleo; 4× é o do perfil "mobile" do Lighthouse |
| Heap | `--js-flags=--max-old-space-size=1024` | o V8 dá ~1/4 da RAM ao heap: notebook de 4 GB ≈ 1 GiB (`jsHeapSizeLimit` medido: 1.144 MiB) |
| Viewport | 1366×768 | resolução de notebook mais comum |
| Lit | build de produção (`resolve.conditions` sem `development`) | o de desenvolvimento valida e avisa a cada render; o usuário final roda o de produção |
| Paralelismo | um arquivo de perf por vez | dois medindo juntos disputam a CPU |

### Por que não `Emulation.setCPUThrottlingRate` como régua

Era o plano (CDP, começando em 4×). Medido nesta máquina (Windows 11), o
mesmo micro-benchmark (~11 ms sem estrangular):

| Fator do CDP | Benchmark (mediana, faixa) | Lentidão efetiva |
|---|---|---|
| 2× | 29–32 ms | ~2,8× |
| 3× | 49–91 ms | 5–9× |
| 4× | 94–154 ms | 9–15× |
| 6× | 226–250 ms | ~22× |

Superlinear e instável (o estrangulamento suspende a thread em fatias do
relógio do Windows). Com ele, duas execuções seguidas da suíte davam
números 2× diferentes e a linha de base não se reproduzia. Por isso:

- **Modo normalizado (padrão; vale para orçamento e linha de base)**: mede o
  TRABALHO de cada render, passo de rolagem e interação (script do Lit +
  estilo + layout, sem esperar quadro) sem estrangular e multiplica pelo
  fator `BENCH_REFERENCE_MS ÷ benchmark agora`. Uma CPU 4× mais lenta deixa
  esse trabalho 4× mais longo — é o modelo mais fiel e é estável.
- **Modo CDP** (`PERF_CPU_RATE=n`): estrangula de verdade e não multiplica;
  para inspecionar a sensação real (quadros, pintura). Não compara com a
  linha de base.

### Calibração

- Micro-benchmark fixo (`benchmark()` em `src/test/perf.ts`: 40 mil objetos,
  textos, `Map` e ordenação por comparação — o que o row model faz),
  mediana de execuções depois de aquecer o JIT.
- Máquina do usuário, ociosa: **9,8–12,6 ms** (referência 11,5 ms).
- Máquina fraca de referência: **`BENCH_REFERENCE_MS = 46` ms** (4×).
- O fator é recalculado (benchmark curto) logo antes de CADA medida, porque
  a carga muda durante a execução (outras sessões rodando testes, GC dos
  cenários grandes). Máquina rápida → fator maior; lenta ou ocupada →
  menor (1× a 20×). Nas execuções desta frente: 3,9× a 4,7×.
- Cada medida é a **melhor de 3** (o ruído só soma tempo).

## Como rodar

```
npm run test:perf                            # mede, confere orçamentos e linha de base (~1,5 min)
PERF_UPDATE_BASELINE=1 npm run test:perf     # regrava os cenários medidos…
PERF_UPDATE_BASELINE=max npm run test:perf   # …e fica com o maior de cada métrica (não grava uma execução de sorte)
PERF_CPU_RATE=4 npm run test:perf            # modo CDP (inspeção)
```

Regravar a linha de base só com motivo (melhora ou custo aceito de recurso
novo), sempre nos dois passos acima e no mesmo commit da mudança.

- `npm test` NÃO roda o perf (só os projetos `node` e `browser`).
- Cada cenário imprime `[perf] cenário: métrica=valor …` e grava em
  `perf-results.json` (fora do git). A linha de base versionada é
  `.specs/16-performance.baseline.json`.
- Falhou só por tempo e perto da tolerância? Rodar de novo uma vez antes de
  investigar; regressão de verdade se repete.
- Não medir no painel de navegador do app (estrangula o
  `requestAnimationFrame`).

## Cenários e métricas (`src/grid.perf.browser.test.ts`)

Dados em `src/test/perf-data.ts`, gerados antes de medir. 24 colunas (textos
com 5 a 200 valores, nome único, números com `format` Intl, moeda,
percentual, data ISO com `dataType: 'date'`, booleano). Grid de 600 px.

| Cenário | Volume | Mede |
|---|---|---|
| `flat-100k`, `flat-1m` | 100 mil / 1 milhão × 24 colunas | 1º render; rolar; ordenar texto (16 valores), texto único, inverter, número, data; rolar ordenado; trocar `items`; nós no DOM; heap do grid; última linha alcançável |
| `grouped-100k`, `grouped-1m` | idem | agrupar (1 e 2 níveis); ordenar agrupado; expandir tudo (`autoExpandGroups`); rolar; reagrupar; recolher tudo; trocar `items` |
| `lean-5m` | 5 milhões × 8 colunas | 1º render; rolar; ordenar número, texto, texto único; agrupar; expandir tudo; rolar agrupado; última linha alcançável |
| `wide-1m`, `bands-1m` | 1 milhão × 300 colunas calculadas (`valueGetter` do `id`; sem e com bandas de 10), frente 13 | 1º render; rolar na vertical; rolar na horizontal (`horizontal.`: 40 passos de 120 px e 20 saltos pela largura); rolar na vertical com a janela de colunas no meio (`middle.`); nós; heap |

- **5 milhões × 24 colunas não cabe** no heap de 1 GiB: só os itens passam
  de ~900 MiB (24 propriedades + `double`s em caixa + nome único por linha).
  O cenário de 5 milhões usa 8 colunas leves (~360 MiB de itens).
- **Rolagem** (`scroll…`, `jump…`): trabalho por passo, do evento de rolagem
  (captura no ancestral, antes do virtualizador) ao render e ao layout das
  linhas novas; um passo por quadro. Roda: 60 passos de 120 px. Salto
  (arrastar a barra): 30 posições espalhadas pela lista. p95 e pior.
- **Interação** (`…Ms`): da ação síncrona ao fim do render do Lit (todas as
  atualizações encadeadas) e do layout — o tempo em que a página fica
  bloqueada.
- **`gridHeapMiB`**: heap JS depois de coletar, com o grid, menos o heap com
  os itens já criados (o custo do grid, não dos dados).
- **`domNodes`**: elementos no shadow root.
- LoAF/`longtask`: no iframe do Vitest o Chromium só entrega `longtask`
  (LoAF é suportado mas não chega); como o modo normalizado mede o trabalho
  direto, não são usados.

## Orçamentos (máquina fraca)

| Métrica | Orçamento |
|---|---|
| Rolar com roda: p95 / pior passo | ≤ 33 ms (30 fps) / ≤ 67 ms |
| Salto da barra: p95 | ≤ 100 ms (10 fps arrastando) |
| 1º render útil | ≤ 500 ms, qualquer volume |
| Interação | ≤ 200 ms até 100 mil linhas; acima, ≤ 1,5 ms por mil linhas (1 milhão: 1,5 s; 5 milhões: 7,5 s) |
| Ordenar texto todo distinto (pior caso) | ≤ 400 ms até 100 mil; acima, ≤ 3 ms por mil linhas |
| Nós no DOM | ≤ 2.500 |
| Heap do grid | ≤ 64 MiB por milhão de linhas (mín. 8 MiB) |

Acima de 100 mil linhas uma tarefa longa é inevitável sem trabalhador (Web
Worker) — o orçamento a limita, não a proíbe. Ver pendências.

**Linha de base**: além dos orçamentos, nenhuma métrica pode piorar além
da tolerância sobre `.specs/16-performance.baseline.json`: interações +50%
(mín. +25 ms) — duas execuções seguidas com a máquina ocupada variam até
~40%; regressão algorítmica (o dobro ou mais) passa disso —; p95 de rolagem
+100% (mín. +33 ms; layout oscila mais que script); pior passo de rolagem só
tem orçamento; memória +15% (mín. +2 MiB); nós +10% (mín. +20). Métrica ou
cenário novo sem linha de base não é comparado até ser gravado. A linha de
base guarda o maior valor de 3 execuções.

## Linha de base: antes → depois

Mesmo harness (modo normalizado, 4×), na mesma máquina: "antes" = `main` em
af1ade9 (uma medida), "depois" = este branch (uma execução, melhor de 3 por
medida; a linha de base versionada guarda o maior de 3 execuções). Em
negrito, o que estourava o orçamento.

| Cenário / métrica | Antes | Depois |
|---|---|---|
| **flat-100k** 1º render | 225 ms | 42 ms |
| rolar p95 / salto p95 | 16 / 94 ms | 11 / 32 ms |
| ordenar texto / texto único / inverter | 198 / **977** / **213 ms** | 56 / 114 / 32 ms |
| ordenar número / data | **313** / **563 ms** | 36 / 37 ms |
| trocar `items` | **611 ms** | 17 ms |
| heap do grid / nós | 4,4 MiB / 684 | 1,7 MiB / 610 |
| **grouped-100k** 1º render | 310 ms | 29 ms |
| agrupar / 2º nível / ordenar agrupado | 86 / 83 / **253 ms** | 22 / 37 / 76 ms |
| expandir tudo / reagrupar / trocar `items` | **206** / **734** / **370 ms** | 17 / 88 / 86 ms |
| **flat-1m** 1º render | **3.421 ms** | 47 ms |
| última linha alcançável | **699.055 de 999.999** | 999.999 |
| ordenar texto / texto único / inverter | **3.553** / **12.939** / **4.049 ms** | 165 / 1.063 / 120 ms |
| ordenar número / data / trocar `items` | **5.173** / **8.076** / **7.895 ms** | 382 / 167 / 151 ms |
| heap do grid | **118,5 MiB** | 8,5 MiB |
| **grouped-1m** 1º render | **2.900 ms** | 47 ms |
| agrupar / 2º nível / ordenar agrupado | 418 / 768 / **2.016 ms** | 98 / 175 / 1.019 ms |
| expandir tudo / reagrupar / trocar `items` | **3.127** / **4.685** / **2.569 ms** | 20 / 693 / 1.042 ms |
| **lean-5m** | não roda (linhas além de ~699 mil inalcançáveis; ~590 MiB de grid no heap de 1 GiB) | 1º render 19 ms; rolar p95 4 ms; salto 11 ms; ordenar número 1,9 s, texto 0,7 s, texto único 5,7 s; agrupar 2,4 s; expandir 8 ms; heap 47 MiB |

## Gargalos corrigidos

Sem API pública nova. Números antes → depois na máquina fraca (tabela
acima).

1. **Altura acima do limite do navegador** (bug): `tbody` de 1 milhão × 48
   px = 48 M px; o Chromium corta em ~33,5 M px e a rolagem parava na linha
   699.055. → Virtualizador próprio com **escala**: corpo físico de no
   máximo 15 M px (`MAX_SCROLL_HEIGHT`, abaixo do limite do Firefox,
   ~17,9 M px). Saltos (barra, Home/End) mapeiam proporcionalmente; passos
   até uma janela (roda, setas, Page Up/Down) andam 1:1 para a leitura não
   pular linhas; o começo e o fim físicos são sempre os da lista. Última
   linha 1 M: 699.055 → 999.999 (e 5.000.011 no `lean-5m`).
2. **Custo O(linhas) do `@tanstack/lit-virtual`**: a cada mudança de
   contagem ou `measure()` ele recria um objeto de medida e chama
   `getItemKey` para TODAS as linhas — o que exigia um `DataRow` com chave em
   texto por linha. → `src/render/virtualizer.ts` (`RowVirtualizer`): altura
   fixa é aritmética; `wrap` usa árvore de Fenwick por índice (só nesse
   modo). A dependência `@tanstack/lit-virtual` saiu. 1º render 1 M: 3.421 →
   47 ms; expandir tudo 1 M: 3.127 → 20 ms; heap do grid 1 M: 118,5 → 8,5
   MiB.
3. **Uma linha por item no row model**: `flattenRows` criava 1 milhão de
   objetos e textos de chave (e um `Map` de chaves para repetidos) a cada
   ordenar/expandir. → `RowList` (`row-model/flatten.ts`): só segmentos
   (linhas de grupo e blocos de itens), `at(i)` monta a linha pedida e
   `slice()` desduplica chaves na janela. Trocar `items` 1 M: 7.895 → 151 ms.
4. **Estilo recalculado em todas as linhas a cada janela**: o `translateY`
   em cada `<tr>` mudava o `style` de todas. → uma linha espaçadora
   (`tr.spacer`) com a altura até a janela; só ela muda. (Um `transform` no
   `<tbody>` encolheria a caixa da tabela e soltaria o cabeçalho `sticky`.)
   Estilo por passo de roda (sem estrangular): 1–5 → 0,2–0,3 ms; salto p95
   100k: 94 → 32 ms. Também: janela calculada a partir do início real do
   corpo (barra + cabeçalho grudados) e `overscan` 5 → 3.
5. **Ordenar números**: `Map` de distintos + comparador em JS. → postos por
   radix LSD nos bits do `double` (`numericRanks`), linear. Número 1 M:
   5.173 → 382 ms.
6. **Ordenar texto quase todo distinto**: `Map` de 1 milhão de entradas,
   regex de preenchimento de dígitos em todos e `Intl.Collator.compare` em
   O(n log n). → `distinctTextRanks`: amostra decide pular o `Map`; chaves
   numéricas com os pesos primários dos 20 primeiros caracteres (espaço <
   dígitos < letras, sem caixa, sequências de dígitos preenchidas como no
   atalho existente), ordenadas por radix; o collator só desempata. A tabela
   de pesos é **conferida uma vez por collator** contra todos os textos de 1
   e 2 caracteres: idiomas que reordenam ou contraem letras (tcheco,
   dinamarquês, lituano, turco) ou ignoram espaço (tailandês) ficam no
   caminho antigo. Texto único 1 M: 12.939 → 1.063 ms; 100k: 977 → 114 ms.
7. **Converter cada linha antes de ordenar** (`dataType` com texto ISO): o
   `toDate` rodava para cada uma das 1 milhão de linhas. → converte só os
   valores distintos. Data 1 M: 8.076 → 167 ms.
8. **Agrupar**: texto de identidade montado por item. → `Map` pelo valor
   cru, identidade só por valor distinto (`row-model/group.ts`). Agrupar 1 M:
   418 → 98 ms; 2º nível: 768 → 175 ms.
9. **Laços quentes**: `Int32Array.from({ length })`, `Array.from(order, fn)`,
   closure por elemento no counting sort, `path.split('.')` por célula lida
   (`cellValueReader`). Inverter 1 M: 4.049 → 120 ms.

## Limites conhecidos e pendências

- **Texto único com 1 milhão+**: 1,1 s (1 M) e 5,7 s (5 M) numa tarefa só.
  Próximo passo: postos num Web Worker (os textos vão por `postMessage`) ou
  fatiar o trabalho entre quadros.
- **Agrupar por postos**: `buildGroups` ainda faz um `Map` por item e nível
  (ordenar agrupado 1 M: 1,0 s; reagrupar: 0,7 s; agrupar 5 M: 2,4 s). Com a
  ordenação devolvendo índices (`sortOrder`, frente 04) e o `group.ts` da
  frente 07 na `main`, agrupar vira counting sort pelos postos das colunas
  de grupo, sem `Map`. Fazer depois que as duas entrarem.
- **Salto da barra com muitas colunas**: ~30 ms na máquina fraca é o
  layout de ~20 linhas × 24 células novas; metade delas está fora da tela
  na horizontal. A virtualização de colunas (frente 13) corta isso.
- **Textos com acento ou pontuação nos 20 primeiros caracteres** não usam
  as chaves primárias (caem no collator em O(n log n)); ampliar a tabela de
  pesos exige conferir a ordem desses caracteres por idioma.
- **Na escala** (> 15 M px de corpo, ~312 mil linhas de 48 px), a posição
  do polegar da barra deixa de ser exata depois de rolar com a roda (os
  passos são 1:1, a barra é proporcional); o começo e o fim continuam
  exatos.
- O modo normalizado não mede pintura/raster (rodam em parte fora da thread
  principal); para vê-los, modo CDP.

## Para as frentes (mudanças internas)

- `#rows` agora é `RowList` (`length`, `at(i)`, `slice(a, b)`, `push(row)`,
  `pushItems(items)`), não `Row[]`. Linha avulsa nova (rodapé de grupo,
  frente 07) entra com `push`; não criar objeto por item em `flattenRows`.
- O virtualizador é `this.#virtualizer` (`RowVirtualizer`): `count`,
  `renderWindow()`, `getTotalSize()`, `startOf(i)`, `indexAt(px)`,
  `measure()`, `measureRows(trs)` e `scrollToIndex(i, { align })` — este
  último leva em conta a barra e o cabeçalho grudados (frente 05: rolar até
  a célula ativa). `grid._virtualizer` (`@internal`) para testes.
- Linhas do corpo: sem `transform`; a `tr.spacer` (aria-hidden) é a 1ª filha
  do `<tbody>`.
- Perf de recurso novo: cenário/métrica em `src/grid.perf.browser.test.ts`
  com `interaction(nome, grid, ação, desfazer)` e `scrollMetrics(grid)`.

## Regra permanente

No `CLAUDE.md` (Testes) e no passo 8 do fluxo (`BACKLOG.md`): toda frente
que mexe em dados, render ou interação roda `npm run test:perf` e não pode
piorar a linha de base além da tolerância nem estourar os orçamentos;
recurso novo entra com cenário/métrica de perf no
`src/grid.perf.browser.test.ts` (e a linha de base regravada no mesmo
commit, com o porquê).
