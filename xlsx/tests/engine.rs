//! Testes do motor pelo protocolo binário (o mesmo do JS): o arquivo é lido de volta pelo
//! `uo-opc` (zip, inflate, XML estrito) e conferido parte a parte.

use std::collections::BTreeMap;

use grid_xlsx::{Engine, code};
use uo_opc::xml::{self, Document, ParseOptions};

#[derive(Default)]
struct Enc(Vec<u8>);

impl Enc {
    fn u8(&mut self, v: u8) -> &mut Self {
        self.0.push(v);
        self
    }
    fn u16(&mut self, v: u16) -> &mut Self {
        self.0.extend_from_slice(&v.to_le_bytes());
        self
    }
    fn u32(&mut self, v: u32) -> &mut Self {
        self.0.extend_from_slice(&v.to_le_bytes());
        self
    }
    fn f32(&mut self, v: f32) -> &mut Self {
        self.0.extend_from_slice(&v.to_bits().to_le_bytes());
        self
    }
    fn f64(&mut self, v: f64) -> &mut Self {
        self.0.extend_from_slice(&v.to_le_bytes());
        self
    }
    fn s(&mut self, v: &str) -> &mut Self {
        self.u32(v.len() as u32);
        self.0.extend_from_slice(v.as_bytes());
        self
    }
}

struct Begin<'a> {
    title: &'a str,
    language: &'a str,
    name: &'a str,
    rtl: bool,
    freeze: bool,
    header_rows: u8,
    outline: u8,
    fixed: u16,
    widths: &'a [f32],
}

impl Default for Begin<'_> {
    fn default() -> Self {
        Begin { title: "Sales", language: "pt-BR", name: "Sales", rtl: false, freeze: true, header_rows: 1, outline: 0, fixed: 0, widths: &[100.0, 0.0] }
    }
}

fn config(b: &Begin<'_>) -> Vec<u8> {
    let mut e = Enc::default();
    e.u8(2).s(b.title).s(b.language).s(b.name).s("Data");
    e.u8(u8::from(b.rtl) | if b.freeze { 2 } else { 0 }).u8(b.header_rows).u8(b.outline).u16(b.fixed);
    e.u16(b.widths.len() as u16);
    for &w in b.widths {
        e.f32(w);
    }
    e.0
}

/// Uma célula no protocolo.
enum C<'a> {
    Empty(u32),
    Text(&'a str, u32),
    Num(f64, u32),
    Bool(bool),
    Date(i32, [u8; 5], u16),
    Link(&'a str, &'a str),
}

fn cell(e: &mut Enc, c: &C<'_>) {
    match *c {
        C::Empty(s) => {
            e.u8(0).u32(s);
        }
        C::Text(t, s) => {
            e.u8(1).u32(s).s(t);
        }
        C::Num(x, s) => {
            e.u8(2).u32(s).f64(x);
        }
        C::Bool(b) => {
            e.u8(if b { 4 } else { 3 }).u32(0);
        }
        C::Date(y, f, ms) => {
            e.u8(5).u32(0).u32(y as u32);
            for x in f {
                e.u8(x);
            }
            e.u16(ms);
        }
        C::Link(t, url) => {
            e.u8(0x81).u32(0).s(t).s(url);
        }
    }
}

