import { SERVER_PORT } from '../../../shared/src/constants';
import type { ClientMsg, ServerMsg, SnapshotMsg, LeaderboardEntry } from '../../../shared/src/protocol';
import type { GameMode } from '../../../shared/src/gameMode';

export interface Career {
  points: number;
  dunks: number;
  bestSession: number;
  sessions: number;
  rank: number | null;
}

/** Append the identity token to the WS URL so the server can identify a connection pre-join. */
export function wsUrlWithToken(base: string, token: string): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

/** Build the join message, attaching the stored character only when present. */
export function joinMessage(name: string, token: string, character: object | null): ClientMsg {
  const msg: Extract<ClientMsg, { t: 'join' }> = { t: 'join', name, token };
  // `character` is opaque untrusted localStorage JSON; the join field is typed `Character`,
  // but the server re-sanitizes on receipt (server-authority), so the cast is intentional.
  if (character) (msg as { character?: object }).character = character;
  return msg;
}

export class Net {
  private readonly playerToken = Net.token();
  ws: WebSocket;
  myId: string | null = null;
  room: string | null = null;
  mode: GameMode | null = null;
  career: Career | null = null;
  onSnapshot: ((s: SnapshotMsg) => void) | null = null;
  onWelcome: ((id: string, x: number, y: number) => void) | null = null;
  onIdentity: ((c: Career) => void) | null = null;
  onLeaderboard: ((entries: LeaderboardEntry[]) => void) | null = null;
  onArena: ((combined: number) => void) | null = null;

  constructor() {
    const base =
      new URLSearchParams(location.search).get('server') ??
      `ws://${location.hostname}:${SERVER_PORT}`;
    this.ws = new WebSocket(wsUrlWithToken(base, this.playerToken));
    this.ws.onopen = () => this.requestLeaderboard();
    this.ws.onmessage = (ev) => {
      const msg: ServerMsg = JSON.parse(ev.data);
      if (msg.t === 'welcome') {
        this.myId = msg.id;
        this.room = msg.room;
        this.mode = msg.mode;
        this.onWelcome?.(msg.id, msg.x, msg.y);
      } else if (msg.t === 'identity') {
        this.career = {
          points: msg.points,
          dunks: msg.dunks,
          bestSession: msg.bestSession,
          sessions: msg.sessions,
          rank: msg.rank,
        };
        this.onIdentity?.(this.career);
      } else if (msg.t === 'leaderboard') {
        this.onLeaderboard?.(msg.entries);
      } else if (msg.t === 'snapshot') {
        this.onSnapshot?.(msg);
      } else if (msg.t === 'arena') {
        this.onArena?.(msg.combined);
      }
    };
  }

  /** Stable per-browser identity token (arcade-style, no auth). */
  static token(): string {
    const KEY = 'rimverse-token';
    let t = localStorage.getItem(KEY);
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(KEY, t);
    }
    return t;
  }

  /** Stored character from the creator (A2b). Returns null if absent or unparseable. */
  static character(): object | null {
    const raw = localStorage.getItem('rimverse-character');
    if (!raw) return null;
    try { return JSON.parse(raw) as object; } catch { return null; }
  }

  /** Enter the rimverse with the chosen name + stored character (called on PLAY). */
  join(name: string, room?: string): void {
    const msg = joinMessage(name, this.playerToken, Net.character());
    if (room) (msg as { room?: string }).room = room;
    this.send(msg);
  }

  requestLeaderboard(limit?: number): void {
    this.send(typeof limit === 'number' ? { t: 'getLeaderboard', limit } : { t: 'getLeaderboard' });
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
