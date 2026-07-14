import { html } from 'lit';

export const template = (data: any[]) =>
  html`<dev-root initialData="${JSON.stringify(data)}"></dev-root>`;
