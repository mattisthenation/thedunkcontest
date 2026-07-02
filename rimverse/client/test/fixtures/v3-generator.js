// generator.js — procedural NBA Jam–style big-head pixel-art sprite sheets.
//
// Every character is baked once into a single canvas sheet (7 animation rows
// × 6 columns of 96×128 frames). The figure is drawn by a small posable rig:
// limbs are fat-pixel line segments with outlines and shading, the head is
// deliberately enormous, and every visual knob (skin, hair, jersey colors,
// number, accessory, build) comes from the character config that the server
// sanitizes and persists.

export const SHEET = { frameW: 96, frameH: 128, cols: 6, rows: 7 };

const PX = 2;            // fat-pixel size: art grid is 48×64
const W = 48;
const GROUND = 62;       // feet line in art pixels

export const SKINS = [
  ['#ffd9b0', '#e0b489'], ['#f2c193', '#cf9a6b'], ['#d99e6a', '#b37c4d'],
  ['#b07442', '#8d5a31'], ['#8a5328', '#6b3d1d'], ['#5f3a1e', '#472a14'],
];
export const HAIR_COLORS = ['#16120e', '#4a2e15', '#c9a14a', '#933a1d', '#b8b8b8', '#2d5fd1'];
export const HAIR_STYLES = ['Bald', 'Short', 'Flat Top', 'Afro', 'Hi-Top Fade', 'Buzz', 'Cornrows', 'Mohawk'];
export const ACCESSORIES = ['None', 'Headband', 'Goggles', 'Wristbands', 'Sleeve'];
export const BUILDS = ['Slim', 'Athletic', 'Bulky'];

// Animation table; row index == ANIM wire code. `hold` freezes on the last
// frame instead of looping (jump/shoot/dunk are one-shot poses).
export const ANIMATIONS = {
  0: { row: 0, start: 0, frames: 4, speed: 0.28 },              // idle
  1: { row: 1, start: 0, frames: 6, speed: 0.09 },              // run
  2: { row: 2, start: 0, frames: 6, speed: 0.09 },              // dribble
  3: { row: 3, start: 0, frames: 4, speed: 0.12, hold: true },  // jump
  4: { row: 4, start: 0, frames: 4, speed: 0.1, hold: true },   // shoot
  5: { row: 5, start: 0, frames: 6, speed: 0.13, hold: true },  // dunk
  6: { row: 6, start: 0, frames: 6, speed: 0.12 },              // celebrate
};

export function generateSpriteSheet(character = {}) {
  const cfg = withDefaults(character);
  const canvas = document.createElement('canvas');
  canvas.width = SHEET.frameW * SHEET.cols;
  canvas.height = SHEET.frameH * SHEET.rows;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const rows = [idleFrames(), runFrames(), dribbleFrames(), jumpFrames(), shootFrames(), dunkFrames(), celebrateFrames()];
  rows.forEach((frames, row) => {
    frames.forEach((pose, col) => {
      ctx.save();
      ctx.translate(col * SHEET.frameW, row * SHEET.frameH);
      drawFigure(ctx, cfg, pose);
      ctx.restore();
    });
  });

  return { canvas, animations: ANIMATIONS, cfg };
}

// Render one frame standalone (character creator preview).
export function renderPreview(character, animCode = 0, frame = 0, scale = 2) {
  const cfg = withDefaults(character);
  const canvas = document.createElement('canvas');
  canvas.width = SHEET.frameW * scale;
  canvas.height = SHEET.frameH * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const rows = { 0: idleFrames, 1: runFrames, 2: dribbleFrames, 3: jumpFrames, 4: shootFrames, 5: dunkFrames, 6: celebrateFrames };
  const frames = (rows[animCode] || idleFrames)();
  const tmp = document.createElement('canvas');
  tmp.width = SHEET.frameW; tmp.height = SHEET.frameH;
  const tctx = tmp.getContext('2d');
  drawFigure(tctx, cfg, frames[frame % frames.length]);
  ctx.scale(scale, scale);
  ctx.drawImage(tmp, 0, 0);
  return canvas;
}

function withDefaults(c) {
  return {
    skin: c.skin ?? 2, hair: c.hair ?? 1, hairColor: c.hairColor ?? 0,
    jersey: c.jersey ?? '#e8432e', jersey2: c.jersey2 ?? '#f5f0e0',
    shorts: c.shorts ?? c.jersey ?? '#e8432e', shoes: c.shoes ?? '#f5f0e0',
    number: c.number ?? 23, accessory: c.accessory ?? 0, build: c.build ?? 1,
  };
}

// ---- pose tables ---------------------------------------------------------
// Angles in degrees, 0 = straight down, 90 = forward (facing +x), 180 = up,
// negative = behind. Arms: [upperAngle, lowerAngle]; legs likewise.

