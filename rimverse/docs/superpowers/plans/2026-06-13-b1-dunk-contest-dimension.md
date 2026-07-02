# B1 — The Dunk Contest Dimension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port v3's free-play Dunk Contest onto the rimverse engine as a per-room game mode — a faithful 1:1 reproduction of v3's rules (additive 2/3/dunk scoring, zone accuracy, on-fire, fixed 2-rim court) running in server-managed rooms, with a combined-score (ARENA) counter as Phase-C groundwork, a faithful base-court render, and real 6-court selection.

**Architecture:** `World` gains a `mode` (`dunkContest | rimverse`); mode drives geometry (fixed v3 court vs N-disc), the hoop model (2 shared rims, nearest-target vs N owned), and scoring (v3 additive + on-fire vs rimverse tug-of-war). A `RoomManager` (`Map<roomId, World>`, first-fit per court) replaces the single-World server wiring; `Session` carries its room. `rimverse` mode is byte-for-byte today's behavior, so the existing 169 tests stay green. The client learns its room's mode from `welcome`, pins geometry to the fixed court, renders a faithful v3 base court, and shows the in-room leaderboard + ARENA + on-fire. Shared changes are additive only.

**Tech Stack:** TS ESM monorepo, Vitest (node + jsdom per-file), Vite 6 client, Three.js. Branch: `b1-dunk-contest-dimension` (off `main`, A2b merged). Spec: `docs/superpowers/specs/2026-06-13-b1-dunk-contest-dimension-design.md`.

---

## Conventions

- **cwd:** Always `cd /Users/matthewlittlehale/Sites/thedunkcontest2` first — the shell's default cwd is the v3 repo (`~/Sites/thedunkcontest`, frozen reference).
- **Run one test file:** `npx vitest run <path>`. **Full suite:** `npm test`. **Types:** `npm run typecheck` (must be clean). The existing **169 tests stay green** throughout (rimverse mode is unchanged).
- **jsdom per file:** client DOM tests start with `// @vitest-environment jsdom` on line 1.
- **TDD:** every task is RED → GREEN → typecheck → commit. No red between commits.
- **Commits:** Conventional-Commits prefix; `git add` explicit paths; end every message with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- **Source to port (v3, frozen):** `~/Sites/thedunkcontest/src/{room,roomManager}.js`, `~/Sites/thedunkcontest/shared/{constants,courts}.js`. Mine the exact rules/constants from there.
- **Faithful port:** reproduce v3's rules + constants exactly. Durations stay in ms in `dunkConstants.ts`; convert to V5's 30 Hz / sim-seconds at the call site (the sim runs at `TICK_RATE = 30`, `World.time = tick/30` seconds).
- **Engine facts (from reading the code):** the single score seam is `world.ts:361–382` (`tickFlightsAndActions`); geometry is `shared/src/geometry.ts` (`hoopCount/hoopPosition/spawnPos/clampToArena`, all branch `n<=2`); the server is one `World` in `server/src/index.ts:6`; sessions are `server/src/net.ts` (`Session` has no room today).

## File map

| File | Change |
|------|--------|
| `shared/src/gameMode.ts` | NEW — `GameMode` type + `DEFAULT_MODE` |
| `shared/src/dunkConstants.ts` | NEW — v3 court/zones/accuracy/fire/points/steal/block/cap + pure dc-geometry (`dcHoops`, `dcSpawn`, `dcClamp`) |
| `server/src/game/dunkContest.ts` | NEW — pure scoring/accuracy/fire helpers (mined from v3) |
| `server/src/game/roomManager.ts` | NEW — first-fit room registry (port of v3 roomManager) |
| `server/src/game/world.ts` | `mode` + fire state + `combinedScore`; mode-aware geometry/hoops/scoring/accuracy/dunk-reach/flashy/steal/block/respawn |
| `server/src/game/bots.ts` | nearest-rim targeting when no rim is owned (dunkContest) |
| `shared/src/types.ts` | `PlayerSnap.onFire` |
| `shared/src/protocol.ts` | `join.room?`, `welcome.room`+`welcome.mode`, new `arena` ServerMsg |
| `server/src/index.ts` | RoomManager instead of single World; per-room step + broadcast |
| `server/src/net.ts` | `Session.world`; room-routed join/intent/bots/close; `welcome` mode+room; `arena` push |
| `client/src/net/net.ts` | capture `welcome.room`+`mode`; `onArena`; `join(name, courtId?)` |
| `client/src/lobby/courts.ts` | enable selection (drop disabled, `.selected`, default court, `getSelected`) |
| `client/src/lobby/lobby.ts` | widen `onPlay(name, courtId)`; thread selected court |
| `client/src/scene/dunkCourt.ts` | NEW — faithful v3 base court mesh (floor/lines/key/backboards) |
| `client/src/scene/scene.ts` | mount dunk court + flatten bend in `dunkContest` mode |
| `client/src/main.ts` | mode-aware render/geometry; in-room leaderboard + ARENA + ON FIRE HUD; `onPlay(name, courtId)` |
| tests | new `dunkContest`/`roomManager`/`dunkConstants` suites + `world`/`net` extensions; existing 169 green |

---

# PART A — Server engine + rooms (independently testable)

## Task 1: Shared — `GameMode` type

**Files:** Create `shared/src/gameMode.ts`; Test `shared/test/gameMode.test.ts`.

> The dimension marker. A room (`World`) carries a mode; `rimverse` is the default so nothing changes until a room opts into `dunkContest`.

- [ ] **Step 1: Write the failing test** — create `shared/test/gameMode.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_MODE, type GameMode } from '../src/gameMode';

describe('GameMode', () => {
  it('defaults to rimverse (existing behavior)', () => {
    const m: GameMode = DEFAULT_MODE;
    expect(m).toBe('rimverse');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run shared/test/gameMode.test.ts` (module missing).

- [ ] **Step 3: Implement** — create `shared/src/gameMode.ts`:

```ts
/** Which dimension a room simulates. rimverse = the existing arena; dunkContest = v3's free-play court. */
export type GameMode = 'dunkContest' | 'rimverse';
export const DEFAULT_MODE: GameMode = 'rimverse';
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run shared/test/gameMode.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/gameMode.ts shared/test/gameMode.test.ts
git commit -m "feat(shared): GameMode type (dunkContest | rimverse)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Shared — v3 dunk-contest constants + fixed-court geometry

**Files:** Create `shared/src/dunkConstants.ts`; Test `shared/test/dunkConstants.test.ts`.

> v3's exact tuning (from `~/Sites/thedunkcontest/shared/constants.js`) + the fixed-court geometry both the server sim and client render use. Pure data + math; dependency-free. v3's z-axis (length) maps to V5's `y`.

- [ ] **Step 1: Write the failing test** — create `shared/test/dunkConstants.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DC_COURT, DC_ZONES, DC_ACCURACY, DC_FIRE, dcHoops, dcClamp, dcSpawn, dcDunkReach, dcRespawnBall } from '../src/dunkConstants';

describe('dunk-contest constants (v3-faithful)', () => {
  it('carries v3 court + zone + accuracy + fire values', () => {
    expect(DC_COURT.threePointRadius).toBe(6.75);
    expect(DC_COURT.rimHeight).toBe(3.05);
    expect(DC_ZONES).toEqual({ dunk: 3.2, close: 5.0, mid: 8.0, heave: 13.0 });
    expect(DC_ACCURACY).toMatchObject({ close: 0.8, mid: 0.62, three: 0.45, heave: 0.18, onFireBonus: 0.18, max: 0.96 });
    expect(DC_FIRE).toEqual({ makesToIgnite: 3, durationMs: 45_000 });
  });
});

