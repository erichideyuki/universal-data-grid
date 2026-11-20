# Site de documentação

Site estático com um exemplo ao vivo de cada recurso do `<u-grid>`. O
código mostrado em "Show code" é o próprio arquivo do exemplo — o que roda é
o que o usuário lê.

```bash
npm run docs:dev      # http://localhost:5174
npm run docs:build    # gera dist-docs/ (base relativa: serve em qualquer subpasta, ex. GitHub Pages)
npm run docs:preview  # serve o dist-docs/
npm run docs:publish  # build + cópia para ../universal-material.github.io/data-grid
```

## Estrutura

- `site/` — casca: menu (`nav.ts`), rotas por hash (`#/página/exemplo`),
  realce de código, estilos. Os exemplos montam quando chegam perto da tela e
  desmontam ao trocar de página.
- `pages/<id>.ts` — uma página: título, introdução, âncora do `API.md` e a
  lista ordenada de exemplos (`DocPage` em `site/types.ts`).
- `examples/<página>/<exemplo>.ts` — `export const meta = { title, description };`
  (o site tira esse bloco do código exibido; manter o `};` na coluna 0) e
  `export default (host) => cleanup?`.
- `examples/shared/` — dados de exemplo com semente (`data.ts`), controles
  das demos (`controls.ts`) e um "servidor" falso sobre o `LocalDataSource`
  (`fake-server.ts`).

## Regras

- Os exemplos importam `@universal-material/data-grid` como o hospedeiro faria
  (o `vite.config.ts` e o `tsconfig.json` daqui apontam o nome para `src/`).
- Código dos exemplos, títulos e descrições em inglês (é vitrine pública,
  como o README); a casca segue a regra do repositório (comentários em pt-BR).
- Exemplo que registra timer, listener em `window`/`document` ou estado global
  (`setGridLanguage`, `setGridTranslation`) devolve a limpeza — o site a chama
  ao sair da página.
- Nada de `innerHTML`/`unsafeHTML` com dado.
- API nova entra com exemplo aqui na mesma entrega (além do `API.md`).
- `npm run typecheck` cobre o `docs/` (`tsc -p docs`).

## Publicação

O site é publicado em <https://universal-material.github.io/data-grid/>, uma
subpasta do GitHub Pages do Universal Material (repositório
`universal-material/universal-material.github.io`, branch `master`, que guarda
só o site já construído; a raiz é o build Angular de
`universal-material-web/docs`).

1. `npm run docs:publish` — constrói e copia `dist-docs/` para
   `../universal-material.github.io/data-grid/` (ou para a pasta passada
   depois de `--`; o destino é substituído e precisa se chamar `data-grid`).
2. No repositório do Pages: commit da pasta `data-grid/` e push.

Visual: segue o site do Universal Material (Roboto, Material Symbols, paleta
padrão em `site/tokens.css`). Fontes e ícones vêm do Google Fonts; o exemplo
de Excel carrega o ExcelJS do jsDelivr na hora do clique.
