import { BALL_RESPAWN_DELAY, GRAB_RADIUS, ballCount } from '../../../shared/src/constants';
import type { BallSnap, BallState, Vec2 } from '../../../shared/src/types';
import type { PlayerEnt } from './world';

export interface BallFlight {
  from: Vec2;
  to: Vec2;
  start: number;
  duration: number;
  made: boolean;
  isDunk: boolean; // true = the slam-release flight; drives the career dunk counter
  targetHoop: number; // visual hoop position only
  shooter: string;
  defenderId: string | null; // owner of the targeted rim at launch (id-stable; M2/M3)
}

export interface BallEnt {
  id: string;
  pos: Vec2;
  z: number;
  state: BallState;
  carrier: string | null;
  respawnAt: number; // world time
  flight: BallFlight | null;
}

let nextBallId = 1;

export function makeBall(): BallEnt {
  return {
    id: `b${nextBallId++}`,
    pos: { x: 0, y: 0 },
    z: 0,
    state: 'free',
    carrier: null,
    respawnAt: 0,
    flight: null,
  };
}

/** Keep ball count in line with the scarcity rule; new balls appear at the hub. */
export function ensureBallCount(balls: Map<string, BallEnt>, playerCount: number): void {
  const target = ballCount(Math.max(1, playerCount));
  while (balls.size < target) {
    const b = makeBall();
    balls.set(b.id, b);
  }
  // shrink: remove only idle hub balls (never carried/flight) until at target
  if (balls.size > target) {
    for (const [id, b] of balls) {
      if (balls.size <= target) break;
      if (b.state === 'free' && Math.hypot(b.pos.x, b.pos.y) < 1) balls.delete(id);
    }
  }
}

/** Resolve grab intents: closest grabbing player within radius wins each free ball. */
export function resolveGrabs(balls: Map<string, BallEnt>, grabbers: PlayerEnt[]): void {
  for (const ball of balls.values()) {
    if (ball.state !== 'free') continue;
    let best: PlayerEnt | null = null;
    let bestD = GRAB_RADIUS;
    for (const p of grabbers) {
      if (p.ballId !== null || p.action !== null) continue;
      const d = Math.hypot(p.pos.x - ball.pos.x, p.pos.y - ball.pos.y);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      ball.state = 'carried';
      ball.carrier = best.id;
      best.ballId = ball.id;
    }
  }
}

export function tickRespawns(balls: Map<string, BallEnt>, time: number): void {
  for (const b of balls.values()) {
    if (b.state === 'respawning' && time >= b.respawnAt) {
      b.state = 'free';
      b.carrier = null;
      b.pos = { x: 0, y: 0 };
      b.z = 0;
    }
  }
}

export function startRespawn(b: BallEnt, time: number): void {
  b.state = 'respawning';
  b.carrier = null;
  b.flight = null;
  b.z = 0;
  b.respawnAt = time + BALL_RESPAWN_DELAY;
}

export function toSnap(b: BallEnt): BallSnap {
  return { id: b.id, x: b.pos.x, y: b.pos.y, z: b.z, state: b.state, carrier: b.carrier };
}
