//! O documento: geometria (papel, orientação, colunas ocultas/espremidas), layout em passo único
//! (cada célula moldada uma vez), desenho do conteúdo com marcação, estrutura (`Table`, grupos,
//! linha adaptativa, links, figuras) e o fecho (fontes, recursos, páginas, marcadores, XMP).

use std::collections::VecDeque;
use std::fmt::Write as _;

use crate::fonts::Font;
use crate::images::{self, Image};
use crate::input::{Align, Cell, Config, Kind, Layout, Row};
use crate::tags::{self, Tags};
use crate::text::{self, G, Line, Text};
use crate::writer::{Writer, literal, num, put_cents, put_num, text_string};

const PAD: f64 = 2.0;
/// Recuo por nível de grupo (pt).
const INDENT: f64 = 10.0;
/// TRs por TBody (mantém os arrays `/K` pequenos).
const TBODY_ROWS: u32 = 2000;

/// Uma célula já medida e moldada.
struct CellLayout {
    lines: Vec<Line>,
    /// texto lógico da célula (ActualText) quando houve shaping/bidi ou palavra partida
    actual: Option<String>,
    text: String,
    align: Align,
    color: u32,
    bg: Option<u32>,
    lang: Option<String>,
    image: Option<(u32, String)>,
    link: Option<(String, String)>,
    image_h: f64,
}

/// Uma coluna visível na página: índice na config, x (já espelhado em RTL) e largura.
#[derive(Clone, Copy)]
struct Col {
    index: usize,
    x: f64,
    w: f64,
}

pub struct Doc {
    pub w: Writer,
    t: Text,
    tags: Tags,
    cfg: Config,
    images: Vec<Image>,
    // geometria
    pw: f64,
    ph: f64,
    cols: Vec<Col>,
    hidden: Vec<usize>,
    table_x: f64,
    table_w: f64,
    header: Option<Vec<Cell>>,
    // entrada
    pub rows: VecDeque<Row>,
    pub input_done: bool,
    pub rows_done: u64,
    // estrutura
    doc_elem: u32,
    table_depth: Option<usize>,
    thead_done: bool,
    tbody_open: bool,
    tbody_rows: u32,
    tfoot_open: bool,
    sect_open: bool,
    col_ids: Vec<String>,
    group_ids: Vec<String>,
    stripe: u32,
    // página
    page_open: bool,
    page_obj: u32,
    content: Vec<u8>,
    y: f64,
    rows_on_page: u32,
    annots: Vec<u32>,
    pub pages: Vec<u32>,
    /// estado gráfico corrente do conteúdo da página (evita repetir cor e fonte)
    gs_fill: Option<u32>,
    gs_stroke: Option<u32>,
    gs_font: Option<(u16, u64)>,
    /// objeto de texto aberto (BT sem ET): as células de uma linha dividem um BT, cada uma com o
    /// seu BDC/EMC dentro; `text_mc` = profundidade de conteúdo marcado em que o BT abriu
    in_text: bool,
    text_mc: u32,
    mc_depth: u32,
    /// origem da linha de texto corrente (centésimos de pt), para o `Td` relativo
    tlm: (i64, i64),
    /// objetos de atributo (`/A`) compartilhados: TD por coluna (muda com os IDs de cabeçalho), TH de linha
    td_attr: Vec<Option<u32>>,
    row_scope: Option<u32>,
    /// fios das linhas seguidas com as mesmas divisas: desenhados juntos (por cima dos fundos)
    rules: Option<RuleRun>,
    // documento
    pages_node: u32,
    resources: u32,
    total_form: u32,
    metadata: u32,
    outline: Vec<(String, u32, f64)>,
    started: bool,
}

/// Fios adiados: divisas verticais (x) e as horizontais (y) de linhas seguidas da tabela.
struct RuleRun {
    xs: Vec<f64>,
    ys: Vec<f64>,
}

fn put_rgb(out: &mut Vec<u8>, c: u32) {
    put_num(out, f64::from((c >> 16) & 255) / 255.0);
    out.push(b' ');
    put_num(out, f64::from((c >> 8) & 255) / 255.0);
    out.push(b' ');
    put_num(out, f64::from(c & 255) / 255.0);
}

/// Números separados por espaço, seguidos do operador `op` (`re f`, `m`, `l`…).
fn put_op(out: &mut Vec<u8>, nums: &[f64], op: &[u8]) {
    for v in nums {
        put_num(out, *v);
        out.push(b' ');
    }
    out.extend_from_slice(op);
}

fn rgb(c: u32) -> String {
    format!("{} {} {}", num(f64::from((c >> 16) & 255) / 255.0), num(f64::from((c >> 8) & 255) / 255.0), num(f64::from(c & 255) / 255.0))
}

impl Doc {
    pub fn new(cfg: Config, fonts: Vec<Font>, mut w: Writer) -> Doc {
        let mut tags = Tags::new(&mut w);
        let doc_elem = tags.open(&mut w, "Document", String::new());
        let pages_node = w.alloc();
        let resources = w.alloc();
        let total_form = w.alloc();
        let metadata = w.alloc();
        Doc {
            w,
            t: Text::new(fonts),
            tags,
            cfg,
            images: Vec::new(),
            pw: 0.0,
            ph: 0.0,
            cols: Vec::new(),
            hidden: Vec::new(),
            table_x: 0.0,
            table_w: 0.0,
            header: None,
            rows: VecDeque::new(),
            input_done: false,
            rows_done: 0,
            doc_elem,
            table_depth: None,
            thead_done: false,
            tbody_open: false,
            tbody_rows: 0,
            tfoot_open: false,
            sect_open: false,
            col_ids: Vec::new(),
            group_ids: Vec::new(),
            stripe: 0,
            page_open: false,
            page_obj: 0,
            content: Vec::new(),
            y: 0.0,
            rows_on_page: 0,
            annots: Vec::new(),
            pages: Vec::new(),
            gs_fill: None,
            gs_stroke: None,
            gs_font: None,
            in_text: false,
            text_mc: 0,
            mc_depth: 0,
            tlm: (0, 0),
            td_attr: Vec::new(),
            row_scope: None,
            rules: None,
            pages_node,
            resources,
            total_form,
            metadata,
            outline: Vec::new(),
            started: false,
        }
    }

    pub fn add_image(&mut self, data: &[u8], format: u8, width: f64, height: f64) -> Result<u32, String> {
        let img = images::add(&mut self.w, self.images.len(), data, format, width, height)?;
        self.images.push(img);
        Ok((self.images.len() - 1) as u32)
    }

    pub fn missing(&self) -> &std::collections::BTreeSet<u32> {
        &self.t.missing
    }

    fn size(&self) -> f64 {
        self.cfg.font_size
    }

    fn lh(&self) -> f64 {
        self.cfg.font_size * 1.25
    }

    // ------------------------------------------------------------------ geometria

