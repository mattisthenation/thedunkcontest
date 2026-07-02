import { NEUTRAL_POSE, type Pose } from './rig';

export interface AnimDef {
  fps: number;
  loop: boolean;
  frames: Pose[];
}

const P = (over: Partial<Pose>): Pose => ({ ...NEUTRAL_POSE, ...over });

/** Idle: 4 frames @ 6 fps — breathing, slight sway. */
const idle: AnimDef = {
  fps: 6,
  loop: true,
  frames: [
    P({ rootY: 0.478 }),
    P({ rootY: 0.474, lean: 1, uaN: 7, uaF: -7 }),
    P({ rootY: 0.47, lean: 1.5 }),
    P({ rootY: 0.474, lean: 0.5, uaN: 4, uaF: -4 }),
  ],
};

/** Run: 8 frames @ 12 fps. Wide stride, hard arm pump (~90° elbows), airborne at f3/f7. */
const run: AnimDef = {
  fps: 12,
  loop: true,
  frames: [
    P({ rootY: 0.468, lean: 10, thN: 34, shN: 10, thF: -26, shF: 44, uaN: -38, faN: 85, uaF: 40, faF: 80 }), // near-foot strike
    P({ rootY: 0.45, lean: 10, thN: 14, shN: 14, thF: -8, shF: 70, uaN: -18, faN: 80, uaF: 22, faF: 85 }), // support (low)
    P({ rootY: 0.462, lean: 11, thN: -8, shN: 16, thF: 20, shF: 52, uaN: 12, faN: 75, uaF: -8, faF: 82 }), // push-off
    P({ rootY: 0.5, lean: 11, thN: -28, shN: 48, thF: 36, shF: 14, uaN: 40, faN: 78, uaF: -36, faF: 88 }), // flight (high)
    P({ rootY: 0.468, lean: 10, thN: -26, shN: 44, thF: 34, shF: 10, uaN: 40, faN: 80, uaF: -38, faF: 85 }), // far-foot strike (mirror)
    P({ rootY: 0.45, lean: 10, thN: -8, shN: 70, thF: 14, shF: 14, uaN: 22, faN: 85, uaF: -18, faF: 80 }),
    P({ rootY: 0.462, lean: 11, thN: 20, shN: 52, thF: -8, shF: 16, uaN: -8, faN: 82, uaF: 12, faF: 75 }),
    P({ rootY: 0.5, lean: 11, thN: 36, shN: 14, thF: -28, shF: 48, uaN: -36, faN: 88, uaF: 40, faF: 78 }),
  ],
};

/**
 * Dribble (idle): 8 frames @ 12 fps. One full bounce per cycle.
 * Ball x ≈ 0.18 ahead; in hand f0–f2 (push), free f3–f5 (down/up), caught f6–f7.
 */
const dribbleIdle: AnimDef = {
  fps: 12,
  loop: true,
  frames: [
    P({ rootY: 0.452, lean: 8, headTilt: 4, thN: 18, shN: 26, thF: -12, shF: 18, uaN: 42, faN: 64, uaF: -16, faF: 22, ball: 'handN' }), // hand high
    P({ rootY: 0.448, lean: 8, headTilt: 4, thN: 19, shN: 28, thF: -12, shF: 18, uaN: 34, faN: 38, uaF: -16, faF: 22, ball: 'handN' }), // pushing down
    P({ rootY: 0.444, lean: 9, headTilt: 5, thN: 20, shN: 30, thF: -13, shF: 19, uaN: 26, faN: 12, uaF: -17, faF: 24, ball: 'handN' }), // release point
    P({ rootY: 0.442, lean: 9, headTilt: 5, thN: 20, shN: 30, thF: -13, shF: 19, uaN: 23, faN: 6, uaF: -17, faF: 24, ball: { x: 0.2, y: 0.16 } }), // ball falling
    P({ rootY: 0.44, lean: 10, headTilt: 6, thN: 21, shN: 32, thF: -13, shF: 19, uaN: 26, faN: 14, uaF: -18, faF: 26, ball: { x: 0.2, y: 0.05 } }), // floor!
    P({ rootY: 0.444, lean: 9, headTilt: 5, thN: 20, shN: 30, thF: -13, shF: 19, uaN: 31, faN: 28, uaF: -17, faF: 24, ball: { x: 0.2, y: 0.2 } }), // rising
    P({ rootY: 0.448, lean: 8, headTilt: 4, thN: 19, shN: 28, thF: -12, shF: 18, uaN: 36, faN: 46, uaF: -16, faF: 22, ball: { x: 0.19, y: 0.34 } }), // almost caught
    P({ rootY: 0.452, lean: 8, headTilt: 4, thN: 18, shN: 26, thF: -12, shF: 18, uaN: 41, faN: 58, uaF: -16, faF: 22, ball: 'handN' }), // caught
  ],
};

