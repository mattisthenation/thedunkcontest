// stage.js — Street Fighter–style stage dressing. Each court definition
// picks a backdrop painter, a ground treatment, a prop list, and an ambient
// particle system; everything is procedural (canvas textures + primitive
// meshes), so a new location is data in shared/courts.js, not new art files.

import * as THREE from 'three';
import { COURT } from '/shared/constants.js';
import { disposeGroup } from './world.js';

const WALL_RADIUS = 52;
const WALL_HEIGHT = 44;

export class Stage {
  constructor(scene, def) {
    this.scene = scene;
    this.def = def;
    this.group = new THREE.Group();
    this.particles = null;
    this.gulls = [];
    this.t = 0;

    this.buildBackdrop();
    this.buildGround();
    this.buildProps();
    this.buildParticles();
    scene.add(this.group);
  }

  dispose() {
    disposeGroup(this.scene, this.group);
  }

  // ---- backdrop: painted canvas wrapped on an inward-facing cylinder -----

  buildBackdrop() {
    const c = document.createElement('canvas');
    c.width = 4096; c.height = 1024;
    const ctx = c.getContext('2d');
    const painter = BACKDROPS[this.def.backdrop] || BACKDROPS.cityNight;
    painter(ctx, c.width, c.height, this.def);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.CylinderGeometry(WALL_RADIUS, WALL_RADIUS, WALL_HEIGHT, 64, 1, true);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
    const wall = new THREE.Mesh(geo, mat);
    wall.position.y = WALL_HEIGHT / 2 - 6;
    this.group.add(wall);
  }

  buildGround() {
    const colors = {
      cityNight: '#2a2a30', beach: '#d9bd86', neonSkyline: '#1c1b24',
      favelaHill: '#7a6a52', parisDusk: '#3c3f52', aurora: '#dfe9f2',
    };
    const mat = new THREE.MeshStandardMaterial({
      color: colors[this.def.backdrop] || '#333',
      roughness: 1,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(WALL_RADIUS, 48), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  // ---- props --------------------------------------------------------------

  buildProps() {
    for (const id of this.def.props || []) {
      const builder = PROPS[id];
      if (builder) this.group.add(builder(this.def));
    }
  }

  // ---- ambient particles ---------------------------------------------------

  buildParticles() {
    const kind = this.def.particles;
    if (!kind) return;
    if (kind === 'gulls') return this.buildGulls();

    const conf = {
      snow: { n: 900, color: 0xffffff, size: 0.16, fall: 1.6, drift: 0.6, opacity: 0.9 },
      neonRain: { n: 700, color: 0x9fd4ff, size: 0.1, fall: 14, drift: 0, opacity: 0.5 },
      confetti: { n: 350, color: 0xffffff, size: 0.14, fall: 0.9, drift: 1.4, opacity: 0.95, multi: true },
    }[kind];
    if (!conf) return;

    const pos = new Float32Array(conf.n * 3);
    const col = new Float32Array(conf.n * 3);
    const palette = [0xff5a5a, 0xffd23c, 0x4cd964, 0x4ca6ff, 0xff6ad5].map((h) => new THREE.Color(h));
    for (let i = 0; i < conf.n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      const cc = conf.multi ? palette[i % palette.length] : new THREE.Color(conf.color);
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: conf.size, vertexColors: true, transparent: true,
      opacity: conf.opacity, depthWrite: false,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.userData = conf;
    this.group.add(this.particles);
  }

  buildGulls() {
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const ctx = c.getContext('2d');
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(6, 24); ctx.quadraticCurveTo(20, 6, 32, 20); ctx.quadraticCurveTo(44, 6, 58, 24);
      ctx.stroke();
      const tex = new THREE.CanvasTexture(c);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false }));
      s.scale.set(1.6, 0.8, 1);
      s.userData = { phase: i * 1.7, r: 18 + i * 5, h: 12 + i * 2.5, speed: 0.12 + i * 0.03 };
      this.gulls.push(s);
      this.group.add(s);
    }
  }

