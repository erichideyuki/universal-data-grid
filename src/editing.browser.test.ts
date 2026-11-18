/**
 * Frente 09: edição (célula, linha, lote), editores por tipo, validação
 * síncrona/assíncrona, inserir/excluir, teclado, ARIA e o contrato de nunca
 * mutar os dados do hospedeiro.
 */
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumnDef } from './grid-column-def.js';
import type {
  DataGrid,
  GridEditCancelEventDetail,
  GridEditStartingEventDetail,
  GridRowAddingEventDetail,
  GridRowValidatingEventDetail,
  GridSaveEventDetail,
  GridSavingEventDetail,
} from './grid.js';
import { cleanup, createGrid, dataRows, settle } from './test/fixture.js';

afterEach(cleanup);

interface Person {
  id: number;
  name: string;
  age: number;
  active: boolean;
  city?: string;
}

const people = (): Person[] => [
  { id: 1, name: 'Ana', age: 30, active: true },
  { id: 2, name: 'Bia', age: 25, active: false },
  { id: 3, name: 'Caio', age: 41, active: true },
  { id: 4, name: 'Duda', age: 19, active: false },
];

const columns = (): GridColumnDef[] => [
  { path: 'id', label: 'Id', editable: false },
  { path: 'name', label: 'Name' },
  { path: 'age', label: 'Age', dataType: 'number' },
  { path: 'active', label: 'Active', dataType: 'boolean' },
];

const root = (grid: DataGrid): ShadowRoot => grid.shadowRoot!;
const focused = (grid: DataGrid): Element | null => root(grid).activeElement;

const cell = (grid: DataGrid, row: number, col: number): HTMLElement =>
  root(grid).querySelector<HTMLElement>(`tbody tr[data-index="${row}"]:not(.pinned) > td[data-col="${col}"]`)
  ?? root(grid).querySelector<HTMLElement>(`tbody tr[data-index="${row}"] > td[data-col="${col}"]`)!;