/** Dribble (moving): run legs + dribble arm, ball synced to the support phase. */
const dribbleRun: AnimDef = {
  fps: 12,
  loop: true,
  frames: [
    P({ rootY: 0.468, lean: 12, thN: 34, shN: 10, thF: -26, shF: 44, uaN: 40, faN: 60, uaF: 36, faF: 78, ball: 'handN' }),
    P({ rootY: 0.45, lean: 12, thN: 14, shN: 14, thF: -8, shF: 70, uaN: 32, faN: 34, uaF: 20, faF: 82, ball: 'handN' }),
    P({ rootY: 0.462, lean: 13, thN: -8, shN: 16, thF: 20, shF: 52, uaN: 25, faN: 10, uaF: -10, faF: 80, ball: { x: 0.26, y: 0.18 } }),
    P({ rootY: 0.5, lean: 13, thN: -28, shN: 48, thF: 36, shF: 14, uaN: 23, faN: 6, uaF: -32, faF: 85, ball: { x: 0.28, y: 0.05 } }),
    P({ rootY: 0.468, lean: 12, thN: -26, shN: 44, thF: 34, shF: 10, uaN: 27, faN: 16, uaF: -36, faF: 82, ball: { x: 0.28, y: 0.16 } }),
    P({ rootY: 0.45, lean: 12, thN: -8, shN: 70, thF: 14, shF: 14, uaN: 32, faN: 32, uaF: -16, faF: 80, ball: { x: 0.26, y: 0.3 } }),
    P({ rootY: 0.462, lean: 13, thN: 20, shN: 52, thF: -8, shF: 16, uaN: 37, faN: 50, uaF: 10, faF: 76, ball: 'handN' }),
    P({ rootY: 0.5, lean: 13, thN: 36, shN: 14, thF: -28, shF: 48, uaN: 41, faN: 58, uaF: 32, faF: 75, ball: 'handN' }),
  ],
};

/**
 * Shoot: 6 frames @ 12 fps, one-shot (~0.5 s). Release at frame 3 —
 * after that frame the ball is a world entity, the sprite stops drawing it.
 */
const shoot: AnimDef = {
  fps: 12,
  loop: false,
  frames: [
    P({ rootY: 0.43, lean: 4, thN: 22, shN: 30, thF: -14, shF: 26, uaN: 40, faN: 70, uaF: 20, faF: 60, ball: 'handN' }), // gather crouch
    P({ rootY: 0.445, lean: 2, thN: 16, shN: 22, thF: -10, shF: 20, uaN: 95, faN: 80, uaF: 40, faF: 50, ball: 'handN' }), // ball to chest
    P({ rootY: 0.54, lean: 0, thN: 6, shN: 8, thF: -4, shF: 8, uaN: 150, faN: 50, uaF: 30, faF: 30, ball: 'handN' }), // rising, ball up
    P({ rootY: 0.58, lean: -2, thN: 2, shN: 4, thF: -2, shF: 6, uaN: 175, faN: 12, uaF: 20, faF: 20 }), // RELEASE (snap)
    P({ rootY: 0.56, lean: -2, thN: 4, shN: 8, thF: -2, shF: 8, uaN: 170, faN: 8, uaF: 16, faF: 16 }), // follow-through
    P({ rootY: 0.48, lean: 0, thN: 10, shN: 16, thF: -6, shF: 14, uaN: 60, faN: 20, uaF: 10, faF: 14 }), // land
  ],
};

/**
 * Dunk: 8 frames @ 12 fps, one-shot (~0.67 s + server lock to 0.9 s).
 * Slam at frame 5. Ball glued to hand until the slam.
 */
const dunk: AnimDef = {
  fps: 12,
  loop: false,
  frames: [
    P({ rootY: 0.43, lean: 10, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 30, faN: 50, uaF: -10, faF: 30, ball: 'handN' }), // gather
    P({ rootY: 0.47, lean: 6, thN: 18, shN: 20, thF: -22, shF: 44, uaN: 60, faN: 60, uaF: -20, faF: 40, ball: 'handN' }), // leap drive
    P({ rootY: 0.64, lean: 0, thN: 30, shN: 50, thF: -10, shF: 60, uaN: 120, faN: 70, uaF: -24, faF: 44, ball: 'handN' }), // airborne, winding
    P({ rootY: 0.76, lean: -6, thN: 24, shN: 60, thF: -6, shF: 64, uaN: 165, faN: 60, uaF: -26, faF: 40, ball: 'handN' }), // peak, ball back
    P({ rootY: 0.78, lean: -4, thN: 20, shN: 55, thF: -8, shF: 60, uaN: 185, faN: 30, uaF: -20, faF: 36, ball: 'handN' }), // cocked overhead
    P({ rootY: 0.74, lean: 6, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 95, faN: 10, uaF: -10, faF: 30 }), // SLAM (snap)
    P({ rootY: 0.56, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 50, faN: 16, uaF: 0, faF: 24 }), // falling
    P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }), // land
  ],
};

