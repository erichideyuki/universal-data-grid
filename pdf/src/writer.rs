//! Escritor de PDF em fluxo: objetos numerados escritos assim que ficam prontos (em qualquer
//! ordem), objetos pequenos agrupados em object streams comprimidos, xref em stream (PDF 1.5+) e a
//! saída em blocos de tamanho fixo que o hospedeiro recolhe (a memória não cresce com o arquivo).
//!
//! Modo adiado (worker): o motor não comprime nem conta offsets — os objetos saem como segmentos
//! crus e o `Assembler` (outra instância, noutro worker) comprime, escreve o arquivo e a xref, em
//! paralelo com o layout das próximas linhas (o deflate é ~metade do trabalho).

use std::fmt::Write as _;


/// Nível do deflate: o 2 do zlib-rs tem o tamanho do 3 do miniz_oxide em ~60% do tempo (medido).
const DEFLATE_LEVEL: i32 = 2;
/// Objetos por object stream (e bytes, o que vier primeiro).
const OBJSTM_COUNT: usize = 200;
const OBJSTM_BYTES: usize = 64 * 1024;

/// Segmentos do modo adiado (little endian).
mod seg {
    /// bytes soltos: `[len u32][bytes]`
    pub const RAW: u8 = 0;
    /// objeto direto: `[num u32][len u32][corpo]`
    pub const OBJ: u8 = 1;
    /// stream: `[num u32][comprimir u8][len u32][dict][len u32][dados][n u32][membros u32 × n]`
    /// (membros: os objetos guardados quando é um object stream)
    pub const STREAM: u8 = 2;
    /// fim: `[xref u32][root u32][info u32, 0 = nenhum][id 16][tamanho da xref u32]`
    pub const END: u8 = 3;
}

#[derive(Clone, Copy)]
enum Entry {
    Free,
    /// offset no arquivo
    Direct(u64),
    /// (número do object stream, índice dentro dele)
    InStream(u32, u32),
}

pub struct Writer {
    chunk_size: usize,
    buf: Vec<u8>,
    /// blocos prontos para o hospedeiro (FIFO)
    pub ready: std::collections::VecDeque<Vec<u8>>,
    out_len: u64,
    entries: Vec<Entry>,
    // object stream em montagem
    stm_offsets: Vec<u8>,
    stm_body: Vec<u8>,
    stm_members: Vec<u32>,
    /// saída do deflate (cresce até o maior stream; `scratch_len` é o usado)
    scratch: Vec<u8>,
    scratch_len: usize,
    /// modo adiado: segmentos crus para o `Assembler`
    deferred: bool,
}

impl Writer {
    pub fn new(chunk_size: usize) -> Writer {
        Self::with_mode(chunk_size, false)
    }

