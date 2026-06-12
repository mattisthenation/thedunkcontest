// world.js — Three.js scene: lighting, painted court floor, hoop assemblies,
// and the ball. Consumes a court definition from shared/courts.js; the stage
// dressing (backdrops, props, particles) lives in stage.js.

import * as THREE from 'three';
import { COURT } from '/shared/constants.js';
import { shade } from './generator.js';

export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    // Broadcast camera: elevated sideline seat at -x, court runs left-right.
    this.camera.position.set(-17, 10, 0);
    this.camera.lookAt(0, 1, 0);

    this.courtGroup = null;
    this.stageGroup = null;
    this.lights = [];

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // (Re)build the world for a court definition.
  loadCourt(def) {
    if (this.courtGroup) disposeGroup(this.scene, this.courtGroup);
    for (const l of this.lights) this.scene.remove(l);
    this.lights = [];

    this.applyAtmosphere(def);
    this.applyLights(def);

    const g = new THREE.Group();
    g.add(this.buildFloor(def));
    g.add(this.buildHoop(def, -1));
    g.add(this.buildHoop(def, 1));
    this.courtGroup = g;
    this.scene.add(g);
  }

  applyAtmosphere(def) {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, def.sky.top);
    grad.addColorStop(1, def.sky.horizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = tex;
    this.scene.fog = def.fog ? new THREE.Fog(def.fog.color, def.fog.near, def.fog.far) : null;
  }

  applyLights(def) {
    const L = def.light;
    const ambient = new THREE.AmbientLight(L.ambient, L.ambientIntensity);
    const hemi = new THREE.HemisphereLight(def.sky.top, def.palette.floor, L.hemi);
    const sun = new THREE.DirectionalLight(L.sun, L.sunIntensity);
    sun.position.set(...L.sunPos);
    sun.castShadow = true;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.mapSize.set(2048, 2048);
    this.lights = [ambient, hemi, sun];
    for (const l of this.lights) this.scene.add(l);
  }

  // The floor is one painted canvas texture: apron, planks/surface, key
  // paint, arcs, and lines all in the court's palette.
  buildFloor(def) {
    const P = def.palette;
    const c = document.createElement('canvas');
    const SCALE = 36; // px per world unit
    c.width = (COURT.halfWidth * 2 + 4) * SCALE;
    c.height = (COURT.halfLength * 2 + 4) * SCALE;
    const ctx = c.getContext('2d');
    const u = (x) => (x + COURT.halfWidth + 2) * SCALE;   // world x → px
    const v = (z) => (z + COURT.halfLength + 2) * SCALE;  // world z → px

    // Apron + surface.
    ctx.fillStyle = P.apron;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = P.floor;
    ctx.fillRect(u(-COURT.halfWidth), v(-COURT.halfLength), COURT.halfWidth * 2 * SCALE, COURT.halfLength * 2 * SCALE);

    // Subtle surface variation (planks across x).
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < COURT.halfWidth * 2; i++) {
      ctx.fillStyle = i % 2 ? '#000000' : '#ffffff';
      ctx.fillRect(u(-COURT.halfWidth + i), v(-COURT.halfLength), SCALE, COURT.halfLength * 2 * SCALE);
    }
    ctx.globalAlpha = 1;

    // Key paint boxes.
    ctx.fillStyle = P.key;
    for (const s of [-1, 1]) {
      const zEnd = s * COURT.halfLength;
      const zFree = s * (COURT.halfLength - 5.8);
      ctx.fillRect(u(-2.45), Math.min(v(zEnd), v(zFree)), 4.9 * SCALE, Math.abs(v(zEnd) - v(zFree)));
    }

    // Lines.
    ctx.strokeStyle = P.lines;
    ctx.lineWidth = SCALE * 0.12;
    ctx.strokeRect(u(-COURT.halfWidth), v(-COURT.halfLength), COURT.halfWidth * 2 * SCALE, COURT.halfLength * 2 * SCALE);
    // Half-court line + center circle.
    line(ctx, u(-COURT.halfWidth), v(0), u(COURT.halfWidth), v(0));
    circle(ctx, u(0), v(0), 1.8 * SCALE);
    // Key outlines + free-throw circles.
    for (const s of [-1, 1]) {
      const zEnd = s * COURT.halfLength;
      const zFree = s * (COURT.halfLength - 5.8);
      ctx.strokeRect(u(-2.45), Math.min(v(zEnd), v(zFree)), 4.9 * SCALE, Math.abs(v(zEnd) - v(zFree)));
      circle(ctx, u(0), v(zFree), 1.8 * SCALE);
      // Three-point arc, opening toward center court.
      const rim = COURT.rims[s < 0 ? 0 : 1];
      ctx.beginPath();
      if (s < 0) ctx.arc(u(rim.x), v(rim.z), COURT.threePointRadius * SCALE, 0, Math.PI);
      else ctx.arc(u(rim.x), v(rim.z), COURT.threePointRadius * SCALE, Math.PI, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(COURT.halfWidth * 2 + 4, COURT.halfLength * 2 + 4);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  }

  buildHoop(def, side) {
    const g = new THREE.Group();
    const rim = COURT.rims[side < 0 ? 0 : 1];
    const bz = side * COURT.backboardZ;

    // Pole + arm.
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.5, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 10), poleMat);
    pole.position.set(0, 2.2, side * (COURT.backboardZ + 1));
    pole.castShadow = true;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.1), poleMat);
    arm.position.set(0, 3.9, side * (COURT.backboardZ + 0.45));
    g.add(arm);

    // Backboard: clear acrylic with painted target square.
    const bbCanvas = document.createElement('canvas');
    bbCanvas.width = 256; bbCanvas.height = 160;
    const bctx = bbCanvas.getContext('2d');
    bctx.fillStyle = 'rgba(235,240,248,0.32)';
    bctx.fillRect(0, 0, 256, 160);
    bctx.strokeStyle = 'rgba(255,255,255,0.9)';
    bctx.lineWidth = 7;
    bctx.strokeRect(6, 6, 244, 148);
    bctx.strokeStyle = def.palette.key;
    bctx.lineWidth = 6;
    bctx.strokeRect(96, 84, 64, 48);
    const bbTex = new THREE.CanvasTexture(bbCanvas);
    bbTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 1.8, 0.06),
      new THREE.MeshStandardMaterial({ map: bbTex, transparent: true, roughness: 0.2 }),
    );
    board.position.set(0, 3.95, bz);
    board.castShadow = true;
    g.add(board);

    // Rim.
    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(COURT.rimRadius, 0.035, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xe8541e, roughness: 0.35, metalness: 0.7 }),
    );
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.set(rim.x, rim.y, rim.z);
    rimMesh.castShadow = true;
    rimMesh.name = `rim${side < 0 ? 0 : 1}`;
    g.add(rimMesh);

    // Net: alpha-textured open cylinder.
    const netCanvas = document.createElement('canvas');
    netCanvas.width = 128; netCanvas.height = 64;
    const nctx = netCanvas.getContext('2d');
    nctx.strokeStyle = 'rgba(255,255,255,0.95)';
    nctx.lineWidth = 2.5;
    for (let i = 0; i < 10; i++) {
      nctx.beginPath();
      nctx.moveTo(i * 12.8, 0); nctx.lineTo(i * 12.8 + 8, 64);
      nctx.moveTo(i * 12.8 + 8, 0); nctx.lineTo(i * 12.8, 64);
      nctx.stroke();
    }
    const netTex = new THREE.CanvasTexture(netCanvas);
    const net = new THREE.Mesh(
      new THREE.CylinderGeometry(COURT.rimRadius * 0.96, COURT.rimRadius * 0.55, 0.55, 16, 1, true),
      new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    net.position.set(rim.x, rim.y - 0.31, rim.z);
    net.name = `net${side < 0 ? 0 : 1}`;
    g.add(net);

    return g;
  }

  makeBall() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8702a';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#2a1208';
    ctx.lineWidth = 2.5;
    for (const x of [0, 64, 128]) line(ctx, x, 0, x, 64);
    line(ctx, 0, 32, 128, 32);
    ctx.beginPath(); ctx.ellipse(32, 32, 22, 30, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(96, 32, 22, 30, 0, 0, Math.PI * 2); ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 20, 16),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
    );
    ball.castShadow = true;
    this.scene.add(ball);
    return ball;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
function circle(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

export function disposeGroup(scene, group) {
  scene.remove(group);
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}
