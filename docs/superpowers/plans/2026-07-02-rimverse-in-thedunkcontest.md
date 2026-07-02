# RIMVERSE in The Dunk Contest — Seamless Warp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The rimverse (from `~/Sites/thedunkcontest2`) moves into this repo as a game-within-the-game: when a dunk-contest room's combined score crosses a hidden threshold, the next dunk triggers a Universe Collapse and every player in the room is transported — in the same page, no URL navigation — into the shared rimverse.

**Architecture:** Both games stay AS-IS. Rimverse's full source (TS workspaces: shared/server/client) is vendored into `rimverse/`; its ws server runs as a second process; v3's Express serves the built rimverse client at `/rimverse/`. The warp is an in-page hand-off: v3's server broadcasts `warp` (SP3 trigger, already written and tested in thedunkcontest2 PR #7), each client plays the ~2.2s collapse FX while a fullscreen same-origin iframe preloads the rimverse underneath; the white flash fades out to reveal the player already standing in the rimverse. Identity flows through the shared SQLite: the iframe URL carries v3's `dunkToken`; rimverse (read-only on the DB, SP2) loads that player's character and derives their rimverse appearance.

**Tech Stack:** v3 = Express + socket.io + better-sqlite3 + Three.js (vanilla JS, `node --test`). Rimverse = TS workspaces, `ws` server (:8081), Vite + Three.js client, vitest.

## Global Constraints

