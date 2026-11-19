//! Testes do motor pelo protocolo binário (o mesmo do JS). Fontes: `src/test/fonts` (Noto, OFL).

use grid_pdf::Engine;

struct Enc(Vec<u8>);

impl Enc {
    fn u8(&mut self, v: u8) {
        self.0.push(v);
    }
    fn u16(&mut self, v: u16) {
        self.0.extend_from_slice(&v.to_le_bytes());
    }
    fn u32(&mut self, v: u32) {
        self.0.extend_from_slice(&v.to_le_bytes());
    }
    fn f32(&mut self, v: f32) {
        self.0.extend_from_slice(&v.to_bits().to_le_bytes());
    }
    fn s(&mut self, v: &str) {
        self.u32(v.len() as u32);
        self.0.extend_from_slice(v.as_bytes());
    }
}

fn font(name: &str) -> Vec<u8> {
    std::fs::read(format!("{}/../src/test/fonts/{name}", env!("CARGO_MANIFEST_DIR"))).expect("font")
}

fn engine(cols: &[&str], layout: u8, flags: u32) -> Engine {
    engine_mode(cols, layout, flags, false)
}

fn engine_mode(cols: &[&str], layout: u8, flags: u32, deferred: bool) -> Engine {
    let mut e = Engine::with_mode(deferred);
    assert_eq!(e.add_font(font("NotoSans-Regular.subset.ttf"), false, false), 0, "{}", e.error);
    assert_eq!(e.add_font(font("NotoSans-Bold.subset.ttf"), true, false), 0, "{}", e.error);
    assert_eq!(e.add_font(font("NotoSansArabic-Regular.subset.ttf"), false, false), 0, "{}", e.error);
    assert_eq!(e.add_font(font("NotoSansHebrew-Regular.subset.ttf"), false, false), 0, "{}", e.error);
    let mut c = Enc(Vec::new());
    c.u8(1);
    c.s("Test title");
    c.s("en");
    c.s("en");
    c.u8(0);
    c.u8(layout);
    c.f32(595.28);
    c.f32(841.89);
    c.u8(0);
    c.f32(36.0);
    c.f32(8.0);
    c.u32(flags);
    for col in [0x1a1a1a, 0xe6e6e6, 0xf0f0f0, 0xf7f7f7, 0xececec, 0x8a8a8a] {
        c.u32(col);
    }
    c.s("Page {page} of {pageCount}");
    c.s(": ");
    c.s("Total");
    c.u16(cols.len() as u16);
    for col in cols {
        c.s(col);
        c.f32(100.0);
        c.u8(0);
        c.u32(i32::MIN as u32);
        c.u8(0);
    }
    assert_eq!(e.begin(&c.0), 0, "{}", e.error);
    e
}

/// Linhas: (tipo, nível, textos).
fn rows(e: &mut Engine, rows: &[(u8, u8, Vec<&str>)]) -> i32 {
    let mut r = Enc(Vec::new());
    r.u32(rows.len() as u32);
    for (kind, level, cells) in rows {
        r.u8(*kind);
        r.u8(*level);
        r.u16(cells.len() as u16);
        for c in cells {
            r.u16(u16::from(*kind == 4));
            r.s(c);
        }
    }
    e.push_rows(&r.0)
}

fn run(mut e: Engine) -> (Vec<u8>, usize) {
    e.end_input();
    loop {
        let s = e.layout(10);
        assert!(s >= 0, "{}", e.error);
        if s == 1 {
            break;
        }
    }
    let pages = e.page_count();
    assert_eq!(e.finish(), 0, "{}", e.error);
    let mut bytes = Vec::new();
    for c in e.out.drain(..) {
        bytes.extend_from_slice(&c);
    }
    (bytes, pages)
}

fn has(bytes: &[u8], needle: &str) -> bool {
    bytes.windows(needle.len()).any(|w| w == needle.as_bytes())
}

