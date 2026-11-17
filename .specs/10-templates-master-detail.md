# 10 — Templates e master-detail

## Objetivo
Personalizar cabeçalho, linha de grupo, estado vazio e linha de detalhe, e
dar ao `renderer` de célula um contrato sólido.

## Referência
DevExtreme: `cellTemplate`, `headerCellTemplate`, `groupCellTemplate`,
`dataRowTemplate`, `noDataText`/template, `masterDetail: { enabled,
autoExpandAll, template }`. AG Grid: `cellRenderer`, `headerComponent`,
`detailCellRenderer`, `fullWidthCellRenderer`.

## Decisão a tomar com o usuário (início da frente)
Hoje o `renderer` devolve `HTMLElement` que é posto no LIGHT DOM do `<u-grid>`
e projetado por slot (vantagem: estilos da página valem; desvantagem: o grid
injeta filhos no elemento — React/Vue podem removê-los ao reconciliar — e cada
célula custa um slot). Opções:
1. Manter light DOM + slot, com nomes estáveis por chave (já corrigido na 01).
2. Aceitar também `TemplateResult` do Lit e `string`, renderizados direto no
   shadow DOM da célula (rápido; estilo por `::part` ou `adoptedStyleSheets`).
3. As duas, com `renderer` devolvendo qualquer uma.
Recomendação: (3), com `TemplateResult` como caminho principal.

## Escopo — API
- Coluna: `renderer(ctx)`, `headerRenderer(ctx)`, `groupRenderer(ctx)`;
  `ctx = { item, value, displayValue, column, rowKey, rowIndex, grid }`.
- Grid: `noDataRenderer()`, `masterDetail: { enabled; autoExpandAll;
  renderer(ctx) }`, métodos `expandRow(key)`, `collapseRow(key)`.
- Retorno aceito: `HTMLElement | TemplateResult | string`.

## Comportamento
- Renderer chamado de novo quando o item ou a coluna mudam (nunca reaproveita
  conteúdo de outra linha). Elementos devolvidos podem ser reaproveitados pelo
  hospedeiro (o grid só os move).
- Master-detail: coluna de expansão (chevron), linha de detalhe de largura
  total com altura medida (`virtualizer.measureElement`) — exige altura
  variável no virtualizador.
- Detalhe aninhado (grid dentro do detalhe) funciona, com teclado isolado.

## Acessibilidade
Linha de detalhe com `aria-labelledby` da linha mestre; chevron é
`<button aria-expanded>`.

## i18n
`expandRow`, `collapseRow`.

## Fora de escopo
`rowRenderer` de linha inteira (fase D).

## Arquivos
`render/cell.ts`, `grid-custom-cell.ts` (ou remoção), `features/master-
detail.ts`, `render/header.ts`, `render/group-row.ts`.

## Testes
Renderer correto após expandir grupo / ordenar / rolar; detalhe com altura
variável e rolagem estável; grid aninhado.

## Referência medida
(preencher)
