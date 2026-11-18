/**
 * Conteúdo interativo das células (spec 17, A12). O grid tem um ponto de Tab
 * só (roving tabindex da APG): links, botões e campos devolvidos por
 * `renderer` saem da ordem de Tab (`tabindex="-1"`). Enter/F2 na célula
 * entram neles, Tab/Shift+Tab circulam entre eles e Esc volta à célula.
 * Custom elements com shadow root (ex.: um botão do Material Web) recebem o
 * `tabindex="-1"` no hospedeiro, o que tira a árvore sombra da ordem de Tab.
 * Conteúdo inserido depois do render (assíncrono) não é alcançado.
 */

/** Seletor do que é focável por Tab. */
export const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Elementos que o grid tirou da ordem de Tab (continuam alvo de Enter/F2). */
const demoted = new WeakSet<Element>();

/**
 * Custom element com árvore sombra que recebe foco (\`delegatesFocus\` ou um
 * focável lá dentro). Decorativos (ícone, selo, avatar) ficam como estão: com
 * \`tabindex\` virariam alvo de clique e de Enter sem papel nem nome.
 */
const isFocusableShadowHost = (element: Element): boolean =>
  element.localName.includes('-')
  && !!element.shadowRoot
  && (element.shadowRoot.delegatesFocus || !!element.shadowRoot.querySelector(TABBABLE));

/** Tira `root` e seus descendentes focáveis da ordem de Tab. */
export const demoteFocusables = (root: Element): void => {
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.matches(TABBABLE) || isFocusableShadowHost(element)) {
      element.setAttribute('tabindex', '-1');
      demoted.add(element);
    }
  }
};

const isFocusTarget = (element: Element): boolean =>
  (element.matches(TABBABLE) || demoted.has(element)) && !element.closest('[aria-hidden="true"]');

/**
 * Rebaixa agora e de novo depois que os custom elements do conteúdo
 * desenharem (Lit desenha num microtask: o focável interno ainda não existe).
 */
export const demoteRendererContent = (root: Element): void => {
  demoteFocusables(root);
  const hosts = [root, ...root.querySelectorAll('*')].filter(element => element.localName.includes('-'));

  if (hosts.length) {
    const updates = hosts.map(host => (host as Element & { updateComplete?: Promise<unknown> }).updateComplete ?? Promise.resolve());
    void Promise.all(updates).then(() => {
      if (root.isConnected) {
        demoteFocusables(root);
      }
    });
  }
};

/** Alvos de foco da célula, em ordem (inclusive o projetado por `renderer`). */
export const focusTargetsWithin = (cell: HTMLElement): (HTMLElement | SVGElement)[] => {
  const slotted = [...cell.querySelectorAll('slot')].flatMap(slot => slot.assignedElements({ flatten: true }));
  const targets: (HTMLElement | SVGElement)[] = [];

  for (const root of [cell, ...slotted]) {
    const candidates = root === cell ? root.querySelectorAll('*') : [root, ...root.querySelectorAll('*')];

    for (const target of candidates) {
      if ((target instanceof HTMLElement || target instanceof SVGElement) && isFocusTarget(target)) {
        targets.push(target);
      }
    }
  }

  return targets;
};

/** Enter/F2: foca o 1º elemento interativo da célula. */
export const focusFirstWithin = (cell: HTMLElement): boolean => {
  const target = focusTargetsWithin(cell)[0];
  target?.focus();
  return !!target;
};

/**
 * Tab/Shift+Tab dentro do conteúdo da célula: circula entre os alvos dela
 * (a APG põe Tab no próximo widget; sem isso o 2º botão ficaria inalcançável).
 * Devolve `true` quando moveu o foco.
 */
export const cycleWithin = (cell: HTMLElement, current: Element, backward: boolean): boolean => {
  const targets = focusTargetsWithin(cell);

  if (targets.length < 2) {
    return false;
  }

  // O foco pode estar dentro da árvore sombra de um alvo (custom element).
  const index = targets.findIndex(target => target === current || target.contains(current) || target.shadowRoot?.contains(current));
  const next = targets[(index + (backward ? -1 : 1) + targets.length) % targets.length];
  next.focus();
  return true;
};
