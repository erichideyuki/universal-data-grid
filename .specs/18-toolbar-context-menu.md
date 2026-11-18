# 18 — Barra de ferramentas e menu de contexto

## Objetivo
Barra configurável acima da tabela (itens embutidos + itens do hospedeiro,
ordem, lado e recolhimento em "mais") e um menu de contexto único para
cabeçalho, painel de grupos e linhas, com itens embutidos e um evento para o
hospedeiro mexer nos itens. O menu do cabeçalho (spec 17, A1) e o do painel
de grupos (spec 07) passam a usar o mesmo motor.

## Referência
DevExtreme: `toolbar: { items }` com itens nomeados (`groupPanel`,
`searchPanel`, `columnChooserButton`, `exportButton`, `addRowButton`,
`saveButton`, `revertButton`), `location`, `locateInMenu`, `showText`,
`template`; `export: { enabled, formats, allowExportSelectedData }` +
`onExporting`; `onContextMenuPreparing(e)` com `target`, `row`, `column`,
`items`. AG Grid: `getContextMenuItems(params)` e `MenuItemDef { name,
action, disabled, subMenu, … }`. Medido em "Referência medida".

## Escopo — API (revisada; aprovada pelo usuário em 2026-11-18)

Revisada pelo `webcomponent-api-reviewer` (24 achados) e pelo
`a11y-reviewer` (20 achados) — aceitos, exceto: método `fixColumn()`
(opcional na revisão; fica de fora, o item de menu basta).

**`<u-grid>` — propriedades**
- `toolbarItems: readonly (GridToolbarItemName | GridToolbarItem)[] | null`
  (só propriedade; padrão `null` = composição automática). Lista = ordem;
  `[]` = sem barra (o texto de status da edição continua aparecendo).
  Embutido só aparece com o recurso ligado (aviso uma vez se listado e
  desligado): `groupPanel` (`showGroupPanel`), `searchPanel`
  (`showSearchPanel`), `columnChooserButton` (`columnChooser`),
  `exportButton` (`exportFormats`), `addRowButton` (`allowAdding`),
  `saveButton`/`discardButton` (`editMode="batch"`). Substituir o array,
  não mutar; o getter devolve cópia congelada.
- `exportFormats: readonly GridExportFormat[]` ↔ `export-formats` (lista de
  palavras separadas por espaço ou vírgula, `"csv xlsx"`; padrão `[]` = sem
  exportação pela interface; token desconhecido ignorado com aviso; sem
  reflexão — exceção registrada à regra "array = `attribute: false`", como
  `page-size-options`). `GridExportFormat = 'csv' | 'xlsx'` (pode ganhar
  membros). `xlsx` sem `xlsxExporter`: aviso uma vez, entrada omitida.
- `xlsxExporter: GridExporter | null` (só propriedade) — o grid não importa
  o ExcelJS: `grid.xlsxExporter = createXlsxExporter(ExcelJS, options?)`
  (novo em `@universal-material/data-grid/export-xlsx`; `options:
  GridXlsxExporterOptions = Omit<GridXlsxDownloadOptions, 'selectedOnly' |
  'signal'>`).
- `csvExportOptions: Omit<GridCsvDownloadOptions, 'selectedOnly' |
  'signal'> | null` (só propriedade) — opções do CSV exportado pela
  interface (`fileName`, `separator`, …).
- `rowMenu` ↔ `row-menu` (`booleanAttribute(false)`): itens embutidos no
  menu das linhas. Padrão `false` (difere dos irmãos `columnHeaderMenu`/
  `groupPanelMenu`) para não trocar o menu nativo das células de quem
  atualiza. As três só ligam os itens EMBUTIDOS: o evento dispara mesmo
  assim e o hospedeiro pode pôr os seus.