  update(dt) {
    this.t += dt;
    if (this.particles) {
      const { fall, drift } = this.particles.userData;
      const arr = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= fall * dt;
        arr[i] += Math.sin(this.t * 1.3 + i) * drift * dt;
        if (arr[i + 1] < 0) {
          arr[i + 1] = 28 + Math.random() * 4;
          arr[i] = (Math.random() - 0.5) * 70;
          arr[i + 2] = (Math.random() - 0.5) * 80;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
    for (const g of this.gulls) {
      const u = g.userData;
      const a = this.t * u.speed + u.phase;
      g.position.set(Math.cos(a) * u.r, u.h + Math.sin(this.t * 0.7 + u.phase) * 1.2, Math.sin(a) * u.r);
    }
  }
}

// ---- backdrop painters -----------------------------------------------------

const BACKDROPS = {
  cityNight(ctx, w, h) {
    skyFill(ctx, w, h, '#0e1430', '#d8722c');
    stars(ctx, w, h * 0.4, 140);
    skyline(ctx, w, h, [
      { base: 0.94, min: 0.32, max: 0.62, width: [70, 140], color: '#080a16', lit: '#ffd9a0', litChance: 0.35 },
      { base: 0.96, min: 0.18, max: 0.4, width: [90, 180], color: '#10142a', lit: '#9fb4ff', litChance: 0.2 },
    ]);
  },

  beach(ctx, w, h) {
    skyFill(ctx, w, h, '#3d9be0', '#ffd9a8');
    // Sun.
    glow(ctx, w * 0.7, h * 0.55, 90, '#fff3d6');
    // Ocean band + sand.
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(0, h * 0.62, w, h * 0.16);
    ctx.fillStyle = '#3f97c2';
    ctx.fillRect(0, h * 0.62, w, h * 0.04);
    ctx.fillStyle = '#d9bd86';
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    // Distant hills.
    ctx.fillStyle = 'rgba(90,110,140,0.55)';
    hillRange(ctx, w, h * 0.62, h * 0.12, 5);
  },

  neonSkyline(ctx, w, h) {
    skyFill(ctx, w, h, '#070918', '#3b1e5e');
    stars(ctx, w, h * 0.35, 90);
    skyline(ctx, w, h, [
      { base: 0.97, min: 0.3, max: 0.75, width: [60, 120], color: '#0b0918', lit: '#ff4fd2', litChance: 0.45 },
      { base: 0.99, min: 0.2, max: 0.5, width: [80, 150], color: '#141028', lit: '#54f0ff', litChance: 0.4 },
    ]);
    // Neon haze.
    glow(ctx, w * 0.25, h * 0.8, 160, 'rgba(255,79,210,0.25)');
    glow(ctx, w * 0.6, h * 0.85, 200, 'rgba(84,240,255,0.2)');
    glow(ctx, w * 0.85, h * 0.8, 150, 'rgba(255,201,40,0.18)');
  },

  favelaHill(ctx, w, h) {
    skyFill(ctx, w, h, '#2f86d6', '#ffe9b8');
    glow(ctx, w * 0.3, h * 0.3, 80, '#fff8e0');
    // Hillside of stacked painted houses.
    const palette = ['#e8743c', '#3fa05c', '#3c7fe8', '#e8b23c', '#c25ba8', '#5bc2b8'];
    for (let band = 0; band < 5; band++) {
      const yBase = h * (0.5 + band * 0.11);
      for (let x = 0; x < w; x += 36 + Math.random() * 30) {
        const hh = 30 + Math.random() * 50;
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        ctx.fillRect(x, yBase - hh, 30 + Math.random() * 26, hh);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, yBase - hh, 8, hh);
      }
    }
  },

  parisDusk(ctx, w, h) {
    skyFill(ctx, w, h, '#5a7bb5', '#f4c8a8');
    // Haussmann rooflines.
    skyline(ctx, w, h, [
      { base: 0.95, min: 0.22, max: 0.38, width: [120, 220], color: '#3a3d55', lit: '#ffe6c8', litChance: 0.25, mansard: true },
    ]);
    // The Tower.
    const tx = w * 0.18, base = h * 0.95, th = h * 0.78;
    ctx.strokeStyle = '#2b2d40';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(tx - 90, base); ctx.quadraticCurveTo(tx - 14, base - th * 0.55, tx, base - th);
    ctx.quadraticCurveTo(tx + 14, base - th * 0.55, tx + 90, base);
    ctx.stroke();
    ctx.lineWidth = 6;
    for (const f of [0.22, 0.42, 0.62]) {
      const yy = base - th * f;
      const spread = 78 * (1 - f) + 12;
      line(ctx, tx - spread, yy, tx + spread, yy);
    }
  },

  aurora(ctx, w, h) {
    skyFill(ctx, w, h, '#03070f', '#10243c');
    stars(ctx, w, h * 0.6, 240);
    // Aurora ribbons.
    for (let r = 0; r < 3; r++) {
      const baseY = h * (0.18 + r * 0.1);
      const grad = ctx.createLinearGradient(0, baseY - 60, 0, baseY + 120);
      const tone = r === 1 ? '120,255,190' : r === 2 ? '90,200,255' : '160,255,160';
      grad.addColorStop(0, `rgba(${tone},0)`);
      grad.addColorStop(0.4, `rgba(${tone},0.35)`);
      grad.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= w; x += 60) {
        ctx.lineTo(x, baseY + Math.sin(x * 0.004 + r * 2) * 50);
      }
      ctx.lineTo(w, baseY + 130); ctx.lineTo(0, baseY + 130);
      ctx.fill();
    }
    // Snowfield horizon + pines.
    ctx.fillStyle = '#dfe9f2';
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
    ctx.fillStyle = '#0c1a26';
    for (let x = 0; x < w; x += 26) {
      const hh = 36 + Math.random() * 50;
      tri(ctx, x, h * 0.88, 22, hh);
    }
  },
};