    /// Papel, orientação e colunas: retrato → paisagem → ocultas (regra da spec 21) → espremidas.
    fn plan(&mut self) {
        let m = self.cfg.margin;
        let (pw, ph) = (self.cfg.paper_w.min(self.cfg.paper_h), self.cfg.paper_w.max(self.cfg.paper_h));
        let needed: f64 = self.cfg.columns.iter().map(|c| c.width).sum();
        let landscape = match self.cfg.orientation {
            1 => false,
            2 => true,
            _ => needed > pw - 2.0 * m,
        };
        (self.pw, self.ph) = if landscape { (ph, pw) } else { (pw, ph) };
        let avail = self.pw - 2.0 * m;
        let n = self.cfg.columns.len();
        let mut hidden: Vec<usize> = Vec::new();
        if self.cfg.auto_hide && needed > avail && n > 1 {
            let mut order: Vec<usize> = (0..n).filter(|&i| !self.cfg.columns[i].fixed && (!self.cfg.any_priority || self.cfg.columns[i].priority.is_some())).collect();
            if self.cfg.any_priority {
                order.sort_by(|&a, &b| self.cfg.columns[a].priority.cmp(&self.cfg.columns[b].priority).then(b.cmp(&a)));
            } else {
                order.reverse();
            }
            let mut total = needed;
            let mut remaining = n;
            for i in order {
                if total <= avail || remaining <= 1 {
                    break;
                }
                hidden.push(i);
                total -= self.cfg.columns[i].width;
                remaining -= 1;
            }
            hidden.sort_unstable();
        }
        let visible: Vec<usize> = (0..n).filter(|i| !hidden.contains(i)).collect();
        let vis_sum: f64 = visible.iter().map(|&i| self.cfg.columns[i].width).sum::<f64>().max(1.0);
        // espreme (ou estica até a largura útil): proporcional; mínimo de ~3 caracteres
        let min_w = self.size() * 2.5 + 2.0 * PAD;
        let mut widths: Vec<f64> = visible.iter().map(|&i| (self.cfg.columns[i].width * avail / vis_sum).max(min_w)).collect();
        let total: f64 = widths.iter().sum();
        if total > avail {
            let k = avail / total;
            for w in &mut widths {
                *w *= k;
            }
        }
        self.table_w = widths.iter().sum();
        self.table_x = if self.cfg.rtl { self.pw - m - self.table_w } else { m };
        let mut x = 0.0;
        self.cols = visible
            .iter()
            .zip(widths)
            .map(|(&index, w)| {
                let cx = if self.cfg.rtl { self.pw - m - x - w } else { m + x };
                x += w;
                Col { index, x: cx, w }
            })
            .collect();
        self.hidden = hidden;
    }

    // ------------------------------------------------------------------ medida

    fn measure(&mut self, cell: &Cell, w: f64, align_default: Align, color: u32, extra_indent: f64) -> CellLayout {
        let avail = (w - 2.0 * PAD - extra_indent).max(1.0);
        let size = self.size();
        let (lines, split) = text::wrap(&mut self.t, &cell.text, size, cell.bold, cell.italic, self.cfg.rtl, avail);
        let actual = (split || self.cfg.rtl || text::complex(&cell.text)).then(|| cell.text.clone());
        let image_h = cell.image.as_ref().and_then(|(i, _)| self.images.get(*i as usize)).map_or(0.0, |img| img.height.min(w - 2.0 * PAD) + PAD);
        CellLayout {
            lines,
            actual,
            text: cell.text.clone(),
            align: cell.align.unwrap_or(align_default),
            color: cell.color.unwrap_or(color),
            bg: cell.bg,
            lang: cell.lang.clone(),
            image: cell.image.clone(),
            link: cell.link.clone(),
            image_h,
        }
    }

    fn cell_h(&self, c: &CellLayout) -> f64 {
        let n = if c.text.is_empty() { 0 } else { c.lines.len() };
        c.image_h + n as f64 * self.lh() + 2.0 * PAD
    }

    // ------------------------------------------------------------------ página

    fn open_page(&mut self) {
        self.page_obj = self.w.alloc();
        self.page_open = true;
        self.content.clear();
        // espessura única (fios da tabela e sublinhado); cor e fonte conforme o uso
        self.content.extend_from_slice(b"0.5 w\n");
        self.gs_fill = None;
        self.gs_stroke = None;
        self.gs_font = None;
        self.in_text = false;
        self.mc_depth = 0;
        self.annots.clear();
        self.rows_on_page = 0;
        self.y = self.cfg.margin;
        if self.pages.is_empty() {
            self.title();
        }
        self.pages.push(self.page_obj);
        if self.table_depth.is_some() {
            self.draw_header(!self.thead_done);
        }
    }

    fn bottom(&self) -> f64 {
        self.ph - self.cfg.margin - if self.cfg.page_numbers { self.lh() + 4.0 } else { 0.0 }
    }

    fn close_page(&mut self) {
        if !self.page_open {
            return;
        }
        self.flush_rules();
        self.page_open = false;
        self.end_text();
        if self.cfg.page_numbers {
            let n = self.pages.len();
            let label = self.cfg.page_label.replace("{page}", &n.to_string());
            let (before, _) = label.split_once("{pageCount}").unwrap_or((&label, ""));
            let before = before.to_owned();
            let size = self.size();
            let base = self.ph - self.cfg.margin + 2.0;
            let mut g = Vec::new();
            let wtxt = self.t.shape_line(&before, size, false, false, self.cfg.rtl, &mut g);
            let total_w = wtxt + size * 3.0;
            let x = (self.pw - total_w) / 2.0;
            self.content.extend_from_slice(b"/Artifact <</Type /Pagination /Subtype /Footer>> BDC\n");
            self.mc_depth += 1;
            let color = self.cfg.colors.text;
            self.glyphs(&g, &before, x, base, size, color);
            // o total (Y) é um formulário escrito no fim
            let fy = self.ph - base;
            self.end_text();
            let _ = write!(self.content_str(), "q 1 0 0 1 {} {} cm /Fm0 Do Q\n", num(x + wtxt), num(fy));
            self.emc();
        }
        debug_assert!(self.mc_depth == 0 && !self.in_text);
        let key = self.tags.end_page(&mut self.w);
        let contents = self.w.alloc();
        let data = std::mem::take(&mut self.content);
        self.w.stream(contents, "", &data, true);
        self.content = data;
        self.content.clear();
        let annots = if self.annots.is_empty() {
            String::new()
        } else {
            format!(" /Annots [{}]", self.annots.iter().map(|a| format!("{a} 0 R")).collect::<Vec<_>>().join(" "))
        };
        let page = format!(
            "<</Type /Page /Parent {} 0 R /MediaBox [0 0 {} {}] /Resources {} 0 R /Contents {contents} 0 R /StructParents {key} /Tabs /S{annots}>>",
            self.pages_node,
            num(self.pw),
            num(self.ph),
            self.resources
        );
        self.w.small(self.page_obj, page.as_bytes());
    }

