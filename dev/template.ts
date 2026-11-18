import { html } from 'lit';

export const template = (data: any[], columnsCount = 4, bands = false) =>
  html`<dev-root initialData="${JSON.stringify(data)}" columns-count=${columnsCount} ?bands=${bands}></dev-root>`;
