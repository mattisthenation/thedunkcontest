# A1 — Identity & Persistence Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give V5 a persistent token-based identity, career stats, and a leaderboard (a TS port of v3's SQLite model), so a player is the same someone across sessions — keeping the existing hue-only character.

**Architecture:** A server-only SQLite layer (`server/src/db.ts`, `better-sqlite3`) holds one `players` table. The client generates a `localStorage` token and sends it in `join`; `net.ts` resolves identity on join (applying the persisted hue to the entity) and flushes per-connection stat deltas to the career on disconnect (simple reconnect model — no live-entity grace). The World stays DB-ignorant: it only accumulates per-entity session counters fed from the server-resolved score path. Leaderboard + the player's rank travel over the existing WebSocket. `shared/` stays dependency-free; `Date.now()`/SQLite live only in `server/`.

**Tech Stack:** TypeScript ESM monorepo (shared/server/client), Vitest (`include: */test/**/*.test.ts`), `ws`, `better-sqlite3`. Branch: `a1-identity`. Spec: `docs/superpowers/specs/2026-06-13-a1-identity-persistence-design.md`.

---

## Conventions
- Single test file from repo root: `npx vitest run <path>` (e.g. `npx vitest run server/test/db.test.ts`). Full suite: `npm test`. Types: `npm run typecheck`.
- Commit messages follow the repo style; every commit ends with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- `*.db` / `*.db-journal` are already gitignored — no `.gitignore` change needed.

## File map
| File | Change |
|---|---|
| `server/package.json` | add `better-sqlite3` dep + `@types/better-sqlite3` dev dep |
| `shared/src/types.ts` | add `Character` interface |
| `shared/src/protocol.ts` | `join.token`; `getLeaderboard`; `identity`/`leaderboard` msgs; `LeaderboardEntry` |
| `server/src/db.ts` | NEW — SQLite layer (port of v3 `db.js`) |
| `server/src/game/balls.ts` | `BallFlight.isDunk` |
| `server/src/game/world.ts` | `PlayerEnt` session counters + increment in score path; set `isDunk` on flights |
| `server/src/net.ts` | `startNet(world, port, db)`; `resolveIdentity`/`flushSession`/`hueFromToken` helpers; join → identity + apply hue; `getLeaderboard` handler; flush on close |
| `server/src/index.ts` | `openDb()` and pass to `startNet` |
| `client/src/net/net.ts` | token gen/store + send in join; `onIdentity`/`onLeaderboard`; store career |
| `client/src/main.ts` | request leaderboard, log career + board (optional HUD line) |
| tests | `server/test/db.test.ts`, `server/test/identity.test.ts`, `server/test/world.test.ts` additions |

---

## Task 1: SQLite persistence layer (`db.ts`)

**Files:** `server/package.json`; Create `server/src/db.ts`; add `Character` to `shared/src/types.ts` + `LeaderboardEntry` to `shared/src/protocol.ts` (needed for db return types); Test `server/test/db.test.ts`.

- [ ] **Step 1: Add the dependency**

Run: `npm install better-sqlite3 -w server && npm install -D @types/better-sqlite3 -w server`
Expected: installs + native build succeeds (macOS has build tools; v3 uses this same dep). Verify `server/package.json` now lists `better-sqlite3` under dependencies.

- [ ] **Step 2: Add shared types these depend on**

In `shared/src/types.ts`, add (A1 keeps it minimal; A2 widens):
```ts
/** Authored character (A1 = hue only; A2 enriches). Stored as JSON, sent on the wire. */
export interface Character {
  hue: number;
}
```
In `shared/src/protocol.ts`, add the wire type (import `Character`):
```ts
import type { BallSnap, GameEvent, HoopSnap, PlayerSnap, Character } from './types';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  dunks: number;
  bestSession: number;
  character: Character | null;
}
```

- [ ] **Step 3: Write the failing test**

