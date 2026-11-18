# 17 — Acessibilidade (auditoria WCAG 2.2 AA + APG "Data Grid")

## Objetivo
Revisor de acessibilidade no fluxo de toda frente (subagente
`a11y-reviewer`, `.claude/agents/`) e auditoria do `<u-grid>` como estava na
`main` 20c9ecd (fundação + frentes 02–07, 14, 16).

## Como foi feita
Três rodadas do `a11y-reviewer` só lendo o código (cabeçalho/colunas/grupos;
filtro/busca/seleção/teclado/rodapés; estilos/contraste/modos). Cada
correção sem mudança de API entrou com teste em
`src/accessibility.browser.test.ts` que falhava na `main` (conferido
rodando o teste contra o `src/` da `main`). Contraste é medido no navegador
pela cor computada (canvas normaliza `color-mix` e cores do sistema);
`forced-colors` e `prefers-reduced-motion` são emulados pelo Playwright
(comando `emulateMedia` no `vitest.config.ts`).

## Decisões
- **Mudança visível ao hospedeiro vai ao usuário**: tecla nova, texto/chave
  de i18n nova, valor padrão de token `--u-grid-*`, `::part`, evento.
  Ajuste de cor interna sem token (placeholder, borda do editor) e
  `@media (forced-colors)`/`(prefers-reduced-motion)` não precisam de aval.
- **Guarda de foco**: se o render remover o elemento focado do grid (linha
  filtrada por API, chip desagrupado, coluna ocultada), o foco vai à célula
  ativa realocada em vez de cair no `<body>`. O seletor de colunas devolve
  o foco ao mesmo controle quando a lista se reordena.
- **Clique fora de popover/menu não devolve o foco ao disparador**: segue a
  APG (o foco vai aonde o usuário clicou); só Esc/ação devolvem.
- **Anúncio repetido**: texto igual ao anterior ganha um espaço
  inquebrável alternado no fim, para a região `aria-live` ser relida.
- **`lang`**: só nos elementos com texto da i18n (região de status,
  popovers, menus, busca, "arraste aqui", "sem dados"), não no contêiner —
  dados e rótulos de coluna são do app.
- **`aria-level` no `treegrid`**: dados = nº de colunas agrupadas + 1;
  rodapé de grupo = nível do grupo + 2.
- **2.5.7 (arrasto)**: o atalho de teclado (Alt+Shift+←/→, Ctrl+G) atende
  o 2.1.1, mas NÃO o 2.5.7, que pede alternativa de ponteiro único sem
  arrasto. Reabre a decisão da spec 05 — vai ao usuário (A1).

## Auditoria

Severidade: ALTA impede uso; MÉDIA falha AA localizada/com contorno;
BAIXA boa prática. Estado: ✅ corrigido aqui (com teste) · ⏳ aguarda aval
(muda API/interface) · 🔎 verificar com leitor de tela · ➖ decidido não
corrigir · 📌 pendente sem mudança de API (fora deste lote).

### Corrigidos (sem mudança de API)

