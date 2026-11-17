import { html } from 'lit';

export const template = (data: any[], columnsCount = 4) =>
  html`<dev-root initialData="${JSON.stringify(data)}" columns-count=${columnsCount}></dev-root>`;
