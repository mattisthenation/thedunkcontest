// src/room.js — one court instance. Owns the authoritative simulation:
// ball state machine, possession, shot resolution, dunk choreography,
// scoring, and the on-fire mechanic. Clients only ever *request* actions;
// every outcome is decided here.
//
// Decoupled from socket.io for testability: the room talks to the world
// through two injected callbacks, broadcast(event, data) and
// sendTo(playerId, event, data).

import {
  COURT, NET, ROOM, PLAYER, BALL, ZONES, ACCURACY, FIRE, DUNKS,
  ANIM, BALL_STATE, dist2D, nearestRim,
} from '../shared/constants.js';

const TICK_DT = 1 / NET.tickRate;

export class Room {
  constructor(id, courtId, { broadcast, sendTo, now = () => Date.now(), random = Math.random } = {}) {
    this.id = id;
    this.courtId = courtId;
    this.broadcast = broadcast || (() => {});
    this.sendTo = sendTo || (() => {});
    this.now = now;
    this.random = random;

    this.players = new Map();   // playerId -> player
    this.nextPid = 1;

    this.ball = this.makeBall({ x: 0, y: BALL.radius, z: 0 });
  }

  makeBall(pos) {
    return {
      state: BALL_STATE.free,
      pos: { ...pos },
      vel: { x: 0, y: 0, z: 0 },
      carrier: null,        // playerId
      shooter: null,        // playerId of pending shot/dunk
      willScore: false,
      three: false,
      target: null,         // {x,y,z} aim point (rim center or miss offset)
      rimIndex: 0,
      flightStart: 0,
      prevY: pos.y,
    };
  }

  // ---- membership -------------------------------------------------------

  get connectedCount() {
    let n = 0;
    for (const p of this.players.values()) if (p.connected) n++;
    return n;
  }

  hasSpace() {
    return this.connectedCount < ROOM.cap;
  }

  join(identity) {
    const spawn = {
      x: (this.random() - 0.5) * 12,
      y: 0,
      z: (this.random() - 0.5) * 16,
    };
    const player = {
      id: identity.id,                // session id (stable across reconnects)
      pid: this.nextPid++,            // small wire id, unique per room lifetime
      token: identity.token,
      name: identity.name,
      character: identity.character,
      pos: spawn,
      anim: ANIM.idle,
      facing: 1,
      connected: true,
      disconnectedAt: 0,
      lastInputMs: this.now(),
      noClampUntil: 0,                // movement validation grace (post-dunk)
      dunk: null,                     // {type, rimIndex, until}
      score: 0,
      consecutiveMakes: 0,
      fireUntil: 0,
      stats: { points: 0, dunks: 0, threes: 0, makes: 0, misses: 0, bestStreak: 0 },
    };
    this.players.set(player.id, player);
    this.broadcast('ev', { k: 'join', p: this.rosterEntry(player) });
    return player;
  }

  rejoin(playerId) {
    const p = this.players.get(playerId);
    if (!p) return null;
    p.connected = true;
    p.disconnectedAt = 0;
    p.lastInputMs = this.now();
    this.broadcast('ev', { k: 'join', p: this.rosterEntry(p) });
    return p;
  }

  // Soft leave: keep the player for the reconnect grace window.
  disconnect(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = this.now();
    this.dropBallIfCarrier(playerId);
    this.broadcast('ev', { k: 'leave', pid: p.pid });
  }

  leave(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    this.dropBallIfCarrier(playerId);
    this.players.delete(playerId);
    if (p.connected) this.broadcast('ev', { k: 'leave', pid: p.pid });
  }

  dropBallIfCarrier(playerId) {
    const p = this.players.get(playerId);
    if (this.ball.carrier === playerId) {
      const ball = this.ball;
      ball.state = BALL_STATE.free;
      ball.carrier = null;
      ball.pos = { x: p.pos.x, y: 1, z: p.pos.z };
      ball.vel = { x: 0, y: 0, z: 0 };
    }
    if (p && p.dunk) p.dunk = null;
    if (this.ball.shooter === playerId) this.ball.shooter = null;
  }

