# SP3 — The Warp (Universe Collapse) — Design Spec

**Date:** 2026-06-14
**Status:** Design for review.
**Parent:** `2026-06-14-rimverse-arc-realignment-design.md` (SP3 of 4). **Builds on:** SP1 (v3 vendored), SP2 (shared data layer).

> **Goal:** A v3 game's **combined score** climbs; at a hidden threshold the game **arms**; the next dunk becomes the **Universe Collapse** — the court wormhole-collapses and **every player in that room is handed off into the V5 rimverse** as the same identity. Server-authoritative trigger; hard client hand-off (socket.io → navigate → V5 raw-ws). **Whole-room collapse (confirmed).**

## 1. Scope

**In:** v3 server — a combined room-score, a hidden random threshold `[10,25]`, an "armed" state, detection of the clinching dunk, a `warp` broadcast (whole room). v3 client — a `warp` handler that plays the collapse FX, flushes the session, and redirects to V5 carrying the token.
**Out:** V5 *consuming* the warp (suppress fresh-mint + seed the avatar) = **SP4**; the rimverse roguelike/escape loop = later phase; the bespoke "leap-from-anywhere" Collapse-dunk *choreography* = deferred polish (see §5, leans on the brief §7 NBA-Jam analysis). SP3 ships a **functional, dramatic warp**; the signature leap animation is a follow-up.

## 2. Server (vendored v3) — the trigger

All in `dunkcontest/` (this is the second deliberate divergence of the vendored copy from source — record in its README).

- **Combined score (new):** v3 tracks only per-player `p.score` today (`room.js`). Add a `Room.combinedScore` = running sum of all points scored in the room (increment in `registerMake` by `points`). It is **server-only authoritative** (a client can't fake it).
- **Hidden threshold (new):** on room creation, `this.warpThreshold = 10 + Math.floor(rng() * 16)` (→ `[10,25]`, brief §5.3). Store it in `shared/constants.js` as `WARP = { min: 10, span: 16 }` so it's tunable; keep the per-room *value* hidden from clients (never serialized).
- **Armed + clinch (in `registerMake`, `room.js:338-356`):** after `combinedScore += points`, if `!this.warpArmed && this.combinedScore >= this.warpThreshold` → `this.warpArmed = true` (optionally broadcast a subtle `ev:{k:'warpArmed'}` for a HUD tease — optional). Then **if `warpArmed && kind === 'dunk'`** → this make is the Universe Collapse: broadcast `ev:{ k:'warp', pid, rim: rimIndex }` to the **whole room** and set a `this.warping` latch (so only one collapse fires).
- **Flush before hand-off:** the warp must persist each player's session to the shared DB **before** they navigate (so SP4's seed reflects the just-played game). v3 already flushes on disconnect (`roomManager.persistStats`); when clients disconnect on redirect this fires. To be deterministic, also flush the room's players on the `warp` broadcast (server-side `persistStats` for each), so the career rows are current the instant the warp fires.
- **Guardrail:** the trigger is computed entirely server-side from authoritative scores (brief §10: server decides everything).

## 3. Client (vendored v3) — collapse + hand-off

- **`warp` handler:** in `game.js` (alongside the existing `net.on('score', …)` / event dispatch) or `main.js`, handle `ev.k === 'warp'`: set `inGame = false` (stop the game loop driving input), trigger the collapse FX, then after the FX beat, hand off.
- **The collapse FX (the *feel*):** a screen-warping court collapse — lean on v3's existing `fx.js` + `stage.js`/`world.js`. SP3 ships a **dramatic screen-level wormhole-collapse** (e.g. rapid camera punch-in toward the clinching rim + a radial warp/scanline tear + fade-to-white/void over ~1.5–2.5s), reusing v3's renderer. The **bespoke "leap from anywhere → one killer slam" choreography is deferred** (it wants the incoming NBA-Jam dunk analysis, brief §7) — SP3's collapse is the screen/court event, not a new per-player dunk rig.
- **The hand-off (SP3-TRANSITION = top-level redirect):** after the FX, `location.assign(<V5 url>?token=<dunkToken>&from=warp)` — a hard navigation. v3's socket.io disconnects (firing the server soft-leave/flush as a backstop to §2's explicit flush). **No socket migration** (socket.io ≠ V5 raw-ws).
- **The V5 URL (WARP-ROUTING = path-split):** prod → `/rimverse/` (same origin, so localStorage also carries); dev → `http://localhost:5173/?token=…&from=warp`. Make it a single configurable constant (e.g. `WARP_DEST` in v3 `shared/constants.js` or read from a `<meta>`/env-injected value), defaulting to the path-split `/rimverse/` in prod and the dev client URL locally. Always pass the token explicitly in the URL (the two apps use different localStorage keys — `dunkToken` vs `rimverse-token`).

## 4. V5 boundary (SP3 stops here; SP4 continues)

SP3 lands the player at V5's URL **with `?token=…&from=warp`**. SP3 does **not** change V5. SP4 makes V5 read that token, **suppress its fresh-UUID mint** (`server/src/net.ts:81-85`), and seed the avatar from the shared character (already reachable — SP2 proved the read + `deriveRimverseAppearance`). So after SP3 a warp lands you in today's rimverse (as a default avatar until SP4 wires the seed). *Optional:* SP3 could land on a simple "/rimverse?from=warp" that just shows rimverse — the identity continuity is SP4.

## 5. Scope note — the Collapse dunk choreography (deferred)

The brief §5.3's "player leaps from wherever they are into one impossible screen-tearing slam" is the *aspirational* Collapse dunk. SP3 delivers the **court-collapse moment + the hand-off** (the mechanic + a dramatic screen FX). The **bespoke leap-dunk animation** is a separate polish pass (brief §7's NBA-Jam dunk-mechanics analysis is the authority on that feel; it's "incoming"). This keeps SP3 shippable and testable without blocking on art that depends on a not-yet-landed analysis.

## 6. Testing & gate

- **Server unit (v3 `node:test`):** combined score accumulates; threshold is in `[10,25]`; arms exactly when `combined >= threshold`; the clinching **dunk** (not a non-dunk make) sets `warping` + emits one `warp` ev to the room; the latch prevents double-fire. (These are pure room-logic tests, like v3's existing `room.test.js`.)
- **Server unit:** players' stats are flushed to the (shared) DB on warp (mock/`:memory:` db).
- **Gate (controller-run):** play (or bot) a v3 game past the threshold; on the clinching dunk the **whole room** sees the collapse FX and each client redirects to the V5 URL with `?token=…&from=warp`; the player's career row in the shared DB reflects the just-played session (SP2 read confirms). v3's existing 23 tests + `verify.js` stay green (the warp path is additive; non-warp play is unchanged).

## 7. Decisions applied / risks

- **SP3-TRIGGER** → combined room-score threshold `[10,25]`, server-authoritative (whole-room, confirmed — *upgraded from the earlier per-player rec*).
- **SP3-TRANSITION** → top-level redirect carrying the token; flush-before-navigate (server-side explicit flush + disconnect backstop) avoids the read-before-flush race.
- **WARP-ROUTING** → path-split `/rimverse/` in prod (localStorage carries); token always in the URL regardless.
- **Risks:** (1) double-fire → the `warping` latch + single broadcast. (2) read-before-flush → §2 server-side flush on warp. (3) socket.io↔ws → hard hand-off, never migration. (4) the collapse FX must not block the redirect if it errors (wrap in try/finally → always navigate). (5) vendored-v3 divergence grows (combined score + warp) → keep it sectioned + noted in the README so the "as-is" delta is auditable.
