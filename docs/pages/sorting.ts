import type { DocPage } from '../site/types.js';

export default {
  title: 'Sorting',
  intro: 'Click a header to sort; with `sortMode = \'multiple\'` **Shift+click** adds columns to the sort. The initial sort comes from the columns (`sortOrder`, `sortIndex`); after that it is grid state, driven by the user or by `sortColumn()` / `clearSorting()`. Your `items` array is never mutated.',
  readme: '#sorting',
  examples: ['multi-sort', 'api-events', 'comparator'],
} satisfies DocPage;
