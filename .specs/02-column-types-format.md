# 02 — Tipos de dado e formatação

## Objetivo
Coluna saber o TIPO do dado e exibi-lo formatado no idioma do grid, base para
ordenação (03), filtro (04), resumos (07), edição (09) e exportação (12).

## Referência
DevExtreme: `column.dataType` (`string|number|date|datetime|boolean|object`),
`format`, `alignment`, `calculateCellValue`, `calculateDisplayValue`,
`customizeText`, `trueText`/`falseText`, `wordWrapEnabled`, `encodeHtml`.
AG Grid: `cellDataType`, `valueGetter`, `valueFormatter`.

## Escopo — API (`GridColumnDef` e `<u-grid-column>`)
| Propriedade | Tipo | Padrão |
|---|---|---|
| `dataType` | `'string' \| 'number' \| 'date' \| 'datetime' \| 'boolean'` | inferido do 1º valor não nulo |
| `format` | `Intl.NumberFormatOptions \| Intl.DateTimeFormatOptions \| ((value, item) => string)` | por tipo |
| `alignment` | `'start' \| 'center' \| 'end'` | `end` para número, `center` para booleano, `start` resto |
| `valueGetter` | `(item) => unknown` | lê `path` |
| `displayValue` | `(value, item) => string` | aplica `format` |
| `wrap` | `boolean` | `false` (reticências com `title`) |
| `minWidth` | `number` | — |

- `format` usa `Intl.*` com o idioma efetivo do grid (o mesmo do i18n);
  formatadores em cache por `(language, options)`.
- Data: aceita `Date`, número (epoch) e string ISO; string inválida exibe o
  texto bruto, não `Invalid Date`.
- Booleano: textos `true`/`false` na tabela i18n (`trueText`, `falseText`)
  e opção de mostrar como ícone de check (só leitura).
- `valueGetter` é o valor usado por ordenar/filtrar/agrupar/resumir;
  `displayValue` é só exibição (e o texto do grupo).
- Valor nulo: célula vazia; texto configurável `emptyText` por coluna.

## Acessibilidade
Célula numérica com `text-align: end`, mas leitura natural (sem ícones
falados). Texto truncado ganha `title` com o valor completo.

## i18n
Novas chaves: `trueText`, `falseText` nos 14 idiomas.

## Fora de escopo
Máscaras de edição (09), moeda por linha, formatação condicional (fase D).

## Arquivos
`grid-column-def.ts`, `grid-column.ts`, `row-model/value.ts`,
`row-model/format.ts` (novo), `render/cell.ts`, `grid-i18n.ts`.

## Testes
Inferência de tipo; formatação em `en`/`pt`/`de`/`ar`; datas ISO e
inválidas; `valueGetter` usado no agrupamento; alinhamento em RTL (`end` vai
para a esquerda).

## Critério de pronto
Demo com colunas de número, data e booleano formatadas trocando o idioma ao
vivo.

## Referência medida
(preencher)
