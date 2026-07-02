import { discRadius } from '../../../shared/src/geometry';
import { COURT_HALF_L } from '../../../shared/src/constants';
import type { AnimState, BallSnap, HoopSnap, PlayerSnap, Vec2 } from '../../../shared/src/types';

// ── Pure math (unit-tested; no THREE, no DOM) ──────────────────────────────

export interface RadarPoint {
  px: number;
  py: number;
  clamped: boolean;
}

/** Radar shows a touch more than the full ring so rim entities sit just inside. */
export function ringViewRange(n: number): number {
  return (n <= 2 ? COURT_HALF_L : discRadius(n)) * 1.08;
}

/** World (wx,wy) → radar pixel offset from center, clamped to the dish. sim +x→right, +y→down. */
export function projectToRadar(
  wx: number,
  wy: number,
  center: Vec2,
  viewRange: number,
  radiusPx: number,
): RadarPoint {
  const rx = ((wx - center.x) / viewRange) * radiusPx;
  const ry = ((wy - center.y) / viewRange) * radiusPx;
  const d = Math.hypot(rx, ry);
  if (d > radiusPx) {
    const s = radiusPx / d;
    return { px: rx * s, py: ry * s, clamped: true };
  }
  return { px: rx, py: ry, clamped: false };
}

const DUNK_OR_SHOOT = (a: AnimState) => a === 'shoot' || a.startsWith('dunk');
const THREAT_RADIUS = 12;

/** 0..1 — how much player p threatens the viewer's hoop (no PlayerSnap target field, so derived). */
export function attackerScore(p: PlayerSnap, myHoop: Vec2 | null): number {
  if (!myHoop) return 0;
  const dx = myHoop.x - p.x;
  const dy = myHoop.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > THREAT_RADIUS) return 0;
  const prox = 1 - dist / THREAT_RADIUS;
  if (DUNK_OR_SHOOT(p.anim)) return Math.max(0.6, prox); // imminent score on my rim
  if (p.hasBall) {
    const len = dist || 1;
    const toward = (p.dx * dx + p.dy * dy) / len; // -1..1, heading at my hoop?
    if (toward > 0.2) return Math.min(0.9, 0.3 + 0.5 * toward * prox + 0.3 * prox);
  }
  return 0;
}

export function isAttacker(p: PlayerSnap, myHoop: Vec2 | null): boolean {
  return attackerScore(p, myHoop) > 0.3;
}

export type BlipKind =
  | 'self'
  | 'player'
  | 'attacker'
  | 'hoopMine'
  | 'hoopEnemy'
  | 'hoopNeutral'
  | 'ball';

export interface Blip {
  kind: BlipKind;
  x: number;
  y: number;
  hue?: number;
}

export function buildBlips(
  players: PlayerSnap[],
  hoops: HoopSnap[],
  balls: BallSnap[],
  myId: string | null,
  myHoop: Vec2 | null,
): Blip[] {
  const blips: Blip[] = [];
  for (const h of hoops) {
    const kind: BlipKind = h.owner === myId ? 'hoopMine' : h.owner ? 'hoopEnemy' : 'hoopNeutral';
    blips.push({ kind, x: h.x, y: h.y });
  }
  for (const p of players) {
    if (p.id === myId) {
      blips.push({ kind: 'self', x: p.x, y: p.y, hue: p.hue });
    } else {
      blips.push({ kind: isAttacker(p, myHoop) ? 'attacker' : 'player', x: p.x, y: p.y, hue: p.hue });
    }
  }
  for (const b of balls) {
    if (b.state === 'free' || b.state === 'flight') blips.push({ kind: 'ball', x: b.x, y: b.y });
  }
  return blips;
}

// ── Canvas rendering (impure; not unit-tested) ─────────────────────────────

export interface RadarView {
  ctx: CanvasRenderingContext2D;
  radiusPx: number;
}

export function makeRadar(canvas: HTMLCanvasElement, sizePx = 160): RadarView {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = sizePx * dpr;
  canvas.height = sizePx * dpr;
  canvas.style.width = `${sizePx}px`;
  canvas.style.height = `${sizePx}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { ctx, radiusPx: sizePx / 2 };
}

export function drawRadar(
  view: RadarView,
  center: Vec2,
  blips: Blip[],
  viewRange: number,
  now: number,
): void {
  const { ctx, radiusPx } = view;
  const cx = radiusPx;
  const cy = radiusPx;
  ctx.clearRect(0, 0, radiusPx * 2, radiusPx * 2);

  // dish
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx - 1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,2,24,0.65)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,113,206,0.55)';
  ctx.stroke();
  // crosshair
  ctx.strokeStyle = 'rgba(255,113,206,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - radiusPx, cy);
  ctx.lineTo(cx + radiusPx, cy);
  ctx.moveTo(cx, cy - radiusPx);
  ctx.lineTo(cx, cy + radiusPx);
  ctx.stroke();

  const blink = 0.5 + 0.5 * Math.sin(now / 120);
  for (const b of blips) {
    const p = projectToRadar(b.x, b.y, center, viewRange, radiusPx);
    const x = cx + p.px;
    const y = cy + p.py;
    switch (b.kind) {
      case 'self':
        ctx.fillStyle = '#ffffff';
        dot(ctx, x, y, 3);
        break;
      case 'hoopMine':
        square(ctx, x, y, 5, '#05ffa1');
        break;
      case 'hoopEnemy':
        square(ctx, x, y, 4, '#ff71ce');
        break;
      case 'hoopNeutral':
        square(ctx, x, y, 4, '#ff9e00');
        break;
      case 'ball':
        ctx.fillStyle = '#ff9e00';
        dot(ctx, x, y, 2);
        break;
      case 'attacker':
        ctx.fillStyle = `rgba(255,60,60,${0.5 + 0.5 * blink})`;
        dot(ctx, x, y, 3.5);
        if (p.clamped) chevron(ctx, cx, cy, x, y);
        break;
      default:
        ctx.fillStyle = b.hue !== undefined ? `hsl(${b.hue} 80% 65%)` : '#9aa';
        dot(ctx, x, y, 2.5);
    }
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function square(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
}

/** Little outward arrow at a rim-clamped blip pointing the threat's direction. */
function chevron(ctx: CanvasRenderingContext2D, cx: number, cy: number, x: number, y: number): void {
  const a = Math.atan2(y - cy, x - cx);
  ctx.strokeStyle = 'rgba(255,60,60,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a - 0.4) * 5, y + Math.sin(a - 0.4) * 5);
  ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
  ctx.lineTo(x + Math.cos(a + 0.4) * 5, y + Math.sin(a + 0.4) * 5);
  ctx.stroke();
}
