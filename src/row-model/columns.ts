/**
 * Bandas (frente 13): árvore de colunas, ordem das folhas e linhas do
 * cabeçalho multinível. Funções puras, sem DOM.
 *
 * O estado de ordem do grid continua uma lista PLANA de folhas
 * (`_regularColumns`); a ordem das bandas é a da primeira folha de cada uma.
 * `normalizeLeafOrder` garante que as folhas de cada banda fiquem juntas
 * (invariante de que o cabeçalho depende para o `colspan`).
 */

/**
 * Nome da coluna em texto fora do cabeçalho (menus, chip, seletor, linha
 * adaptativa, anúncios, exportação) e no cabeçalho sem `headerRenderer`:
 * `label`, senão `path`, senão `name`, crus (sem humanizar: texto em inglês
 * gerado do campo num grid de 14 idiomas seria pior que o id). `||`, não
 * `??`: o `label` de `<u-grid-column>` é `''` quando vazio. Não usar na
 * identidade de grupo (`group.ts`): a chave mudaria.
 */
export const columnText = (column: { label?: string | null; path?: string | null; name?: string | null }): string =>
  column.label || column.path || column.name || '';

/**
 * Texto VISÍVEL do cabeçalho sem `headerRenderer`: `label`, senão `path`,
 * senão o `name` da coluna calculada (`valueGetter`; spec 28: filtrável e
 * ordenável, não pode ficar sem nome). Coluna só de `renderer` (ações,
 * "select") com `name` de estado mantém o cabeçalho vazio, como antes.
 */
export const headerText = (column: {
  label?: string | null;
  path?: string | null;
  name?: string | null;
  valueGetter?: unknown;
}): string =>
  column.label || column.path || (column.valueGetter ? column.name || '' : '');

/**
 * Textos de `true`/`false` de uma coluna: os dela (`trueText`/`falseText`) ou
 * os do idioma. Vazio também cai no idioma: o ícone e o `check` precisam de
 * um nome acessível, e uma célula sem texto não diria nada ao leitor de tela.
 */
export const booleanTexts = (
  column: { trueText?: string | null; falseText?: string | null } | undefined,
  translation: { trueText: string; falseText: string },
): { trueText: string; falseText: string } => ({
  trueText: column?.trueText || translation.trueText,
  falseText: column?.falseText || translation.falseText,
});

/** O que a árvore precisa de uma coluna: os filhos, quando é banda. */
export interface TreeColumn {
  columns?: readonly unknown[] | null;
}

export interface ColumnTree<C> {
  /** Colunas do nível de cima, na ordem da definição. */
  readonly roots: readonly C[];
  /** Banda que contém a coluna (`null` no nível de cima). */
  readonly parentOf: ReadonlyMap<C, C | null>;
  /** Filhos de cada banda, na ordem da definição. */
  readonly childrenOf: ReadonlyMap<C, readonly C[]>;
  /** Folhas na ordem da definição (busca em profundidade). */
  readonly leaves: readonly C[];
  /** Todas as bandas (também as vazias). */
  readonly bands: readonly C[];
  /** Profundidade máxima de bandas acima de uma folha (0 = sem bandas). */
  readonly maxBandDepth: number;
}

/** A coluna é banda (`columns` com pelo menos 1 item; `[]` = folha). */
export const isBandColumn = (column: TreeColumn | null | undefined): boolean =>
  !!column && Array.isArray(column.columns) && column.columns.length > 0;

/**
 * Monta a árvore. Uma coluna repetida (o mesmo objeto em dois lugares ou um
 * ciclo) só vale na primeira vez em que aparece.
 */