**Tipos**
```ts
const GRID_DEFAULT_TOOLBAR_ITEMS: readonly GridToolbarItemName[];
// ['groupPanel', 'addRowButton', 'saveButton', 'discardButton',
//  'exportButton', 'columnChooserButton', 'searchPanel']

type GridToolbarItemName = 'groupPanel' | 'searchPanel' | 'columnChooserButton'
  | 'exportButton' | 'addRowButton' | 'saveButton' | 'discardButton';

type GridToolbarItem = GridBuiltInToolbarItem | GridHostToolbarItem;

interface GridToolbarItemOptions {
  /** Lado. Padrão: `groupPanel` 'start'; o resto 'end'. */
  location?: 'start' | 'end';
  /** Padrão: botões embutidos 'auto'; painel de grupos, busca e `renderer` sempre 'never'; botões do hospedeiro 'never'. */
  locateInMenu?: 'auto' | 'always' | 'never';
  /** 'in-menu': na barra só o ícone (o texto vira nome e dica). Padrão 'always'. */
  showText?: 'always' | 'in-menu';
  disabled?: boolean;
}
/** Configura um embutido (`text` opcional troca o rótulo). */
interface GridBuiltInToolbarItem extends GridToolbarItemOptions {
  name: GridToolbarItemName;
  text?: string;
}
/** Item do hospedeiro: botão (`text` + `action`, `icon` opcional) ou conteúdo próprio (`renderer`). */
type GridHostToolbarItem = GridToolbarItemOptions & { id?: string } & (
  | { text: string; icon?: GridRenderResult; action: (context: GridToolbarItemActionContext) => void; renderer?: never }
  | { renderer: GridToolbarItemRenderer; text?: string; icon?: never; action?: never });

interface GridToolbarItemActionContext { readonly toolbarItem: GridToolbarItem; readonly grid: DataGrid }
interface GridToolbarItemRenderContext extends GridRenderContextBase { readonly toolbarItem: GridToolbarItem }
type GridToolbarItemRenderer = (context: GridToolbarItemRenderContext) => GridRenderResult;

type GridExporter = (grid: DataGrid, options: { selectedOnly: boolean; signal: AbortSignal }) => Promise<void>;

type GridContextMenuTarget = 'header' | 'group-panel' | 'row' | 'group-row'; // pode ganhar membros

type GridContextMenuItem = {
  /** Embutido (ação do grid; `text` opcional = i18n) … */
  name?: GridContextMenuItemName;
  /** … ou do hospedeiro (`text` + `action` obrigatórios). */
  id?: string;
  text?: string;
  disabled?: boolean;
  separatorBefore?: boolean;
  action?: (context: GridContextMenuItemActionContext) => void;
};
interface GridContextMenuItemActionContext<TItem = any> {
  readonly menuItem: GridContextMenuItem;
  readonly target: GridContextMenuTarget;
  readonly cellType: GridCellType | null;
  readonly column: GridColumnDef | null;
  readonly item: TItem | null;
  readonly rowKey: unknown;
  readonly groupPath: GridGroupPath | null;
  readonly grid: DataGrid;
}

type GridContextMenuItemName =
  // cabeçalho
  | 'sortColumnAscending' | 'sortColumnDescending' | 'clearColumnSorting' | 'groupColumn'
  | 'fixColumnStart' | 'fixColumnEnd' | 'unfixColumn' | 'moveLeft' | 'moveRight'
  | 'autoSizeColumn' | 'increaseColumnWidth' | 'decreaseColumnWidth'
  // painel de grupos (+ moveLeft/moveRight do chip)
  | 'ungroupColumn' | 'ungroupAll' | 'expandAllGroups' | 'collapseAllGroups'
  // linhas
  | 'copyCell' | 'copySelectedRows' | 'exportSelectedCsv' | 'exportSelectedXlsx'
  | 'editRow' | 'editCell' | 'removeRow' | 'restoreRow' | 'expandRow' | 'collapseRow'
  // linha de grupo (+ expandAllGroups/collapseAllGroups/ungroupColumn)
  | 'expandGroup' | 'collapseGroup';
```

