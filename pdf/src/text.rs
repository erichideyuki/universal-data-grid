//! Texto: fonte de reserva por caractere, bidi (UAX #9), shaping (rustybuzz) só onde precisa,
//! quebra de linha (UAX #14 + grafemas, UAX #29), caches limitados (glifo, palavra moldada).
//!
//! Chave do cache de palavra = (fonte exata, direção, texto): estilos diferentes da mesma palavra
//! usam fontes diferentes e nunca se misturam.

use std::collections::{BTreeSet, HashMap};

use unicode_bidi::{Level, ParagraphBidiInfo};
use unicode_segmentation::UnicodeSegmentation;

use crate::fonts::Font;

/// Um glifo posicionado numa linha (coordenadas relativas ao início da linha, em pt).
#[derive(Clone, Copy, Debug)]
pub struct G {
    pub font: u16,
    pub gid: u16,
    /// byte de origem no texto da linha
    pub cluster: u32,
    /// fim (exclusivo) do texto de origem do glifo
    pub cluster_end: u32,
    pub x: f32,
    pub dy: f32,
    pub adv: f32,
}

#[derive(Clone, Copy)]
struct WordGlyph {
    gid: u16,
    cl: u32,
    adv: i32,
    xoff: i32,
    yoff: i32,
}

/// Teto dos caches (entradas aproximadas).
const WORD_CACHE_GLYPHS: usize = 256 * 1024;

pub struct Text {
    pub fonts: Vec<Font>,
    /// ordem de reserva por estilo (0 regular, 1 negrito, 2 itálico, 3 negrito itálico)
    order: [Vec<u16>; 4],
    /// cache de glifo por estilo e código BMP: 0 = desconhecido; senão 1 | idx<<1 | gid<<16 | adv<<32
    bmp: [Vec<u64>; 4],
    words: HashMap<u64, (Box<str>, Box<[WordGlyph]>)>,
    words_glyphs: usize,
    plans: HashMap<(u16, bool, rustybuzz::Script), rustybuzz::ShapePlan>,
    buf: Option<rustybuzz::UnicodeBuffer>,
    /// caracteres sem glifo em nenhuma fonte
    pub missing: BTreeSet<u32>,
}

pub fn style_index(bold: bool, italic: bool) -> usize {
    usize::from(bold) | (usize::from(italic) << 1)
}

/// Texto que precisa de bidi/shaping.
pub fn complex(text: &str) -> bool {
    text.chars().any(|c| needs_shaping(c) || is_rtl(c))
}

fn is_rtl(c: char) -> bool {
    matches!(c as u32, 0x0590..=0x08FF | 0xFB1D..=0xFDFF | 0xFE70..=0xFEFF | 0x10800..=0x10FFF | 0x1E800..=0x1EFFF | 0x200F | 0x202B | 0x202E | 0x2067)
}

fn needs_shaping(c: char) -> bool {
    let u = c as u32;
    is_mark(c) || (0x0600..=0x08FF).contains(&u) || (0x0900..=0x0DFF).contains(&u) || (0x0E00..=0x0EFF).contains(&u) || (0x0F00..=0x109F).contains(&u) || (0x1780..=0x17FF).contains(&u) || (0x1B00..=0x1CFF).contains(&u) || (0xA8E0..=0xA8FF).contains(&u) || (0xFB50..=0xFDFF).contains(&u) || (0xFE70..=0xFEFF).contains(&u) || u == 0x200C || u == 0x200D
}

/// Marca combinante (faixas principais): fica na fonte da base.
pub fn is_mark(c: char) -> bool {
    matches!(c as u32, 0x0300..=0x036F | 0x0483..=0x0489 | 0x0591..=0x05C7 | 0x0610..=0x061A | 0x064B..=0x065F | 0x0670 | 0x06D6..=0x06ED | 0x0900..=0x0903 | 0x093A..=0x094F | 0x0951..=0x0957 | 0x0962..=0x0963 | 0x0981..=0x0983 | 0x09BC..=0x09D7 | 0x0E31 | 0x0E34..=0x0E3A | 0x0E47..=0x0E4E | 0x1AB0..=0x1AFF | 0x1DC0..=0x1DFF | 0x20D0..=0x20FF | 0xFE00..=0xFE0F | 0xFE20..=0xFE2F)
}

