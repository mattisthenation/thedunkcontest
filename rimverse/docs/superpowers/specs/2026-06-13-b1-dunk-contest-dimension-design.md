# B1 — The Dunk Contest Dimension — Design Spec

**Date:** 2026-06-13
**Status:** Approved (brainstorming) → ready for implementation plan
**Repo:** `thedunkcontest2` (TypeScript)
**Branch:** `b1-dunk-contest-dimension` (off `main`, after A2b/PR #4 merged)

> First half of **Phase B** (the Dunk Contest "outer dimension"). B1 is a **faithful 1:1 port of v3's
> free-play Dunk Contest gameplay + its 6-court room model** onto the rimverse engine — laid *on top of*
> rimverse as an additive dimension, never burying the substrate. PLAY now enters a Dunk Contest room
> instead of the rimverse. A new **combined game score** is tracked + surfaced (the ARENA counter) as the
> load-bearing input Phase C's wormhole will arm on. **B2** (a separate spec) faithfully ports v3's 6
> *themed* location stages (`stage.js`). Source to port: `~/Sites/thedunkcontest/src/{room,roomManager}.js`,
> `shared/{constants,courts}.js` (v3 is frozen reference).

---

## 1. Goal & scope

Bring The Dunk Contest into V5 as a recognizable, playable game: join a court, race for the ball, hit shots and dunks, catch fire, watch your score and the live leaderboard climb. It is **continuous free-play** (v3's model — no rounds, timer, or win condition), per-player additive scoring, on a fixed full court. The game runs on the rimverse engine via a per-room **game mode**, so the rimverse (Phase C destination) and the Dunk Contest coexist on one substrate.

**Decisions locked in brainstorming (do not re-litigate):**
- **Faithful 1:1 port — no changes, no "improvements."** Port v3's exact rules and tuning constants verbatim (§2.4). The Dunk Contest plays exactly like v3. We do **not** substitute V5's rimverse accuracy formula, tug-of-war, or progression.
- **v3 free-play scoring (additive):** made shot **2**, three (horizontal dist to nearest rim > 6.75) **3**, any dunk flat **2**. Per-player score only; **no tug-of-war** (rim owner never loses points), **no rim ownership** (shoot at the *nearest* of two shared rims).
- **Uniform players — no size⇄skill progression.** Size/skill stay at base in this dimension. The only modifier is **on fire**: 3 consecutive makes → a flat 45 s buff (+0.18 shot accuracy + unlocks tier-1 flashy dunks); any miss resets the streak **and** extinguishes fire.
- **Fixed v3 court:** the v3 full court (half-width 10, half-length 15, two rims at z ±12.3 / y 3.05, 3-pt radius 6.75, dunk range 3.2) — **fixed regardless of player count**, two **shared** rims, **one shared ball** that respawns at center after a score, free-for-all up to the room cap.
- **Game-mode parameterization:** `World` gains `mode: 'dunkContest' | 'rimverse'`. Mode drives geometry, the hoop model, and scoring. `rimverse` mode = today's exact behavior (all existing tests stay green; Phase C spawns rimverse rooms).
- **Server room manager:** first-fit-by-court placement (port v3's `findOrCreateRoom`), per-court instance counter (`rucker-1`…), lazy create, delete-on-empty, per-room cap. The single-`World` server wiring becomes a room registry.
- **6 real, selectable courts** — un-disable the A2b court cards; court selection routes you into that court's room pool. In B1 every court renders the **faithful v3 base court** (floor/key/lines/backboards/rims); the 6 *themed* stages are **B2**.
- **Combined score** (sum of all points scored in a room) tracked server-side and shown as a neutral climbing **ARENA** counter (threshold hidden). Built now because Phase C's arm-check consumes it.
- **`mode` is the dimension tag.** A player's dimension = their room's mode; room lifecycle supports programmatic all-leave + fresh spawn; the rimverse `net.join` path stays intact (Phase C/D reuse it).

**Out of scope:** the 6 *themed* location stages — per-court palette/sky/light/fog/backdrop/props/particles/crowd (B2); the wormhole / Universe Collapse dunk / all-players transition into the rimverse (Phase C); the rimverse escape loop — shared arena, enemy bot + key, portal (Phase D); any judged/turn-based contest format (it is free-play); any change to v3's rules or constants; reconnect-grace parity beyond what A1 already provides (v3's 60 s soft-reconnect is a possible later refinement, not B1).

## 2. Architecture & units

The rimverse `World` is the substrate. We parameterize it with a `mode`, add a thin **room manager** above it, port v3's rules into a focused **dunk-contest rules** module + shared **constants**, and make the client mode-aware (render the base court, show the leaderboard + ARENA + fire). Pure scoring/accuracy/fire logic is extracted into testable functions; geometry stays pure functions of `(i, n)`/mode.

### 2.1 `shared/src/gameMode.ts` (new) — the dimension type
```ts
export type GameMode = 'dunkContest' | 'rimverse';
export const DEFAULT_MODE: GameMode = 'rimverse'; // existing behavior unless a room opts in
```
Dependency-free. `mode` is the dimension marker carried by a room (and echoed to the client in `welcome`).

### 2.2 `shared/src/dunkConstants.ts` (new) — v3 tuning, ported verbatim
The exact v3 constants (from `~/Sites/thedunkcontest/shared/constants.js`), shared so the client's court render and the server's sim agree. Dependency-free; no PRNG/wall-clock.

```ts
export const DC_COURT = {
  halfWidth: 10, halfLength: 15, boundX: 9.5, boundZ: 14.5,
  rimHeight: 3.05, rimRadius: 0.45,
  rims: [{ x: 0, y: 3.05, z: -12.3 }, { x: 0, y: 3.05, z: 12.3 }],
  backboardZ: 13, threePointRadius: 6.75,
};
export const DC_ZONES = { dunk: 3.2, close: 5.0, mid: 8.0, heave: 13.0 };
export const DC_ACCURACY = { close: 0.80, mid: 0.62, three: 0.45, heave: 0.18, onFireBonus: 0.18, max: 0.96 };
export const DC_FIRE = { makesToIgnite: 3, durationMs: 45_000 };
export const DC_POINTS = { dunk: 2 }; // shots are 2, or 3 when dist > threePointRadius
export const DC_STEAL = { radius: 1.6, chance: 0.4, cooldownMs: 1500, protectMs: 800 };
export const DC_BLOCK = { radius: 1.8, windowMs: 700, minAirY: 0.45 };
export const DC_ROOM = { cap: 10 };
```
Note: V5 ticks at **30 Hz** (v3 was 20 Hz). The port keeps v3's *durations in ms* (fire 45 000 ms, etc.) and converts to ticks against V5's tick rate, rather than copying tick counts — so the *feel* is identical at the faster tick.

### 2.3 `server/src/game/dunkContest.ts` (new) — v3 scoring/accuracy/fire (pure)
Mined from v3 `room.js`. Pure, fully unit-testable:
```ts
export function shotZone(dist: number): 'close' | 'mid' | 'three' | 'heave';
export function shotAccuracy(dist: number, onFire: boolean): number;   // zone base (+0.18 fire), capped 0.96
export function shotPoints(dist: number): 2 | 3;                        // 3 if dist > threePointRadius
/** Fire state transitions on a make/miss. Returns the new {consecutiveMakes, fireUntil, ignited}. */
export function onMake(fire: FireState, nowMs: number): FireState & { ignited: boolean };
export function onMiss(fire: FireState): FireState;                     // streak→0, fireUntil→0
export function isOnFire(fire: FireState, nowMs: number): boolean;
```
No tug-of-war, no progression — these helpers are additive-only. Dunks bypass the accuracy roll (always score).

### 2.4 `server/src/game/world.ts` (modify) — mode-aware engine
- Add `readonly mode: GameMode` (constructor arg; default `'rimverse'`).
- Per-player **fire state** (`consecutiveMakes`, `fireUntil`) on `PlayerEnt`, used only in `dunkContest` mode.
- Per-room **`combinedScore`** accumulator.
- **Geometry:** in `dunkContest` mode the court is **fixed** — hoop positions, spawn, and `clampToArena` use the v3 court (`DC_COURT`) and ignore `n` (no disc growth, no rectangle/disc snap). In `rimverse` mode, the existing `(i, n)` disc/rectangle path is unchanged.
- **Hoops:** `dunkContest` mode → exactly **2 shared rims** (`owner: null`); shot/dunk target = the **nearest** rim (not "nearest non-owned"). `rimverse` mode → N owned rims, unchanged.
- **Ball count:** `dunkContest` mode → **exactly one shared ball** regardless of player count (v3's contested-possession race), respawning at center after a score; the rimverse `ballCount(n) = ceil(n/6)` scaling is overridden for this mode. `rimverse` mode → unchanged.
- **The single make-resolution seam** (the one place points are awarded — today `tickFlightsAndActions`): branch on mode. `dunkContest`: `points = shotPoints(dist)` for shots / `DC_POINTS.dunk` for dunks; `shooter.score += points`; `sessionPoints/peakScore/sessionDunks` as today; **`combinedScore += points`**; apply `onMake` fire transition; emit the `score` event; **no `applyScore`, no victim −2.** A *miss* (or a block) applies `onMiss`. `rimverse`: today's exact path (flat +2, `applyScore`, victim −2). **This seam is the Phase-C hook** for detecting/replacing the clinching dunk.
- **Shot accuracy:** `dunkContest` rolls `shotAccuracy(dist, isOnFire(p))`; `rimverse` rolls the existing `makeProbability(dist, skill)`.
- **Flashy-dunk unlock:** in `dunkContest`, tier-1 dunks (windmill/360/rimhang) are gated on `turbo || isOnFire(p)` (v3 rule), feeding `pickDunk`.

### 2.5 `server/src/game/roomManager.ts` (new) — the room registry
Ports v3's `roomManager.js` lifecycle onto V5 `World`s:
```ts
export class RoomManager {
  findOrCreateRoom(courtId: string, mode: GameMode): World; // first-fit by court+space, else mint `${courtId}-${n}`
  get(roomId: string): World | undefined;
  rooms(): Iterable<[string, World]>;
  stepAll(): void;        // step every room; delete rooms whose players map is empty
}
```
- First-fit-by-`players.size` against `DC_ROOM.cap`; per-court monotonic instance counter; lazy create; delete-on-empty in `stepAll`. Each `World` is constructed with its `mode` (B1 only mints `dunkContest` rooms; rimverse rooms come in Phase C).
- Court validation falls back to the first court id for unknown input (v3 parity).

### 2.6 `server/src/index.ts` + `server/src/net.ts` (modify) — route per room
- `index.ts`: replace `const world = new World()` with `const rooms = new RoomManager()`; the tick loop calls `rooms.stepAll()` then broadcasts each room's `snapshotFor` to that room's sessions; drain each room's events.
- `net.ts`: `Session` gains `world?: World` (the player's room). `join` reads `msg.room` (court id; default first court), resolves `rooms.findOrCreateRoom(courtId, 'dunkContest')`, runs the cap check against **that** world, `world.addPlayer(...)`, stashes `sess.world`. `intent`/`bots`/`close` operate on `sess.world` (not a closed-over singleton). `welcome` echoes `{ room, mode }`. The pre-join `identity`/`getLeaderboard` path (A2b) is room-agnostic and unchanged. `flushSession` on close is token-scoped — career totals merge across rooms with no change.

### 2.7 `shared/src/protocol.ts` + `types.ts` (modify) — additive wire fields
- `ClientMsg` `join` → add `room?: string` (court id; absent ⇒ server places).
- `ServerMsg` `welcome` → add `room: string` + `mode: GameMode`.
- New `ServerMsg`: `{ t: 'arena'; combined: number }` — the ARENA combined-score push (slow cadence, per room).
- `PlayerSnap` → add `onFire: boolean` (renders the flame; defaults `false` in rimverse mode).

### 2.8 `client/src/scene/dunkCourt.ts` (new) + `scene.ts` (modify) — faithful base court
Render the **faithful v3 base court** in `dunkContest` mode: flat floor + key + boundary lines + two backboards + two rims, sized to `DC_COURT`, with a clean default palette (the court *layout*, not the themed dressing — that's B2). The rimverse vaporwave stage (neon grid/sunset/bend) stays for `rimverse` mode. The render-only Escher bend is near-flat here (small-N feel), consistent with §10.

### 2.9 `client/src/main.ts` + `net/net.ts` (modify) — mode-aware client
- `net.ts`: capture `welcome.room` + `welcome.mode`; expose them; add an `onArena` hook for the `arena` message.
- `main.ts`: when `mode === 'dunkContest'`, pin geometry to the fixed dunk court (render `dunkCourt`, not the disc); HUD shows the **live in-room leaderboard** (built from snapshot `players` `score`+`name`, top N), the **ARENA** counter, and an **ON FIRE** indicator from `PlayerSnap.onFire`. `onPlay(name, courtId)` → `net.join(name, courtId)`.

### 2.10 `client/src/lobby/courts.ts` + `lobby.ts` (modify) — enable selection
Drop `disabled`/`PHASE B` from the cards; add `.selected` state + a default court (`rucker`); track the chosen `data-id`; widen `LobbyOptions.onPlay` to `(name, courtId)`; `play()` passes `this.selectedCourt`.

## 3. Invariants & guardrails

- **Faithful port:** v3's rules and the §2.2 constants are reproduced exactly (durations in ms, converted to V5's 30 Hz) — scoring (2/3/dunk), zone accuracy, on-fire, dunk takeoff reach (3.2 + turbo?1.3:0.5), flashy-dunk-on-fire unlock, steal (0.40 / 1500 ms cooldown / 800 ms protect / 1.6), and immediate scattered ball respawn. No rule is "improved," dropped, or re-tuned. Deviations are limited to the engine substrate (30 Hz vs 20 Hz tick; deterministic made/miss flights instead of physical ball bounces) — never the *feel*. **One input-model adaptation:** v3 blocks airborne *jump shots*, but V5 has no standalone defender jump, so the Dunk Contest block uses V5's dunker-block with v3's reach (1.8) + the fire-out effect — the only place the port bends to the engine.
- **Server decides everything.** Combined score, fire state, make/miss, and steals are server-authoritative; a client never claims a score or a make (the exact bug class §10 of the brief calls out). Clients send intents only.
- **`shared/` stays dependency-free.** The new shared files (`gameMode`, `dunkConstants`) are pure data/types — no PRNG, no wall-clock, no `process`/`window`. Per-room fire timing uses the server clock, not `shared/`.
- **Additive layer, substrate intact.** `rimverse` mode is byte-for-byte today's behavior; the existing **169 tests stay green**. The rimverse `net.join`/World path is preserved for Phase C/D. The Dunk Contest layers on top; it does not fork or replace the engine.
- **Render-only Escher.** The Dunk Contest court is a flat 2D sim; the bend stays a render effect (near-flat here). No non-euclidean geometry in physics/collision/netcode.
- **Phase-C seams exist but stay dormant.** The make-resolution seam, the per-room `combinedScore`, and `mode`-as-dimension are built so Phase C plugs in (arm at `combined ≥ threshold`, intercept the next dunk, move occupants into a rimverse room) without retrofitting. The threshold PRNG itself is **not** built here and will live server-side, not in `shared/`.

## 4. Testing

TDD throughout. New + extended server tests (node, `:memory:` DB where identity is touched):
- `server/test/dunkContest.test.ts` (new): `shotZone`/`shotAccuracy` (zone values + the +0.18 fire bonus + 0.96 cap), `shotPoints` (3 beyond 6.75, else 2), `onMake`/`onMiss`/`isOnFire` (ignite at 3 consecutive, 45 s window, miss resets streak **and** kills fire).
- `server/test/roomManager.test.ts` (new): first-fit fills a court to cap then mints `${court}-2`; unknown court falls back; delete-on-empty; `get`/routing; mode carried onto the `World`.
- `server/test/world.test.ts` (extend): in `dunkContest` mode — a made shot adds 2 (or 3 past the arc) and bumps `combinedScore`; a dunk adds 2 + `combinedScore`; **no** victim −2, **no** size/skill change; fixed-court hoop positions independent of `n`; rim `owner` is null + nearest-rim targeting. In `rimverse` mode — existing assertions unchanged (tug-of-war, owned rims) still pass.
- `server/test/net.test.ts` (extend): `join` with `room` routes into that court's world; `welcome` carries `{ room, mode }`; `intent`/`close` act on the session's room; combined-score `arena` push shape.
- `shared`/`client` unit tests for the additive protocol fields + the court-geometry pinning (pure).

### Visual gate (controller-run — the crux for a faithful port)
Play a recognizable Dunk Contest on the faithful base court: grab the shared ball, hit a mid-range 2 and a 3 (watch the point values), throw down dunks, **catch fire after 3 straight makes** (flame + the accuracy bump + flashy dunks unlock), see your score and the **live in-room leaderboard** and the **ARENA** counter climb, and confirm a second player joining the same court lands in the same room (and a different court does not). Side-by-side feel check against v3. Screenshots as proof. Existing rimverse behavior unaffected (spot-check rimverse mode still scores tug-of-war).

## 5. File map

| File | Change |
|------|--------|
| `shared/src/gameMode.ts` | NEW — `GameMode` type + default |
| `shared/src/dunkConstants.ts` | NEW — v3 court/zones/accuracy/fire/points/steal/block/cap, ported verbatim |
| `shared/src/protocol.ts` | `join.room?`, `welcome.room`+`welcome.mode`, new `arena` ServerMsg |
| `shared/src/types.ts` | `PlayerSnap.onFire` |
| `server/src/game/dunkContest.ts` | NEW — pure zone-accuracy/points/fire helpers (mined from v3) |
| `server/src/game/roomManager.ts` | NEW — first-fit room registry (port of v3 roomManager lifecycle) |
| `server/src/game/world.ts` | `mode`-aware geometry/hoops/scoring; per-player fire state; per-room combinedScore; the make seam |
| `server/src/index.ts` | RoomManager instead of single World; step-all + per-room broadcast |
| `server/src/net.ts` | `Session.world`; room-routed join/intent/bots/close; `welcome` mode+room; `arena` push |
| `client/src/scene/dunkCourt.ts` | NEW — faithful v3 base court render (floor/key/lines/backboards/rims) |
| `client/src/scene/scene.ts` | mount the dunk court for `dunkContest` mode; rimverse stage unchanged |
| `client/src/net/net.ts` | capture `welcome.room`+`mode`; `onArena` hook; `join(name, courtId)` |
| `client/src/main.ts` | mode-aware geometry/render; in-room leaderboard + ARENA + ON FIRE HUD; `onPlay(name, courtId)` |
| `client/src/lobby/courts.ts` | enable selection (drop disabled, `.selected`, default court) |
| `client/src/lobby/lobby.ts` | widen `onPlay(name, courtId)`; thread selected court |
| tests | new `dunkContest`/`roomManager` suites + `world`/`net` extensions; existing 169 stay green |

## 6. How this informs Phase B2 + Phase C (forward-looking, do not build)

**B2 (themed locations)** drops onto the `dunkCourt` render + the already-real 6-court selection: it ports v3's `stage.js` per-court `palette/sky/light/fog/backdrop/props/particles/crowd` (and `courts.js` visual schema) faithfully, swapping the base-court palette/surroundings per `courtId`. No gameplay or routing change — purely the visual nuance, exactly as authored.

**Phase C (the wormhole)** consumes B1's seams: it adds a server-side hidden threshold `10 + floor(rand*16)` per room, arms when `room.combinedScore ≥ threshold`, and hooks the make-resolution seam (§2.4) so the **next dunk by any player** becomes the Universe Collapse — then moves every occupant into a shared **`rimverse`-mode** room (the mode/dimension flip + room lifecycle B1 built) with a cross-fade. The ARENA counter B1 surfaces becomes the visible climb toward that moment. Keep the make seam single and the room teardown programmatic so this lands additively.
