//! Motor de xlsx do `<u-grid>` (`@universal-material/data-grid/export-xlsx`), spec 29: uma camada
//! fina sobre o `uo-xlsx` do Universal Office. Traduz a configuração e os blocos de linhas que o
//! JS serializa (protocolo binário, little endian) em chamadas ao escritor; a escrita, o deflate e
//! o pacote são do `uo-xlsx`.
//!
//! Configuração (`begin`): versão `u8` = 2, título, idioma (`dc:language`), nome da aba, nome de
//! reserva (quando o nome limpo fica vazio), flags `u8` (1 RTL, 2 congelar o cabeçalho), linhas de
//! cabeçalho `u8` (bandas + folhas; a última é a das folhas), níveis de outline `u8` (0–7), colunas
//! fixas no início `u16` (sempre congeladas; títulos de linha), colunas: `u16` n e por coluna a
//! largura `f32` em px (≤ 0 = padrão). Strings: `u32` de bytes + UTF-8.
//!
//! Bloco (`append`): estilos novos — `u16` n e por estilo flags `u8` (1 negrito, 2 itálico, 4 cor,
//! 8 fundo, 16 quebra, 32 formato), alinhamento `u8` (0 nenhum, 1 esquerda, 2 centro, 3 direita,
//! 4 início, 5 fim, 6 centralizar na seleção), [cor `u32`], [fundo `u32`], bordas `u8` (bits 1
//! esquerda, 2 direita, 4 cima, 8 baixo) e por lado presente estilo `u8` (0 fina, 1 média) + tem cor
//! `u8` + [cor `u32`], [formato]; os estilos são numerados na ordem de chegada a partir de 1 (0 =
//! padrão). Depois `u32` linhas e por linha outline `u8`, `u16` células e por célula `kind u8`
//! (0 vazia, 1 texto, 2 número, 3 falso, 4 verdadeiro, 5 data; `| 0x80` = link depois do valor),
//! estilo `u32`, o valor (texto: string; número: `f64`; data: ano `i32`, mês, dia, hora, minuto,
//! segundo `u8`, milissegundo `u16`) e o link (string). Por fim, as áreas mescladas do bloco: `u16`
//! n e por área a 1ª linha `u32`, a 1ª coluna `u16`, a última linha `u32` e a última coluna `u16`
//! (a partir de 1; as linhas são as da aba, não as do bloco).

#[cfg(target_arch = "wasm32")]
mod wasm;

use uo_xlsx::{
    BorderEdge, BorderStyle, Borders, Cell, CellRange, CellValue, Column, DateTime, DefinedName, Error, HAlign, Link, Rgb, RowOptions, SheetOptions,
    Style, StyleId, WorkbookOptions, XlsxWriter,
};

/// Códigos devolvidos ao JS.
pub mod code {
    pub const OK: i32 = 0;
    /// entrada fora do protocolo
    pub const INVALID: i32 = -1;
    /// limite do Excel (linhas, colunas, formatos)
    pub const LIMIT: i32 = -2;
    /// chamada fora de ordem
    pub const STATE: i32 = -5;
}

/// Largura do dígito mais largo da fonte Normal (Aptos Narrow 11 a 96 dpi), em px.
const MDW: u32 = 7;
/// Nível de outline mais fundo que o Excel aceita.
const MAX_OUTLINE: u8 = 7;

pub struct Rd<'a> {
    b: &'a [u8],
    p: usize,
}

impl<'a> Rd<'a> {
    pub fn new(b: &'a [u8]) -> Rd<'a> {
        Rd { b, p: 0 }
    }
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self.p.checked_add(n).ok_or("truncated input")?;
        let s = self.b.get(self.p..end).ok_or("truncated input")?;
        self.p = end;
        Ok(s)
    }
    fn u8(&mut self) -> Result<u8, String> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> Result<u16, String> {
        let s = self.take(2)?;
        Ok(u16::from_le_bytes([s[0], s[1]]))
    }
    fn u32(&mut self) -> Result<u32, String> {
        let s = self.take(4)?;
        Ok(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
    }
    fn f32(&mut self) -> Result<f32, String> {
        Ok(f32::from_bits(self.u32()?))
    }
    fn f64(&mut self) -> Result<f64, String> {
        let s = self.take(8)?;
        let mut a = [0u8; 8];
        a.copy_from_slice(s);
        Ok(f64::from_le_bytes(a))
    }
    fn str(&mut self) -> Result<&'a str, String> {
        let n = self.u32()? as usize;
        std::str::from_utf8(self.take(n)?).map_err(|_| "invalid UTF-8".to_owned())
    }
    fn done(&self) -> bool {
        self.p >= self.b.len()
    }
}

/// Erro do escritor → código e mensagem para o JS.
fn writer_error(e: &Error) -> (i32, String) {
    let c = match e {
        Error::TooManyRows | Error::TooManyColumns | Error::TooManyStyles | Error::OutlineLevel { .. } => code::LIMIT,
        _ => code::INVALID,
    };
    (c, e.to_string())
}

