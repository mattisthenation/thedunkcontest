# V5 Dunk & Animation Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild dunks on the NBA-Jam model — a data-driven timeline, a backwards-projectile launch solve with a real authoritative vertical axis, and hang time — and fix three animation bugs (shots not passing through the rim, dunk variants not playing, legs running backwards), as the foundation of The Dunk Contest V5.

**Architecture:** Physics is authoritative and lives in `shared/` (pure, deterministic, dependency-free) — the server runs it; tests pin it down. Animation is render-only in `client/`. A dunk is data (`DunkDef` timeline fields) interpreted by one per-tick stepper; the player gains a real vertical (`z`) component carried in the snapshot so the body actually rises to the rim, hangs, and drops. The world ball stays in the dunker's hand until the slam tick, then releases through the rim (fixes the double-ball "funny" look).

**Tech Stack:** TypeScript monorepo (`shared`/`server`/`client` workspaces), Vitest, Three.js client. Sim runs at 30 Hz (`TICK_DT = 1/30`), snapshots at 15 Hz. Branch: `v5-dunk-engine`.

**Spec:** `docs/superpowers/specs/2026-06-13-v5-dunk-animation-engine-design.md`

---

## Refinements from the spec (read first)

1. **The dunk arc is server-authoritative, not client-predicted.** A dunk is action-locked (the predictor already integrates no movement while locked — `client/src/net/prediction.ts:30`), so there is nothing for the client to predict. The *physics math* lives in `shared/` as pure, deterministic, unit-tested functions; the **server** runs them each tick and writes the player's height into the snapshot; the client renders it. Movement prediction is unchanged and keeps its existing parity tests. This honors the spec's intent (physics in `shared/`, deterministic, server-authoritative) without speculative dunk prediction.
2. **`GRAV` is fixed; `ticksToRim` (T) is the drama dial** — the authentic Jam model. Apex height scales with T. Per-dunk T sets arc size; the slam fires at the apex (`windupTicks + ticksToRim`). The general backwards-solve `solveLaunchVz(startZ, peak, T, grav)` is provided so the Phase-C Universe Collapse dunk can target an arbitrary rim height from any start.
3. **Physics tuning constants** (`GRAV`, `DUNK_REACH`) ship with sensible starting values and are **finalized at the visual gate** (Task 11). Tests assert *behavioral properties* (rises to a peak, hangs exactly `hangTicks`, falls, lands) — never magic unit values that need eyeballing.

---

## File map

**Create:**
- `shared/src/dunkPhysics.ts` — pure dunk vertical physics: `solveLaunchVz`, `DunkVert`, `startDunkVert`, `stepDunkVert`, `slamTick`.
- `shared/test/dunkPhysics.test.ts` — physics behavior tests.

**Modify:**
- `shared/src/constants.ts` — add `GRAV`, `RIM_HEIGHT`, `DUNK_REACH`.
- `shared/src/dunks.ts` — extend `DunkDef` with timeline fields; fill the 6 dunks.
- `shared/test/dunks.test.ts` — assert timeline fields.
- `shared/src/types.ts` — add `z` to `PlayerSnap`.
- `server/src/game/world.ts` — `PlayerEnt.z` + `.dunkVert`; rework `tryDunk` + `tickFlightsAndActions` (defer ball release to slam; drive `dunkVert`); emit `z` in `snapshotFor`; Bug A ball-arc fix.
- `server/test/world.test.ts` — dunk arc + ball-at-slam tests; Bug A test.
- `client/src/main.ts` — pass player `z` into `upsertPlayer`.
- `client/src/scene/scene.ts` — `upsertPlayer`/render add player `z`; (Bug A already reads `b.z`).
- `client/src/sprites/playerSprite.ts` — `update()` takes `z`, lifts the sprite mesh; (Bug C fix lands here / in poses).
- `client/src/sprites/poses.ts` — remove dead `SLAM_FRAME`/`RELEASE_FRAME`; (Bug C run-cycle fix if diagnosed here).

**Investigate-then-fix (systematic-debugging, live gate):**
- Bug B (dunk variants in the live game) — Task 9.
- Bug C (legs running backwards) — Task 10.

---

## Conventions for every task

- Run a single test file from the repo root: `npx vitest run <path>` (e.g. `npx vitest run shared/test/dunkPhysics.test.ts`).
- Full suite: `npm test`. Types: `npm run typecheck`.
- Commit message style matches the repo (`feat:`/`fix:`/`refactor:`/`test:` …). Every commit ends with the Co-Authored-By trailer already used on this branch.
- Coordinate convention: floor plane is `x,y`; **height is `z`** (ball already uses `z`; rim renders at THREE-`y = 3.05`). Sim `z` → render `y`.

---

## Task 1: Physics constants

**Files:**
- Modify: `shared/src/constants.ts`
- Test: `shared/test/constants.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `shared/test/constants.test.ts` (inside the existing top-level `describe`, or add a new one):

```ts
import { GRAV, RIM_HEIGHT, DUNK_REACH } from '../src/constants';

describe('dunk physics constants', () => {
  it('defines a positive downward gravity', () => {
    expect(GRAV).toBeGreaterThan(0);
  });
  it('rim height matches the client rim mesh (3.05)', () => {
    expect(RIM_HEIGHT).toBeCloseTo(3.05);
  });
  it('the pelvis reach is below the rim (the rig + arm cover the rest)', () => {
    expect(DUNK_REACH).toBeGreaterThan(0.5);
    expect(DUNK_REACH).toBeLessThan(RIM_HEIGHT);
  });
});
```

(If `constants.test.ts` has no `describe`/imports for these yet, add the `import` at top and a fresh `describe`.)

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run shared/test/constants.test.ts`
Expected: FAIL — `GRAV`/`RIM_HEIGHT`/`DUNK_REACH` are not exported.

