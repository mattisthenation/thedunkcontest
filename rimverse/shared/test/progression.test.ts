import { describe, it, expect } from 'vitest';
import {
  applyScore,
  applyBlocked,
  accuracy,
  dunkRangeFor,
  stealChance,
  blockChance,
} from '../src/progression';
import { SIZE_MAX, SIZE_MIN } from '../src/constants';

describe('progression', () => {
  it('scorer grows and skills up; victim shrinks and skills down, with clamps', () => {
    const scorer = { size: 1, skill: 0.5 };
    const victim = { size: 1, skill: 0.5 };
    applyScore(scorer, victim);
    expect(scorer.size).toBeGreaterThan(1);
    expect(scorer.skill).toBeGreaterThan(0.5);
    expect(victim.size).toBeLessThan(1);
    expect(victim.skill).toBeLessThan(0.5);
    for (let i = 0; i < 100; i++) applyScore(scorer, victim);
    expect(scorer.size).toBeLessThanOrEqual(SIZE_MAX);
    expect(victim.size).toBeGreaterThanOrEqual(SIZE_MIN);
    expect(scorer.skill).toBeLessThanOrEqual(1);
    expect(victim.skill).toBeGreaterThanOrEqual(0);
  });

  it('blocked shooter shrinks; blocker gains a little', () => {
    const shooter = { size: 1, skill: 0.5 };
    const blocker = { size: 1, skill: 0.5 };
    applyBlocked(shooter, blocker);
    expect(shooter.skill).toBeLessThan(0.5);
    expect(blocker.skill).toBeGreaterThan(0.5);
  });

  it('skill raises accuracy and dunk range; matchup odds favor higher skill', () => {
    expect(accuracy(8, 0.9)).toBeGreaterThan(accuracy(8, 0.1));
    expect(dunkRangeFor(0.9)).toBeGreaterThan(dunkRangeFor(0.1));
    expect(stealChance({ size: 1, skill: 0.8 }, { size: 1, skill: 0.2 })).toBeGreaterThan(
      stealChance({ size: 1, skill: 0.2 }, { size: 1, skill: 0.8 }),
    );
    expect(blockChance({ size: 1.2, skill: 0.7 }, { size: 1, skill: 0.5 })).toBeGreaterThan(0.5);
    // everything stays a probability
    expect(stealChance({ size: 1, skill: 1 }, { size: 1, skill: 0 })).toBeLessThanOrEqual(0.9);
    expect(blockChance({ size: 0.8, skill: 0 }, { size: 1.3, skill: 1 })).toBeGreaterThanOrEqual(
      0.05,
    );
  });

  it('big carriers are easier steal targets (the lead is never safe)', () => {
    const thief = { size: 1, skill: 0.5 };
    expect(stealChance(thief, { size: 1.3, skill: 0.5 })).toBeGreaterThan(
      stealChance(thief, { size: 0.8, skill: 0.5 }),
    );
  });
});
