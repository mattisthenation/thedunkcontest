# RIMVERSE M6: Dunk Roster + Contextual Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A roster of six named dunks selected NBA-Jam-TE-style (distance bucket × approach angle pools, skill-gated, weighted-random), with a dunk lunge toward the rim — plus the user-requested control consolidation (Space auto-dunks in range, E defends when there's nothing to grab).

**Architecture:** Mined structure from the TE source (`DUNKS.ASM`): 13 dunks selected from per-direction pools split by near/far rim distance, ~7 ticks/frame (≈8.5 fps) with hang frames. Ours: `shared/src/dunks.ts` holds the table + `pickDunk(rng, skill, dist, approachDeg)`; the server stores the picked variant in the action and broadcasts it as the anim string (no protocol change); the client gets five new authored dunk rows on the existing rig. Names come from the spec's list (TE labels are anonymous A–M).

**Tech Stack:** unchanged.

**User feedback folded in:** "WASD works for direction, but it gets tight for other actions." Space already shoots; the fix is needing fewer keys: Space auto-upgrades to a dunk in range, E grabs OR steals/blocks contextually. F/Q remain as explicit aliases.

---

### Task 1: Contextual controls (TDD)

**Files:**
- Modify: `server/src/game/world.ts` (intent routing), `client/src/main.ts` (HUD line)
- Test: `server/test/world.test.ts` (extend)

