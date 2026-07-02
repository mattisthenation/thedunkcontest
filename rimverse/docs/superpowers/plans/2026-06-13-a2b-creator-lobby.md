# A2b — Creator & Lobby — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port v3's lobby + character creator into the V5 client *pixel-faithful* — YOUR BALLER creator (live preview via A2a's `renderPreview`, hair/build/extra as dropdowns), ALL-TIME GREATS wired to A1's real leaderboard, a reserved 6-card WORLD TOUR slot — and gate the (now-deferred) rimverse join behind a PLAY button.

**Architecture:** Vanilla TS + imperative DOM (the `preview/main.ts` pattern), no framework; CSS as one injected `<style>` string (the repo has no `.css` files). Interactive/data logic is factored into pure, node-testable functions; DOM wiring is tested under jsdom; pixel fidelity + the live canvas preview are a controller-run visual gate. One contained server change lets the WS server serve `identity` + `getLeaderboard` *before* join (read the token off the connection), so the pre-join lobby shows real data — no `shared/`/protocol/sim changes.

**Tech Stack:** TS ESM monorepo, Vitest (node + jsdom per-file), Vite 6 client. New dev-dep: `jsdom`. Branch: `a2b-creator-lobby`. Spec: `docs/superpowers/specs/2026-06-13-a2b-creator-lobby-design.md`.

---

## Conventions

- **cwd:** Always `cd /Users/matthewlittlehale/Sites/thedunkcontest2` first — the shell's default cwd is the v3 repo (`~/Sites/thedunkcontest`).
- **Run one test file:** `npx vitest run <path>`. **Full suite:** `npm test`. **Types:** `npm run typecheck` (must be clean). Existing **144 tests across 29 files** stay green throughout.
- **jsdom per file:** client DOM tests start with the docblock `// @vitest-environment jsdom` on line 1. Node tests need no docblock.
- **TDD:** every code task is RED (write failing test, run, expect FAIL) → GREEN (implement, run, expect PASS) → typecheck → commit. No red between commits.
- **Commits:** Conventional-Commits prefix; `git add` lists explicit paths; end every message with the trailer on its own line:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- **Source to port (v3, frozen reference):** `~/Sites/thedunkcontest/public/css/style.css`, `public/index.html`, `public/js/creator.js`, `public/js/main.js`.
- **A2a integration points (already in `main`):** renderer `client/src/dunkchar/generator.ts` (`renderPreview`, `SKINS`, `HAIR_COLORS`, `HAIR_STYLES`, `ACCESSORIES`, `BUILDS`); model `shared/src/character.ts` (`Character`, `DEFAULT_CHARACTER`, `sanitizeCharacter`); join already reads `localStorage['rimverse-character']` via `Net.character()`.

## File map

| File | Change |
|------|--------|
| `server/src/net.ts` | Add `tokenFromReqUrl` + `identityFor`; read token on `connection` → send identity; un-gate `getLeaderboard` pre-join; DRY join's identity send |
| `client/src/net/net.ts` | Deferred join: `wsUrlWithToken`/`joinMessage`, ctor connects w/ `?token=` (no auto-join), `join(name)`, `requestLeaderboard`, `onIdentity`/`onLeaderboard` hooks |
| `client/src/lobby/styles.ts` | NEW — `injectLobbyStyles()`; v3 CSS verbatim + dropdown + disabled-card rules |
| `client/src/lobby/courts.ts` | NEW — `COURTS` (6) + `renderCourtGrid` (disabled cards) |
| `client/src/lobby/leaderboard.ts` | NEW — `leaderboardHTML` + `renderLeaderboard` (ALL-TIME GREATS) |
| `client/src/lobby/creator.ts` | NEW — `Creator` (port of v3 `creator.js`; dropdowns) + `loadCharacter`/`persistCharacter` |
| `client/src/lobby/lobby.ts` | NEW — `Lobby` shell + boot gate (name persist, PLAY/RESUME) |
| `client/src/main.ts` | Mount lobby first; `new Net()`; defer `join` to PLAY |
| `package.json` | Add `jsdom` devDep |
| tests | `server/test/net.test.ts` (extend) + new `client/test/{net,lobby-leaderboard,lobby-courts,lobby-styles,lobby-creator,lobby-shell}.test.ts` |

---

## Task 1: Server — pre-join identity + leaderboard

**Files:** Modify `server/src/net.ts`; Test `server/test/net.test.ts`.

> The lobby shows ALL-TIME GREATS + your rank before PLAY, but the server gates that data behind `sess.joined`. Extract two pure helpers (testable like `sanitizeIntent`/`flushSession`), read the token off the WS connection, send `identity` on connect, and un-gate `getLeaderboard`. `rank` must be `null` for a token with no DB row (else `playerRank` returns `1` for an unknown player). The pre-join leaderboard read is intentionally public (read-only, clamped to limit [1,50], index-backed) — no `World` mutation; `join` stays the sole spawn/upsert authority.

- [ ] **Step 1: Write the failing test** — append to `server/test/net.test.ts`:

```ts
import { openDb } from '../src/db';
import { DEFAULT_CHARACTER } from '../../shared/src/character';
import { tokenFromReqUrl, identityFor } from '../src/net';

describe('tokenFromReqUrl', () => {
  it('extracts the token from the connection url', () => {
    expect(tokenFromReqUrl('/?token=abc123')).toBe('abc123');
    expect(tokenFromReqUrl('/?server=x&token=abc')).toBe('abc');
  });
  it('returns null when absent or blank', () => {
    expect(tokenFromReqUrl('/')).toBeNull();
    expect(tokenFromReqUrl('/?token=')).toBeNull();
    expect(tokenFromReqUrl(undefined)).toBeNull();
  });
});

describe('identityFor', () => {
  it('reports persisted career + rank for a known token', () => {
    const db = openDb(':memory:');
    db.upsertIdentity('tok', 'A', DEFAULT_CHARACTER);
    db.recordSession('tok', 8, { points: 6, dunks: 2 });
    const id = identityFor(db, 'tok');
    expect(id).toEqual({ t: 'identity', points: 6, dunks: 2, bestSession: 8, sessions: 1, rank: 1 });
    db.close();
  });
  it('returns zeros + null rank for an unknown token', () => {
    const db = openDb(':memory:');
    expect(identityFor(db, 'ghost')).toEqual({ t: 'identity', points: 0, dunks: 0, bestSession: 0, sessions: 0, rank: null });
    db.close();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/net.test.ts` (FAIL: `tokenFromReqUrl`/`identityFor` not exported).

- [ ] **Step 3: Implement** in `server/src/net.ts`:
  - Add to the top-of-file imports a type import for `ServerMsg` (already imported alongside `ClientMsg` on line 3 — confirm `ServerMsg` is in that import; it is).
  - Add these exported helpers (place above `startNet`):