/** Tomahawk: one arm cocks deep behind the head, chops through. */
const dunkTomahawk: AnimDef = {
  fps: 10,
  loop: false,
  frames: [
    P({ rootY: 0.43, lean: 10, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 30, faN: 50, uaF: -10, faF: 30, ball: 'handN' }),
    P({ rootY: 0.5, lean: 6, thN: 18, shN: 20, thF: -22, shF: 44, uaN: 70, faN: 60, uaF: -20, faF: 40, ball: 'handN' }),
    P({ rootY: 0.68, lean: -2, thN: 30, shN: 50, thF: -10, shF: 60, uaN: 130, faN: 70, uaF: -24, faF: 44, ball: 'handN' }),
    P({ rootY: 0.8, lean: -10, thN: 26, shN: 62, thF: -6, shF: 66, uaN: 195, faN: 55, uaF: -28, faF: 40, ball: 'handN' }), // deep cock
    P({ rootY: 0.82, lean: -12, thN: 24, shN: 60, thF: -8, shF: 62, uaN: 205, faN: 45, uaF: -26, faF: 38, ball: 'handN' }), // hang
    P({ rootY: 0.8, lean: -6, thN: 22, shN: 56, thF: -8, shF: 58, uaN: 160, faN: 25, uaF: -20, faF: 34, ball: 'handN' }), // whip begins
    P({ rootY: 0.74, lean: 8, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 85, faN: 8, uaF: -10, faF: 30 }), // SLAM
    P({ rootY: 0.55, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 45, faN: 16, uaF: 0, faF: 24 }),
    P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
  ],
};

/** Windmill: the arm sweeps a full circle — down, back, over the top. */
const dunkWindmill: AnimDef = {
  fps: 10,
  loop: false,
  frames: [
    P({ rootY: 0.43, lean: 12, thN: 28, shN: 36, thF: -16, shF: 28, uaN: 25, faN: 40, uaF: -12, faF: 28, ball: 'handN' }),
    P({ rootY: 0.52, lean: 8, thN: 20, shN: 24, thF: -22, shF: 46, uaN: -20, faN: 20, uaF: -16, faF: 36, ball: 'handN' }), // arm swings down-back
    P({ rootY: 0.7, lean: 0, thN: 30, shN: 52, thF: -10, shF: 60, uaN: -70, faN: 10, uaF: -20, faF: 40, ball: 'handN' }), // bottom of circle
    P({ rootY: 0.8, lean: -8, thN: 26, shN: 60, thF: -8, shF: 64, uaN: -140, faN: 5, uaF: -24, faF: 40, ball: 'handN' }), // behind
    P({ rootY: 0.83, lean: -10, thN: 24, shN: 58, thF: -8, shF: 62, uaN: 175, faN: 10, uaF: -26, faF: 38, ball: 'handN' }), // over the top (hang)
    P({ rootY: 0.8, lean: -4, thN: 22, shN: 54, thF: -10, shF: 58, uaN: 140, faN: 12, uaF: -22, faF: 36, ball: 'handN' }), // coming around
    P({ rootY: 0.74, lean: 8, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 80, faN: 8, uaF: -12, faF: 30 }), // SLAM
    P({ rootY: 0.55, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 45, faN: 16, uaF: 0, faF: 24 }),
    P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
  ],
};