fn rgb(r: &mut Rd<'_>) -> Result<Rgb, String> {
    Ok(Rgb(r.u32()? & 0x00FF_FFFF))
}

fn read_style(r: &mut Rd<'_>) -> Result<Style, String> {
    let flags = r.u8()?;
    let align = match r.u8()? {
        0 => None,
        1 => Some(HAlign::Left),
        2 => Some(HAlign::Center),
        3 => Some(HAlign::Right),
        4 => Some(HAlign::Start),
        5 => Some(HAlign::End),
        6 => Some(HAlign::CenterContinuous),
        _ => return Err("unknown alignment".into()),
    };
    let color = if flags & 4 != 0 { Some(rgb(r)?) } else { None };
    let fill = if flags & 8 != 0 { Some(rgb(r)?) } else { None };
    let sides = r.u8()?;
    let mut border = Borders::default();
    for (bit, side) in [(1u8, &mut border.left), (2, &mut border.right), (4, &mut border.top), (8, &mut border.bottom)] {
        if sides & bit != 0 {
            let style = if r.u8()? == 1 { BorderStyle::Medium } else { BorderStyle::Thin };
            let color = if r.u8()? != 0 { Some(rgb(r)?) } else { None };
            *side = Some(BorderEdge { style, color });
        }
    }
    let num_fmt = if flags & 32 != 0 { Some(r.str()?.to_owned()) } else { None };
    Ok(Style { num_fmt, bold: flags & 1 != 0, italic: flags & 2 != 0, color, fill, border, align, wrap: flags & 16 != 0 })
}

/// Uma exportação: `begin` → `append`… → `finish`.
#[derive(Default)]
pub struct Engine {
    w: Option<XlsxWriter>,
    /// estilo local (do JS) → estilo do escritor; 0 = padrão
    styles: Vec<StyleId>,
    rows: u64,
    pub out: Vec<u8>,
    pub error: String,
    dropped_links: u64,
    cut_texts: u64,
}

impl Engine {
    pub fn new() -> Engine {
        Engine { styles: vec![StyleId::DEFAULT], ..Engine::default() }
    }

    fn fail(&mut self, (c, msg): (i32, String)) -> i32 {
        self.error = msg;
        c
    }

    /// Pasta de trabalho com uma aba (configuração no protocolo do módulo).
    pub fn begin(&mut self, cfg: &[u8]) -> i32 {
        if self.w.is_some() {
            return self.fail((code::STATE, "begin called twice".into()));
        }
        match Self::read_begin(cfg) {
            Ok(Ok(w)) => {
                self.w = Some(w);
                code::OK
            }
            Ok(Err(e)) => self.fail(writer_error(&e)),
            Err(e) => self.fail((code::INVALID, e)),
        }
    }

    fn read_begin(cfg: &[u8]) -> Result<uo_xlsx::Result<XlsxWriter>, String> {
        let mut r = Rd::new(cfg);
        if r.u8()? != 2 {
            return Err("unknown config version".into());
        }
        let title = r.str()?;
        let language = r.str()?;
        let name = r.str()?;
        let fallback = r.str()?;
        let flags = r.u8()?;
        let header_rows = u32::from(r.u8()?);
        let outline_levels = r.u8()?.min(MAX_OUTLINE);
        let fixed_cols = u32::from(r.u16()?);
        let n = r.u16()?;
        let mut columns = Vec::with_capacity(usize::from(n));
        for _ in 0..n {
            let px = r.f32()?;
            let width = (px.is_finite() && px > 0.0).then(|| uo_xlsx::column_width_from_px(px.round() as u32, MDW));
            columns.push(Column { width, hidden: false });
        }
        let opts = WorkbookOptions {
            title: (!title.is_empty()).then(|| title.to_owned()),
            language: (!language.is_empty()).then(|| language.to_owned()),
            application: "Universal Material Data Grid".to_owned(),
            ..WorkbookOptions::default()
        };
        let headers = header_rows > 0;
        // convenção dos leitores de tela (JAWS), na 1ª célula da linha das folhas: `ColumnTitle` (títulos de
        // coluna à direita dela), `RowTitle` (títulos de linha abaixo: a 1ª coluna fixa no início) ou, com os
        // dois, `Title`; sem cabeçalho, `RowTitle` em A1
        let title = match (headers, fixed_cols > 0) {
            (true, true) => Some(("Title", header_rows)),
            (true, false) => Some(("ColumnTitle", header_rows)),
            (false, true) => Some(("RowTitle", 1)),
            (false, false) => None,
        };
        let names: Vec<DefinedName> =
            title.map(|(name, row)| DefinedName { name: name.into(), range: CellRange::cell(row, 1), sheet_scope: true }).into_iter().collect();
        let sheet = SheetOptions {
            name: uo_xlsx::sanitize_sheet_name(name, fallback),
            right_to_left: flags & 1 != 0,
            columns,
            freeze_rows: if flags & 2 != 0 { header_rows } else { 0 },
            // as colunas fixas no início, como no grid (o `uo-xlsx` ainda não grava títulos de impressão por coluna)
            freeze_cols: fixed_cols.min(n.into()),
            outline_levels,
            // a linha de grupo vem ANTES dos detalhes (como no grid): o botão de recolher fica nela
            summary_above: true,
            print_title_rows: headers.then_some((1, header_rows)),
            names,
            ..SheetOptions::default()
        };
        Ok(XlsxWriter::new(opts).and_then(|mut w| w.begin_sheet(sheet).map(|()| w)))
    }

