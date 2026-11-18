# 09 — Edição

## Objetivo
Editar, inserir e excluir linhas com validação, nos modos de célula, linha e
lote. Depende de 02 (tipos), 05 (foco/teclado) e 08 (chave).

## Referência
DevExtreme: `editing.mode` (`cell|row|batch|form|popup`), `allowUpdating`,
`allowAdding`, `allowDeleting`, `startEditAction` (`click|dblClick`),
`confirmDelete`, `column.validationRules`, `setCellValue`, eventos
`onEditingStart`, `onRowValidating`, `onSaving`/`onSaved`, `changes`
(edições pendentes), `newRowPosition`. AG Grid: `editable`, cell editors,
`undoRedoCellEditing`.

## Escopo — API (aprovada pelo usuário em 2026-11-18)
Revisada pelo `webcomponent-api-reviewer` e pelo `a11y-reviewer` antes do
aval. Achado recusado: atalho Ctrl+Delete para excluir (a referência não tem;
a coluna de comandos já cobre o teclado).

### `<u-grid>`
- Propriedades planas (como `selectionMode`/`paging`):
  `editMode`/`edit-mode` (`'cell'|'row'|'batch'`, padrão `'cell'`, tipo
  `GridEditMode`); `allowEditing`/`allow-editing`, `allowAdding`/
  `allow-adding`, `allowRemoving`/`allow-removing` (`booleanAttribute(false)`;
  `allowEditing`/`allowRemoving` aceitam `(item) => boolean` só por
  propriedade); `editTrigger`/`edit-trigger` (`'click'|'dblclick'`, padrão
  `'click'`); `confirmRemove`/`confirm-remove` (`booleanAttribute(true)`).
- Métodos: `editCell(rowKey, column): boolean`; `editRow(rowKey): boolean`
  (só modo linha); `addRow(data?): unknown` (chave provisória opaca — objeto
  congelado —, `null` se cancelado/sem `allowAdding`); `removeRow(rowKey):
  Promise<boolean>` (sem confirmação pela API; lote: marca);
  `restoreRow(rowKey)` (lote); `saveChanges(): Promise<boolean>`;
  `discardChanges()`; `hasChanges()`; `getChanges()` (cópia).
- Eventos (`bubbles`, `composed`, todos com `source: 'user'|'api'`):
  `u-grid-edit-starting` (cancelável) `{rowKey, item, column, source}`;
  `u-grid-row-adding` (cancelável) `{data, source}` (`data` do grid, já com o
  argumento de `addRow`; o hospedeiro preenche); `u-grid-row-removing`
  (cancelável) `{rowKey, item, source}` — antes do diálogo;
  `u-grid-row-validating` (cancelável) `{rowKey, item, change, errors,
  setError(message, column?), source}`; `u-grid-saving` (cancelável)
  `{changes, waitUntil(promise), source}` — `waitUntil` só durante o
  dispatch (senão `InvalidStateError`), várias = `Promise.all`; se resolver
  com `GridDataChanges`, o grid aplica essas no lugar das calculadas;
  `u-grid-save` `{changes, items, source}` (`items` = array novo com `items`
  local, senão `null`); `u-grid-save-error` `{changes, error, source}`;
  `u-grid-edit-cancel` `{changes, source}`.
- `GridEditChange<TItem> { type: 'add'|'update'|'remove'; rowKey; data?;
  item? }`; `GridValidationError { column, rule, message }`.
- Aplicação: com `dataSource`, `applyChanges` (precisa de `keyExpr`; sem ela,
  `console.error` e edição desligada); com `items`, o grid passa a usar uma
  cópia do array (`grid.items` devolve a cópia; o `u-grid-save` a entrega).
  Trocar `items` com pendências: ficam as de chaves ainda presentes (com
  `keyExpr`); as demais saem com `u-grid-edit-cancel` `source:'api'`.

### Coluna (`GridColumnDef` e `<u-grid-column>`)
- `editable` (tri-estado; padrão `true` com `path` ou `valueSetter`).
- `editorRenderer(item, ctx: GridEditorRenderContext)` — `item` original;
  `ctx`: `value` (pendente), `data`, `setValue`, `commit`, `cancel`,
  `column`, `rowKey`, `label`, `invalid`, `errorMessage`, `describedBy` (só
  `TemplateResult`; para `HTMLElement` o grid põe a mensagem no light DOM e
  completa `aria-label`/`aria-invalid`/`aria-describedby` se faltarem),
  `signal`, `grid`. O grid ignora Enter/Tab/Esc com `defaultPrevented`.
- `validationRules`: `required` (`trim?`), `range` (`min?`, `max?`),
  `stringLength`, `pattern` (string ancorada como no atributo HTML),
  `email`, `custom` (`validate(ctx, signal) => boolean | string |
  Promise<boolean | string>`); todas com `message?`.
- `valueSetter(data, value, item)`.

### CSS
- Parts: `cell modified`, `cell invalid`, `row added`, `row removed`,
  `cell-editor`, `command-cell`, `command-button`, `save-button`,
  `discard-button`, `add-row-button`, `remove-dialog`, `validation-message`.
- Custom properties: `--u-grid-modified-cell-background-color`,
  `--u-grid-modified-cell-indicator-color`, `--u-grid-invalid-cell-color`,
  `--u-grid-added-row-background-color`, `--u-grid-removed-row-opacity`
  (padrão 0,7 + texto riscado).

## Comportamento
- Editores embutidos por tipo: texto, número (respeita o separador decimal
  do idioma), data (`<input type=date>`), booleano (caixa).
