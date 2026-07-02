import * as THREE from 'three';

/** Fullscreen CRT pass: barrel curve + chromatic aberration + scanlines + grain + vignette. */
export const CRTShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uAberration: { value: 1.4 },
    uScan: { value: 0.1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uAberration, uScan;
    uniform vec2 uResolution;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 uv = vUv + c * r2 * 0.09; // gentle barrel
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // bezel
        return;
      }
      // chromatic aberration grows toward the edges
      vec2 off = c * 0.006 * uAberration;
      float rr = texture2D(tDiffuse, uv + off).r;
      float gg = texture2D(tDiffuse, uv).g;
      float bb = texture2D(tDiffuse, uv - off).b;
      vec3 col = vec3(rr, gg, bb);
      // rolling scanlines
      float scan = sin(uv.y * uResolution.y * 1.4 - uTime * 5.0) * 0.5 + 0.5;
      col *= 1.0 - uScan * scan;
      // film grain
      float g = fract(sin(dot(uv * uResolution + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * 0.035;
      // vignette
      col *= smoothstep(1.05, 0.25, r2 * 1.4);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