  roster() {
    return [...this.players.values()]
      .filter((p) => p.connected)
      .map((p) => this.rosterEntry(p));
  }

  rosterEntry(p) {
    return {
      pid: p.pid,
      name: p.name,
      character: p.character,
      score: p.score,
      onFire: this.isOnFire(p),
    };
  }

  // ---- input ------------------------------------------------------------

  // Movement is client-simulated for feel but server-validated: displacement
  // is capped by max speed (with tolerance), positions are clamped to the
  // court, and everything that *matters* (ball, scoring) ignores client claims.
  handleInput(playerId, msg) {
    const p = this.players.get(playerId);
    if (!p || !p.connected || !msg) return;
    const now = this.now();
    const elapsed = Math.min(250, Math.max(16, now - p.lastInputMs));
    p.lastInputMs = now;

    let x = clampNum(msg.x, -COURT.boundX, COURT.boundX);
    let y = clampNum(msg.y, 0, 4.5);
    let z = clampNum(msg.z, -COURT.boundZ, COURT.boundZ);

    const skipClamp = p.dunk || now < p.noClampUntil;
    if (!skipClamp) {
      const maxDist = PLAYER.maxSpeed * (elapsed / 1000) * 1.8 + 0.3;
      const d = dist2D(p.pos, { x, z });
      if (d > maxDist) {
        const s = maxDist / d;
        x = p.pos.x + (x - p.pos.x) * s;
        z = p.pos.z + (z - p.pos.z) * s;
      }
    }

    p.pos.x = x; p.pos.y = y; p.pos.z = z;
    const anim = msg.a | 0;
    p.anim = anim >= 0 && anim <= 6 ? anim : ANIM.idle;
    p.facing = msg.f === -1 ? -1 : 1;
  }

  handleAction(playerId, action) {
    if (!action || typeof action.type !== 'string') return;
    switch (action.type) {
      case 'pickup': return this.tryPickup(playerId);
      case 'shoot': return this.tryShoot(playerId);
      case 'dunk': return this.tryDunk(playerId);
    }
  }

  deny(playerId, action, reason) {
    this.sendTo(playerId, 'ev', { k: 'deny', action, reason });
  }

  // ---- possession -------------------------------------------------------

  tryPickup(playerId) {
    const p = this.players.get(playerId);
    const ball = this.ball;
    if (!p || !p.connected) return;
    if (ball.state === BALL_STATE.carried) {
      return this.deny(playerId, 'pickup', 'taken');
    }
    if (ball.state === BALL_STATE.dunk) return this.deny(playerId, 'pickup', 'dunk');
    if (ball.pos.y > 2.5) return this.deny(playerId, 'pickup', 'high');
    if (dist2D(p.pos, ball.pos) > PLAYER.pickupRadius) {
      return this.deny(playerId, 'pickup', 'far');
    }
    this.givePossession(p);
  }

  givePossession(p) {
    const ball = this.ball;
    // Grabbing a live shot resolves it as a rebound (no miss penalty for shooter).
    if (ball.state === BALL_STATE.flight) {
      ball.shooter = null;
      ball.willScore = false;
    }
    ball.state = BALL_STATE.carried;
    ball.carrier = p.id;
    ball.vel = { x: 0, y: 0, z: 0 };
    this.broadcast('ev', { k: 'pickup', pid: p.pid });
  }

  // ---- shooting ---------------------------------------------------------

