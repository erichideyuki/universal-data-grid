//! Bancada nativa com os dados do perf do grid (`makeLeanItems`, 8 colunas, latim):
//! `cargo run --release --example bench -- <saída.pdf> [linhas]`. `NOWRITE=1` não grava o arquivo.
//! Usa o mesmo protocolo binário do JS (ver `src/input.rs`).

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
    fn cell(&mut self, text: &str, bold: bool) {
        self.u16(u16::from(bold));
        self.s(text);
    }
}

const COUNTRIES: [&str; 4] = ["Brazil", "Egypt", "Japan", "Germany"];

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out = args.get(1).cloned().unwrap_or_else(|| "sample.pdf".into());
    let n: usize = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(120);
    let layout: u8 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(0);
    let rtl = args.get(4).is_some_and(|s| s == "1");
    let ncols: usize = args.get(5).and_then(|s| s.parse().ok()).unwrap_or(6);
    let caps = ["Name", "Country", "City", "Notes", "Amount", "Date", "Customer", "Street address", "Region", "Postal code", "Phone", "Ship via"];

    let mut e = Engine::new();
    let font = |p: &str| std::fs::read(p).expect("font");
    for (p, b) in [
        ("../src/test/fonts/NotoSans-Regular.subset.ttf", false),
        ("../src/test/fonts/NotoSans-Bold.subset.ttf", true),
    ] {
        assert_eq!(e.add_font(font(p), b, false), 0, "{}", e.error);
    }
    let mut c = Enc(Vec::new());
    c.u8(1);
    c.s("Orders");
    c.s(if rtl { "ar" } else { "en" });
    c.s(if rtl { "ar" } else { "en" });
    c.u8(u8::from(rtl));
    c.u8(layout);
    c.f32(595.28);
    c.f32(841.89);
    c.u8(0);
    c.f32(36.0);
    c.f32(8.0);
    c.u32(1 | 2 | 4 | 8);
    for col in [0x1a1a1a, 0xe6e6e6, 0xf2f2f2, 0xf7f7f7, 0xefefef, 0x8a8a8a] {
        c.u32(col);
    }
    c.s("Page {page} of {pageCount}");
    c.s(": ");
    c.s("Total");
    c.u16(ncols as u16);
    for (i, cap) in caps.iter().take(ncols).enumerate() {
        c.s(cap);
        c.f32(if i == 3 { 110.0 } else { 80.0 });
        c.u8(if i == 4 { 2 } else { 0 });
        c.u32(i32::MIN as u32);
        c.u8(0);
    }
    assert_eq!(e.begin(&c.0), 0, "{}", e.error);

    let mut r = Enc(Vec::new());
    let mut count = 0u32;
    let flush = |e: &mut Engine, r: &mut Enc, count: &mut u32| {
        let mut b = Enc(Vec::new());
        b.u32(*count);
        b.0.extend_from_slice(&r.0);
        assert_eq!(e.push_rows(&b.0), 0, "{}", e.error);
        r.0.clear();
        *count = 0;
    };
    // cabeçalho
    r.u8(4);
    r.u8(0);
    r.u16(ncols as u16);
    for cap in caps.iter().take(ncols) {
        r.cell(cap, true);
    }
    count += 1;
    let t0 = std::time::Instant::now();
    let mut file = std::io::BufWriter::new(std::fs::File::create(&out).expect("create"));
    let mut written = 0usize;
    let mut pages = 0;
    for i in 0..n {
        if false && i % 50 == 0 {
            r.u8(1);
            r.u8(0);
            r.u16(1 + ncols as u16);
            r.cell(&format!("Country: {} ({})", COUNTRIES[(i / 50) % 4], 50), true);
            for k in 0..ncols {
                r.cell(if k == 4 { "Sum: 1,234.00" } else { "" }, false);
            }
            count += 1;
        }
        r.u8(0);
        r.u8(1);
        r.u16(ncols as u16);
        for k in 0..ncols {
            let t = match k {
                0 => format!("{i}"),
                1 => format!("Item {}", (i * 7919) % n),
                2 => COUNTRIES[i % 4].to_owned(),
                3 => "Electronics".to_owned(),
                4 => "Pending".to_owned(),
                5 => "true".to_owned(),
                6 => format!("{}", 1960 + i % 65),
                _ => format!("{}", (i * 37) % 100_000),
            };
            r.cell(&t, false);
        }
        count += 1;
        if count >= 2000 {
            flush(&mut e, &mut r, &mut count);
            loop {
                let s = e.layout(20);
                assert!(s >= 0, "{}", e.error);
                if e.pending_rows() == 0 {
                    break;
                }
            }
            pages = e.page_count();
            for c in e.out.drain(..) {
                written += c.len();
                if std::env::var_os("NOWRITE").is_none() { std::io::Write::write_all(&mut file, &c).expect("write"); }
            }
        }
    }
    r.u8(3);
    r.u8(0);
    r.u16(ncols as u16);
    for k in 0..ncols {
        r.cell(if k == 4 { "Sum: 66,843,315.00" } else { "" }, true);
    }
    count += 1;
    flush(&mut e, &mut r, &mut count);
    e.end_input();
    loop {
        let s = e.layout(20);
        assert!(s >= 0, "{}", e.error);
        if s == 1 {
            break;
        }
    }
    let _ = pages;
    assert_eq!(e.finish(), 0, "{}", e.error);
    for c in e.out.drain(..) {
        written += c.len();
        if std::env::var_os("NOWRITE").is_none() { std::io::Write::write_all(&mut file, &c).expect("write"); }
    }
    drop(file);
    let bytes = vec![0u8; written];
    eprintln!("{} rows, {} pages, {:.1} MB, {} ms", n, e.page_count(), bytes.len() as f64 / 1048576.0, t0.elapsed().as_millis());
}