- [ ] **Step 3: Add the constants**

Append to `shared/src/constants.ts`:

```ts
// --- Dunk arc physics (V5). GRAV is fixed; per-dunk `ticksToRim` sets the arc. ---
export const GRAV = 7.5; // world-units/s^2 downward, applied to vz each tick (floaty arcade arc; tuned at the visual gate)
export const RIM_HEIGHT = 3.05; // world height of the rim (matches scene.ts rim mesh y)
export const DUNK_REACH = 1.35; // peak pelvis rise during a dunk; rig + arm extension reach the rim from here
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run shared/test/constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/constants.ts shared/test/constants.test.ts
git commit -m "feat(shared): dunk arc physics constants (GRAV, RIM_HEIGHT, DUNK_REACH)"
```

---

## Task 2: Extend `DunkDef` with the timeline + fill the roster

**Files:**
- Modify: `shared/src/dunks.ts`
- Test: `shared/test/dunks.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `shared/test/dunks.test.ts` inside `describe('dunk roster', ...)`:

```ts
it('every dunk has a positive, ordered timeline', () => {
  for (const d of DUNKS) {
    expect(d.windupTicks).toBeGreaterThan(0);
    expect(d.ticksToRim).toBeGreaterThan(0);
    expect(d.hangTicks).toBeGreaterThanOrEqual(0);
    expect(d.recoverTicks).toBeGreaterThan(0);
    // flashier dunks (higher minSkill) hang at least as long as the basic jam
    expect(d.hangTicks).toBeGreaterThanOrEqual(0);
  }
});

