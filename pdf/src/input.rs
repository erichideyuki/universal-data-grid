//! Protocolo binário JS → motor (little endian). Strings: `u32` de bytes + UTF-8.
//!
//! Configuração (`begin`): versão `u8` = 1, título, idioma, idioma da i18n, `rtl u8`, `layout u8`
//! (0 table, 1 sections, 2 list), largura e altura do papel em retrato (`f32` pt), orientação `u8`
//! (0 auto, 1 retrato, 2 paisagem), margem `f32`, tamanho da fonte `f32`, flags `u32` (1 numeração,
//! 2 marcadores, 4 listras, 8 auto-hide, 16 alguma coluna com prioridade), 6 cores `u32` RGB
//! (texto, cabeçalho, grupo, listra, resumo, linha), rótulo da página ("… {page} … {pageCount}"),
//! separador da linha adaptativa, rótulo "Total", colunas: `u16` n e por coluna rótulo, largura
//! `f32` pt, alinhamento `u8` (0 início, 1 centro, 2 fim), prioridade `i32` (`i32::MIN` = nenhuma),
//! fixa `u8`.
//!
//! Linhas (`push_rows`): `u32` n e por linha `kind u8` (0 dados, 1 grupo, 2 rodapé de grupo,
//! 3 total, 4 cabeçalho), `level u8`, `u16` células e por célula: flags `u16` (1 negrito, 2 itálico,
//! 4 cor, 8 fundo, 16 idioma, 32 imagem, 64 link, bits 8–9 alinhamento: 0 da coluna, 1 início,
//! 2 centro, 3 fim), texto, [cor `u32`], [fundo `u32`], [idioma], [imagem `u32` + alt],
//! [url + descrição]. Grupo: célula 0 = rótulo, depois uma por coluna (resumos).

pub struct Rd<'a> {
    b: &'a [u8],
    p: usize,
}

