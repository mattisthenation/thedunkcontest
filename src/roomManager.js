// src/roomManager.js — allocates court instances, routes sockets to rooms,
// runs the global tick loop, and tracks perf metrics for /api/status.
//
// Scaling model: each court location spawns instances of ROOM.cap players.
// Broadcast cost is O(roomSize²) per tick, so capping the room caps the
// cost; 100 players ≈ 10 rooms, each costing ~100 messages/tick — trivial.
// A single oversized room degrades gracefully via the AOI slice in Room.

import { Room } from './room.js';
import { NET, ROOM } from '../shared/constants.js';
import { COURTS, COURT_IDS } from '../shared/courts.js';

export class RoomManager {
  constructor(io, { db = null } = {}) {
    this.io = io;
    this.db = db;
    this.rooms = new Map();          // roomId -> Room
    this.sessions = new Map();       // token -> { roomId, playerId, lastSeen }
    this.sockets = new Map();        // socket.id -> { token, roomId, playerId }
    this.nextInstance = new Map();   // courtId -> next instance number
    this.tickTimes = [];             // rolling tick-duration samples (ms)
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => this.tickAll(), 1000 / NET.tickRate);
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
  }

  tickAll() {
    const t0 = process.hrtime.bigint();
    for (const [roomId, room] of this.rooms) {
      if (room.players.size === 0) {
        this.rooms.delete(roomId);
        continue;
      }
      room.tick();
      this.emitSnapshots(room);
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    this.tickTimes.push(ms);
    if (this.tickTimes.length > 600) this.tickTimes.shift();
  }

  emitSnapshots(room) {
    const snap = room.snapshot();
    if (snap.p.length <= NET.aoiLimit) {
      this.io.to(room.id).emit('snap', snap);
      return;
    }
    // Oversized room: per-recipient interest management.
    for (const p of room.players.values()) {
      if (!p.connected || !p.socketId) continue;
      this.io.to(p.socketId).emit('snap', room.sliceFor(p.id, snap));
    }
  }

  // ---- room allocation --------------------------------------------------

  findOrCreateRoom(courtId) {
    if (!COURT_IDS.includes(courtId)) courtId = COURT_IDS[0];
    for (const room of this.rooms.values()) {
      if (room.courtId === courtId && room.hasSpace()) return room;
    }
    const n = (this.nextInstance.get(courtId) || 0) + 1;
    this.nextInstance.set(courtId, n);
    const roomId = `${courtId}-${n}`;
    const room = new Room(roomId, courtId, {
      broadcast: (event, data) => this.io.to(roomId).emit(event, data),
      sendTo: (playerId, event, data) => {
        const p = room.players.get(playerId);
        if (p?.socketId) this.io.to(p.socketId).emit(event, data);
      },
    });
    this.rooms.set(roomId, room);
    return room;
  }

  // ---- socket lifecycle ---------------------------------------------------

  attach(socket) {
    socket.on('hello', (msg, ack) => this.handleHello(socket, msg, ack));
    socket.on('input', (msg) => {
      const link = this.sockets.get(socket.id);
      if (link) this.rooms.get(link.roomId)?.handleInput(link.playerId, msg);
    });
    socket.on('action', (msg) => {
      const link = this.sockets.get(socket.id);
      if (link) this.rooms.get(link.roomId)?.handleAction(link.playerId, msg);
    });
    socket.on('switchCourt', (msg, ack) => {
      this.leaveCurrent(socket, { hard: true });
      this.handleHello(socket, msg, ack);
    });
    socket.on('disconnect', () => this.leaveCurrent(socket, { hard: false }));
  }

  handleHello(socket, msg, ack) {
    if (typeof ack !== 'function') return;
    const token = typeof msg?.token === 'string' ? msg.token.slice(0, 64) : null;
    if (!token) return ack({ error: 'token required' });

    const name = sanitizeName(msg?.name) || 'Baller';
    const character = sanitizeCharacter(msg?.character);
    const courtId = typeof msg?.courtId === 'string' ? msg.courtId : COURT_IDS[0];

    // Reconnect path: same token within grace → restore the same player.
    const session = this.sessions.get(token);
    if (session) {
      const room = this.rooms.get(session.roomId);
      const existing = room?.players.get(session.playerId);
      if (room && existing && !existing.connected &&
          (msg?.courtId == null || room.courtId === courtId)) {
        existing.socketId = socket.id;
        existing.name = name;
        const player = room.rejoin(session.playerId);
        this.sockets.set(socket.id, { token, roomId: room.id, playerId: player.id });
        socket.join(room.id);
        session.lastSeen = Date.now();
        this.db?.upsertPlayer(token, name, character);
        return ack(this.welcome(room, player, { restored: true }));
      }
      this.sessions.delete(token);
    }

    const room = this.findOrCreateRoom(courtId);
    const playerId = `${token}:${room.id}`;
    const player = room.join({ id: playerId, token, name, character });
    player.socketId = socket.id;
    this.sockets.set(socket.id, { token, roomId: room.id, playerId });
    this.sessions.set(token, { roomId: room.id, playerId, lastSeen: Date.now() });
    socket.join(room.id);
    this.db?.upsertPlayer(token, name, character);
    ack(this.welcome(room, player, { restored: false }));
  }

  welcome(room, player, extra) {
    return {
      ...extra,
      pid: player.pid,
      roomId: room.id,
      courtId: room.courtId,
      score: player.score,
      roster: room.roster(),
      snapshot: room.snapshot(),
      courts: COURTS.map((c) => ({
        id: c.id, name: c.name, location: c.location, flag: c.flag, tagline: c.tagline,
      })),
    };
  }

  leaveCurrent(socket, { hard }) {
    const link = this.sockets.get(socket.id);
    if (!link) return;
    this.sockets.delete(socket.id);
    const room = this.rooms.get(link.roomId);
    if (!room) return;
    socket.leave(room.id);
    const player = room.players.get(link.playerId);
    if (player) this.persistStats(player);
    if (hard) {
      room.leave(link.playerId);
      this.sessions.delete(link.token);
    } else {
      room.disconnect(link.playerId);
    }
  }

  // Delta persistence: flush-and-zero so a soft disconnect followed by a
  // reconnect never double-counts when the player finally leaves.
  persistStats(player) {
    if (!this.db || !player) return;
    const s = player.stats;
    if (s.points || s.makes || s.misses) {
      this.db.recordSession(player.token, player.score, s);
    }
    player.stats = { points: 0, makes: 0, misses: 0, dunks: 0, threes: 0, bestStreak: s.bestStreak };
  }

  // Flush every connected player's pending stats — called on graceful
  // shutdown so a deploy restart doesn't drop in-flight session points.
  flushAll() {
    if (!this.db) return;
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) this.persistStats(player);
    }
  }

  status() {
    let players = 0;
    const rooms = [...this.rooms.values()].map((r) => {
      const n = r.connectedCount;
      players += n;
      return { id: r.id, courtId: r.courtId, players: n };
    });
    const sorted = [...this.tickTimes].sort((a, b) => a - b);
    const pct = (p) => sorted.length ? sorted[Math.floor(sorted.length * p)] : 0;
    return {
      players,
      rooms,
      tickMs: {
        p50: round3(pct(0.5)),
        p95: round3(pct(0.95)),
        p99: round3(pct(0.99)),
        max: round3(sorted[sorted.length - 1] ?? 0),
      },
    };
  }
}