function idleFrames() {
  return [0, 1, 2, 1].map((i) => ({
    crouch: i === 2 ? 1 : 0, lean: 0,
    armF: [8, 4], armB: [-8, -4],
    legF: [4, 2], legB: [-4, -2],
    headBob: i === 2 ? 1 : 0,
  }));
}

function runFrames() {
  // 6-frame stride cycle.
  const stride = [
    { f: [55, 95], b: [-40, 15] }, { f: [25, 50], b: [-15, 25] },
    { f: [-15, 10], b: [25, 80] }, { f: [-40, 15], b: [55, 95] },
    { f: [-15, 25], b: [25, 50] }, { f: [25, 80], b: [-15, 10] },
  ];
  return stride.map((s, i) => ({
    crouch: i % 3 === 1 ? 1 : 0, lean: 3,
    armF: [s.b[0] * 0.8, s.b[0] * 0.8 + 35], armB: [s.f[0] * 0.8, s.f[0] * 0.8 + 35],
    legF: s.f, legB: s.b,
    headBob: i % 3 === 1 ? 1 : 0,
  }));
}

function dribbleFrames() {
  const base = runFrames();
  return base.map((p, i) => ({
    ...p,
    // Front arm works the ball: pump down in front, synced to the bounce.
    armF: i % 3 === 0 ? [50, 25] : i % 3 === 1 ? [40, 5] : [55, 35],
  }));
}

function jumpFrames() {
  return [
    { crouch: 4, lean: 2, armF: [-30, -50], armB: [-40, -60], legF: [25, -35], legB: [25, -35], headBob: 1 },
    { crouch: 0, lean: 1, armF: [150, 170], armB: [120, 140], legF: [15, -20], legB: [-10, -30], rise: 2 },
    { crouch: 0, lean: 0, armF: [165, 180], armB: [140, 160], legF: [30, -50], legB: [-20, -45], rise: 3 },
    { crouch: 0, lean: 0, armF: [120, 140], armB: [90, 110], legF: [15, -10], legB: [-5, -15], rise: 1 },
  ];
}

function shootFrames() {
  return [
    { crouch: 3, lean: 0, armF: [45, 110], armB: [35, 100], legF: [15, -20], legB: [-10, -15], headBob: 1 },
    { crouch: 1, lean: 0, armF: [120, 165], armB: [100, 150], legF: [8, -8], legB: [-5, -8] },
    { crouch: 0, lean: -1, armF: [165, 185], armB: [80, 100], legF: [12, -15], legB: [-8, -12], rise: 2 },
    { crouch: 0, lean: -1, armF: [170, 200], armB: [40, 30], legF: [8, -8], legB: [-5, -8], rise: 1 },
  ];
}

function dunkFrames() {
  return [
    { crouch: 3, lean: 4, armF: [-60, -90], armB: [30, 50], legF: [30, 60], legB: [-25, 10], headBob: 1 },
    { crouch: 0, lean: 3, armF: [-90, -140], armB: [60, 90], legF: [40, -40], legB: [-30, -20], rise: 2 },
    { crouch: 0, lean: 2, armF: [-130, -180], armB: [90, 120], legF: [50, -60], legB: [-35, -30], rise: 3 },
    { crouch: 0, lean: 0, armF: [200, 230], armB: [120, 150], legF: [45, -55], legB: [-30, -40], rise: 3 },
    { crouch: 0, lean: -2, armF: [140, 120], armB: [100, 80], legF: [25, -30], legB: [-15, -25], rise: 2 },
    { crouch: 2, lean: 0, armF: [30, 15], armB: [-20, -10], legF: [20, -25], legB: [-15, -20], headBob: 1 },
  ];
}

function celebrateFrames() {
  return [0, 1, 2, 1, 0, 3].map((i) => ({
    crouch: i === 0 ? 2 : 0, lean: 0,
    armF: i === 0 ? [60, 100] : [160 + i * 8, 180 + i * 8],
    armB: i === 0 ? [-60, -100] : [150 + i * 6, 170 + i * 6],
    legF: i === 0 ? [10, -15] : [20, -30], legB: i === 0 ? [-10, -12] : [-20, -25],
    rise: i === 0 ? 0 : i, headBob: i === 0 ? 1 : 0,
  }));
}

// ---- figure renderer -----------------------------------------------------

