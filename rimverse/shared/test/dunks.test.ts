import { describe, it, expect } from 'vitest';
import { DUNKS, pickDunk } from '../src/dunks';
import { mulberry32 } from '../src/rng';

describe('dunk roster', () => {
  it('has six named dunks with anim rows', () => {
    expect(DUNKS.length).toBe(6);
    for (const d of DUNKS) {
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.anim.startsWith('dunk')).toBe(true);
    }
  });

  it('low skill only gets the basic jam; high skill unlocks the flashy set', () => {
    const rng = mulberry32(7);
    const low = new Set<string>();
    const high = new Set<string>();
    for (let i = 0; i < 200; i++) {
      low.add(pickDunk(rng, 0.1, 1.0, 0).name);
      high.add(pickDunk(rng, 1.0, 1.0, 0).name);
    }
    expect(low.size).toBeLessThanOrEqual(2);
    expect(high.size).toBeGreaterThanOrEqual(3);
  });

  it('approach angle biases the pool (side approaches reach windmill)', () => {
    const rng = mulberry32(11);
    const side = new Set<string>();
    for (let i = 0; i < 300; i++) side.add(pickDunk(rng, 1.0, 1.0, 80).name);
    expect(side.has('Windmill')).toBe(true);
  });

  it('is deterministic under a seeded rng and always returns a dunk', () => {
    const a = pickDunk(mulberry32(3), 0.6, 2.5, 30);
    const b = pickDunk(mulberry32(3), 0.6, 2.5, 30);
    expect(a).toEqual(b);
    expect(pickDunk(mulberry32(1), 0, 99, 180)).toBeDefined();
  });

  it('every dunk has a positive, ordered timeline', () => {
    for (const d of DUNKS) {
      expect(d.windupTicks).toBeGreaterThan(0);
      expect(d.ticksToRim).toBeGreaterThan(0);
      expect(d.hangTicks).toBeGreaterThanOrEqual(0);
      expect(d.recoverTicks).toBeGreaterThan(0);
    }
  });

  it('the basic two-hand jam is the quickest, least floaty dunk', () => {
    const basic = DUNKS.find((d) => d.name === 'Two-Hand Jam')!;
    const windmill = DUNKS.find((d) => d.name === 'Windmill')!;
    expect(windmill.ticksToRim + windmill.hangTicks).toBeGreaterThan(basic.ticksToRim + basic.hangTicks);
  });
});