// ---- prop builders --------------------------------------------------------

const PROPS = {
  cageFence() {
    const g = new THREE.Group();
    const H = 5.5;
    const mk = (wdt, x, z, ry) => {
      const tex = chainLinkTexture();
      tex.repeat.set(wdt / 2, H / 2);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(wdt, H),
        new THREE.MeshBasicMaterial({
          map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9,
        }),
      );
      m.position.set(x, H / 2, z);
      m.rotation.y = ry;
      return m;
    };
    const X = COURT.halfWidth + 2.5, Z = COURT.halfLength + 2.5;
    g.add(mk(Z * 2, X, 0, Math.PI / 2));
    g.add(mk(Z * 2, -X, 0, Math.PI / 2));
    g.add(mk(X * 2, 0, Z, 0));
    g.add(mk(X * 2, 0, -Z, 0));
    // Posts.
    const postMat = new THREE.MeshStandardMaterial({ color: 0x444a55, metalness: 0.7, roughness: 0.4 });
    for (const [px, pz] of [[X, Z], [X, -Z], [-X, Z], [-X, -Z], [X, 0], [-X, 0], [0, Z], [0, -Z]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, H, 8), postMat);
      post.position.set(px, H / 2, pz);
      g.add(post);
    }
    return g;
  },

  streetLamps() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c2c33, metalness: 0.6, roughness: 0.5 });
    for (const [x, z] of [[-14, -10], [-14, 10]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 7, 8), mat);
      pole.position.set(x, 3.5, z);
      g.add(pole);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
      );
      head.position.set(x, 7, z);
      g.add(head);
      const light = new THREE.PointLight(0xffd9a0, 18, 26, 1.8);
      light.position.set(x, 7, z);
      g.add(light);
    }
    return g;
  },

  graffitiWall() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(0, 0, 1024, 256);
    const colors = ['#ff4fd2', '#54f0ff', '#ffc928', '#4cd964', '#ff5a4e'];
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 8 + Math.random() * 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const x = Math.random() * 1024, y = 40 + Math.random() * 170;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 60, y - 50, x + 120, y + 50, x + 180, y - 10);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 6.5),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }),
    );
    wall.position.set(16, 3.25, 0);
    wall.rotation.y = -Math.PI / 2;
    return wall;
  },

  palms() {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d3f, roughness: 1 });
    for (const [x, z, h] of [[-13.5, -12, 6], [-14.5, 0, 7], [-13.5, 12, 6.5], [15, -8, 7], [15, 8, 6]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, h, 7), trunkMat);
      trunk.position.set(x, h / 2, z);
      trunk.rotation.z = (Math.random() - 0.5) * 0.16;
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 6; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.6, 5), frondMat);
        const a = (i / 6) * Math.PI * 2;
        frond.position.set(x + Math.cos(a) * 1.0, h + 0.2, z + Math.sin(a) * 1.0);
        frond.rotation.set(Math.sin(a) * 1.25, 0, Math.cos(a) * -1.25);
        g.add(frond);
      }
    }
    return g;
  },

  lifeguardTower() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xd97f4a, roughness: 0.9 });
    const hut = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.2), wood);
    hut.position.set(16, 3.4, -13);
    g.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 4),
      new THREE.MeshStandardMaterial({ color: 0xe8432e, roughness: 0.8 }));
    roof.position.set(16, 4.8, -13);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    for (const [dx, dz] of [[-1, -0.8], [1, -0.8], [-1, 0.8], [1, 0.8]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), wood);
      leg.position.set(16 + dx, 1.3, -13 + dz);
      g.add(leg);
    }
    return g;
  },

  muscleBeachSign() {
    const sign = textBoard('VENICE  BEACH', '#11324a', '#ffd9a8', 30);
    sign.position.set(17, 6, 5);
    sign.rotation.y = -Math.PI / 2;
    sign.scale.set(8, 2, 1);
    return sign;
  },

  neonSigns() {
    const g = new THREE.Group();
    const texts = [
      ['ダンク!', '#ff4fd2', 14, 7, 3, -Math.PI / 2],
      ['バスケ', '#54f0ff', 14, 5.4, -8, -Math.PI / 2],
      ['TOKYO', '#ffc928', 14, 8.2, -2, -Math.PI / 2],
      ['炎', '#ff5a4e', -15, 6, 9, Math.PI / 2],
    ];
    for (const [txt, color, x, y, z, ry] of texts) {
      const board = textBoard(txt, '#0a0a14', color, 44, true);
      board.position.set(x, y, z);
      board.rotation.y = ry;
      board.scale.set(3.6, 1.5, 1);
      g.add(board);
    }
    const glowL = new THREE.PointLight(0xff4fd2, 10, 24, 1.8);
    glowL.position.set(12, 6, 2);
    g.add(glowL);
    return g;
  },

  rooftopRail() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x55596a, metalness: 0.7, roughness: 0.35 });
    const X = COURT.halfWidth + 3, Z = COURT.halfLength + 3;
    for (const [w, x, z, ry] of [[Z * 2, X, 0, Math.PI / 2], [Z * 2, -X, 0, Math.PI / 2], [X * 2, 0, Z, 0], [X * 2, 0, -Z, 0]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), mat);
      rail.position.set(x, 1.1, z);
      rail.rotation.y = ry;
      g.add(rail);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.05), mat);
      kick.position.set(x, 0.15, z);
      kick.rotation.y = ry;
      g.add(kick);
    }
    return g;
  },

  acUnits() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa0ab, metalness: 0.4, roughness: 0.6 });
    for (const [x, z] of [[14, -12], [15.5, -9], [14.5, 11], [-14, -13]]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.2), mat);
      box.position.set(x, 0.55, z);
      box.castShadow = true;
      g.add(box);
    }
    return g;
  },

  vendingMachines() {
    const g = new THREE.Group();
    for (const [x, z, color] of [[-14.5, 6, 0xe8432e], [-14.5, 7.6, 0x2e6fe8]]) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.9, 0.8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.25 }),
      );
      m.position.set(x, 0.95, z);
      g.add(m);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 1.2),
        new THREE.MeshBasicMaterial({ color: 0xcfe8ff }),
      );
      panel.position.set(x + 0.46, 1.1, z);
      panel.rotation.y = Math.PI / 2;
      g.add(panel);
    }
    return g;
  },

  stringLights() {
    const g = new THREE.Group();
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        const x = -12 + 24 * t;
        const y = 7.5 - Math.sin(t * Math.PI) * 1.6;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), bulbMat);
        bulb.position.set(x, y, s * 8);
        g.add(bulb);
      }
    }
    const warm = new THREE.PointLight(0xffe9b0, 12, 30, 1.6);
    warm.position.set(0, 8, 0);
    g.add(warm);
    return g;
  },

  muralWall() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#e8b23c'); grad.addColorStop(0.5, '#3fa05c'); grad.addColorStop(1, '#3c7fe8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `hsl(${Math.random() * 360},75%,60%)`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 256, 14 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 6),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }),
    );
    wall.position.set(15.5, 3, 0);
    wall.rotation.y = -Math.PI / 2;
    return wall;
  },

  hillHouses() {
    const g = new THREE.Group();
    const palette = [0xe8743c, 0x3fa05c, 0x3c7fe8, 0xe8b23c, 0xc25ba8];
    let i = 0;
    for (let row = 0; row < 3; row++) {
      for (let z = -16; z <= 16; z += 4.2) {
        const w = 2.6 + Math.random() * 1.4, hh = 2 + Math.random() * 2.4;
        const x = 18 + row * 4.5;
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(w, hh, 3.4),
          new THREE.MeshStandardMaterial({ color: palette[i++ % palette.length], roughness: 0.95 }),
        );
        m.position.set(x, hh / 2 + row * 2.4, z + (Math.random() - 0.5));
        g.add(m);
      }
    }
    return g;
  },

  mansardEdge() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3c3f57, roughness: 0.9 });
    const X = COURT.halfWidth + 3.2, Z = COURT.halfLength + 3.2;
    for (const [w, x, z, ry] of [[Z * 2, X, 0, Math.PI / 2], [Z * 2, -X, 0, Math.PI / 2], [X * 2, 0, Z, 0], [X * 2, 0, -Z, 0]]) {
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.5), mat);
      ledge.position.set(x, 0.35, z);
      ledge.rotation.y = ry;
      g.add(ledge);
    }
    // Chimney pots.
    for (const [x, z] of [[X, -10], [X, 4], [-X, 8], [-X, -6]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xb05a3c, roughness: 1 }));
      pot.position.set(x, 1.2, z);
      g.add(pot);
    }
    return g;
  },

  cafeChairs() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a6f97, metalness: 0.5, roughness: 0.5 });
    for (const [x, z] of [[-14, -8], [-14.8, -7], [-14.3, 9], [-15, 10]]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.55), mat);
      seat.position.set(x, 0.5, z);
      g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.06), mat);
      back.position.set(x - 0.25, 0.85, z);
      back.rotation.y = Math.PI / 2;
      g.add(back);
    }
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), mat);
    table.position.set(-14.4, 0.75, -7.5);
    g.add(table);
    return g;
  },

  planters() {
    const g = new THREE.Group();
    for (const [x, z] of [[-14, 0], [14.5, -13], [14.5, 13], [-14, -13], [-14, 13]]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 1 }));
      box.position.set(x, 0.3, z);
      g.add(box);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x3f7d4e, roughness: 1 }));
      bush.position.set(x, 0.85, z);
      g.add(bush);
    }
    return g;
  },

  snowBanks() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f7fb, roughness: 1 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 17 + Math.random() * 3;
      const bank = new THREE.Mesh(new THREE.SphereGeometry(1.4 + Math.random() * 1.6, 8, 6), mat);
      bank.position.set(Math.cos(a) * r, -0.4, Math.sin(a) * r * 1.15);
      bank.scale.y = 0.45;
      g.add(bank);
    }
    return g;
  },

  floodlights() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x39414e, metalness: 0.6, roughness: 0.4 });
    for (const [x, z] of [[-15, -13], [-15, 13]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 8), mat);
      pole.position.set(x, 4.5, z);
      g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xeaf6ff }));
      head.position.set(x, 9, z);
      head.lookAt(0, 0, 0);
      g.add(head);
      const spot = new THREE.SpotLight(0xdef0ff, 250, 60, 0.55, 0.45, 1.4);
      spot.position.set(x, 9, z);
      spot.target.position.set(0, 0, z * 0.4);
      g.add(spot, spot.target);
    }
    return g;
  },

  pineTrees() {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 1 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x16352a, roughness: 1 });
    for (const [x, z, s] of [[16, -10, 1.2], [18, -4, 1.5], [17, 6, 1.1], [16, 12, 1.4], [-17, -6, 1.3], [-18, 8, 1.2]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4 * s, 6), trunkMat);
      trunk.position.set(x, 0.7 * s, z);
      g.add(trunk);
      for (let t = 0; t < 3; t++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((1.5 - t * 0.36) * s, 1.7 * s, 7), needleMat);
        cone.position.set(x, (1.6 + t * 1.05) * s, z);
        g.add(cone);
      }
    }
    return g;
  },
};

