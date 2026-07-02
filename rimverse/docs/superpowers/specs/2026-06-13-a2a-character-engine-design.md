# A2a — Character Engine — Design Spec

**Date:** 2026-06-13
**Status:** Approved (brainstorming) → ready for implementation plan
**Repo:** `thedunkcontest2` (TypeScript)
**Branch:** `a2a-character-engine` (off `main`)

> First half of **Phase A2** (character model + creator). A2a is the **engine**: port v3's character
> model + big-head renderer to TS *pixel-identical*, derive the rimverse rig's color from the
> character, and wire it through A1 persistence. **A2b** (the creator/lobby UI) is a separate spec and
> consumes this. Source to port: `~/Sites/thedunkcontest/public/js/generator.js` + the
> `sanitizeCharacter` clamps in `~/Sites/thedunkcontest/src/roomManager.js`.

---

## 1. Goal & scope

Give V5 the real v3 character: the same 10-knob model and the **exact same big-head pixel-art look**,
ported to TS. The only rimverse change is **color influence** — the neon rig picks up the character's
colors. No creator UI (A2b), no Dunk Contest dimension (Phase B).

**Decisions locked in brainstorming (do not re-litigate):**
- **Dunk Contest character look = v3 exactly.** Port `generator.js` pixel-identical; change nothing about the art.
- **Rimverse rig look unchanged except color:** primary **hue from the jersey** (this alone needs *zero* rig-art change — the rig already colors from `hue`), plus a subtle **accent from the trim** (`jersey2`).
- **Full v3 10-field model;** v3 characters map 1:1 (translation is identity).
- **A2 is a faithful PORT, not a redesign.** A2a = engine; A2b = creator/lobby UI (with hair/build/extra as dropdowns; lobby laid out to grow into v3's full lobby with a reserved WORLD TOUR courts slot).
- **Arc flow (context, not built here):** the Dunk Contest is the *starting point*; the rimverse is the *destination* (via the collapse). Today the rimverse is the only built dimension, so the eventual PLAY→Dunk-Contest wiring is A2b/Phase B.

**Out of scope:** the creator/lobby UI (A2b); the Dunk Contest dimension + WORLD TOUR courts (Phase B); integrating the big-head renderer into a live playable dimension (Phase B); v3 DB data migration (Phase E).

---

## 2. Architecture & units

### 2.1 `shared/src/character.ts` (new) — model + pure helpers (dependency-free)
Replaces the A1 placeholder `Character = { hue }` with v3's real model. Pure (no canvas/deps), so the
server and tests can use it.

```ts
export interface Character {
  skin: number;      // 0..5 index into SKINS
  hair: number;      // 0..7 index into HAIR_STYLES
  hairColor: number; // 0..5 index into HAIR_COLORS
  jersey: string;    // hex
  jersey2: string;   // hex (trim)
  shorts: string;    // hex
  shoes: string;     // hex
  number: number;    // 0..99
  accessory: number; // 0..4
  build: number;     // 0..2
}

export const DEFAULT_CHARACTER: Character = {
  skin: 2, hair: 1, hairColor: 0, jersey: '#e8432e', jersey2: '#f5f0e0',
  shorts: '#e8432e', shoes: '#f5f0e0', number: 23, accessory: 0, build: 1,
};

/** Clamp untrusted client cosmetics to known ranges (port of v3 roomManager.sanitizeCharacter). */
export function sanitizeCharacter(c: unknown): Character { /* num()/hex() clamps per ranges above */ }

/** Rimverse "soul": the rig's colors, derived from the dunk-contest character. */
export interface RimverseAppearance { hue: number; accentHue: number; }
export function deriveRimverseAppearance(c: Character): RimverseAppearance {
  return { hue: hueOfHex(c.jersey), accentHue: hueOfHex(c.jersey2) };
}
// hueOfHex(hex): parse #rrggbb → HSL hue 0..359 (pure).
```
`shared/src/types.ts` re-exports `Character` from here so A1's existing `import { Character } from './types'` sites (db.ts, protocol.ts) keep working. The `hue` field is **removed** from `Character` (it was the A1 placeholder); the rimverse hue is now *derived*, not stored.

### 2.2 `client/src/dunkchar/generator.ts` (new) — the ported v3 renderer (client-only)
A **pixel-identical TS port** of `~/Sites/thedunkcontest/public/js/generator.js`:
- Constants: `SHEET = {frameW:96, frameH:128, cols:6, rows:7}`, `SKINS`, `HAIR_COLORS`, `HAIR_STYLES`, `ACCESSORIES`, `BUILDS`, `ANIMATIONS` (0 idle/1 run/2 dribble/3 jump/4 shoot/5 dunk/6 celebrate).
- Pose tables (`idleFrames`/`runFrames`/`dribbleFrames`/`jumpFrames`/`shootFrames`/`dunkFrames`/`celebrateFrames`) — pure data, portable + unit-testable.
- `drawFigure(ctx, cfg, pose)` — the big-head fat-pixel rig (canvas).
- `generateSpriteSheet(character)` → `{ canvas, animations, cfg }` (full 7×6 sheet — for Phase B's dimension + atlas).
- `renderPreview(character, animCode, frame, scale)` → `canvas` (single frame — for A2b's creator preview).
- `withDefaults(c)` → fill missing fields from `DEFAULT_CHARACTER`.

This module is **canvas-based and client-only**. A2a builds + verifies it; A2b uses `renderPreview`; Phase B uses `generateSpriteSheet`. It lives **separately from the rimverse rig** (`client/src/sprites/`) — two distinct aesthetics, side by side.

### 2.3 Rimverse rig color (the only rimverse change)
- **Primary (zero rig-art change):** the server sets the entity's `hue` from `deriveRimverseAppearance(character).hue` instead of the token hash. The rig already colors from `hue`, so it now reflects the jersey automatically.
- **Accent (subtle):** add `accentHue` to `PlayerSnap` + a render-time tint in `client/src/sprites/playerSprite.ts` (e.g. the head-glow/outline) — applied at render, **not baked into the atlas** (the hue-bucket atlas cache is unchanged). Final use tuned at the visual gate; **dropped if it harms the look** ("don't change their look except to reflect color").

### 2.4 Server (`server/src/net.ts`)
- `join` gains `character?: Character` (protocol). On join: `const char = msg.character ? sanitizeCharacter(msg.character) : (stored?.character ?? DEFAULT_CHARACTER); db.upsertIdentity(token, name, char);` — a sent character (the creator's output, A2b) updates the stored one; otherwise use stored/default.
- Replace the token-hash hue: `const rim = deriveRimverseAppearance(char); p.hue = rim.hue; p.accentHue = rim.accentHue;`. `hueFromToken` is removed (or kept only as an unused fallback — prefer removing).
- `resolveIdentity` creates new records with `DEFAULT_CHARACTER` (not `{hue}`).

### 2.5 Client (`client/src/net/net.ts`)
- Read `localStorage['rimverse-character']` (JSON) and include it as `character` in `join`. For A2a (no creator yet) this is absent → server uses the default; A2b's creator writes it.
- The rig consumes `accentHue` from the snapshot (subtle tint).

### 2.6 Protocol (`shared/src/protocol.ts`)
- `join` → `{ t:'join'; name: string; token?: string; character?: Character }`.
- `PlayerSnap` → add `accentHue: number`.
- `LeaderboardEntry.character` / `identity` already carry `Character` (A1) — now the 10-field shape; no message-shape change beyond `accentHue`.

---

## 3. Invariants & guardrails
- **Integration pattern — thedunkcontest ON TOP of rimverse.** We layer the v3 game (its character, renderer, and later its rooms/rules) as an *additive layer atop the rimverse engine* — never fork or bury the rimverse beneath thedunkcontest. The big-head renderer lives beside the rimverse rig (two aesthetics coexisting); the rimverse substrate (sim, netcode, rig) is untouched except for the additive color-derivation. Keep this pattern for the whole unification.
- **Faithful, code-level port (not just visual):** the TS port must reproduce v3's renderer faithfully, proven at the **code + output** level, not eyeballing. Two mechanisms (see §4): a **structural line-for-line correspondence** (same functions, order, constants as `generator.js` — a side-by-side diff confirms it) and a **golden-pixel test** asserting the port's rendered output is **byte-identical** to v3's actual output. No art changes.
- **Rimverse look preserved:** only color is influenced. If the accent muddies it, ship primary-hue-only.
- **`shared/` stays dependency-free:** `character.ts` is pure (clamps + hex→hue math). The canvas renderer lives in `client/` only.
- **Server authority unchanged:** the character is client-supplied cosmetics, always `sanitizeCharacter`d at the boundary (exactly v3's posture). No gameplay/stat trust.
- **Deterministic sim untouched:** color derivation happens at join, not in the tick.
- **No regressions:** existing 135 tests stay green; the rimverse plays identically except rigs are now jersey-colored.

---

## 4. Testing
- **`shared/test/character.test.ts`:** `sanitizeCharacter` clamps each field to its range + coerces junk to defaults (skin>5→default, bad hex→default, number 0..99, etc.); `DEFAULT_CHARACTER` passes sanitize unchanged; `deriveRimverseAppearance` — `hueOfHex` maps known hexes to expected hues (red #e8432e→~9°, blue→~220°), jersey→hue and trim→accentHue.
- **`client/test/dunkchar.test.ts`:** pure pieces only (no canvas in node) — pose tables return the expected frame counts per anim (idle 4, run 6, …) matching `ANIMATIONS`; `withDefaults` fills missing fields; `SHEET`/constants present. (Canvas rendering is covered by the visual gate.)
- **`server/test`:** join with a character → sanitized + stored + `p.hue` = jersey-derived (not token hash); join without → `DEFAULT_CHARACTER`; returning player keeps stored character.
### Faithful-port verification (the crux — code-level, per the guardrail)
v3 ships **no** renderer/sanitize unit tests (only `db`/`room`), so fidelity is proven by porting what *is*
relevant plus two stronger, code-level checks:
1. **Structural line-for-line correspondence.** Port `generator.ts` to mirror `generator.js`
   function-for-function, in the same order, with identical constants (`SHEET`, `SKINS`, `HAIR_*`,
   `ACCESSORIES`, `BUILDS`, `ANIMATIONS`) and identical pose-table numbers. A side-by-side diff against
   `generator.js` must read as a 1:1 translation (reviewer-verified). Pure pieces (pose tables, `withDefaults`,
   `sanitizeCharacter`, `hueOfHex`) get direct unit tests.
2. **Golden-pixel fidelity test (`client/test/dunkchar-fidelity.test.ts`).** Render a representative
   character matrix — every `skin`(6) / `hair`(8) / `hairColor`(6) / `accessory`(5) / `build`(3) value,
   sample jersey/trim/shorts/shoes colors, across all 7 anims × their frames — with the TS port and assert
   the output is **byte-identical** to v3's actual render. Mechanism (plan picks one): run both on a shared
   Canvas2D backend (`node-canvas` dev-dep) — the original `generator.js` copied to `client/test/fixtures/`
   as the golden reference, behind a tiny `document.createElement('canvas')`→`node-canvas` shim — and compare
   `getImageData` bytes; OR compare against PNG fixtures captured once from v3. Pixel-art with
   `imageSmoothingEnabled=false` and **bitmap digits** (v3's `digit()`, no font rendering) → an exact match is
   expected, not a tolerance.
3. **Port applicable v3 tests.** v3's `db.test.js` character-persistence assertions were already ported in
   A1; there are no renderer tests to bring over — checks (1)+(2) carry the fidelity guarantee.
4. **Live rimverse color gate.** A blue-jersey character yields a blue rimverse rig, red→red; the rig is
   otherwise visually unchanged. Screenshot as proof. (Also add the workbench preview section from §2.2 as a
   dev aid + A2b seed.)

---

## 5. File map
| File | Change |
|---|---|
| `shared/src/character.ts` | NEW — `Character` (10 fields), `DEFAULT_CHARACTER`, `sanitizeCharacter`, `deriveRimverseAppearance`, `hueOfHex` |
| `shared/src/types.ts` | re-export `Character` from `./character`; remove the `{hue}` placeholder |
| `shared/src/protocol.ts` | `join.character?`; `PlayerSnap.accentHue` |
| `client/src/dunkchar/generator.ts` | NEW — pixel-identical TS port of v3 `generator.js` |
| `client/src/sprites/playerSprite.ts` | consume `accentHue` (subtle render-time tint) |
| `server/src/net.ts` | sanitize join character; derive + apply rimverse hue/accent; default for new; drop token-hash hue |
| `server/src/game/world.ts` | `PlayerEnt.accentHue`; emit in snapshot |
| `client/src/net/net.ts` | send stored character in `join` |
| `client/src/main.ts` | pass `accentHue` through to the sprite |
| tests | `shared/test/character.test.ts`, `client/test/dunkchar.test.ts`, `server/test` additions |

---

## 6. How this informs A2b (forward-looking, do not build)
A2b builds the v3 lobby/creator UI: the `renderPreview` from §2.2 drives the live character preview; the
controls write `localStorage['rimverse-character']` (the `Character` from §2.1) which §2.5 already sends on
join; hair/build/extra render as dropdowns over `HAIR_STYLES`/`BUILDS`/`ACCESSORIES`; ALL-TIME GREATS uses
A1's leaderboard; the layout reserves the WORLD TOUR slot for Phase B.
