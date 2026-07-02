// shared/constants.js — single source of truth for court geometry, physics,
// netcode rates, and game rules. Imported by the Node server and the browser.

export const COURT = {
  halfWidth: 10,    // x extent of floor
  halfLength: 15,   // z extent of floor
  boundX: 9.5,      // player movement clamp
  boundZ: 14.5,
  rimHeight: 3.05,
  rimRadius: 0.45,
  // Rim centers sit one bracket-length in front of the backboard face
  // (board at ±13, face ≈ ±12.97, rim edge at ±12.75 + 0.22 bracket).
  rims: [
    { x: 0, y: 3.05, z: -12.3 },
    { x: 0, y: 3.05, z: 12.3 },
  ],
  backboardZ: 13,
  threePointRadius: 6.75,
};

export const NET = {
  tickRate: 20,          // server simulation Hz
  snapshotRate: 20,      // snapshots per second (rooms are small; AOI caps payload)
  inputRate: 20,         // client → server input Hz
  interpDelayMs: 110,    // remote entities render this far in the past
  aoiLimit: 24,          // max remote players in one client's snapshot
  reconnectGraceMs: 60_000,
};

export const ROOM = {
  // Players per court instance (see README: scaling model). DUNK_ROOM_CAP
  // exists for the single-mega-room load test; the guard keeps this module
  // importable in the browser, where `process` doesn't exist.
  cap: (typeof process !== 'undefined' && Number(process.env?.DUNK_ROOM_CAP)) || 10,
};

export const PLAYER = {
  maxSpeed: 8,
  jumpVelocity: 8.5,
  gravity: -22,
  height: 2.0,
  pickupRadius: 2.2,     // explicit grab (action)
  magnetRadius: 1.1,     // walk-over auto-pickup
};

export const TURBO = {
  multiplier: 1.45,      // held-SHIFT speed boost
  drainMs: 2600,         // full meter burns in ~2.6s
  rechargeMs: 4800,      // empty → full
};

export const STEAL = {
  radius: 1.6,           // reach to strip a carrier
  chance: 0.4,
  cooldownMs: 1500,      // per-thief attempt cooldown
  protectMs: 800,        // fresh possession can't be stripped
};

export const BLOCK = {
  radius: 1.8,           // reach from an airborne defender to the ball
  windowMs: 700,         // shots are blockable this long after release
  minAirY: 0.45,         // defender must actually be off the ground
};

export const BALL = {
  radius: 0.3,
  gravity: -15,
  bounce: 0.62,
  groundFriction: 0.88,
  flightTimeoutMs: 6000,
};

// Shot zones measured as horizontal distance to nearest rim.
export const ZONES = {
  dunk: 3.2,
  close: 5.0,
  mid: 8.0,
  heave: 13.0,
};

export const ACCURACY = {
  close: 0.8,
  mid: 0.62,
  three: 0.45,
  heave: 0.18,
  onFireBonus: 0.18,
  max: 0.96,
};

export const FIRE = {
  makesToIgnite: 3,      // consecutive makes (a miss resets)
  durationMs: 45_000,
};

// SP3 — the wormhole. The combined room score climbs; at a per-room HIDDEN
// threshold in [min, min+span-1] the game arms, and the next dunk becomes the
// Universe Collapse → the whole room warps into the rimverse. Server-authoritative.
export const WARP = {
  min: 10,   // brief §5.3: threshold = 10 + floor(rand * 16) → [10, 25]
  span: 16,
};

// Dunk choreography. The server treats `ms` as the authoritative timer;
// clients animate to match (spins = full sprite rotations, extraHeight is
// added to the arc peak, hang holds at the rim before the drop).
// Turbo-tier dunks require holding TURBO (or being on fire).
export const DUNKS = {
  basic: { ms: 750, label: 'SLAM', tier: 0, spins: 0, extraHeight: 0, hang: 0 },
  tomahawk: { ms: 880, label: 'TOMAHAWK', tier: 0, spins: 0, extraHeight: 0.5, hang: 0.1 },
  reverse: { ms: 920, label: 'REVERSE JAM', tier: 0, spins: 0.5, extraHeight: 0.3, hang: 0.08 },
  windmill: { ms: 1050, label: 'WINDMILL', tier: 1, spins: 1, extraHeight: 0.7, hang: 0.12 },
  spin360: { ms: 1150, label: '360', tier: 1, spins: 1, extraHeight: 0.9, hang: 0.1 },
  rimhang: { ms: 1450, label: 'RIM ROCKER', tier: 1, spins: 0.5, extraHeight: 1.1, hang: 0.45 },
};

// Wire-format animation codes (snapshot field `a`).
export const ANIM = {
  idle: 0, run: 1, dribble: 2, jump: 3, shoot: 4, dunk: 5, celebrate: 6,
};
export const ANIM_NAMES = Object.fromEntries(
  Object.entries(ANIM).map(([k, v]) => [v, k]),
);

export const BALL_STATE = { free: 0, carried: 1, flight: 2, dunk: 3 };

export function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function nearestRim(pos) {
  const [r0, r1] = COURT.rims;
  const d0 = dist2D(pos, r0);
  const d1 = dist2D(pos, r1);
  return d0 <= d1 ? { rim: r0, dist: d0, index: 0 } : { rim: r1, dist: d1, index: 1 };
}
