import { blobToBase64, fitWithin, NOTE_IMAGE_MAX_SIDE } from './note-image';

describe('fitWithin', () => {
  it('scales the longest side down to the limit and keeps the ratio', () => {
    expect(fitWithin(4032, 3024, NOTE_IMAGE_MAX_SIDE)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, NOTE_IMAGE_MAX_SIDE)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales small images', () => {
    expect(fitWithin(800, 600, NOTE_IMAGE_MAX_SIDE)).toEqual({ width: 800, height: 600 });
  });

  it('keeps at least one pixel on very thin images', () => {
    expect(fitWithin(10000, 2, 1000)).toEqual({ width: 1000, height: 1 });
  });
});

describe('blobToBase64', () => {
  it('returns the contents without the data: prefix', async () => {
    expect(await blobToBase64(new Blob(['Grynd'], { type: 'image/jpeg' }))).toBe(btoa('Grynd'));
  });
});
