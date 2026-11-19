import '@universal-material/data-grid';
import type { GridColumnDef } from '@universal-material/data-grid';

import { controls, createGrid, eventLog } from '../shared/controls.js';
import { makeEmployees, type Employee } from '../shared/data.js';

export const meta = {
  title: 'Validation rules',
  description: 'Each column takes `validationRules`: `required`, `stringLength`, `range` (numbers or dates), `pattern`, `email` and `custom` — which may return a promise, like the server check on **Department** here ("Validating…" shows while it runs). Before saving, `u-grid-row-validating` runs per row for cross-field checks: `setError(message, column)` blocks the save. Try clearing a name, typing a bad e-mail, or giving a Director a salary under 150,000, then **Save changes**.',
};

const DEPARTMENTS = ['Management', 'Engineering', 'Sales', 'Marketing', 'Finance', 'Support'];

// Pretend server check: resolves `true` or an error text after a short delay.
const checkDepartment = (value: unknown, signal: AbortSignal) => new Promise<true | string>((resolve, reject) => {
  const timer = setTimeout(() => resolve(DEPARTMENTS.includes(String(value)) || `Unknown department. Use one of: ${DEPARTMENTS.join(', ')}.`), 600);
  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(signal.reason);
  }, { once: true });
});

export default (host: HTMLElement) => {
  const grid = createGrid(host, 400);

  const salary: GridColumnDef<Employee> = {
    path: 'salary', label: 'Salary', width: 130, dataType: 'number', format: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
    validationRules: [{ type: 'range', min: 30_000, max: 500_000 }],
  };

  const columns: GridColumnDef<Employee>[] = [
    { path: 'name', label: 'Name', width: 180, validationRules: [{ type: 'required' }, { type: 'stringLength', max: 40 }] },
    { path: 'title', label: 'Title', width: 230, validationRules: [{ type: 'pattern', pattern: '[A-Z].*', message: 'Start with a capital letter.' }] },
    { path: 'department', label: 'Department', width: 150, validationRules: [{ type: 'custom', validate: ({ value }, signal) => checkDepartment(value, signal) }] },
    { path: 'email', label: 'E-mail', width: 240, validationRules: [{ type: 'required' }, { type: 'email' }] },
    salary,
    {
      path: 'hireDate', label: 'Hired', width: 150, dataType: 'date',
      validationRules: [{ type: 'range', min: new Date(2000, 0, 1), max: new Date(), message: 'Between 2000 and today.' }],
    },
  ];

  grid.keyExpr = 'id';
  grid.editMode = 'batch';
  grid.allowEditing = true;
  grid.allowAdding = true;
  grid.columns = columns;
  grid.items = makeEmployees();

  const log = eventLog(host);

  // Cross-field rule, checked for each added or edited row before saving.
  grid.addEventListener('u-grid-row-validating', event => {
    const { item, change, errors, setError } = event.detail;
    const row = { ...item, ...change.data } as Employee;

    if (row.title?.includes('Director') && row.salary < 150_000) {
      setError('Directors earn at least 150,000.', salary);
    }

    log.write(`u-grid-row-validating  ${row.name || '(new row)'}  rule errors: ${errors.length}`);
  });

  grid.addEventListener('u-grid-save', event => log.write(`u-grid-save  ${event.detail.changes.length} change(s) saved`));

  controls(host, 'Edit cells, then use Save changes in the toolbar.');
};
