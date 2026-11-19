import type { DocPage } from '../site/types.js';

export default {
  title: 'Filtering',
  intro: 'Three filter UIs — the **filter row**, the **search panel** and the **header filter** — all off by default and all writing to one serializable expression, `filterValue`, in the same array shape as DevExtreme. Set it from code to filter programmatically; read it to save the user\'s filter.',
  readme: '#filtering',
  examples: ['filter-ui', 'expressions', 'column-options'],
} satisfies DocPage;
