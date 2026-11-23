/**
 * Leitor de zip mínimo para os testes (spec 29): diretório central, entradas
 * guardadas ou em deflate (`DecompressionStream('deflate-raw')`). Só o que o
 * xlsx usa; não é código de produção.
 */

const inflate = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([data as BlobPart]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** Partes do pacote por nome, como texto (UTF-8). */
export const unzip = async (blob: Blob): Promise<Map<string, string>> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let eocd = bytes.length - 22;

  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) {
    eocd--;
  }

  if (eocd < 0) {
    throw new Error('not a zip file');
  }

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const parts = new Map<string, string>();
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) {
      throw new Error('bad central directory');
    }

    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const extra = view.getUint16(p + 30, true);
    const comment = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + compressed);
    parts.set(name, decoder.decode(method === 0 ? raw : await inflate(raw)));
    p += 46 + nameLength + extra + comment;
  }

  return parts;
};

/** Um documento XML da parte (lança se ela falta). */
export const xmlOf = (parts: Map<string, string>, name: string): Document => {
  const text = parts.get(name);

  if (text === undefined) {
    throw new Error(`missing part ${name}`);
  }

  const doc = new DOMParser().parseFromString(text, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error(`${name} is not well-formed XML`);
  }

  return doc;
};
