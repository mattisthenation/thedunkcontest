// test/db.test.js — persistence: upsert, delta accumulation, leaderboard
// ordering, rank, and best_session max semantics.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';

function freshDb() {
  return openDb(':memory:');
}

const stats = (over = {}) => ({
  points: 10, makes: 5, misses: 2, dunks: 3, threes: 1, bestStreak: 4, ...over,
});

test('upsert creates and updates identity', () => {
  const db = freshDb();
  db.upsertPlayer('t1', 'Slam', { jersey: '#ff0000' });
  db.upsertPlayer('t1', 'Slammer', { jersey: '#00ff00' });
  const p = db.getPlayer('t1');
  assert.equal(p.name, 'Slammer');
  assert.equal(p.character.jersey, '#00ff00');
  db.close();
});

test('sessions accumulate; best_session and best_streak are maxes', () => {
  const db = freshDb();
  db.upsertPlayer('t1', 'Slam', {});
  db.recordSession('t1', 12, stats());
  db.recordSession('t1', 8, stats({ points: 6, bestStreak: 2 }));
  const p = db.getPlayer('t1');
  assert.equal(p.points, 16);
  assert.equal(p.dunks, 6);
  assert.equal(p.best_session, 12);
  assert.equal(p.best_streak, 4);
  db.close();
});

test('leaderboard orders by points and ranks correctly', () => {
  const db = freshDb();
  for (const [tok, name, pts] of [['a', 'Ace', 30], ['b', 'Bud', 50], ['c', 'Cal', 10]]) {
    db.upsertPlayer(tok, name, {});
    db.recordSession(tok, pts, stats({ points: pts }));
  }
  const top = db.leaderboard(10);
  assert.deepEqual(top.map((r) => r.name), ['Bud', 'Ace', 'Cal']);
  assert.deepEqual(top.map((r) => r.rank), [1, 2, 3]);
  assert.equal(db.getPlayer('c').rank, 3);
  db.close();
});

test('zero-point players stay off the board', () => {
  const db = freshDb();
  db.upsertPlayer('idle', 'Lurker', {});
  assert.equal(db.leaderboard(10).length, 0);
  db.close();
});
