# 13 — Cabeçalho em bandas e virtualização de colunas

## Objetivo
Cabeçalhos multinível e grids largos (centenas de colunas) sem perder
desempenho.

## Referência
DevExtreme: `columns[].columns` (bandas), `isBand`, `ownerBand`;
`scrolling.columnRenderingMode: 'virtual'`. AG Grid: column groups
(`children`, `marryChildren`), column virtualisation por padrão.

## Escopo — API
- `GridColumnDef.children?: GridColumnDef[]` (banda); `<u-grid-column>`
  aninhado faz o mesmo no modo declarativo.
- `column-virtualization="auto|on|off"` (`auto` liga acima de 50 colunas).

## Comportamento
- Cabeçalho com uma linha por nível; banda com `colspan` calculado; arrastar
  uma coluna só reordena dentro da própria banda; arrastar a banda move o
  bloco.
- Fixar uma banda fixa os filhos (06); ocultar todos os filhos oculta a
  banda.
- Virtualização horizontal: `@tanstack/virtual-core` no eixo X com as
  larguras conhecidas (06); colunas fixas sempre renderizadas.
- `<colgroup>` e `aria-colindex` coerentes com as colunas ausentes do DOM.

## Acessibilidade
Banda com `role="columnheader"` e `aria-colspan`; `aria-colcount` total.

## Fora de escopo
Bandas no painel de grupos (só colunas folha agrupam).

## Arquivos
`render/header.ts`, `row-model/columns.ts` (achatamento das bandas),
`features/column-virtualizer.ts`.

## Testes
`colspan` com coluna oculta; reordenar dentro da banda; 300 colunas × 100 mil
linhas rolando nos dois eixos.

## Referência medida
(preencher)