```ts
/** Parse the stable token off the WS connection URL (e.g. ".../?token=abc"). Null if absent/blank. */
export function tokenFromReqUrl(url: string | undefined): string | null {
  if (!url) return null;
  const q = url.indexOf('?');
  if (q < 0) return null;
  const t = new URLSearchParams(url.slice(q + 1)).get('token');
  return t && t.trim() ? t.slice(0, 64) : null;
}

/** Build the identity message for a token from persisted career (zeros + null rank if unknown). */
export function identityFor(db: Db, token: string): Extract<ServerMsg, { t: 'identity' }> {
  const stored = db.loadPlayer(token);
  return {
    t: 'identity',
    points: stored?.points ?? 0,
    dunks: stored?.dunks ?? 0,
    bestSession: stored?.bestSession ?? 0,
    sessions: stored?.sessions ?? 0,
    rank: stored ? db.playerRank(token) : null,
  };
}
```

  - Change the connection handler signature to capture the request and read the token (line 27): `wss.on('connection', (ws) => {` → `wss.on('connection', (ws, req) => {`. Immediately after `sessions.set(id, sess);` add:

```ts
    // Pre-join lobby data: identify by the connection token so ALL-TIME GREATS + the
    // player's rank are available before they press PLAY (read-only; join still owns spawning).
    const connToken = tokenFromReqUrl(req.url);
    if (connToken) {
      sess.token = connToken;
      send(ws, identityFor(db, connToken));
    }
```

  - DRY the join handler's identity send: replace the inline `send(ws, { t: 'identity', ... rank: db.playerRank(token) });` block (currently lines 61–68) with `send(ws, identityFor(db, token));`.
  - Un-gate the leaderboard: change `} else if (msg.t === 'getLeaderboard' && sess.joined) {` to `} else if (msg.t === 'getLeaderboard') {`.

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/net.test.ts` PASS; `npm run typecheck` clean; `npm test` green (144 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add server/src/net.ts server/test/net.test.ts
git commit -m "feat(server): serve identity + leaderboard pre-join (token on WS connect)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Tooling — add jsdom for client DOM tests

**Files:** Modify `package.json` (+ `package-lock.json`).

> The lobby/creator/Net tests need a DOM (`document`, `localStorage`, `location`). The repo's vitest defaults to the node env; jsdom is opted into per-file via `// @vitest-environment jsdom`. This task just installs it. **If `npm install` fails (offline/registry), STOP and report — do not hand-edit the lockfile.**

- [ ] **Step 1: Install** — `cd /Users/matthewlittlehale/Sites/thedunkcontest2 && npm install -D jsdom`.