- [x] **Step 1: Failing tests** — append to `server/test/world.test.ts` (reuse that file's `intent()` helper, extending it with `defend`/`turbo` fields if absent):

```ts
it('shoot intent auto-upgrades to a dunk when in range', () => {
  const w = new World();
  const p = w.addPlayer('p1', 'one');
  p.pos = { x: 0, y: 0 };
  p.pendingIntents.push(intent(1, { grab: true }));
  w.step();
  const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
  p.pos = { x: hoop.x, y: hoop.y - 2 };
  p.pendingIntents.push(intent(2, { shoot: true }));
  w.step();
  expect(p.anim.startsWith('dunk')).toBe(true);
});

it('grab intent with no free ball nearby falls through to defend (steal)', () => {
  const w = new World();
  const c = w.addPlayer('carrier', 'c');
  const d = w.addPlayer('defender', 'd');
  c.pos = { x: 30, y: 0 }; // far from the hub ball
  d.pos = { x: 30.8, y: 0 };
  c.pendingIntents.push(intent(1, { grab: true }));
  w.step(); // carrier fails to grab (too far) — give them the ball directly
  const ball = Array.from(w.balls.values())[0];
  ball.state = 'carried';
  ball.carrier = 'carrier';
  c.ballId = ball.id;
  w.rng = () => 0; // force steal success
  d.pendingIntents.push(intent(1, { grab: true })); // E, not Q
  w.step();
  expect(d.anim).toBe('steal');
  expect(c.ballId).toBeNull();
});
```

- [x] **Step 2: RED**

- [x] **Step 3: Implement** — in `world.ts` intent handling:

```ts
if (intent.shoot && p.ballId) {
  // Space: flashier wins — dunk when in range, otherwise shoot
  const hoops = this.hoopSnaps();
  const target = pickTargetHoop(p.pos, p.id, hoops);
  if (target >= 0 && inDunkRange(p.pos, hoops[target], p.skill)) this.tryDunk(p);
  else this.startShoot(p);
} else if (intent.dunk && p.ballId) this.tryDunk(p);
else if ((intent.defend || intent.grab) && !p.ballId) {
  if (intent.grab) p.wantsGrab = true;
  // E falls through to defend only when no free ball is within grab reach
  const grabbable = Array.from(this.balls.values()).some(
    (b) => b.state === 'free' && Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y) <= GRAB_RADIUS,
  );
  if (intent.defend || !grabbable) this.tryDefend(p);
}
```
(`wantsGrab ||= intent.grab` moves into this branch; import `GRAB_RADIUS`.) HUD: `WASD move · SHIFT turbo · E grab/steal/block · SPACE shoot (dunks in close)`.

- [x] **Step 4: GREEN + Commit** — `git commit -m "feat: contextual controls - Space auto-dunks, E defends when nothing to grab"`

### Task 2: Dunk table + selection (shared, TDD)

**Files:**
- Create: `shared/src/dunks.ts`
- Test: `shared/test/dunks.test.ts`
- Modify: `shared/src/types.ts` (AnimState union)

- [x] **Step 1: Failing test** — `shared/test/dunks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DUNKS, pickDunk } from '../src/dunks';
import { mulberry32 } from '../src/rng';

describe('dunk roster', () => {
  it('has six named dunks with anim rows', () => {
    expect(DUNKS.length).toBe(6);
    for (const d of DUNKS) {
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.anim.startsWith('dunk')).toBe(true);
    }
  });

  it('low skill only gets the basic jam; high skill unlocks the flashy set', () => {
    const rng = mulberry32(7);
    const low = new Set<string>();
    const high = new Set<string>();
    for (let i = 0; i < 200; i++) {
      low.add(pickDunk(rng, 0.1, 1.0, 0).name);
      high.add(pickDunk(rng, 1.0, 1.0, 0).name);
    }
    expect(low.size).toBeLessThanOrEqual(2);
    expect(high.size).toBeGreaterThanOrEqual(3);
  });

  it('approach angle biases the pool (side approaches reach windmill/reverse)', () => {
    const rng = mulberry32(11);
    const side = new Set<string>();
    for (let i = 0; i < 300; i++) side.add(pickDunk(rng, 1.0, 1.0, 80).name);
    expect(side.has('Windmill')).toBe(true);
  });

  it('is deterministic under a seeded rng and always returns a dunk', () => {
    const a = pickDunk(mulberry32(3), 0.6, 2.5, 30);
    const b = pickDunk(mulberry32(3), 0.6, 2.5, 30);
    expect(a).toEqual(b);
    expect(pickDunk(mulberry32(1), 0, 99, 180)).toBeDefined();
  });
});
```

- [x] **Step 2: RED**, then implement `shared/src/dunks.ts`:

```ts
import { DUNK_RANGE } from './constants';
import type { AnimState } from './types';

export type DunkPool = 'nearFront' | 'nearSide' | 'farFront' | 'farSide';

export interface DunkDef {
  id: number;
  name: string;
  anim: AnimState;
  minSkill: number;
  pools: DunkPool[];
  weight: number;
}

/**
 * Roster shaped after NBA Jam TE's DUNKS.ASM: pools keyed by near/far rim
 * distance and approach direction; flashier entries gated by skill (the spec's
 * rule — TE gated via the DUNKS attribute). Names from the spec's list.
 */
export const DUNKS: DunkDef[] = [
  { id: 0, name: 'Two-Hand Jam', anim: 'dunk', minSkill: 0, pools: ['nearFront', 'nearSide', 'farFront', 'farSide'], weight: 3 },
  { id: 1, name: 'Tomahawk', anim: 'dunkTomahawk', minSkill: 0.3, pools: ['nearFront', 'farFront', 'nearSide'], weight: 2 },
  { id: 2, name: 'Reverse Jam', anim: 'dunkReverse', minSkill: 0.4, pools: ['nearSide', 'nearFront'], weight: 2 },
  { id: 3, name: 'Double Pump', anim: 'dunkDoublePump', minSkill: 0.55, pools: ['farFront', 'farSide'], weight: 2 },
  { id: 4, name: 'Windmill', anim: 'dunkWindmill', minSkill: 0.7, pools: ['nearSide', 'farSide'], weight: 2 },
  { id: 5, name: '360 Slam', anim: 'dunk360', minSkill: 0.85, pools: ['farFront', 'farSide'], weight: 1 },
];

/**
 * TE-style selection: distance bucket × approach angle picks the pool, skill
 * gates the candidates, weighted random keeps it surprising.
 * approachDeg: |angle| between the player's facing and the direction to the rim.
 */
export function pickDunk(rng: () => number, skill: number, dist: number, approachDeg: number): DunkDef {
  const bucket = dist <= DUNK_RANGE * 0.55 ? 'near' : 'far';
  const face = Math.abs(approachDeg) > 40 ? 'Side' : 'Front';
  const pool = (bucket + face) as DunkPool;
  const candidates = DUNKS.filter((d) => d.minSkill <= skill && d.pools.includes(pool));
  if (candidates.length === 0) return DUNKS[0];
  const total = candidates.reduce((s, d) => s + d.weight, 0);
  let roll = rng() * total;
  for (const d of candidates) {
    roll -= d.weight;
    if (roll <= 0) return d;
  }
  return candidates[candidates.length - 1];
}
```

AnimState union += `'dunkTomahawk' | 'dunkWindmill' | 'dunkDoublePump' | 'dunkReverse' | 'dunk360'`.

- [x] **Step 3: GREEN + Commit** — `git commit -m "feat(shared): TE-style dunk table + selection (TDD)"`

### Task 3: Server — variant selection + dunk lunge (TDD)

**Files:**
- Modify: `server/src/game/world.ts` (tryDunk, lunge in tickFlightsAndActions), `shared/src/types.ts` (GameEvent dunkName)
- Test: `server/test/shooting.test.ts` (extend)

- [x] **Step 1: Failing tests** — append:

```ts
it('dunk picks a variant anim and lunges toward the rim', () => {
  const { w, p } = setupCarrier();
  p.skill = 1; // full roster
  const hoop = w.hoopSnaps().find((h) => h.owner !== 'me')!;
  p.pos = { x: hoop.x, y: hoop.y - 2.5 };
  const startDist = Math.hypot(p.pos.x - hoop.x, p.pos.y - hoop.y);
  p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: false, dunk: true });
  w.step();
  expect(p.anim.startsWith('dunk')).toBe(true);
  for (let i = 0; i < 15; i++) w.step(); // half the dunk
  const midDist = Math.hypot(p.pos.x - hoop.x, p.pos.y - hoop.y);
  expect(midDist).toBeLessThan(startDist); // lunging in
});

it('variants vary across dunks for a skilled player', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 12; seed++) {
    const w = new World();
    w.rng = mulberry32(seed);
    const p = w.addPlayer('me', 'me');
    p.pos = { x: 0, y: 0 };
    p.skill = 1;
    p.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'me')!;
    p.pos = { x: hoop.x + 2, y: hoop.y - 1.5 }; // angled approach
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: false, dunk: true });
    w.step();
    seen.add(p.anim);
  }
  expect(seen.size).toBeGreaterThanOrEqual(2);
});
```
(import `mulberry32` from shared in the test file)

- [x] **Step 2: RED**, then implement in `world.ts`:

`tryDunk` after the range check:
```ts
    const dirToHoop = { x: hoop.x - p.pos.x, y: hoop.y - p.pos.y };
    const dh = Math.hypot(dirToHoop.x, dirToHoop.y) || 1;
    const cos = (p.dir.x * dirToHoop.x + p.dir.y * dirToHoop.y) / dh;
    const approachDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    const dunk = pickDunk(this.rng, p.skill, dh, approachDeg);
    ...
    p.action = {
      kind: 'dunk', until: this.time + ACTION_TIMES.dunk, targetHoop: target,
      lunge: {
        fx: p.pos.x, fy: p.pos.y,
        tx: hoop.x - (dirToHoop.x / dh) * 0.7, ty: hoop.y - (dirToHoop.y / dh) * 0.7,
      },
    };
    p.anim = dunk.anim;
    this.events.push({ kind: 'dunkStart', player: p.id, hoop: target, dunkName: dunk.name });
```
Action type gains optional `lunge?: { fx: number; fy: number; tx: number; ty: number }`; GameEvent gains `dunkName?: string`. In `tickFlightsAndActions`, before expiry handling:
```ts
    for (const p of this.players.values()) {
      if (p.action?.kind === 'dunk' && p.action.lunge) {
        const total = ACTION_TIMES.dunk;
        const t = Math.min(1, (total - (p.action.until - this.time)) / (total * 0.7));
        const l = p.action.lunge;
        p.pos = { x: l.fx + (l.tx - l.fx) * t, y: l.fy + (l.ty - l.fy) * t };
      }
      if (p.action && this.time >= p.action.until) p.action = null;
    }
```
(replaces the existing expiry loop).

- [x] **Step 3: GREEN + Commit** — `git commit -m "feat(server): dunk variant selection + rim lunge (TDD)"`

### Task 4: Five authored dunk variants (client) + verify

**Files:**
- Modify: `client/src/sprites/poses.ts` (5 new tables), `client/test/atlas.test.ts` (rowCount 10→15), `client/src/scene/scene.ts` (one-shot interrupts cover `anim.startsWith('dunk')`)

- [x] **Step 1: Author the variants** — all 9 frames @ 10 fps one-shot (matches DUNK_TIME 0.9 s; TE cadence ≈7 ticks/frame with hang holds → our hang lives in frames 3–5). Shared shape: gather(0–1) → leap(2) → trick(3–5, the identity of the dunk) → slam(6) → fall(7) → land(8). Tables in full:

```ts
/** Tomahawk: one arm cocks deep behind the head, chops through. */
const dunkTomahawk: AnimDef = { fps: 10, loop: false, frames: [
  P({ rootY: 0.43, lean: 10, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 30, faN: 50, uaF: -10, faF: 30, ball: 'handN' }),
  P({ rootY: 0.50, lean: 6, thN: 18, shN: 20, thF: -22, shF: 44, uaN: 70, faN: 60, uaF: -20, faF: 40, ball: 'handN' }),
  P({ rootY: 0.68, lean: -2, thN: 30, shN: 50, thF: -10, shF: 60, uaN: 130, faN: 70, uaF: -24, faF: 44, ball: 'handN' }),
  P({ rootY: 0.80, lean: -10, thN: 26, shN: 62, thF: -6, shF: 66, uaN: 195, faN: 55, uaF: -28, faF: 40, ball: 'handN' }), // deep cock
  P({ rootY: 0.82, lean: -12, thN: 24, shN: 60, thF: -8, shF: 62, uaN: 205, faN: 45, uaF: -26, faF: 38, ball: 'handN' }), // hang
  P({ rootY: 0.80, lean: -6, thN: 22, shN: 56, thF: -8, shF: 58, uaN: 160, faN: 25, uaF: -20, faF: 34, ball: 'handN' }), // whip begins
  P({ rootY: 0.74, lean: 8, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 85, faN: 8, uaF: -10, faF: 30 }),                  // SLAM
  P({ rootY: 0.55, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 45, faN: 16, uaF: 0, faF: 24 }),
  P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
]};

/** Windmill: the arm sweeps a full circle — down, back, over the top. */
const dunkWindmill: AnimDef = { fps: 10, loop: false, frames: [
  P({ rootY: 0.43, lean: 12, thN: 28, shN: 36, thF: -16, shF: 28, uaN: 25, faN: 40, uaF: -12, faF: 28, ball: 'handN' }),
  P({ rootY: 0.52, lean: 8, thN: 20, shN: 24, thF: -22, shF: 46, uaN: -20, faN: 20, uaF: -16, faF: 36, ball: 'handN' }),  // arm swings DOWN-back
  P({ rootY: 0.70, lean: 0, thN: 30, shN: 52, thF: -10, shF: 60, uaN: -70, faN: 10, uaF: -20, faF: 40, ball: 'handN' }),  // bottom of circle
  P({ rootY: 0.80, lean: -8, thN: 26, shN: 60, thF: -8, shF: 64, uaN: -140, faN: 5, uaF: -24, faF: 40, ball: 'handN' }),  // behind
  P({ rootY: 0.83, lean: -10, thN: 24, shN: 58, thF: -8, shF: 62, uaN: 175, faN: 10, uaF: -26, faF: 38, ball: 'handN' }), // over the top (hang)
  P({ rootY: 0.80, lean: -4, thN: 22, shN: 54, thF: -10, shF: 58, uaN: 140, faN: 12, uaF: -22, faF: 36, ball: 'handN' }), // coming around
  P({ rootY: 0.74, lean: 8, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 80, faN: 8, uaF: -12, faF: 30 }),                   // SLAM
  P({ rootY: 0.55, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 45, faN: 16, uaF: 0, faF: 24 }),
  P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
]};

/** Double Pump: ball thrusts up, pulls back to the chest, thrusts again. */
const dunkDoublePump: AnimDef = { fps: 10, loop: false, frames: [
  P({ rootY: 0.43, lean: 8, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 35, faN: 55, uaF: -12, faF: 30, ball: 'handN' }),
  P({ rootY: 0.55, lean: 2, thN: 22, shN: 30, thF: -18, shF: 40, uaN: 100, faN: 60, uaF: -16, faF: 36, ball: 'handN' }),
  P({ rootY: 0.72, lean: -4, thN: 28, shN: 52, thF: -10, shF: 58, uaN: 165, faN: 25, uaF: -20, faF: 40, ball: 'handN' }), // pump 1 up
  P({ rootY: 0.80, lean: -4, thN: 26, shN: 56, thF: -8, shF: 60, uaN: 95, faN: 80, uaF: -22, faF: 38, ball: 'handN' }),   // pull back to chest (hang)
  P({ rootY: 0.82, lean: -6, thN: 24, shN: 58, thF: -8, shF: 60, uaN: 110, faN: 70, uaF: -24, faF: 38, ball: 'handN' }),  // holding
  P({ rootY: 0.79, lean: -2, thN: 22, shN: 54, thF: -10, shF: 56, uaN: 170, faN: 30, uaF: -20, faF: 36, ball: 'handN' }), // pump 2 up
  P({ rootY: 0.73, lean: 8, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 90, faN: 10, uaF: -12, faF: 30 }),                  // SLAM
  P({ rootY: 0.55, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 45, faN: 16, uaF: 0, faF: 24 }),
  P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
]};

/** Reverse Jam: back arches away, ball slams behind the head. */
const dunkReverse: AnimDef = { fps: 10, loop: false, frames: [
  P({ rootY: 0.43, lean: 6, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 30, faN: 50, uaF: -10, faF: 28, ball: 'handN' }),
  P({ rootY: 0.54, lean: -4, thN: 20, shN: 26, thF: -20, shF: 42, uaN: 70, faN: 60, uaF: -18, faF: 34, ball: 'handN' }),
  P({ rootY: 0.70, lean: -14, thN: 26, shN: 50, thF: -12, shF: 56, uaN: 120, faN: 65, uaF: -22, faF: 40, ball: 'handN' }),
  P({ rootY: 0.80, lean: -22, thN: 22, shN: 56, thF: -10, shF: 60, uaN: 170, faN: 50, uaF: -26, faF: 42, ball: 'handN' }), // arched back (hang)
  P({ rootY: 0.82, lean: -26, thN: 20, shN: 54, thF: -10, shF: 58, uaN: 190, faN: 35, uaF: -28, faF: 42, ball: 'handN' }), // peak arch
  P({ rootY: 0.79, lean: -18, thN: 18, shN: 50, thF: -12, shF: 54, uaN: 205, faN: 15, uaF: -24, faF: 40, ball: 'handN' }), // behind the head
  P({ rootY: 0.72, lean: -8, thN: 16, shN: 44, thF: -12, shF: 48, uaN: 215, faN: 5, uaF: -18, faF: 34 }),                  // SLAM (behind)
  P({ rootY: 0.55, lean: 0, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 60, faN: 16, uaF: -6, faF: 24 }),
  P({ rootY: 0.45, lean: 2, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
]};

/** 360 Slam: the body lean and arm wrap swing hard side to side — reads as a spin. */
const dunk360: AnimDef = { fps: 10, loop: false, frames: [
  P({ rootY: 0.43, lean: 10, thN: 28, shN: 36, thF: -16, shF: 28, uaN: 30, faN: 45, uaF: -14, faF: 30, ball: 'handN' }),
  P({ rootY: 0.55, lean: 16, thN: 22, shN: 30, thF: -20, shF: 44, uaN: 60, faN: 55, uaF: 30, faF: 50, ball: 'handN' }),   // wind up the spin
  P({ rootY: 0.72, lean: -16, thN: 30, shN: 55, thF: -8, shF: 60, uaN: -40, faN: 30, uaF: -60, faF: 45, ball: 'handN' }), // whipping around
  P({ rootY: 0.81, lean: 18, thN: 26, shN: 60, thF: -6, shF: 62, uaN: 90, faN: 65, uaF: 50, faF: 55, ball: 'handN' }),    // mid-spin (hang)
  P({ rootY: 0.83, lean: -14, thN: 24, shN: 58, thF: -8, shF: 60, uaN: -30, faN: 40, uaF: -50, faF: 48, ball: 'handN' }), // coming around again
  P({ rootY: 0.80, lean: 4, thN: 22, shN: 54, thF: -10, shF: 56, uaN: 170, faN: 25, uaF: -20, faF: 36, ball: 'handN' }),  // squared up
  P({ rootY: 0.74, lean: 8, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 88, faN: 8, uaF: -12, faF: 30 }),                   // SLAM
  P({ rootY: 0.55, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 45, faN: 16, uaF: 0, faF: 24 }),
  P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
]};
```

ANIMS += the five keys. scene.ts interrupt check becomes `anim === 'shoot' || anim.startsWith('dunk') || anim === 'steal' || anim === 'block' || anim === 'stunned'`. Atlas test rowCount → 15.

- [x] **Step 2: GREEN + preview** — run tests; check `/preview.html` filmstrips: each variant's trick frames (3–5) must read distinctly at a glance (cock-behind-head vs full circle vs chest pull vs back arch vs lean whip).

- [x] **Step 3: Commit** — `git commit -m "feat(client): five authored dunk variants on the rig"`

### Task 5: M6 GATE + wrap-up

- [x] **Step 1: Gate** — with 10 bots soaking: record `dunkStart` events for ~2 minutes via the `__rim` hook; expect ≥3 distinct `dunkName`s as bot skill diverges (early bots are skill 0.5 → Two-Hand/Tomahawk/Reverse; scorers reach 0.7+ → Windmill appears). Manual: drive in with Space and watch the auto-dunk; approach side-on at high skill for windmills.
- [x] **Step 2: README + plan checkboxes + commit** — controls line, status M6; `git commit -m "docs: M6 complete"`. Merge to main via finishing-a-development-branch.

## Self-review notes

1. **Spec §4.4 coverage:** named roster ✓ (6 dunks: spec names windmill/360/double-pump/tomahawk; between-the-legs traded for Reverse Jam + Two-Hand base — silhouette of between-the-legs doesn't read on this rig), `{name, keyframes, arc, skill threshold, trigger conditions}` ✓ (arc = shared lunge+flight), TE-mined structure ✓ (near/far × direction pools, hang frames, frame cadence), randomness ✓ (weighted).
2. **Type consistency:** `pickDunk(rng, skill, dist, approachDeg)` matches the server call; `DunkDef.anim` values all exist as `ANIMS` keys and in the `AnimState` union; `action.lunge` optional so steal/block/stun actions are unaffected.
3. **User controls request:** Task 1, conservative superset (no bindings removed).
