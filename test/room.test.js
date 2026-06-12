// test/room.test.js — authoritative simulation rules.
// The Room takes injected broadcast/sendTo/now/random, so every rule is
// testable without sockets or timers.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Room, projectileVelocity } from '../src/room.js';
import { COURT, NET, ROOM, BALL_STATE, FIRE, DUNKS } from '../shared/constants.js';

function makeRoom({ random = () => 0.5 } = {}) {
  const events = [];
  const direct = [];
  let nowMs = 100_000;
  const room = new Room('test-1', 'rucker', {
    broadcast: (ev, data) => events.push(data),
    sendTo: (pid, ev, data) => direct.push({ pid, data }),
    now: () => nowMs,
    random,
  });
  return {
    room, events, direct,
    advance(ms) {
      const ticks = Math.round(ms / (1000 / NET.tickRate));
      for (let i = 0; i < ticks; i++) {
        nowMs += 1000 / NET.tickRate;
        room.tick();
      }
    },
    setNow(ms) { nowMs = ms; },
    getNow: () => nowMs,
  };
}

function join(room, id, name = id) {
  return room.join({ id, token: `tok-${id}`, name, character: {} });
}

function give(harness, player) {
  harness.room.ball.pos = { ...player.pos, y: 0.3 };
  harness.room.tryPickup(player.id);
}

test('join/leave lifecycle and roster', () => {
  const h = makeRoom();
  const a = join(h.room, 'a');
  const b = join(h.room, 'b');
  assert.equal(h.room.connectedCount, 2);
  assert.notEqual(a.pid, b.pid);
  h.room.leave('a');
  assert.equal(h.room.connectedCount, 1);
  assert.deepEqual(h.room.roster().map((r) => r.pid), [b.pid]);
});

test('pickup requires proximity; contested pickup is denied', () => {
  const h = makeRoom();
  const a = join(h.room, 'a');
  const b = join(h.room, 'b');

  a.pos = { x: 0, y: 0, z: 0 };
  h.room.ball.pos = { x: 8, y: 0.3, z: 8 };
  h.room.tryPickup('a');
  assert.equal(h.room.ball.carrier, null, 'too far — no possession');
  assert.equal(h.direct.at(-1).data.reason, 'far');

  h.room.ball.pos = { x: 0.5, y: 0.3, z: 0 };
  h.room.tryPickup('a');
  assert.equal(h.room.ball.carrier, 'a');

  b.pos = { x: 0.5, y: 0, z: 0 };
  h.room.tryPickup('b');
  assert.equal(h.room.ball.carrier, 'a', 'second pickup denied — no desync');
  assert.equal(h.direct.at(-1).data.reason, 'taken');
});

test('walk-over magnet pickup grabs a loose ball', () => {
  const h = makeRoom();
  const a = join(h.room, 'a');
  a.pos = { x: 1, y: 0, z: 1 };
  h.room.ball.pos = { x: 1.4, y: 0.3, z: 1 };
  h.advance(100);
  assert.equal(h.room.ball.carrier, 'a');
});

test('shoot without ball is denied', () => {
  const h = makeRoom();
  join(h.room, 'a');
  h.room.tryShoot('a');
  assert.equal(h.direct.at(-1).data.reason, 'noball');
});

test('made shot scores 2 from inside the arc, server-resolved', () => {
  const h = makeRoom({ random: () => 0.01 }); // always under accuracy → make
  const a = join(h.room, 'a');
  a.pos = { x: 0, y: 0, z: -8 }; // 3.8 from rim → close/mid range, inside arc
  give(h, a);
  h.room.tryShoot('a');
  assert.equal(h.room.ball.state, BALL_STATE.flight);

  h.advance(3000);
  assert.equal(a.score, 2);
  const score = h.events.find((e) => e.k === 'score');
  assert.equal(score.points, 2);
  assert.equal(score.kind, 'shot');
  assert.equal(h.room.ball.state, BALL_STATE.free, 'ball checked back in');
});

test('made shot beyond the arc scores 3', () => {
  const h = makeRoom({ random: () => 0.01 });
  const a = join(h.room, 'a');
  a.pos = { x: 0, y: 0, z: -3 }; // 8.8 from rim at z=-11.8 → beyond 6.75 arc
  give(h, a);
  h.room.tryShoot('a');
  h.advance(4000);
  assert.equal(a.score, 3);
  assert.equal(h.events.find((e) => e.k === 'score').kind, 'three');
});

