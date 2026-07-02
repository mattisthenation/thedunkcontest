# SP1 — Vendor v3 In, As-Is — Design Spec

**Date:** 2026-06-14
**Status:** Design for review (decision-light; ready to plan).
**Parent:** `2026-06-14-rimverse-arc-realignment-design.md` (SP1 of 4).

> **Goal:** Copy The Dunk Contest v3 wholesale into the V5 repo (`~/Sites/thedunkcontest2`) as its own self-contained app, running **byte-identically to production**. No backend sharing, no warp, **no code changes to v3 and none to V5/rimverse**. This is pure relocation + run-wiring — the foundation the rest of the arc builds on.

## 1. Scope

**In:** copy v3 into a dedicated top-level folder; install its own deps; run its own `node server.js` on :3000; verify it behaves exactly as the deployed game.
**Out (later SPs):** the shared SQLite redirect (SP2), the warp trigger/hand-off (SP3), V5-side landing (SP4), unified deploy (Phase E). Nothing in v3's or V5's source changes in SP1.

## 2. Where v3 lands

A new top-level directory **`dunkcontest/`** in the V5 repo, **outside** V5's npm workspaces (root `package.json` `workspaces: ["shared","server","client"]` — `dunkcontest/` is intentionally not a member). It ships its **own** `package.json` + `package-lock.json` + `node_modules` + `.gitignore`, completely separate from the TS stack.