| Item | WCAG | Problema | Correção | API? | Sev. | Estado |
|---|---|---|---|---|---|---|
| Linha focada some (filtro/`items` por API) | 2.4.3 | `keyedRows` remove o `<tr>` focado; foco cai no `<body>` | guarda de foco no `willUpdate`/`updated` | não | ALTA | ✅ |
| Rodapé de totais sobre a célula focada | 2.4.11 | só havia `scroll-padding-block-start`; ↓/PageDown paravam atrás do `tfoot` | `scroll-padding-block-end` = altura do `tfoot` nas células do corpo; `#pageSize` desconta | não | ALTA | ✅ |
| Fixar coluna no seletor | 2.4.3 | o `repeat` move o `<li>` do botão focado; foco cai no `<body>` | controller guarda o controle focado e refoca após o render | não | ALTA | ✅ |
| Teclas do cabeçalho no rodapé de totais | 3.2.2 | Espaço na caixa do rodapé selecionava tudo; Ctrl+G/Alt+Shift agiam | só `position.row === HEADER_ROW` | não | MÉDIA | ✅ |
| Alça inalcançável com filtro no cabeçalho | 2.1.1 | F2 ia sempre ao funil; do funil nada chegava à alça | F2 percorre funil → alça → célula (como já dizia a spec 05) | não | MÉDIA | ✅ |
| Clique no botão de expandir grupo | 2.1.1, 4.1.2 | foco parava no `<button aria-hidden tabindex=-1>`; setas mortas | `mousedown` sem foco; clique foca a célula do grupo | não | MÉDIA | ✅ |
| Seletor de colunas não modal | 2.4.3 | Tab saía do grid com o painel aberto | `focusout` para fora fecha (sem roubar o foco) | não | MÉDIA | ✅ |
| Menu do painel aberto na área vazia | 2.4.3 | `returnFocus` nulo; Esc/ação deixava o foco no `<body>` | volta ao chip ativo | não | MÉDIA | ✅ |
| Desagrupar sem cabeçalho de colunas | 2.4.3 | chip some, foco no `<body>` | guarda de foco | não | MÉDIA | ✅ |
| Nome do cabeçalho poluído | 1.3.1, 4.1.2 | nome do `th` incluía o `aria-label` da alça ("City City") e o funil | `aria-labelledby` → `.header-text` | não | MÉDIA | ✅ |
| Ctrl+G em coluna não agrupável | 4.1.3 | anunciava "Agrupado por X" sem agrupar | anuncia só se agrupou | não | MÉDIA | ✅ |
| Anúncio igual não relido | 4.1.3 | mesmo texto não muda o DOM da região | marca alternada (decisão acima) | não | MÉDIA | ✅ |
| Espaço numa linha não anunciado | 4.1.3 | só `aria-selected` do `<tr>` (ancestral do foco) mudava | anuncia `rowsSelectedAnnouncement` ao alternar | não | MÉDIA | ✅ |
| `treegrid` sem nível nas linhas de dados/rodapés | 1.3.1 | só grupos tinham `aria-level` | ver decisão | não | MÉDIA | ✅ |
| Idioma dos textos da interface | 3.1.2 | `language` ≠ página: lido com a voz errada | `lang` da tradução (decisão acima) | não | MÉDIA | ✅ |
| `forced-colors` | 1.4.1, 1.4.11 | sem `@media (forced-colors)`: seleção, realce de busca, linhas, bordas das fixas, indicadores de soltar, funil ativo, pino, item marcado e bordas dos popovers sumiam | cores do sistema (`Highlight`, `CanvasText`) e bordas reais | não | MÉDIA | ✅ |
| Placeholder das buscas | 1.4.3 | 60% do texto: 4,36:1 (barra), 4,11:1 (popover) | `on-surface-variant` (8,49:1 / 7,24:1) | não | ALTA | ✅ |
| Borda do editor da linha de filtro | 1.4.11 | 20% do texto: 1,6:1 | `--u-color-outline` (4,55:1) | não | MÉDIA | ✅ |
| `prefers-reduced-motion` | 2.3.3 | transições sem a preferência | `transition: none` | não | BAIXA | ✅ |
| `aria-busy` no filtro em fatias | 4.1.2 | resultado antigo na tela sem sinal | `aria-busy="true"` no `<table>` enquanto há fatia | não | BAIXA | ✅ |
| Fantasma do arrasto | 4.1.2 | clone do `th` com `role`/`tabindex`/`aria-sort` fora da tabela | `aria-hidden` + sem `tabindex` (sem `inert`: ele recebe o clique final) | não | BAIXA | ✅ |
| Anel de foco do menu de operação | 2.4.7 | `outline-offset` positivo cortado pelo `overflow` | `-2px` | não | BAIXA | ✅ |

### Aprovados pelo usuário e implementados (A1–A14)