const press = async (grid: DataGrid, key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> => {
  const target = (focused(grid) ?? root(grid).querySelector('[tabindex="0"]')) as HTMLElement;
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  await settle(grid);
  return event;
};

/** Digita no editor focado (troca o valor e dispara `input`). */
const type = async (grid: DataGrid, text: string): Promise<void> => {
  const input = focused(grid) as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle(grid);
};

const editorOf = (grid: DataGrid): HTMLInputElement | null =>
  root(grid).querySelector<HTMLInputElement>('td.editing .cell-editor');

const record = <T>(grid: DataGrid, name: string): T[] => {
  const details: T[] = [];
  grid.addEventListener(name, event => details.push((event as CustomEvent<T>).detail));
  return details;
};

const editableGrid = (configure?: (grid: DataGrid) => void, items = people()) => createGrid({
  columns: columns(),
  items,
  configure: grid => {
    grid.keyExpr = 'id';
    grid.allowEditing = true;
    configure?.(grid);
  },
});

const openCell = async (grid: DataGrid, rowKey: unknown, path: string): Promise<HTMLInputElement> => {
  const column = grid.columns.find(candidate => candidate.path === path)!;
  expect(grid.focusCell(rowKey, column)).toBe(true);
  await settle(grid);
  await press(grid, 'Enter');
  return focused(grid) as HTMLInputElement;
};

describe('edição: modo célula', () => {
  it('Enter abre, Enter confirma, salva e desce; o item do hospedeiro não muda', async () => {
    const items = people();
    const original = items[0];
    const grid = await editableGrid(undefined, items);
    const saving = record<GridSavingEventDetail>(grid, 'u-grid-saving');
    const saved = record<GridSaveEventDetail>(grid, 'u-grid-save');

    const input = await openCell(grid, 1, 'name');
    expect(input.classList.contains('cell-editor')).toBe(true);
    expect(input.getAttribute('aria-label')).toBe('Name');

    await type(grid, 'Alice');
    await press(grid, 'Enter');
    await settle(grid);

    expect(saving).toHaveLength(1);
    expect(saving[0].changes).toEqual([{ type: 'update', rowKey: 1, data: { name: 'Alice' }, item: original }]);
    expect(saved).toHaveLength(1);
    expect(original.name).toBe('Ana');
    expect(items[0]).toBe(original);
    expect(grid.items).not.toBe(items);
    expect(saved[0].items).toBe(grid.items);
    expect(grid.items[0]).toEqual({ ...original, name: 'Alice' });
    expect(cell(grid, 0, 1).textContent?.trim()).toBe('Alice');
    // Desceu uma linha, mesma coluna, sem editor.
    expect(focused(grid)).toBe(cell(grid, 1, 1));
    expect(editorOf(grid)).toBeNull();
    expect(grid.hasChanges()).toBe(false);
  });

  it('Esc cancela e devolve o foco à célula, sem evento de salvar', async () => {
    const grid = await editableGrid();
    const saving = record(grid, 'u-grid-saving');

    await openCell(grid, 2, 'name');
    await type(grid, 'X');
    await press(grid, 'Escape');

    expect(editorOf(grid)).toBeNull();
    expect(focused(grid)).toBe(cell(grid, 1, 1));
    expect(cell(grid, 1, 1).textContent?.trim()).toBe('Bia');
    expect(saving).toHaveLength(0);
    expect(grid.hasChanges()).toBe(false);
  });

  it('Tab confirma e abre a próxima editável (pula a não editável, passa de linha)', async () => {
    const grid = await editableGrid();
    await openCell(grid, 1, 'active');
    await press(grid, 'Tab');

    // Da última coluna da linha 0 para a 1ª editável da linha 1 (Name; Id não é editável).
    const input = focused(grid) as HTMLInputElement;
    expect(input.classList.contains('cell-editor')).toBe(true);
    expect(input.closest('td')).toBe(cell(grid, 1, 1));

    await press(grid, 'Tab', { shiftKey: true });
    expect((focused(grid) as HTMLElement).closest('td')).toBe(cell(grid, 0, 3));
  });

  it('não editável: aria-readonly; F2 não abre editor', async () => {
    const grid = await editableGrid();
    expect(cell(grid, 0, 0).getAttribute('aria-readonly')).toBe('true');
    expect(cell(grid, 0, 1).hasAttribute('aria-readonly')).toBe(false);

    grid.focusCell(1, grid.columns[0]);
    await settle(grid);
    await press(grid, 'F2');
    expect(editorOf(grid)).toBeNull();
  });

  it('u-grid-edit-starting cancelável', async () => {
    const grid = await editableGrid();
    const starts = record<GridEditStartingEventDetail>(grid, 'u-grid-edit-starting');
    grid.addEventListener('u-grid-edit-starting', event => event.preventDefault(), { once: true });

    expect(grid.editCell(1, grid.columns[1])).toBe(false);
    expect(starts[0]).toMatchObject({ rowKey: 1, column: grid.columns[1], source: 'api' });
    expect(grid.editCell(1, grid.columns[1])).toBe(true);
    await settle(grid);
    expect(editorOf(grid)).not.toBeNull();
  });

  it('clique abre o editor (editTrigger); dblclick só com edit-trigger="dblclick"', async () => {
    const grid = await editableGrid();
    cell(grid, 0, 1).click();
    await settle(grid);
    expect(editorOf(grid)?.closest('td')).toBe(cell(grid, 0, 1));

    await press(grid, 'Escape');
    grid.editTrigger = 'dblclick';
    await settle(grid);
    cell(grid, 1, 1).click();
    await settle(grid);
    expect(editorOf(grid)).toBeNull();
    cell(grid, 1, 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await settle(grid);
    expect(editorOf(grid)?.closest('td')).toBe(cell(grid, 1, 1));
  });

  it('número no separador do idioma; valor inválido não sai', async () => {
    const grid = await editableGrid(g => {
      g.language = 'pt-BR';
    });
    const saving = record<GridSavingEventDetail>(grid, 'u-grid-saving');
    const input = await openCell(grid, 1, 'age');
    expect(input.value).toBe('30');
    expect(input.getAttribute('inputmode')).toBe('decimal');

    await type(grid, 'abc');
    await press(grid, 'Enter');
    expect(editorOf(grid)).not.toBeNull();
    expect(editorOf(grid)!.getAttribute('aria-invalid')).toBe('true');

    await type(grid, '30,5');
    await press(grid, 'Enter');
    expect(saving[0].changes[0].data).toEqual({ age: 30.5 });
  });

  it('booleano: Enter foca a caixa, Espaço alterna (sem selecionar a linha), clique alterna e confirma', async () => {
    const grid = await editableGrid(g => {
      g.selectionMode = 'multiple';
    });
    const input = await openCell(grid, 2, 'active');
    expect(input.type).toBe('checkbox');
    expect(input.checked).toBe(false);

    // Espaço é do controle nativo (o grid não seleciona a linha).
    const space = await press(grid, ' ');
    expect(space.defaultPrevented).toBe(false);
    expect(grid.selectedKeys).toEqual([]);

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await press(grid, 'Enter');
    expect(grid.items.find((item: Person) => item.id === 2).active).toBe(true);
  });
});

describe('edição: validação', () => {
  const rules = (): GridColumnDef[] => [
    { path: 'id', label: 'Id', editable: false },
    { path: 'name', label: 'Name', validationRules: [{ type: 'required' }, { type: 'stringLength', max: 5 }] },
    { path: 'age', label: 'Age', dataType: 'number', validationRules: [{ type: 'range', min: 0, max: 120 }] },
  ];

  it('erro síncrono: editor aria-invalid + aria-describedby para a mensagem visível; Esc sai', async () => {
    const grid = await createGrid({ columns: rules(), items: people(), configure: g => {
      g.keyExpr = 'id';
      g.allowEditing = true;
    } });

    await openCell(grid, 1, 'name');
    await type(grid, '');
    await press(grid, 'Enter');

    const editor = editorOf(grid)!;
    expect(editor).not.toBeNull();
    expect(focused(grid)).toBe(editor);
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    const message = root(grid).getElementById(editor.getAttribute('aria-describedby')!.split(' ')[0])!;
    expect(message.hidden).toBe(false);
    expect(message.textContent).toContain('This field is required.');
    expect(message.textContent).toContain('Esc');
    expect(message.getAttribute('part')).toBe('validation-message');

    await press(grid, 'Escape');
    expect(editorOf(grid)).toBeNull();
    expect(cell(grid, 0, 1).textContent?.trim()).toBe('Ana');
    expect(grid.hasChanges()).toBe(false);
  });

  it('mensagem própria e intervalo formatado', async () => {
    const grid = await createGrid({ columns: rules(), items: people(), configure: g => {
      g.keyExpr = 'id';
      g.allowEditing = true;
    } });

    await openCell(grid, 1, 'age');
    await type(grid, '200');
    await press(grid, 'Enter');
    expect(root(grid).querySelector('.validation-message')?.textContent).toContain('between 0 and 120');
  });

  it('assíncrona com corrida: a resposta velha é descartada', async () => {
    const resolvers: ((value: boolean | string) => void)[] = [];
    const signals: AbortSignal[] = [];
    const grid = await createGrid({
      columns: [
        { path: 'id', label: 'Id', editable: false },
        {
          path: 'name',
          label: 'Name',
          validationRules: [{
            type: 'custom',
            validate: (_ctx, signal) => {
              signals.push(signal);
              return new Promise(resolve => resolvers.push(resolve));
            },
          }],
        },
      ],
      items: people(),
      configure: g => {
        g.keyExpr = 'id';
        g.allowEditing = true;
        g.editMode = 'batch';
      },
    });

    await openCell(grid, 1, 'name');
    await type(grid, 'Old');
    await press(grid, 'Enter');
    // Enter espera a resposta: o editor fica, com "Validando…" visível e aria-busy.
    const message = root(grid).querySelector('.validation-message:not([hidden])')!;
    expect(message.textContent).toContain('Validating');
    expect(cell(grid, 0, 1).getAttribute('aria-busy')).toBe('true');
    expect(editorOf(grid)!.getAttribute('aria-describedby')).toContain(message.id);

    // Digitar de novo aborta a validação em curso.
    await type(grid, 'New');
    expect(signals[0].aborted).toBe(true);
    await press(grid, 'Enter');

    resolvers[1](true);
    await settle(grid);
    resolvers[0]('stale error');
    await settle(grid);

    expect(editorOf(grid)).toBeNull();
    expect(cell(grid, 0, 1).getAttribute('aria-invalid')).toBeNull();
    expect(grid.getChanges()[0].data).toEqual({ name: 'New' });
  });

  it('u-grid-row-validating: setError por coluna impede salvar e marca a célula', async () => {
    const grid = await editableGrid(g => {
      g.editMode = 'batch';
    });
    const saving = record(grid, 'u-grid-saving');
    grid.addEventListener('u-grid-row-validating', event => {
      const detail = (event as CustomEvent<GridRowValidatingEventDetail>).detail;
      detail.setError('Too young', grid.columns[2]);
    });

    await openCell(grid, 1, 'age');
    await type(grid, '10');
    await press(grid, 'Enter');

    expect(await grid.saveChanges()).toBe(false);
    expect(saving).toHaveLength(0);
    expect(cell(grid, 0, 2).getAttribute('aria-invalid')).toBe('true');
    expect(root(grid).querySelector('.edit-status')?.textContent).toContain('Rows with errors: 1');
  });
});

describe('edição: lote', () => {
  it('marca alteradas, entrega todas no salvar com waitUntil e aplica', async () => {
    const items = people();
    const grid = await editableGrid(g => {
      g.editMode = 'batch';
    }, items);
    const saved = record<GridSaveEventDetail>(grid, 'u-grid-save');
    let resolve!: () => void;
    grid.addEventListener('u-grid-saving', event => {
      (event as CustomEvent<GridSavingEventDetail>).detail.waitUntil(new Promise<void>(done => {
        resolve = done;
      }));
    });

    await openCell(grid, 1, 'name');
    await type(grid, 'A2');
    await press(grid, 'Enter');
    await openCell(grid, 3, 'age');
    await type(grid, '50');
    await press(grid, 'Enter');

    expect(cell(grid, 0, 1).classList.contains('modified')).toBe(true);
    expect(cell(grid, 0, 1).getAttribute('part')).toBe('cell modified');
    expect(cell(grid, 0, 1).getAttribute('aria-describedby')).toBe('edit-desc-modified');
    expect(root(grid).getElementById('edit-desc-modified')?.textContent).toBe('Changed, not saved');
    expect(grid.getChanges()).toHaveLength(2);
    expect(items[0].name).toBe('Ana');

    const save = root(grid).querySelector<HTMLElement>('.save-button')!;
    expect(save.getAttribute('aria-disabled')).toBe('false');
    save.click();
    await settle(grid);
    expect(save.getAttribute('aria-busy')).toBe('true');
    expect(saved).toHaveLength(0);

    resolve();
    await settle(grid);
    await settle(grid);
    expect(saved).toHaveLength(1);
    expect(grid.hasChanges()).toBe(false);
    expect(cell(grid, 0, 1).classList.contains('modified')).toBe(false);
    expect(grid.items.map((item: Person) => item.name)).toEqual(['A2', 'Bia', 'Caio', 'Duda']);
    expect(grid.items[2].age).toBe(50);
    expect(items[2].age).toBe(41);
  });

  it('excluir marca e o MESMO botão vira Restaurar; descartar avisa', async () => {
    const grid = await editableGrid(g => {
      g.editMode = 'batch';
      g.allowRemoving = true;
    });
    const canceled = record<GridEditCancelEventDetail>(grid, 'u-grid-edit-cancel');
    const button = cell(grid, 1, 4).querySelector<HTMLButtonElement>('.command-button')!;
    expect(button.textContent).toBe('Delete');

    button.click();
    await settle(grid);
    expect(cell(grid, 1, 4).querySelector('.command-button')).toBe(button);
    expect(button.textContent).toBe('Restore');
    expect(dataRows(grid)[1].classList.contains('removed')).toBe(true);
    expect(cell(grid, 1, 1).getAttribute('aria-readonly')).toBe('true');
    expect(cell(grid, 1, 1).getAttribute('aria-describedby')).toBe('edit-desc-removed');
    expect(grid.getChanges()).toEqual([{ type: 'remove', rowKey: 2, item: grid.items[1] }]);

    button.click();
    await settle(grid);
    expect(button.textContent).toBe('Delete');
    expect(grid.hasChanges()).toBe(false);

    button.click();
    await settle(grid);
    root(grid).querySelector<HTMLElement>('.discard-button')!.click();
    await settle(grid);
    expect(canceled).toHaveLength(1);
    expect(canceled[0].changes[0].type).toBe('remove');
    expect(grid.hasChanges()).toBe(false);
  });
});

describe('edição: modo linha', () => {
  it('Enter abre a linha inteira; Tab percorre editores e botões; Esc cancela; Salvar salva', async () => {
    const grid = await editableGrid(g => {
      g.editMode = 'row';
    });
    const saving = record<GridSavingEventDetail>(grid, 'u-grid-saving');

    await openCell(grid, 1, 'name');
    const editors = [...dataRows(grid)[0].querySelectorAll('.cell-editor')];
    expect(editors).toHaveLength(3);
    expect(focused(grid)).toBe(editors[0]);

    await type(grid, 'Row');
    await press(grid, 'Tab');
    expect(focused(grid)).toBe(editors[1]);
    await press(grid, 'Tab');
    await press(grid, 'Tab');
    expect((focused(grid) as HTMLElement).textContent).toBe('Save');

    await press(grid, 'Escape');
    expect(root(grid).querySelector('.cell-editor')).toBeNull();
    expect(cell(grid, 0, 1).textContent?.trim()).toBe('Ana');
    expect(saving).toHaveLength(0);

    expect(grid.editRow(1)).toBe(true);
    await settle(grid);
    await type(grid, 'Row');
    root(grid).querySelector<HTMLElement>('.command-button.save')!.click();
    await settle(grid);
    await settle(grid);
    expect(saving[0].changes[0].data).toEqual({ name: 'Row' });
    expect(cell(grid, 0, 1).textContent?.trim()).toBe('Row');
  });
});

describe('edição: inserir e excluir', () => {
  it('addRow: linha no topo, valores iniciais pelo evento, editor aberto; salvar entrega add', async () => {
    const grid = await editableGrid(g => {
      g.allowAdding = true;
      g.editMode = 'batch';
    });
    const adding = record<GridRowAddingEventDetail>(grid, 'u-grid-row-adding');
    grid.addEventListener('u-grid-row-adding', event => {
      (event as CustomEvent<GridRowAddingEventDetail<Person>>).detail.data.id = 99;
    });

    const key = grid.addRow({ age: 1 });
    await settle(grid);

    expect(key).toBeTypeOf('object');
    expect(adding[0].source).toBe('api');
    const first = dataRows(grid)[0];
    expect(first.classList.contains('added')).toBe(true);
    expect(first.getAttribute('part')).toContain('added');
    expect((focused(grid) as HTMLElement).closest('tr')).toBe(first);

    await type(grid, 'Novo');
    await press(grid, 'Enter');

    expect(grid.getChanges()).toEqual([{ type: 'add', rowKey: key, data: { id: 99, age: 1, name: 'Novo' } }]);
    expect(await grid.saveChanges()).toBe(true);
    expect(grid.items.at(-1)).toEqual({ id: 99, age: 1, name: 'Novo' });
    expect(dataRows(grid).some(tr => tr.classList.contains('added'))).toBe(false);
  });

  it('Esc numa linha nova (modo célula) tira a linha e devolve o foco a "Adicionar linha"', async () => {
    const grid = await editableGrid(g => {
      g.allowAdding = true;
    });
    const button = root(grid).querySelector<HTMLElement>('.add-row-button')!;
    expect(button.textContent?.trim()).toBe('Add row');

    button.focus();
    button.click();
    await settle(grid);
    expect(dataRows(grid)[0].classList.contains('added')).toBe(true);

    await press(grid, 'Escape');
    expect(dataRows(grid).some(tr => tr.classList.contains('added'))).toBe(false);
    expect(focused(grid)).toBe(button);
  });

  it('excluir com confirmação: alertdialog, foco em Cancelar, Esc devolve o foco; confirmar remove', async () => {
    const grid = await editableGrid(g => {
      g.allowRemoving = true;
    });
    const saving = record<GridSavingEventDetail>(grid, 'u-grid-saving');
    const button = cell(grid, 0, 4).querySelector<HTMLButtonElement>('.command-button')!;
    button.focus();
    button.click();
    await settle(grid);

    const dialog = root(grid).querySelector<HTMLDialogElement>('dialog.remove-dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(focused(grid)?.textContent).toBe('Cancel');

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle(grid);
    expect(root(grid).querySelector('dialog')).toBeNull();
    expect(focused(grid)).toBe(button);

    button.click();
    await settle(grid);
    root(grid).querySelector<HTMLElement>('dialog .danger')!.click();
    await settle(grid);
    await settle(grid);
    expect(saving[0].changes).toEqual([{ type: 'remove', rowKey: 1, item: people()[0] }]);
    expect(grid.items.map((item: Person) => item.id)).toEqual([2, 3, 4]);
  });

  it('waitUntil rejeitado: u-grid-save-error, mudança pendente e mensagem visível', async () => {
    const grid = await editableGrid(g => {
      g.editMode = 'batch';
    });
    const errors = record(grid, 'u-grid-save-error');
    grid.addEventListener('u-grid-saving', event => {
      (event as CustomEvent<GridSavingEventDetail>).detail.waitUntil(Promise.reject(new Error('Server down')));
    });

    await openCell(grid, 1, 'name');
    await type(grid, 'Z');
    await press(grid, 'Enter');
    expect(await grid.saveChanges()).toBe(false);
    await settle(grid);

    expect(errors).toHaveLength(1);
    expect(grid.hasChanges()).toBe(true);
    expect(root(grid).querySelector('.edit-status')?.textContent).toBe('Could not save the changes. Server down');
  });

  it('waitUntil fora do dispatch lança InvalidStateError', async () => {
    const grid = await editableGrid(g => {
      g.editMode = 'batch';
    });
    let detail: GridSavingEventDetail | undefined;
    grid.addEventListener('u-grid-saving', event => {
      detail = (event as CustomEvent<GridSavingEventDetail>).detail;
    });

    await openCell(grid, 1, 'name');
    await type(grid, 'Z');
    await press(grid, 'Enter');
    await grid.saveChanges();
    expect(() => detail!.waitUntil(Promise.resolve())).toThrowError(/waitUntil/);
  });
});

describe('edição: dados e rolagem', () => {
  it('com dataSource aplica por applyChanges e precisa de keyExpr', async () => {
    const data = people();
    const grid = await createGrid({
      columns: columns(),
      configure: g => {
        g.allowEditing = true;
        g.dataSource = { load: async () => ({ data }) };
      },
    });
    await settle(grid);
    expect(grid.editCell(1, grid.columns[1])).toBe(false);

    grid.keyExpr = 'id';
    await settle(grid);
    expect(grid.editCell(1, grid.columns[1])).toBe(true);
    await settle(grid);
    await type(grid, 'Remote');
    await press(grid, 'Enter');
    await settle(grid);
    expect(cell(grid, 0, 1).textContent?.trim()).toBe('Remote');
    expect(data[0].name).toBe('Ana');
  });

  it('a edição pendente sobrevive à ordenação, ao filtro e à rolagem virtual', async () => {
    const items = Array.from({ length: 5000 }, (_, id) => ({ id, name: `N${id}`, age: id % 90, active: false }));
    const grid = await editableGrid(g => {
      g.editMode = 'batch';
    }, items);

    await openCell(grid, 0, 'name');
    await type(grid, 'Edited');
    await press(grid, 'Enter');

    grid.sortColumn(grid.columns[2], 'desc');
    await settle(grid);
    grid.sortColumn(grid.columns[2], null);
    await settle(grid);
    grid.filterValue = ['name', 'contains', 'N'];
    await settle(grid);
    grid.filterValue = null;
    await settle(grid);
    expect(cell(grid, 0, 1).textContent?.trim()).toBe('Edited');

    // Editor aberto e rolagem até o fim: a linha fica presa (no DOM) com o rascunho.
    await openCell(grid, 1, 'name');
    await type(grid, 'Draft');
    const scroller = root(grid).querySelector<HTMLElement>('.scroll-container')!;
    scroller.scrollTop = scroller.scrollHeight;
    await settle(grid);
    const editor = editorOf(grid)!;
    expect(editor.closest('tr')!.classList.contains('pinned')).toBe(true);
    expect(editor.value).toBe('Draft');
    await press(grid, 'Enter');
    expect(grid.getChanges().map(change => change.data)).toEqual([{ name: 'Edited' }, { name: 'Draft' }]);
  });

  it('trocar items mantém as pendências das chaves presentes e avisa as outras', async () => {
    const grid = await editableGrid(g => {
      g.editMode = 'batch';
    });
    const canceled = record<GridEditCancelEventDetail>(grid, 'u-grid-edit-cancel');
    grid.editCell(1, grid.columns[1]);
    await settle(grid);
    await type(grid, 'K');
    await press(grid, 'Enter');
    grid.editCell(2, grid.columns[1]);
    await settle(grid);
    await type(grid, 'L');
    await press(grid, 'Enter');

    grid.items = people().filter(item => item.id !== 2);
    await settle(grid);

    expect(grid.getChanges().map(change => change.rowKey)).toEqual([1]);
    expect(canceled[0]).toMatchObject({ source: 'api', changes: [{ type: 'update', rowKey: 2 }] });
  });
});

describe('edição: ARIA e axe', () => {
  const run = async (grid: DataGrid) => {
    const result = await axe.run(grid, { resultTypes: ['violations'] });
    return result.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`);
  };

  it('sem violações: editor aberto, inválido, lote marcado, linha nova, diálogo, RTL', async () => {
    const grid = await createGrid({
      columns: [
        { path: 'id', label: 'Id', editable: false },
        { path: 'name', label: 'Name', validationRules: [{ type: 'required' }] },
        { path: 'age', label: 'Age', dataType: 'number' },
      ],
      items: people(),
      configure: g => {
        g.keyExpr = 'id';
        g.allowEditing = true;
        g.allowAdding = true;
        g.allowRemoving = true;
        g.editMode = 'batch';
      },
    });

    await openCell(grid, 1, 'name');
    expect(await run(grid)).toEqual([]);

    await type(grid, '');
    await press(grid, 'Enter');
    await openCell(grid, 2, 'age');
    await type(grid, '9');
    await press(grid, 'Enter');
    cell(grid, 2, 3).querySelector<HTMLElement>('.command-button')!.click();
    grid.addRow();
    await settle(grid);
    expect(await run(grid)).toEqual([]);

    grid.dir = 'rtl';
    grid.language = 'ar';
    await settle(grid);
    expect(await run(grid)).toEqual([]);

    grid.editMode = 'cell';
    grid.dir = '';
    await settle(grid);
    grid.discardChanges();
    await settle(grid);
    const button = root(grid).querySelector<HTMLElement>('.command-button')!;
    button.click();
    await settle(grid);
    expect(root(grid).querySelector('dialog')?.open).toBe(true);
    expect(await run(grid)).toEqual([]);
  });

  it('sem edição ligada: nada de coluna de botões nem aria-readonly', async () => {
    const grid = await createGrid({ columns: columns(), items: people() });
    expect(root(grid).querySelector('.command-cell')).toBeNull();
    expect(root(grid).querySelector('[aria-readonly]')).toBeNull();
    expect(root(grid).querySelector('#edit-desc-added')).toBeNull();
  });
});
