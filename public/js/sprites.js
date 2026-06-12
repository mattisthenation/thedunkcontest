// sprites.js — billboard character rendering.
// CharacterSprite is the stable interface the rest of the client uses;
// generator.js (phase 2) supplies the real big-head sprite-sheet art.
// Rendering model: one THREE.Sprite (single quad, one canvas texture) per
// player + one for the name tag — 2 draw calls per character, which is why
// 100 on screen is cheap.

import * as THREE from 'three';
import { ANIM } from '/shared/constants.js';
import { generateSpriteSheet, SHEET } from './generator.js';

export class CharacterSprite {
  constructor(scene, character, name) {
    this.scene = scene;
    this.anim = ANIM.idle;
    this.frame = 0;
    this.animTime = 0;
    this.facing = 1;
    this.fire = false;
    this.carrying = false;
    this.pos = new THREE.Vector3();

    const { canvas, animations } = generateSpriteSheet(character);
    this.animations = animations;

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;

    this.material = new THREE.SpriteMaterial({ map: this.texture, transparent: true });
    this.sprite = new THREE.Sprite(this.material);
    const aspect = SHEET.frameW / SHEET.frameH;
    this.baseScale = { x: aspect * 2.6, y: 2.6 };
    this.sprite.scale.set(this.baseScale.x, this.baseScale.y, 1);
    this.sprite.center.set(0.5, 0.06); // feet anchored at position
    scene.add(this.sprite);

    this.nameTag = makeNameTag(name);
    scene.add(this.nameTag);

    this.applyFrame();
  }

  setPosition(x, y, z) { this.pos.set(x, y, z); }

  setAnim(code) {
    if (this.anim === code) return;
    this.anim = code;
    this.frame = 0;
    this.animTime = 0;
    this.applyFrame();
  }

  setFacing(f) { this.facing = f; }
  setFire(on) {
    if (this.fire === on) return;
    this.fire = on;
    this.material.color.set(on ? 0xffc080 : 0xffffff);
  }
  setCarrying(on) { this.carrying = on; }

  update(dt) {
    const a = this.animations[this.anim] || this.animations[ANIM.idle];
    this.animTime += dt;
    if (this.animTime >= a.speed) {
      this.animTime = 0;
      // One-shot poses (jump/shoot/dunk) hold their final frame.
      this.frame = a.hold ? Math.min(this.frame + 1, a.frames - 1) : (this.frame + 1) % a.frames;
      this.applyFrame();
    }
    this.sprite.position.copy(this.pos);
    this.sprite.scale.x = this.baseScale.x * (this.facing >= 0 ? 1 : -1);
    this.nameTag.position.set(this.pos.x, this.pos.y + 2.95, this.pos.z);
  }

  applyFrame() {
    const a = this.animations[this.anim] || this.animations[ANIM.idle];
    const col = a.start + Math.min(this.frame, a.frames - 1);
    this.texture.offset.set(col / SHEET.cols, 1 - (a.row + 1) / SHEET.rows);
    this.texture.repeat.set(1 / SHEET.cols, 1 / SHEET.rows);
  }

  dispose() {
    this.scene.remove(this.sprite);
    this.scene.remove(this.nameTag);
    this.texture.dispose();
    this.material.dispose();
    this.nameTag.material.map.dispose();
    this.nameTag.material.dispose();
  }
}

function makeNameTag(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(name, 128, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 0.6, 1);
  sprite.renderOrder = 10;
  return sprite;
}
