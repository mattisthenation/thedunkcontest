# RIMVERSE M4–M5: Breathing Court + Conflict & Growth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Many players share a court that morphs smoothly on join/leave with AOI-filtered snapshots (M4), then fight over balls with steal/block/stun/turbo and a size⇄skill tug-of-war (M5).

**Architecture:** Topology stays server-authoritative and instant in the sim; smoothness is client-only animation toward snapshot targets. Hoops are sent only when a `topoVersion` counter changes. AOI filtering happens in `snapshotFor` via a pure `aoiPlayers` helper. Turbo moves INTO the shared `stepPlayer` (state = pos + turbo meter) so prediction stays drift-free; progression/defend math lives in `shared/progression.ts` so server, bots, and HUD share formulas. Defend is ONE intent (Q) resolved contextually by the server into steal or block.

**Tech Stack:** unchanged (TS, ws, Three.js, Vitest). New: `tools/bots.ts` headless bot harness (seed of the M9 loadtest).

**Spec deviations chosen:** blocker gains a small skill/size reward (spec only specifies loser penalties; symmetric incentive feels right). Celebrate anim plays on any score (0.8 s lock).

---

## Milestone M4 — The breathing court

### Task 1: Spawn at your own hoop (TDD)

**Files:**
- Modify: `shared/src/geometry.ts`, `server/src/game/world.ts`, `shared/src/protocol.ts`, `server/src/net.ts`, `client/src/net/net.ts`, `client/src/main.ts`
- Test: `shared/test/geometry.test.ts` (extend)

- [x] **Step 1: Failing test** — append to `shared/test/geometry.test.ts`:

```ts
import { spawnPos } from '../src/geometry'; // merge into existing import

it('spawnPos sits inside the arena, near the owned hoop, facing the hub', () => {
  const rect = spawnPos(0, 1);
  expect(rect.y).toBeGreaterThan(-COURT_HALF_L); // pulled 2.5 in from the rim
  expect(rect.y).toBeLessThan(-COURT_HALF_L + 4);
  const disc = spawnPos(2, 8);
  const r = Math.hypot(disc.x, disc.y);
  expect(r).toBeLessThan(discRadius(8));
  expect(r).toBeGreaterThan(discRadius(8) - 4);
});
```

- [x] **Step 2: RED** — `npx vitest run shared/test/geometry.test.ts`

- [x] **Step 3: Implement** — `shared/src/geometry.ts`:

```ts
/** Spawn point for the owner of hoop i: 2.5 units inside their rim, toward the hub. */
export function spawnPos(i: number, n: number): Vec2 {
  const h = hoopPosition(i, n);
  if (n <= 2) return { x: h.x, y: h.y - Math.sign(h.y) * 2.5 };
  const r = discRadius(n);
  const f = (r - 2.5) / r;
  return { x: h.x * f, y: h.y * f };
}
```

Server `addPlayer` (world.ts), after `this.reslot()`: `p.pos = spawnPos(p.hoop, Math.max(1, this.players.size));`
Protocol welcome gains spawn: `{ t: 'welcome'; id: string; tick: number; x: number; y: number }`; `net.ts` sends `world.players.get(id)!.pos` coords; client `Net.onWelcome` becomes `(id, x, y)` and `main.ts` seeds `new Predictor({ x, y })`.

- [x] **Step 4: GREEN** — `npx vitest run` (all suites; fix any test assuming spawn at origin by setting `p.pos` explicitly)

- [x] **Step 5: Commit** — `git commit -m "feat: players spawn at their own hoop"`

### Task 2: AOI filtering (TDD)

**Files:**
- Create: `server/src/game/aoi.ts`
- Modify: `server/src/game/world.ts` (use in snapshotFor)
- Test: `server/test/aoi.test.ts`

- [x] **Step 1: Failing test** — `server/test/aoi.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aoiPlayers } from '../src/game/aoi';
import { World, type PlayerEnt } from '../src/game/world';

function ring(w: World, count: number): PlayerEnt[] {
  const out: PlayerEnt[] = [];
  for (let i = 0; i < count; i++) {
    const p = w.addPlayer(`p${i}`, `p${i}`);
    const a = (i / count) * Math.PI * 2;
    p.pos = { x: Math.cos(a) * 20, y: Math.sin(a) * 20 };
    out.push(p);
  }
  return out;
}

describe('aoiPlayers', () => {
  it('caps the list and keeps the nearest', () => {
    const w = new World();
    const all = ring(w, 60);
    const viewer = all[0];
    const seen = aoiPlayers(viewer, Array.from(w.players.values()), 28);
    expect(seen.length).toBeLessThanOrEqual(28);
    expect(seen).toContain(viewer);
    // immediate ring neighbours are nearer than the far side
    expect(seen).toContain(all[1]);
    expect(seen).not.toContain(all[30]); // diametrically opposite
  });

  it('always includes hoop attackers and ball carriers, even when far', () => {
    const w = new World();
    const all = ring(w, 60);
    const viewer = all[0];
    const attacker = all[30];
    attacker.action = { kind: 'dunk', until: 99, targetHoop: viewer.hoop };
    const carrier = all[29];
    carrier.ballId = 'b1';
    const seen = aoiPlayers(viewer, Array.from(w.players.values()), 28);
    expect(seen).toContain(attacker);
    expect(seen).toContain(carrier);
  });
});
```

