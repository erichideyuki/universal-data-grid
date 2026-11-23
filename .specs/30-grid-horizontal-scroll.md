# 30 — Rolagem horizontal no grid com a vertical no contêiner externo

> Estado: IMPLEMENTADA no branch da frente (2026-11-23; ver
> "Implementação"). Proposta revisada (2026-11-23: `webcomponent-api-reviewer` e
> `a11y-reviewer`, achados em "Revisão do desenho") e APROVADA pelo
> usuário em 2026-11-23 (API `scroll-container-axis`, novo padrão `block`
> na 0.5.0, 150px para coluna sem largura). Depende da frente 27 (`scroll-container`), já na `main`. Sai numa
> minor (0.5.0): muda o padrão visível do `scroll-container`.

## Objetivo
Com `scroll-container`, hoje o contêiner externo (a janela ou um ancestral)
rola nas DUAS direções (spec 27, opção A). Quando a tabela é mais larga que
o grid, o grid cresce até a largura da tabela e passa do contêiner do
hospedeiro (ex.: um `u-container` de largura máxima): a página inteira anda
para o lado, os outros controles saem da tela e o hospedeiro precisa
compensar a posição de tudo que fica "fora da caixinha" (relato do
ClickCompliance, 2026-11-23, menu lateral de 360px + padding).

Esta frente mantém a rolagem VERTICAL (e a virtualização de linhas) no
contêiner externo, como hoje, e traz a rolagem HORIZONTAL para dentro do
grid: o grid nunca passa da largura que o hospedeiro dá a ele, as colunas
fixas ficam nas bordas dele, e a página não rola para o lado.

## Referência
As duas referências do projeto rolam na horizontal dentro do próprio grid
e separam cabeçalho e corpo em áreas distintas, com a posição horizontal
do cabeçalho sincronizada à do corpo. Nenhuma das duas virtualiza pela
rolagem da página (spec 27, "Referência medida"); o Handsontable
(`preventOverflow: 'horizontal'`) é o único que junta as duas coisas, com
cabeçalhos clonados que acompanham a página. O comportamento visível desta
frente é o deles: rolagem horizontal do grid, cabeçalho e totais grudados
na página, colunas fixas paradas nas bordas do grid.

### Por que não dá para manter uma tabela só
`position: sticky` gruda no ancestral rolável mais próximo. Para o grid
rolar na horizontal, um elemento dele precisa de `overflow-x: auto`, e o
CSS transforma o `overflow-y: visible` desse elemento em `auto`: ele vira
contêiner de rolagem nas duas direções. O cabeçalho (`top`) e os totais
(`bottom`) passariam a grudar nele — que não rola na vertical — e não na
página. Por isso o que gruda na vertical sai da área que rola na
horizontal.

## Decisões de escopo (a confirmar com o usuário)
1. **Faixas separadas (opção A da conversa de 2026-11-23).** O grid passa a
   ter até três faixas, cada uma com a própria `<table>` e o MESMO
   `<colgroup>`:
   - **cabeçalho** — barra de bandas, rótulos, linha de filtro e linhas
     fixadas no topo; `position: sticky; top` na página; `overflow-x:
     hidden`;
   - **corpo** — as linhas virtualizadas; `overflow-x: auto`: a ÚNICA
     rolagem horizontal, nativa (toque com inércia, trackpad, Ctrl+F,
     foco por Tab);
   - **rodapé** — totais e linhas fixadas embaixo; `position: sticky;
     bottom` na página; `overflow-x: hidden`. Sem totais nem fixas
     embaixo, a faixa não existe (duas tabelas).
   O JS só copia o `scrollLeft` do corpo para o cabeçalho e o rodapé.
   Recusadas: rolagem horizontal emulada (`overflow-x: clip` + `transform`
   + barra própria: toque, Ctrl+F e Tab ficariam por nossa conta) e
   cabeçalho movido por JS na vertical (spec 27, salta a cada quadro).
