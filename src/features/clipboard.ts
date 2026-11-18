/**
 * Área de transferência (frente 12): decide se o evento nativo `copy`
 * (Ctrl/Cmd+C, menu Editar) é do grid e escreve TSV + HTML nele. O grid
 * escuta `copy` na própria tabela (binding do Lit: sai com o DOM, sem
 * listener global).
 */
import type { ClipboardContent } from '../export/write.js';

/** `copy` (default): Ctrl/Cmd+C copies the selected rows or the focused cell; `none`: the grid does not touch the clipboard. */
export type GridClipboardMode = 'copy' | 'none';

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

interface SelectionRoot {
  getSelection?: () => Selection | null;
}

/** Há texto selecionado pelo usuário (no documento ou no shadow root do grid)? */
const hasTextSelection = (root: ShadowRoot): boolean => {
  const inShadow = (root as unknown as SelectionRoot).getSelection?.();
  const inDocument = root.ownerDocument.getSelection();

  return [inShadow, inDocument].some(selection => !!selection && !selection.isCollapsed && selection.toString() !== '');
};

/**
 * O `copy` é do grid: veio de uma célula/linha da tabela (não de um campo
 * editável — linha de filtro, busca) e o usuário não selecionou texto (aí
 * a cópia nativa segue).
 */
export const isGridCopy = (event: ClipboardEvent, table: HTMLTableElement, root: ShadowRoot): boolean => {
  if (!event.clipboardData) {
    return false;
  }

  const target = event.composedPath()[0];

  if (!(target instanceof Element) || !table.contains(target) || target.closest(EDITABLE)) {
    return false;
  }

  return !hasTextSelection(root);
};

/** Escreve o conteúdo no evento (o chamador já decidiu cancelar a cópia nativa). */
export const writeClipboard = (data: DataTransfer, content: ClipboardContent): void => {
  data.setData('text/plain', content.text);

  if (content.html) {
    data.setData('text/html', content.html);
  }
};