| # | Item | WCAG | Problema | Correção (feita; nomes finais na seção da proposta) | API? | Sev. |
|---|---|---|---|---|---|---|
| A1 | Arrasto sem alternativa de ponteiro único (reordenar, agrupar, nível do chip, redimensionar) | 2.5.7 | teclado não atende 2.5.7 | menu da coluna (clique direito/Shift+F10/botão): "Agrupar", "Mover ←/→", "Ajustar largura"; menu do painel com "Mover ←/→" | sim | ALTA |
| A2 | Seleção só por cor | 1.4.1, 1.4.11 | linha selecionada 1,19:1 da comum, quase igual ao hover | barra de 3 px no início da linha selecionada (primário, 6,4:1); token `--u-grid-selected-row-indicator-color` | sim | ALTA |
| A3 | Alça de redimensionar | 2.5.8, 1.4.11 | alvo de 8 px colado ao alvo de ordenação; barra 2,3:1 | padrão `--u-grid-resize-handle-width: 24px` (barra visual segue 2 px) e barra opaca no hover/foco | sim | MÉDIA |
| A4 | Cor do texto não definida | 1.4.3 | página escura sem tema → texto claro sobre o fundo branco do grid | `:host { color: var(--u-grid-color, var(--u-color-on-surface, rgb(29,27,32))) }` | sim | MÉDIA |
| A5 | Coluna filtrada só pela cor do funil | 1.4.1, 1.3.1 | mesmo ícone e mesmo nome com/sem filtro | funil preenchido quando ativo + i18n `columnFiltered` em `aria-describedby` | sim | MÉDIA |
| A6 | Anúncios que faltam | 4.1.3 | prioridade da multi-ordenação; nível do chip; desagrupar/expandir tudo pelo menu; redimensionar por teclado | chaves novas: `sortedPriorityAnnouncement`, `groupLevelAnnouncement`, `ungroupedAllAnnouncement`, `groupsExpandedAnnouncement`, `groupsCollapsedAnnouncement`, `columnResizedAnnouncement` | sim | MÉDIA |
| A7 | Nomes acessíveis | 2.4.6, 1.3.1 | alça = rótulo da coluna; painel de grupos sem nome; funil/operador sem a coluna; busca "Search…" (reticências, repetido); expandir nó de data = nome do checkbox; pino sem a coluna | chaves `resizeColumn`, `groupPanel`, `filterOperationOf`, `searchLabel`, `headerFilterSearchLabel`, `expandValue`, `fixStartColumn`/`fixEndColumn` | sim | MÉDIA |
| A8 | Ctrl+G sem painel de grupos | 2.1.1 | agrupa sem como desagrupar | Ctrl+G alterna (agrupa/desagrupa) também no cabeçalho | sim | MÉDIA |
| A9 | Barra não reflui a 320 px | 1.4.10 | altura fixa, chips por cima da busca | `flex-wrap`; `--u-grid-toolbar-height` vira altura mínima | sim | MÉDIA |
| A10 | Lista do popover do funil | 1.3.1, 2.4.3 | até 500 pontos de Tab; árvore de datas plana; corte em 500 sem aviso; Enter na busca não confirma | `role=tree`/`listbox` com roving, Enter = OK, linha "mostrando 500 de N" + contagem por `status` | sim | MÉDIA |
| A11 | Botão de operador | APG Menu Button | ↓/↑ não abrem o menu | ↓/↑ abrem no 1º/último item | sim | BAIXA |
| A12 | Conteúdo interativo de células | APG | link/botão num `renderer` vira ponto de Tab extra | grid põe `tabindex=-1` nos focáveis das células não ativas (ou documentar) | sim | BAIXA |
| A13 | Atalhos não descobríveis | 3.3.2 | Ctrl+G, Alt+Shift, Delete, F2 só na spec | `aria-keyshortcuts` + textos que citam a tecla ("…ou Ctrl+G") | sim | BAIXA |
| A14 | Estado "fixada" e prioridade de ordenação no cabeçalho | 1.3.1 | só visual / só no seletor | `aria-description` com i18n | sim | BAIXA |

### Outros

| Item | WCAG | Problema | Encaminhamento | API? | Sev. | Estado |
|---|---|---|---|---|---|---|
| Expandir/recolher lido? | 4.1.2 | `aria-expanded` no `<tr>`, foco no `gridcell`; NVDA pode não ler a mudança | roteiro manual NVDA/JAWS; se mudo, `aria-expanded` também no `gridcell` | não | MÉDIA | 🔎 |
| `aria-setsize`/`aria-posinset` dos grupos | 1.3.1 | com virtualização o leitor não deduz "grupo 3 de 5" | calcular pelos irmãos no modelo de grupos | não | MÉDIA | 📌 |
| Clique fora do popover | 2.4.3 | foco vai aonde se clicou | decisão acima | não | — | ➖ |
| Linha "sem dados" fora dos índices | 1.3.1 | sem `aria-rowindex`; `colspan` conta recuos | dar índice e contar no `aria-rowcount` | não | BAIXA | 📌 |
| `colspan` do rótulo do grupo | 1.3.1 | inclui recuos `presentation` | separar recuos em `td` próprio | não | BAIXA | 📌 |
| Alça: `aria-valuemax`/`valuetext`, Home/End | 4.1.2 | sem máximo finito, sem texto | largura do contêiner como máximo; Home/End | não | BAIXA | 📌 |
| Chip sem ação com `role=button` | 4.1.2 | Enter não faz nada sem ordenação/menu | sem `role=button` nesse caso | não | BAIXA | 📌 |
| Mover coluna no limite | 4.1.3 | silêncio | anunciar a posição atual | não | BAIXA | 📌 |
| Zoom só de texto | 1.4.4 | virtualizador assume `rowHeight` sem `wrap` | medir uma linha de amostra | não | BAIXA | 📌 |
| Textos cortados nos popovers | 1.4.12 | reticências sem como ler tudo | `white-space: normal` nas listas | não | BAIXA | 📌 |
| Busca dentro de `role=toolbar` | 1.3.1 | campo de texto numa barra sem nome | o `role=toolbar` passou ao painel de grupos, com nome (`groupPanelLabel`); a busca fica fora | não | BAIXA | ✅ |

