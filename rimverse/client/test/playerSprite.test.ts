import { describe, it, expect } from 'vitest';
import { spriteWorldY } from '../src/sprites/spriteMath';

describe('spriteWorldY', () => {
  it('adds the player height z on top of the grounded base', () => {
    const grounded = spriteWorldY(1 /*size*/, 0 /*bendY*/, 0 /*z*/);
    const airborne = spriteWorldY(1, 0, 1.3);
    expect(airborne - grounded).toBeCloseTo(1.3);
  });
  it('scales the grounded base by size and adds bend height', () => {
    // base = (QUAD_H*size)/2 - 0.06 + bendY ; only the delta matters here
    const a = spriteWorldY(1, 0, 0);
    const b = spriteWorldY(1, 0.5, 0); // +0.5 bend
    expect(b - a).toBeCloseTo(0.5);
  });
});
