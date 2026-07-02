# The Dunk Contest × RIMVERSE — The Unlock Arc

> **Kickoff prompt for a fresh session.** Self-contained: drop into a new session as the brief. It builds on the existing RIMVERSE codebase (this repo, `~/Sites/thedunkcontest2`, TypeScript, milestones M0–M7 complete + audited) and the established **The Dunk Contest v3** game (`~/Sites/thedunkcontest`, JavaScript, room-based, SQLite). Read §3 for what already exists before designing.

---

## 1. The vision

The Dunk Contest is rad on its own. But there's a secret: **score enough and the court tears open into the RIMVERSE — another dimension of the game.**

You're playing a normal Dunk Contest. The combined score climbs. At a threshold nobody can predict, the next dunk becomes the **Universe Collapse** — a player leaps from wherever they are into one impossible, screen-tearing slam, and the court *wormhole-collapses*. Everyone is dumped into the RIMVERSE: the glowing, curved, 100-rim coliseum.

In there it's a roguelike. Two goals:
1. **Score as many points as possible.**
2. **Find the portal and escape back to the Dunk Contest.**

The catch: the portal is one of the rimverse hoops, and it's locked. The **key** is held by an **enemy bot** hiding among the practice bots. Steal the key, get a ball, and throw down a sick dunk on the portal rim to tear your way home. Escape banks your run and drops you into a fresh Dunk Contest — where you can do it all again.

---

## 2. Decisions locked (do not re-litigate)

1. **Unify in the TypeScript codebase.** `thedunkcontest2` becomes the single game with two dimensions. Reimplement the Dunk Contest "outer dimension" on the modern rimverse engine; port identity/leaderboard from v3's `db.js`. One server, one character builder, a seamless collapse. (v3's JS code is reference to mine, not a runtime dependency.)
2. **One shared global RIMVERSE.** Every Dunk Contest game that hits its threshold funnels its players into a single persistent rimverse arena. Rimverse is reached *through the wormhole*, not as a standalone lobby.
3. **Roguelike escape loop.** Escaping = a run win: the escaper returns to a fresh Dunk Contest with score banked; the rimverse instance keeps going for everyone still inside.
4. **Two current rimverse bugs are Step 0** (§6) for this session, then build the arc.

---

## 3. What already exists (reuse, don't rebuild)

### This repo — RIMVERSE engine (TypeScript, M0–M7 done, 105 tests, audited)
The hard parts are built. Mine them:
- **Server-authoritative netcode** — 30 Hz tick / 15 Hz snapshot, intents-in/authoritative-out, client prediction + reconciliation, AOI (cap 28), `shared/` dependency-free discipline. (`server/`, `shared/sim.ts`, `client/src/net/`)
- **The arena & breathing court** — flat 2D disc sim, polar wedge geometry, smooth join/leave morph, N-scaled (`shared/src/geometry.ts`, `server/src/game/world.ts`).
- **Players & animation** — parametric rig → canvas atlas → billboarded depth-scaled sprites, NBA-Jam-cadence dribble/run/idle/shoot, a 6-dunk roster + selection (`client/src/sprites/`, `shared/src/dunks.ts`).
- **Gameplay** — hub balls + scarcity + contested grabs, server-resolved shoot/dunk scoring, steal/block/stun, turbo (in the shared integrator), size⇄skill tug-of-war progression (`server/src/game/{balls,shooting,defend}.ts`, `shared/src/progression.ts`).
- **The Vaporwave × Escher render pass** — render-only per-vertex world-bend (`client/src/scene/bend.ts`, GLSL+TS twin), neon-grid floor + sunset sky, bloom + CRT post-FX, flat-truth HUD radar. **Bend now scales with N: flat classic court at ≤2 players, full curl by ~13.** (`client/src/scene/`, `client/src/hud/radar.ts`)
- **Bots** — server-side bot players (`server/src/game/bots.ts`, `world.setBotCount`), toggled in-game (B key). External loadtest harness at `tools/bots.ts`.
- **Controls** — WASD move, SHIFT turbo, M grab/steal/block (E alias), SPACE shoot (auto-dunks in range), B bots.
- **Docs** — original spec `docs/INITIAL_DESIGN_SPEC.md`; audit `docs/audits/2026-06-12-m0-m6-audit.md` (deferred M9 scaling: O(N²) snapshot path); plans in `docs/superpowers/plans/`.

### `~/Sites/thedunkcontest` — The Dunk Contest v3 (JavaScript, deployed)
Reference for the Dunk Contest dimension's *gameplay rules and feel*, plus identity:
- `server.js`, `src/room.js`, `src/roomManager.js` — room/lobby model and the actual dunk-contest game loop/scoring. **Mine the real rules here** (how a dunk contest game plays, scores, and ends).
- `src/db.js`, `data/` — SQLite identity (localStorage token), persistent stats, leaderboard, character records. **Port these patterns into the TS codebase.**
- `src/courts.js`, `src/constants.js` — court definitions, tuning.
- `DEPLOY.md`, `deploy/` — droplet deploy (Caddy + systemd + SQLite backups).

