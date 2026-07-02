import { describe, it, expect } from 'vitest';
import { TICK_RATE, TICK_DT, ballCount, GRAV, RIM_HEIGHT, DUNK_REACH } from '../src/constants';

describe('constants', () => {
  it('tick math is consistent', () => {
    expect(TICK_DT).toBeCloseTo(1 / TICK_RATE);
  });
  it('ball scarcity: max(1, ceil(N/6))', () => {
    expect(ballCount(1)).toBe(1);
    expect(ballCount(6)).toBe(1);
    expect(ballCount(7)).toBe(2);
    expect(ballCount(100)).toBe(17);
  });
});

describe('dunk physics constants', () => {
  it('defines a positive downward gravity', () => {
    expect(GRAV).toBeGreaterThan(0);
  });
  it('rim height matches the client rim mesh (3.05)', () => {
    expect(RIM_HEIGHT).toBeCloseTo(3.05);
  });
  it('the pelvis reach is below the rim (the rig + arm cover the rest)', () => {
    expect(DUNK_REACH).toBeGreaterThan(0.5);
    expect(DUNK_REACH).toBeLessThan(RIM_HEIGHT);
  });
});