#[test]
fn documento_marcado_com_idioma_titulo_e_xref_em_stream() {
    let mut e = engine(&["Name", "Amount"], 0, 1 | 2);
    rows(&mut e, &[(4, 0, vec!["Name", "Amount"]), (1, 0, vec!["Country: Brazil (1)", "", ""]), (0, 1, vec!["Ana", "10.00"]), (3, 0, vec!["", "Sum: 10.00"])]);
    let (pdf, pages) = run(e);
    assert_eq!(pages, 1);
    assert!(pdf.starts_with(b"%PDF-1.7"));
    assert!(pdf.ends_with(b"%%EOF\n"));
    // o catálogo fica num object stream comprimido: confere pelo que é direto
    assert!(has(&pdf, "/Type /XRef"));
    assert!(has(&pdf, "/Type /ObjStm"));
    assert!(has(&pdf, "/Type /Metadata"));
    assert!(has(&pdf, "pdfuaid:part>1<"));
    assert!(has(&pdf, "Test title"));
}

#[test]
fn linha_mais_alta_que_a_pagina_continua_na_seguinte() {
    let mut e = engine(&["Notes"], 0, 1);
    let long = "lorem ipsum dolor sit amet ".repeat(900);
    rows(&mut e, &[(4, 0, vec!["Notes"]), (0, 0, vec![long.as_str()])]);
    let (_, pages) = run(e);
    assert!(pages >= 3, "{pages}");
}

#[test]
fn caractere_sem_glifo_vira_erro_com_os_codigos() {
    let mut e = engine(&["Name"], 0, 0);
    rows(&mut e, &[(4, 0, vec!["Name"]), (0, 0, vec!["東京"])]);
    e.end_input();
    let s = e.layout(10);
    assert_eq!(s, grid_pdf::code::MISSING_GLYPH);
    assert_eq!(e.error, "4EAC,6771");
}

#[test]
fn varios_scripts_e_modos_sections_e_list() {
    for layout in [0u8, 1, 2] {
        let mut e = engine(&["Name", "Note"], layout, 1 | 2 | 4);
        let mut list = vec![(4u8, 0u8, vec!["Name", "Note"])];
        for g in 0..3 {
            if layout != 2 {
                list.push((1, 0, vec!["Group: مصر (2)", "", ""]));
            }
            list.push((0, 1, vec!["محمد علي", "Order #123 — طلب جديد"]));
            list.push((0, 1, vec!["שלום עולם", if g == 0 { "नमस्ते दुनिया" } else { "क्षत्रिय श्री" }]));
        }
        list.push((3, 0, vec!["", "Total"]));
        assert_eq!(rows(&mut e, &list), 0);
        let (pdf, pages) = run(e);
        assert!(pages >= 1);
        assert!(has(&pdf, "%%EOF"));
    }
}

#[test]
fn colunas_que_nao_cabem_vao_para_a_linha_adaptativa() {
    let cols: Vec<String> = (0..20).map(|i| format!("Column {i}")).collect();
    let refs: Vec<&str> = cols.iter().map(String::as_str).collect();
    let mut e = engine(&refs, 0, 1 | 8);
    let vals: Vec<String> = (0..20).map(|i| format!("value {i}")).collect();
    let vrefs: Vec<&str> = vals.iter().map(String::as_str).collect();
    rows(&mut e, &[(4, 0, refs.clone()), (0, 0, vrefs)]);
    let (pdf, _) = run(e);
    assert!(has(&pdf, "%%EOF"));
}

/// Linhas com células já codificadas (estilo, imagem, link).
fn raw_rows(e: &mut Engine, rows: &[(u8, u8, Vec<Vec<u8>>)]) -> i32 {
    let mut r = Enc(Vec::new());
    r.u32(rows.len() as u32);
    for (kind, level, cells) in rows {
        r.u8(*kind);
        r.u8(*level);
        r.u16(cells.len() as u16);
        for c in cells {
            r.0.extend_from_slice(c);
        }
    }
    e.push_rows(&r.0)
}

fn cell(text: &str) -> Vec<u8> {
    let mut c = Enc(Vec::new());
    c.u16(0);
    c.s(text);
    c.0
}

