//! Motor de PDF do `<u-grid>` (`@universal-material/data-grid/export-pdf`): tabelas em PDF marcado
//! (alvo PDF/UA-1), com bidi e shaping, layout em passo único e escrita em fluxo. Spec 26.

mod doc;
mod fonts;
mod images;
mod input;
mod tags;
mod text;
pub mod writer;

#[cfg(target_arch = "wasm32")]
mod wasm;

use std::collections::VecDeque;

pub use input::Config;

/// Códigos de erro devolvidos ao JS.
pub mod code {
    pub const OK: i32 = 0;
    pub const INVALID: i32 = -1;
    pub const FONT: i32 = -2;
    pub const MISSING_GLYPH: i32 = -3;
    pub const IMAGE: i32 = -4;
    pub const STATE: i32 = -5;
}

/// Uma exportação: fontes → configuração → imagens/linhas em blocos → layout → fecho.
pub struct Engine {
    w: Option<writer::Writer>,
    fonts: Vec<fonts::Font>,
    doc: Option<doc::Doc>,
    pub out: VecDeque<Vec<u8>>,
    pub error: String,
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

impl Engine {
    pub fn new() -> Engine {
        Engine { w: Some(writer::Writer::new(1 << 20)), fonts: Vec::new(), doc: None, out: VecDeque::new(), error: String::new() }
    }

    fn fail(&mut self, code: i32, msg: impl Into<String>) -> i32 {
        self.error = msg.into();
        code
    }

    pub fn add_font(&mut self, bytes: Vec<u8>, bold: bool, italic: bool) -> i32 {
        let Some(w) = self.w.as_mut() else { return self.fail(code::STATE, "fonts must be added before begin") };
        match fonts::Font::load(self.fonts.len(), bytes, bold, italic, w) {
            Ok(f) => {
                self.fonts.push(f);
                code::OK
            }
            Err(fonts::FontLoadError::Invalid(i)) => self.fail(code::FONT, format!("font {i} is not a valid TrueType/OpenType font")),
            Err(fonts::FontLoadError::NotEmbeddable(i)) => self.fail(code::FONT, format!("font {i} does not allow embedding (OS/2 fsType)")),
        }
    }

    pub fn begin(&mut self, cfg: &[u8]) -> i32 {
        if self.fonts.is_empty() {
            return self.fail(code::INVALID, "no fonts");
        }
        let cfg = match input::Config::read(cfg) {
            Ok(c) => c,
            Err(e) => return self.fail(code::INVALID, e),
        };
        let (Some(w), fonts) = (self.w.take(), std::mem::take(&mut self.fonts)) else { return self.fail(code::STATE, "begin called twice") };
        self.doc = Some(doc::Doc::new(cfg, fonts, w));
        code::OK
    }

    pub fn add_image(&mut self, data: &[u8], format: u8, width: f64, height: f64) -> i32 {
        let Some(d) = self.doc.as_mut() else { return self.fail(code::STATE, "begin first") };
        match d.add_image(data, format, width, height) {
            Ok(id) => id as i32,
            Err(e) => self.fail(code::IMAGE, e),
        }
    }

    pub fn push_rows(&mut self, data: &[u8]) -> i32 {
        let Some(d) = self.doc.as_mut() else { return self.fail(code::STATE, "begin first") };
        match input::read_rows(data, &mut d.rows) {
            Ok(()) => code::OK,
            Err(e) => self.fail(code::INVALID, e),
        }
    }

    pub fn end_input(&mut self) {
        if let Some(d) = self.doc.as_mut() {
            d.input_done = true;
        }
    }

    /// Até `pages` páginas novas: 1 = acabou, 0 = há mais (ou espera linhas), negativo = erro.
    pub fn layout(&mut self, pages: usize) -> i32 {
        let Some(d) = self.doc.as_mut() else { return self.fail(code::STATE, "begin first") };
        let done = d.layout(pages);
        // blocos prontos do arquivo
        while let Some(c) = d.w.ready.pop_front() {
            self.out.push_back(c);
        }
        if !d.missing().is_empty() {
            let list: Vec<String> = d.missing().iter().map(|c| format!("{c:X}")).collect();
            return self.fail(code::MISSING_GLYPH, list.join(","));
        }
        i32::from(done)
    }

    pub fn pending_rows(&self) -> usize {
        self.doc.as_ref().map_or(0, |d| d.rows.len())
    }

    pub fn page_count(&self) -> usize {
        self.doc.as_ref().map_or(0, |d| d.pages.len())
    }

    pub fn rows_done(&self) -> u64 {
        self.doc.as_ref().map_or(0, |d| d.rows_done)
    }

    /// Fecha o documento; os blocos finais vão para `out`.
    pub fn finish(&mut self) -> i32 {
        let Some(d) = self.doc.take() else { return self.fail(code::STATE, "begin first") };
        if !d.missing().is_empty() {
            let list: Vec<String> = d.missing().iter().map(|c| format!("{c:X}")).collect();
            return self.fail(code::MISSING_GLYPH, list.join(","));
        }
        let chunks = d.finish();
        self.out.extend(chunks);
        code::OK
    }
}