    /// `deferred`: objetos saem como segmentos crus (ver o módulo); o cabeçalho é do `Assembler`.
    pub fn with_mode(chunk_size: usize, deferred: bool) -> Writer {
        let mut w = Writer {
            chunk_size: chunk_size.max(4096),
            buf: Vec::new(),
            ready: std::collections::VecDeque::new(),
            out_len: 0,
            entries: vec![Entry::Free],
            stm_offsets: Vec::new(),
            stm_body: Vec::new(),
            stm_members: Vec::new(),
            scratch: Vec::new(),
            scratch_len: 0,
            deferred,
        };
        if !deferred {
            // cabeçalho + comentário binário
            w.put(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n");
        }
        w
    }

    /// Segmento inteiro no bloco corrente; o bloco fecha entre segmentos (o `Assembler` lê blocos
    /// com segmentos inteiros).
    fn segment(&mut self, parts: &[&[u8]]) {
        for p in parts {
            self.buf.extend_from_slice(p);
        }
        if self.buf.len() >= self.chunk_size {
            self.ready.push_back(std::mem::take(&mut self.buf));
        }
    }

    /// Garante a entrada `num` na xref (o `Assembler` recebe números do motor).
    fn ensure(&mut self, num: u32) {
        if self.entries.len() <= num as usize {
            self.entries.resize(num as usize + 1, Entry::Free);
        }
    }

    fn put(&mut self, bytes: &[u8]) {
        let mut bytes = bytes;
        while !bytes.is_empty() {
            if self.buf.capacity() == 0 {
                self.buf.reserve_exact(self.chunk_size);
            }
            let room = self.chunk_size - self.buf.len();
            let n = room.min(bytes.len());
            self.buf.extend_from_slice(&bytes[..n]);
            bytes = &bytes[n..];
            self.out_len += n as u64;
            if self.buf.len() == self.chunk_size {
                self.ready.push_back(std::mem::take(&mut self.buf));
            }
        }
    }

    /// Reserva um número de objeto.
    pub fn alloc(&mut self) -> u32 {
        self.entries.push(Entry::Free);
        (self.entries.len() - 1) as u32
    }

    /// Bytes escritos até agora (sem o object stream em montagem).
    pub fn len(&self) -> u64 {
        self.out_len
    }

    /// Objeto direto no arquivo (`num 0 obj … endobj`).
    pub fn obj(&mut self, num: u32, body: &[u8]) {
        if self.deferred {
            self.entries[num as usize] = Entry::Direct(0);
            self.segment(&[&[seg::OBJ], &num.to_le_bytes(), &(body.len() as u32).to_le_bytes(), body]);
            return;
        }
        self.entries[num as usize] = Entry::Direct(self.out_len);
        let mut head = String::with_capacity(16);
        let _ = writeln!(head, "{num} 0 obj");
        self.put(head.as_bytes());
        self.put(body);
        self.put(b"\nendobj\n");
    }

    /// Stream (comprimido quando ganha).
    pub fn stream(&mut self, num: u32, dict: &str, data: &[u8], compress_it: bool) {
        self.stream_with(num, dict, data, compress_it, &[]);
    }

    /// `stream` de um object stream: `members` são os objetos guardados nele (para a xref do
    /// `Assembler`).
    fn stream_with(&mut self, num: u32, dict: &str, data: &[u8], compress_it: bool, members: &[u32]) {
        if self.deferred {
            self.entries[num as usize] = Entry::Direct(0);
            let mut list = Vec::with_capacity(4 + members.len() * 4);
            list.extend_from_slice(&(members.len() as u32).to_le_bytes());
            for m in members {
                list.extend_from_slice(&m.to_le_bytes());
            }
            self.segment(&[
                &[seg::STREAM],
                &num.to_le_bytes(),
                &[u8::from(compress_it)],
                &(dict.len() as u32).to_le_bytes(),
                dict.as_bytes(),
                &(data.len() as u32).to_le_bytes(),
                data,
                &list,
            ]);
            return;
        }
        let deflated = compress_it && data.len() > 64 && self.deflate(data);
        let (payload, filter): (&[u8], &str) = if deflated { (&self.scratch[..self.scratch_len], " /Filter /FlateDecode") } else { (data, "") };
        let head = format!("<<{dict}{filter} /Length {}>>\nstream\n", payload.len());
        let payload = payload.to_vec();
        let mut body = Vec::with_capacity(head.len() + payload.len() + 11);
        body.extend_from_slice(head.as_bytes());
        body.extend_from_slice(&payload);
        body.extend_from_slice(b"\nendstream");
        self.obj(num, &body);
    }

    /// Objeto pequeno (dicionário, array) num object stream comprimido. Streams não podem ir aqui.
    pub fn small(&mut self, num: u32, body: &[u8]) {
        let idx = self.stm_members.len() as u32;
        put_u32(&mut self.stm_offsets, num);
        self.stm_offsets.push(b' ');
        put_u32(&mut self.stm_offsets, self.stm_body.len() as u32);
        self.stm_offsets.push(b' ');
        self.stm_body.extend_from_slice(body);
        self.stm_body.push(b'\n');
        self.stm_members.push(num);
        // o número do object stream só é conhecido no fecho: marca provisória
        self.entries[num as usize] = Entry::InStream(0, idx);
        if self.stm_members.len() >= OBJSTM_COUNT || self.stm_body.len() >= OBJSTM_BYTES {
            self.flush_objstm();
        }
    }

    fn flush_objstm(&mut self) {
        if self.stm_members.is_empty() {
            return;
        }
        let num = self.alloc();
        let members = std::mem::take(&mut self.stm_members);
        for (i, m) in members.iter().enumerate() {
            self.entries[*m as usize] = Entry::InStream(num, i as u32);
        }
        let offsets = std::mem::take(&mut self.stm_offsets);
        let mut data = Vec::with_capacity(offsets.len() + self.stm_body.len());
        data.extend_from_slice(&offsets);
        let first = data.len();
        data.extend_from_slice(&self.stm_body);
        self.stm_body.clear();
        self.stream_with(num, &format!(" /Type /ObjStm /N {} /First {first}", members.len()), &data, true, &members);
    }

    /// zlib (cabeçalho, deflate e adler32) em `scratch`; `true` quando ficou menor.
    fn deflate(&mut self, data: &[u8]) -> bool {
        let bound = zlib_rs::deflate::compress_bound(data.len());
        if self.scratch.len() < bound {
            self.scratch.resize(bound, 0);
        }
        let config = zlib_rs::deflate::DeflateConfig::new(DEFLATE_LEVEL);
        let (out, code) = zlib_rs::deflate::compress_slice(&mut self.scratch[..bound], data, config);
        self.scratch_len = out.len();
        code == zlib_rs::ReturnCode::Ok && self.scratch_len < data.len()
    }

    /// Fecha o arquivo: object stream pendente, xref em stream e trailer. `info` é opcional.
    pub fn finish(mut self, root: u32, info: Option<u32>, id: [u8; 16]) -> std::collections::VecDeque<Vec<u8>> {
        self.flush_objstm();
        let xref = self.alloc();
        if self.deferred {
            let size = self.entries.len() as u32;
            self.segment(&[&[seg::END], &xref.to_le_bytes(), &root.to_le_bytes(), &info.unwrap_or(0).to_le_bytes(), &id, &size.to_le_bytes()]);
            if !self.buf.is_empty() {
                let last = std::mem::take(&mut self.buf);
                self.ready.push_back(last);
            }
            return self.ready;
        }
        self.write_xref(xref, root, info, id);
        self.ready
    }

    /// xref em stream (objeto `xref`), trailer e o último bloco.
    fn write_xref(&mut self, xref: u32, root: u32, info: Option<u32>, id: [u8; 16]) {
        let start = self.out_len;
        self.entries[xref as usize] = Entry::Direct(start);
        // W [1 4 2]: tipo, offset/objstm, geração/índice
        let mut data = Vec::with_capacity(self.entries.len() * 7);
        for e in &self.entries {
            match *e {
                Entry::Free => data.extend_from_slice(&[0, 0, 0, 0, 0, 0xff, 0xff]),
                Entry::Direct(off) => {
                    data.push(1);
                    data.extend_from_slice(&(off as u32).to_be_bytes());
                    data.extend_from_slice(&[0, 0]);
                }
                Entry::InStream(stm, idx) => {
                    data.push(2);
                    data.extend_from_slice(&stm.to_be_bytes());
                    data.extend_from_slice(&(idx as u16).to_be_bytes());
                }
            }
        }
        let hex: String = id.iter().map(|b| format!("{b:02X}")).collect();
        let info = info.map(|n| format!(" /Info {n} 0 R")).unwrap_or_default();
        let dict = format!(" /Type /XRef /Size {} /W [1 4 2] /Root {root} 0 R{info} /ID [<{hex}> <{hex}>]", self.entries.len());
        self.stream(xref, &dict, &data, true);
        let tail = format!("startxref\n{start}\n%%EOF\n");
        self.put(tail.as_bytes());
        if !self.buf.is_empty() {
            let last = std::mem::take(&mut self.buf);
            self.ready.push_back(last);
        }
    }
}

/// Monta o arquivo a partir dos segmentos do motor em modo adiado: comprime os streams, conta os
/// offsets e escreve a xref no fim.
pub struct Assembler {
    w: Writer,
    done: bool,
}

impl Default for Assembler {
    fn default() -> Self {
        Self::new()
    }
}

/// Leitor dos segmentos.
struct Rd<'a>(&'a [u8]);

