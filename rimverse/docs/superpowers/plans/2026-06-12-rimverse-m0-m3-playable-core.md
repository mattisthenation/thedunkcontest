# RIMVERSE M0–M3: Playable Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A server-authoritative arcade basketball core: connect, move on the disc with prediction/reconciliation, see NBA-Jam-cadence dribble/run sprites, grab scarce hub balls, shoot and dunk on rims, score — all outcomes decided by the server.

**Architecture:** npm-workspaces monorepo (`shared/` dependency-free TS imported relatively by both sides; `server/` Node+ws fixed 30 Hz tick, snapshots every 2nd tick; `client/` Vite+Three.js with billboarded canvas-rendered parametric sprites). Clients send intents only; the shared `stepPlayer` function is the single movement integrator used by both server sim and client prediction. The sim is a flat 2D plane (`Vec2{x,y}`, client maps y→Three z).

**Tech Stack:** TypeScript (strict, ESM, `moduleResolution: bundler`, extensionless relative imports), Node ≥20, `ws`, Three.js, Vite, Vitest, tsx (server runtime).

**Scope:** Spec milestones M0–M3. Deliberately deferred to later plans: turbo/steal/block/stun + progression (M5), topology breathing + AOI (M4), dunk roster (M6), vaporwave/Escher pass (M7), SQLite identity (M8), loadtest/deploy (M9). Hoops are placed via the shared geometry from day one so M4 re-slotting drops in cleanly.

**Spec deviations chosen (spec §8 says override freely):** snapshots at 15 Hz (every 2nd tick — clean divisor of 30, inside the spec's 15–20 band). M2 ships side-profile + horizontal flip (2 facings) to nail the dribble gate, with front/back rows as the final M2 task (4-dir minimum per spec §4.2).

---

## Milestone M0 — Scaffold

### Task 1: Repo hygiene + workspace scaffold

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.base.json`, `vitest.config.ts`
- Create: `shared/package.json`, `shared/tsconfig.json`
- Create: `server/package.json`, `server/tsconfig.json`
- Create: `client/package.json`, `client/tsconfig.json`
- Move: `INITIAL_DESIGN_SPEC.md` → `docs/INITIAL_DESIGN_SPEC.md`

- [x] **Step 1: Write config files**

`.gitignore`:
```
node_modules/
dist/
*.db
*.db-journal
.DS_Store
```

`package.json` (root):
```json
{
  "name": "rimverse",
  "private": true,
  "type": "module",
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "concurrently -n srv,web -c blue,magenta \"npm run dev -w server\" \"npm run dev -w client\"",
    "test": "vitest run",
    "typecheck": "tsc -b shared server client"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  }
}
```

`vitest.config.ts` (root):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['*/test/**/*.test.ts'] },
});
```

`shared/package.json`:
```json
{ "name": "@rimverse/shared", "private": true, "type": "module" }
```

`shared/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["src", "test"] }
```

`server/package.json`:
```json
{
  "name": "@rimverse/server",
  "private": true,
  "type": "module",
  "scripts": { "dev": "tsx watch src/index.ts", "start": "tsx src/index.ts" },
  "dependencies": { "ws": "^8.18.0" },
  "devDependencies": { "@types/ws": "^8.5.0", "tsx": "^4.19.0", "@types/node": "^22.0.0" }
}
```

`server/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "../shared/src"]
}
```

`client/package.json`:
```json
{
  "name": "@rimverse/client",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "three": "^0.170.0" },
  "devDependencies": { "@types/three": "^0.170.0", "vite": "^6.0.0" }
}
```

`client/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022", "DOM"] },
  "include": ["src", "test", "../shared/src"]
}
```

- [x] **Step 2: Move spec into docs/, install, verify install**

Run: `git mv INITIAL_DESIGN_SPEC.md docs/INITIAL_DESIGN_SPEC.md && npm install`
Expected: lockfile created, no errors.

- [x] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold npm-workspaces monorepo (shared/server/client)"
```

### Task 2: Shared constants + types (smoke test)

**Files:**
- Create: `shared/src/constants.ts`, `shared/src/types.ts`
- Test: `shared/test/constants.test.ts`

- [x] **Step 1: Write the failing test**

`shared/test/constants.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { TICK_RATE, TICK_DT, ballCount } from '../src/constants';

