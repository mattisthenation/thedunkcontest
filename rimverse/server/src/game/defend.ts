import { STEAL_RANGE } from '../../../shared/src/constants';
import { blockReachFor } from '../../../shared/src/progression';
import type { PlayerEnt } from './world';

/** Nearest enemy ball-carrier in steal range (not mid-action). */
export function findStealTarget(defender: PlayerEnt, all: PlayerEnt[]): PlayerEnt | null {
  let best: PlayerEnt | null = null;
  let bestD = STEAL_RANGE;
  for (const p of all) {
    if (p === defender || p.ballId === null || p.action) continue;
    const d = Math.hypot(p.pos.x - defender.pos.x, p.pos.y - defender.pos.y);
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Nearest dunker (pre-slam, still action-locked) within block reach. */
export function findBlockTarget(defender: PlayerEnt, all: PlayerEnt[]): PlayerEnt | null {
  const reach = blockReachFor(defender.size, defender.skill);
  let best: PlayerEnt | null = null;
  let bestD = reach;
  for (const p of all) {
    if (p === defender || p.action?.kind !== 'dunk') continue;
    const d = Math.hypot(p.pos.x - defender.pos.x, p.pos.y - defender.pos.y);
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