- O grid NÃO altera o objeto do hospedeiro: guarda `changes`
  (`{ type: 'insert'|'update'|'remove', key, data }`) e entrega no
  `u-grid-saving`; o hospedeiro aplica (ou deixa o grid aplicar numa cópia
  em `items` local com `applyChanges` da 08).
- Modo célula: Enter/F2 edita, Enter confirma e desce, Tab vai à próxima
  editável, Esc cancela. Modo linha: botões Salvar/Cancelar na linha. Lote:
  células alteradas marcadas, barra "Salvar/Descartar".
- Validação síncrona e assíncrona; célula inválida com borda de erro e
  mensagem em tooltip; impede salvar.
- Linha nova no topo da página visível; excluir com confirmação opcional.

## Acessibilidade (aprovada)
- Teclado sem editor: Enter/F2 abre o editor da célula editável (foco no
  editor); não editável segue o 05. Clique/duplo clique (`editTrigger`).
- Com editor: Enter confirma e desce (última linha: confirma e fica);
  Shift+Enter sobe; Tab/Shift+Tab confirma e abre a próxima/anterior
  editável (pula grupos, detalhes, removidas; renderiza e rola antes de
  focar); na última/primeira, confirma e o foco fica na célula. Esc cancela
  e devolve o foco à célula. Setas/Home/End são do editor. Tratado ANTES do
  ramo genérico "foco dentro do conteúdo".
- Valor inválido (célula/linha): Enter/Tab não saem; Esc é a saída e o texto
  de erro a cita. Foco saindo do editor (clique fora): válido confirma;
  inválido fica pendente marcado. Lote: inválido fica pendente com
  `aria-invalid`.
- Booleano: Espaço segue selecionando a linha; Enter/F2 foca a caixa,
  Espaço alterna, Enter confirma e desce; clique na caixa alterna e
  confirma. Caixa ≥ 24×24 com `aria-label` da coluna.
- Modo linha: Enter/F2 abre a linha (foco no editor da célula ativa); Tab
  percorre editores e Salvar/Cancelar; Enter salva; Esc cancela.
- Coluna de comandos no roving (Enter/F2 entra nos botões). No lote,
  Excluir vira Restaurar no MESMO `<button>`. Barra: "Adicionar linha" e,
  no lote, "Salvar"/"Descartar" (`aria-disabled` sem mudanças).
- Mensagem de erro: elemento visível e persistente abaixo da célula (acima
  na última linha), `aria-describedby` + `aria-invalid`; sem tooltip.
  Validação async: "Validando…" no próprio elemento; Enter/Tab esperam a
  resposta; digitar de novo aborta (`signal`).
- Linha nova/removida: `aria-describedby` em cada célula para um `<span
  hidden>` por estado; "Alterado" só na célula; ids juntados com o do erro.
  Marca de alterada visível (canto) além do fundo.
- `aria-readonly="true"` nas células de dados não editáveis quando há
  edição (`allowEditing` ou `allowAdding`) e nas de linha removida; nunca nas
  colunas de caixa, detalhe, comandos nem no cabeçalho.
- Diálogo de exclusão: `<dialog>` `showModal`, `role=alertdialog`, `lang`
  da tradução, foco inicial em Cancelar; Esc (`cancel`)/Cancelar devolvem o
  foco ao botão Excluir; confirmado, foco na mesma coluna da linha seguinte
  (ou anterior; sem linhas, cabeçalho).
- Esc numa linha nova: a linha some; foco volta a "Adicionar linha" se foi
  ele o disparador, senão à célula na mesma posição.
- Salvar barrado (validação/servidor): mensagem visível na barra (lote) ou
  junto aos botões (linha), foco no 1º inválido, anúncio "Linhas inválidas:
  {count}".
- Anúncios (polite): salvas, descartadas ({count}), marcada para remoção,
  restaurada, removida, erro ao salvar, "Salvando…"/"Validando…" só depois
  de 1 s. "Linha adicionada" só quando o foco não vai ao editor.
- `aria-busy` só na barra/botão Salvar enquanto salva.

## i18n
`edit`, `save`, `cancel`, `delete`, `add`, `confirmDeleteMessage`,
`saveChanges`, `discardChanges`, mensagens de cada regra de validação.

## Fora de escopo
Modos `form` e `popup` (fase D), desfazer/refazer (fase D), edição de
intervalo colado (fase D).

## Arquivos
`features/editing.ts`, `features/validation.ts`, `render/editors/*`,
`render/cell.ts`.

## Testes
Ciclo completo por modo; validação async com corrida (resposta antiga
descartada); edição sobrevive à rolagem virtual; Tab pula não editáveis.

## Referência medida
DevExtreme 26.1, demo "Cell Editing" (jQuery, 2026-11-18):
- Clique simples numa célula editável abre o editor (`startEditAction`
  padrão `click`), cursor no fim do texto (não seleciona). F2 abre igual.
  Digitar sem editor aberto NÃO abre (`editOnKeyPress` padrão `false`).
- Enter no editor confirma e FICA na mesma célula (padrão
  `enterKeyDirection: 'none'`; `'column'` desce — é o que adotamos, pedido
  do usuário). Enter de novo reabre o editor.
- Tab no editor confirma e abre o editor da próxima célula editável.
- Esc cancela o valor da célula e devolve o foco ao `<td>`.
- ARIA: editor `<input role=textbox aria-labelledby=<id do cabeçalho>>`;
  `<td role=gridcell aria-roledescription="Editable">` nas editáveis (nada
  nas não editáveis); coluna de comandos (lixeira) é uma `gridcell` na
  navegação.