test('missed shot emits miss and resets the streak', () => {
  const h = makeRoom({ random: () => 0.99 }); // always over accuracy → miss
  const a = join(h.room, 'a');
  a.pos = { x: 0, y: 0, z: -8 };
  a.consecutiveMakes = 2;
  give(h, a);
  h.room.tryShoot('a');
  h.advance(5000);
  assert.equal(a.score, 0);
  assert.ok(h.events.find((e) => e.k === 'miss'));
  assert.equal(a.consecutiveMakes, 0);
});

test('dunk requires the dunk zone and scores after choreography', () => {
  const h = makeRoom();
  const a = join(h.room, 'a');

  a.pos = { x: 0, y: 0, z: 0 }; // 11.8 from rim — way out
  give(h, a);
  h.room.tryDunk('a');
  assert.equal(h.direct.at(-1).data.reason, 'far');

  a.pos = { x: 0, y: 0, z: -10 }; // 1.8 from rim — in the zone
  h.room.tryDunk('a');
  assert.equal(h.room.ball.state, BALL_STATE.dunk);
  const start = h.events.find((e) => e.k === 'dunkStart');
  assert.ok(start);
  assert.ok(DUNKS[start.type]);

  h.advance(start.ms + 100);
  assert.equal(a.score, 2);
  assert.equal(a.stats.dunks, 1);
  assert.ok(h.events.find((e) => e.k === 'dunkScore'));
  assert.equal(h.room.ball.state, BALL_STATE.free);
});

test('on-fire ignites after 3 straight makes and boosts dunk pool', () => {
  const h = makeRoom({ random: () => 0.01 });
  const a = join(h.room, 'a');
  for (let i = 0; i < FIRE.makesToIgnite; i++) {
    a.pos = { x: 0, y: 0, z: -8 };
    give(h, a);
    h.room.tryShoot('a');
    h.advance(3000);
  }
  assert.equal(a.consecutiveMakes, 3);
  assert.ok(h.room.isOnFire(a));
  const igniting = h.events.filter((e) => e.k === 'score' && e.ignited);
  assert.equal(igniting.length, 1);

  // Fire expires after its duration.
  h.advance(FIRE.durationMs + 1000);
  assert.ok(!h.room.isOnFire(a));
  assert.ok(h.events.find((e) => e.k === 'fireOut'));
});

test('a miss extinguishes the fire', () => {
  const h = makeRoom({ random: () => 0.01 });
  const a = join(h.room, 'a');
  a.fireUntil = h.getNow() + 60_000;
  a.pos = { x: 0, y: 0, z: -8 };
  give(h, a);
  // Force a miss by making accuracy roll fail.
  h.room.random = () => 0.999;
  h.room.tryShoot('a');
  h.advance(5000);
  assert.ok(!h.room.isOnFire(a));
  assert.equal(h.events.find((e) => e.k === 'miss').fireOut, true);
});

test('movement validation clamps teleports and bounds', () => {
  const h = makeRoom();
  const a = join(h.room, 'a');
  a.pos = { x: 0, y: 0, z: 0 };
  h.advance(50);
  h.room.handleInput('a', { x: 9, y: 0, z: 9, a: 1, f: 1 });
  const moved = Math.hypot(a.pos.x, a.pos.z);
  assert.ok(moved < 1.5, `teleport clamped, moved ${moved.toFixed(2)}`);

  h.room.handleInput('a', { x: 999, y: -5, z: -999, a: 99, f: 0 });
  assert.ok(Math.abs(a.pos.x) <= COURT.boundX);
  assert.ok(Math.abs(a.pos.z) <= COURT.boundZ);
  assert.ok(a.pos.y >= 0);
  assert.equal(a.anim, 0, 'bogus anim code rejected');
});

test('disconnect drops the ball; reconnect within grace restores score', () => {
  const h = makeRoom();
  const a = join(h.room, 'a');
  a.pos = { x: 2, y: 0, z: 2 };
  give(h, a);
  a.score = 12;

  h.room.disconnect('a');
  assert.equal(h.room.ball.state, BALL_STATE.free);
  assert.equal(h.room.ball.carrier, null);
  assert.equal(h.room.connectedCount, 0);

  h.advance(1000);
  const back = h.room.rejoin('a');
  assert.equal(back.score, 12);
  assert.equal(h.room.connectedCount, 1);
});

test('disconnected players are reaped after the grace window', () => {
  const h = makeRoom();
  join(h.room, 'a');
  h.room.disconnect('a');
  h.advance(NET.reconnectGraceMs + 2000);
  assert.equal(h.room.players.size, 0);
});