Create `server/test/db.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db';

const fresh = () => openDb(':memory:');

describe('db identity + stats', () => {
  it('creates a player on upsert and loads it back', () => {
    const db = fresh();
    db.upsertIdentity('tok1', 'Ada', { hue: 200 });
    const p = db.loadPlayer('tok1');
    expect(p).not.toBeNull();
    expect(p!.name).toBe('Ada');
    expect(p!.character).toEqual({ hue: 200 });
    expect(p!.points).toBe(0);
    expect(p!.sessions).toBe(0);
    expect(db.loadPlayer('nope')).toBeNull();
    db.close();
  });

  it('upsert updates name/character without resetting stats', () => {
    const db = fresh();
    db.upsertIdentity('t', 'Old', { hue: 10 });
    db.recordSession('t', 14, { points: 8, dunks: 2 });
    db.upsertIdentity('t', 'New', { hue: 99 });
    const p = db.loadPlayer('t')!;
    expect(p.name).toBe('New');
    expect(p.character).toEqual({ hue: 99 });
    expect(p.points).toBe(8); // stats survive the identity update
    db.close();
  });

  it('recordSession adds deltas, MAXes bestSession, bumps sessions', () => {
    const db = fresh();
    db.upsertIdentity('t', 'A', { hue: 1 });
    db.recordSession('t', 10, { points: 6, dunks: 1 });
    db.recordSession('t', 4, { points: 2, dunks: 3 }); // lower peak this time
    const p = db.loadPlayer('t')!;
    expect(p.points).toBe(8);
    expect(p.dunks).toBe(4);
    expect(p.bestSession).toBe(10); // MAX(10, 4)
    expect(p.sessions).toBe(2);
    db.close();
  });

  it('leaderboard orders by points then bestSession and hides 0-point players', () => {
    const db = fresh();
    db.upsertIdentity('a', 'A', { hue: 1 }); db.recordSession('a', 20, { points: 20, dunks: 5 });
    db.upsertIdentity('b', 'B', { hue: 2 }); db.recordSession('b', 30, { points: 20, dunks: 1 }); // tie on points, higher bestSession
    db.upsertIdentity('c', 'C', { hue: 3 }); db.recordSession('c', 5, { points: 0, dunks: 0 });  // 0 points → hidden
    const board = db.leaderboard(10);
    expect(board.map((e) => e.name)).toEqual(['B', 'A']); // B first (bestSession tiebreak), C absent
    expect(board[0].rank).toBe(1);
    expect(board[0].character).toEqual({ hue: 2 });
    db.close();
  });

  it('playerRank counts players with strictly more points', () => {
    const db = fresh();
    db.upsertIdentity('a', 'A', { hue: 1 }); db.recordSession('a', 0, { points: 30, dunks: 0 });
    db.upsertIdentity('b', 'B', { hue: 2 }); db.recordSession('b', 0, { points: 10, dunks: 0 });
    expect(db.playerRank('a')).toBe(1);
    expect(db.playerRank('b')).toBe(2);
    db.close();
  });
});
```

- [ ] **Step 4: Run it — expect FAIL**

Run: `npx vitest run server/test/db.test.ts`
Expected: FAIL — `../src/db` not found.

- [ ] **Step 5: Implement `server/src/db.ts`**

