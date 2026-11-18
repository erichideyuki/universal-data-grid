# Data Grid — backlog de funcionalidades

Lacunas do `<u-grid>` em relação ao **DevExtreme DataGrid** (referência
principal) e ao **AG Grid** (referência secundária), levantamento de
2026-11-17, e o fluxo combinado para fechá-las. Modelo herdado do
`write/BACKLOG.md` do Universal Office, adaptado a um componente só.

## Fluxo de cada frente

Uma **frente** é um recurso completo com API, interação, teclado, ARIA, i18n,
testes e docs (ex.: "Ordenação"), não um botão. Cada frente tem uma spec em
`.specs/` e roda na própria sessão, no próprio worktree.

0. **Worktree** — sessão nova com worktree a partir da `main` atualizada;
   `npm ci`. Nunca apagar o worktree com `rm -rf` — usar
   `git worktree remove`.
1. **Escopo** — reler a spec da frente e confirmar com o usuário NA SESSÃO da
   frente o que entra e o que fica de fora. Mudança de escopo atualiza a spec
   no mesmo branch.
2. **Medir a referência** — abrir a demo equivalente do DevExtreme (e do AG
   Grid quando o DevExtreme não cobre) no navegador e anotar na seção
   "Referência medida" da spec: interação (clique, Shift/Ctrl+clique), teclas,
   padrões, ordem dos estados, textos (só o sentido; a tradução é nossa) e
   ARIA. Sem copiar código, CSS ou ícones.
3. **Row model** — a parte de dados entra como função pura em
   `src/row-model/` (filtrar → ordenar → agrupar → resumir → achatar), com
   teste unitário antes da UI.
4. **API e desenho de acessibilidade** — propriedades/atributos, métodos e
   eventos no `<u-grid>` e, quando for por coluna, no `GridColumnDef` e no
   `<u-grid-column>`. Eventos são `CustomEvent` com prefixo `u-grid-`,
   `bubbles` e `composed`, e os cancelláveis disparam ANTES da mudança. Na
   mesma proposta, a seção "Acessibilidade" da spec: mapa de teclado (LTR e
   RTL; todo gesto de mouse com equivalente), papéis e propriedades ARIA,
   foco (para onde vai ao abrir, fechar, remover) e anúncios `aria-live`
   (o quê, quando, sem excesso).
5. **Revisão do desenho** — antes de mostrar a proposta ao usuário, rodar
   em paralelo os subagentes `webcomponent-api-reviewer` e `a11y-reviewer`
   (`.claude/agents/`) sobre ela, aplicar os achados aceitos e levar ao
   usuário já a versão revisada (com os achados recusados e o porquê, em
   uma linha cada). Nome de API pública e comportamento visível ao
   hospedeiro só entram com o aval do usuário.
6. **Interface** — render no `src/render/` ou num controller em
   `src/features/`; textos novos na tabela de `grid-i18n.ts` (14 idiomas);
   CSS por custom property `--u-grid-*` e `::part`.
7. **Acessibilidade** — implementar o desenho aprovado: teclado completo
   (todo gesto de mouse tem equivalente), ARIA conforme o padrão "grid" da
   APG, foco visível e não obscurecido, retorno do foco, anúncios, RTL,
   `forced-colors` e `prefers-reduced-motion`; decisões em
   `.specs/17-accessibility.md`.
8. **Testes** — unitários do row model, de componente no navegador (Vitest
   browser), `axe-core` sem violações nos estados do recurso (aberto/
   fechado, agrupado, RTL), roteiro de teclado automatizado no navegador
   (operar só por teclado e conferir para onde volta o foco), SSR
   (renderiza no `@lit-labs/ssr` sem erro) e conferência manual
   no demo (`npm run dev`) em `en`, `pt` e `ar` (RTL). Suíte verde, lint e
   `tsc` limpos. Todo listener/observer/timer/cache global novo libera no
   `disconnectedCallback` (ou é limitado) e ganha teste de vazamento com
   `src/test/leak.ts` (spec 14). Frente que mexe em dados, render ou
   interação roda `npm run test:perf` (perfil de máquina fraca) e não piora
   a linha de base além da tolerância nem estoura os orçamentos; recurso
   novo entra com cenário de perf (spec 16).
9. **Docs** — README (seção do recurso + API reference) e
   `custom-elements.json` (`npm run analyze`).
10. **Revisão da API implementada** — rodar de novo o
    `webcomponent-api-reviewer` sobre o que foi implementado (código,
    README, `custom-elements.json`); corrigir o que for ALTA/MÉDIA ou
    justificar no relato de entrega. Divergência do que o usuário aprovou
    volta para ele.
11. **Revisão de acessibilidade do implementado** — rodar de novo o
    `a11y-reviewer` sobre o implementado (código, estilos, i18n), com o
    `axe-core` e o roteiro de teclado do passo 8 verdes; corrigir o que for
    ALTA/MÉDIA ou justificar no relato. Correção que muda API ou
    comportamento visível ao hospedeiro volta para o usuário.