impl<'a> Rd<'a> {
    pub fn new(b: &'a [u8]) -> Rd<'a> {
        Rd { b, p: 0 }
    }
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let s = self.b.get(self.p..self.p + n).ok_or_else(|| "truncated input".to_owned())?;
        self.p += n;
        Ok(s)
    }
    pub fn u8(&mut self) -> Result<u8, String> {
        Ok(self.take(1)?[0])
    }
    pub fn u16(&mut self) -> Result<u16, String> {
        let s = self.take(2)?;
        Ok(u16::from_le_bytes([s[0], s[1]]))
    }
    pub fn u32(&mut self) -> Result<u32, String> {
        let s = self.take(4)?;
        Ok(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
    }
    pub fn i32(&mut self) -> Result<i32, String> {
        Ok(self.u32()? as i32)
    }
    pub fn f32(&mut self) -> Result<f32, String> {
        Ok(f32::from_bits(self.u32()?))
    }
    pub fn str(&mut self) -> Result<String, String> {
        let n = self.u32()? as usize;
        let s = self.take(n)?;
        String::from_utf8(s.to_vec()).map_err(|_| "invalid UTF-8".to_owned())
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Layout {
    Table,
    Sections,
    List,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Align {
    Start,
    Center,
    End,
}

pub struct Column {
    pub label: String,
    pub width: f64,
    pub align: Align,
    pub priority: Option<i32>,
    pub fixed: bool,
}

pub struct Colors {
    pub text: u32,
    pub header: u32,
    pub group: u32,
    pub stripe: u32,
    pub summary: u32,
    pub line: u32,
}

pub struct Config {
    pub title: String,
    pub lang: String,
    pub ui_lang: String,
    pub rtl: bool,
    pub layout: Layout,
    pub paper_w: f64,
    pub paper_h: f64,
    pub orientation: u8,
    pub margin: f64,
    pub font_size: f64,
    pub page_numbers: bool,
    pub bookmarks: bool,
    pub striped: bool,
    pub auto_hide: bool,
    pub any_priority: bool,
    pub colors: Colors,
    pub page_label: String,
    pub adaptive_sep: String,
    pub total_label: String,
    pub columns: Vec<Column>,
}

fn align(v: u8) -> Align {
    match v {
        1 => Align::Center,
        2 => Align::End,
        _ => Align::Start,
    }
}

impl Config {
    pub fn read(b: &[u8]) -> Result<Config, String> {
        let mut r = Rd::new(b);
        if r.u8()? != 1 {
            return Err("unsupported protocol version".to_owned());
        }
        let title = r.str()?;
        let lang = r.str()?;
        let ui_lang = r.str()?;
        let rtl = r.u8()? != 0;
        let layout = match r.u8()? {
            1 => Layout::Sections,
            2 => Layout::List,
            _ => Layout::Table,
        };
        let paper_w = f64::from(r.f32()?);
        let paper_h = f64::from(r.f32()?);
        let orientation = r.u8()?;
        let margin = f64::from(r.f32()?);
        let font_size = f64::from(r.f32()?).max(6.0);
        let flags = r.u32()?;
        let colors = Colors { text: r.u32()?, header: r.u32()?, group: r.u32()?, stripe: r.u32()?, summary: r.u32()?, line: r.u32()? };
        let page_label = r.str()?;
        let adaptive_sep = r.str()?;
        let total_label = r.str()?;
        let n = r.u16()?;
        let mut columns = Vec::with_capacity(usize::from(n));
        for _ in 0..n {
            let label = r.str()?;
            let width = f64::from(r.f32()?);
            let a = align(r.u8()?);
            let p = r.i32()?;
            let fixed = r.u8()? != 0;
            columns.push(Column { label, width, align: a, priority: (p != i32::MIN).then_some(p), fixed });
        }
        Ok(Config {
            title,
            lang,
            ui_lang,
            rtl,
            layout,
            paper_w,
            paper_h,
            orientation,
            margin,
            font_size,
            page_numbers: flags & 1 != 0,
            bookmarks: flags & 2 != 0,
            striped: flags & 4 != 0,
            auto_hide: flags & 8 != 0,
            any_priority: flags & 16 != 0,
            colors,
            page_label,
            adaptive_sep,
            total_label,
            columns,
        })
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    Data,
    Group,
    Footer,
    Total,
    Header,
}

pub struct Cell {
    pub text: String,
    pub bold: bool,
    pub italic: bool,
    pub align: Option<Align>,
    pub color: Option<u32>,
    pub bg: Option<u32>,
    pub lang: Option<String>,
    pub image: Option<(u32, String)>,
    pub link: Option<(String, String)>,
}

pub struct Row {
    pub kind: Kind,
    pub level: u8,
    pub cells: Vec<Cell>,
}

pub fn read_rows(b: &[u8], out: &mut std::collections::VecDeque<Row>) -> Result<(), String> {
    let mut r = Rd::new(b);
    let n = r.u32()?;
    for _ in 0..n {
        let kind = match r.u8()? {
            1 => Kind::Group,
            2 => Kind::Footer,
            3 => Kind::Total,
            4 => Kind::Header,
            _ => Kind::Data,
        };
        let level = r.u8()?;
        let nc = r.u16()?;
        let mut cells = Vec::with_capacity(usize::from(nc));
        for _ in 0..nc {
            let flags = r.u16()?;
            let text = r.str()?;
            let color = if flags & 4 != 0 { Some(r.u32()?) } else { None };
            let bg = if flags & 8 != 0 { Some(r.u32()?) } else { None };
            let lang = if flags & 16 != 0 { Some(r.str()?) } else { None };
            let image = if flags & 32 != 0 { Some((r.u32()?, r.str()?)) } else { None };
            let link = if flags & 64 != 0 { Some((r.str()?, r.str()?)) } else { None };
            let align = match (flags >> 8) & 3 {
                1 => Some(Align::Start),
                2 => Some(Align::Center),
                3 => Some(Align::End),
                _ => None,
            };
            cells.push(Cell { text, bold: flags & 1 != 0, italic: flags & 2 != 0, align, color, bg, lang, image, link });
        }
        out.push_back(Row { kind, level, cells });
    }
    Ok(())
}
