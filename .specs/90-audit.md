# 90 — Auditoria de bugs e segurança (2026-11-17)

Leitura completa de `src/` e `dev/`, `tsc`, `npm audit` e reprodução no
navegador (servidor de dev, grids criados por JS). Tudo aqui é corrigido na
frente **Fundação** (`01-foundation.md`), salvo indicação.

**Estado (Fundação concluída):** B1–B22 e S1–S7 corrigidos, cada bug com
teste de regressão em `src/grid.browser.test.ts` (B10: contador de registros;
B13: sem `indexOf` por render; B15: conferido no demo em RTL). B23 resolvido
(pacote MIT no npmjs). Em aberto: o `picomatch` do S6 (sem versão corrigida;
só ferramentas de dev).

Veredito: **REPRODUZIDO** = rodado no navegador com o resultado anotado;
**CÓDIGO** = evidente pela leitura, sem reprodução.

## Bugs

| # | Sev. | Veredito | Onde | Defeito | Reprodução / efeito |
|---|---|---|---|---|---|
| B1 | Alta | REPRODUZIDO | `grid-custom-cell.ts` + `#renderCell` | A célula com `renderer` só chama o renderer no `connectedCallback`. O `repeat` reaproveita o DOM pela chave do virtualizador (o ÍNDICE da linha), então quando as linhas mudam de posição a célula mostra o conteúdo de OUTRA linha. O nome do slot também usa o índice da linha/coluna e não é atualizado. | Grupo A (item0..2) e B (item3..5); expandir B, depois A → a linha `item1` mostra `R-item3`, `item2` mostra `R-item4`. Também ao reordenar colunas e ao ordenar. |
| B2 | Alta | REPRODUZIDO | `connectedCallback` → `#setColumns` | `#setColumns` sempre troca `_columns` pelos `<u-grid-column>` filhos. Colunas passadas por propriedade ANTES de conectar somem; o `slotchange` do slot padrão (texto em branco entre as tags) faz o mesmo. | `g.columns=[…]; g.items=[…]; document.body.append(g)` → 0 colunas, grid vazio. |
| B3 | Alta | REPRODUZIDO | `disconnectedCallback` | `this._columns.length = 0` esvazia o ARRAY DO CONSUMIDOR passado em `.columns`; ao reconectar (mover no DOM, portal, troca de rota com cache) o grid fica sem colunas. | Array `cols` com 2 itens → `g.remove()` → `cols.length === 0`; `append` de novo → 0 colunas. |
| B4 | Alta | REPRODUZIDO | `#updateSorting` | `this.items.sort(...)` ordena NO LUGAR o array do consumidor (quebra estado de frameworks, `Object.freeze` lança). | `[z,a,m]` agrupado → o array do hospedeiro vira `[a,m,z]`. |
| B5 | Alta | REPRODUZIDO | `#rebuildGroupsFromLevel` | Ao acrescentar um nível de grupo, os itens do nível de cima não são reordenados pela coluna nova antes de agrupar; `#buildGroups` só junta valores CONSECUTIVOS → subgrupos duplicados. | A=x com B=[p,q,p]; arrastar B para o grupo → `B: p | B: q | B: p`. |
| B6 | Alta | REPRODUZIDO | `#rebuildGroupsFromLevel` | Com `items` vazio, `#groupsByLevel[level-1]` é `undefined` → `TypeError: levelGroups is not iterable` ao agrupar em nível > 0. | Grid com grupo em A e `items=[]`; `groupColumn(B, 1)` (= arrastar B para o fim do painel). |
| B7 | Alta | REPRODUZIDO | `#getValueByPath` | Coluna sem `path` (coluna de ações com `renderer`) quebra ao ser agrupada: `path.split` de `undefined`. A UI deixa arrastar qualquer coluna para o painel. | `TypeError: Cannot read properties of undefined (reading 'split')`. |
| B8 | Média | REPRODUZIDO | `#updateSorting` | Grupos ordenados por `toString().localeCompare` → números e datas em ordem lexicográfica. | Anos 9, 10, 100, 2 → `10, 100, 2, 9`. |
| B9 | Média | REPRODUZIDO | `_resetGroupColumns` | `.sort(c => (c._index ?? 0) - (c._index ?? 0))` — comparador sempre 0 (um parâmetro só). A ordem arrastada pelo usuário se perde em qualquer reatribuição de `columns`/`groupIndex`. | Mover C para o início → `C,A,B`; `g.columns = g.columns` → `A,B,C`. |
| B10 | Média | CÓDIGO | `GroupDragAndDropAdapter.attachToGroupDropTarget` | Sem checagem de duplicata, e o `ref` é uma arrow nova a cada render → o Lit chama o callback em TODO render (inclusive a cada passo de rolagem) e o array `#groups` cresce sem limite (vazamento de memória). `ColumnDragAndDropAdapter.attach` checa duplicata, mas nunca solta `<th>` que saíram do DOM. | Rolar por alguns minutos cresce o array indefinidamente. |
| B11 | Média | CÓDIGO | `#renderBody` | Paridade das listras (`odd`/`even`) é calculada a partir da 1ª linha RENDERIZADA, não do índice real → as listras trocam ao rolar um número ímpar de linhas. | `stripped` + rolar 1 linha. |
| B12 | Média | CÓDIGO | `#renderBody` | "Sem dados" aparece quando `virtualRows` está vazio — também com dados quando o contêiner ainda não tem altura (1º render, SSR, aba oculta). Deve olhar `#rows.length`. | — |
| B13 | Média | CÓDIGO | `#renderCell` | `this.#rows.indexOf(row)` por célula customizada em cada render → O(n) por célula; com 100 mil linhas e várias colunas customizadas a rolagem trava. | — |
| B14 | Média | CÓDIGO | `items` setter / agrupamento | Trocar `items` recria todos os grupos e perde o estado de expandido (sem `autoExpandGroups` tudo fecha a cada atualização de dados). | — |
| B15 | Média | CÓDIGO | drag adapters | Antes/depois do soltar é calculado por `clientX` e o indicador por `left` → invertido em RTL (o árabe é idioma embutido). | — |
| B16 | Baixa | CÓDIGO | `rowHeight` | Mudar `rowHeight` não chama `virtualizer.measure()`; `count` é mutado direto em `options` em vez de `setOptions`. | — |
| B17 | Baixa | CÓDIGO | `u-grid-column` | `renderer` declarado com `@property()` (com atributo): `renderer="x"` no HTML vira string e quebra com "is not a function". Deve ser `attribute: false`. `label` usa `textContent` sem `trim()`. | — |
| B18 | Baixa | CÓDIGO | ARIA | `aria-rowcount` não conta o cabeçalho; linha de grupo usa `aria-colindex` 1/2 fixos; o botão de expandir é um `<td>` com clique, sem foco, sem `aria-expanded`, sem teclado; `role="grid"` sem nenhuma navegação por teclado. | — |
| B19 | Baixa | CÓDIGO | `showHeader`/`stripped` | `showHeader` só esconde o painel de grupos (a linha de cabeçalho continua); `stripped` é erro de grafia de `striped`. Corrigir com alias e deprecação, sem quebrar. | — |
| B20 | Baixa | CÓDIGO | `grid-i18n.ts` | `setGridTranslation('__proto__', …)` troca o protótipo da tabela; `language="constructor"` devolve `Object` como tradução (textos `undefined`). Usar `Object.hasOwn`/objeto sem protótipo. | — |
| B21 | Baixa | CÓDIGO | `grid-i18n.ts` | `ContextRoot` anexado ao `document.body` como efeito colateral do import; com duas cópias do pacote na página, dois `ContextRoot`. Mudança de `<html lang>` depois do 1º render não é observada. | — |
| B22 | Baixa | CÓDIGO | build | `npm run build` (`tsc ./src/grid.ts`) ignora o `tsconfig`; `tsc -p src` falha (TS5097 em `grid-column.ts:5`, import `.ts`; TS4111 em `grid.ts:214`); `build:server` aponta para `src/entry-server.js`, que não existe; não há script de teste. | — |
| B23 | Baixa | CÓDIGO | README/pacote | Mudança local (não commitada) tira o privJS do topo do README, mas a seção Installation continua ensinando o registro privJS; `license: "Paid"` não é SPDX. Decidir o canal de distribuição. | **Resolvido:** pacote público no npmjs, licença MIT (`LICENSE`); `package.json` com `exports`/`types`/`files`/`sideEffects`, `prepack` limpa o `dist/` e gera o build; README sem privJS (npm + CDN). |

