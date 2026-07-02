import * as THREE from 'three';
import { discRadius } from '../../../shared/src/geometry';
import { COURT_HALF_L, COURT_HALF_W } from '../../../shared/src/constants';
import type { AnimState } from '../../../shared/src/types';
import { PlayerSprite } from '../sprites/playerSprite';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BEND, rimBend, bendHeightFor } from './bend';
import { makeNeonGrid, type NeonGrid } from './neonGrid';
import { makeSunsetSky, type SunsetSky } from './sunsetSky';
import { CRTShader } from './crtShader';
import { makeDunkCourt } from './dunkCourt';
import { DC_COURT } from '../../../shared/src/dunkConstants';

export class GameScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  floorRadius = 14; // eased; also the bend-origin radius
  private grid: NeonGrid;
  private sky: SunsetSky;
  private floorN = -1;
  private dunkCourt: THREE.Group | null = null;
  private playerSprites = new Map<string, PlayerSprite>();
  private composer: EffectComposer;
  private crt: ShaderPass;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false }); // composer + grain hide aliasing
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0x2a0a3a, 38, 110); // horizon-tinted, far rim dissolves
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
    this.camera.position.set(0, 9, 11);

    this.sky = makeSunsetSky();
    this.scene.add(this.sky.mesh);
    this.grid = makeNeonGrid();
    this.scene.add(this.grid.mesh);

    // Post-FX: bloom (neon glow) → CRT (scanlines/aberration/barrel) → tonemap+sRGB.
    // The Escher bend lives in the scene's vertex shaders, so the FX stack is wrap-agnostic.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.55, // strength
      0.5, // radius
      0.9, // threshold (only the brightest neon lines/rims/balls bloom, not the sky)
    );
    this.composer.addPass(bloom);
    this.crt = new ShaderPass(CRTShader);
    this.crt.uniforms.uResolution.value.set(innerWidth, innerHeight);
    this.composer.addPass(this.crt);
    this.composer.addPass(new OutputPass());

    addEventListener('resize', () => this.onResize());
  }

  protected onResize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.crt.uniforms.uResolution.value.set(innerWidth, innerHeight);
  }

  /**
   * The breathing-court morph is now pure uniform easing on the one grid mesh —
   * no rebuild, no chord artifacts. Radius/mode/opacity ease toward the new N.
   */
  setArena(n: number, dt: number): void {
    const targetRadius = n <= 2 ? COURT_HALF_L : discRadius(n);
    const targetMode = n <= 2 ? 0 : 1;
    if (n !== this.floorN) {
      this.floorN = n;
      this.grid.grid.uMode.value = targetMode; // discrete: snap rect/disc selector
      this.grid.grid.uOpacity.value = 0.35; // dip, then ease back to full
    }
    const k = Math.min(1, dt * 3);
    this.floorRadius += (targetRadius - this.floorRadius) * k;
    BEND.bendHeight += (bendHeightFor(n) - BEND.bendHeight) * k; // flat at low N, curls as it fills
    this.grid.grid.uRadius.value = this.floorRadius;
    this.grid.grid.uOpacity.value = Math.min(1, this.grid.grid.uOpacity.value + dt * 1.2);
  }

  setDunkCourt(dt: number): void {
    this.grid.mesh.visible = false;       // hide the rimverse neon grid
    this.sky.mesh.visible = false;
    if (!this.dunkCourt) { this.dunkCourt = makeDunkCourt(); this.scene.add(this.dunkCourt); }
    this.floorRadius += (DC_COURT.boundZ - this.floorRadius) * Math.min(1, dt * 3);
    BEND.bendHeight += (0 - BEND.bendHeight) * Math.min(1, dt * 3); // flatten (court is flat)
  }

  /** Feed the local player as the bend origin. BEND (TS) is the single source of
   *  truth for height/pull; the floor's GLSL uniforms sync from it here so the GPU
   *  floor and CPU-placed entities can never diverge (and runtime tuning hits both). */
  setWrapOrigin(x: number, y: number, radius: number): void {
    BEND.originX = x;
    BEND.originY = y;
    BEND.floorRadius = radius;
    this.grid.wrap.uOrigin.value.set(x, y);
    this.grid.wrap.uFloorRadius.value = radius;
    this.grid.wrap.uBendHeight.value = BEND.bendHeight;
    this.grid.wrap.uBendPull.value = BEND.bendPull;
  }

  setShaderTime(t: number): void {
    this.grid.grid.uTime.value = t;
    this.sky.uniforms.uTime.value = t;
  }

  upsertPlayer(
    id: string,
    x: number,
    y: number,
    z: number,
    hue: number,
    accentHue: number,
    anim: AnimState,
    dx: number,
    dy: number,
    size: number,
    now: number,
  ): void {
    let sprite = this.playerSprites.get(id);
    if (!sprite) {
      sprite = new PlayerSprite({ hue, accentHue });
      this.playerSprites.set(id, sprite);
      this.scene.add(sprite.mesh);
    }
    // one-shots play to completion unless the server starts a new action
    const interrupts =
      anim === 'shoot' ||
      anim.startsWith('dunk') ||
      anim === 'steal' ||
      anim === 'block' ||
      anim === 'stunned';
    if (!sprite.oneShotPlaying(now) || interrupts) {
      sprite.setAnim(anim, now);
    }
    sprite.update(now, x, y, z, size, dx, dy, this.camera);
  }

  removeMissingPlayers(liveIds: Set<string>): void {
    for (const [id, sprite] of this.playerSprites) {
      if (!liveIds.has(id)) {
        this.scene.remove(sprite.mesh);
        sprite.dispose();
        this.playerSprites.delete(id);
      }
    }
  }

  private hoopMeshes: THREE.Group[] = [];
  private ballMeshes = new Map<string, THREE.Mesh>();

  syncHoops(
    hoops: { index: number; x: number; y: number; owner: string | null }[],
    myId: string | null,
    dt: number,
  ): void {
    while (this.hoopMeshes.length > hoops.length) {
      this.scene.remove(this.hoopMeshes.pop()!);
    }
    while (this.hoopMeshes.length < hoops.length) {
      const g = new THREE.Group();
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.05, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xff9e00, toneMapped: false }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, 3.05, 0.55);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.2),
        new THREE.MeshBasicMaterial({
          color: 0x05ffa1,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        }),
      );
      board.position.set(0, 3.5, 0);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.5),
        new THREE.MeshBasicMaterial({ color: 0x8888aa }),
      );
      pole.position.set(0, 1.75, -0.15);
      g.add(rim, board, pole);
      g.scale.setScalar(0.01); // new hoops grow in
      g.userData.fresh = true;
      this.hoopMeshes.push(g);
      this.scene.add(g);
    }
    hoops.forEach((h, i) => {
      const g = this.hoopMeshes[i];
      // track the FLAT slot (reslot glide), then bend for display so the hoop rides the floor
      if (g.userData.fresh) {
        g.userData.fx = h.x;
        g.userData.fz = h.y;
        g.userData.fresh = false;
      } else {
        const k = Math.min(1, dt * 4);
        g.userData.fx += (h.x - g.userData.fx) * k;
        g.userData.fz += (h.y - g.userData.fz) * k;
      }
      const b = rimBend(g.userData.fx, 0, g.userData.fz, BEND);
      g.position.set(b.x, b.y, b.z);
      g.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 3));
      g.lookAt(0, b.y, 0); // rim juts toward the play-area center, at its own height
      const rim = g.children[0] as THREE.Mesh;
      (rim.material as THREE.MeshBasicMaterial).color
        .set(h.owner === myId ? 0x05ffa1 : h.owner ? 0xff71ce : 0xff9e00)
        .multiplyScalar(2.0); // HDR overdrive → bloom catches the rim
    });
  }

  syncBalls(balls: { id: string; x: number; y: number; z: number; state: string }[]): void {
    const live = new Set(balls.map((b) => b.id));
    for (const [id, m] of this.ballMeshes) {
      if (!live.has(id)) {
        this.scene.remove(m);
        this.ballMeshes.delete(id);
      }
    }
    for (const b of balls) {
      let m = this.ballMeshes.get(b.id);
      if (!m) {
        m = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 12, 12),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xff9e00).multiplyScalar(2.0), // bloom overdrive
            toneMapped: false,
          }),
        );
        this.ballMeshes.set(b.id, m);
        this.scene.add(m);
      }
      // carried balls are drawn by the carrier's sprite; respawning balls are invisible
      m.visible = b.state === 'free' || b.state === 'flight';
      let localY = Math.max(0.22, b.z);
      if (b.state === 'free') localY = 0.25 + Math.sin(performance.now() / 250) * 0.06;
      const bp = rimBend(b.x, 0, b.y, BEND); // ride the bent floor
      m.position.set(bp.x, bp.y + localY, bp.z);
    }
  }

  followCam(x: number, y: number, dt: number): void {
    const target = new THREE.Vector3(x, 9, y + 11);
    this.camera.position.lerp(target, Math.min(1, dt * 5));
    this.camera.lookAt(x, 0.8, y);
  }

  render(): void {
    this.crt.uniforms.uTime.value = performance.now() / 1000;
    this.composer.render();
  }
}
