/**
 * Textos da i18n para a exportação sem grid (`exportPdf(data)`): a tabela de
 * `grid-i18n.ts`, lida pelo símbolo que o módulo do grid registra ao carregar
 * (assim os bundles autocontidos não arrastam a tabela nem o @lit/context, e
 * usam as traduções de `setGridTranslation`). Sem o grid carregado, inglês.
 */
import type { GridI18n } from '../grid-i18n.js';

/** Os textos que a exportação usa. */
export type ExportTexts = Pick<GridI18n, 'exportDefaultTitle' | 'pdfPageNumber' | 'adaptiveLabelSeparator' | 'pdfTotalRow'>;

/** Os de `en` em `grid-i18n.ts` (só quando o grid não foi carregado). */
const ENGLISH: ExportTexts = {
  exportDefaultTitle: 'Data',
  pdfPageNumber: 'Page {page} of {pageCount}',
  adaptiveLabelSeparator: ': ',
  pdfTotalRow: 'Total',
};

export const exportTranslation = (language: string): ExportTexts => {
  // eslint-disable-next-line no-undef -- `globalThis` (ES2020; também no SSR) falta nos globais do lint
  const resolve = (globalThis as Record<symbol, unknown>)[Symbol.for('u-grid-resolve-translation')];
  return typeof resolve === 'function' ? (resolve as (language: string) => GridI18n)(language) : ENGLISH;
};
