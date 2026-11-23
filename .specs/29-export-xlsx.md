# 29 — Exportação em Excel (xlsx) pelo escritor do Universal Office

Estado: **aprovada** pelo usuário (2026-11-23), depois de 2 rodadas de
revisão (API e a11y). Implementação aguarda o crate `uo-xlsx`.

## Objetivo
Exportar para xlsx o que o usuário vê (colunas visíveis na ordem atual,
filtro, ordenação, grupos, resumos, bandas), sem dependência injetada
(hoje o adaptador exige o ExcelJS, ~1 MB), sem travar a página com volume
(5–10 mil linhas × 40 colunas folgado) e com estilo por célula (mapa de
calor do pivô do clickCompliance). Bundles autocontidos para quem carrega o
grid de `/vendor` ou de CDN.

## Referência
- **DevExtreme**: `exportDataGrid({ component, worksheet, customizeCell })`
  com o ExcelJS injetado; `customizeCell({ gridCell, excelCell })` por
  célula; cabeçalho de banda mesclado; sem worker.
- **AG Grid** (Enterprise): escritor xlsx próprio, sem dependência; estilo
  por `excelStyles` + classes; congela e mescla.
- **SheetJS Community**: não grava estilos (só o Pro) — descartado.
- Medido no nosso código (0.3.8): o adaptador ExcelJS tem 4,7 KB
  minificado; coleta em fatias, escrita síncrona; datas pelo horário de
  parede (sem fuso); totais, grupos (outline) e rodapés saem; bandas não;
  sem congelar.

## Decisões do usuário (2026-11-23)
1. **Motor**: o escritor de xlsx é do Universal Office — crate `uo-xlsx`
   (branch `rust-core`, sobre `uo-opc` — zip, deflate, XML, OPC — e
   `uo-numfmt`), adiantando a "track C" da migração do Sheet. O grid o usa
   como dependência Rust (git `rev` fixo, como o `grid-pdf` usa o
   `uo-fonts`) num crate fino, `grid-xlsx`: só traduz as linhas e estilos
   da exportação para o `uo-xlsx` e o expõe ao worker em WASM.
   Dependência por pacote npm do Universal Office foi considerada e
   descartada por ora (o `uo-wasm` publicado é um wasm único do núcleo
   inteiro; acoplaria as versões; mais um pacote para o hospedeiro servir);
   volta à mesa se o Universal Office publicar um wasm só de xlsx que os
   apps já carreguem.
2. **Esperar o motor**: a API nova sai junto com ele, não antes sobre o
   ExcelJS.

## API (revisada)
Entrada `@universal-material/data-grid/export-xlsx` (a mesma de hoje).

**Funções** — sobrecargas, sem nome novo (o objeto com `Workbook` separa):
- `exportXlsx(grid, options?: GridXlsxOptions)` → `Promise<Blob>`;
  `downloadXlsx(grid, options?: GridXlsxDownloadOptions)`;
  `createXlsxExporter(options?)` → `GridExporter` (barra e menu).
- As formas com o ExcelJS no 1º argumento continuam, `@deprecated`, com
  SÓ as opções de hoje (`GridXlsxExcelJSOptions<Wb, Ws>`: `sheetName`,
  `includeHeaders`, `customize(worksheet, workbook)`; sem bandas, sem
  congelar, sem `customizeCell`) e um `console.warn` uma vez por módulo.
  Os 2 parâmetros genéricos de `GridXlsxOptions<Wb, Ws>` ficam
  `@deprecated`, com padrão e sem uso (código que os escreve compila).

