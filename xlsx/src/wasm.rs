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
pub extern "C" fn begin(ptr: *mut u8, len: usize) -> i32 {
    let bytes = take(ptr, len);
    with(|e| e.begin(&bytes), code::STATE)
}

#[unsafe(no_mangle)]
pub extern "C" fn append(ptr: *mut u8, len: usize) -> i32 {
    let bytes = take(ptr, len);
    with(|e| e.append(&bytes), code::STATE)
}

/// Fecha o arquivo; devolve o tamanho (lido em `out_ptr`) ou um código negativo.
#[unsafe(no_mangle)]
pub extern "C" fn finish() -> i32 {
    with(Engine::finish, code::STATE)
}

#[unsafe(no_mangle)]
pub extern "C" fn rows_written() -> f64 {
    with(|e| e.rows_written() as f64, 0.0)
}

#[unsafe(no_mangle)]
pub extern "C" fn dropped_links() -> f64 {
    with(|e| e.dropped_links() as f64, 0.0)
}

#[unsafe(no_mangle)]
pub extern "C" fn cut_texts() -> f64 {
    with(|e| e.cut_texts() as f64, 0.0)
}

/// Início do arquivo (depois de `finish`; tamanho = o que `finish` devolveu).
#[unsafe(no_mangle)]
pub extern "C" fn file_ptr() -> *const u8 {
    with(|e| e.out.as_ptr(), std::ptr::null())
}

/// Início da mensagem de erro (depois de `error`).
#[unsafe(no_mangle)]
pub extern "C" fn out_ptr() -> *const u8 {
    OUT.with(|o| o.borrow().as_ptr())
}

/// Mensagem do último erro (em `out_ptr`); devolve o tamanho.
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
