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
  uaN: number;
  faN: number;
  uaF: number;
  faF: number;
  thN: number;
  shN: number;
  thF: number;
  shF: number;
  ball?: 'handN' | Vec2;
}

export const NEUTRAL_POSE: Pose = {
  rootY: RIG.standHip,
  lean: 0,
  headTilt: 0,
  uaN: 5,
  faN: 8,
  uaF: -5,
  faF: 8,
  thN: 2,
  shN: 4,
  thF: -2,
  shF: 4,
};

export interface Skeleton {
  pelvis: Vec2;
  chest: Vec2;
  head: Vec2;
  elbowN: Vec2;
  handN: Vec2;
  elbowF: Vec2;
  handF: Vec2;
  kneeN: Vec2;
  footN: Vec2;
  kneeF: Vec2;
  footF: Vec2;
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

  // Ball rides just beyond the palm along the forearm axis: below the hand when the
  // arm hangs (dribble), above it when the arm is raised (shot/dunk windup).
  let ball: Vec2 | null = null;
  if (p.ball === 'handN') {
    const dx = handN.x - elbowN.x;
    const dy = handN.y - elbowN.y;
    const len = Math.hypot(dx, dy) || 1;
    ball = { x: handN.x + (dx / len) * 0.075, y: handN.y + (dy / len) * 0.075 };
  } else if (p.ball) {
    ball = p.ball;
  }
  return { pelvis, chest, head, elbowN, handN, elbowF, handF, kneeN, footN, kneeF, footF, ball };
}
