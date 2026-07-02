# A2b — Creator & Lobby — Design Spec

**Date:** 2026-06-13
**Status:** Approved (brainstorming) → ready for implementation plan
**Repo:** `thedunkcontest2` (TypeScript)
**Branch:** `a2b-creator-lobby` (off `main`)

> Second half of **Phase A2** (character model + creator). A2a was the **engine** (the 10-field
> `Character` model + a pixel-identical TS port of v3's big-head renderer + rimverse color derivation,
> all in `main`). **A2b is the UI**: port v3's lobby + character creator into the V5 client
> *pixel-faithful*, driven by A2a's `renderPreview`, and wire **ALL-TIME GREATS** to A1's real
> leaderboard. The lobby gates the (now-deferred) game join. Source to port:
> `~/Sites/thedunkcontest/public/{index.html,css/style.css,js/creator.js,js/main.js}` (v3 is frozen reference).

---

## 1. Goal & scope

Bring v3's **lobby screen** into V5 as a pixel-faithful entry gate in front of the rimverse. The screen is the v3 "THE DUNK CONTEST" lobby: a title, **YOUR BALLER** (name field + character creator with a live preview), **WORLD TOUR** (court picker), **ALL-TIME GREATS** (leaderboard), and **PLAY / RESUME**. The creator authors only the dunk-contest character; the rimverse appearance is already derived from it server-side (A2a). On PLAY the client persists the character + name and joins the rimverse.

**Decisions locked in brainstorming + this session (do not re-litigate):**
- **Pixel-faithful to v3.** Reproduce v3's exact layout, palette (gold `#ffc928` on ink `#0b0d14`), Arial-Black display font, and the red+black double-offset title shadow. The look is locked to v3-exact; it is a port, not a redesign.
- **The only deviation from v3's creator:** `HAIR`, `BUILD`, `EXTRA` render as **`<select>` dropdowns** (v3 used a forward-only `▸` cycler). All color fields stay **swatch grids** (v3-faithful); `NUMBER` stays a numeric input.
- **Build YOUR BALLER + ALL-TIME GREATS now**, wired to live data. **WORLD TOUR** renders all **6 court cards present-but-disabled** ("Phase B") so the full lobby layout is locked in and courts become clickable later with no redesign.
- **PLAY → rimverse** (eventually → a Dunk Contest room, Phase B). **RESUME** is a **present-but-inert** ghost button (v3-faithful: in v3 it only dismissed an in-game overlay, which V5 does not have yet).
- **Deferred join.** Today the client auto-joins on load (`new Net('hooper')`); A2b mounts the lobby first and joins only on PLAY.
- **Pre-join data needs a small server change** (decision this session): V5's WS server gates `getLeaderboard`/`identity` behind `sess.joined`, but the lobby shows them *before* join. The server will read the player's token from the WS connection and serve `identity` on connect + allow `getLeaderboard` pre-join — modeled on v3's `/api/leaderboard` + `/api/me/:token`, adapted to the WS transport. No `shared/` protocol-shape change (the `identity`/`leaderboard`/`getLeaderboard` messages already exist).

**Out of scope:** the Dunk Contest room/ruleset (Phase B); functional court selection + per-court scenes (Phase B); an in-game lobby overlay / ESC-to-lobby + a working RESUME (later); the wormhole/collapse (Phase C); any change to A2a's renderer or the `Character` model. A2b is **client UI + one contained server read-path**; no sim/`shared/`-protocol changes.

## 2. Architecture & units

The lobby is built the V5 way — **vanilla TS + imperative DOM** (the `preview/main.ts` pattern), no framework. CSS ships as one injected `<style>` string (the repo has no `.css` files; styling is inline by convention). The interactive/data logic is factored into **pure, node-testable functions**; DOM wiring is tested under jsdom; pixel fidelity + the live canvas preview are a controller-run visual gate.

### 2.1 `server/src/net.ts` (modify) — pre-join identity + leaderboard

Two new exported pure helpers (testable like `sanitizeIntent`/`flushSession`), then wire them into the connection handler:

```ts
/** Parse the stable token off the WS connection URL (e.g. ".../?token=abc"). Null if absent/blank. */
export function tokenFromReqUrl(url: string | undefined): string | null;

/** Build the identity message for a token from persisted career (zeros + null rank if unknown). */
export function identityFor(db: Db, token: string): Extract<ServerMsg, { t: 'identity' }>;
```

