//! Fontes do hospedeiro: leitura (TTF/OTF/TTC), cobertura, métricas e os objetos de fonte do PDF
//! (Type0 + CIDFont, subset TrueType, `/W` e `ToUnicode` com o texto de origem de cada glifo).

use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::sync::Arc;

use uo_fonts::{Face, FontLimits};

use crate::writer::{Writer, name};

pub struct Font {
    /// face do rustybuzz (shaping e métricas); empresta `bytes`, então vem ANTES (é solta antes)
    pub rb: rustybuzz::Face<'static>,
    pub face: Face,
    pub bytes: Arc<[u8]>,
    pub upem: f64,
    pub bold: bool,
    pub italic: bool,
    /// objeto Type0 (reservado no início, escrito no fim)
    pub obj: u32,
    /// nome do recurso (`F0`, `F1`…)
    pub res: String,
    /// glifo → texto de origem (ToUnicode); só os usados
    pub used: BTreeMap<u16, String>,
    /// glifos já registrados (bit por gid): evita a busca no `used` a cada glifo desenhado
    seen: Box<[u64; 1024]>,
    /// `/W` por gid (-1 = ainda não lido)
    widths: Box<[i32]>,
    cff: bool,
    ps_name: String,
}

#[derive(Debug)]
pub enum FontLoadError {
    Invalid(usize),
    NotEmbeddable(usize),
}