test('snapshots are compact and AOI-sliced in oversized rooms', () => {
  const h = makeRoom();
  for (let i = 0; i < NET.aoiLimit + 10; i++) {
    const p = join(h.room, `p${i}`);
    p.pos = { x: (i % 10) - 5, y: 0, z: Math.floor(i / 10) * 3 - 5 };
  }
  const snap = h.room.snapshot();
  assert.equal(snap.p.length, NET.aoiLimit + 10);

  const slice = h.room.sliceFor('p0', snap);
  assert.equal(slice.p.length, NET.aoiLimit);
  const me = h.room.players.get('p0');
  assert.ok(slice.p.some((row) => row[0] === me.pid), 'self always included');
});

test('room capacity gate', () => {
  const h = makeRoom();
  for (let i = 0; i < ROOM.cap; i++) join(h.room, `p${i}`);
  assert.equal(h.room.hasSpace(), false);
});

test('projectile lands on target', () => {
  const from = { x: 0, y: 2.4, z: -5 };
  const to = { x: 0, y: 3.05, z: -11.8 };
  const g = 15;
  const v = projectileVelocity(from, to, 2.6, g);
  // Integrate.
  const pos = { ...from };
  const vel = { ...v };
  const dt = 1 / 240;
  let closest = 1e9;
  for (let t = 0; t < 4; t += dt) {
    vel.y -= g * dt;
    pos.x += vel.x * dt; pos.y += vel.y * dt; pos.z += vel.z * dt;
    const d = Math.hypot(pos.x - to.x, pos.y - to.y, pos.z - to.z);
    closest = Math.min(closest, d);
  }
  assert.ok(closest < 0.15, `trajectory passes within ${closest.toFixed(3)} of rim`);
});

test('steal: proximity + cooldown + protection window, server-resolved', () => {
  const h = makeRoom({ random: () => 0.1 }); // under STEAL.chance → success
  const a = join(h.room, 'a');
  const b = join(h.room, 'b');
  a.pos = { x: 0, y: 0, z: 0 };
  give(h, a);

  // Fresh possession is protected.
  b.pos = { x: 0.5, y: 0, z: 0 };
  h.room.trySteal('b');
  assert.equal(h.room.ball.carrier, 'a', 'protected possession survives');
  assert.ok(h.events.some((e) => e.k === 'stealMiss'));

  // After protection + cooldown: too far fails, close succeeds.
  h.advance(2000);
  b.pos = { x: 8, y: 0, z: 8 };
  h.room.trySteal('b');
  assert.equal(h.direct.at(-1).data.reason, 'far');
  b.pos = { x: 0.6, y: 0, z: 0 };
  h.room.trySteal('b');
  assert.equal(h.room.ball.carrier, 'b');
  assert.ok(h.events.some((e) => e.k === 'steal' && e.from === a.pid));
});

test('block: airborne defender near a fresh shot swats it down', () => {
  const h = makeRoom({ random: () => 0.01 }); // shot would be a make
  const a = join(h.room, 'a');
  const d = join(h.room, 'd');
  a.pos = { x: 0, y: 0, z: -8 };
  give(h, a);
  h.room.tryShoot('a');

  // Defender leaps right into the release.
  d.pos = { x: 0, y: 1.2, z: -8.3 };
  h.advance(200);
  const block = h.events.find((e) => e.k === 'block');
  assert.ok(block, 'block event fired');
  assert.equal(block.pid, d.pid);
  assert.equal(h.room.ball.state, BALL_STATE.free);
  assert.ok(h.events.some((e) => e.k === 'miss'), 'shooter charged with the miss');
  h.advance(4000);
  assert.equal(a.score, 0, 'blocked shot never scores');
});

test('turbo dunks deal from the flashy tier; normal dunks stay basic-tier', () => {
  const h = makeRoom();
  const a = join(h.room, 'a');
  a.pos = { x: 0, y: 0, z: -10.5 };
  give(h, a);
  h.room.tryDunk('a', true);
  const start = h.events.find((e) => e.k === 'dunkStart');
  assert.equal(DUNKS[start.type].tier, 1, `turbo dealt ${start.type}`);
  assert.equal(start.turbo, true);

  h.advance(start.ms + 200);
  const h2 = makeRoom();
  const b = join(h2.room, 'b');
  b.pos = { x: 0, y: 0, z: -10.5 };
  h2.room.ball.pos = { ...b.pos, y: 0.3 };
  h2.room.tryPickup('b');
  h2.room.tryDunk('b', false);
  const s2 = h2.events.find((e) => e.k === 'dunkStart');
  assert.equal(DUNKS[s2.type].tier, 0, `normal dealt ${s2.type}`);
});
