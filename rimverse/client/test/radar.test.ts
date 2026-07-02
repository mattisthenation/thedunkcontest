import { describe, it, expect } from 'vitest';
import {
  projectToRadar,
  attackerScore,
  buildBlips,
  ringViewRange,
} from '../src/hud/radar';
import { discRadius } from '../../shared/src/geometry';
import { COURT_HALF_L } from '../../shared/src/constants';
import type { PlayerSnap } from '../../shared/src/types';

const player = (over: Partial<PlayerSnap>): PlayerSnap => ({
  id: 'x',
  name: 'x',
  x: 0,
  y: 0,
  z: 0,
  dx: 0,
  dy: 1,
  anim: 'idle',
  size: 1,
  skill: 0.5,
  turboLeft: 1,
  turboCd: 0,
  hue: 0,
  accentHue: 0,
  hasBall: false,
  onFire: false,
  score: 0,
  hoop: 0,
  ...over,
});

describe('ringViewRange', () => {
  it('matches disc/rect radius * 1.08', () => {
    expect(ringViewRange(8)).toBeCloseTo(discRadius(8) * 1.08);
    expect(ringViewRange(2)).toBeCloseTo(COURT_HALF_L * 1.08);
  });
});

describe('projectToRadar', () => {
  it('origin maps to center', () => {
    const p = projectToRadar(0, 0, { x: 0, y: 0 }, 20, 80);
    expect(p.px).toBe(0);
    expect(p.py).toBe(0);
    expect(p.clamped).toBe(false);
  });
  it('a far point clamps to the rim', () => {
    const p = projectToRadar(100, 0, { x: 0, y: 0 }, 20, 80);
    expect(p.clamped).toBe(true);
    expect(Math.hypot(p.px, p.py)).toBeCloseTo(80);
  });
  it('sign convention: sim +x → right, +y → down', () => {
    const p = projectToRadar(5, 5, { x: 0, y: 0 }, 20, 80);
    expect(p.px).toBeGreaterThan(0);
    expect(p.py).toBeGreaterThan(0);
  });
});

describe('attackerScore', () => {
  const myHoop = { x: 0, y: -14 };
  it('shooting/dunking enemy near my hoop → high', () => {
    expect(attackerScore(player({ x: 0, y: -12, anim: 'dunkWindmill' }), myHoop)).toBeGreaterThan(0.6);
  });
  it('carrier heading toward my hoop + close → mid-high', () => {
    expect(attackerScore(player({ x: 0, y: -6, hasBall: true, dx: 0, dy: -1 }), myHoop)).toBeGreaterThan(0.4);
  });
  it('carrier heading away → 0', () => {
    expect(attackerScore(player({ x: 0, y: -6, hasBall: true, dx: 0, dy: 1 }), myHoop)).toBe(0);
  });
  it('idle unarmed → 0', () => {
    expect(attackerScore(player({ x: 0, y: -8, anim: 'idle' }), myHoop)).toBe(0);
  });
  it('beyond the threat radius → 0', () => {
    expect(attackerScore(player({ x: 0, y: 30, hasBall: true, dx: 0, dy: -1, anim: 'dunk' }), myHoop)).toBe(0);
  });
  it('no owned hoop → 0', () => {
    expect(attackerScore(player({ x: 0, y: -12, anim: 'dunk' }), null)).toBe(0);
  });
});

describe('buildBlips', () => {
  const hoops = [
    { index: 0, x: 0, y: -14, owner: 'me' },
    { index: 1, x: 0, y: 14, owner: 'them' },
    { index: 2, x: 14, y: 0, owner: null },
  ];
  it('classifies hoop ownership from owner===myId', () => {
    const b = buildBlips([], hoops, [], 'me', null);
    expect(b.find((x) => x.x === 0 && x.y === -14)!.kind).toBe('hoopMine');
    expect(b.find((x) => x.x === 0 && x.y === 14)!.kind).toBe('hoopEnemy');
    expect(b.find((x) => x.x === 14 && x.y === 0)!.kind).toBe('hoopNeutral');
  });
  it('filters balls to free/flight and dedupes self', () => {
    const players = [player({ id: 'me' }), player({ id: 'a', x: 3 })];
    const balls = [
      { id: 'b1', x: 0, y: 0, z: 0, state: 'free' as const, carrier: null },
      { id: 'b2', x: 1, y: 1, z: 0, state: 'carried' as const, carrier: 'a' },
      { id: 'b3', x: 2, y: 2, z: 5, state: 'flight' as const, carrier: null },
    ];
    const b = buildBlips(players, [], balls, 'me', null);
    expect(b.filter((x) => x.kind === 'ball').length).toBe(2); // free + flight, not carried
    expect(b.filter((x) => x.kind === 'self').length).toBe(1);
  });
});
