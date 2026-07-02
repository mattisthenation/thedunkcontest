# RIMVERSE Arc — Architecture Realignment — Design Spec

**Date:** 2026-06-14
**Status:** Design for review (user away; authored autonomously to the planning dead-end). **Supersedes** `docs/THE_RIMVERSE_UNLOCK_BRIEF.md` §2.1 + §4 (the architecture); keeps its vision (§1) + mechanics (§5.3–5.4) + guardrails (§10).
**Repos:** v3 = `~/Sites/thedunkcontest` (JS, Express + socket.io + better-sqlite3, deployed). V5 = `~/Sites/thedunkcontest2` (TS, raw-ws, rimverse engine).

> **The pivot.** The brief locked "unify in the TS codebase — *reimplement* the Dunk Contest on the rimverse engine; v3 is reference, not runtime." We are reversing that. **The Dunk Contest dimension IS v3, moved over and run as-is.** V5/rimverse stays its own app — the warp destination. The two share only the **data layer**. The V5 reimplementation of the dunk contest (A2b creator, B1 gameplay/rooms, B2 themed stages) becomes **dormant dead code, kept completely separate** (user is OK carrying it). [PR #6](https://github.com/mattisthenation/thedunkcontest2/pull/6) (B2) is **superseded and unmerged**.

---

## 1. Target architecture

```
        ┌──────────────── SHARED DATA LAYER (the only thing shared) ────────────────┐
        │  one SQLite `players` table: identity (token) · character · career/leaderboard  │
        └─────────▲────────────────────────────────────────────────────▲──────────────┘
                  │ writer (sole)                                        │ reader (warp seed)
   ┌──────────────┴───────────────┐    ── trigger → WARP → ──   ┌────────┴──────────────────────┐
   │ STAGE 1 — v3, AS-IS          │   (hard hand-off, not a    │ STAGE 3 — V5 rimverse (as today)│
   │ Express+socket.io, :3000     │    socket migration)       │ raw-ws TS server, :8081/:3001   │
   │ v3 creator → court → play    │                            │ avatar = today + v3 highlights  │
   └──────────────────────────────┘                            └─────────────────────────────────┘
        same player, continuous across the warp (token carried in the hand-off)
```

**Principle: clients / renderers / realtime servers are separate; only the data layer is shared.** v3 is the sole writer of career/identity; V5 reads it to seed the warped-in player. The warp is a hard hand-off (v3 socket.io disconnect + stats flush → browser navigate → fresh V5 ws join), because socket.io (v3) and raw-ws (V5) are non-interoperating stacks on separate ports/processes.

## 2. What's preserved vs superseded (from the brief)

| Brief section | Status |
|---|---|
| §1 vision (score → court tears open → rimverse roguelike → escape home) | **Kept** |
| §2.1 "unify in TS, reimplement v3 on rimverse engine, v3 = reference not runtime" | **Superseded** — v3 runs as-is |
| §2.2 one shared global rimverse; §2.3 roguelike escape loop | **Kept** (Stage 3 / Phase D) |
| §4 "one TS server, two dimensions as room-states" | **Superseded** — two apps, two servers, shared DB |
| §5.1 unified identity/character | **Kept, but cheaper** — v3 already owns the store; V5 already has an identical `Character` + a `deriveRimverseAppearance` reducer |
| §5.3 wormhole threshold `[10,25]` / Universe Collapse dunk | **Kept** (SP3) |
| §5.4 enemy-bot-holds-key + portal escape | **Kept** (later phase, V5 side) |
| §10 guardrails (server authority, render-only Escher, `shared/` dependency-free, no elimination, TDD) | **Kept, non-negotiable** |

## 3. Decomposition (build order)

Each is its own spec → plan → execution cycle. SP1 has a full spec + plan (this realignment); SP2–SP4 are design-level here, gated on the §6 decisions.

- **SP1 — Vendor v3 in, as-is.** Copy v3 wholesale into V5's repo as a 4th sibling app (its own `package.json`/`node_modules`, `node server.js`, :3000). Plays byte-identically to production. *Decision-light; spec + plan written.*
- **SP2 — Shared data layer.** Point V5's `openDb()` at v3's `players` SQLite file; v3 = sole writer, V5 = read-only seed. *Gated on DB-LOCATION, SP2-WRITE.*
- **SP3 — The warp.** Add the (currently nonexistent) threshold trigger to v3's `registerMake` + a hand-off that flushes v3 stats, then navigates to V5 carrying the token. *Gated on SP3-TRIGGER, SP3-TRANSITION, WARP-ROUTING.*
- **SP4 — Land in rimverse + highlights.** V5 seeds the warped-in player from the shared `character` JSON via the existing `deriveRimverseAppearance` (cosmetics → rig hues = *zero new code*). **Scope note:** richer *career* highlights (the v3-only `makes/misses/threes/best_streak`) have **no existing V5 read path** — V5's `CareerRow`/`stmtOne` don't model them, so career-driven cosmetics need a new query + a widened `CareerRow`, not just the reducer. *Gated on V5-FALLBACK-MINT.*
- **Phase D+ (later):** the rimverse roguelike (enemy bot + key + portal escape) and unified deploy (DEPLOY-PROCESS) — per the brief, after the warp works.

## 4. The shared data layer (the SP2/SP4 core, verified)

Both apps use `better-sqlite3` + a `players` table + WAL. **v3's schema is a superset** of V5's:

- Schema columns v3 owns: `token, name, character(JSON), created_at, last_seen, points, dunks, best_session, sessions` + the v3-only `makes, misses, threes, best_streak`. V5's `loadPlayer` (`db.ts:73-76`) reads only `name, character, points, dunks, best_session, sessions` (it never reads `created_at`/`last_seen` — harmless), and the **v3-only `makes/misses/threes/best_streak` have no V5 read path** (see SP4 note below).
- **v3's character JSON is byte-compatible with V5's `Character`** — `shared/src/character.ts` is field/range/default-identical to v3's `sanitizeCharacter` (`roomManager.js:222-245`). A v3-written character `JSON.parse`s straight into V5's `Character` with **zero mapping**.
- **V5 already reduces it:** `deriveRimverseAppearance(c) = {hue: hueOfHex(c.jersey), accentHue: hueOfHex(c.jersey2)}` (`character.ts:66-68`), applied at join (`server/src/net.ts:96-98`). So the minimum "avatar seeded from v3 highlights" (cosmetics → rig hues) is **already implemented** — it just needs to read the *shared* store keyed by the warp-passed token. (Richer *career* highlights are NOT free — see SP4 note.)

Reconciliation needed: (a) V5's `openDb()` points at v3's file (`server/src/db.ts:33-36` accepts an explicit path); (b) V5 must **not** create its narrower table first on an empty file (v3 owns DDL); (c) the **token key differs** (v3 `localStorage.dunkToken` vs V5 `localStorage['rimverse-token']`, both `crypto.randomUUID()`) — the warp passes v3's token explicitly and V5 **suppresses its fresh-UUID fallback** (`server/src/net.ts:81-85`) on the warp path; (d) both processes set `busy_timeout (~5000ms)` (v3 currently sets none).

## 5. The warp seam (SP3, verified)

- **No trigger exists in v3.** It's an endless free-for-all — no clock/round/win/global score; only per-player `p.score`. The single server-side chokepoint where score advances is `registerMake` (`room.js:338-356`), which already broadcasts a `score` event. SP3 adds `if (p.score >= WARP_THRESHOLD)` there → a new `warp` event.
- **Hard hand-off, not socket migration.** v3 = socket.io v4 over websocket-only (`:3000`); V5 = raw `ws` (`:8081`). Sequence: trigger → clear `inGame` (`main.js:138`) → v3 socket disconnect fires v3's soft-leave + `persistStats` flush (`roomManager.js:99,164,175-182`) so the session score commits to the shared DB **before** navigation → browser navigates to the V5 app carrying `dunkToken` → V5 opens a fresh ws join seeded by that token.
- **Dead code trap:** the live import graph (from `main.js`) is 10 files: `main, net, world, game, hud, creator, fx, stage, sprites, generator`. **7 of the 17 `public/js` files are dead** (zero importers): `game-client.js`, `network-manager.js`, `ball-handler.js`, `dunk-animation-system.js`, `shot-system.js`, `sprite-player.js`, `sprite-player-generator.js`. SP1 vendors them verbatim (inert; cleanup deferred), and **SP3 must hook the live `net.js`/`game.js`, not these** (the `*-system`/`sprite-player` files look like live netcode but aren't).

## 6. Open decisions (THE dead-end — your calls)

Each has a recommendation; planning can proceed on the recommendations, but these are genuinely yours to confirm. Full options in the mapping artifact (`tasks/w8iyp1j1e.output`).

1. **DB-LOCATION** — where the single shared SQLite file lives. → *Rec: keep v3's `data/dunkcontest.db` as canonical (v3 owns DDL + superset + sole writer); point V5's `openDb()` at it. Zero migration, preserves existing players.*
2. **SP2-WRITE** — does V5 ever write the shared store? → *Rec: V5 strictly read-only for warp seeding; v3 sole writer (its flush-and-zero + additive `recordSession` assume one mutator). If V5 needs its own progress later, give it a separate table.*
3. **WARP-ROUTING** — same-origin path split vs subdomain vs port-only. → *Rec: single-domain path split (v3 at `/`, V5 at `/rimverse/*`) so localStorage carries for free; still pass the token explicitly (different key names).*
4. **SP3-TRIGGER** — what fires the warp. → *Rec: server-authoritative per-player score threshold in `registerMake`, threshold a constant in `shared/constants.js` (tunable, can't be faked). Brief suggests random `[10,25]`.*
5. **SP3-TRANSITION** — the hand-off mechanism. → *Rec: top-level redirect carrying the token (socket migration is impossible across the two stacks); optional warp cutscene before redirect.*
6. **V5-FALLBACK-MINT** — V5 mints a fresh UUID on tokenless join. → *Rec: suppress on the warp path (require the passed token, else the landed player is a stranger); keep it for ordinary cold V5 entry.*
7. **DEPLOY-PROCESS** — two apps + shared DB on the droplet. → *Rec: two systemd units (v3 `:3000`, rimverse `:3001/:8081`) run as the same user `dunk` (shared rw on the DB dir), one path-matched Caddy line, per-app/parameterized deploy. (Phase E.)*

**Coupled decisions (don't pick contradictory options):** **DB-LOCATION ↔ DEPLOY-PROCESS** — where the shared DB lives interacts with systemd hardening (`ProtectSystem=full` makes only `/opt` writable; a DB outside `/opt` needs explicit `ReadWritePaths=` on both units, and `backup.sh:9`'s hard-coded path must match). **WARP-ROUTING ↔ SP3-TRANSITION** — the recommended top-level-redirect transition assumes same-origin "localStorage carries for free"; choosing a **subdomain** for WARP-ROUTING breaks that (cross-origin), forcing the token to be passed explicitly in the URL (which the rec already does as a safety net, but a subdomain makes it mandatory).

## 7. Risks carried into the specs (top of 14 from the mapping)

- **Native `better-sqlite3`** — never copy a prebuilt binary; `npm install`/`rebuild` in the new location.
- **`data/` is gitignored** — the live `dunkcontest.db` (16KB, real players) is not in git; copy it explicitly to preserve players.
- **Two writers race** on cumulative columns + double-increment `sessions` — keep v3 sole writer.
- **Token-key mismatch** → V5 mints a stranger if the warp doesn't pass the token + suppress the fallback.
- **Read-before-flush race** — trigger must flush v3 stats before navigate (or carry live highlights in the warp payload).
- **WAL not over NFS** — shared-file approach holds only because both processes are on one droplet.
- **Caddy matcher ordering** — `/rimverse/*` must precede the catch-all or all traffic falls to v3.
- **`backup.sh:9`** hard-codes the DB path — update if the canonical path changes.

## 8. Build sequence & gates

- **SP1** — *Gate:* vendored v3 boots from V5's repo (`/api/status` JSON, `/` 200, `/socket.io/socket.io.js` served, clean SIGTERM), its 4 db tests pass, and the full flow (lobby → creator → court → PLAY → score → on-fire) is byte-identical to production.
- **SP2** — *Gate:* V5 reads the shared store; v3's 4 db tests stay green; no double-count; V5 never establishes the narrow schema.
- **SP3** — *Gate:* crossing the threshold flushes v3 stats and navigates to V5 carrying the token; v3 otherwise unchanged.
- **SP4** — *Gate:* the warped-in player lands in rimverse as themselves (cosmetics + career from the shared store), not a stranger.

> Next docs: `2026-06-14-sp1-vendor-v3-design.md` (spec) + `plans/2026-06-14-sp1-vendor-v3.md` (executable plan). SP2–SP4 get their own specs once the §6 decisions are confirmed.