  tryShoot(playerId) {
    const p = this.players.get(playerId);
    const ball = this.ball;
    if (!p || !p.connected) return;
    if (ball.carrier !== playerId) return this.deny(playerId, 'shoot', 'noball');
    if (p.dunk) return;

    // One context button: a shot requested from inside the dunk zone IS a
    // dunk. Server-side, so client and server can never disagree.
    if (nearestRim(p.pos).dist <= ZONES.dunk) return this.tryDunk(playerId);

    const { rim, dist, index } = nearestRim(p.pos);
    const three = dist > COURT.threePointRadius;
    let accuracy;
    if (dist < ZONES.close) accuracy = ACCURACY.close;
    else if (dist < ZONES.mid) accuracy = ACCURACY.mid;
    else if (dist < ZONES.heave) accuracy = ACCURACY.three;
    else accuracy = ACCURACY.heave;
    if (this.isOnFire(p)) accuracy += ACCURACY.onFireBonus;
    accuracy = Math.min(ACCURACY.max, accuracy);

    const willScore = this.random() < accuracy;

    // Aim point: rim center for makes; a rim-lip offset for misses.
    let target = { ...rim };
    if (!willScore) {
      const ang = this.random() * Math.PI * 2;
      const off = 0.45 + this.random() * 0.4;
      target = { x: rim.x + Math.cos(ang) * off, y: rim.y, z: rim.z + Math.sin(ang) * off };
    }

    const release = { x: p.pos.x, y: p.pos.y + 2.4, z: p.pos.z };
    const arc = dist < ZONES.close ? 1.8 : dist < ZONES.mid ? 2.6 : dist < ZONES.heave ? 3.2 : 4.0;
    const vel = projectileVelocity(release, target, arc, Math.abs(BALL.gravity));

    ball.state = BALL_STATE.flight;
    ball.carrier = null;
    ball.shooter = playerId;
    ball.willScore = willScore;
    ball.three = three;
    ball.target = target;
    ball.rimIndex = index;
    ball.pos = release;
    ball.prevY = release.y;
    ball.vel = vel;
    ball.flightStart = this.now();

    this.broadcast('ev', {
      k: 'shot', pid: p.pid, three,
      from: q3(release), vel: q3(vel),
    });
  }

  // ---- dunking ----------------------------------------------------------

  tryDunk(playerId) {
    const p = this.players.get(playerId);
    const ball = this.ball;
    if (!p || !p.connected) return;
    if (ball.carrier !== playerId) return this.deny(playerId, 'dunk', 'noball');
    if (p.dunk) return;

    const { rim, dist, index } = nearestRim(p.pos);
    if (dist > ZONES.dunk + 0.5) return this.deny(playerId, 'dunk', 'far');

    const type = this.pickDunkType(p);
    const ms = DUNKS[type].ms;
    p.dunk = { type, rimIndex: index, until: this.now() + ms };
    ball.state = BALL_STATE.dunk;
    ball.carrier = playerId;
    ball.shooter = playerId;
    ball.rimIndex = index;

    this.broadcast('ev', { k: 'dunkStart', pid: p.pid, type, rim: index, ms });
  }

  pickDunkType(p) {
    const types = Object.keys(DUNKS);
    // On fire unlocks the flashier end of the table more often.
    const pool = this.isOnFire(p) ? types : types.slice(0, 4);
    return pool[Math.floor(this.random() * pool.length)];
  }

  // ---- scoring & fire ---------------------------------------------------

  isOnFire(p) {
    return p.fireUntil > this.now();
  }

  registerMake(p, points, kind) {
    p.score += points;
    p.stats.points += points;
    p.stats.makes += 1;
    if (kind === 'dunk') p.stats.dunks += 1;
    if (kind === 'three') p.stats.threes += 1;
    p.consecutiveMakes += 1;
    p.stats.bestStreak = Math.max(p.stats.bestStreak, p.consecutiveMakes);

    let ignited = false;
    if (!this.isOnFire(p) && p.consecutiveMakes >= FIRE.makesToIgnite) {
      p.fireUntil = this.now() + FIRE.durationMs;
      ignited = true;
    }
    this.broadcast('ev', {
      k: 'score', pid: p.pid, points, kind,
      score: p.score, streak: p.consecutiveMakes,
      fire: this.isOnFire(p), ignited,
    });
  }

  registerMiss(p) {
    p.stats.misses += 1;
    p.consecutiveMakes = 0;
    const wasOnFire = this.isOnFire(p);
    p.fireUntil = 0;
    this.broadcast('ev', { k: 'miss', pid: p.pid, fireOut: wasOnFire });
  }

  // After any score the ball checks in near center court — far from the
  // scorer at the rim, so possession is a race, not a standing-under-the-
  // basket dunk loop.
  resetBallAfterScore() {
    this.ball = this.makeBall({
      x: (this.random() - 0.5) * 8,
      y: 1.2,
      z: (this.random() - 0.5) * 10,
    });
    this.broadcast('ev', { k: 'ballReset', pos: q3(this.ball.pos) });
  }