impl<'a> Rd<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        if self.0.len() < n {
            return Err("truncated segment".into());
        }
        let (a, b) = self.0.split_at(n);
        self.0 = b;
        Ok(a)
    }
    fn u8(&mut self) -> Result<u8, String> {
        Ok(self.take(1)?[0])
    }
    fn u32(&mut self) -> Result<u32, String> {
        let b = self.take(4)?;
        Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }
    fn bytes(&mut self) -> Result<&'a [u8], String> {
        let n = self.u32()? as usize;
        self.take(n)
    }
}

impl Assembler {
    pub fn new() -> Assembler {
        Assembler { w: Writer::new(1 << 20), done: false }
    }

    /// Consome um bloco de segmentos; `Ok(true)` depois do fim do documento.
    pub fn push(&mut self, data: &[u8]) -> Result<bool, String> {
        let mut r = Rd(data);
        while !r.0.is_empty() {
            match r.u8()? {
                seg::RAW => {
                    let b = r.bytes()?;
                    self.w.put(b);
                }
                seg::OBJ => {
                    let num = r.u32()?;
                    let body = r.bytes()?;
                    self.w.ensure(num);
                    self.w.obj(num, body);
                }
                seg::STREAM => {
                    let num = r.u32()?;
                    let compress = r.u8()? != 0;
                    let dict = std::str::from_utf8(r.bytes()?).map_err(|_| "invalid dictionary")?;
                    let data = r.bytes()?;
                    let n = r.u32()? as usize;
                    self.w.ensure(num);
                    for i in 0..n {
                        let m = r.u32()?;
                        self.w.ensure(m);
                        self.w.entries[m as usize] = Entry::InStream(num, i as u32);
                    }
                    self.w.stream(num, dict, data, compress);
                }
                seg::END => {
                    let xref = r.u32()?;
                    let root = r.u32()?;
                    let info = r.u32()?;
                    let id: [u8; 16] = r.take(16)?.try_into().map_err(|_| "invalid id")?;
                    let size = r.u32()?;
                    self.w.ensure(size.saturating_sub(1));
                    self.w.write_xref(xref, root, (info != 0).then_some(info), id);
                    self.done = true;
                }
                k => return Err(format!("unknown segment {k}")),
            }
        }
        Ok(self.done)
    }

