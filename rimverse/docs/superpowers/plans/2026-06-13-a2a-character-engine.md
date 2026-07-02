# A2a — Character Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring v3's real character into V5 — the 10-field model + a *pixel-identical* TS port of v3's big-head renderer — and derive the rimverse rig's color from it, wired through A1 persistence.

**Architecture:** Pure model/sanitize/derivation in dependency-free `shared/src/character.ts`; the canvas renderer ported 1:1 from `~/Sites/thedunkcontest/public/js/generator.js` into client-only `client/src/dunkchar/generator.ts` (it lives *beside* the rimverse rig — thedunkcontest layered on top of rimverse, not replacing it). The server derives the rimverse hue from the jersey at join. Faithfulness is proven by a **golden-pixel test**: render both v3's original `generator.js` and the port on one `@napi-rs/canvas` backend and assert byte-identical output.

**Tech Stack:** TS ESM monorepo, Vitest, `@napi-rs/canvas` (prebuilt skia canvas, no native build) for the fidelity test. Branch: `a2a-character-engine`. Spec: `docs/superpowers/specs/2026-06-13-a2a-character-engine-design.md`.

---

## Conventions
- Always `cd /Users/matthewlittlehale/Sites/thedunkcontest2` first (the shell's default cwd is the v3 repo). Single test: `npx vitest run <path>`. Full suite: `npm test`. Types: `npm run typecheck`.
- Commit messages follow repo style + the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- v3 source to port: `/Users/matthewlittlehale/Sites/thedunkcontest/public/js/generator.js` (read it; it's 364 lines) and the `sanitizeCharacter` clamps in `/Users/matthewlittlehale/Sites/thedunkcontest/src/roomManager.js`.

## File map
| File | Change |
|---|---|
| `shared/src/character.ts` | NEW — `Character` (10 fields), `DEFAULT_CHARACTER`, `sanitizeCharacter`, `deriveRimverseAppearance`, `hueOfHex` |
| `shared/src/types.ts` | re-export `Character` from `./character`; drop the `{hue}` placeholder |
| `shared/src/protocol.ts` | `join.character?`; `PlayerSnap.accentHue` |
| `server/src/net.ts` | derive rimverse hue/accent from character; default char for new; sanitize join character |
| `server/src/game/world.ts` | `PlayerEnt.accentHue` + init + emit in `snapshotFor` |
| `client/src/dunkchar/generator.ts` | NEW — pixel-identical port of v3 `generator.js` |
| `client/src/net/net.ts` | send stored character in `join` |
| `client/src/main.ts` | pass `accentHue` to the sprite |
| `client/src/sprites/playerSprite.ts` | consume `accentHue` (subtle render-time tint) |
| `client/src/preview/main.ts` | workbench: render the ported character (dev aid + A2b seed) |
| tests | `shared/test/character.test.ts`, `client/test/dunkchar-fidelity.test.ts`, `server/test` + `client/test/radar.test.ts` mock |

---

## Task 1: Character model + sanitize + rimverse derivation

**Files:** Create `shared/src/character.ts`; Modify `shared/src/types.ts`, `server/src/net.ts`; Test `shared/test/character.test.ts`.

> Widening `Character` from A1's `{hue}` to 10 fields breaks `net.ts` (it reads `career.character.hue`), so this task updates the server derivation in the same commit to stay green. `db.ts`/`protocol.ts` only pass `Character` around (no `.hue` access) — they compile unchanged.

- [ ] **Step 1: Write the failing test** — create `shared/test/character.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CHARACTER, sanitizeCharacter, deriveRimverseAppearance, hueOfHex } from '../src/character';

describe('sanitizeCharacter', () => {
  it('passes a valid character through unchanged', () => {
    expect(sanitizeCharacter(DEFAULT_CHARACTER)).toEqual(DEFAULT_CHARACTER);
  });
  it('clamps out-of-range indices and junk to defaults', () => {
    const c = sanitizeCharacter({ skin: 9, hair: -1, hairColor: 'x', jersey: 'nope', number: 500, accessory: 4, build: 2 });
    expect(c.skin).toBe(DEFAULT_CHARACTER.skin);   // 9 > 5 → default
    expect(c.hair).toBe(DEFAULT_CHARACTER.hair);   // -1 < 0 → default
    expect(c.hairColor).toBe(DEFAULT_CHARACTER.hairColor);
    expect(c.jersey).toBe(DEFAULT_CHARACTER.jersey); // bad hex → default
    expect(c.number).toBe(DEFAULT_CHARACTER.number); // 500 out of 0..99 → default
    expect(c.accessory).toBe(4); // in range, kept
    expect(c.build).toBe(2);
  });
  it('accepts a valid 6-digit hex and an in-range number', () => {
    const c = sanitizeCharacter({ ...DEFAULT_CHARACTER, jersey: '#1A2b3C', number: 7 });
    expect(c.jersey).toBe('#1A2b3C');
    expect(c.number).toBe(7);
  });
});

describe('hueOfHex + deriveRimverseAppearance', () => {
  it('maps primary colors to expected hues', () => {
    expect(hueOfHex('#ff0000')).toBe(0);
    expect(hueOfHex('#00ff00')).toBe(120);
    expect(hueOfHex('#0000ff')).toBe(240);
    expect(hueOfHex('bad')).toBe(0);
  });
  it('derives rimverse hue from jersey and accent from trim', () => {
    const a = deriveRimverseAppearance({ ...DEFAULT_CHARACTER, jersey: '#0000ff', jersey2: '#00ff00' });
    expect(a.hue).toBe(240);
    expect(a.accentHue).toBe(120);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** — `cd /Users/matthewlittlehale/Sites/thedunkcontest2 && npx vitest run shared/test/character.test.ts` → module not found.

- [ ] **Step 3: Implement `shared/src/character.ts`:**
```ts
/** v3 character model (cosmetics). Indices map into the renderer's arrays. */
export interface Character {
  skin: number;      // 0..5
  hair: number;      // 0..7
  hairColor: number; // 0..5
  jersey: string;    // #rrggbb
  jersey2: string;   // #rrggbb (trim)
  shorts: string;    // #rrggbb
  shoes: string;     // #rrggbb
  number: number;    // 0..99
  accessory: number; // 0..4
  build: number;     // 0..2
}

export const DEFAULT_CHARACTER: Character = {
  skin: 2, hair: 1, hairColor: 0, jersey: '#e8432e', jersey2: '#f5f0e0',
  shorts: '#e8432e', shoes: '#f5f0e0', number: 23, accessory: 0, build: 1,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
function intIn(v: unknown, min: number, max: number, def: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}
function hex(v: unknown, def: string): string {
  return typeof v === 'string' && HEX.test(v) ? v : def;
}

/** Clamp untrusted client cosmetics to known ranges (port of v3 roomManager.sanitizeCharacter). */
export function sanitizeCharacter(c: unknown): Character {
  const o = (c ?? {}) as Record<string, unknown>;
  const d = DEFAULT_CHARACTER;
  return {
    skin: intIn(o.skin, 0, 5, d.skin),
    hair: intIn(o.hair, 0, 7, d.hair),
    hairColor: intIn(o.hairColor, 0, 5, d.hairColor),
    jersey: hex(o.jersey, d.jersey),
    jersey2: hex(o.jersey2, d.jersey2),
    shorts: hex(o.shorts, d.shorts),
    shoes: hex(o.shoes, d.shoes),
    number: intIn(o.number, 0, 99, d.number),
    accessory: intIn(o.accessory, 0, 4, d.accessory),
    build: intIn(o.build, 0, 2, d.build),
  };
}

/** Hue (0..359) of a #rrggbb color; 0 for invalid/greyscale. Pure. */
export function hueOfHex(h: string): number {
  const m = HEX.exec(h);
  if (!m) return 0;
  const n = parseInt(m[0].slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return Math.round(hue) % 360;
}

/** The rimverse rig's colors, derived from the dunk-contest character ("soul"). */
export interface RimverseAppearance { hue: number; accentHue: number; }
export function deriveRimverseAppearance(c: Character): RimverseAppearance {
  return { hue: hueOfHex(c.jersey), accentHue: hueOfHex(c.jersey2) };
}
```

- [ ] **Step 4: Re-export from `types.ts` + update the server derivation (keep green).**
In `shared/src/types.ts`: remove the old `export interface Character { hue: number }` and add `export type { Character } from './character';`.
In `server/src/net.ts`:
- Add `import { DEFAULT_CHARACTER, deriveRimverseAppearance } from '../../shared/src/character';`.
- In `resolveIdentity`, replace the new-record creation `db.upsertIdentity(token, name, { hue: hueFromToken(token) });` with `db.upsertIdentity(token, name, DEFAULT_CHARACTER);`.
- In the join handler, replace `if (career.character) p.hue = career.character.hue;` with:
```ts
        const rim = deriveRimverseAppearance(career.character ?? DEFAULT_CHARACTER);
        p.hue = rim.hue;
```
- `hueFromToken` may now be unused — if so, remove it and its test in `server/test/identity.test.ts` (delete the `hueFromToken` describe block and the `expect(first.character).toEqual({ hue: hueFromToken('tok') })` assertion → change that assertion in `resolveIdentity`'s test to `expect(first.character).toEqual(DEFAULT_CHARACTER)`).

- [ ] **Step 5: Run — expect PASS + typecheck** — `npx vitest run shared/test/character.test.ts server/test/identity.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 6: Commit**
```bash
git add shared/src/character.ts shared/src/types.ts server/src/net.ts server/test/identity.test.ts shared/test/character.test.ts
git commit -m "feat(shared): v3 character model + sanitize + rimverse color derivation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: accentHue through the snapshot (trim → rig accent)

**Files:** `shared/src/protocol.ts`, `server/src/game/world.ts`, `server/src/net.ts`, `client/src/main.ts`, `client/src/sprites/playerSprite.ts`, `client/test/radar.test.ts`; Test `server/test/world.test.ts`.

> Adding a required `accentHue` to `PlayerSnap` is atomic (like A1's `z`): emit it server-side, read it client-side, fix the one mock — all in one commit.

- [ ] **Step 1: Write the failing test** — add to `server/test/world.test.ts`:
```ts
it('snapshot carries accentHue (rig trim accent)', () => {
  const w = new World();
  const p = w.addPlayer('p1', 'one');
  w.step();
  expect(w.snapshotFor('p1').players[0].accentHue).toBe(0);
  p.accentHue = 200;
  expect(w.snapshotFor('p1').players[0].accentHue).toBeCloseTo(200);
});
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run server/test/world.test.ts` (accentHue undefined).

- [ ] **Step 3: Implement.**
- `shared/src/protocol.ts` `PlayerSnap`: add `accentHue: number;` after `hue: number;` — wait, `hue` is on `PlayerSnap`? It is. Add `accentHue: number;` right after the existing `hue` field.
- `server/src/game/world.ts`: add `accentHue: number;` to `PlayerEnt` (after `hue`); init `accentHue: 0,` in `addPlayer`; in `snapshotFor`'s player map add `accentHue: p.accentHue,` after `hue: p.hue,`.
- `server/src/net.ts`: in the join handler where you set `p.hue = rim.hue;` (Task 1), also set `p.accentHue = rim.accentHue;`.
- `client/src/main.ts`: the sprite update path — pass `accentHue` through (see Step 4 of playerSprite). Where `upsertPlayer`/sprite update is called, thread `snapP.accentHue` (remote) and `me?.accentHue ?? 0` (local). (Mirror how `hue` is passed today.)
- `client/src/sprites/playerSprite.ts`: accept an `accentHue` and apply a **subtle** render-time tint (e.g. the billboard's outline/glow). Keep it minimal; if it muddies the look at the gate (Task 6), reduce or drop. Do NOT change the baked atlas (no new cache key).
- `client/test/radar.test.ts`: add `accentHue: 0` to the `player()` mock factory (the only `PlayerSnap` literal).

- [ ] **Step 4: Run — expect PASS + typecheck** — `npx vitest run server/test/world.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**
```bash
git add shared/src/protocol.ts server/src/game/world.ts server/src/net.ts client/src/main.ts client/src/sprites/playerSprite.ts client/test/radar.test.ts server/test/world.test.ts
git commit -m "feat: carry accentHue (trim) through the snapshot to the rig

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: join carries the character (client → server)

**Files:** `shared/src/protocol.ts`, `server/src/net.ts`, `client/src/net/net.ts`; Test `server/test/` (new `server/test/character-join.test.ts` or extend `identity.test.ts`).

- [ ] **Step 1: Write the failing test** — create `server/test/character-join.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db';
import { resolveIdentity } from '../src/net';
import { sanitizeCharacter, deriveRimverseAppearance } from '../../shared/src/character';

describe('join character resolution', () => {
  it('a sent character is sanitized, stored, and drives the rimverse hue', () => {
    const db = openDb(':memory:');
    // simulate the join handler's resolution: sent character wins over default
    const sent = { skin: 3, hair: 2, hairColor: 1, jersey: '#0000ff', jersey2: '#00ff00', shorts: '#222222', shoes: '#ffffff', number: 7, accessory: 1, build: 2 };
    const clean = sanitizeCharacter(sent);
    db.upsertIdentity('tok', 'Ada', clean);
    expect(resolveIdentity(db, 'tok', 'Ada').character).toEqual(clean);
    expect(deriveRimverseAppearance(clean).hue).toBe(240); // blue jersey
    db.close();
  });
});
```
(The handler wiring itself is exercised live in Task 6; this test pins the resolution logic the handler uses.)

- [ ] **Step 2: Run — expect FAIL** — module/behavior not present.

- [ ] **Step 3: Implement.**
- `shared/src/protocol.ts`: `join` → `{ t: 'join'; name: string; token?: string; character?: Character }` (import `Character` from `./types`). Additive/optional → non-breaking.
- `server/src/net.ts` join handler: after resolving `token`/`name`, resolve the character so a sent one updates the stored record:
```ts
        const stored = db.loadPlayer(token);
        const character = (msg as { character?: unknown }).character
          ? sanitizeCharacter((msg as { character?: unknown }).character)
          : (stored?.character ?? DEFAULT_CHARACTER);
        db.upsertIdentity(token, name, character);
        const p = world.addPlayer(id, name);
        const rim = deriveRimverseAppearance(character);
        p.hue = rim.hue; p.accentHue = rim.accentHue;
```
(import `sanitizeCharacter` from `../../shared/src/character`. This replaces the Task-1 `resolveIdentity`-based hue set in the handler; `resolveIdentity` stays for the no-character path / identity load + the `identity` message still uses `db.loadPlayer`/`playerRank` for career stats. Keep sending `welcome` then `identity` as before.)
- `client/src/net/net.ts`: read `localStorage['rimverse-character']` (JSON, parsed defensively) and include as `character` in the `join` send. If absent/invalid, omit it (server defaults). Add a static `Net.character()` helper mirroring `Net.token()`.

- [ ] **Step 4: Run — expect PASS + typecheck + full suite** — green.

- [ ] **Step 5: Commit**
```bash
git add shared/src/protocol.ts server/src/net.ts client/src/net/net.ts server/test/character-join.test.ts
git commit -m "feat: join carries the character; server sanitizes + derives rig color

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Golden-pixel fidelity harness (RED — drives the port)

**Files:** `client/package.json` (dev-dep `@napi-rs/canvas`); Create `client/test/fixtures/v3-generator.js` (verbatim copy of v3's `generator.js`); Create `client/test/dunkchar-fidelity.test.ts`.

> TDD for the port: capture v3's *actual* output as the reference, then (Task 5) port until byte-identical. Both renderers run on the SAME `@napi-rs/canvas` backend, so any pixel difference is a *code* difference — proving line-level fidelity.

- [ ] **Step 1: Add the canvas backend** — `cd /Users/matthewlittlehale/Sites/thedunkcontest2 && npm install -D @napi-rs/canvas -w client`. (Prebuilt skia binary — no system libs. If it fails to install, STOP and report BLOCKED; fallback is a headless-browser pixel gate, but try napi first.)

- [ ] **Step 2: Copy v3's renderer as the golden reference** — copy `/Users/matthewlittlehale/Sites/thedunkcontest/public/js/generator.js` verbatim to `client/test/fixtures/v3-generator.js` (unchanged — it stays the source of truth for the comparison).

- [ ] **Step 3: Write the fidelity test** — `client/test/dunkchar-fidelity.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';

// Shim the one browser API both renderers use: document.createElement('canvas').
beforeAll(() => {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error('only canvas supported in shim');
      return createCanvas(1, 1); // width/height set by the renderers
    },
  };
});

// representative matrix: defaults + every enum value + sample colors, all anims
const SAMPLES = [
  {}, // default
  { skin: 0, hair: 0, hairColor: 0, accessory: 0, build: 0, jersey: '#0000ff', jersey2: '#00ff00', shorts: '#123456', shoes: '#abcdef', number: 0 },
  { skin: 5, hair: 7, hairColor: 5, accessory: 4, build: 2, jersey: '#ffcc00', jersey2: '#101010', shorts: '#fefefe', shoes: '#222', number: 99 },
  { skin: 3, hair: 3, hairColor: 2, accessory: 2, build: 1, number: 8 }, // afro + goggles
  { skin: 1, hair: 6, hairColor: 4, accessory: 3, build: 0, number: 42 }, // cornrows + wristband
];

async function sheetBytes(mod: any, character: any): Promise<Uint8ClampedArray> {
  const { canvas } = mod.generateSpriteSheet(character);
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data as Uint8ClampedArray;
}

describe('dunkchar port is byte-identical to v3 generator.js', () => {
  it('matches v3 across the character matrix', async () => {
    const v3 = await import('./fixtures/v3-generator.js');
    const port = await import('../src/dunkchar/generator');
    for (const s of SAMPLES) {
      const a = await sheetBytes(v3, s);
      const b = await sheetBytes(port, s);
      expect(b.length).toBe(a.length);
      // exact byte compare (pixel-art, smoothing off, bitmap digits → no tolerance)
      let firstDiff = -1;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { firstDiff = i; break; }
      expect(firstDiff, `character ${JSON.stringify(s)} differs at byte ${firstDiff}`).toBe(-1);
    }
  });
});
```

- [ ] **Step 4: Run — expect FAIL** — `npx vitest run client/test/dunkchar-fidelity.test.ts` → FAIL importing `../src/dunkchar/generator` (not ported yet). (If `@napi-rs/canvas` import or the v3 fixture import errors instead, fix the harness first — it must fail only on the missing port.)

- [ ] **Step 5: Commit the harness**
```bash
git add client/package.json package-lock.json client/test/fixtures/v3-generator.js client/test/dunkchar-fidelity.test.ts
git commit -m "test(client): golden-pixel fidelity harness vs v3 generator.js (RED)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Port v3's renderer → `client/src/dunkchar/generator.ts` (GREEN)

**Files:** Create `client/src/dunkchar/generator.ts`. Driven by Task 4's golden test + structural review.

- [ ] **Step 1: Port faithfully.** READ `/Users/matthewlittlehale/Sites/thedunkcontest/public/js/generator.js` and translate it to TypeScript **1:1** in `client/src/dunkchar/generator.ts`:
  - Keep the SAME structure, function order, and names: `SHEET`, `SKINS`, `HAIR_COLORS`, `HAIR_STYLES`, `ACCESSORIES`, `BUILDS`, `ANIMATIONS`, `generateSpriteSheet`, `renderPreview`, `withDefaults`, `idleFrames`…`celebrateFrames`, `drawFigure`, class `Grid`, `DIGITS`, `rad`, `shade`.
  - Preserve EVERY numeric constant and pose-table value exactly (the golden test enforces this).
  - Keep `document.createElement('canvas')` calls as-is (the test shims `document`; the browser provides it). Do NOT change rendering math, offsets, colors, or order.
  - Add TS types: `export interface Character` is already in `shared/src/character.ts` — import it; type `generateSpriteSheet(character: Partial<Character>)`, `withDefaults` → `Character`, pose objects as a local `Pose` type, `Grid` methods typed against `CanvasRenderingContext2D`. Export `SHEET`, `SKINS`, `HAIR_STYLES`, `HAIR_COLORS`, `ACCESSORIES`, `BUILDS`, `ANIMATIONS`, `generateSpriteSheet`, `renderPreview`, `shade` (A2b + the workbench import these).
  - It is a client-only module (canvas). It must import cleanly in Node without touching `document` at module top-level (v3's file already only uses `document` inside functions — keep that).

- [ ] **Step 2: Run the golden test — iterate to GREEN.** `npx vitest run client/test/dunkchar-fidelity.test.ts`. If any sample differs, the report names the character + first differing byte — diff your port against `generator.js` at the corresponding function and fix the translation. Repeat until **all samples byte-identical**.

- [ ] **Step 3: Add pure unit tests** — `client/test/dunkchar.test.ts` (no canvas needed):
```ts
import { describe, it, expect } from 'vitest';
import { SHEET, ANIMATIONS, HAIR_STYLES, BUILDS, ACCESSORIES, shade } from '../src/dunkchar/generator';
describe('dunkchar constants', () => {
  it('sheet + anim table match v3', () => {
    expect(SHEET).toEqual({ frameW: 96, frameH: 128, cols: 6, rows: 7 });
    expect(Object.keys(ANIMATIONS).length).toBe(7);
    expect(HAIR_STYLES.length).toBe(8);
    expect(BUILDS.length).toBe(3);
    expect(ACCESSORIES.length).toBe(5);
  });
  it('shade scales an rgb hex toward/away from full', () => {
    expect(shade('#808080', 2)).toBe('rgb(255,255,255)'); // clamped
    expect(shade('#804020', 0.5)).toBe('rgb(64,32,16)');
  });
});
```

- [ ] **Step 4: Run all + typecheck** — `npx vitest run client/test/dunkchar.test.ts client/test/dunkchar-fidelity.test.ts` PASS; `npm run typecheck` clean; `npm test` green.

- [ ] **Step 5: Commit**
```bash
git add client/src/dunkchar/generator.ts client/test/dunkchar.test.ts
git commit -m "feat(client): pixel-identical TS port of v3 big-head renderer

Verified byte-identical to v3 generator.js across the character matrix.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Workbench preview + live rimverse color gate

**Files:** `client/src/preview/main.ts` (+ `client/preview.html` if needed). Controller-run visual gate (like prior phases) — no new sim code expected.

- [ ] **Step 1: Add a Dunk Contest character section to the workbench.** In `client/src/preview/main.ts`, render the ported character (`renderPreview` and/or `generateSpriteSheet` from `../dunkchar/generator`) for the default + a couple sample characters, drawn to canvases on the page. This is a dev aid and the seed for A2b's creator preview.

- [ ] **Step 2: Visual fidelity check (browser).** `npm run dev`; open the workbench (`/preview.html`) — navigate the preview browser there (preview MCP is rooted at v3; use `window.location.href='http://localhost:5173/preview.html'`). Compare the rendered big-head character to v3's actual lobby render (run v3, or recall the reference screenshot) — confirm it reads identically. The golden test already guarantees byte-equality; this is the human confirmation. Screenshot.

- [ ] **Step 3: Live rimverse color gate.** In the live game, set a character with a known jersey (e.g. via `localStorage['rimverse-character'] = JSON.stringify({...DEFAULT, jersey:'#2d5fd1'})` then reload), confirm the rimverse rig is now blue-tinted (and red jersey → red), and that the rig is otherwise visually unchanged. If the `accentHue` tint (Task 2) muddies the look, reduce/remove it here and re-commit. Screenshots (blue vs red) as proof.

- [ ] **Step 4: Full suite + typecheck green; commit any workbench/tuning code.**
```bash
git add -A
git commit -m "feat(client): workbench character preview + rimverse color gate (A2a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (done while writing — kept for the executor)
- **Spec coverage:** model+sanitize+derive → T1; accent → T2; join character → T3; faithful port (golden-pixel) → T4+T5; line-for-line correspondence → T5 step 1 + review; workbench + live color → T6. v3-translation = identity (model IS v3's) — noted in spec, no separate task.
- **Type consistency:** `Character` (10 fields, shared) used by sanitize/derive/db/protocol/join; `RimverseAppearance{hue,accentHue}` → `p.hue/p.accentHue` → `PlayerSnap.hue/accentHue` → client sprite. `generateSpriteSheet`/`renderPreview`/`shade`/`SHEET`/`ANIMATIONS` names match v3 + the workbench/fidelity imports.
- **Green commits:** Character widening + server derivation land together (T1); `accentHue` is atomic (T2); `join.character` is optional/additive (T3). No red intermediate states.
- **No placeholders:** new code is complete; the port (T5) translates a specific named source file with the golden test as the exact correctness oracle — not a stub.
- **Risk:** `@napi-rs/canvas` install (T4 step 1) — prebuilt, low risk; BLOCKED-and-report if it fails (fallback: headless-browser pixel gate + structural review).