/// Bloco: estilos novos (bytes já no protocolo) e linhas (outline, células), sem áreas mescladas.
fn block(styles: &[Vec<u8>], rows: &[(u8, Vec<C<'_>>)]) -> Vec<u8> {
    merged_block(styles, rows, &[])
}

/// Bloco com áreas mescladas (1ª linha, 1ª coluna, última linha, última coluna; a partir de 1).
fn merged_block(styles: &[Vec<u8>], rows: &[(u8, Vec<C<'_>>)], merges: &[(u32, u16, u32, u16)]) -> Vec<u8> {
    let mut e = Enc::default();
    e.u16(styles.len() as u16);
    for s in styles {
        e.0.extend_from_slice(s);
    }
    e.u32(rows.len() as u32);
    for (level, cells) in rows {
        e.u8(*level).u16(cells.len() as u16);
        for c in cells {
            cell(&mut e, c);
        }
    }
    e.u16(merges.len() as u16);
    for &(r1, c1, r2, c2) in merges {
        e.u32(r1).u16(c1).u32(r2).u16(c2);
    }
    e.0
}

/// Estilo com formato embutido por id (flag 64), sem mais nada.
fn builtin_style(id: u16) -> Vec<u8> {
    let mut e = Enc::default();
    e.u8(64).u8(0).u8(0).u16(id);
    e.0
}

/// Estilo: flags (1 negrito, 2 itálico, 4 cor, 8 fundo, 16 quebra, 32 formato), alinhamento, cores, bordas, formato.
fn style(flags: u8, align: u8, color: u32, fill: u32, borders: u8, fmt: &str) -> Vec<u8> {
    let mut e = Enc::default();
    e.u8(flags).u8(align);
    if flags & 4 != 0 {
        e.u32(color);
    }
    if flags & 8 != 0 {
        e.u32(fill);
    }
    e.u8(borders);
    for bit in [1u8, 2, 4, 8] {
        if borders & bit != 0 {
            e.u8(1).u8(1).u32(0x00_33_66);
        }
    }
    if flags & 32 != 0 {
        e.s(fmt);
    }
    e.0
}

fn parts(bytes: &[u8]) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for e in uo_opc::zip::read(bytes, 1000).expect("zip") {
        let raw = e.compressed(bytes);
        let data = if e.method == 0 { raw.to_vec() } else { uo_opc::flate::inflate_raw(raw, Some(e.size), 1 << 30).expect("inflate") };
        assert_eq!(uo_opc::flate::crc32(&data), e.crc32, "{}", e.name);
        out.insert(e.name.clone(), String::from_utf8(data).expect("utf8"));
    }
    out
}

fn strict(s: &str) -> Document {
    xml::read::parse(s.to_owned(), &ParseOptions::STRICT).unwrap_or_else(|e| panic!("{e:?} in {s:.300}"))
}

fn run(b: &Begin<'_>, blocks: &[Vec<u8>]) -> BTreeMap<String, String> {
    run_with(b, blocks, &[])
}

fn run_with(b: &Begin<'_>, blocks: &[Vec<u8>], tail: &[u8]) -> BTreeMap<String, String> {
    let mut e = Engine::new();
    assert_eq!(e.begin(&config(b)), code::OK, "{}", e.error);
    for bl in blocks {
        assert!(e.append(bl) >= 0, "{}", e.error);
    }
    let n = e.finish(tail);
    assert!(n > 0, "{}", e.error);
    assert_eq!(n as usize, e.out.len());
    let p = parts(&e.out);
    for (name, text) in &p {
        if name.ends_with(".xml") || name.ends_with(".rels") {
            strict(text);
        }
    }
    p
}

fn sheet(p: &BTreeMap<String, String>) -> &str {
    &p["xl/worksheets/sheet1.xml"]
}

#[test]
fn cabecalho_congelado_titulos_e_nome_columntitle() {
    let header = style(1 | 8, 0, 0, 0xE6E6E6, 0, "");
    let band = style(1 | 8, 6, 0, 0xE6E6E6, 0, "");
    let p = run(
        &Begin { header_rows: 2, widths: &[100.0, 80.0, 0.0], ..Begin::default() },
        &[block(
            &[header, band],
            &[
                (0, vec![C::Text("Region", 2), C::Empty(2), C::Empty(1)]),
                (0, vec![C::Text("Name", 1), C::Text("Country", 1), C::Text("Amount", 1)]),
                (0, vec![C::Text("Ana", 0), C::Text("Brazil", 0), C::Num(1200.5, 0)]),
            ],
        )],
    );
    let s = sheet(&p);
    // congelado nas 2 linhas de cabeçalho, sem mesclar
    assert!(s.contains(r#"<pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>"#), "{s}");
    assert!(!s.contains("mergeCell"), "{s}");
    let wb = &p["xl/workbook.xml"];
    assert!(wb.contains(r#"<definedName name="ColumnTitle" localSheetId="0">'Sales'!$A$2</definedName>"#) || wb.contains(r#"<definedName name="ColumnTitle" localSheetId="0">Sales!$A$2</definedName>"#), "{wb}");
    assert!(wb.contains("_xlnm.Print_Titles"), "{wb}");
    assert!(wb.contains("$1:$2"), "{wb}");
    assert!(wb.contains(r#"<sheet name="Sales""#), "{wb}");
    // larguras: 100 px e 80 px; a 3ª sem largura fica com a padrão
    assert!(s.contains("<cols>"), "{s}");
    assert_eq!(s.matches("<col ").count(), 2, "{s}");
    let styles = &p["xl/styles.xml"];
    assert!(styles.contains(r#"horizontal="centerContinuous""#), "{styles}");
    assert!(styles.contains("FFE6E6E6"), "{styles}");
    let core = &p["docProps/core.xml"];
    assert!(core.contains("<dc:language>pt-BR</dc:language>"), "{core}");
    assert!(core.contains("<dc:title>Sales</dc:title>"), "{core}");
}

#[test]
fn colunas_fixas_congeladas_e_nomes_de_titulo() {
    let p = run(&Begin { header_rows: 2, fixed: 1, widths: &[100.0, 80.0], ..Begin::default() }, &[block(&[], &[(0, vec![C::Text("a", 0)])])]);
    let s = sheet(&p);
    assert!(s.contains(r#"<pane xSplit="1" ySplit="2" topLeftCell="B3" activePane="bottomRight" state="frozen"/>"#), "{s}");
    let wb = &p["xl/workbook.xml"];
    // cabeçalho e coluna fixa: um nome só, `Title`, no canto (convenção do JAWS)
    assert!(wb.contains(r#"<definedName name="Title" localSheetId="0">'Sales'!$A$2</definedName>"#), "{wb}");
    assert!(!wb.contains("ColumnTitle") && !wb.contains("RowTitle"), "{wb}");
    // só a coluna fixa: `RowTitle` em A1
    let p = run(&Begin { header_rows: 0, fixed: 1, ..Begin::default() }, &[block(&[], &[])]);
    assert!(p["xl/workbook.xml"].contains(r#"<definedName name="RowTitle" localSheetId="0">'Sales'!$A$1</definedName>"#), "{}", p["xl/workbook.xml"]);
    // sem congelar o cabeçalho: só as colunas
    let p = run(&Begin { freeze: false, fixed: 1, ..Begin::default() }, &[block(&[], &[])]);
    assert!(sheet(&p).contains(r#"xSplit="1""#), "{}", sheet(&p));
    assert!(!sheet(&p).contains("ySplit"), "{}", sheet(&p));
}

#[test]
fn rtl_sem_congelar_e_sem_cabecalho() {
    let p = run(&Begin { rtl: true, freeze: false, header_rows: 0, ..Begin::default() }, &[block(&[], &[(0, vec![C::Text("a", 0)])])]);
    let s = sheet(&p);
    assert!(s.contains(r#"rightToLeft="1""#), "{s}");
    assert!(!s.contains("<pane"), "{s}");
    let wb = &p["xl/workbook.xml"];
    assert!(!wb.contains("ColumnTitle"), "{wb}");
    assert!(!wb.contains("Print_Titles"), "{wb}");
}

#[test]
fn nome_da_aba_limpo_e_reserva() {
    let p = run(&Begin { name: "Q1/2026: [sales]*", ..Begin::default() }, &[block(&[], &[])]);
    assert!(p["xl/workbook.xml"].contains(r#"<sheet name="Q12026 sales""#), "{}", p["xl/workbook.xml"]);
    let p = run(&Begin { name: "History", ..Begin::default() }, &[block(&[], &[])]);
    assert!(p["xl/workbook.xml"].contains(r#"<sheet name="Data""#), "{}", p["xl/workbook.xml"]);
    let p = run(&Begin { name: "[]", ..Begin::default() }, &[block(&[], &[])]);
    assert!(p["xl/workbook.xml"].contains(r#"<sheet name="Data""#));
}

#[test]
fn outline_com_resumo_acima() {
    let p = run(
        &Begin { outline: 2, ..Begin::default() },
        &[block(&[], &[(0, vec![C::Text("Country: Brazil (2)", 0)]), (1, vec![C::Text("City: Rio (1)", 0)]), (2, vec![C::Text("Ana", 0)])])],
    );
    let s = sheet(&p);
    assert!(s.contains(r#"outlineLevelRow="2""#), "{s}");
    assert!(s.contains(r#"summaryBelow="0""#), "{s}");
    assert!(s.contains(r#"outlineLevel="2""#), "{s}");
}

#[test]
fn tipos_datas_numeros_booleanos_e_links() {
    let date = style(32, 0, 0, 0, 0, "dd/mm/yyyy");
    let money = style(32, 0, 0, 0, 0, "#,##0.00");
    let p = run(
        &Begin::default(),
        &[block(
            &[date, money],
            &[
                (0, vec![C::Date(2024, [11, 22, 0, 0, 0], 0), C::Num(1234.5, 2), C::Bool(true)]),
                (0, vec![C::Text("2024-13-01 (not a date)", 0), C::Num(f64::NAN, 2), C::Bool(false)]),
                (0, vec![C::Date(1850, [3, 9, 7, 5, 0], 0), C::Link("site", "https://example.com/a?b=1&c=2"), C::Link("x", "javascript:alert(1)")]),
                (0, vec![C::Text("=SUM(A1:A2)", 0)]),
            ],
        )],
    );
    let s = sheet(&p);
    // 2024-11-22 = 45618
    assert!(s.contains("<v>45618</v>"), "{s}");
    assert!(s.contains("<v>1234.5</v>"), "{s}");
    assert!(s.contains(r#"t="b""#), "{s}");
    // texto que parece fórmula fica texto
    assert!(!s.contains("<f>"), "{s}");
    assert!(p["xl/sharedStrings.xml"].contains("=SUM(A1:A2)"));
    // data fora do Excel vira texto ISO
    assert!(p["xl/sharedStrings.xml"].contains("1850-03-09 07:05:00"), "{}", p["xl/sharedStrings.xml"]);
    // um link http (o javascript: é descartado)
    let rels = &p["xl/worksheets/_rels/sheet1.xml.rels"];
    assert_eq!(rels.matches("<Relationship ").count(), 1, "{rels}");
    assert!(rels.contains("https://example.com/a?b=1&amp;c=2"), "{rels}");
    let styles = &p["xl/styles.xml"];
    assert!(styles.contains(r#"formatCode="dd/mm/yyyy""#), "{styles}");
    // `#,##0.00` é o built-in 4
    assert!(styles.contains(r#"numFmtId="4""#), "{styles}");
}

#[test]
fn estilos_por_celula_sem_repeticao() {
    // mapa de calor: 3 tons, cada um com negrito e borda; repetidos em muitas células
    let tones = [0xF8696B_u32, 0xFFEB84, 0x63BE7B];
    let styles: Vec<Vec<u8>> = tones.iter().map(|&t| style(1 | 4 | 8, 2, 0x1A1A1A, t, 15, "")).collect();
    let rows: Vec<(u8, Vec<C<'_>>)> = (0..300).map(|r| (0, (0..12).map(|c| C::Text("ok", 1 + ((r + c) % 3) as u32)).collect())).collect();
    let p = run(&Begin::default(), &[block(&styles, &rows)]);
    let st = &p["xl/styles.xml"];
    let doc = strict(st);
    let xfs = doc.root().descendants().find(|e| e.local_name() == "cellXfs").expect("cellXfs");
    // padrão + 3
    assert_eq!(xfs.attr("count"), Some("4"), "{st}");
    let fills = doc.root().descendants().find(|e| e.local_name() == "fills").expect("fills");
    assert_eq!(fills.attr("count"), Some("5"), "{st}");
    assert!(st.contains(r#"style="medium""#), "{st}");
    assert!(st.contains("FF003366"), "{st}");
}

#[test]
fn blocos_seguidos_reusam_estilos_locais() {
    let bold = style(1, 0, 0, 0, 0, "");
    let p = run(&Begin::default(), &[block(&[bold], &[(0, vec![C::Text("a", 1)])]), block(&[], &[(0, vec![C::Text("b", 1)])])]);
    let s = sheet(&p);
    assert_eq!(s.matches(r#"s="1""#).count(), 2, "{s}");
}

#[test]
fn formato_invalido_cai_para_o_geral() {
    let long = "0".repeat(300);
    let p = run(&Begin::default(), &[block(&[style(1 | 32, 0, 0, 0, 0, &long)], &[(0, vec![C::Num(1.0, 1)])])]);
    assert!(!p["xl/styles.xml"].contains("000000000"), "{}", p["xl/styles.xml"]);
}

#[test]
fn formato_embutido_por_id_sai_como_id() {
    // 22 (data e hora) e 14 (data curta): o Excel mostra no padrão regional de quem abre
    let p = run(
        &Begin::default(),
        &[block(
            &[builtin_style(22), builtin_style(14)],
            &[(0, vec![C::Num(45618.0, 1), C::Num(45618.5625, 2)])],
        )],
    );
    let styles = &p["xl/styles.xml"];
    assert!(styles.contains(r#"numFmtId="22""#), "{styles}");
    assert!(styles.contains(r#"numFmtId="14""#), "{styles}");
    assert!(!styles.contains("<numFmt "), "{styles}");
    // id desconhecido: o estilo fica sem formato (o JS avisa), a exportação segue
    let mut e = Engine::new();
    assert_eq!(e.begin(&config(&Begin::default())), code::OK);
    assert_eq!(e.append(&block(&[builtin_style(200)], &[(0, vec![C::Num(1.0, 1)])])), 1);
}

#[test]
fn autofilter_no_fim_com_ordenacao() {
    // rótulos na linha 1, dados nas 2-3; ordenação descendente pela coluna B
    let mut tail = Enc::default();
    tail.u32(1).u16(1).u32(3).u16(2).u8(1).u16(2).u8(1);
    let p = run_with(
        &Begin::default(),
        &[block(&[], &[(0, vec![C::Text("a", 0), C::Text("b", 0)]), (0, vec![C::Num(1.0, 0), C::Num(2.0, 0)]), (0, vec![C::Num(3.0, 0), C::Num(4.0, 0)])])],
        &tail.0,
    );
    let s = sheet(&p);
    assert!(s.contains(r#"<autoFilter ref="A1:B3"><sortState ref="A2:B3"><sortCondition descending="1" ref="B2:B3"/></sortState></autoFilter>"#), "{s}");
    assert!(p["xl/workbook.xml"].contains("_xlnm._FilterDatabase"), "{}", p["xl/workbook.xml"]);

    // range fora das colunas: erro do escritor, sem pânico
    let mut e = Engine::new();
    assert_eq!(e.begin(&config(&Begin::default())), code::OK);
    let mut bad = Enc::default();
    bad.u32(1).u16(1).u32(1).u16(2).u8(1).u16(9).u8(0);
    assert!(e.finish(&bad.0) < 0);
    // bytes a mais
    let mut e = Engine::new();
    assert_eq!(e.begin(&config(&Begin::default())), code::OK);
    let mut extra = tail.0.clone();
    extra.push(0);
    assert_eq!(e.finish(&extra), code::INVALID);
}

#[test]
fn bandas_mescladas_na_horizontal() {
    let header = style(1 | 8, 0, 0, 0xE6E6E6, 0, "");
    let p = run(
        &Begin { header_rows: 2, widths: &[100.0, 80.0, 60.0], ..Begin::default() },
        &[merged_block(
            &[header],
            &[
                (0, vec![C::Empty(1), C::Text("Region", 1), C::Empty(1)]),
                (0, vec![C::Text("Name", 1), C::Text("Country", 1), C::Text("Amount", 1)]),
            ],
            &[(1, 2, 1, 3)],
        )],
    );
    let s = sheet(&p);
    assert!(s.contains(r#"<mergeCells count="1"><mergeCell ref="B1:C1"/></mergeCells>"#), "{s}");
    // o nome de títulos continua na linha das folhas
    let wb = &p["xl/workbook.xml"];
    assert!(wb.contains("$A$2"), "{wb}");
}

#[test]
fn mescla_sobreposta_e_erro() {
    let mut e = Engine::new();
    assert_eq!(e.begin(&config(&Begin::default())), code::OK);
    let rows = [(0, vec![C::Text("a", 0), C::Empty(0), C::Empty(0)])];
    assert_eq!(e.append(&merged_block(&[], &rows, &[(1, 1, 1, 2), (1, 2, 1, 3)])), code::INVALID);
    assert!(e.error.contains("overlap"), "{}", e.error);
}

#[test]
fn erros_de_protocolo_e_de_estado() {
    let mut e = Engine::new();
    assert_eq!(e.append(&block(&[], &[])), code::STATE);
    assert_eq!(e.finish(&[]), code::STATE);
    assert_eq!(e.begin(&[1]), code::INVALID);
    assert_eq!(e.begin(&config(&Begin::default())), code::OK);
    assert_eq!(e.begin(&config(&Begin::default())), code::STATE);
    // bloco truncado, estilo desconhecido, sobra no fim
    assert_eq!(e.append(&[0, 0, 1]), code::INVALID);
    assert_eq!(e.append(&block(&[], &[(0, vec![C::Text("a", 9)])])), code::INVALID);
    assert!(e.error.contains("unknown style"), "{}", e.error);
    let mut trailing = block(&[], &[]);
    trailing.push(0);
    assert_eq!(e.append(&trailing), code::INVALID);
    // nível de outline acima do declarado: limite
    assert_eq!(e.append(&block(&[], &[(1, vec![C::Text("a", 0)])])), code::LIMIT);
    // o escritor continua usável
    assert_eq!(e.append(&block(&[], &[(0, vec![C::Text("a", 0)])])), 1);
    assert!(e.finish(&[]) > 0);
    assert_eq!(e.rows_written(), 1);
}

#[test]
fn contadores_de_links_e_textos_cortados() {
    let mut e = Engine::new();
    assert_eq!(e.begin(&config(&Begin::default())), code::OK);
    let long = "x".repeat(40_000);
    assert_eq!(e.append(&block(&[], &[(0, vec![C::Text(&long, 0), C::Link("a", "file:///etc/passwd")])])), 1);
    assert!(e.finish(&[]) > 0);
    assert_eq!(e.dropped_links(), 1);
    assert_eq!(e.cut_texts(), 1);
}

#[test]
fn dez_mil_por_quarenta() {
    let mut e = Engine::new();
    let widths = [90.0_f32; 40];
    assert_eq!(e.begin(&config(&Begin { widths: &widths, ..Begin::default() })), code::OK);
    let styles: Vec<Vec<u8>> = (0..10).map(|i| style(8, 0, 0, 0x100000 * i, 0, "")).collect();
    let mut first = true;
    for chunk in 0..20 {
        let rows: Vec<(u8, Vec<C<'_>>)> =
            (0..500).map(|r| (0, (0..40).map(|c| if c == 0 { C::Text("user@example.com", 0) } else { C::Num(f64::from((r * c + chunk) % 100), 1 + (c % 10) as u32) }).collect())).collect();
        let b = block(if first { &styles } else { &[] }, &rows);
        first = false;
        assert_eq!(e.append(&b), 500, "{}", e.error);
    }
    let n = e.finish(&[]);
    assert!(n > 100_000, "{n}");
    assert_eq!(e.rows_written(), 10_000);
}
