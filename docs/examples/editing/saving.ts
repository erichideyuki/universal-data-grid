import '@universal-material/data-grid';
import type { GridDataChanges, GridEditChange } from '@universal-material/data-grid';

import { button, controls, createGrid, eventLog, stat } from '../shared/controls.js';
import { makeOrders, type Order } from '../shared/data.js';

export const meta = {
  title: 'Saving to a server',
  description: 'In `u-grid-saving`, send `detail.changes` to your server and pass the promise to `detail.waitUntil()`: the grid waits, and keeps the changes pending if it rejects (`u-grid-save-error`, with the message in the toolbar). Resolving with `{ add, update, remove }` lets the server have the last word — here it assigns the ids of new rows. `u-grid-row-adding` fills the defaults of a new row, and `u-grid-save` hands you the new array (your `items` are never mutated).',
};

// A pretend API: waits, then answers with the saved rows (new rows get their id here).
const createServer = (firstId: number) => {
  let nextId = firstId;
  let failNext = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  return {
    dispose() {
      timers.forEach(clearTimeout);
    },
    failNextSave() {
      failNext = true;
    },
    save(changes: readonly GridEditChange<Order>[]) {
      return new Promise<GridDataChanges<Order>>((resolve, reject) => timers.add(setTimeout(() => {
        timers.clear();

        if (failNext) {
          failNext = false;
          reject(new Error('The server is unavailable (simulated).'));
          return;
        }

        resolve({
          add: changes.filter(c => c.type === 'add').map(c => ({ ...c.data, id: nextId++ }) as Order),
          update: changes.filter(c => c.type === 'update').map(c => ({ ...c.item, ...c.data }) as Order),
          remove: changes.filter(c => c.type === 'remove').map(c => c.rowKey),
        });
      }, 1_200)));
    },
  };
};

export default (host: HTMLElement) => {
  const grid = createGrid(host, 380);
  const orders = makeOrders(100);
  const server = createServer(orders.length + 1);

  grid.keyExpr = 'id';
  grid.editMode = 'batch';
  grid.allowEditing = true;
  grid.allowAdding = true;
  grid.allowRemoving = true;
  grid.columns = [
    { path: 'id', label: 'Order', width: 90, dataType: 'number', editable: false },
    { path: 'customer', label: 'Customer', width: 190, validationRules: [{ type: 'required' }] },
    { path: 'status', label: 'Status', width: 130 },
    { path: 'quantity', label: 'Qty', width: 100, dataType: 'number', validationRules: [{ type: 'range', min: 1 }] },
    { path: 'orderDate', label: 'Date', width: 150, dataType: 'date' },
  ];
  grid.items = orders;

  const count = stat(`${orders.length} rows saved`);
  const log = eventLog(host);

  grid.addEventListener('u-grid-row-adding', event => {
    Object.assign(event.detail.data, { status: 'Pending', quantity: 1, orderDate: new Date() });
  });

  grid.addEventListener('u-grid-saving', event => {
    const summary = event.detail.changes.map(change => `${change.type} ${typeof change.rowKey === 'number' ? `#${change.rowKey}` : '(new)'}`);
    log.write(`u-grid-saving  ${summary.join(', ')}  — waiting for the server…`);
    event.detail.waitUntil(server.save(event.detail.changes));
  });

  grid.addEventListener('u-grid-save', event => {
    // Keep the new array in your state: it is what the grid shows now.
    const items = event.detail.items as Order[];
    count.textContent = `${items.length} rows saved`;
    log.write(`u-grid-save  ${event.detail.changes.length} change(s) applied`);
  });

  grid.addEventListener('u-grid-save-error', event => {
    log.write(`u-grid-save-error  ${String((event.detail.error as Error).message)}  (changes are still pending)`);
  });

  controls(host,
    button('Add row', () => grid.addRow()),
    button('Save changes', () => grid.saveChanges()),
    button('Discard changes', () => grid.discardChanges()),
    button('Make the next save fail', () => {
      server.failNextSave();
      log.write('The next save will fail.');
    }),
    count);

  return () => server.dispose();
};
