# 12 — Exportação e área de transferência

## Objetivo
Exportar o que o usuário vê (colunas visíveis, ordem, filtro, grupos) e
copiar linhas selecionadas.

## Referência
DevExtreme: `export: { enabled, formats: ['xlsx','pdf'], allowExport
SelectedData }` com `exportDataGrid` (ExcelJS/jsPDF injetados pelo
hospedeiro), `onExporting`. AG Grid: `exportDataAsCsv` (Community),
`exportDataAsExcel` (Enterprise), Ctrl+C.

## Escopo — API
- `exportCsv({ fileName, selectedOnly, separator, includeGroups,
  bom: true }): Blob` e `downloadCsv(...)`.
- `getExportRows()` (linhas já formatadas, com nível de grupo e resumos) —
  base para o hospedeiro gerar Excel/PDF com a biblioteca que quiser.
- Adaptador opcional, fora do bundle principal:
  `@universal-material/data-grid/export-xlsx` (`exportXlsx(grid, ExcelJS)`,
  ExcelJS injetado — o grid não depende dele).
- Ctrl+C com seleção: TSV no `text/plain` e tabela no `text/html`.

## Comportamento
- CSV RFC 4180 (aspas, quebras de linha), BOM para o Excel abrir UTF-8,
  separador `;` quando o idioma usa vírgula decimal (opcional `auto`).
- Valores exportados: `displayValue` (formatado) por padrão, `raw` opcional.

## Segurança
**Injeção de fórmula em CSV/planilha**: célula que começa com `=`, `+`, `-`,
`@`, tab ou CR recebe prefixo `'` (OWASP CSV Injection), ligado por padrão
(`escapeFormulas: true`). No `text/html` do Ctrl+C, valores escapados.

## i18n
`exportCsv`, `exportExcel`, `exportSelected`, `copied`.

## Fora de escopo
PDF embutido (o hospedeiro usa `getExportRows`), impressão.

## Arquivos
`export/csv.ts`, `export/rows.ts`, `features/clipboard.ts`,
`export-xlsx/index.ts` (entrada separada no build).

## Testes
Escapes do CSV; injeção de fórmula; grupos e resumos; idioma pt (`;`);
Ctrl+C com HTML escapado.

## Referência medida
(preencher)