2. **Largura de coluna sem `width` nesse modo: número fixo.** O
   `<colgroup>` compartilhado só alinha o que tem número; uma coluna sem
   largura seria calculada por cada tabela a partir do próprio conteúdo
   (cabeçalho pelo rótulo, corpo pelas células) e desalinharia. Nesse modo
   toda coluna recebe um número:
   - `width` do autor, largura do usuário (redimensionar) ou a medida do
     `column-auto-width` (cabeçalho + linhas renderizadas, uma vez,
     congelada — já é assim hoje; não remede na rolagem);
   - sem nada disso: largura padrão fixa de **150px**
     (`DEFAULT_VIRTUAL_COLUMN_WIDTH`, a mesma que a virtualização de
     colunas já usa), respeitando `minWidth`/`maxWidth`.
   A sobra (tabela mais estreita que o grid) continua indo para a última
   coluna não fixa, como hoje.
   Motivo (ver "Referência medida"): largura fixa gera de 3 a 4 vezes
   menos queixas proporcionais que medir o conteúdo, nos dois produtos;
   medir na rolagem (o `columnAutoWidth` do DevExtreme) faz as colunas
   pularem enquanto o usuário rola, a queixa mais recorrente.
3. **Barra horizontal sempre ao alcance.** A barra nativa do corpo fica no
   fim do grid — num grid longo, abaixo da dobra. A barra visível passa a
   ser uma barra própria na faixa do rodapé (que gruda no pé da página):
   uma `div` rolável fina com um espaçador da largura da tabela, cujo
   `scrollLeft` é sincronizado com o do corpo nos dois sentidos; a barra
   nativa do corpo fica oculta (`scrollbar-width: none`). Sem rodapé de
   totais, a faixa do rodapé existe só com essa barra.
4. **Modo atual preservado como opção.** Quem quer o comportamento de hoje
   (o contêiner rola nas duas direções) escolhe explicitamente — ver API.
   O padrão do `scroll-container` muda para o novo modo. Não há renomeação
   (sem alias nem aviso no console), mas é quebra visível: sai na 0.5.0
   com seção "Breaking" nas notas e a receita
   `scroll-container-axis="both"`. A confirmar com o usuário.

## API (proposta, antes das revisões)

`<u-grid>`:
- `scroll-container` / `scrollContainerElement`: inalterados — apontam o
  contêiner que rola na VERTICAL (e onde o que gruda na vertical gruda).
- **Novo** `scrollContainerAxis: 'block' | 'both'` (atributo
  `scroll-container-axis`, padrão `'block'`):
  - `'block'` (novo padrão): o contêiner rola só na vertical; a rolagem
    horizontal é do grid (faixas, barra própria);
  - `'both'`: o comportamento da 0.4.x (o contêiner rola nas duas
    direções; o grid cresce até a largura da tabela; recuos e máscara de
    `scroll-padding-inline` da 0.4.2).
  Sem `scroll-container`, a propriedade não tem efeito (a rolagem é toda
  do grid, como hoje). Valor inválido (inclusive `'inline'` sozinho) →
  `'block'` com `console.warn` uma vez por valor. Sem reflexão
  (`reflect: false`). Tipo exportado `GridScrollContainerAxis = 'block' |
  'both'` (no molde de `GridScrollMode`).
  Recusados na revisão: `horizontal-scroll="grid|container"` (físico,
  radical novo) e booleano `scroll-container-inline` (fecha um 3º modo).
- Sem evento novo, sem método novo. JSDoc de `focusCell`/`editCell`: no
  eixo `block`, a revelação rola o corpo do grid na horizontal e o
  contêiner na vertical.
- Sem `::part` nem custom property novos: `::part(x)::-webkit-scrollbar`
  não é seletor válido, e `scrollbar-color` é herdado (`u-grid {
  scrollbar-color: … }` já estiliza a barra própria) — documentado. Um part
  pode entrar depois sem quebrar.