---

## 4. Target architecture

One TypeScript server, two dimensions, shared identity & character.

```
                 ┌─────────────────────────── one TS game ───────────────────────────┐
  player ──join──▶  DUNK CONTEST dimension (rooms)                                     │
                 │     classic half-court game; combined score climbs                  │
                 │     threshold (rand 10–25) crossed → next dunk = UNIVERSE COLLAPSE  │
                 │                         │ wormhole collapse                         │
                 │                         ▼                                            │
                 │  RIMVERSE dimension (ONE shared global arena)                        │
                 │     score + survive; enemy bot holds the KEY; one rim = PORTAL       │
                 │     key + ball + sick dunk on portal → ESCAPE (roguelike)            │
                 │                         │ escape                                     │
                 └─────────────────────────┘──▶ fresh DUNK CONTEST (score banked) ──────┘
```

- **Dimensions are server room-states.** The Dunk Contest is room-based (port v3's room manager concept to TS); the rimverse is one shared room every collapse funnels into. A player entity carries a `dimension` tag; AOI/snapshots already scope what each client sees.
- **The rimverse engine is the substrate.** The Dunk Contest dimension is essentially a constrained rimverse room: small/rectangular court, dunk-contest rules. The existing N≤2 rectangle mode is a strong starting point — but honor v3's actual gameplay, don't assume the rectangle mode already *is* it.
- **Keep the invariants** (§10): server authority, render-only Escher, dependency-free `shared/`, TDD, frequent commits.

---

## 5. New systems to build

### 5.1 Unified identity + character (do early — both dimensions need it)
- One **identity** (localStorage token → SQLite, ported from v3's `db.js`), one **persistent stats/leaderboard**, one **parametric character model** + creator UI used by BOTH dimensions.
- **Character translation:** map v3's stored Dunk Contest characters into the unified model (good enough, not exact — proportions/colors/gear/vibe → rimverse appearance hue+rig params). New players use the unified creator directly.

### 5.2 The Dunk Contest dimension (entry)
- Room-based lobbies (port v3's room/roomManager to TS). Reimplement the dunk-contest game loop/scoring **mined from v3's `room.js`** on the rimverse engine. Reuse rig/sprites/dribble/dunks.
- Track **combined game score** (sum of points scored in the game).

### 5.3 The wormhole (the unlock)
- **Threshold:** per game, a hidden random integer in **[10, 25]** (`10 + floor(rand*16)`).
- **Collapse armed:** when combined score ≥ threshold, the game arms. The **next dunk by any player becomes the Universe Collapse dunk.**
- **Universe Collapse dunk:** a NEW signature dunk — the player leaps **from wherever they are** to the rim for one killer, screen-warping slam (author a dramatic anim; lean on the incoming NBA Jam dunk-mechanics analysis, §7). On its slam frame, the court wormhole-collapses (big render moment) and **all players in that game transition into the shared global rimverse** (server moves their entities into the rimverse dimension; clients cross-fade).

### 5.4 The RIMVERSE escape loop
- **Shared global arena.** All collapses funnel here. Drop-in/out, no elimination (existing rimverse rules apply: tug-of-war scoring, turbo, steal/block).
- **Enemy bot + key.** While the arena is occupied, maintain a baseline bot population including **exactly one enemy bot** (visually menacing, distinct) that **holds the KEY** — a carriable item it guards/keeps-away. **Steal the key** from it (knock it loose like a ball, then pick it up). Bots are present whenever ≥1 human is in the arena.
- **The portal.** One rim is designated the **PORTAL** (distinct glow/FX). **Escape condition:** a player holding the **key** AND a **ball** performs a **sick dunk on the portal rim** → the portal opens → that player **escapes** (roguelike return to a fresh Dunk Contest, run score banked to their persistent total). The key drops back into play for the next contender; the rimverse continues for everyone else.
- **Goals surfaced in HUD/radar:** score, key status (who holds it / "you have the key"), portal location flagged on the radar.

### 5.5 Bots policy
- Dunk Contest: practice bots optional (existing B-key toggle).
- Rimverse: always-populated — baseline bots + the one enemy bot, present while ≥1 human is in the arena, so the escape objective is always playable.

---

## 6. Step 0 — fix these current rimverse bugs first

**Bug A — shots don't visibly pass through the hoop.** Shots arc to the hoop's **floor xy** (`BallFlight.to = {hoop.x, hoop.y}`) with `z = 4·arcH·t(1-t)+1.0`, but the rim mesh is at **world y ≈ 3.05**. The ball skims the floor toward the hoop base instead of dropping through the rim. *Fix:* terminate the flight arc at rim height over the hoop (and tune the arc apex) so a made shot visibly drops through the rim; a miss clanks off. Files: `server/src/game/world.ts` (flight target/z), `client/src/scene/scene.ts` (`syncBalls` render height + bend).

**Bug B — dunk variant animations don't play in-game (player jumps, no dunk anim).** The server sets `p.anim` to the variant (`dunkTomahawk`, etc.) and the client interrupt check includes `anim.startsWith('dunk')`, yet variants don't render. *Suspects, in order:* (1) atlas/UV **row indexing for the 5 dunk-variant rows** — the atlas grew to 15 anims × 3 facings; verify `cellUV`/`buildAtlas` map the variant rows to real cells, not blank/overflow; (2) the **dunk lunge** (server moving the player) masking or out-pacing the anim; (3) one-shot/`oneShotPlaying` timing vs `DUNK_TIME`. Repro: grab a ball, dunk near an enemy rim, watch the local sprite. Files: `client/src/sprites/{atlas,poses,playerSprite}.ts`, `client/src/scene/scene.ts`. Add a visual gate (preview workbench already renders the variant filmstrips — confirm they also play *in the live game*).

Both should land with tests/visual gates before the arc work.

---

## 7. Incoming: NBA Jam dunk-mechanics analysis
A separate deeper analysis of the NBA Jam source dunk mechanics is being prepared. When it lands, fold it into: the dunk roster/selection/cadence in both dimensions, and especially the **Universe Collapse** dunk (timing, hang, the leap-from-anywhere arc). Treat it as the authority on dunk *feel*; keep our art original.

## 8. Open item (future): storytelling
The "trapped in another dimension, escape home" premise invites narrative — why the rimverse exists, who the enemy bot is, lore that unfolds across escapes. **Left intentionally open.** Don't build it yet; just don't paint into a corner that forbids it (e.g., keep room/dimension transitions and the enemy-bot identity flexible enough to carry story later).

---

## 9. Suggested build sequence (gates per phase)

- **Phase 0 — Fixes.** Step 0 bugs (A shot-through-rim, B dunk anims). *Gate:* shots visibly score through the rim; dunk variants play in live game.
- **Phase A — Unified identity & character.** Port SQLite identity/leaderboard from v3 to TS; unified character model + shared creator; v3 character translation. *Gate:* appearance + stats persist across sessions in both dimensions; a v3 character loads "good enough."
- **Phase B — Dunk Contest dimension.** TS rooms + dunk-contest gameplay mined from v3, on the rimverse engine; combined-score tracking. *Gate:* you can play a recognizable Dunk Contest game to a score.
- **Phase C — The wormhole.** Random threshold (10–25), collapse-armed state, the Universe Collapse dunk (anim + FX), all-players transition into the shared rimverse. *Gate:* crossing the threshold + the clinching dunk collapses the court and lands everyone in the rimverse.
- **Phase D — The escape loop.** Shared global rimverse, baseline bots + enemy bot, the steal-able key, the portal rim, escape (key+ball+dunk) → roguelike return with banked score. *Gate:* steal the key, dunk the portal, escape to a fresh Dunk Contest; rimverse continues for others.
- **Phase E — Scale, polish, deploy.** Resolve deferred M9 scaling (O(N²) snapshot path — see audit); unified deploy/migration plan (this game now supersedes v3 — decide DB migration & cutover). *Gate:* 100-player loadtest holds; live.

Use the superpowers brainstorming → writing-plans → execution flow per phase. Each phase = its own plan in `docs/superpowers/plans/`.

## 10. Guardrails (carried over — non-negotiable)
- **Server decides everything; clients send intents only.** Never let a client claim an outcome (the bug class that sank an earlier version; re-confirmed by the M0–M6 audit).
- **The Escher/render weirdness is render-only.** The sim is a flat 2D plane in both dimensions; never bake non-euclidean geometry into physics/collision/netcode.
- **`shared/` stays dependency-free** (runs in Node + browser; no unguarded `process`/`window`; no wall-clock/PRNG in the deterministic path).
- **No elimination in the rimverse**; escape is a personal win, not a knockout.
- **TDD, frequent atomic commits, verify each gate** (tests + live preview). Animation quality outranks feature count.

## 11. Pointers
- This repo (TS): `server/`, `client/`, `shared/`, `tools/`, `docs/INITIAL_DESIGN_SPEC.md`, `docs/audits/`, `docs/superpowers/plans/`.
- v3 (JS, reference): `~/Sites/thedunkcontest/` — `server.js`, `src/{room,roomManager,db,courts,constants}.js`, `DEPLOY.md`.
- Dev: `npm run dev` (server :8081 + client :5173); preview `/`; anim workbench `/preview.html`; `npm test`; `npm run typecheck`.
