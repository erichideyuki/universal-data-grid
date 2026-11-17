# 05 — Seleção, teclado e acessibilidade

## Objetivo
Grid operável só por teclado e leitor de tela, com foco de célula e seleção
de linhas — pré-requisito da edição (09).

## Referência
WAI-ARIA APG, padrão "Data Grid" (fonte primária para teclado/ARIA).
DevExtreme: `focusedRowEnabled`, `selection.mode`
(`none|single|multiple`), `showCheckBoxesMode`, `selectAllMode`
(`page|allPages`), `selectedRowKeys`; navegação por setas, Tab entre
elementos internos, Ctrl+A. AG Grid: `rowSelection`, foco de célula.

## Escopo — teclado (célula focada, *roving tabindex*)
| Tecla | Ação |
|---|---|
| ←/→/↑/↓ | célula vizinha (←/→ invertidos em RTL) |
| Home/End | 1ª/última célula da linha; Ctrl+Home/End: do grid |
| PageUp/PageDown | uma página (virtualizador rola e mantém foco) |
| Enter / F2 | entra no conteúdo interativo da célula (ou edição, 09) |
| Esc | volta o foco à célula |
| Espaço | seleciona a linha (com seleção ligada) |
| Shift+↑/↓ / Shift+Espaço | estende a seleção |
| Ctrl+A | seleciona tudo (multiple) |
| → / ← na linha de grupo | expande / recolhe |
| Alt+Shift+←/→ no cabeçalho | move a coluna (equivalente ao arrasto) |
| Ctrl+G no cabeçalho | agrupa/desagrupa pela coluna (equivalente ao arrasto) |

## Escopo — seleção
- `selection-mode="none|single|multiple"`, `show-checkboxes` (coluna de
  caixas com "selecionar tudo" no cabeçalho, estado misto).
- `selectedKeys` (usa a chave da frente 08 ou o objeto), `selectRows()`,
  `deselectRows()`, `clearSelection()`, `getSelectedItems()`.
- Clique seleciona; Ctrl+clique alterna; Shift+clique estende.
- Seleção sobrevive a ordenação, filtro, agrupamento e troca de `items`
  (pela chave). Selecionar tudo = linhas filtradas.
- `focusedRowKey` + evento `u-grid-focus-change`.
- Eventos: `u-grid-selection-change` (`{ selectedKeys, added, removed }`).

## ARIA
`role="grid"` com `aria-multiselectable`, `aria-rowcount`/`aria-colcount`
totais (virtualização), `aria-rowindex`/`aria-colindex` reais,
`aria-selected` nas linhas, `aria-expanded` + `aria-level` nas linhas de
grupo (`role="row"` com `aria-level` = nível + 1), `aria-sort` (03),
foco visível com `:focus-visible` e `--u-grid-focus-ring-*`. Arrasto de
coluna/grupo com alternativa de teclado (WCAG 2.1.1 e 2.5.7).

## i18n
`selectRow`, `selectAll`, `groupExpanded`, `groupCollapsed`,
`columnMovedAnnouncement`, `groupedByAnnouncement`.

## Fora de escopo
Seleção de intervalo de células (fase D).

## Arquivos
`features/keyboard.ts`, `features/selection.ts`, `render/*` (atributos ARIA),
`grid.styles.ts`, `grid-i18n.ts`.

## Testes
Navegação com virtualização (foco em linha que sai e volta da tela);
RTL; seleção por chave após ordenar/filtrar; checagem automática com
`axe-core` nos testes de navegador; roteiro manual com NVDA (Windows).

## Critério de pronto
Zero violações do axe; percorrer, agrupar, reordenar e selecionar sem mouse.

## Referência medida
(preencher)