export const buildColumnTree = <C extends TreeColumn>(definitions: readonly C[]): ColumnTree<C> => {
  const parentOf = new Map<C, C | null>();
  const childrenOf = new Map<C, readonly C[]>();
  const leaves: C[] = [];
  const bands: C[] = [];
  let maxBandDepth = 0;

  const visit = (columns: readonly C[], parent: C | null, depth: number): C[] => {
    const accepted: C[] = [];

    for (const column of columns) {
      if (!column || typeof column !== 'object' || parentOf.has(column)) {
        continue;
      }

      parentOf.set(column, parent);
      accepted.push(column);

      if (isBandColumn(column)) {
        bands.push(column);
        childrenOf.set(column, visit(column.columns as readonly C[], column, depth + 1));
      } else {
        leaves.push(column);
        maxBandDepth = Math.max(maxBandDepth, depth);
      }
    }

    return accepted;
  };

  const roots = visit(definitions, null, 0);

  return { roots, parentOf, childrenOf, leaves, bands, maxBandDepth };
};

/** Bandas acima da coluna, da de cima para a mais próxima. */
export const ancestorsOf = <C>(tree: ColumnTree<C>, column: C): C[] => {
  const chain: C[] = [];
  let parent = tree.parentOf.get(column) ?? null;

  while (parent) {
    chain.unshift(parent);
    parent = tree.parentOf.get(parent) ?? null;
  }

  return chain;
};

/** Coluna do nível de cima que contém `column` (ela mesma, se já é de cima). */
export const rootOf = <C>(tree: ColumnTree<C>, column: C): C => {
  let current = column;
  let parent = tree.parentOf.get(current) ?? null;

  while (parent) {
    current = parent;
    parent = tree.parentOf.get(current) ?? null;
  }

  return current;
};

/**
 * Reordena `flat` (folhas) para que as folhas de cada banda fiquem juntas:
 * irmãos na ordem da primeira folha de cada um em `flat` (ou pela posição
 * dada em `rank`), recursivamente. Folhas fora da árvore ficam de fora;
 * bandas sem folha em `flat` somem.
 */
export const normalizeLeafOrder = <C>(
  flat: readonly C[],
  tree: ColumnTree<C>,
  rank?: ReadonlyMap<C, number>,
): C[] => {
  if (!tree.bands.length && !rank) {
    return flat.filter(column => tree.parentOf.has(column));
  }

  const position = new Map<C, number>();
  flat.forEach((column, index) => position.set(column, index));

  const firstPosition = new Map<C, number>();

  const first = (column: C): number => {
    const known = firstPosition.get(column);

    if (known !== undefined) {
      return known;
    }

    let value = Infinity;
    const children = tree.childrenOf.get(column);

    if (children) {
      for (const child of children) {
        value = Math.min(value, first(child));
      }
    } else {
      value = position.get(column) ?? Infinity;
    }

    firstPosition.set(column, value);
    return value;
  };

  const result: C[] = [];

  const emit = (columns: readonly C[]): void => {
    const present = columns
      .filter(column => first(column) !== Infinity)
      .map(column => ({ column, key: rank?.get(column) ?? first(column) }))
      .sort((a, b) => a.key - b.key || first(a.column) - first(b.column));

    for (const { column } of present) {
      const children = tree.childrenOf.get(column);

      if (children) {
        emit(children);
      } else {
        result.push(column);
      }
    }
  };

  emit(tree.roots);
  return result;
};

/** Irmãos presentes em `flat` (com alguma folha), na ordem atual. */
export const orderedSiblings = <C>(flat: readonly C[], tree: ColumnTree<C>, parent: C | null): C[] => {
  const siblings = parent ? tree.childrenOf.get(parent) ?? [] : tree.roots;
  const order = normalizeLeafOrder(flat, tree);
  const position = new Map<C, number>();
  order.forEach((column, index) => position.set(column, index));

  const firstOf = (column: C): number => {
    const children = tree.childrenOf.get(column);

    if (!children) {
      return position.get(column) ?? Infinity;
    }

    return Math.min(Infinity, ...children.map(firstOf));
  };

  return siblings
    .map(column => ({ column, first: firstOf(column) }))
    .filter(entry => entry.first !== Infinity)
    .sort((a, b) => a.first - b.first)
    .map(entry => entry.column);
};

