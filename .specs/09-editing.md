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

## Escopo — API
- `editing: { mode: 'cell'|'row'|'batch'; allowUpdating; allowAdding;
  allowDeleting; startEditAction: 'click'|'dblClick'; confirmDelete }`.
- Coluna: `editable` (padrão `true` com `path`), `editor` (`(ctx) =>
  HTMLElement` para editor próprio), `validationRules` (`required`,
  `range`, `stringLength`, `pattern`, `email`, `custom`, `async`),
  `setCellValue(newItem, value, currentItem)`.
- Métodos: `editCell(key, column)`, `editRow(key)`, `addRow()`,
  `deleteRow(key)`, `saveEditData()`, `cancelEditData()`, `hasEditData()`.
- Eventos (nomes pela regra da spec 15): `u-grid-edit-starting`
  (cancelável), `u-grid-row-validating` (cancelável: `preventDefault()`
  marca a linha inválida), `u-grid-saving` (cancelável, com
  `changes` e `promise` para salvar no servidor), `u-grid-save`,
  `u-grid-edit-cancel`.

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

## Acessibilidade
Editor com `aria-label` da coluna, `aria-invalid` e `aria-describedby` para a
mensagem; Esc sempre devolve o foco à célula.

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
(preencher)
