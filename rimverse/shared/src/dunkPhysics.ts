import { DUNK_REACH, TICK_DT } from './constants';
import type { DunkDef } from './dunks';

/**
 * Backwards-projectile solve: the launch vertical velocity so that, starting at
 * `startZ` and decelerating under `grav`, height equals `peak` after `T` seconds.
 *   peak = startZ + vz0*T - 0.5*grav*T^2  ⇒  vz0 = (peak-startZ)/T + 0.5*grav*T
 * The `+dt` term corrects for the semi-implicit Euler integration used by the
 * stepper (velocity kicked before position each tick), so the discrete arc lands
 * exactly at `peak` after `round(T/dt)` steps.
 * General form (any target height) so the Universe Collapse dunk can leap from anywhere.
 */
export function solveLaunchVz(startZ: number, peak: number, T: number, grav: number, dt = TICK_DT): number {
  return (peak - startZ) / T + 0.5 * grav * (T + dt);
}

/** Per-tick airborne state. The single source of a dunk's gross vertical motion. */
export interface DunkVert {
  z: number; // height above floor (world units)
  vz: number; // vertical velocity (units/s)
  hangLeft: number; // hang ticks remaining (consumed at the apex)
  landed: boolean;
}

/** Tick (relative to action start) at which the ball slams through the rim. */
export function slamTick(def: DunkDef): number {
  return def.windupTicks + def.ticksToRim;
}

/** Launch: solve vz so the apex (vz≈0) lands ~DUNK_REACH at ~ticksToRim. */
export function startDunkVert(def: DunkDef, grav: number, ticksToSec = 1 / 30): DunkVert {
  const T = def.ticksToRim * ticksToSec;
  return { z: 0, vz: solveLaunchVz(0, DUNK_REACH, T, grav), hangLeft: def.hangTicks, landed: false };
}

/**
 * One tick of the arc. Hang freezes gravity at the apex (the money mechanic):
 * once the body stops rising (vz <= 0) and hang ticks remain, the step holds z.
 */
export function stepDunkVert(s: DunkVert, grav: number, dt: number): DunkVert {
  if (s.landed) return s;
  if (s.vz <= 0 && s.hangLeft > 0) {
    return { z: s.z, vz: 0, hangLeft: s.hangLeft - 1, landed: false }; // HANG: skip gravity
  }
  const vz = s.vz - grav * dt;
  const z = s.z + vz * dt;
  if (z <= 0 && vz < 0) return { z: 0, vz: 0, hangLeft: 0, landed: true };
  return { z, vz, hangLeft: s.hangLeft, landed: false };
}
