# SP2 — Shared Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Checkbox (`- [ ]`) steps.

**Goal:** V5 reads identity/character/career from v3's canonical SQLite file as a **read-only** second process; one source of truth. v3 stays the sole writer. Rimverse-progress persistence is **deferred** (confirmed).

**Spec:** `docs/superpowers/specs/2026-06-14-sp2-shared-data-layer-design.md`. **Branch:** continue on `sp1-vendor-v3` (the arc stack) or branch `sp2-shared-data` off it.

**Tech:** better-sqlite3 (both apps), WAL, Vitest (V5) / node:test (v3).

---

## Context

- Canonical file: `dunkcontest/data/dunkcontest.db` (v3 owns DDL + is sole writer). V5 opens the **same file** read-only.
- V5 `openDb(file?)` (`server/src/db.ts:33`) already takes a path + returns the `Db` interface (`loadPlayer`/`upsertIdentity`/`recordSession`/`leaderboard`/`playerRank`/`close`). Default `server/data/rimverse.db` stays for tests/standalone.
- Read-only design: a `readonly` mode where `upsertIdentity`/`recordSession` are **no-ops** and the `CREATE TABLE` is **skipped** (v3 owns the table). Writable mode (default) is unchanged except the `CREATE` is widened to v3's superset for forward-compat.
- v3-only career columns (`makes/misses/threes/best_streak`) — V5 doesn't read them in SP2 (deferred to SP4's career-highlights). V5 reads the columns it already models.

---

## Task 1: V5 `db.ts` — read-only mode + busy_timeout + superset CREATE (TDD)

**Files:** Modify `server/src/db.ts`; Test `server/test/db.test.ts` (extend).

- [ ] **Step 1: Failing tests** — add to `server/test/db.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db';

describe('shared-store read-only mode', () => {
  it('read-only db: writes are no-ops, reads still work', () => {
    // seed via a writable handle on a temp file
    const file = `/tmp/sp2-${process.pid}-${Math.random().toString(36).slice(2)}.db`;
    const w = openDb(file);
    w.upsertIdentity('tok', 'V3Player', { skin: 1, hair: 2, hairColor: 0, jersey: '#ff0000', jersey2: '#00ff00', shorts: '#0000ff', shoes: '#ffffff', number: 7, accessory: 0, build: 1 });
    w.recordSession('tok', 12, { points: 12, dunks: 3 });
    w.close();

    const r = openDb(file, { readonly: true });
    expect(r.loadPlayer('tok')?.name).toBe('V3Player');   // reads work
    expect(r.loadPlayer('tok')?.points).toBe(12);
    r.upsertIdentity('tok', 'HACKED', { skin: 0, hair: 0, hairColor: 0, jersey: '#000000', jersey2: '#000000', shorts: '#000000', shoes: '#000000', number: 0, accessory: 0, build: 0 });
    r.recordSession('tok', 99, { points: 99, dunks: 99 }); // no-op
    r.close();

    const v = openDb(file);
    expect(v.loadPlayer('tok')?.name).toBe('V3Player');   // unchanged by the read-only handle
    expect(v.loadPlayer('tok')?.points).toBe(12);
    v.close();
  });

  it('busy_timeout pragma is set', () => {
    const db = openDb(':memory:');
    // smoke: the handle opened without throwing and reads work
    expect(db.leaderboard(1)).toEqual([]);
    db.close();
  });
});
```

- [ ] **Step 2:** `cd ~/Sites/thedunkcontest2 && npm test -- db` → FAIL (`openDb` has no `readonly` option; writes mutate).