describe('dc geometry (fixed court, n-independent)', () => {
  it('has exactly two opposed rims at ±12.3 on y', () => {
    expect(dcHoops()).toEqual([{ x: 0, y: -12.3 }, { x: 0, y: 12.3 }]);
  });
  it('clamps to the v3 court bounds (±9.5 x, ±14.5 y)', () => {
    expect(dcClamp({ x: 99, y: -99 })).toEqual({ x: 9.5, y: -14.5 });
    expect(dcClamp({ x: NaN, y: 2 })).toEqual({ x: 0, y: 0 });
  });
  it('spawns inside the court', () => {
    const p = dcSpawn(() => 0.5); // rng 0.5 → center
    expect(p).toEqual({ x: 0, y: 0 });
    const c = dcSpawn(() => 0.99);
    expect(Math.abs(c.x)).toBeLessThanOrEqual(9.5);
    expect(Math.abs(c.y)).toBeLessThanOrEqual(14.5);
  });
  it('v3 dunk reach (3.7 normal / 4.5 turbo) and immediate scattered ball respawn', () => {
    expect(dcDunkReach(false)).toBeCloseTo(3.7);
    expect(dcDunkReach(true)).toBeCloseTo(4.5);
    expect(dcRespawnBall(() => 0.5)).toEqual({ x: 0, y: 0 });
    expect(Math.abs(dcRespawnBall(() => 0.99).x)).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run shared/test/dunkConstants.test.ts` (module missing).

- [ ] **Step 3: Implement** — create `shared/src/dunkConstants.ts`:

```ts
import type { Vec2 } from './types';

/** v3 full court (shared/constants.js COURT). v3 z (length) → V5 y. */
export const DC_COURT = {
  halfWidth: 10, halfLength: 15, boundX: 9.5, boundZ: 14.5,
  rimHeight: 3.05, rimRadius: 0.45,
  rims: [{ x: 0, y: -12.3 }, { x: 0, y: 12.3 }] as const, // v3 z=∓12.3
  backboardZ: 13, threePointRadius: 6.75,
};
export const DC_ZONES = { dunk: 3.2, close: 5.0, mid: 8.0, heave: 13.0 };
export const DC_ACCURACY = { close: 0.80, mid: 0.62, three: 0.45, heave: 0.18, onFireBonus: 0.18, max: 0.96 };
export const DC_FIRE = { makesToIgnite: 3, durationMs: 45_000 };
export const DC_POINTS = { dunk: 2 };
export const DC_STEAL = { radius: 1.6, chance: 0.4, cooldownMs: 1500, protectMs: 800 };
export const DC_BLOCK = { radius: 1.8, windowMs: 700, minAirY: 0.45 };
export const DC_ROOM = { cap: 10 };

/** The two shared rims (no ownership, no N-scaling). */
export function dcHoops(): Vec2[] {
  return DC_COURT.rims.map((r) => ({ x: r.x, y: r.y }));
}

/** Clamp to the v3 court rectangle; non-finite → origin (defense-in-depth, matches geometry.ts). */
export function dcClamp(p: Vec2): Vec2 {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return { x: 0, y: 0 };
  return {
    x: Math.max(-DC_COURT.boundX, Math.min(DC_COURT.boundX, p.x)),
    y: Math.max(-DC_COURT.boundZ, Math.min(DC_COURT.boundZ, p.y)),
  };
}

/** Random spawn inside the court (v3 room.js: x (rand-0.5)*12, z (rand-0.5)*16; always within bounds). */
export function dcSpawn(rng: () => number): Vec2 {
  return dcClamp({ x: (rng() - 0.5) * 12, y: (rng() - 0.5) * 16 });
}

/** v3 dunk takeoff reach: ZONES.dunk(3.2) + (turbo ? 1.3 : 0.5) → 3.7 / 4.5 (room.js tryDunk). */
export function dcDunkReach(turbo: boolean): number {
  return DC_ZONES.dunk + (turbo ? 1.3 : 0.5);
}

/** v3 ball re-spot after a score: immediate, scattered near center (room.js resetBallAfterScore: x (rand-.5)*8, z (rand-.5)*10). */
export function dcRespawnBall(rng: () => number): Vec2 {
  return { x: (rng() - 0.5) * 8, y: (rng() - 0.5) * 10 };
}
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run shared/test/dunkConstants.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/dunkConstants.ts shared/test/dunkConstants.test.ts
git commit -m "feat(shared): v3 dunk-contest constants + fixed-court geometry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Server — dunk-contest scoring/accuracy/fire (pure, mined from v3)

**Files:** Create `server/src/game/dunkContest.ts`; Test `server/test/dunkContest.test.ts`.

> v3's scoring rules as pure functions (`room.js` `tryShoot`/`registerMake`/`registerMiss`). Fire timing in **sim-seconds** (`World.time`); the 45 000 ms constant is converted at use. No tug-of-war, no progression.

- [ ] **Step 1: Write the failing test** — create `server/test/dunkContest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shotZone, shotAccuracy, shotPoints, fireOnMake, fireOnMiss, isOnFire, type FireState } from '../src/game/dunkContest';

describe('shot scoring (v3-faithful)', () => {
  it('zones by distance to nearest rim', () => {
    expect(shotZone(3)).toBe('close');   // < 5
    expect(shotZone(7)).toBe('mid');     // < 8
    expect(shotZone(12)).toBe('three');  // < 13
    expect(shotZone(20)).toBe('heave');  // >= 13
  });
  it('accuracy by zone, +0.18 on fire, capped 0.96', () => {
    expect(shotAccuracy(3, false)).toBeCloseTo(0.80);
    expect(shotAccuracy(7, false)).toBeCloseTo(0.62);
    expect(shotAccuracy(3, true)).toBeCloseTo(0.96);   // 0.80 + 0.18 = 0.98 → cap 0.96
    expect(shotAccuracy(7, true)).toBeCloseTo(0.80);   // 0.62 + 0.18
  });
  it('scores 3 beyond the arc, else 2', () => {
    expect(shotPoints(6.74)).toBe(2);
    expect(shotPoints(6.76)).toBe(3);
  });
});

describe('on fire (3 makes → 45s, miss resets + extinguishes)', () => {
  const fresh = (): FireState => ({ consecutiveMakes: 0, fireUntil: 0 });
  it('ignites on the 3rd consecutive make', () => {
    let f = fresh();
    f = fireOnMake(f, 0); expect(f.ignited).toBe(false);
    f = fireOnMake(f, 0); expect(f.ignited).toBe(false);
    f = fireOnMake(f, 0); expect(f.ignited).toBe(true);
    expect(isOnFire(f, 0)).toBe(true);
    expect(isOnFire(f, 46)).toBe(false); // 45s window (seconds) elapsed
  });
  it('a miss zeroes the streak AND extinguishes fire', () => {
    let f = fresh();
    f = fireOnMake(f, 0); f = fireOnMake(f, 0); f = fireOnMake(f, 0);
    expect(isOnFire(f, 1)).toBe(true);
    f = fireOnMiss(f);
    expect(f.consecutiveMakes).toBe(0);
    expect(isOnFire(f, 1)).toBe(false);
  });
  it('does not re-ignite while already on fire', () => {
    let f = fresh();
    f = fireOnMake(f, 0); f = fireOnMake(f, 0); f = fireOnMake(f, 0); // ignited at t=0
    const f2 = fireOnMake(f, 0);
    expect(f2.ignited).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/dunkContest.test.ts` (module missing).

- [ ] **Step 3: Implement** — create `server/src/game/dunkContest.ts`:

```ts
import { DC_ZONES, DC_ACCURACY, DC_FIRE, DC_COURT } from '../../../shared/src/dunkConstants';

export interface FireState {
  consecutiveMakes: number;
  fireUntil: number; // sim-seconds; 0 = not on fire
}

export function shotZone(dist: number): 'close' | 'mid' | 'three' | 'heave' {
  if (dist < DC_ZONES.close) return 'close';
  if (dist < DC_ZONES.mid) return 'mid';
  if (dist < DC_ZONES.heave) return 'three';
  return 'heave';
}

/** v3 zone accuracy + on-fire bonus, capped (room.js tryShoot). */
export function shotAccuracy(dist: number, onFire: boolean): number {
  const base = DC_ACCURACY[shotZone(dist)];
  const acc = base + (onFire ? DC_ACCURACY.onFireBonus : 0);
  return Math.min(DC_ACCURACY.max, acc);
}

/** 3 beyond the arc, else 2 (room.js: ball.three ? 3 : 2). */
export function shotPoints(dist: number): 2 | 3 {
  return dist > DC_COURT.threePointRadius ? 3 : 2;
}

export function isOnFire(f: FireState, nowSec: number): boolean {
  return f.fireUntil > nowSec;
}

/** A make: bump streak; ignite on the 3rd consecutive make (only when not already lit). */
export function fireOnMake(f: FireState, nowSec: number): FireState & { ignited: boolean } {
  const consecutiveMakes = f.consecutiveMakes + 1;
  if (!isOnFire(f, nowSec) && consecutiveMakes >= DC_FIRE.makesToIgnite) {
    return { consecutiveMakes, fireUntil: nowSec + DC_FIRE.durationMs / 1000, ignited: true };
  }
  return { consecutiveMakes, fireUntil: f.fireUntil, ignited: false };
}

/** A miss: streak → 0 AND fire out (room.js registerMiss). */
export function fireOnMiss(_f: FireState): FireState {
  return { consecutiveMakes: 0, fireUntil: 0 };
}
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/dunkContest.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/dunkContest.ts server/test/dunkContest.test.ts
git commit -m "feat(server): v3 dunk-contest scoring/accuracy/fire helpers (pure)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Server — World gains `mode`, fire state, combinedScore (scaffolding)

**Files:** Modify `server/src/game/world.ts`; Test `server/test/world.test.ts`.

> Add the mode + new per-player/per-room fields with **no behavior change** (default mode `rimverse`). This keeps every existing test green while later tasks branch on `mode`.

- [ ] **Step 1: Write the failing test** — append to `server/test/world.test.ts`:

```ts
import { World } from '../src/game/world';

describe('World mode scaffolding', () => {
  it('defaults to rimverse and initializes dunk-contest fields', () => {
    const w = new World();
    expect(w.mode).toBe('rimverse');
    expect(w.combinedScore).toBe(0);
    const p = w.addPlayer('p1', 'one');
    expect(p.consecutiveMakes).toBe(0);
    expect(p.fireUntil).toBe(0);
  });
  it('accepts a dunkContest mode', () => {
    const w = new World('dunkContest');
    expect(w.mode).toBe('dunkContest');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/world.test.ts` (`mode`/`combinedScore`/`consecutiveMakes` undefined).

- [ ] **Step 3: Implement** in `server/src/game/world.ts`:
- Add the import at the top: `import { DEFAULT_MODE, type GameMode } from '../../../shared/src/gameMode';`
- On `PlayerEnt` (after `peakScore: number;`): add `consecutiveMakes: number;` and `fireUntil: number;`.
- In `addPlayer`'s player literal (after `peakScore: 0,`): add `consecutiveMakes: 0,` and `fireUntil: 0,`.
- On the `World` class, add a constructor + fields (above `tick = 0;` add the field, and add a constructor):
```ts
  readonly mode: GameMode;
  combinedScore = 0;
  constructor(mode: GameMode = DEFAULT_MODE) {
    this.mode = mode;
  }
```
  (Keep all existing field initializers as-is; TS allows field initializers alongside a constructor.)

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/world.test.ts` PASS; `npm run typecheck` clean; `npm test` green (rimverse unchanged).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/world.ts server/test/world.test.ts
git commit -m "feat(server): World mode + fire state + combinedScore scaffolding (rimverse default)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Server — dunkContest geometry (fixed court, 2 shared rims, 1 ball)

**Files:** Modify `server/src/game/world.ts`; Test `server/test/world.test.ts`.

> In `dunkContest` mode the court is the fixed v3 court: exactly 2 shared rims (`owner: null`), spawns inside the court, movement clamped to the court (re-clamp after the shared `stepPlayer`), and exactly one ball. `rimverse` mode is untouched.

- [ ] **Step 1: Write the failing test** — append to `server/test/world.test.ts`:

```ts
import { dcHoops } from '../../shared/src/dunkConstants';

describe('dunkContest geometry', () => {
  it('always has exactly 2 shared rims at the fixed court positions, regardless of N', () => {
    const w = new World('dunkContest');
    for (let i = 0; i < 5; i++) w.addPlayer(`p${i}`, `n${i}`);
    const hoops = w.hoopSnaps();
    expect(hoops).toHaveLength(2);
    expect(hoops.every((h) => h.owner === null)).toBe(true);
    expect(hoops.map((h) => ({ x: h.x, y: h.y }))).toEqual(dcHoops());
  });
  it('keeps exactly one ball regardless of N', () => {
    const w = new World('dunkContest');
    for (let i = 0; i < 8; i++) w.addPlayer(`p${i}`, `n${i}`);
    w.step();
    expect(w.balls.size).toBe(1);
  });
  it('spawns players inside the court bounds', () => {
    const w = new World('dunkContest');
    const p = w.addPlayer('p1', 'one');
    expect(Math.abs(p.pos.x)).toBeLessThanOrEqual(9.5);
    expect(Math.abs(p.pos.y)).toBeLessThanOrEqual(14.5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/world.test.ts` (dunkContest still returns N-disc hoops / N-scaled balls).

- [ ] **Step 3: Implement** in `server/src/game/world.ts`:
- Add imports: `import { dcHoops, dcClamp, dcSpawn } from '../../../shared/src/dunkConstants';`
- **`hoopSnaps()`** — branch at the top:
```ts
  hoopSnaps(): HoopSnap[] {
    if (this.mode === 'dunkContest') {
      return dcHoops().map((h, i) => ({ index: i, x: h.x, y: h.y, owner: null }));
    }
    // ...existing rimverse body unchanged...
  }
```
- **`addPlayer`** — replace the spawn line `p.pos = spawnPos(p.hoop, Math.max(1, this.players.size));` with:
```ts
    p.pos = this.mode === 'dunkContest' ? dcSpawn(this.rng) : spawnPos(p.hoop, Math.max(1, this.players.size));
```
- **Movement clamp** — in `step()`, immediately after the `p.pos = next.pos;` assignment inside the `if (!p.action)` block, add: `if (this.mode === 'dunkContest') p.pos = dcClamp(p.pos);`
- **`scatterNear`** — branch the clamp:
```ts
  private scatterNear(center: Vec2, radius: number): Vec2 {
    const a = this.rng() * Math.PI * 2;
    const p = { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius };
    return this.mode === 'dunkContest' ? dcClamp(p) : clampToArena(p, Math.max(1, this.players.size));
  }
```
- **One ball** — in `step()`, change `ensureBallCount(this.balls, this.players.size);` to `ensureBallCount(this.balls, this.mode === 'dunkContest' ? 1 : this.players.size);` — `ballCount(1) = max(1, ceil(1/6)) = 1`, so exactly one shared ball in dunkContest mode regardless of player count (verified against `balls.ts`; the shrink path only culls idle hub balls, never a carried/flight ball).

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/world.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/world.ts server/test/world.test.ts
git commit -m "feat(server): dunkContest fixed-court geometry (2 shared rims, 1 ball, court clamp)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Server — dunkContest scoring + accuracy + fire at the make seam

**Files:** Modify `server/src/game/world.ts`; Test `server/test/world.test.ts`.

> The heart of the port. In `dunkContest` mode: shots roll v3 zone accuracy; the make seam awards 2/3 (shot, by launch→rim distance) or 2 (dunk), **additively** (no `applyScore`, no victim −2), bumps `combinedScore`, and runs the fire transition; a miss/block runs `fireOnMiss`. `rimverse` mode keeps its exact path.

- [ ] **Step 1: Write the failing test** — append to `server/test/world.test.ts`:

```ts
import { DC_COURT } from '../../shared/src/dunkConstants';

function dcWorldWithCarrier(): { w: World; p: ReturnType<World['addPlayer']> } {
  const w = new World('dunkContest');
  w.rng = () => 0; // shots always make (rng < accuracy)
  const p = w.addPlayer('p1', 'one');
  // give the player the ball
  w.step();
  const ball = [...w.balls.values()][0];
  ball.state = 'carried'; ball.carrier = p.id; p.ballId = ball.id;
  return { w, p };
}

describe('dunkContest scoring (additive, v3 values)', () => {
  it('a made 2 adds 2 to the shooter and combinedScore, no victim loss', () => {
    const { w, p } = dcWorldWithCarrier();
    p.pos = { x: 0, y: -12.3 + 4 }; // ~4 from the near rim → a 2
    p.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    for (let i = 0; i < 40; i++) w.step(); // shoot + flight resolves
    expect(p.score).toBe(2);
    expect(w.combinedScore).toBe(2);
    expect(p.size).toBe(1); // no progression (uniform players)
  });
  it('a made 3 adds 3', () => {
    const { w, p } = dcWorldWithCarrier();
    p.pos = { x: 0, y: -12.3 + (DC_COURT.threePointRadius + 1) }; // beyond the arc
    p.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    for (let i = 0; i < 40; i++) w.step();
    expect(p.score).toBe(3);
    expect(w.combinedScore).toBe(3);
  });
  it('ignites fire after 3 makes', () => {
    const { w, p } = dcWorldWithCarrier();
    p.pos = { x: 0, y: -12.3 + 4 };
    for (let m = 0; m < 3; m++) {
      const b = [...w.balls.values()][0];
      b.state = 'carried'; b.carrier = p.id; p.ballId = b.id; p.action = null;
      p.pendingIntents.push({ seq: m + 1, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
      for (let i = 0; i < 40; i++) w.step();
    }
    expect(p.consecutiveMakes).toBeGreaterThanOrEqual(3);
    expect(p.fireUntil).toBeGreaterThan(0);
  });
});
```

> Note: the test drives the real sim; if grab/respawn timing makes the harness flaky, the executor may stabilize by directly setting `ball.state='carried'` before each shot (as shown) and asserting after enough ticks. Keep the assertions (points 2/3, combinedScore, no size change, fire ignite) intact.

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/world.test.ts` (dunkContest still scores flat 2 via the rimverse path).

- [ ] **Step 3: Implement** in `server/src/game/world.ts`:
- Add imports: `import { shotAccuracy, shotPoints, fireOnMake, fireOnMiss, isOnFire } from './dunkContest';`
- **Thread turbo into the dunk path + v3 dunk reach.** In `step()`'s intent loop, change `if (target >= 0 && inDunkRange(p.pos, hoops[target], p.skill)) this.tryDunk(p);` to `if (target >= 0 && this.inDunkRangeFor(p, hoops[target], move.turbo)) this.tryDunk(p, move.turbo);`, and change `else if (intent.dunk && p.ballId) this.tryDunk(p);` to `else if (intent.dunk && p.ballId) this.tryDunk(p, intent.turbo ?? false);`. Add a mode-aware reach helper on `World` (v3: 3.2 + (turbo?1.3:0.5) = 3.7 / 4.5):
```ts
  private inDunkRangeFor(p: PlayerEnt, hoop: HoopSnap, turbo: boolean): boolean {
    const d = Math.hypot(p.pos.x - hoop.x, p.pos.y - hoop.y);
    return this.mode === 'dunkContest' ? d <= dcDunkReach(turbo) : inDunkRange(p.pos, hoop, p.skill);
  }
```
- **`tryDunk(p, turbo)`** — change the signature to `private tryDunk(p: PlayerEnt, turbo: boolean): void`. Replace the range gate `if (target < 0 || !inDunkRange(p.pos, hoops[target], p.skill)) return;` with `if (target < 0 || !this.inDunkRangeFor(p, hoops[target], turbo)) return;`. Make tier-1 dunks reachable on fire/turbo (v3 `pickDunkType` flashy rule) — replace `const def = pickDunk(this.rng, p.skill, dh, approachDeg);` with:
```ts
    const flashy = turbo || (this.mode === 'dunkContest' && isOnFire({ consecutiveMakes: p.consecutiveMakes, fireUntil: p.fireUntil }, this.time));
    const dunkSkill = this.mode === 'dunkContest' ? (flashy ? 1.0 : 0.5) : p.skill;
    const def = pickDunk(this.rng, dunkSkill, dh, approachDeg);
```
  (rimverse mode is byte-identical: `dunkSkill` falls back to `p.skill`. In dunkContest, normal dunks use effective skill 0.5 → tier-0; on fire/turbo → 1.0 unlocks Windmill/360/rimhang, matching v3's flashy pool.)
- **`startShoot`** — make the accuracy roll mode-aware. Replace `const made = this.rng() < makeProbability(dist, p.skill);` with:
```ts
    const made = this.rng() < (this.mode === 'dunkContest'
      ? shotAccuracy(dist, isOnFire({ consecutiveMakes: p.consecutiveMakes, fireUntil: p.fireUntil }, this.time))
      : makeProbability(dist, p.skill));
```
- **The make seam** (`tickFlightsAndActions`, the `if (f.made && !defenderGone)` block) — branch scoring on mode. Replace the body that currently does `shooter.score += 2; … applyScore(shooter, victim); … victim −2; events.push({…points:2})` with:
```ts
        if (f.made && !defenderGone) {
          const shooter = this.players.get(f.shooter);
          const owner = f.defenderId ? this.players.get(f.defenderId) : undefined;
          const victim = owner && owner !== shooter ? owner : null;
          const dc = this.mode === 'dunkContest';
          // points: dunkContest = 2/3 by launch→rim distance (or dunk 2); rimverse = flat 2 (unchanged).
          const points = dc
            ? (f.isDunk ? DC_POINTS.dunk : shotPoints(Math.hypot(f.from.x - f.to.x, f.from.y - f.to.y)))
            : 2;
          if (shooter) {
            shooter.score += points;
            shooter.sessionPoints += points;
            shooter.peakScore = Math.max(shooter.peakScore, shooter.score);
            if (f.isDunk) shooter.sessionDunks += 1;
            if (dc) {
              this.combinedScore += points;
              const fr = fireOnMake({ consecutiveMakes: shooter.consecutiveMakes, fireUntil: shooter.fireUntil }, this.time);
              shooter.consecutiveMakes = fr.consecutiveMakes;
              shooter.fireUntil = fr.fireUntil;
            } else {
              applyScore(shooter, victim);
            }
            if (shooter.action?.kind !== 'dunk') {
              shooter.action = { kind: 'celebrate', until: this.time + 0.8, targetHoop: f.targetHoop };
              shooter.anim = 'celebrate';
            }
          }
          if (!dc && victim) victim.score = Math.max(0, victim.score - 2); // rimverse only, OUTSIDE if(shooter) — byte-identical
          this.events.push({ kind: 'score', player: f.shooter, hoop: f.targetHoop, points });
          if (dc) {
            // v3 resetBallAfterScore: immediate re-spot at a scattered near-center point (no 3s delay, not exact center).
            b.state = 'free'; b.carrier = null; b.z = 0; b.flight = null; b.pos = dcRespawnBall(this.rng);
          } else {
            startRespawn(b, this.time);
          }
        } else {
```
  Extend the Task-5 dunkConstants import line to also bring in `DC_POINTS, dcRespawnBall, dcDunkReach`.
  > For rimverse mode `points` is always `2`, so this block is byte-identical to the original (the `if (!dc && victim) victim −2` and the `events.push` and `startRespawn` all fire exactly as before, outside `if (shooter)`).
- **Miss → fire out** — in the `else { // miss … }` branch of the seam, before scattering the ball, add: `if (this.mode === 'dunkContest') { const s = this.players.get(f.shooter); if (s) { const fr = fireOnMiss({ consecutiveMakes: s.consecutiveMakes, fireUntil: s.fireUntil }); s.consecutiveMakes = fr.consecutiveMakes; s.fireUntil = fr.fireUntil; } }`

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/world.test.ts` PASS; `npm run typecheck` clean; `npm test` green (rimverse scoring tests still pass — the rimverse branch is byte-identical to before).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/world.ts server/test/world.test.ts
git commit -m "feat(server): dunkContest additive scoring + zone accuracy + on-fire + v3 dunk reach/flashy + scattered respawn

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6b: Server — dunkContest steal/block fidelity (v3 tuning)

**Files:** Modify `server/src/game/world.ts`; Test `server/test/world.test.ts`. (`DC_STEAL`/`DC_BLOCK` from Task 2 are wired here.)

> Port v3's defense in dunkContest mode: **steal** = 40% flat, 1500 ms per-thief cooldown, 800 ms fresh-possession protect, radius 1.6 (room.js `trySteal`). **Block** charges the shooter a miss (kills streak + fire). Note an input-model adaptation: v3 blocks airborne *jump shots*, but V5 has no standalone defender jump, so dunkContest block keeps V5's dunker-block (the closest faithful analog) with v3's reach 1.8 + the fire-out effect — documented under spec §3 (engine-substrate deviation). `rimverse` mode keeps V5's defend untouched.

- [ ] **Step 1: Write the failing test** — append to `server/test/world.test.ts`:

```ts
import { DC_STEAL } from '../../shared/src/dunkConstants';

describe('dunkContest steal fidelity (v3 numbers)', () => {
  function carrier(): { w: World; thief: ReturnType<World['addPlayer']>; vic: ReturnType<World['addPlayer']> } {
    const w = new World('dunkContest');
    const vic = w.addPlayer('v', 'vic');
    const thief = w.addPlayer('t', 'thief');
    w.step();
    const ball = [...w.balls.values()][0];
    ball.state = 'carried'; ball.carrier = vic.id; vic.ballId = ball.id;
    vic.pos = { x: 0, y: 0 }; thief.pos = { x: 1, y: 0 }; // within radius 1.6
    return { w, thief, vic };
  }
  it('cannot steal fresh (protected) possession', () => {
    const { w, thief, vic } = carrier();
    vic.protectUntil = w.time + 1; // protected
    w.rng = () => 0; // would otherwise succeed
    thief.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: false, shoot: false, dunk: false, defend: true });
    w.step();
    expect(vic.ballId).not.toBeNull(); // still held
  });
  it('steal succeeds at 40% (rng below chance) and respects the thief cooldown', () => {
    const { w, thief, vic } = carrier();
    vic.protectUntil = 0; thief.nextStealAt = 0; w.rng = () => DC_STEAL.chance - 0.01; // < 0.40 → success
    thief.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: false, shoot: false, dunk: false, defend: true });
    w.step();
    expect(thief.ballId === vic.ballId || vic.ballId === null).toBe(true); // possession left the victim
    expect(thief.nextStealAt).toBeGreaterThan(0); // cooldown armed
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/world.test.ts`.

- [ ] **Step 3: Implement** in `server/src/game/world.ts`:
- Add imports: `import { DC_STEAL, DC_BLOCK } from '../../../shared/src/dunkConstants';`
- `PlayerEnt`: add `nextStealAt: number;` and `protectUntil: number;`. In `addPlayer`'s literal add `nextStealAt: 0,` and `protectUntil: 0,`.
- **Fresh-possession protect** — in `step()`, just before `resolveGrabs(...)`, snapshot who holds a ball: `const heldBefore = new Set([...this.players.values()].filter((p) => p.ballId).map((p) => p.id));` and just after the `for (const p of this.players.values()) p.wantsGrab = false;` line add (dunkContest only): `if (this.mode === 'dunkContest') for (const p of this.players.values()) if (p.ballId && !heldBefore.has(p.id)) p.protectUntil = this.time + DC_STEAL.protectMs / 1000;`
- **Steal (dunkContest branch)** — in `tryDefend`, gate the steal branch on v3 rules in dunkContest mode. Wrap the existing `if (stealTarget) {…}` so that in dunkContest: skip if `this.time < p.nextStealAt`; require `stealTarget` within `DC_STEAL.radius`; set `p.nextStealAt = this.time + DC_STEAL.cooldownMs / 1000` on the attempt; succeed on `this.rng() < DC_STEAL.chance` (0.40); and treat the victim as unstealable while `this.time < stealTarget.protectUntil`. Concretely, in dunkContest mode replace the steal success roll `this.rng() < stealChance(p, stealTarget)` with `this.rng() < DC_STEAL.chance`, add the cooldown/protect guards, and use `findStealTarget` with the v3 radius (the existing `findStealTarget` uses `STEAL_RANGE` 1.6, which equals `DC_STEAL.radius` — confirm, else pass the radius). Set `p.nextStealAt` when the steal action starts.
- **Block (dunkContest branch)** — in the block branch of `tryDefend`, in dunkContest mode use `DC_BLOCK.radius` (1.8) for `findBlockTarget` reach, and on a successful block apply the fire-out: `const fr = fireOnMiss({ consecutiveMakes: dunker.consecutiveMakes, fireUntil: dunker.fireUntil }); dunker.consecutiveMakes = fr.consecutiveMakes; dunker.fireUntil = fr.fireUntil;` (after `applyBlocked(dunker, p);`). (`applyBlocked`'s size/skill swing is a no-op for uniform players.)

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/world.test.ts` PASS; `npm run typecheck` clean; `npm test` green (rimverse defend untouched).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/world.ts server/test/world.test.ts
git commit -m "feat(server): dunkContest steal/block fidelity (v3 chance/cooldown/protect/reach)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Server — `PlayerSnap.onFire` through the snapshot

**Files:** Modify `shared/src/types.ts`, `server/src/game/world.ts`; Test `server/test/world.test.ts`.

> Carry the on-fire flag to the client (flame + HUD). `false` in rimverse mode.

- [ ] **Step 1: Write the failing test** — append to `server/test/world.test.ts`:

```ts
describe('PlayerSnap.onFire', () => {
  it('is false by default and true when a dunkContest player is on fire', () => {
    const w = new World('dunkContest');
    const p = w.addPlayer('p1', 'one');
    expect(w.snapshotFor('p1').players[0].onFire).toBe(false);
    p.consecutiveMakes = 3; p.fireUntil = w.time + 10;
    expect(w.snapshotFor('p1').players[0].onFire).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/world.test.ts` (`onFire` missing on PlayerSnap).

- [ ] **Step 3: Implement:**
- `shared/src/types.ts` `PlayerSnap`: add `onFire: boolean;` after `hasBall: boolean;`.
- `server/src/game/world.ts` `snapshotFor` player map: add `onFire: this.mode === 'dunkContest' && isOnFire({ consecutiveMakes: p.consecutiveMakes, fireUntil: p.fireUntil }, this.time),` after `hasBall: p.ballId !== null,`.
- `client/test/radar.test.ts` builds a `PlayerSnap` literal/factory that lacks `onFire` — add `onFire: false` to it (the review confirmed this breaks `tsc` otherwise). Then `grep -rn "anim:" client/test` to find any other `PlayerSnap` literal and add `onFire: false` to each.

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/world.test.ts` PASS; `npm run typecheck` clean (every `PlayerSnap` literal now carries `onFire`); `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/types.ts server/src/game/world.ts server/test/world.test.ts client/test/radar.test.ts
git commit -m "feat: carry onFire through PlayerSnap (dunkContest flame)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7b: Server — bots target the nearest rim in dunkContest

**Files:** Modify `server/src/game/bots.ts`; Test `server/test/bots.test.ts`.

> The bot brain targets an "enemy rim" via `hoops.find(h => h.owner && h.owner !== bot.id) ?? hoops.find(h => h.owner !== bot.id)`. In dunkContest mode every rim has `owner: null`, so the first find fails and the second returns rim index 0 — every bot drives to the −y rim and clusters. Fix: when **no** rim is owned, target the **nearest** rim (the dunk-contest free-for-all rule).

- [ ] **Step 1: Write the failing test** — append to `server/test/bots.test.ts` (read the file first for its helpers):

```ts
import { World } from '../src/game/world';

describe('bots in dunkContest target the nearest rim', () => {
  it('a ball-carrying bot near the +y rim heads toward it, not rim 0', () => {
    const w = new World('dunkContest');
    const bot = w.addPlayer('bot:1', 'BOT 1', true);
    w.step();
    const ball = [...w.balls.values()][0];
    ball.state = 'carried'; ball.carrier = bot.id; bot.ballId = ball.id;
    bot.pos = { x: 0, y: 10 }; // near the +y rim (12.3), far from the -y rim (-12.3)
    const yStart = bot.pos.y;
    for (let i = 0; i < 30; i++) w.step();
    // It should approach the near (+y) rim — move toward +y or already be shooting/dunking there.
    expect(bot.pos.y).toBeGreaterThanOrEqual(yStart - 1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/bots.test.ts` (bot walks toward rim 0 at −y).

- [ ] **Step 3: Implement** in `server/src/game/bots.ts` — replace the enemy-rim selection with an owner-aware one. Where it currently computes the target hoop (`const enemyHoop = hoops.find(h => h.owner && h.owner !== bot.id) ?? hoops.find(h => h.owner !== bot.id);` or equivalent), change to:
```ts
    const owned = hoops.some((h) => h.owner);
    const target = owned
      ? (hoops.find((h) => h.owner && h.owner !== bot.id) ?? hoops.find((h) => h.owner !== bot.id))
      : hoops.reduce((best, h) => // no ownership (dunkContest): nearest rim
          Math.hypot(h.x - bot.pos.x, h.y - bot.pos.y) < Math.hypot(best.x - bot.pos.x, best.y - bot.pos.y) ? h : best);
```
  (Adapt to the file's exact variable names; the key change is the `!owned → nearest rim` fallback. Keep the rimverse path — `owned` true — byte-identical.)

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/bots.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/bots.ts server/test/bots.test.ts
git commit -m "fix(server): bots target the nearest rim when no rim is owned (dunkContest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Server — the room manager

**Files:** Create `server/src/game/roomManager.ts`; Test `server/test/roomManager.test.ts`.

> Ports v3's `findOrCreateRoom` lifecycle onto V5 `World`s: first-fit by court + space, per-court instance counter, lazy create, delete-on-empty.

- [ ] **Step 1: Write the failing test** — create `server/test/roomManager.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/game/roomManager';
import { DC_ROOM } from '../../shared/src/dunkConstants';

describe('RoomManager', () => {
  it('first-fits a court until cap, then mints a new instance', () => {
    const rm = new RoomManager();
    const a = rm.findOrCreateRoom('rucker', 'dunkContest');
    expect(a.id).toBe('rucker-1');
    expect(a.world.mode).toBe('dunkContest');
    for (let i = 0; i < DC_ROOM.cap; i++) a.world.addPlayer(`p${i}`, `n${i}`);
    const b = rm.findOrCreateRoom('rucker', 'dunkContest');
    expect(b.id).toBe('rucker-2'); // full → new instance
    const c = rm.findOrCreateRoom('venice', 'dunkContest');
    expect(c.id).toBe('venice-1'); // different court → its own pool
  });
  it('falls back to the first court for an unknown id', () => {
    const rm = new RoomManager();
    expect(rm.findOrCreateRoom('nope', 'dunkContest').id).toBe('rucker-1');
  });
  it('deletes empty rooms on stepAll and routes by id', () => {
    const rm = new RoomManager();
    const r = rm.findOrCreateRoom('rucker', 'dunkContest');
    r.world.addPlayer('p1', 'one');
    expect(rm.get('rucker-1')).toBe(r.world);
    r.world.removePlayer('p1');
    rm.stepAll();
    expect(rm.get('rucker-1')).toBeUndefined();
  });
  it('does NOT reap a freshly created room before its first join (race guard)', () => {
    const rm = new RoomManager();
    const r = rm.findOrCreateRoom('rucker', 'dunkContest');
    rm.stepAll(); // tick fires between findOrCreateRoom and the join handler's addPlayer
    expect(rm.get('rucker-1')).toBe(r.world); // never had players → not reapable
    r.world.addPlayer('p1', 'one');
    rm.stepAll();
    expect(rm.get('rucker-1')).toBe(r.world); // populated → kept
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/roomManager.test.ts` (module missing).

- [ ] **Step 3: Implement** — create `server/src/game/roomManager.ts`:

```ts
import { World } from './world';
import type { GameMode } from '../../../shared/src/gameMode';
import { DC_ROOM } from '../../../shared/src/dunkConstants';
import { COURTS } from './courts';

export interface Room { id: string; courtId: string; world: World; hadPlayers: boolean; }

export class RoomManager {
  private roomsById = new Map<string, Room>();
  private nextInstance = new Map<string, number>();

  /** First-fit by court + space; else mint `${courtId}-${n}` (v3 roomManager parity). */
  findOrCreateRoom(courtId: string, mode: GameMode): Room {
    const id = COURTS.some((c) => c.id === courtId) ? courtId : COURTS[0].id;
    for (const room of this.roomsById.values()) {
      if (room.courtId === id && room.world.players.size < DC_ROOM.cap) return room;
    }
    const n = (this.nextInstance.get(id) ?? 0) + 1;
    this.nextInstance.set(id, n);
    const room: Room = { id: `${id}-${n}`, courtId: id, world: new World(mode), hadPlayers: false };
    this.roomsById.set(room.id, room);
    return room;
  }

  get(roomId: string): World | undefined {
    return this.roomsById.get(roomId)?.world;
  }

  rooms(): Iterable<Room> {
    return this.roomsById.values();
  }

  /** Step populated rooms; reap a room only once it HAS had players and is now empty —
   *  so the tick can't delete a freshly created room before its first join lands (the race). */
  stepAll(): void {
    for (const [id, room] of this.roomsById) {
      if (room.world.players.size > 0) { room.hadPlayers = true; room.world.step(); }
      else if (room.hadPlayers) this.roomsById.delete(id);
    }
  }
}
```
  Note: this imports a server-side `COURTS`. Create `server/src/game/courts.ts` exporting the 6 court ids (mirror the client `client/src/lobby/courts.ts` data, server needs only `{id}`):
```ts
// server/src/game/courts.ts
export const COURTS = [
  { id: 'rucker' }, { id: 'venice' }, { id: 'tokyo' }, { id: 'rio' }, { id: 'paris' }, { id: 'tundra' },
] as const;
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/roomManager.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/roomManager.ts server/src/game/courts.ts server/test/roomManager.test.ts
git commit -m "feat(server): RoomManager — first-fit dunk-contest rooms per court

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Shared — additive protocol fields (join.room, welcome.room+mode, arena)

**Files:** Modify `shared/src/protocol.ts`; Test `shared/test/protocol.test.ts` (new, type-level).

> Additive wire fields. Adding required `room`/`mode` to `welcome` forces the server's `welcome` send to populate them — done in Task 10, so this task ships the types + a compile guard only (the new fields are consumed next task).

- [ ] **Step 1: Write the failing test** — create `shared/test/protocol.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { ClientMsg, ServerMsg } from '../src/protocol';

describe('protocol additive fields', () => {
  it('join carries an optional room; welcome carries room+mode; arena exists', () => {
    const join: ClientMsg = { t: 'join', name: 'A', room: 'rucker' };
    const welcome: ServerMsg = { t: 'welcome', id: 'x', tick: 0, x: 0, y: 0, room: 'rucker-1', mode: 'dunkContest' };
    const arena: ServerMsg = { t: 'arena', combined: 5 };
    expect(join.t).toBe('join');
    expect((welcome as { room: string }).room).toBe('rucker-1');
    expect((arena as { combined: number }).combined).toBe(5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run shared/test/protocol.test.ts` (type errors: `room`/`mode`/`arena` unknown).

- [ ] **Step 3: Implement** in `shared/src/protocol.ts`:
- Add the import: `import type { GameMode } from './gameMode';`
- `ClientMsg` join variant → add `room?: string;` : `| { t: 'join'; name: string; token?: string; character?: Character; room?: string }`
- `ServerMsg` welcome variant → add `room: string; mode: GameMode;` : `| { t: 'welcome'; id: string; tick: number; x: number; y: number; room: string; mode: GameMode }`
- Add a new `ServerMsg` member: `| { t: 'arena'; combined: number }`

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run shared/test/protocol.test.ts` PASS. `npm run typecheck` will FAIL where the server sends `welcome` without the new required fields (`server/src/net.ts`) and where the client builds the join — those are fixed in Tasks 10–11. To keep THIS commit green, also apply the Task-10 `welcome` change minimally now (add `room`/`mode` to the existing `send(ws, { t:'welcome', … })`), or sequence Task 9 + Task 10 as one commit. Simplest: **commit Tasks 9 and 10 together** (the protocol fields + their server population). If you keep them separate, stub `welcome`’s `room: 'rucker-1', mode: 'rimverse'` here and refine in Task 10.

- [ ] **Step 5: Commit** (folded with Task 10 — see below).

---

## Task 10: Server — route per room (index.ts + net.ts)

**Files:** Modify `server/src/index.ts`, `server/src/net.ts`; Test `server/test/net.test.ts`.

> Replace the single `World` with the `RoomManager`; thread the resolved room through `join`/`intent`/`bots`/`close`; `welcome` echoes `{ room, mode }`; push the per-room `arena` combined-score.

- [ ] **Step 1: Write the failing test** — extend `server/test/net.test.ts` (these test the exported helpers + a small routing helper; keep them pure where possible):

```ts
import { RoomManager } from '../src/game/roomManager';

describe('room routing', () => {
  it('routes a join into the requested court room and reports it', () => {
    const rm = new RoomManager();
    const room = rm.findOrCreateRoom('venice', 'dunkContest');
    const p = room.world.addPlayer('id1', 'A');
    expect(rm.get('venice-1')).toBe(room.world);
    expect(room.world.players.has('id1')).toBe(true);
    // welcome echoes the room + mode
    expect(room.id).toBe('venice-1');
    expect(room.world.mode).toBe('dunkContest');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/net.test.ts` (passes only once RoomManager + routing exist; this asserts the wiring shape).

- [ ] **Step 3: Implement:**
- **`server/src/net.ts`:**
  - `Session` interface: add `world?: import('./game/world').World;` (the player's room world).
  - `startNet` signature: change `world: World` → `rooms: RoomManager` (import `RoomManager`). Update the type imports.
  - In the **join** handler: after computing `name`/`token`/`character`, resolve the court + room:
    ```ts
    // Global ceiling across all rooms (the per-room cap of DC_ROOM.cap is enforced by findOrCreateRoom spilling to a new instance).
    let total = 0;
    for (const r of rooms.rooms()) total += r.world.players.size;
    if (total >= MAX_PLAYERS) { ws.close(1013, 'server full'); return; }
    const courtId = typeof (msg as { room?: unknown }).room === 'string' ? (msg as { room: string }).room : 'rucker';
    const room = rooms.findOrCreateRoom(courtId, 'dunkContest');
    sess.world = room.world;
    const p = room.world.addPlayer(id, name);
    // ...hue/accent as today...
    send(ws, { t: 'welcome', id, tick: room.world.tick, x: p.pos.x, y: p.pos.y, room: room.id, mode: room.world.mode });
    send(ws, identityFor(db, token));
    ```
    (Remove the old `world.players.size >= MAX_PLAYERS` global cap check / `world.addPlayer` lines.)
  - **`intent`/`bots`/`close`** handlers: replace `world.players.get(id)` / `world.setBotCount(...)` / `world.removePlayer(id)` with `sess.world?.players.get(id)` / `sess.world?.setBotCount(...)` / `sess.world?.removePlayer(id)`. For `bots`, clamp the request to the room cap so one court can't be flooded past `DC_ROOM.cap`: `sess.world?.setBotCount(Math.min(count, DC_ROOM.cap))` (import `DC_ROOM` from `dunkConstants`). The `getLeaderboard`/pre-join `identity` path (A2b) is unchanged (room-agnostic, DB-backed).
- **`server/src/index.ts`:**
  ```ts
  import { SERVER_PORT, SNAPSHOT_EVERY, TICK_RATE } from '../../shared/src/constants';
  import { RoomManager } from './game/roomManager';
  import { send, startNet } from './net';
  import { openDb } from './db';

  const rooms = new RoomManager();
  const db = openDb();
  const { sessions } = startNet(rooms, SERVER_PORT, db);

  setInterval(() => {
    rooms.stepAll();
    for (const room of rooms.rooms()) {
      const w = room.world;
      if (w.tick % SNAPSHOT_EVERY !== 0) continue;
      for (const sess of sessions.values()) {
        if (!sess.joined || sess.world !== w) continue;
        const includeHoops = sess.lastTv !== w.topoVersion;
        send(sess.ws, w.snapshotFor(sess.id, includeHoops));
        if (includeHoops) sess.lastTv = w.topoVersion;
        if (w.tick % (SNAPSHOT_EVERY * 8) === 0) send(sess.ws, { t: 'arena', combined: w.combinedScore });
      }
      w.events.length = 0;
    }
  }, 1000 / TICK_RATE);

  console.log(`[dunk-contest] server on ws://localhost:${SERVER_PORT}, tick ${TICK_RATE} Hz`);
  ```
  Note: each `World` has its own `tick`; `stepAll` advances them. The snapshot cadence keys off each room's own tick.

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/net.test.ts server/test/roomManager.test.ts` PASS; `npm run typecheck` clean (protocol fields now populated); `npm test` green.

- [ ] **Step 5: Commit** (Tasks 9 + 10 together)

```bash
git add shared/src/protocol.ts shared/test/protocol.test.ts server/src/index.ts server/src/net.ts server/test/net.test.ts
git commit -m "feat(server): room-routed sessions + welcome mode/room + arena push (RoomManager)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# PART B — Client court + selection + HUD (completes the gate)

## Task 11: Client Net — room/mode + arena hook + join(name, courtId)

**Files:** Modify `client/src/net/net.ts`; Test `client/test/net.test.ts`.

- [ ] **Step 1: Write the failing test** — append to `client/test/net.test.ts` (inside the existing jsdom file):

```ts
describe('Net dunk-contest awareness', () => {
  it('join(name, court) sends the room; captures welcome mode/room; fires onArena', () => {
    const net = new Net();
    net.join('Zee', 'venice');
    const join = FakeWS.last.sent.map((s) => JSON.parse(s)).find((m: { t: string }) => m.t === 'join');
    expect(join).toMatchObject({ t: 'join', name: 'Zee', room: 'venice' });
    let combined = -1;
    net.onArena = (c) => (combined = c);
    FakeWS.last.onmessage!({ data: JSON.stringify({ t: 'welcome', id: 'x', tick: 0, x: 0, y: 0, room: 'venice-1', mode: 'dunkContest' }) });
    FakeWS.last.onmessage!({ data: JSON.stringify({ t: 'arena', combined: 7 }) });
    expect(net.room).toBe('venice-1');
    expect(net.mode).toBe('dunkContest');
    expect(combined).toBe(7);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run client/test/net.test.ts`.

- [ ] **Step 3: Implement** in `client/src/net/net.ts`:
- Import `GameMode`: `import type { GameMode } from '../../../shared/src/gameMode';`
- Add public fields: `room: string | null = null;`, `mode: GameMode | null = null;`, `onArena: ((combined: number) => void) | null = null;`
- `join(name)` → `join(name: string, room?: string): void` — build the message and attach `room`:
  ```ts
  join(name: string, room?: string): void {
    const msg = joinMessage(name, this.playerToken, Net.character());
    if (room) (msg as { room?: string }).room = room;
    this.send(msg);
  }
  ```
- In `onmessage`, in the `welcome` branch: set `this.room = msg.room; this.mode = msg.mode;` (after `this.myId = msg.id;`). Add an `arena` branch: `else if (msg.t === 'arena') { this.onArena?.(msg.combined); }`.

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run client/test/net.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add client/src/net/net.ts client/test/net.test.ts
git commit -m "feat(client): Net learns room/mode + onArena + join(name, court)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Lobby — enable court selection

**Files:** Modify `client/src/lobby/courts.ts`, `client/src/lobby/lobby.ts`; Test `client/test/lobby-courts.test.ts`, `client/test/lobby-shell.test.ts`.

- [ ] **Step 1: Write the failing tests** — update `client/test/lobby-courts.test.ts` (replace the disabled assertion) and add selection coverage:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { COURTS, renderCourtGrid } from '../src/lobby/courts';

describe('COURTS', () => {
  it('has the 6 v3 courts in order', () => {
    expect(COURTS.map((c) => c.id)).toEqual(['rucker', 'venice', 'tokyo', 'rio', 'paris', 'tundra']);
  });
});

describe('renderCourtGrid (selectable)', () => {
  it('renders 6 enabled cards, defaults a selection, and updates on click', () => {
    const el = document.createElement('div');
    const grid = renderCourtGrid(el);
    const cards = el.querySelectorAll<HTMLButtonElement>('.courtCard');
    expect(cards).toHaveLength(6);
    expect([...cards].some((c) => c.disabled)).toBe(false);
    expect(grid.getSelected()).toBe('rucker'); // default
    expect(el.querySelector('.courtCard.selected')?.getAttribute('data-id')).toBe('rucker');
    (el.querySelector('[data-id="venice"]') as HTMLButtonElement).click();
    expect(grid.getSelected()).toBe('venice');
    expect(el.querySelector('.courtCard.selected')?.getAttribute('data-id')).toBe('venice');
  });
});
```

  And in `client/test/lobby-shell.test.ts`, update the PLAY test to assert the court is passed:
```ts
  it('PLAY passes the selected court to onPlay', () => {
    const net = fakeNet();
    const onPlay = vi.fn();
    new Lobby({ net, onPlay });
    (document.querySelector('#nameInput') as HTMLInputElement).value = 'Zee';
    (document.querySelector('#playBtn') as HTMLButtonElement).click();
    expect(onPlay).toHaveBeenCalledWith('Zee', 'rucker'); // default court
  });
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run client/test/lobby-courts.test.ts client/test/lobby-shell.test.ts`.

- [ ] **Step 3: Implement:**
- `client/src/lobby/courts.ts` — `renderCourtGrid` returns a small controller and renders enabled, selectable cards:
```ts
export interface CourtGrid { getSelected(): string; }
export function renderCourtGrid(mount: HTMLElement): CourtGrid {
  let selected = COURTS[0].id;
  const paint = () => {
    mount.innerHTML = COURTS.map((c) => `
      <button class="courtCard${c.id === selected ? ' selected' : ''}" data-id="${c.id}">
        <span class="cFlag">${c.flag}</span>
        <span class="cName">${c.name}</span>
        <span class="cLoc">${c.location}</span>
      </button>`).join('');
    for (const btn of Array.from(mount.querySelectorAll<HTMLButtonElement>('.courtCard'))) {
      btn.addEventListener('click', () => { selected = btn.dataset.id as string; paint(); });
    }
  };
  paint();
  return { getSelected: () => selected };
}
```
  Add a `.courtCard.selected` rule to `client/src/lobby/styles.ts` (mirror `.swatch.sel`): `\n.courtCard.selected { border-color: var(--gold); background: #181a10; box-shadow: 0 0 14px rgba(255,201,40,0.25); }`. Remove the old `.cSoon`/`PHASE B` + `[disabled]` styling usage (the cards are no longer disabled; leave the `.courtCard[disabled]` rule harmlessly or drop it).
- `client/src/lobby/lobby.ts` — `LobbyOptions.onPlay: (name: string, court: string) => void`. Capture the grid controller: `this.courtGrid = renderCourtGrid(this.root.querySelector('#courtGrid')!)`. In `play()`: `this.onPlay(name, this.courtGrid.getSelected());`.

- [ ] **Step 4: Run — expect PASS + typecheck** — the two suites PASS; `npm run typecheck` will flag `main.ts`'s `onPlay` (one arg) — fix in Task 13, or stub `onPlay: (name) => net.join(name)` to accept the 2nd arg now. `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add client/src/lobby/courts.ts client/src/lobby/lobby.ts client/src/lobby/styles.ts client/test/lobby-courts.test.ts client/test/lobby-shell.test.ts
git commit -m "feat(client): enable WORLD TOUR court selection (B1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Client — route PLAY into a dunk-contest room + mode-aware boot

**Files:** Modify `client/src/main.ts`.

> Wire the selected court into the join; make the render/geometry mode-aware (the dunk-contest court is rendered in Task 14; here we just gate on `net.mode` and pin the arena to the fixed court).

- [ ] **Step 1: Implement** in `client/src/main.ts`:
- The lobby callback: `new Lobby({ net, onPlay: (name, court) => net.join(name, court) });`
- In the `frame()` loop, when `net.mode === 'dunkContest'`, render the dunk court instead of the N-disc arena. Concretely, replace `scene.setArena(Math.max(1, latest.n), dt);` with:
  ```ts
  if (net.mode === 'dunkContest') scene.setDunkCourt(dt);
  else scene.setArena(Math.max(1, latest.n), dt);
  ```
  (`setDunkCourt` is added in Task 14; it pins the floor to the fixed court + flattens the bend.)

- [ ] **Step 2: Run — typecheck** — `npm run typecheck` will flag `scene.setDunkCourt` until Task 14. Sequence Task 13 + 14 together (commit jointly), or stub `setDunkCourt(dt){ this.setArena(2, dt); }` now and flesh it out in Task 14.

- [ ] **Step 3: Commit** (folded with Task 14).

---

## Task 14: Client — faithful v3 base court render

**Files:** Create `client/src/scene/dunkCourt.ts`; Modify `client/src/scene/scene.ts`.

> A faithful v3 base court (floor + boundary/center/key lines + 3-pt arcs + two backboards) sized to `DC_COURT`. The two rims still come from `syncHoops` (already renders rim+board+pole groups). In `dunkContest` mode the neon grid is hidden and the bend is flattened. Themed per-court dressing (skies/props/particles) is **B2**; this is the clean base court only. This is a controller-verified visual task — build a faithful functional court, refine at the gate.

- [ ] **Step 1: Implement** — create `client/src/scene/dunkCourt.ts`:
```ts
import * as THREE from 'three';
import { DC_COURT } from '../../../shared/src/dunkConstants';

/** Faithful v3 base court: flat floor, boundary + center + key lines, two backboards. */
export function makeDunkCourt(): THREE.Group {
  const g = new THREE.Group();
  const W = DC_COURT.boundX, L = DC_COURT.boundZ;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2, L * 2),
    new THREE.MeshBasicMaterial({ color: 0x6e6862 }), // neutral v3 hardwood; B2 themes per court
  );
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe8e4da });
  const ring = (r: number, y = 0.02, x = 0, z = 0) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push(new THREE.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
  };
  const rect = (w: number, l: number, y = 0.02) => {
    const h = w, k = l;
    const pts = [[-h, y, -k], [h, y, -k], [h, y, k], [-h, y, k], [-h, y, -k]].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
  };
  g.add(rect(W, L));                 // boundary
  g.add(ring(1.8));                  // center circle
  for (const rim of DC_COURT.rims) { // 3-pt arc + key per end
    g.add(ring(DC_COURT.threePointRadius, 0.02, rim.x, rim.y));
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.05, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
    );
    board.position.set(rim.x, 3.5, rim.y + Math.sign(rim.y) * 0.55);
    g.add(board);
  }
  return g;
}
```

- Modify `client/src/scene/scene.ts`:
  - Import: `import { makeDunkCourt } from './dunkCourt';`
  - Add a field `private dunkCourt: THREE.Group | null = null;`
  - Add the method:
    ```ts
    setDunkCourt(dt: number): void {
      this.grid.mesh.visible = false;              // hide the rimverse neon grid
      this.sky.mesh.visible = false;
      if (!this.dunkCourt) { this.dunkCourt = makeDunkCourt(); this.scene.add(this.dunkCourt); }
      this.floorRadius += (DC_COURT.boundZ - this.floorRadius) * Math.min(1, dt * 3);
      BEND.bendHeight += (0 - BEND.bendHeight) * Math.min(1, dt * 3); // flatten
    }
    ```
    (Import `DC_COURT` + `BEND` already imported.) The dunk court is flat, so `setWrapOrigin`/`rimBend` resolve to near-identity at bendHeight 0 — hoops/balls render at their flat positions.

- [ ] **Step 2: Run — typecheck** — `npm run typecheck` clean. (No unit test for Three.js meshes; verified at the gate.)

- [ ] **Step 3: Commit** (Tasks 13 + 14)

```bash
git add client/src/main.ts client/src/scene/dunkCourt.ts client/src/scene/scene.ts
git commit -m "feat(client): faithful v3 base court render + dunkContest mode boot

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Client HUD — in-room leaderboard + ARENA counter + ON FIRE

**Files:** Modify `client/src/main.ts`.

> The recognizable Dunk Contest HUD: a live leaderboard (top 8 by score, from the snapshot), the ARENA combined-score counter (from `onArena`), and an ON FIRE flag for the local player.

- [ ] **Step 1: Implement** in `client/src/main.ts`:
- Track the arena value: near the top, `let arena = 0;` and register `net.onArena = (c) => { arena = c; };`
- In the `frame()` HUD block (the `hud.textContent = …` assignment), when `net.mode === 'dunkContest'`, render the dunk-contest HUD instead:
  ```ts
  if (net.mode === 'dunkContest') {
    const board = [...latest.players].sort((a, b) => b.score - a.score).slice(0, 8)
      .map((p, i) => `${i + 1}. ${p.name} ${p.score}${p.onFire ? ' 🔥' : ''}`).join('\n');
    const me = latest.players.find((p) => p.id === net.myId);
    hud.textContent =
      `THE DUNK CONTEST\nARENA ${arena}\n` +
      (me?.onFire ? 'ON FIRE 🔥\n' : '') +
      `★ SCORES ★\n${board}\n` +
      `WASD move · SHIFT turbo · M grab/steal/block · SPACE shoot (dunks close)`;
  } else {
    // ...existing rimverse HUD unchanged...
  }
  ```

- [ ] **Step 2: Run — typecheck** — `npm run typecheck` clean; `npm test` green.

- [ ] **Step 3: Commit**

```bash
git add client/src/main.ts
git commit -m "feat(client): dunk-contest HUD — leaderboard + ARENA + on-fire

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Visual gate (controller-run) — play a Dunk Contest to a score

**Files:** none (manual verification + screenshots). Controller-run gate, like prior phases.

> Start V5 yourself (`npm run dev`) and drive the preview (the preview MCP is rooted at the v3 repo — start V5 + navigate the preview browser to `http://localhost:5173/`, per the project preview note).

- [ ] **Step 1: Start V5** — `npm run dev` (client :5173, server :8081). Open the lobby.
- [ ] **Step 2: Court selection** — the 6 WORLD TOUR cards are enabled; clicking one highlights it. Pick a court, press PLAY. **Screenshot.**
- [ ] **Step 3: The court** — confirm the faithful v3 base court renders (flat hardwood, boundary/center/key lines, 3-pt arcs, two backboards + rims) — **not** the vaporwave rimverse arena. **Screenshot.**
- [ ] **Step 4: Scoring** — grab the shared ball; hit a close shot (+2), a three beyond the arc (+3, confirm the value), and a dunk (+2); watch your score + the **live in-room leaderboard** climb and the **ARENA** counter climb. Drive via `window.__rim` + keyboard events as needed (server is authoritative; verify scores via `window.__rim.latest.players`). **Screenshot.**
- [ ] **Step 5: On fire** — make 3 in a row → the 🔥 flag + the accuracy bump (subsequent shots make more reliably) + flashy dunks unlock; a miss extinguishes it. **Screenshot.**
- [ ] **Step 6: Rooms** — open a second browser/tab, pick the **same** court → both land in the same room (you see each other); a **different** court → separate room (you don't). Confirm the ARENA total is per-room. **Screenshot.**
- [ ] **Step 7: Regression** — spot-check the existing rimverse path still works in `rimverse` mode (e.g., a quick server test or a `?mode` harness if available); the 169 tests already cover it. 
- [ ] **Step 8: Commit any tuning** — if Steps 3–6 needed court/HUD nudges:
```bash
git add -A
git commit -m "polish(client): B1 dunk-contest visual-gate pass

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (done while writing — kept for the executor)

- **Spec coverage:** game mode → Tasks 1,4; v3 constants/geometry/dunk-reach/respawn helpers → Task 2; v3 scoring/accuracy/fire → Tasks 3,6; v3 dunk takeoff reach (3.7/4.5+turbo) + flashy-dunk-on-fire → Task 6; v3 steal/block fidelity → Task 6b; bots nearest-rim in dunkContest → Task 7b; fixed court + 2 shared rims + 1 ball + court clamp + immediate scattered respawn → Tasks 5,6; combinedScore + ARENA → Tasks 6,10,15; onFire wire+render → Tasks 7,15; room manager (first-fit/cap/delete-empty + reap-race guard) → Task 8; protocol additive → Task 9; per-room routing + global ceiling + bot cap → Task 10; client mode/room/arena → Task 11; court selection → Task 12; PLAY→room + mode boot → Task 13; faithful base court → Task 14; in-room leaderboard → Task 15; gate → Task 16. `mode` as dimension tag + Phase-C seams → Tasks 4/6/8/10. No spec requirement unmapped. (Themed stages, wormhole, escape are explicitly out — B2/C/D.)
- **Type consistency:** `GameMode` (Task 1) used by `World` (4), protocol (9), Net (11). `FireState` shape `{consecutiveMakes,fireUntil}` consistent across Tasks 3/6/7. `DC_*` constants (Task 2) used in 3/5/6/8/14. `combinedScore` (4) read in 10/15. `welcome.{room,mode}` (9) sent in 10, read in 11. `onFire` (7) read in 15. `renderCourtGrid` returns `CourtGrid` (12) used in 13. `setDunkCourt` (14) called in 13/15.
- **Green commits / ordering:** Task 4 keeps rimverse default (existing tests green). Tasks 9+10 commit together (welcome's new required fields are populated in the same commit). Tasks 13+14 commit together (`setDunkCourt` defined before use). Task 7 notes fixing any PlayerSnap literal in client mocks. Each task otherwise green on its own.
- **No placeholders:** new modules have complete code; existing-file edits show the exact insert/replace code + the line anchors from the read of `world.ts`/`net.ts`/`index.ts`/`scene.ts`/`geometry.ts`.
- **Phase-C seam contract:** the clinch is detected ONLY at the make-resolution seam (a successful shot/dunk make); a blocked or missed dunk does not clinch and needs no Phase-C hook — so the seam stays single (no retrofit into `tryDefend`). `combinedScore` is per-room/queryable, `mode` is the dimension tag, room teardown is programmatic. Phase C drops in additively.
- **Regression safety:** every `rimverse`-mode branch is byte-identical to today (the make seam computes `points = 2`, the victim −2 + score event stay outside `if (shooter)`, `dunkSkill` falls back to `p.skill`, defend/bots take the owned-rim path) — so the existing 169 tests stay green.
- **Faithful-port notes / adjust-as-we-go:** v3's dunk takeoff reach (3.7/4.5+turbo), flashy-dunk-on-fire, steal tuning (0.40/1500ms/800ms), and immediate scattered ball respawn ARE ported (Tasks 6/6b). One documented substrate adaptation (spec §3): v3 blocks airborne *jump shots*, but V5 has no standalone defender jump, so dunkContest block keeps V5's dunker-block with v3 reach 1.8 + the fire-out effect. The sim-driven scoring/steal/bot tests may need stabilization (set ball/positions directly — shown); keep the assertions. The base-court render (Task 14) is faithful-layout; per-court theming is B2. Client movement near the court wall predicts on the N-disc clamp and is corrected by server reconciliation (server `dcClamp` is authoritative) — a one-frame wall nudge at most.