/** Double Pump: ball thrusts up, pulls back to the chest, thrusts again. */
const dunkDoublePump: AnimDef = {
  fps: 10,
  loop: false,
  frames: [
    P({ rootY: 0.43, lean: 8, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 35, faN: 55, uaF: -12, faF: 30, ball: 'handN' }),
    P({ rootY: 0.55, lean: 2, thN: 22, shN: 30, thF: -18, shF: 40, uaN: 100, faN: 60, uaF: -16, faF: 36, ball: 'handN' }),
    P({ rootY: 0.72, lean: -4, thN: 28, shN: 52, thF: -10, shF: 58, uaN: 165, faN: 25, uaF: -20, faF: 40, ball: 'handN' }), // pump 1 up
    P({ rootY: 0.8, lean: -4, thN: 26, shN: 56, thF: -8, shF: 60, uaN: 95, faN: 80, uaF: -22, faF: 38, ball: 'handN' }), // pull back (hang)
    P({ rootY: 0.82, lean: -6, thN: 24, shN: 58, thF: -8, shF: 60, uaN: 110, faN: 70, uaF: -24, faF: 38, ball: 'handN' }), // holding
    P({ rootY: 0.79, lean: -2, thN: 22, shN: 54, thF: -10, shF: 56, uaN: 170, faN: 30, uaF: -20, faF: 36, ball: 'handN' }), // pump 2 up
    P({ rootY: 0.73, lean: 8, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 90, faN: 10, uaF: -12, faF: 30 }), // SLAM
    P({ rootY: 0.55, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 45, faN: 16, uaF: 0, faF: 24 }),
    P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
  ],
};

