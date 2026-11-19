//! Árvore de estrutura (PDF marcado) em fluxo: cada elemento é escrito quando fecha (pilha), as
//! entradas da `ParentTree` e da `IDTree` saem em folhas assim que enchem (as chaves e os IDs são
//! gerados em ordem crescente), então a memória não cresce com o número de células.

use std::fmt::Write as _;

use crate::writer::{Writer, put_u32, text_string};

#[derive(Clone, Copy)]
pub enum Kid {
    Mcid { page: u32, mcid: u32 },
    Elem(u32),
    Objr { page: u32, annot: u32 },
}

struct Open {
    obj: u32,
    ty: &'static str,
    parent: u32,
    kids: Vec<Kid>,
    /// objeto de atributo (`/A n 0 R`), 0 = nenhum
    attr: u32,
    /// entradas extras do dicionário (`/A`, `/ID`, `/Alt`, `/ActualText`, `/Lang`, `/T`)
    extra: String,
}

const LEAF: usize = 128;

pub struct Tags {
    pub root: u32,
    stack: Vec<Open>,
    /// elementos abertos fora da pilha (células de uma linha que atravessa páginas)
    detached: std::collections::HashMap<u32, Open>,
    /// folhas da ParentTree: (1ª chave, última chave, objeto)
    pt_leaves: Vec<(u32, u32, u32)>,
    pt_pending: Vec<(u32, u32)>,
    next_key: u32,
    /// folhas da IDTree: (1º id, último id, objeto)
    id_leaves: Vec<(String, String, u32)>,
    id_pending: Vec<(String, u32)>,
    next_id: u32,
    /// MCIDs da página corrente: dono de cada MCID
    page_owners: Vec<u32>,
    pub elements: u64,
}

impl Tags {
    pub fn new(w: &mut Writer) -> Tags {
        Tags {
            root: w.alloc(),
            stack: Vec::new(),
            detached: std::collections::HashMap::new(),
            pt_leaves: Vec::new(),
            pt_pending: Vec::new(),
            next_key: 0,
            id_leaves: Vec::new(),
            id_pending: Vec::new(),
            next_id: 0,
            page_owners: Vec::new(),
            elements: 0,
        }
    }

    /// Abre um elemento filho do topo (ou da raiz). Devolve o número do objeto.
    pub fn open(&mut self, w: &mut Writer, ty: &'static str, extra: String) -> u32 {
        let obj = w.alloc();
        let parent = self.stack.last().map_or(self.root, |o| o.obj);
        if let Some(p) = self.stack.last_mut() {
            p.kids.push(Kid::Elem(obj));
        }
        self.stack.push(Open { obj, ty, parent, kids: Vec::new(), attr: 0, extra });
        self.elements += 1;
        obj
    }

    fn push_kid(&mut self, parent: u32, kid: Kid) {
        if let Some(o) = self.detached.get_mut(&parent) {
            o.kids.push(kid);
        } else if let Some(o) = self.stack.iter_mut().rev().find(|o| o.obj == parent) {
            o.kids.push(kid);
        }
    }

    /// Abre um elemento fora da pilha, filho de `parent` (aberto na pilha ou fora dela).
    pub fn open_detached(&mut self, w: &mut Writer, parent: u32, ty: &'static str, extra: String) -> u32 {
        self.open_cell(w, parent, ty, 0, extra)
    }

    /// `open_detached` com o objeto de atributo compartilhado `attr` (`/A attr 0 R`; 0 = nenhum).
    pub fn open_cell(&mut self, w: &mut Writer, parent: u32, ty: &'static str, attr: u32, extra: String) -> u32 {
        let obj = w.alloc();
        self.push_kid(parent, Kid::Elem(obj));
        self.detached.insert(obj, Open { obj, ty, parent, kids: Vec::new(), attr, extra });
        self.elements += 1;
        obj
    }

    /// Acrescenta entradas ao dicionário de um elemento ainda aberto (fora da pilha).
    pub fn extend(&mut self, obj: u32, extra: &str) {
        if let Some(o) = self.detached.get_mut(&obj) {
            o.extra.push_str(extra);
        }
    }

    /// Novo MCID da página corrente com dono `owner` (aberto na pilha ou fora dela).
    pub fn mcid_to(&mut self, page: u32, owner: u32) -> u32 {
        let mcid = self.page_owners.len() as u32;
        self.page_owners.push(owner);
        self.push_kid(owner, Kid::Mcid { page, mcid });
        mcid
    }

