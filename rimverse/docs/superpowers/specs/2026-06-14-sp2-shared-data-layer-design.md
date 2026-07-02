# SP2 — Shared Data Layer — Design Spec

**Date:** 2026-06-14
**Status:** Design for review.
**Parent:** `2026-06-14-rimverse-arc-realignment-design.md` (SP2 of 4). **Builds on:** SP1 (v3 vendored into `dunkcontest/`).

> **Goal:** Make **one SQLite file the single source of truth** for identity + character + career, shared by the vendored v3 app (the **sole writer**) and the V5 rimverse app (a **read-only** consumer that will seed warped-in players in SP4). After SP2, V5's leaderboard/identity reflect the *same* players as v3.

Implements the approved decisions: **DB-LOCATION** = keep v3's `data/dunkcontest.db` canonical; **SP2-WRITE** = V5 strictly read-only.

## 1. Scope

**In:** point V5's `openDb()` at v3's vendored SQLite file; make V5 safe as a second process on that file (busy_timeout, no schema clobber); make V5 **read-only** against the shared career/identity columns; one minimal cross-process-safety edit to vendored v3.
**Out:** the warp + token hand-off (SP3), seeding the rimverse avatar (SP4), persisting *rimverse* gameplay progress (deferred — see §6), unified deploy (Phase E).

## 2. The shared file

- **Canonical path:** the vendored `dunkcontest/data/dunkcontest.db` (v3 owns the DDL + is the sole writer; SP1 copied the real players there). Both processes open the **same physical file**; WAL allows concurrent readers + one writer. Same machine only (WAL is not NFS-safe — fine, one droplet).
- v3's path is computed from `src/db.js` `__dirname` → already resolves to `dunkcontest/data/dunkcontest.db`. **No v3 path change needed.**
- V5's `openDb(file?)` (`server/src/db.ts:33-35`) already accepts an explicit path (defaults to `server/data/rimverse.db`). SP2 calls it with the shared path.

## 3. V5 changes (`thedunkcontest2/server` + `shared`)

### 3.1 Point V5 at the shared file
A new resolved constant (e.g. `SHARED_DB_PATH` = `<repoRoot>/dunkcontest/data/dunkcontest.db`, overridable by env `DUNKVERSE_DB`). `server/src/index.ts:7` calls `openDb(SHARED_DB_PATH)` instead of the default. Keep the default (`rimverse.db`) for tests / standalone runs.

### 3.2 No schema clobber (v3 owns DDL)
v3's `players` table is a **superset** of V5's (v3 adds `makes, misses, threes, best_streak`). V5's `CREATE TABLE IF NOT EXISTS` (`db.ts:40-52`) is narrower. Two safe options:
- **(Recommended) Widen V5's `CREATE` to v3's full superset schema** — then `CREATE TABLE IF NOT EXISTS` is correct regardless of which app touches an empty file first, and it's idempotent against v3's existing table (no-op). Lowest-risk; removes the "V5 runs first → wrong schema" hazard entirely.
- (Alternative) Gate V5's `CREATE` off when using the shared path (assume v3 created it). Riskier if V5 ever runs first.

### 3.3 Cross-process safety
Add `db.pragma('busy_timeout = 5000')` in V5's `openDb` (after the WAL pragma). Prevents `SQLITE_BUSY` throws when V5 reads while v3 writes.

### 3.4 V5 read-only against the shared store (SP2-WRITE = read-only)
v3's career accounting (`recordSession` additive + flush-and-zero) assumes a **single writer**. So when V5 is pointed at the shared file, V5 must **not write career/identity** to it:
- V5's write methods (`upsertIdentity`, `recordSession`) must be **no-ops (or guarded off) on the shared path**, so V5's rimverse sessions never clobber v3's `name`/`character`/cumulative columns or double-increment `sessions`.
- V5 keeps its **reads** (`loadPlayer`, `leaderboard`, `playerRank`) — these now return v3's players.
- Cleanest shape: a small `readonly` flag on the `Db` (set when `file === SHARED_DB_PATH`) that turns the write methods into guarded no-ops; or split the interface so the shared instance only exposes reads. (Pick during planning.)

## 4. v3 change (the first intentional edit to the vendored copy)

Add `db.pragma('busy_timeout = 5000')` to the vendored `dunkcontest/src/db.js` `openDb` (v3 currently sets none → can throw `SQLITE_BUSY` under contention). **This is the first deliberate divergence of the vendored copy from source** — "as-is" was SP1's *starting* state, not a permanent freeze; record it in the vendored README/CHANGELOG. One line, behavior-preserving for v3's single-process case.

## 5. Testing & gate

- **V5 unit:** widen V5's `db.ts` tests to cover the superset schema + the `readonly` guard (writes are no-ops on the shared path; reads still work). V5's existing db behavior on its own file unchanged.
- **v3 unit:** v3's 4 pinned `db.test.js` stay green (the busy_timeout pragma is additive).
- **Integration gate (controller-run):** run vendored v3 + V5 against the **same** `dunkcontest/data/dunkcontest.db`; (a) a player created/scored in v3 appears in **V5's** `loadPlayer`/`leaderboard` by token; (b) V5 running a rimverse session does **not** mutate that player's v3 career row (read-only proven); (c) v3's `verify.js` e2e still all-PASS with V5 also attached to the file (no `SQLITE_BUSY`, no double-count). 

## 6. The one sub-decision to confirm

**SP2-WRITE = "read-only for now"** means **rimverse gameplay progress does not persist yet** — a player's rimverse points/escapes aren't saved anywhere in SP2 (only their *seed-in* from v3 is read). Options, in order of recommendation:
- **(Rec) Defer rimverse persistence.** SP2 is read-only; rimverse progress persistence is a later phase (its own table so it never races v3's columns — per the SP2-WRITE decision's escape hatch). Keeps SP2 small and the single-writer invariant clean.
- Give V5 a **separate `rimverse_runs` table** in the same file now (V5 writes only there; never touches `players`' career columns). More scope, but rimverse progress persists from day one.

If you want rimverse progress to persist immediately, say so and SP2 grows the separate-table option; otherwise SP2 ships read-only and a later phase adds rimverse persistence.

## 7. Risks (carried)

- **Two writers** would race v3's cumulative columns + double-increment `sessions` → SP2 enforces V5 read-only (§3.4). The integration gate explicitly proves V5 doesn't mutate the row.
- **Schema-first hazard** → §3.2 widens V5's CREATE to the superset (no order dependency).
- **`SQLITE_BUSY`** under contention → busy_timeout on both (§3.3, §4).
- **WAL sidecars / file perms** → both processes need rw on the DB dir (the `-wal`/`-shm` sidecars); on one machine as one user this holds. (Deploy detail = DEPLOY-PROCESS, Phase E.)
- **Path coupling** → V5's `SHARED_DB_PATH` must resolve to the vendored file from the repo root; keep it env-overridable so tests use `:memory:`/a temp file.