/** Reverse Jam: back arches away, ball slams behind the head. */
const dunkReverse: AnimDef = {
  fps: 10,
  loop: false,
  frames: [
    P({ rootY: 0.43, lean: 6, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 30, faN: 50, uaF: -10, faF: 28, ball: 'handN' }),
    P({ rootY: 0.54, lean: -4, thN: 20, shN: 26, thF: -20, shF: 42, uaN: 70, faN: 60, uaF: -18, faF: 34, ball: 'handN' }),
    P({ rootY: 0.7, lean: -14, thN: 26, shN: 50, thF: -12, shF: 56, uaN: 120, faN: 65, uaF: -22, faF: 40, ball: 'handN' }),
    P({ rootY: 0.8, lean: -22, thN: 22, shN: 56, thF: -10, shF: 60, uaN: 170, faN: 50, uaF: -26, faF: 42, ball: 'handN' }), // arched (hang)
    P({ rootY: 0.82, lean: -26, thN: 20, shN: 54, thF: -10, shF: 58, uaN: 190, faN: 35, uaF: -28, faF: 42, ball: 'handN' }), // peak arch
    P({ rootY: 0.79, lean: -18, thN: 18, shN: 50, thF: -12, shF: 54, uaN: 205, faN: 15, uaF: -24, faF: 40, ball: 'handN' }), // behind the head
    P({ rootY: 0.72, lean: -8, thN: 16, shN: 44, thF: -12, shF: 48, uaN: 215, faN: 5, uaF: -18, faF: 34 }), // SLAM (behind)
    P({ rootY: 0.55, lean: 0, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 60, faN: 16, uaF: -6, faF: 24 }),
    P({ rootY: 0.45, lean: 2, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
  ],
};

/** 360 Slam: lean and arm wrap whip side to side — reads as a spin. */
const dunk360: AnimDef = {
  fps: 10,
  loop: false,
  frames: [
    P({ rootY: 0.43, lean: 10, thN: 28, shN: 36, thF: -16, shF: 28, uaN: 30, faN: 45, uaF: -14, faF: 30, ball: 'handN' }),
    P({ rootY: 0.55, lean: 16, thN: 22, shN: 30, thF: -20, shF: 44, uaN: 60, faN: 55, uaF: 30, faF: 50, ball: 'handN' }), // wind up
    P({ rootY: 0.72, lean: -16, thN: 30, shN: 55, thF: -8, shF: 60, uaN: -40, faN: 30, uaF: -60, faF: 45, ball: 'handN' }), // whipping
    P({ rootY: 0.81, lean: 18, thN: 26, shN: 60, thF: -6, shF: 62, uaN: 90, faN: 65, uaF: 50, faF: 55, ball: 'handN' }), // mid-spin (hang)
    P({ rootY: 0.83, lean: -14, thN: 24, shN: 58, thF: -8, shF: 60, uaN: -30, faN: 40, uaF: -50, faF: 48, ball: 'handN' }), // around again
    P({ rootY: 0.8, lean: 4, thN: 22, shN: 54, thF: -10, shF: 56, uaN: 170, faN: 25, uaF: -20, faF: 36, ball: 'handN' }), // squared up
    P({ rootY: 0.74, lean: 8, thN: 16, shN: 45, thF: -10, shF: 50, uaN: 88, faN: 8, uaF: -12, faF: 30 }), // SLAM
    P({ rootY: 0.55, lean: 8, thN: 20, shN: 30, thF: -12, shF: 30, uaN: 45, faN: 16, uaF: 0, faF: 24 }),
    P({ rootY: 0.45, lean: 4, thN: 24, shN: 32, thF: -14, shF: 26, uaN: 20, faN: 20, uaF: 4, faF: 18 }),
  ],
};

/** Steal: 4f @ 16 fps one-shot — low lunge with a swipe. */
const steal: AnimDef = {
  fps: 16,
  loop: false,
  frames: [
    P({ rootY: 0.44, lean: 14, thN: 30, shN: 30, thF: -18, shF: 24, uaN: 20, faN: 30, uaF: -14, faF: 20 }),
    P({ rootY: 0.41, lean: 22, thN: 42, shN: 38, thF: -24, shF: 30, uaN: 55, faN: 10, uaF: -18, faF: 24 }), // swipe out
    P({ rootY: 0.42, lean: 18, thN: 36, shN: 34, thF: -20, shF: 26, uaN: 70, faN: 6, uaF: -16, faF: 22 }), // full extension
    P({ rootY: 0.45, lean: 10, thN: 24, shN: 26, thF: -14, shF: 20, uaN: 30, faN: 24, uaF: -12, faF: 18 }), // recover
  ],
};

/** Block: 4f @ 16 fps one-shot — vertical leap, wall of arms. */
const block: AnimDef = {
  fps: 16,
  loop: false,
  frames: [
    P({ rootY: 0.42, lean: 2, thN: 26, shN: 34, thF: -16, shF: 28, uaN: 60, faN: 60, uaF: -50, faF: 55 }), // crouch
    P({ rootY: 0.62, lean: 0, thN: 18, shN: 30, thF: -10, shF: 34, uaN: 160, faN: 15, uaF: -150, faF: 18 }), // leap
    P({ rootY: 0.72, lean: -2, thN: 14, shN: 36, thF: -8, shF: 38, uaN: 175, faN: 5, uaF: -168, faF: 8 }), // peak
    P({ rootY: 0.5, lean: 2, thN: 22, shN: 28, thF: -12, shF: 24, uaN: 90, faN: 20, uaF: -80, faF: 22 }), // land
  ],
};

/** Stunned: 4f @ 8 fps loop — woozy wobble. */
const stunned: AnimDef = {
  fps: 8,
  loop: true,
  frames: [
    P({ rootY: 0.43, lean: -6, headTilt: -12, thN: 14, shN: 24, thF: -10, shF: 18, uaN: -20, faN: 30, uaF: 24, faF: 28 }),
    P({ rootY: 0.425, lean: 4, headTilt: 10, thN: 16, shN: 26, thF: -12, shF: 20, uaN: -10, faN: 26, uaF: 16, faF: 30 }),
    P({ rootY: 0.43, lean: 8, headTilt: 14, thN: 14, shN: 24, thF: -10, shF: 18, uaN: 10, faN: 28, uaF: -12, faF: 26 }),
    P({ rootY: 0.425, lean: -2, headTilt: -8, thN: 16, shN: 26, thF: -12, shF: 20, uaN: 20, faN: 30, uaF: -22, faF: 28 }),
  ],
};

/** Celebrate: 4f @ 10 fps one-shot — both fists up. */
const celebrate: AnimDef = {
  fps: 10,
  loop: false,
  frames: [
    P({ rootY: 0.46, lean: -4, thN: 8, shN: 10, thF: -8, shF: 10, uaN: 40, faN: 70, uaF: -40, faF: 70 }),
    P({ rootY: 0.52, lean: -8, thN: 12, shN: 18, thF: -12, shF: 18, uaN: 150, faN: 30, uaF: -150, faF: 30 }),
    P({ rootY: 0.56, lean: -10, thN: 16, shN: 24, thF: -16, shF: 24, uaN: 170, faN: 10, uaF: -170, faF: 10 }), // peak fists
    P({ rootY: 0.48, lean: -4, thN: 8, shN: 12, thF: -8, shF: 12, uaN: 120, faN: 25, uaF: -120, faF: 25 }),
  ],
};

export const ANIMS = {
  idle,
  run,
  dribbleIdle,
  dribbleRun,
  shoot,
  dunk,
  dunkTomahawk,
  dunkWindmill,
  dunkDoublePump,
  dunkReverse,
  dunk360,
  steal,
  block,
  stunned,
  celebrate,
} as const;
export type AnimName = keyof typeof ANIMS;

/** Discrete frame playback (NBA-Jam snap — no tweening). */
export function frameIndex(anim: AnimDef, t: number): number {
  const i = Math.floor(t * anim.fps);
  return anim.loop ? i % anim.frames.length : Math.min(i, anim.frames.length - 1);
}