- `wss.on('connection', (ws, req) => …)` — read `tokenFromReqUrl(req.url)`; if present, `sess.token = token` and `send(ws, identityFor(db, token))` immediately (the lobby's "YOU — RANK…" data, available before join).
- `getLeaderboard` branch: drop the `&& sess.joined` guard — leaderboard is public read-only data the lobby needs pre-join. (`bots`/`intent` stay join-gated.)
- The existing `join` handler reuses `identityFor(db, token)` for its identity send (DRY; replaces the inline build). Join still owns spawning + character upsert.

### 2.2 `client/src/net/net.ts` (modify) — deferred join + lobby hooks

Restructure `Net` so connecting no longer auto-joins; the lobby drives join on PLAY and consumes pre-join data.

```ts
// pure, node-testable
export function wsUrlWithToken(base: string, token: string): string; // appends ?token= / &token=
export function joinMessage(name: string, token: string, character: object | null): ClientMsg;

class Net {
  career: Career | null;
  onWelcome:  ((id: string, x: number, y: number) => void) | null;
  onSnapshot: ((s: SnapshotMsg) => void) | null;
  onIdentity: ((c: Career) => void) | null;        // NEW — fires when identity arrives (pre-join now)
  onLeaderboard: ((e: LeaderboardEntry[]) => void) | null; // NEW — re-add the A2a-removed consumer
  constructor();                                    // NO name; connects with ?token=, does NOT join
  join(name: string): void;                         // sends join (+ localStorage character) on PLAY
  requestLeaderboard(limit?: number): void;
}
```

- Constructor: connect to `wsUrlWithToken(base, Net.token())`. On `open`, `requestLeaderboard()` (the lobby always wants it). **Do not** send `join`.
- `onmessage`: `identity` → set `this.career` + fire `onIdentity`; `leaderboard` → fire `onLeaderboard(msg.entries)` (was a bare `console.log`); `welcome`/`snapshot` unchanged.
- `join(name)`: `send(joinMessage(name, Net.token(), Net.character()))`. Server reads the same token from the connection, so identity/career stay consistent.

### 2.3 `client/src/lobby/styles.ts` (new) — pixel-faithful v3 CSS

`export function injectLobbyStyles(): void` appends a one-time `<style id="lobby-styles">` with v3's `public/css/style.css` rules verbatim for the lobby subtree (`:root` tokens, `#lobby` background, `h1` title + `.tag`, `.lobbyCols/.lobbyCol/h2`, `#nameInput`, `.creator/.previewBox/#charPreview/.previewBtns/.mini/.knobs/.knobRow/.swatches/.swatch/.cycle/#numInput`, `#courtGrid/.courtCard/.cFlag/.cName/.cLoc`, `.lbTitle/.lbHead/.lbRow/.lbRank/.lbName/.lbStat/.lbEmpty/.lbMe`, `.lobbyActions/#playBtn/.ghost`). One addition: `.knobRow select` styled to mirror `.cycle` (the dropdowns). One addition: `.courtCard[disabled]` (dimmed, `cursor: not-allowed`, a small "PHASE B" tag) for the reserved cards. v3's `box-sizing: border-box` reset is preserved, scoped to `#lobby *` (so panel sizing matches v3 and the reset doesn't leak into the game HUD); the `.lbRow.me` self-highlight + bronze top-rank rule (`.lbRow:nth-child(3) .lbRank`) are kept.

### 2.4 `client/src/lobby/courts.ts` (new) — reserved court roster

The 6 v3 courts as a local const (Phase B has no V5 court scenes yet), plus a disabled-grid renderer.

```ts
export interface CourtCard { id: string; name: string; location: string; flag: string; }
export const COURTS: CourtCard[]; // rucker/venice/tokyo/rio/paris/tundra — v3 names/locations/flags
export function renderCourtGrid(mount: HTMLElement): void; // 6 .courtCard buttons, all disabled
```

### 2.5 `client/src/lobby/leaderboard.ts` (new) — ALL-TIME GREATS

Pure HTML builder + thin mount, ported from v3 `renderLeaderboard`:

```ts
export function leaderboardHTML(entries: LeaderboardEntry[], career: Career | null): string;
export function renderLeaderboard(mount: HTMLElement, entries: LeaderboardEntry[], career: Career | null): void;
```

- `.lbTitle "ALL-TIME GREATS"`, `.lbHead` (`# / BALLER / PTS / DNK / STK`), one `.lbRow` per entry (`rank`, escaped `name`, `points`, `dunks`🏀, … ). **Adaptation:** v3's row showed `best_streak`🔥 for STK, but V5's `LeaderboardEntry` has no streak field (`{ rank, name, points, dunks, bestSession, character }`) — STK shows `bestSession`🔥 (best single-session score), the closest A1 stat. The `.lbMe` summary row uses `career` (`YOU — RANK {rank ?? '—'} · {points} PTS · {dunks} DUNKS · BEST {bestSession}`). Empty → `.lbEmpty "No legends yet. Be the first."`. `name` is HTML-escaped.

### 2.6 `client/src/lobby/creator.ts` (new) — YOUR BALLER creator (port of v3 `creator.js`)

A `Creator` class over a `mount`, driving A2a's renderer. Pure helpers extracted for tests; DOM + preview loop wrap them.

```ts
export function loadCharacter(): Character;          // localStorage['rimverse-character'] → sanitizeCharacter, else DEFAULT_CHARACTER
export function persistCharacter(c: Character): void; // writes sanitized JSON to localStorage['rimverse-character']
export class Creator {
  constructor(mount: HTMLElement);
  current(): Character;
  destroy(): void;                                   // clears the preview interval
}
```

- Controls in v3 order: `SKIN` (6 swatches, index), `HAIR` (**select**, `HAIR_STYLES`), `HAIR COLOR` (6 swatches, index), `JERSEY` (10 swatches, hex), `TRIM` (10 swatches, hex), `SHOES` (5 swatches, hex), `BUILD` (**select**, `BUILDS`), `EXTRA` (**select**, `ACCESSORIES`), `NUMBER` (numeric input 0–99). Swatch/jersey palettes + option labels come from the renderer's exports (`SKINS`, `HAIR_COLORS`, `HAIR_STYLES`, `ACCESSORIES`, `BUILDS`). `shorts` has no control (v3-faithful — set with `jersey` only by RANDOM).
- Preview: a persistent `#charPreview` canvas; an interval (~140 ms) calls `renderPreview(cfg, anim, frame, 2)` and `drawImage`s it in. `▶ POSE` cycles `[0,1,2,6]` (idle/run/dribble/celebrate, v3 order); `🎲 RANDOM` re-rolls (v3 `randomCfg`) and rebuilds.
- Every change calls `persistCharacter(cfg)` (sanitized via A2a's `sanitizeCharacter`) → `localStorage['rimverse-character']`, the exact key A2a's `Net.character()` reads on join.

### 2.7 `client/src/lobby/lobby.ts` (new) — the lobby shell + boot gate

```ts
export interface LobbyOptions { net: Net; onPlay: (name: string) => void; }
export class Lobby {
  constructor(opts: LobbyOptions);  // injects styles, builds DOM, mounts creator+courts+leaderboard
  hide(): void; show(): void;
}
```

- Builds the v3 skeleton: `#lobby > .lobbyInner > h1("THE DUNK CONTEST") + p.tag + .lobbyCols[ YOUR BALLER col (#nameInput + creator) | WORLD TOUR col (#courtGrid + leaderboard) ] + .lobbyActions[ #playBtn + #resumeBtn.ghost ]`. Appends `#lobby` to `document.body`.
- Name: pre-fill from `localStorage['rimverse-name']`; on PLAY write it back and pass to `onPlay`.
- Wires `net.onLeaderboard` + `net.onIdentity` to re-render ALL-TIME GREATS as data arrives.
- PLAY → persist name, `onPlay(name)`, `hide()`. RESUME (`.ghost`) → inert no-op (present for layout/fidelity).

### 2.8 `client/src/main.ts` (modify) — mount lobby, defer join to PLAY

`new Net()` (no name, no auto-join). Build the `Lobby` with `onPlay = (name) => { net.join(name); lobby.hide(); }`. The existing `net.onWelcome` (creates `Predictor`) now fires after PLAY; the input interval + `frame()` loop stay registered (they already early-return until `predictor`/`latest` exist), so the game boots the moment `welcome` arrives. Remove the `net.send({ t: 'getLeaderboard' })` from `onWelcome` (the lobby/Net owns leaderboard now).

## 3. Invariants & guardrails

- **`shared/` stays dependency-free and unchanged.** A2b touches the client and one server read-path; no protocol-shape, sim, or `shared/` edits. The `identity`/`leaderboard`/`getLeaderboard` messages already exist.
- **Server still decides everything.** The pre-join change only *reads* (identity/leaderboard from the DB by token); it grants no client-claimed outcomes. `bots`/`intent`/`join` stay join-gated; `join` remains the sole authority for spawning + character.
- **Pixel-faithful, not reinterpreted.** CSS is ported verbatim from v3; the only intentional visual deltas are the three dropdowns and the disabled court cards. The live preview is byte-faithful by construction (it calls A2a's already-golden `renderPreview`).
- **Character key contract.** The creator writes the sanitized 10-field `Character` to `localStorage['rimverse-character']`; A2a's join path consumes it unchanged.
- **No regressions:** the existing **144 tests** (29 files) stay green; `npm run typecheck` stays clean.
- **Deferred join is invisible to the sim.** Connecting without joining adds no `World` player; the arena is untouched until PLAY.

## 4. Testing

- `server/test/net.test.ts` (extend): `tokenFromReqUrl` parses `?token=`, returns `null` for absent/blank/garbage; `identityFor(openDb(':memory:'), token)` returns persisted `points/dunks/bestSession/sessions` + `playerRank`, and zeros + `rank: null` for an unknown token.
- `client/test/net.test.ts` (new, jsdom + a fake `WebSocket`): `wsUrlWithToken`/`joinMessage` pure cases; the ctor sends **no** `join` on open and **does** send `getLeaderboard`; `join(name)` sends a `join` carrying `localStorage['rimverse-character']`; an inbound `leaderboard`/`identity` frame fires `onLeaderboard`/`onIdentity` and sets `career`.
- `client/test/lobby-leaderboard.test.ts` (new, node): `leaderboardHTML` — rank/name/PTS/DNK/STK columns, the `.lbMe` "YOU — RANK…" row from `career`, the empty state, and HTML-escaping of `name`.
- `client/test/lobby-courts.test.ts` (new, node): `COURTS` has the 6 v3 ids in order; `renderCourtGrid` emits 6 `.courtCard` buttons, all `disabled` (jsdom for the render assertion).
- `client/test/lobby-creator.test.ts` (new, jsdom; `vi.mock` the generator to stub `renderPreview`/`generateSpriteSheet`, keep the real arrays): `loadCharacter` round-trips + falls back to `DEFAULT_CHARACTER`; changing the `HAIR` select updates cfg + writes `localStorage`; clicking a `JERSEY` swatch sets `.sel` + persists the hex; `current()` returns a sanitized `Character`.
- `client/test/lobby-shell.test.ts` (new, jsdom): PLAY calls `onPlay` with the name + persists `rimverse-name`; RESUME is inert; `net.onLeaderboard` re-renders ALL-TIME GREATS.

### Visual gate (controller-run, like A2a Task 6 — the crux for a UI port)
A side-by-side screenshot of the V5 lobby vs v3's lobby: title shadow, gold-on-ink palette, two-column layout, the creator with **working dropdowns** + a **live-animating** character preview, the 6 **disabled** court cards, and **ALL-TIME GREATS populated from real A1 data**. Then PLAY → the lobby fades and the rimverse boots with the chosen character. Screenshots as proof. Fidelity deltas that *improve* on v3 are allowed only where this spec calls them out (dropdowns, disabled courts); everything else matches.

## 5. File map

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
| `client/index.html` | (none required — lobby self-mounts; styles injected in TS) |
| `package.json` | Add `jsdom` devDep (for client DOM tests) |
| tests | `server/test/net.test.ts` (extend) + 5 new `client/test/lobby-*`/`net` specs; existing 144 stay green |

## 6. How this informs Phase B (forward-looking, do not build)

A2b leaves the lobby **laid out as the full v3 screen** so Phase B drops in without a redesign: the `WORLD TOUR` slot already renders the 6 cards (just `disabled`) — Phase B enables selection + per-court scenes and routes PLAY into a **Dunk Contest room** instead of straight to the rimverse. The `onPlay(name)` seam in `main.ts` is the single switch point for that re-route. The pre-join server read-path (`identityFor`/token-on-connect) generalizes to whatever pre-game data Phase B needs (room lists, court rosters) — the user has flagged that more v3 server behavior will be ported across as we go, so keep these reads small and DB-sourced. RESUME stays inert until the in-game lobby overlay (ESC-to-lobby) lands, at which point it gains v3's dismiss behavior.