Rationale: a sibling folder (not under `apps/`, since V5's own app already lives at the repo root as `shared/server/client`) keeps v3 isolated and obvious, and not being a workspace means npm never tries to hoist or link it into the TS build.

## 3. What to copy (and what not to)

**Copy wholesale from `~/Sites/thedunkcontest/` → `thedunkcontest2/dunkcontest/`:**
`server.js`, `src/` (`db.js`, `room.js`, `roomManager.js`), `shared/` (`constants.js`, `courts.js`), `public/` (incl. `index.html`, `js/*`, `css/`, `vendor/three.module.js`), `test/`, `tools/`, `deploy/`, `DEPLOY.md`, `README.md`, `package.json`, `package-lock.json`, `.gitignore`.

**Do NOT copy:**
- `node_modules/` — reinstall (native `better-sqlite3` must compile for this machine/ABI; copying a prebuilt binary is a boot-failure risk).
- `.git/` — a plain copy; v3's own repo keeps its history (the user said "copy," not subtree/submodule).
- v3 **dev-meta** — `.claude/` (its own preview/launch config, would confuse V5's repo-root tooling), `.superpowers/`, `docs/` — these are v3's planning artifacts, not part of the running app.
- `app.json` — stray `{"expo":{}}`, unrelated.

`public/` (incl. all of `public/js/`) is copied **verbatim** — SP1 changes nothing. For SP3's benefit, note the **live import graph** (from the sole ESM entry `main.js`) is 10 files: `main, net, world, game, hud, creator, fx, stage, sprites, generator`. The other **7 of the 17 `public/js` files are dead** (zero importers, traced): `game-client.js`, `network-manager.js`, `ball-handler.js`, `dunk-animation-system.js`, `shot-system.js`, `sprite-player.js`, `sprite-player-generator.js`. They are inert and ride along; **SP3 must hook the live netcode (`net.js`/`game.js`), not the dead `*-system`/`sprite-player` files** (which an author could mistake for live netcode). Cleanup of the dead files is a later SP, not SP1.

**The live database (`data/dunkcontest.db`, 16KB, gitignored, real players):** copy it into `dunkcontest/data/` so dev shows the real leaderboard and SP2 has a populated store to share. It stays **gitignored** (v3's `.gitignore` covers `data/`), so it is never committed. Production DB migration/cutover is Phase E, not SP1.

## 4. Path invariants that must survive the move (else the client white-screens)

These are why a wholesale copy (preserving v3's internal layout) is the safe move — they all hold automatically if the tree is copied intact under `dunkcontest/`:

- `server.js` mounts `express.static('public')` at `/` and `express.static('shared')` at `/shared` (relative to `server.js`'s dir) — the browser does `import '/shared/constants.js'`. Keeping `public/` and `shared/` as siblings of `server.js` preserves both mounts.
- `public/vendor/three.module.js` must stay reachable via the importmap in `index.html:9`.
- The socket.io browser client is server-generated at `/socket.io/socket.io.js` (no vendored file) — it works as long as the `socket.io` dep is installed and `Server` is attached to the http server (`server.js:18-19`), which the wholesale copy preserves.
- `src/db.js` resolves the DB path from its own `__dirname` (`..//data/dunkcontest.db`) → after the move it resolves to `dunkcontest/data/dunkcontest.db`. (This relative resolution is exactly what SP2 will later redirect; SP1 leaves it untouched.)

## 5. Running it

- Install: `npm ci` inside `dunkcontest/` (uses the copied lockfile; recompiles `better-sqlite3`).
- Run: `node server.js` (prod) / `node --watch server.js` (dev), `PORT` default **3000**, `HOST` default `0.0.0.0`. Zero config — every env var has a default. `DUNK_NO_DB=1` runs DB-less; `DUNK_ROOM_CAP` overrides the per-room cap.
- **No port conflict** with V5 (client :5173, server :8081). v3 owns :3000.
- **Optional convenience** (the only V5-root touch, and it's inert to the TS build): a root `package.json` script `"dev:dunk": "npm --prefix dunkcontest run dev"`. If "completely separate" should mean *zero* root edits, omit it and document `cd dunkcontest && npm run dev` instead. (Plan treats this as optional/last.)

## 6. .gitignore

The **nested `dunkcontest/.gitignore`** (copied from v3 — ignores `node_modules/`, `data/`, `backups/`) is the **load-bearing** protection: it is what covers the SQLite `-wal`/`-shm` sidecars that appear once the server runs. The V5 **root** `.gitignore` (`*.db`, un-anchored `node_modules/`) is only a *partial redundant net* — it has no `data/`/`backups/`/`-wal`/`-shm` rules, so it is a helpful backstop, not the primary mechanism. Verify with `git status` that the copied tree stages only source (no `node_modules`, no `data/` incl. sidecars, no `backups`). If the nested file didn't copy, add **directory** rules `dunkcontest/data/` + `dunkcontest/backups/` to the root `.gitignore`.

## 7. Verification (the SP1 gate — this is an integration/relocation task, not unit-TDD)

SP1 changes no logic, so its correctness is "v3 runs identically from the new location." Verify in three layers:

1. **Boot parity** (matches the production smoke test): `cd dunkcontest && npm ci`, then `PORT=3999 node server.js` →
   - `GET /api/status` returns JSON, `GET /` returns 200, `GET /socket.io/socket.io.js` serves the client lib, and `SIGTERM` shuts down cleanly (v3 self-exits ≤8s — `server.js:68` flush cap; the prod `TimeoutStopSec=10` SIGKILL backstop is systemd's, not the app's). No `better-sqlite3` ABI error on boot.
2. **v3's own test suite green in the new location:** `npm test` inside `dunkcontest/` runs `test/db.test.js` (4 pinned tests) + `test/room.test.js` — all pass (proves the native module + module resolution survived the move).
3. **Functional flow (browser, byte-identical to production):** lobby loads → character creator works (10 knobs persist to `localStorage.dunkCharacter`) → pick a court → PLAY → connect via socket.io → move (WASD), grab a ball, dunk → `p.score` accrues (+2/+3) → on-fire ignites at 3 consecutive makes → leaderboard reflects the populated copied DB. Compare side-by-side against the deployed thedunkcontest.com.

## 8. Risks (SP1-specific, from the mapping)

- **Native `better-sqlite3`:** a copied `node_modules` won't boot; the plan installs fresh (`npm ci`). Mitigated by not copying `node_modules`.
- **Lost players:** `data/` is gitignored; the live DB isn't in git — the plan copies `data/dunkcontest.db` explicitly. (If it's missing, v3 auto-creates an empty one on first write — functional but empty leaderboard.)
- **Layout drift:** if the copy reorganizes `public`/`shared` relative to `server.js`, the two static mounts + the importmap break → white screen. Mitigated by copying the tree intact.
- **Accidental workspace capture:** if someone adds `dunkcontest` to the root `workspaces` glob, npm will try to hoist it and clash with the TS deps. The plan keeps it out of `workspaces` and verifies a root `npm install` doesn't touch `dunkcontest/`.

## 9. Out of scope confirmations

No edits to v3 source (`server.js`/`src`/`public`/`shared` are copied verbatim). No edits to V5 `shared/server/client` source. No DB redirect, no warp, no Caddy/systemd/deploy change. Those are SP2/SP3/SP4/Phase-E.