- Docs que mudam: JSDoc de `scrollContainer` (hoje "the container scrolls
  in both directions") e o API.md; JSDoc de `width` em `GridColumnDef` e
  `<u-grid-column>` (hoje cita os 150px só para `columnRenderingMode`):
  "…or with `scrollContainer` on the `block` axis…". Notas: CSS do
  hospedeiro que mirava `<table>`/`thead` no shadow DOM não é suportado
  (os `::part` de linha/célula seguem iguais).
- SSR: o render do servidor lê `scroll-container-axis` (o atributo sozinho
  já decide as faixas), com teste com e sem o atributo.

Fica `@internal`: as faixas, a sincronização e a barra.

## Comportamento

### Estrutura (modo `'block'`)
```
grid (largura do hospedeiro)
├─ barra de ferramentas / painel de grupo  (sticky top na página, largura do grid)
├─ faixa do cabeçalho  <div> sticky top · overflow-x: hidden
│  └─ <table role="presentation"> <colgroup/> <thead>…</thead>
├─ faixa do corpo      <div> overflow-x: auto · scrollbar oculta
│  └─ <table role="presentation"> <colgroup/> <tbody>…</tbody>
├─ faixa do rodapé     <div> sticky bottom · overflow-x: hidden
│  ├─ <table role="presentation"> <colgroup/> <tfoot>…</tfoot>   (se houver)
│  └─ barra horizontal própria (div rolável + espaçador)
└─ paginação (no fim, rola com o conteúdo, como hoje)
```
- As três tabelas com `table-layout: fixed`, a mesma largura total e o
  mesmo `<colgroup>` (todas as colunas com número, decisão 2). Colunas de
  grupo, detalhe, seleção e comando entram no `<colgroup>` das três.
- Linhas: cada faixa tem as próprias; a altura de cada linha é
  independente (cabeçalho com quebra de linha não afeta o corpo).
- Colunas fixas e o rótulo do grupo: `sticky` horizontal nativo DENTRO de
  cada faixa (cada faixa é uma área rolável). Somem, nesse modo, os
  recuos `--_port-inset-start/end` e as faixas de máscara da 0.4.2 (que
  continuam no modo `'both'`).
- Sombra de rolagem das colunas fixas (`scroll-start`/`scroll-end`): pelo
  `scrollLeft` do corpo.

### Sincronização horizontal
- Evento `scroll` (passivo) do corpo → `scrollLeft` do cabeçalho, do
  rodapé e da barra própria no mesmo tratamento (o `scroll` dispara antes
  do quadro; atraso visível de no máximo um quadro na rolagem rápida, só
  no cabeçalho/rodapé — o corpo é nativo).
- Nos DOIS sentidos: a barra própria e as faixas também ouvem `scroll` e
  repassam ao corpo (e daí ao resto) — uma faixa com `overflow: hidden`
  ainda é rolada pelo navegador por `focus()`, Ctrl+F e pelo cursor num
  campo da linha de filtro. Guarda contra eco (a atribuição gera `scroll`
  de volta).
- Roda horizontal / Shift+roda / trackpad sobre o cabeçalho ou o rodapé
  (que têm `overflow: hidden` e não rolam sozinhos): `wheel` não passivo só
  quando há `deltaX` (ou Shift) → repassa ao corpo e `preventDefault`;
  rolagem vertical passa direto para a página.
- RTL: `scrollLeft` negativo no Chromium/Firefox/Safari atuais; a
  sincronização copia o valor como está (mesma direção nas três faixas).

### Virtualização
- Linhas: inalterada (contêiner externo, spec 27).
- Colunas: janela = parte visível do CORPO (`scrollLeft` + `clientWidth`
  da faixa), como na rolagem interna — não mais a interseção com o
  contêiner externo. `--_viewport-inline-size` = largura do grid.

### Foco e revelação
- `scrollIntoView` nativo de uma célula do corpo rola o corpo (horizontal)
  e o contêiner (vertical) — `scroll-margin-inline` das colunas fixas
  continua valendo dentro do corpo.
- Célula do cabeçalho ou do rodapé focada (teclado, Tab): o grid foca com
  `focus({ preventScroll: true })` e ajusta o `scrollLeft` do CORPO para
  revelar a coluna; o resto segue pela sincronização. Foco que chega sem
  passar por nós (Tab nativo) rola a faixa, e a sincronização nos dois
  sentidos corrige o corpo.
- Ctrl+F do navegador acha texto no corpo e rola o corpo nativamente; o
  cabeçalho acompanha pela sincronização.

### Arrastar (colunas, intervalo de células, seleção)
- Auto-rolagem horizontal ao arrastar perto da borda: rola o corpo.

## Acessibilidade
- Uma grade só para a tecnologia assistiva (Chromium e Firefox montam a
  tabela ARIA atravessando nós genéricos/`presentation`; sem `aria-owns`,
  caro e frágil com a virtualização): o `role="grid"` (ou
  `treegrid`) e `aria-rowcount`/`aria-colcount`/`aria-multiselectable`/
  `aria-label`/`aria-busy` passam da `<table>` para a `div` que contém as
  três faixas; cada `<table>` vira `role="presentation"`; `<thead>`,
  `<tfoot>` ficam `role="rowgroup"` (o corpo: ver "Implementação"); linhas e células mantêm os
  papéis explícitos que já têm (`row`, `columnheader`, `gridcell`,
  `rowheader`) e os `aria-rowindex`/`aria-colindex` atuais. A ordem do DOM
  (cabeçalho → corpo → rodapé) é a ordem de leitura. Numa tabela
  `presentation` o `colspan`/`rowspan` nativo das bandas some da árvore
  ARIA: os `th` de banda e com rowspan ganham `aria-colspan`/`aria-rowspan`
  explícitos.
- Roteiro manual obrigatório na entrega (risco maior no WebKit/VoiceOver):
  NVDA+Chrome, NVDA+Firefox, JAWS+Chrome e VoiceOver+Safari — Ctrl+Alt+
  setas no modo de leitura atravessa cabeçalho → corpo → rodapé e anuncia
  o cabeçalho da coluna numa célula do corpo, com colunas virtualizadas e
  com bandas.
- Navegação por teclado entre faixas: inalterada (o roving tabindex já é
  por índice de linha/coluna, não pela tabela).
- 2.4.11 (foco não obscurecido): a margem inferior soma barra própria +
  totais + fixas de baixo (a faixa do rodapé é mais alta); o
  `scroll-padding-inline` das fixas (hoje no `.scroll-container`) vai para
  a faixa do corpo. Testar a última linha e a última coluna antes das
  fixas.
- 1.4.10 / zoom de 400%: barra de ferramentas + cabeçalho + rodapé + barra,
  todos grudados, podem cobrir a viewport (256px de altura): o `sticky`
  vertical é desligado quando a soma passa de ~50% da altura da porta
  (medido no redimensionamento).
- A barra própria é `aria-hidden` e fora da ordem de Tab com `tabindex="-1"`
  EXPLÍCITO (o Chromium 130+ torna Tab-focável toda área rolável sem
  conteúdo focável; sem isso, `aria-hidden-focus`); o espaçador é `inert`.
  O teclado rola pela navegação de células; roda e toque no corpo são o
  equivalente. Área de acerto de 24px de altura (2.5.8; é controle nosso,
  a exceção do agente de usuário não vale); `min-height` e
  `scrollbar-gutter` para barras de sobreposição (macOS) não sumirem.
- `scrollable-region-focusable` (2.1.1): o corpo é área rolável; com
  células com `tabindex` dentro, a navegação do grid basta. No estado sem
  dados/carregando (só a linha `no-data`) o corpo rolaria sem nada
  focável: a célula `no-data` entra no roving (`tabindex="-1"`/`0`) e o
  estado entra no teste `axe`.
- `forced-colors`: a barra própria usa as cores do sistema
  (`ScrollbarColor`/`CanvasText`), com o thumb visível conferido.
- RTL: faixas e barra espelhadas; coberto nos testes.

## i18n
Nenhum texto novo.

## Revisão do desenho (2026-11-23)
- **API** (`webcomponent-api-reviewer`): aceitos todos — nome e valores
  mantidos, tipo exportado, 0.5.0 com "Breaking", sem `::part` da barra
  (herança de `scrollbar-color`), 150px no JSDoc de `width`, SSR lendo o
  eixo, `focusCell`/`editCell` documentados, nota sobre CSS no shadow DOM.
- **A11y** (`a11y-reviewer`): aceitos todos — `tabindex="-1"` na barra,
  sincronização nos dois sentidos e `preventScroll`, margens de 2.4.11 com
  a barra, `aria-colspan`/`aria-rowspan` explícitos, roteiro manual com 4
  leitores, `no-data` no roving, sticky desligado acima de ~50% da altura,
  área de 24px e barra de sobreposição.
- Recusados: nenhum.

## Implementação (2026-11-23)
- Faixas em `#renderBands` (`src/grid.ts`), sincronização em
  `src/features/horizontal-sync.ts`. Uma consulta multi-tabela
  (`#tables()`/`#queryTables`) substitui as buscas na tabela única; o papel
  de grade e os handlers da tabela vão para quem tem o papel (`#gridRef`).
- Cada tabela gera o próprio `<colgroup>` (o `map` do Lit devolve um
  iterador, que só se percorre uma vez).
- Desvio de a11y (aceito na entrega, ver spec 17): a faixa do corpo é o
  `rowgroup` com `tabindex="-1"` (o Chromium a punha no Tab quando o
  roving estava no cabeçalho; numa `div` genérica, o `tabindex` viola
  `aria-required-children`) e o `<tbody>` dela fica `presentation`. A
  célula `no-data` ganha `tabindex="-1"`, sem entrar como parada do roving.
- A medida da barra (mostrar/ocultar, largura do espaçador) roda no quadro
  seguinte ao `ResizeObserver`: dentro do callback ela mudava a altura do
  grid, observado pelo próprio grid ("ResizeObserver loop").
- Regra dos 50% por faixa inteira: cabeçalho (com as fixas do topo) e
  rodapé (fixas do fundo, totais e barra) deixam de grudar juntos.
- Correção junto: a região `aria-live` passava 1px da borda em RTL.
- Revisão de a11y da entrega (2026-11-23, sem ALTA): clique no vazio da
  faixa do corpo ou na barra devolve o foco à célula (`#onGridFocusIn`);
  `aria-colspan` explícito também no rótulo de grupo e na célula
  `no-data`; testes da regra dos 50%, Shift+Tab, axe com bandas+RTL e
  seleção múltipla + filtro + fixas, e a regra de área rolável aplicada no
  estado vazio. Decisões: a `no-data` fica `tabindex="-1"` (sem parada
  própria; sem cabeçalho e sem dados o grid não tem parada, como na 0.4.x);
  a área operável da barra é a nativa (exceção de controle do agente de
  usuário em 2.5.8 — os 24px só reservam espaço); em `forced-colors` vale a
  barra do sistema (o navegador força `scrollbar-color: auto`).
- Os testes da spec 27 (`parent-scroll.browser.test.ts`) rodam no eixo
  `both`; o cenário de perf `parent-scroll-1m` também (linha de base da
  0.4.x). Cenário novo `horizontal-bands-1m`.

## Fora de escopo
- Rolagem horizontal emulada e cabeçalho movido por JS na vertical
  (recusadas, ver decisões).
- Modo `'both'` com as faixas (ele segue como na 0.4.2).
- Rolagem interna (sem `scroll-container`): a estrutura de uma tabela só
  continua; unificar com as faixas fica para depois, se o custo de manter
  dois layouts aparecer.
- Medir colunas além das renderizadas.

## Arquivos
- `src/grid.ts` — template das faixas no modo `'block'`, `<colgroup>`
  compartilhado, papéis ARIA na `div`, propriedade nova.
- `src/features/scroll-port.ts` — modo por eixo; a janela de colunas
  volta a ser do corpo no modo `'block'`.
- `src/features/horizontal-sync.ts` (novo) — sincronização das faixas,
  roda sobre cabeçalho/rodapé, barra própria; libera tudo no
  `disconnectedCallback` (spec 14).
- `src/grid.styles.ts` — faixas, barra própria, `forced-colors`.
- `API.md`, docs (`docs/examples/page-scroll/`), `custom-elements.json`.

## Testes
- Navegador (LTR e RTL, contêiner elemento e janela):
  - o grid não passa da largura do hospedeiro; o contêiner não rola na
    horizontal (`scrollWidth === clientWidth`);
  - colunas alinhadas nas três faixas (borda de cada `<th>` = borda da
    `<td>` do corpo, ±0,5px) com larguras do autor, do usuário, do
    `column-auto-width` e padrão; depois de rolar o corpo;
  - cabeçalho gruda no topo da página e totais no pé (como hoje);
  - rolar o corpo move cabeçalho, rodapé e barra; arrastar a barra move o
    corpo; Shift+roda sobre o cabeçalho rola o corpo;
  - colunas fixas e rótulo do grupo parados nas bordas do grid em qualquer
    ponto da rolagem;
  - foco por teclado numa coluna fora da vista (corpo e cabeçalho) revela
    a coluna; RTL com foco no cabeçalho e o corpo rolado; Tab nativo e
    cursor num campo da linha de filtro realinham o corpo; 2.4.11 com
    colunas fixas, a barra e os totais (última linha e última coluna);
  - Tab não para na barra própria; `axe` sem `aria-hidden-focus` nem
    `scrollable-region-focusable`, inclusive sem dados e carregando;
  - SSR com e sem `scroll-container-axis`;
  - `column-auto-width`: rolar a janela virtual não muda nenhuma largura;
  - `'both'`: comportamento da 0.4.2 intacto (testes atuais da spec 27);
  - `axe-core` sem violações (com bandas, agrupado, RTL); leitor: uma
    grade só (`role` na `div`, tabelas `presentation`).
- SSR: as faixas renderizam no `@lit-labs/ssr` sem erro.
- Vazamento (spec 14): grid com o modo usado e removido é coletado;
  listeners de `scroll`/`wheel` liberados.
- Perf (spec 16): cenário novo — 1 milhão de linhas × 40 colunas no modo
  `'block'` com a janela como contêiner: rolagem horizontal e vertical sem
  frame longo; linha de base sem piora.

## Critério de pronto
Global da spec 00 + os testes acima + conferência manual no demo e no
ClickCompliance (build local, script de cópia) antes de publicar.

## Referência medida (2026-11-23)
Medido ao vivo, 100 mil linhas virtualizadas, uma linha com nome longo na
posição 90.000.

- **DevExtreme DataGrid** (demo "Local Virtual Scrolling", tema Fluent):
  - padrão (`columnAutoWidth: false`): colunas sem largura repartem o
    espaço (213px cada num grid de 923px); grid estreito (350px): espremem
    a 70px com reticências, SEM rolagem horizontal;
  - `columnAutoWidth: true`: largura pelo conteúdo, rolagem horizontal
    aparece; REMEDE ao rolar — na linha longa "First Name" foi de 232 para
    541px e as outras encolheram; de volta ao topo, 232 de novo;
  - cabeçalho e corpo em tabelas separadas (`.dx-datagrid-headers` e
    `.dx-datagrid-rowsview`), sincronizadas.
- **AG Grid Community 34** (CDN, página local):
  - padrão: 200px por coluna sem largura; grid estreito: rolagem
    horizontal (670px em 383px);
  - `autoSizeAllColumns()`: mede só as linhas renderizadas, uma vez
    (firstName 121px); rolar até a linha longa NÃO muda (texto cortado);
    chamar de novo: 506px, mantido ao voltar ao topo.
- **Reação dos usuários** (pesquisa na web; ~30 itens, evidência fina —
  Support Center da DevExpress e Zendesk do AG Grid Enterprise são
  privados ou parcialmente indexados). Queixas normalizadas:

  | | por 100 mil downloads/semana (npm) | por mil perguntas no SO |
  |---|---|---|
  | AG Grid, medir conteúdo | 0,25 | 2,8 |
  | AG Grid, largura padrão/dividir | 0,07 | 0,8 |
  | DevExtreme, medir conteúdo | 2,2 | 9,1 |
  | DevExtreme, largura padrão/dividir | 0,56 | 2,3 |

  Bases: ag-grid-community 5,6 mi e devextreme 359 mil downloads/semana;
  tags do SO 4.965 e 876. Queixas de medir: só linhas visíveis (texto
  cortado ao rolar, ag-grid#1020, #2032), largura que muda/pisca ao rolar
  (DevExtreme#6563, T1118555), lentidão com muitas colunas. Queixas do
  padrão: colunas espremidas sem rolagem (padrão do DevExtreme, T466605) e
  bugs de "ajustar à largura". Nenhuma queixa direta contra os 200px do
  AG Grid.
