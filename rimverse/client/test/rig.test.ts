import { describe, it, expect } from 'vitest';
import { computeSkeleton, NEUTRAL_POSE } from '../src/sprites/rig';

describe('rig forward kinematics', () => {
  it('neutral pose: head above pelvis, feet near ground', () => {
    const s = computeSkeleton(NEUTRAL_POSE);
    expect(s.head.y).toBeGreaterThan(s.pelvis.y);
    expect(s.footN.y).toBeLessThan(0.06);
    expect(Math.abs(s.footN.x)).toBeLessThan(0.05);
  });

  it('hip flexion moves the knee forward and up', () => {
    const bent = computeSkeleton({ ...NEUTRAL_POSE, thN: 45 });
    const straight = computeSkeleton(NEUTRAL_POSE);
    expect(bent.kneeN.x).toBeGreaterThan(straight.kneeN.x);
    expect(bent.kneeN.y).toBeGreaterThan(straight.kneeN.y);
  });

  it('knee flexion pulls the foot backward relative to the knee', () => {
    const s = computeSkeleton({ ...NEUTRAL_POSE, thN: 0, shN: 60 });
    expect(s.footN.x).toBeLessThan(s.kneeN.x);
  });

  it('elbow flexion raises the hand forward', () => {
    const s = computeSkeleton({ ...NEUTRAL_POSE, uaN: 20, faN: 90 });
    expect(s.handN.x).toBeGreaterThan(s.elbowN.x);
  });

  it('ball attaches to the near hand when pose.ball is handN', () => {
    const s = computeSkeleton({ ...NEUTRAL_POSE, ball: 'handN' });
    expect(s.ball).not.toBeNull();
    expect(s.ball!.x).toBeCloseTo(s.handN.x, 1);
  });
});