  // ---- simulation -------------------------------------------------------

  tick() {
    const now = this.now();
    const ball = this.ball;

    // Reap players whose reconnect grace expired.
    for (const p of this.players.values()) {
      if (!p.connected && now - p.disconnectedAt > NET.reconnectGraceMs) {
        this.players.delete(p.id);
      }
      if (p.fireUntil && p.fireUntil <= now && p.connected) {
        p.fireUntil = 0;
        this.broadcast('ev', { k: 'fireOut', pid: p.pid });
      }
    }

    switch (ball.state) {
      case BALL_STATE.carried: {
        const c = this.players.get(ball.carrier);
        if (c) {
          ball.pos.x = c.pos.x + c.facing * 0.5;
          ball.pos.y = c.pos.y + 1.2;
          ball.pos.z = c.pos.z;
        }
        break;
      }
      case BALL_STATE.dunk: {
        const c = this.players.get(ball.carrier);
        if (c) {
          ball.pos.x = c.pos.x + c.facing * 0.4;
          ball.pos.y = c.pos.y + 2.2;
          ball.pos.z = c.pos.z;
          if (c.dunk && now >= c.dunk.until) {
            const rimIndex = c.dunk.rimIndex;
            const label = DUNKS[c.dunk.type].label;
            c.dunk = null;
            c.noClampUntil = now + 800;
            ball.carrier = null;
            ball.shooter = null;
            this.registerMake(c, 2, 'dunk');
            this.broadcast('ev', { k: 'dunkScore', pid: c.pid, label });
            this.resetBallAfterScore();
          }
        } else {
          // Dunker vanished mid-dunk.
          this.ball = this.makeBall({ x: 0, y: BALL.radius, z: 0 });
        }
        break;
      }
      case BALL_STATE.flight:
        this.tickBallPhysics(now);
        break;
      case BALL_STATE.free:
        this.tickBallPhysics(now);
        this.tryMagnetPickup();
        break;
    }
  }

  tickBallPhysics(now) {
    const ball = this.ball;
    ball.prevY = ball.pos.y;
    ball.vel.y += BALL.gravity * TICK_DT;
    ball.pos.x += ball.vel.x * TICK_DT;
    ball.pos.y += ball.vel.y * TICK_DT;
    ball.pos.z += ball.vel.z * TICK_DT;

    if (ball.state === BALL_STATE.flight) {
      const rim = COURT.rims[ball.rimIndex];
      const descending = ball.vel.y < 0;
      const crossedRim = descending && ball.prevY > rim.y && ball.pos.y <= rim.y;

      if (crossedRim) {
        const d = dist2D(ball.pos, rim);
        if (ball.willScore && d < COURT.rimRadius + 0.15) {
          const shooter = this.players.get(ball.shooter);
          ball.state = BALL_STATE.free;
          ball.shooter = null;
          ball.pos = { x: rim.x, y: rim.y - 0.4, z: rim.z };
          ball.vel = { x: 0, y: -2, z: 0 };
          if (shooter) {
            this.registerMake(shooter, ball.three ? 3 : 2, ball.three ? 'three' : 'shot');
            this.resetBallAfterScore();
          }
          return;
        }
        if (d < COURT.rimRadius + 0.6) {
          // Rim out: kick the ball off the iron.
          const ang = Math.atan2(ball.pos.z - rim.z, ball.pos.x - rim.x);
          const kick = 2 + this.random() * 2.5;
          ball.vel.x = Math.cos(ang) * kick;
          ball.vel.z = Math.sin(ang) * kick;
          ball.vel.y = Math.abs(ball.vel.y) * 0.45;
          this.resolveMiss();
          return;
        }
      }

      // Backboard plane.
      if (Math.abs(ball.pos.z) > COURT.backboardZ - BALL.radius &&
          ball.pos.y > 2.6 && ball.pos.y < 5.2 && Math.abs(ball.pos.x) < 1.9) {
        ball.pos.z = Math.sign(ball.pos.z) * (COURT.backboardZ - BALL.radius);
        ball.vel.z *= -0.55;
      }

      if (now - ball.flightStart > BALL.flightTimeoutMs) this.resolveMiss();
    }

    // Ground.
    if (ball.pos.y <= BALL.radius) {
      ball.pos.y = BALL.radius;
      if (ball.state === BALL_STATE.flight) this.resolveMiss();
      if (Math.abs(ball.vel.y) > 1) {
        ball.vel.y = -ball.vel.y * BALL.bounce;
      } else {
        ball.vel.y = 0;
      }
      ball.vel.x *= BALL.groundFriction;
      ball.vel.z *= BALL.groundFriction;
    }

    // Walls.
    if (Math.abs(ball.pos.x) > COURT.halfWidth - BALL.radius) {
      ball.pos.x = Math.sign(ball.pos.x) * (COURT.halfWidth - BALL.radius);
      ball.vel.x *= -0.7;
    }
    if (Math.abs(ball.pos.z) > COURT.halfLength - BALL.radius) {
      ball.pos.z = Math.sign(ball.pos.z) * (COURT.halfLength - BALL.radius);
      ball.vel.z *= -0.7;
    }
  }

