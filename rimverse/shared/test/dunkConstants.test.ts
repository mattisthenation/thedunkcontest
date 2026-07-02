import { describe, it, expect } from 'vitest';
import { DC_COURT, DC_ZONES, DC_ACCURACY, DC_FIRE, dcHoops, dcClamp, dcSpawn, dcDunkReach, dcRespawnBall } from '../src/dunkConstants';

describe('dunk-contest constants (v3-faithful)', () => {
  it('carries v3 court + zone + accuracy + fire values', () => {
    expect(DC_COURT.threePointRadius).toBe(6.75);
    expect(DC_COURT.rimHeight).toBe(3.05);
    expect(DC_ZONES).toEqual({ dunk: 3.2, close: 5.0, mid: 8.0, heave: 13.0 });
    expect(DC_ACCURACY).toMatchObject({ close: 0.8, mid: 0.62, three: 0.45, heave: 0.18, onFireBonus: 0.18, max: 0.96 });
    expect(DC_FIRE).toEqual({ makesToIgnite: 3, durationMs: 45_000 });
  });
});

describe('dc geometry (fixed court, n-independent)', () => {
  it('has exactly two opposed rims at ±12.3 on y', () => {
    expect(dcHoops()).toEqual([{ x: 0, y: -12.3 }, { x: 0, y: 12.3 }]);
  });
  it('clamps to the v3 court bounds (±9.5 x, ±14.5 y)', () => {
    expect(dcClamp({ x: 99, y: -99 })).toEqual({ x: 9.5, y: -14.5 });
    expect(dcClamp({ x: NaN, y: 2 })).toEqual({ x: 0, y: 0 });
  });
  it('spawns inside the court', () => {
    const p = dcSpawn(() => 0.5); // rng 0.5 → center
    expect(p).toEqual({ x: 0, y: 0 });
    const c = dcSpawn(() => 0.99);
    expect(Math.abs(c.x)).toBeLessThanOrEqual(9.5);
    expect(Math.abs(c.y)).toBeLessThanOrEqual(14.5);
  });
  it('v3 dunk reach (3.7 normal / 4.5 turbo) and immediate scattered ball respawn', () => {
    expect(dcDunkReach(false)).toBeCloseTo(3.7);
    expect(dcDunkReach(true)).toBeCloseTo(4.5);
    expect(dcRespawnBall(() => 0.5)).toEqual({ x: 0, y: 0 });
    expect(Math.abs(dcRespawnBall(() => 0.99).x)).toBeLessThanOrEqual(4);
  });
});
