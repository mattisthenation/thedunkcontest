import type { Vec2 } from './types';

/** v3 full court (shared/constants.js COURT). v3 z (length) → V5 y. */
export const DC_COURT = {
  halfWidth: 10, halfLength: 15, boundX: 9.5, boundZ: 14.5,
  rimHeight: 3.05, rimRadius: 0.45,
  rims: [{ x: 0, y: -12.3 }, { x: 0, y: 12.3 }] as const, // v3 z=∓12.3
  backboardZ: 13, threePointRadius: 6.75,
};
export const DC_ZONES = { dunk: 3.2, close: 5.0, mid: 8.0, heave: 13.0 };
export const DC_ACCURACY = { close: 0.80, mid: 0.62, three: 0.45, heave: 0.18, onFireBonus: 0.18, max: 0.96 };
export const DC_FIRE = { makesToIgnite: 3, durationMs: 45_000 };
export const DC_POINTS = { dunk: 2 };
export const DC_STEAL = { radius: 1.6, chance: 0.4, cooldownMs: 1500, protectMs: 800 };
export const DC_ROOM = { cap: 10 };

/** The two shared rims (no ownership, no N-scaling). */
export function dcHoops(): Vec2[] {
  return DC_COURT.rims.map((r) => ({ x: r.x, y: r.y }));
}

/** Clamp to the v3 court rectangle; non-finite → origin (defense-in-depth, matches geometry.ts). */
export function dcClamp(p: Vec2): Vec2 {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return { x: 0, y: 0 };
  return {
    x: Math.max(-DC_COURT.boundX, Math.min(DC_COURT.boundX, p.x)),
    y: Math.max(-DC_COURT.boundZ, Math.min(DC_COURT.boundZ, p.y)),
  };
}

/** Random spawn inside the court (v3 room.js: x (rand-0.5)*12, z (rand-0.5)*16; always within bounds). */
export function dcSpawn(rng: () => number): Vec2 {
  return dcClamp({ x: (rng() - 0.5) * 12, y: (rng() - 0.5) * 16 });
}

/** v3 dunk takeoff reach: ZONES.dunk(3.2) + (turbo ? 1.3 : 0.5) → 3.7 / 4.5 (room.js tryDunk). */
export function dcDunkReach(turbo: boolean): number {
  return DC_ZONES.dunk + (turbo ? 1.3 : 0.5);
}

/** v3 ball re-spot after a score: immediate, scattered near center (room.js resetBallAfterScore: x (rand-.5)*8, z (rand-.5)*10). */
export function dcRespawnBall(rng: () => number): Vec2 {
  return { x: (rng() - 0.5) * 8, y: (rng() - 0.5) * 10 };
}
