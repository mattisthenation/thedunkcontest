import * as THREE from 'three';
import { atlasLayout, buildAtlas, cellUV, type AtlasLayout } from './atlas';
import { ANIMS, frameIndex, type AnimName } from './poses';
import type { Appearance, Facing } from './draw';
import { BEND, rimBend } from '../scene/bend';
import { QUAD_H, spriteWorldY } from './spriteMath';

const layout: AtlasLayout = atlasLayout();
const textureCache = new Map<HTMLCanvasElement, THREE.CanvasTexture>();

function textureFor(look: Appearance): THREE.CanvasTexture {
  const canvas = buildAtlas(look);
  let tex = textureCache.get(canvas);
  if (!tex) {
    tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    textureCache.set(canvas, tex);
  }
  return tex;
}

export class PlayerSprite {
  mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private geo: THREE.PlaneGeometry;
  private anim: AnimName = 'idle';
  private animStart = 0;
  private lastFrame = -1;
  private facingLeft = false;
  private facing: Facing = 'side';

  constructor(look: Appearance) {
    this.geo = new THREE.PlaneGeometry(QUAD_H, QUAD_H);
    this.material = new THREE.MeshBasicMaterial({
      map: textureFor(look),
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.setUV('idle', 0);
  }

  setAnim(anim: AnimName, now: number): void {
    if (anim === this.anim) return;
    this.anim = anim;
    this.animStart = now;
    this.lastFrame = -1;
  }

  get currentAnim(): AnimName {
    return this.anim;
  }

  /** (dx,dy): sim-space facing. Sim y maps to world z. */
  update(
    now: number,
    x: number,
    y: number,
    z: number,
    size: number,
    dx: number,
    dy: number,
    camera: THREE.Camera,
  ): void {
    const t = (now - this.animStart) / 1000;
    const f = frameIndex(ANIMS[this.anim], t);

    // facing selection: angle between view ray and player facing dir
    if (Math.hypot(dx, dy) > 0.15) {
      const yawV = Math.atan2(x - camera.position.x, y - camera.position.z);
      const yawD = Math.atan2(dx, dy);
      let rel = yawD - yawV;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      const abs = Math.abs(rel);
      const facing: Facing = abs < Math.PI / 4 ? 'back' : abs > (3 * Math.PI) / 4 ? 'front' : 'side';
      const left = facing === 'side' ? rel > 0 : this.facingLeft;
      if (facing !== this.facing || left !== this.facingLeft) {
        this.facing = facing;
        this.facingLeft = left;
        this.lastFrame = -1; // force UV refresh
      }
    }
    if (f !== this.lastFrame) {
      this.setUV(this.anim, f);
      this.lastFrame = f;
    }
    // Glue the sprite's feet to the bent floor (render-only); facing/UV stay on flat
    // sim coords above. Sprite stays world-vertical — figures pinned to the rising court.
    const b = rimBend(x, 0, y, BEND);
    this.mesh.position.set(b.x, spriteWorldY(size, b.y, z), b.z);
    this.mesh.scale.setScalar(size);
    // billboard: yaw-only toward camera, from the rendered (bent) position
    const yaw = Math.atan2(camera.position.x - b.x, camera.position.z - b.z);
    this.mesh.rotation.set(0, yaw, 0);
  }

  /** True while a one-shot anim still has frames left to show. */
  oneShotPlaying(now: number): boolean {
    const def = ANIMS[this.anim];
    if (def.loop) return false;
    return (now - this.animStart) / 1000 < def.frames.length / def.fps;
  }

  private setUV(anim: AnimName, frame: number): void {
    const { u0, v0, u1, v1 } = cellUV(layout, anim, frame, this.facing);
    // three.js v=0 is image bottom; our v0 is from the top ⇒ flip.
    const top = 1 - v0;
    const bot = 1 - v1;
    const flip = this.facing === 'side' && this.facingLeft;
    const left = flip ? u1 : u0;
    const right = flip ? u0 : u1;
    const uv = this.geo.attributes.uv as THREE.BufferAttribute;
    uv.setXY(0, left, top);
    uv.setXY(1, right, top);
    uv.setXY(2, left, bot);
    uv.setXY(3, right, bot);
    uv.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}