function drawFigure(ctx, cfg, pose) {
  const g = new Grid(ctx);
  const [skin, skinDark] = SKINS[cfg.skin] || SKINS[2];
  const hairC = HAIR_COLORS[cfg.hairColor] || HAIR_COLORS[0];
  const torsoW = cfg.build === 0 ? 11 : cfg.build === 2 ? 15 : 13;

  // `rise` is mostly cosmetic — the sprite's world position carries the real
  // jump height — so keep it small to protect headroom for the big head.
  const rise = (pose.rise || 0);
  const baseY = GROUND - rise;
  const crouch = pose.crouch || 0;
  const hipY = baseY - 20 + crouch;
  const cx = 24 + (pose.lean || 0) * 0.5;

  const shoulderY = hipY - 14 + (pose.headBob || 0);
  const shoulderX = cx + (pose.lean || 0);

  // Far (back) limbs first, darkened.
  g.limb(shoulderX - 2, shoulderY + 1, pose.armB, 7, 6, 3, shade(skin, 0.72), shade(skinDark, 0.72), shade(cfg.jersey, 0.72), cfg, true);
  g.leg(cx - 2, hipY, pose.legB, shade(skin, 0.78), shade(cfg.shorts, 0.78), shade(cfg.shoes, 0.78), baseY);

  // Torso (jersey) + shorts.
  const torsoTop = shoulderY - 1;
  g.rect(cx - torsoW / 2, torsoTop, torsoW, hipY - torsoTop, cfg.jersey);
  g.rect(cx - torsoW / 2, hipY - 3, torsoW, 3, shade(cfg.jersey, 0.82));
  g.rect(cx - torsoW / 2 - 1, hipY, torsoW + 2, 6, cfg.shorts);
  g.rect(cx - torsoW / 2 - 1, hipY + 4, torsoW + 2, 2, shade(cfg.shorts, 0.8));
  g.outline(cx - torsoW / 2, torsoTop, torsoW, hipY - torsoTop + 6);
  // Jersey trim + number.
  g.rect(cx - torsoW / 2, torsoTop, torsoW, 1, cfg.jersey2);
  g.number(cx, torsoTop + 4, cfg.number, cfg.jersey2);

  // Near (front) leg.
  g.leg(cx + 2, hipY, pose.legF, skin, cfg.shorts, cfg.shoes, baseY);

  // Head — the NBA Jam part. Enormous.
  const headBob = pose.headBob || 0;
  const headH = 20, headW = 22;
  const hx = cx - 10 + (pose.lean || 0);
  const hy = torsoTop - headH - 1 + headBob;
  g.head(hx, hy, headW, headH, skin, skinDark, hairC, cfg);

  // Near (front) arm last, on top of everything.
  g.limb(shoulderX + 2, shoulderY + 1, pose.armF, 7, 6, 3, skin, skinDark, cfg.jersey, cfg, false);
}

class Grid {
  constructor(ctx) { this.ctx = ctx; }

