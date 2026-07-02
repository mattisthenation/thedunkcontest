import { describe, it, expect } from 'vitest';
import { aoiPlayers } from '../src/game/aoi';
import { World, type PlayerEnt } from '../src/game/world';

function ring(w: World, count: number): PlayerEnt[] {
  const out: PlayerEnt[] = [];
  for (let i = 0; i < count; i++) {
    const p = w.addPlayer(`p${i}`, `p${i}`);
    const a = (i / count) * Math.PI * 2;
    p.pos = { x: Math.cos(a) * 20, y: Math.sin(a) * 20 };
    out.push(p);
  }
  return out;
}

describe('aoiPlayers', () => {
  it('caps the list and keeps the nearest', () => {
    const w = new World();
    const all = ring(w, 60);
    const viewer = all[0];
    const seen = aoiPlayers(viewer, Array.from(w.players.values()), 28);
    expect(seen.length).toBeLessThanOrEqual(28);
    expect(seen).toContain(viewer);
    // immediate ring neighbours are nearer than the far side
    expect(seen).toContain(all[1]);
    expect(seen).not.toContain(all[30]); // diametrically opposite
  });

  it('does not let a NaN-position player corrupt nearest ordering (H1 blast radius)', () => {
    const w = new World();
    const all = ring(w, 10);
    const viewer = all[0];
    all[5].pos = { x: NaN, y: NaN }; // poisoned distance
    const seen = aoiPlayers(viewer, Array.from(w.players.values()), 4);
    expect(seen).toContain(viewer);
    expect(seen).toContain(all[1]); // true nearest still selected, not displaced by NaN
    expect(seen).toContain(all[9]); // the other adjacent neighbour
    expect(seen.length).toBeLessThanOrEqual(4);
  });

  it('always includes hoop attackers and ball carriers, even when far', () => {
    const w = new World();
    const all = ring(w, 60);
    const viewer = all[0];
    const attacker = all[30];
    attacker.action = { kind: 'dunk', until: 99, targetHoop: viewer.hoop, defenderId: viewer.id };
    const carrier = all[29];
    carrier.ballId = 'b1';
    const seen = aoiPlayers(viewer, Array.from(w.players.values()), 28);
    expect(seen).toContain(attacker);
    expect(seen).toContain(carrier);
  });
});
