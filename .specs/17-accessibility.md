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

### Aguardam aval (mudam API ou comportamento visível ao hospedeiro)

| # | Item | WCAG | Problema | Correção proposta | API? | Sev. |
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
| Busca dentro de `role=toolbar` | 1.3.1 | campo de texto numa barra sem nome | com A7 (`groupPanel`/nome da barra) | — | BAIXA | ⏳ |

## Testes
`src/accessibility.browser.test.ts` (21 casos): foco (linha filtrada,
desagrupar, menu do painel, expandir grupo, seletor: fixar e Tab),
2.4.11 com totais, teclado (rodapé, F2), ARIA (nome do cabeçalho,
`aria-level` + axe agrupado, `aria-busy`, fantasma, `lang`), anúncios
(Ctrl+G recusado, repetido, Espaço), contraste (placeholder, editor),
`forced-colors` e movimento reduzido.

## Roteiro manual (leitor de tela)
NVDA + Chrome e JAWS + Edge no Windows, VoiceOver + Safari no macOS:
percorrer cabeçalho → corpo → rodapé; ordenar (ouvir o anúncio); filtrar
pela linha de filtro e pelo funil (Esc devolve ao funil); agrupar por
Ctrl+G, expandir/recolher (ouvir o estado — item 🔎); selecionar com
Espaço e Ctrl+A; abrir o seletor e fixar; `language="ar"` numa página `en`.
