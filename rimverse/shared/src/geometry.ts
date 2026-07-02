import { COURT_HALF_L, COURT_HALF_W, R_BASE, R_K } from './constants';
import type { Vec2 } from './types';

export function discRadius(n: number): number {
  return R_BASE + R_K * Math.sqrt(Math.max(0, n));
}

/** Rectangle mode below 3 players always has exactly 2 opposed hoops. */
export function hoopCount(n: number): number {
  return n <= 2 ? 2 : n;
}

export function wedgeAngle(i: number, n: number, rot = 0): number {
  return (i * 2 * Math.PI) / n + rot;
}

export function hoopPosition(i: number, n: number, rot = 0): Vec2 {
  if (n <= 2) return { x: 0, y: i === 0 ? -COURT_HALF_L : COURT_HALF_L };
  const a = wedgeAngle(i, n, rot);
  const r = discRadius(n);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

/** Spawn point for the owner of hoop i: 2.5 units inside their rim, toward the hub. */
export function spawnPos(i: number, n: number): Vec2 {
  const h = hoopPosition(i, n);
  if (n <= 2) return { x: h.x, y: h.y - Math.sign(h.y) * 2.5 };
  const r = discRadius(n);
  const f = (r - 2.5) / r;
  return { x: h.x * f, y: h.y * f };
}

export function clampToArena(p: Vec2, n: number): Vec2 {
  // Defense-in-depth: never let a non-finite coordinate propagate into the sim.
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return { x: 0, y: 0 };
  if (n <= 2) {
    return {
      x: Math.max(-COURT_HALF_W, Math.min(COURT_HALF_W, p.x)),
      y: Math.max(-COURT_HALF_L, Math.min(COURT_HALF_L, p.y)),
    };
  }
  const r = discRadius(n);
  const d = Math.hypot(p.x, p.y);
  if (d <= r) return { x: p.x, y: p.y };
  return { x: (p.x / d) * r, y: (p.y / d) * r };
}
