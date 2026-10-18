import {
  decodeShareCode,
  encodeShareCode,
  findShareCode,
  SHARE_CODE_MAX_BYTES,
  SHARE_CODE_PREFIX,
} from './share-code';

describe('share codes', () => {
  it('round-trips JSON, including umlauts, and stays short', async () => {
    const json = JSON.stringify({
      name: 'Oberkörper – Schwerpunkt Brust',
      exercises: Array.from({ length: 8 }, (_, i) => ({ id: `01a0f3b7-93cb-740c-896e-${i}` })),
    });
    const code = await encodeShareCode(json);

    expect(code.startsWith(SHARE_CODE_PREFIX)).toBe(true);
    expect(code).toMatch(/^GRYND1:[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(json.length);
    expect(await decodeShareCode(findShareCode(code)!)).toBe(json);
  });

  it('finds the code in a chat message', () => {
    expect(findShareCode('Hier mein Plan:\nGRYND1:abc_-1 viel Spass')).toBe('abc_-1');
    expect(findShareCode('{"app":"grynd"}')).toBeNull();
  });

  it('returns null for damaged codes and for oversized content', async () => {
    expect(await decodeShareCode('nope!')).toBeNull();
    const code = await encodeShareCode('{"a":1}');
    expect(await decodeShareCode(findShareCode(code)!.slice(0, -3))).toBeNull();

    const bomb = await encodeShareCode('x'.repeat(1001));
    expect(await decodeShareCode(findShareCode(bomb)!, 1000)).toBeNull();
    expect(SHARE_CODE_MAX_BYTES).toBe(50 * 1024 * 1024);
  });
});