    /// Blocos prontos do arquivo.
    pub fn take(&mut self) -> Option<Vec<u8>> {
        self.w.ready.pop_front()
    }
}


/// Texto PDF em UTF-16BE com BOM, como string hexadecimal (`<FEFF…>`).
pub fn text_string(s: &str) -> String {
    let mut out = String::with_capacity(6 + s.len() * 4);
    out.push_str("<FEFF");
    for u in s.encode_utf16() {
        let _ = write!(out, "{u:04X}");
    }
    out.push('>');
    out
}

/// Nome PDF seguro (`/Nome`): bytes fora de `!`..`~` e os delimitadores viram `#xx`.
pub fn name(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 1);
    out.push('/');
    for b in s.bytes() {
        if (b'!'..=b'~').contains(&b) && !b"()<>[]{}/%#".contains(&b) {
            out.push(b as char);
        } else {
            let _ = write!(out, "#{b:02X}");
        }
    }
    out
}

/// String literal de bytes (`(…)`), com escapes.
pub fn literal(bytes: &[u8], out: &mut Vec<u8>) {
    out.push(b'(');
    for &b in bytes {
        match b {
            b'(' | b')' | b'\\' => out.extend_from_slice(&[b'\\', b]),
            b'\r' => out.extend_from_slice(b"\\r"),
            _ => out.push(b),
        }
    }
    out.push(b')');
}

/// Inteiro sem sinal direto no buffer (sem `fmt`).
pub fn put_u32(out: &mut Vec<u8>, v: u32) {
    let mut buf = [0u8; 10];
    let mut i = buf.len();
    let mut n = v;
    loop {
        i -= 1;
        buf[i] = b'0' + (n % 10) as u8;
        n /= 10;
        if n == 0 {
            break;
        }
    }
    out.extend_from_slice(&buf[i..]);
}

/// `num` direto no buffer (sem alocar): o caminho quente do conteúdo das páginas.
pub fn put_num(out: &mut Vec<u8>, v: f64) {
    put_cents(out, (v * 100.0).round() as i64);
}

/// Número em centésimos (`1234` → `12.34`), sem zeros à direita.
pub fn put_cents(out: &mut Vec<u8>, c: i64) {
    if c < 0 {
        out.push(b'-');
    }
    let c = c.unsigned_abs();
    let (int, frac) = (c / 100, c % 100);
    let mut buf = [0u8; 20];
    let mut i = buf.len();
    let mut n = int;
    loop {
        i -= 1;
        buf[i] = b'0' + (n % 10) as u8;
        n /= 10;
        if n == 0 {
            break;
        }
    }
    out.extend_from_slice(&buf[i..]);
    if frac != 0 {
        out.push(b'.');
        out.push(b'0' + (frac / 10) as u8);
        if frac % 10 != 0 {
            out.push(b'0' + (frac % 10) as u8);
        }
    }
}

/// Número curto (até 2 casas, sem zeros à direita).
pub fn num(v: f64) -> String {
    let r = (v * 100.0).round() / 100.0;
    if r == r.trunc() { format!("{}", r as i64) } else { let s = format!("{r:.2}"); s.trim_end_matches('0').trim_end_matches('.').to_owned() }
}