12. **Entrega** — commits no branch da frente, `git rebase main`, testes de
    novo; avisar a coordenadora com resumo e print. Não editar este arquivo.

**Sessão coordenadora** (a que abre as frentes): faz o merge fast-forward de
cada frente na main quando testes, lint e `tsc` estão verdes; atualiza o
estado aqui; remove o worktree e abre a próxima frente.

Regras gerais:

- A **Fase 0 é sequencial e vem antes de tudo**: sem ela todas as frentes
  disputam o `grid.ts` (hoje 728 linhas com dados, render e eventos juntos) e
  não há onde pôr teste.
- Depois da Fase 0, até **3 frentes** ao mesmo tempo, escolhidas para mexer
  em pastas diferentes (`row-model/<recurso>`, `features/<recurso>`). O
  `grid.ts` e o `grid-i18n.ts` são pontos de encontro: conflito neles se
  resolve no rebase de quem entrega.
- Pedir decisão ao usuário só em escopo, comportamento que diverge da
  referência, nome de API pública ou dependência nova.

## Lacunas frente às referências

Legenda: ✅ tem · ◐ parcial/com defeito · — não tem.

| Área | Recurso | `<u-grid>` | DevExtreme | AG Grid |
|---|---|---|---|---|
| Dados | Array local | ✅ | ✅ | ✅ |
| Dados | Fonte remota (sort/filter/group/paginação no servidor) | — | ✅ | ✅ (server-side row model) |
| Dados | Chave de linha (`keyExpr`/`getRowId`) e atualização incremental | — | ✅ | ✅ |
| Dados | Paginação / rolagem infinita | — | ✅ | ✅ |
| Rolagem | Virtualização de linhas | ✅ | ✅ | ✅ |
| Rolagem | Virtualização de colunas | — | ✅ | ✅ |
| Colunas | Definição por propriedade e por `<u-grid-column>` | ✅ | ✅ | ✅ |
| Colunas | Reordenar por arrasto | ✅ | ✅ | ✅ |
| Colunas | Redimensionar | ✅ | ✅ | ✅ |
| Colunas | Fixar à esquerda/direita | ✅ | ✅ | ✅ |
| Colunas | Ocultar / seletor de colunas | ✅ | ✅ | ✅ |
| Colunas | Cabeçalho em bandas (multinível) | — | ✅ | ✅ |
| Colunas | Tipo de dado e formatação (número, data, moeda, booleano) | ✅ | ✅ | ✅ |
| Colunas | Alinhamento, quebra de texto, largura mín./auto | ✅ | ✅ | ✅ |
| Ordenação | Clique no cabeçalho, múltipla, comparador próprio | ✅ | ✅ | ✅ |
| Filtro | Linha de filtro | ✅ | ✅ | ✅ (floating filter) |
| Filtro | Filtro no cabeçalho (lista de valores) | ✅ | ✅ | ✅ (set filter, Enterprise) |
| Filtro | Painel de busca (texto em todas as colunas) | ✅ | ✅ | ✅ (quick filter) |
| Filtro | Construtor de filtro / painel de filtro | — | ✅ | ◐ |
| Agrupamento | Painel de arrasto, multinível, auto-expandir | ✅ | ✅ | ✅ (Enterprise) |
| Agrupamento | Expandir/recolher tudo, estado mantido ao trocar dados | ✅ | ✅ | ✅ |
| Agrupamento | Ordenar grupos, contagem e resumos na linha do grupo | ✅ | ✅ | ✅ |
| Resumos | Totais (rodapé) e por grupo; agregações próprias | ✅ | ✅ | ✅ |
| Seleção | Linha única/múltipla, caixa de seleção, selecionar tudo | ✅ | ✅ | ✅ |
| Seleção | Foco de célula/linha, intervalo de células | ◐ (foco feito; intervalo — fase D) | ◐ | ✅ (intervalo: Enterprise) |
| Teclado | Navegação por setas, Home/End, PageUp/Down, Enter/F2 | ✅ | ✅ | ✅ |
| Edição | Célula, linha, lote, formulário/popup | — | ✅ | ✅ |
| Edição | Validação, inserir/excluir linha, desfazer | — | ✅ | ✅ |
| Templates | Célula | ✅ (`HTMLElement`; `TemplateResult` na frente 10) | ✅ | ✅ |
| Templates | Cabeçalho, linha de grupo, linha inteira, vazio | — | ✅ | ✅ |
| Detalhe | Master-detail (linha expansível) | — | ✅ | ✅ (Enterprise) |
| Hierarquia | Dados em árvore | — (TreeList é outro componente) | ◐ | ✅ (Enterprise) |
| Estado | Salvar/restaurar layout (colunas, ordem, filtros, grupos) | — | ✅ | ✅ |
| Exportação | CSV / Excel / PDF / área de transferência | — | ✅ | ✅ (Excel: Enterprise) |
| UI | Barra de ferramentas, menu de contexto, painel de carregamento | — | ✅ | ✅ |
| UI | Responsivo (colunas ocultas por prioridade) | — | ✅ | — |
| A11y | Padrão grid ARIA completo, leitor de tela | ✅ (revisão de acessibilidade em curso) | ✅ | ✅ |
| i18n | Textos da interface (14 idiomas) | ✅ | ✅ | ✅ |
| i18n | RTL | ✅ | ✅ | ✅ |
| SSR | Lit SSR + hidratação | ✅ | — | — |
| Tema | CSS custom properties e `::part` | ✅ | ✅ | ✅ |