- [ ] **Step 2: Verify** — `npm test` (existing 148 stay green; jsdom present in `devDependencies`). `npm run typecheck` clean.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add jsdom dev-dep for client DOM tests (A2b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Client Net — deferred join + lobby hooks

**Files:** Modify `client/src/net/net.ts`; Test `client/test/net.test.ts` (new).

> Today `Net` auto-joins on `ws.onopen`. A2b connects (with the token in the URL so the server can identify pre-join), requests the leaderboard, and joins only when the lobby calls `join(name)` on PLAY. Re-add the `onLeaderboard` consumer A2a removed, plus `onIdentity`. Pure URL/message builders are node-testable; the wiring is verified with a fake `WebSocket` under jsdom.

- [ ] **Step 1: Write the failing test** — create `client/test/net.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Net, wsUrlWithToken, joinMessage } from '../src/net/net';

class FakeWS {
  static OPEN = 1;
  static last: FakeWS;
  readyState = FakeWS.OPEN;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  sent: string[] = [];
  constructor(url: string) { this.url = url; FakeWS.last = this; }
  send(s: string) { this.sent.push(s); }
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('WebSocket', FakeWS as unknown as typeof WebSocket);
});

describe('wsUrlWithToken', () => {
  it('appends token with the right separator', () => {
    expect(wsUrlWithToken('ws://h:8081', 't1')).toBe('ws://h:8081?token=t1');
    expect(wsUrlWithToken('ws://h/?server=x', 't2')).toBe('ws://h/?server=x&token=t2');
  });
});

describe('joinMessage', () => {
  it('omits character when null, includes it when present', () => {
    expect(joinMessage('Al', 'tok', null)).toEqual({ t: 'join', name: 'Al', token: 'tok' });
    expect(joinMessage('Al', 'tok', { skin: 1 })).toEqual({ t: 'join', name: 'Al', token: 'tok', character: { skin: 1 } });
  });
});

describe('Net deferred join', () => {
  it('connects with a token, requests leaderboard on open, and does NOT join', () => {
    new Net();
    expect(FakeWS.last.url).toContain('token=');
    FakeWS.last.onopen!();
    const msgs = FakeWS.last.sent.map((s) => JSON.parse(s));
    expect(msgs).toContainEqual({ t: 'getLeaderboard' });
    expect(msgs.find((m) => m.t === 'join')).toBeUndefined();
  });

  it('join(name) sends a join carrying the stored character', () => {
    localStorage.setItem('rimverse-character', JSON.stringify({ skin: 3 }));
    const net = new Net();
    net.join('Zee');
    const join = FakeWS.last.sent.map((s) => JSON.parse(s)).find((m) => m.t === 'join');
    expect(join).toMatchObject({ t: 'join', name: 'Zee', character: { skin: 3 } });
    expect(typeof join.token).toBe('string');
  });

  it('fires onIdentity + onLeaderboard from inbound frames', () => {
    const net = new Net();
    let career: unknown = null;
    let entries: unknown = null;
    net.onIdentity = (c) => (career = c);
    net.onLeaderboard = (e) => (entries = e);
    FakeWS.last.onmessage!({ data: JSON.stringify({ t: 'identity', points: 5, dunks: 2, bestSession: 7, sessions: 1, rank: 3 }) });
    FakeWS.last.onmessage!({ data: JSON.stringify({ t: 'leaderboard', entries: [{ rank: 1, name: 'A', points: 9, dunks: 4, bestSession: 9, character: null }] }) });
    expect(career).toMatchObject({ points: 5, rank: 3 });
    expect(net.career).toMatchObject({ points: 5 });
    expect(entries).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run client/test/net.test.ts` (FAIL: `wsUrlWithToken`/`joinMessage`/`join`/`onLeaderboard` missing).

- [ ] **Step 3: Implement** — replace `client/src/net/net.ts` entirely with:

```ts
import { SERVER_PORT } from '../../../shared/src/constants';
import type { ClientMsg, ServerMsg, SnapshotMsg, LeaderboardEntry } from '../../../shared/src/protocol';

export interface Career {
  points: number;
  dunks: number;
  bestSession: number;
  sessions: number;
  rank: number | null;
}

/** Append the identity token to the WS URL so the server can identify a connection pre-join. */
export function wsUrlWithToken(base: string, token: string): string {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

/** Build the join message, attaching the stored character only when present. */
export function joinMessage(name: string, token: string, character: object | null): ClientMsg {
  const msg: Extract<ClientMsg, { t: 'join' }> = { t: 'join', name, token };
  if (character) (msg as { character?: object }).character = character;
  return msg;
}

export class Net {
  ws: WebSocket;
  myId: string | null = null;
  career: Career | null = null;
  onSnapshot: ((s: SnapshotMsg) => void) | null = null;
  onWelcome: ((id: string, x: number, y: number) => void) | null = null;
  onIdentity: ((c: Career) => void) | null = null;
  onLeaderboard: ((entries: LeaderboardEntry[]) => void) | null = null;

  constructor() {
    const base =
      new URLSearchParams(location.search).get('server') ??
      `ws://${location.hostname}:${SERVER_PORT}`;
    this.ws = new WebSocket(wsUrlWithToken(base, Net.token()));
    this.ws.onopen = () => this.requestLeaderboard();
    this.ws.onmessage = (ev) => {
      const msg: ServerMsg = JSON.parse(ev.data);
      if (msg.t === 'welcome') {
        this.myId = msg.id;
        this.onWelcome?.(msg.id, msg.x, msg.y);
      } else if (msg.t === 'identity') {
        this.career = {
          points: msg.points,
          dunks: msg.dunks,
          bestSession: msg.bestSession,
          sessions: msg.sessions,
          rank: msg.rank,
        };
        this.onIdentity?.(this.career);
      } else if (msg.t === 'leaderboard') {
        this.onLeaderboard?.(msg.entries);
      } else if (msg.t === 'snapshot') {
        this.onSnapshot?.(msg);
      }
    };
  }

  /** Stable per-browser identity token (arcade-style, no auth). */
  static token(): string {
    const KEY = 'rimverse-token';
    let t = localStorage.getItem(KEY);
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(KEY, t);
    }
    return t;
  }

  /** Stored character from the creator (A2b). Returns null if absent or unparseable. */
  static character(): object | null {
    const raw = localStorage.getItem('rimverse-character');
    if (!raw) return null;
    try { return JSON.parse(raw) as object; } catch { return null; }
  }

  /** Enter the rimverse with the chosen name + stored character (called on PLAY). */
  join(name: string): void {
    this.send(joinMessage(name, Net.token(), Net.character()));
  }

  requestLeaderboard(limit?: number): void {
    this.send(typeof limit === 'number' ? { t: 'getLeaderboard', limit } : { t: 'getLeaderboard' });
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run client/test/net.test.ts` PASS. `npm run typecheck` will FAIL on `client/src/main.ts` (`new Net('hooper')` + `net.send({t:'getLeaderboard'})` arg). That's fixed in Task 9; to keep this commit green, also apply the two minimal main.ts edits now: `const net = new Net('hooper');` → `const net = new Net();`, and delete the line `net.send({ t: 'getLeaderboard' });` inside `net.onWelcome`. Then `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add client/src/net/net.ts client/test/net.test.ts client/src/main.ts
git commit -m "feat(client): deferred join + onIdentity/onLeaderboard hooks (A2b lobby seam)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Leaderboard render (ALL-TIME GREATS)

**Files:** Create `client/src/lobby/leaderboard.ts`; Test `client/test/lobby-leaderboard.test.ts`.

> Pure HTML-string builder ported from v3 `renderLeaderboard` — node-testable, no DOM. V5's `LeaderboardEntry` has no `best_streak`, so the STK column shows `bestSession`🔥 (the closest A1 stat). The `YOU` row reads `Career`.

- [ ] **Step 1: Write the failing test** — create `client/test/lobby-leaderboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { leaderboardHTML } from '../src/lobby/leaderboard';

const E = (over: Partial<Record<string, unknown>> = {}) =>
  ({ rank: 1, name: 'Ace', points: 50, dunks: 9, bestSession: 22, character: null, ...over }) as never;

describe('leaderboardHTML', () => {
  it('renders title, header, and a row with PTS/DNK/STK', () => {
    const html = leaderboardHTML([E()], null);
    expect(html).toContain('ALL-TIME GREATS');
    expect(html).toContain('class="lbRow"');
    expect(html).toContain('>Ace<');
    expect(html).toContain('50');
    expect(html).toContain('9🏀');
    expect(html).toContain('22🔥');
  });
  it('renders the YOU row from career and the empty state', () => {
    const html = leaderboardHTML([], { points: 12, dunks: 3, bestSession: 8, sessions: 2, rank: 4 });
    expect(html).toContain('YOU — RANK 4 · 12 PTS · 3 DUNKS · BEST SESSION 8');
    expect(html).toContain('No legends yet');
  });
  it('escapes names and shows — for a null rank', () => {
    expect(leaderboardHTML([E({ name: '<b>x' })], null)).toContain('&lt;b&gt;x');
    expect(leaderboardHTML([], { points: 0, dunks: 0, bestSession: 0, sessions: 0, rank: null })).toContain('RANK —');
  });
  it('marks the player\'s own row with .me when ranks match', () => {
    const html = leaderboardHTML([E({ rank: 4 })], { points: 12, dunks: 3, bestSession: 8, sessions: 2, rank: 4 });
    expect(html).toContain('class="lbRow me"');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run client/test/lobby-leaderboard.test.ts` (FAIL: module missing).

- [ ] **Step 3: Implement** — create `client/src/lobby/leaderboard.ts`:

```ts
import type { LeaderboardEntry } from '../../../shared/src/protocol';
import type { Career } from '../net/net';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** v3-faithful ALL-TIME GREATS markup. STK column = bestSession (V5 has no streak stat). */
export function leaderboardHTML(entries: LeaderboardEntry[], career: Career | null): string {
  const rows = entries.slice(0, 10).map((p) => `
    <div class="lbRow${career && p.rank === career.rank ? ' me' : ''}">
      <span class="lbRank">${p.rank}</span>
      <span class="lbName">${esc(p.name)}</span>
      <span class="lbStat" title="career points">${p.points}</span>
      <span class="lbStat sm" title="dunks">${p.dunks}🏀</span>
      <span class="lbStat sm" title="best session">${p.bestSession}🔥</span>
    </div>`).join('');
  const mine = career
    ? `\n    <div class="lbMe">YOU — RANK ${career.rank ?? '—'} · ${career.points} PTS · ${career.dunks} DUNKS · BEST SESSION ${career.bestSession}</div>`
    : '';
  return `
    <h2 class="lbTitle">ALL-TIME GREATS</h2>
    <div class="lbHead"><span class="lbRank">#</span><span class="lbName">BALLER</span><span class="lbStat">PTS</span><span class="lbStat sm">DNK</span><span class="lbStat sm">STK</span></div>
    ${rows || '<div class="lbEmpty">No legends yet. Be the first.</div>'}${mine}`;
}

export function renderLeaderboard(mount: HTMLElement, entries: LeaderboardEntry[], career: Career | null): void {
  mount.innerHTML = leaderboardHTML(entries, career);
}
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run client/test/lobby-leaderboard.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add client/src/lobby/leaderboard.ts client/test/lobby-leaderboard.test.ts
git commit -m "feat(client): ALL-TIME GREATS leaderboard render (A2b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Reserved WORLD TOUR court grid

**Files:** Create `client/src/lobby/courts.ts`; Test `client/test/lobby-courts.test.ts`.

> Render all 6 v3 courts present-but-disabled so the full lobby layout is locked in; Phase B enables selection. Court names/locations/flags are ported from v3 `shared/courts.js`.

- [ ] **Step 1: Write the failing test** — create `client/test/lobby-courts.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { COURTS, renderCourtGrid } from '../src/lobby/courts';

describe('COURTS', () => {
  it('has the 6 v3 courts in order', () => {
    expect(COURTS.map((c) => c.id)).toEqual(['rucker', 'venice', 'tokyo', 'rio', 'paris', 'tundra']);
  });
});

describe('renderCourtGrid', () => {
  it('renders 6 disabled court cards', () => {
    const el = document.createElement('div');
    renderCourtGrid(el);
    const cards = el.querySelectorAll<HTMLButtonElement>('.courtCard');
    expect(cards).toHaveLength(6);
    expect(Array.from(cards).every((c) => c.disabled)).toBe(true);
    expect(el.textContent).toContain('The Cage');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run client/test/lobby-courts.test.ts` (FAIL: module missing).

- [ ] **Step 3: Implement** — create `client/src/lobby/courts.ts`:

```ts
export interface CourtCard {
  id: string;
  name: string;
  location: string;
  flag: string;
}

/** The 6 v3 courts (ported from thedunkcontest/shared/courts.js). Reserved for Phase B; disabled in A2b. */
export const COURTS: CourtCard[] = [
  { id: 'rucker', name: 'The Cage', location: 'New York City', flag: '🇺🇸' },
  { id: 'venice', name: 'Venice Beach', location: 'Los Angeles', flag: '🇺🇸' },
  { id: 'tokyo', name: 'Shibuya Rooftop', location: 'Tokyo', flag: '🇯🇵' },
  { id: 'rio', name: 'Favela Heights', location: 'Rio de Janeiro', flag: '🇧🇷' },
  { id: 'paris', name: 'Le Toit', location: 'Paris', flag: '🇫🇷' },
  { id: 'tundra', name: 'Polar Run', location: 'Tromsø', flag: '🇳🇴' },
];

export function renderCourtGrid(mount: HTMLElement): void {
  mount.innerHTML = COURTS.map((c) => `
    <button class="courtCard" data-id="${c.id}" disabled title="Courts arrive in Phase B">
      <span class="cFlag">${c.flag}</span>
      <span class="cName">${c.name}</span>
      <span class="cLoc">${c.location}</span>
      <span class="cSoon">PHASE B</span>
    </button>`).join('');
}
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run client/test/lobby-courts.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add client/src/lobby/courts.ts client/test/lobby-courts.test.ts
git commit -m "feat(client): reserved WORLD TOUR court grid (6 disabled cards, A2b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Lobby styles (pixel-faithful v3 CSS)

**Files:** Create `client/src/lobby/styles.ts`; Test `client/test/lobby-styles.test.ts`.

> Inject v3's `public/css/style.css` lobby rules verbatim (the repo has no `.css` files; inline `<style>` is the convention). Two intentional additions vs v3: `.knobRow select` (styled like the old `.cycle`) and `.courtCard[disabled]`.

- [ ] **Step 1: Write the failing test** — create `client/test/lobby-styles.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { injectLobbyStyles } from '../src/lobby/styles';

describe('injectLobbyStyles', () => {
  it('injects once and carries the v3 gold token + title shadow', () => {
    injectLobbyStyles();
    injectLobbyStyles();
    const styles = document.querySelectorAll('#lobby-styles');
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain('--gold: #ffc928');
    expect(styles[0].textContent).toContain('4px 4px 0 var(--red)');
    expect(styles[0].textContent).toContain('.knobRow select');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run client/test/lobby-styles.test.ts` (FAIL: module missing).

- [ ] **Step 3: Implement** — create `client/src/lobby/styles.ts` (CSS ported verbatim from v3 `style.css`, scoped to `#lobby`, plus the two additions):

```ts
const CSS = `
:root { --gold: #ffc928; --gold-dark: #b8860b; --ink: #0b0d14; --red: #e8432e;
  --font: 'Verdana','Tahoma',sans-serif; --display: 'Arial Black','Verdana',sans-serif; }
#lobby, #lobby * { box-sizing: border-box; }
#lobby { position: fixed; inset: 0; z-index: 10; overflow-y: auto; font-family: var(--font); color: #fff;
  background: radial-gradient(ellipse at 50% -10%, rgba(255,201,40,0.16), transparent 55%),
    linear-gradient(170deg, #11141f, #0b0d14 55%, #151022); }
#lobby.hidden { display: none; }
.lobbyInner { max-width: 980px; margin: 0 auto; padding: 36px 24px 48px; text-align: center; }
#lobby h1 { font-family: var(--display); font-size: 56px; line-height: 0.95; letter-spacing: 4px;
  color: var(--gold); text-shadow: 4px 4px 0 var(--red), 7px 7px 0 #000; margin: 0 0 10px; }
#lobby .tag { font-size: 11px; letter-spacing: 3px; color: #8d96ad; margin: 0 0 28px; }
.lobbyCols { display: flex; gap: 28px; justify-content: center; flex-wrap: wrap; text-align: left; }
.lobbyCol { flex: 1 1 360px; max-width: 460px; }
.lobbyCol h2 { font-family: var(--display); font-size: 14px; letter-spacing: 3px; color: #fff;
  border-bottom: 2px solid var(--gold); padding-bottom: 6px; margin: 0 0 14px; }
#nameInput { width: 100%; padding: 11px 14px; margin-bottom: 14px; font-family: var(--display);
  font-size: 16px; letter-spacing: 2px; color: var(--gold); background: #060810; border: 2px solid #2a3046;
  border-radius: 6px; outline: none; text-transform: uppercase; box-sizing: border-box; }
#nameInput:focus { border-color: var(--gold); }
.creator { display: flex; gap: 16px; }
.previewBox { flex: 0 0 200px; background: #060810; border: 2px solid #2a3046; border-radius: 8px; padding: 4px; text-align: center; }
#charPreview { image-rendering: pixelated; width: 192px; height: 256px; }
.previewBtns { display: flex; gap: 6px; padding: 4px; }
.mini { flex: 1; font-size: 10px; font-weight: bold; letter-spacing: 1px; padding: 7px 4px; background: #1a2030;
  color: #cfd6e6; border: 1px solid #38415c; border-radius: 4px; cursor: pointer; }
.mini:hover { background: #242c42; }
.knobs { flex: 1; display: flex; flex-direction: column; gap: 7px; }
.knobRow { display: flex; align-items: center; gap: 8px; }
.knobRow label { flex: 0 0 84px; font-size: 9px; font-weight: bold; letter-spacing: 1px; color: #8d96ad; }
.swatches { display: flex; gap: 4px; flex-wrap: wrap; }
.swatch { width: 20px; height: 20px; border-radius: 4px; cursor: pointer; padding: 0;
  border: 2px solid rgba(255,255,255,0.15); }
.swatch.sel { border-color: var(--gold); box-shadow: 0 0 8px rgba(255,201,40,0.6); }
.knobRow select { flex: 1; padding: 6px 10px; font-size: 11px; font-weight: bold; font-family: var(--font);
  background: #1a2030; color: #fff; border: 1px solid #38415c; border-radius: 4px; cursor: pointer; }
#numInput { width: 70px; padding: 6px 8px; font-family: var(--display); font-size: 14px; color: var(--gold);
  background: #060810; border: 2px solid #2a3046; border-radius: 4px; }
#courtGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.courtCard { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; text-align: left;
  background: #10141f; border: 2px solid #2a3046; border-radius: 8px; cursor: pointer; color: #fff;
  transition: transform .08s, border-color .08s; }
.courtCard:hover:not([disabled]) { transform: translateY(-2px); border-color: #56618a; }
.courtCard[disabled] { opacity: 0.55; cursor: not-allowed; }
.cFlag { font-size: 20px; }
.cName { font-family: var(--display); font-size: 13px; letter-spacing: 1px; color: var(--gold); }
.cLoc { font-size: 10px; letter-spacing: 1px; color: #8d96ad; }
.cSoon { font-size: 8px; letter-spacing: 2px; color: #8d96ad; margin-top: 2px; }
#leaderboardMount { margin-top: 18px; }
.lbTitle { font-family: var(--display); font-size: 14px; letter-spacing: 3px; color: #fff;
  border-bottom: 2px solid var(--gold); padding-bottom: 6px; margin: 0 0 10px; }
.lbHead, .lbRow { display: flex; align-items: center; gap: 8px; padding: 4px 6px; font-size: 11px; }
.lbHead { color: #8d96ad; font-weight: bold; letter-spacing: 1px; font-size: 9px; }
.lbRow { background: #10141f; border-radius: 4px; margin-bottom: 3px; }
.lbRow.me { background: rgba(255,201,40,0.12); border: 1px solid rgba(255,201,40,0.4); }
.lbRow:nth-child(3) .lbRank { color: var(--gold); }
.lbRank { flex: 0 0 22px; color: #8d96ad; font-weight: bold; }
.lbName { flex: 1; font-weight: bold; }
.lbStat { flex: 0 0 52px; text-align: right; color: var(--gold); font-weight: bold; }
.lbStat.sm { flex: 0 0 44px; color: #b9c0d2; font-weight: normal; }
.lbEmpty { padding: 10px 6px; font-size: 11px; color: #8d96ad; }
.lbMe { margin-top: 8px; padding: 8px 10px; font-size: 10px; letter-spacing: 1px; color: var(--gold);
  background: #10141f; border-radius: 4px; border: 1px solid #2a3046; }
.lobbyActions { margin-top: 28px; display: flex; gap: 14px; justify-content: center; }
#playBtn { font-family: var(--display); font-size: 22px; letter-spacing: 4px; padding: 14px 56px; color: #0b0d14;
  background: var(--gold); border: none; border-radius: 8px; cursor: pointer;
  box-shadow: 0 5px 0 var(--gold-dark), 0 10px 24px rgba(0,0,0,0.5); transition: transform .07s, box-shadow .07s; }
#playBtn:hover { transform: translateY(2px); box-shadow: 0 3px 0 var(--gold-dark); }
#playBtn:active { transform: translateY(5px); box-shadow: 0 0 0 var(--gold-dark); }
.ghost { font-family: var(--display); font-size: 13px; letter-spacing: 2px; padding: 12px 22px; background: transparent;
  color: #8d96ad; border: 2px solid #2a3046; border-radius: 8px; cursor: pointer; }
.ghost:hover { color: #fff; border-color: #56618a; }
`;

/** Inject the v3-faithful lobby stylesheet once. */
export function injectLobbyStyles(): void {
  if (document.getElementById('lobby-styles')) return;
  const el = document.createElement('style');
  el.id = 'lobby-styles';
  el.textContent = CSS;
  document.head.append(el);
}
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run client/test/lobby-styles.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add client/src/lobby/styles.ts client/test/lobby-styles.test.ts
git commit -m "feat(client): pixel-faithful v3 lobby stylesheet (A2b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: YOUR BALLER creator (port of v3 creator.js)

**Files:** Create `client/src/lobby/creator.ts`; Test `client/test/lobby-creator.test.ts`.

> Port v3's `Creator` onto A2a's renderer. Swatches stay (skin/hairColor/jersey/trim/shoes); the only deviation is HAIR/BUILD/EXTRA as `<select>` dropdowns. Every change persists the sanitized character to `localStorage['rimverse-character']` (the key A2a's join reads). The generator is mocked in tests so the canvas preview doesn't need a real 2D context.

- [ ] **Step 1: Write the failing test** — create `client/test/lobby-creator.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/dunkchar/generator', async (orig) => ({
  ...(await orig() as object),
  renderPreview: vi.fn(() => document.createElement('canvas')),
}));

import { Creator, loadCharacter, persistCharacter } from '../src/lobby/creator';
import { DEFAULT_CHARACTER } from '../../shared/src/character';

beforeEach(() => localStorage.clear());

describe('loadCharacter / persistCharacter', () => {
  it('falls back to the default when storage is empty', () => {
    expect(loadCharacter()).toEqual(DEFAULT_CHARACTER);
  });
  it('round-trips a sanitized character', () => {
    persistCharacter({ ...DEFAULT_CHARACTER, skin: 4, jersey: '#2e6fe8' });
    expect(loadCharacter()).toMatchObject({ skin: 4, jersey: '#2e6fe8' });
  });
  it('sanitizes junk on load', () => {
    localStorage.setItem('rimverse-character', JSON.stringify({ skin: 99, jersey: 'nope' }));
    const c = loadCharacter();
    expect(c.skin).toBe(DEFAULT_CHARACTER.skin);
    expect(c.jersey).toBe(DEFAULT_CHARACTER.jersey);
  });
});

describe('Creator', () => {
  it('changing the HAIR select updates cfg + persists', () => {
    const mount = document.createElement('div');
    const creator = new Creator(mount);
    const hair = mount.querySelector('select[data-key="hair"]') as HTMLSelectElement;
    hair.value = '3';
    hair.dispatchEvent(new Event('change'));
    expect(creator.current().hair).toBe(3);
    expect(loadCharacter().hair).toBe(3);
    creator.destroy();
  });
  it('clicking a JERSEY swatch sets sel + persists the hex', () => {
    const mount = document.createElement('div');
    const creator = new Creator(mount);
    const sw = mount.querySelector('[data-key="jersey"][data-val="#2e6fe8"]') as HTMLButtonElement;
    sw.click();
    expect(creator.current().jersey).toBe('#2e6fe8');
    expect(sw.classList.contains('sel')).toBe(true);
    expect(loadCharacter().jersey).toBe('#2e6fe8');
    creator.destroy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run client/test/lobby-creator.test.ts` (FAIL: module missing).

- [ ] **Step 3: Implement** — create `client/src/lobby/creator.ts`:

```ts
import { Character, DEFAULT_CHARACTER, sanitizeCharacter } from '../../../shared/src/character';
import { renderPreview, SKINS, HAIR_COLORS, HAIR_STYLES, ACCESSORIES, BUILDS } from '../dunkchar/generator';

const CHAR_KEY = 'rimverse-character';
const JERSEY_COLORS = ['#e8432e', '#2e6fe8', '#1fa84a', '#f2b011', '#9b30c9', '#e85a9b', '#11b5b5', '#f06014', '#23282e', '#f5f0e0'];
const SHOE_COLORS = ['#f5f0e0', '#23282e', '#e8432e', '#2e6fe8', '#f2b011'];
const PREVIEW_ANIMS = [0, 1, 2, 6]; // idle, run, dribble, celebrate (v3 creator.js order)

export function loadCharacter(): Character {
  try {
    const raw = localStorage.getItem(CHAR_KEY);
    if (raw) return sanitizeCharacter(JSON.parse(raw));
  } catch { /* fall through to default */ }
  return { ...DEFAULT_CHARACTER };
}

export function persistCharacter(c: Character): void {
  localStorage.setItem(CHAR_KEY, JSON.stringify(sanitizeCharacter(c)));
}

function randomCharacter(): Character {
  const rand = (n: number) => Math.floor(Math.random() * n);
  const j = rand(JERSEY_COLORS.length);
  return sanitizeCharacter({
    skin: rand(SKINS.length),
    hair: rand(HAIR_STYLES.length),
    hairColor: rand(4),
    jersey: JERSEY_COLORS[j],
    jersey2: JERSEY_COLORS[(j + 5) % JERSEY_COLORS.length],
    shorts: JERSEY_COLORS[j],
    shoes: Math.random() < 0.5 ? '#f5f0e0' : '#23282e',
    number: rand(99) + 1,
    accessory: rand(ACCESSORIES.length),
    build: rand(BUILDS.length),
  });
}

/** Port of v3 public/js/creator.js — HAIR/BUILD/EXTRA are <select> dropdowns (the only deviation). */
export class Creator {
  private mount: HTMLElement;
  private cfg: Character;
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private previewAnim = 0;
  private previewFrame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(mount: HTMLElement) {
    this.mount = mount;
    this.cfg = loadCharacter();
    this.build();
    this.timer = setInterval(() => { this.previewFrame++; this.renderFrame(); }, 140);
  }

  current(): Character { return { ...this.cfg }; }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private setKey(key: keyof Character, val: number | string): void {
    (this.cfg as unknown as Record<string, unknown>)[key] = val;
    persistCharacter(this.cfg);
  }

  private swatchRow(label: string, key: keyof Character, colors: string[], indexed: boolean): string {
    const cells = colors.map((c, i) => {
      const val = indexed ? i : c;
      const sel = this.cfg[key] === val ? ' sel' : '';
      return `<button type="button" class="swatch${sel}" data-key="${key}" data-val="${val}" style="background:${c}"></button>`;
    }).join('');
    return `<div class="knobRow"><label>${label}</label><div class="swatches">${cells}</div></div>`;
  }

  private selectRow(label: string, key: keyof Character, options: string[]): string {
    const cur = Number(this.cfg[key]);
    const opts = options.map((o, i) => `<option value="${i}"${i === cur ? ' selected' : ''}>${o}</option>`).join('');
    return `<div class="knobRow"><label>${label}</label><select data-key="${key}">${opts}</select></div>`;
  }

  private build(): void {
    this.mount.innerHTML = `
      <div class="creator">
        <div class="previewBox">
          <canvas id="charPreview" width="192" height="256"></canvas>
          <div class="previewBtns">
            <button class="mini" id="prevAnimBtn">▶ POSE</button>
            <button class="mini" id="randomBtn">🎲 RANDOM</button>
          </div>
        </div>
        <div class="knobs">
          ${this.swatchRow('SKIN', 'skin', SKINS.map((s) => s[0]), true)}
          ${this.selectRow('HAIR', 'hair', HAIR_STYLES)}
          ${this.swatchRow('HAIR COLOR', 'hairColor', HAIR_COLORS, true)}
          ${this.swatchRow('JERSEY', 'jersey', JERSEY_COLORS, false)}
          ${this.swatchRow('TRIM', 'jersey2', JERSEY_COLORS, false)}
          ${this.swatchRow('SHOES', 'shoes', SHOE_COLORS, false)}
          ${this.selectRow('BUILD', 'build', BUILDS)}
          ${this.selectRow('EXTRA', 'accessory', ACCESSORIES)}
          <div class="knobRow"><label>NUMBER</label><input type="number" id="numInput" min="0" max="99" value="${this.cfg.number}"></div>
        </div>
      </div>`;
    this.canvas = this.mount.querySelector('#charPreview') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    this.bind();
    this.renderFrame();
  }

  private bind(): void {
    (this.mount.querySelector('#randomBtn') as HTMLElement).addEventListener('click', () => {
      this.cfg = randomCharacter();
      persistCharacter(this.cfg);
      this.build();
    });
    (this.mount.querySelector('#prevAnimBtn') as HTMLElement).addEventListener('click', () => {
      this.previewAnim = (this.previewAnim + 1) % PREVIEW_ANIMS.length;
      this.previewFrame = 0;
    });
    (this.mount.querySelector('#numInput') as HTMLElement).addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) || 0;
      this.setKey('number', Math.max(0, Math.min(99, v)));
    });
    for (const el of Array.from(this.mount.querySelectorAll<HTMLElement>('[data-key]'))) {
      const key = el.dataset.key as keyof Character;
      if (el.tagName === 'SELECT') {
        el.addEventListener('change', () => this.setKey(key, Number((el as HTMLSelectElement).value)));
      } else {
        el.addEventListener('click', () => {
          const raw = el.dataset.val as string;
          this.setKey(key, isNaN(Number(raw)) ? raw : Number(raw));
          for (const sib of Array.from(this.mount.querySelectorAll(`[data-key="${key}"]`))) sib.classList.remove('sel');
          el.classList.add('sel');
        });
      }
    }
  }

  private renderFrame(): void {
    if (!this.ctx) return;
    const anim = PREVIEW_ANIMS[this.previewAnim];
    const frame = renderPreview(this.cfg, anim, this.previewFrame, 2);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(frame, 0, 0);
  }
}
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run client/test/lobby-creator.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add client/src/lobby/creator.ts client/test/lobby-creator.test.ts
git commit -m "feat(client): YOUR BALLER creator port (dropdowns + live preview, A2b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Lobby shell + boot gate

**Files:** Create `client/src/lobby/lobby.ts`; Test `client/test/lobby-shell.test.ts`.

> Assemble the v3 skeleton, mount creator + courts + leaderboard, persist the name, wire net hooks to re-render ALL-TIME GREATS, and gate join behind PLAY. RESUME is present-but-inert.

- [ ] **Step 1: Write the failing test** — create `client/test/lobby-shell.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/dunkchar/generator', async (orig) => ({
  ...(await orig() as object),
  renderPreview: vi.fn(() => document.createElement('canvas')),
}));

import { Lobby } from '../src/lobby/lobby';
import type { Net } from '../src/net/net';

function fakeNet(): Net {
  return { career: null, onLeaderboard: null, onIdentity: null } as unknown as Net;
}

beforeEach(() => { document.body.innerHTML = ''; document.head.innerHTML = ''; localStorage.clear(); });

describe('Lobby', () => {
  it('PLAY persists the name, calls onPlay, then hides', () => {
    const net = fakeNet();
    const onPlay = vi.fn();
    new Lobby({ net, onPlay });
    (document.querySelector('#nameInput') as HTMLInputElement).value = 'Zee';
    (document.querySelector('#playBtn') as HTMLButtonElement).click();
    expect(onPlay).toHaveBeenCalledWith('Zee');
    expect(localStorage.getItem('rimverse-name')).toBe('Zee');
    expect(document.querySelector('#lobby')!.classList.contains('hidden')).toBe(true);
  });

  it('RESUME is inert (never calls onPlay)', () => {
    const net = fakeNet();
    const onPlay = vi.fn();
    new Lobby({ net, onPlay });
    (document.querySelector('#resumeBtn') as HTMLButtonElement).click();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('re-renders ALL-TIME GREATS when a leaderboard frame arrives', () => {
    const net = fakeNet();
    new Lobby({ net, onPlay: vi.fn() });
    net.onLeaderboard!([{ rank: 1, name: 'Ace', points: 50, dunks: 9, bestSession: 22, character: null }]);
    expect(document.querySelector('#leaderboardMount')!.innerHTML).toContain('Ace');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run client/test/lobby-shell.test.ts` (FAIL: module missing).

- [ ] **Step 3: Implement** — create `client/src/lobby/lobby.ts`:

```ts
import type { Net } from '../net/net';
import type { LeaderboardEntry } from '../../../shared/src/protocol';
import { injectLobbyStyles } from './styles';
import { Creator } from './creator';
import { renderCourtGrid } from './courts';
import { renderLeaderboard } from './leaderboard';

const NAME_KEY = 'rimverse-name';

export interface LobbyOptions {
  net: Net;
  onPlay: (name: string) => void;
}

export class Lobby {
  private net: Net;
  private onPlay: (name: string) => void;
  private root: HTMLElement;
  private creator: Creator;
  private nameInput: HTMLInputElement;
  private lbMount: HTMLElement;
  private entries: LeaderboardEntry[] = [];

  constructor(opts: LobbyOptions) {
    this.net = opts.net;
    this.onPlay = opts.onPlay;
    injectLobbyStyles();

    this.root = document.createElement('div');
    this.root.id = 'lobby';
    this.root.innerHTML = `
      <div class="lobbyInner">
        <h1>THE<br>DUNK<br>CONTEST</h1>
        <p class="tag">PICK YOUR PLAYER · PICK YOUR COURT · GET BUCKETS</p>
        <div class="lobbyCols">
          <div class="lobbyCol">
            <h2>YOUR BALLER</h2>
            <input id="nameInput" maxlength="16" placeholder="ENTER NAME" autocomplete="off">
            <div id="creatorMount"></div>
          </div>
          <div class="lobbyCol">
            <h2>WORLD TOUR</h2>
            <div id="courtGrid"></div>
            <div id="leaderboardMount"></div>
          </div>
        </div>
        <div class="lobbyActions">
          <button id="playBtn">▶ &nbsp;PLAY</button>
          <button id="resumeBtn" class="ghost">RESUME</button>
        </div>
      </div>`;
    document.body.append(this.root);

    this.nameInput = this.root.querySelector('#nameInput') as HTMLInputElement;
    this.nameInput.value = localStorage.getItem(NAME_KEY) ?? '';
    this.creator = new Creator(this.root.querySelector('#creatorMount') as HTMLElement);
    renderCourtGrid(this.root.querySelector('#courtGrid') as HTMLElement);
    this.lbMount = this.root.querySelector('#leaderboardMount') as HTMLElement;
    this.renderBoard();

    this.net.onLeaderboard = (e) => { this.entries = e; this.renderBoard(); };
    this.net.onIdentity = () => this.renderBoard();

    (this.root.querySelector('#playBtn') as HTMLButtonElement).addEventListener('click', () => this.play());
    // RESUME: present-but-inert (v3-faithful) — wired when an in-game lobby overlay exists.
    (this.root.querySelector('#resumeBtn') as HTMLButtonElement).addEventListener('click', () => { /* no-op */ });
  }

  private renderBoard(): void {
    renderLeaderboard(this.lbMount, this.entries, this.net.career);
  }

  private play(): void {
    const name = this.nameInput.value.trim() || 'Baller';
    localStorage.setItem(NAME_KEY, name);
    this.onPlay(name);
    this.hide();
  }

  show(): void { this.root.classList.remove('hidden'); this.renderBoard(); }
  hide(): void { this.root.classList.add('hidden'); }

  /** Stop the creator preview loop (call when permanently tearing the lobby down). */
  destroy(): void { this.creator.destroy(); }
}
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run client/test/lobby-shell.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add client/src/lobby/lobby.ts client/test/lobby-shell.test.ts
git commit -m "feat(client): lobby shell + PLAY boot gate (A2b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Bootstrap — mount the lobby, defer join to PLAY

**Files:** Modify `client/src/main.ts`.

> Wire it together. The lobby mounts over the idle scene; the input interval + `frame()` loop already early-return until `predictor`/`latest` exist, so the game boots the instant `welcome` arrives after PLAY. (`new Net()` + the removed `getLeaderboard` line were already applied in Task 3 to keep typecheck green.)

- [ ] **Step 1: Add the import** — at the top of `client/src/main.ts`, after the existing `import { GameScene } ...`/`import { ... radar }` lines, add:

```ts
import { Lobby } from './lobby/lobby';
```

- [ ] **Step 2: Confirm Task-3 edits are present** — `const net = new Net();` (no `'hooper'`), and `net.onWelcome` no longer calls `net.send({ t: 'getLeaderboard' })` (it should be just `predictor = new Predictor({ x, y });`). If either is missing, apply it now.

- [ ] **Step 3: Mount the lobby** — at the very end of `client/src/main.ts`, after `requestAnimationFrame(frame);`, add:

```ts
// The lobby gates the join: it mounts over the idle scene and joins the rimverse on PLAY.
new Lobby({ net, onPlay: (name) => net.join(name) });
```

- [ ] **Step 4: Run — expect PASS + typecheck** — `npm run typecheck` clean; `npm test` green (all suites). There is no unit test for `main.ts` (top-level module wiring); it is covered by `npm run typecheck` + the Task 10 visual gate.

- [ ] **Step 5: Commit**

```bash
git add client/src/main.ts
git commit -m "feat(client): mount the lobby and defer rimverse join to PLAY (A2b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Visual gate (controller-run) — pixel-faithful lobby + PLAY → rimverse

**Files:** none (manual verification + screenshots). This is a controller-run gate like A2a Task 6.

> Automated tests cover logic + structure; this gate confirms the *look* matches v3 and the end-to-end flow works. Run the dev server and drive the live page (see the project's preview note: the preview MCP is rooted at the v3 repo, so start V5 yourself and navigate the preview browser to `http://localhost:5173/`).

- [ ] **Step 1: Start V5** — `cd /Users/matthewlittlehale/Sites/thedunkcontest2 && npm run dev` (client :5173, server :8081). Open the page (navigate the preview browser to `http://localhost:5173/`).

- [ ] **Step 2: Lobby fidelity** — confirm against v3's lobby screenshot: the gold-on-ink palette, the "THE / DUNK / CONTEST" title with the red+black double-offset shadow (Arial Black), the two-column layout, the YOUR BALLER panel, and the `.lobbyActions` PLAY (chunky beveled gold) + RESUME (ghost). **Screenshot as proof.**

- [ ] **Step 3: Creator** — the live character preview **animates**; `▶ POSE` cycles idle/dribble/run/celebrate; `🎲 RANDOM` re-rolls; SKIN/HAIR COLOR/JERSEY/TRIM/SHOES swatches select (gold `sel` ring); **HAIR/BUILD/EXTRA are dropdowns** and change the preview; NUMBER updates. Reload the page → the character persists (localStorage). **Screenshot.**

- [ ] **Step 4: ALL-TIME GREATS** — the leaderboard shows real data pre-join (play a quick session first if the DB is empty, then reload the lobby): rank/name/PTS/DNK/STK columns + the `YOU — RANK…` row from your career. **Screenshot.**

- [ ] **Step 5: WORLD TOUR** — all 6 court cards render, visibly disabled ("PHASE B"). **Screenshot.**

- [ ] **Step 6: PLAY → rimverse** — enter a name, press PLAY: the lobby hides and the rimverse boots with your chosen character (jersey/trim → rig hue/accent, per A2a). Confirm via `window.__rim.latest.players` and a screenshot of the in-game sprite. **Screenshot as proof.**

- [ ] **Step 7: Commit any tuning** — if Steps 2–6 required CSS/markup nudges for fidelity, commit them:

```bash
git add -A
git commit -m "polish(client): A2b lobby visual-gate fidelity pass

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (done while writing — kept for the executor)

- **Spec coverage:** YOUR BALLER creator → Task 7; dropdowns for hair/build/extra → Task 7 (`selectRow`); live preview via `renderPreview` → Task 7 (`renderFrame`); ALL-TIME GREATS wired to A1 → Tasks 1 (server pre-join) + 3 (`onLeaderboard`) + 4 (render) + 8 (wire); reserved 6-card WORLD TOUR → Task 5; PLAY → rimverse + deferred join → Tasks 3 + 8 + 9; RESUME present-but-inert → Task 8; pixel-faithful CSS → Task 6; name persistence → Task 8; the small server change → Task 1; visual gate → Task 10. No spec requirement is unmapped.
- **Type consistency:** `Career` (defined in `net.ts`) is the param type for `leaderboardHTML`/`renderLeaderboard` (Task 4) and read via `net.career` (Task 8). `LeaderboardEntry` shape (`rank/name/points/dunks/bestSession/character`) is consistent across Tasks 1, 4, 8 and the protocol. `identityFor` returns `Extract<ServerMsg,{t:'identity'}>` and feeds both the connect-path and join-path sends. The creator's `localStorage['rimverse-character']` key matches `Net.character()` exactly. `Net` API (`join`, `requestLeaderboard`, `onIdentity`, `onLeaderboard`) is used consistently in Tasks 8–9.
- **Green commits / ordering:** Task 3 includes the two `main.ts` edits needed so `npm run typecheck` stays clean at that commit (Net's ctor signature changed). jsdom (Task 2) precedes the first jsdom test (Task 3). Each task is independently green.
- **No placeholders:** every code step contains complete, runnable code and exact commands.
- **Risk / BLOCKED:** Task 2's `npm install -D jsdom` is the one network step — if it fails, STOP and report (don't hand-edit the lockfile). The server change (Task 1) is read-only and preserves `join` semantics (the new `identityFor` matches the old inline send: a row always exists post-upsert in the join path, so rank stays numeric there; `null` only applies to the pre-join connect path for brand-new tokens).
