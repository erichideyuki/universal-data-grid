# 12 — Exportação e área de transferência

## Objetivo
Exportar o que o usuário vê (colunas visíveis, ordem, filtro, grupos) e
copiar linhas selecionadas.

## Referência
DevExtreme: `export: { enabled, formats: ['xlsx','pdf'], allowExport
SelectedData }` com `exportDataGrid` (ExcelJS/jsPDF injetados pelo
hospedeiro), `onExporting`. AG Grid: `exportDataAsCsv` (Community),
`exportDataAsExcel` (Enterprise), Ctrl+C.

## Escopo — API (aprovada pelo usuário em 2026-11-18)

Revisada pelo `webcomponent-api-reviewer` (24 achados, todos aceitos; só
`copySelection()` fica para a frente de barra/menu).

**`<u-grid>` — métodos (assíncronos: a fonte remota da 08 e 1 milhão de
linhas em blocos sem travar a interface)**
- `getExportData(options?: GridExportOptions): Promise<GridExportData>` —
  `{ columns, rows }` para o hospedeiro gerar Excel/PDF com a biblioteca
  que quiser (a spec chamava `getExportRows`).
- `exportCsv(options?: GridCsvOptions): Promise<Blob>` e
  `downloadCsv(options?: GridCsvDownloadOptions): Promise<void>`.

**Opções**
- `GridExportOptions`: `selectedOnly` (`false`), `includeGroups` (`true`),
  `includeSummaries` (`true`), `signal?: AbortSignal` (rejeita com
  `AbortError`).
- `GridCsvOptions`: + `separator: 'auto' | (string & {})` (`'auto'`: `;`
  em idioma com vírgula decimal), `bom` (`true`), `includeHeaders`
  (`true`), `escapeFormulas` (`true`), `rawValues` (`false`: número com
  `.`, data ISO 8601, booleano `true`/`false`, vazio `''`).
- `GridCsvDownloadOptions`: + `fileName` (`'export.csv'`).

**Dados**: `GridExportData<TItem> { columns: GridExportColumn[]; rows:
GridExportRow<TItem>[] }`; `GridExportColumn { column, label, dataType?,
alignment, width? }`; linhas com `rowType`:
- `'data'`: `level`, `item`, `values: unknown[]`, `texts: string[]`;
- `'group'`: `level`, `groupPath`, `column`, `value`, `text` (valor
  formatado), `label` (`"País: Brasil (3)"`), `itemCount`,
  `summaries: GridSummaryValue[][]` (resumos `display: 'column'`),
  `texts: string[]`;
- `'group-footer'` (`groupPath`) e `'total'` (`groupPath: null`): `level`,
  `summaries`, `texts`.

`summaries[i]`/`texts[i]`/`values[i]` alinhados com `columns[i]`; vários
resumos na mesma coluna → `texts[i]` unido pelo separador de lista do
idioma, como na tela. Com `includeGroups: false`, `columns` começa pelas
agrupadas (ordem de `getGrouping()`) e todas as linhas têm `level` 0.

**Coluna**: `exportable?: boolean | null` no `GridColumnDef` e atributo
`exportable` no `<u-grid-column>` (tri-estado); padrão `true` quando a
coluna tem `path`, `valueGetter` ou `displayValue` (só `renderer` fica de
fora). Vale para exportação e área de transferência.

**Área de transferência**: `clipboardMode: 'copy' | 'none'` (atributo
`clipboard-mode`, padrão `'copy'`); evento cancelável `u-grid-copying`
`GridCopyEventDetail<TItem> { items, columns, text, html, clipboardData }`
— cancelado, o grid não escreve nem chama `preventDefault` no `copy`
nativo (o hospedeiro pode `setData` em `clipboardData`).

**Adaptador** `@universal-material/data-grid/export-xlsx` (entrada própria
no `exports` e no build; só `import type` do grid; ExcelJS injetado):
`exportXlsx(grid, ExcelJS, options?): Promise<Blob>` e
`downloadXlsx(grid, ExcelJS, options?)`; `GridXlsxOptions` =
`GridExportOptions` + `sheetName` (`'Sheet1'`), `includeHeaders` (`true`),
`customize(worksheet, workbook)` tipados pelos genéricos do módulo
injetado; `fileName` (`'export.xlsx'`) no download.

## Comportamento
- Exporta o que o usuário vê: colunas visíveis e exportáveis na ordem
  atual, filtro, ordenação, grupos e resumos. Grupos RECOLHIDOS saem
  inteiros (como o DevExtreme). Ordenação, filtro, grupos, colunas e
  seleção são lidos na chamada (instantâneo); mudanças durante os blocos
  não se misturam.
- `selectedOnly`: só as selecionadas, na ordem e filtro atuais (não na
  ordem de seleção de `getSelectedItems()`); grupos, contagens e resumos
  recalculados sobre elas (como o DevExtreme).
- CSV RFC 4180 (aspas, CRLF), BOM, cabeçalho alinhado com os dados. Linha
  de grupo: rótulo na 1ª célula; recuo por nível só em `level` e no
  outline do xlsx, nunca como colunas vazias no CSV.
- Valores: texto formatado (`displayValue`/`format`) por padrão;
  `rawValues` no CSV. O xlsx grava número/data tipados (`numFmt`
  aproximado do `format` Intl); vira texto só a coluna com `displayValue`,
  `format` em função ou `booleanDisplay`.