  resolveMiss() {
    const ball = this.ball;
    if (ball.state !== BALL_STATE.flight) return;
    ball.state = BALL_STATE.free;
    const shooter = this.players.get(ball.shooter);
    ball.shooter = null;
    if (shooter) this.registerMiss(shooter);
  }

  tryMagnetPickup() {
    const ball = this.ball;
    if (ball.pos.y > 1.5) return;
    for (const p of this.players.values()) {
      if (!p.connected || p.dunk) continue;
      if (dist2D(p.pos, ball.pos) < PLAYER.magnetRadius) {
        this.givePossession(p);
        return;
      }
    }
  }

  // ---- snapshots --------------------------------------------------------

  // Base snapshot of everything; sliceFor() applies AOI when the room is
  // larger than the interest limit.
  snapshot() {
    const ball = this.ball;
    const carrier = ball.carrier ? this.players.get(ball.carrier) : null;
    const players = [];
    for (const p of this.players.values()) {
      if (!p.connected) continue;
      let flags = 0;
      if (this.isOnFire(p)) flags |= 1;
      if (carrier === p) flags |= 2;
      if (p.dunk) flags |= 4;
      players.push([p.pid, q(p.pos.x), q(p.pos.y), q(p.pos.z), p.anim, p.facing, flags]);
    }
    return {
      t: this.now(),
      p: players,
      b: [ball.state, q(ball.pos.x), q(ball.pos.y), q(ball.pos.z), carrier ? carrier.pid : -1],
    };
  }

  // Per-recipient AOI slice: self + ball carrier + nearest others, capped.
  sliceFor(playerId, snap) {
    if (snap.p.length <= NET.aoiLimit) return snap;
    const me = this.players.get(playerId);
    if (!me) return snap;
    const keep = snap.p
      .map((row) => ({
        row,
        d: row[0] === me.pid ? -1 : (row[6] & 2) ? -0.5
          : (row[1] - me.pos.x) ** 2 + (row[3] - me.pos.z) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, NET.aoiLimit)
      .map((e) => e.row);
    return { ...snap, p: keep };
  }
}

// ---- helpers ------------------------------------------------------------

function clampNum(v, lo, hi) {
  v = Number(v);
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function q(v) { return Math.round(v * 100) / 100; }
function q3(v) { return { x: q(v.x), y: q(v.y), z: q(v.z) }; }

// Solve a projectile that leaves `from`, peaks `arc` above the release, and
// lands on `to`.
export function projectileVelocity(from, to, arc, g) {
  const peak = Math.max(from.y, to.y) + arc;
  const vy = Math.sqrt(2 * g * (peak - from.y));
  const tUp = vy / g;
  const tDown = Math.sqrt(2 * Math.max(0.01, peak - to.y) / g);
  const t = tUp + tDown;
  return {
    x: (to.x - from.x) / t,
    y: vy,
    z: (to.z - from.z) / t,
  };
}
