/**
 * Text codes to copy an export and paste it elsewhere (decision 0027):
 * `GRYND1:` + base64url of the deflate-compressed JSON. Built on the browser's
 * CompressionStream, so no dependency is needed.
 */
export const SHARE_CODE_PREFIX = 'GRYND1:';
/**
 * Decompressed JSON larger than this is refused, so a crafted code cannot exhaust memory. Codes
 * can carry workout history, which stays far below this without photos.
 */
export const SHARE_CODE_MAX_BYTES = 50 * 1024 * 1024;

const CODE = new RegExp(`${SHARE_CODE_PREFIX}([A-Za-z0-9_-]+)`);

export async function encodeShareCode(json: string): Promise<string> {
  const stream = streamOf(new TextEncoder().encode(json)).pipeThrough(
    new CompressionStream('deflate-raw'),
  );
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return SHARE_CODE_PREFIX + toBase64Url(bytes);
}

/** The code inside a text, e.g. a chat message with a greeting around it; null without one. */
export function findShareCode(text: string): string | null {
  return CODE.exec(text)?.[1] ?? null;
}

/** The JSON inside a code (without prefix); null when it is damaged or too large. */
export async function decodeShareCode(
  code: string,
  maxBytes = SHARE_CODE_MAX_BYTES,
): Promise<string | null> {
  try {
    const stream = streamOf(fromBase64Url(code)).pipeThrough(
      new DecompressionStream('deflate-raw'),
    );
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function streamOf(bytes: Uint8Array<ArrayBuffer>): ReadableStream<Uint8Array<ArrayBuffer>> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