```ts
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Character } from '../../shared/src/types';
import type { LeaderboardEntry } from '../../shared/src/protocol';

export interface CareerRow {
  name: string;
  character: Character | null;
  points: number;
  dunks: number;
  bestSession: number;
  sessions: number;
}
export interface SessionDeltas {
  points: number;
  dunks: number;
}
export interface Db {
  loadPlayer(token: string): CareerRow | null;
  upsertIdentity(token: string, name: string, character: Character): void;
  recordSession(token: string, peakScore: number, deltas: SessionDeltas): void;
  leaderboard(limit?: number): LeaderboardEntry[];
  playerRank(token: string): number | null;
  close(): void;
}

function safeParse(s: string): Character | null {
  try { return JSON.parse(s) as Character; } catch { return null; }
}

export function openDb(file?: string): Db {
  const here = dirname(fileURLToPath(import.meta.url));
  const dbPath = file ?? join(here, '..', 'data', 'rimverse.db');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      token        TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      character    TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      last_seen    INTEGER NOT NULL,
      points       INTEGER NOT NULL DEFAULT 0,
      dunks        INTEGER NOT NULL DEFAULT 0,
      best_session INTEGER NOT NULL DEFAULT 0,
      sessions     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_players_points ON players(points DESC);
  `);

  const stmtUpsert = db.prepare(`
    INSERT INTO players (token, name, character, created_at, last_seen)
    VALUES (@token, @name, @character, @now, @now)
    ON CONFLICT(token) DO UPDATE SET name = @name, character = @character, last_seen = @now
  `);
  const stmtRecord = db.prepare(`
    UPDATE players SET
      points = points + @points,
      dunks = dunks + @dunks,
      best_session = MAX(best_session, @peak),
      sessions = sessions + 1,
      last_seen = @now
    WHERE token = @token
  `);
  const stmtTop = db.prepare(`
    SELECT name, points, dunks, best_session AS bestSession, character
    FROM players WHERE points > 0
    ORDER BY points DESC, best_session DESC LIMIT ?
  `);
  const stmtOne = db.prepare(`
    SELECT name, character, points, dunks, best_session AS bestSession, sessions
    FROM players WHERE token = ?
  `);
  const stmtRank = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM players
    WHERE points > (SELECT points FROM players WHERE token = ?)
  `);

  return {
    loadPlayer(token) {
      const r = stmtOne.get(token) as (Omit<CareerRow, 'character'> & { character: string }) | undefined;
      if (!r) return null;
      return { ...r, character: safeParse(r.character) };
    },
    upsertIdentity(token, name, character) {
      stmtUpsert.run({ token, name, character: JSON.stringify(character), now: Date.now() });
    },
    recordSession(token, peakScore, d) {
      stmtRecord.run({ token, points: d.points, dunks: d.dunks, peak: peakScore, now: Date.now() });
    },
    leaderboard(limit = 20) {
      const rows = stmtTop.all(limit) as Array<Omit<LeaderboardEntry, 'rank' | 'character'> & { character: string }>;
      return rows.map((r, i) => ({ rank: i + 1, name: r.name, points: r.points, dunks: r.dunks, bestSession: r.bestSession, character: safeParse(r.character) }));
    },
    playerRank(token) {
      const r = stmtRank.get(token) as { rank: number } | undefined;
      return r?.rank ?? null;
    },
    close() { db.close(); },
  };
}
```

- [ ] **Step 6: Run it — expect PASS + typecheck**

Run: `npx vitest run server/test/db.test.ts` → PASS (5 tests). Then `npm run typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json package-lock.json shared/src/types.ts shared/src/protocol.ts server/src/db.ts server/test/db.test.ts
git commit -m "feat(server): SQLite persistence layer (TS port of v3 db.js)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
(Only add the lockfiles that actually changed.)

---

## Task 2: Protocol messages for identity + leaderboard

**Files:** Modify `shared/src/protocol.ts`. Verified by typecheck (pure type additions — no runtime behavior to unit-test).

- [ ] **Step 1: Add the message types**

In `shared/src/protocol.ts`:

Change the `join` member of `ClientMsg` and add the new client message. **`token` is optional** (the server falls back to a generated token when absent) — this keeps the addition non-breaking, so every intermediate commit typechecks green and old/token-less clients still play:
```ts
export type ClientMsg =
  | { t: 'join'; name: string; token?: string }
  | { t: 'bots'; count: number }
  | { t: 'getLeaderboard'; limit?: number }
  | IntentMsg;
```
Add the two server messages to `ServerMsg`:
```ts
export type ServerMsg =
  | { t: 'welcome'; id: string; tick: number; x: number; y: number }
  | { t: 'identity'; points: number; dunks: number; bestSession: number; sessions: number; rank: number | null }
  | { t: 'leaderboard'; entries: LeaderboardEntry[] }
  | SnapshotMsg;
```
(`LeaderboardEntry` and the `Character` import were added in Task 1.)

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: **clean.** The additions are non-breaking — `token` is optional (existing `join` sends still typecheck), and `identity`/`leaderboard`/`getLeaderboard` are additive union members (existing code simply doesn't produce/handle them yet, which is valid). Run `npm test` too — still green.

- [ ] **Step 3: Commit**

```bash
git add shared/src/protocol.ts
git commit -m "feat(shared): identity + leaderboard wire messages; join carries token

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Per-connection session counters in the World

