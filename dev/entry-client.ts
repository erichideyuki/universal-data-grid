import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

setTimeout(() =>
  import('./dev-root'), 1000);
