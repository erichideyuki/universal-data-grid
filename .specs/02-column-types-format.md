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
| `booleanDisplay` | `'text' \| 'icon'` | `text` (aprovado pelo usuário depois da 1ª entrega) |

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
DevExtreme DataGrid 26.1.5 (grid criado na página da demo, 2026-11-17):
- `dataType` inferido do 1º valor não nulo (coluna com `null` na 1ª linha e
  número na 2ª vira `number`). `Date` → `date`; string ISO NÃO vira data
  (fica `string`); `dataType: 'date'` explícito aceita string ISO.
- String inválida numa coluna `date` aparece como texto bruto
  (`"not a date"`); `"2024-02-30"` vira 1/3/2024 (nós: texto bruto — data
  que "transborda" é inválida).
- Número sem `format`: valor cru, sem separador de milhar (`1000000`,
  `1234.5`, também em `de`). Nós: `Intl.NumberFormat` sem agrupamento —
  mesmo visual, mas com o separador decimal do idioma (`1234,5` em `de`);
  com `format` informado valem os padrões do `Intl` (com milhar).
- `date`: dia/mês/ano numérico com ano de 4 dígitos (`1/15/2024`,
  `15.1.2024`); `datetime`: + hora:minuto (`15.1.2024, 13:05`).
- Alinhamento: número à direita, booleano ao centro, resto à esquerda; o
  cabeçalho segue a coluna. Em RTL o DevExtreme deixa tudo à direita (inclusive
  número); nós usamos `start`/`end` lógicos, então número vai à esquerda em
  RTL (decisão da spec).
- Booleano: célula com checkbox só leitura (`null` = indeterminado); grupo
  mostra o texto (`G: true`/`G: false`). Nós: texto `trueText`/`falseText`
  na célula e no grupo; com `booleanDisplay: 'icon'`, ícone check/x só
  leitura na célula (nome acessível = `trueText`/`falseText`), grupo em texto.
- Nulo: célula vazia.
- Texto que não cabe: reticências e dica (`title`) só quando truncado
  (`cellHintEnabled`).