// ---- shared canvas helpers ------------------------------------------------

function skyFill(ctx, w, h, top, horizon) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(0.85, horizon);
  grad.addColorStop(1, horizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function stars(ctx, w, maxY, n) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.3 + Math.random() * 0.7;
    ctx.fillRect(Math.random() * w, Math.random() * maxY, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function glow(ctx, x, y, r, color) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function skyline(ctx, w, h, layers) {
  for (const L of layers) {
    let x = 0;
    while (x < w) {
      const bw = L.width[0] + Math.random() * (L.width[1] - L.width[0]);
      const bh = h * (L.min + Math.random() * (L.max - L.min));
      const top = h * L.base - bh;
      ctx.fillStyle = L.color;
      ctx.fillRect(x, top, bw, bh);
      if (L.mansard) {
        ctx.beginPath();
        ctx.moveTo(x, top); ctx.lineTo(x + bw * 0.12, top - 26);
        ctx.lineTo(x + bw * 0.88, top - 26); ctx.lineTo(x + bw, top);
        ctx.fill();
      }
      // Lit windows.
      ctx.fillStyle = L.lit;
      for (let wy = top + 14; wy < h * L.base - 12; wy += 22) {
        for (let wx = x + 8; wx < x + bw - 10; wx += 18) {
          if (Math.random() < L.litChance) ctx.fillRect(wx, wy, 7, 10);
        }
      }
      x += bw + 4 + Math.random() * 18;
    }
  }
}

function hillRange(ctx, w, baseY, amp, n) {
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let i = 0; i <= n * 8; i++) {
    const x = (i / (n * 8)) * w;
    ctx.lineTo(x, baseY - Math.abs(Math.sin(i * 0.7)) * amp);
  }
  ctx.lineTo(w, baseY);
  ctx.fill();
}

function tri(ctx, x, baseY, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, baseY); ctx.lineTo(x + w / 2, baseY - h); ctx.lineTo(x + w, baseY);
  ctx.fill();
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

function chainLinkTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(190,200,215,0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 32); ctx.lineTo(32, 0); ctx.lineTo(64, 32); ctx.lineTo(32, 64); ctx.closePath();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function textBoard(text, bg, fg, size, neon = false) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 176);
  ctx.font = `bold ${size * 2}px "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (neon) { ctx.shadowColor = fg; ctx.shadowBlur = 26; }
  ctx.fillStyle = fg;
  ctx.fillText(text, 256, 100);
  if (neon) ctx.fillText(text, 256, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.375),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false, fog: false }),
  );
}
