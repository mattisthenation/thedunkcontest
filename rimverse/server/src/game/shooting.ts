import { DUNK_TIME, SHOOT_TIME } from '../../../shared/src/constants';
import { accuracy, dunkRangeFor } from '../../../shared/src/progression';
import type { HoopSnap, Vec2 } from '../../../shared/src/types';

/** Skill-aware accuracy curve (shared formula). */
export function makeProbability(dist: number, skill = 0.5): number {
  return accuracy(dist, skill);
}

export function flightDuration(dist: number): number {
  return 0.5 + 0.035 * dist;
}

/** Nearest hoop not owned by the shooter; -1 if none exist. */
export function pickTargetHoop(pos: Vec2, shooterId: string, hoops: HoopSnap[]): number {
  let best = -1;
  let bestD = Infinity;
  for (const h of hoops) {
    if (h.owner === shooterId) continue;
    const d = Math.hypot(pos.x - h.x, pos.y - h.y);
    if (d < bestD) {
      bestD = d;
      best = h.index;
    }
  }
  return best;
}

export function inDunkRange(pos: Vec2, hoop: HoopSnap, skill = 0.5): boolean {
  return Math.hypot(pos.x - hoop.x, pos.y - hoop.y) <= dunkRangeFor(skill);
}

export const ACTION_TIMES = { shoot: SHOOT_TIME, dunk: DUNK_TIME } as const;