**Métodos**
- `copySelection(): Promise<boolean>` — igual ao Ctrl+C (linhas
  selecionadas; sem seleção, a célula ativa) pela Clipboard API; dispara
  `u-grid-copying`. `false` se cancelado sem dados, sem nada a copiar,
  `clipboardMode="none"` ou permissão negada. Precisa de ativação do
  usuário (Safari): chamar dentro do gesto.
- `openContextMenu(target: { rowKey: unknown; column?: GridColumnDef } |
  { column: GridColumnDef } | { groupPath: GridGroupPath }, anchor?:
  HTMLElement): boolean` — abre o mesmo menu (evento + embutidos), ex.: de
  um botão "⋯" num `renderer`; `false` se cancelado, vazio ou antes do 1º
  render. `closeContextMenu(): void`.

**Eventos**
- `u-grid-context-menu-opening` (cancelável) —
  `GridContextMenuOpeningEventDetail<TItem>`: os campos do
  `GridContextMenuItemActionContext` (sem `menuItem`) + `menuItems:
  GridContextMenuItem[]`, antes de abrir qualquer menu de contexto (clique
  direito, Shift+F10, tecla Menu, toque longo, "⋮", `openContextMenu`). O
  hospedeiro altera `menuItems` no próprio array durante o dispatch
  (síncrono; o grid lê logo depois; não guardar a referência). Cancelado ou
  vazio: o grid não abre e não chama `preventDefault` no `contextmenu`
  nativo. Embutido de outro alvo: ignorado com aviso; embutido que não se
  aplica não age mesmo com `disabled: false`. Exceção na `action` →
  `console.error`.
- `u-grid-exporting` (cancelável) `GridExportingEventDetail { format,
  selectedOnly }` → `u-grid-export` (mesmo detail) ou `u-grid-export-error`
  (`+ error`). Só pela interface (barra, "mais", menu da linha); os métodos
  `exportCsv`/`downloadCsv` não disparam. Outro formato (PDF) = item
  próprio do hospedeiro com `getExportData`.
- `u-grid-copying` (existente): `clipboardData` segue `DataTransfer`. Em
  `copySelection()`/menu o grid passa um `DataTransfer` próprio; não
  cancelado → grava o conteúdo dele; cancelado → grava os tipos que o
  ouvinte pôs nele (espelha o `copy` nativo). Ganha `source: 'user' |
  'api'`.

**Parts**: `toolbar`, `toolbar-button` (botões embutidos e do hospedeiro),
`toolbar-more-button`, `export-button`, `column-chooser-button`; menus com a
part comum `menu` + a própria (`row-menu`, `toolbar-menu`; mantidas
`column-header-menu`, `group-panel-menu`), `menu-item`, `menu-separator`.
Mantidas: `column-header-menu-button`, `add-row-button`, `save-button`,
`discard-button`.

**Custom properties**: `--u-grid-menu-background-color`,
`--u-grid-menu-shape`.

## Comportamento
- **Composição automática** (`toolbarItems = null`) =
  `GRID_DEFAULT_TOOLBAR_ITEMS` (ordem do DevExtreme). Muda o visual de
  hoje num ponto: o seletor de colunas passa para antes da busca (a busca
  sai do roving e fica na ponta — ver Acessibilidade).
- **Estrutura** (DOM na ordem visual; RTL só inverte as setas):
  `[part=toolbar] = [itens avulsos 'start'] [role=toolbar: painel de grupos,
  botões 'start' … status da edição … botões 'end', "mais"] [itens avulsos
  'end']`. Avulsos (fora do roving, pontos de Tab próprios): busca e itens
  com `renderer`; `location` decide em que ponta. Com menos de 2 itens no
  roving, sem `role=toolbar`.
- **Recolhimento**: itens `auto` que não cabem numa linha vão, do fim para
  o começo, para o botão "mais" (⋯) no fim do roving; `always` vai sempre.
  Painel de grupos, busca e `renderer` nunca recolhem (o painel quebra
  linha, A9). Medição no `ResizeObserver` que a barra já tem e na troca de
  itens; SSR desenha tudo, sem "mais". No "mais", as entradas de exportar
  entram achatadas com o nome completo, depois de um separador.