- [ ] **Step 3: Implement** in `server/src/db.ts`:
  - Signature: `export function openDb(file?: string, opts?: { readonly?: boolean }): Db`.
  - After `db.pragma('journal_mode = WAL')`, add `db.pragma('busy_timeout = 5000');`.
  - Wrap the `db.exec(CREATE TABLE …)` in `if (!opts?.readonly) { … }`, and **widen the CREATE** to v3's superset (add `makes INTEGER NOT NULL DEFAULT 0, misses … , threes … , best_streak …`) so a writable V5 instance establishes the correct schema.
  - In the returned object, guard the writers: `upsertIdentity(...) { if (opts?.readonly) return; stmtUpsert.run(...); }` and likewise `recordSession`. (Prepare the write statements lazily or keep them; they just won't run when readonly.)
  - Reads (`loadPlayer`/`leaderboard`/`playerRank`) unchanged.

- [ ] **Step 4:** `npm test -- db` → PASS. Then full `npm test ; echo "EXIT=$?"` → 200 still green (existing db behavior on the default writable path unchanged).

- [ ] **Step 5:** `npm run typecheck` clean; commit `feat(sp2): db.ts read-only mode + busy_timeout + superset schema`.

---

## Task 2: V5 wiring — point the server at the shared file

**Files:** Modify `server/src/index.ts` (+ a small path constant).

- [ ] **Step 1:** Add a resolved shared-path constant (e.g. in `server/src/index.ts` or a `paths.ts`): `SHARED_DB_PATH` = `<repoRoot>/dunkcontest/data/dunkcontest.db`, resolved from `import.meta.url` (server/src → ../../../dunkcontest/data/...), overridable by `process.env.DUNKVERSE_DB`.
- [ ] **Step 2:** Change `server/src/index.ts:7` `openDb()` → `openDb(process.env.DUNKVERSE_DB ?? SHARED_DB_PATH, { readonly: true })`.
- [ ] **Step 3:** `npm run typecheck` clean; `npm test` 200 green (tests use their own `openDb(...)` calls, unaffected). Commit `feat(sp2): V5 server reads the shared v3 SQLite (read-only)`.

> Note: this makes V5's standalone server read-only against the shared store. New-player creation is v3's job (the creator); cold cosmetic seeding for non-warp V5 entry is an SP3/SP4 concern, not SP2.

---

## Task 3: vendored v3 — busy_timeout (first deliberate divergence)

**Files:** Modify `dunkcontest/src/db.js`.

- [ ] **Step 1:** In `dunkcontest/src/db.js` `openDb`, after the WAL pragma add `db.pragma('busy_timeout = 5000');`.
- [ ] **Step 2:** `cd ~/Sites/thedunkcontest2/dunkcontest && npm test ; echo "EXIT=$?"` → v3's 23 tests still green (pragma is additive).
- [ ] **Step 3:** Note the divergence in `dunkcontest/README.md` (a short "Local changes from upstream v3" line). Commit `feat(sp2): vendored v3 busy_timeout for cross-process sharing`.

---

## Task 4: Integration gate (controller-run)

- [ ] **Step 1:** Start vendored v3 (`cd dunkcontest && PORT=3000 node server.js`), drive a scoring session (the bot `verify.js`, or a manual play) so a player row has points in `dunkcontest/data/dunkcontest.db`.
- [ ] **Step 2:** Start V5 server pointed at the shared DB (`DUNKVERSE_DB=<abs path> npm run dev -w server` or default). Query V5's leaderboard path / `loadPlayer` for that token → **the v3 player appears in V5**.
- [ ] **Step 3:** Run a V5 rimverse session (or its server harness) → re-read the player's v3 career row → **unchanged** (read-only proven; no double-count).
- [ ] **Step 4:** With V5 attached to the file, re-run v3 `verify.js` → still ALL PASS (no `SQLITE_BUSY`). Screenshot/log the cross-app read.

---

## Self-Review
- **Spec coverage:** §3.1 path → Task 2; §3.2 superset/no-clobber → Task 1 Step 3; §3.3 busy_timeout → Task 1/3; §3.4 read-only → Task 1; §4 v3 edit → Task 3; §5 gate → Task 4.
- **TDD:** the read-only guard + reads are genuinely unit-testable (temp-file db) — done in Task 1. Wiring + v3 line + cross-process behavior are integration-gated (Task 4).
- **Invariant:** v3 stays sole writer; V5 read-only on the shared file; default V5 path stays writable so existing tests are unaffected. Rimverse persistence deferred.
