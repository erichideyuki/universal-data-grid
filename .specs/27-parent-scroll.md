# 27 — Rolagem por contêiner externo (virtualização pelo pai ou pela janela)

## Objetivo
Deixar o grid sem barra de rolagem própria e rolar junto com a página (a
janela) ou com um ancestral rolável que o hospedeiro escolhe, com o grid em
qualquer posição dentro dele (conteúdo acima e abaixo), SEM perder a
virtualização de linhas e de colunas, nem o que gruda (barra, cabeçalho com
bandas, linhas fixas, totais, colunas fixas, rótulos de grupo), nem o
teclado, o foco, o RTL e o SSR.

Caso de uso: páginas de relatório/painel em que o grid é um bloco do
conteúdo e a página tem UMA rolagem só (sem "rolagem dentro de rolagem"),
com milhões de linhas.

## Referência
Nenhuma das duas referências do projeto cobre isso com virtualização (ver
"Referência medida"): DevExtreme e AG Grid (`domLayout: 'autoHeight'`)
desligam a virtualização e renderizam todas as linhas; o Handsontable
(`preventOverflow: 'horizontal'`, com o contêiner sem altura) virtualiza
pela rolagem da janela/ancestral. O comportamento de referência desta
frente é, então, o da rolagem nativa do navegador: o que gruda gruda no
contêiner externo, e o grid só desenha o que está na parte visível dele.

## Decisões de escopo (combinadas com o usuário antes da spec)
1. **Opção A (CSS, sem JS no que gruda).** No modo externo o `:host` fica
   com `height: auto` e o `.scroll-container` sem `overflow` nem altura. O
   contêiner externo rola nas duas direções. Tudo que hoje é
   `position: sticky` continua sendo e passa a grudar no contêiner externo
   por herança natural do CSS (o ancestral rolável mais próximo).
   Recusadas: (B) dividir a tabela em cabeçalho/corpo/rodapé (perde o
   alinhamento das colunas por uma tabela só e o ARIA de uma grade só);
   (C) cabeçalho deslocado por JS (salta a cada quadro e não acompanha a
   rolagem do compositor).
2. **Contêiner explícito.** O hospedeiro aponta o contêiner; não há
   detecção automática de "ancestral rolável" (frágil: o mesmo grid
   mudaria de modo conforme o CSS da página).
3. **`instant` só para ação do usuário.** Rolagem causada por teclado ou
   clique é instantânea; por chamada de API respeita o `scroll-behavior`
   do contêiner.
4. **Fora**: barra de rolagem horizontal flutuante (o padrão
   "floating-scroll"); ver "Fora de escopo".

## API (revisada pelos subagentes em 2026-11-20; aguarda o aval do usuário)

