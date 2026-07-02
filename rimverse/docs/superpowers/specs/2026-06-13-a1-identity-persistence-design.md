# A1 — Identity & Persistence Backend — Design Spec

**Date:** 2026-06-13
**Status:** Approved (brainstorming) → ready for implementation plan
**Repo:** `thedunkcontest2` (TypeScript)
**Branch:** `a1-identity` (off `v5-dunk-engine`)

> First sub-project of **Phase A** of the RIMVERSE unlock arc (`docs/THE_RIMVERSE_UNLOCK_BRIEF.md` §5.1). Gives V5 a persistent identity, career stats, and a leaderboard — ported from v3's SQLite model (`~/Sites/thedunkcontest/src/db.js`) into the TS server. The rich character model + creator UI is **A2** (its own spec); A1 keeps the existing hue-only character.

---

## 1. Goal & scope

Today V5 has **zero persistence**: each WS connection gets a throwaway random 8-char id (`server/src/net.ts:24`), `join` carries only a name (hardcoded `'hooper'`), and a "character" is just a `hue`. A1 makes a player the **same someone across sessions** (and, later, both dimensions) and ranks them on a leaderboard.

**In scope:**
1. A server-only SQLite layer (`server/src/db.ts`, `better-sqlite3`) — TS port of v3's `db.js`.
2. Token identity: client generates a `localStorage` token, sends it in `join`; server loads/creates the career record.
3. Per-connection stat accumulation (server-resolved only) → flushed to career totals on disconnect (the **simple reconnect model**: career persists, in-arena score resets, no live-entity grace).
4. Leaderboard (career points, `bestSession` tiebreaker) + the player's own rank, delivered **over the WebSocket**.
5. The protocol/`join` changes and the minimal client wiring (generate/store token, send it, receive + log career — no UI yet).

