import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/game/roomManager';
import { DC_ROOM } from '../../shared/src/dunkConstants';

describe('RoomManager', () => {
  it('first-fits a court until cap, then mints a new instance', () => {
    const rm = new RoomManager();
    const a = rm.findOrCreateRoom('rucker', 'dunkContest');
    expect(a.id).toBe('rucker-1');
    expect(a.world.mode).toBe('dunkContest');
    for (let i = 0; i < DC_ROOM.cap; i++) a.world.addPlayer(`p${i}`, `n${i}`);
    const b = rm.findOrCreateRoom('rucker', 'dunkContest');
    expect(b.id).toBe('rucker-2'); // full → new instance
    const c = rm.findOrCreateRoom('venice', 'dunkContest');
    expect(c.id).toBe('venice-1'); // different court → its own pool
  });
  it('falls back to the first court for an unknown id', () => {
    const rm = new RoomManager();
    expect(rm.findOrCreateRoom('nope', 'dunkContest').id).toBe('rucker-1');
  });
  it('deletes empty rooms on stepAll and routes by id', () => {
    const rm = new RoomManager();
    const r = rm.findOrCreateRoom('rucker', 'dunkContest');
    r.world.addPlayer('p1', 'one');
    expect(rm.get('rucker-1')).toBe(r.world);
    r.world.removePlayer('p1');
    rm.stepAll();
    expect(rm.get('rucker-1')).toBeUndefined();
  });
  it('does NOT reap a freshly created room before its first join (race guard)', () => {
    const rm = new RoomManager();
    const r = rm.findOrCreateRoom('rucker', 'dunkContest');
    rm.stepAll(); // tick fires between findOrCreateRoom and the join handler's addPlayer
    expect(rm.get('rucker-1')).toBe(r.world); // never had players → not reapable
    r.world.addPlayer('p1', 'one');
    rm.stepAll();
    expect(rm.get('rucker-1')).toBe(r.world); // populated → kept
  });
});
