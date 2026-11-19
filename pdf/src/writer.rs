//! Escritor de PDF em fluxo: objetos numerados escritos assim que ficam prontos (em qualquer
//! ordem), objetos pequenos agrupados em object streams comprimidos, xref em stream (PDF 1.5+) e a
//! saída em blocos de tamanho fixo que o hospedeiro recolhe (a memória não cresce com o arquivo).

use std::fmt::Write as _;

use miniz_oxide::deflate::core::{CompressorOxide, TDEFLFlush, TDEFLStatus, compress, create_comp_flags_from_zip_params};

/// Nível do deflate: 3 é ~3× mais rápido que o 6 com ~6% a mais de tamanho (medido).
const DEFLATE_LEVEL: i32 = 3;
/// Objetos por object stream (e bytes, o que vier primeiro).
const OBJSTM_COUNT: usize = 200;
const OBJSTM_BYTES: usize = 64 * 1024;

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
    stm_offsets: String,
    stm_body: Vec<u8>,
    stm_members: Vec<u32>,
    compressor: Box<CompressorOxide>,
    scratch: Vec<u8>,
}

impl Writer {
    pub fn new(chunk_size: usize) -> Writer {
        // janela negativa = deflate cru (o cabeçalho zlib e o adler32 são escritos aqui)
        let flags = create_comp_flags_from_zip_params(DEFLATE_LEVEL, -15, 0);
        let mut w = Writer {
            chunk_size: chunk_size.max(4096),
            buf: Vec::new(),
            ready: std::collections::VecDeque::new(),
            out_len: 0,
            entries: vec![Entry::Free],
            stm_offsets: String::new(),
            stm_body: Vec::new(),
            stm_members: Vec::new(),
            compressor: Box::new(CompressorOxide::new(flags)),
            scratch: Vec::new(),
        };
        // cabeçalho + comentário binário
        w.put(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n");
        w
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
        self.entries[num as usize] = Entry::Direct(self.out_len);
        let mut head = String::with_capacity(16);
        let _ = writeln!(head, "{num} 0 obj");
        self.put(head.as_bytes());
        self.put(body);
        self.put(b"\nendobj\n");
    }

    /// Stream (comprimido quando ganha).
    pub fn stream(&mut self, num: u32, dict: &str, data: &[u8], compress_it: bool) {
        let deflated = compress_it && data.len() > 64 && self.deflate(data);
        let (payload, filter): (&[u8], &str) = if deflated { (&self.scratch, " /Filter /FlateDecode") } else { (data, "") };
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
        let _ = write!(self.stm_offsets, "{num} {} ", self.stm_body.len());
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
        data.extend_from_slice(offsets.as_bytes());
        let first = data.len();
        data.extend_from_slice(&self.stm_body);
        self.stm_body.clear();
        self.stream(num, &format!(" /Type /ObjStm /N {} /First {first}", members.len()), &data, true);
    }

    fn deflate(&mut self, data: &[u8]) -> bool {
        self.compressor.reset();
        self.scratch.clear();
        // zlib: cabeçalho + deflate + adler32
        self.scratch.extend_from_slice(&[0x78, 0x5e]);
        let mut out = vec![0u8; 64 * 1024];
        let mut input = data;
        loop {
            let (status, read, written) = compress(&mut self.compressor, input, &mut out, TDEFLFlush::Finish);
            self.scratch.extend_from_slice(&out[..written]);
            input = &input[read..];
            match status {
                TDEFLStatus::Done => break,
                TDEFLStatus::Okay => {}
                _ => return false,
            }
        }
        self.scratch.extend_from_slice(&adler32(data).to_be_bytes());
        self.scratch.len() < data.len()
    }

    /// Fecha o arquivo: object stream pendente, xref em stream e trailer. `info` é opcional.
    pub fn finish(mut self, root: u32, info: Option<u32>, id: [u8; 16]) -> std::collections::VecDeque<Vec<u8>> {
        self.flush_objstm();
        let xref = self.alloc();
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
        self.ready
    }
}

fn adler32(data: &[u8]) -> u32 {
    let (mut a, mut b) = (1u32, 0u32);
    for chunk in data.chunks(5552) {
        for &x in chunk {
            a += u32::from(x);
            b += a;
        }
        a %= 65521;
        b %= 65521;
    }
    (b << 16) | a
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

/// Número curto (até 2 casas, sem zeros à direita).
pub fn num(v: f64) -> String {
    let r = (v * 100.0).round() / 100.0;
    if r == r.trunc() { format!("{}", r as i64) } else { let s = format!("{r:.2}"); s.trim_end_matches('0').trim_end_matches('.').to_owned() }
}
