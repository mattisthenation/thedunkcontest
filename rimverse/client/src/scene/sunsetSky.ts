import * as THREE from 'three';

export interface SunsetSky {
  mesh: THREE.Mesh;
  uniforms: { uTime: { value: number } };
}

/** 80s-sunset gradient skydome with chrome-sun scanline bands. Backdrop only — never bent. */
export function makeSunsetSky(): SunsetSky {
  const uniforms = { uTime: { value: 0 } };
  const geo = new THREE.SphereGeometry(160, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vDir;
      uniform float uTime;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = vec3(0.95, 0.32, 0.10); // deep orange
        vec3 mid     = vec3(0.40, 0.06, 0.34); // rich magenta-purple
        vec3 top     = vec3(0.02, 0.01, 0.07); // near-black violet
        // steep gradient: only the horizon line glows; it darkens fast going up
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, h));
        col = mix(col, top, smoothstep(0.16, 0.5, h));
        // chrome sun: a disc just above the horizon, sliced by retro scanline bands
        float sunY = vDir.y - 0.04;
        float sun = smoothstep(0.3, 0.0, length(vec2(vDir.x * 0.6, sunY)));
        float bands = step(0.45, fract(sunY * 40.0));
        col = mix(col, vec3(1.0, 0.8, 0.35), sun * bands * 0.9);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return { mesh, uniforms };
}
