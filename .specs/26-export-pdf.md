# 26 — Exportação em PDF

## Objetivo
Exportar para PDF o que o usuário vê no grid (colunas visíveis na ordem
atual, filtro, ordenação, grupos, resumos), **acessível em primeiro lugar**
(PDF marcado, alvo PDF/UA-1), com qualquer idioma embutido (árabe RTL, CJK,
devanágari, tailandês…), sem travar a interface e com volume grande (100 mil
linhas folgado; 1 milhão com progresso e cancelamento), sem dependência nova
no pacote principal.

## Referência
- **DevExtreme 26.1** (medido): `pdfExporter.exportDataGrid({ jsPDFDocument,
  component, customizeCell, customDrawCell, onRowExporting })`, jsPDF
  injetado. Tabela com bordas, grupo em linha mesclada, cabeçalho repetido.
  PDF SEM marcação, sem idioma, sem título, fontes padrão não embutidas.
  Templates (`cellTemplate`, `dataRowTemplate`…) não são exportados: o
  hospedeiro recria com `customizeCell`/`customDrawCell` (imagem pela demo
  oficial). Grade larga: espreme tudo e corta o texto com "…".
- **Syncfusion**: `pdfExport()` e `pdfQueryCellInfo` (texto, estilo,
  `image` base64, `hyperLink`); exportação no servidor para volume.
- **Wijmo**: `FlexGridPdfConverter` com `formatItem` por célula, estilos
  fixos (`cellStyle`, `groupCellStyle`, `headerCellStyle`), Web Worker
  (`PdfWebWorkerClient`, demo de 100 mil linhas / 3.500 páginas), progresso
  e cancelamento.
