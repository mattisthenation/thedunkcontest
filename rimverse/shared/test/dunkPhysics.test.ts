import { describe, it, expect } from 'vitest';
import { solveLaunchVz, startDunkVert, stepDunkVert, slamTick } from '../src/dunkPhysics';
import { GRAV, DUNK_REACH, TICK_DT } from '../src/constants';
import { DUNKS } from '../src/dunks';

const basic = DUNKS[0];

describe('solveLaunchVz', () => {
  it('reaches the target peak after T seconds under gravity', () => {
    const T = 0.6;
    const vz0 = solveLaunchVz(0, DUNK_REACH, T, GRAV);
    let z = 0;
    let vz = vz0;
    const steps = Math.round(T / TICK_DT);
    for (let i = 0; i < steps; i++) {
      vz -= GRAV * TICK_DT;
      z += vz * TICK_DT;
    }
    expect(z).toBeCloseTo(DUNK_REACH, 1);
  });
});

describe('stepDunkVert', () => {
  it('rises off the floor after launch', () => {
    let s = startDunkVert(basic, GRAV);
    expect(s.z).toBe(0);
    s = stepDunkVert(s, GRAV, TICK_DT);
    expect(s.z).toBeGreaterThan(0);
  });

  it('hangs at the apex for exactly hangTicks before falling', () => {
    const def = DUNKS.find((d) => d.hangTicks >= 5)!;
    let s = startDunkVert(def, GRAV);
    let guard = 0;
    while (s.vz > 0 && guard++ < 1000) s = stepDunkVert(s, GRAV, TICK_DT);
    const apexZ = s.z;
    for (let i = 0; i < def.hangTicks; i++) {
      s = stepDunkVert(s, GRAV, TICK_DT);
      expect(s.z).toBeCloseTo(apexZ, 5);
    }
    s = stepDunkVert(s, GRAV, TICK_DT);
    expect(s.z).toBeLessThan(apexZ);
  });

  it('lands (z=0, landed) and then is idempotent', () => {
    let s = startDunkVert(basic, GRAV);
    let guard = 0;
    while (!s.landed && guard++ < 1000) s = stepDunkVert(s, GRAV, TICK_DT);
    expect(s.landed).toBe(true);
    expect(s.z).toBe(0);
    const again = stepDunkVert(s, GRAV, TICK_DT);
    expect(again).toEqual(s);
  });

  it('is deterministic (parity)', () => {
    const arr = (def = basic) => {
      let s = startDunkVert(def, GRAV);
      const zs: number[] = [];
      for (let i = 0; i < 40; i++) { s = stepDunkVert(s, GRAV, TICK_DT); zs.push(s.z); }
      return zs;
    };
    expect(arr()).toEqual(arr());
  });
});

describe('slamTick', () => {
  it('is windup + ticksToRim', () => {
    expect(slamTick(basic)).toBe(basic.windupTicks + basic.ticksToRim);
  });
});
