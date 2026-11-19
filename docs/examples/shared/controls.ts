/**
 * Tiny DOM helpers for the demo controls above each grid (buttons, selects, an event log).
 * They are plain DOM; the grid itself does not need any of this.
 */

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
};

/** A row of controls, prepended to `host`. */
export const controls = (host: HTMLElement, ...children: (Node | string)[]) => {
  const bar = el('div', { className: 'demo-controls' }, ...children);
  host.prepend(bar);
  return bar;
};

export const button = (text: string, onClick: (event: MouseEvent) => void, props: Partial<HTMLButtonElement> = {}) => {
  const node = el('button', { type: 'button', ...props }, text);
  node.addEventListener('click', onClick);
  return node;
};

export const select = <T extends string>(label: string, options: readonly (T | readonly [T, string])[], value: T, onChange: (value: T) => void) => {
  const node = el('select');

  for (const option of options) {
    const [optionValue, text] = typeof option === 'string' ? [option, option] : option;
    node.append(el('option', { value: optionValue, selected: optionValue === value }, text));
  }

  node.addEventListener('change', () => onChange(node.value as T));
  return el('label', {}, label, node);
};

export const checkbox = (label: string, checked: boolean, onChange: (checked: boolean) => void) => {
  const input = el('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', {}, input, label);
};

export const stat = (text = '') => el('span', { className: 'demo-stat', role: 'status' }, text);

/** An event log below the grid: `log.write('…')` adds a line at the top. */
export const eventLog = (host: HTMLElement) => {
  const node = el('pre', { className: 'demo-log', ariaLabel: 'Event log', tabIndex: 0 });
  host.append(node);

  return {
    node,
    write(line: string) {
      node.prepend(`${new Date().toLocaleTimeString()}  ${line}\n`);

      while (node.childNodes.length > 50) {
        node.lastChild!.remove();
      }
    },
  };
};

/** Creates a `<u-grid>` with a fixed height and appends it to `host`. */
export const createGrid = (host: HTMLElement, height = 420) => {
  const grid = document.createElement('u-grid');
  grid.style.height = `${height}px`;
  host.append(grid);
  return grid;
};
