// game.js — gameplay orchestration. Local player is simulated locally for
// zero-latency feel (server validates); remote players and the free ball
// render ~110ms in the past via snapshot interpolation; all outcomes
// (possession, scores, dunks, fire) arrive as server events.

import * as THREE from 'three';
import { COURT, PLAYER, ANIM, BALL_STATE, ZONES, nearestRim, dist2D } from '/shared/constants.js';
import { CharacterSprite } from './sprites.js';

export class Game {
  constructor(world, net, hud, fx) {
    this.world = world;
    this.net = net;
    this.hud = hud;
    this.fx = fx;

    this.players = new Map();   // pid -> { sprite, name, score, fire, last:[x,y,z], anim }
    this.myPid = null;
    this.ball = world.makeBall();
    this.ballCarrierPid = -1;
    this.ballLerp = new THREE.Vector3();

    this.local = {
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      facing: 1,
      anim: ANIM.idle,
      carrying: false,
      dunk: null,             // {from, rim, start, ms, type}
      celebrateUntil: 0,
      shootPoseUntil: 0,
    };
    this.keys = {};
    this.bindInput();
    this.bindNet();
  }

  // ---- session ----------------------------------------------------------

  applyWelcome(welcome) {
    this.myPid = welcome.pid;
    for (const { sprite } of this.players.values()) sprite.dispose();
    this.players.clear();
    for (const entry of welcome.roster) this.addPlayer(entry);
    const me = welcome.snapshot.p.find((r) => r[0] === this.myPid);
    if (me) {
      this.local.pos = { x: me[1], y: me[2], z: me[3] };
    }
    this.hud.setRoster(this.players, this.myPid);
  }

  addPlayer(entry) {
    if (this.players.has(entry.pid)) return;
    const sprite = new CharacterSprite(this.world.scene, entry.character || {}, entry.name);
    this.players.set(entry.pid, {
      sprite, name: entry.name, score: entry.score || 0,
      fire: !!entry.onFire, last: null, anim: ANIM.idle,
    });
    sprite.setFire(!!entry.onFire);
  }

  removePlayer(pid) {
    const p = this.players.get(pid);
    if (!p) return;
    p.sprite.dispose();
    this.players.delete(pid);
    this.hud.setRoster(this.players, this.myPid);
  }

  // ---- input ------------------------------------------------------------

