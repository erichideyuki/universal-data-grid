# Fontes de teste (exportação PDF, spec 26)

Subconjuntos das fontes Noto (The Noto Project Authors), licença SIL Open
Font License 1.1 (https://openfontlicense.org), gerados com
`python -m fontTools.subset … --layout-features='*'`:

| Arquivo | Origem | Faixas |
|---|---|---|
| `NotoSans-Regular.subset.ttf` | Noto Sans Regular | Latim básico e Latin-1, pontuação, Devanágari (com GSUB/GPOS) |
| `NotoSans-Bold.subset.ttf` | Noto Sans Bold | Latim básico e Latin-1, pontuação |
| `NotoSansArabic-Regular.subset.ttf` | Noto Sans Arabic Regular | Árabe e formas de apresentação |
| `NotoSansHebrew-Regular.subset.ttf` | Noto Sans Hebrew Regular | Hebraico |

Usadas só nos testes (não vão no pacote publicado). Sem CJK de propósito:
os testes conferem o `GridPdfMissingGlyphError` com caracteres CJK.