- **Kendo**: PDF a partir do DOM (templates saem, mas trava com volume,
  ~0,2 s/página; não marcado). **AG Grid**: sem PDF (impressão; "não
  imprima muitos dados"). **MUI X**: impressão do navegador em iframe.

## Decisões de escopo (com o usuário, 2026-11-18/19)
1. **Motor**: gerador PRÓPRIO em Rust compilado para WebAssembly, com
   escritor de PDF próprio e o `uo-fonts` (fontes, subset) do Universal
   Office (branch `rust-core`, MIT, mesmo autor), com shaping `rustybuzz`
   (porta do HarfBuzz) e bidi `unicode-bidi` (UAX #9). Descartados, com
   medida (seção "Referência medida"): impressão do navegador em iframe
   (falha acima de ~30 mil linhas, 66 MB em 30 mil), jsPDF/pdfmake/pdf-lib
   (sem marcação), PDFKit (marca, mas inverte o árabe e trava a tela),
   office-converter/motor Word do UO (sem marcação, corta a tabela, quebra
   com 100 mil linhas).
2. **Conteúdo a partir dos DADOS** (`getExportData`), não do DOM, como
   DevExtreme/Syncfusion/Wijmo: `renderer`, `rowRenderer` e
   `detailRenderer` NÃO são desenhados; o hospedeiro estiliza e anexa
   imagem/link por célula num gancho (`customizeCell`).
3. **Três modos no mesmo método**, A padrão: `table` (tabela única, grupos
   como linhas), `sections` (uma seção com título por grupo do 1º nível;
   títulos navegáveis e marcadores no PDF), `list` (lista plana, colunas
   agrupadas primeiro, listras).
4. **Colunas que não cabem na página**: a regra do auto-hide da 21
   (`hidingPriority`) contra a largura útil da página; as ocultas saem numa
   linha "Rótulo: valor" abaixo de cada linha (como a linha adaptativa). Se
   nada puder sair, as colunas são espremidas como no DevExtreme, MAS com
   quebra de linha na célula em vez de "…" (medido: o "…" apaga o texto do
   PDF, também para o leitor de tela). Aprovado.
5. **Fontes vêm do hospedeiro** (o navegador não lê arquivos de fonte do
   sistema; PDF/UA exige fonte embutida). Ordem = ordem de reserva por
   caractere. Fonte padrão empacotada: fica para depois (pedido do usuário).
6. **Entrada própria no pacote do grid** `@universal-material/data-grid/export-pdf`
   (como o `export-xlsx`), recomendada pelos revisores em vez de pacote
   separado: lê os dados em blocos e as traduções por membros internos
   (`@internal`, que somem das `.d.ts` de um pacote separado), sem
   `peerDependency` nem versões a casar. O `.wasm` (~1 MB, ~375 KB gzip) e o
   worker vão no tarball, mas o navegador só os baixa ao exportar; o bundle
   do grid não muda. Aprovado.

## API (revisada pelo `webcomponent-api-reviewer` e pelo `a11y-reviewer`)

### Entrada `@universal-material/data-grid/export-pdf`
Carrega o worker e o `.wasm` sob demanda (`new URL('./…', import.meta.url)`).

- `exportPdf(source: DataGrid | GridExportData, options): Promise<Blob>` — o
  PDF do que o usuário vê (com `DataGrid`) ou de dados prontos (Node,
  servidor; aí `language`, `direction` e `title` não têm padrão do grid).
- `downloadPdf(source, options: GridPdfDownloadOptions): Promise<void>` —
  `exportPdf` + download (`fileName`, padrão `export.pdf`).
- `createPdfExporter(options: GridPdfExporterOptions): GridExporter` —
  entrada "Exportar para PDF" da barra/menu: `grid.pdfExporter =
  createPdfExporter({ fonts })`. Valida as opções na hora (`TypeError` na
  configuração, não no clique).

Tipos exportados: `GridPdfOptions`, `GridPdfDownloadOptions` (+ `fileName`),
`GridPdfExporterOptions` (= `Omit<GridPdfDownloadOptions, 'selectedOnly' |
'signal'>`), `GridPdfFont`, `GridPdfLayout`, `GridPdfPaperSize`,
`GridPdfOrientation`, `GridPdfTheme`, `GridPdfCell`, `GridPdfCellStyle`,
`GridPdfImage`, `GridPdfLink`, `GridPdfProgress`, `GridPdfMissingGlyphError`.
Toda medida do PDF em pt.

`GridPdfOptions extends Omit<GridExportOptions, 'includeGroups'>`
(`selectedOnly`, `includeSummaries`, `includeFixedRows`, `signal`):
- `fonts: GridPdfFont[]` (obrigatório, não vazio) — `{ source: ArrayBuffer |
  Uint8Array | string | URL, weight?: 'normal' | 'bold', style?: 'normal' |
  'italic' }`; a ordem é a de reserva por caractere; sem negrito, o regular
  serve. O buffer do hospedeiro é sempre copiado, nunca transferido; fonte
  decodificada em cache limitado (`LruCache`) por exportador.
- `layout: GridPdfLayout = 'table' | 'sections' | 'list'` (padrão
  `'table'`); `'sections'` sem agrupamento cai em `'table'`; `'list'` =
  `includeGroups: false`.
- `title?: string` — metadado `Title` (exibido na barra do leitor) e título
  visível na 1ª página. Padrão: nome acessível do grid, senão a chave
  `pdfDefaultTitle` ("Data"); `trim`, vazio cai no padrão.
- `language?: string` — `/Lang`; padrão o idioma efetivo do grid; validado
  com `Intl.getCanonicalLocales` (inválido: idioma do grid + aviso).
- `direction?: 'ltr' | 'rtl'` — padrão a do grid (RTL espelha a tabela).
- `paperSize: GridPdfPaperSize = 'auto' | 'a4' | 'letter' | 'legal' | 'a3'`
  (padrão `'auto'`: `letter` para US/CA/MX/…, `a4` no resto);
  `orientation: 'auto' | 'portrait' | 'landscape'` (padrão `'auto'`).
- `autoHideColumns?: boolean` — padrão o do grid (decisão 4); `striped?:
  boolean` — padrão o `striped` do grid.
- `theme?: GridPdfTheme` — `{ fontSize?: number /* pt, padrão 8, mínimo 6 */,
  color?, headerBackgroundColor?, groupBackgroundColor?,
  stripedBackgroundColor?, summaryBackgroundColor?, lineColor? }`.
- `customizeCell?: (cell: GridPdfCell) => void` — síncrono, por célula do
  cabeçalho, dados, grupo, rodapé e total (o título e a linha adaptativa não
  passam por ele). Leitura: `rowType: GridExportRow['rowType'] | 'header'`,
  `row: GridExportRow | null` (`null` no cabeçalho), `column:
  GridExportColumn | null`, `columnIndex` (`-1` na célula mesclada do
  grupo), `value` (no cabeçalho, o rótulo). Escrita: `text`, `lang?`
  (BCP 47: o idioma do trecho — o grid não deduz idioma do script),
  `style: GridPdfCellStyle` (`bold`, `italic`, `color`, `backgroundColor`,
  `alignment?: GridColumnAlignment`), `image?: GridPdfImage = { data:
  Uint8Array, format: 'png' | 'jpeg', width, height, alt }`, `link?:
  GridPdfLink = { url, description? }` (só `http(s):`/`mailto:`).
- `includePageNumbers?: boolean` (padrão `true`) — "Página X de Y".
- `bookmarks?: boolean` — marcadores pelos grupos do 1º nível (padrão
  `true` quando há grupos, em qualquer `layout`).
- `onProgress?: (p: GridPdfProgress) => void` — `{ rowCount, totalCount,
  pageCount }` a cada ~250 ms e uma última com `rowCount === totalCount`
  antes de resolver; nenhuma depois do aborto; exceção no callback vai ao
  `console.error` sem abortar.
- `worker?: boolean | (() => Worker)` (padrão `true` quando há `Worker`) —
  uma fábrica cobre CDN/CSP (Blob URL); `false` gera na thread principal em
  fatias (Node, CSP sem `worker-src`).
- `assetsUrl?: string | URL` — onde estão `grid-pdf.wasm` e o worker
  (padrão: ao lado do módulo).

Erros (rejeição): opções inválidas → `TypeError`; falha ao carregar fonte,
`.wasm` ou worker → o erro original; exceção em `customizeCell` → rejeita e
encerra o worker; aborto → `signal.reason` (como o xlsx); **caractere sem
glifo em nenhuma fonte → `GridPdfMissingGlyphError`** (`codePoints`, blocos
Unicode), antes de gerar: nunca sai `.notdef` (quebraria o PDF/UA e o texto
para o leitor de tela). Cor de `theme`/`customizeCell` com contraste < 4.5:1
contra o fundo final da célula → aviso uma vez por combinação e a cor do
tema no lugar. Imagem sem `alt` string → ignorada com aviso; em cabeçalho ou
grupo exige `text` ou `alt` não vazio. Link sem texto acessível (`text` →
`alt` → `description`) ou com esquema não permitido → ignorado com aviso.

### `<u-grid>` (pacote principal, 1.x: nada quebra)
- `GridExportFormat` ganha `'pdf'`; `export-formats="csv xlsx pdf"`.
- `pdfExporter: GridExporter | null` (só propriedade), como o
  `xlsxExporter`; aviso de exportador ausente por formato (cita
  `createPdfExporter`).
- `cancelExport(): void` — cancela a exportação da interface em curso.
- Cancelamento (do hospedeiro, do usuário ou do worker) não é erro: sem
  `u-grid-export-error`, anúncio `exportCanceledAnnouncement`.
- `GridExporter` recebe também `onProgress` nas opções (campo novo
  opcional, as existentes seguem iguais).
- Menu de contexto: `GridContextMenuItemName` ganha `'exportSelectedPdf'`
  (no conjunto `row`); a união pode ganhar membros (como `GridExportFormat`).
- Atualizar no mesmo commit: spec 18 e README ("PDF = item do hospedeiro"),
  JSDoc de `GridExporter`, `GridExportOptions` e `exportFormats`,
  `EXPORT_FORMAT_TOKENS`, rótulo e nome do formato no anúncio de fim.

### i18n (14 idiomas)
`exportPdf` ("Export to PDF"), `exportSelectedPdf` ("Export selected rows
to PDF"), `exportCancel` ("Cancel export"), `exportCanceledAnnouncement`
("Export canceled"), `exportProgress` ("Exporting… {percent}%"),
`pdfPageNumber` ("Page {page} of {pageCount}"), `pdfDefaultTitle` ("Data"),
`pdfTotalRow` ("Total"). O separador da linha adaptativa é o
`adaptiveLabelSeparator` da 21; o anúncio de fim usa
`exportCompleteAnnouncement` com `{format}` = "PDF".

## Comportamento
- **Dados**: lidos do grid em blocos de 2.000 linhas (membro interno do
  grid, sem montar 1 milhão de objetos de uma vez), `customizeCell` no
  bloco, textos serializados ao worker (cópia); o worker faz layout,
  shaping e escreve o PDF em passo único (cada célula moldada uma vez) e
  devolve os blocos do arquivo assim que ficam prontos (o PDF fica em `Blob`s
  no JS; a memória do worker não cresce com o total). `rowType` desconhecido
  (versão futura do grid) é ignorado com aviso.
- **Página**: ordem para caber: retrato → paisagem (`orientation: 'auto'`)
  → colunas ocultas pela regra da 21 (linha adaptativa) → colunas
  espremidas com quebra de texto (nunca "…", nunca abaixo de 6 pt).
- **Tabela**: cabeçalho repetido em cada página; texto quebra na célula por
  palavra (UAX #14; tailandês/lao/khmer por dicionário), palavra maior que a
  coluna quebra em limite de grafema (UAX #29), nunca no meio de um
  conjunto; linha não se divide entre páginas (linha maior que a página:
  quebra entre linhas de texto); grupos com recuo por nível e negrito
  (`table`), título de seção (`sections`) ou nada (`list`); rodapés de
  grupo e totais; números alinhados ao fim; "Página X de Y" (o Y é escrito
  no fim, num objeto compartilhado).
- **Texto**: fonte de reserva por caractere; bidi (UAX #9) por linha;
  shaping só nos trechos que precisam (árabe, índicos, tailandês, hebraico
  com sinais); latim, CJK e coreano glifo a glifo; caches de glifo, palavra
  moldada (chave = fonte exata, direção, recursos, texto: regular, negrito
  e itálico nunca se misturam) e linha, todos limitados.
- **Arquivo**: fontes com subset; compressão nível 3.
- **Cancelar**: `signal` ou `cancelExport()` abortam (worker encerrado);
  desconectar o grid aborta a exportação da interface (como hoje).

## Acessibilidade
### Do PDF (PDF/UA-1, conferido com veraPDF e pdf.js)
- Catálogo: `/MarkInfo << /Marked true /Suspects false >>`, `/Lang`,
  `/ViewerPreferences << /DisplayDocTitle true >>`, XMP com `dc:title` e
  `pdfuaid:part 1`; páginas com `/StructParents` e `/Tabs /S`;
  `ParentTree` em árvore de números balanceada (`Kids`).
- Árvore (irmãos sob `Document`):
  - `table`: `H1` (título) + `Table` › `THead` › `TR` › `TH /Scope
    /Column` (com `ID`) + `TBody` › `TR`. Linha de grupo: `TH /Scope /Row`
    com `ID`, `ColSpan` até a 1ª coluna com resumo e `TD` por coluna
    depois. `TD` com `/Headers` = [coluna, grupos ancestrais]. Rodapé de
    grupo e total: 1ª célula `TH /Scope /Row` ("Total"/rótulo do grupo);
    totais em `TFoot`.
  - `sections`: `H1` + uma `Sect` por grupo do 1º nível com `H2` e a sua
    `Table` (`THead` próprio); grupos de nível ≥ 2 como no `table`.
  - `list`: `H1` + `Table` (colunas agrupadas como colunas comuns).
  - Linha adaptativa: `TR` › `TD` com `ColSpan` e `/Headers` = [1ª célula
    da linha de dados, promovida a `TH /Scope /Row` com `ID`], contendo
    `L` › `LI` › `LBody` com "Rótulo: valor" (sem `Lbl`).
- Repetições do cabeçalho, bordas, fundos, "Página X de Y" = `Artifact
  /Type /Pagination` (o cabeçalho da 1ª ocorrência é o `THead` real).
- Texto: `ActualText` num `Span` por linha/trecho (nunca no `TD`, que
  esconderia `Link`/`Figure`) em todo trecho moldado com reordenação ou
  muitos-para-um (RTL, devanágari, tailandês, ligaduras) e em palavra
  partida pela quebra; célula que continua na página seguinte = um `Span`
  por página. `Lang` só onde o hospedeiro diz (`cell.lang`); textos da i18n
  com o `Lang` da i18n quando difere do documento. Fontes embutidas com
  `ToUnicode`; nunca `.notdef`.
- Imagem = `Figure` com `Alt` (decorativa = `Artifact`); link = `Link` com
  `OBJR` da anotação, `/Contents` com o texto visível, uma anotação por
  linha (ou `QuadPoints`), sublinhado (não só cor); `Link` › `Figure` quando
  a imagem é o link.
- Contraste ≥ 4.5:1 em todas as combinações de texto e fundo (tema e
  `customizeCell`); cabeçalho e grupo distinguidos também por negrito/recuo.
- Marcadores pelos grupos do 1º nível (`bookmarks`).
- A medir e documentar: abrir e ler o PDF de 100 mil linhas no Acrobat +
  NVDA (árvore com milhões de elementos); limite prático no README.

### Da interface (a11y da 18 reaproveitada)
- Itens "Exportar para PDF" / "… selecionadas"; durante a exportação o item
  do formato ocupado vira "Cancelar exportação" (`exportCancel`), ativável
  por teclado; o foco fica no disparador.
- O botão Exportar ganha `aria-describedby` com o progresso ("Exportando…
  40%"), lido no foco, não em região viva (sem anúncio intermediário).
- Anúncios: "Exportando…" depois de 1 s; fim "Exportado para PDF";
  cancelado `exportCanceledAnnouncement`; erro "Falha ao exportar" (a causa
  em `u-grid-export-error.detail.error` e no console).

## Fora de escopo
Desenhar templates (`renderer`, `rowRenderer`, `detailRenderer`); fonte
empacotada; PDF/A; criptografia; assinatura; cabeçalho/rodapé de página
customizado além do título e da numeração; exportação no servidor própria
(o pacote roda no Node, `worker: false`).

## Arquivos
- `pdf/` — crate Rust `grid-pdf` (layout, bidi/shaping, estrutura,
  escritor de PDF) → `src/export-pdf/grid-pdf.wasm` (versionado; `npm test`
  não precisa de Rust; `npm run build:pdf` regera); depende do `uo-fonts`
  (git, `rust-core`), `rustybuzz`, `unicode-bidi`, `unicode-linebreak`,
  `unicode-segmentation`, `miniz_oxide`, `png`. Build com `cargo` (alvo `wasm32-unknown-unknown`), fora
  do `npm test`; o `.wasm` versionado no build.
- `src/export-pdf/` — `index.ts` (API), `worker.ts`, `protocol.ts`
  (mensagens), `serialize.ts` (dados → blocos), `fonts.ts`, `engine.ts`
  (carrega o `.wasm`).
- `src/grid.ts` (formato `pdf`, `pdfExporter`, `cancelExport`, leitura em
  blocos `@internal`), `src/grid-i18n.ts`, `src/export/types.ts`,
  `src/features/context-menu.ts`, `src/attribute-converters.ts`.

## Testes
- Rust: layout (quebra por palavra e grafema, paginação, cabeçalho
  repetido, colunas ocultas, espremidas), bidi/shaping (árabe, hebraico,
  devanágari, tailandês, CJK, misturados), mesma palavra em regular,
  negrito e itálico dá glifos diferentes, árvore de estrutura de cada modo.
- Navegador: PDF lido de volta com pdf.js (texto na ordem lógica,
  `Table/TR/TH/TD`, `/Headers`, `Lang`, `Title`, `Tabs /S`, `OBJR` de link,
  `ActualText` em devanágari/tailandês, sem `.notdef`), veraPDF PDF/UA-1
  sem erros, `GridPdfMissingGlyphError`, contraste rejeitado em
  `customizeCell`, menu "Exportar para PDF", "Cancelar exportação",
  `cancelExport()`, worker encerrado, RTL; axe e roteiro de teclado do item.
- Vazamento: grid com exportação PDF removido é coletado; worker encerrado;
  cache de fontes limitado.
- Desempenho (perfil fraco): 100 mil e 1 milhão de linhas, sem tarefa
  longa > 50 ms na thread principal (worker), memória do worker estável.
- SSR: importar a entrada no Node não quebra; `worker: false` gera no Node
  a partir de `GridExportData`.
- Manual (anotado aqui): NVDA + Acrobat e JAWS no PDF de referência.

## Critério de pronto
`npm test`, `npm run test:perf`, `typecheck`, `lint` verdes; veraPDF PDF/UA-1
sem erros no PDF de referência; README; `npm pack --dry-run` com a entrada
nova; `npm audit --omit=dev` zerado; revisores na entrega.

## Decisões do usuário (2026-11-19: "Aprovo tudo")
1. Entrada `@universal-material/data-grid/export-pdf` no mesmo pacote.
2. Escritor de PDF PRÓPRIO no crate `pdf/` (objetos, xref em stream,
   object streams, estrutura marcada, links, XMP, escrita em fluxo); do
   Universal Office só o `uo-fonts` (leitura e subset de fontes), por
   dependência git do branch `rust-core` (publicado em 2026-11-19, commit
   `62b381d7`). O `uo-pdf` fica como está (feito para paridade com o motor
   TS do Word).
3. Colunas espremidas quebram a linha na célula (nunca "…").
4. veraPDF: ainda bloqueado pela permissão do ambiente; job de CI à parte.

## Pendências
- Trocar a dependência do `uo-fonts` para um commit da `main` do Universal
  Office quando a migração para o Rust acabar (pedido do usuário).
- veraPDF no ambiente/CI.
- Quebra de linha por dicionário em tailandês/lao/khmer: na 1ª versão só
  espaço e limite de grafema (o segmentador por dicionário do ICU4X custa
  ~centenas de KB no `.wasm`; medir antes de incluir).

### Achados dos revisores recusados
- Chave `exportErrorFontAnnouncement` (a11y): a causa vai no
  `detail.error` e no console; o anúncio curto continua igual aos outros
  formatos.
- Evento `u-grid-export-cancel` (API, opcional): o anúncio e a falta de
  `u-grid-export-error` bastam; entra se o hospedeiro pedir.
- `getExportDataChunks` público e `getGridTranslation` público (API): com a
  entrada no mesmo pacote, ficam internos (`@internal`).

## Referência medida

### Opções de geração (2026-11-18)
| Caminho | Marcado | Unicode/RTL | 100 mil linhas |
|---|---|---|---|
| jsPDF + autotable (258 KB gz) | não | só com fonte e sem shaping | 13 s, 138 MB, trava |
| pdfmake 0.3 (300 KB gz) | só a flag | — | 18 s, trava |
| PDFKit 0.20 (352 KB gz) | sim | inverte palavras árabes | 21 s, 84 MB, trava |
| pdf-lib + fontkit (590 KB gz) | não | — | 86 s |
| office-converter (UO, xlsx→PDF) | não | 1 fonte só; corta colunas | 12 s, 1,8 GB, trava |
| motor Word do UO (rust-core) | não | sem fonte árabe/CJK | quebra (`RangeError`) |
| impressão do Chromium (iframe) | sim | correto | falha ("Printing failed") |
| **protótipo Rust/WASM** | estrutura a fazer | correto (shaping + bidi) | ver abaixo |

Impressão do Chromium: 10 mil linhas 4,5 s/22 MB; 10 mil com linhas
customizadas 16 s/71 MB; 30 mil 44 s/66 MB; 30 mil customizadas falha.
Reticências (`text-overflow`) no PDF marcado do Chromium: o texto cortado
some (sem `ActualText`/`Alt`).

### Grade larga (18 colunas)
DevExtreme espreme e corta todo texto com "…" (também no texto do PDF);
AG Grid imprime 6 colunas e MUI 9 (o resto sai da página).

### Protótipo Rust/WASM (2026-11-19; `%TEMP%/pdf26/rust-proto`, fora do repositório)
WASM 988 KB (374 KB gzip). Chromium, `scheduler.yield()` entre fatias de
8 ms, 100 mil linhas × 6 colunas:

| Dados | CPU 1× | CPU 4× (perfil fraco) | memória do wasm |
|---|---|---|---|
| latim, 1 linha em 4 em árabe | 0,7 s | 4,0 s | 24 MB |
| scripts complexos, valores repetidos | 1,7 s | 7,8 s | 70 MB |
| scripts complexos, todos diferentes | 7,0 s | 19,1 s | 78 MB |
| 1 milhão (latim + árabe) | 6,8 s | 37 s | 24 MB |

Maior pausa da thread principal: o fechamento do arquivo (fontes), até
~0,35 s no perfil fraco — some com o worker. Linear até 1 milhão (custo
constante por página). O que levou a esses números: passo único (cada célula
moldada uma vez), texto da página escrito com string literal (2 bytes por
glifo), compressão nível 3, linhas quebradas recortadas do shaping inteiro,
bidi só com RTL, shaping só nos scripts complexos, cache por palavra, fonte
repetida embutida uma vez, páginas gravadas ao terminar, entrada em blocos.
