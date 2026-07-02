import { describe, it, expect } from 'vitest';
import { ANIMS, frameIndex } from '../src/sprites/poses';

describe('animation tables', () => {
  it('every anim has frames and a positive fps', () => {
    for (const [name, a] of Object.entries(ANIMS)) {
      expect(a.frames.length, name).toBeGreaterThan(0);
      expect(a.fps, name).toBeGreaterThan(0);
    }
  });

  it('looping anims wrap; one-shots clamp on the last frame', () => {
    const run = ANIMS.run;
    expect(frameIndex(run, run.frames.length / run.fps + 0.01)).toBe(0); // wrapped
    const shoot = ANIMS.shoot;
    expect(frameIndex(shoot, 10)).toBe(shoot.frames.length - 1); // clamped
  });

  it('dribble ball alternates between hand and free flight', () => {
    const d = ANIMS.dribbleIdle;
    const inHand = d.frames.filter((f) => f.ball === 'handN').length;
    const free = d.frames.filter((f) => typeof f.ball === 'object').length;
    expect(inHand).toBeGreaterThan(0);
    expect(free).toBeGreaterThan(0);
    // the lowest free-ball frame should be near the floor (the bounce)
    const ys = d.frames.flatMap((f) => (typeof f.ball === 'object' && f.ball ? [f.ball.y] : []));
    expect(Math.min(...ys)).toBeLessThan(0.1);
  });
});