/// Caractere que não precisa de glifo (controle, formato, seletor de variante).
fn ignorable(c: char) -> bool {
    let u = c as u32;
    u < 0x20 || (0x7F..0xA0).contains(&u) || matches!(u, 0x00AD | 0x034F | 0x061C | 0x115F | 0x1160 | 0x17B4 | 0x17B5 | 0x180B..=0x180F | 0x200B..=0x200F | 0x202A..=0x202E | 0x2060..=0x206F | 0xFE00..=0xFE0F | 0xFEFF | 0xE0000..=0xE0FFF)
}

/// Script para segmentar (0 = comum: herda o vizinho).
fn script_of(c: char) -> u32 {
    let u = c as u32;
    match u {
        0x00..=0x40 | 0x5B..=0x60 | 0x7B..=0xBF | 0xD7 | 0xF7 | 0x2000..=0x206F | 0x20A0..=0x20CF | 0x2100..=0x214F | 0x2190..=0x2BFF | 0x3000..=0x303F | 0xFF00..=0xFF20 => 0,
        0x0590..=0x05FF | 0xFB1D..=0xFB4F => 2,
        0x0600..=0x06FF | 0x0750..=0x077F | 0x08A0..=0x08FF | 0xFB50..=0xFDFF | 0xFE70..=0xFEFF => 3,
        0x0900..=0x0DFF => 0x100 + (u >> 7),
        0x0E00..=0x0E7F => 5,
        0x0E80..=0x0EFF => 8,
        0x1780..=0x17FF => 9,
        0x1100..=0x11FF | 0xAC00..=0xD7AF | 0x3130..=0x318F => 6,
        0x2E80..=0x9FFF | 0xF900..=0xFAFF | 0x20000..=0x3FFFF => 7,
        _ => 1,
    }
}

/// Espelho bidi dos pares mais comuns (num trecho RTL sem shaping).
fn mirror(c: char) -> char {
    match c {
        '(' => ')',
        ')' => '(',
        '[' => ']',
        ']' => '[',
        '{' => '}',
        '}' => '{',
        '<' => '>',
        '>' => '<',
        '«' => '»',
        '»' => '«',
        _ => c,
    }
}

fn fnv(seed: u64, text: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325 ^ seed;
    for b in text.as_bytes() {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x100_0000_01b3);
    }
    h
}

impl Text {
    pub fn new(fonts: Vec<Font>) -> Text {
        // ordem por estilo: o estilo exato primeiro, depois o mais próximo (peso, depois itálico),
        // mantendo a ordem do hospedeiro em cada grupo
        let order = std::array::from_fn(|s| {
            let (bold, italic) = (s & 1 != 0, s & 2 != 0);
            let mut idx: Vec<u16> = (0..fonts.len() as u16).collect();
            idx.sort_by_key(|&i| {
                let f = &fonts[i as usize];
                u8::from(f.bold != bold) * 2 + u8::from(f.italic != italic)
            });
            idx
        });
        Text {
            fonts,
            order,
            bmp: std::array::from_fn(|_| Vec::new()),
            words: HashMap::new(),
            words_glyphs: 0,
            plans: HashMap::new(),
            buf: None,
            missing: BTreeSet::new(),
        }
    }

