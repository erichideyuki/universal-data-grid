import { html, nothing, render } from 'lit';

import { describe, expect, it } from 'vitest';

import { keyedRows } from './keyed-rows.js';

const comments = (node: Node): number =>
  [...node.childNodes].filter(child => child.nodeType === Node.COMMENT_NODE).length;

const draw = (host: HTMLElement, keys: number[] | null): void => {
  render(html`<ul>${keys
    ? keyedRows(keys, key => key, key => html`<li data-key=${key}>${key}</li>`)
    : html`<li class="empty">empty</li>`}</ul>`, host);
};

const shown = (host: HTMLElement): string[] =>
  [...host.querySelectorAll('li')].map(li => li.textContent);

describe('keyedRows (spec 14)', () => {
  it('janela deslizante: não deixa marcadores para trás (o repeat do Lit deixa)', () => {
    const host = document.createElement('div');
    draw(host, [1, 2, 3, 4, 5]);
    const ul = host.querySelector('ul')!;
    const baseline = comments(ul);

    for (let start = 0; start < 200; start += 3) {
      draw(host, [start, start + 1, start + 2, start + 3, start + 4]);
    }

    expect(comments(ul)).toBe(baseline);
    expect(shown(host)).toEqual(['198', '199', '200', '201', '202']);
  });

  it('reaproveita o elemento da mesma chave e respeita a ordem nova', () => {
    const host = document.createElement('div');
    draw(host, [1, 2, 3]);
    const two = host.querySelector('[data-key="2"]');

    draw(host, [3, 2, 9, 1]);

    expect(shown(host)).toEqual(['3', '2', '9', '1']);
    expect(host.querySelector('[data-key="2"]')).toBe(two);
  });

  it('chaves repetidas e troca com outro conteúdo não deixam sobras', () => {
    const host = document.createElement('div');
    draw(host, [1, 1, 2]);
    expect(shown(host)).toEqual(['1', '1', '2']);

    draw(host, [2]);
    expect(shown(host)).toEqual(['2']);

    draw(host, null);
    expect(shown(host)).toEqual(['empty']);

    draw(host, [5, 6]);
    expect(shown(host)).toEqual(['5', '6']);
    expect(host.querySelector('.empty')).toBeNull();

    render(nothing, host);
  });
});
