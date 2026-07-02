import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';

// Shim the one browser API both renderers use: document.createElement('canvas').
// @napi-rs/canvas supports post-creation width/height reassignment natively,
// so returning createCanvas(1,1) is sufficient — the renderer sets .width/.height
// after creation and the canvas resizes correctly.
beforeAll(() => {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error('only canvas supported in shim');
      return createCanvas(1, 1); // renderers set width/height after creation
    },
  };
});

const SAMPLES = [
  {},
  { skin: 0, hair: 0, hairColor: 0, accessory: 0, build: 0, jersey: '#0000ff', jersey2: '#00ff00', shorts: '#123456', shoes: '#abcdef', number: 0 },
  { skin: 5, hair: 7, hairColor: 5, accessory: 4, build: 2, jersey: '#ffcc00', jersey2: '#101010', shorts: '#fefefe', shoes: '#222222', number: 99 },
  { skin: 3, hair: 3, hairColor: 2, accessory: 2, build: 1, number: 8 },
  { skin: 1, hair: 6, hairColor: 4, accessory: 3, build: 0, number: 42 },
];

function sheetBytes(mod: any, character: any): Uint8ClampedArray {
  const { canvas } = mod.generateSpriteSheet(character);
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data as Uint8ClampedArray;
}

describe('dunkchar port is byte-identical to v3 generator.js', () => {
  it('harness renders the v3 reference at sheet dimensions', async () => {
    const v3: any = await import('./fixtures/v3-generator.js');
    const { canvas } = v3.generateSpriteSheet({});
    expect(canvas.width).toBe(96 * 6);
    expect(canvas.height).toBe(128 * 7);
    const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    expect(bytes.length).toBe(96 * 6 * 128 * 7 * 4);
  });

  it('matches v3 across the character matrix', async () => {
    const v3: any = await import('./fixtures/v3-generator.js');
    const port: any = await import('../src/dunkchar/generator');
    for (const s of SAMPLES) {
      const a = sheetBytes(v3, s);
      const b = sheetBytes(port, s);
      expect(b.length).toBe(a.length);
      let firstDiff = -1;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { firstDiff = i; break; }
      expect(firstDiff, `character ${JSON.stringify(s)} differs at byte ${firstDiff}`).toBe(-1);
    }
  });
});