- [x] **Step 2: RED**

- [x] **Step 3: Implement** — `server/src/game/aoi.ts`:

```ts
import type { PlayerEnt } from './world';

/**
 * Interest set for one viewer: self + anyone attacking the viewer's hoop +
 * all ball carriers (scarce, ≤ ceil(N/6)), then nearest others up to cap.
 */
export function aoiPlayers(viewer: PlayerEnt, all: PlayerEnt[], cap: number): PlayerEnt[] {
  const forced = new Set<PlayerEnt>([viewer]);
  for (const p of all) {
    if (p.action && p.action.targetHoop === viewer.hoop && viewer.hoop >= 0) forced.add(p);
    if (p.ballId !== null) forced.add(p);
  }
  const rest = all
    .filter((p) => !forced.has(p))
    .map((p) => ({ p, d: (p.pos.x - viewer.pos.x) ** 2 + (p.pos.y - viewer.pos.y) ** 2 }))
    .sort((a, b) => a.d - b.d);
  const out = [...forced];
  for (const { p } of rest) {
    if (out.length >= cap) break;
    out.push(p);
  }
  return out;
}
```

`world.ts` `snapshotFor`: `players: aoiPlayers(viewer, Array.from(this.players.values()), AOI_CAP).map(...)` where `viewer = this.players.get(viewerId)` (fall back to all-players map of self only if viewer missing). Import `AOI_CAP` from shared constants.

- [x] **Step 4: GREEN** — full run

- [x] **Step 5: Commit** — `git commit -m "feat(server): AOI-filtered snapshots (TDD)"`

### Task 3: Hoops only on topology change (TDD)

**Files:**
- Modify: `server/src/game/world.ts` (`topoVersion`), `shared/src/protocol.ts` (`tv`, optional hoops), `server/src/index.ts` (per-session tracking), `server/src/net.ts` (Session gains `lastTv`), `client/src/main.ts` (hoops cache)
- Test: `server/test/topology.test.ts` (extend)

- [x] **Step 1: Failing test** — append:

```ts
it('bumps topoVersion on join and leave', () => {
  const w = new World();
  const v0 = w.topoVersion;
  w.addPlayer('a', 'a');
  expect(w.topoVersion).toBeGreaterThan(v0);
  const v1 = w.topoVersion;
  w.removePlayer('a');
  expect(w.topoVersion).toBeGreaterThan(v1);
});

it('snapshotFor includes hoops only when asked', () => {
  const w = new World();
  w.addPlayer('a', 'a');
  expect(w.snapshotFor('a', true).hoops).toBeDefined();
  expect(w.snapshotFor('a', false).hoops).toBeUndefined();
});
```

- [x] **Step 2: RED**

- [x] **Step 3: Implement** —
world.ts: `topoVersion = 0;` incremented inside `reslot()`. `snapshotFor(viewerId: string, includeHoops = true)`: `tv: this.topoVersion`, `hoops: includeHoops ? this.hoopSnaps() : undefined`.
protocol.ts: `tv: number; hoops?: HoopSnap[];`
index.ts broadcast: `const inc = sess.lastTv !== world.topoVersion; send(sess.ws, world.snapshotFor(sess.id, inc)); if (inc) sess.lastTv = world.topoVersion;` (`lastTv: number` initialised to `-1` in net.ts Session).
client main.ts: `let hoops: HoopSnap[] = [];` — in `net.onSnapshot`: `if (snap.hoops) hoops = snap.hoops;` — frame loop uses the cached `hoops` for `syncHoops`.

- [x] **Step 4: GREEN** — full run

- [x] **Step 5: Commit** — `git commit -m "feat: hoops sent only on topology change (tv versioning)"`

### Task 4: Client smooth morph (visual)

**Files:**
- Modify: `client/src/scene/scene.ts`, `client/src/main.ts`