impl Font {
    pub fn load(index: usize, bytes: Vec<u8>, bold: bool, italic: bool, w: &mut Writer) -> Result<Font, FontLoadError> {
        let limits = FontLimits::DEFAULT;
        // coleção (TTC): a 1ª face vira um sfnt próprio
        let bytes: Arc<[u8]> = match uo_fonts::standalone_face(&bytes, None, &limits) {
            Ok(b) => b.into_owned().into(),
            Err(_) => return Err(FontLoadError::Invalid(index)),
        };
        if !uo_fonts::is_embeddable(&bytes) {
            return Err(FontLoadError::NotEmbeddable(index));
        }
        let face = Face::parse(bytes.clone(), &limits).map_err(|_| FontLoadError::Invalid(index))?;
        // SAFETY: `bytes` é um Arc guardado no mesmo `Font` e nunca trocado; o campo `rb` é solto antes dele.
        let slice: &'static [u8] = unsafe { std::mem::transmute::<&[u8], &'static [u8]>(&bytes[..]) };
        let rb = rustybuzz::Face::from_slice(slice, 0).ok_or(FontLoadError::Invalid(index))?;
        let cff = bytes.get(0..4) == Some(b"OTTO");
        let ps_name = rb
            .names()
            .into_iter()
            .find(|n| n.name_id == rustybuzz::ttf_parser::name_id::POST_SCRIPT_NAME)
            .and_then(|n| n.to_string())
            .unwrap_or_else(|| format!("Font{index}"));
        let upem = f64::from(face.metrics().units_per_em.max(16));
        Ok(Font { rb, face, bytes, upem, bold, italic, obj: w.alloc(), res: format!("F{index}"), used: BTreeMap::new(), seen: Box::new([0; 1024]), widths: vec![-1; 0x10000].into_boxed_slice(), cff, ps_name })
    }

    pub fn has(&self, cp: u32) -> bool {
        self.face.glyph_id(cp) != 0
    }

    /// Registra o uso de um glifo com o texto de origem (o 1º texto vence).
    pub fn use_glyph(&mut self, gid: u16, text: &str) {
        let (word, bit) = (usize::from(gid >> 6), 1u64 << (gid & 63));
        if self.seen[word] & bit != 0 {
            return;
        }
        self.seen[word] |= bit;
        if !self.used.contains_key(&gid) {
            let t = if text.is_empty() { "\u{FFFD}" } else { text };
            self.used.insert(gid, t.to_owned());
        }
    }

    /// Largura do glifo em milésimos do em (a do `/W`).
    pub fn width1000(&mut self, gid: u16) -> i64 {
        let cached = self.widths[usize::from(gid)];
        if cached >= 0 {
            return i64::from(cached);
        }
        let w = self.raw_width(gid);
        self.widths[usize::from(gid)] = w as i32;
        w
    }

    fn raw_width(&self, gid: u16) -> i64 {
        (f64::from(self.face.advance_width(u32::from(gid))) * 1000.0 / self.upem).round() as i64
    }

    /// Escreve o subset e os objetos da fonte (chamado no fim do documento).
    pub fn write(&self, w: &mut Writer) {
        let gids: Vec<u32> = std::iter::once(0).chain(self.used.keys().map(|g| u32::from(*g))).collect();
        let tag = subset_tag(&gids);
        let base = format!("{tag}+{}", self.ps_name.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect::<String>());
        let file = w.alloc();
        let (sub, cid_type) = if self.cff {
            // CFF: a fonte inteira (FontFile3/OpenType); CID = GID
            w.stream(file, " /Subtype /OpenType", &self.bytes, true);
            ("FontFile3", "CIDFontType0")
        } else {
            let data = uo_fonts::subset_true_type(&self.bytes, gids.iter().copied(), false, &FontLimits::DEFAULT);
            w.stream(file, &format!(" /Length1 {}", data.len()), &data, true);
            ("FontFile2", "CIDFontType2")
        };
        let m = self.face.metrics();
        let s = 1000.0 / self.upem;
        let bbox = self.rb.global_bounding_box();
        let italic_angle = self.rb.italic_angle();
        let cap = self.rb.capital_height().map_or(f64::from(m.ascender) * 0.7, f64::from);
        let mut flags = 32;
        if self.italic {
            flags |= 64;
        }
        let desc = w.alloc();
        let d = format!(
            "<</Type /FontDescriptor /FontName {} /Flags {flags} /FontBBox [{} {} {} {}] /ItalicAngle {} /Ascent {} /Descent {} /CapHeight {} /StemV {} /{sub} {file} 0 R>>",
            name(&base),
            (f64::from(bbox.x_min) * s).round(),
            (f64::from(bbox.y_min) * s).round(),
            (f64::from(bbox.x_max) * s).round(),
            (f64::from(bbox.y_max) * s).round(),
            italic_angle.round(),
            (f64::from(m.ascender) * s).round(),
            (f64::from(m.descender) * s).round(),
            (cap * s).round(),
            if self.bold { 140 } else { 80 },
        );
        w.small(desc, d.as_bytes());
        // /W: grupos de glifos consecutivos
        let mut widths = String::from("[");
        let mut run: Vec<i64> = Vec::new();
        let mut run_start = 0u16;
        let mut prev: Option<u16> = None;
        for &g in self.used.keys() {
            if prev.is_some_and(|p| p + 1 == g) {
                run.push(self.raw_width(g));
            } else {
                if !run.is_empty() {
                    let _ = write!(widths, "{run_start} [{}] ", run.iter().map(i64::to_string).collect::<Vec<_>>().join(" "));
                }
                run.clear();
                run.push(self.raw_width(g));
                run_start = g;
            }
            prev = Some(g);
        }
        if !run.is_empty() {
            let _ = write!(widths, "{run_start} [{}]", run.iter().map(i64::to_string).collect::<Vec<_>>().join(" "));
        }
        widths.push(']');
        let cid = w.alloc();
        let map = if self.cff { String::new() } else { " /CIDToGIDMap /Identity".to_owned() };
        let c = format!(
            "<</Type /Font /Subtype /{cid_type} /BaseFont {} /CIDSystemInfo <</Registry (Adobe) /Ordering (Identity) /Supplement 0>> /FontDescriptor {desc} 0 R /DW {} /W {widths}{map}>>",
            name(&base),
            self.raw_width(0)
        );
        w.small(cid, c.as_bytes());
        let tu = w.alloc();
        w.stream(tu, "", self.to_unicode().as_bytes(), true);
        let t0 = format!(
            "<</Type /Font /Subtype /Type0 /BaseFont {} /Encoding /Identity-H /DescendantFonts [{cid} 0 R] /ToUnicode {tu} 0 R>>",
            name(&base)
        );
        w.small(self.obj, t0.as_bytes());
    }

    fn to_unicode(&self) -> String {
        let mut s = String::from(
            "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo <</Registry (Adobe) /Ordering (UCS) /Supplement 0>> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n",
        );
        let entries: Vec<(&u16, &String)> = self.used.iter().collect();
        for chunk in entries.chunks(100) {
            let _ = writeln!(s, "{} beginbfchar", chunk.len());
            for (g, t) in chunk {
                let _ = write!(s, "<{:04X}> <", g);
                for u in t.encode_utf16() {
                    let _ = write!(s, "{u:04X}");
                }
                s.push_str(">\n");
            }
            s.push_str("endbfchar\n");
        }
        s.push_str("endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n");
        s
    }
}

fn subset_tag(gids: &[u32]) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for g in gids {
        h ^= u64::from(*g);
        h = h.wrapping_mul(0x100_0000_01b3);
    }
    (0..6).map(|i| (b'A' + ((h >> (i * 5)) % 26) as u8) as char).collect()
}
