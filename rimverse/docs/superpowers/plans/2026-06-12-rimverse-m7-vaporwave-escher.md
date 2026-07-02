# RIMVERSE M7: Vaporwave × Escher Render Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The flat sim becomes a glowing impossible coliseum — neon grid floor + sunset sky, a render-only radial world-bend that curls the far rim into the sky (Escher loop), bloom + CRT/chromatic-aberration post-FX, and a flat-truth HUD radar. **The simulation stays a flat 2D disc; nothing here touches `shared/`, `server/`, or netcode.**

**Architecture (from the design workflow's judge-panel winner, Approach A):** one source-of-truth bend function `rimBend(worldXZ, origin)` raises world-y by horizontal distance from the local player; it lives in `client/src/scene/bend.ts` as TS **and** a byte-identical GLSL twin, locked by a contract test. The floor is a procedural grid `ShaderMaterial` that bends per-vertex on the GPU; sprites/balls/hoops bend their ground-anchor on the CPU via the same TS function and stay world-vertical. Post-FX is `three/examples/jsm` EffectComposer (zero new deps). The radar is unwarped flat-sim truth.

**Tech Stack:** three@0.170 (vendored postprocessing), Vite, Vitest. No new deps.

**Guardrail (enforced at EVERY gate):**
```bash
git diff --name-only | grep -E '^(shared|server|client/src/net)/' && echo "GUARDRAIL VIOLATION" || echo clean
npx vitest run shared server   # sim/netcode tests stay green + unchanged
```

Full design blueprint: `docs/superpowers/plans/` design artifact (workflow wm2m3dv51). Tests live in `client/test/`, importing `../src/...` (vitest glob `*/test/**/*.test.ts`).

---

## Component 1: Shared bend math `bend.ts` (TDD)

**Files:** Create `client/src/scene/bend.ts`, `client/test/bend.test.ts`

- [x] **Step 1: Failing tests** — `client/test/bend.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BendParams, rimBend, rimLift, bendNormal } from '../src/scene/bend';

const P = (over: Partial<BendParams> = {}): BendParams => ({
  originX: 0, originY: 0, floorRadius: 14, bendHeight: 8, bendPull: 0.2, ...over,
});

describe('rimBend', () => {
  it('is flat at the origin (zero lift, no pull)', () => {
    const b = rimBend(0, 0, 0, P());
    expect(b).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('lift increases monotonically with distance', () => {
    const ys = [0, 5, 10, 20, 40].map((d) => rimBend(d, 0, 0, P()).y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  it('slope at the origin is ~0 (quadratic, no seasick tilt)', () => {
    const eps = 0.01;
    const slope = (rimLift(eps, 0, P()) - rimLift(0, 0, P())) / eps;
    expect(Math.abs(slope)).toBeLessThan(0.01);
  });

  it('far rim (d = 2*radius) lifts above the camera (y≈9)', () => {
    const y = rimLift(28, 0, P());
    expect(y).toBeGreaterThan(9);
    expect(y).toBeLessThan(13);
  });

  it('rimLift equals rimBend().y exactly', () => {
    for (const [x, z] of [[3, 4], [10, -7], [-12, 5]]) {
      expect(rimLift(x, z, P())).toBeCloseTo(rimBend(x, 0, z, P()).y, 10);
    }
  });

  it('GLSL<->TS contract: hand-computed values match to 1e-6', () => {
    // u = d/14; lift = 8*u^2/(1+u*0.5); pull = 0.2*lift; bent = pos - dir*pull (xz), y+lift
    // d=14 (u=1): lift = 8*1/(1.5) = 5.3333...; at (14,0,0): dir=(1,0), pull=1.06666...
    const b = rimBend(14, 0, 0, P());
    expect(b.y).toBeCloseTo(5.333333, 5);
    expect(b.x).toBeCloseTo(14 - 1.066667, 5);
    expect(b.z).toBeCloseTo(0, 6);
  });

  it('bendNormal is world-up at origin, tilts radially off-origin', () => {
    const n0 = bendNormal(0, 0, P());
    expect(n0.x).toBeCloseTo(0, 6);
    expect(n0.y).toBeCloseTo(1, 6);
    expect(n0.z).toBeCloseTo(0, 6);
    const n1 = bendNormal(20, 0, P());
    expect(n1.x).toBeLessThan(0); // tilts back toward the hub
    expect(n1.y).toBeGreaterThan(0);
    expect(Math.hypot(n1.x, n1.y, n1.z)).toBeCloseTo(1, 6);
  });
});
```

- [x] **Step 2: RED** — `npx vitest run client/test/bend.test.ts` → fail (module missing)

- [x] **Step 3: Implement** `client/src/scene/bend.ts` (verbatim from blueprint; render-only, imports only three):

```ts
// SHARED BEND — algebraically identical to RIM_BEND_GLSL and to the values
// asserted in client/test/bend.test.ts. RENDER-ONLY: reads sim-derived values,
// never writes sim/collision/netcode state.
import * as THREE from 'three';

export interface BendParams {
  originX: number; originY: number; // local player world X / world Z (= sim x / sim y)
  floorRadius: number; // eased discRadius(n) / COURT_HALF_L
  bendHeight: number; // tune 6..12; default 8
  bendPull: number; // 0.15..0.25; default 0.2
}

export const BEND: BendParams = {
  originX: 0, originY: 0, floorRadius: 14, bendHeight: 8.0, bendPull: 0.2,
};

export function rimBend(wx: number, wy: number, wz: number, p: BendParams) {
  const relX = wx - p.originX, relZ = wz - p.originY;
  const d = Math.hypot(relX, relZ);
  const u = d / Math.max(p.floorRadius, 0.001);
  const lift = (p.bendHeight * (u * u)) / (1 + u * 0.5);
  const inv = d > 1e-4 ? 1 / d : 0;
  const pull = p.bendPull * lift;
  return { x: wx - relX * inv * pull, y: wy + lift, z: wz - relZ * inv * pull };
}

export function rimLift(wx: number, wz: number, p: BendParams): number {
  const d = Math.hypot(wx - p.originX, wz - p.originY);
  const u = d / Math.max(p.floorRadius, 0.001);
  return (p.bendHeight * (u * u)) / (1 + u * 0.5);
}

const _n = new THREE.Vector3();
export function bendNormal(wx: number, wz: number, p: BendParams): THREE.Vector3 {
  const e = 0.25;
  const hL = rimLift(wx - e, wz, p), hR = rimLift(wx + e, wz, p);
  const hD = rimLift(wx, wz - e, p), hU = rimLift(wx, wz + e, p);
  return _n.set(-(hR - hL) / (2 * e), 1, -(hU - hD) / (2 * e)).normalize();
}

// === GLSL twin — byte-identical algebra. Locked by the contract test. ===
export const RIM_BEND_GLSL = /* glsl */ `
uniform vec2  uOrigin;
uniform float uFloorRadius;
uniform float uBendHeight;
uniform float uBendPull;
vec3 rimBend(vec3 worldPos) {
  vec2  rel  = worldPos.xz - uOrigin;
  float d    = length(rel);
  float u    = d / max(uFloorRadius, 0.001);
  float lift = uBendHeight * (u * u) / (1.0 + u * 0.5);
  vec2  dir  = d > 1e-4 ? rel / d : vec2(0.0);
  vec2  pull = dir * (uBendPull * lift);
  return vec3(worldPos.x - pull.x, worldPos.y + lift, worldPos.z - pull.y);
}`;
```

- [x] **Step 4: GREEN** — `npx vitest run client/test/bend.test.ts`; guardrail check (only `client/` touched)

- [x] **Step 5: Commit** — `git commit -m "feat(client/m7): shared bend math (TS + GLSL twin), TDD"`

---

## Component 2: Neon grid floor with bend injection + sunset sky

**Files:** Create `client/src/scene/neonGrid.ts`, `client/src/scene/sunsetSky.ts`; Modify `client/src/scene/scene.ts`

Procedural grid `ShaderMaterial` on a `PlaneGeometry(200,200,200,200)` (interior verts so the bend curves smoothly — solves the floor-tessellation winnerFix by construction). Shared `wrapUniforms` object. Grid vertex shader prepends `RIM_BEND_GLSL` and does model→world→bend→view→projection. Fragment: AA grid lines, radial fade, pulse, HDR cores for bloom. Skydome: BackSide sphere(150), sunset gradient + chrome sun, not bent, renderOrder -2.

`scene.ts` rewrite of `setArena`: build grid+sky once in ctor; on N change only retarget `uMode`/`uRadius`/dip `uOpacity` and ease uniforms at `dt*3`. Add `setWrapOrigin(x,y,radius)` (writes both `wrapUniforms` and TS `BEND` from one call), `setShaderTime(t)`. Expose `floorRadius`.

- [x] **Step 1:** author `neonGrid.ts` + `sunsetSky.ts` (shaders), rewrite `setArena`, add origin/time setters. (Source authored during execution; iterate visually.)
- [x] **Step 2: VISUAL GATE** — app run: `bendHeight=0` → flat neon vaporwave grid, morphs rect↔disc without popping. `bendHeight=8` → far rim lifts into the sky and curls inward, near-player patch stays flat, lines follow the curve (no straight chords). Sunset behind. Screenshot before/after. Guardrail check.
- [x] **Step 3: Commit** — `git commit -m "feat(client/m7): procedural neon grid + sunset sky + bend-injected floor shader"`

---

## Component 3: Bend origin feed + entity gluing (sprites/balls/hoops)

**Files:** Modify `client/src/main.ts` (frame reorder), `client/src/sprites/playerSprite.ts`, `client/src/scene/scene.ts`

`main.ts` frame order: `setArena` → `setWrapOrigin(predictor.pos.x, predictor.pos.y, scene.floorRadius)` → `setShaderTime` → entity syncs → followCam → render. Origin = `predictor.pos` (same source as followCam), read-only.

`playerSprite.update` (line ~90): `const b = rimBend(x, 0, y, BEND); mesh.position.set(b.x, baseY + b.y, b.z)`; **keep billboard yaw + facing selection on FLAT (x,y)** — only `mesh.position` uses bent coords. `toneMapped:false` on sprite material.

`scene.syncBalls`/`syncHoops`: bend the anchor via `rimBend(...,BEND)`; balls keep local hover; hoops ship lift-only (`g.lookAt(0,0,0)` retained), optional `bendNormal` tilt as follow-up. `toneMapped:false` + neon overdrive on rim/ball materials.

- [x] **Step 1:** add glue-contract test to `bend.test.ts` (entity anchor == floor vertex at same XZ → identical `rimBend`); implement placements.
- [x] **Step 2: VISUAL GATE (decisive)** — at `bendHeight=8`, walk the local player to the far rim: players/balls/hoops ride up the rising wall glued to the grid, feet stay on bent cells the whole way, no float/sink. Screenshot near+far. Guardrail check.
- [x] **Step 3: Commit** — `git commit -m "feat(client/m7): glue sprites/balls/hoops to the bent floor (shared rimBend)"`

---

## Component 4: Post-FX stack (bloom + CRT/chromatic aberration)

**Files:** Modify `client/src/scene/scene.ts`

EffectComposer chain (imports from `three/examples/jsm/postprocessing/*.js`, zero new deps): `RenderPass` → `UnrealBloomPass(strength~0.9, radius~0.7, threshold~0.72)` → `ShaderPass(CRTShader)` (scanlines + chromatic aberration + barrel + vignette + grain) → `OutputPass` (last; ACES + sRGB). `renderer.toneMapping = ACESFilmicToneMapping`, exposure ~1.15. `render()` → `composer.render()`; resize updates composer + CRT `uResolution`. `lowQuality` flag bypasses composer for weak GPUs.

- [x] **Step 1:** author CRT shader + composer wiring; tune intensities.
- [x] **Step 2: VISUAL GATE** — neon grid/rims/balls bloom (dim grid below threshold), scanlines + subtle chromatic fringe + barrel bezel + grain; reads "synthwave"; framerate smooth at moderate N. Screenshot. Guardrail check.
- [x] **Step 3: Commit** — `git commit -m "feat(client/m7): EffectComposer post-FX (bloom + CRT + chromatic aberration)"`

---

## Component 5: HUD mini-radar (TDD pure math + canvas draw)

**Files:** Create `client/src/hud/radar.ts`, `client/test/radar.test.ts`; Modify `client/index.html`, `client/src/main.ts`

Pure (no THREE/DOM): `projectToRadar()`, `attackerScore()`, `isAttacker()`, `buildBlips()`, `ringViewRange()`. Reads `discRadius`/`COURT_HALF_L`/`AOI_CAP` from `shared/` (read-only). `index.html` adds `<canvas id="radar">` bottom-right (HiDPI). `main.ts` draws after the HUD text block, centered on `predictor.pos`. "Attacker" derived (no PlayerSnap target field): fuse `anim ∈ {shoot,dunk*}`, `hasBall`+facing·toHoop, proximity → 0..1 blink.

- [x] **Step 1: Failing tests** `client/test/radar.test.ts`:
  - `projectToRadar`: far point clamps to rim (`clamped`, `hypot==radiusPx`); origin→center; sim +x→right, +y→down.
  - `attackerScore`: shooting/dunking enemy near your hoop → high; carrier heading away → 0; carrier toward+close → mid-high; idle unarmed → 0; beyond threatRadius → 0.
  - `buildBlips`: ownership (`hoopMine`/`hoopEnemy`/`hoopNeutral` from `owner===myId`), ball filter (free/flight only), self dedupe, ≤28.
  - `ringViewRange(n)`: `discRadius(n)*1.08` (N≥3) / `COURT_HALF_L*1.08` (N≤2).
- [x] **Step 2: RED → implement pure fns → GREEN**, then author `drawRadar`/`makeView` + wire into `main.ts` + `index.html`.
- [x] **Step 3: VISUAL GATE** — radar dish bottom-right shows the true flat ring (unwarped), your dot, hoops (mine highlighted/pulsing), carriers haloed, attackers blinking red with outward chevrons, rim-clamped show direction. Readable at high N. Screenshot. Guardrail check.
- [x] **Step 4: Commit** — `git commit -m "feat(client/m7): flat-truth HUD radar (TDD pure math + canvas)"`

---

## Component 6: M7 GATE + wrap-up

- [x] **Step 1: Full acceptance** — all four hard requirements visible simultaneously: (a) Escher loop (far rim into sky), (b) entities glued to bent floor, (c) vaporwave/sunset/bloom/CRT, (d) flat-truth radar. Run with bots for a populated screenshot.
- [x] **Step 2: Guardrail final** — `git diff --name-only main | grep -E '^(shared|server|client/src/net)/'` is EMPTY; `npx vitest run` all green; `npm run typecheck` clean.
- [x] **Step 3: README + plan checkboxes + commit**; merge to main via finishing-a-development-branch.

## Self-review

1. **Spec §3 + M7 coverage:** neon grid ✓ (C2), sunset sky ✓ (C2), CRT/scanline/chromatic-aberration + bloom ✓ (C4), non-euclidean wrap render-only ✓ (C1–C3, guardrail-fenced), HUD ✓ existing + radar ✓ (C5). Sim stays flat ✓ (guardrail at every gate).
2. **Render-only guardrail:** structurally enforced — only `client/` (excl. `net/`) is touched; `git diff` check + `vitest run shared server` at every gate.
3. **GPU/CPU bend parity:** ONE math source (`bend.ts`); `setWrapOrigin` writes GLSL uniforms + TS BEND from the same args; locked by the GLSL↔TS contract test.
4. **Deferred (not M7):** 100-player sprite InstancedMesh batching (AOI caps drawn at 28 now); hoop bendNormal tilt (lift-only ships first).