- Ctrl/Cmd+C (evento nativo `copy`, também do menu Editar) com o foco numa
  célula/linha do grid fora de input: com seleção → linhas selecionadas
  (igual aos `texts` de `getExportData({ selectedOnly: true, includeGroups:
  false, includeSummaries: false })`); sem seleção → a célula focada. TSV
  em `text/plain`, `<table>` escapada em `text/html` (até 10 000 linhas;
  acima, só o TSV). Sem cabeçalho. Com texto selecionado pelo mouse
  (seleção não colapsada), a cópia nativa segue. Anúncio `aria-live`.

### Revisão de acessibilidade na entrega (`a11y-reviewer`, spec 17)

Aplicado (sem mudar API): o `copy` só vale vindo de uma célula navegável
(o botão de operação da linha de filtro não copia mais a célula ativa de
antes) e copia a célula de onde veio o evento; `beforecopy` cancelado com o
mesmo critério (o WebKit só habilita Copiar sem seleção de texto assim);
seleção de texto esquecida fora do grid não bloqueia; campo editável inclui
`contenteditable` e widgets ARIA editáveis dentro da célula, em shadow roots
aninhados; README com Ctrl+C na tabela de teclado, o que não copia e o
anúncio a cargo do hospedeiro quando ele cancela. Testes desses casos.

Pendente (muda o `detail.html` do `u-grid-copying`, decisão do usuário):
`<table dir="rtl" lang="ar">` no HTML copiado com o grid em RTL; trocar o
`'` visível no HTML por `mso-number-format:'\@'` (decisão de segurança —
conferir antes se o Excel não avalia `=` assim). Não testado em WebKit/
Firefox (o Vitest do projeto só roda Chromium).

## Segurança
**Injeção de fórmula** (OWASP CSV Injection): texto que começa com `=`,
`+`, `-`, `@`, tab ou CR recebe prefixo `'` (`escapeFormulas: true` no
CSV; sempre na área de transferência, que o Excel avalia ao colar). Isento:
valor `number`/`bigint`/`Date` com formatação embutida (sem `displayValue`
nem `format` em função) e texto que é número puro (`-5`, `-1.234,5`,
`-$5.00`). No xlsx as strings são células de texto (nunca fórmula), então
não recebem prefixo. No `text/html`, tudo escapado.

## i18n
`rowsCopiedAnnouncement` ("Copied rows: {count}") e
`cellCopiedAnnouncement` ("Cell copied"), nos 14 idiomas. As chaves
`exportCsv`/`exportExcel`/`exportSelected` ficam para a frente da barra de
ferramentas (sem UI de exportação aqui).

## Fora de escopo
PDF embutido (o hospedeiro usa `getExportData`), impressão, botões de
exportar (barra de ferramentas, Fase D), `copySelection()` por API.

## Arquivos
`export/csv.ts`, `export/rows.ts`, `export/slice.ts`,
`features/clipboard.ts`, `export-xlsx/index.ts` (entrada separada no build).

## Testes
Escapes do CSV; injeção de fórmula; grupos e resumos; idioma pt (`;`);
Ctrl+C com HTML escapado.

## Referência medida

DevExtreme 26.1.6, demo "DataGrid › Export to Excel › Overview"
(`exportDataGrid` com ExcelJS), medida em 2026-11-18 chamando o exportador
no console com grupo por `State`, resumo de grupo `count` (na linha do
grupo) e `max` no rodapé do grupo, total `count`, coluna movida, grupo
recolhido, seleção e valores `=1+1`, `-5`, `@x`:

- 1ª linha: rótulos das colunas visíveis na ordem atual (a agrupada sai das
  colunas).
- Linha de grupo: só o texto do grupo na 1ª célula (mesclada),
  `"State: Arkansas (Count: 2)"`; nível de outline 0; linhas de dados com
  outline 1 (um a mais por nível).
- Grupo RECOLHIDO sai inteiro (filhos incluídos) — exporta os dados, não a
  janela de linhas.
- Rodapé de grupo: linha com o texto do resumo sob a coluna dele
  (`"Max: 3/24/2008"`); totais numa última linha, sob as colunas.
- `selectedRowsOnly`: grupos, contagens e resumos RECALCULADOS sobre as
  selecionadas (`"California (Count: 1)"`, total `Count: 2`).
- Datas saem tipadas (`Date` + `numFmt` `M/d/yyyy`); texto sai como texto.
- Sem proteção contra fórmula: `=1+1`, `-5`, `@x` saem iguais (no xlsx são
  células de texto, então não executam; no CSV executariam). Nós protegemos
  por padrão (seção Segurança).

### Nossa medida (perfil de máquina fraca, spec 16 — cenário `export-1m`)

1 milhão de linhas × 8 colunas (`npm run test:perf`, linha de base gravada
com `=1` e `=max` no commit da frente): maior fatia de trabalho sem ceder
a vez ≈ 22–31 ms no CSV plano, 34 ms no agrupado com totais e 29–45 ms no
`getExportData` (1 milhão de objetos de linha: pausas de GC) — orçamento
50 ms (nenhuma tarefa longa); exportação inteira 8–12 s (orçamento 20 s);
Ctrl+C de 10 mil selecionadas 135–210 ms (síncrono: o `copy` nativo só
aceita `setData` durante o evento). Fatias de 6 ms de relógio,
`scheduler.yield()` quando existe; cada fatia vira um `Blob` na hora
(juntar 64 de uma vez codificava ~20 MB num só passo: fatia de 60 ms).

Conferido à mão contra o exceljs 4 real (fora do repositório): os tipos do
módulo passam no `ExcelJSModule` e o `customize` recebe os tipos reais; o
arquivo gerado lido de volta tem outline, mesclagem do rótulo do grupo,
datas e números tipados com `numFmt` e `=1+1` como texto.