describe('constants', () => {
  it('tick math is consistent', () => {
    expect(TICK_DT).toBeCloseTo(1 / TICK_RATE);
  });
  it('ball scarcity: max(1, ceil(N/6))', () => {
    expect(ballCount(1)).toBe(1);
    expect(ballCount(6)).toBe(1);
    expect(ballCount(7)).toBe(2);
    expect(ballCount(100)).toBe(17);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/test/constants.test.ts`
Expected: FAIL (cannot resolve `../src/constants`)

- [x] **Step 3: Write the implementation**

`shared/src/constants.ts`:
```ts
export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
export const SNAPSHOT_EVERY = 2; // every 2nd tick → 15 Hz

export const R_BASE = 14; // disc radius at small N (meters-ish)
export const R_K = 2.5; // R = R_BASE + R_K * sqrt(N)
export const COURT_HALF_W = 8; // rectangle mode (N <= 2)
export const COURT_HALF_L = 14;

export const PLAYER_SPEED = 8;
export const PLAYER_RADIUS = 0.5;

export const GRAB_RADIUS = 1.4;
export const DUNK_RANGE = 3.0;
export const DUNK_TIME = 0.9; // s, action lock
export const SHOOT_TIME = 0.7;
export const BALL_RESPAWN_DELAY = 3;

export const INTERP_DELAY_MS = 100;
export const MAX_INTENTS_PER_TICK = 5;
export const SERVER_PORT = 8081;

export const ballCount = (n: number) => Math.max(1, Math.ceil(n / 6));
```

`shared/src/types.ts`:
```ts
export interface Vec2 {
  x: number;
  y: number;
}

export type AnimState =
  | 'idle'
  | 'run'
  | 'dribbleIdle'
  | 'dribbleRun'
  | 'shoot'
  | 'dunk';

export interface PlayerSnap {
  id: string;
  name: string;
  x: number;
  y: number;
  dx: number; // facing (unit-ish)
  dy: number;
  anim: AnimState;
  size: number; // 1.0 until M5 progression
  hue: number; // appearance tint bucket, server-assigned
  hasBall: boolean;
  score: number;
  hoop: number; // owned hoop index, -1 if none
}

export type BallState = 'free' | 'carried' | 'flight' | 'respawning';

export interface BallSnap {
  id: string;
  x: number;
  y: number;
  z: number; // render height (flight arc); sim stays 2D
  state: BallState;
  carrier: string | null;
}

export interface HoopSnap {
  index: number;
  x: number;
  y: number;
  owner: string | null;
}

export interface GameEvent {
  kind: 'score' | 'miss' | 'shootStart' | 'dunkStart';
  player: string;
  hoop: number;
  points?: number;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/test/constants.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add shared && git commit -m "feat(shared): constants and snapshot/entity types"
```

### Task 3: Protocol + WS server boot with 30 Hz tick

**Files:**
- Create: `shared/src/protocol.ts`, `server/src/index.ts`, `server/src/net.ts`, `server/src/game/world.ts` (skeleton)

- [x] **Step 1: Write protocol types**

`shared/src/protocol.ts`:
```ts
import type { BallSnap, GameEvent, HoopSnap, PlayerSnap } from './types';

export interface IntentMsg {
  t: 'intent';
  seq: number;
  mx: number; // move dir, |[mx,my]| <= 1
  my: number;
  grab?: boolean;
  shoot?: boolean;
  dunk?: boolean;
}

export type ClientMsg = { t: 'join'; name: string } | IntentMsg;

export interface SnapshotMsg {
  t: 'snapshot';
  tick: number;
  ack: number; // last intent seq the server applied for *this* client
  n: number; // current player count (drives geometry)
  players: PlayerSnap[];
  balls: BallSnap[];
  hoops: HoopSnap[];
  events: GameEvent[];
}

export type ServerMsg = { t: 'welcome'; id: string; tick: number } | SnapshotMsg;
```

- [x] **Step 2: World skeleton (players join/leave, tick counter)**

`server/src/game/world.ts`:
```ts
import { TICK_DT } from '../../../shared/src/constants';
import type { AnimState, Vec2 } from '../../../shared/src/types';

export interface PlayerEnt {
  id: string;
  name: string;
  pos: Vec2;
  dir: Vec2;
  lastSeq: number;
  pendingIntents: { seq: number; mx: number; my: number; grab: boolean; shoot: boolean; dunk: boolean }[];
  anim: AnimState;
  size: number;
  hue: number;
  ballId: string | null;
  score: number;
  hoop: number;
  action: { kind: 'shoot' | 'dunk'; until: number; targetHoop: number } | null;
}

export class World {
  tick = 0;
  players = new Map<string, PlayerEnt>();

  get time(): number {
    return this.tick * TICK_DT;
  }

  addPlayer(id: string, name: string): PlayerEnt {
    const hue = (Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
    const p: PlayerEnt = {
      id, name,
      pos: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      lastSeq: 0,
      pendingIntents: [],
      anim: 'idle',
      size: 1,
      hue,
      ballId: null,
      score: 0,
      hoop: -1,
      action: null,
    };
    this.players.set(id, p);
    return p;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  step(): void {
    this.tick++;
  }
}
```

- [x] **Step 3: WS server + loop**

`server/src/net.ts`:
```ts
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { ClientMsg, ServerMsg } from '../../shared/src/protocol';
import { World } from './game/world';

export interface Session {
  id: string;
  ws: WebSocket;
  joined: boolean;
}

export function startNet(world: World, port: number): { wss: WebSocketServer; sessions: Map<string, Session> } {
  const wss = new WebSocketServer({ port });
  const sessions = new Map<string, Session>();

  wss.on('connection', (ws) => {
    const id = randomUUID().slice(0, 8);
    const sess: Session = { id, ws, joined: false };
    sessions.set(id, sess);

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.t === 'join' && !sess.joined) {
        sess.joined = true;
        world.addPlayer(id, String(msg.name).slice(0, 16) || 'hooper');
        send(ws, { t: 'welcome', id, tick: world.tick });
        console.log(`[net] ${id} joined (${world.players.size} players)`);
      } else if (msg.t === 'intent' && sess.joined) {
        const p = world.players.get(id);
        if (!p) return;
        if (typeof msg.seq !== 'number' || msg.seq <= p.lastSeq + p.pendingIntents.length - (p.pendingIntents[0]?.seq ?? msg.seq) + (p.pendingIntents[0]?.seq ?? msg.seq) - 1 && p.pendingIntents.some((q) => q.seq >= msg.seq)) return;
        p.pendingIntents.push({
          seq: msg.seq,
          mx: Number(msg.mx) || 0,
          my: Number(msg.my) || 0,
          grab: !!msg.grab,
          shoot: !!msg.shoot,
          dunk: !!msg.dunk,
        });
      }
    });

    ws.on('close', () => {
      sessions.delete(id);
      if (sess.joined) {
        world.removePlayer(id);
        console.log(`[net] ${id} left (${world.players.size} players)`);
      }
    });
  });

  return { wss, sessions };
}

export function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
```

(Note: the intent-ordering guard above is intentionally simplified during execution — accept any `seq > p.lastSeq` and not already queued; see Task 6 where it's finalized.)

`server/src/index.ts`:
```ts
import { SERVER_PORT, TICK_RATE } from '../../shared/src/constants';
import { World } from './game/world';
import { startNet } from './net';

const world = new World();
const { sessions } = startNet(world, SERVER_PORT);

setInterval(() => {
  world.step();
  if (world.tick % TICK_RATE === 0) {
    console.log(`[tick] ${world.tick} players=${world.players.size} sessions=${sessions.size}`);
  }
}, 1000 / TICK_RATE);

console.log(`[rimverse] server on ws://localhost:${SERVER_PORT}, tick ${TICK_RATE} Hz`);
```

- [x] **Step 4: Run and verify tick logs**

Run: `npm run dev -w server` (background), wait 3s.
Expected: `[rimverse] server on ws://localhost:8081` then `[tick] 30 ...`, `[tick] 60 ...` once per second.

- [x] **Step 5: Commit**

```bash
git add shared server && git commit -m "feat(server): ws server, join/leave sessions, 30Hz tick loop"
```

### Task 4: Client scaffold — connect and log welcome (M0 gate)

**Files:**
- Create: `client/index.html`, `client/vite.config.ts`, `client/src/main.ts`, `client/src/net/net.ts`

- [x] **Step 1: Write the client shell**

`client/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RIMVERSE</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0b0218; overflow: hidden; }
      canvas { display: block; }
      #hud { position: fixed; top: 12px; left: 12px; color: #ff71ce; font: 14px/1.4 monospace; text-shadow: 0 0 6px #ff71ce; pointer-events: none; white-space: pre; }
    </style>
  </head>
  <body>
    <div id="hud"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`client/vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
});
```

`client/src/net/net.ts`:
```ts
import { SERVER_PORT } from '../../../shared/src/constants';
import type { ClientMsg, ServerMsg, SnapshotMsg } from '../../../shared/src/protocol';

export class Net {
  ws: WebSocket;
  myId: string | null = null;
  onSnapshot: ((s: SnapshotMsg) => void) | null = null;
  onWelcome: ((id: string) => void) | null = null;

  constructor(name: string) {
    const url = new URLSearchParams(location.search).get('server')
      ?? `ws://${location.hostname}:${SERVER_PORT}`;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.send({ t: 'join', name });
    this.ws.onmessage = (ev) => {
      const msg: ServerMsg = JSON.parse(ev.data);
      if (msg.t === 'welcome') {
        this.myId = msg.id;
        console.log('[net] welcome', msg.id);
        this.onWelcome?.(msg.id);
      } else if (msg.t === 'snapshot') {
        this.onSnapshot?.(msg);
      }
    };
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
```

`client/src/main.ts` (M0 minimal — replaced in Task 8):
```ts
import { Net } from './net/net';

const net = new Net('hooper');
net.onWelcome = (id) => {
  document.getElementById('hud')!.textContent = `RIMVERSE\nconnected as ${id}`;
};
```

- [x] **Step 2: Verify M0 gate**

Run server + `npm run dev -w client`, open `http://localhost:5173` in a browser.
Expected: HUD shows `connected as <id>`; server logs the join; tick log keeps counting. **M0 gate: client connects, server logs a tick. ✓**

- [x] **Step 3: Commit**

```bash
git add client && git commit -m "feat(client): vite scaffold, ws connect, welcome handshake (M0 gate)"
```

---

## Milestone M1 — Flat sim (server-authoritative movement, prediction, follow-cam)

### Task 5: Shared geometry + movement integrator (TDD)

**Files:**
- Create: `shared/src/geometry.ts`, `shared/src/sim.ts`
- Test: `shared/test/geometry.test.ts`, `shared/test/sim.test.ts`

- [x] **Step 1: Write the failing tests**

`shared/test/geometry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { discRadius, hoopPosition, hoopCount, clampToArena } from '../src/geometry';
import { COURT_HALF_L, COURT_HALF_W, R_BASE, R_K } from '../src/constants';

describe('geometry', () => {
  it('disc radius scales with sqrt(N)', () => {
    expect(discRadius(4)).toBeCloseTo(R_BASE + R_K * 2);
    expect(discRadius(100)).toBeCloseTo(R_BASE + R_K * 10);
  });

  it('rectangle mode (N<=2): two opposed hoops on the y axis', () => {
    expect(hoopCount(1)).toBe(2);
    expect(hoopCount(2)).toBe(2);
    expect(hoopPosition(0, 1)).toEqual({ x: 0, y: -COURT_HALF_L });
    expect(hoopPosition(1, 2)).toEqual({ x: 0, y: COURT_HALF_L });
  });

  it('disc mode (N>=3): N hoops evenly on the rim', () => {
    expect(hoopCount(3)).toBe(3);
    const r = discRadius(4);
    const h0 = hoopPosition(0, 4);
    const h1 = hoopPosition(1, 4);
    expect(Math.hypot(h0.x, h0.y)).toBeCloseTo(r);
    expect(Math.hypot(h1.x, h1.y)).toBeCloseTo(r);
    // quarter turn apart
    const dot = (h0.x * h1.x + h0.y * h1.y) / (r * r);
    expect(dot).toBeCloseTo(0);
  });

  it('clamps to rectangle when N<=2', () => {
    const p = clampToArena({ x: 99, y: -99 }, 2);
    expect(p.x).toBe(COURT_HALF_W);
    expect(p.y).toBe(-COURT_HALF_L);
  });

  it('clamps to disc when N>=3', () => {
    const p = clampToArena({ x: 100, y: 0 }, 3);
    expect(p.x).toBeCloseTo(discRadius(3));
    expect(p.y).toBe(0);
    const inside = clampToArena({ x: 1, y: 1 }, 3);
    expect(inside).toEqual({ x: 1, y: 1 });
  });
});
```

`shared/test/sim.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { stepPlayer } from '../src/sim';
import { PLAYER_SPEED, TICK_DT } from '../src/constants';

describe('stepPlayer', () => {
  it('moves at PLAYER_SPEED in the input direction', () => {
    const p = stepPlayer({ x: 0, y: 0 }, { mx: 1, my: 0 }, TICK_DT, 4);
    expect(p.x).toBeCloseTo(PLAYER_SPEED * TICK_DT);
    expect(p.y).toBe(0);
  });

  it('normalizes oversized input vectors', () => {
    const p = stepPlayer({ x: 0, y: 0 }, { mx: 3, my: 4 }, TICK_DT, 4);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(PLAYER_SPEED * TICK_DT);
  });

  it('is deterministic (same in = same out)', () => {
    const a = stepPlayer({ x: 1, y: 2 }, { mx: 0.5, my: -0.5 }, TICK_DT, 8);
    const b = stepPlayer({ x: 1, y: 2 }, { mx: 0.5, my: -0.5 }, TICK_DT, 8);
    expect(a).toEqual(b);
  });

  it('cannot leave the arena', () => {
    let pos = { x: 0, y: 0 };
    for (let i = 0; i < 300; i++) pos = stepPlayer(pos, { mx: 1, my: 0 }, TICK_DT, 3);
    expect(Math.hypot(pos.x, pos.y)).toBeLessThanOrEqual(  // disc radius for N=3
      14 + 2.5 * Math.sqrt(3) + 1e-9,
    );
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/test`
Expected: FAIL (modules missing)

- [x] **Step 3: Implement**

`shared/src/geometry.ts`:
```ts
import { COURT_HALF_L, COURT_HALF_W, R_BASE, R_K } from './constants';
import type { Vec2 } from './types';

export function discRadius(n: number): number {
  return R_BASE + R_K * Math.sqrt(Math.max(0, n));
}

/** Rectangle mode below 3 players always has exactly 2 opposed hoops. */
export function hoopCount(n: number): number {
  return n <= 2 ? 2 : n;
}

export function wedgeAngle(i: number, n: number, rot = 0): number {
  return (i * 2 * Math.PI) / n + rot;
}

export function hoopPosition(i: number, n: number, rot = 0): Vec2 {
  if (n <= 2) return { x: 0, y: i === 0 ? -COURT_HALF_L : COURT_HALF_L };
  const a = wedgeAngle(i, n, rot);
  const r = discRadius(n);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function clampToArena(p: Vec2, n: number): Vec2 {
  if (n <= 2) {
    return {
      x: Math.max(-COURT_HALF_W, Math.min(COURT_HALF_W, p.x)),
      y: Math.max(-COURT_HALF_L, Math.min(COURT_HALF_L, p.y)),
    };
  }
  const r = discRadius(n);
  const d = Math.hypot(p.x, p.y);
  if (d <= r) return { x: p.x, y: p.y };
  return { x: (p.x / d) * r, y: (p.y / d) * r };
}
```

`shared/src/sim.ts`:
```ts
import { PLAYER_SPEED } from './constants';
import { clampToArena } from './geometry';
import type { Vec2 } from './types';

export interface SimInput {
  mx: number;
  my: number;
}

/** The single movement integrator. Server sim and client prediction both call this. */
export function stepPlayer(pos: Vec2, input: SimInput, dt: number, n: number): Vec2 {
  let { mx, my } = input;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  return clampToArena({ x: pos.x + mx * PLAYER_SPEED * dt, y: pos.y + my * PLAYER_SPEED * dt }, n);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/test`
Expected: PASS (all)

- [x] **Step 5: Commit**

```bash
git add shared && git commit -m "feat(shared): wedge geometry, arena clamps, stepPlayer integrator (TDD)"
```

### Task 6: Server movement — apply intents, broadcast snapshots

**Files:**
- Modify: `server/src/game/world.ts` (movement + snapshot), `server/src/net.ts` (clean intent guard), `server/src/index.ts` (snapshot send)
- Test: `server/test/world.test.ts`

- [x] **Step 1: Write the failing test**

`server/test/world.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { PLAYER_SPEED, TICK_DT } from '../../shared/src/constants';

describe('World movement', () => {
  it('applies queued intents in order and tracks ack seq', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pendingIntents.push(
      { seq: 1, mx: 1, my: 0, grab: false, shoot: false, dunk: false },
      { seq: 2, mx: 1, my: 0, grab: false, shoot: false, dunk: false },
    );
    w.step();
    expect(p.pos.x).toBeCloseTo(2 * PLAYER_SPEED * TICK_DT);
    expect(p.lastSeq).toBe(2);
    expect(p.pendingIntents.length).toBe(0);
  });

  it('caps intents applied per tick (anti-speedhack)', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    for (let s = 1; s <= 20; s++) p.pendingIntents.push({ seq: s, mx: 1, my: 0, grab: false, shoot: false, dunk: false });
    w.step();
    expect(p.pendingIntents.length).toBe(15); // MAX_INTENTS_PER_TICK = 5
  });

  it('updates facing and anim from movement', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pendingIntents.push({ seq: 1, mx: 0, my: -1, grab: false, shoot: false, dunk: false });
    w.step();
    expect(p.dir.y).toBeLessThan(0);
    expect(p.anim).toBe('run');
    w.step();
    expect(p.anim).toBe('idle');
  });

  it('builds a snapshot with ack for a given player', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pendingIntents.push({ seq: 7, mx: 0, my: 0, grab: false, shoot: false, dunk: false });
    w.step();
    const snap = w.snapshotFor('p1');
    expect(snap.ack).toBe(7);
    expect(snap.players[0].id).toBe('p1');
    expect(snap.n).toBe(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/test/world.test.ts`
Expected: FAIL (`snapshotFor` missing; movement not applied)

- [x] **Step 3: Implement movement + snapshot in World**

Modify `server/src/game/world.ts` — replace `step()` and add `snapshotFor`:
```ts
import { MAX_INTENTS_PER_TICK, TICK_DT } from '../../../shared/src/constants';
import { stepPlayer } from '../../../shared/src/sim';
import type { SnapshotMsg } from '../../../shared/src/protocol';

// inside class World:
  step(): void {
    this.tick++;
    const n = Math.max(1, this.players.size);
    for (const p of this.players.values()) {
      let applied = 0;
      while (p.pendingIntents.length > 0 && applied < MAX_INTENTS_PER_TICK) {
        const intent = p.pendingIntents.shift()!;
        p.pos = stepPlayer(p.pos, intent, TICK_DT, n);
        p.lastSeq = intent.seq;
        const mlen = Math.hypot(intent.mx, intent.my);
        if (mlen > 0.01) {
          p.dir = { x: intent.mx / mlen, y: intent.my / mlen };
          p.moving = true;
        } else {
          p.moving = false;
        }
        applied++;
      }
      if (applied === 0) p.moving = false;
      p.anim = p.moving ? (p.ballId ? 'dribbleRun' : 'run') : p.ballId ? 'dribbleIdle' : 'idle';
    }
  }

  snapshotFor(viewerId: string): SnapshotMsg {
    return {
      t: 'snapshot',
      tick: this.tick,
      ack: this.players.get(viewerId)?.lastSeq ?? 0,
      n: this.players.size,
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id, name: p.name,
        x: p.pos.x, y: p.pos.y, dx: p.dir.x, dy: p.dir.y,
        anim: p.anim, size: p.size, hue: p.hue,
        hasBall: p.ballId !== null, score: p.score, hoop: p.hoop,
      })),
      balls: [],
      hoops: [],
      events: [],
    };
  }
```
Add `moving: boolean` to `PlayerEnt` (init `false`).

Simplify the intent guard in `server/src/net.ts` (replace the convoluted line):
```ts
      } else if (msg.t === 'intent' && sess.joined) {
        const p = world.players.get(id);
        if (!p || typeof msg.seq !== 'number') return;
        const lastQueued = p.pendingIntents[p.pendingIntents.length - 1]?.seq ?? p.lastSeq;
        if (msg.seq <= lastQueued) return; // stale or duplicate
        if (p.pendingIntents.length > 60) return; // flood guard
        p.pendingIntents.push({
          seq: msg.seq,
          mx: Number(msg.mx) || 0,
          my: Number(msg.my) || 0,
          grab: !!msg.grab,
          shoot: !!msg.shoot,
          dunk: !!msg.dunk,
        });
      }
```

Wire snapshots in `server/src/index.ts`:
```ts
import { SERVER_PORT, SNAPSHOT_EVERY, TICK_RATE } from '../../shared/src/constants';
import { World } from './game/world';
import { send, startNet } from './net';

const world = new World();
const { sessions } = startNet(world, SERVER_PORT);

setInterval(() => {
  world.step();
  if (world.tick % SNAPSHOT_EVERY === 0) {
    for (const sess of sessions.values()) {
      if (sess.joined) send(sess.ws, world.snapshotFor(sess.id));
    }
  }
  if (world.tick % (TICK_RATE * 5) === 0) {
    console.log(`[tick] ${world.tick} players=${world.players.size}`);
  }
}, 1000 / TICK_RATE);

console.log(`[rimverse] server on ws://localhost:${SERVER_PORT}, tick ${TICK_RATE} Hz`);
```

- [x] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS (shared + server suites)

- [x] **Step 5: Commit**

```bash
git add server shared && git commit -m "feat(server): intent application, facing/anim, per-client snapshots"
```

### Task 7: Client prediction + reconciliation (TDD) and input

**Files:**
- Create: `client/src/net/prediction.ts`, `client/src/input.ts`
- Test: `client/test/prediction.test.ts`

- [x] **Step 1: Write the failing test**

`client/test/prediction.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Predictor } from '../src/net/prediction';
import { PLAYER_SPEED, TICK_DT } from '../../shared/src/constants';

describe('Predictor', () => {
  it('predicts forward locally', () => {
    const pred = new Predictor({ x: 0, y: 0 });
    pred.applyInput({ mx: 1, my: 0 }, 4);
    pred.applyInput({ mx: 1, my: 0 }, 4);
    expect(pred.pos.x).toBeCloseTo(2 * PLAYER_SPEED * TICK_DT);
  });

  it('reconciles: server pos + replay of unacked intents', () => {
    const pred = new Predictor({ x: 0, y: 0 });
    pred.applyInput({ mx: 1, my: 0 }, 4); // seq 1
    pred.applyInput({ mx: 1, my: 0 }, 4); // seq 2
    pred.applyInput({ mx: 1, my: 0 }, 4); // seq 3
    // server acked seq 2 but disagrees slightly on position
    pred.reconcile({ x: 0.1, y: 0 }, 2, 4);
    // expected: server pos + replay of seq 3 only
    expect(pred.pos.x).toBeCloseTo(0.1 + PLAYER_SPEED * TICK_DT);
    expect(pred.pendingCount).toBe(1);
  });

  it('matches the server exactly when they agree (no drift)', () => {
    const pred = new Predictor({ x: 0, y: 0 });
    let serverPos = { x: 0, y: 0 };
    for (let i = 0; i < 10; i++) {
      const input = { mx: Math.sin(i), my: Math.cos(i) };
      pred.applyInput(input, 4);
      serverPos = { // server applies the same shared integrator
        ...require('../../shared/src/sim').stepPlayer(serverPos, input, TICK_DT, 4),
      };
    }
    pred.reconcile(serverPos, 10, 4);
    expect(pred.pos.x).toBeCloseTo(serverPos.x);
    expect(pred.pos.y).toBeCloseTo(serverPos.y);
  });
});
```
(During execution use a static import for `stepPlayer`, not `require` — ESM.)

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/test/prediction.test.ts`
Expected: FAIL (module missing)

- [x] **Step 3: Implement**

`client/src/net/prediction.ts`:
```ts
import { TICK_DT } from '../../../shared/src/constants';
import { stepPlayer, type SimInput } from '../../../shared/src/sim';
import type { Vec2 } from '../../../shared/src/types';

export class Predictor {
  pos: Vec2;
  seq = 0;
  private pending: { seq: number; input: SimInput }[] = [];

  constructor(start: Vec2) {
    this.pos = { ...start };
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Sample local input for one fixed tick: advance prediction, return seq to send. */
  applyInput(input: SimInput, n: number): number {
    this.seq++;
    this.pending.push({ seq: this.seq, input });
    this.pos = stepPlayer(this.pos, input, TICK_DT, n);
    return this.seq;
  }

  /** Snap to authoritative pos, drop acked intents, replay the rest. */
  reconcile(serverPos: Vec2, ack: number, n: number): void {
    this.pending = this.pending.filter((p) => p.seq > ack);
    let pos = { ...serverPos };
    for (const p of this.pending) pos = stepPlayer(pos, p.input, TICK_DT, n);
    this.pos = pos;
  }
}
```

`client/src/input.ts`:
```ts
import type { SimInput } from '../../shared/src/sim';

export class Input {
  private keys = new Set<string>();
  /** one-shot action latches, cleared when consumed */
  grab = false;
  shoot = false;
  dunk = false;

  constructor() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.shoot = true;
      if (e.code === 'KeyE') this.grab = true;
      if (e.code === 'KeyF') this.dunk = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  /** Move vector in sim space: screen-up (W) = -y. */
  move(): SimInput {
    let mx = 0;
    let my = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    return { mx, my };
  }

  consumeActions(): { grab: boolean; shoot: boolean; dunk: boolean } {
    const a = { grab: this.grab, shoot: this.shoot, dunk: this.dunk };
    this.grab = this.shoot = this.dunk = false;
    return a;
  }
}
```

- [x] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add client && git commit -m "feat(client): prediction/reconciliation (TDD) and keyboard input"
```

### Task 8: Three.js scene, follow-cam, remote interpolation — M1 gate

**Files:**
- Create: `client/src/scene/scene.ts`, `client/src/net/interpolation.ts`
- Modify: `client/src/main.ts`
- Test: `client/test/interpolation.test.ts`

- [x] **Step 1: Write the failing interpolation test**

`client/test/interpolation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SnapshotBuffer } from '../src/net/interpolation';

describe('SnapshotBuffer', () => {
  it('lerps remote positions between snapshots at render time', () => {
    const buf = new SnapshotBuffer();
    buf.push(1000, [{ id: 'r1', x: 0, y: 0 }]);
    buf.push(1100, [{ id: 'r1', x: 10, y: 0 }]);
    const at = buf.sample(1050);
    expect(at.get('r1')!.x).toBeCloseTo(5);
  });

  it('clamps to latest when render time is ahead', () => {
    const buf = new SnapshotBuffer();
    buf.push(1000, [{ id: 'r1', x: 0, y: 0 }]);
    buf.push(1100, [{ id: 'r1', x: 10, y: 0 }]);
    expect(buf.sample(2000).get('r1')!.x).toBe(10);
  });

  it('drops snapshots older than the window', () => {
    const buf = new SnapshotBuffer();
    for (let i = 0; i < 100; i++) buf.push(i * 50, [{ id: 'r1', x: i, y: 0 }]);
    expect(buf.size).toBeLessThan(30);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/test/interpolation.test.ts`
Expected: FAIL

- [x] **Step 3: Implement buffer, scene, main**

`client/src/net/interpolation.ts`:
```ts
export interface RemotePoint {
  id: string;
  x: number;
  y: number;
}

interface Entry {
  time: number;
  points: Map<string, RemotePoint>;
}

const WINDOW_MS = 1000;

export class SnapshotBuffer {
  private entries: Entry[] = [];

  get size(): number {
    return this.entries.length;
  }

  push(time: number, points: RemotePoint[]): void {
    this.entries.push({ time, points: new Map(points.map((p) => [p.id, p])) });
    const cutoff = time - WINDOW_MS;
    while (this.entries.length > 2 && this.entries[0].time < cutoff) this.entries.shift();
  }

  /** Positions at render time t (already delayed by INTERP_DELAY_MS by the caller). */
  sample(t: number): Map<string, { x: number; y: number }> {
    const out = new Map<string, { x: number; y: number }>();
    if (this.entries.length === 0) return out;
    let a = this.entries[0];
    let b = this.entries[this.entries.length - 1];
    for (let i = 0; i < this.entries.length - 1; i++) {
      if (this.entries[i].time <= t && this.entries[i + 1].time >= t) {
        a = this.entries[i];
        b = this.entries[i + 1];
        break;
      }
    }
    const span = b.time - a.time;
    const f = span > 0 ? Math.min(1, Math.max(0, (t - a.time) / span)) : 1;
    for (const [id, pb] of b.points) {
      const pa = a.points.get(id) ?? pb;
      out.set(id, { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f });
    }
    return out;
  }
}
```

`client/src/scene/scene.ts`:
```ts
import * as THREE from 'three';
import { discRadius } from '../../../shared/src/geometry';
import { COURT_HALF_L, COURT_HALF_W } from '../../../shared/src/constants';

export class GameScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private floor: THREE.Object3D | null = null;
  private floorN = -1;
  private playerMeshes = new Map<string, THREE.Object3D>();

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x0b0218);
    this.scene.fog = new THREE.Fog(0x0b0218, 30, 90);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
    this.camera.position.set(0, 9, 11);
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  /** Rebuild the floor when player count (geometry) changes. */
  setArena(n: number): void {
    if (n === this.floorN) return;
    this.floorN = n;
    if (this.floor) this.scene.remove(this.floor);
    const group = new THREE.Group();
    if (n <= 2) {
      const grid = new THREE.GridHelper(COURT_HALF_L * 2, 14, 0xff71ce, 0x2a1a4a);
      grid.scale.x = COURT_HALF_W / COURT_HALF_L;
      group.add(grid);
    } else {
      const r = discRadius(n);
      group.add(new THREE.PolarGridHelper(r, Math.max(8, n), 8, 64, 0xff71ce, 0x2a1a4a));
    }
    this.floor = group;
    this.scene.add(group);
  }

  /** Placeholder capsule per player until M2 sprites land. */
  upsertPlayer(id: string, x: number, y: number, isLocal: boolean, hue: number): void {
    let mesh = this.playerMeshes.get(id);
    if (!mesh) {
      const color = new THREE.Color().setHSL(hue / 360, 0.9, isLocal ? 0.7 : 0.55);
      mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 0.9, 4, 12),
        new THREE.MeshBasicMaterial({ color }),
      );
      this.playerMeshes.set(id, mesh);
      this.scene.add(mesh);
    }
    mesh.position.set(x, 0.85, y); // sim y → three z
  }

  removeMissingPlayers(liveIds: Set<string>): void {
    for (const [id, mesh] of this.playerMeshes) {
      if (!liveIds.has(id)) {
        this.scene.remove(mesh);
        this.playerMeshes.delete(id);
      }
    }
  }

  followCam(x: number, y: number, dt: number): void {
    const target = new THREE.Vector3(x, 9, y + 11);
    this.camera.position.lerp(target, Math.min(1, dt * 5));
    this.camera.lookAt(x, 0.8, y);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
```

`client/src/main.ts` (replace entirely):
```ts
import { INTERP_DELAY_MS, TICK_RATE } from '../../shared/src/constants';
import type { SnapshotMsg } from '../../shared/src/protocol';
import { Input } from './input';
import { SnapshotBuffer } from './net/interpolation';
import { Net } from './net/net';
import { Predictor } from './net/prediction';
import { GameScene } from './scene/scene';

const hud = document.getElementById('hud')!;
const net = new Net('hooper');
const input = new Input();
const scene = new GameScene();
const remoteBuf = new SnapshotBuffer();
let predictor: Predictor | null = null;
let latest: SnapshotMsg | null = null;

net.onWelcome = () => {
  predictor = new Predictor({ x: 0, y: 0 });
};

net.onSnapshot = (snap) => {
  latest = snap;
  const me = snap.players.find((p) => p.id === net.myId);
  if (me && predictor) predictor.reconcile({ x: me.x, y: me.y }, snap.ack, Math.max(1, snap.n));
  remoteBuf.push(performance.now(), snap.players.filter((p) => p.id !== net.myId));
};

// Fixed-rate input sampling → intents (mirrors server tick so prediction stays in lockstep)
setInterval(() => {
  if (!predictor || !net.myId) return;
  const move = input.move();
  const actions = input.consumeActions();
  const seq = predictor.applyInput(move, Math.max(1, latest?.n ?? 1));
  net.send({ t: 'intent', seq, mx: move.mx, my: move.my, ...actions });
}, 1000 / TICK_RATE);

let lastFrame = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!latest) return;
  scene.setArena(Math.max(1, latest.n));

  const live = new Set<string>();
  if (predictor && net.myId) {
    live.add(net.myId);
    const me = latest.players.find((p) => p.id === net.myId);
    scene.upsertPlayer(net.myId, predictor.pos.x, predictor.pos.y, true, me?.hue ?? 0);
    scene.followCam(predictor.pos.x, predictor.pos.y, dt);
  }
  const remotes = remoteBuf.sample(now - INTERP_DELAY_MS);
  for (const [id, pos] of remotes) {
    const snapP = latest.players.find((p) => p.id === id);
    live.add(id);
    scene.upsertPlayer(id, pos.x, pos.y, false, snapP?.hue ?? 0);
  }
  scene.removeMissingPlayers(live);

  const me = latest.players.find((p) => p.id === net.myId);
  hud.textContent = `RIMVERSE\nplayers ${latest.n}  score ${me?.score ?? 0}${me?.hasBall ? '  ● BALL' : ''}`;
  scene.render();
}
requestAnimationFrame(frame);
```

- [x] **Step 4: Run tests, then verify M1 gate live**

Run: `npx vitest run` → PASS.
Run server + client; open two browser tabs.
Expected: WASD moves a capsule on a neon polar grid with a follow-cam; second tab shows the first tab's player moving smoothly (interpolated). Server logs show both players. Movement is clamped to the arena. **M1 gate: you move; server owns position (kill the client's `reconcile` call temporarily → player rubber-bands to server truth, proving authority); prediction feels instant. ✓**

- [x] **Step 5: Commit**

```bash
git add client && git commit -m "feat(client): three.js arena scene, follow-cam, remote interpolation (M1 gate)"
```

---

## Milestone M2 — The look: parametric rig + living dribble

**Authoring philosophy (from spec §4 + NBA Jam teardown):** sprites are *discrete frames played with snap* (no crossfade) at ~10–14 fps, like digitized footage. The rig renders keyframe poses to an atlas; playback just flips frames. Cadence > smoothness. Frames are authored side-profile facing +x; left-facing is a horizontal flip.

### Task 9: Rig skeleton + pose model (TDD on forward kinematics)

**Files:**
- Create: `client/src/sprites/rig.ts`
- Test: `client/test/rig.test.ts`

- [x] **Step 1: Write the failing test**

`client/test/rig.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeSkeleton, NEUTRAL_POSE, RIG } from '../src/sprites/rig';

describe('rig forward kinematics', () => {
  it('neutral pose: head above pelvis, feet near ground', () => {
    const s = computeSkeleton(NEUTRAL_POSE);
    expect(s.head.y).toBeGreaterThan(s.pelvis.y);
    expect(s.footN.y).toBeLessThan(0.06);
    expect(Math.abs(s.footN.x)).toBeLessThan(0.05);
  });

  it('hip flexion moves the knee forward', () => {
    const bent = computeSkeleton({ ...NEUTRAL_POSE, thN: 45 });
    const straight = computeSkeleton(NEUTRAL_POSE);
    expect(bent.kneeN.x).toBeGreaterThan(straight.kneeN.x);
    expect(bent.kneeN.y).toBeGreaterThan(straight.kneeN.y);
  });

  it('knee flexion pulls the foot backward relative to the knee', () => {
    const s = computeSkeleton({ ...NEUTRAL_POSE, thN: 0, shN: 60 });
    expect(s.footN.x).toBeLessThan(s.kneeN.x);
  });

  it('elbow flexion raises the hand forward', () => {
    const s = computeSkeleton({ ...NEUTRAL_POSE, uaN: 20, faN: 90 });
    expect(s.handN.x).toBeGreaterThan(s.elbowN.x);
  });

  it('ball attaches to the near hand when pose.ball is handN', () => {
    const s = computeSkeleton({ ...NEUTRAL_POSE, ball: 'handN' });
    expect(s.ball).not.toBeNull();
    expect(s.ball!.x).toBeCloseTo(s.handN.x, 1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/test/rig.test.ts`
Expected: FAIL

- [x] **Step 3: Implement the rig**

`client/src/sprites/rig.ts`:
```ts
import type { Vec2 } from '../../../shared/src/types';

/** Segment lengths in player-height units (H = 1.0). */
export const RIG = {
  headR: 0.075,
  neck: 0.045,
  torso: 0.26,
  upperArm: 0.15,
  forearm: 0.15,
  thigh: 0.23,
  shin: 0.23,
  foot: 0.07,
  standHip: 0.48,
} as const;

/**
 * Pose angles in degrees. Convention: 0 = straight down, positive = toward facing (+x).
 * Elbow flex (fa*) bends FORWARD relative to the upper arm; knee flex (sh*) bends BACKWARD.
 * `lean` tilts the torso forward from vertical. rootY = pelvis height.
 * ball: 'handN' glues the ball to the near hand; Vec2 = position relative to feet-center origin.
 */
export interface Pose {
  rootY: number;
  lean: number;
  headTilt: number;
  uaN: number; faN: number;
  uaF: number; faF: number;
  thN: number; shN: number;
  thF: number; shF: number;
  ball?: 'handN' | Vec2;
}

export const NEUTRAL_POSE: Pose = {
  rootY: RIG.standHip,
  lean: 0,
  headTilt: 0,
  uaN: 5, faN: 8,
  uaF: -5, faF: 8,
  thN: 2, shN: 4,
  thF: -2, shF: 4,
};

export interface Skeleton {
  pelvis: Vec2; chest: Vec2; head: Vec2;
  elbowN: Vec2; handN: Vec2; elbowF: Vec2; handF: Vec2;
  kneeN: Vec2; footN: Vec2; kneeF: Vec2; footF: Vec2;
  ball: Vec2 | null;
}

const D2R = Math.PI / 180;

/** Unit vector for a limb angle: 0° points down, positive swings toward +x. */
function down(deg: number): Vec2 {
  return { x: Math.sin(deg * D2R), y: -Math.cos(deg * D2R) };
}

/** 0° points up (for the torso), positive leans toward +x. */
function up(deg: number): Vec2 {
  return { x: Math.sin(deg * D2R), y: Math.cos(deg * D2R) };
}

function add(a: Vec2, b: Vec2, len: number): Vec2 {
  return { x: a.x + b.x * len, y: a.y + b.y * len };
}

export function computeSkeleton(p: Pose): Skeleton {
  const pelvis: Vec2 = { x: 0, y: p.rootY };
  const chest = add(pelvis, up(p.lean), RIG.torso);
  const head = add(chest, up(p.lean + p.headTilt), RIG.neck + RIG.headR);

  const elbowN = add(chest, down(p.uaN), RIG.upperArm);
  const handN = add(elbowN, down(p.uaN + p.faN), RIG.forearm);
  const elbowF = add(chest, down(p.uaF), RIG.upperArm);
  const handF = add(elbowF, down(p.uaF + p.faF), RIG.forearm);

  const kneeN = add(pelvis, down(p.thN), RIG.thigh);
  const footN = add(kneeN, down(p.thN - p.shN), RIG.shin);
  const kneeF = add(pelvis, down(p.thF), RIG.thigh);
  const footF = add(kneeF, down(p.thF - p.shF), RIG.shin);

  const ball = p.ball === 'handN' ? { x: handN.x, y: handN.y - 0.06 } : p.ball ?? null;
  return { pelvis, chest, head, elbowN, handN, elbowF, handF, kneeN, footN, kneeF, footF, ball };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/test/rig.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add client && git commit -m "feat(client): parametric rig skeleton + pose FK (TDD)"
```

### Task 10: Keyframe tables + frame sampler (TDD)

**Files:**
- Create: `client/src/sprites/poses.ts`
- Test: `client/test/poses.test.ts`

- [x] **Step 1: Write the failing test**

`client/test/poses.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ANIMS, frameIndex } from '../src/sprites/poses';

describe('animation tables', () => {
  it('every anim has frames and a positive fps', () => {
    for (const [name, a] of Object.entries(ANIMS)) {
      expect(a.frames.length, name).toBeGreaterThan(0);
      expect(a.fps, name).toBeGreaterThan(0);
    }
  });

  it('looping anims wrap; one-shots clamp on the last frame', () => {
    const run = ANIMS.run;
    expect(frameIndex(run, (run.frames.length / run.fps) + 0.01)).toBe(0); // wrapped
    const shoot = ANIMS.shoot;
    expect(frameIndex(shoot, 10)).toBe(shoot.frames.length - 1); // clamped
  });

  it('dribble ball alternates between hand and free flight', () => {
    const d = ANIMS.dribbleIdle;
    const inHand = d.frames.filter((f) => f.ball === 'handN').length;
    const free = d.frames.filter((f) => typeof f.ball === 'object').length;
    expect(inHand).toBeGreaterThan(0);
    expect(free).toBeGreaterThan(0);
    // the lowest free-ball frame should be near the floor (the bounce)
    const ys = d.frames.flatMap((f) => (typeof f.ball === 'object' && f.ball ? [f.ball.y] : []));
    expect(Math.min(...ys)).toBeLessThan(0.1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/test/poses.test.ts`
Expected: FAIL

- [x] **Step 3: Author the keyframes**

`client/src/sprites/poses.ts` — these tables are the **first pass**; Task 13's preview gate tunes the numbers visually. Cadence targets from NBA Jam: dribble ≈12 fps 8-frame cycle (~0.67 s per bounce), run ≈12 fps, idle slow at 6 fps, shoot/dunk one-shots with a hard snap on release/slam.

```ts
import { NEUTRAL_POSE, type Pose } from './rig';

export interface AnimDef {
  fps: number;
  loop: boolean;
  frames: Pose[];
}

const P = (over: Partial<Pose>): Pose => ({ ...NEUTRAL_POSE, ...over });

/** Idle: 4 frames @ 6 fps — breathing, slight sway. */
const idle: AnimDef = {
  fps: 6,
  loop: true,
  frames: [
    P({ rootY: 0.478 }),
    P({ rootY: 0.474, lean: 1, uaN: 7, uaF: -7 }),
    P({ rootY: 0.470, lean: 1.5 }),
    P({ rootY: 0.474, lean: 0.5, uaN: 4, uaF: -4 }),
  ],
};

/** Run: 8 frames @ 12 fps. Legs alternate; arms counter-swing; airborne at f3/f7. */
const run: AnimDef = {
  fps: 12,
  loop: true,
  frames: [
    P({ rootY: 0.470, lean: 8, thN: 28, shN: 8,  thF: -20, shF: 38, uaN: -22, faN: 70, uaF: 26, faF: 55 }), // near-foot strike
    P({ rootY: 0.455, lean: 8, thN: 12, shN: 12, thF: -6,  shF: 64, uaN: -10, faN: 60, uaF: 14, faF: 60 }), // support
    P({ rootY: 0.462, lean: 9, thN: -6, shN: 14, thF: 16,  shF: 48, uaN: 8,   faN: 55, uaF: -6, faF: 62 }), // push-off
    P({ rootY: 0.488, lean: 9, thN: -24, shN: 40, thF: 30, shF: 12, uaN: 24,  faN: 52, uaF: -20, faF: 68 }), // flight
    P({ rootY: 0.470, lean: 8, thN: -20, shN: 38, thF: 28, shF: 8,  uaN: 26,  faN: 55, uaF: -22, faF: 70 }), // far-foot strike (mirror)
    P({ rootY: 0.455, lean: 8, thN: -6,  shN: 64, thF: 12, shF: 12, uaN: 14,  faN: 60, uaF: -10, faF: 60 }),
    P({ rootY: 0.462, lean: 9, thN: 16,  shN: 48, thF: -6, shF: 14, uaN: -6,  faN: 62, uaF: 8,  faF: 55 }),
    P({ rootY: 0.488, lean: 9, thN: 30,  shN: 12, thF: -24, shF: 40, uaN: -20, faN: 68, uaF: 24, faF: 52 }),
  ],
};

/**
 * Dribble (idle): 8 frames @ 12 fps. One full bounce per cycle.
 * Ball x ≈ 0.18 ahead; in hand f0–f2 (push), free f3–f5 (down/up), caught f6–f7.
 */
const dribbleIdle: AnimDef = {
  fps: 12,
  loop: true,
  frames: [
    P({ rootY: 0.460, thN: 10, shN: 14, thF: -8, shF: 12, uaN: 38, faN: 58, ball: 'handN' }),                  // hand high
    P({ rootY: 0.456, thN: 11, shN: 16, thF: -8, shF: 12, uaN: 32, faN: 36, ball: 'handN' }),                  // pushing down
    P({ rootY: 0.452, thN: 12, shN: 18, thF: -9, shF: 13, uaN: 26, faN: 14, ball: 'handN' }),                  // release point
    P({ rootY: 0.450, thN: 12, shN: 18, thF: -9, shF: 13, uaN: 24, faN: 8,  ball: { x: 0.19, y: 0.16 } }),     // ball falling
    P({ rootY: 0.448, lean: 3, thN: 13, shN: 20, thF: -9, shF: 13, uaN: 26, faN: 14, ball: { x: 0.19, y: 0.05 } }), // floor!
    P({ rootY: 0.452, thN: 12, shN: 18, thF: -9, shF: 13, uaN: 30, faN: 26, ball: { x: 0.19, y: 0.20 } }),     // rising
    P({ rootY: 0.456, thN: 11, shN: 16, thF: -8, shF: 12, uaN: 34, faN: 44, ball: { x: 0.18, y: 0.34 } }),     // almost caught
    P({ rootY: 0.460, thN: 10, shN: 14, thF: -8, shF: 12, uaN: 37, faN: 54, ball: 'handN' }),                  // caught
  ],
};

/** Dribble (moving): run legs + dribble arm, ball synced to the support phase. */
const dribbleRun: AnimDef = {
  fps: 12,
  loop: true,
  frames: [
    P({ rootY: 0.470, lean: 10, thN: 28, shN: 8,  thF: -20, shF: 38, uaN: 36, faN: 56, uaF: 24, faF: 50, ball: 'handN' }),
    P({ rootY: 0.455, lean: 10, thN: 12, shN: 12, thF: -6,  shF: 64, uaN: 30, faN: 34, uaF: 12, faF: 56, ball: 'handN' }),
    P({ rootY: 0.462, lean: 11, thN: -6, shN: 14, thF: 16,  shF: 48, uaN: 25, faN: 12, uaF: -4, faF: 60, ball: { x: 0.24, y: 0.18 } }),
    P({ rootY: 0.488, lean: 11, thN: -24, shN: 40, thF: 30, shF: 12, uaN: 24, faN: 8,  uaF: -16, faF: 64, ball: { x: 0.26, y: 0.05 } }),
    P({ rootY: 0.470, lean: 10, thN: -20, shN: 38, thF: 28, shF: 8,  uaN: 27, faN: 16, uaF: -18, faF: 66, ball: { x: 0.26, y: 0.16 } }),
    P({ rootY: 0.455, lean: 10, thN: -6,  shN: 64, thF: 12, shF: 12, uaN: 31, faN: 32, uaF: -8,  faF: 58, ball: { x: 0.24, y: 0.30 } }),
    P({ rootY: 0.462, lean: 11, thN: 16,  shN: 48, thF: -6, shF: 14, uaN: 35, faN: 48, uaF: 6,  faF: 54, ball: 'handN' }),
    P({ rootY: 0.488, lean: 11, thN: 30,  shN: 12, thF: -24, shF: 40, uaN: 37, faN: 56, uaF: 20, faF: 50, ball: 'handN' }),
  ],
};

/**
 * Shoot: 6 frames @ 12 fps, one-shot (~0.5 s). Release at frame 3 (RELEASE_FRAME) —
 * after that frame the ball is a world entity, the sprite stops drawing it.
 */
const shoot: AnimDef = {
  fps: 12,
  loop: false,
  frames: [
    P({ rootY: 0.430, lean: 4, thN: 22, shN: 30, thF: -14, shF: 26, uaN: 40, faN: 70, uaF: 20, faF: 60, ball: 'handN' }), // gather crouch
    P({ rootY: 0.445, lean: 2, thN: 16, shN: 22, thF: -10, shF: 20, uaN: 95, faN: 80, uaF: 40, faF: 50, ball: 'handN' }), // ball to chest
    P({ rootY: 0.540, lean: 0, thN: 6,  shN: 8,  thF: -4,  shF: 8,  uaN: 150, faN: 50, uaF: 30, faF: 30, ball: 'handN' }), // rising, ball up
    P({ rootY: 0.580, lean: -2, thN: 2, shN: 4,  thF: -2,  shF: 6,  uaN: 175, faN: 12, uaF: 20, faF: 20 }),               // RELEASE (snap)
    P({ rootY: 0.560, lean: -2, thN: 4, shN: 8,  thF: -2,  shF: 8,  uaN: 170, faN: 8,  uaF: 16, faF: 16 }),               // follow-through
    P({ rootY: 0.480, lean: 0, thN: 10, shN: 16, thF: -6,  shF: 14, uaN: 60, faN: 20, uaF: 10, faF: 14 }),                // land
  ],
};

/**
 * Dunk: 8 frames @ 12 fps, one-shot (~0.67 s + server lock to 0.9 s).
 * Slam at frame 5 (SLAM_FRAME). Ball glued to hand until the slam.
 */
const dunk: AnimDef = {
  fps: 12,
  loop: false,
  frames: [
    P({ rootY: 0.430, lean: 10, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 30, faN: 50, uaF: -10, faF: 30, ball: 'handN' }), // gather
    P({ rootY: 0.470, lean: 6,  thN: 18, shN: 20, thF: -22, shF: 44, uaN: 60, faN: 60, uaF: -20, faF: 40, ball: 'handN' }), // leap drive
    P({ rootY: 0.640, lean: 0,  thN: 30, shN: 50, thF: -10, shF: 60, uaN: 120, faN: 70, uaF: -24, faF: 44, ball: 'handN' }), // airborne, winding
    P({ rootY: 0.760, lean: -6, thN: 24, shN: 60, thF: -6,  shF: 64, uaN: 165, faN: 60, uaF: -26, faF: 40, ball: 'handN' }), // peak, ball back
    P({ rootY: 0.780, lean: -4, thN: 20, shN: 55, thF: -8,  shF: 60, uaN: 185, faN: 30, uaF: -20, faF: 36, ball: 'handN' }), // cocked overhead
    P({ rootY: 0.740, lean: 6,  thN: 16, shN: 45, thF: -10, shF: 50, uaN: 95,  faN: 10, uaF: -10, faF: 30 }),               // SLAM (snap)
    P({ rootY: 0.560, lean: 8,  thN: 20, shN: 30, thF: -12, shF: 30, uaN: 50,  faN: 16, uaF: 0,  faF: 24 }),                // falling
    P({ rootY: 0.450, lean: 4,  thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20,  faN: 20, uaF: 4,  faF: 18 }),                // land
  ],
};

export const RELEASE_FRAME = 3; // shoot
export const SLAM_FRAME = 5; // dunk

export const ANIMS = { idle, run, dribbleIdle, dribbleRun, shoot, dunk } as const;
export type AnimName = keyof typeof ANIMS;

/** Discrete frame playback (NBA-Jam snap — no tweening). */
export function frameIndex(anim: AnimDef, t: number): number {
  const i = Math.floor(t * anim.fps);
  return anim.loop ? i % anim.frames.length : Math.min(i, anim.frames.length - 1);
}
```

- [x] **Step 4: Run tests**

Run: `npx vitest run client/test/poses.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add client && git commit -m "feat(client): keyframe tables (idle/run/dribble/shoot/dunk) + discrete sampler"
```

### Task 11: Canvas renderer + texture atlas (TDD on layout)

**Files:**
- Create: `client/src/sprites/draw.ts`, `client/src/sprites/atlas.ts`
- Test: `client/test/atlas.test.ts`

- [x] **Step 1: Write the failing test**

`client/test/atlas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { atlasLayout, cellUV } from '../src/sprites/atlas';

describe('atlas layout', () => {
  it('lays out one row per anim, one column per frame', () => {
    const layout = atlasLayout();
    expect(layout.rows.idle.row).toBe(0);
    expect(layout.rows.run.frames).toBe(8);
    expect(layout.cols).toBeGreaterThanOrEqual(8);
    expect(layout.rowCount).toBe(6);
  });

  it('cellUV maps a frame to its sub-rectangle', () => {
    const layout = atlasLayout();
    const uv = cellUV(layout, 'run', 2);
    expect(uv.u0).toBeCloseTo(2 / layout.cols);
    expect(uv.u1).toBeCloseTo(3 / layout.cols);
    // row 1 of N rows, v measured from atlas top
    expect(uv.v0).toBeCloseTo(layout.rows.run.row / layout.rowCount);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/test/atlas.test.ts`
Expected: FAIL

- [x] **Step 3: Implement draw + atlas**

`client/src/sprites/draw.ts` — renders one pose to a 2D canvas cell (chrome-neon stylization):
```ts
import { computeSkeleton, RIG, type Pose } from './rig';
import type { Vec2 } from '../../../shared/src/types';

export interface Appearance {
  hue: number; // 0–360 jersey hue
}

/**
 * Draw a posed figure into ctx within a cell of `px` size.
 * Origin: feet-center at the bottom-middle of the cell; 1.0 height unit = 0.62*px,
 * leaving headroom for jumps (dunk rootY up to ~0.8 + torso + head ≈ 1.25).
 */
export function drawPose(ctx: CanvasRenderingContext2D, pose: Pose, px: number, look: Appearance): void {
  const S = px * 0.62;
  const ox = px / 2;
  const oy = px * 0.94;
  const X = (p: Vec2) => ox + p.x * S;
  const Y = (p: Vec2) => oy - p.y * S;

  const s = computeSkeleton(pose);
  const jersey = `hsl(${look.hue} 90% 60%)`;
  const jerseyDark = `hsl(${look.hue} 70% 38%)`;
  const skin = `hsl(${(look.hue + 160) % 360} 35% 72%)`;
  const skinDark = `hsl(${(look.hue + 160) % 360} 25% 50%)`;

  const limb = (a: Vec2, b: Vec2, w: number, color: string, glow = false) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * S;
    ctx.lineCap = 'round';
    ctx.shadowBlur = glow ? 6 : 0;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(X(a), Y(a));
    ctx.lineTo(X(b), Y(b));
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  // FAR limbs first (darker), then body, then NEAR limbs (brighter) — painter's depth.
  limb(s.pelvis, s.kneeF, 0.085, skinDark);
  limb(s.kneeF, s.footF, 0.075, skinDark);
  limb(s.chest, s.elbowF, 0.07, jerseyDark);
  limb(s.elbowF, s.handF, 0.06, skinDark);

  limb(s.pelvis, s.chest, 0.16, jersey, true); // torso
  // head
  ctx.fillStyle = skin;
  ctx.shadowBlur = 8;
  ctx.shadowColor = jersey;
  ctx.beginPath();
  ctx.arc(X(s.head), Y(s.head), RIG.headR * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  limb(s.pelvis, s.kneeN, 0.095, skin);
  limb(s.kneeN, s.footN, 0.08, skin);
  limb(s.chest, s.elbowN, 0.075, jersey);
  limb(s.elbowN, s.handN, 0.065, skin);

  if (s.ball) {
    const br = 0.07 * S;
    ctx.fillStyle = 'hsl(25 95% 55%)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'hsl(25 95% 60%)';
    ctx.beginPath();
    ctx.arc(X(s.ball), Y(s.ball), br, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'hsl(25 60% 30%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(X(s.ball), Y(s.ball), br, 0, Math.PI * 2);
    ctx.moveTo(X(s.ball) - br, Y(s.ball));
    ctx.quadraticCurveTo(X(s.ball), Y(s.ball) - br * 0.6, X(s.ball) + br, Y(s.ball));
    ctx.stroke();
  }
}
```

`client/src/sprites/atlas.ts`:
```ts
import { ANIMS, type AnimName } from './poses';
import { drawPose } from './draw';
import type { Appearance } from './draw';

export const CELL_PX = 128;

export interface AtlasLayout {
  cols: number;
  rowCount: number;
  rows: Record<AnimName, { row: number; frames: number }>;
}

export function atlasLayout(): AtlasLayout {
  const names = Object.keys(ANIMS) as AnimName[];
  const rows = {} as AtlasLayout['rows'];
  let cols = 0;
  names.forEach((name, i) => {
    const frames = ANIMS[name].frames.length;
    rows[name] = { row: i, frames };
    cols = Math.max(cols, frames);
  });
  return { cols, rowCount: names.length, rows };
}

export interface CellUV {
  u0: number; v0: number; u1: number; v1: number;
}

/** v measured from the TOP of the atlas image (flip when applying to three.js UVs). */
export function cellUV(layout: AtlasLayout, anim: AnimName, frame: number): CellUV {
  const row = layout.rows[anim].row;
  return {
    u0: frame / layout.cols,
    u1: (frame + 1) / layout.cols,
    v0: row / layout.rowCount,
    v1: (row + 1) / layout.rowCount,
  };
}

const cache = new Map<string, HTMLCanvasElement>();

/** Render every anim frame for an appearance into one canvas. Cached by hue bucket. */
export function buildAtlas(look: Appearance): HTMLCanvasElement {
  const key = `h${Math.round(look.hue / 30) * 30}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const layout = atlasLayout();
  const canvas = document.createElement('canvas');
  canvas.width = layout.cols * CELL_PX;
  canvas.height = layout.rowCount * CELL_PX;
  const ctx = canvas.getContext('2d')!;
  for (const [name, def] of Object.entries(ANIMS)) {
    const row = layout.rows[name as AnimName].row;
    def.frames.forEach((pose, f) => {
      ctx.save();
      ctx.translate(f * CELL_PX, row * CELL_PX);
      ctx.beginPath();
      ctx.rect(0, 0, CELL_PX, CELL_PX);
      ctx.clip();
      drawPose(ctx, pose, CELL_PX, look);
      ctx.restore();
    });
  }
  cache.set(key, canvas);
  return canvas;
}
```

- [x] **Step 4: Run tests**

Run: `npx vitest run client/test/atlas.test.ts`
Expected: PASS (layout/UV tests are DOM-free; `buildAtlas` is exercised in-browser next task)

- [x] **Step 5: Commit**

```bash
git add client && git commit -m "feat(client): neon pose renderer + cached texture atlas with UV layout (TDD)"
```

### Task 12: Billboard player sprites in the world

**Files:**
- Create: `client/src/sprites/playerSprite.ts`
- Modify: `client/src/scene/scene.ts` (swap capsules for sprites)

- [x] **Step 1: Implement the billboard sprite**

`client/src/sprites/playerSprite.ts`:
```ts
import * as THREE from 'three';
import { atlasLayout, buildAtlas, cellUV, type AtlasLayout } from './atlas';
import { ANIMS, frameIndex, type AnimName } from './poses';
import type { Appearance } from './draw';

const layout: AtlasLayout = atlasLayout();
const textureCache = new Map<HTMLCanvasElement, THREE.CanvasTexture>();

function textureFor(look: Appearance): THREE.CanvasTexture {
  const canvas = buildAtlas(look);
  let tex = textureCache.get(canvas);
  if (!tex) {
    tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    textureCache.set(canvas, tex);
  }
  return tex;
}

/** World height of the sprite quad for size=1 (matches cell headroom: 1/0.62). */
const QUAD_H = 2.0;

export class PlayerSprite {
  mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private geo: THREE.PlaneGeometry;
  private anim: AnimName = 'idle';
  private animStart = 0;
  private lastFrame = -1;
  private facingLeft = false;

  constructor(look: Appearance) {
    this.geo = new THREE.PlaneGeometry(QUAD_H, QUAD_H);
    this.material = new THREE.MeshBasicMaterial({
      map: textureFor(look),
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.setUV('idle', 0);
  }

  setAnim(anim: AnimName, now: number): void {
    if (anim === this.anim) return;
    this.anim = anim;
    this.animStart = now;
    this.lastFrame = -1;
  }

  /** dx: sim-space facing x. Camera looks down -z, so sim +x is screen-right. */
  update(now: number, x: number, y: number, size: number, dx: number, camera: THREE.Camera): void {
    const t = (now - this.animStart) / 1000;
    const f = frameIndex(ANIMS[this.anim], t);
    if (Math.abs(dx) > 0.15) this.facingLeft = dx < 0;
    if (f !== this.lastFrame) {
      this.setUV(this.anim, f);
      this.lastFrame = f;
    }
    this.mesh.position.set(x, (QUAD_H * size) / 2 - 0.06, y);
    this.mesh.scale.setScalar(size);
    // billboard: yaw-only toward camera
    const yaw = Math.atan2(camera.position.x - x, camera.position.z - y);
    this.mesh.rotation.set(0, yaw, 0);
  }

  /** True while a one-shot anim still has frames left to show. */
  oneShotPlaying(now: number): boolean {
    const def = ANIMS[this.anim];
    if (def.loop) return false;
    return (now - this.animStart) / 1000 < def.frames.length / def.fps;
  }

  private setUV(anim: AnimName, frame: number): void {
    const { u0, v0, u1, v1 } = cellUV(layout, anim, frame);
    // three.js v=0 is image bottom; our v0 is from the top ⇒ flip.
    const top = 1 - v0;
    const bot = 1 - v1;
    const left = this.facingLeft ? u1 : u0;
    const right = this.facingLeft ? u0 : u1;
    const uv = this.geo.attributes.uv as THREE.BufferAttribute;
    uv.setXY(0, left, top);
    uv.setXY(1, right, top);
    uv.setXY(2, left, bot);
    uv.setXY(3, right, bot);
    uv.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}
```

- [x] **Step 2: Swap capsules for sprites in the scene**

In `client/src/scene/scene.ts`: replace `playerMeshes` map with `Map<string, PlayerSprite>`, and `upsertPlayer` with:
```ts
  upsertPlayer(id: string, x: number, y: number, hue: number, anim: AnimName, dx: number, size: number, now: number): void {
    let sprite = this.playerSprites.get(id);
    if (!sprite) {
      sprite = new PlayerSprite({ hue });
      this.playerSprites.set(id, sprite);
      this.scene.add(sprite.mesh);
    }
    // one-shots (shoot/dunk) play to completion; loops switch freely
    if (!sprite.oneShotPlaying(now) || anim === 'shoot' || anim === 'dunk') {
      sprite.setAnim(anim, now);
    }
    sprite.update(now, x, y, size, dx, this.camera);
  }
```
`removeMissingPlayers` calls `sprite.dispose()` and removes `sprite.mesh`. Update `client/src/main.ts` call sites to pass `(id, x, y, hue, anim, dx, size, now)` — for the local player use the server's anim from `latest` (movement anim is server-derived; prediction only owns position), `dx` from last non-zero input.

- [x] **Step 3: Verify in browser**

Run dev servers, open the client. Expected: a neon figure that idles (breathes) and runs with pumping arms when moving. No ball yet (M3 gives possession), so dribble isn't reachable in-game — next task's preview page is where the dribble gate is judged.

- [x] **Step 4: Commit**

```bash
git add client && git commit -m "feat(client): billboarded sprite players with discrete frame playback"
```

### Task 13: Anim preview page + dribble tuning — **M2 GATE**

**Files:**
- Create: `client/preview.html`, `client/src/preview/main.ts`
- Modify: `client/vite.config.ts` (multi-page)

- [x] **Step 1: Build the preview harness**

`client/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        preview: resolve(__dirname, 'preview.html'),
      },
    },
  },
});
```

`client/preview.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>RIMVERSE anim preview</title>
    <style>
      body { margin: 0; background: #0b0218; color: #ff71ce; font: 14px monospace; }
      #stage { display: flex; gap: 24px; padding: 24px; flex-wrap: wrap; }
      .cell { text-align: center; }
      canvas { background: #150a2e; border: 1px solid #3a2a5a; image-rendering: auto; }
      #controls { padding: 0 24px; }
      input[type=range] { width: 240px; }
    </style>
  </head>
  <body>
    <div id="controls">
      <h2>RIMVERSE — animation preview</h2>
      <label>speed <input id="speed" type="range" min="0.1" max="2" step="0.1" value="1" /></label>
      <label>zoom <input id="zoom" type="range" min="1" max="4" step="0.5" value="2" /></label>
    </div>
    <div id="stage"></div>
    <script type="module" src="/src/preview/main.ts"></script>
  </body>
</html>
```

`client/src/preview/main.ts`:
```ts
import { ANIMS, frameIndex, type AnimName } from '../sprites/poses';
import { drawPose } from '../sprites/draw';
import { CELL_PX } from '../sprites/atlas';

const stage = document.getElementById('stage')!;
const speedEl = document.getElementById('speed') as HTMLInputElement;
const zoomEl = document.getElementById('zoom') as HTMLInputElement;

const cells: { name: AnimName; ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement }[] = [];
for (const name of Object.keys(ANIMS) as AnimName[]) {
  const wrap = document.createElement('div');
  wrap.className = 'cell';
  const canvas = document.createElement('canvas');
  const label = document.createElement('div');
  label.textContent = name;
  wrap.append(canvas, label);
  stage.append(wrap);
  cells.push({ name, ctx: canvas.getContext('2d')!, canvas });
}

const start = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const speed = Number(speedEl.value);
  const zoom = Number(zoomEl.value);
  const px = CELL_PX * zoom;
  const t = ((now - start) / 1000) * speed;
  for (const c of cells) {
    if (c.canvas.width !== px) {
      c.canvas.width = px;
      c.canvas.height = px;
    }
    c.ctx.clearRect(0, 0, px, px);
    // floor line for grounding reference
    c.ctx.strokeStyle = '#3a2a5a';
    c.ctx.beginPath();
    c.ctx.moveTo(0, px * 0.94);
    c.ctx.lineTo(px, px * 0.94);
    c.ctx.stroke();
    const def = ANIMS[c.name];
    const loopT = def.loop ? t : t % (def.frames.length / def.fps + 0.8); // replay one-shots
    drawPose(c.ctx, def.frames[frameIndex(def, loopT)], px, { hue: 210 });
  }
}
requestAnimationFrame(frame);
```

- [x] **Step 2: THE GATE — iterate until the dribble looks alive**

Open `http://localhost:5173/preview.html`. Screenshot at multiple moments and judge against the bar (spec §0: *"players who look like they are really dribbling"*). Checklist:
- Ball clearly leaves the hand, hits the floor, returns — readable bounce per cycle.
- Body weight responds: knees/root bob in sync with the bounce, slight lean over the ball.
- Run has airborne frames and counter-swinging arms; cadence snaps (no mush).
- Shoot release and dunk slam read as a single decisive frame.

**Iterate the numbers in `poses.ts` (and `draw.ts` styling) until this passes. Do not proceed to M3 until the dribble looks alive.** Expected to take several rounds of screenshot → tweak.

- [x] **Step 3: Commit (after gate passes)**

```bash
git add client && git commit -m "feat(client): anim preview page; tune dribble to NBA Jam cadence (M2 gate)"
```

### Task 14: Front/back facing rows (4-direction minimum)

**Files:**
- Modify: `client/src/sprites/rig.ts` (facing-aware draw), `client/src/sprites/draw.ts`, `client/src/sprites/atlas.ts`, `client/src/sprites/playerSprite.ts`

- [x] **Step 1: Add facing variants**

Approach: keep ONE pose table (side view). For `front`/`back` facings, re-project the skeleton instead of re-authoring: x-coordinates compress (×0.35) toward the centerline, near/far limbs render symmetrically (legs split ±0.06 hipW), and the head draws full-circle with a face hint (front) or plain (back). Add to `draw.ts`:
```ts
export type Facing = 'side' | 'front' | 'back';

export function drawPoseFacing(ctx: CanvasRenderingContext2D, pose: Pose, px: number, look: Appearance, facing: Facing): void {
  if (facing === 'side') return drawPose(ctx, pose, px, look);
  // project: compress x, mirror near-limb x for the off-side limb
  const proj = projectFrontal(pose, facing === 'back');
  drawFrontal(ctx, proj, px, look, facing === 'back');
}
```
`projectFrontal` computes the side skeleton then maps each joint `{x,y} → {x*0.35 ± splay, y}` with near limbs splayed +0.07 and far limbs −0.07 on x; `drawFrontal` draws the same limb set with symmetric widths (both legs `skin` tone, far-limb darkening dropped), torso drawn as a rounded rect of width 0.20·S, ball drawn at projected coords. Back view: same minus face hint, jersey slightly darkened.

Atlas grows to `rowCount = anims × 3` (side/front/back rows per anim): extend `atlasLayout()` with a `facing` dimension — `rows[anim].row` becomes `rows[anim].rowFor(facing)` implemented as `row * 3 + facingIndex`; update `cellUV(layout, anim, frame, facing)` and the existing tests to pass `'side'`.

`playerSprite.ts` picks facing from the angle between sprite facing dir and the camera ray:
```ts
const camYaw = Math.atan2(camera.position.x - x, camera.position.z - y);
const dirYaw = Math.atan2(dxWorld, dyWorld); // sim dir mapped to world x,z
let rel = ((dirYaw - camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // -π..π
// |rel| < π/4 → 'back' (moving away), |rel| > 3π/4 → 'front', else side (flip if rel < 0)
```

- [x] **Step 2: Verify in preview + game**

Add a facing selector to the preview page (`side/front/back` buttons re-rendering with `drawPoseFacing`). In game: run toward/away from camera shows front/back sprites; strafing shows side. Run `npx vitest run` — atlas tests updated and passing.

- [x] **Step 3: Commit**

```bash
git add client && git commit -m "feat(client): front/back projected facings (4-dir sprites)"
```

---

## Milestone M3 — Score: hoops, scarce balls, shoot + dunk (server-resolved)

### Task 15: Server topology-lite + hoops in snapshot

**Files:**
- Modify: `server/src/game/world.ts`
- Test: `server/test/topology.test.ts`

- [x] **Step 1: Write the failing test**

`server/test/topology.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { COURT_HALF_L } from '../../shared/src/constants';

describe('topology-lite', () => {
  it('one player: rectangle with own hoop + free practice hoop', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    expect(p.hoop).toBe(0);
    const hoops = w.hoopSnaps();
    expect(hoops.length).toBe(2);
    expect(hoops[0].owner).toBe('p1');
    expect(hoops[1].owner).toBeNull();
    expect(hoops[0].y).toBe(-COURT_HALF_L);
  });

  it('three players: disc with three owned hoops on the rim', () => {
    const w = new World();
    w.addPlayer('p1', 'a');
    w.addPlayer('p2', 'b');
    w.addPlayer('p3', 'c');
    const hoops = w.hoopSnaps();
    expect(hoops.length).toBe(3);
    expect(new Set(hoops.map((h) => h.owner)).size).toBe(3);
  });

  it('leaver frees their slot; hoops recompute', () => {
    const w = new World();
    w.addPlayer('p1', 'a');
    w.addPlayer('p2', 'b');
    w.addPlayer('p3', 'c');
    w.removePlayer('p2');
    const hoops = w.hoopSnaps();
    expect(hoops.length).toBe(2);
    expect(hoops.every((h) => h.owner !== 'p2')).toBe(true);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run server/test/topology.test.ts` → FAIL (`hoopSnaps` missing)

- [x] **Step 3: Implement**

In `server/src/game/world.ts` add:
```ts
import { hoopCount, hoopPosition } from '../../../shared/src/geometry';
import type { HoopSnap } from '../../../shared/src/types';

// inside World:
  /** Hoop index i belongs to the i-th player in join order (M4 replaces with smooth re-slotting). */
  private reslot(): void {
    let i = 0;
    for (const p of this.players.values()) p.hoop = i++;
  }

  hoopSnaps(): HoopSnap[] {
    const n = this.players.size;
    const count = hoopCount(Math.max(1, n));
    const owners = new Map<number, string>();
    for (const p of this.players.values()) owners.set(p.hoop, p.id);
    const out: HoopSnap[] = [];
    for (let i = 0; i < count; i++) {
      const pos = hoopPosition(i, Math.max(1, n));
      out.push({ index: i, x: pos.x, y: pos.y, owner: owners.get(i) ?? null });
    }
    return out;
  }
```
Call `this.reslot()` at the end of `addPlayer` and `removePlayer`. In `snapshotFor`, replace `hoops: []` with `hoops: this.hoopSnaps()`.

- [x] **Step 4: Run tests** → `npx vitest run` PASS

- [x] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): topology-lite hoop slots + hoops in snapshots (TDD)"
```

### Task 16: Balls — hub spawner, scarcity, grab resolution (TDD)

**Files:**
- Create: `server/src/game/balls.ts`
- Modify: `server/src/game/world.ts`
- Test: `server/test/balls.test.ts`

- [x] **Step 1: Write the failing test**

`server/test/balls.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { BALL_RESPAWN_DELAY, GRAB_RADIUS, TICK_RATE } from '../../shared/src/constants';

function tickN(w: World, n: number) {
  for (let i = 0; i < n; i++) w.step();
}

describe('balls', () => {
  it('spawns max(1, ceil(N/6)) balls at the hub', () => {
    const w = new World();
    w.addPlayer('p1', 'a');
    w.step();
    expect(w.ballSnaps().length).toBe(1);
    expect(w.ballSnaps()[0].x).toBeCloseTo(0);
    for (let i = 2; i <= 7; i++) w.addPlayer(`p${i}`, `n${i}`);
    w.step();
    expect(w.ballSnaps().length).toBe(2);
  });

  it('grab intent within radius takes a free ball; closest contender wins', () => {
    const w = new World();
    const a = w.addPlayer('a', 'a');
    const b = w.addPlayer('b', 'b');
    a.pos = { x: 0.5, y: 0 };
    b.pos = { x: 1.0, y: 0 };
    a.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    b.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    w.step();
    expect(a.ballId).not.toBeNull();
    expect(b.ballId).toBeNull();
  });

  it('grab outside GRAB_RADIUS does nothing', () => {
    const w = new World();
    const a = w.addPlayer('a', 'a');
    a.pos = { x: GRAB_RADIUS + 2, y: 0 };
    a.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    w.step();
    expect(a.ballId).toBeNull();
  });

  it('scored ball respawns at the hub after the delay', () => {
    const w = new World();
    const a = w.addPlayer('a', 'a');
    a.pos = { x: 0, y: 0 };
    a.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    w.step();
    const ballId = a.ballId!;
    w.scoreBall(ballId); // helper used by shooting
    expect(w.ballSnaps().find((b) => b.id === ballId)!.state).toBe('respawning');
    tickN(w, Math.ceil(BALL_RESPAWN_DELAY * TICK_RATE) + 1);
    const ball = w.ballSnaps().find((b) => b.id === ballId)!;
    expect(ball.state).toBe('free');
    expect(ball.x).toBeCloseTo(0);
  });
});
```

- [x] **Step 2: Run to verify it fails** → FAIL

- [x] **Step 3: Implement**

`server/src/game/balls.ts`:
```ts
import { BALL_RESPAWN_DELAY, GRAB_RADIUS, ballCount } from '../../../shared/src/constants';
import type { BallSnap, BallState, Vec2 } from '../../../shared/src/types';
import type { PlayerEnt } from './world';

export interface BallEnt {
  id: string;
  pos: Vec2;
  z: number;
  state: BallState;
  carrier: string | null;
  respawnAt: number; // world time
  flight: { from: Vec2; to: Vec2; start: number; duration: number; made: boolean; targetHoop: number; shooter: string } | null;
}

let nextBallId = 1;

export function makeBall(): BallEnt {
  return { id: `b${nextBallId++}`, pos: { x: 0, y: 0 }, z: 0, state: 'free', carrier: null, respawnAt: 0, flight: null };
}

/** Keep ball count in line with scarcity rule; new balls appear at the hub. */
export function ensureBallCount(balls: Map<string, BallEnt>, playerCount: number): void {
  const target = ballCount(Math.max(1, playerCount));
  while (balls.size < target) {
    const b = makeBall();
    balls.set(b.id, b);
  }
  // shrink: remove only idle hub balls (never carried/flight) until at target
  if (balls.size > target) {
    for (const [id, b] of balls) {
      if (balls.size <= target) break;
      if (b.state === 'free' && Math.hypot(b.pos.x, b.pos.y) < 1) balls.delete(id);
    }
  }
}

/** Resolve grab intents: closest grabbing player within radius wins each free ball. */
export function resolveGrabs(balls: Map<string, BallEnt>, grabbers: PlayerEnt[]): void {
  for (const ball of balls.values()) {
    if (ball.state !== 'free') continue;
    let best: PlayerEnt | null = null;
    let bestD = GRAB_RADIUS;
    for (const p of grabbers) {
      if (p.ballId !== null || p.action !== null) continue;
      const d = Math.hypot(p.pos.x - ball.pos.x, p.pos.y - ball.pos.y);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      ball.state = 'carried';
      ball.carrier = best.id;
      best.ballId = ball.id;
    }
  }
}

export function tickRespawns(balls: Map<string, BallEnt>, time: number): void {
  for (const b of balls.values()) {
    if (b.state === 'respawning' && time >= b.respawnAt) {
      b.state = 'free';
      b.carrier = null;
      b.pos = { x: 0, y: 0 };
      b.z = 0;
    }
  }
}

export function startRespawn(b: BallEnt, time: number): void {
  b.state = 'respawning';
  b.carrier = null;
  b.flight = null;
  b.z = 0;
  b.respawnAt = time + BALL_RESPAWN_DELAY;
}

export function toSnap(b: BallEnt): BallSnap {
  return { id: b.id, x: b.pos.x, y: b.pos.y, z: b.z, state: b.state, carrier: b.carrier };
}
```

In `server/src/game/world.ts`:
```ts
import { ensureBallCount, resolveGrabs, startRespawn, tickRespawns, toSnap, type BallEnt } from './balls';
import type { BallSnap } from '../../../shared/src/types';

// inside World:
  balls = new Map<string, BallEnt>();

  ballSnaps(): BallSnap[] {
    return Array.from(this.balls.values()).map(toSnap);
  }

  scoreBall(id: string): void {
    const b = this.balls.get(id);
    if (!b) return;
    if (b.carrier) {
      const p = this.players.get(b.carrier);
      if (p) p.ballId = null;
    }
    startRespawn(b, this.time);
  }
```
In `step()`, after the per-player intent loop, add:
```ts
    ensureBallCount(this.balls, this.players.size);
    const grabbers = Array.from(this.players.values()).filter((p) => p.wantsGrab);
    resolveGrabs(this.balls, grabbers);
    for (const p of this.players.values()) p.wantsGrab = false;
    tickRespawns(this.balls, this.time);
    // carried balls follow their carrier
    for (const b of this.balls.values()) {
      if (b.state === 'carried' && b.carrier) {
        const c = this.players.get(b.carrier);
        if (c) b.pos = { ...c.pos };
      }
    }
```
Add `wantsGrab: boolean` to `PlayerEnt` (init false) and set `p.wantsGrab ||= intent.grab` inside the intent-apply loop. In `snapshotFor`, replace `balls: []` with `balls: this.ballSnaps()`. On `removePlayer`, drop any carried ball where it stands:
```ts
    const leaver = this.players.get(id);
    if (leaver?.ballId) {
      const b = this.balls.get(leaver.ballId);
      if (b) {
        b.state = 'free';
        b.carrier = null;
      }
    }
```

- [x] **Step 4: Run tests** → `npx vitest run` PASS

- [x] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): hub ball spawner, scarcity, contested grabs, respawns (TDD)"
```

### Task 17: Shooting + dunking, server-resolved (TDD)

**Files:**
- Create: `shared/src/rng.ts`, `server/src/game/shooting.ts`
- Modify: `server/src/game/world.ts`
- Test: `server/test/shooting.test.ts`, `shared/test/rng.test.ts`

- [x] **Step 1: Write the failing tests**

`shared/test/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/rng';

describe('mulberry32', () => {
  it('same seed → same sequence; output in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

`server/test/shooting.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeProbability, pickTargetHoop } from '../src/game/shooting';
import { World } from '../src/game/world';
import { DUNK_TIME, TICK_RATE } from '../../shared/src/constants';

describe('shot math', () => {
  it('probability falls with distance, clamped to (0,1) interior', () => {
    expect(makeProbability(1)).toBeGreaterThan(makeProbability(10));
    expect(makeProbability(0)).toBeLessThanOrEqual(0.95);
    expect(makeProbability(1000)).toBeGreaterThanOrEqual(0.05);
  });

  it('targets the nearest hoop the shooter does not own', () => {
    const hoops = [
      { index: 0, x: 0, y: -14, owner: 'me' },
      { index: 1, x: 0, y: 14, owner: 'them' },
    ];
    expect(pickTargetHoop({ x: 0, y: 10 }, 'me', hoops)).toBe(1);
    expect(pickTargetHoop({ x: 0, y: -10 }, 'me', hoops)).toBe(1); // own hoop never targeted
  });
});

describe('world shooting integration', () => {
  function setupCarrier() {
    const w = new World();
    const p = w.addPlayer('me', 'me');
    p.pos = { x: 0, y: 0 };
    p.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    w.step(); // grabs the hub ball
    expect(p.ballId).not.toBeNull();
    return { w, p };
  }

  it('shoot intent launches a flight and locks the shooter briefly', () => {
    const { w, p } = setupCarrier();
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    w.step();
    expect(p.anim).toBe('shoot');
    expect(p.ballId).toBeNull();
    const ball = w.ballSnaps()[0];
    expect(ball.state).toBe('flight');
  });

  it('made shot scores +2 shooter / −2 hoop owner at landing', () => {
    const { w, p } = setupCarrier();
    w.rng = () => 0; // force make (rng < probability)
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    w.step();
    for (let i = 0; i < TICK_RATE * 3; i++) w.step();
    expect(p.score).toBe(2);
  });

  it('missed shot leaves a free ball near the hoop', () => {
    const { w, p } = setupCarrier();
    w.rng = () => 0.999; // force miss
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    w.step();
    for (let i = 0; i < TICK_RATE * 3; i++) w.step();
    const ball = w.ballSnaps()[0];
    expect(ball.state).toBe('free');
    expect(p.score).toBe(0);
  });

  it('dunk requires range; in range it always scores and locks for DUNK_TIME', () => {
    const { w, p } = setupCarrier();
    // out of range: dunk intent ignored
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: false, dunk: true });
    w.step();
    expect(p.anim).not.toBe('dunk');
    expect(p.ballId).not.toBeNull();
    // walk into range of the enemy/practice hoop at (0, +14)
    p.pos = { x: 0, y: 12.5 };
    p.pendingIntents.push({ seq: 3, mx: 0, my: 0, grab: false, shoot: false, dunk: true });
    w.step();
    expect(p.anim).toBe('dunk');
    for (let i = 0; i < Math.ceil(DUNK_TIME * TICK_RATE) + 2; i++) w.step();
    expect(p.score).toBe(2);
    expect(p.anim).not.toBe('dunk');
  });
});
```

- [x] **Step 2: Run to verify failure** → FAIL

- [x] **Step 3: Implement**

`shared/src/rng.ts`:
```ts
/** Deterministic PRNG for server-side outcome rolls (testable via injection). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`server/src/game/shooting.ts`:
```ts
import { DUNK_RANGE, DUNK_TIME, SHOOT_TIME } from '../../../shared/src/constants';
import type { HoopSnap, Vec2 } from '../../../shared/src/types';

/** Base accuracy curve (skill modifiers arrive in M5). */
export function makeProbability(dist: number): number {
  return Math.min(0.95, Math.max(0.05, 0.92 - 0.035 * dist));
}

export function flightDuration(dist: number): number {
  return 0.5 + 0.035 * dist;
}

/** Nearest hoop not owned by the shooter; -1 if none exist. */
export function pickTargetHoop(pos: Vec2, shooterId: string, hoops: HoopSnap[]): number {
  let best = -1;
  let bestD = Infinity;
  for (const h of hoops) {
    if (h.owner === shooterId) continue;
    const d = Math.hypot(pos.x - h.x, pos.y - h.y);
    if (d < bestD) {
      bestD = d;
      best = h.index;
    }
  }
  return best;
}

export function inDunkRange(pos: Vec2, hoop: HoopSnap): boolean {
  return Math.hypot(pos.x - hoop.x, pos.y - hoop.y) <= DUNK_RANGE;
}

export const ACTION_TIMES = { shoot: SHOOT_TIME, dunk: DUNK_TIME } as const;
```

In `server/src/game/world.ts` — wire into `step()`:
```ts
import { mulberry32 } from '../../../shared/src/rng';
import { ACTION_TIMES, flightDuration, inDunkRange, makeProbability, pickTargetHoop } from './shooting';
import type { GameEvent } from '../../../shared/src/types';

// inside World:
  rng: () => number = mulberry32(Date.now() & 0xffffffff);
  events: GameEvent[] = []; // drained into each snapshot batch

// inside the intent-apply loop, after movement, when p.action === null && p.ballId:
      if (intent.shoot && p.ballId && !p.action) this.startShoot(p);
      else if (intent.dunk && p.ballId && !p.action) this.tryDunk(p);
```
Add methods:
```ts
  private startShoot(p: PlayerEnt): void {
    const hoops = this.hoopSnaps();
    const target = pickTargetHoop(p.pos, p.id, hoops);
    if (target < 0) return;
    const hoop = hoops[target];
    const ball = this.balls.get(p.ballId!);
    if (!ball) return;
    const dist = Math.hypot(p.pos.x - hoop.x, p.pos.y - hoop.y);
    const made = this.rng() < makeProbability(dist);
    ball.state = 'flight';
    ball.carrier = null;
    ball.flight = {
      from: { ...p.pos }, to: { x: hoop.x, y: hoop.y },
      start: this.time, duration: flightDuration(dist),
      made, targetHoop: target, shooter: p.id,
    };
    p.ballId = null;
    p.action = { kind: 'shoot', until: this.time + ACTION_TIMES.shoot, targetHoop: target };
    p.anim = 'shoot';
    this.events.push({ kind: 'shootStart', player: p.id, hoop: target });
  }

  private tryDunk(p: PlayerEnt): void {
    const hoops = this.hoopSnaps();
    const target = pickTargetHoop(p.pos, p.id, hoops);
    if (target < 0 || !inDunkRange(p.pos, hoops[target])) return;
    const ball = this.balls.get(p.ballId!);
    if (!ball) return;
    const hoop = hoops[target];
    ball.state = 'flight';
    ball.carrier = null;
    ball.flight = {
      from: { ...p.pos }, to: { x: hoop.x, y: hoop.y },
      start: this.time, duration: ACTION_TIMES.dunk * 0.7, // ball arrives on the slam
      made: true, targetHoop: target, shooter: p.id,
    };
    p.ballId = null;
    p.action = { kind: 'dunk', until: this.time + ACTION_TIMES.dunk, targetHoop: target };
    p.anim = 'dunk';
    this.events.push({ kind: 'dunkStart', player: p.id, hoop: target });
  }

  private tickFlightsAndActions(): void {
    const hoops = this.hoopSnaps();
    for (const b of this.balls.values()) {
      if (b.state !== 'flight' || !b.flight) continue;
      const f = b.flight;
      const t = Math.min(1, (this.time - f.start) / f.duration);
      b.pos = { x: f.from.x + (f.to.x - f.from.x) * t, y: f.from.y + (f.to.y - f.from.y) * t };
      const arcH = 1 + Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) * 0.08;
      b.z = 4 * arcH * t * (1 - t) + 1.0; // launch/rim height baseline
      if (t >= 1) {
        if (f.made) {
          const shooter = this.players.get(f.shooter);
          const owner = hoops[f.targetHoop] ? this.players.get(hoops[f.targetHoop].owner ?? '') : undefined;
          if (shooter) shooter.score += 2;
          if (owner) owner.score = Math.max(0, owner.score - 2);
          this.events.push({ kind: 'score', player: f.shooter, hoop: f.targetHoop, points: 2 });
          startRespawn(b, this.time);
        } else {
          this.events.push({ kind: 'miss', player: f.shooter, hoop: f.targetHoop });
          const a = this.rng() * Math.PI * 2;
          b.state = 'free';
          b.flight = null;
          b.z = 0;
          b.pos = clampToArena({ x: f.to.x + Math.cos(a) * 1.5, y: f.to.y + Math.sin(a) * 1.5 }, Math.max(1, this.players.size));
        }
      }
    }
    for (const p of this.players.values()) {
      if (p.action && this.time >= p.action.until) p.action = null;
    }
  }
```
(import `clampToArena` from shared geometry; `startRespawn` already imported.) Call `this.tickFlightsAndActions()` in `step()` after grabs. Guard the movement/anim assignment: when `p.action !== null`, skip movement intents' anim overwrite (keep `shoot`/`dunk` anim and freeze position — dunkers lunge in M6; M3 keeps it simple). Concretely, wrap the per-intent movement in `if (!p.action) { ... }` and the trailing anim assignment in `if (!p.action)`.

In `snapshotFor`, replace `events: []` with a drained copy. **Drain once per broadcast batch** — in `index.ts`, after the per-session send loop, call `world.events.length = 0`; `snapshotFor` reads `events: [...this.events]`.

- [x] **Step 4: Run tests** → `npx vitest run` PASS (note: `w.rng = () => 0` in tests overrides the seeded default)

- [x] **Step 5: Commit**

```bash
git add shared server && git commit -m "feat(server): server-resolved shooting + dunking with scoring (TDD)"
```

### Task 18: Client world objects — hoops, balls, action anims, HUD — **M3 GATE**

**Files:**
- Modify: `client/src/scene/scene.ts`, `client/src/main.ts`

- [x] **Step 1: Render hoops and balls**

Add to `client/src/scene/scene.ts`:
```ts
  private hoopMeshes: THREE.Group[] = [];
  private ballMeshes = new Map<string, THREE.Mesh>();

  syncHoops(hoops: { index: number; x: number; y: number; owner: string | null }[], myId: string | null): void {
    while (this.hoopMeshes.length > hoops.length) {
      this.scene.remove(this.hoopMeshes.pop()!);
    }
    while (this.hoopMeshes.length < hoops.length) {
      const g = new THREE.Group();
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.05, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xff9e00 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 3.05;
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.2),
        new THREE.MeshBasicMaterial({ color: 0x05ffa1, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      board.position.set(0, 3.5, -0.55);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.5),
        new THREE.MeshBasicMaterial({ color: 0x8888aa }),
      );
      pole.position.set(0, 1.75, -0.7);
      g.add(rim, board, pole);
      this.hoopMeshes.push(g);
      this.scene.add(g);
    }
    hoops.forEach((h, i) => {
      const g = this.hoopMeshes[i];
      g.position.set(h.x, 0, h.y);
      // face the hub (origin)
      g.lookAt(0, 0, 0);
      const rim = g.children[0] as THREE.Mesh;
      (rim.material as THREE.MeshBasicMaterial).color.set(
        h.owner === myId ? 0x05ffa1 : h.owner ? 0xff71ce : 0xff9e00,
      );
    });
  }

  syncBalls(balls: { id: string; x: number; y: number; z: number; state: string }[]): void {
    const live = new Set(balls.map((b) => b.id));
    for (const [id, m] of this.ballMeshes) {
      if (!live.has(id)) {
        this.scene.remove(m);
        this.ballMeshes.delete(id);
      }
    }
    for (const b of balls) {
      let m = this.ballMeshes.get(b.id);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xff9e00 }),
        );
        this.ballMeshes.set(b.id, m);
        this.scene.add(m);
      }
      // carried balls are drawn by the carrier's sprite; respawning balls are invisible
      m.visible = b.state === 'free' || b.state === 'flight';
      m.position.set(b.x, Math.max(0.22, b.z), b.y);
    }
  }
```

- [x] **Step 2: Wire into main loop + HUD**

In `client/src/main.ts` frame loop, after `setArena`:
```ts
  scene.syncHoops(latest.hoops, net.myId);
  scene.syncBalls(latest.balls);
```
The anim passed to `upsertPlayer` comes straight from each `PlayerSnap.anim` (server-driven state machine — shoot/dunk lock client-side via `oneShotPlaying`). HUD line gains controls help:
```ts
  hud.textContent = `RIMVERSE\nplayers ${latest.n}  score ${me?.score ?? 0}${me?.hasBall ? '  ● BALL' : ''}\nWASD move · E grab · SPACE shoot · F dunk`;
```

- [x] **Step 3: Verify M3 gate end-to-end**

Two browser tabs. Expected flow: ball pulses at the hub → drive to it, press E to grab (HUD shows ● BALL, sprite switches to dribble — *the M2 dribble now lives in-game*) → drive at the other tab's hoop → SPACE mid-range: shoot anim snaps, ball arcs to the rim, score +2 on make / loose ball on miss → walk in close, F: dunk anim, guaranteed slam, defender's score drops. Server logs stay clean; outcomes change only on the server (verify: score never changes before the snapshot arrives). **M3 gate: grab → drive → dunk → score, all server-authoritative. ✓**

- [x] **Step 4: Commit**

```bash
git add client && git commit -m "feat(client): hoops, ball flight, action anims, HUD (M3 gate)"
```

### Task 19: Wrap-up — typecheck everything, README stub

**Files:**
- Create: `README.md`
- Modify: each `tsconfig.json` if `tsc -b` needs `composite` adjustments

- [x] **Step 1: Full check**

Run: `npx vitest run && npx tsc -p shared && npx tsc -p server && npx tsc -p client`
Expected: all green. Fix any strictness fallout.
(If `tsc -b` composite-project wiring fights the no-emit setup, run the three `tsc -p` invocations in the root `typecheck` script instead — keep it simple.)

- [x] **Step 2: README**

`README.md`:
```markdown
# RIMVERSE

Surreal drop-in arcade basketball for up to 100 players. One disc, N rims,
scarce balls at the hub, endless tug-of-war. See `docs/INITIAL_DESIGN_SPEC.md`.

## Dev

    npm install
    npm run dev        # server :8081 + client :5173

Open http://localhost:5173 (two tabs = two players).
Anim workbench: http://localhost:5173/preview.html

## Controls

WASD move · E grab · SPACE shoot · F dunk

## Status

M0–M3 complete: server-authoritative sim, prediction/reconciliation,
parametric NBA-Jam-cadence sprites, hub balls, shoot/dunk scoring.
Next: M4 breathing court → see docs/superpowers/plans/.
```

- [x] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: typecheck wiring + README (M0–M3 complete)"
```

---

## Self-review notes (run after drafting — issues found & fixed inline)

1. **Spec coverage M0–M3:** scaffold ✓ (T1–T4), flat sim + prediction ✓ (T5–T8), rig/atlas/billboard + dribble gate ✓ (T9–T13), 4-dir minimum ✓ (T14), hoops/balls/shoot/dunk/score server-resolved ✓ (T15–T18). Deferred items are listed in the Scope section with their target plans.
2. **Type consistency pass:** `SimInput`/`stepPlayer` signatures match across shared/server/client; `PlayerSnap.anim` uses the `AnimState` union which matches `AnimName` keys of `ANIMS`; `snapshotFor` field names match `SnapshotMsg`.
3. **Known simplification flagged in Task 3 Step 3** (intent guard) is explicitly finalized in Task 6 Step 3.
4. **`Date.now` seeding of `rng`** happens once at World construction (server boot) — fine for runtime, overridden in tests.
