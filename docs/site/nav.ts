/** Menu lateral: seções e a ordem das páginas (`docs/pages/<id>.ts`). */
export const NAV: readonly { title: string; pages: readonly string[] }[] = [
  { title: 'Getting started', pages: ['overview'] },
  { title: 'Columns', pages: ['data-types', 'column-features', 'bands', 'responsive'] },
  { title: 'Data shaping', pages: ['sorting', 'filtering', 'grouping', 'summaries', 'tree-data'] },
  { title: 'Data & performance', pages: ['data-sources', 'real-time', 'big-data'] },
  { title: 'Interaction', pages: ['selection', 'editing', 'toolbar-menus', 'export', 'state'] },
  { title: 'Customization', pages: ['templates', 'i18n', 'theming'] },
];