**Files:** `server/src/game/balls.ts`; `server/src/game/world.ts`; Test `server/test/world.test.ts`.

- [ ] **Step 1: Write the failing test**

Add to `server/test/world.test.ts` (the `setupDunker` helper and `actionIntent` already exist in this file):
```ts
describe('A1 session counters', () => {
  it('a made dunk increments sessionPoints and sessionDunks; peakScore tracks max', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.skill = 1;
    p.pos = { x: 0, y: 0 };
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 2 };
    p.dir = { x: 0, y: Math.sign(hoop.y - p.pos.y) };
    expect(p.sessionPoints).toBe(0);
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    for (let i = 0; i < 60; i++) w.step();
    expect(p.sessionPoints).toBe(2);
    expect(p.sessionDunks).toBe(1);
    expect(p.peakScore).toBeGreaterThanOrEqual(2);
  });

  it('a made jump shot increments sessionPoints only (not dunks)', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pos = { x: 0, y: 0 };
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 6 }; // out of dunk range → shot
    w.rng = () => 0; // force the shot to be made
    p.pendingIntents.push(actionIntent(2, { shoot: true }));
    w.step();
    for (let i = 0; i < 60; i++) w.step();
    expect(p.sessionPoints).toBe(2);
    expect(p.sessionDunks).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run server/test/world.test.ts`
Expected: FAIL — `sessionPoints`/`sessionDunks`/`peakScore` undefined.

- [ ] **Step 3: Implement**

In `server/src/game/balls.ts`, add `isDunk` to `BallFlight`:
```ts
export interface BallFlight {
  from: Vec2;
  to: Vec2;
  start: number;
  duration: number;
  made: boolean;
  isDunk: boolean; // true = the slam-release flight; drives the career dunk counter
  targetHoop: number;
  shooter: string;
  defenderId: string | null;
}
```

In `server/src/game/world.ts`:

(a) Add counters to `PlayerEnt` (after `score: number;`):
```ts
  score: number;
  sessionPoints: number; // monotonic points scored this connection (career delta)
  sessionDunks: number; // made dunks this connection
  peakScore: number; // highest live score reached this connection
```
(b) Initialize them in `addPlayer` (after `score: 0,`):
```ts
      score: 0,
      sessionPoints: 0,
      sessionDunks: 0,
      peakScore: 0,
```
(c) In `startShoot`, the `ball.flight = { ... }` object: add `isDunk: false,` (e.g. right after `made,`).

(d) In the dunk slam-release inside `tickFlightsAndActions` (the `ball.flight = { ... }` with `duration: 0.18`): add `isDunk: true,`.

(e) In `tickFlightsAndActions`, the made-shot branch where `shooter.score += 2;` — extend it:
```ts
          if (shooter) {
            shooter.score += 2;
            shooter.sessionPoints += 2;
            shooter.peakScore = Math.max(shooter.peakScore, shooter.score);
            if (f.isDunk) shooter.sessionDunks += 1;
            applyScore(shooter, victim);
            if (shooter.action?.kind !== 'dunk') {
              shooter.action = { kind: 'celebrate', until: this.time + 0.8, targetHoop: f.targetHoop };
              shooter.anim = 'celebrate';
            }
          }
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run server/test/world.test.ts` → PASS (existing + 2 new). Then `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/balls.ts server/src/game/world.ts server/test/world.test.ts
git commit -m "feat(server): per-connection session counters (points/dunks/peak)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Identity helpers (`resolveIdentity`, `flushSession`, `hueFromToken`)

**Files:** `server/src/net.ts` (add exported helpers); Test `server/test/identity.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `server/test/identity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db';
import { resolveIdentity, flushSession, hueFromToken } from '../src/net';
import { World } from '../src/game/world';

describe('resolveIdentity', () => {
  it('creates a record on first sight, then loads the same one', () => {
    const db = openDb(':memory:');
    const first = resolveIdentity(db, 'tok', 'Ada');
    expect(first.name).toBe('Ada');
    expect(first.character).toEqual({ hue: hueFromToken('tok') });
    expect(first.points).toBe(0);
    // second call loads the persisted record (keeps stored name even if a new one is passed)
    db.recordSession('tok', 9, { points: 4, dunks: 1 });
    const second = resolveIdentity(db, 'tok', 'Ignored');
    expect(second.name).toBe('Ada');
    expect(second.points).toBe(4);
    db.close();
  });
});

describe('hueFromToken', () => {
  it('is deterministic and in [0,360)', () => {
    expect(hueFromToken('abc')).toBe(hueFromToken('abc'));
    const h = hueFromToken('xyz');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
});

describe('flushSession', () => {
  it('writes the entity session counters as career deltas', () => {
    const db = openDb(':memory:');
    resolveIdentity(db, 'tok', 'A');
    const w = new World();
    const p = w.addPlayer('id1', 'A');
    p.sessionPoints = 6;
    p.sessionDunks = 2;
    p.peakScore = 8;
    flushSession(db, 'tok', p);
    const row = db.loadPlayer('tok')!;
    expect(row.points).toBe(6);
    expect(row.dunks).toBe(2);
    expect(row.bestSession).toBe(8);
    expect(row.sessions).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run server/test/identity.test.ts`
