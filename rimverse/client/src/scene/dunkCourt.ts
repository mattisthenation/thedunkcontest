import * as THREE from 'three';
import { DC_COURT } from '../../../shared/src/dunkConstants';

/** Faithful v3 base court: flat floor, boundary + center + key lines, two backboards. */
export function makeDunkCourt(): THREE.Group {
  const g = new THREE.Group();
  const W = DC_COURT.boundX, L = DC_COURT.boundZ;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2, L * 2),
    new THREE.MeshBasicMaterial({ color: 0x6e6862 }), // neutral v3 hardwood; B2 themes per court
  );
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe8e4da });
  const ring = (r: number, y = 0.02, x = 0, z = 0) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push(new THREE.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
  };
  const rect = (w: number, l: number, y = 0.02) => {
    const pts = [[-w, y, -l], [w, y, -l], [w, y, l], [-w, y, l], [-w, y, -l]].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
  };
  g.add(rect(W, L));                 // boundary
  g.add(ring(1.8));                  // center circle
  for (const rim of DC_COURT.rims) { // 3-pt arc + backboard per end
    g.add(ring(DC_COURT.threePointRadius, 0.02, rim.x, rim.y));
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.05, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
    );
    board.position.set(rim.x, 3.5, rim.y + Math.sign(rim.y) * 0.55);
    g.add(board);
  }
  return g;
}
