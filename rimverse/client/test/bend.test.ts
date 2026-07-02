import { describe, it, expect } from 'vitest';
import { type BendParams, rimBend, rimLift, bendNormal, bendHeightFor } from '../src/scene/bend';

const P = (over: Partial<BendParams> = {}): BendParams => ({
  originX: 0,
  originY: 0,
  floorRadius: 14,
  bendHeight: 8,
  bendPull: 0.2,
  ...over,
});

describe('rimBend', () => {
  it('is flat at the origin (zero lift, no pull)', () => {
    const b = rimBend(0, 0, 0, P());
    expect(b).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('lift increases monotonically with distance', () => {
    const ys = [0, 5, 10, 20, 40].map((d) => rimBend(d, 0, 0, P()).y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  it('slope at the origin is ~0 (quadratic, no seasick tilt)', () => {
    const eps = 0.01;
    const slope = (rimLift(eps, 0, P()) - rimLift(0, 0, P())) / eps;
    expect(Math.abs(slope)).toBeLessThan(0.01);
  });

  it('far rim (d = 2*radius) lifts well above the camera (y=9) into the sky', () => {
    const y = rimLift(28, 0, P()); // u=2: 8*4/(1+1) = 16
    expect(y).toBeGreaterThan(9); // clears the follow-cam → Escher loop
    expect(y).toBeLessThan(20); // but not absurd
  });

  it('rimLift equals rimBend().y exactly', () => {
    for (const [x, z] of [
      [3, 4],
      [10, -7],
      [-12, 5],
    ]) {
      expect(rimLift(x, z, P())).toBeCloseTo(rimBend(x, 0, z, P()).y, 10);
    }
  });

  it('GLSL<->TS contract: hand-computed values match to 1e-5', () => {
    // d=14 (u=1): lift = 8*1/(1.5) = 5.33333; dir=(1,0); pull = 0.2*lift = 1.06667
    const b = rimBend(14, 0, 0, P());
    expect(b.y).toBeCloseTo(5.33333, 5);
    expect(b.x).toBeCloseTo(14 - 1.06667, 5);
    expect(b.z).toBeCloseTo(0, 6);
  });

  it('bendHeightFor: flat classic half-court at <=2 players, ramps up with the disc', () => {
    expect(bendHeightFor(1)).toBe(0); // nostalgic rectangle stays flat (spec)
    expect(bendHeightFor(2)).toBe(0);
    expect(bendHeightFor(3)).toBeGreaterThan(0); // disc begins to curl
    expect(bendHeightFor(13)).toBeGreaterThan(bendHeightFor(5)); // grows with N
    expect(bendHeightFor(100)).toBeLessThanOrEqual(8); // clamped to full Escher
    expect(bendHeightFor(40)).toBeCloseTo(8); // saturated well before 100
  });

  it('bendNormal is world-up at origin, tilts back toward the hub off-origin', () => {
    const n0 = bendNormal(0, 0, P());
    expect(n0.x).toBeCloseTo(0, 6);
    expect(n0.y).toBeCloseTo(1, 6);
    expect(n0.z).toBeCloseTo(0, 6);
    const n1 = bendNormal(20, 0, P());
    expect(n1.x).toBeLessThan(0);
    expect(n1.y).toBeGreaterThan(0);
    expect(Math.hypot(n1.x, n1.y, n1.z)).toBeCloseTo(1, 6);
  });
});
