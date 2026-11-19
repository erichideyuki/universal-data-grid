//! Amostra nativa: `cargo run --release --example sample -- <saída.pdf> [linhas] [layout 0|1|2] [rtl 0|1] [colunas]`.
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

const COUNTRIES: [&str; 4] = ["Brazil", "مصر", "日本", "Germany"];
const SAMPLES: [&str; 10] = ["محمد علي", "مُحَمَّد", "שלום עולם", "नमस्ते दुनिया", "क्षत्रिय श्री", "สวัสดีชาวโลก", "東京都渋谷区", "Zoe\u{0308} Ñandú", "Order #123 — طلب جديد", "São Paulo"];

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
        ("C:/Windows/Fonts/NotoSans-Regular.ttf", false),
        ("C:/Windows/Fonts/NotoSans-Bold.ttf", true),
        ("C:/Windows/Fonts/NotoSansArabic-Regular.ttf", false),
        ("C:/Windows/Fonts/NotoSansArabic-Bold.ttf", true),
        ("C:/Windows/Fonts/NotoSansHebrew-Regular.ttf", false),
        ("C:/Windows/Fonts/Nirmala.ttc", false),
        ("C:/Windows/Fonts/tahoma.ttf", false),
        ("C:/Windows/Fonts/msgothic.ttc", false),
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
    let mut pages = 0;
    for i in 0..n {
        if i % 50 == 0 {
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
                0 => format!("Person {i}"),
                1 => COUNTRIES[i % 4].to_owned(),
                2 => SAMPLES[i % SAMPLES.len()].to_owned(),
                3 => format!("{} — {}", SAMPLES[(i + 3) % SAMPLES.len()], SAMPLES[(i + 7) % SAMPLES.len()]),
                4 => format!("{:.2}", i as f64 * 13.37),
                5 => format!("{}/{}/2020", 1 + i % 12, 1 + i % 28),
                _ => format!("{} {i}", caps[k]),
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
    let mut bytes = Vec::new();
    for c in e.out.drain(..) {
        bytes.extend_from_slice(&c);
    }
    std::fs::write(&out, &bytes).expect("write");
    eprintln!("{} rows, {} pages, {:.1} MB, {} ms", n, e.page_count(), bytes.len() as f64 / 1048576.0, t0.elapsed().as_millis());
}