fn link_cell(text: &str, url: &str) -> Vec<u8> {
    let mut c = Enc(Vec::new());
    c.u16(64);
    c.s(text);
    c.s(url);
    c.s("");
    c.0
}

fn image_cell(text: &str, image: u32, alt: &str) -> Vec<u8> {
    let mut c = Enc(Vec::new());
    c.u16(32 | 8);
    c.s(text);
    c.u32(0xffeeaa);
    c.u32(image);
    c.s(alt);
    c.0
}

/// PNG 1×1 vermelho.
const PNG: [u8; 69] = [
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 0, 0, 3, 1, 1, 0, 201, 254, 146, 239, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66,
    96, 130,
];

/// Documento com linhas comuns, links, imagens, grupos e uma linha que atravessa páginas.
fn mixed(deferred: bool) -> Engine {
    let mut e = engine_mode(&["Name", "Site", "Flag"], 0, 1 | 2 | 4, deferred);
    assert_eq!(e.add_image(&PNG, 0, 12.0, 12.0), 0, "{}", e.error);
    let mut list = vec![(4u8, 0u8, vec![cell("Name"), cell("Site"), cell("Flag")])];
    for g in 0..4 {
        list.push((1, 0, vec![cell(&format!("Group {g}")), cell(""), cell(""), cell("")]));
        for i in 0..60 {
            list.push((0, 1, vec![cell(&format!("Row {i} محمد")), link_cell("example.com", "https://example.com"), image_cell(if i % 2 == 0 { "ok" } else { "" }, 0, if i % 3 == 0 { "" } else { "flag" })]));
        }
    }
    list.push((0, 0, vec![cell(&"lorem ipsum dolor ".repeat(400)), cell("x"), cell("y")]));
    list.push((3, 0, vec![cell(""), cell("Total"), cell("")]));
    assert_eq!(raw_rows(&mut e, &list), 0, "{}", e.error);
    e
}

/// Streams FlateDecode do arquivo, descomprimidos (os de conteúdo de página e os object streams).
fn streams(pdf: &[u8]) -> Vec<Vec<u8>> {
    let mut out = Vec::new();
    let mut i = 0;
    while let Some(p) = pdf[i..].windows(14).position(|w| w == b"/FlateDecode /") {
        let at = i + p;
        let len_at = at + b"/FlateDecode /Length ".len();
        let end = len_at + pdf[len_at..].iter().position(|b| *b == b'>').expect("Length");
        let len: usize = std::str::from_utf8(&pdf[len_at..end]).expect("utf8").parse().expect("number");
        let start = end + b">>
stream
".len();
        let mut buf = vec![0u8; len * 64 + 4096];
        let (raw, code) = zlib_rs::inflate::uncompress_slice(&mut buf, &pdf[start..start + len], zlib_rs::inflate::InflateConfig::default());
        assert_eq!(code, zlib_rs::ReturnCode::Ok);
        out.push(raw.to_vec());
        i = start + len;
    }
    out
}

#[test]
fn modo_adiado_com_montador_gera_o_mesmo_arquivo() {
    let (direct, pages) = run(mixed(false));
    let mut e = mixed(true);
    e.end_input();
    let mut asm = grid_pdf::writer::Assembler::new();
    let mut out = Vec::new();
    let mut feed = |e: &mut Engine, asm: &mut grid_pdf::writer::Assembler| {
        for c in e.out.drain(..) {
            asm.push(&c).expect("segmentos");
        }
        while let Some(c) = asm.take() {
            out.extend_from_slice(&c);
        }
    };
    loop {
        let s = e.layout(3);
        assert!(s >= 0, "{}", e.error);
        feed(&mut e, &mut asm);
        if s == 1 {
            break;
        }
    }
    assert_eq!(e.finish(), 0, "{}", e.error);
    feed(&mut e, &mut asm);
    assert!(pages >= 3);
    assert_eq!(out.len(), direct.len());
    assert!(out == direct, "o arquivo montado difere do direto");
}

