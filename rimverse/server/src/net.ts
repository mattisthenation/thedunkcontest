import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { ClientMsg, ServerMsg } from '../../shared/src/protocol';
import { MAX_INTENT_BACKLOG, MAX_PLAYERS } from '../../shared/src/constants';
import type { PlayerIntent, PlayerEnt } from './game/world';
import type { World } from './game/world';
import { RoomManager } from './game/roomManager';
import type { Db } from './db';
import { DEFAULT_CHARACTER, deriveRimverseAppearance, sanitizeCharacter } from '../../shared/src/character';
import { DC_ROOM } from '../../shared/src/dunkConstants';

export interface Session {
  id: string;
  ws: WebSocket;
  joined: boolean;
  lastTv: number;
  token?: string;
  world?: World;
}

/** Parse the stable token off the WS connection URL (e.g. ".../?token=abc"). Null if absent/blank. */
export function tokenFromReqUrl(url: string | undefined): string | null {
  if (!url) return null;
  const q = url.indexOf('?');
  if (q < 0) return null;
  const t = new URLSearchParams(url.slice(q + 1)).get('token');
  return t && t.trim() ? t.slice(0, 64) : null;
}

/** Build the identity message for a token from persisted career (zeros + null rank if unknown). */
export function identityFor(db: Db, token: string): Extract<ServerMsg, { t: 'identity' }> {
  const stored = db.loadPlayer(token);
  return {
    t: 'identity',
    points: stored?.points ?? 0,
    dunks: stored?.dunks ?? 0,
    bestSession: stored?.bestSession ?? 0,
    sessions: stored?.sessions ?? 0,
    rank: stored ? db.playerRank(token) : null,
  };
}

export function startNet(
  rooms: RoomManager,
  port: number,
  db: Db,
): { wss: WebSocketServer; sessions: Map<string, Session> } {
  // Tight maxPayload (M1): joins/intents are tiny; reject oversized frames in `ws`
  // before JSON.parse ever allocates them.
  const wss = new WebSocketServer({ port, maxPayload: 4096 });
  const sessions = new Map<string, Session>();

  wss.on('connection', (ws, req) => {
    const id = randomUUID().slice(0, 8);
    const sess: Session = { id, ws, joined: false, lastTv: -1 };
    sessions.set(id, sess);

    // Pre-join lobby data: identify by the connection token so ALL-TIME GREATS + the
    // player's rank are available before they press PLAY (read-only; join still owns spawning).
    const connToken = tokenFromReqUrl(req.url);
    if (connToken) {
      sess.token = connToken;
      send(ws, identityFor(db, connToken));
    }

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.t === 'join' && !sess.joined) {
        let total = 0;
        for (const r of rooms.rooms()) total += r.world.players.size;
        if (total >= MAX_PLAYERS) {
          ws.close(1013, 'server full'); // 1013 = try again later (H3 cap)
          return;
        }
        sess.joined = true;
        const token =
          typeof (msg as { token?: unknown }).token === 'string' && (msg as { token: string }).token
            ? (msg as { token: string }).token.slice(0, 64)
            : randomUUID();
        sess.token = token;
        const name = String(msg.name).slice(0, 16) || 'hooper';
        const stored = db.loadPlayer(token);
        const character = (msg as { character?: unknown }).character
          ? sanitizeCharacter((msg as { character?: unknown }).character)
          : (stored?.character ?? DEFAULT_CHARACTER);
        db.upsertIdentity(token, name, character);
        const courtId = typeof (msg as { room?: unknown }).room === 'string' ? (msg as { room: string }).room : 'rucker';
        const room = rooms.findOrCreateRoom(courtId, 'dunkContest');
        sess.world = room.world;
        const p = room.world.addPlayer(id, name);
        const rim = deriveRimverseAppearance(character);
        p.hue = rim.hue;
        p.accentHue = rim.accentHue;
        send(ws, { t: 'welcome', id, tick: room.world.tick, x: p.pos.x, y: p.pos.y, room: room.id, mode: room.world.mode });
        send(ws, identityFor(db, token));
        console.log(`[net] ${id} joined as ${name} (${room.world.players.size} players in ${room.id})`);
      } else if (msg.t === 'getLeaderboard') {
        const limit = Number((msg as { limit?: unknown }).limit);
        send(ws, {
          t: 'leaderboard',
          entries: db.leaderboard(Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 20),
        });
      } else if (msg.t === 'bots' && sess.joined) {
        const c = Number((msg as { count?: unknown }).count);
        if (Number.isFinite(c)) sess.world?.setBotCount(Math.min(Math.max(0, Math.floor(c)), DC_ROOM.cap));
      } else if (msg.t === 'intent' && sess.joined) {
        const p = sess.world?.players.get(id);
        if (!p) return;
        if (p.pendingIntents.length >= MAX_INTENT_BACKLOG) return; // flood guard
        const lastQueued = p.pendingIntents[p.pendingIntents.length - 1]?.seq ?? p.lastSeq;
        const intent = sanitizeIntent(msg, lastQueued);
        if (intent) p.pendingIntents.push(intent);
      }
    });

    ws.on('close', () => {
      sessions.delete(id);
      if (sess.joined) {
        const p = sess.world?.players.get(id);
        if (p && sess.token) flushSession(db, sess.token, p);
        sess.world?.removePlayer(id);
        console.log(`[net] ${id} left`);
      }
    });
  });

  return { wss, sessions };
}

export function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

/** Coerce an untrusted move component to a finite value in [-1, 1] (0 if junk). */
function clamp01(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < -1 ? -1 : n > 1 ? 1 : n;
}

/**
 * Validate + sanitize an untrusted intent message at the trust boundary.
 * Rejects non-finite/stale seq (H1/L1); neutralizes non-finite move components (H1).
 * Returns null if the message must be dropped.
 */
export function sanitizeIntent(msg: unknown, lastQueued: number): PlayerIntent | null {
  const m = msg as Record<string, unknown>;
  if (!Number.isFinite(m?.seq as number)) return null;
  const seq = m.seq as number;
  if (seq <= lastQueued) return null; // stale or duplicate
  return {
    seq,
    mx: clamp01(m.mx),
    my: clamp01(m.my),
    grab: !!m.grab,
    shoot: !!m.shoot,
    dunk: !!m.dunk,
    turbo: !!m.turbo,
    defend: !!m.defend,
  };
}

/** Flush a finishing connection's session counters into the player's career totals. */
export function flushSession(db: Db, token: string, p: PlayerEnt): void {
  db.recordSession(token, p.peakScore, { points: p.sessionPoints, dunks: p.sessionDunks });
}
