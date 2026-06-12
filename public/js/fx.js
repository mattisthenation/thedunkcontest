// fx.js — game feel: particle bursts, rim/net reactions, screen shake, and
// on-fire ember trails. One pooled Points cloud handles every burst, so the
// render cost is a single draw call no matter how chaotic the game gets.

import * as THREE from 'three';
import { COURT } from '/shared/constants.js';

const POOL = 600;

export class Fx {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.t = 0;

    // Pooled burst particles.
    this.parts = new Array(POOL).fill(null).map(() => ({
      life: 0, ttl: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      color: new THREE.Color(), size: 1,
    }));
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(POOL * 3), 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.shake = 0;
    this.rimShakes = [0, 0];
  }

  // ---- emitters -----------------------------------------------------------

  spawn(pos, vel, color, ttl, jitter = 0.4) {
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    p.life = ttl; p.ttl = ttl;
    p.pos.copy(pos).add(new THREE.Vector3(
      (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter,
    ));
    p.vel.copy(vel);
    p.color.set(color);
  }

  burst(pos, colors, n, speed, up = 2.5, ttl = 0.8) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      v.set(Math.cos(a) * s, up * (0.3 + Math.random() * 0.7), Math.sin(a) * s);
      this.spawn(pos, v, colors[i % colors.length], ttl * (0.6 + Math.random() * 0.6));
    }
  }

  dunkImpact(rimIndex) {
    const rim = COURT.rims[rimIndex] || COURT.rims[0];
    const pos = new THREE.Vector3(rim.x, rim.y, rim.z);
    this.burst(pos, ['#ffc928', '#ff7a3c', '#ffffff'], 70, 5, 3.5, 0.9);
    this.rimShakes[rimIndex] = 1;
    this.shake = Math.max(this.shake, 0.55);
    this.splashNet(rimIndex, 1.6);
  }

  scoreBurst(kind, rimIndex) {
    const rim = COURT.rims[rimIndex] || COURT.rims[0];
    const pos = new THREE.Vector3(rim.x, rim.y - 0.3, rim.z);
    const colors = kind === 'three' ? ['#54f0ff', '#ffffff', '#ffc928'] : ['#ffc928', '#ffffff'];
    this.burst(pos, colors, kind === 'three' ? 50 : 30, 3, 1.6, 0.7);
    this.splashNet(rimIndex, 1.0);
  }

  dunkTakeoff(rim) {
    this.burst(new THREE.Vector3(rim.x, 0.2, rim.z), ['#cfd6e6'], 12, 2, 1.2, 0.4);
  }

  missClank(rimIndex) {
    this.rimShakes[rimIndex] = 0.5;
  }

  fireTrail(pos) {
    if (Math.random() < 0.55) {
      this.spawn(
        new THREE.Vector3(pos.x, pos.y + 0.4 + Math.random() * 0.9, pos.z),
        new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.6 + Math.random(), (Math.random() - 0.5) * 0.5),
        Math.random() < 0.5 ? '#ff7a3c' : '#ffc928',
        0.5, 0.3,
      );
    }
  }

  splashNet(rimIndex, strength) {
    const net = this.scene.getObjectByName(`net${rimIndex}`);
    if (net) net.userData.splash = strength;
  }

  // ---- per-frame ----------------------------------------------------------

  update(dt) {
    this.t += dt;
    const posAttr = this.points.geometry.attributes.position;
    const colAttr = this.points.geometry.attributes.color;
    for (let i = 0; i < POOL; i++) {
      const p = this.parts[i];
      if (p.life <= 0) {
        posAttr.array[i * 3 + 1] = -100; // park dead particles below the floor
        continue;
      }
      p.life -= dt;
      p.vel.y -= 6.5 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const f = Math.max(0, p.life / p.ttl);
      posAttr.array[i * 3] = p.pos.x;
      posAttr.array[i * 3 + 1] = p.pos.y;
      posAttr.array[i * 3 + 2] = p.pos.z;
      colAttr.array[i * 3] = p.color.r * f;
      colAttr.array[i * 3 + 1] = p.color.g * f;
      colAttr.array[i * 3 + 2] = p.color.b * f;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    // Rim + net reactions.
    for (let r = 0; r < 2; r++) {
      const rimMesh = this.scene.getObjectByName(`rim${r}`);
      if (rimMesh) {
        if (this.rimShakes[r] > 0) {
          this.rimShakes[r] = Math.max(0, this.rimShakes[r] - dt * 2.2);
          rimMesh.position.y = COURT.rims[r].y - Math.sin(this.t * 38) * 0.05 * this.rimShakes[r];
        } else {
          rimMesh.position.y = COURT.rims[r].y;
        }
      }
      const net = this.scene.getObjectByName(`net${r}`);
      if (net?.userData.splash > 0) {
        net.userData.splash = Math.max(0, net.userData.splash - dt * 3);
        const s = 1 + Math.sin(this.t * 30) * 0.16 * net.userData.splash;
        net.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      }
    }

    // Screen shake (applied after the camera follow has positioned us).
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8);
      const cam = this.world.camera;
      const k = this.shake * this.shake * 0.5;
      cam.position.x += (Math.random() - 0.5) * k;
      cam.position.y += (Math.random() - 0.5) * k;
    }
  }
}
