export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
export const SNAPSHOT_EVERY = 2; // every 2nd tick → 15 Hz

export const R_BASE = 14; // disc radius at small N (meters-ish)
export const R_K = 2.5; // R = R_BASE + R_K * sqrt(N)
export const COURT_HALF_W = 8; // rectangle mode (N <= 2)
export const COURT_HALF_L = 14;

export const PLAYER_SPEED = 8;

export const TURBO_MULT = 1.6;
export const TURBO_MAX = 1.5; // seconds of boost in a full meter
export const TURBO_COOLDOWN = 2.5; // s after depletion before regen starts
export const TURBO_REGEN = 0.5; // meter-seconds gained per second

export const SIZE_MIN = 0.8;
export const SIZE_MAX = 1.3;
export const STEAL_RANGE = 1.6;
export const BLOCK_RANGE = 2.2;
export const STUN_TIME = 1.2;
export const STEAL_LOCK = 0.45;
export const BLOCK_LOCK = 0.5;

export const GRAB_RADIUS = 1.4;
export const DUNK_RANGE = 3.0;
export const DUNK_TIME = 0.9; // s, action lock
export const SHOOT_TIME = 0.7;
export const BALL_RESPAWN_DELAY = 3;

export const AOI_CAP = 28;
export const INTERP_DELAY_MS = 100;
export const MAX_PLAYERS = 100; // join cap (H3); spec ceiling
export const MAX_INTENT_BACKLOG = 60; // per-player pending-intent flood guard
export const SERVER_PORT = 8081;

export const ballCount = (n: number) => Math.max(1, Math.ceil(n / 6));

// --- Dunk arc physics (V5). GRAV is fixed; per-dunk `ticksToRim` sets the arc. ---
export const GRAV = 7.5; // world-units/s^2 downward, applied to vz each tick (floaty arcade arc; tuned at the visual gate)
export const RIM_HEIGHT = 3.05; // world height of the rim (matches scene.ts rim mesh y)
export const DUNK_REACH = 1.35; // peak pelvis rise during a dunk; rig + arm extension reach the rim from here
