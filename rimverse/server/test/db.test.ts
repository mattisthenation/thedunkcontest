import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db';
import { DEFAULT_CHARACTER } from '../../shared/src/character';

const fresh = () => openDb(':memory:');

describe('db identity + stats', () => {
  it('creates a player on upsert and loads it back', () => {
    const db = fresh();
    db.upsertIdentity('tok1', 'Ada', DEFAULT_CHARACTER);
    const p = db.loadPlayer('tok1');
    expect(p).not.toBeNull();
    expect(p!.name).toBe('Ada');
    expect(p!.character).toEqual(DEFAULT_CHARACTER);
    expect(p!.points).toBe(0);
    expect(p!.sessions).toBe(0);
    expect(db.loadPlayer('nope')).toBeNull();
    db.close();
  });

  it('upsert updates name/character without resetting stats', () => {
    const db = fresh();
    db.upsertIdentity('t', 'Old', DEFAULT_CHARACTER);
    db.recordSession('t', 14, { points: 8, dunks: 2 });
    const updated = { ...DEFAULT_CHARACTER, skin: 3 };
    db.upsertIdentity('t', 'New', updated);
    const p = db.loadPlayer('t')!;
    expect(p.name).toBe('New');
    expect(p.character).toEqual(updated);
    expect(p.points).toBe(8);
    db.close();
  });

  it('recordSession adds deltas, MAXes bestSession, bumps sessions', () => {
    const db = fresh();
    db.upsertIdentity('t', 'A', DEFAULT_CHARACTER);
    db.recordSession('t', 10, { points: 6, dunks: 1 });
    db.recordSession('t', 4, { points: 2, dunks: 3 });
    const p = db.loadPlayer('t')!;
    expect(p.points).toBe(8);
    expect(p.dunks).toBe(4);
    expect(p.bestSession).toBe(10);
    expect(p.sessions).toBe(2);
    db.close();
  });

  it('leaderboard orders by points then bestSession and hides 0-point players', () => {
    const db = fresh();
    db.upsertIdentity('a', 'A', DEFAULT_CHARACTER); db.recordSession('a', 20, { points: 20, dunks: 5 });
    db.upsertIdentity('b', 'B', DEFAULT_CHARACTER); db.recordSession('b', 30, { points: 20, dunks: 1 });
    db.upsertIdentity('c', 'C', DEFAULT_CHARACTER); db.recordSession('c', 5, { points: 0, dunks: 0 });
    const board = db.leaderboard(10);
    expect(board.map((e) => e.name)).toEqual(['B', 'A']);
    expect(board[0].rank).toBe(1);
    expect(board[0].character).toEqual(DEFAULT_CHARACTER);
    db.close();
  });

  it('playerRank counts players with strictly more points', () => {
    const db = fresh();
    db.upsertIdentity('a', 'A', DEFAULT_CHARACTER); db.recordSession('a', 0, { points: 30, dunks: 0 });
    db.upsertIdentity('b', 'B', DEFAULT_CHARACTER); db.recordSession('b', 0, { points: 10, dunks: 0 });
    expect(db.playerRank('a')).toBe(1);
    expect(db.playerRank('b')).toBe(2);
    db.close();
  });
});

describe('shared-store read-only mode (SP2)', () => {
  const tmp = () => `/tmp/sp2-${process.pid}-${Math.random().toString(36).slice(2)}.db`;

  it('read-only handle: reads work, writes are no-ops (v3 stays sole writer)', () => {
    const file = tmp();
    // seed via a writable handle (stands in for v3 owning the file)
    const w = openDb(file);
    w.upsertIdentity('tok', 'V3Player', { ...DEFAULT_CHARACTER, skin: 3, jersey: '#ff0000' });
    w.recordSession('tok', 12, { points: 12, dunks: 3 });
    w.close();

    // V5 opens read-only
    const r = openDb(file, { readonly: true });
    expect(r.loadPlayer('tok')?.name).toBe('V3Player');         // reads work
    expect(r.loadPlayer('tok')?.points).toBe(12);
    expect(r.leaderboard(5).map((e) => e.name)).toEqual(['V3Player']);
    r.upsertIdentity('tok', 'HACKED', DEFAULT_CHARACTER);        // no-op
    r.recordSession('tok', 99, { points: 99, dunks: 99 });       // no-op
    r.close();

    // the row is untouched by the read-only handle
    const v = openDb(file);
    expect(v.loadPlayer('tok')?.name).toBe('V3Player');
    expect(v.loadPlayer('tok')?.points).toBe(12);
    v.close();
  });

  it('default (writable) mode is unchanged', () => {
    const db = openDb(':memory:');           // no opts → writable
    db.upsertIdentity('t', 'A', DEFAULT_CHARACTER);
    db.recordSession('t', 5, { points: 5, dunks: 0 });
    expect(db.loadPlayer('t')?.points).toBe(5);
    db.close();
  });
});