- **Exportar**: botão de menu com "Exportar para CSV", "Exportar para
  Excel" e, com seleção ligada, "… selecionadas" (`aria-disabled` sem
  seleção); uma entrada só = botão direto. Ocupado: `aria-disabled`,
  ativá-lo relê "Exportando…"; vale também no "mais" e no menu da linha.
  Desconectar aborta (`signal`).
- **Menu de contexto — embutidos por alvo** (só os que se aplicam):
  - `header` (`columnHeaderMenu`): ordenar crescente/decrescente/limpar
    (ordenável; "limpar" desabilitado sem ordenação), agrupar, fixar
    início/fim/desafixar (com `column-chooser`, onde o usuário já fixa;
    só o nível de cima), mover ←/→, ajustar/
    aumentar/diminuir largura.
  - `group-panel` (`groupPanelMenu`): como hoje.
  - `row` (`rowMenu`): copiar célula, copiar selecionadas (com seleção),
    exportar selecionadas (por formato), editar (`editRow` no modo linha;
    `editCell` em célula/lote, se editável), excluir/restaurar,
    mostrar/ocultar detalhe (`detailRenderer`).
  - `group-row` (`rowMenu`): expandir/recolher este grupo, expandir/
    recolher tudo, desagrupar a coluna do grupo.
  - Alvo × campos: `header` → `column` (banda incluída), resto nulo;
    `group-panel` → `column` do chip ou nulo na área vazia; `row` →
    `item`, `rowKey`, `column` e `cellType` da célula (caixa, botões,
    detalhe incluídos); `group-row` → `groupPath`, `column` agrupada.
    Linha de detalhe, rodapés de grupo/totais, linha de filtro e "sem
    dados": nenhum menu do grid.
- **Menu nativo preservado**: com texto selecionado, alvo editável
  (editor, busca, input do `renderer`) ou Ctrl+clique direito, o grid não
  abre o seu.
- **Toque longo** (500 ms, sem mover > 10 px; cancela em `pointercancel`,
  rolagem, multitoque) nas linhas, no cabeçalho e no chip, onde o navegador
  não dispara `contextmenu` (iOS); engole o `click` seguinte; abre
  deslocado do dedo; `-webkit-touch-callout: none` só onde há menu.
- **Motor único** (`src/features/menu.ts`): o `GroupPanelMenuController`
  vira `MenuController` genérico (popover manual, preso à janela, espelhado
  em RTL) para cabeçalho, painel, linhas, "mais" e exportar. Guarda a
  posição lógica do disparador (`rowKey` + coluna, cabeçalho, chip, item da
  barra), não o elemento: resolve no fechamento (o `<td>` pode ter sido
  reciclado). O seletor de colunas aceita âncora/`returnFocus` (aberto pelo
  "mais").

## Acessibilidade
- **Barra**: `role="toolbar"` com nome — `toolbarLabel`, ou
  `aria-labelledby` = nome do grid (spec 10) + texto "barra" quando o
  hospedeiro tem nome. Um ponto de Tab (roving; lembra o último), ←/→
  (invertidas em RTL), Home/End no 1º/último item. Sempre exatamente um
  `tabindex=0`; o item focado que sai (chip desagrupado, recolhido, recurso
  desligado) leva o foco ao vizinho do mesmo índice ou ao "mais"; troca de
  itens com o "mais" aberto fecha e devolve o foco ao "mais". Desabilitados
  focáveis com `aria-disabled`. Busca e `renderer` fora do roving (o
  conteúdo do hospedeiro pode usar as setas; spec 17 já tirou a busca do
  `toolbar`).
- **Painel de grupos**: deixa de ser `toolbar` (não aninhar): `role="group"`
  + `groupPanelLabel`; os chips entram no roving da barra — ←/→ no limite
  passam ao vizinho da barra, Home/End vão às pontas da barra;
  Alt+Shift+←/→, Ctrl+G, Delete, Enter e Shift+F10 seguem nos chips.
