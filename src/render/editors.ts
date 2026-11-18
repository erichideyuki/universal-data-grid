import { html, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';

import type { EditorKind } from '../features/editing.js';

/** O que o editor embutido precisa (frente 09). */
export interface BuiltInEditor {
  kind: EditorKind;
  /** Texto do campo (`kind` ≠ `boolean`). */
  text: string;
  /** Caixa marcada (`boolean`; `null` = indeterminada). */
  checked: boolean | null;
  /** Nome acessível (rótulo da coluna). */
  label: string;
  invalid: boolean;
  /** Ids para `aria-describedby` (erro, estado da linha). */
  describedBy: string;
  /** Formato esperado do número (WCAG 3.3.2), em `title`/descrição. */
  placeholder?: string;
  onInput: (event: Event) => void;
  onChange: (event: Event) => void;
}

/**
 * Editor embutido por tipo: texto, número (texto com `inputmode=decimal`, no
 * separador do idioma), data (`date`/`datetime-local`) e booleano (caixa).
 * `live()`: o valor do DOM é o do usuário até o grid mandar outro.
 */
export const renderBuiltInEditor = (editor: BuiltInEditor): TemplateResult => {
  const describedBy = editor.describedBy || undefined;

  if (editor.kind === 'boolean') {
    return html`<input
      class="cell-editor cell-editor-checkbox"
      part="cell-editor"
      type="checkbox"
      aria-label=${editor.label}
      aria-invalid=${editor.invalid ? 'true' : 'false'}
      aria-describedby=${ifDefined(describedBy)}
      .checked=${live(editor.checked === true)}
      .indeterminate=${live(editor.checked === null)}
      @change=${editor.onChange}>`;
  }

  const type = editor.kind === 'date' ? 'date' : editor.kind === 'datetime' ? 'datetime-local' : 'text';

  return html`<input
    class="cell-editor"
    part="cell-editor"
    type=${type}
    inputmode=${ifDefined(editor.kind === 'number' ? 'decimal' : undefined)}
    autocomplete="off"
    spellcheck=${editor.kind === 'text' ? 'true' : 'false'}
    placeholder=${ifDefined(editor.placeholder)}
    aria-label=${editor.label}
    aria-invalid=${editor.invalid ? 'true' : 'false'}
    aria-describedby=${ifDefined(describedBy)}
    .value=${live(editor.text)}
    @input=${editor.onInput}
    @change=${editor.onChange}>`;
};