Pontos fortes que a referência não tem e que precisam continuar: SSR,
web component nativo sem framework, tema por tokens do Material 3.

## Backlog

Estado: `—` a fazer · `em curso` · `feito`.

### Fase 0 — fundação (sequencial, antes de tudo)

| Frente | Spec | Inclui | Estado |
|---|---|---|---|
| Fundação | `01-foundation.md` | infra de testes; correção dos bugs da auditoria; separar row model, render e controllers; higiene de dependências e scripts | feito |
| Memória | `14-memory.md` | inventário do que retém o grid; helper `src/test/leak.ts`; testes de coleta, heap e grid de vida longa; correção dos vazamentos | feito |
| Desempenho em máquina fraca | `16-performance.md` | perfil fraco calibrado (`npm run test:perf`); orçamentos e linha de base de 100 mil a 5 milhões de linhas; virtualizador próprio com escala; row model sem objeto por linha; postos rápidos | feito |
| Revisão de acessibilidade | `17-accessibility.md` | subagente `a11y-reviewer` no fluxo (desenho e entrega); auditoria WCAG 2.2 AA do grid atual; correções sem mudança de API; as que mudam API/comportamento aguardam aval | em curso |

### Fase A — o dia a dia de qualquer grid

| Frente | Spec | Inclui | Estado |
|---|---|---|---|
| Tipos e formatação | `02-column-types-format.md` | `dataType`, `format` (Intl), alinhamento, `calculateCellValue`, quebra de texto | feito |
| Ordenação | `03-sorting.md` | clique no cabeçalho, múltipla com Shift, comparador, ordenação de grupos, API e evento | feito |
| Filtro | `04-filtering.md` | linha de filtro, painel de busca, filtro no cabeçalho, API de expressão de filtro | feito |
| Seleção e teclado | `05-selection-keyboard-a11y.md` | foco de célula, navegação por teclado, seleção única/múltipla, caixa de seleção, ARIA completo, teclado para agrupar/reordenar | feito |
| Colunas | `06-column-features.md` | redimensionar, fixar, ocultar + seletor, largura mín./auto, RTL do arrasto | feito |

### Fase B — dados de verdade

| Frente | Spec | Inclui | Estado |
|---|---|---|---|
| Resumos e grupos | `07-summaries-groups.md` | totais, resumos por grupo, contagem, expandir/recolher tudo, estado mantido | feito |
| Fonte de dados | `08-data-source-paging.md` | `keyExpr`, `DataSource` remota, paginação, rolagem infinita, painel de carregamento | — |
| Edição | `09-editing.md` | célula/linha/lote, editores por tipo, validação, inserir/excluir, eventos | — |
| Templates e detalhe | `10-templates-master-detail.md` | templates de cabeçalho, grupo, vazio; master-detail; refazer o renderer de célula | — |

### Fase C — produtividade

| Frente | Spec | Inclui | Estado |
|---|---|---|---|
| Estado | `11-state-persistence.md` | `getState`/`setState`, salvamento automático, evento de mudança | — |
| Exportação | `12-export-clipboard.md` | CSV, área de transferência; Excel por adaptador opcional | — |
| Bandas e virtualização de colunas | `13-bands-column-virtualization.md` | cabeçalho multinível, virtualizar colunas | — |

### Fase D — avançado (escopo decidido quando chegar a vez)

| Frente | Inclui | Estado |
|---|---|---|
| Barra e menus | barra de ferramentas configurável, menu de contexto, menu da coluna | — |
| Responsivo | colunas ocultas por prioridade com linha adaptativa | — |
| Árvore | dados hierárquicos (talvez um `<u-tree-grid>` à parte) | — |
| Intervalo de células | seleção retangular, copiar/colar intervalo | — |
| Linhas fixas | linhas fixadas no topo/rodapé | — |
| Arrastar linhas | reordenar linhas e arrastar entre grids | — |

### Pendências deixadas pelas frentes

| Origem | Pendência |
|---|---|
| Fundação | `picomatch` (ReDoS com padrões de glob não confiáveis) segue no `npm audit` sem versão corrigida; só ferramentas de dev com padrões fixos |
| Fundação | Renderer de célula aceitar `TemplateResult` além de `HTMLElement` — decidir na frente 10 |
| Fundação | Sem `keyExpr`, trocar `items` por objetos novos recria as linhas (a chave é a identidade do objeto) — frente 08 |
| Fundação | Expansão de grupos ainda não tem API (`expandAll` etc.) — frente 07 |
| Memória | Chromium retém ~0,6 KiB por grid criado (`<thead>` em shadow root, item 20 da spec 14); reportar ao Chromium e decidir se troca o `<thead>` |
