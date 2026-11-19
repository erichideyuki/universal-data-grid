import type { DocPage } from '../site/types.js';

export default {
  title: 'Real-time updates',
  intro: 'Stream changes into the grid without reloading: `applyChanges({ add, update, remove })` patches loaded rows by key, or assign a new immutable `items` array and the grid keeps selection, focus and expansion by `keyExpr`. Only the rows on screen re-render, so hundreds of updates per second stay smooth.',
  readme: '#refreshing-and-incremental-changes',
  examples: ['ticker', 'live-feed', 'immutable'],
} satisfies DocPage;
