# 29 — Exportação em Excel (xlsx) pelo escritor do Universal Office

Estado: **aprovada** pelo usuário (2026-11-23), depois de 2 rodadas de
revisão (API e a11y). **Implementada** (2026-11-23) sobre o `uo-xlsx` do
`rust-core` (`8d0d0004`); ver "Implementação".

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

## Implementação (2026-11-23)
- **Motor**: crate `xlsx/` (`grid-xlsx`, `cdylib`), `uo-xlsx` por git `rev`
  `8d0d0004`. Protocolo binário em `xlsx/src/lib.rs`: configuração (título,
  idioma, aba e nome de reserva, RTL, congelar, linhas de cabeçalho,
  níveis de outline, larguras em px → `column_width_from_px(px, 7)`) e
  blocos (estilos novos numerados pelo JS + linhas). O nome `ColumnTitle`
  (escopo da aba) fica na 1ª célula da linha das folhas; títulos de
  impressão = 1..linhas de cabeçalho; `summary_above` (o botão do outline na
  linha de grupo, como o DevExtreme); formato que o Excel recusa cai para o
  Geral. `npm run build:xlsx` / `test:xlsx-engine`; CI testa e compila.
- **`.wasm`**: 230.061 bytes, 95.968 gzip -9 (perfil `opt-level = 3` do
  `grid-pdf`). Dentro da estimativa.
- **JS** (`src/export-xlsx/`): `index.ts` (API, decisão de valor/formato/
  estilo, `customizeCell`, serialização em fatias de 4 ms com o relógio
  lido a cada 256 células com `customizeCell`, blocos de 500 linhas, um em
  voo), `client.ts` (worker ou thread principal, blocos de 100 linhas com
  cessão de vez entre eles), `worker.ts`, `engine.ts`, `legacy.ts` (formas
  com o ExcelJS, obsoletas, aviso uma vez por módulo), `types.ts`.
  `_exportStream` ganhou `maxLevel` (o outline é declarado antes das
  linhas). Bandas por `_bandChainOf`. Compartilhado com o PDF:
  `export/wasm.ts` (compilar o `.wasm`), `export/serialize.ts` (`Writer`,
  cores, contraste) e `GridExportCellStyle`.
- **Decisões de detalhe** (dentro da spec): borda por lado é
  `GridXlsxBorderSides` `{ top?, bottom?, start?, end? }` (start/end pela
  direção, como o alinhamento; misturar com `color`/`style` avisa); a
  célula que abrange várias (banda, rótulo de grupo) passa UMA vez pelo
  `customizeCell` e as cobertas, vazias, levam o estilo final dela;
  `assetsUrl` é uma pasta relativa à página (a `/` final que faltar é
  posta; vale também para o PDF); `alignment: 'center'` numa célula que
  abrange várias (banda, rótulo de grupo) vira `centerContinuous`; o
  `customize` obsoleto continua tipado em `GridXlsxOptions` (é o único uso
  dos genéricos obsoletos) e, sem ExcelJS, é ignorado com aviso; links só
  `http:`, `https:`, `mailto:` (o `GridPdfLink`); o estilo padrão é
  cabeçalho e bandas em negrito com fundo `#e6e6e6`, grupo em negrito,
  total em negrito.
- **Bundles**: `scripts/bundle-exports.mjs` — `worker.js` de cada formato
  num arquivo (no `build`) e `dist/export-{xlsx,pdf}.min.js` (no
  `bundle:browser`, assets em `./export-*/` por `__U_GRID_ASSETS__`);
  falha se o metafile tiver `lit`/`@lit/*`. Para isso o PDF sem grid
  (`exportPdf(data)`) lê as traduções pela ponte
  `Symbol.for('u-grid-resolve-translation')` que o `grid-i18n.ts` registra
  (inglês sem o grid carregado) — antes importava a tabela e o
  @lit/context.