**Decided in brainstorming:**
- Start with A1 (backend) before A2 (character/creator).
- **Simple reconnect:** flush on disconnect, reload career on join, fresh spawn/score. No 60s grace (that's Phase B rooms).
- **Leaderboard metric = career cumulative *points scored* (monotonic)**, NOT the volatile live rimverse score; `bestSession` (peak live score reached) breaks ties.
- **Transport = WebSocket** (server is ws-only; no HTTP stack added).
- **Drop v3's `threes` and `bestStreak`** (V5 has no threes or fire/streak; it uses the size⇄skill tug-of-war). Schema stays easy to extend.
- No v3 data migration now (Phase E cutover).

**Out of scope:** rich character + creator UI + v3 character translation (A2); Dunk Contest rooms + grace (Phase B); any HTTP API; lobby/leaderboard *display* UI (A2).

---

## 2. Architecture & units

### 2.1 `server/src/db.ts` (new, server-only)
Thin synchronous SQLite layer (`better-sqlite3`), modeled on v3's `db.js`. One table, prepared statements, a small functional API. DB file at `server/data/rimverse.db` (gitignored); pass `':memory:'` in tests.

Schema:
```sql
CREATE TABLE IF NOT EXISTS players (
  token        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  character    TEXT NOT NULL,            -- JSON; A1 stores {"hue":N}, A2 enriches
  created_at   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  points       INTEGER NOT NULL DEFAULT 0,   -- career points scored (monotonic)
  dunks        INTEGER NOT NULL DEFAULT 0,
  best_session INTEGER NOT NULL DEFAULT 0,   -- highest live score reached in one connection
  sessions     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_players_points ON players(points DESC);
```

API (`openDb(file?)` returns an object):
- `loadPlayer(token)` → `{ name, character, points, dunks, bestSession, sessions } | null`.
- `upsertIdentity(token, name, character)` → insert-or-update name/character/last_seen (sets created_at on insert). Returns nothing.
- `recordSession(token, peakScore, { points, dunks })` → `points += points`, `dunks += dunks`, `best_session = MAX(best_session, peakScore)`, `sessions += 1`, `last_seen = now`.
- `leaderboard(limit = 20)` → `[{ rank, name, points, dunks, bestSession, character }]`, ordered `points DESC, best_session DESC`, `points > 0` only.
- `playerRank(token)` → integer rank (count of players with strictly more career points, + 1), or null.
- `close()`.

`now` is `Date.now()` — confined to this server-only module (NOT in `shared/`).

### 2.2 Identity flow (`server/src/net.ts`, `server/src/index.ts`)
- `index.ts` creates the db (`openDb()`), passes it into `startNet(world, port, db)`.
- **On `join`** (`net.ts`): validate `token` (string, sliced to ≤64 chars; if missing/blank, generate a server-side token so anonymous play still works). Resolve identity via a testable helper `resolveIdentity(db, token, name) → { name, character }`: `loadPlayer(token)` if it exists (keep the stored name + character), else `upsertIdentity(token, name, { hue })` with a hue derived from the token. Then `world.addPlayer(id, name)`, and **apply the persisted hue to the entity** (`p.hue = character.hue`) so appearance is stable across sessions and matches the leaderboard. Store `sess.token = token`. Send `welcome` (unchanged) then a new `identity` message (career stats + rank).
- **On `close`** (`net.ts`): before `world.removePlayer(id)`, call a testable helper `flushSession(db, token, player)` → `db.recordSession(token, player.peakScore, { points: player.sessionPoints, dunks: player.sessionDunks })`. Always runs (zero deltas are fine — it still bumps `sessions`/`last_seen`); the leaderboard query hides 0-point players, so no caller-side guard is needed.
- The in-world **entity id stays the per-connection random 8-char** (AOI/snapshot ids unchanged); the **token** lives on the `Session`, not in the snapshot.

### 2.3 Per-connection stat accumulation (`server/src/game/world.ts`, `balls.ts`)
The World stays **ignorant of tokens/DB** — it only tracks per-entity session counters; net.ts reads them at disconnect.
- `PlayerEnt` gains: `sessionPoints: number`, `sessionDunks: number`, `peakScore: number` (init 0 in `addPlayer`).
- `BallFlight` gains `isDunk: boolean` (true for the slam-release flight in the dunk path, false in `startShoot`).
- In the score-resolution path (`tickFlightsAndActions`, the made branch), after `shooter.score += 2`: `shooter.sessionPoints += 2`, `shooter.peakScore = Math.max(shooter.peakScore, shooter.score)`, and `if (f.isDunk) shooter.sessionDunks += 1`.

### 2.4 Protocol changes (`shared/src/protocol.ts`)
- `join` gains `token: string` (and keeps `name`): `{ t: 'join'; name: string; token: string }`.
- New `ClientMsg`: `{ t: 'getLeaderboard'; limit?: number }`.
- New `ServerMsg`s:
  - `{ t: 'identity'; points: number; dunks: number; bestSession: number; sessions: number; rank: number | null }`
  - `{ t: 'leaderboard'; entries: LeaderboardEntry[] }` where `LeaderboardEntry = { rank, name, points, dunks, bestSession, character }`.
- `welcome` is unchanged.

### 2.5 Client wiring (`client/src/net/net.ts`, `client/src/main.ts`) — minimal, no UI
- On construction, read-or-create `localStorage['rimverse-token']` = `crypto.randomUUID()`; send it in `join`.
- Add `onIdentity` / `onLeaderboard` callbacks; on `identity`, store career on the `Net` instance and `console.log` it; send a `getLeaderboard` once after join and `console.log` the result. (Display is A2; A1 only proves the data round-trips. Optionally append career points to the existing HUD text — one line, no new DOM.)

---

## 3. Invariants & guardrails
- **Server authority over stats.** The token is client-supplied arcade identity (no auth — exactly like v3). The server **never trusts client-claimed stats**; career totals only ever increment from **server-resolved score events**. Token spoofing can impersonate a name/career on the board — accepted, same threat model as v3; noted explicitly, not hidden.
- **`shared/` stays dependency-free.** `better-sqlite3` and `Date.now()` live only in `server/`. The deterministic sim/prediction path is untouched.
- **Persistence happens only on join/disconnect boundaries**, never in the 30 Hz tick.
- **No regressions:** existing 125 tests stay green; `join` without a token still lets a client play (anonymous, server-assigned token).

---

## 4. Testing
- `server/test/db.test.ts` (new) against `openDb(':memory:')`: create-on-upsert, `loadPlayer` returns stored identity, `recordSession` adds point/dunk deltas and `MAX`es `best_session` and bumps `sessions`, `leaderboard` orders by `points DESC, best_session DESC` and excludes 0-point players, `playerRank` is correct, character JSON round-trips.
- `server/test/identity.test.ts` (new): `resolveIdentity` creates a fresh record then loads it on second call; `flushSession` writes the entity's `sessionPoints/sessionDunks/peakScore` as deltas (drive a `World`, simulate a made dunk + shot, assert the db row).
- `server/test/world.test.ts` additions: a made dunk increments `sessionDunks` and `sessionPoints`; a made shot increments `sessionPoints` only; `peakScore` tracks the max.
- All via `:memory:` — no file I/O in tests. `npm test` + `npm run typecheck` green.

---

## 5. File map
| File | Change |
|---|---|
| `server/package.json` | add `better-sqlite3` dep (+ `@types/better-sqlite3` dev) |
| `server/src/db.ts` | NEW — SQLite layer (port of v3 `db.js`) |
| `server/src/net.ts` | `startNet(world, port, db)`; `resolveIdentity`/`flushSession` helpers; join sends `identity`; `getLeaderboard` handler; flush on close |
| `server/src/index.ts` | `openDb()` and pass to `startNet` |
| `server/src/game/world.ts` | `PlayerEnt` session counters; increment in score path |
| `server/src/game/balls.ts` | `BallFlight.isDunk` |
| `shared/src/protocol.ts` | `join.token`; `getLeaderboard`; `identity`/`leaderboard` msgs + `LeaderboardEntry` |
| `client/src/net/net.ts` | token gen/store + send; `onIdentity`/`onLeaderboard` |
| `client/src/main.ts` | request leaderboard, log career (optional HUD line) |
| `.gitignore` | `server/data/` |
| tests | `db.test.ts`, `identity.test.ts`, `world.test.ts` additions |

---

## 6. How this informs A2 (forward-looking, do not build)
A1 stores `character` as opaque JSON (`{hue}` for now). A2 will widen the character model, enrich the rig, and add the creator UI + v3 translation — `upsertIdentity` and the `character` column already carry whatever A2 defines, and `join` already threads identity, so A2 slots in without reworking persistence.

**Aesthetic-continuity model for A2 (user direction, 2026-06-13 — track, don't build now):**
- **Identity/tracking continuity = already A1.** One token → one career record, shared across both dimensions. (This is the persistence half of "continuity between the dunk-contest character and the rimverse character.")
- **The two dimensions keep DISTINCT player aesthetics.** The Dunk Contest look and the Rimverse look are not the same art; they stay visually their own thing.
- **Overlap = shared style in the character collection.** Some cosmetic/style elements carry across both dimensions, but it's partial, not a 1:1 skin swap.
- **The Rimverse character is the "soul" of the Dunk Contest character — DERIVED, not separately authored.** The authored Dunk Contest character is the source of truth; the Rimverse appearance is *generated* from it (distilled essence). Data model implication: `character` = the authored Dunk Contest character; the Rimverse entity appearance is a derivation `deriveRimverseAppearance(character)` (today trivially `{hue}` → the entity hue, per §2.2). A2 widens both the authored model and that derivation.
- **The creator UI is for the Dunk Contest character ONLY.** It does not author a separate Rimverse character; the Rimverse one falls out of the derivation.
