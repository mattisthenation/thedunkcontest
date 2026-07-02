import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db';
import { flushSession } from '../src/net';
import { World } from '../src/game/world';
import { DEFAULT_CHARACTER } from '../../shared/src/character';

describe('flushSession', () => {
  it('writes the entity session counters as career deltas', () => {
    const db = openDb(':memory:');
    db.upsertIdentity('tok', 'A', DEFAULT_CHARACTER);
    const w = new World();
    const p = w.addPlayer('id1', 'A');
    p.sessionPoints = 6;
    p.sessionDunks = 2;
    p.peakScore = 8;
    flushSession(db, 'tok', p);
    const row = db.loadPlayer('tok')!;
    expect(row.points).toBe(6);
    expect(row.dunks).toBe(2);
    expect(row.bestSession).toBe(8);
    expect(row.sessions).toBe(1);
    db.close();
  });
});