    fn content_str(&mut self) -> ContentWriter<'_> {
        ContentWriter(&mut self.content)
    }

    fn fy(&self, y: f64) -> f64 {
        self.ph - y
    }

    fn set_fill(&mut self, color: u32) {
        if self.gs_fill != Some(color) {
            put_rgb(&mut self.content, color);
            self.content.extend_from_slice(b" rg\n");
            self.gs_fill = Some(color);
        }
    }

    fn set_stroke(&mut self, color: u32) {
        if self.gs_stroke != Some(color) {
            put_rgb(&mut self.content, color);
            self.content.extend_from_slice(b" RG\n");
            self.gs_stroke = Some(color);
        }
    }

    /// Abre o objeto de texto (se não houver um aberto).
    fn begin_text(&mut self) {
        if !self.in_text {
            self.content.extend_from_slice(b"BT\n");
            self.in_text = true;
            self.text_mc = self.mc_depth;
            self.tlm = (0, 0);
        }
    }

    /// Fecha o objeto de texto antes de um operador gráfico (caminho, imagem, formulário). Só
    /// pode ser chamado no nível de conteúdo marcado em que o BT abriu (o aninhamento fica certo).
    fn end_text(&mut self) {
        if self.in_text {
            debug_assert!(self.mc_depth <= self.text_mc, "ET dentro de um BDC aberto depois do BT");
            self.content.extend_from_slice(b"ET\n");
            self.in_text = false;
        }
    }

    /// Fecha o conteúdo marcado corrente (o BT aberto dentro dele fecha antes).
    fn emc(&mut self) {
        if self.in_text && self.text_mc >= self.mc_depth {
            self.end_text();
        }
        self.content.extend_from_slice(b"EMC\n");
        self.mc_depth = self.mc_depth.saturating_sub(1);
    }

    fn fill(&mut self, x: f64, y: f64, w: f64, h: f64, color: u32) {
        self.end_text();
        let fy = self.fy(y + h);
        self.content.extend_from_slice(b"/Artifact <</Type /Layout>> BDC\n");
        self.set_fill(color);
        put_op(&mut self.content, &[x, fy, w, h], b"re f EMC\n");
    }

    /// Fios de uma linha da tabela: adiados enquanto as linhas seguintes têm as mesmas divisas
    /// (a vertical vira um segmento só por trecho; os fundos das linhas ficam por baixo).
    fn row_rules(&mut self, y: f64, h: f64, spans: &[(f64, f64)]) {
        let mut xs: Vec<f64> = spans.iter().flat_map(|&(x, w)| [x, x + w]).collect();
        xs.sort_by(f64::total_cmp);
        xs.dedup_by(|a, b| (*a - *b).abs() < 0.01);
        if let Some(run) = self.rules.as_mut() {
            let same = run.xs.len() == xs.len() && run.xs.iter().zip(&xs).all(|(a, b)| (a - b).abs() < 0.01);
            if same && run.ys.last().is_some_and(|last| (last - y).abs() < 0.01) {
                run.ys.push(y + h);
                return;
            }
        }
        self.flush_rules();
        self.rules = Some(RuleRun { xs, ys: vec![y, y + h] });
    }

    /// Desenha os fios adiados (antes de fechar a página ou ao mudar as divisas).
    fn flush_rules(&mut self) {
        let Some(run) = self.rules.take() else { return };
        self.end_text();
        self.content.extend_from_slice(b"/Artifact <</Type /Layout>> BDC\n");
        self.set_stroke(self.cfg.colors.line);
        let (x0, x1) = (self.table_x, self.table_x + self.table_w);
        for &y in &run.ys {
            let fy = self.fy(y);
            put_op(&mut self.content, &[x0, fy], b"m ");
            put_op(&mut self.content, &[x1, fy], b"l\n");
        }
        let (top, bottom) = (self.fy(run.ys[0]), self.fy(*run.ys.last().unwrap_or(&run.ys[0])));
        for &x in &run.xs {
            put_op(&mut self.content, &[x, top], b"m ");
            put_op(&mut self.content, &[x, bottom], b"l\n");
        }
        self.content.extend_from_slice(b"S EMC\n");
    }

    /// Objeto de atributo `/A` do TD da coluna `k` (compartilhado pelas linhas até os IDs mudarem).
    fn td_attr(&mut self, k: usize) -> u32 {
        if self.td_attr.len() <= k {
            self.td_attr.resize(k + 1, None);
        }
        if let Some(o) = self.td_attr[k] {
            return o;
        }
        let body = format!("<</O /Table{}>>", self.headers_attr(k));
        let o = self.w.alloc();
        self.w.small(o, body.as_bytes());
        self.td_attr[k] = Some(o);
        o
    }

    /// Objeto de atributo `/A` do TH de linha (`/Scope /Row`).
    fn row_scope(&mut self) -> u32 {
        if let Some(o) = self.row_scope {
            return o;
        }
        let o = self.w.alloc();
        self.w.small(o, b"<</O /Table /Scope /Row>>");
        self.row_scope = Some(o);
        o
    }

    fn glyphs(&mut self, gs: &[G], text: &str, x0: f64, base: f64, size: f64, color: u32) {
        if gs.is_empty() {
            return;
        }
        self.set_fill(color);
        self.begin_text();
        let mut i = 0;
        while i < gs.len() {
            let g0 = gs[i];
            // fonte e tamanho são estado gráfico: valem entre BT/ET até a próxima troca
            let state = (g0.font, size.to_bits());
            if self.gs_font != Some(state) {
                self.content.push(b'/');
                self.content.extend_from_slice(self.t.fonts[g0.font as usize].res.as_bytes());
                self.content.push(b' ');
                put_op(&mut self.content, &[size], b"Tf\n");
                self.gs_font = Some(state);
            }
            let ty = self.fy(base - f64::from(g0.dy));
            // `Td` relativo à origem da linha anterior, em centésimos exatos (sem erro acumulado)
            let (xc, yc) = (((x0 + f64::from(g0.x)) * 100.0).round() as i64, (ty * 100.0).round() as i64);
            put_cents(&mut self.content, xc - self.tlm.0);
            self.content.push(b' ');
            put_cents(&mut self.content, yc - self.tlm.1);
            self.content.extend_from_slice(b" Td [");
            self.tlm = (xc, yc);
            let mut bytes = Vec::with_capacity(32);
            let mut pen = f64::from(g0.x);
            let mut j = i;
            while j < gs.len() {
                let g = gs[j];
                if g.font != g0.font || (j > i && (g.dy != g0.dy || g.x < gs[j - 1].x)) {
                    break;
                }
                if j > i {
                    let n = ((pen - f64::from(g.x)) * 1000.0 / size).round();
                    if n != 0.0 {
                        literal(&bytes, &mut self.content);
                        bytes.clear();
                        let _ = write!(self.content_str(), "{}", n as i64);
                        pen -= n * size / 1000.0;
                    }
                }
                bytes.extend_from_slice(&g.gid.to_be_bytes());
                let font = &mut self.t.fonts[g.font as usize];
                let src = text.get(g.cluster as usize..g.cluster_end as usize).unwrap_or("");
                font.use_glyph(g.gid, src);
                pen += font.width1000(g.gid) as f64 * size / 1000.0;
                j += 1;
            }
            literal(&bytes, &mut self.content);
            self.content.extend_from_slice(b"] TJ\n");
            i = j;
        }
    }

    /// x da linha de texto conforme o alinhamento (e a direção).
    fn line_x(&self, x: f64, w: f64, lw: f64, align: Align, indent: f64) -> f64 {
        let (start, end) = (x + PAD + if self.cfg.rtl { 0.0 } else { indent }, x + w - PAD - if self.cfg.rtl { indent } else { 0.0 });
        match (align, self.cfg.rtl) {
            (Align::Center, _) => (start + end - lw) / 2.0,
            (Align::Start, false) | (Align::End, true) => start,
            _ => end - lw,
        }
    }

    // ------------------------------------------------------------------ título, cabeçalho

    fn title(&mut self) {
        let size = self.size() * 1.75;
        let mut g = Vec::new();
        let title = self.cfg.title.clone();
        let w = self.t.shape_line(&title, size, true, false, self.cfg.rtl, &mut g);
        let h1 = self.tags.open(&mut self.w, "H1", if text::complex(&title) { tags::actual_text(&title) } else { String::new() });
        let mcid = self.tags.mcid_to(self.page_obj, h1);
        let x = if self.cfg.rtl { self.pw - self.cfg.margin - w } else { self.cfg.margin };
        let base = self.y + size;
        let _ = write!(self.content_str(), "/H1 <</MCID {mcid}>> BDC\n");
        self.mc_depth += 1;
        self.glyphs(&g, &title, x, base, size, self.cfg.colors.text);
        self.emc();
        self.tags.close(&mut self.w);
        self.y += size * 1.6;
    }

    /// Abre a tabela (dentro da seção corrente, se houver).
    fn open_table(&mut self) {
        self.tags.open(&mut self.w, "Table", String::new());
        self.table_depth = Some(self.tags.depth());
        self.thead_done = false;
        self.col_ids.clear();
        self.td_attr.clear();
        if self.page_open {
            self.draw_header(true);
        }
    }

    fn close_table(&mut self) {
        if let Some(d) = self.table_depth.take() {
            while self.tags.depth() >= d {
                self.tags.close(&mut self.w);
            }
        }
        self.tbody_open = false;
        self.tfoot_open = false;
        self.group_ids.clear();
        self.td_attr.clear();
    }

    /// Cabeçalho da tabela: na 1ª vez, `THead` real; nas páginas seguintes, artefato de paginação.
    fn draw_header(&mut self, real: bool) {
        let Some(header) = self.header.take() else { return };
        let color = self.cfg.colors.text;
        let cols = self.cols.clone();
        let layouts: Vec<CellLayout> = cols
            .iter()
            .map(|c| {
                let cell = &header[c.index];
                let a = self.cfg.columns[c.index].align;
                self.measure(cell, c.w, a, color, 0.0)
            })
            .collect();
        let h = layouts.iter().map(|l| self.cell_h(l)).fold(self.lh() + 2.0 * PAD, f64::max);
        let y = self.y;
        self.fill(self.table_x, y, self.table_w, h, self.cfg.colors.header);
        if real {
            self.tags.open(&mut self.w, "THead", String::new());
            let tr = self.tags.open(&mut self.w, "TR", String::new());
            for (c, l) in cols.iter().zip(&layouts) {
                let th = self.tags.open_detached(&mut self.w, tr, "TH", " /A <</O /Table /Scope /Column>>".to_owned());
                let id = self.tags.new_id(&mut self.w, th);
                self.tags.extend(th, &format!(" /ID ({id})"));
                self.col_ids.push(id);
                self.td_attr.clear();
                self.draw_cell(th, "TH", l, c.x, c.w, y, 0, usize::MAX, 0.0);
                self.tags.close_detached(&mut self.w, th);
            }
            self.tags.close(&mut self.w); // TR
            self.tags.close(&mut self.w); // THead
            self.thead_done = true;
        } else {
            self.content.extend_from_slice(b"/Artifact <</Type /Pagination /Subtype /Header>> BDC\n");
            self.mc_depth += 1;
            for (c, l) in cols.iter().zip(&layouts) {
                for (i, line) in l.lines.iter().enumerate() {
                    let base = y + PAD + l.image_h + self.lh() * i as f64 + self.size();
                    let x = self.line_x(c.x, c.w, line.width, l.align, 0.0);
                    self.glyphs_bold(&line.glyphs, &l.text, x, base, l);
                }
            }
            self.emc();
        }
        let spans: Vec<(f64, f64)> = cols.iter().map(|c| (c.x, c.w)).collect();
        self.row_rules(y, h, &spans);
        self.y += h;
        self.header = Some(header);
    }

    fn glyphs_bold(&mut self, gs: &[G], t: &str, x: f64, base: f64, l: &CellLayout) {
        let size = self.size();
        self.glyphs(gs, t, x, base, size, l.color);
    }

    /// Desenha as linhas `from..to` de uma célula (o conteúdo vai marcado com dono `owner`).
    #[allow(clippy::too_many_arguments)]
    fn draw_cell(&mut self, owner: u32, tag: &str, l: &CellLayout, x: f64, w: f64, y: f64, from: usize, to: usize, indent: f64) {
        let size = self.size();
        let lh = self.lh();
        let to = to.min(l.lines.len());
        if let Some(bg) = l.bg {
            // só a célula inteira (a linha alta pinta o fundo de cada pedaço)
            if from == 0 && to >= l.lines.len() {
                let h = self.cell_h(l);
                self.fill(x, y, w, h, bg);
            }
        }
        // imagem (só no 1º pedaço)
        if from == 0 {
            if let Some((img, alt)) = &l.image {
                if let Some(im) = self.images.get(*img as usize) {
                    let iw = (w - 2.0 * PAD).min(im.width * (l.image_h - PAD) / im.height.max(1.0));
                    let ih = l.image_h - PAD;
                    let ix = if self.cfg.rtl { x + w - PAD - iw } else { x + PAD };
                    let name = im.name.clone();
                    let fy = self.fy(y + PAD + ih);
                    self.end_text();
                    if alt.is_empty() {
                        let _ = write!(self.content_str(), "/Artifact BMC q {} 0 0 {} {} {} cm /{name} Do Q EMC\n", num(iw), num(ih), num(ix), num(fy));
                    } else {
                        let bbox = format!(" /A <</O /Layout /BBox [{} {} {} {}]>>", num(ix), num(fy), num(ix + iw), num(fy + ih));
                        let fig = self.tags.open_detached(&mut self.w, owner, "Figure", format!("{}{bbox}", tags::alt(alt)));
                        let mcid = self.tags.mcid_to(self.page_obj, fig);
                        let _ = write!(self.content_str(), "/Figure <</MCID {mcid}>> BDC q {} 0 0 {} {} {} cm /{name} Do Q EMC\n", num(iw), num(ih), num(ix), num(fy));
                        self.tags.close_detached(&mut self.w, fig);
                    }
                }
            }
        }
        if l.text.is_empty() || from >= to {
            return;
        }
        // dono do texto: Link, Span (ActualText) ou a própria célula
        let mut owner_text = owner;
        let mut span = None;
        if l.actual.is_some() {
            // texto lógico do pedaço desenhado (a célula inteira no caso comum)
            let (a, b) = (l.lines[from].start, l.lines[to - 1].end.max(l.lines[from].start));
            let logical = if from == 0 && to == l.lines.len() { l.text.as_str() } else { &l.text[a..b] };
            let s = self.tags.open_detached(&mut self.w, owner, "Span", tags::actual_text(logical));
            span = Some(s);
            owner_text = s;
        }
        let mut link = None;
        if let Some((url, desc)) = &l.link {
            let contents = if desc.is_empty() { l.text.clone() } else if desc.contains(&l.text) { desc.clone() } else { format!("{} {desc}", l.text) };
            let lk = self.tags.open_detached(&mut self.w, owner_text, "Link", String::new());
            link = Some((lk, url.clone(), contents));
            owner_text = lk;
        }
        let mcid = self.tags.mcid_to(self.page_obj, owner_text);
        let mtag = if link.is_some() { "Link" } else if span.is_some() { "Span" } else { tag };
        if link.is_some() {
            self.end_text();
        } else {
            // BT antes do BDC: as células seguintes da linha continuam no mesmo objeto de texto
            self.begin_text();
        }
        let _ = write!(self.content_str(), "/{mtag} <</MCID {mcid}>> BDC\n");
        self.mc_depth += 1;
        let mut rects = Vec::new();
        for i in from..to {
            let line = &l.lines[i];
            let base = y + PAD + if from == 0 { l.image_h } else { 0.0 } + lh * (i - from) as f64 + size;
            let lx = self.line_x(x, w, line.width, l.align, indent);
            self.glyphs(&line.glyphs, &l.text, lx, base, size, l.color);
            if link.is_some() {
                // sublinhado (o link não depende só da cor)
                let uy = self.fy(base + size * 0.12);
                self.end_text();
                self.set_stroke(l.color);
                put_op(&mut self.content, &[lx, uy], b"m ");
                put_op(&mut self.content, &[lx + line.width, uy], b"l S\n");
                rects.push((lx, self.fy(base + size * 0.25), lx + line.width, self.fy(base - size)));
            }
        }
        self.emc();
        if let Some((lk, url, contents)) = link {
            for r in rects {
                let annot = self.w.alloc();
                let key = self.tags.objr_to(&mut self.w, self.page_obj, annot, lk);
                let mut uri = Vec::new();
                literal(url.as_bytes(), &mut uri);
                let d = format!(
                    "<</Type /Annot /Subtype /Link /Rect [{} {} {} {}] /Border [0 0 0] /F 4 /Contents {} /StructParent {key} /A <</S /URI /URI {}>>>>",
                    num(r.0),
                    num(r.1),
                    num(r.2),
                    num(r.3),
                    text_string(&contents),
                    String::from_utf8_lossy(&uri)
                );
                self.w.small(annot, d.as_bytes());
                self.annots.push(annot);
            }
            self.tags.close_detached(&mut self.w, lk);
        }
        if let Some(s) = span {
            self.tags.close_detached(&mut self.w, s);
        }
    }

    // ------------------------------------------------------------------ linhas

    fn ensure_table(&mut self) {
        if self.table_depth.is_none() {
            // a página (e o título, filho do Document) antes da tabela
            if !self.page_open {
                self.open_page();
            }
            self.open_table();
        }
    }

    fn ensure_tbody(&mut self) {
        if !self.tbody_open || self.tbody_rows >= TBODY_ROWS {
            if self.tbody_open {
                self.tags.close(&mut self.w);
            }
            self.tags.open(&mut self.w, "TBody", String::new());
            self.tbody_open = true;
            self.tbody_rows = 0;
        }
    }

    /// Garante espaço para `h`: senão fecha a página e abre outra (com o cabeçalho repetido).
    fn room(&mut self, h: f64) {
        if !self.page_open {
            self.open_page();
        }
        if self.y + h > self.bottom() && self.rows_on_page > 0 {
            self.close_page();
            self.open_page();
        }
    }

    /// Processa uma linha da entrada.
    pub fn row(&mut self, row: Row) {
        if !self.started {
            self.started = true;
        }
        match row.kind {
            Kind::Header => {
                self.header = Some(row.cells);
                if self.cols.is_empty() {
                    self.plan();
                }
            }
            Kind::Group => self.group(row),
            Kind::Data => self.data(row),
            Kind::Footer | Kind::Total => self.summary(row),
        }
        self.rows_done += 1;
    }

    /// `/A` próprio (inline) de uma TD numa linha com cabeçalho de linha: coluna, grupos
    /// `groups` e o TH da linha (com `/Headers` explícito o leitor não soma o `/Scope /Row`).
    fn headers_with(&self, col: usize, groups: &[String], row_th: &str) -> String {
        let mut s = String::from(" /A <</O /Table /Headers [");
        if let Some(id) = self.col_ids.get(col) {
            let _ = write!(s, "({id}) ");
        }
        for g in groups {
            let _ = write!(s, "({g}) ");
        }
        let _ = write!(s, "({row_th})]>>");
        s
    }

    fn headers_attr(&self, col: usize) -> String {
        let mut s = String::from(" /Headers [");
        if let Some(id) = self.col_ids.get(col) {
            let _ = write!(s, "({id}) ");
        }
        for g in &self.group_ids {
            let _ = write!(s, "({g}) ");
        }
        s.push(']');
        s
    }

    fn data(&mut self, row: Row) {
        if self.cols.is_empty() {
            self.plan();
        }
        let color = self.cfg.colors.text;
        let cols = self.cols.clone();
        let layouts: Vec<CellLayout> = cols
            .iter()
            .map(|c| {
                let a = self.cfg.columns[c.index].align;
                let cell = row.cells.get(c.index);
                match cell {
                    Some(cell) => self.measure(cell, c.w, a, color, 0.0),
                    None => self.measure(&empty_cell(), c.w, a, color, 0.0),
                }
            })
            .collect();
        // linha adaptativa: "Rótulo: valor" das colunas ocultas
        let adaptive: Vec<CellLayout> = self
            .hidden
            .clone()
            .iter()
            .filter_map(|&i| {
                let c = row.cells.get(i)?;
                if c.text.is_empty() {
                    return None;
                }
                let label = self.cfg.columns[i].label.clone();
                let cell = Cell { text: format!("{label}{}{}", self.cfg.adaptive_sep, c.text), bold: false, italic: c.italic, align: Some(Align::Start), color: c.color, bg: None, lang: c.lang.clone(), image: None, link: None };
                Some(self.measure(&cell, self.table_w, Align::Start, color, INDENT))
            })
            .collect();
        let h = layouts.iter().map(|l| self.cell_h(l)).fold(self.lh() + 2.0 * PAD, f64::max);
        let ah: f64 = adaptive.iter().map(|l| l.lines.len() as f64 * self.lh()).sum::<f64>() + if adaptive.is_empty() { 0.0 } else { 2.0 * PAD };
        self.ensure_table();
        self.room(h + ah);
        self.ensure_tbody();
        self.tbody_rows += 1;
        if self.y + h > self.bottom() {
            // linha mais alta que a página: quebra entre linhas de texto (nada se perde)
            let row_header_id = self.tall_row(&cols, &layouts, !adaptive.is_empty());
            self.stripe += 1;
            if !adaptive.is_empty() {
                self.room(ah);
                self.adaptive_line(&cols, &adaptive, ah, row_header_id);
            }
            self.rows_on_page += 1;
            return;
        }
        let y = self.y;
        if self.cfg.striped && self.stripe % 2 == 1 {
            self.fill(self.table_x, y, self.table_w, h + ah, self.cfg.colors.stripe);
        }
        self.stripe += 1;
        let tr = self.tags.open(&mut self.w, "TR", String::new());
        let mut row_header_id: Option<String> = None;
        for (k, (c, l)) in cols.iter().zip(&layouts).enumerate() {
            let lang = l.lang.as_deref().map(tags::lang).unwrap_or_default();
            let (ty, cell) = if k == 0 && !adaptive.is_empty() {
                let attr = self.row_scope();
                ("TH", self.tags.open_cell(&mut self.w, tr, "TH", attr, lang))
            } else if let Some(th) = row_header_id.as_deref() {
                let extra = format!("{}{lang}", self.headers_with(k, &self.group_ids, th));
                ("TD", self.tags.open_detached(&mut self.w, tr, "TD", extra))
            } else {
                let attr = self.td_attr(k);
                ("TD", self.tags.open_cell(&mut self.w, tr, "TD", attr, lang))
            };
            if ty == "TH" {
                let id = self.tags.new_id(&mut self.w, cell);
                self.tags.extend(cell, &format!(" /ID ({id})"));
                row_header_id = Some(id);
            }
            self.draw_cell(cell, ty, l, c.x, c.w, y, 0, usize::MAX, 0.0);
            self.tags.close_detached(&mut self.w, cell);
        }
        self.tags.close(&mut self.w); // TR
        let spans: Vec<(f64, f64)> = cols.iter().map(|c| (c.x, c.w)).collect();
        self.row_rules(y, h, &spans);
        self.y += h;
        if !adaptive.is_empty() {
            self.adaptive_line(&cols, &adaptive, ah, row_header_id);
        }
        self.rows_on_page += 1;
    }

    /// Linha adaptativa: "Rótulo: valor" das colunas ocultas, numa célula que cobre a linha.
    fn adaptive_line(&mut self, cols: &[Col], adaptive: &[CellLayout], ah: f64, row_header_id: Option<String>) {
        let ay = self.y;
        let tr = self.tags.open(&mut self.w, "TR", String::new());
        let headers = row_header_id.map(|id| format!(" /Headers [({id})]")).unwrap_or_default();
        let td = self.tags.open_detached(&mut self.w, tr, "TD", format!(" /A <</O /Table /ColSpan {}{headers}>>", cols.len()));
        let list = self.tags.open_detached(&mut self.w, td, "L", String::new());
        let mut yy = ay + PAD;
        for l in adaptive {
            let li = self.tags.open_detached(&mut self.w, list, "LI", String::new());
            let body = self.tags.open_detached(&mut self.w, li, "LBody", String::new());
            self.draw_cell(body, "LBody", l, self.table_x, self.table_w, yy - PAD, 0, usize::MAX, INDENT);
            yy += l.lines.len() as f64 * self.lh();
            self.tags.close_detached(&mut self.w, body);
            self.tags.close_detached(&mut self.w, li);
        }
        self.tags.close_detached(&mut self.w, list);
        self.tags.close_detached(&mut self.w, td);
        self.tags.close(&mut self.w);
        self.row_rules(ay, ah, &[(self.table_x, self.table_w)]);
        self.y += ah;
    }

    /// Linha de dados mais alta que a página: as células continuam na página seguinte, linha de
    /// texto a linha de texto (cada pedaço é um MCID da mesma célula). Devolve o ID do cabeçalho de
    /// linha (com linha adaptativa).
    fn tall_row(&mut self, cols: &[Col], layouts: &[CellLayout], row_header: bool) -> Option<String> {
        let lh = self.lh();
        let tr = self.tags.open(&mut self.w, "TR", String::new());
        let mut row_header_id: Option<String> = None;
        let cells: Vec<(u32, &'static str)> = cols
            .iter()
            .zip(layouts)
            .enumerate()
            .map(|(k, (_, l))| {
                let lang = l.lang.as_deref().map(tags::lang).unwrap_or_default();
                let (ty, cell) = if k == 0 && row_header {
                    let attr = self.row_scope();
                    ("TH", self.tags.open_cell(&mut self.w, tr, "TH", attr, lang))
                } else if let Some(th) = row_header_id.as_deref() {
                    let extra = format!("{}{lang}", self.headers_with(k, &self.group_ids, th));
                    ("TD", self.tags.open_detached(&mut self.w, tr, "TD", extra))
                } else {
                    let attr = self.td_attr(k);
                    ("TD", self.tags.open_cell(&mut self.w, tr, "TD", attr, lang))
                };
                if ty == "TH" {
                    let id = self.tags.new_id(&mut self.w, cell);
                    self.tags.extend(cell, &format!(" /ID ({id})"));
                    row_header_id = Some(id);
                }
                (cell, ty)
            })
            .collect();
        let mut from = vec![0usize; cols.len()];
        loop {
            let y = self.y;
            let avail = self.bottom() - y;
            let mut chunk_h = lh + 2.0 * PAD;
            let mut plan = Vec::with_capacity(cols.len());
            for (k, l) in layouts.iter().enumerate() {
                let img = if from[k] == 0 { l.image_h } else { 0.0 };
                let fit = (((avail - 2.0 * PAD - img) / lh).floor().max(1.0)) as usize;
                let n = if l.text.is_empty() { 0 } else { l.lines.len() };
                let to = (from[k] + fit).min(n);
                chunk_h = chunk_h.max(img + (to - from[k].min(to)) as f64 * lh + 2.0 * PAD);
                plan.push(to);
            }
            for (k, (c, l)) in cols.iter().zip(layouts).enumerate() {
                // fundo do pedaço (o `draw_cell` só pinta o fundo da célula inteira)
                if let Some(bg) = l.bg {
                    self.fill(c.x, y, c.w, chunk_h, bg);
                }
                self.draw_cell(cells[k].0, cells[k].1, l, c.x, c.w, y, from[k], plan[k], 0.0);
                from[k] = plan[k];
            }
            let spans: Vec<(f64, f64)> = cols.iter().map(|c| (c.x, c.w)).collect();
            self.row_rules(y, chunk_h, &spans);
            self.y += chunk_h;
            self.rows_on_page += 1;
            let done = layouts.iter().enumerate().all(|(k, l)| l.text.is_empty() || from[k] >= l.lines.len());
            if done {
                break;
            }
            self.close_page();
            self.open_page();
        }
        for (cell, _) in cells {
            self.tags.close_detached(&mut self.w, cell);
        }
        self.tags.close(&mut self.w);
        row_header_id
    }

    fn group(&mut self, row: Row) {
        if self.cols.is_empty() {
            self.plan();
        }
        let level = usize::from(row.level);
        let label = row.cells.first().map(|c| c.text.clone()).unwrap_or_default();
        if self.cfg.layout == Layout::Sections && level == 0 {
            // nova seção: fecha a tabela/seção anterior; título H2; tabela nova
            self.close_table();
            if self.sect_open {
                self.tags.close(&mut self.w);
            }
            self.tags.open(&mut self.w, "Sect", String::new());
            self.sect_open = true;
            let size = self.size() * 1.35;
            let need = size * 2.0 + self.lh() * 3.0;
            if !self.page_open {
                self.open_page();
            } else if self.y + need > self.bottom() {
                self.close_page();
                self.open_page();
            }
            self.y += size * 0.6;
            let mut g = Vec::new();
            let w = self.t.shape_line(&label, size, true, false, self.cfg.rtl, &mut g);
            let h2 = self.tags.open(&mut self.w, "H2", if text::complex(&label) { tags::actual_text(&label) } else { String::new() });
            let mcid = self.tags.mcid_to(self.page_obj, h2);
            let x = if self.cfg.rtl { self.pw - self.cfg.margin - w } else { self.cfg.margin };
            let base = self.y + size;
            let _ = write!(self.content_str(), "/H2 <</MCID {mcid}>> BDC\n");
            self.mc_depth += 1;
            let color = self.cfg.colors.text;
            self.glyphs(&g, &label, x, base, size, color);
            self.emc();
            self.tags.close(&mut self.w);
            if self.cfg.bookmarks {
                self.outline.push((label, self.page_obj, self.y));
            }
            self.y += size * 1.5;
            self.open_table();
            self.stripe = 0;
            self.rows_on_page += 1;
            return;
        }
        let color = self.cfg.colors.text;
        let cols = self.cols.clone();
        // o TH do grupo cobre até a 1ª coluna com resumo
        let first_summary = (1..cols.len()).find(|&k| row.cells.get(cols[k].index + 1).is_some_and(|c| !c.text.is_empty())).unwrap_or(cols.len());
        let span_w: f64 = cols[..first_summary].iter().map(|c| c.w).sum();
        let span_x = if self.cfg.rtl { cols[first_summary - 1].x } else { cols[0].x };
        let indent = INDENT * (level as f64 - if self.cfg.layout == Layout::Sections { 1.0 } else { 0.0 }).max(0.0);
        let label_cell = row.cells.first().map(|c| Cell { text: c.text.clone(), bold: c.bold, italic: c.italic, align: Some(Align::Start), color: c.color, bg: c.bg, lang: c.lang.clone(), image: c.image.clone(), link: c.link.clone() }).unwrap_or_else(empty_cell);
        let ll = self.measure(&label_cell, span_w, Align::Start, color, indent);
        let rest: Vec<(Col, CellLayout)> = cols[first_summary..]
            .iter()
            .map(|c| {
                let a = self.cfg.columns[c.index].align;
                let cell = row.cells.get(c.index + 1).map(|c| Cell { text: c.text.clone(), bold: c.bold, italic: c.italic, align: c.align, color: c.color, bg: c.bg, lang: c.lang.clone(), image: None, link: None }).unwrap_or_else(empty_cell);
                (*c, self.measure(&cell, c.w, a, color, 0.0))
            })
            .collect();
        let h = rest.iter().map(|(_, l)| self.cell_h(l)).fold(self.cell_h(&ll), f64::max);
        self.ensure_table();
        if level == 0 && self.cfg.layout == Layout::Table && self.tbody_open {
            self.tags.close(&mut self.w);
            self.tbody_open = false;
        }
        // um grupo não fica sozinho no pé da página: precisa de espaço para mais uma linha
        self.room(h + self.lh() + 2.0 * PAD);
        self.ensure_tbody();
        self.tbody_rows += 1;
        self.stripe = 0;
        let y = self.y;
        self.fill(self.table_x, y, self.table_w, h, self.cfg.colors.group);
        if self.cfg.bookmarks && level == 0 {
            self.outline.push((label.clone(), self.page_obj, y));
        }
        let tr = self.tags.open(&mut self.w, "TR", String::new());
        let colspan = if first_summary > 1 { format!(" /ColSpan {first_summary}") } else { String::new() };
        let th = self.tags.open_detached(&mut self.w, tr, "TH", format!(" /A <</O /Table /Scope /Row{colspan}>>{}", ll.lang.as_deref().map(tags::lang).unwrap_or_default()));
        let id = self.tags.new_id(&mut self.w, th);
        self.tags.extend(th, &format!(" /ID ({id})"));
        let keep = level.saturating_sub(usize::from(self.cfg.layout == Layout::Sections));
        self.group_ids.truncate(keep);
        self.td_attr.clear();
        self.draw_cell(th, "TH", &ll, span_x, span_w, y, 0, usize::MAX, indent);
        self.tags.close_detached(&mut self.w, th);
        for (k, (c, l)) in rest.iter().enumerate() {
            let extra = self.headers_with(first_summary + k, &self.group_ids, &id);
            let td = self.tags.open_detached(&mut self.w, tr, "TD", extra);
            self.draw_cell(td, "TD", l, c.x, c.w, y, 0, usize::MAX, 0.0);
            self.tags.close_detached(&mut self.w, td);
        }
        self.group_ids.push(id);
        self.td_attr.clear();
        self.tags.close(&mut self.w);
        let mut spans = vec![(span_x, span_w)];
        spans.extend(rest.iter().map(|(c, _)| (c.x, c.w)));
        self.row_rules(y, h, &spans);
        self.y += h;
        self.rows_on_page += 1;
    }

    fn summary(&mut self, row: Row) {
        if self.cols.is_empty() {
            self.plan();
        }
        let total = row.kind == Kind::Total;
        let color = self.cfg.colors.text;
        let cols = self.cols.clone();
        let layouts: Vec<CellLayout> = cols
            .iter()
            .enumerate()
            .map(|(k, c)| {
                let a = self.cfg.columns[c.index].align;
                let mut cell = row.cells.get(c.index).map(|c| Cell { text: c.text.clone(), bold: c.bold, italic: c.italic, align: c.align, color: c.color, bg: c.bg, lang: c.lang.clone(), image: None, link: None }).unwrap_or_else(empty_cell);
                if k == 0 && cell.text.is_empty() && total {
                    // texto da i18n: no idioma dela quando difere do documento (WCAG 3.1.2)
                    cell.text = self.cfg.total_label.clone();
                    if self.cfg.ui_lang != self.cfg.lang && !self.cfg.ui_lang.is_empty() {
                        cell.lang = Some(self.cfg.ui_lang.clone());
                    }
                }
                self.measure(&cell, c.w, a, color, 0.0)
            })
            .collect();
        let h = layouts.iter().map(|l| self.cell_h(l)).fold(self.lh() + 2.0 * PAD, f64::max);
        self.ensure_table();
        self.room(h);
        if total {
            if self.tbody_open {
                self.tags.close(&mut self.w);
                self.tbody_open = false;
            }
            if !self.tfoot_open {
                self.tags.open(&mut self.w, "TFoot", String::new());
                self.tfoot_open = true;
            }
        } else {
            self.ensure_tbody();
            self.tbody_rows += 1;
        }
        let y = self.y;
        self.fill(self.table_x, y, self.table_w, h, self.cfg.colors.summary);
        let tr = self.tags.open(&mut self.w, "TR", String::new());
        // rodapé: os grupos que ele resume (nível da linha = nível do grupo + 1); total: nenhum
        let groups: Vec<String> = if total {
            Vec::new()
        } else {
            let keep = usize::from(row.level).saturating_sub(usize::from(self.cfg.layout == Layout::Sections));
            self.group_ids.iter().take(keep).cloned().collect()
        };
        let mut th_id = String::new();
        for (k, (c, l)) in cols.iter().zip(&layouts).enumerate() {
            let lang = l.lang.as_deref().map(tags::lang).unwrap_or_default();
            let (ty, cell) = if k == 0 {
                let attr = self.row_scope();
                let cell = self.tags.open_cell(&mut self.w, tr, "TH", attr, lang);
                th_id = self.tags.new_id(&mut self.w, cell);
                self.tags.extend(cell, &format!(" /ID ({th_id})"));
                ("TH", cell)
            } else {
                let extra = format!("{}{lang}", self.headers_with(k, &groups, &th_id));
                ("TD", self.tags.open_detached(&mut self.w, tr, "TD", extra))
            };
            self.draw_cell(cell, ty, l, c.x, c.w, y, 0, usize::MAX, 0.0);
            self.tags.close_detached(&mut self.w, cell);
        }
        self.tags.close(&mut self.w);
        let spans: Vec<(f64, f64)> = cols.iter().map(|c| (c.x, c.w)).collect();
        self.row_rules(y, h, &spans);
        self.y += h;
        self.rows_on_page += 1;
    }

    /// Consome linhas até `max_pages` páginas novas. `true` quando a entrada acabou e tudo foi desenhado.
    pub fn layout(&mut self, max_pages: usize) -> bool {
        let target = self.pages.len() + max_pages;
        while let Some(row) = self.rows.pop_front() {
            self.row(row);
            if self.pages.len() >= target && self.rows.front().is_some() {
                return false;
            }
        }
        self.input_done
    }

    // ------------------------------------------------------------------ fecho

    pub fn finish(mut self) -> VecDeque<Vec<u8>> {
        if self.cols.is_empty() {
            self.plan();
        }
        if !self.page_open && self.pages.is_empty() {
            // documento sem linhas: título e cabeçalho
            self.open_page();
            self.ensure_table();
        }
        self.close_page();
        self.close_table();
        if self.sect_open {
            self.tags.close(&mut self.w);
        }
        // fecha o Document e a raiz
        self.tags.finish(&mut self.w, self.doc_elem);
        // total de páginas (formulário Fm0)
        let total = self.pages.len().to_string();
        let size = self.size();
        let mut g = Vec::new();
        let tw = self.t.shape_line(&total, size, false, false, false, &mut g);
        let mut form = Vec::new();
        {
            let c = rgb(self.cfg.colors.text);
            let _ = write!(ContentWriter(&mut form), "BT {c} rg\n");
            let mut cur = u16::MAX;
            for gl in &g {
                if gl.font != cur {
                    let _ = write!(ContentWriter(&mut form), "/{} {} Tf 1 0 0 1 {} 0 Tm ", self.t.fonts[gl.font as usize].res, num(size), num(f64::from(gl.x)));
                    cur = gl.font;
                }
                let mut b = Vec::new();
                literal(&gl.gid.to_be_bytes(), &mut b);
                form.extend_from_slice(&b);
                form.extend_from_slice(b" Tj ");
                let src = total.get(gl.cluster as usize..gl.cluster_end as usize).unwrap_or("").to_owned();
                self.t.fonts[gl.font as usize].use_glyph(gl.gid, &src);
            }
            form.extend_from_slice(b"ET\n");
        }
        self.w.stream(self.total_form, &format!(" /Type /XObject /Subtype /Form /BBox [0 {} {} {}] /Resources {} 0 R", num(-size), num(tw + 2.0), num(size * 1.5), self.resources), &form, true);
        // fontes
        for f in &self.t.fonts {
            f.write(&mut self.w);
        }
        // recursos compartilhados
        let fonts: String = self.t.fonts.iter().map(|f| format!("/{} {} 0 R ", f.res, f.obj)).collect();
        let mut xo = format!("/Fm0 {} 0 R ", self.total_form);
        for im in &self.images {
            let _ = write!(xo, "/{} {} 0 R ", im.name, im.obj);
        }
        self.w.small(self.resources, format!("<</Font <<{fonts}>> /XObject <<{xo}>>>>").as_bytes());
        // árvore de páginas
        let kids: String = self.pages.iter().map(|p| format!("{p} 0 R ")).collect();
        self.w.small(self.pages_node, format!("<</Type /Pages /Count {} /Kids [{kids}]>>", self.pages.len()).as_bytes());
        // marcadores
        let outlines = if self.cfg.bookmarks && !self.outline.is_empty() { Some(self.write_outline()) } else { None };
        // XMP
        let xmp = xmp(&self.cfg.title, &self.cfg.lang);
        self.w.stream(self.metadata, " /Type /Metadata /Subtype /XML", xmp.as_bytes(), false);
        let info = self.w.alloc();
        self.w.small(info, format!("<</Title {} /Producer (@universal-material/data-grid)>>", text_string(&self.cfg.title)).as_bytes());
        let catalog = self.w.alloc();
        let ol = outlines.map(|o| format!(" /Outlines {o} 0 R /PageMode /UseOutlines")).unwrap_or_default();
        let cat = format!(
            "<</Type /Catalog /Pages {} 0 R /StructTreeRoot {} 0 R /MarkInfo <</Marked true /Suspects false>> /Lang {} /ViewerPreferences <</DisplayDocTitle true>> /Metadata {} 0 R{ol}>>",
            self.pages_node,
            self.tags.root,
            text_string(&self.cfg.lang),
            self.metadata
        );
        self.w.small(catalog, cat.as_bytes());
        let id = doc_id(&self.cfg.title, self.pages.len(), self.rows_done);
        self.w.finish(catalog, Some(info), id)
    }

    fn write_outline(&mut self) -> u32 {
        let root = self.w.alloc();
        let items: Vec<u32> = self.outline.iter().map(|_| self.w.alloc()).collect();
        for (i, (title, page, y)) in self.outline.iter().enumerate() {
            let prev = if i > 0 { format!(" /Prev {} 0 R", items[i - 1]) } else { String::new() };
            let next = items.get(i + 1).map(|n| format!(" /Next {n} 0 R")).unwrap_or_default();
            let d = format!("<</Title {} /Parent {root} 0 R{prev}{next} /Dest [{page} 0 R /XYZ 0 {} 0]>>", text_string(title), num(self.ph - y));
            self.w.small(items[i], d.as_bytes());
        }
        let first = items[0];
        let last = items[items.len() - 1];
        self.w.small(root, format!("<</Type /Outlines /First {first} 0 R /Last {last} 0 R /Count {}>>", items.len()).as_bytes());
        root
    }
}