- **Testes**: Rust (`xlsx/tests/engine.rs`, lido de volta pelo `uo-opc`);
  navegador `src/export-xlsx.browser.test.ts` (zip aberto por
  `src/test/unzip.ts`) e `src/export-xlsx.memory.browser.test.ts`; perf
  `xlsx-10k` (spec 16).

- **Revisão na entrega** (API e a11y, 2026-11-23): corrigidos o rótulo de
  grupo com `customizeCell` (as cobertas perdiam o "centralizar na
  seleção"), o nome `GridXlsxBorderSides`, o aviso das opções novas na
  forma com o ExcelJS, o `assetsUrl` relativo, a fábrica de worker do
  exemplo de CDN (uma Blob URL só, sem vazar), JSDoc/doc (contraste também
  tira o fundo; `text` não acompanha `cellValue`; só `center` atravessa) e
  testes (anúncio de 1 s, exportador real pelo teclado com cancelamento e
  worker encerrado, RTL com `dc:language`/start/end/bordas, ramos do
  contraste, axe com o menu aberto em `ar`). Ficaram para o usuário (mudam
  o contrato aprovado ou o padrão visível) — ver "Em aberto".

## Decisões do usuário depois da entrega (2026-11-23)
Aceitas as 8 recomendações da revisão na entrega (mudam a API aprovada
acima; valem sobre ela):
1. **Rótulo da banda** segue o `alignment` da banda (padrão `start`, como
   na tela); `center` centraliza na seleção (`centerContinuous`) — antes
   era sempre centralizado.
2. **`GridXlsxCell.column`** é sempre o `GridExportColumn` (na célula de
   banda, a 1ª folha; paridade com o PDF) + `readonly band: GridColumnDef
   | null` (a banda; `null` fora dela).
3. **`GridExportLink`** comum em `src/export/types.ts` (`GridPdfLink` vira
   alias); no xlsx o `description` é ignorado até o `uo-xlsx` gravar a
   dica do link.
4. **`language`** em `GridXlsxOptions`, como no PDF (padrão: o idioma do
   grid): `dc:language` e os formatos de número e data.
5. **Chave i18n `exportDefaultTitle`** no lugar de `pdfDefaultTitle` (14
   idiomas); `pdfDefaultTitle` continua aceita no `setGridTranslation`,
   obsoleta (aviso uma vez por página), como as outras chaves renomeadas.
6. **Link com a cor de link** do Excel (`#0563c1`, contraste conferido)
   sem cor do hospedeiro; o sublinhado espera o `uo-xlsx` ter sublinhado.
7. **Texto branco** antes de descartar um fundo escuro que reprova o
   contraste com o preto (com texto branco ou preto sempre passa: só um
   fundo inválido cai).
8. **Colunas `fixed: 'start'`** congeladas (divisão de colunas, sempre,
   independente de `freezeHeader`) e lidas como títulos de linha
   (convenção do JAWS): com cabeçalho, um nome só, `Title`, na 1ª célula da
   linha das folhas (títulos de coluna e de linha a partir dele; o
   `ColumnTitle` "sempre" da seção Acessibilidade vale só sem colunas
   fixas); sem cabeçalho, `RowTitle` em A1. O link sem cor (ou com a do
   hospedeiro reprovada) usa a cor de link, ou `#9dc3e6` num fundo escuro. Títulos de impressão por coluna esperam o `uo-xlsx` (ele só
   grava os de linha e recusa nomes `_xlnm.`). Protocolo do motor: versão 2
   da configuração (+ `u16` de colunas fixas).

Da conferência no Excel 365 (COM + PDF) das amostras: células de dados
tipadas (número, data, booleano) numa coluna `start` ganham alinhamento
explícito ao início, como na tela (o "Geral" do Excel as punha à direita).
Ficam para o `uo-xlsx`: `quotePrefix` no texto que parece fórmula (editar
a célula a converteria), configuração de página (ajustar à largura).

## Em aberto
- Abrir os arquivos no LibreOffice e no Google Sheets (o autor do
  `uo-xlsx` validou só no Excel 365) — conferência manual.
- Formas com o ExcelJS: remover na próxima major.