  bindInput() {
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyE' || e.code === 'Enter') this.actionButton();
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  actionButton() {
    if (this.local.dunk) return;
    if (this.local.carrying) {
      // Server decides shoot vs dunk; we pose optimistically.
      this.net.sendAction('shoot');
      const { dist } = nearestRim(this.local.pos);
      if (dist > ZONES.dunk) this.local.shootPoseUntil = performance.now() + 450;
    } else {
      this.net.sendAction('pickup');
    }
  }

  // ---- server events ----------------------------------------------------

  bindNet() {
    const net = this.net;
    net.on('join', (ev) => { this.addPlayer(ev.p); this.hud.setRoster(this.players, this.myPid); });
    net.on('leave', (ev) => this.removePlayer(ev.pid));

    net.on('pickup', (ev) => {
      this.ballCarrierPid = ev.pid;
      if (ev.pid === this.myPid) {
        this.local.carrying = true;
        this.hud.announce('YOU GOT THE ROCK', 900, 'minor');
      }
    });

    net.on('shot', (ev) => {
      if (ev.pid === this.myPid) this.local.carrying = false;
      if (this.ballCarrierPid === ev.pid) this.ballCarrierPid = -1;
      // Seed the visual ball at the release point so flight starts clean.
      this.ballLerp.set(ev.from.x, ev.from.y, ev.from.z);
    });

    net.on('dunkStart', (ev) => {
      const rim = COURT.rims[ev.rim];
      if (ev.pid === this.myPid) {
        this.local.dunk = {
          from: { ...this.local.pos }, rim, start: performance.now(), ms: ev.ms, type: ev.type,
        };
      }
      this.fx?.dunkTakeoff(rim);
    });

    net.on('dunkScore', (ev) => {
      const p = this.players.get(ev.pid);
      this.hud.announceDunk(p?.name || '???', ev.label, ev.pid === this.myPid);
      this.fx?.dunkImpact(ev.rim);
    });

    net.on('score', (ev) => {
      const p = this.players.get(ev.pid);
      if (p) { p.score = ev.score; p.fire = ev.fire; p.sprite.setFire(ev.fire); }
      this.hud.setRoster(this.players, this.myPid);
      if (ev.kind !== 'dunk') {
        this.hud.announceScore(p?.name || '???', ev.points, ev.kind, ev.pid === this.myPid);
      }
      if (ev.ignited) this.hud.announce(`${p?.name || '???'} IS ON FIRE!`, 2400, 'fire');
      if (ev.pid === this.myPid) {
        this.local.celebrateUntil = performance.now() + 1100;
        this.local.carrying = false;
      }
      if (ev.kind !== 'dunk') this.fx?.scoreBurst(ev.kind, ev.rim);
    });

    net.on('miss', (ev) => {
      if (ev.pid === this.myPid) this.hud.announce('OFF THE IRON!', 1100, 'minor');
      this.fx?.missClank(ev.rim ?? 0);
      const p = this.players.get(ev.pid);
      if (p && ev.fireOut) { p.fire = false; p.sprite.setFire(false); }
    });

    net.on('fireOut', (ev) => {
      const p = this.players.get(ev.pid);
      if (p) { p.fire = false; p.sprite.setFire(false); }
    });

    net.on('deny', (ev) => {
      if (ev.action === 'pickup' && ev.reason === 'taken') {
        this.hud.announce('TOO SLOW!', 800, 'minor');
      }
      if (ev.reason === 'noball') this.local.carrying = false;
    });

    net.on('ballReset', () => { this.ballCarrierPid = -1; });
  }

  // ---- per-frame update ---------------------------------------------------

  update(dt) {
    this.updateLocal(dt);
    this.updateRemotes(dt);
    this.updateBall(dt);
    this.updateCamera(dt);
    for (const p of this.players.values()) {
      p.sprite.update(dt);
      if (p.fire) this.fx?.fireTrail(p.sprite.pos);
    }
  }

  updateLocal(dt) {
    const L = this.local;
    const now = performance.now();

    if (L.dunk) {
      // Choreographed flight: parabolic arc from takeoff to the rim.
      const t = Math.min(1, (now - L.dunk.start) / L.dunk.ms);
      const flight = Math.min(1, t / 0.82); // reach rim, then hang/land
      const ease = 1 - (1 - flight) * (1 - flight);
      const towardCenter = L.dunk.rim.z > 0 ? -0.7 : 0.7;
      L.pos.x = L.dunk.from.x + (L.dunk.rim.x - L.dunk.from.x) * ease;
      L.pos.z = L.dunk.from.z + (L.dunk.rim.z + towardCenter - L.dunk.from.z) * ease;
      L.pos.y = Math.sin(Math.min(flight, 1) * Math.PI * 0.92) * (L.dunk.rim.y - 0.8);
      L.anim = ANIM.dunk;
      L.facing = (L.dunk.rim.z - L.dunk.from.z) >= 0 ? 1 : -1;
      if (t >= 1) {
        L.pos.y = 0;
        L.dunk = null;
        L.carrying = false;
      }
    } else {
      // Screen-relative movement: camera sits at -x, so screen-right is +z
      // and "up the court" is +x.
      const speed = PLAYER.maxSpeed;
      let vx = 0, vz = 0;
      if (this.keys.KeyW || this.keys.ArrowUp) vx = speed;
      if (this.keys.KeyS || this.keys.ArrowDown) vx = -speed;
      if (this.keys.KeyA || this.keys.ArrowLeft) vz = -speed;
      if (this.keys.KeyD || this.keys.ArrowRight) vz = speed;
      if (vx && vz) { vx *= 0.7071; vz *= 0.7071; }
      L.vel.x = vx; L.vel.z = vz;

      if ((this.keys.Space) && L.pos.y <= 0.01) L.vel.y = PLAYER.jumpVelocity;
      if (L.pos.y > 0 || L.vel.y > 0) L.vel.y += PLAYER.gravity * dt;

      L.pos.x = clamp(L.pos.x + L.vel.x * dt, -COURT.boundX, COURT.boundX);
      L.pos.z = clamp(L.pos.z + L.vel.z * dt, -COURT.boundZ, COURT.boundZ);
      L.pos.y = Math.max(0, L.pos.y + L.vel.y * dt);
      if (L.pos.y === 0) L.vel.y = 0;

      if (vz > 0.1) L.facing = 1;
      else if (vz < -0.1) L.facing = -1;

      const moving = Math.abs(vx) > 0.1 || Math.abs(vz) > 0.1;
      if (now < L.shootPoseUntil) L.anim = ANIM.shoot;
      else if (now < L.celebrateUntil && !moving) L.anim = ANIM.celebrate;
      else if (L.pos.y > 0.05) L.anim = ANIM.jump;
      else if (moving) L.anim = L.carrying ? ANIM.dribble : ANIM.run;
      else L.anim = ANIM.idle;
    }

    const me = this.players.get(this.myPid);
    if (me) {
      me.sprite.setPosition(L.pos.x, L.pos.y, L.pos.z);
      me.sprite.setAnim(L.anim);
      me.sprite.setFacing(L.facing);
    }
    this.net.sendInput(L.pos, L.anim, L.facing);
  }

  updateRemotes() {
    const sample = this.net.sampleSnapshots();
    if (!sample) return;
    const { a, b, t } = sample;

    const rows = new Map();
    for (const row of a.snap.p) rows.set(row[0], { a: row, b: null });
    for (const row of b.snap.p) {
      const e = rows.get(row[0]);
      if (e) e.b = row; else rows.set(row[0], { a: row, b: row });
    }

    for (const [pid, { a: ra, b: rb }] of rows) {
      if (pid === this.myPid) continue;
      const p = this.players.get(pid);
      if (!p) continue;
      const r2 = rb || ra;
      const x = lerp(ra[1], r2[1], t);
      const y = lerp(ra[2], r2[2], t);
      const z = lerp(ra[3], r2[3], t);
      p.sprite.setPosition(x, y, z);
      p.sprite.setAnim(r2[4]);
      p.sprite.setFacing(r2[5]);
      p.sprite.setFire(!!(r2[6] & 1));
      p.last = [x, y, z];
    }

    // Ball authoritative state from the latest snapshot.
    const bs = b.snap.b;
    this.ballCarrierPid = bs[0] === BALL_STATE.carried || bs[0] === BALL_STATE.dunk ? bs[4] : -1;
    if (this.ballCarrierPid === -1) {
      const ba = a.snap.b;
      this.ballLerp.set(lerp(ba[1], bs[1], t), lerp(ba[2], bs[2], t), lerp(ba[3], bs[3], t));
    }
  }

  updateBall(dt) {
    const pid = this.ballCarrierPid;
    if (pid !== -1) {
      let px, py, pz, facing;
      if (pid === this.myPid) {
        ({ x: px, y: py, z: pz } = this.local.pos);
        facing = this.local.facing;
        this.local.carrying = true;
      } else {
        const p = this.players.get(pid);
        if (!p || !p.last) return;
        [px, py, pz] = p.last;
        facing = p.sprite.facing;
      }
      // Dribble bob when the carrier is grounded.
      const bob = py < 0.05 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.55 : 0;
      this.ball.position.set(px, py + 0.7 + bob, pz + facing * 0.55);
      if (pid === this.myPid && !this.local.dunk) this.local.carrying = true;
    } else {
      if (this.local.carrying && !this.local.dunk) this.local.carrying = false;
      this.ball.position.copy(this.ballLerp);
    }
    this.ball.rotation.x += dt * 6;
    this.ball.rotation.z += dt * 3;
  }

  updateCamera(dt) {
    const cam = this.world.camera;
    const L = this.local.pos;
    const k = 1 - Math.exp(-dt * 4);
    cam.position.z += (L.z * 0.72 - cam.position.z) * k;
    cam.position.y += (10 + L.y * 0.25 - cam.position.y) * k;
    cam.lookAt(L.x * 0.25, 1.4, L.z * 0.8);
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
