// sprites.test.js — anatomy of the run cycle. The moonwalk bug: shin angles
// authored FORWARD of the thigh kept the recovery foot at ground level while
// it swung forward, so the legs read as running backwards.
// Convention (generator.js): angles from vertical, positive = forward (+x);
// a knee only flexes backward, so shin angle must never exceed thigh angle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runFrames } from '../public/js/generator.js';

const THIGH = 9, SHIN = 8; // leg segment lengths in art pixels
const rad = (d) => (d * Math.PI) / 180;
const foot = ([a1, a2]) => ({
  x: Math.sin(rad(a1)) * THIGH + Math.sin(rad(a2)) * SHIN,
  y: Math.cos(rad(a1)) * THIGH + Math.cos(rad(a2)) * SHIN, // down from hip
});

test('run cycle: knees never bend forward (shin trails thigh)', () => {
  for (const [i, p] of runFrames().entries()) {
    assert.ok(p.legF[1] <= p.legF[0], `frame ${i} front leg: shin ${p.legF[1]} forward of thigh ${p.legF[0]}`);
    assert.ok(p.legB[1] <= p.legB[0], `frame ${i} back leg: shin ${p.legB[1]} forward of thigh ${p.legB[0]}`);
  }
});

test('run cycle: the recovering (rearward-thigh) leg is folded off the ground', () => {
  const legLength = THIGH + SHIN;
  for (const [i, p] of runFrames().entries()) {
    for (const leg of [p.legF, p.legB]) {
      if (leg[0] >= -20) continue; // only the trailing/recovery part of the cycle
      const { y } = foot(leg);
      assert.ok(y < legLength - 2.5,
        `frame ${i}: recovery foot at ground level (y=${y.toFixed(1)} of ${legLength}) — moonwalk`);
    }
  }
});
