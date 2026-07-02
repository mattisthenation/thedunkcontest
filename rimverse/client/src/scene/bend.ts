// SHARED BEND — algebraically identical to RIM_BEND_GLSL and to the values
// asserted in client/test/bend.test.ts. RENDER-ONLY: reads sim-derived values,
// never writes sim/collision/netcode state. The Escher loop is a pure visual.
import * as THREE from 'three';

export interface BendParams {
  originX: number; // local player world X (= sim x)
  originY: number; // local player world Z (= sim y)
  floorRadius: number; // eased discRadius(n) / COURT_HALF_L
  bendHeight: number; // tune 6..12; default 8
  bendPull: number; // 0.15..0.25; default 0.2
}

export const BEND: BendParams = {
  originX: 0,
  originY: 0,
  floorRadius: 14,
  bendHeight: 0, // starts flat; eases toward bendHeightFor(n) as players join
  bendPull: 0.2,
};

/**
 * Bend strength by player count. Spec: 1–2 players is the "nostalgic rectangle"
 * with a classic half-court feel (flat — no Escher curl), and the disc curls up
 * more as it fills toward the 100-player wheel.
 */
export function bendHeightFor(n: number): number {
  if (n <= 2) return 0;
  return Math.min(8, (n - 2) * 0.7);
}

/** Lift world-y and pull inward by horizontal distance from the bend origin. */
export function rimBend(wx: number, wy: number, wz: number, p: BendParams) {
  const relX = wx - p.originX;
  const relZ = wz - p.originY;
  const d = Math.hypot(relX, relZ);
  const u = d / Math.max(p.floorRadius, 0.001);
  const lift = (p.bendHeight * (u * u)) / (1 + u * 0.5);
  const inv = d > 1e-4 ? 1 / d : 0;
  const pull = p.bendPull * lift;
  return { x: wx - relX * inv * pull, y: wy + lift, z: wz - relZ * inv * pull };
}

/** Just the y-lift (the cheap path for entity anchors). Equals rimBend().y. */
export function rimLift(wx: number, wz: number, p: BendParams): number {
  const d = Math.hypot(wx - p.originX, wz - p.originY);
  const u = d / Math.max(p.floorRadius, 0.001);
  return (p.bendHeight * (u * u)) / (1 + u * 0.5);
}

const _n = new THREE.Vector3();
/** Surface normal of the bent floor (finite-difference of the lift field). */
export function bendNormal(wx: number, wz: number, p: BendParams): THREE.Vector3 {
  const e = 0.25;
  const hL = rimLift(wx - e, wz, p);
  const hR = rimLift(wx + e, wz, p);
  const hD = rimLift(wx, wz - e, p);
  const hU = rimLift(wx, wz + e, p);
  return _n.set(-(hR - hL) / (2 * e), 1, -(hU - hD) / (2 * e)).normalize();
}

// === GLSL twin — byte-identical algebra. Locked by the contract test in bend.test.ts. ===
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
