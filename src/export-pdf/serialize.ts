/**
 * Protocolo binário JS → motor (o mesmo de `pdf/src/input.rs`): configuração
 * e blocos de linhas, little endian, strings em UTF-8 com o tamanho antes.
 */

const encoder = new TextEncoder();

export class Writer {
  #buf = new Uint8Array(64 * 1024);
  #view = new DataView(this.#buf.buffer);
  #len = 0;

  #room(n: number) {
    if (this.#len + n > this.#buf.length) {
      let size = this.#buf.length * 2;

      while (size < this.#len + n) {
        size *= 2;
      }

      const next = new Uint8Array(size);
      next.set(this.#buf.subarray(0, this.#len));
      this.#buf = next;
      this.#view = new DataView(next.buffer);
    }
  }

  u8(v: number) {
    this.#room(1);
    this.#view.setUint8(this.#len, v);
    this.#len += 1;
  }

  u16(v: number) {
    this.#room(2);
    this.#view.setUint16(this.#len, v, true);
    this.#len += 2;
  }

  u32(v: number) {
    this.#room(4);
    this.#view.setUint32(this.#len, v >>> 0, true);
    this.#len += 4;
  }

  i32(v: number) {
    this.#room(4);
    this.#view.setInt32(this.#len, v, true);
    this.#len += 4;
  }

  f32(v: number) {
    this.#room(4);
    this.#view.setFloat32(this.#len, v, true);
    this.#len += 4;
  }

  str(v: string) {
    // UTF-8 tem no máximo 3 bytes por unidade UTF-16
    this.#room(4 + v.length * 3);
    const { written } = encoder.encodeInto(v, this.#buf.subarray(this.#len + 4));
    this.#view.setUint32(this.#len, written, true);
    this.#len += 4 + written;
  }

  get length(): number {
    return this.#len;
  }

  /** Bytes escritos (cópia) e recomeça. */
  take(): Uint8Array {
    const out = this.#buf.slice(0, this.#len);
    this.#len = 0;
    return out;
  }
}

/** Cor CSS → RGB (`0xRRGGBB`); `undefined` quando não dá para ler. */
export const parseColor = (color: string | undefined | null): number | undefined => {
  if (!color) {
    return undefined;
  }

  const c = color.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(c);

  if (m) {
    const [r, g, b] = [...m[1]].map(x => parseInt(x + x, 16));
    return (r << 16) | (g << 8) | b;
  }

  m = /^#([0-9a-f]{6})$/.exec(c);

  if (m) {
    return parseInt(m[1], 16);
  }

  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c);

  if (m) {
    return (Math.min(255, +m[1]) << 16) | (Math.min(255, +m[2]) << 8) | Math.min(255, +m[3]);
  }

  // nomes e outros formatos: o canvas normaliza (só no navegador)
  if (typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined') {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (ctx) {
      ctx.fillStyle = '#010203';
      ctx.fillStyle = color;
      const normalized = String(ctx.fillStyle);

      if (normalized !== '#010203' || c === '#010203') {
        return parseColor(normalized);
      }
    }
  }

  return undefined;
};

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb: number) => 0.2126 * channel((rgb >> 16) & 255) + 0.7152 * channel((rgb >> 8) & 255) + 0.0722 * channel(rgb & 255);

/** Contraste WCAG entre duas cores. */
export const contrast = (a: number, b: number): number => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