fn empty_cell() -> Cell {
    Cell { text: String::new(), bold: false, italic: false, align: None, color: None, bg: None, lang: None, image: None, link: None }
}

/// `write!` direto num `Vec<u8>` de conteúdo.
struct ContentWriter<'a>(&'a mut Vec<u8>);

impl std::fmt::Write for ContentWriter<'_> {
    fn write_str(&mut self, s: &str) -> std::fmt::Result {
        self.0.extend_from_slice(s.as_bytes());
        Ok(())
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn xmp(title: &str, lang: &str) -> String {
    let t = xml_escape(title);
    let l = xml_escape(lang);
    format!(
        "<?xpacket begin=\"\u{feff}\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n<rdf:Description rdf:about=\"\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:pdfuaid=\"http://www.aiim.org/pdfua/ns/id/\" xmlns:pdf=\"http://ns.adobe.com/pdf/1.3/\" xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\">\n<dc:title><rdf:Alt><rdf:li xml:lang=\"x-default\">{t}</rdf:li></rdf:Alt></dc:title>\n<dc:language><rdf:Bag><rdf:li>{l}</rdf:li></rdf:Bag></dc:language>\n<dc:format>application/pdf</dc:format>\n<pdf:Producer>@universal-material/data-grid</pdf:Producer>\n<xmp:CreatorTool>@universal-material/data-grid</xmp:CreatorTool>\n<pdfuaid:part>1</pdfuaid:part>\n</rdf:Description>\n</rdf:RDF>\n</x:xmpmeta>\n<?xpacket end=\"w\"?>"
    )
}

fn doc_id(title: &str, pages: usize, rows: u64) -> [u8; 16] {
    let mut h1: u64 = 0xcbf2_9ce4_8422_2325 ^ pages as u64;
    let mut h2: u64 = 0x8422_2325_cbf2_9ce4 ^ rows;
    for b in title.bytes() {
        h1 = (h1 ^ u64::from(b)).wrapping_mul(0x100_0000_01b3);
        h2 = (h2 ^ u64::from(b)).wrapping_mul(0x0000_0100_0000_01b3 ^ 0x9e37);
    }
    let mut id = [0u8; 16];
    id[..8].copy_from_slice(&h1.to_be_bytes());
    id[8..].copy_from_slice(&h2.to_be_bytes());
    id
}
