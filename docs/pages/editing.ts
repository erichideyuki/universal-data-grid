import type { DocPage } from '../site/types.js';

export default {
  title: 'Editing',
  intro: 'Cells are edited in place, rows are added and deleted, and values are validated — but the grid **never mutates your items**: it keeps the pending changes by row key and hands them to you in `u-grid-saving`, then shows a new array with the changes applied.',
  readme: '#editing',
  examples: ['modes', 'validation', 'custom-editor', 'saving'],
} satisfies DocPage;