Expected: FAIL — `resolveIdentity`/`flushSession`/`hueFromToken` not exported.

- [ ] **Step 3: Implement the helpers in `server/src/net.ts`**

Add imports at the top:
```ts
import type { Db, CareerRow } from './db';
import type { PlayerEnt } from './game/world';
```
(Adjust the existing `import { World, type PlayerIntent } from './game/world';` to also bring `type PlayerEnt` if not already, or add the separate import above.)

Add the exported helpers (e.g. below `sanitizeIntent`):
```ts
/** Stable hue (0..359) derived from the identity token — same formula spirit as addPlayer's id hash. */
export function hueFromToken(token: string): number {
  let sum = 0;
  for (const c of token) sum += c.charCodeAt(0);
  return (sum * 37) % 360;
}

/** Load the player's career by token, creating it (with a token-derived hue) on first sight. */
export function resolveIdentity(db: Db, token: string, name: string): CareerRow {
  const existing = db.loadPlayer(token);
  if (existing) return existing;
  db.upsertIdentity(token, name, { hue: hueFromToken(token) });
  return db.loadPlayer(token)!; // now exists with zeroed stats
}

/** Flush a finishing connection's session counters into the player's career totals. */
export function flushSession(db: Db, token: string, p: PlayerEnt): void {
  db.recordSession(token, p.peakScore, { points: p.sessionPoints, dunks: p.sessionDunks });
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run server/test/identity.test.ts` → PASS. `npm run typecheck` → clean (the helpers are additive; `startNet` keeps its 2-arg signature until Task 5).

- [ ] **Step 5: Commit**