/**
 * Move `column` (folha ou banda) para a posição `targetIndex` entre os
 * próprios irmãos presentes em `flat`; devolve a nova lista plana. A coluna
 * nunca sai da própria banda.
 */
export const moveAmongSiblings = <C>(flat: readonly C[], tree: ColumnTree<C>, column: C, targetIndex: number): C[] => {
  const parent = tree.parentOf.get(column) ?? null;
  const siblings = orderedSiblings(flat, tree, parent);
  const from = siblings.indexOf(column);

  if (from < 0) {
    return [...flat];
  }

  // Mesma regra do `moveColumn` sem bandas: vai para antes de quem está em `targetIndex`.
  const target = siblings[targetIndex];

  if (target === column) {
    return normalizeLeafOrder(flat, tree);
  }

  siblings.splice(from, 1);
  const insertAt = target ? siblings.indexOf(target) : siblings.length;
  siblings.splice(insertAt, 0, column);

  const rank = new Map<C, number>();
  siblings.forEach((sibling, index) => rank.set(sibling, index));

  return normalizeLeafOrder(flat, tree, rank);
};

// ------------------------------------------------------ cabeçalho multinível

/** Posição do cabeçalho: uma coluna folha (com as bandas acima) ou um espaçador. */
export interface HeaderSlot<C> {
  /** Folha da posição; `null` = espaçador (colunas fora do DOM). */
  readonly leaf: C | null;
  /** Bandas acima, da de cima para a mais próxima. */
  readonly chain: readonly C[];
}

export interface HeaderCellLayout<C> {
  /** Banda, folha ou `null` (espaçador). */
  readonly column: C | null;
  readonly band: boolean;
  /** Nível de cima da célula (0 = 1ª linha do cabeçalho). */
  readonly level: number;
  readonly rowSpan: number;
  /** Primeira posição coberta e quantas. */
  readonly start: number;
  readonly span: number;
}

/**
 * Linhas do cabeçalho (`depth` níveis): banda com `colspan` = posições
 * seguidas sob ela; folha (e espaçador) no nível logo abaixo da última banda,
 * com `rowspan` até o fim. Posições seguidas da mesma banda viram uma célula.
 */
export const buildHeaderRows = <C>(slots: readonly HeaderSlot<C>[], depth: number): HeaderCellLayout<C>[][] => {
  const levels = Math.max(depth, 1);
  const rows: HeaderCellLayout<C>[][] = Array.from({ length: levels }, () => []);

  for (let level = 0; level < levels; level++) {
    const row = rows[level];
    let open: { column: C; start: number; span: number } | null = null;

    const close = (): void => {
      if (open) {
        row.push({ column: open.column, band: true, level, rowSpan: 1, start: open.start, span: open.span });
        open = null;
      }
    };

    slots.forEach((slot, index) => {
      const chain = slot.chain;

      if (level < chain.length) {
        const band = chain[level];

        // Mesma banda E mesmos ancestrais (a mesma banda nunca aparece em dois ramos).
        if (open && open.column === band && open.start + open.span === index) {
          open.span++;
        } else {
          close();
          open = { column: band, start: index, span: 1 };
        }

        return;
      }

      close();

      if (level === chain.length) {
        row.push({ column: slot.leaf, band: false, level, rowSpan: levels - level, start: index, span: 1 });
      }
    });

    close();
  }

  return rows;
};

/** Célula que cobre (nível, posição): para a navegação espacial entre níveis. */
export const headerCellAt = <C>(rows: readonly HeaderCellLayout<C>[][], level: number, index: number): HeaderCellLayout<C> | undefined => {
  for (let current = Math.min(level, rows.length - 1); current >= 0; current--) {
    const cell = rows[current].find(candidate => index >= candidate.start && index < candidate.start + candidate.span);

    if (cell) {
      return cell.level + cell.rowSpan > level ? cell : undefined;
    }
  }

  return undefined;
};