    /// Um bloco de estilos novos e linhas; devolve as linhas escritas (ou um código negativo).
    pub fn append(&mut self, block: &[u8]) -> i32 {
        match self.append_inner(block) {
            Ok(n) => i32::try_from(n).unwrap_or(i32::MAX),
            Err(e) => self.fail(e),
        }
    }

    fn append_inner(&mut self, block: &[u8]) -> Result<u32, (i32, String)> {
        let invalid = |e: String| (code::INVALID, e);
        let Some(w) = self.w.as_mut() else { return Err((code::STATE, "append before begin".into())) };
        let mut r = Rd::new(block);
        let new_styles = r.u16().map_err(invalid)?;
        for _ in 0..new_styles {
            let mut style = read_style(&mut r).map_err(invalid)?;
            let id = match w.add_style(&style) {
                // formato que o Excel recusa: o estilo fica sem ele (o JS já avisou)
                Err(Error::NumFmt) => {
                    style.num_fmt = None;
                    w.add_style(&style)
                }
                other => other,
            }
            .map_err(|e| writer_error(&e))?;
            self.styles.push(id);
        }
        let rows = r.u32().map_err(invalid)?;
        let mut cells: Vec<Cell<'_>> = Vec::new();
        for _ in 0..rows {
            let level = r.u8().map_err(invalid)?.min(MAX_OUTLINE);
            let n = r.u16().map_err(invalid)?;
            cells.clear();
            for _ in 0..n {
                let kind = r.u8().map_err(invalid)?;
                let local = r.u32().map_err(invalid)? as usize;
                let style = *self.styles.get(local).ok_or_else(|| invalid(format!("unknown style {local}")))?;
                let value = match kind & 0x7F {
                    0 => CellValue::Empty,
                    1 => CellValue::Text(r.str().map_err(invalid)?),
                    2 => CellValue::Number(r.f64().map_err(invalid)?),
                    3 => CellValue::Bool(false),
                    4 => CellValue::Bool(true),
                    5 => {
                        let year = r.u32().map_err(invalid)? as i32;
                        let mut f = [0u8; 5];
                        for x in &mut f {
                            *x = r.u8().map_err(invalid)?;
                        }
                        let millisecond = r.u16().map_err(invalid)?;
                        CellValue::Date(DateTime { year, month: f[0], day: f[1], hour: f[2], minute: f[3], second: f[4], millisecond })
                    }
                    k => return Err(invalid(format!("unknown cell kind {k}"))),
                };
                let link = if kind & 0x80 != 0 { Some(Link::Url(r.str().map_err(invalid)?)) } else { None };
                cells.push(Cell { value, style, link });
            }
            w.append_row(&RowOptions { outline_level: level, ..RowOptions::default() }, &cells).map_err(|e| writer_error(&e))?;
            self.rows += 1;
        }
        let merges = r.u16().map_err(invalid)?;
        for _ in 0..merges {
            let first_row = r.u32().map_err(invalid)?;
            let first_col = u32::from(r.u16().map_err(invalid)?);
            let last_row = r.u32().map_err(invalid)?;
            let last_col = u32::from(r.u16().map_err(invalid)?);
            w.merge(CellRange::new(first_row, first_col, last_row, last_col)).map_err(|e| writer_error(&e))?;
        }
        if !r.done() {
            return Err(invalid("trailing bytes in block".into()));
        }
        Ok(rows)
    }

    /// Fecha a aba e o pacote; o arquivo fica em `out`. Devolve o tamanho.
    pub fn finish(&mut self) -> i32 {
        let Some(mut w) = self.w.take() else { return self.fail((code::STATE, "finish before begin".into())) };
        self.dropped_links = w.dropped_links();
        self.cut_texts = w.cut_texts();
        match w.end_sheet().and_then(|()| w.finish()) {
            Ok(bytes) => {
                self.out = bytes;
                i32::try_from(self.out.len()).unwrap_or(i32::MAX)
            }
            Err(e) => self.fail(writer_error(&e)),
        }
    }

    /// Linhas escritas até aqui.
    pub fn rows_written(&self) -> u64 {
        self.rows
    }

    /// Links descartados pelo escritor (esquema fora da lista, alvo longo demais).
    pub fn dropped_links(&self) -> u64 {
        self.w.as_ref().map_or(self.dropped_links, XlsxWriter::dropped_links)
    }

    /// Textos cortados no limite do Excel (32.767 caracteres).
    pub fn cut_texts(&self) -> u64 {
        self.w.as_ref().map_or(self.cut_texts, XlsxWriter::cut_texts)
    }
}
