import { describe, it, expect } from 'vitest';
import { shotZone, shotAccuracy, shotPoints, fireOnMake, fireOnMiss, isOnFire, type FireState } from '../src/game/dunkContest';

describe('shot scoring (v3-faithful)', () => {
  it('zones by distance to nearest rim', () => {
    expect(shotZone(3)).toBe('close');   // < 5
    expect(shotZone(7)).toBe('mid');     // < 8
    expect(shotZone(12)).toBe('three');  // < 13
    expect(shotZone(20)).toBe('heave');  // >= 13
  });
  it('accuracy by zone, +0.18 on fire, capped 0.96', () => {
    expect(shotAccuracy(3, false)).toBeCloseTo(0.80);
    expect(shotAccuracy(7, false)).toBeCloseTo(0.62);
    expect(shotAccuracy(3, true)).toBeCloseTo(0.96);   // 0.80 + 0.18 = 0.98 → cap 0.96
    expect(shotAccuracy(7, true)).toBeCloseTo(0.80);   // 0.62 + 0.18
  });
  it('scores 3 beyond the arc, else 2', () => {
    expect(shotPoints(6.74)).toBe(2);
    expect(shotPoints(6.76)).toBe(3);
  });
});

describe('on fire (3 makes → 45s, miss resets + extinguishes)', () => {
  const fresh = (): FireState => ({ consecutiveMakes: 0, fireUntil: 0 });
  it('ignites on the 3rd consecutive make', () => {
    let f = fresh();
    f = fireOnMake(f, 0); expect(f.ignited).toBe(false);
    f = fireOnMake(f, 0); expect(f.ignited).toBe(false);
    f = fireOnMake(f, 0); expect(f.ignited).toBe(true);
    expect(isOnFire(f, 0)).toBe(true);
    expect(isOnFire(f, 46)).toBe(false); // 45s window (seconds) elapsed
  });
  it('a miss zeroes the streak AND extinguishes fire', () => {
    let f = fresh();
    f = fireOnMake(f, 0); f = fireOnMake(f, 0); f = fireOnMake(f, 0);
    expect(isOnFire(f, 1)).toBe(true);
    f = fireOnMiss(f);
    expect(f.consecutiveMakes).toBe(0);
    expect(isOnFire(f, 1)).toBe(false);
  });
  it('does not re-ignite while already on fire', () => {
    let f = fresh();
    f = fireOnMake(f, 0); f = fireOnMake(f, 0); f = fireOnMake(f, 0); // ignited at t=0
    const f2 = fireOnMake(f, 0);
    expect(f2.ignited).toBe(false);
  });
});
