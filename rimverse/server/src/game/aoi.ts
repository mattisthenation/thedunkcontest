import type { PlayerEnt } from './world';

/**
 * Interest set for one viewer: self + anyone attacking the viewer's hoop +
 * all ball carriers (scarce, ≤ ceil(N/6)), then nearest others up to cap.
 */
export function aoiPlayers(viewer: PlayerEnt, all: PlayerEnt[], cap: number): PlayerEnt[] {
  const forced = new Set<PlayerEnt>([viewer]);
  for (const p of all) {
    // anyone attacking the viewer's rim (id-stable across reslots; L3) + all carriers
    if (p.action && p.action.defenderId === viewer.id) forced.add(p);
    if (p.ballId !== null) forced.add(p);
  }
  const rest = all
    .filter((p) => !forced.has(p))
    .map((p) => {
      const d = (p.pos.x - viewer.pos.x) ** 2 + (p.pos.y - viewer.pos.y) ** 2;
      return { p, d: Number.isFinite(d) ? d : Infinity }; // NaN-safe ordering
    })
    .sort((a, b) => a.d - b.d);
  const out = [...forced];
  for (const { p } of rest) {
    if (out.length >= cap) break;
    out.push(p);
  }
  return out;
}