- [x] **Step 1: Implement** —
`setArena(n, dt)`: keep `floorN`; on change, rebuild grid group at the NEW radius/mode, then set `group.scale.setScalar(oldRadius/newRadius)` (rect↔disc: start at 0.85) and store `floorScaleTarget = 1`. Every call: `floor.scale.lerp` toward 1 with `dt*3`. Make grid materials transparent and fade in from 0.4 → full over the same lerp (traverse children, set `material.transparent = true`, animate `opacity`).
`syncHoops(hoops, myId, dt)`: instead of `g.position.set(...)`, lerp: `g.position.lerp(new THREE.Vector3(h.x, 0, h.y), Math.min(1, dt * 4)); g.lookAt(0,0,0);` New hoop groups start at `scale 0.01` and lerp scale to 1. Removed hoops: pop instantly (they're behind the leaver).
main.ts passes `dt` to both.

- [x] **Step 2: Verify** — with bots from Task 5 joining/leaving, the floor radius eases and hoops glide to new slots; no snapping.

- [x] **Step 3: Commit** — `git commit -m "feat(client): smooth court morph (eased radius, gliding hoops)"`

### Task 5: Bot harness + M4 GATE

**Files:**
- Create: `tools/bots.ts`

- [x] **Step 1: Implement** — `tools/bots.ts` (run: `npx tsx tools/bots.ts 8 ws://localhost:8081`):

```ts
import WebSocket from 'ws';
import { TICK_RATE } from '../shared/src/constants';
import type { ServerMsg, SnapshotMsg } from '../shared/src/protocol';

const count = Number(process.argv[2] ?? 8);
const url = process.argv[3] ?? 'ws://localhost:8081';

function startBot(i: number): void {
  const ws = new WebSocket(url);
  let myId: string | null = null;
  let seq = 0;
  let latest: SnapshotMsg | null = null;
  let wander = { mx: 0, my: 0 };
  setInterval(() => {
    if (Math.random() < 0.03) {
      const a = Math.random() * Math.PI * 2;
      wander = { mx: Math.cos(a), my: Math.sin(a) };
    }
  }, 100);

  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: `bot-${i}` })));
  ws.on('message', (raw) => {
    const msg: ServerMsg = JSON.parse(raw.toString());
    if (msg.t === 'welcome') myId = msg.id;
    else if (msg.t === 'snapshot') latest = msg;
  });

  setInterval(() => {
    if (!myId || !latest || ws.readyState !== WebSocket.OPEN) return;
    const me = latest.players.find((p) => p.id === myId);
    if (!me) return;
    let mx = wander.mx;
    let my = wander.my;
    let grab = false;
    let shoot = false;
    let dunk = false;
    const freeBall = latest.balls.find((b) => b.state === 'free');
    const enemyHoop = (latest.hoops ?? []).find((h) => h.owner && h.owner !== myId) ?? (latest.hoops ?? []).find((h) => h.owner !== myId);
    if (!me.hasBall && freeBall) {
      const d = Math.hypot(freeBall.x - me.x, freeBall.y - me.y);
      mx = (freeBall.x - me.x) / (d || 1);
      my = (freeBall.y - me.y) / (d || 1);
      grab = d < 1.2;
    } else if (me.hasBall && enemyHoop) {
      const d = Math.hypot(enemyHoop.x - me.x, enemyHoop.y - me.y);
      mx = (enemyHoop.x - me.x) / (d || 1);
      my = (enemyHoop.y - me.y) / (d || 1);
      if (d < 2.5) dunk = true;
      else if (d < 9 && Math.random() < 0.02) shoot = true;
    }
    ws.send(JSON.stringify({ t: 'intent', seq: ++seq, mx, my, grab, shoot, dunk }));
  }, 1000 / TICK_RATE);
}

for (let i = 0; i < count; i++) setTimeout(() => startBot(i), i * 400);
console.log(`[bots] ${count} bots → ${url}`);
```

(Note: bots cache hoops from their first snapshot — after Task 3, hoops only arrive on change, so keep a `let hoops` cache exactly like the client: `if (msg.hoops) hoops = msg.hoops`.)

- [x] **Step 2: M4 GATE** — Run server + client + `npx tsx tools/bots.ts 8`. Verify in the preview browser:
  1. Court morphs rectangle→disc as bots join; radius grows ~`R_base + 2.5√N`; hoops glide, floor eases.
  2. Kill the bot process → wedges close smoothly back toward the rectangle.
  3. `__rim.latest.players.length ≤ 28` even if you raise bots to 40 (AOI works); hoop attackers always visible.
  4. Bots visibly grab/dunk/score (HUD scores move).

- [x] **Step 3: Commit** — `git commit -m "feat(tools): wandering scoring bots; M4 gate verified"`

---

## Milestone M5 — Conflict & growth

### Task 6: Turbo inside the shared integrator (TDD)

**Files:**
- Modify: `shared/src/constants.ts`, `shared/src/sim.ts`, `shared/src/types.ts`, `shared/src/protocol.ts`
- Rewrite tests: `shared/test/sim.test.ts`
- Modify: `server/src/game/world.ts`, `server/src/net.ts`, `client/src/net/prediction.ts`, `client/test/prediction.test.ts`, `client/src/input.ts`, `client/src/main.ts`

- [x] **Step 1: New constants** —

```ts
export const TURBO_MULT = 1.6;
export const TURBO_MAX = 1.5; // seconds of boost in a full meter
export const TURBO_COOLDOWN = 2.5; // s after depletion before regen starts
export const TURBO_REGEN = 0.5; // meter-seconds gained per second
export const SIZE_MIN = 0.8;
export const SIZE_MAX = 1.3;
```

- [x] **Step 2: Failing tests** — rewrite `shared/test/sim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialSimState, speedFor, stepPlayer } from '../src/sim';
import { PLAYER_SPEED, TICK_DT, TURBO_MAX, TURBO_MULT } from '../src/constants';

const run = (state, input, ticks, n = 4, size = 1) => {
  for (let i = 0; i < ticks; i++) state = stepPlayer(state, input, TICK_DT, n, size);
  return state;
};

describe('stepPlayer v2', () => {
  it('moves at speedFor(size); bigger is slower', () => {
    expect(speedFor(0.8)).toBeGreaterThan(speedFor(1.3));
    const s = stepPlayer(initialSimState({ x: 0, y: 0 }), { mx: 1, my: 0 }, TICK_DT, 4, 1);
    expect(s.pos.x).toBeCloseTo(speedFor(1) * TICK_DT);
  });

  it('turbo multiplies speed and drains the meter', () => {
    const s = stepPlayer(initialSimState({ x: 0, y: 0 }), { mx: 1, my: 0, turbo: true }, TICK_DT, 4, 1);
    expect(s.pos.x).toBeCloseTo(speedFor(1) * TURBO_MULT * TICK_DT);
    expect(s.turboLeft).toBeLessThan(TURBO_MAX);
  });

  it('meter depletes, cools down, then regenerates', () => {
    let s = run(initialSimState({ x: 0, y: 0 }), { mx: 0, my: 0, turbo: true }, Math.ceil((TURBO_MAX / TICK_DT) * 1.2));
    expect(s.turboLeft).toBe(0);
    expect(s.turboCd).toBeGreaterThan(0);
    s = run(s, { mx: 0, my: 0 }, 200); // ~6.7 s: cooldown passes, meter refills
    expect(s.turboLeft).toBeGreaterThan(0.5);
  });

  it('is deterministic for prediction parity', () => {
    const inputs = Array.from({ length: 50 }, (_, i) => ({ mx: Math.sin(i), my: Math.cos(i), turbo: i % 7 < 3 }));
    let a = initialSimState({ x: 1, y: 1 });
    let b = initialSimState({ x: 1, y: 1 });
    for (const inp of inputs) {
      a = stepPlayer(a, inp, TICK_DT, 8, 1.1);
      b = stepPlayer(b, inp, TICK_DT, 8, 1.1);
    }
    expect(a).toEqual(b);
  });
});
```

- [x] **Step 3: RED**, then implement `shared/src/sim.ts`:

```ts
import { PLAYER_SPEED, TURBO_COOLDOWN, TURBO_MAX, TURBO_MULT, TURBO_REGEN } from './constants';
import { clampToArena } from './geometry';
import type { Vec2 } from './types';

export interface SimInput {
  mx: number;
  my: number;
  turbo?: boolean;
}

export interface SimState {
  pos: Vec2;
  turboLeft: number;
  turboCd: number;
}

export function initialSimState(pos: Vec2): SimState {
  return { pos: { ...pos }, turboLeft: TURBO_MAX, turboCd: 0 };
}

/** Big = slower: size 0.8 → ×1.06, size 1.3 → ×0.91. */
export function speedFor(size: number): number {
  return PLAYER_SPEED * (1.3 - 0.3 * size);
}

/** The single movement integrator (server sim AND client prediction). Pure. */
export function stepPlayer(s: SimState, input: SimInput, dt: number, n: number, size = 1): SimState {
  let { mx, my } = input;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  let turboLeft = s.turboLeft;
  let turboCd = s.turboCd;
  let speed = speedFor(size);
  if (input.turbo && turboLeft > 0) {
    speed *= TURBO_MULT;
    turboLeft = Math.max(0, turboLeft - dt);
    if (turboLeft === 0) turboCd = TURBO_COOLDOWN;
  } else if (turboCd > 0) {
    turboCd = Math.max(0, turboCd - dt);
  } else {
    turboLeft = Math.min(TURBO_MAX, turboLeft + dt * TURBO_REGEN);
  }
  const pos = clampToArena({ x: s.pos.x + mx * speed * dt, y: s.pos.y + my * speed * dt }, n);
  return { pos, turboLeft, turboCd };
}
```

- [x] **Step 4: Wire everywhere** —
types.ts `PlayerSnap` += `skill: number; turboLeft: number; turboCd: number;` (skill defaults 0.5 until Task 7).
protocol.ts `IntentMsg` += `turbo?: boolean; defend?: boolean;`
world.ts `PlayerEnt` += `turboLeft: number; turboCd: number; skill: number;` (init `TURBO_MAX, 0, 0.5`); intent application becomes:

```ts
const next = stepPlayer(
  { pos: p.pos, turboLeft: p.turboLeft, turboCd: p.turboCd },
  intent, TICK_DT, n, p.size,
);
p.pos = next.pos;
p.turboLeft = next.turboLeft;
p.turboCd = next.turboCd;
```

net.ts passes `turbo: !!msg.turbo, defend: !!msg.defend` into pendingIntents (PlayerIntent gains both fields; all test intent literals gain `turbo:false, defend:false` — or make a helper).
prediction.ts: Predictor holds `state: SimState`; `applyInput(input, n, size)`; `reconcile(server: {x,y,turboLeft,turboCd}, ack, n, size)` replays pending through `stepPlayer`. `get pos()` returns `state.pos`. Rewrite `client/test/prediction.test.ts` against the new API (same three scenarios, plus: turbo state survives reconcile replay).
input.ts: `move()` returns `{mx,my,turbo: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')}`; `KeyQ` latches `defend`.
main.ts: send `turbo`/`defend` in the intent; HUD line gains a turbo bar: `'TURBO ' + '█'.repeat(Math.round((me?.turboLeft ?? 0) / TURBO_MAX * 8)).padEnd(8, '░')`.

- [x] **Step 5: GREEN** — full `npx vitest run` + `npm run typecheck`; play-test: Shift sprints, meter drains/refills on HUD.

- [x] **Step 6: Commit** — `git commit -m "feat: turbo in shared integrator, drift-free prediction (TDD)"`

### Task 7: Progression — size⇄skill tug-of-war (TDD)

**Files:**
- Create: `shared/src/progression.ts`
- Modify: `server/src/game/world.ts` (score resolution), `server/src/game/shooting.ts` (skill-aware accuracy + dunk range)
- Test: `shared/test/progression.test.ts`

- [x] **Step 1: Failing test** — `shared/test/progression.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyScore, applyBlocked, accuracy, dunkRangeFor, stealChance, blockChance } from '../src/progression';
import { SIZE_MAX, SIZE_MIN } from '../src/constants';

describe('progression', () => {
  it('scorer grows and skills up; victim shrinks and skills down, with clamps', () => {
    const scorer = { size: 1, skill: 0.5 };
    const victim = { size: 1, skill: 0.5 };
    applyScore(scorer, victim);
    expect(scorer.size).toBeGreaterThan(1);
    expect(scorer.skill).toBeGreaterThan(0.5);
    expect(victim.size).toBeLessThan(1);
    expect(victim.skill).toBeLessThan(0.5);
    for (let i = 0; i < 100; i++) applyScore(scorer, victim);
    expect(scorer.size).toBeLessThanOrEqual(SIZE_MAX);
    expect(victim.size).toBeGreaterThanOrEqual(SIZE_MIN);
    expect(scorer.skill).toBeLessThanOrEqual(1);
    expect(victim.skill).toBeGreaterThanOrEqual(0);
  });

  it('blocked shooter shrinks; blocker gains a little', () => {
    const shooter = { size: 1, skill: 0.5 };
    const blocker = { size: 1, skill: 0.5 };
    applyBlocked(shooter, blocker);
    expect(shooter.skill).toBeLessThan(0.5);
    expect(blocker.skill).toBeGreaterThan(0.5);
  });

  it('skill raises accuracy and dunk range; matchup odds favor higher skill', () => {
    expect(accuracy(8, 0.9)).toBeGreaterThan(accuracy(8, 0.1));
    expect(dunkRangeFor(0.9)).toBeGreaterThan(dunkRangeFor(0.1));
    expect(stealChance({ size: 1, skill: 0.8 }, { size: 1, skill: 0.2 })).toBeGreaterThan(
      stealChance({ size: 1, skill: 0.2 }, { size: 1, skill: 0.8 }),
    );
    expect(blockChance({ size: 1.2, skill: 0.7 }, { size: 1, skill: 0.5 })).toBeGreaterThan(0.5);
    // everything stays a probability
    expect(stealChance({ size: 1, skill: 1 }, { size: 1, skill: 0 })).toBeLessThanOrEqual(0.9);
    expect(blockChance({ size: 0.8, skill: 0 }, { size: 1.3, skill: 1 })).toBeGreaterThanOrEqual(0.05);
  });
});
```

- [x] **Step 2: RED**, then implement `shared/src/progression.ts`:

```ts
import { DUNK_RANGE, SIZE_MAX, SIZE_MIN } from './constants';

export interface Build {
  size: number;
  skill: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clampBuild = (b: Build) => {
  b.size = clamp(b.size, SIZE_MIN, SIZE_MAX);
  b.skill = clamp(b.skill, 0, 1);
};

/** Tug-of-war: scoring grows you (slower, juicier target) and skills you up. */
export function applyScore(scorer: Build, victim: Build | null): void {
  scorer.size += 0.04;
  scorer.skill += 0.05;
  clampBuild(scorer);
  if (victim) {
    victim.size -= 0.03;
    victim.skill -= 0.04;
    clampBuild(victim);
  }
}

export function applyBlocked(shooter: Build, blocker: Build): void {
  shooter.size -= 0.02;
  shooter.skill -= 0.03;
  blocker.size += 0.02;
  blocker.skill += 0.03;
  clampBuild(shooter);
  clampBuild(blocker);
}

/** Make probability: distance falloff, skill swing of ±0.15. */
export function accuracy(dist: number, skill: number): number {
  return clamp(0.92 - 0.035 * dist + 0.3 * (skill - 0.5), 0.05, 0.97);
}

export function dunkRangeFor(skill: number): number {
  return DUNK_RANGE * (1 + 0.6 * (skill - 0.5));
}

export function stealChance(att: Build, def: Build): number {
  return clamp(0.45 + 0.4 * (att.skill - def.skill) + 0.2 * (def.size - 1), 0.1, 0.9);
}

export function blockChance(blocker: Build, shooter: Build): number {
  return clamp(0.5 + 0.5 * (blocker.skill - shooter.skill) + 0.3 * (blocker.size - 1), 0.05, 0.9);
}
```

(Note `stealChance`: a BIG carrier is an easier steal target — `+0.2*(def.size-1)` — reinforcing "the lead is never safe".)

- [x] **Step 3: Wire** —
shooting.ts: `makeProbability(dist)` → delegate: `export const makeProbability = (dist: number, skill = 0.5) => accuracy(dist, skill);` `inDunkRange(pos, hoop, skill = 0.5)` uses `dunkRangeFor(skill)`. world.ts `startShoot` passes `p.skill`; `tryDunk` passes `p.skill`.
world.ts score resolution (`tickFlightsAndActions`, made branch): replace manual `score +=` with score AND `applyScore(shooter, owner ?? null)` (PlayerEnt already has size/skill fields — Build-compatible). Keep the ±2 score points.
`snapshotFor` already maps size; add `skill: p.skill, turboLeft: p.turboLeft, turboCd: p.turboCd`.

- [x] **Step 4: GREEN** — full run; existing shooting test still passes (default skill 0.5 keeps old probabilities).

- [x] **Step 5: Commit** — `git commit -m "feat: size-skill tug-of-war progression (TDD)"`

### Task 8: Defend — contextual steal/block + stun (TDD)

**Files:**
- Create: `server/src/game/defend.ts`
- Modify: `server/src/game/world.ts`
- Test: `server/test/defend.test.ts`

- [x] **Step 1: Failing test** — `server/test/defend.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { STUN_TIME, TICK_RATE } from '../../shared/src/constants';

const intent = (seq: number, over: Partial<{ mx: number; my: number; grab: boolean; shoot: boolean; dunk: boolean; defend: boolean; turbo: boolean }> = {}) =>
  ({ seq, mx: 0, my: 0, grab: false, shoot: false, dunk: false, defend: false, turbo: false, ...over });

function carrierAndDefender() {
  const w = new World();
  const c = w.addPlayer('carrier', 'c');
  const d = w.addPlayer('defender', 'd');
  c.pos = { x: 0, y: 0 };
  d.pos = { x: 0.8, y: 0 };
  c.pendingIntents.push(intent(1, { grab: true }));
  w.step();
  expect(c.ballId).not.toBeNull();
  return { w, c, d };
}

describe('defend', () => {
  it('successful steal knocks the ball loose and stuns the carrier', () => {
    const { w, c, d } = carrierAndDefender();
    w.rng = () => 0; // force success
    d.pendingIntents.push(intent(1, { defend: true }));
    w.step();
    expect(c.ballId).toBeNull();
    expect(c.anim).toBe('stunned');
    expect(d.anim).toBe('steal');
    expect(w.ballSnaps()[0].state).toBe('free');
  });

  it('failed steal just locks the stealer briefly', () => {
    const { w, c, d } = carrierAndDefender();
    w.rng = () => 0.999; // force failure
    d.pendingIntents.push(intent(1, { defend: true }));
    w.step();
    expect(c.ballId).not.toBeNull();
    expect(d.anim).toBe('steal');
  });

  it('stunned players cannot move until the stun expires', () => {
    const { w, c } = carrierAndDefender();
    w.rng = () => 0;
    w.players.get('defender')!.pendingIntents.push(intent(1, { defend: true }));
    w.step();
    const before = { ...c.pos };
    c.pendingIntents.push(intent(2, { mx: 1 }));
    w.step();
    expect(c.pos).toEqual(before);
    for (let i = 0; i < Math.ceil(STUN_TIME * TICK_RATE) + 2; i++) w.step();
    c.pendingIntents.push(intent(3, { mx: 1 }));
    w.step();
    expect(c.pos.x).toBeGreaterThan(before.x);
  });

  it('block cancels a dunk: ball loose, dunker stunned, blocker rewarded', () => {
    const w = new World();
    const a = w.addPlayer('dunker', 'a');
    const b = w.addPlayer('blocker', 'b');
    a.pos = { x: 0, y: 0 };
    a.pendingIntents.push(intent(1, { grab: true }));
    w.step();
    // walk dunker into range of b's hoop? simpler: teleport next to ANY enemy hoop
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'dunker')!;
    a.pos = { x: hoop.x, y: hoop.y - 2 };
    b.pos = { x: hoop.x, y: hoop.y - 2.5 };
    a.pendingIntents.push(intent(2, { dunk: true }));
    w.step();
    expect(a.anim).toBe('dunk');
    const skillBefore = b.skill;
    w.rng = () => 0; // force block success
    b.pendingIntents.push(intent(1, { defend: true }));
    w.step();
    expect(a.anim).toBe('stunned');
    expect(b.skill).toBeGreaterThan(skillBefore);
    expect(w.ballSnaps()[0].state).toBe('free');
    expect(a.score).toBe(0);
    for (let i = 0; i < TICK_RATE * 2; i++) w.step();
    expect(a.score).toBe(0); // the cancelled flight never lands
  });
});
```

- [x] **Step 2: RED**, then implement `server/src/game/defend.ts`:

```ts
import { STEAL_RANGE } from '../../../shared/src/constants';
import { blockReachFor } from '../../../shared/src/progression';
import type { PlayerEnt } from './world';

/** Nearest enemy ball-carrier in steal range (not mid-action). */
export function findStealTarget(defender: PlayerEnt, all: PlayerEnt[]): PlayerEnt | null {
  let best: PlayerEnt | null = null;
  let bestD = STEAL_RANGE;
  for (const p of all) {
    if (p === defender || p.ballId === null || p.action) continue;
    const d = Math.hypot(p.pos.x - defender.pos.x, p.pos.y - defender.pos.y);
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Nearest dunker (pre-slam) within block reach. */
export function findBlockTarget(defender: PlayerEnt, all: PlayerEnt[], time: number): PlayerEnt | null {
  const reach = blockReachFor(defender.size, defender.skill);
  let best: PlayerEnt | null = null;
  let bestD = reach;
  for (const p of all) {
    if (p === defender || p.action?.kind !== 'dunk') continue;
    const d = Math.hypot(p.pos.x - defender.pos.x, p.pos.y - defender.pos.y);
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
```

Add to progression.ts: `export function blockReachFor(size: number, skill: number): number { return BLOCK_RANGE * (1 + 0.4 * (size - 1) + 0.3 * (skill - 0.5)); }` and to constants: `STEAL_RANGE = 1.6; BLOCK_RANGE = 2.2; STUN_TIME = 1.2; STEAL_LOCK = 0.45; BLOCK_LOCK = 0.5;`

world.ts: in the intent loop (inside `if (!p.action)`), after shoot/dunk handling: `else if (intent.defend) this.tryDefend(p);`

```ts
private tryDefend(p: PlayerEnt): void {
  const all = Array.from(this.players.values());
  const stealTarget = findStealTarget(p, all);
  if (stealTarget) {
    p.action = { kind: 'steal', until: this.time + STEAL_LOCK, targetHoop: -1 };
    p.anim = 'steal';
    if (this.rng() < stealChance(p, stealTarget)) {
      const ball = this.balls.get(stealTarget.ballId!);
      if (ball) {
        ball.state = 'free';
        ball.carrier = null;
        const a = this.rng() * Math.PI * 2;
        ball.pos = clampToArena(
          { x: stealTarget.pos.x + Math.cos(a), y: stealTarget.pos.y + Math.sin(a) },
          Math.max(1, this.players.size),
        );
      }
      stealTarget.ballId = null;
      this.stun(stealTarget);
      this.events.push({ kind: 'steal', player: p.id, hoop: -1 });
    }
    return;
  }
  const dunker = findBlockTarget(p, all, this.time);
  p.action = { kind: 'block', until: this.time + BLOCK_LOCK, targetHoop: -1 };
  p.anim = 'block';
  if (dunker && this.rng() < blockChance(p, dunker)) {
    // cancel the dunk: kill the in-flight ball, drop it loose at the rim approach
    for (const b of this.balls.values()) {
      if (b.state === 'flight' && b.flight?.shooter === dunker.id) {
        b.state = 'free';
        b.flight = null;
        b.z = 0;
        const a = this.rng() * Math.PI * 2;
        b.pos = clampToArena(
          { x: dunker.pos.x + Math.cos(a) * 1.5, y: dunker.pos.y + Math.sin(a) * 1.5 },
          Math.max(1, this.players.size),
        );
      }
    }
    applyBlocked(dunker, p);
    this.stun(dunker);
    this.events.push({ kind: 'block', player: p.id, hoop: -1 });
  }
}

private stun(p: PlayerEnt): void {
  p.action = { kind: 'stunned', until: this.time + STUN_TIME, targetHoop: -1 };
  p.anim = 'stunned';
}
```

Action kind union in PlayerEnt widens to `'shoot' | 'dunk' | 'steal' | 'block' | 'stunned' | 'celebrate'`. GameEvent kind union += `'steal' | 'block'`. PlayerIntent += `defend: boolean` (update existing test literals via the `intent()` helpers already in each test file).
Celebrate: in the made-shot branch after `applyScore`, if shooter exists: `shooter.action = { kind: 'celebrate', until: this.time + 0.8, targetHoop: f.targetHoop }; shooter.anim = 'celebrate';`

- [x] **Step 3: GREEN** — full run (existing M3 dunk test still passes: nobody defends).

- [x] **Step 4: Commit** — `git commit -m "feat(server): contextual defend - steals, dunk blocks, stuns (TDD)"`

### Task 9: New animations — steal, block, stunned, celebrate

**Files:**
- Modify: `shared/src/types.ts` (AnimState), `client/src/sprites/poses.ts`, `client/test/atlas.test.ts` (rowCount 6→10), `client/src/input.ts` (already has Q), HUD help line in `client/src/main.ts`

- [x] **Step 1: Extend AnimState** — `'steal' | 'block' | 'stunned' | 'celebrate'` added to the union.

- [x] **Step 2: Author keyframes** — append to `poses.ts` (tune in preview after):

```ts
/** Steal: 4f @ 16 fps one-shot — low lunge with a swipe. */
const steal: AnimDef = {
  fps: 16,
  loop: false,
  frames: [
    P({ rootY: 0.44, lean: 14, thN: 30, shN: 30, thF: -18, shF: 24, uaN: 20, faN: 30, uaF: -14, faF: 20 }),
    P({ rootY: 0.41, lean: 22, thN: 42, shN: 38, thF: -24, shF: 30, uaN: 55, faN: 10, uaF: -18, faF: 24 }), // swipe out
    P({ rootY: 0.42, lean: 18, thN: 36, shN: 34, thF: -20, shF: 26, uaN: 70, faN: 6, uaF: -16, faF: 22 }),  // full extension
    P({ rootY: 0.45, lean: 10, thN: 24, shN: 26, thF: -14, shF: 20, uaN: 30, faN: 24, uaF: -12, faF: 18 }), // recover
  ],
};

/** Block: 4f @ 16 fps one-shot — vertical leap, arms up. */
const block: AnimDef = {
  fps: 16,
  loop: false,
  frames: [
    P({ rootY: 0.42, lean: 2, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 60, faN: 60, uaF: -50, faF: 55 }),   // crouch
    P({ rootY: 0.62, lean: 0, thN: 18, shN: 30, thF: -10, shF: 34, uaN: 160, faN: 15, uaF: -150, faF: 18 }), // leap
    P({ rootY: 0.72, lean: -2, thN: 14, shN: 36, thF: -8, shF: 38, uaN: 175, faN: 5, uaF: -168, faF: 8 }),   // peak, wall of arms
    P({ rootY: 0.5, lean: 2, thN: 22, shN: 28, thF: -12, shF: 24, uaN: 90, faN: 20, uaF: -80, faF: 22 }),    // land
  ],
};

/** Stunned: 4f @ 8 fps loop — wobble, stars implied. */
const stunned: AnimDef = {
  fps: 8,
  loop: true,
  frames: [
    P({ rootY: 0.43, lean: -6, headTilt: -12, thN: 14, shN: 24, thF: -10, shF: 18, uaN: -20, faN: 30, uaF: 24, faF: 28 }),
    P({ rootY: 0.425, lean: 4, headTilt: 10, thN: 16, shN: 26, thF: -12, shF: 20, uaN: -10, faN: 26, uaF: 16, faF: 30 }),
    P({ rootY: 0.43, lean: 8, headTilt: 14, thN: 14, shN: 24, thF: -10, shF: 18, uaN: 10, faN: 28, uaF: -12, faF: 26 }),
    P({ rootY: 0.425, lean: -2, headTilt: -8, thN: 16, shN: 26, thF: -12, shF: 20, uaN: 20, faN: 30, uaF: -22, faF: 28 }),
  ],
};

/** Celebrate: 4f @ 10 fps one-shot — both fists up. */
const celebrate: AnimDef = {
  fps: 10,
  loop: false,
  frames: [
    P({ rootY: 0.46, lean: -4, thN: 8, shN: 10, thF: -8, shF: 10, uaN: 40, faN: 70, uaF: -40, faF: 70 }),
    P({ rootY: 0.52, lean: -8, thN: 12, shN: 18, thF: -12, shF: 18, uaN: 150, faN: 30, uaF: -150, faF: 30 }),
    P({ rootY: 0.56, lean: -10, thN: 16, shN: 24, thF: -16, shF: 24, uaN: 170, faN: 10, uaF: -170, faF: 10 }), // peak fists
    P({ rootY: 0.48, lean: -4, thN: 8, shN: 12, thF: -8, shF: 12, uaN: 120, faN: 25, uaF: -120, faF: 25 }),
  ],
};
```

`ANIMS` export += `steal, block, stunned, celebrate`. `client/src/scene/scene.ts` one-shot guard extends: `anim === 'shoot' || anim === 'dunk' || anim === 'steal' || anim === 'block'` (stunned/celebrate handled as normal switches — stunned loops, celebrate is server-timed).
Atlas test: `expect(layout.rowCount).toBe(10)`.
HUD help: `WASD move · SHIFT turbo · E grab · SPACE shoot · F dunk · Q steal/block`.

- [x] **Step 3: Verify in preview** — `/preview.html` shows the four new cells + filmstrips; check silhouettes read (lunge, wall-of-arms, wobble, fists).

- [x] **Step 4: GREEN + Commit** — `git commit -m "feat(client): steal/block/stunned/celebrate animations"`

### Task 10: M5 GATE — tradeoff verification + wrap-up

**Files:**
- Modify: `README.md` (controls + status), plan checkboxes

- [x] **Step 1: Numeric gate** — vitest already pins: speed falls as size rises; accuracy/dunk range rise with skill; steal odds favor skill and punish big carriers. Play-test with 8 bots: scores swing both ways, sizes visibly diverge then recover (watch two bots trade dunks), Q near a carrier knocks the ball loose, Q under a dunker cancels it, stun freezes movement ~1.2 s, Shift drains/refills the HUD meter.

- [x] **Step 2: The "leads aren't safe" check** — let bots run 3 minutes; confirm no bot pins the max size forever (big = slow + easy steal target should pull leaders back). If a runaway leader emerges, increase `+0.2*(def.size-1)` steal term to `+0.3` and/or score growth from 0.04 → 0.03.

- [x] **Step 3: README + commit** — update Status section (M0–M5), controls line; flip plan checkboxes; `git commit -m "docs: M4-M5 complete"`.

---

## Self-review notes

1. **Spec coverage M4:** topology smooth re-slot ✓ (T3 server version + T4 client morph), radius scaling already shared, join/leave ✓, AOI ✓ (T2), multiplayer ✓ (T5 bots). M5: steal ✓, block+stun ✓ (T8), turbo ✓ (T6), size⇄skill with clamps and no elimination ✓ (T7), anims ✓ (T9), tradeoff verify ✓ (T10).
2. **Type consistency:** `SimState{pos,turboLeft,turboCd}` used by world+predictor; `Build{size,skill}` structurally matches `PlayerEnt`; `PlayerIntent` gains `turbo`/`defend` and every test literal goes through a local `intent()` helper; `snapshotFor(viewerId, includeHoops)` matches both call sites; `AnimState` union matches `ANIMS` keys (10 rows).
3. **Known interaction:** AOI (T2) lands before bots (T5) so the 40-bot check exercises it; hoops-on-change (T3) requires the bot hoop cache noted in T5.
4. **Prediction parity risk:** size affects speed and arrives via snapshot; a size change mid-prediction causes one rubber-band frame — accepted (reconcile fixes it).