  px(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x) * PX, Math.round(y) * PX, PX, PX);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x) * PX, Math.round(y) * PX, Math.round(w) * PX, Math.round(h) * PX);
  }

  outline(x, y, w, h) {
    this.ctx.strokeStyle = '#101010';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(Math.round(x) * PX - 0.5, Math.round(y) * PX - 0.5, Math.round(w) * PX + 1, Math.round(h) * PX + 1);
  }

  // Thick pixel line for limb segments.
  seg(x0, y0, x1, y1, t, color) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (x1 - x0) * (i / steps);
      const y = y0 + (y1 - y0) * (i / steps);
      this.rect(x - t / 2, y - t / 2, t, t, color);
    }
  }

  // Two-segment arm. Sleeve covers the shoulder; wristband/sleeve accessories.
  limb(sx, sy, [a1, a2], len1, len2, t, skin, skinDark, jersey, cfg, isFar) {
    const r1 = rad(a1), r2 = rad(a2);
    const ex = sx + Math.sin(r1) * len1;
    const ey = sy + Math.cos(r1) * len1;
    const hxp = ex + Math.sin(r2) * len2;
    const hyp = ey + Math.cos(r2) * len2;
    const sleeve = cfg.accessory === 4 && !isFar;
    // Outline pass.
    this.seg(sx, sy, ex, ey, t + 1.6, '#101010');
    this.seg(ex, ey, hxp, hyp, t + 1.4, '#101010');
    // Fill.
    this.seg(sx, sy, ex, ey, t, sleeve ? cfg.jersey2 : skin);
    this.seg(ex, ey, hxp, hyp, t - 0.6, sleeve ? cfg.jersey2 : skin);
    // Shoulder cap in jersey color.
    this.rect(sx - t / 2 - 0.5, sy - t / 2 - 1, t + 1, 3, jersey);
    // Hand.
    this.rect(hxp - 1.5, hyp - 1.5, 3, 3, skinDark);
    if (cfg.accessory === 3) this.rect(hxp - 2, hyp - 3, 4, 2, cfg.jersey2); // wristband
  }

  leg(hx, hy, [a1, a2], skin, shorts, shoe, groundY) {
    const len1 = 9, len2 = 8, t = 4;
    const r1 = rad(a1), r2 = rad(a2);
    const kx = hx + Math.sin(r1) * len1;
    const ky = hy + Math.cos(r1) * len1;
    const fx = kx + Math.sin(r2) * len2;
    const fy = Math.min(ky + Math.cos(r2) * len2, groundY - 1);
    this.seg(hx, hy, kx, ky, t + 1.6, '#101010');
    this.seg(kx, ky, fx, fy, t + 1.2, '#101010');
    this.seg(hx, hy, kx, ky, t, skin);
    this.seg(kx, ky, fx, fy, t - 1, skin);
    // Big arcade sneaker, pointing forward.
    this.rect(fx - 2, fy - 1, 7, 3, shoe);
    this.rect(fx - 2, fy + 1, 7, 1.4, '#ffffff');
    this.outlineShoe(fx - 2, fy - 1, 7, 3);
  }

  outlineShoe(x, y, w, h) {
    this.ctx.strokeStyle = '#101010';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(Math.round(x) * PX - 0.5, Math.round(y) * PX - 0.5, Math.round(w) * PX + 1, Math.round(h) * PX + 1);
  }

  head(hx, hy, w, h, skin, skinDark, hairC, cfg) {
    // Skull.
    this.rect(hx, hy, w, h, skin);
    this.rect(hx, hy + h - 3, w, 3, skinDark);            // jaw shade
    this.rect(hx + w, hy + 8, 1, 3, skin);                 // nose bump (facing right)
    this.px(hx + w, hy + 10, skinDark);
    // Ear.
    this.rect(hx + 5, hy + 8, 2, 4, skinDark);
    // Eye + brow (big and expressive).
    this.rect(hx + w - 7, hy + 7, 4, 3, '#ffffff');
    this.rect(hx + w - 5, hy + 8, 2, 2, '#101010');
    this.rect(hx + w - 8, hy + 5, 6, 1.4, '#101010');
    // Mouth — competitive grimace.
    this.rect(hx + w - 8, hy + 13, 6, 1.4, '#101010');
    this.px(hx + w - 3, hy + 12, skinDark);

    // Hair.
    const styles = {
      1: () => { this.rect(hx - 1, hy - 1, w - 4, 5, hairC); this.rect(hx - 1, hy + 2, 4, 8, hairC); },
      2: () => { this.rect(hx - 1, hy - 4, w - 2, 7, hairC); },
      3: () => {
        // Afro: a big rounded halo around the skull.
        this.rect(hx - 3, hy - 6, w + 5, 11, hairC);
        this.rect(hx - 5, hy - 3, w + 9, 7, hairC);
        this.rect(hx - 1, hy - 8, w + 1, 4, hairC);
      },
      4: () => { this.rect(hx + 1, hy - 7, w - 7, 9, hairC); },
      5: () => { this.rect(hx - 1, hy - 1, w - 3, 3, hairC); },
      6: () => {
        this.rect(hx - 1, hy - 1, w - 4, 4, hairC);
        for (let i = 0; i < 4; i++) this.rect(hx + 1 + i * 4, hy - 1, 1, 4, shade(hairC, 1.6));
        this.rect(hx - 1, hy + 2, 4, 9, hairC);
      },
      7: () => { this.rect(hx + 4, hy - 6, 6, 7, hairC); },
    };
    (styles[cfg.hair] || (() => {}))();

    // Accessories.
    if (cfg.accessory === 1) this.rect(hx - 1, hy + 4, w + 1, 2.4, cfg.jersey);          // headband
    if (cfg.accessory === 2) {                                                            // goggles
      this.rect(hx + 4, hy + 6, w - 6, 1.4, '#101010');
      this.rect(hx + w - 8, hy + 6, 6, 5, 'rgba(120,200,255,0.55)');
      this.outline(hx + w - 8, hy + 6, 6, 5);
    }
    this.outline(hx, hy, w, h);
  }

  // Tiny 3×5 digit font for the jersey number.
  number(cx, y, num, color) {
    const s = String(Math.abs(num) % 100);
    const totalW = s.length * 4 - 1;
    let x = cx - totalW / 2;
    for (const ch of s) {
      this.digit(x, y, DIGITS[ch], color);
      x += 4;
    }
  }

  digit(x, y, rows, color) {
    rows.forEach((bits, dy) => {
      for (let dx = 0; dx < 3; dx++) {
        if (bits & (4 >> dx)) this.px(x + dx, y + dy, color);
      }
    });
  }
}

const DIGITS = {
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2],
  8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
};

function rad(deg) { return (deg * Math.PI) / 180; }

export function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}