## Testes
`src/accessibility.browser.test.ts` (21 casos): foco (linha filtrada,
desagrupar, menu do painel, expandir grupo, seletor: fixar e Tab),
2.4.11 com totais, teclado (rodapé, F2), ARIA (nome do cabeçalho,
`aria-level` + axe agrupado, `aria-busy`, fantasma, `lang`), anúncios
(Ctrl+G recusado, repetido, Espaço), contraste (placeholder, editor),
`forced-colors` e movimento reduzido.

Ajustes aprovados depois (2026-11-18): nome do grid pelo hospedeiro
(`aria-label`/`aria-labelledby` → tabela, spec 10;
`src/host-label.browser.test.ts`, com axe e vazamento do observador),
`dir`/`lang` no HTML do Ctrl+C (spec 12), `groupPanelMenuLabel`.
Revisão de a11y dessa entrega: aplicado o que não muda API
(`ariaLabelledByElements`, cópia de texto sem `aria-hidden`, ancestral do
alvo trocado, alvo que contém o grid, hidratação). 🔎 Com VoiceOver/JAWS:
o hospedeiro com `aria-label` (genérico) é lido como "grupo" com o nome
repetido antes da tabela? Se sim, a saída é um rótulo não ARIA (vai ao
usuário). ⏳ Propostas que mudam o `detail.html` do `u-grid-copying` (vão
ao usuário): `lang` da tabela copiada = idioma do CONTEÚDO (o `[lang]`
mais próximo do hospedeiro, sem cair no idioma do navegador), não o da
interface — o Ctrl+C só copia dados do app (decisão "`lang`" acima); e
`dir="ltr"` explícito em grid LTR (colado num documento RTL, inverteria as
colunas).

## Roteiro manual (leitor de tela)
NVDA + Chrome e JAWS + Edge no Windows, VoiceOver + Safari no macOS:
percorrer cabeçalho → corpo → rodapé; ordenar (ouvir o anúncio); filtrar
pela linha de filtro e pelo funil (Esc devolve ao funil); agrupar por
Ctrl+G, expandir/recolher (ouvir o estado — item 🔎); selecionar com
Espaço e Ctrl+A; abrir o seletor e fixar; `language="ar"` numa página `en`.

Frente 13 (bandas): conferir que NVDA/JAWS leem banda + coluna ao entrar
numa célula do corpo e o alcance do `colspan` da banda, também com
`column-rendering-mode="virtual"` e a banda só em parte no DOM (o `colspan`
conta as espaçadoras); 🔎 VoiceOver: se ficar mudo no alcance, criar
`bandColumnCount` na descrição da banda.

