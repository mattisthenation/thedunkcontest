import { describe, it, expect } from 'vitest';
import { initialSimState, speedFor, stepPlayer, type SimInput, type SimState } from '../src/sim';
import { R_BASE, R_K, TICK_DT, TURBO_MAX, TURBO_MULT } from '../src/constants';

const run = (state: SimState, input: SimInput, ticks: number, n = 4, size = 1): SimState => {
  for (let i = 0; i < ticks; i++) state = stepPlayer(state, input, TICK_DT, n, size);
  return state;
};

describe('stepPlayer v2', () => {
  it('moves at speedFor(size); bigger is slower', () => {
    expect(speedFor(0.8)).toBeGreaterThan(speedFor(1.3));
    const s = stepPlayer(initialSimState({ x: 0, y: 0 }), { mx: 1, my: 0 }, TICK_DT, 4, 1);
    expect(s.pos.x).toBeCloseTo(speedFor(1) * TICK_DT);
  });

  it('normalizes oversized input vectors', () => {
    const s = stepPlayer(initialSimState({ x: 0, y: 0 }), { mx: 3, my: 4 }, TICK_DT, 4, 1);
    expect(Math.hypot(s.pos.x, s.pos.y)).toBeCloseTo(speedFor(1) * TICK_DT);
  });

  it('turbo multiplies speed and drains the meter', () => {
    const s = stepPlayer(
      initialSimState({ x: 0, y: 0 }),
      { mx: 1, my: 0, turbo: true },
      TICK_DT,
      4,
      1,
    );
    expect(s.pos.x).toBeCloseTo(speedFor(1) * TURBO_MULT * TICK_DT);
    expect(s.turboLeft).toBeLessThan(TURBO_MAX);
  });

  it('meter depletes, cools down, then regenerates', () => {
    let s = run(
      initialSimState({ x: 0, y: 0 }),
      { mx: 0, my: 0, turbo: true },
      Math.ceil((TURBO_MAX / TICK_DT) * 1.2),
    );
    expect(s.turboLeft).toBe(0);
    expect(s.turboCd).toBeGreaterThan(0);
    s = run(s, { mx: 0, my: 0 }, 200); // ~6.7 s: cooldown passes, meter refills
    expect(s.turboLeft).toBeGreaterThan(0.5);
  });

  it('cannot leave the arena', () => {
    let s = initialSimState({ x: 0, y: 0 });
    for (let i = 0; i < 300; i++) s = stepPlayer(s, { mx: 1, my: 0 }, TICK_DT, 3);
    expect(Math.hypot(s.pos.x, s.pos.y)).toBeLessThanOrEqual(R_BASE + R_K * Math.sqrt(3) + 1e-9);
  });

  it('stays finite when handed non-finite input (H1 defense-in-depth)', () => {
    const s = stepPlayer(initialSimState({ x: 0, y: 0 }), { mx: Infinity, my: NaN }, TICK_DT, 4, 1);
    expect(Number.isFinite(s.pos.x)).toBe(true);
    expect(Number.isFinite(s.pos.y)).toBe(true);
  });

  it('is deterministic for prediction parity', () => {
    const inputs = Array.from({ length: 50 }, (_, i) => ({
      mx: Math.sin(i),
      my: Math.cos(i),
      turbo: i % 7 < 3,
    }));
    let a = initialSimState({ x: 1, y: 1 });
    let b = initialSimState({ x: 1, y: 1 });
    for (const inp of inputs) {
      a = stepPlayer(a, inp, TICK_DT, 8, 1.1);
      b = stepPlayer(b, inp, TICK_DT, 8, 1.1);
    }
    expect(a).toEqual(b);
  });
});
