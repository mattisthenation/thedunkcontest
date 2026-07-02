import * as THREE from 'three';
import { RIM_BEND_GLSL } from './bend';

export interface WrapUniforms {
  uOrigin: { value: THREE.Vector2 };
  uFloorRadius: { value: number };
  uBendHeight: { value: number };
  uBendPull: { value: number };
}

export interface GridUniforms {
  uTime: { value: number };
  uRadius: { value: number };
  uMode: { value: number }; // 0 = rectangle, 1 = disc
  uHalfW: { value: number };
  uHalfL: { value: number };
  uOpacity: { value: number };
  uColor: { value: THREE.Color };
  uColorB: { value: THREE.Color };
}

export interface NeonGrid {
  mesh: THREE.Mesh;
  wrap: WrapUniforms;
  grid: GridUniforms;
}

/**
 * Procedural neon-grid floor. The vertex shader bends every vertex by the shared
 * rimBend (Escher loop, render-only); the fragment draws AA grid lines + a radial
 * rim glow + an outward pulse ring, all HDR-overdriven so bloom catches the lines.
 * One mesh for the whole match — the breathing-court morph is just uniform easing.
 */
export function makeNeonGrid(): NeonGrid {
  const wrap: WrapUniforms = {
    uOrigin: { value: new THREE.Vector2(0, 0) },
    uFloorRadius: { value: 14 },
    uBendHeight: { value: 8 },
    uBendPull: { value: 0.2 },
  };
  const grid: GridUniforms = {
    uTime: { value: 0 },
    uRadius: { value: 14 },
    uMode: { value: 1 },
    uHalfW: { value: 8 },
    uHalfL: { value: 14 },
    uOpacity: { value: 1 },
    uColor: { value: new THREE.Color(0xff4fd8) }, // hot magenta lines
    uColorB: { value: new THREE.Color(0x18e0ff) }, // cyan rim
  };

  const geo = new THREE.PlaneGeometry(240, 240, 220, 220); // dense → bend stays smooth
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...wrap, ...grid },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    vertexShader: `
      ${RIM_BEND_GLSL}
      varying vec2 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0); // mesh rotated to the XZ ground
        vWorld = wp.xz;
        wp.xyz = rimBend(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime, uRadius, uMode, uHalfW, uHalfL, uOpacity;
      uniform vec3 uColor, uColorB;
      varying vec2 vWorld;

      float gridFactor(vec2 p, float cell) {
        vec2 c = p / cell;
        vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }

      void main() {
        float d = length(vWorld);
        float inside = uMode > 0.5
          ? step(d, uRadius)
          : step(abs(vWorld.x), uHalfW) * step(abs(vWorld.y), uHalfL);
        if (inside < 0.5) discard;

        float fine = gridFactor(vWorld, 2.0);
        float coarse = gridFactor(vWorld, 8.0) * 1.4;
        float lines = max(fine, coarse);

        // brighter toward the rim (so the rising wall reads), + outward pulse ring
        float rim = smoothstep(uRadius * 0.3, uRadius, d);
        float ring = smoothstep(0.5, 0.0, abs(fract(d * 0.12 - uTime * 0.25) - 0.5));
        vec3 col = mix(uColor, uColorB, rim);
        float glow = lines * (0.5 + 0.7 * rim) + ring * 0.25 * lines;

        gl_FragColor = vec4(col * glow * 1.25, clamp(glow, 0.0, 1.0) * uOpacity);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; // local XY plane → world XZ ground
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, wrap, grid };
}