## Segurança

O núcleo do componente **não tem XSS**: rótulos, valores, traduções e o texto
de grupo passam por binding de texto do Lit; o `renderer` devolve um
`HTMLElement` criado pelo próprio hospedeiro. Os riscos estão nas
dependências e no ambiente de dev.

| # | Sev. | Onde | Problema | Correção |
|---|---|---|---|---|
| S1 | Alta | `package.json` | `express` está em `dependencies`: todo consumidor instala o Express e herda `proxy-addr` (crítica, spoofing de IP), `body-parser` e `path-to-regexp` (altas, DoS) e `qs` (moderada) — `npm audit --omit=dev` = 4 vulnerabilidades. `@webcomponents/template-shadowroot` também só serve ao demo. | Mover os dois para `devDependencies`; `npm audit fix`. |
| S2 | Alta | `dev/server.js` + `vite@7.2.4` | `app.listen(5173)` escuta em TODAS as interfaces, e o Vite 7.2.4 tem leitura arbitrária de arquivo pelo WebSocket do dev server, bypass de `server.fs.deny` (inclusive caminhos alternativos no Windows) e execução de script cross-origin via middleware. Qualquer máquina da rede lê arquivos do PC de quem roda `npm run dev`. | `app.listen(5173, 'localhost')`; Vite ≥ 7.3.7. |
| S3 | Alta | `rollup@4.53` | Escrita arbitrária de arquivo por path traversal (< 4.59) no build. | Rollup ≥ 4.59; `@rollup/plugin-terser` (puxa `serialize-javascript` vulnerável) atualizado. |
| S4 | Média | `@universal-material/web` (dev) | Puxa `swiper` com prototype pollution (crítica) e `dompurify` com vários XSS; só usado em `docs/my-element.ts`. | Atualizar ou remover se o `docs/` não for mais usado. |
| S5 | Média | `dev/entry-server.ts` | O SSR do demo busca `countriesnow.space` a cada import do módulo, sem timeout nem validação; se a API cair, o dev server não sobe. | Fixture local versionada (`dev/population.json`) e a API como opção. |
| S6 | Baixa | geral | `npm audit` completo: 56 vulnerabilidades (4 críticas, 19 altas), quase todas de ferramentas de dev (`npm` embutido em alguma dev-dep, `tar`, `minimatch`, `brace-expansion`, `postcss`). | `npm audit fix` + checagem no CI. |
| S7 | Info | `renderer` | Documentar no README que o `renderer` deve montar DOM com `textContent` (o exemplo já faz) e nunca `innerHTML` com dado da linha — o grid não sanitiza o que o hospedeiro devolve. | Nota no README. |