`<u-grid>`:
- `scrollContainer: string | null` ↔ atributo `scroll-container`
  (padrão `null`): id de um ANCESTRAL do grid que rola o grid, ou o valor
  reservado `window` (a janela; vence um elemento com `id="window"`). A
  busca sobe pelos ancestrais (pais e hosts de shadow roots) e usa o
  primeiro com esse id — diferente dos atributos IDREF da plataforma, que
  olham só a própria árvore (documentado no JSDoc: "first ancestor with
  this id, crossing shadow boundaries"). Se o ancestral for o
  `document.documentElement` ou o `document.scrollingElement`, o
  contêiner é a janela; o `document.body` só é janela quando é o
  `scrollingElement` (quirks) — num app com `html { overflow: hidden }` e
  `body { overflow: auto }` o body é um elemento rolável comum. Trocar o
  id do ancestral depois não gera nova resolução (documentado).
  A presença do atributo basta para o SSR: o servidor renderiza o modo
  externo por CSS (`:host([scroll-container])`), sem altura nem rolagem
  própria, e a hidratação não pula. `scroll-container=""` = aviso +
  rolagem interna.
- `scrollContainerElement: HTMLElement | Window | null` (`attribute:
  false`, padrão `null`): o contêiner por referência; vence o atributo
  (como `popoverTargetElement` × `popovertarget`); o getter devolve o que
  foi atribuído. `window`, `document.documentElement` e
  `document.scrollingElement` = a janela.
- Resolução (no `connectedCallback`, a cada mudança das duas e, para o
  id, também no `firstUpdated`): elemento não encontrado ou não ancestral
  → `console.warn` (prefixo `<u-grid>:`, uma vez por valor) e rolagem
  interna — e aí o CSS do atributo é anulado por uma folha adotada da
  instância (o grid não fica "sem altura e sem rolagem"). Ancestral entre
  o grid e o contêiner (inclusive dentro de shadow roots) com `overflow`
  diferente de `visible`/`clip` também avisa (o `sticky` gruda nele) — o
  grid segue no modo externo. Host com altura dada pela página
  (`u-grid { height: 400px }` vence o `height: auto`): aviso quando a
  altura do host corta o conteúdo; o API.md diz "no modo externo, não dê
  altura ao grid".
- **Compensação do que o hospedeiro gruda no contêiner** (barra de app de
  64px no topo da janela): SEM custom property nova. O grid lê o
  `scroll-padding-top`/`-bottom` computado do contêiner resolvido (o
  mecanismo da plataforma para conteúdo grudado, técnica C43 da 2.4.11,
  que o `scrollIntoView` e o foco nativo já respeitam) e usa esse valor
  como deslocamento interno do `top`/`bottom` do que gruda e nas margens
  de rolagem. Relido na resolução e no redimensionamento da porta.
  Motivo: uma `--u-grid-sticky-top` é herdada — posta no `:root` para a
  barra do app, abriria um vão em todo grid com rolagem interna — e o
  `scroll-padding` já vem do contêiner certo.
- Sem evento novo, sem método novo, sem getter do contêiner resolvido.
  `focusCell`/`editCell`/teclado e o fim da lista do `scrollMode:
  'infinite'` passam a ler/rolar o contêiner externo.

Fica `@internal`: a porta de rolagem (`ScrollPort`) e o retângulo visível.

## Comportamento

### Modo externo (CSS)
- `:host([scroll-container])` cobre o SSR e o caso do atributo; o modo
  vindo só da propriedade (e a anulação na falha) usa uma folha adotada
  própria da instância no shadow root — sem `data-*`, sem `:state()`
  (que viraria API pública), sem estilo inline no host.
- `.scroll-container`: `height: auto; overflow: visible`. A tabela pode
  ser mais larga que o grid: o excesso vira rolagem horizontal do
  contêiner externo.
- Barra de ferramentas, painel de grupo, paginação, linha de detalhe e
  linha de largura total: largura = parte VISÍVEL do grid
  (`--_viewport-inline-size`) e `position: sticky` na borda inicial, para
  não saírem da tela com a rolagem horizontal do contêiner.
- Painel de carga: centralizado na parte visível do grid (não no meio de
  um grid de 5 milhões de linhas).
- Paginação (`paging`): no fim do grid, rola com o conteúdo (não gruda).
- `scrollMode: 'infinite'`: "chegou ao fim" = fim do corpo dentro da
  porta.

### Virtualização de linhas
- O virtualizador lê a rolagem de uma "porta" (elemento ou janela):
  `scrollTop`/`scrollY`, `clientHeight`/`innerHeight`, evento `scroll`
  passivo e `ResizeObserver` (elemento) ou `resize` (janela).
- Margem de rolagem = posição do corpo no conteúdo do contêiner
  (`getBoundingClientRect` do corpo − topo da porta + `scrollTop`), relida
  a cada rolagem e quando muda o que está acima (ver abaixo). Altura
  grudada = parte da barra/cabeçalho/fixas que está de fato grudada sobre
  a porta (0 quando o grid ainda está abaixo da dobra).
- Grid só parcialmente visível (topo abaixo da dobra, ou fim acima do topo
  da porta): só as linhas que cruzam a porta são desenhadas (+ overscan).
  Grid fora da porta: nenhuma linha além do overscan.
- Escala (> `MAX_SCROLL_HEIGHT`): a heurística atual vale (validada no
  protótipo com 5 milhões de linhas e 600px de conteúdo depois do grid: a
  última linha é alcançável e o conteúdo depois do grid também).
- **Conteúdo acima do grid que muda de altura sem rolagem** (painel
  recolhido, imagem que carrega): com `overflow-anchor` a tela não salta,
  mas sem ele (ou fora do alcance da âncora) o corpo fica em branco. Um
  `IntersectionObserver` (`root` = contêiner externo ou `null` na janela)
  nas linhas renderizadas e no corpo relê a margem quando elas entram ou
  saem da porta sem evento de rolagem.

### Virtualização de colunas e sombras
- Janela de colunas = interseção horizontal do retângulo da tabela com o
  da porta, medida a partir da borda INICIAL da tabela (esquerda em LTR,
  direita em RTL) — independe do sinal do `scrollLeft` e do `dir` do
  contêiner externo.
- `#viewportWidth` e `--_viewport-inline-size` = largura dessa interseção
  (a parte visível do grid), recalculada na rolagem horizontal e no
  redimensionamento da porta.
- Sombras das colunas fixas: `scroll-start` quando há colunas livres
  escondidas antes da borda inicial visível; `scroll-end` quando há depois
  da borda final visível.

### Rolar até linha/célula
- Foco por teclado, clique, `focusCell`, `editCell`, PageUp/PageDown,
  Home/End, Ctrl+Home/End e revelação do intervalo de células: um
  elemento auxiliar invisível (`aria-hidden`, `pointer-events: none`,
  dentro do `.scroll-container`) é posicionado onde a linha/célula
  estaria e recebe `scrollIntoView({ block: 'nearest', inline: 'nearest'
  })`. Margens dele:
  - `scroll-margin-top` = `scroll-padding-top` do contêiner + barra + cabeçalho +
    fixas do topo (só as grudadas);
  - `scroll-margin-bottom` = `scroll-padding-bottom` do contêiner + totais + fixas do
    fundo;
  - `scroll-margin-inline` = largura das colunas fixas do lado.
  Assim a célula para logo abaixo do cabeçalho / acima dos totais e nunca
  sob uma coluna fixa (WCAG 2.4.11). O `scrollIntoView` também rola os
  ancestrais do contêiner (contêiner dentro de página rolável), como o
  navegador faz com o foco nativo.
- `behavior`: ação do usuário → `'instant'`; API → `'auto'` (respeita o
  `scroll-behavior` do contêiner), e o foco/editor espera o `scrollend`
  (com tempo limite de reserva, 2s, e sem `scrollend` no navegador: um
  quadro). `prefers-reduced-motion: reduce` → sempre `'instant'`.
- Escala: o destino virtual da linha é guardado até a rolagem chegar (a
  rolagem suave passa por posições intermediárias que não podem trocar o
  mapeamento físico→virtual).
- Foco nativo que não passa pelo auxiliar (Tab vindo de fora, controle
  de renderer/editor, `focus()` do navegador): as `td`/`th` do corpo e os
  focáveis dentro delas levam por CSS as mesmas margens
  (`scroll-margin-block-start/-end`, `scroll-margin-inline-start/-end`,
  por variáveis internas, incluindo o `scroll-padding` do contêiner e a barra de
  erro de 56px que hoje é `scroll-padding-block-end`). No `focusin` vindo
  de fora com a célula ativa fora da porta (ou fora da janela virtual),
  revela pelo auxiliar com `'instant'`.
- Foco atrasado por API: o estado ativo (roving `tabindex`) muda na
  hora; o foco do DOM fica onde estava até o `scrollend`. `pointerdown`,
  `keydown` ou foco saindo do grid durante a espera cancelam o foco
  pendente (nada é roubado). No tempo limite, só foca se o foco ainda
  estiver no grid ou no `body`. Um único evento de foco, no fim.
- PageUp/PageDown: tamanho da página = altura da porta − o que grudaria
  (barra, cabeçalho, fixas, totais e o `scroll-padding` do contêiner), independente
  de quanto do grid está visível agora; mínimo 1 linha.
- Excesso do que gruda (regra da spec 17, "deixa de grudar acima de
  50%"): no modo externo mede contra a ALTURA DA PORTA (somando
  o `scroll-padding` do contêiner) e, para colunas fixas, contra a largura
  VISÍVEL do grid (a interseção), não a área do grid.
- Auxiliar: `<div aria-hidden="true">` vazio, sem `role`/`tabindex`,
  `position: absolute`, fora da `<table>`, sem tamanho que aumente a
  rolagem; não é renderizado no SSR. Margens só lógicas (RTL).

### Arrasto
- Intervalo de células (19): a rolagem automática perto da borda usa o
  retângulo da porta (∩ grid) e rola o contêiner externo.
- Mover/agrupar coluna (interactjs) não tem rolagem automática hoje; nada
  muda.

### Ciclo de vida e memória
- Listeners de `scroll` (porta), `resize` (janela), `ResizeObserver` e
  `IntersectionObserver` são registrados ao entrar no modo externo e
  liberados ao trocar de contêiner, ao voltar para a rolagem interna e no
  `disconnectedCallback` (spec 14). Nada de referência forte do grid no
  contêiner externo além desses listeners.
- Trocar de contêiner em tempo de execução: libera o antigo, mede o novo,
  mantém a linha ativa visível.

## Acessibilidade
- **Papéis/ARIA**: nenhum novo. A grade continua uma `table`/`grid` só;
  `aria-rowcount`/`aria-rowindex`/`aria-colindex` não mudam.
- **Teclado**: o mesmo mapa de hoje (spec 05/17), em LTR e RTL. O que
  muda é QUEM rola: setas, PageUp/PageDown, Home/End, Ctrl+Home/End e Tab
  para dentro do grid rolam o contêiner externo até a célula ativa.
  Nenhuma tecla nova. Dentro do grid, as setas e PageUp/PageDown não rolam
  a página por padrão (o grid já chama `preventDefault` nelas); fora do
  grid, a página rola como sempre.
- **Foco não obscurecido (2.4.11)**: célula focada nunca para sob o
  cabeçalho grudado, sob os totais, sob colunas fixas nem sob o que o
  hospedeiro gruda no contêiner (via `scroll-padding` do contêiner).
- **Região rolável**: no modo externo o `.scroll-container` não rola; ele
  não precisa de `tabindex` (axe `scrollable-region-focusable` não se
  aplica). O contêiner externo é do hospedeiro: durante a carga o grid
  fica `inert` e o contêiner ficaria sem focável, então o API.md
  recomenda `tabindex="0"` + `role="region"` + `aria-label` nele (axe
  testado também na carga e com 0 linhas).
- **Bordas do grid**: na primeira/última linha, ↑/↓ não rolam a página
  (o grid consome a tecla); Tab sai do grid normalmente (não é armadilha).
- **Movimento (2.3.3)**: `prefers-reduced-motion: reduce` → rolagem
  sempre instantânea.
- **Reflow (1.4.10)**: a linha de detalhe e a barra seguem limitadas à
  parte visível do grid.
- **Anúncios**: nenhum novo.
- **`forced-colors`**: nada novo de cor.

## i18n
Nenhum texto novo (avisos de console são para o desenvolvedor, em inglês,
fora da tabela de i18n — como os demais `console.warn` do grid).

## Revisão do desenho (2026-11-20)
Aceitos (`webcomponent-api-reviewer`): CSS do atributo anulado na falha
(folha adotada); `scroll-padding` do contêiner no lugar de
`--u-grid-sticky-top/-bottom` (custom property herdada abriria vão nos
grids internos); `body` só é janela quando é o `scrollingElement`; valor
reservado `window`; sem `:state()` (seria API pública); aviso de altura
dada ao host; JSDoc da busca por ancestral; `scrollMode: 'infinite'`.
Aceitos (`a11y-reviewer`): margens de rolagem nas próprias células e
focáveis (foco nativo, Tab de fora) além do auxiliar; regra dos 50%
medida contra a porta; foco atrasado por API cancelável e sem roubo;
PageUp/Down pela altura da porta; barra de erro na margem inferior;
recomendação de `tabindex`/`role="region"`/`aria-label` no contêiner do
hospedeiro; auxiliar fora da `<table>` e fora do SSR; propriedades
lógicas; testes extras.
Recusados: nenhum.

## Fora de escopo
- Barra horizontal flutuante ("floating-scroll") quando o fim do grid está
  abaixo da dobra: o hospedeiro rola o contêiner externo (ou usa
  Shift+roda). Fica como frente futura se pedirem.
- Detecção automática do ancestral rolável.
- Contêiner que não é ancestral do grid (rolagem sincronizada de outro
  elemento).
- Posicionamento dos popups (`position: fixed`) — já hoje convivem com a
  página rolando; nada muda.

## Arquivos
- `src/render/virtualizer.ts` — porta de rolagem (elemento/janela),
  destino virtual que dura até a chegada, margem relida.
- `src/features/scroll-port.ts` (novo) — resolução do contêiner, avisos,
  retângulo visível, `scrollIntoView` do auxiliar, `scrollend` com reserva,
  `IntersectionObserver`; controller com liberação no disconnect.
- `src/grid.ts` — propriedades, troca de modo, pontos que leem o
  contêiner interno (janela de colunas, sombras, viewport, página,
  primeira visível, intervalo de células).
- `src/grid.styles.ts` — modo externo e custom properties.
- `docs/` — exemplo ao vivo (grid no meio de uma página longa e num painel
  rolável, com barra de app grudada compensada por `scroll-padding-top` no contêiner).
- `API.md` — seção "Scrolling with the page or a parent".

## Testes
- Navegador (`src/grid.parent-scroll.browser.test.ts`), com contêiner
  elemento e janela, 300px acima e 600px abaixo:
  - o que gruda (barra, cabeçalho com bandas, fixas, totais, coluna fixa)
    nas posições certas; LTR e RTL;
  - sem buracos na porta em várias posições, 1 mil e 5 milhões de linhas;
    última linha e conteúdo depois do grid alcançáveis;
  - janela de colunas pelo `scrollLeft` do contêiner, LTR e RTL;
  - foco/teclado (setas, PageUp/Down, Ctrl+End) param a célula abaixo do
    cabeçalho e acima dos totais, fora das colunas fixas, com
    `scroll-padding-top` no contêiner;
  - `focusCell` com `scroll-behavior: smooth` foca depois do `scrollend`;
    `prefers-reduced-motion` → instantâneo;
  - conteúdo acima encolhe sem rolagem → corpo redesenhado;
  - id inexistente / não ancestral → aviso e rolagem interna; troca de
    contêiner e volta para interno;
  - intervalo de células com rolagem automática no contêiner externo;
  - Tab de fora com a célula ativa fora da porta e fora da janela
    virtual; foco num controle de renderer; cancelamento do foco
    pendente por API (pointerdown/keydown/foco saindo);
  - porta de 256px (zoom 400%): o que gruda solta e a célula aparece;
  - PageDown com o grid parcialmente visível;
  - 2.4.11 horizontal em RTL (janela e contêiner `dir="rtl"`);
  - `axe-core` sem violações no modo externo (LTR e RTL, carga, 0 linhas,
    contêiner do hospedeiro);
  - roteiro de teclado automatizado no modo externo, LTR e RTL.
- Vazamento (`src/test/leak.ts`): grid no modo externo removido é
  coletado e o contêiner externo não segura listeners; trocar de contêiner
  repetidamente não cresce.
- SSR: `<u-grid scroll-container="x">` renderiza no `@lit-labs/ssr` sem
  erro e com o modo externo no CSS.
- Perf (spec 16): cenário novo "1 milhão de linhas rolando pela janela",
  com orçamento igual ao da rolagem interna.

## Critério de pronto
- Global (00) + `npm run test:perf` com o cenário novo dentro do
  orçamento e sem piorar a linha de base.

## Referência medida
- **DevExtreme DataGrid**: a rolagem é sempre do próprio grid
  (`scrolling.mode: 'virtual'`/`'infinite'` dependem de altura fixa);
  sem altura, o grid cresce até o conteúdo e não virtualiza pela rolagem
  da página. Não há opção de contêiner de rolagem externo.
- **AG Grid Community** (`domLayout: 'autoHeight'`): a documentação diz
  que a virtualização de linhas é desligada e TODAS as linhas são
  renderizadas (não recomendado para muitas linhas); a barra horizontal
  fica no fim do grid. Não virtualiza pela rolagem externa.
- **MUI X DataGrid** (`autoHeight`, hoje `autoHeight`/altura por
  conteúdo): renderiza todas as linhas; mesma limitação.
- **Handsontable** (`preventOverflow: 'horizontal'` e contêiner sem
  altura): virtualiza pela rolagem da janela ou do ancestral, com
  cabeçalhos clonados que acompanham — é o único dos pesquisados que
  cobre o caso; o comportamento visível (o que gruda, só desenha o
  visível) é o que esta frente reproduz, com `sticky` nativo em vez de
  clones.
- **Protótipo** (Chromium do Vitest, contêiner elemento e janela, 300px
  acima e 600px abaixo, código de medição no stash "spike: rolagem pelo
  contêiner externo"):
  - sticky nativo correto: barra em 0, cabeçalho em 56, totais no fim da
    porta enquanto o grid ocupa a tela, coluna fixa na borda esquerda;
  - linhas sem buracos, inclusive 5 milhões com conteúdo depois do grid
    (última linha alcançável; heurística de escala atual basta);
  - `scrollIntoView` num auxiliar com `scroll-margin`: a linha para logo
    abaixo do cabeçalho ou logo acima dos totais;
  - `scrollend` dispara na rolagem suave (≈1,5s num salto de 38 mil px);
  - janela de colunas pelo `scrollLeft` do pai funciona;
  - conteúdo acima que encolhe sem rolagem com `overflow-anchor: none`:
    tela em branco; um `IntersectionObserver` nas linhas resolve.
  - NÃO validados no protótipo: RTL, SSR, rolagem automática do intervalo,
    vazamento, perf.
