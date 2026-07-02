import { computeSkeleton, RIG, type Pose } from './rig';
import type { Vec2 } from '../../../shared/src/types';

export interface Appearance {
  hue: number; // 0–360 jersey hue
  accentHue: number; // 0–360 trim/jersey2 hue (head-glow)
}

export type Facing = 'side' | 'front' | 'back';

/** One pose, any facing. Front/back are projections of the side skeleton. */
export function drawPoseFacing(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  px: number,
  look: Appearance,
  facing: Facing,
): void {
  if (facing === 'side') return drawPose(ctx, pose, px, look);
  drawFrontal(ctx, pose, px, look, facing === 'back');
}

/**
 * Frontal projection: compress side-view x toward the centerline and splay the
 * near/far limb pairs symmetrically so both legs/arms are visible.
 */
function drawFrontal(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  px: number,
  look: Appearance,
  back: boolean,
): void {
  const S = px * 0.62;
  const ox = px / 2;
  const oy = px * 0.94;
  const C = 0.35; // depth compression of side-view x
  const SPLAY = 0.07;
  const X = (p: Vec2, splay: number) => ox + (p.x * C + splay) * S;
  const Y = (p: Vec2) => oy - p.y * S;

  const s = computeSkeleton(pose);
  const jersey = back ? `hsl(${look.hue} 75% 48%)` : `hsl(${look.hue} 90% 60%)`;
  const skin = `hsl(${(look.hue + 160) % 360} 35% 72%)`;

  const limb = (a: Vec2, b: Vec2, splay: number, w: number, color: string, glow = false) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * S;
    ctx.lineCap = 'round';
    ctx.shadowBlur = glow ? 6 : 0;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(X(a, splay), Y(a));
    ctx.lineTo(X(b, splay), Y(b));
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  const shoe = (foot: Vec2, splay: number) => {
    ctx.fillStyle = 'hsl(0 0% 92%)';
    ctx.beginPath();
    ctx.ellipse(X(foot, splay), Y(foot) + 0.01 * S, 0.05 * S, 0.035 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // legs (shorts thigh + skin shin), symmetric splay
  limb(s.pelvis, s.kneeF, -SPLAY, 0.09, jersey);
  limb(s.kneeF, s.footF, -SPLAY, 0.07, skin);
  shoe(s.footF, -SPLAY);
  limb(s.pelvis, s.kneeN, SPLAY, 0.09, jersey);
  limb(s.kneeN, s.footN, SPLAY, 0.07, skin);
  shoe(s.footN, SPLAY);

  // torso + head
  limb(s.pelvis, s.chest, 0, 0.2, jersey, true);
  ctx.fillStyle = skin;
  ctx.shadowBlur = 8;
  ctx.shadowColor = `hsl(${look.accentHue} 90% 60%)`;
  ctx.beginPath();
  ctx.arc(X(s.head, 0), Y(s.head), RIG.headR * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (!back) {
    // face hint: two eye dots
    ctx.fillStyle = 'hsl(250 40% 20%)';
    for (const ex of [-0.026, 0.026]) {
      ctx.beginPath();
      ctx.arc(X(s.head, 0) + ex * S, Y(s.head) - 0.008 * S, 0.012 * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // arms over torso
  limb(s.chest, s.elbowF, -SPLAY, 0.065, jersey);
  limb(s.elbowF, s.handF, -SPLAY, 0.055, skin);
  limb(s.chest, s.elbowN, SPLAY, 0.065, jersey);
  limb(s.elbowN, s.handN, SPLAY, 0.055, skin);

  if (s.ball) {
    const br = 0.07 * S;
    const bx = X(s.ball, SPLAY);
    const by = Y(s.ball);
    ctx.fillStyle = 'hsl(25 95% 55%)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'hsl(25 95% 60%)';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/**
 * Draw a posed figure into ctx within a cell of `px` size.
 * Origin: feet-center at the bottom-middle of the cell; 1.0 height unit = 0.62*px,
 * leaving headroom for jumps (dunk rootY up to ~0.8 + torso + head ≈ 1.25).
 */
export function drawPose(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  px: number,
  look: Appearance,
): void {
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

  const dot = (p: Vec2, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(X(p), Y(p), r * S, 0, Math.PI * 2);
    ctx.fill();
  };

  /** Shoe: short bright stub pointing toward facing (+x), slightly down-weighted. */
  const shoe = (foot: Vec2, dark: boolean) => {
    const toe = { x: foot.x + RIG.foot, y: foot.y - 0.01 };
    limb(foot, toe, 0.075, dark ? 'hsl(0 0% 55%)' : 'hsl(0 0% 92%)');
  };

  // FAR limbs first (darker), then body, then NEAR limbs (brighter) — painter's depth.
  limb(s.pelvis, s.kneeF, 0.085, jerseyDark); // far thigh = shorts
  limb(s.kneeF, s.footF, 0.07, skinDark);
  shoe(s.footF, true);
  limb(s.chest, s.elbowF, 0.065, jerseyDark);
  limb(s.elbowF, s.handF, 0.055, skinDark);
  dot(s.handF, 0.035, skinDark);

  limb(s.pelvis, s.chest, 0.16, jersey, true); // torso
  // head
  ctx.fillStyle = skin;
  ctx.shadowBlur = 8;
  ctx.shadowColor = `hsl(${look.accentHue} 90% 60%)`;
  ctx.beginPath();
  ctx.arc(X(s.head), Y(s.head), RIG.headR * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  limb(s.pelvis, s.kneeN, 0.095, jersey); // near thigh = shorts
  limb(s.kneeN, s.footN, 0.075, skin);
  shoe(s.footN, false);
  limb(s.chest, s.elbowN, 0.07, jersey);
  limb(s.elbowN, s.handN, 0.06, skin);
  dot(s.handN, 0.038, skin);

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
