import { uuid7, uuid7Timestamp } from './uuid7';

const UUID7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid7', () => {
  it('has the UUIDv7 format with version and variant bits', () => {
    for (let i = 0; i < 50; i++) {
      expect(uuid7()).toMatch(UUID7_PATTERN);
    }
  });

  it('encodes the millisecond timestamp', () => {
    const ms = Date.UTC(2031, 5, 1, 12, 0, 0, 123);
    expect(uuid7Timestamp(uuid7(ms))).toBe(ms);
  });

  it('is strictly increasing, also within the same millisecond', () => {
    const ms = Date.UTC(2032, 0, 1);
    const ids = Array.from({ length: 5000 }, () => uuid7(ms));
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stays increasing when the clock goes backwards', () => {
    const later = uuid7(Date.UTC(2033, 0, 1, 0, 0, 1));
    const earlier = uuid7(Date.UTC(2033, 0, 1, 0, 0, 0));
    expect(earlier > later).toBe(true);
  });
});
