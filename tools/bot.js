// tools/bot.js — a headless player: joins, chases the ball, shoots/dunks.
// Used standalone for multiplayer verification and by loadtest.js at scale.

import { io } from 'socket.io-client';
import { COURT, PLAYER, ZONES, ANIM, BALL_STATE, nearestRim, dist2D } from '../shared/constants.js';

export class Bot {
  constructor(url, { name = 'Bot', courtId = 'rucker', token = null, log = () => {} } = {}) {
    this.url = url;
    this.name = name;
    this.courtId = courtId;
    this.token = token || `bot-${Math.random().toString(36).slice(2)}`;
    this.log = log;

    this.pid = null;
    this.pos = { x: 0, y: 0, z: 0 };
    this.carrying = false;
    this.dunkUntil = 0;
    this.ball = { x: 0, y: 0, z: 0, state: 0, carrierPid: -1 };
    this.events = [];           // every server event, for assertions
    this.snapshots = 0;
    this.bytesIn = 0;
    this.score = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.url, { transports: ['websocket'], forceNew: true });
      this.socket.on('connect_error', reject);
      this.socket.onAny((event, data) => {
        this.bytesIn += JSON.stringify(data ?? '').length;
      });
      this.socket.on('snap', (snap) => {
        this.snapshots++;
        this.ball = {
          state: snap.b[0], x: snap.b[1], y: snap.b[2], z: snap.b[3], carrierPid: snap.b[4],
        };
        this.carrying = this.ball.carrierPid === this.pid &&
          (this.ball.state === BALL_STATE.carried || this.ball.state === BALL_STATE.dunk);
        const me = snap.p.find((r) => r[0] === this.pid);
        if (me && this.dunkUntil < Date.now()) {
          // Server may have clamped us; accept its truth.
          this.pos.x = me[1]; this.pos.z = me[3];
        }
      });
      this.socket.on('ev', (ev) => {
        this.events.push(ev);
        if (ev.k === 'score' && ev.pid === this.pid) this.score = ev.score;
        if (ev.k === 'dunkStart' && ev.pid === this.pid) {
          this.dunkUntil = Date.now() + ev.ms;
          const rim = COURT.rims[ev.rim];
          this.pos.x = rim.x; this.pos.z = rim.z; // fly to the rim like a client would
        }
      });
      this.socket.on('connect', () => {
        this.socket.emit('hello', {
          token: this.token, name: this.name, courtId: this.courtId,
          character: { number: Math.floor(Math.random() * 99) },
        }, (res) => {
          if (!res || res.error) return reject(new Error(res?.error || 'hello failed'));
          this.pid = res.pid;
          this.welcome = res;
          const me = res.snapshot.p.find((r) => r[0] === this.pid);
          if (me) this.pos = { x: me[1], y: me[2], z: me[3] };
          resolve(res);
        });
      });
    });
  }

  // One AI step + input send; call at ~15-20Hz.
  step(dt = 0.066) {
    if (Date.now() < this.dunkUntil) return;
    if (this.carrying) {
      const { dist } = nearestRim(this.pos);
      if (dist <= ZONES.dunk - 0.4) {
        this.socket.emit('action', { type: 'dunk', turbo: Math.random() < 0.5 });
      } else if (Math.random() < 0.02) {
        this.socket.emit('action', { type: 'shoot' });
      } else {
        this.seek(nearestRim(this.pos).rim, dt);
      }
    } else if (this.ball.carrierPid === -1) {
      this.seek(this.ball, dt);
      if (dist2D(this.pos, this.ball) < PLAYER.pickupRadius * 0.9) {
        this.socket.emit('action', { type: 'pickup' });
      }
    } else {
      // Defense: chase the ball (≈ the carrier) and swipe at it.
      this.seek(this.ball, dt, 0.8);
      if (dist2D(this.pos, this.ball) < 1.5 && Math.random() < 0.3) {
        this.socket.emit('action', { type: 'steal' });
      }
    }
    this.socket.emit('input', {
      x: r2(this.pos.x), y: 0, z: r2(this.pos.z),
      a: this.carrying ? ANIM.dribble : ANIM.run, f: 1,
    });
  }

  seek(target, dt, speedScale = 1) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const step = Math.min(d, PLAYER.maxSpeed * speedScale * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
  }

  disconnect() {
    this.socket.disconnect();
  }
}

function r2(v) { return Math.round(v * 100) / 100; }