- **Botões de menu** ("mais", exportar): `aria-haspopup="menu"` +
  `aria-expanded`; Enter/Espaço/↓ abrem no 1º item, ↑ no último. Item do
  "mais" que abre o seletor: `aria-haspopup="dialog"`.
- **Menu**: `role="menu"`, itens `menuitem` (`tabindex=-1`, foco móvel),
  `role="separator"`. ↑/↓ circulares, Home/End, letra (sem Ctrl/Alt/Meta;
  buffer de 500 ms; sem diacríticos e caixa pelo idioma; sem resultado não
  move), Enter/Espaço agem, Esc e Tab fecham e devolvem o foco. Clique fora
  fecha sem roubar o foco (spec 17). Sem submenus. Nomes: cabeçalho
  `columnHeaderMenuLabel` (sempre, mesmo só com itens do hospedeiro), painel
  `groupPanelMenuLabel`, linha `rowMenuLabel`, linha de grupo
  `groupRowMenuLabel`, "mais"/exportar `aria-labelledby` do botão.
- **Abrir pelo teclado**: Shift+F10/tecla Menu só quando o alvo é a própria
  célula, o cabeçalho ou o chip (em editor, busca ou conteúdo da célula,
  fica o menu nativo). A célula vira a ativa.
- **Foco depois de cada ação** (fechar sem devolver o foco nas que o
  movem): copiar, exportar, ordenar, fixar, largura, expandir/recolher
  grupo ou detalhe, restaurar → disparador; editar → editor; excluir →
  diálogo com `returnFocus` = célula disparadora; confirmado → mesma coluna
  da linha seguinte (ou anterior), cancelado → a célula; agrupar/desagrupar
  → como Ctrl+G; "recolher tudo" de grupo aninhado → grupo de 1º nível
  ancestral; "desagrupar tudo" pelo painel → próximo item da barra; mover
  → segue a coluna/chip; `action` do hospedeiro → disparador (antes de
  chamar, no mesmo gesto).
- **Anúncios**: copiar (os de hoje); exportar — "Exportando…" só depois de
  1 s (timer solto no disconnect), fim `exportCompleteAnnouncement`
  ("Exported to {format}") ou `exportErrorAnnouncement`.
- **`lang`**: nos itens embutidos e nos textos da i18n (não no
  `role=menu`/`toolbar`); `text` do hospedeiro (inclusive embutido
  renomeado) sem `lang` da i18n. Ícone do hospedeiro em wrapper
  `aria-hidden`. Item sem nome: aviso e omitido.
- **Visual**: alvos ≥ 24 px (2.5.8); `forced-colors` (expandido com
  `outline Highlight`, "⋯" com `ButtonText`, desabilitado `GrayText`, item
  focado `Highlight`/`HighlightText`, separador por `border`);
  `prefers-reduced-motion`.

