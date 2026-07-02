import {
  PLAYER_SPEED,
  TURBO_COOLDOWN,
  TURBO_MAX,
  TURBO_MULT,
  TURBO_REGEN,
} from './constants';
import { clampToArena } from './geometry';
import type { Vec2 } from './types';

export interface SimInput {
  mx: number;
  my: number;
  turbo?: boolean;
}

export interface SimState {
  pos: Vec2;
  turboLeft: number;
  turboCd: number;
}

export function initialSimState(pos: Vec2): SimState {
  return { pos: { ...pos }, turboLeft: TURBO_MAX, turboCd: 0 };
}

/** Big = slower: size 0.8 → ×1.06, size 1.3 → ×0.91. */
export function speedFor(size: number): number {
  return PLAYER_SPEED * (1.3 - 0.3 * size);
}

/** The single movement integrator (server sim AND client prediction). Pure. */
export function stepPlayer(s: SimState, input: SimInput, dt: number, n: number, size = 1): SimState {
  let { mx, my } = input;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  let turboLeft = s.turboLeft;
  let turboCd = s.turboCd;
  let speed = speedFor(size);
  if (input.turbo && turboLeft > 0) {
    speed *= TURBO_MULT;
    turboLeft = Math.max(0, turboLeft - dt);
    if (turboLeft === 0) turboCd = TURBO_COOLDOWN;
  } else if (turboCd > 0) {
    turboCd = Math.max(0, turboCd - dt);
  } else {
    turboLeft = Math.min(TURBO_MAX, turboLeft + dt * TURBO_REGEN);
  }
  const pos = clampToArena(
    { x: s.pos.x + mx * speed * dt, y: s.pos.y + my * speed * dt },
    n,
  );
  return { pos, turboLeft, turboCd };
}
