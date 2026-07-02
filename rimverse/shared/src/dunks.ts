import { DUNK_RANGE } from './constants';
import type { AnimState } from './types';

export type DunkPool = 'nearFront' | 'nearSide' | 'farFront' | 'farSide';

export interface DunkDef {
  id: number;
  name: string;
  anim: AnimState;
  minSkill: number;
  pools: DunkPool[];
  weight: number;
  // --- V5 timeline (ticks @ 30 Hz). Slam fires at windupTicks + ticksToRim. ---
  windupTicks: number; // crouch/gather before launch
  ticksToRim: number; // T — ticks from launch to the rim (apex); the drama dial
  hangTicks: number; // gravity-frozen ticks at the rim
  recoverTicks: number; // fall + land after the slam
}

/**
 * Roster shaped after NBA Jam TE's DUNKS.ASM: pools keyed by near/far rim
 * distance and approach direction; flashier entries gated by skill (the spec's
 * rule — TE gated via the DUNKS attribute). Names from the spec's list.
 */
export const DUNKS: DunkDef[] = [
  { id: 0, name: 'Two-Hand Jam', anim: 'dunk', minSkill: 0, pools: ['nearFront', 'nearSide', 'farFront', 'farSide'], weight: 3, windupTicks: 4, ticksToRim: 14, hangTicks: 2, recoverTicks: 7 },
  { id: 1, name: 'Tomahawk', anim: 'dunkTomahawk', minSkill: 0.3, pools: ['nearFront', 'farFront', 'nearSide'], weight: 2, windupTicks: 5, ticksToRim: 17, hangTicks: 5, recoverTicks: 7 },
  { id: 2, name: 'Reverse Jam', anim: 'dunkReverse', minSkill: 0.4, pools: ['nearSide', 'nearFront'], weight: 2, windupTicks: 5, ticksToRim: 17, hangTicks: 6, recoverTicks: 7 },
  { id: 3, name: 'Double Pump', anim: 'dunkDoublePump', minSkill: 0.55, pools: ['farFront', 'farSide'], weight: 2, windupTicks: 5, ticksToRim: 19, hangTicks: 8, recoverTicks: 7 },
  { id: 4, name: 'Windmill', anim: 'dunkWindmill', minSkill: 0.7, pools: ['nearSide', 'farSide'], weight: 2, windupTicks: 6, ticksToRim: 20, hangTicks: 9, recoverTicks: 8 },
  { id: 5, name: '360 Slam', anim: 'dunk360', minSkill: 0.85, pools: ['farFront', 'farSide'], weight: 1, windupTicks: 6, ticksToRim: 22, hangTicks: 10, recoverTicks: 8 },
];

/**
 * TE-style selection: distance bucket × approach angle picks the pool, skill
 * gates the candidates, weighted random keeps it surprising.
 * approachDeg: |angle| between the player's facing and the direction to the rim.
 */
export function pickDunk(
  rng: () => number,
  skill: number,
  dist: number,
  approachDeg: number,
): DunkDef {
  const bucket = dist <= DUNK_RANGE * 0.55 ? 'near' : 'far';
  const face = Math.abs(approachDeg) > 40 ? 'Side' : 'Front';
  const pool = (bucket + face) as DunkPool;
  const candidates = DUNKS.filter((d) => d.minSkill <= skill && d.pools.includes(pool));
  if (candidates.length === 0) return DUNKS[0];
  const total = candidates.reduce((s, d) => s + d.weight, 0);
  let roll = rng() * total;
  for (const d of candidates) {
    roll -= d.weight;
    if (roll <= 0) return d;
  }
  return candidates[candidates.length - 1];
}
