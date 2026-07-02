# V5 Dunk & Animation Engine — Design Spec

**Date:** 2026-06-13
**Status:** Approved (brainstorming) → ready for implementation plan
**Repo:** `thedunkcontest2` (TypeScript) — v3 (`~/Sites/thedunkcontest`, JS) stays frozen as reference
**Branch:** `v5-dunk-engine`

> This is the first sub-project of the larger **The Dunk Contest × RIMVERSE unlock arc** (see
> `docs/THE_RIMVERSE_UNLOCK_BRIEF.md`, Phases 0→E). It is the **foundation**: the dunk &
> animation engine that everything else — most of all the Phase C *Universe Collapse* dunk —
> stands on. Source of dunk *feel*: `~/Sites/nbajam/.../DUNK_SYSTEM_HANDOFF.md` (the NBA Jam TE
> analysis). We borrow the *mechanics* from Jam; the art stays original.

---

## 1. Goal & scope

Rebuild dunks on the NBA-Jam model so they have **weight, hang, and timeline-precise
launch/slam**, and fix three visible animation bugs — as the foundation for the rest of the
arc. **Animation quality outranks feature count.**

**In scope (this pass):**
1. A data-driven **dunk sequence model** + one **interpreter** (replaces the single-anim-name model).
2. The **backwards-projectile launch solve** (replaces position lerp), with a real authoritative
   vertical axis so the arc has weight.
