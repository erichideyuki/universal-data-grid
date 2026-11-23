/**
 * Área de transferência (frente 12): decide se o evento nativo `copy`
 * (Ctrl/Cmd+C, menu Editar) é do grid e escreve TSV + HTML nele. O grid
 * escuta `copy` na própria tabela (binding do Lit: sai com o DOM, sem
 * listener global).
 */
import type { ClipboardContent } from '../export/write.js';

/**
 * `copy` (default): Ctrl/Cmd+C copies the cell ranges, the selected rows or
 * the focused cell; `copy-paste`: also Ctrl/Cmd+V pastes into editable cells
 * (needs `allowEditing`); `none`: the grid does not touch the clipboard. May
 * gain members in minor versions.
 */
export type GridClipboardMode = 'copy' | 'copy-paste' | 'none';

/** Campos editáveis (nativos e widgets ARIA dentro da célula, spec 17): a cópia é deles. */
const EDITABLE = 'input, textarea, select, [role=textbox], [role=combobox], [role=spinbutton], [role=searchbox]';

interface SelectionRoot {
  getSelection?: () => Selection | null;
}

const isRange = (selection: Selection | null | undefined): selection is Selection =>
  !!selection && !selection.isCollapsed && selection.toString() !== '';

/**
 * O usuário selecionou texto DENTRO do grid? Seleção esquecida em outro
 * ponto da página não conta (o Chromium a mantém ao entrar no grid por Tab).
 */
export const hasTextSelection = (root: ShadowRoot): boolean => {
  if (isRange((root as unknown as SelectionRoot).getSelection?.())) {
    return true;
  }

  const selection = root.ownerDocument.getSelection();
  // No documento, uma seleção dentro do shadow root aparece reapontada para o hospedeiro.
  const inside = (node: Node | null): boolean => !!node && (node === root.host || root.contains(node) || root.host.contains(node));

  return isRange(selection) && (inside(selection.anchorNode) || inside(selection.focusNode));
};

/** Algum elemento do caminho, até a tabela, é editável? (shadow roots aninhados do renderer incluídos) */
const isEditablePath = (path: readonly EventTarget[], table: HTMLElement): boolean => {
  for (const node of path) {
    if (node === table) {
      return false;
    }

    if (node instanceof HTMLElement && (node.isContentEditable || node.matches(EDITABLE))) {
      return true;
    }
  }

  return false;
};

/**
 * O `copy` é do grid: veio de uma célula/linha da tabela (não de um campo
 * editável — linha de filtro, busca) e o usuário não selecionou texto (aí
 * a cópia nativa segue).
 */
export const isGridCopy = (event: Event, table: HTMLElement, root: ShadowRoot): boolean => {
  if (event.type === 'copy' && !(event as ClipboardEvent).clipboardData) {
    return false;
  }

  const path = event.composedPath();

  return path.includes(table) && !isEditablePath(path, table) && !hasTextSelection(root);
};

/** Escreve o conteúdo no evento (o chamador já decidiu cancelar a cópia nativa). */
export const writeClipboard = (data: DataTransfer, content: ClipboardContent): void => {
  data.setData('text/plain', content.text);

  if (content.html) {
    data.setData('text/html', content.html);
  }
};