- **Both games stay as-is.** No gameplay, rendering, or protocol changes to either engine beyond the warp seams listed here.
- **No URL navigation at warp time.** `location.assign`/redirect is the rejected approach (PR #7 SP3). The page never reloads.
- **Server-authoritative.** The warp trigger lives in v3's `registerMake`; clients only react to the broadcast `ev:{k:'warp'}`.
- **Rimverse is READ-ONLY on the shared DB** (`data/dunkcontest.db`); v3 is the sole writer (SP2 decision).
- Vendor source from `~/Sites/thedunkcontest2` branch **`sp1-vendor-v3`** (has the SP2 read-only db layer), commit `1e9b122`, EXCLUDING its `dunkcontest/` dir (that's a vendored copy of this repo — circular).
- v3 tests: `npm test` (node --test, currently 23 green). Rimverse tests: `npm test` in `rimverse/` (vitest, 202 green on sp1-vendor-v3).
- Work on branch `rimverse-warp` off `main`.

---

### Task 1: Vendor rimverse source into `rimverse/`

**Files:**
- Create: `rimverse/` (entire tree from thedunkcontest2 @ sp1-vendor-v3, minus `dunkcontest/`)
- Modify: `rimverse/server/src/index.ts` (SHARED_DB default path)
- Modify: `.gitignore` (rimverse node_modules/dist)

**Interfaces:**
- Produces: a self-contained rimverse app at `rimverse/` — `npm test` (202 green), `npm run dev` (ws :8081 + vite :5173), reading this repo's `data/dunkcontest.db` read-only.

- [ ] **Step 1: Branch + export the tree**

```bash
cd ~/Sites/thedunkcontest
git checkout -b rimverse-warp
mkdir rimverse
git -C ~/Sites/thedunkcontest2 archive sp1-vendor-v3 | tar -x -C rimverse
rm -rf rimverse/dunkcontest
```

- [ ] **Step 2: Point the shared-DB default at this repo's db**

In `rimverse/server/src/index.ts`, the SP2 default points at the (now deleted) vendored copy. Change:

```ts
const SHARED_DB =
  process.env.DUNKVERSE_DB ??
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dunkcontest', 'data', 'dunkcontest.db');
```

to (server/src → ../../.. = repo root):

```ts
const SHARED_DB =
  process.env.DUNKVERSE_DB ??
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data', 'dunkcontest.db');
```

Also update the comment above it: the file lives at `<repo>/data/dunkcontest.db` (v3's canonical DB, v3 sole writer).

- [ ] **Step 3: Install + verify green**

```bash
cd rimverse && npm install && npm test && npm run typecheck
```

Expected: 202 tests pass, typecheck clean.

- [ ] **Step 4: Boot check against the real shared DB**

```bash
cd rimverse && npm run dev -w server &
sleep 2 && kill %1
```

Expected: server starts on :8081 with no db error (reads `data/dunkcontest.db` read-only).

- [ ] **Step 5: Gitignore + commit**

Append to repo-root `.gitignore` (rimverse ships its own .gitignore, but belt-and-suspenders for the dist path v3 serves):

```
rimverse/node_modules/
rimverse/client/dist/
```

```bash
git add -A rimverse .gitignore
git commit -m "feat: vendor RIMVERSE (thedunkcontest2 @ sp1-vendor-v3) into rimverse/ as-is"
```

---

### Task 2: v3 server warp trigger (port SP3, already written + tested)

**Files:**
- Modify: `shared/constants.js` (add `WARP`)
- Modify: `src/room.js` (combined score → armed → dunk → broadcast)
- Modify: `test/room.test.js` (3 warp tests)

**Interfaces:**
- Produces: server broadcasts `ev: { k: 'warp', pid, rim }` once per room when combined score ≥ hidden threshold in [10,25] and the next dunk lands. v3 client receives it via the existing `net.on('warp', …)` event bus (net.js already routes `ev.k`).

These exact changes exist as commits `5a988a3` on thedunkcontest2's vendored copy, which was byte-identical to this repo — the diff applies cleanly.

- [ ] **Step 1: Apply the SP3 server diff**

```bash
cd ~/Sites/thedunkcontest
git -C ~/Sites/thedunkcontest2 diff cc1333f..1e9b122 -- \
  dunkcontest/src/room.js dunkcontest/shared/constants.js dunkcontest/test/room.test.js \
  | git apply -p2
```

This adds to `shared/constants.js`:

```js
// The wormhole. The combined room score climbs; at a per-room HIDDEN
// threshold in [min, min+span-1] the game arms, and the next dunk becomes the
// Universe Collapse → the whole room warps into the rimverse. Server-authoritative.
export const WARP = {
  min: 10,   // brief §5.3: threshold = 10 + floor(rand * 16) → [10, 25]
  span: 16,
};
```

And to `src/room.js` (constructor):

```js
// Wormhole: combined room score + a per-room HIDDEN threshold (never serialized).
// Once combined >= threshold the room is armed; the next dunk is the Universe Collapse.
this.combinedScore = 0;
this.warpThreshold = WARP.min + Math.floor(this.random() * WARP.span);
this.warpArmed = false;
this.warping = false; // latch: the collapse fires exactly once
```

And at the end of `registerMake` (after the make broadcast):

```js
// Wormhole: combined score climbs → arm at the hidden threshold → the
// next dunk is the Universe Collapse → broadcast one `warp` to the whole room.
this.combinedScore += points;
if (!this.warpArmed && this.combinedScore >= this.warpThreshold) this.warpArmed = true;
if (this.warpArmed && !this.warping && kind === 'dunk') {
  this.warping = true;
  this.broadcast('ev', { k: 'warp', pid: p.pid, rim: rimIndex });
}
```

(plus `WARP` added to the constants import, and the 3 tests from `test/room.test.js`).

- [ ] **Step 2: Run v3 tests**

```bash
npm test
```

Expected: 26 pass (was 23; +2 warp units +1 live-dunk-path).

- [ ] **Step 3: Commit**

```bash
git add shared/constants.js src/room.js test/room.test.js
git commit -m "feat: warp trigger — hidden combined-score threshold arms the Universe Collapse dunk (SP3 port)"
```

---

### Task 3: Rimverse global-room join route (rimverse server)

**Files:**
- Modify: `rimverse/server/src/game/roomManager.ts` (singleton rimverse room)
- Modify: `rimverse/server/src/net.ts` (route `room: 'rimverse'` joins to it)
- Test: `rimverse/server/test/roomManager.test.ts` (or the existing roomManager test file — add cases there)

**Interfaces:**
- Consumes: `RoomManager.findOrCreateRoom(courtId, mode)`, `World(mode)` with `mode: 'rimverse'`.
- Produces: `RoomManager.rimverse(): Room` — the ONE shared rimverse (id `'rimverse'`, `World('rimverse')`, capped only by the global `MAX_PLAYERS=100` join check that already exists in net.ts). A client `join` with `room: 'rimverse'` lands there.

Background: the current join handler hardcodes `rooms.findOrCreateRoom(courtId, 'dunkContest')` — there is NO live route into a rimverse-mode world. The dunk-contest first-fit also caps rooms at `DC_ROOM.cap` (10), which must not apply to the rimverse.

- [ ] **Step 1: Write the failing tests**

In the rimverse server's roomManager test file:

```ts
describe('rimverse room', () => {
  it('returns one shared rimverse room in rimverse mode', () => {
    const rm = new RoomManager();
    const a = rm.rimverse();
    const b = rm.rimverse();
    expect(a).toBe(b);
    expect(a.id).toBe('rimverse');
    expect(a.world.mode).toBe('rimverse');
  });

  it('is not capped at the dunk-contest room cap', () => {
    const rm = new RoomManager();
    const room = rm.rimverse();
    for (let i = 0; i < 12; i++) room.world.addPlayer(`p${i}`, `P${i}`);
    expect(rm.rimverse()).toBe(room); // still the same room past DC_ROOM.cap=10
    expect(room.world.players.size).toBe(12);
  });

  it('is stepped and never reaped by stepAll', () => {
    const rm = new RoomManager();
    const room = rm.rimverse();
    room.world.addPlayer('p1', 'P1');
    rm.stepAll();
    room.world.removePlayer('p1');
    rm.stepAll();
    expect(rm.rimverse()).toBe(room); // dunk rooms reap when empty; the rimverse persists
  });
});
```

(Adjust `addPlayer`/`removePlayer` call signatures to the actual `World` API in `world.ts` — B1 used `world.addPlayer(id, name)`.)

- [ ] **Step 2: Run to verify failure**

```bash
cd rimverse && npx vitest run server/test -t rimverse
```

Expected: FAIL — `rm.rimverse is not a function`.

- [ ] **Step 3: Implement `rimverse()` in RoomManager**

In `roomManager.ts`:

```ts
/** The ONE shared global rimverse (locked decision) — created lazily, never reaped,
 *  capped only by the global MAX_PLAYERS join check in net.ts. */
rimverse(): Room {
  let room = this.roomsById.get('rimverse');
  if (!room) {
    room = { id: 'rimverse', courtId: 'rimverse', world: new World('rimverse'), hadPlayers: false };
    this.roomsById.set('rimverse', room);
  }
  return room;
}
```

And in `stepAll()`, guard the reap so the rimverse persists (dunk rooms keep v3 reap parity):

```ts
else if (room.hadPlayers && id !== 'rimverse') this.roomsById.delete(id);
```

- [ ] **Step 4: Route the join in net.ts**

In the join handler, replace:

```ts
const courtId = typeof (msg as { room?: unknown }).room === 'string' ? (msg as { room: string }).room : 'rucker';
const room = rooms.findOrCreateRoom(courtId, 'dunkContest');
```

with:

```ts
const courtId = typeof (msg as { room?: unknown }).room === 'string' ? (msg as { room: string }).room : 'rucker';
const room = courtId === 'rimverse' ? rooms.rimverse() : rooms.findOrCreateRoom(courtId, 'dunkContest');
```

- [ ] **Step 5: Run the full rimverse suite**

```bash
cd rimverse && npm test && npm run typecheck
```

Expected: 205 pass (202 + 3), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add rimverse/server
git commit -m "feat(rimverse): global shared rimverse room — join route for warp arrivals"
```

---

### Task 4: Warp-entry boot (rimverse client)

**Files:**
- Modify: `rimverse/client/src/net/net.ts` (`Net.token()` URL override)
- Modify: `rimverse/client/src/main.ts` (skip lobby on `from=warp`, auto-join the rimverse)
- Test: `rimverse/client/test/net.test.ts` (token override case)

**Interfaces:**
- Consumes: Task 3's `room: 'rimverse'` join route; the existing `?server=` WS-URL override in Net's constructor (used by the prod iframe URL in Task 5).
- Produces: opening `/?from=warp&token=<dunkToken>&name=<name>` boots straight into the rimverse as that identity. The server loads the character from the shared DB by token (v3 wrote it) and derives the rimverse appearance — zero extra bridge code (SP2/SP4 proven path).

- [ ] **Step 1: Write the failing test**

In `rimverse/client/test/net.test.ts` (jsdom is already a dev dep and this file already exercises Net statics):

```ts
it('Net.token() honors a ?token= URL param and persists it', () => {
  window.history.replaceState({}, '', '/?from=warp&token=warp-tok-123');
  localStorage.setItem('rimverse-token', 'old-local-token');
  expect(Net.token()).toBe('warp-tok-123');
  expect(localStorage.getItem('rimverse-token')).toBe('warp-tok-123');
  window.history.replaceState({}, '', '/'); // reset for other tests
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd rimverse && npx vitest run client/test/net.test.ts
```

Expected: FAIL — token() returns `'old-local-token'`.

- [ ] **Step 3: Implement the override**

In `net.ts`:

```ts
/** Stable per-browser identity token (arcade-style, no auth).
 *  A ?token= URL param (the warp hand-off from The Dunk Contest) wins and is
 *  persisted, so the warped-in identity survives future visits. */
static token(): string {
  const KEY = 'rimverse-token';
  const fromUrl = new URLSearchParams(location.search).get('token');
  if (fromUrl) {
    localStorage.setItem(KEY, fromUrl);
    return fromUrl;
  }
  let t = localStorage.getItem(KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(KEY, t);
  }
  return t;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd rimverse && npx vitest run client/test/net.test.ts
```

Expected: PASS (whole file).

- [ ] **Step 5: Warp boot in main.ts**

At the bottom of `main.ts`, replace:

```ts
// The lobby gates the join: it mounts over the idle scene and joins the rimverse on PLAY.
new Lobby({ net, onPlay: (name, court) => net.join(name, court) });
```

with:

```ts
// The lobby gates the join — EXCEPT when arriving through the warp from The Dunk
// Contest: then we drop straight into the shared rimverse as the warped identity.
const boot = new URLSearchParams(location.search);
if (boot.get('from') === 'warp') {
  net.join((boot.get('name') ?? 'hooper').slice(0, 16) || 'hooper', 'rimverse');
} else {
  new Lobby({ net, onPlay: (name, court) => net.join(name, court) });
}
```

(`net.join` sends token + stored character; on a first warp there is no localStorage character in the iframe, the join carries `character: null`, and the server falls back to the shared-DB character for the token — exactly the SP4 bridge.)

- [ ] **Step 6: Full suite + typecheck, commit**

```bash
cd rimverse && npm test && npm run typecheck
git add rimverse/client
git commit -m "feat(rimverse): warp-entry boot — URL token identity + straight-to-rimverse join"
```

---

### Task 5: v3 client — Universe Collapse + in-page iframe hand-off

**Files:**
- Create: `public/js/warp.js` (collapse FX + `rimverseUrl` + `mountRimverse`)
- Modify: `public/js/main.js` (handle the `warp` event)
- Test: `test/warp.test.js` (pure `rimverseUrl` unit — node --test, no DOM)

**Interfaces:**
- Consumes: Task 2's `ev:{k:'warp'}` broadcast (arrives as `net.on('warp', …)`); v3's `net.socket` (socket.io client) for the post-warp disconnect; `localStorage.dunkToken` / `localStorage.dunkName`.
- Produces: on `warp`, the rimverse iframe mounts immediately (loads + connects during the collapse), the ~2.2s collapse FX plays over it, the white flash fades out to reveal the rimverse — no navigation, one page.

The collapse FX is the proven `runCollapse` from PR #7 (`1e9b122`), with ONE change: the overlay used to persist because the page navigated away; now it must fade out and remove itself to reveal the iframe underneath. The redirect (`warpUrl` + `location.assign`) is replaced by `mountRimverse`.

- [ ] **Step 1: Write the failing test (pure URL builder)**

Create `test/warp.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { rimverseUrl } from '../public/js/warp.js';

test('rimverseUrl: dev points at the vite client with warp identity', () => {
  const u = new URL(rimverseUrl('tok-1', 'MATT', {
    hostname: 'localhost', host: 'localhost:3000', protocol: 'http:', href: 'http://localhost:3000/',
  }));
  assert.equal(u.origin, 'http://localhost:5173');
  assert.equal(u.searchParams.get('from'), 'warp');
  assert.equal(u.searchParams.get('token'), 'tok-1');
  assert.equal(u.searchParams.get('name'), 'MATT');
  assert.equal(u.searchParams.get('server'), null); // dev default ws://localhost:8081 already works
});

test('rimverseUrl: prod is same-origin /rimverse/ with a same-host wss server override', () => {
  const u = new URL(rimverseUrl('tok-2', 'MATT', {
    hostname: 'thedunkcontest.com', host: 'thedunkcontest.com', protocol: 'https:', href: 'https://thedunkcontest.com/',
  }));
  assert.equal(u.origin, 'https://thedunkcontest.com');
  assert.equal(u.pathname, '/rimverse/');
  assert.equal(u.searchParams.get('server'), 'wss://thedunkcontest.com/rimverse/ws');
  assert.equal(u.searchParams.get('token'), 'tok-2');
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test
```

Expected: FAIL — cannot find `../public/js/warp.js` (or `rimverseUrl` not exported). NOTE: `warp.js` must stay DOM-free at import time (styles inject lazily) so node --test can import it.

- [ ] **Step 3: Create `public/js/warp.js`**

The `injectStyles`/CSS/`runCollapse` body is verbatim from PR #7's `warp.js` (commit `1e9b122`) EXCEPT the promise at the end of `runCollapse` (fade + remove), and `warpUrl` is replaced:

```js
// warp.js — the Universe Collapse. Every player who receives the server `warp`
// event plays this screen-level wormhole-collapse while the rimverse loads in a
// fullscreen same-origin iframe underneath; the white flash fades out to reveal
// it. ONE page — no navigation. The bespoke "leap-from-anywhere" Collapse-dunk
// choreography is deferred (docs/superpowers/specs/2026-06-14-sp3-warp-design.md §5).

const DUR_MS = 2200;

let stylesInjected = false;
function injectStyles() {
  /* … verbatim from 1e9b122 … */
}

/** Play the collapse; resolves at the white-flash peak, then fades the overlay
 *  out (revealing the rimverse iframe) and removes it. */
export function runCollapse(world) {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'warpOverlay';
  el.innerHTML =
    '<div class="warpVortex"></div><div class="warpRing"></div>' +
    '<div class="warpTitle">Universe Collapse</div><div class="warpFlash"></div>';
  document.body.appendChild(el);

  /* … camera dolly verbatim from 1e9b122 … */

  return new Promise((resolve) => setTimeout(() => {
    el.style.transition = 'opacity 700ms ease-out';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 750);
    resolve();
  }, DUR_MS));
}

/** Rimverse iframe URL. Dev → the vite client (its default ws://localhost:8081 works).
 *  Prod → same-origin /rimverse/ + a same-host wss override (Caddy proxies /rimverse/ws → :8081).
 *  The token is v3's dunkToken; rimverse persists it as its own identity (SP4 bridge). */
export function rimverseUrl(token, name, loc = window.location) {
  const dev = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  const base = (typeof window !== 'undefined' && window.RIMVERSE_URL) || (dev ? 'http://localhost:5173/' : '/rimverse/');
  const u = new URL(base, loc.href);
  u.searchParams.set('from', 'warp');
  u.searchParams.set('token', token);
  if (name) u.searchParams.set('name', name);
  if (!dev) u.searchParams.set('server', `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/rimverse/ws`);
  return u.toString();
}

/** Mount the rimverse fullscreen under the collapse overlay (z 9000 < overlay 9999)
 *  so it loads + connects while the collapse plays. Returns the iframe. */
export function mountRimverse(token, name) {
  const f = document.createElement('iframe');
  f.id = 'rimverse';
  f.src = rimverseUrl(token, name);
  f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9000;background:#0b0218;';
  f.addEventListener('load', () => f.focus());
  document.body.appendChild(f);
  return f;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 28 pass (26 + 2 warp-url tests).

- [ ] **Step 5: Handle `warp` in `public/js/main.js`**

Add the import:

```js
import { runCollapse, mountRimverse } from './warp.js';
```

Add after the `net.on('net', …)` handler (and change that handler's reconnect guard):

```js
net.on('net', ({ up }) => {
  hud.setConnection(up);
  // socket.io reconnected: re-run the handshake to restore our session.
  // (Suppressed once the warp has started — we now live in the rimverse.)
  if (up && inGame && !warping) join();
});

// The Universe Collapse. The server arms the room at a hidden combined-score
// threshold and broadcasts one `warp` to everyone when the next dunk lands.
// The rimverse mounts (and connects) in an iframe UNDER the collapse FX; the
// flash fades out and you're standing in the rimverse. Same page, no redirect.
let warping = false;
net.on('warp', () => {
  if (warping) return;
  warping = true;
  inGame = false; // freeze the local game (stops input + sim updates)
  const frame = mountRimverse(token, localStorage.dunkName || '');
  Promise.resolve(runCollapse(world))
    .catch((e) => console.error('collapse FX failed', e))
    .finally(() => {
      net.socket.disconnect();          // v3 session over — the rimverse owns the page now
      const ui = document.getElementById('gameUI');
      if (ui) ui.style.display = 'none';
      frame.focus();                    // WASD flows into the rimverse
    });
});
```

(`token` is already in scope at main.js top: `const token = localStorage.dunkToken || …`.)

- [ ] **Step 6: Run v3 tests + commit**

```bash
npm test
git add public/js/warp.js public/js/main.js test/warp.test.js
git commit -m "feat: Universe Collapse warp — in-page iframe hand-off into the rimverse (no redirect)"
```

---

### Task 6: Build + serve the rimverse client under v3's Express

**Files:**
- Modify: `rimverse/client/vite.config.ts` (`base: '/rimverse/'`)
- Modify: `server.js` (static mount)
- Modify: `package.json` (build script)

**Interfaces:**
- Consumes: Task 5's prod URL `/rimverse/?from=warp…`.
- Produces: `npm run build:rimverse` → `rimverse/client/dist/`; `GET /rimverse/` on :3000 serves the built rimverse client with correctly-prefixed asset URLs.

- [ ] **Step 1: Vite base path**

In `rimverse/client/vite.config.ts` add `base` (assets resolve under the /rimverse/ mount):

```ts
export default defineConfig({
  base: '/rimverse/',
  server: { port: 5173 },
  build: { /* … unchanged … */ },
});
```

Note: `base` also applies to the dev server — the dev iframe URL stays `http://localhost:5173/` and vite redirects to `/rimverse/`; verify the dev iframe still boots in Task 8 (if vite doesn't redirect, change Task 5's dev base to `http://localhost:5173/rimverse/`).

- [ ] **Step 2: Static mount in `server.js`**

After the existing static mounts:

```js
app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
// The rimverse — the game within the game (built by `npm run build:rimverse`).
app.use('/rimverse', express.static(path.join(__dirname, 'rimverse', 'client', 'dist')));
```

- [ ] **Step 3: Build script in v3 `package.json`**

```json
"build:rimverse": "npm --prefix rimverse run build -w @rimverse/client"
```

- [ ] **Step 4: Verify the built client serves**

```bash
npm run build:rimverse
node server.js &
sleep 1
curl -s http://localhost:3000/rimverse/ | grep -o '/rimverse/assets/[^"]*' | head -3
kill %1
```

Expected: HTML 200 with `/rimverse/assets/…` script/asset paths.

- [ ] **Step 5: Commit**

```bash
git add rimverse/client/vite.config.ts server.js package.json
git commit -m "feat: serve the built rimverse client at /rimverse/ from v3's Express"
```

---

### Task 7: Deploy config — second systemd unit + Caddy ws route

**Files:**
- Create: `deploy/rimverse.service`
- Modify: `deploy/Caddyfile` (proxy `/rimverse/ws` → :8081)
- Modify: `deploy/deploy.sh` (build rimverse + restart both units) — read it first and follow its existing structure.

**Interfaces:**
- Consumes: Task 5's prod `server=wss://<host>/rimverse/ws` override; Task 6's build.
- Produces: config files only — actually applying to the droplet is a separate, user-approved deploy.

- [ ] **Step 1: `deploy/rimverse.service`**

Mirror `deploy/dunkcontest.service` (read it for User/WorkingDirectory conventions), with:

```ini
[Unit]
Description=RIMVERSE server (the game within The Dunk Contest)
After=network.target

[Service]
# ponytail: tsx runtime in prod, matches dev; compile to dist if droplet CPU ever matters
WorkingDirectory=/opt/thedunkcontest/rimverse
ExecStart=/usr/bin/npm run start -w @rimverse/server
Environment=DUNKVERSE_DB=/opt/thedunkcontest/data/dunkcontest.db
Restart=always

[Install]
WantedBy=multi-user.target
```

(Adopt the exact paths/User from the existing unit — the `/opt/thedunkcontest` guess must be corrected to whatever `dunkcontest.service` actually uses.)

- [ ] **Step 2: Caddyfile ws route**

Inside the existing site block, BEFORE the default reverse_proxy to :3000:

```
handle /rimverse/ws {
    reverse_proxy localhost:8081
}
```

- [ ] **Step 3: deploy.sh** — add `npm run build:rimverse` + `npm --prefix rimverse install` to the build steps and `rimverse.service` to the restart step, following the script's existing shape.

- [ ] **Step 4: Commit**

```bash
git add deploy/
git commit -m "deploy: rimverse systemd unit + Caddy /rimverse/ws route (config only)"
```

---

### Task 8: End-to-end verification

**Files:** none created (throwaway bot script in the scratchpad if needed).

- [ ] **Step 1: Server-side warp broadcast (bots)** — run v3's `verify.js` e2e (bots join/score/dunk). Then a variant: keep bots dunking until combined ≥ 26 (guarantees past any threshold in [10,25]) and assert every bot socket received `ev:{k:'warp'}`. This mirrors the live-bot integration already proven in PR #7.

- [ ] **Step 2: Full browser warp (dev)** — run `node server.js` (:3000) + `cd rimverse && npm run dev` (:8081 + :5173). Drive the game in the browser preview (rooted at this repo): join a court, score with bots until the warp fires. Verify: collapse FX plays → flash fades → rimverse visible IN THE SAME PAGE (URL still :3000), player joined the shared rimverse world, WASD moves the rimverse player (iframe focus), and the rimverse sprite's hue derives from the v3 character (check `__rim.net` / player snapshot).

- [ ] **Step 3: Prod-shape smoke** — `npm run build:rimverse`, `node server.js`, `DUNKVERSE_DB=data/dunkcontest.db npm --prefix rimverse run start -w @rimverse/server`; open `http://localhost:3000/rimverse/?from=warp&token=<a real token from the db>&name=SMOKE&server=ws://localhost:8081` directly and confirm the built client boots straight into the rimverse with that identity.

- [ ] **Step 4: Screenshot proof + commit any fixes.**