function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  return name.replace(/[^\w \-'.]/g, '').trim().slice(0, 16);
}

// The character config is client-generated cosmetics; clamp it to known
// fields so the DB and other clients never see arbitrary payloads.
export function sanitizeCharacter(c) {
  const def = {
    skin: 2, hair: 1, hairColor: 0, jersey: '#e8432e', jersey2: '#f5f0e0',
    shorts: '#e8432e', shoes: '#f5f0e0', number: 23, accessory: 0, build: 1,
  };
  if (typeof c !== 'object' || c === null) return def;
  const num = (v, lo, hi, d) => {
    v = Number(v);
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d;
  };
  const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);
  return {
    skin: num(c.skin, 0, 5, def.skin),
    hair: num(c.hair, 0, 7, def.hair),
    hairColor: num(c.hairColor, 0, 5, def.hairColor),
    jersey: hex(c.jersey, def.jersey),
    jersey2: hex(c.jersey2, def.jersey2),
    shorts: hex(c.shorts, def.shorts),
    shoes: hex(c.shoes, def.shoes),
    number: num(c.number, 0, 99, def.number),
    accessory: num(c.accessory, 0, 4, def.accessory),
    build: num(c.build, 0, 2, def.build),
  };
}

function round3(v) { return Math.round(v * 1000) / 1000; }
