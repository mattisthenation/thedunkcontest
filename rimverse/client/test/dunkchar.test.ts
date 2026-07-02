import { describe, it, expect } from 'vitest';
import { SHEET, ANIMATIONS, HAIR_STYLES, BUILDS, ACCESSORIES, shade } from '../src/dunkchar/generator';
describe('dunkchar constants', () => {
  it('sheet + anim table match v3', () => {
    expect(SHEET).toEqual({ frameW: 96, frameH: 128, cols: 6, rows: 7 });
    expect(Object.keys(ANIMATIONS).length).toBe(7);
    expect(HAIR_STYLES.length).toBe(8);
    expect(BUILDS.length).toBe(3);
    expect(ACCESSORIES.length).toBe(5);
  });
  it('shade scales an rgb hex', () => {
    expect(shade('#808080', 2)).toBe('rgb(255,255,255)');
    expect(shade('#804020', 0.5)).toBe('rgb(64,32,16)');
  });
});