```bash
git add server/src/net.ts server/test/identity.test.ts
git commit -m "feat(server): resolveIdentity/flushSession/hueFromToken identity helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire identity into the WS server

**Files:** `server/src/net.ts` (startNet signature + handlers); `server/src/index.ts`. Verified by typecheck + the full suite staying green (the logic is covered by Task 4's helper tests; this task is wiring).

- [ ] **Step 1: Implement the wiring**

In `server/src/net.ts`:

(a) Add `token?: string` to the `Session` interface:
```ts
export interface Session {
  id: string;
  ws: WebSocket;
  joined: boolean;
  lastTv: number;
  token?: string;
}
```
(b) Change `startNet` to accept the db:
```ts
export function startNet(
  world: World,
  port: number,
  db: Db,
): { wss: WebSocketServer; sessions: Map<string, Session> } {
```
(c) In the `join` branch, replace the body with token resolution + identity send:
```ts
      if (msg.t === 'join' && !sess.joined) {
        if (world.players.size >= MAX_PLAYERS) {
          ws.close(1013, 'server full');
          return;
        }
        sess.joined = true;
        const token = typeof (msg as { token?: unknown }).token === 'string' && (msg as { token: string }).token
          ? (msg as { token: string }).token.slice(0, 64)
          : randomUUID();
        sess.token = token;
        const name = String(msg.name).slice(0, 16) || 'hooper';
        const career = resolveIdentity(db, token, name);
        const p = world.addPlayer(id, career.name);
        if (career.character) p.hue = career.character.hue; // persisted appearance
        send(ws, { t: 'welcome', id, tick: world.tick, x: p.pos.x, y: p.pos.y });
        send(ws, {
          t: 'identity',
          points: career.points,
          dunks: career.dunks,
          bestSession: career.bestSession,
          sessions: career.sessions,
          rank: db.playerRank(token),
        });
        console.log(`[net] ${id} joined as ${career.name} (${world.players.size} players)`);
      } else if (msg.t === 'getLeaderboard' && sess.joined) {
        const limit = Number((msg as { limit?: unknown }).limit);
        send(ws, { t: 'leaderboard', entries: db.leaderboard(Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 20) });
      } else if (msg.t === 'bots' && sess.joined) {
```
(keep the rest of the `bots`/`intent` branches as they were).

(d) In the `close` handler, flush before removing:
```ts
    ws.on('close', () => {
      sessions.delete(id);
      if (sess.joined) {
        const p = world.players.get(id);
        if (p && sess.token) flushSession(db, sess.token, p);
        world.removePlayer(id);
        console.log(`[net] ${id} left (${world.players.size} players)`);
      }
    });
```
(e) Add the `Db` import: `import type { Db } from './db';` (if not already from Task 4).

In `server/src/index.ts`:
```ts
import { SERVER_PORT, SNAPSHOT_EVERY, TICK_RATE } from '../../shared/src/constants';
import { World } from './game/world';
import { send, startNet } from './net';
import { openDb } from './db';

const world = new World();
const db = openDb();
const { sessions } = startNet(world, SERVER_PORT, db);
```
(rest of `index.ts` unchanged).

- [ ] **Step 2: Verify**

Run: `npm run typecheck` → clean now on the server side (join carries token; new messages handled). Then `npm test` → all green (existing 125 + Task 1/3/4 additions; nothing references the old `startNet(world, port)` 2-arg form except `index.ts`, now updated — grep to be sure: `grep -rn "startNet(" server`).

- [ ] **Step 3: Commit**

```bash
git add server/src/net.ts server/src/index.ts
git commit -m "feat(server): wire token identity + leaderboard into the WS server

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Client token + identity/leaderboard wiring (no UI)

**Files:** `client/src/net/net.ts`; `client/src/main.ts`. Verified by typecheck + the live gate (Task 7).

- [ ] **Step 1: Implement client net changes**

In `client/src/net/net.ts`, replace the class with token + identity/leaderboard handling:
```ts
import { SERVER_PORT } from '../../../shared/src/constants';
import type { ClientMsg, ServerMsg, SnapshotMsg, LeaderboardEntry } from '../../../shared/src/protocol';

export interface Career {
  points: number;
  dunks: number;
  bestSession: number;
  sessions: number;
  rank: number | null;
}

export class Net {
  ws: WebSocket;
  myId: string | null = null;
  career: Career | null = null;
  onSnapshot: ((s: SnapshotMsg) => void) | null = null;
  onWelcome: ((id: string, x: number, y: number) => void) | null = null;
  onIdentity: ((c: Career) => void) | null = null;
  onLeaderboard: ((entries: LeaderboardEntry[]) => void) | null = null;

  constructor(name: string) {
    const url =
      new URLSearchParams(location.search).get('server') ??
      `ws://${location.hostname}:${SERVER_PORT}`;
    const token = Net.token();
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.send({ t: 'join', name, token });
    this.ws.onmessage = (ev) => {
      const msg: ServerMsg = JSON.parse(ev.data);
      if (msg.t === 'welcome') {
        this.myId = msg.id;
        console.log('[net] welcome', msg.id);
        this.onWelcome?.(msg.id, msg.x, msg.y);
      } else if (msg.t === 'identity') {
        this.career = { points: msg.points, dunks: msg.dunks, bestSession: msg.bestSession, sessions: msg.sessions, rank: msg.rank };
        console.log('[net] identity', this.career);
        this.onIdentity?.(this.career);
      } else if (msg.t === 'leaderboard') {
        console.log('[net] leaderboard', msg.entries);
        this.onLeaderboard?.(msg.entries);
      } else if (msg.t === 'snapshot') {
        this.onSnapshot?.(msg);
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

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
```

In `client/src/main.ts`, request the leaderboard once after welcome and surface career on the HUD. In `net.onWelcome` (the existing handler that sets `predictor`), add a leaderboard request:
```ts
net.onWelcome = (_id, x, y) => {
  predictor = new Predictor({ x, y });
  net.send({ t: 'getLeaderboard' });
};
```
And in the HUD text block in `frame()`, append a career line (optional but cheap proof) — change the `hud.textContent` template's last line to include career points when known:
```ts
  const career = net.career;
  hud.textContent =
    `RIMVERSE\nplayers ${latest.n}  score ${me?.score ?? 0}${me?.hasBall ? '  ● BALL' : ''}\n` +
    `TURBO ${turboBar}  size ${(me?.size ?? 1).toFixed(2)}  skill ${(me?.skill ?? 0.5).toFixed(2)}\n` +
    (career ? `career ${career.points} pts · ${career.dunks} dunks · rank ${career.rank ?? '—'}\n` : '') +
    `WASD move · SHIFT turbo · M grab/steal/block · SPACE shoot (dunks close) · B bots (${BOT_STEPS[botStep]})`;
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck` → clean (shared + server + client). Run `npm test` → all green (client tests unaffected; `radar.test.ts` mock already has a `PlayerSnap` — unchanged here).

- [ ] **Step 3: Commit**

```bash
git add client/src/net/net.ts client/src/main.ts
git commit -m "feat(client): localStorage token in join; show career + request leaderboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Live gate — persistence round-trips end to end

**Files:** none (verification). Controller-run, like the Phase-0 visual gate.

- [ ] **Step 1: Start the server and join**

`npm run dev` (server :8081 + client :5173). Open the client (preview rooted at v3 → navigate the browser tab to `http://localhost:5173/`, per the preview-rooting note). Confirm no console errors and `[net] identity` logs with `points:0` on a first-ever token.

- [ ] **Step 2: Score, then reconnect with the same token**

Drive a dunk or two (reuse the Phase-0 eval driver: steer to the hub ball, grab with `M`, approach the opponent rim, `Space`). Confirm `score` climbs. Then reload the page (same `localStorage` token) and confirm the `identity` message now reports `points > 0` and a `rank`, and the HUD shows the `career …` line. This proves flush-on-disconnect → reload → career restored.

- [ ] **Step 3: Confirm the leaderboard**

`preview_eval`: read the logged leaderboard (or add `net.send({t:'getLeaderboard'})` via `__rim.net.send(...)`) and confirm your token's name appears with the right points/rank. Confirm the hue is stable across the reconnect (the persisted character hue applied to the entity).

- [ ] **Step 4: Suite + types green; final commit if any tuning**

Run: `npm test && npm run typecheck` → all green. No code expected here unless the gate surfaces a bug (then fix + commit).

---

## Self-review (done while writing — kept for the executor)
- **Spec coverage:** db layer → T1; protocol → T2; session counters → T3; identity helpers → T4; server wiring (join/identity/getLeaderboard/flush) → T5; client token + career → T6; live persistence → T7. Schema/metric/transport/dropped-columns all per spec §1–2.
- **Type consistency:** `Character` (shared) ↔ `db.character` ↔ wire; `CareerRow`/`SessionDeltas`/`Db` (db.ts) ↔ `resolveIdentity`/`flushSession` (net.ts) ↔ `PlayerEnt.sessionPoints/sessionDunks/peakScore` (world.ts) ↔ `recordSession(token, peakScore, {points, dunks})`. `identity`/`leaderboard`/`getLeaderboard`/`LeaderboardEntry` consistent across protocol, server, client.
- **No placeholders:** every code step is complete. `token` is optional, so every task's commit typechecks green (no broken intermediate states).
- **Invariants:** `shared/` gains only the pure `Character` type + wire types (no deps); `Date.now()`/SQLite confined to `server/`; sim/prediction untouched; bots (no session) never flush; missing-token clients still play (server-generated token).