    /// Anotação ligada a `owner`: devolve a chave `/StructParent`.
    pub fn objr_to(&mut self, w: &mut Writer, page: u32, annot: u32, owner: u32) -> u32 {
        self.push_kid(owner, Kid::Objr { page, annot });
        let key = self.next_key;
        self.next_key += 1;
        self.pt_push(w, key, owner);
        key
    }

    /// Fecha e escreve um elemento fora da pilha.
    pub fn close_detached(&mut self, w: &mut Writer, obj: u32) {
        if let Some(o) = self.detached.remove(&obj) {
            Self::write(w, o);
        }
    }

    /// Fecha o elemento do topo e o escreve.
    pub fn close(&mut self, w: &mut Writer) {
        let Some(o) = self.stack.pop() else { return };
        Self::write(w, o);
    }

    fn write(w: &mut Writer, o: Open) {
        let mut s: Vec<u8> = Vec::with_capacity(48 + o.kids.len() * 8 + o.extra.len());
        s.extend_from_slice(b"<</S /");
        s.extend_from_slice(o.ty.as_bytes());
        s.extend_from_slice(b" /P ");
        put_u32(&mut s, o.parent);
        s.extend_from_slice(b" 0 R");
        // /Pg = página do 1º MCID; MCIDs de outra página viram MCR
        let pg = o.kids.iter().find_map(|k| if let Kid::Mcid { page, .. } = k { Some(*page) } else { None });
        if let Some(p) = pg {
            s.extend_from_slice(b" /Pg ");
            put_u32(&mut s, p);
            s.extend_from_slice(b" 0 R");
        }
        match o.kids.as_slice() {
            [] => {}
            // um MCID só (a célula comum): inteiro, sem array
            [Kid::Mcid { page, mcid }] if Some(*page) == pg => {
                s.extend_from_slice(b" /K ");
                put_u32(&mut s, *mcid);
            }
            kids => {
                s.extend_from_slice(b" /K [");
                for k in kids {
                    match *k {
                        Kid::Mcid { page, mcid } if Some(page) == pg => {
                            put_u32(&mut s, mcid);
                            s.push(b' ');
                        }
                        Kid::Mcid { page, mcid } => {
                            let _ = write!(Buf(&mut s), "<</Type /MCR /Pg {page} 0 R /MCID {mcid}>> ");
                        }
                        Kid::Elem(e) => {
                            put_u32(&mut s, e);
                            s.extend_from_slice(b" 0 R ");
                        }
                        Kid::Objr { page, annot } => {
                            let _ = write!(Buf(&mut s), "<</Type /OBJR /Pg {page} 0 R /Obj {annot} 0 R>> ");
                        }
                    }
                }
                s.pop();
                s.push(b']');
            }
        }
        if o.attr != 0 {
            s.extend_from_slice(b" /A ");
            put_u32(&mut s, o.attr);
            s.extend_from_slice(b" 0 R");
        }
        s.extend_from_slice(o.extra.as_bytes());
        s.extend_from_slice(b">>");
        w.small(o.obj, &s);
    }

    pub fn depth(&self) -> usize {
        self.stack.len()
    }

    /// Fecha a página: o array dono-por-MCID vira um objeto e entra na ParentTree. Devolve a chave
    /// `/StructParents` da página.
    pub fn end_page(&mut self, w: &mut Writer) -> u32 {
        let owners = std::mem::take(&mut self.page_owners);
        let arr = w.alloc();
        let mut s = String::with_capacity(owners.len() * 9 + 2);
        s.push('[');
        for o in &owners {
            let _ = write!(s, "{o} 0 R ");
        }
        s.push(']');
        w.small(arr, s.as_bytes());
        let key = self.next_key;
        self.next_key += 1;
        self.pt_push(w, key, arr);
        key
    }

    fn pt_push(&mut self, w: &mut Writer, key: u32, obj: u32) {
        self.pt_pending.push((key, obj));
        if self.pt_pending.len() >= LEAF {
            self.pt_flush(w);
        }
    }

    fn pt_flush(&mut self, w: &mut Writer) {
        if self.pt_pending.is_empty() {
            return;
        }
        let leaf = w.alloc();
        let mut s = String::from("<</Nums [");
        for (k, o) in &self.pt_pending {
            let _ = write!(s, "{k} {o} 0 R ");
        }
        let (first, last) = (self.pt_pending[0].0, self.pt_pending[self.pt_pending.len() - 1].0);
        let _ = write!(s, "] /Limits [{first} {last}]>>");
        w.small(leaf, s.as_bytes());
        self.pt_leaves.push((first, last, leaf));
        self.pt_pending.clear();
    }

