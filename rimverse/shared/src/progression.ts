import { BLOCK_RANGE, DUNK_RANGE, SIZE_MAX, SIZE_MIN } from './constants';

export interface Build {
  size: number;
  skill: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const clampBuild = (b: Build) => {
  b.size = clamp(b.size, SIZE_MIN, SIZE_MAX);
  b.skill = clamp(b.skill, 0, 1);
};

/** Tug-of-war: scoring grows you (slower, juicier target) and skills you up. */
export function applyScore(scorer: Build, victim: Build | null): void {
  scorer.size += 0.04;
  scorer.skill += 0.05;
  clampBuild(scorer);
  if (victim) {
    victim.size -= 0.03;
    victim.skill -= 0.04;
    clampBuild(victim);
  }
}

export function applyBlocked(shooter: Build, blocker: Build): void {
  shooter.size -= 0.02;
  shooter.skill -= 0.03;
  blocker.size += 0.02;
  blocker.skill += 0.03;
  clampBuild(shooter);
  clampBuild(blocker);
}

/** Make probability: distance falloff, skill swing of ±0.15. */
export function accuracy(dist: number, skill: number): number {
  return clamp(0.92 - 0.035 * dist + 0.3 * (skill - 0.5), 0.05, 0.97);
}

export function dunkRangeFor(skill: number): number {
  return DUNK_RANGE * (1 + 0.6 * (skill - 0.5));
}

export function blockReachFor(size: number, skill: number): number {
  return BLOCK_RANGE * (1 + 0.4 * (size - 1) + 0.3 * (skill - 0.5));
}

/** A BIG carrier is an easier steal target — the lead is never safe. */
export function stealChance(att: Build, def: Build): number {
  return clamp(0.45 + 0.4 * (att.skill - def.skill) + 0.2 * (def.size - 1), 0.1, 0.9);
}

export function blockChance(blocker: Build, shooter: Build): number {
  return clamp(0.5 + 0.5 * (blocker.skill - shooter.skill) + 0.3 * (blocker.size - 1), 0.05, 0.9);
}