3. **Hang time** as a gravity-skip counter, exposed per-dunk.
4. Fix **Bug A** (shots don't pass through the rim).
5. Fix **Bug B** (dunk variant animations don't play in the live game).
6. Fix **Bug C** (legs look like they run backwards) via direction-aware art.
7. Port the existing **6 dunks** onto the new model.

**Explicitly deferred to a later "juice" phase** (the data model leaves slots for each; adding
one is a new field, never an engine change): miss %, "facials," camera flashes, speech/sound
escalation, signature sounds, on-fire (FF) variant art, the 70-dunk roster expansion, and the
full skill→set→distance→direction selection cascade.

**Decided in brainstorming:** build in TS (locked by brief); v3 frozen, fixed only in V5; the
Dunk Contest dimension keeps v3's **free-play scoring** model (pairs naturally with the
combined-score→threshold→collapse mechanic); real authoritative vertical axis (not a client-only
fake); deferred list stays deferred.

---

## 2. Core architectural decision — physics in `shared/`, animation in `client/`

NBA Jam decouples animation *timing* from *physics*. The server-authoritative mapping of that
principle, honoring the locked invariants:

- **`shared/` (authoritative · deterministic · dependency-free):** the **physics timeline** —
  backwards-projectile launch solve, gravity integration, the hang counter, the slam tick, ball
  trajectory, and scoring. The server runs it; the client predicts it with the *same code*.
- **`client/` (render-only):** the **visual frame sequence** — which rig pose shows at which
  tick, spin, direction-aware art. Driven by the dunk id + the normalized phase the snapshot
  already implies (anim + animStart). Never affects the sim.

This adopts Jam's decoupling without violating: *server decides everything*, *`shared/` stays
dependency-free*, *the Escher/visual layer is render-only*.

---

## 3. The dunk data model (the "bytecode," TS-native)

Evolve `DunkDef` in `shared/src/dunks.ts` from `{ anim, minSkill, pools, weight }` into a
timed sequence:

```ts
interface DunkDef {
  id: number;
  name: string;
  // selection (unchanged this pass):
  minSkill: number;
  weight: number;
  pools: DunkPool[];
  // NEW — the physics timeline (all in ticks; sim runs at 30 Hz):
  windupTicks: number;   // ticks before launch
  ticksToRim: number;    // T — backwards-solve target airtime; THE drama dial
  hangTicks: number;     // gravity-frozen ticks at the rim (the money mechanic)
  recoverTicks: number;  // ticks after slam before landing
  // visual:
  anim: AnimState;       // which client frame-sequence to play (render only)
}
```

One function — **`stepDunk(p, dt)`** in `shared/src/sim.ts` — interprets *every* dunk:
`windup → launch (solve velocity) → airborne → slam (apply hang, score) → recover → land`.
Analogous to NBA Jam's ~40-line per-tick interpreter. **Adding a dunk = adding a data row; the
engine never changes** (the analysis's "dunks are data, not code").

The client's visual **`onLaunch` / `onSlam`** markers are expressed as frame indices derived
from the same `windupTicks` / `ticksToRim` / `hangTicks` numbers, so the visual slam lines up
with the physics slam and the two stay in lockstep without a separate scheduler.

---

## 4. Backwards-projectile solve + authoritative vertical axis

Today the jump is largely a client visual plus a server position-glide (remote sprites don't
even elevate). To give dunks weight we introduce an **authoritative vertical (height) component**
on the player for airborne actions, integrated by the shared sim and carried in the snapshot.

**Coordinate convention (honor the existing codebase, do NOT import Jam's y-up-negative):** the
floor plane is `x,y`; **height is the `z` axis** (the ball already uses `b.z` for height; the
rim mesh renders at THREE `y ≈ 3.05`). Render maps sim-`z` → THREE-`y`.

At **launch**, given start pos, the rim target, and `T = ticksToRim`:

```
vel.x = (rim.x - p.x) / T            // floor-plane, constant (no air drag)
vel.y = (rim.y - p.y) / T
vel.z = (rimHeight - p.z) / T + 0.5 * GRAV * T   // solve so body reaches rim height at tick T
```

`GRAV` is a tuned **positive downward magnitude subtracted** from `vel.z` each tick (z is up;
simple Euler) — consistent with the `+ 0.5·GRAV·T` term in the solve above. **`T` is the
single drama dial:** small `T` = quick putback; large `T` = floaty showcase. Because the solve
works from *any* start position, the **Universe Collapse dunk (Phase C) is just an extreme-`T`,
long-`hangTicks`, leap-from-anywhere data row** — the engine is *designed to express it now*,
though we build its FX/transition later.

The **shot arc** (Bug A) uses the same backwards-solve thinking: terminate at rim height, not
the floor.

---

## 5. Hang time

A `hangTicks` counter on the player. While `hangTicks > 0`, `stepDunk` **skips the gravity
step** (the body floats at the rim), then decrements by one per tick; at zero, gravity resumes
and the player drops. Exactly the analysis's gravity-skip trick. The single highest-leverage
feel mechanic; exposed per-dunk.

---

## 6. The three bug fixes (each lands with a visual gate)

### Bug A — shots don't visibly pass through the rim
Ball `z` is capped near `1.0` while the rim sits at world `y ≈ 3.05`, so the ball skims the
floor toward the hoop base. **Fix:** terminate the ball flight arc at *rim height* over the
hoop (tune the apex) so a make visibly drops through and a miss clanks.
Files: `server/src/game/world.ts` (flight target/z), `client/src/scene/scene.ts` (`syncBalls`
render height + bend).

### Bug B — dunk variant animations don't play in the live game
Atlas row/UV indexing is structurally sound (verified) and all 5 variants exist in `ANIMS`,
the `AnimState` union, and the atlas layout. **Suspect, to confirm via the live preview:** the
dunk-lunge movement (server gliding the player) masking/out-pacing the anim, or one-shot timing
(`oneShotPlaying` vs the dunk duration). **Fix:** make all 5 variants play *in the live game*,
not just the workbench filmstrips.
Files: `client/src/sprites/{atlas,poses,playerSprite}.ts`, `client/src/scene/scene.ts`,
`server/src/game/world.ts` (lunge timing).

### Bug C — legs look like they run backwards
Sprites are drawn **right-facing only**; left-facing applies a UV horizontal flip but the
**stride/pose phase is not mirrored**, so the planted foot sweeps the wrong way relative to
travel (a moonwalk/backwards read). Present in both repos; same root-cause class. **Fix** in the
rig/atlas via **direction-aware art** — either mirror the stride phase on flip or drive the
leg-sweep direction from the velocity vector. This is the same analysis feature ("direction-aware
art + auto-flip") that also makes dunks read correctly from any approach angle.
Files: `client/src/sprites/{poses,atlas,playerSprite}.ts`, `client/src/scene/scene.ts` (facing
selection). Root-cause via `superpowers:systematic-debugging` against the live preview before
patching.

---

## 7. Verification (gates)

- **TDD in `shared/`** (pure, deterministic — add to the existing 105 tests):
  - `stepDunk` reaches rim height at **exactly** tick `T`, parametrized over `T` and start
    positions (under-hoop … far).
  - Hang freezes gravity for **exactly** `hangTicks`, then the body falls.
  - Landing snaps to ground; scoring fires on the slam tick.
- **Prediction parity:** local client prediction of a dunk matches the server's authoritative
  replay (reconciliation produces zero correction).
- **Visual gates** — `/preview.html` workbench **and** the live game (`npm run dev`):
  - legs read correctly at all facings/headings,
  - all dunk variants play in the live game,
  - shots visibly drop through the rim; misses clank.
  Capture screenshots as proof (preview MCP).
- `npm run typecheck` + `npm test` green. Frequent atomic commits on `v5-dunk-engine`.

---

## 8. Units / interfaces touched (map for the plan)

| Unit | File | Change |
|---|---|---|
| Dunk data + selection | `shared/src/dunks.ts` | `DunkDef` gains timeline fields; port 6 dunks; selection unchanged |
| Dunk interpreter | `shared/src/sim.ts` | new `stepDunk`; integrate vertical `z`, gravity, hang, launch solve |
| Shared types | `shared/src/types.ts` | player vertical (`z`/`vz`) + dunk-phase fields in snapshot; ball arc |
| Constants | `shared/src/constants.ts` | `GRAV`, rim height, default tick values |
| Server world | `server/src/game/world.ts` | drive `stepDunk`; ball flight target/z (Bug A); lunge timing (Bug B) |
| Client prediction | `client/src/net/prediction.ts` | predict the vertical/dunk timeline |
| Scene render | `client/src/scene/scene.ts` | sim-`z`→THREE-`y` for player + ball; interrupt logic (Bug B) |
| Rig / poses / atlas | `client/src/sprites/{rig,poses,atlas,playerSprite}.ts` | direction-aware art (Bug C); visual onLaunch/onSlam markers |

---

## 9. Out of scope / future (do not paint into a corner)

- The **juice** layer (§1 deferred list) — later phase; data model already has room.
- Phases A–E of the brief (identity/leaderboard port, Dunk Contest rooms, the wormhole +
  Universe Collapse dunk, the rimverse escape loop, scale/deploy/cutover) — each its own
  spec → plan → implementation cycle. This foundation must keep the engine general enough that
  the Universe Collapse dunk is *just a data row with extreme params*.
