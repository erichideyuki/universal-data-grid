# 01 — Fundação (Fase 0, sequencial)

## Objetivo

Deixar o repositório pronto para frentes em paralelo: testes automatizados,
os bugs da auditoria (`90-audit.md`) corrigidos, o `grid.ts` separado em row
model / render / controllers, e dependências e scripts limpos.

## Escopo (nesta ordem — cada passo é um commit)

### 1. Higiene de pacote e segurança (S1–S6, B22, B23)
- `express` e `@webcomponents/template-shadowroot` → `devDependencies`.
- `npm audit fix`; Vite ≥ 7.3.7, Rollup ≥ 4.59; avaliar remover
  `@universal-material/web` e `docs/` se não houver uso.
- `dev/server.js`: `listen(5173, 'localhost')`; dados do demo de
  `dev/population.json` (gerado uma vez da API, versionado) com a API como
  opção (`?remote`).
- Scripts: `build` = `tsc -p src`; remover `build:server` quebrado (ou
  apontar para `dev/entry-server.ts`); `typecheck`; `test`; `test:watch`.
- Corrigir os 2 erros do `tsc -p src` (TS5097, TS4111).
- Decidir com o usuário: canal de distribuição (privJS ou não) e o campo
  `license` (B23).

### 2. Infra de testes
- Vitest com dois projetos: `node` (`src/row-model/**/*.test.ts`) e
  `browser` (Vitest browser mode + Playwright Chromium,
  `src/**/*.browser.test.ts`).
- Helper `src/test/fixture.ts`: cria `<u-grid>`, define colunas/itens, espera
  `updateComplete` + um frame do virtualizador.
- Teste de SSR: `render()` do `@lit-labs/ssr` com colunas, grupos e idioma.
- Teste de regressão para CADA bug B1–B9 antes da correção (devem falhar).

### 3. Row model puro (`src/row-model/`)
- Extrair agrupamento, ordenação e achatamento para funções puras sem
  mutação. Entrada: `items`, `groupColumns`, `expandedKeys`; saída: `Row[]`.
- Agrupar = ordenar uma CÓPIA por todas as colunas de grupo e só então
  partir em grupos (corrige B5); grupos de nível > 0 são recalculados por
  inteiro a partir dos itens do pai já ordenados.
- `compare.ts`: comparador por tipo — número, `Date`, booleano, string com
  `Intl.Collator(language, { numeric: true, sensitivity: 'base' })`;
  `null`/`undefined` sempre primeiro (B8). A frente 02 estende com `dataType`.
- `value.ts`: `getValue(item, column)` tolera `path` ausente (B7) e é o único
  ponto que lê dado da linha (base de `calculateCellValue`).
- Chave de grupo: caminho de valores (`['Brasil', 2020]`) serializado de forma
  estável; expansão guardada num `Set` de chaves, sobrevive a troca de
  `items` (B14) e a reordenação.
- Sem `items` ou sem grupos de um nível: nunca indexar `groupsByLevel` sem
  checar (B6).

### 4. Colunas e ciclo de vida
- Duas origens explícitas: `columns` (propriedade) tem precedência; sem ela,
  os `<u-grid-column>` filhos. `connectedCallback`/`slotchange` só releem os
  filhos quando a origem é declarativa (B2).
- `disconnectedCallback` não mexe em `_columns` nem em arrays do hospedeiro
  (B3); só solta os listeners do `interactjs`.
- Ordem e grupo do usuário num estado interno (`#columnOrder`,
  `#groupOrder`, por referência de coluna), não em `_index`/`_groupIndex`
  escritos nos objetos do hospedeiro (B9). `groupIndex` da definição é só o
  valor inicial.
- `u-grid-column`: `renderer` com `attribute: false`; `label` com `trim()`
  (B17).

### 5. Render e controllers
- `render/`: header, body, group-row, cell, group-panel como funções de
  template.
- Virtualizador com `getItemKey` pela chave da linha (objeto/`keyExpr`) e
  `setOptions` em vez de mutar `options`; `measure()` quando `rowHeight` muda
  (B16).
- Listras pela posição real da linha de dados dentro do grupo (B11).
- "Sem dados" quando `rows.length === 0` (B12).
- Célula customizada refeita (B1, B13): o `<u-grid-custom-cell>` re-executa o
  renderer quando `item` ou `column` mudam (`willUpdate`), o nome do slot usa
  a CHAVE da linha + id estável da coluna (não índices), e não há
  `indexOf` por render. Avaliar a alternativa sem light DOM: o renderer pode
  devolver `TemplateResult` do Lit (renderizado direto na célula) além de
  `HTMLElement` — decidir com o usuário (ver spec 10).
- `features/column-dnd.ts` e `features/group-dnd.ts` como ReactiveControllers:
  `ref` com callback estável, registro por `WeakSet`, soltar o que saiu do DOM
  (B10). Posição antes/depois e indicador respeitando `dir` (B15).
- ARIA mínimo (o resto é da frente 05): `aria-rowcount` = linhas + cabeçalho,
  `aria-colindex` real na linha de grupo, botão de expandir como `<button>`
  com `aria-expanded` (B18).

### 6. Ajustes de API sem quebrar (B19–B21)
- `striped` (novo) com `stripped` como alias deprecado.
- `showGroupPanel` (novo) e `showColumnHeaders` (novo); `showHeader` vira alias
  de `showGroupPanel`, deprecado.
- `grid-i18n.ts`: tabela com `Object.hasOwn`/`Object.create(null)`; observar
  `<html lang>` com um `MutationObserver` único compartilhado entre os grids
  (só quando o idioma não vem de `language` nem do context).

## Fora de escopo
Qualquer recurso novo (ordenação por clique, filtro, seleção…) — são as
frentes 02+.

## Arquivos
Praticamente todos de `src/`, `package.json`, `dev/server.js`,
`dev/entry-server.ts`, README (só API renomeada e nota do `renderer`).

## Testes
- Regressão de B1–B9, B11, B12, B14, B16 no navegador; B5, B6, B7, B8 também
  no row model em Node.
- B10: contar registros do controller depois de 200 renders → constante.
- Snapshot de SSR.

## Critério de pronto
- Todos os itens de `90-audit.md` com status (corrigido / adiado com motivo
  na tabela de pendências do BACKLOG).
- `npm audit --omit=dev` = 0.
- Demo com 100 mil linhas sintéticas (`?rows=100000`) rolando liso, grupos
  em 2 níveis, colunas customizadas corretas após expandir/recolher/rolar.

## Referência medida
(preencher)