#[test]
fn texto_e_conteudo_marcado_aninham_certo_com_links_e_imagens() {
    let (pdf, _) = run(mixed(false));
    let mut contents = 0;
    for s in streams(&pdf) {
        if s.starts_with(b"0.5 w") {
            contents += 1;
            // pilha de BT/BDC: ET fecha um BT, EMC fecha um BDC, sempre o do topo; caminho e
            // imagem (`re`, `m`, `Do`) só fora de BT
            let mut stack: Vec<&str> = Vec::new();
            let mut prev: &[u8] = b"";
            for tok in s.split(|b| b.is_ascii_whitespace()).filter(|t| !t.is_empty()) {
                // BDC: tag e propriedades (`/Tag <<…>> BDC`); BMC: só a tag
                if tok == b"BDC" {
                    assert!(prev.ends_with(b">>"), "BDC sem lista de propriedades");
                }
                if tok == b"BMC" {
                    assert!(prev.starts_with(b"/"), "BMC sem tag");
                    stack.push("BDC");
                }
                prev = tok;
                match tok {
                    b"BT" => {
                        assert!(!stack.contains(&"BT"), "BT dentro de BT");
                        stack.push("BT");
                    }
                    b"BDC" => stack.push("BDC"),
                    b"ET" => assert_eq!(stack.pop(), Some("BT"), "ET fora de ordem"),
                    b"EMC" => assert_eq!(stack.pop(), Some("BDC"), "EMC fora de ordem"),
                    b"re" | b"m" | b"Do" | b"cm" => assert!(!stack.contains(&"BT"), "operador gráfico dentro de BT"),
                    _ => {}
                }
            }
            assert!(stack.is_empty(), "página termina com {stack:?}");
        }
    }
    assert!(contents >= 3, "{contents}");
}

#[test]
fn headers_apontam_para_ids_existentes_com_grupos_aninhados_rodapes_e_total() {
    for (layout, flags, ncols) in [(0u8, 1u32, 3usize), (1, 1, 3), (0, 1 | 8, 14)] {
        let cols: Vec<String> = (0..ncols).map(|i| format!("Column {i}")).collect();
        let refs: Vec<&str> = cols.iter().map(String::as_str).collect();
        let mut e = engine(&refs, layout, flags);
        let vals: Vec<String> = (0..ncols).map(|i| format!("value {i}")).collect();
        let vrefs: Vec<&str> = vals.iter().map(String::as_str).collect();
        let mut group = vec!["G"];
        group.extend(std::iter::repeat_n("", ncols));
        let mut sum = vec![""];
        sum.extend(std::iter::repeat_n("Sum: 1", ncols - 1));
        let mut list = vec![(4u8, 0u8, refs.clone())];
        for _ in 0..2 {
            list.push((1, 0, group.clone()));
            list.push((1, 1, group.clone()));
            list.push((0, 2, vrefs.clone()));
            list.push((2, 2, sum.clone()));
            list.push((2, 1, sum.clone()));
        }
        list.push((3, 0, sum.clone()));
        assert_eq!(rows(&mut e, &list), 0, "{}", e.error);
        let (pdf, _) = run(e);
        let text: String = streams(&pdf).iter().map(|s| String::from_utf8_lossy(s).into_owned()).collect::<Vec<_>>().join("
");
        let ids: std::collections::HashSet<&str> = text.match_indices("/ID (").map(|(i, _)| &text[i + 5..i + 5 + text[i + 5..].find(')').unwrap()]).collect();
        let mut headers = 0;
        for (i, _) in text.match_indices("/Headers [") {
            let list = &text[i + 10..i + 10 + text[i + 10..].find(']').unwrap()];
            for id in list.split(['(', ')', ' ']).filter(|x| !x.is_empty()) {
                assert!(ids.contains(id), "/Headers aponta para {id}, que não existe (layout {layout})");
                headers += 1;
            }
        }
        assert!(headers > 0);
    }
}
