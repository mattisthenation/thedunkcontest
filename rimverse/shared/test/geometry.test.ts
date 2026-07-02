import { describe, it, expect } from 'vitest';
import { discRadius, hoopPosition, hoopCount, clampToArena, spawnPos } from '../src/geometry';
import { COURT_HALF_L, COURT_HALF_W, R_BASE, R_K } from '../src/constants';

describe('geometry', () => {
  it('disc radius scales with sqrt(N)', () => {
    expect(discRadius(4)).toBeCloseTo(R_BASE + R_K * 2);
    expect(discRadius(100)).toBeCloseTo(R_BASE + R_K * 10);
  });

  it('rectangle mode (N<=2): two opposed hoops on the y axis', () => {
    expect(hoopCount(1)).toBe(2);
    expect(hoopCount(2)).toBe(2);
    expect(hoopPosition(0, 1)).toEqual({ x: 0, y: -COURT_HALF_L });
    expect(hoopPosition(1, 2)).toEqual({ x: 0, y: COURT_HALF_L });
  });

  it('disc mode (N>=3): N hoops evenly on the rim', () => {
    expect(hoopCount(3)).toBe(3);
    const r = discRadius(4);
    const h0 = hoopPosition(0, 4);
    const h1 = hoopPosition(1, 4);
    expect(Math.hypot(h0.x, h0.y)).toBeCloseTo(r);
    expect(Math.hypot(h1.x, h1.y)).toBeCloseTo(r);
    // quarter turn apart
    const dot = (h0.x * h1.x + h0.y * h1.y) / (r * r);
    expect(dot).toBeCloseTo(0);
  });

  it('clamps to rectangle when N<=2', () => {
    const p = clampToArena({ x: 99, y: -99 }, 2);
    expect(p.x).toBe(COURT_HALF_W);
    expect(p.y).toBe(-COURT_HALF_L);
  });

  it('spawnPos sits inside the arena, near the owned hoop, toward the hub', () => {
    const rect = spawnPos(0, 1);
    expect(rect.y).toBeGreaterThan(-COURT_HALF_L); // pulled 2.5 in from the rim
    expect(rect.y).toBeLessThan(-COURT_HALF_L + 4);
    const disc = spawnPos(2, 8);
    const r = Math.hypot(disc.x, disc.y);
    expect(r).toBeLessThan(discRadius(8));
    expect(r).toBeGreaterThan(discRadius(8) - 4);
  });

  it('returns a safe in-arena point for non-finite input (H1 defense-in-depth)', () => {
    for (const n of [2, 5]) {
      const a = clampToArena({ x: NaN, y: 0 }, n);
      const b = clampToArena({ x: Infinity, y: -Infinity }, n);
      for (const p of [a, b]) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(discRadius(Math.max(3, n)) + 1e-9);
      }
    }
  });

  it('clamps to disc when N>=3', () => {
    const p = clampToArena({ x: 100, y: 0 }, 3);
    expect(p.x).toBeCloseTo(discRadius(3));
    expect(p.y).toBe(0);
    const inside = clampToArena({ x: 1, y: 1 }, 3);
    expect(inside).toEqual({ x: 1, y: 1 });
  });
});
