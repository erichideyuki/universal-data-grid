/**
 * Manifesto de custom elements (`npm run analyze`). Só os módulos da API
 * pública entram (spec 15); membros `@internal` ficam de fora, e os caminhos
 * apontam para o `dist/` publicado, não para o `src/`.
 */
const toDist = path => path.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js');

/** Remove do manifesto o que estiver marcado `@internal` no JSDoc e os membros `#private`. */
const stripInternal = () => ({
  name: 'strip-internal',
  analyzePhase({ ts, node, moduleDoc }) {
    if (!ts.isClassDeclaration(node) && !ts.isVariableStatement(node) && !ts.isFunctionDeclaration(node)) {
      return;
    }

    const isInternal = member => ts.getJSDocTags(member).some(tag => tag.tagName.text === 'internal');
    const nameOf = member => member.name?.getText?.();

    if (ts.isClassDeclaration(node)) {
      const className = node.name?.getText();
      const declaration = moduleDoc.declarations?.find(d => d.name === className);

      if (!declaration) {
        return;
      }

      if (isInternal(node)) {
        moduleDoc.declarations = moduleDoc.declarations.filter(d => d !== declaration);
        moduleDoc.exports = moduleDoc.exports?.filter(e => e.declaration?.name !== className);
        return;
      }

      // `@internal` e `#private` não são API.
      const internal = new Set(node.members.filter(isInternal).map(nameOf));
      declaration.members = declaration.members?.filter(member => !internal.has(member.name) && !member.name.startsWith('#'));
      return;
    }

    const names = ts.isVariableStatement(node)
      ? node.declarationList.declarations.map(d => d.name.getText())
      : [node.name?.getText()];

    if (isInternal(node)) {
      moduleDoc.declarations = moduleDoc.declarations?.filter(d => !names.includes(d.name));
      moduleDoc.exports = moduleDoc.exports?.filter(e => !names.includes(e.declaration?.name));
    }
  },
});

/**
 * Atributos antigos ainda aceitos (aliases com aviso, spec 15). Espelha os
 * `LEGACY_ATTRIBUTES` de `src/grid.ts` e `src/grid-column.ts`.
 */
const LEGACY_ATTRIBUTES = {
  DataGrid: { rowheight: 'row-height', showrowlines: 'show-row-lines', showcolumnlines: 'show-column-lines' },
  DataGridColumn: { 'data-type': 'type' },
};

/**
 * Acabamento do manifesto: caminhos `src/x.ts` → `dist/x.js` (também nos
 * `./x.js` relativos dos `exports`), `exports` só de módulos que estão no
 * manifesto, aliases de atributo como `deprecated` e descrições só com LF
 * (os fontes em CRLF levariam CR e o manifesto mudaria conforme o SO).
 */
const finishManifest = () => ({
  name: 'finish-manifest',
  packageLinkPhase({ customElementsManifest }) {
    const modules = customElementsManifest.modules;

    const visit = (value, base) => {
      if (Array.isArray(value)) {
        value.forEach(child => visit(child, base));
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (typeof child !== 'string') {
            visit(child, base);
          } else if (key === 'path') {
            value[key] = toDist(child);
          } else if (key === 'module') {
            value[key] = toDist(child.startsWith('./') ? `${base}/${child.slice(2)}` : child);
          } else if (child.includes('\r')) {
            value[key] = child.replace(/\r\n?/g, '\n');
          }
        }
      }
    };

    for (const module of modules) {
      visit(module, module.path.slice(0, module.path.lastIndexOf('/')));
    }

    const known = new Set(modules.map(module => module.path));

    for (const module of modules) {
      module.exports = module.exports?.filter(entry => !entry.declaration?.module || known.has(entry.declaration.module));

      for (const declaration of module.declarations ?? []) {
        const legacy = LEGACY_ATTRIBUTES[declaration.name];

        for (const [name, replacement] of Object.entries(legacy ?? {})) {
          const current = declaration.attributes?.find(attribute => attribute.name === replacement);
          declaration.attributes.push({
            name,
            type: current?.type,
            description: `Deprecated alias of \`${replacement}\`.`,
            deprecated: `Use \`${replacement}\`.`,
            fieldName: current?.fieldName,
          });
        }
      }
    }
  },
});

export default {
  globs: ['src/grid.ts', 'src/grid-column.ts', 'src/grid-column-def.ts', 'src/grid-i18n.ts'],
  exclude: ['src/**/*.test.ts', 'src/test/**'],
  outdir: '.',
  litelement: true,
  plugins: [stripInternal(), finishManifest()],
};