**`GridXlsxOptions extends GridExportOptions`** (`selectedOnly`,
`includeGroups`, `includeSummaries`, `includeFixedRows`, `signal`):
- `sheetName` — padrão: o nome acessível do grid (a mesma fonte do título
  do PDF), senão o texto da i18n (`pdfDefaultTitle`); sempre limpo
  (`[]:*?/\` fora, 31 caracteres, nunca `History`), também quando vem do
  hospedeiro. `title` (metadado) com o mesmo padrão.
- `includeHeaders` (padrão `true`).
- `includeBands` (padrão `true`): linhas de banda acima das folhas, SEM
  mesclar — rótulo na 1ª coluna da banda com "centralizar na seleção"
  (`centerContinuous`). Mudança visível nas notas (as linhas descem).
- `freezeHeader` (padrão `true`): congela TODAS as linhas de cabeçalho
  (bandas + folhas). Mudança visível nas notas.
- `direction?: 'ltr' | 'rtl'` — padrão: a do grid; `rtl` grava a aba da
  direita para a esquerda; `start`/`end` seguem a direção.
- `customizeCell?: (cell: GridXlsxCell) => void` — síncrono, mesmo nome do
  PDF; chamado para cabeçalho, banda, dado, grupo, rodapé de grupo e total,
  depois de o adaptador decidir valor, formato e estilo.
- `onProgress?: (progress: GridExportProgress) => void` (`pageCount`
  sempre 0).
- `worker?: boolean | (() => Worker)` (a fábrica é chamada uma vez) e
  `assetsUrl?: string | URL`, como no PDF.
- `GridXlsxDownloadOptions` acrescenta `fileName` (padrão `export.xlsx`).

**`GridXlsxCell<TItem>`**:
- `readonly rowType` (`'header'` inclui as bandas), `readonly row`
  (`null` no cabeçalho), `readonly column` (a banda, na célula de banda;
  `null` no rótulo de grupo), `readonly columnIndex` (1ª folha na banda;
  `-1` no rótulo de grupo), `readonly columnSpan`, `readonly headerRow`
  (0 = linha de cima), `readonly value` (o dado de origem).
- Editáveis: `cellValue: string | number | boolean | Date | null` (string =
  célula de texto, nunca fórmula); `text` (acessor: ler dá o texto exibido;
  escrever faz `cellValue = text` e `numFmt = null`); `numFmt: string |
  null`; `style: GridXlsxCellStyle`; `link?: GridPdfLink` (hiperlink
  nativo). Vale a última escrita, sem regra oculta.

**Estilo comum** — `GridExportCellStyle` em `src/export/types.ts` (`bold`,
`italic`, `color`, `backgroundColor`, `alignment`), o mesmo objeto nos
dois formatos; `GridPdfCellStyle` vira alias. `GridXlsxCellStyle extends
GridExportCellStyle { wrap?: boolean; border?: boolean | GridXlsxBorder }`
(`GridXlsxBorder`: `{ color?, style?: 'thin' | 'medium' }` por lado ou
todos). Contraste < 4,5:1 com a mesma regra do PDF (aviso).

**Estrutura** — grupos com `outlineLevel` e rótulo em texto ("Campo: valor
(n)"), não só negrito, sem mesclar (`centerContinuous`); linhas fixas
saem (`includeFixedRows`), não congeladas; nenhuma linha em branco entre
o cabeçalho e os dados; larguras pelas do grid.

## Distribuição
- `dist/export-xlsx.min.js` e `dist/export-pdf.min.js` autocontidos (só a
  API pública do grid em runtime; conferir no metafile que não arrastam
  `lit`/`@lit/context`), subpaths `./export-xlsx.min.js` e
  `./export-pdf.min.js`, sem `types` e fora do CEM; o `worker.js` de cada
  um empacotado (um arquivo) ao lado do `.wasm`, servindo ao ESM e ao min.
- CDN: Worker de outra origem é bloqueado — documentar a fábrica
  `worker: () => new Worker(URL.createObjectURL(new Blob([`import
  '<cdn>/export-xlsx/worker.js'`], { type: 'text/javascript' })), { type:
  'module' })`. Tabela de CDN no API.md (mesma versão do `grid.min.js`).
- CSP: `worker-src 'self'` (ou `blob:` com a fábrica), `script-src
  'wasm-unsafe-eval'`, `connect-src` (o `.wasm` e as fontes), `.wasm` como
  `application/wasm` (senão compila depois de baixar).

## Acessibilidade
- Cor nunca sozinha: doc e exemplo gravam o estado como texto da célula; o
  JSDoc do `customizeCell` diz isso; contraste ≥ 4,5:1 (aviso igual ao PDF).
- Sem `mergeCells` por padrão (verificador do Office): bandas e grupos com
  `centerContinuous`.
- Títulos: nome definido com prefixo `ColumnTitle` (convenção do JAWS) no
  início da linha de folhas, sempre; títulos de impressão = todas as linhas
  de cabeçalho.
- Documento: `dc:language` = idioma efetivo do grid; `rightToLeft` na aba
  em RTL; título e nome de aba significativos (nunca `Sheet1`).
- Fluxo da interface: o mesmo da spec 26 — o item do formato ocupado vira
  "Cancelar exportação" (`exportCancel`), operável por teclado; progresso
  no `aria-describedby`, sem anúncio intermediário; "Exportando…" só
  depois de 1 s; `exportCanceledAnnouncement`; foco no disparador;
  `exportCompleteAnnouncement` com `{format}` = "Excel".

## Testes (critério de pronto)
- Rust (`uo-xlsx`, `grid-xlsx`): o xlsx gerado abre sem reparo no Excel,
  LibreOffice e Google Sheets (validação do pacote e do XML); tipos,
  `numFmt`, estilos sem repetição, outline, congelamento, títulos.
- Navegador: sem `mergeCells` por padrão; nome `ColumnTitle`,
  `dc:language`, `rightToLeft`, títulos de impressão e nome da aba;
  `customizeCell` (mapa de calor); progresso e cancelamento; roteiro de
  teclado e axe do item "Exportar para Excel"; vazamento (worker solto).
- Perf: 10 mil × 40 sem travar (fatias/worker), cenário novo na spec 16.

## Em aberto
- Tamanho do `.wasm` (estimativa 150–300 KB) — medir no protótipo.
- Formas com o ExcelJS: remover na próxima major.