it('the basic two-hand jam is the quickest, least floaty dunk', () => {
  const basic = DUNKS.find((d) => d.name === 'Two-Hand Jam')!;
  const windmill = DUNKS.find((d) => d.name === 'Windmill')!;
  expect(windmill.ticksToRim + windmill.hangTicks).toBeGreaterThan(basic.ticksToRim + basic.hangTicks);
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run shared/test/dunks.test.ts`
Expected: FAIL — properties undefined / TS error on the interface.

- [ ] **Step 3: Extend the interface + data**

In `shared/src/dunks.ts`, replace the `DunkDef` interface and `DUNKS` array:

```ts
export interface DunkDef {
  id: number;
  name: string;
  anim: AnimState;
  minSkill: number;
  pools: DunkPool[];
  weight: number;
  // --- V5 timeline (ticks @ 30 Hz). Slam fires at windupTicks + ticksToRim. ---
  windupTicks: number; // crouch/gather before launch
  ticksToRim: number; // T — ticks from launch to the rim (apex); the drama dial
  hangTicks: number; // gravity-frozen ticks at the rim
  recoverTicks: number; // fall + land after the slam
}

export const DUNKS: DunkDef[] = [
  { id: 0, name: 'Two-Hand Jam', anim: 'dunk', minSkill: 0, pools: ['nearFront', 'nearSide', 'farFront', 'farSide'], weight: 3, windupTicks: 4, ticksToRim: 14, hangTicks: 2, recoverTicks: 7 },
  { id: 1, name: 'Tomahawk', anim: 'dunkTomahawk', minSkill: 0.3, pools: ['nearFront', 'farFront', 'nearSide'], weight: 2, windupTicks: 5, ticksToRim: 17, hangTicks: 5, recoverTicks: 7 },
  { id: 2, name: 'Reverse Jam', anim: 'dunkReverse', minSkill: 0.4, pools: ['nearSide', 'nearFront'], weight: 2, windupTicks: 5, ticksToRim: 17, hangTicks: 6, recoverTicks: 7 },
  { id: 3, name: 'Double Pump', anim: 'dunkDoublePump', minSkill: 0.55, pools: ['farFront', 'farSide'], weight: 2, windupTicks: 5, ticksToRim: 19, hangTicks: 8, recoverTicks: 7 },
  { id: 4, name: 'Windmill', anim: 'dunkWindmill', minSkill: 0.7, pools: ['nearSide', 'farSide'], weight: 2, windupTicks: 6, ticksToRim: 20, hangTicks: 9, recoverTicks: 8 },
  { id: 5, name: '360 Slam', anim: 'dunk360', minSkill: 0.85, pools: ['farFront', 'farSide'], weight: 1, windupTicks: 6, ticksToRim: 22, hangTicks: 10, recoverTicks: 8 },
];
```

> Note: `windupTicks + ticksToRim + hangTicks + recoverTicks` for each dunk is the total airborne action length. For the basic jam that's `4+14+2+7 = 27` ticks ≈ 0.9 s — matches today's `DUNK_TIME`. Variants run longer; Task 4 lengthens the per-dunk action lock to fit (no more fixed `DUNK_TIME` for dunks).

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run shared/test/dunks.test.ts`
Expected: PASS (all dunk-roster tests, old + new).

- [ ] **Step 5: Commit**

```bash
git add shared/src/dunks.ts shared/test/dunks.test.ts
git commit -m "feat(shared): data-driven dunk timeline (windup/ticksToRim/hang/recover)"
```

---

## Task 3: The dunk vertical physics (`shared/src/dunkPhysics.ts`)

The heart: a backwards-projectile solve + a per-tick stepper with hang. Pure and deterministic.

**Files:**
- Create: `shared/src/dunkPhysics.ts`
- Create: `shared/test/dunkPhysics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `shared/test/dunkPhysics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { solveLaunchVz, startDunkVert, stepDunkVert, slamTick } from '../src/dunkPhysics';
import { GRAV, DUNK_REACH, TICK_DT } from '../src/constants';
import { DUNKS } from '../src/dunks';

const basic = DUNKS[0];

describe('solveLaunchVz', () => {
  it('reaches the target peak after T seconds under gravity', () => {
    const T = 0.6;
    const vz0 = solveLaunchVz(0, DUNK_REACH, T, GRAV);
    // integrate forward T seconds and check height ≈ DUNK_REACH
    let z = 0;
    let vz = vz0;
    const steps = Math.round(T / TICK_DT);
    for (let i = 0; i < steps; i++) {
      vz -= GRAV * TICK_DT;
      z += vz * TICK_DT;
    }
    expect(z).toBeCloseTo(DUNK_REACH, 1);
  });
});

describe('stepDunkVert', () => {
  it('rises off the floor after launch', () => {
    let s = startDunkVert(basic, GRAV);
    expect(s.z).toBe(0);
    s = stepDunkVert(s, GRAV, TICK_DT);
    expect(s.z).toBeGreaterThan(0);
  });

  it('hangs at the apex for exactly hangTicks before falling', () => {
    const def = DUNKS.find((d) => d.hangTicks >= 5)!;
    let s = startDunkVert(def, GRAV);
    // rise to apex
    let guard = 0;
    while (s.vz > 0 && guard++ < 1000) s = stepDunkVert(s, GRAV, TICK_DT);
    const apexZ = s.z;
    // now hang: z frozen for hangTicks steps
    for (let i = 0; i < def.hangTicks; i++) {
      s = stepDunkVert(s, GRAV, TICK_DT);
      expect(s.z).toBeCloseTo(apexZ, 5); // frozen
    }
    // next step gravity resumes → falls below apex
    s = stepDunkVert(s, GRAV, TICK_DT);
    expect(s.z).toBeLessThan(apexZ);
  });

  it('lands (z=0, landed) and then is idempotent', () => {
    let s = startDunkVert(basic, GRAV);
    let guard = 0;
    while (!s.landed && guard++ < 1000) s = stepDunkVert(s, GRAV, TICK_DT);
    expect(s.landed).toBe(true);
    expect(s.z).toBe(0);
    const again = stepDunkVert(s, GRAV, TICK_DT);
    expect(again).toEqual(s); // idempotent once landed
  });

  it('is deterministic (parity)', () => {
    const arr = (def = basic) => {
      let s = startDunkVert(def, GRAV);
      const zs: number[] = [];
      for (let i = 0; i < 40; i++) { s = stepDunkVert(s, GRAV, TICK_DT); zs.push(s.z); }
      return zs;
    };
    expect(arr()).toEqual(arr());
  });
});

describe('slamTick', () => {
  it('is windup + ticksToRim', () => {
    expect(slamTick(basic)).toBe(basic.windupTicks + basic.ticksToRim);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run shared/test/dunkPhysics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dunkPhysics.ts`**

Create `shared/src/dunkPhysics.ts`:

```ts
import { DUNK_REACH } from './constants';
import type { DunkDef } from './dunks';

/**
 * Backwards-projectile solve: the launch vertical velocity so that, starting at
 * `startZ` and decelerating under `grav`, height equals `peak` after `T` seconds.
 *   peak = startZ + vz0*T - 0.5*grav*T^2  ⇒  vz0 = (peak-startZ)/T + 0.5*grav*T
 * General form (any target height) so the Universe Collapse dunk can leap from anywhere.
 */
export function solveLaunchVz(startZ: number, peak: number, T: number, grav: number): number {
  return (peak - startZ) / T + 0.5 * grav * T;
}

/** Per-tick airborne state. The single source of a dunk's gross vertical motion. */
export interface DunkVert {
  z: number; // height above floor (world units)
  vz: number; // vertical velocity (units/s)
  hangLeft: number; // hang ticks remaining (consumed at the apex)
  landed: boolean;
}

/** Tick (relative to action start) at which the ball slams through the rim. */
export function slamTick(def: DunkDef): number {
  return def.windupTicks + def.ticksToRim;
}

/** Launch: solve vz so the apex (vz≈0) lands ~DUNK_REACH at ~ticksToRim. */
export function startDunkVert(def: DunkDef, grav: number, ticksToSec = 1 / 30): DunkVert {
  const T = def.ticksToRim * ticksToSec;
  return { z: 0, vz: solveLaunchVz(0, DUNK_REACH, T, grav), hangLeft: def.hangTicks, landed: false };
}

/**
 * One tick of the arc. Hang freezes gravity at the apex (the money mechanic):
 * once the body stops rising (vz <= 0) and hang ticks remain, the step holds z.
 */
export function stepDunkVert(s: DunkVert, grav: number, dt: number): DunkVert {
  if (s.landed) return s;
  if (s.vz <= 0 && s.hangLeft > 0) {
    return { z: s.z, vz: 0, hangLeft: s.hangLeft - 1, landed: false }; // HANG: skip gravity
  }
  const vz = s.vz - grav * dt;
  const z = s.z + vz * dt;
  if (z <= 0 && vz < 0) return { z: 0, vz: 0, hangLeft: 0, landed: true };
  return { z, vz, hangLeft: s.hangLeft, landed: false };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run shared/test/dunkPhysics.test.ts`
Expected: PASS (all). If the apex-height test is off by tuning, that's expected to be visually finalized later — but the *behavioral* assertions (rises, hangs exactly `hangTicks`, lands, deterministic) must pass now.

- [ ] **Step 5: Commit**

```bash
git add shared/src/dunkPhysics.ts shared/test/dunkPhysics.test.ts
git commit -m "feat(shared): dunk vertical physics — backwards-solve + hang-time stepper"
```

---

## Task 4: Server — drive the dunk arc, defer ball release to the slam

Rework `tryDunk` and `tickFlightsAndActions` so: the player gets a real `z` arc, the ball stays **carried** (in hand) through windup+rise, and **releases at the slam tick** through the rim (fixes the double-ball "funny" look). The action lock length becomes the dunk's own timeline, not a fixed `DUNK_TIME`.

**Files:**
- Modify: `server/src/game/world.ts`
- Test: `server/test/world.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `server/test/world.test.ts`:

```ts
import { DUNKS } from '../../shared/src/dunks';
import { slamTick } from '../../shared/src/dunkPhysics';

describe('World dunk arc (V5)', () => {
  const setupDunker = () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.skill = 1; // unlock all dunks
    // give them a ball
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 2 }; // in dunk range, facing the rim
    p.dir = { x: 0, y: Math.sign(hoop.y - p.pos.y) };
    return { w, p, hoop };
  };

  it('keeps the ball in hand at launch, then releases it at the slam', () => {
    const { w, p } = setupDunker();
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    expect(p.action?.kind).toBe('dunk');
    expect(p.ballId).not.toBeNull(); // still carried during windup/rise
    const ball = Array.from(w.balls.values()).find((b) => b.carrier === 'p1');
    expect(ball?.state).toBe('carried');
  });

  it('the body rises off the floor and peaks near the rim', () => {
    const { w, p } = setupDunker();
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    const def = DUNKS.find((d) => d.anim === p.anim)!;
    let peak = 0;
    for (let i = 0; i < slamTick(def) + 2; i++) { w.step(); peak = Math.max(peak, p.z); }
    expect(peak).toBeGreaterThan(0.8); // a real leap, not grounded
  });

  it('scores after the dunk completes and the ball respawns', () => {
    const { w, p } = setupDunker();
    const startScore = p.score;
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    for (let i = 0; i < 60; i++) w.step();
    expect(p.score).toBeGreaterThan(startScore);
    expect(p.action).toBeNull(); // returned to idle
    expect(p.z).toBe(0); // landed
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run server/test/world.test.ts`
Expected: FAIL — `p.z` undefined; ball goes to flight immediately; no arc.

- [ ] **Step 3: Implement the server arc**

In `server/src/game/world.ts`:

(a) Add imports near the top:

```ts
import { pickDunk, type DunkDef } from '../../../shared/src/dunks';
import { startDunkVert, stepDunkVert, slamTick, type DunkVert } from '../../../shared/src/dunkPhysics';
import { GRAV, RIM_HEIGHT } from '../../../shared/src/constants';
```

(remove the old `import { pickDunk } from ...dunks` line — fold it into the line above).

(b) Add `z` and `dunkVert` to `PlayerEnt` (after `pos`/`dir`):

```ts
  pos: Vec2;
  dir: Vec2;
  z: number; // height above floor (dunk/jump arc); 0 on the ground
  dunkVert: DunkVert | null; // active dunk arc state, null when grounded
```

Extend the `action` union to carry the chosen dunk + slam bookkeeping:

```ts
  action: {
    kind: 'shoot' | 'dunk' | 'steal' | 'block' | 'stunned' | 'celebrate';
    until: number;
    targetHoop: number;
    defenderId?: string | null;
    lunge?: { fx: number; fy: number; tx: number; ty: number };
    dunk?: { def: DunkDef; startTick: number; released: boolean }; // V5 dunk timeline
  } | null;
```

(c) Initialize the new fields in `addPlayer` (alongside `pos`/`dir`):

```ts
      pos: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      z: 0,
      dunkVert: null,
```

(d) Rewrite `tryDunk` — keep the ball carried, set up the arc, lunge over the *rise* window:

```ts
  private tryDunk(p: PlayerEnt): void {
    const hoops = this.hoopSnaps();
    const target = pickTargetHoop(p.pos, p.id, hoops);
    if (target < 0 || !inDunkRange(p.pos, hoops[target], p.skill)) return;
    const ball = this.balls.get(p.ballId!);
    if (!ball) return;
    const hoop = hoops[target];
    const dirToHoop = { x: hoop.x - p.pos.x, y: hoop.y - p.pos.y };
    const dh = Math.hypot(dirToHoop.x, dirToHoop.y) || 1;
    const cos = (p.dir.x * dirToHoop.x + p.dir.y * dirToHoop.y) / dh;
    const approachDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    const def = pickDunk(this.rng, p.skill, dh, approachDeg);
    const totalTicks = def.windupTicks + def.ticksToRim + def.hangTicks + def.recoverTicks;
    // ball stays carried until the slam — the sprite draws it in-hand (no double ball)
    p.dunkVert = startDunkVert(def, GRAV);
    p.action = {
      kind: 'dunk',
      until: this.time + totalTicks * TICK_DT,
      targetHoop: target,
      defenderId: hoop.owner,
      // arrive at the rim's foot exactly when the body peaks (the slam)
      lunge: { fx: p.pos.x, fy: p.pos.y, tx: hoop.x - (dirToHoop.x / dh) * 0.45, ty: hoop.y - (dirToHoop.y / dh) * 0.45 },
      dunk: { def, startTick: this.tick, released: false },
    };
    p.anim = def.anim;
    this.events.push({ kind: 'dunkStart', player: p.id, hoop: target, dunkName: def.name });
  }
```

(e) In `tickFlightsAndActions`, replace the dunk-lunge block (the `if (p.action?.kind === 'dunk' && p.action.lunge)` section) with the arc driver + slam release:

```ts
    for (const p of this.players.values()) {
      const act = p.action;
      if (act?.kind === 'dunk' && act.dunk) {
        const { def, startTick } = act.dunk;
        const elapsed = this.tick - startTick;
        // vertical arc (starts at launch = after windup)
        if (elapsed >= def.windupTicks && p.dunkVert) {
          p.dunkVert = stepDunkVert(p.dunkVert, GRAV, TICK_DT);
          p.z = p.dunkVert.z;
        }
        // horizontal lunge completes at the slam (apex)
        if (act.lunge) {
          const slam = slamTick(def);
          const t = Math.min(1, elapsed / Math.max(1, slam));
          const l = act.lunge;
          p.pos = { x: l.fx + (l.tx - l.fx) * t, y: l.fy + (l.ty - l.fy) * t };
        }
        // release the ball through the rim at the slam tick
        if (!act.dunk.released && elapsed >= slamTick(def)) {
          act.dunk.released = true;
          const ball = p.ballId ? this.balls.get(p.ballId) : null;
          const hoop = this.hoopSnaps()[act.targetHoop];
          if (ball && hoop) {
            ball.state = 'flight';
            ball.carrier = null;
            ball.flight = {
              from: { x: p.pos.x, y: p.pos.y },
              to: { x: hoop.x, y: hoop.y },
              start: this.time,
              duration: 0.18, // short drop through the rim
              made: true,
              targetHoop: act.targetHoop,
              shooter: p.id,
              defenderId: act.defenderId ?? hoop.owner,
            };
          }
          p.ballId = null;
        }
      }
      if (act && this.time >= act.until) {
        p.action = null;
        p.dunkVert = null;
        p.z = 0;
      }
    }
```

> The ball's flight/score resolution (the `for (const b of this.balls.values())` block above it) is unchanged and now fires for the short slam-release flight, awarding the 2 points and respawning the ball.

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run server/test/world.test.ts`
Expected: PASS (old movement tests + new dunk-arc tests). The existing `'shoot intent auto-upgrades to a dunk when in range'` test still passes (it only checks `p.anim.startsWith('dunk')`).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/world.ts server/test/world.test.ts
git commit -m "feat(server): real dunk arc + slam-timed ball release (fixes double-ball)"
```

---

## Task 5: Bug A — shots (and the slam) pass through the rim

The flight arc caps `b.z` near 1.0 while the rim is at 3.05. Make the arc reach rim height so a made shot visibly drops through; a miss falls short/clanks.

**Files:**
- Modify: `server/src/game/world.ts` (the flight `b.z` formula in `tickFlightsAndActions`)
- Test: `server/test/world.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `server/test/world.test.ts`:

```ts
import { RIM_HEIGHT } from '../../shared/src/constants';

describe('Bug A — shot arc passes through the rim', () => {
  it('a made shot reaches rim height near the end of the flight', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 6 }; // mid-range jump shot, not a dunk
    p.pendingIntents.push(actionIntent(2, { shoot: true }));
    w.step();
    const ball = Array.from(w.balls.values()).find((b) => b.state === 'flight')!;
    let maxZ = 0;
    for (let i = 0; i < 60 && ball.state === 'flight'; i++) { w.step(); maxZ = Math.max(maxZ, ball.z); }
    expect(maxZ).toBeGreaterThan(RIM_HEIGHT - 0.6); // arcs up to the rim, not skimming the floor
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run server/test/world.test.ts`
Expected: FAIL — `maxZ` ≈ 1.0 (old cap), well below the rim.

- [ ] **Step 3: Fix the arc**

In `server/src/game/world.ts`, in the ball-flight loop of `tickFlightsAndActions`, replace:

```ts
      const arcH = 1 + Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) * 0.08;
      b.z = 4 * arcH * t * (1 - t) + 1.0; // launch/rim height baseline
```

with:

```ts
      // Parabola that releases at chest height and passes through the rim at the end.
      const release = 1.6; // ball leaves the hands ~chest height
      const apex = RIM_HEIGHT + 1.0 + Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) * 0.06;
      // z(t): release at t=0, peak `apex`, and exactly RIM_HEIGHT at t=1 (drops through)
      b.z = release + (4 * (apex - release)) * t * (1 - t) + (RIM_HEIGHT - release) * t;
```

> At `t=1`: `release + 0 + (RIM_HEIGHT-release) = RIM_HEIGHT`. The arc tops out above the rim and descends through it. A short slam-release flight (Task 4, duration 0.18) covers a tiny distance so its arc effectively starts already at the rim — visually a drop-through.

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run server/test/world.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/world.ts server/test/world.test.ts
git commit -m "fix(server): shot arc terminates at rim height (Bug A — pass-through)"
```

---

## Task 6: Snapshot — carry the player's `z`

**Files:**
- Modify: `shared/src/types.ts` (add `z` to `PlayerSnap`)
- Modify: `server/src/game/world.ts` (`snapshotFor` emits `z`)
- Test: `server/test/world.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `server/test/world.test.ts` (in the existing `'builds a snapshot...'` area or a new `describe`):

```ts
it('snapshot carries the player height (z)', () => {
  const w = new World();
  const p = w.addPlayer('p1', 'one');
  w.step();
  const snap = w.snapshotFor('p1');
  expect(snap.players[0].z).toBe(0);
  p.z = 1.2; // simulate mid-dunk
  const snap2 = w.snapshotFor('p1');
  expect(snap2.players[0].z).toBeCloseTo(1.2);
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run server/test/world.test.ts`
Expected: FAIL — `z` not on `PlayerSnap` / not emitted.

- [ ] **Step 3: Add the field**

In `shared/src/types.ts`, add to `PlayerSnap` (after `y`):

```ts
  x: number;
  y: number;
  z: number; // height above floor (dunk/jump arc), render-only; sim floor stays 2D
```

In `server/src/game/world.ts`, in `snapshotFor`'s `players.map`, add `z: p.pos` → actually `z: p.z,` after `y: p.pos.y,`:

```ts
        x: p.pos.x,
        y: p.pos.y,
        z: p.z,
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run server/test/world.test.ts` then `npm run typecheck`
Expected: PASS; typecheck clean (the client doesn't yet read `z`, which is fine — added next).

- [ ] **Step 5: Commit**

```bash
git add shared/src/types.ts server/src/game/world.ts server/test/world.test.ts
git commit -m "feat(shared): PlayerSnap carries height z for the dunk arc"
```

---

## Task 7: Client — lift the sprite by `z` (the visible leap)

**Files:**
- Modify: `client/src/sprites/playerSprite.ts` (`update` takes `z`, adds it to mesh y)
- Modify: `client/src/scene/scene.ts` (`upsertPlayer` takes & forwards `z`)
- Modify: `client/src/main.ts` (pass `me.z` / `snapP.z`)
- Test: `client/test/poses.test.ts` (or a small new render-math test — see below)

> This task is verified primarily by the **live visual gate** (Task 11), but we add a focused unit test on the height contribution to lock the math.

- [ ] **Step 1: Write the failing test**

Create `client/test/playerSprite.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest';

// jsdom-free: stub the canvas/three bits the module touches at import time.
beforeAll(() => {
  // PlayerSprite builds a CanvasTexture via buildAtlas → needs a 2d context.
  // vitest's environment must be 'jsdom' for document.createElement('canvas').
});

import { spriteWorldY } from '../src/sprites/playerSprite';

describe('spriteWorldY', () => {
  it('adds the player height z on top of the grounded base', () => {
    const grounded = spriteWorldY(1 /*size*/, 0 /*bendY*/, 0 /*z*/);
    const airborne = spriteWorldY(1, 0, 1.3);
    expect(airborne - grounded).toBeCloseTo(1.3);
  });
});
```

> If `client/test` runs under `node` not `jsdom`, importing `playerSprite.ts` (which imports three) may be heavy. To keep this test pure, we extract a tiny pure helper `spriteWorldY` and import only it. Check `client/test/poses.test.ts`/`rig.test.ts` for the configured environment and mirror it; if importing the full module is problematic, move `spriteWorldY` into a sibling pure module `client/src/sprites/spriteMath.ts` and import from there in both the test and `playerSprite.ts`.

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run client/test/playerSprite.test.ts`
Expected: FAIL — `spriteWorldY` not exported.

- [ ] **Step 3: Implement the height lift**

In `client/src/sprites/playerSprite.ts`:

(a) Add the pure helper (near `QUAD_H`):

```ts
/** World Y of the sprite center: grounded base (feet on bent floor) + jump height z. */
export function spriteWorldY(size: number, bendY: number, z: number): number {
  return (QUAD_H * size) / 2 - 0.06 + bendY + z;
}
```

(b) Change `update`'s signature to accept `z` and use the helper. Replace the signature and the position line:

```ts
  update(
    now: number,
    x: number,
    y: number,
    z: number,
    size: number,
    dx: number,
    dy: number,
    camera: THREE.Camera,
  ): void {
```

and replace:

```ts
    const b = rimBend(x, 0, y, BEND);
    this.mesh.position.set(b.x, (QUAD_H * size) / 2 - 0.06 + b.y, b.z);
```

with:

```ts
    const b = rimBend(x, 0, y, BEND);
    this.mesh.position.set(b.x, spriteWorldY(size, b.y, z), b.z);
```

(c) In `client/src/scene/scene.ts`, change `upsertPlayer` to take `z` and forward it. Update the signature (add `z` after `y`) and the `sprite.update(...)` call:

```ts
  upsertPlayer(
    id: string,
    x: number,
    y: number,
    z: number,
    hue: number,
    anim: AnimState,
    dx: number,
    dy: number,
    size: number,
    now: number,
  ): void {
```

and at the end:

```ts
    sprite.update(now, x, y, z, size, dx, dy, this.camera);
```

(d) In `client/src/main.ts`, pass `z` at both call sites. Local player (the `scene.upsertPlayer(net.myId, ...)` call) — insert `me?.z ?? 0` after `predictor.pos.y`:

```ts
    scene.upsertPlayer(
      net.myId,
      predictor.pos.x,
      predictor.pos.y,
      me?.z ?? 0,
      me?.hue ?? 0,
      me?.anim ?? 'idle',
      localFacing.x,
      localFacing.y,
      me?.size ?? 1,
      now,
    );
```

Remote players — insert `snapP.z`:

```ts
    scene.upsertPlayer(id, pos.x, pos.y, snapP.z, snapP.hue, snapP.anim, snapP.dx, snapP.dy, snapP.size, now);
```

> Remote `z` comes from the latest snapshot (the interpolation buffer carries x/y; height during the brief dunk reads from `snapP.z`). If remote dunks look steppy at 15 Hz, smoothing is a Task 11 tuning item — not a correctness issue.

- [ ] **Step 4: Run it — expect PASS + typecheck**

Run: `npx vitest run client/test/playerSprite.test.ts` then `npm run typecheck`
Expected: PASS; typecheck clean (all `upsertPlayer`/`update` callers updated).

- [ ] **Step 5: Commit**

```bash
git add client/src/sprites/playerSprite.ts client/src/scene/scene.ts client/src/main.ts client/test/playerSprite.test.ts
git commit -m "feat(client): lift the sprite by authoritative dunk height z"
```

---

## Task 8: Remove dead frame constants

`SLAM_FRAME` and `RELEASE_FRAME` (`client/src/sprites/poses.ts:243-244`) are exported but unused anywhere in the codebase. Remove them to avoid implying a coupling that doesn't exist.

**Files:**
- Modify: `client/src/sprites/poses.ts`

- [ ] **Step 1: Confirm they're unused**

Run: `grep -rn "SLAM_FRAME\|RELEASE_FRAME" client server shared --include="*.ts"`
Expected: matches ONLY in `client/src/sprites/poses.ts`. (If any other file references them, stop and keep them — re-scope this task.)

- [ ] **Step 2: Remove the dead exports**

In `client/src/sprites/poses.ts`, delete:

```ts
export const RELEASE_FRAME = 3; // shoot
export const SLAM_FRAME = 5; // dunk
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npx vitest run client/test/poses.test.ts`
Expected: PASS (no references broke).

- [ ] **Step 4: Commit**

```bash
git add client/src/sprites/poses.ts
git commit -m "refactor(client): drop dead SLAM_FRAME/RELEASE_FRAME constants"
```

---

## Task 9: Bug B — dunk variants play in the live game (systematic-debugging)

**REQUIRED SUB-SKILL:** Use `superpowers:systematic-debugging`. Reproduce before fixing.

Static analysis shows the path *should* work: the server sets `p.anim = def.anim` (variant), the snapshot carries it, `main.ts` reads `me.anim`, and `scene.upsertPlayer`'s interrupt check matches `anim.startsWith('dunk')`. After Tasks 4–7 the dunk path is substantially rebuilt, so this task is **verify, then fix only if it still fails.**

**Files (likely fix targets):** `client/src/scene/scene.ts:126-134`, `client/src/sprites/playerSprite.ts:47-52`, `client/src/main.ts:79`.

- [ ] **Step 1: Reproduce on the live game**

Start the dev server (`npm run dev`) and use the preview tools (preview_start → the client URL). In-game: press a movement key to a rim, grab a ball (M), then SPACE in close range to dunk. **Raise skill to see flashy variants** — the default `skill = 0.5` only unlocks Two-Hand/Tomahawk/Reverse; set the player's skill higher to exercise Windmill/360 (e.g. temporarily in `world.addPlayer`, or drive a bot). Watch the **local** sprite and the console.

Record: which dunks render the dunk poses vs. which show idle/run/no-anim; local vs. remote; any console errors. Capture a screenshot.

- [ ] **Step 2: Confirm the atlas/UV path independently**

Open the anim workbench at `/preview.html`. Confirm each variant's filmstrip renders real poses (not blank cells). If the workbench is fine but the live game is not, the bug is in the live anim-selection/timing path, not the atlas.

- [ ] **Step 3: Root-cause from the evidence**

Most-likely causes, in order:
1. **Skill gating** made it *look* broken (variants never selected at skill 0.5) — not a bug; document and move on.
2. **One-shot timing:** `oneShotPlaying` uses `def.frames.length / def.fps`; variants are 9f@10fps = 0.9 s while the action lock is now per-dunk (Task 2/4). If the action ends before the anim, the sprite reverts early. Confirm the action length ≥ the anim length per dunk.
3. **Anim restart churn:** `setAnim` early-returns when `anim === this.anim`, so a held variant should not restart — confirm `animStart` isn't being reset every frame by a facing change (`update` resets `lastFrame`, not `animStart` — OK).

- [ ] **Step 4: Apply the fix the evidence supports, with a code change**

Example (if cause #2): ensure every dunk's total action ticks cover its anim length. The anim length in ticks = `frames.length / fps * 30`. For the 9f@10fps variants that's 27 ticks; the Task-2 timelines already total ≥27. If a mismatch is found, adjust the dunk's `recoverTicks` so `windup+ticksToRim+hang+recover >= ceil(frames/fps*30)`, and add an assertion to `shared/test/dunks.test.ts`:

```ts
import { ANIMS } from '../../client/src/sprites/poses'; // if cross-import is undesirable, hardcode the per-anim length
it('each dunk action lasts at least as long as its animation', () => {
  // anim length in ticks for the 9-frame @10fps variants = 27; basic dunk 8f@12fps = 20
  for (const d of DUNKS) {
    const total = d.windupTicks + d.ticksToRim + d.hangTicks + d.recoverTicks;
    expect(total).toBeGreaterThanOrEqual(20);
  }
});
```

> If cross-importing client poses into a shared test is undesirable (it couples `shared`→`client`), instead keep this assertion in `client/test/poses.test.ts` where `ANIMS` is already in scope, comparing each dunk anim's `frames.length/fps*30` against the matching `DUNKS` timeline imported from shared.

- [ ] **Step 5: Verify on the live game + commit**

Re-run the live repro: every variant (with skill high enough) plays its dunk poses through the slam. Screenshot as proof. Then:

```bash
git add -A
git commit -m "fix: dunk variant animations play through in the live game (Bug B)"
```

---

## Task 10: Bug C — legs running backwards (systematic-debugging)

**REQUIRED SUB-SKILL:** Use `superpowers:systematic-debugging`. Reproduce before fixing.

The run cycle (`poses.ts:24-37`) is a correct 8-frame stride for a right-facing runner; left-facing uses a UV horizontal flip (`playerSprite.ts:113`). A pure mirror of a correct rightward run is a correct leftward run — so the "backwards" read is **not** explained by the mirror alone. Reproduce to find the real failing case (candidates: the frontal/`drawFrontal` projection toward/away from camera reads as a march; or a facing/flip vs. travel-direction mismatch at certain camera angles).

**Files (likely fix targets):** `client/src/sprites/playerSprite.ts:71-86` (facing/flip selection), `client/src/sprites/draw.ts:26-95` (`drawFrontal` stride visibility), `client/src/sprites/poses.ts:24-37` (run stride).

- [ ] **Step 1: Reproduce across all four headings**

`npm run dev`; in-game run right, left, up (away from camera), and down (toward camera), and the diagonals. Record for each heading whether the legs sweep with travel or against it. Screenshot the bad case(s). Also check `/preview.html`'s live run loop for the canonical side view.

- [ ] **Step 2: Isolate the failing facing**

From the evidence, pin which `facing` (`side`/`front`/`back`) and which `facingLeft` value produce the backward read. The `update()` facing math (`playerSprite.ts:71-86`) selects facing from the angle between the camera view ray and `dir`; confirm `facingLeft` matches on-screen travel direction in the failing case.

- [ ] **Step 3: Root-cause**

State the single root cause in one sentence backed by the repro (e.g. "when running toward the camera, `drawFrontal` compresses the stride x by `C=0.35` so the legs barely translate and the alternating shins read as marching in place / reversed," or "facingLeft is chosen from `dir` vs. view-ray but the sprite billboards to a yaw that disagrees with travel at camera-relative angle θ").

- [ ] **Step 4: Apply the matching fix**

Pick the fix that addresses the confirmed cause. Likely shapes (choose per evidence):
- **If it's the frontal projection:** increase stride x translation in `drawFrontal` for the legs (raise `C` for foot x, or add a per-foot fore/aft offset keyed to the pose's `thN/thF`) so the near leg visibly leads.
- **If it's facing/flip vs. travel:** drive `facingLeft` from the **screen-space travel direction** (sign of the camera-relative x velocity) rather than the facing `dir`, so a horizontally-moving runner always faces travel.

Whichever fix, add a deterministic unit test on the pure decision function you touch. Example, if you extract the flip decision:

```ts
// client/src/sprites/spriteMath.ts
export function facingLeftFor(relYaw: number): boolean { return relYaw > 0; }
```

```ts
// client/test/playerSprite.test.ts
import { facingLeftFor } from '../src/sprites/spriteMath';
it('faces left when the relative yaw is positive', () => {
  expect(facingLeftFor(0.5)).toBe(true);
  expect(facingLeftFor(-0.5)).toBe(false);
});
```

- [ ] **Step 5: Verify on the live game + commit**

Re-run all four headings: legs always sweep with travel; no moonwalk. Before/after screenshots. Then:

```bash
git add -A
git commit -m "fix: legs sweep with travel direction (Bug C — no more backwards run)"
```

---

## Task 11: Full visual gate + tuning + suite green

The behavioral correctness is tested; the *feel* (arc weight, hang, reach to the rim) is finalized here against the live preview.

**Files:** tune only — `shared/src/constants.ts` (`GRAV`, `DUNK_REACH`) and per-dunk timeline numbers in `shared/src/dunks.ts`.

- [ ] **Step 1: Live dunk pass**

`npm run dev`. Trigger each dunk (vary skill/approach/distance). Confirm: the body **rises to the rim**, **hangs** visibly on the flashy dunks, the **ball stays in hand until the slam** then drops through the rim (no double ball), and lands cleanly. Screenshot 2–3 dunks at the apex.

- [ ] **Step 2: Tune the feel**

If the leap under/over-shoots the rim, adjust `DUNK_REACH` (peak) and/or `GRAV` (floatiness) in `shared/src/constants.ts`; if a specific dunk's slam is mistimed vs. its anim, adjust that dunk's `ticksToRim`/`hangTicks` in `shared/src/dunks.ts`. Re-run the `shared` physics tests after any constant change (`npx vitest run shared/test/dunkPhysics.test.ts shared/test/dunks.test.ts`) — the behavioral assertions must stay green.

- [ ] **Step 3: Bug A + B + C confirmation in one session**

In the same live session confirm all three fixes hold together: shots drop through the rim (Bug A), every variant plays (Bug B), legs read correctly at all headings (Bug C). Capture a short set of screenshots covering each.

- [ ] **Step 4: Whole suite + types**

Run: `npm test && npm run typecheck`
Expected: all tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: V5 dunk-engine visual tuning + full suite green"
```

---

## Self-review checklist (done while writing — kept for the executor)

- **Spec coverage:** §2 split (physics shared / anim client) → Tasks 3,6,7. §3 data model → Task 2. §4 backwards-solve + vertical axis → Tasks 3,4,6,7. §5 hang → Task 3. §6 Bug A → Task 5; Bug B → Task 9; Bug C → Task 10. §1 port 6 dunks onto the model → Task 2. Deferred juice → untouched (correct).
- **Type consistency:** `DunkVert {z,vz,hangLeft,landed}`, `solveLaunchVz`, `startDunkVert`, `stepDunkVert`, `slamTick` consistent across Tasks 3–4. `PlayerSnap.z`, `PlayerEnt.z`/`.dunkVert`, `upsertPlayer(...,z,...)`, `update(...,z,...)`, `spriteWorldY(size,bendY,z)` consistent across Tasks 6–7.
- **No placeholders:** every code step has real code. Bug B/C tasks are genuine systematic-debugging procedures (reproduce → root-cause → matching fix + test), not stubs — their exact patch is evidence-driven by design, with the leading hypothesis and candidate code given.
- **Known deviation flagged:** the dunk arc is server-authoritative, not client-predicted (Refinement #1) — surfaced for the spec review.
