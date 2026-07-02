import { describe, it, expect } from 'vitest';
import { sanitizeIntent, tokenFromReqUrl, identityFor } from '../src/net';
import { openDb } from '../src/db';
import { DEFAULT_CHARACTER } from '../../shared/src/character';
import { RoomManager } from '../src/game/roomManager';

describe('sanitizeIntent (input boundary, H1 + L1)', () => {
  const base = { t: 'intent', seq: 5, mx: 0.5, my: -0.5, grab: true, turbo: true };

  it('accepts a valid intent and coerces flags to booleans', () => {
    const got = sanitizeIntent({ ...base }, 0);
    expect(got).not.toBeNull();
    expect(got!.seq).toBe(5);
    expect(got!.mx).toBeCloseTo(0.5);
    expect(got!.my).toBeCloseTo(-0.5);
    expect(got!.grab).toBe(true);
    expect(got!.turbo).toBe(true);
    expect(got!.shoot).toBe(false);
    expect(got!.defend).toBe(false);
  });

  it('rejects a non-finite seq (L1: NaN/Infinity no longer disables the guard)', () => {
    expect(sanitizeIntent({ ...base, seq: NaN }, 0)).toBeNull();
    expect(sanitizeIntent({ ...base, seq: Infinity }, 0)).toBeNull();
    expect(sanitizeIntent({ ...base, seq: 'x' as unknown as number }, 0)).toBeNull();
  });

  it('rejects a stale/duplicate seq (<= lastQueued)', () => {
    expect(sanitizeIntent({ ...base, seq: 5 }, 5)).toBeNull();
    expect(sanitizeIntent({ ...base, seq: 4 }, 5)).toBeNull();
    expect(sanitizeIntent({ ...base, seq: 6 }, 5)).not.toBeNull();
  });

  it('neutralizes non-finite move components (H1: Infinity/NaN -> bounded)', () => {
    const inf = sanitizeIntent({ ...base, mx: Infinity, my: -Infinity }, 0)!;
    expect(Number.isFinite(inf.mx)).toBe(true);
    expect(Number.isFinite(inf.my)).toBe(true);
    expect(Math.abs(inf.mx)).toBeLessThanOrEqual(1);
    expect(Math.abs(inf.my)).toBeLessThanOrEqual(1);
    const nan = sanitizeIntent({ ...base, mx: NaN, my: NaN }, 0)!;
    expect(nan.mx).toBe(0);
    expect(nan.my).toBe(0);
  });

  it('clamps oversized-but-finite components to [-1,1]', () => {
    const big = sanitizeIntent({ ...base, mx: 1e9, my: -1e9 }, 0)!;
    expect(big.mx).toBe(1);
    expect(big.my).toBe(-1);
  });
});

describe('tokenFromReqUrl', () => {
  it('extracts the token from the connection url', () => {
    expect(tokenFromReqUrl('/?token=abc123')).toBe('abc123');
    expect(tokenFromReqUrl('/?server=x&token=abc')).toBe('abc');
  });
  it('returns null when absent or blank', () => {
    expect(tokenFromReqUrl('/')).toBeNull();
    expect(tokenFromReqUrl('/?token=')).toBeNull();
    expect(tokenFromReqUrl(undefined)).toBeNull();
  });
});

describe('identityFor', () => {
  it('reports persisted career + rank for a known token', () => {
    const db = openDb(':memory:');
    db.upsertIdentity('tok', 'A', DEFAULT_CHARACTER);
    db.recordSession('tok', 8, { points: 6, dunks: 2 });
    const id = identityFor(db, 'tok');
    expect(id).toEqual({ t: 'identity', points: 6, dunks: 2, bestSession: 8, sessions: 1, rank: 1 });
    db.close();
  });
  it('returns zeros + null rank for an unknown token', () => {
    const db = openDb(':memory:');
    expect(identityFor(db, 'ghost')).toEqual({ t: 'identity', points: 0, dunks: 0, bestSession: 0, sessions: 0, rank: null });
    db.close();
  });
});

describe('room routing', () => {
  it('routes a join into the requested court room and reports it', () => {
    const rm = new RoomManager();
    const room = rm.findOrCreateRoom('venice', 'dunkContest');
    const p = room.world.addPlayer('id1', 'A');
    expect(rm.get('venice-1')).toBe(room.world);
    expect(room.world.players.has('id1')).toBe(true);
    expect(room.id).toBe('venice-1');
    expect(room.world.mode).toBe('dunkContest');
  });
});
