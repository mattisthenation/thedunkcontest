// net.js — socket transport, snapshot buffering, and the join handshake.
// Snapshots are buffered with arrival timestamps; remotes.js renders the
// world NET.interpDelayMs in the past, interpolating between the two
// snapshots that bracket the render time.

import { NET } from '/shared/constants.js';

export class NetClient {
  constructor() {
    this.socket = window.io({ transports: ['websocket'] });
    this.pid = null;
    this.snapshots = [];          // { at: clientMs, snap }
    this.handlers = new Map();    // event kind -> [fn]
    this.connected = false;
    this.lastInputSent = 0;

    this.socket.on('connect', () => { this.connected = true; this.emitLocal('net', { up: true }); });
    this.socket.on('disconnect', () => { this.connected = false; this.emitLocal('net', { up: false }); });
    this.socket.on('snap', (snap) => {
      this.snapshots.push({ at: performance.now(), snap });
      if (this.snapshots.length > 40) this.snapshots.shift();
    });
    this.socket.on('ev', (ev) => this.emitLocal(ev.k, ev));
  }

  // join/rejoin. Resolves with the welcome payload.
  hello({ token, name, character, courtId }) {
    return new Promise((resolve, reject) => {
      this.socket.emit('hello', { token, name, character, courtId }, (res) => {
        if (!res || res.error) return reject(new Error(res?.error || 'join failed'));
        this.pid = res.pid;
        this.snapshots.length = 0;
        resolve(res);
      });
    });
  }

  switchCourt({ token, name, character, courtId }) {
    return new Promise((resolve, reject) => {
      this.socket.emit('switchCourt', { token, name, character, courtId }, (res) => {
        if (!res || res.error) return reject(new Error(res?.error || 'switch failed'));
        this.pid = res.pid;
        this.snapshots.length = 0;
        resolve(res);
      });
    });
  }

  sendInput(pos, animCode, facing) {
    const now = performance.now();
    if (now - this.lastInputSent < 1000 / NET.inputRate) return;
    this.lastInputSent = now;
    this.socket.emit('input', {
      x: r2(pos.x), y: r2(pos.y), z: r2(pos.z), a: animCode, f: facing,
    });
  }

  sendAction(type) {
    this.socket.emit('action', { type });
  }

  on(kind, fn) {
    if (!this.handlers.has(kind)) this.handlers.set(kind, []);
    this.handlers.get(kind).push(fn);
  }

  emitLocal(kind, data) {
    for (const fn of this.handlers.get(kind) || []) fn(data);
    for (const fn of this.handlers.get('*') || []) fn(kind, data);
  }

  // The two snapshots bracketing (now - interpDelay), for interpolation.
  sampleSnapshots() {
    const renderAt = performance.now() - NET.interpDelayMs;
    const s = this.snapshots;
    if (s.length === 0) return null;
    if (s.length === 1 || s[0].at > renderAt) return { a: s[0], b: s[0], t: 0 };
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].at <= renderAt) {
        const a = s[i];
        const b = s[i + 1] || a;
        const span = b.at - a.at;
        return { a, b, t: span > 0 ? Math.min(1, (renderAt - a.at) / span) : 0 };
      }
    }
    const last = s[s.length - 1];
    return { a: last, b: last, t: 0 };
  }
}

function r2(v) { return Math.round(v * 100) / 100; }
