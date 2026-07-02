import { DC_ZONES, DC_ACCURACY, DC_FIRE, DC_COURT } from '../../../shared/src/dunkConstants';

export interface FireState {
  consecutiveMakes: number;
  fireUntil: number; // sim-seconds; 0 = not on fire
  ignited?: boolean; // true only on the tick fire was first lit
}

export function shotZone(dist: number): 'close' | 'mid' | 'three' | 'heave' {
  if (dist < DC_ZONES.close) return 'close';
  if (dist < DC_ZONES.mid) return 'mid';
  if (dist < DC_ZONES.heave) return 'three';
  return 'heave';
}

/** v3 zone accuracy + on-fire bonus, capped (room.js tryShoot). */
export function shotAccuracy(dist: number, onFire: boolean): number {
  const base = DC_ACCURACY[shotZone(dist)];
  const acc = base + (onFire ? DC_ACCURACY.onFireBonus : 0);
  return Math.min(DC_ACCURACY.max, acc);
}

/** 3 beyond the arc, else 2 (room.js: ball.three ? 3 : 2). */
export function shotPoints(dist: number): 2 | 3 {
  return dist > DC_COURT.threePointRadius ? 3 : 2;
}

export function isOnFire(f: FireState, nowSec: number): boolean {
  return f.fireUntil > nowSec;
}

/** A make: bump streak; ignite on the 3rd consecutive make (only when not already lit). */
export function fireOnMake(f: FireState, nowSec: number): FireState {
  const consecutiveMakes = f.consecutiveMakes + 1;
  if (!isOnFire(f, nowSec) && consecutiveMakes >= DC_FIRE.makesToIgnite) {
    return { consecutiveMakes, fireUntil: nowSec + DC_FIRE.durationMs / 1000, ignited: true };
  }
  return { consecutiveMakes, fireUntil: f.fireUntil, ignited: false };
}

/** A miss: streak → 0 AND fire out (room.js registerMiss). */
export function fireOnMiss(_f: FireState): FireState {
  return { consecutiveMakes: 0, fireUntil: 0 };
}
