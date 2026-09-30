/**
 * UUID version 7 (RFC 9562): 48-bit Unix time in milliseconds, then randomness.
 * IDs created by this app sort by creation time. Within the same millisecond the 12-bit
 * `rand_a` field acts as a counter (RFC 9562 §6.2, method 1), so IDs stay strictly increasing.
 */
let lastMs = -1;
let sequence = 0;

export function uuid7(nowMs: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let ms = nowMs;
  if (ms <= lastMs) {
    ms = lastMs;
    sequence++;
    if (sequence > 0xfff) {
      // Counter exhausted: borrow the next millisecond.
      ms++;
      sequence = 0;
    }
  } else {
    // Start below the midpoint so there is room to count up.
    sequence = ((bytes[6] & 0x07) << 8) | bytes[7];
  }
  lastMs = ms;

  // 48-bit big-endian timestamp.
  let t = ms;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = t % 256;
    t = Math.floor(t / 256);
  }
  bytes[6] = 0x70 | (sequence >> 8); // version 7 + high bits of rand_a
  bytes[7] = sequence & 0xff;
  bytes[8] = 0x80 | (bytes[8] & 0x3f); // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Reads the millisecond timestamp back out of a UUIDv7. */
export function uuid7Timestamp(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}
