import { sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
  it('spreads values over the width, highest at the top', () => {
    expect(sparklinePoints([10, 20, 15])).toEqual([
      [4, 28],
      [48, 4],
      [92, 16],
    ]);
  });

  it('skips gaps and centres flat or single values', () => {
    expect(sparklinePoints([null, 5, null]).map(([, y]) => y)).toEqual([16]);
    expect(sparklinePoints([60])).toEqual([[48, 16]]);
    expect(sparklinePoints([null])).toEqual([]);
  });
});
