import type { DocPage } from '../site/types.js';

export default {
  title: 'Tree data',
  intro: 'Set `treeMode` and every row becomes a node with an indent and an expand button: `nested` reads children arrays, `flat` links rows by `keyExpr` + `parentKeyExpr`. Filtering, search, sorting, summaries, selection and virtualization keep working, and children can load on demand from a `dataSource`.',
  readme: '#tree-data',
  examples: ['nested', 'flat', 'load-on-demand'],
} satisfies DocPage;