Frente 19 (intervalo de células): 🔎 conferir se NVDA/JAWS leem
"selecionado" ao entrar numa célula de um intervalo e o anúncio do tamanho
depois da pausa; "linha selecionada + intervalo" (linha com
`aria-selected="true"` e células do intervalo); Shift+F8 → setas →
Shift+seta → Esc; a tinta de 14 % do intervalo no modo normal (o contorno
é o indicador ≥ 3:1). ⏳ 2.5.7 do intervalo depende dos itens da frente 18
(`extendSelectionToCell`/`addCellToSelection` no menu da célula, pressionar
longo no toque): a 19 sozinha não fecha o 2.5.7 para quem usa só ponteiro.
✅ Fechado depois do merge da 18: os itens estão no menu da célula (clique
direito real com a âncora de antes do `mousedown`, toque longo, Ctrl+clique
no Mac), com testes em `cell-range.browser.test.ts` ("menu de contexto da
célula"). Deixado (BAIXA): o nome do menu continua "Row options"
(`rowMenuLabel`) mesmo só com itens de célula — chave nova, fica para aval.
Hoje só `aria-selected="true"` vai nas células (o
`false` não é emitido, como no AG Grid) para não dizer "não selecionado" a
cada seta; se o leitor não ler o "selecionado" sem o `false` nas vizinhas,
reavaliar.

## Proposta A1–A14 (aprovada pelo usuário em 2026-11-18: "Approve all")

Nomes e desenho concretos, revisados pelo `webcomponent-api-reviewer` e
pelo `a11y-reviewer` antes da implementação.

- **A1 — menu do cabeçalho** (alternativa de ponteiro único ao arrasto).
  Propriedade `columnHeaderMenu` ↔ `column-header-menu`
  (`booleanAttribute(true)`; `"false"` desliga), irmã de `groupPanelMenu`.
  Abre com clique direito no cabeçalho, Shift+F10 ou tecla de menu no
  cabeçalho focado. `role="menu"` + `menuitem`, ↑/↓/Home/End, Esc e ação
  devolvem o foco ao cabeçalho, Tab fecha. Itens (só os que valem para a
  coluna): "Group by this column" (agrupável), "Move left"/"Move right"
  (físicos; desabilitados no limite do bloco), "Auto-size column"
  (`column-resizing`). Menu do painel ganha "Move left"/"Move right" (nível
  do chip). `::part(column-header-menu)`. i18n: `columnHeaderMenu`
  ("Column options"), `groupByColumn`, `moveLeft`, `moveRight`,
  `autoSizeColumn`. Largura arbitrária segue só por teclado (Alt+←/→) e
  arrasto; pelo ponteiro sem arrasto, "Auto-size column".
- **A2** — `--u-grid-selected-row-indicator-color` (padrão
  `--u-color-primary`): barra de 3 px no início da linha selecionada.
- **A3** — padrão de `--u-grid-resize-handle-width` 8px → 24px; com
  `column-resizing`, o `th` reserva a largura da alça no fim
  (`padding-inline-end`); barra opaca (`--u-grid-group-toggle-color`) no
  hover/foco.
- **A4** — `--u-grid-color` (padrão `--u-color-on-surface`,
  `rgb(29, 27, 32)`) no `:host`.
- **A5** — funil preenchido quando a coluna tem filtro; i18n
  `columnFiltered` ("Filtered") na descrição do cabeçalho e do funil.
- **A6** — i18n `sortedPriorityAnnouncement` ("Sorted by {column},
  {order}, priority {priority}", com 2+ colunas), `groupLevelAnnouncement`
  ("{column} moved to grouping level {level} of {count}"),
  `ungroupedAllAnnouncement`, `groupsExpandedAnnouncement`,
  `groupsCollapsedAnnouncement`, `columnResizedAnnouncement` ("{column}
  width: {width} pixels", com espera de 500 ms).
- **A7** — i18n `resizeColumn` ("Resize {column}", nome da alça),
  `groupPanel` ("Grouping", nome do painel de grupos, que passa a ser o
  `role="toolbar"` no lugar da barra inteira), `filterOperationFor`
  ("Filter operation for {column}: {operation}"), `searchLabel` ("Search in
  the grid"), `headerFilterSearchLabel` ("Search values"),
  `fixStartColumn`/`fixEndColumn` ("Pin {column} to start/end").
- **A8** — Ctrl+G numa linha de grupo desagrupa a coluna dela (o cabeçalho
  continua agrupando).
- **A9** — a barra quebra linha (`flex-wrap`); `--u-grid-toolbar-height`
  vira altura mínima; o cabeçalho das colunas prende abaixo da altura
  medida.
- **A10** — popover do funil: lista `role="tree"`
  (`aria-multiselectable`) com `treeitem` + `aria-checked`/`aria-level`/
  `aria-expanded`, um ponto de Tab (roving), ↑/↓/Home/End, →/← expandem/
  recolhem ou vão ao pai/filho, Espaço marca, Enter = OK (também na
  busca); linha "Showing {shown} of {count}" quando corta em 500;
  contagem após a busca numa região `status` do popover. i18n
  `headerFilterTruncated`, `headerFilterValueCount` ("{count} values").
- **A11** — ↓/↑ no botão de operação abrem o menu no 1º/último item.
- **A12** — focáveis dentro das células (renderer) ficam `tabindex="-1"`;
  Enter/F2 entram neles, Esc volta (um ponto de Tab por grid).
- **A13** — `aria-keyshortcuts` no cabeçalho (conforme os recursos
  ligados) e nos chips; textos `dragToGroup` ("…or press Ctrl+G on it") e
  `autoSize` ("Double-click or press Enter to auto-size") nos 14 idiomas.
- **A14** — descrição do cabeçalho (`aria-describedby` para um texto
  oculto): "Pinned to start/end" (`columnFixedStart`/`columnFixedEnd`),
  "Sort priority {priority}" (`sortPriority`, com 2+ colunas) e "Filtered"
  (A5).

## Implementação de A1–A14 (revisões e decisões)

O `webcomponent-api-reviewer` e o `a11y-reviewer` revisaram a proposta antes
da implementação. Achados aceitos (nomes finais; os ajustes de nome e os
acréscimos voltam ao usuário para confirmação junto com a entrega):

- **Chaves renomeadas** em relação à proposta: `fixStartColumn`/`fixEndColumn`
  → `fixStartLabel`/`fixEndLabel`; `filterOperationFor` →
  `filterOperationButtonLabel`; `resizeColumn` → `resizeHandleLabel`;
  `searchLabel` → `searchPanelLabel`; `groupPanel` → `groupPanelLabel`;
  `sortedPriorityAnnouncement` → `sortedWithPriorityAnnouncement`;
  `groupLevelAnnouncement` → `groupLevelChangedAnnouncement`;
  `ungroupedAllAnnouncement` → `groupingClearedAnnouncement`; `sortPriority`
  → `columnSortPriority` ("Sorted {order}, priority {priority}"); `groupByColumn`
  → `groupColumn`; `columnHeaderMenu` (texto) → `columnHeaderMenuLabel`
  ("Options for {column}"). Sem plural: `headerFilterSearchAnnouncement` (era `headerFilterValueCount`) = "Values:
  {count}", `columnResizedAnnouncement` = "{column} width: {width} px".
- **Acréscimos** (do `a11y-reviewer`, para fechar o 2.5.7 de verdade):
  botão "⋮" no cabeçalho (`::part(column-header-menu-button)`; no hover/foco
  e sempre em telas de toque — o iOS não tem menu de contexto no toque
  longo); itens "Increase width"/"Decrease width" (`increaseColumnWidth`,
  `decreaseColumnWidth`; o menu fica aberto para repetir) — largura por
  ponteiro sem arrasto; "Select all results ({count})" (`selectAllResults`)
  enquanto há busca no funil; `aria-sort` só na 1ª coluna da ordenação (as
  outras levam `none` + a descrição com direção e prioridade);
  `--u-grid-selected-row-indicator-width` (3px; `0` desliga) e
  `--u-grid-resize-handle-color` (do `webcomponent-api-reviewer`).
- **Menu do cabeçalho**: itens que não se aplicam somem; "Mover" fica visível
  e `aria-disabled` no limite do bloco (focável pelas setas, sem efeito,
  `GrayText` em `forced-colors`). Sem nenhum item: não abre, não chama
  `preventDefault` e não há botão nem `Shift+F10`. O hospedeiro cancela no
  `contextmenu` (captura) e fica com o próprio menu. Lados físicos: em RTL
  "Move left" vai para o fim. Abrir pelo clique direito/botão torna o
  cabeçalho a célula ativa (Esc volta a ele). "Agrupar" e "Mover" levam o
  foco como o Ctrl+G/Alt+Shift (a guarda de foco cobre o cabeçalho que
  sai). Eventos: os mesmos dos gestos (`u-grid-group-change`,
  `u-grid-column-reorder`, `u-grid-column-resize`).
- **Árvore do funil**: o `treeitem` carrega o estado (`aria-checked`
  true/false/mixed); a caixa e a seta de expandir são só visuais
  (`aria-hidden`; a seta só no ponteiro). `aria-level`/`aria-setsize`/
  `aria-posinset` explícitos (a lista é desenhada plana). Ao buscar, o roving
  volta ao 1º item; Tab no popover: busca → "Select all" → árvore → Limpar →
  OK → Cancelar. A contagem é anunciada 500 ms depois de parar de digitar,
  numa região `status` que existe desde a abertura.
- **Largura por teclado**: no cabeçalho (Alt+←/→) anuncia com espera de 500 ms
  (timer solto no disconnect: `_memoryStats.announceTimers`); na alça focada
  o leitor lê o `aria-valuenow` (sem anúncio duplicado); pelo menu, na hora.
- **Conteúdo das células (A12)**: Tab/Shift+Tab circulam entre os focáveis
  da célula; custom elements com shadow root recebem `tabindex="-1"` no
  hospedeiro. Conteúdo inserido depois (assíncrono) não é ajustado
  (documentado).
- **Descrição do cabeçalho**: um `<span hidden>` com id único por
  `aria-colindex`, texto "prioridade, fixada, filtrada"; sem descrição,
  sem `aria-describedby`. O funil filtrado aponta para a mesma descrição.
- **Funil filtrado (A5)**: em vez de "funil preenchido", um ponto no canto
  do ícone (a barra de cima encurta para caber); mesmo efeito, sem segundo
  ícone.
- **Barra da alça (A3)**: cor por `--u-grid-resize-handle-color` (fallback
  `--u-grid-group-toggle-color`), não direto pelo token do grupo.
- **Renomeação da chave `groupPanelMenu`** (nome do menu do painel) para
  `groupPanelMenuLabel`: recusada na revisão desta frente (API anterior),
  aprovada pelo usuário depois (2026-11-18) e feita com alias:
  `setGridTranslation` aceita `groupPanelMenu` com aviso uma vez por página
  (spec 15, "Deprecated names" no README).
- **Barra (A9)**: a altura medida vai numa variável interna do contêiner
  (`--_toolbar-offset`, `ResizeObserver` já existente, solto no
  disconnect) e alimenta o `top` do `thead` e do indicador de soltura.

### Revisão de a11y da implementação (corrigido, com teste)

- Guarda de foco cobre o conteúdo do `renderer` (light DOM): botão que
  remove a própria linha devolve o foco à célula ativa. Confere pelo
  `activeElement` depois do microtask de remoção (o `:focus-within` do
  Chromium fica velho até o "focus fixup").
- A12 só rebaixa custom elements que recebem foco (`delegatesFocus` ou
  focável na árvore sombra; reconfere depois do `updateComplete` do Lit);
  decorativos ficam sem `tabindex` e o clique neles não trava as setas.
  Alvos `aria-hidden` nunca recebem foco.
- O "⋮" fica no fluxo do cabeçalho, depois do funil (não cobre funil, seta
  nem alça); só a opacidade alterna.
- Clicar no "⋮" com o menu aberto fecha (não fecha-e-reabre).
- Enter/Esc durante composição de IME não aplicam nem fecham o funil.
- Os menus do grid cancelam o `contextmenu` (a tecla Menu o solta no
  `keyup`, já com o foco no menu).

## Frente 09 — edição (decisões)

Desenho revisado pelo `a11y-reviewer` antes do aval (seção "Acessibilidade
(aprovada)" da spec 09) e de novo na entrega. Corrigido na entrega (com
teste em `editing.browser.test.ts`, roteiro "edição: roteiro de teclado"):
erro da linha (`setError` sem coluna, colunas ocultas) visível na 1ª célula
e no `aria-describedby` de todas; anúncio do salvar barrado com o 1º erro;
modo célula só move o foco depois de salvar se salvou e o foco ainda está
na célula (destino pela chave); "Validando…" anunciado depois de 1 s; sem
`aria-busy` na célula; foco em célula inválida com faixa clara entre o anel
e o vermelho; marca de alterada num `::after` com bordas (RTL e
`forced-colors`) e barra na linha nova; editor embutido nomeado pelo
cabeçalho (`aria-labelledby`), nunca `aria-label` vazio; Esc em qualquer
célula da linha aberta (modo linha); mensagem com `aria-hidden` fora do
editor (lida só pela descrição); `aria-describedby` do editor do hospedeiro
acrescentado, não trocado; `close` do diálogo tratado.

Deixados (BAIXA, justificados): `lang` da mensagem quando o texto é da i18n
(a mensagem pode ser do hospedeiro; o `lang` do grid já é o do texto da
interface na maioria dos casos); exemplo do formato do número (texto i18n
novo — fica para aval); erro de salvar do modo linha na barra (não junto aos
botões); mensagem da última linha visível pode ficar sob o rodapé fixo.

## Frente 21 — responsivo (colunas ocultas por falta de espaço)

Desenho revisado pelo `a11y-reviewer` antes do aval (seção
"Acessibilidade" da spec 21), todos os achados acatados: a linha
adaptativa é a linha de detalhe (um botão, `aria-expanded`, linha ligada à
mestre); `aria-colcount`/`aria-colindex` só com as colunas exibidas; todo
valor é parada do Tab dentro da célula (`aria-labelledby` = `<dt>` + valor;
separador de lista oculto entre pares); marcas de ordenação/filtro no
rótulo; erro/alteração de coluna oculta marcados na célula de expansão;
foco realocado (coluna sai → célula de expansão; volta → célula dela; a
expansão some → 1ª célula de dados; fora do grid só o `tabindex`);
conjunto congelado com editor/popover aberto; anúncio único por rajada (1
s), só com foco dentro, também na descrição do cabeçalho da expansão;
reflow 400% (última coluna encolhe; fixas param de grudar acima de 50%).
🔎 Conferir com NVDA/VoiceOver a leitura do `<dl>` dentro da `gridcell` e
do valor focado.

## Frente 20 — linhas fixas e linha inteira

Desenho revisado pelo `a11y-reviewer` antes do aval (seção
"Acessibilidade" da spec 20), todos os achados acatados: fixas em
`rowgroup`s próprios com nome (`fixedTopRowsLabel`/`fixedBottomRowsLabel`;
🔎 conferir se algum leitor lê o nome do `rowgroup`), `aria-rowindex` na
ordem visual, `aria-level="1"` no `treegrid`; sequência de teclado
cabeçalho → fixas do topo → corpo → fixas do fundo → totais; PageUp/PageDown
por blocos; foco em fixa só revela na horizontal (a rolagem do corpo não
pula); `#stickyTop`/`#stickyBottom`/`scrollToIndex` descontam as fixas
(WCAG 2.4.11); fixas deixam de ser sticky quando o que gruda passa de 50% da
área (zoom, 1.4.10); linha inteira com as células iniciais reais (expansão,
caixa) e uma `gridcell` com `aria-colspan`, Enter/F2/Esc como o detalhe.
Corrigido junto: o conteúdo do detalhe (frente 10) não ficava na largura
visível ao rolar na horizontal (a `--_viewport-inline-size` era apagada pelo
`style` do template e o `overflow: hidden` da célula prendia o sticky).

## Frente 25 — dados em árvore

`role="treegrid"` com `treeMode`; cada nó com `aria-level` (profundidade + 1;
no `match-only`, o nível para onde subiu), `aria-setsize`/`aria-posinset`
explícitos entre os irmãos exibidos (o conjunto inteiro mesmo com
paginação; esqueleto, rodapé de resumos, linha nova, fixas e totais sem
eles) e `aria-expanded` só com filhos (ou `hasChildren` remoto) — também na
`gridcell` da coluna da árvore, para o leitor ler a mudança com o foco na
célula (🔎 conferir NVDA/JAWS no roteiro manual). Botão de expandir
`aria-hidden`, `tabindex="-1"`, alvo 24×24 em CSS próprio; o clique foca a
célula da árvore. Teclado da APG treegrid adaptado ao foco de célula (aval
do usuário): na célula da árvore `→` expande o recolhido (senão anda), `←`
recolhe o expandido, senão vai ao pai (raiz: anda); `*` expande os irmãos
com anúncio "Expanded rows: {count}"; Enter alterna só sem edição e sem
conteúdo interativo. Recolher com a célula ativa num descendente leva a
célula ativa à do nó (o foco do DOM só acompanha se já estava no grid);
descartar um filho novo devolve à célula da árvore do pai. Carga remota:
"Loading child rows" só passando de 1 s, "Child rows loaded: {count}" ou o
erro sempre. Seleção recursiva exige as caixas (o misto só aparece nelas:
`aria-checked="mixed"`, linha `aria-selected="false"`). RTL: recuo por
`padding-inline-start`, seta espelhada recolhida; `forced-colors`: botão
`ButtonText`, indicador `CanvasText`; movimento reduzido: sem giro.