    /// (fonte, glifo, avanço em unidades) do caractere no estilo, com reserva.
    fn glyph(&mut self, style: usize, c: char) -> (u16, u16, u32) {
        let cp = c as u32;
        if cp < 0x10000 {
            let table = &mut self.bmp[style];
            if table.is_empty() {
                table.resize(0x10000, 0);
            }
            let e = table[cp as usize];
            if e != 0 {
                return (((e >> 1) & 0x7fff) as u16, ((e >> 16) & 0xffff) as u16, (e >> 32) as u32);
            }
        }
        let found = self.order[style].iter().copied().find(|&i| self.fonts[i as usize].has(cp));
        let (fi, gid) = match found {
            Some(i) => (i, self.fonts[i as usize].face.glyph_id(cp).min(0xffff) as u16),
            None => {
                if !ignorable(c) {
                    self.missing.insert(cp);
                }
                (self.order[style][0], 0)
            }
        };
        let adv = u32::from(self.fonts[fi as usize].face.advance_width(u32::from(gid)));
        if cp < 0x10000 {
            self.bmp[style][cp as usize] = 1 | (u64::from(fi) << 1) | (u64::from(gid) << 16) | (u64::from(adv) << 32);
        }
        (fi, gid, adv)
    }

    /// Glifos da linha na ordem VISUAL, x relativo (pt); devolve a largura.
    pub fn shape_line(&mut self, text: &str, size: f64, bold: bool, italic: bool, rtl_para: bool, out: &mut Vec<G>) -> f64 {
        let style = style_index(bold, italic);
        if text.is_empty() {
            return 0.0;
        }
        if !rtl_para && !complex(text) {
            // caminho rápido: glifo a glifo
            let mut pen = 0.0f64;
            let mut iter = text.char_indices().peekable();
            while let Some((i, c)) = iter.next() {
                let end = iter.peek().map_or(text.len(), |(j, _)| *j);
                let (f, gid, adv) = self.glyph(style, c);
                let a = f64::from(adv) * size / self.fonts[f as usize].upem;
                out.push(G { font: f, gid, cluster: i as u32, cluster_end: end as u32, x: pen as f32, dy: 0.0, adv: a as f32 });
                pen += a;
            }
            return pen;
        }
        let has_rtl = rtl_para || text.chars().any(is_rtl);
        let (levels, runs): (Vec<Level>, Vec<std::ops::Range<usize>>) = if has_rtl {
            let info = ParagraphBidiInfo::new(text, Some(if rtl_para { Level::rtl() } else { Level::ltr() }));
            let (levels, runs) = info.visual_runs(0..text.len());
            (levels, runs.into_iter().collect())
        } else {
            (vec![Level::ltr(); text.len().max(1)], vec![0..text.len()])
        };
        let mut pen = 0.0f64;
        for run in runs {
            let rtl = levels.get(run.start).is_some_and(|l| l.is_rtl());
            let s = &text[run.clone()];
            // trechos de mesma fonte e script; comuns ficam na fonte corrente quando ela tem o glifo
            let mut segs: Vec<(u16, std::ops::Range<usize>, u32, bool)> = Vec::new();
            let (mut cur, mut start, mut script, mut marks) = (u16::MAX, 0usize, 0u32, false);
            for (i, c) in s.char_indices() {
                let sc = script_of(c);
                let f = if cur != u16::MAX && (is_mark(c) || (sc == 0 && self.fonts[cur as usize].has(c as u32))) { cur } else { self.glyph(style, c).0 };
                let new_script = sc != 0 && script != 0 && sc != script && !is_mark(c);
                if f != cur || new_script {
                    if cur != u16::MAX {
                        segs.push((cur, start..i, script, marks));
                    }
                    cur = f;
                    start = i;
                    script = sc;
                    marks = false;
                } else if script == 0 {
                    script = sc;
                }
                marks |= is_mark(c);
            }
            if cur != u16::MAX {
                segs.push((cur, start..s.len(), script, marks));
            }
            if rtl {
                segs.reverse();
            }
            for (f, r, seg_script, seg_marks) in segs {
                let seg = &s[r.clone()];
                let base = run.start + r.start;
                let scale = size / self.fonts[f as usize].upem;
                let shaped = seg_marks || seg.chars().any(needs_shaping) || !matches!(seg_script, 0 | 1 | 2 | 6 | 7);
                if !shaped {
                    let chars: Vec<(usize, char)> = seg.char_indices().collect();
                    let order: Box<dyn Iterator<Item = &(usize, char)>> = if rtl { Box::new(chars.iter().rev()) } else { Box::new(chars.iter()) };
                    for &(i, c) in order {
                        let c2 = if rtl { mirror(c) } else { c };
                        let font = &self.fonts[f as usize];
                        let mut gid = font.face.glyph_id(c2 as u32).min(0xffff) as u16;
                        if gid == 0 {
                            gid = font.face.glyph_id(c as u32).min(0xffff) as u16;
                        }
                        if gid == 0 && !ignorable(c) {
                            self.missing.insert(c as u32);
                        }
                        let a = f64::from(font.face.advance_width(u32::from(gid))) * scale;
                        let end = base + i + c.len_utf8();
                        out.push(G { font: f, gid, cluster: (base + i) as u32, cluster_end: end as u32, x: pen as f32, dy: 0.0, adv: a as f32 });
                        pen += a;
                    }
                    continue;
                }
                // por palavra (o espaço não liga letras nem forma conjunto): cada palavra moldada uma vez
                let mut items: Vec<(usize, usize)> = Vec::new();
                let mut ws = 0usize;
                for (i, c) in seg.char_indices() {
                    if c == ' ' {
                        if i > ws {
                            items.push((ws, i));
                        }
                        items.push((i, i + 1));
                        ws = i + 1;
                    }
                }
                if seg.len() > ws {
                    items.push((ws, seg.len()));
                }
                if rtl {
                    items.reverse();
                }
                for (a, b) in items {
                    let word = &seg[a..b];
                    if word == " " {
                        let font = &self.fonts[f as usize];
                        let gid = font.face.glyph_id(32).min(0xffff) as u16;
                        let adv = f64::from(font.face.advance_width(u32::from(gid))) * scale;
                        out.push(G { font: f, gid, cluster: (base + a) as u32, cluster_end: (base + b) as u32, x: pen as f32, dy: 0.0, adv: adv as f32 });
                        pen += adv;
                        continue;
                    }
                    let key = fnv((u64::from(f) << 1) | u64::from(rtl), word);
                    if !matches!(self.words.get(&key), Some((w, _)) if &**w == word) {
                        let glyphs = self.shape_word(f, rtl, word);
                        if self.words_glyphs + glyphs.len() > WORD_CACHE_GLYPHS {
                            self.words.clear();
                            self.words_glyphs = 0;
                        }
                        self.words_glyphs += glyphs.len();
                        self.words.insert(key, (Box::from(word), glyphs));
                    }
                    let Some((_, glyphs)) = self.words.get(&key) else { continue };
                    // fim do texto de origem de cada cluster (para o ToUnicode de ligaduras)
                    let mut clusters: Vec<u32> = glyphs.iter().map(|g| g.cl).collect();
                    clusters.sort_unstable();
                    clusters.dedup();
                    for g in glyphs.iter() {
                        let next = clusters.iter().copied().find(|&c| c > g.cl).unwrap_or(word.len() as u32);
                        if g.gid == 0 {
                            if let Some(c) = word.get(g.cl as usize..).and_then(|t| t.chars().next()) {
                                if !ignorable(c) {
                                    self.missing.insert(c as u32);
                                }
                            }
                        }
                        let adv = f64::from(g.adv) * scale;
                        out.push(G {
                            font: f,
                            gid: g.gid,
                            cluster: (base + a) as u32 + g.cl,
                            cluster_end: (base + a) as u32 + next,
                            x: (pen + f64::from(g.xoff) * scale) as f32,
                            dy: (f64::from(g.yoff) * scale) as f32,
                            adv: adv as f32,
                        });
                        pen += adv;
                    }
                }
            }
        }
        pen
    }

