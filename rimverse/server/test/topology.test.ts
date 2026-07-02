import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { COURT_HALF_L } from '../../shared/src/constants';

describe('topology-lite', () => {
  it('one player: rectangle with own hoop + free practice hoop', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    expect(p.hoop).toBe(0);
    const hoops = w.hoopSnaps();
    expect(hoops.length).toBe(2);
    expect(hoops[0].owner).toBe('p1');
    expect(hoops[1].owner).toBeNull();
    expect(hoops[0].y).toBe(-COURT_HALF_L);
  });

  it('three players: disc with three owned hoops on the rim', () => {
    const w = new World();
    w.addPlayer('p1', 'a');
    w.addPlayer('p2', 'b');
    w.addPlayer('p3', 'c');
    const hoops = w.hoopSnaps();
    expect(hoops.length).toBe(3);
    expect(new Set(hoops.map((h) => h.owner)).size).toBe(3);
  });

  it('bumps topoVersion on join and leave', () => {
    const w = new World();
    const v0 = w.topoVersion;
    w.addPlayer('a', 'a');
    expect(w.topoVersion).toBeGreaterThan(v0);
    const v1 = w.topoVersion;
    w.removePlayer('a');
    expect(w.topoVersion).toBeGreaterThan(v1);
  });

  it('snapshotFor includes hoops only when asked', () => {
    const w = new World();
    w.addPlayer('a', 'a');
    expect(w.snapshotFor('a', true).hoops).toBeDefined();
    expect(w.snapshotFor('a', false).hoops).toBeUndefined();
  });

  it('leaver frees their slot; hoops recompute', () => {
    const w = new World();
    w.addPlayer('p1', 'a');
    w.addPlayer('p2', 'b');
    w.addPlayer('p3', 'c');
    w.removePlayer('p2');
    const hoops = w.hoopSnaps();
    expect(hoops.length).toBe(2);
    expect(hoops.every((h) => h.owner !== 'p2')).toBe(true);
  });
});
