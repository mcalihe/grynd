import { canAnimate, countUp, pop, reducedMotion } from './motion';

describe('motion helpers without animation support (jsdom)', () => {
  it('reports no animation support', () => {
    expect(reducedMotion()).toBe(false);
    expect(canAnimate()).toBe(false);
  });

  it('resolves element animations right away', async () => {
    await expect(pop(document.createElement('div'))).resolves.toBeUndefined();
    await expect(pop(null)).resolves.toBeUndefined();
  });

  it('jumps straight to the final value when counting up', async () => {
    const values: number[] = [];
    await countUp(480, (v) => values.push(v));
    expect(values).toEqual([480]);
  });
});