    /// Novo ID único (crescente: a IDTree sai em ordem) ligado ao objeto `obj`.
    pub fn new_id(&mut self, w: &mut Writer, obj: u32) -> String {
        let id = format!("i{:08}", self.next_id);
        self.next_id += 1;
        self.id_pending.push((id.clone(), obj));
        if self.id_pending.len() >= LEAF {
            self.id_flush(w);
        }
        id
    }

    fn id_flush(&mut self, w: &mut Writer) {
        if self.id_pending.is_empty() {
            return;
        }
        let leaf = w.alloc();
        let mut s = String::from("<</Names [");
        for (id, o) in &self.id_pending {
            let _ = write!(s, "({id}) {o} 0 R ");
        }
        let first = self.id_pending[0].0.clone();
        let last = self.id_pending[self.id_pending.len() - 1].0.clone();
        let _ = write!(s, "] /Limits [({first}) ({last})]>>");
        w.small(leaf, s.as_bytes());
        self.id_leaves.push((first, last, leaf));
        self.id_pending.clear();
    }

    /// Um nível de nós intermediários de árvore de números/nomes: até `LEAF` filhos por nó, com
    /// `/Limits` (chaves de string entre parênteses quando `quote` = "()").
    fn nodes(w: &mut Writer, kids: Vec<(String, String, u32)>, quote: &str) -> Vec<(String, String, u32)> {
        let (open, close) = if quote.is_empty() { ("", "") } else { ("(", ")") };
        kids.chunks(LEAF)
            .map(|group| {
                let node = w.alloc();
                let refs: Vec<String> = group.iter().map(|(_, _, o)| format!("{o} 0 R")).collect();
                let (first, last) = (group[0].0.clone(), group[group.len() - 1].1.clone());
                w.small(node, format!("<</Kids [{}] /Limits [{open}{first}{close} {open}{last}{close}]>>", refs.join(" ")).as_bytes());
                (first, last, node)
            })
            .collect()
    }

    /// Fecha tudo e escreve a StructTreeRoot. `kids` = os elementos de 1º nível já abertos/fechados.
    pub fn finish(&mut self, w: &mut Writer, doc: u32) {
        while !self.stack.is_empty() {
            self.close(w);
        }
        self.pt_flush(w);
        self.id_flush(w);
        let pt = w.alloc();
        let mut level: Vec<(String, String, u32)> = self.pt_leaves.iter().map(|(a, b, o)| (a.to_string(), b.to_string(), *o)).collect();
        while level.len() > LEAF {
            level = Self::nodes(w, level, "");
        }
        let kids: Vec<String> = level.iter().map(|(_, _, o)| format!("{o} 0 R")).collect();
        w.small(pt, format!("<</Kids [{}]>>", kids.join(" ")).as_bytes());
        let mut root = format!("<</Type /StructTreeRoot /K [{doc} 0 R] /ParentTree {pt} 0 R /ParentTreeNextKey {}", self.next_key);
        if !self.id_leaves.is_empty() {
            let idt = w.alloc();
            let mut level = std::mem::take(&mut self.id_leaves);
            while level.len() > LEAF {
                level = Self::nodes(w, level, "()");
            }
            let kids: Vec<String> = level.iter().map(|(_, _, o)| format!("{o} 0 R")).collect();
            w.small(idt, format!("<</Kids [{}]>>", kids.join(" ")).as_bytes());
            let _ = write!(root, " /IDTree {idt} 0 R");
        }
        root.push_str(">>");
        w.small(self.root, root.as_bytes());
    }
}

/// `/ActualText` (texto lógico) para o dicionário de um elemento.
/// `write!` num `Vec<u8>`.
struct Buf<'a>(&'a mut Vec<u8>);

impl std::fmt::Write for Buf<'_> {
    fn write_str(&mut self, s: &str) -> std::fmt::Result {
        self.0.extend_from_slice(s.as_bytes());
        Ok(())
    }
}

pub fn actual_text(s: &str) -> String {
    format!(" /ActualText {}", text_string(s))
}

/// `/Alt`.
pub fn alt(s: &str) -> String {
    format!(" /Alt {}", text_string(s))
}

/// `/Lang`.
pub fn lang(s: &str) -> String {
    format!(" /Lang {}", text_string(s))
}