## i18n (14 idiomas)
`toolbarLabel` ("Grid toolbar"), `toolbarMoreButtonLabel` ("More
actions"), `exportButtonLabel` ("Export"), `exportCsv` ("Export to CSV"),
`exportXlsx` ("Export to Excel"), `exportSelectedCsv` ("Export selected
rows to CSV"), `exportSelectedXlsx` ("Export selected rows to Excel"),
`exportingAnnouncement` ("Exporting…"), `exportCompleteAnnouncement`
("Exported to {format}"), `exportErrorAnnouncement` ("Export failed"),
`copyCell` ("Copy"), `copySelectedRows` ("Copy selected rows"),
`rowMenuLabel` ("Row options"), `groupRowMenuLabel` ("Options for group
{value}"), `sortColumnAscending` ("Sort ascending"), `sortColumnDescending`
("Sort descending"), `clearColumnSorting` ("Clear sorting"), `expandGroup`
("Expand group"), `collapseGroup` ("Collapse group"), `expandRow` ("Show
details"), `collapseRow` ("Hide details"). Reaproveitadas (JSDoc
atualizado): `fixStart`/`fixEnd`/`unfix`, `editRow`, `removeRow`,
`restoreRow`, `ungroupColumn`, `ungroupAll`, `expandAllGroups`,
`collapseAllGroups`, `groupColumn`, `moveLeft`/`moveRight`, …

## Fora de escopo
Submenus, itens marcáveis, atalhos exibidos no menu, `location: 'center'`,
`disabled` da barra inteira, menu no rodapé/filtro/detalhe, colar, PDF
embutido, método `fixColumn()`.

## Arquivos
`features/menu.ts` (motor; substitui `group-panel-menu.ts`),
`features/toolbar.ts` (composição, roving, recolhimento),
`features/context-menu.ts` (itens por alvo, toque longo),
`render/toolbar.ts`, `export-xlsx/index.ts` (`createXlsxExporter`),
`attribute-converters.ts`, `grid.ts`, `grid-i18n.ts`, `grid.styles.ts`.

## Testes
Composição automática (DOM/ARIA); `toolbarItems` (ordem, lado, embutido
desligado com aviso, `[]`, `renderer` com `signal`); recolhimento por
largura e `always`, item focado recolhido mantém um `tabindex=0`;
exportar CSV/Excel (exportador falso), `u-grid-exporting` cancelado,
`u-grid-export`/`-error`, aborto no disconnect;
`u-grid-context-menu-opening` (incluir, tirar, cancelar, vazio,
embutido de outro alvo) em todos os alvos; embutidos de cada alvo;
`openContextMenu`; `copySelection()` (negado, cancelado, `clipboardMode`);
menu nativo preservado (seleção, editor, Ctrl); roteiro de teclado (barra:
Tab/←/→/Home/End, RTL, chips no limite; busca e `renderer` fora do
roving; menus: Shift+F10, tecla Menu, setas, letra, Esc/Tab; foco depois
de CADA ação da tabela; seletor e "Adicionar linha" pelo "mais"); toque
longo (clique fantasma, cancelamento); `lang` dos itens; axe (barra, "mais"
aberto, menus, RTL); `forced-colors`; SSR e hidratação; vazamento
(listeners de documento, popovers, timers do toque longo e do anúncio,
`AbortSignal`); perf (sem custo por linha; abrir o menu em 1 milhão de
linhas).

## Decisões da implementação

- **Fixar no menu do cabeçalho só com `column-chooser`**: sem o seletor o
  usuário não fixa hoje; ligar o menu de fixação para todo grid mudaria o
  cabeçalho de quem atualiza (botão "⋮" em toda coluna).
- **Reserva do painel de grupos** na medida do "mais": `min(120px, 100%)`
  (o painel quebra linha por dentro, A9); o roving cresce a partir de 200 px
  (`flex: 1 1 200px`), então a busca desce de linha antes de espremer os
  botões. A largura disponível vem do espaço, não do conteúdo (sem laço de
  medida).
- **`always` já no 1º render e no SSR** (sem medida); `auto` só depois de
  medir (o SSR e a hidratação desenham tudo, iguais).
- **Tecla de menu sem itens**: quando a tecla não abriu menu, o `contextmenu`
  que o navegador solta depois fica nativo (o evento não dispara duas vezes);
  quando abriu, ele cai no menu focado, que o cancela.
- **Guarda de foco**: foco levado de propósito para fora do grid (âncora do
  `openContextMenu`) não é foco perdido — a guarda só age com o foco no
  `<body>`.
- **Revisão da API na entrega** (`webcomponent-api-reviewer`, 13 achados,
  aplicados): avisos uma vez por lista e motivo (o item em string virava
  objeto novo a cada render); `exportFormats` valida também na propriedade
  (minúsculas, desconhecido avisa); embutidos no `menuItems` com `disabled`
  e `separatorBefore` padrão; aviso do `xlsx` sem exportador um quadro
  depois do render (o exportador chega depois do 1º render nos frameworks);
  `GRID_DEFAULT_TOOLBAR_ITEMS` declarado no `grid.ts` (entra no CEM);
  `export-formats` como `string` no CEM; JSDoc das chaves reaproveitadas.
  Desvios registrados: `showText` padrão `in-menu` no `columnChooserButton`
  e no `exportButton` (botões de ícone, como o seletor de hoje); item com
  `renderer` sem `locateInMenu`/`showText`/`disabled` (nunca recolhe; o
  conteúdo é do hospedeiro); tipos extras exportados
  (`GridToolbarButtonItem`, `GridToolbarContentItem`, `GridContextMenuContext`).
  Recusado: tipo nomeado `GridCsvExportOptions` (nome público novo — fica para
  aval; o README mostra o `Omit`).
- **Revisão de a11y na entrega** (`a11y-reviewer`, 13 achados). Aplicados:
  clique no chip não ordenável (botão de menu) abre o menu; toque longo em
  campo editável ou com texto selecionado fica nativo;
  `-webkit-touch-callout: none` só onde há menu; nome da barra por
  `aria-labelledby` com o `lang` de cada parte; "mais" que some com o menu
  aberto devolve o foco à barra; ativar item de exportar desabilitado durante
  a exportação relê "Exportando…"; sufixo oculto ("Desagrupar País") com o
  `lang` do conteúdo; `forced-colors` do item desabilitado focado; testes de
  foco que faltavam. Deixados (justificados, vão ao usuário): desagrupar pelo
  menu do painel leva o foco ao chip vizinho (comportamento já aprovado na
  spec 17; o texto "como Ctrl+G" desta spec vale para o cabeçalho e a linha
  de grupo); `lang` do estado da ordenação no `aria-label` do chip (nome
  existente, spec 05); anúncio de falha ao copiar (chave i18n nova) e
  `opacity` do botão desabilitado (muda o visual padrão) — pedem aval.
- **Aprovados pelo usuário depois da entrega** ("Accept recommendations",
  2026-11-18) e feitos: chave `copyFailedAnnouncement` ("Could not copy to the clipboard.", mesma chave e textos da frente 19,
  14 idiomas), anunciada quando o "Copiar" do menu da linha não consegue
  escrever (só `source: 'user'`; `copySelection()` só devolve `false`);
  botão desabilitado da barra com `opacity: 0.38` no botão inteiro (ícone e
  texto, cor do botão mantida) em vez de 60% da cor (WCAG 1.4.1). Recusado:
  tipo nomeado `GridCsvExportOptions`.
- **Ícone do botão do hospedeiro** desenhado direto no shadow DOM (valor, não
  função): `TemplateResult` ou texto; um `HTMLElement` é movido para lá.

## Critério de pronto
Global (`00-overview.md`) + `npm run test:perf` sem regressão.

## Referência medida

DevExtreme 26.1.6 (demo "DataGrid › Toolbar", reconfigurada pela API no
console, 2026-11-18) e AG Grid (só a documentação: menu de contexto é
Enterprise).

**Barra (DevExtreme)**
- Ordem padrão: antes `groupPanel`; depois `addRowButton`, `saveButton`,
  `revertButton`, `exportButton`, `columnChooserButton`, `searchPanel`.
  Com `items` informado, só aparece o listado (string = embutido como está;
  objeto com `name` = personalizado).
- Item: `location` (padrão `after`), `locateInMenu` (padrão `never`;
  embutidos de botão vêm `auto`, painel de grupos e busca `never`),
  `showText` (`always`/`inMenu`; os botões embutidos vêm `inMenu`: só ícone
  na barra), `visible`, `disabled`, `widget`+`options`, `template`,
  `menuItemTemplate`; `toolbar.visible`/`toolbar.disabled`.
- Recolhimento: a 420 px exportar e seletor vão ao menu; a 300 px também
  adicionar/salvar/descartar — sai primeiro o `auto` mais ao fim. O menu
  segue a ordem da barra; as entradas de exportar entram achatadas.
  Botão "overflow" com `aria-haspopup`/`aria-expanded`; o popup é um
  `dialog` sem nome com menu/listbox misturados (ARIA inconsistente — não
  copiamos).
- `role="toolbar"` com nome ("Data grid toolbar"), mas SEM roving: cada
  controle é um ponto de Tab; desabilitados saem da ordem de Tab. Nós
  seguimos a APG (um ponto de Tab, roving, desabilitado focável).
- Exportar: botão de lista com "Exportar tudo para Excel" / "Exportar
  selecionadas para Excel" por formato (as "selecionadas" só com
  `allowExportSelectedData`); o resultado vai ao `onExporting(format,
  selectedRowsOnly)`.

**Menu de contexto (DevExtreme)**
- `onContextMenuPreparing(e)`: `target`, `targetElement`, `row`,
  `rowIndex`, `column`, `columnIndex`, `items`, `event`. O hospedeiro faz
  `push` em `e.items`; sem itens não abre e não chama `preventDefault`
  (fica o menu do navegador). Item: `text`, `icon`, `disabled`,
  `beginGroup` (separador), `items` (submenu), `onItemClick`, `name`.
- Itens padrão: cabeçalho — ordenar crescente/decrescente/limpar
  (desabilitado sem ordenação) | agrupar, desagrupar tudo | fixar ▸
  (esquerda/direita), desafixar (desabilitado se não fixada). Chip —
  desagrupar, desagrupar tudo | mover ←/→ (desabilitados nas pontas). Área
  vazia do painel: nada. Linha de grupo: desagrupar, desagrupar tudo. Linha
  de dados: nada.
- Teclado: `role="menu"` com `menuitem`s, ↓/↑ circulares, desabilitados
  focáveis, → abre submenu, Esc fecha — o foco caiu no `<body>` (não volta
  ao cabeçalho). Shift+F10 no cabeçalho não abriu nada; a documentação de
  teclado não tem atalho para o menu.

**AG Grid (documentação)**
- `getContextMenuItems(params)` (`column`, `value`, `node`, itens padrão;
  pode devolver `Promise`); `colDef.contextMenuItems` tem precedência.
  Embutidos: `copy`, `copyWithHeaders`, `cut`, `paste`, `export`
  (submenu `csvExport`/`excelExport`), `autoSizeAll`,
  `expandAll`/`contractAll`, `resetColumns`, `separator`. Padrão da célula:
  copiar, colar, exportar.
- `MenuItemDef`: `name`, `action`, `disabled`, `shortcut` (só texto),
  `checked`, `icon`, `subMenu`, `cssClasses`, `tooltip`.
- `suppressContextMenu`, `preventDefaultOnContextMenu`,
  `allowContextMenuWithControlKey`; API `showContextMenu`/`hidePopupMenu`.
  Toque longo de 500 ms no cabeçalho abre o menu da coluna; na célula, não
  documentado. Sem atalho de teclado documentado para o menu de contexto.
- Menu da coluna e de contexto usam o mesmo formato de item; embutidos de
  coluna: `sortAscending`/`sortDescending`/`sortUnSort`, `pinSubMenu`,
  `moveLeft`/`moveRight`, `autoSizeThis`, `rowGroup`/`rowUnGroup`,
  `columnChooser`, `expandAll`/`contractAll`.

Divergências nossas (de propósito): roving na barra (APG), Shift+F10/tecla
Menu abrem os menus, Esc devolve o foco ao disparador, ordem de hoje
(busca antes do seletor) mantida.

### Nossa medida (perfil de máquina fraca, spec 16 — cenário `menus-1m`)

1 milhão de linhas × 8 colunas com a barra completa (painel, exportar,
seletor, busca, botão do hospedeiro e um `always` no "mais") e `row-menu`:
1º render ~34–55 ms, 217 nós; abrir o menu da linha ~4 ms, o do cabeçalho
~4–5 ms, o "mais" ~4–5 ms (sem custo por linha). Os outros cenários sem
regressão (`npm run test:perf` inteiro verde contra a linha de base).
