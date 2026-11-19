//! Exportações para o JS (worker ou thread principal). Uma exportação por instância do módulo.
//! Buffers de entrada vêm de `alloc` e são consumidos pela chamada.

use std::cell::RefCell;

use crate::{Engine, code};

thread_local! {
    static ENGINE: RefCell<Option<Engine>> = const { RefCell::new(None) };
    static OUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

fn take(ptr: *mut u8, len: usize) -> Vec<u8> {
    if ptr.is_null() || len == 0 {
        return Vec::new();
    }
    // SAFETY: ptr/len vieram de `alloc(len)` e o JS só escreveu dentro deles.
    unsafe { Vec::from_raw_parts(ptr, len, len) }
}

fn with<R>(f: impl FnOnce(&mut Engine) -> R, default: R) -> R {
    ENGINE.with(|e| e.borrow_mut().as_mut().map_or(default, f))
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut v = vec![0u8; len];
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// Começa uma exportação nova (descarta a anterior).
#[unsafe(no_mangle)]
pub extern "C" fn create() {
    ENGINE.with(|e| *e.borrow_mut() = Some(Engine::new()));
    OUT.with(|o| *o.borrow_mut() = Vec::new());
}

#[unsafe(no_mangle)]
pub extern "C" fn add_font(ptr: *mut u8, len: usize, bold: u32, italic: u32) -> i32 {
    let bytes = take(ptr, len);
    with(|e| e.add_font(bytes, bold != 0, italic != 0), code::STATE)
}

#[unsafe(no_mangle)]
pub extern "C" fn begin(ptr: *mut u8, len: usize) -> i32 {
    let bytes = take(ptr, len);
    with(|e| e.begin(&bytes), code::STATE)
}

#[unsafe(no_mangle)]
pub extern "C" fn add_image(ptr: *mut u8, len: usize, format: u32, width: f32, height: f32) -> i32 {
    let bytes = take(ptr, len);
    with(|e| e.add_image(&bytes, format as u8, f64::from(width), f64::from(height)), code::STATE)
}

#[unsafe(no_mangle)]
pub extern "C" fn push_rows(ptr: *mut u8, len: usize) -> i32 {
    let bytes = take(ptr, len);
    with(|e| e.push_rows(&bytes), code::STATE)
}

#[unsafe(no_mangle)]
pub extern "C" fn end_input() {
    with(Engine::end_input, ());
}

#[unsafe(no_mangle)]
pub extern "C" fn layout(pages: u32) -> i32 {
    with(|e| e.layout(pages as usize), code::STATE)
}

#[unsafe(no_mangle)]
pub extern "C" fn pending_rows() -> u32 {
    with(|e| e.pending_rows() as u32, 0)
}

#[unsafe(no_mangle)]
pub extern "C" fn page_count() -> u32 {
    with(|e| e.page_count() as u32, 0)
}

#[unsafe(no_mangle)]
pub extern "C" fn rows_done() -> f64 {
    with(|e| e.rows_done() as f64, 0.0)
}

#[unsafe(no_mangle)]
pub extern "C" fn finish() -> i32 {
    with(Engine::finish, code::STATE)
}

/// Tira o próximo bloco pronto do PDF; devolve o tamanho (0 = nenhum). Leia em `out_ptr`.
#[unsafe(no_mangle)]
pub extern "C" fn take_chunk() -> usize {
    let c = with(|e| e.out.pop_front(), None).unwrap_or_default();
    OUT.with(|o| {
        *o.borrow_mut() = c;
        o.borrow().len()
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn out_ptr() -> *const u8 {
    OUT.with(|o| o.borrow().as_ptr())
}

/// Mensagem do último erro em OUT; devolve o tamanho.
#[unsafe(no_mangle)]
pub extern "C" fn error() -> usize {
    let msg = with(|e| e.error.clone(), String::new());
    OUT.with(|o| {
        *o.borrow_mut() = msg.into_bytes();
        o.borrow().len()
    })
}

/// Solta a exportação (memória do wasm volta ao alocador; o `memory` não encolhe).
#[unsafe(no_mangle)]
pub extern "C" fn dispose() {
    ENGINE.with(|e| *e.borrow_mut() = None);
    OUT.with(|o| *o.borrow_mut() = Vec::new());
}
