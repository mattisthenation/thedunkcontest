// shared/constants.js — single source of truth for court geometry, physics,
// netcode rates, and game rules. Imported by the Node server and the browser.

export const COURT = {
  halfWidth: 10,    // x extent of floor
  halfLength: 15,   // z extent of floor
  boundX: 9.5,      // player movement clamp
  boundZ: 14.5,
  rimHeight: 3.05,
  rimRadius: 0.45,
  // Rim centers. Backboards sit 1.2 behind each rim at z = ±13.
  rims: [
    { x: 0, y: 3.05, z: -11.8 },
    { x: 0, y: 3.05, z: 11.8 },
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

// Dunk choreography lengths. The server treats these as authoritative timers;
// clients animate to match.
export const DUNKS = {
  basic: { ms: 750, label: 'SLAM' },
  tomahawk: { ms: 850, label: 'TOMAHAWK' },
  windmill: { ms: 950, label: 'WINDMILL' },
  spin360: { ms: 1050, label: '360' },
  reverse: { ms: 900, label: 'REVERSE JAM' },
  rimhang: { ms: 1200, label: 'RIM ROCKER' },
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