    fn shape_word(&mut self, f: u16, rtl: bool, word: &str) -> Box<[WordGlyph]> {
        let face = &self.fonts[f as usize].rb;
        let mut buf = self.buf.take().unwrap_or_default();
        buf.push_str(word);
        let dir = if rtl { rustybuzz::Direction::RightToLeft } else { rustybuzz::Direction::LeftToRight };
        buf.set_direction(dir);
        buf.guess_segment_properties();
        let script = buf.script();
        let plan = self.plans.entry((f, rtl, script)).or_insert_with(|| rustybuzz::ShapePlan::new(face, dir, Some(script), None, &[]));
        let gb = rustybuzz::shape_with_plan(face, plan, buf);
        let glyphs = gb
            .glyph_infos()
            .iter()
            .zip(gb.glyph_positions())
            .map(|(gi, gp)| WordGlyph { gid: gi.glyph_id.min(0xffff) as u16, cl: gi.cluster, adv: gp.x_advance, xoff: gp.x_offset, yoff: gp.y_offset })
            .collect();
        self.buf = Some(gb.clear());
        glyphs
    }
}

/// Uma linha quebrada: faixa de bytes do texto, glifos (ordem visual, x relativo) e largura.
pub struct Line {
    pub start: usize,
    pub end: usize,
    pub glyphs: Vec<G>,
    pub width: f64,
}

/// Quebra `text` em linhas de até `avail` pt: oportunidades do UAX #14; trecho maior que a coluna
/// quebra em limite de grafema. O texto inteiro é moldado uma vez; cada linha recorta seus glifos
/// (na ordem visual do texto inteiro). Devolve as linhas e se alguma palavra foi partida.
pub fn wrap(t: &mut Text, text: &str, size: f64, bold: bool, italic: bool, rtl: bool, avail: f64) -> (Vec<Line>, bool) {
    let mut all = Vec::new();
    let full = t.shape_line(text, size, bold, italic, rtl, &mut all);
    if full <= avail && !text.contains('\n') {
        return (vec![Line { start: 0, end: text.len(), glyphs: all, width: full }], false);
    }
    // largura por byte de origem (soma dos avanços de cada cluster)
    let mut adv_at = vec![0f32; text.len() + 1];
    for g in &all {
        if let Some(v) = adv_at.get_mut(g.cluster as usize) {
            *v += g.adv;
        }
    }
    let width_of = |a: usize, b: usize| -> f64 { adv_at[a..b].iter().map(|v| f64::from(*v)).sum() };
    // segmentos entre oportunidades de quebra
    let mut ranges: Vec<(usize, usize)> = Vec::new();
    let mut split = false;
    let (mut ls, mut le, mut lw) = (0usize, 0usize, 0.0f64);
    let mut seg_start = 0usize;
    for (pos, kind) in unicode_linebreak::linebreaks(text) {
        let seg = &text[seg_start..pos];
        let trimmed_len = seg.trim_end_matches([' ', '\n', '\r', '\t']).len();
        let content_end = seg_start + trimmed_len;
        let w_content = width_of(seg_start, content_end);
        let w_full = width_of(seg_start, pos);
        if le > ls && lw + w_content > avail {
            ranges.push((ls, le));
            ls = seg_start;
            le = ls;
            lw = 0.0;
        }
        if w_content > avail {
            // trecho maior que a coluna: quebra por grafema
            split = true;
            let mut gs = seg_start;
            let mut gw = 0.0;
            for (gi, g) in text[seg_start..content_end].grapheme_indices(true) {
                let a = seg_start + gi;
                let w = width_of(a, a + g.len());
                if gw + w > avail && a > gs {
                    ranges.push((gs, a));
                    gs = a;
                    gw = 0.0;
                }
                gw += w;
            }
            ls = gs;
            le = content_end;
            lw = gw + (w_full - w_content);
        } else {
            if le == ls {
                ls = seg_start;
            }
            le = content_end.max(ls);
            lw += w_full;
        }
        seg_start = pos;
        if matches!(kind, unicode_linebreak::BreakOpportunity::Mandatory) && pos < text.len() {
            ranges.push((ls, le));
            ls = pos;
            le = pos;
            lw = 0.0;
        }
    }
    if le > ls || ranges.is_empty() {
        ranges.push((ls, le));
    }
    let lines = ranges
        .into_iter()
        .map(|(a, b)| {
            let mut pen = 0.0f32;
            let mut pen_full = 0.0f32;
            let mut glyphs = Vec::new();
            for g in &all {
                let c = g.cluster as usize;
                if c >= a && c < b && !text[c..].starts_with('\n') {
                    glyphs.push(G { x: pen + (g.x - pen_full), ..*g });
                    pen += g.adv;
                }
                pen_full += g.adv;
            }
            Line { start: a, end: b, glyphs, width: f64::from(pen) }
        })
        .collect();
    (lines, split)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::writer::Writer;

    fn text() -> Text {
        let dir = format!("{}/../src/test/fonts", env!("CARGO_MANIFEST_DIR"));
        let mut w = Writer::new(4096);
        let load = |i: usize, name: &str, bold: bool, w: &mut Writer| Font::load(i, std::fs::read(format!("{dir}/{name}")).unwrap(), bold, false, w).unwrap();
        let fonts = vec![
            load(0, "NotoSans-Regular.subset.ttf", false, &mut w),
            load(1, "NotoSans-Bold.subset.ttf", true, &mut w),
            load(2, "NotoSansArabic-Regular.subset.ttf", false, &mut w),
        ];
        Text::new(fonts)
    }

    #[test]
    fn a_mesma_palavra_em_estilos_diferentes_usa_fontes_diferentes() {
        let mut t = text();
        let (mut a, mut b) = (Vec::new(), Vec::new());
        t.shape_line("Total", 8.0, false, false, false, &mut a);
        t.shape_line("Total", 8.0, true, false, false, &mut b);
        assert!(a.iter().all(|g| g.font == 0));
        assert!(b.iter().all(|g| g.font == 1));
        // de novo (do cache): continua separado
        let (mut c, mut d) = (Vec::new(), Vec::new());
        t.shape_line("Total", 8.0, false, false, false, &mut c);
        t.shape_line("Total", 8.0, true, false, false, &mut d);
        assert_eq!(c.iter().map(|g| g.font).collect::<Vec<_>>(), a.iter().map(|g| g.font).collect::<Vec<_>>());
        assert_eq!(d.iter().map(|g| g.font).collect::<Vec<_>>(), b.iter().map(|g| g.font).collect::<Vec<_>>());
    }

    #[test]
    fn arabe_e_moldado_em_ordem_visual_e_numeros_ficam_ltr() {
        let mut t = text();
        let mut g = Vec::new();
        t.shape_line("رقم 123", 8.0, false, false, false, &mut g);
        // ordem visual: "123" (LTR) vem à esquerda da palavra árabe
        let digits: Vec<f32> = g.iter().filter(|x| x.font == 0 || (x.cluster as usize) >= "رقم ".len()).map(|x| x.x).collect();
        let arabic: Vec<f32> = g.iter().filter(|x| (x.cluster as usize) < "رقم".len()).map(|x| x.x).collect();
        assert!(digits.iter().cloned().fold(f32::MAX, f32::min) < arabic.iter().cloned().fold(f32::MAX, f32::min));
        assert!(t.missing.is_empty());
    }

    #[test]
    fn quebra_por_palavra_e_por_grafema_na_palavra_longa() {
        let mut t = text();
        let (lines, split) = wrap(&mut t, "alpha beta gamma delta", 8.0, false, false, false, 40.0);
        assert!(lines.len() >= 2);
        assert!(!split);
        let (lines, split) = wrap(&mut t, "Supercalifragilisticexpialidocious", 8.0, false, false, false, 30.0);
        assert!(lines.len() >= 3);
        assert!(split);
        let joined: String = lines.iter().map(|l| &"Supercalifragilisticexpialidocious"[l.start..l.end]).collect();
        assert_eq!(joined, "Supercalifragilisticexpialidocious");
    }
}
