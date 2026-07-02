import { describe, it, expect } from 'vitest';
import { makeProbability, pickTargetHoop } from '../src/game/shooting';
import { World } from '../src/game/world';
import { TICK_RATE } from '../../shared/src/constants';
import { mulberry32 } from '../../shared/src/rng';

describe('shot math', () => {
  it('probability falls with distance, clamped to (0,1) interior', () => {
    expect(makeProbability(1)).toBeGreaterThan(makeProbability(10));
    expect(makeProbability(0)).toBeLessThanOrEqual(0.95);
    expect(makeProbability(1000)).toBeGreaterThanOrEqual(0.05);
  });

  it('targets the nearest hoop the shooter does not own', () => {
    const hoops = [
      { index: 0, x: 0, y: -14, owner: 'me' },
      { index: 1, x: 0, y: 14, owner: 'them' },
    ];
    expect(pickTargetHoop({ x: 0, y: 10 }, 'me', hoops)).toBe(1);
    expect(pickTargetHoop({ x: 0, y: -10 }, 'me', hoops)).toBe(1); // own hoop never targeted
  });
});

describe('world shooting integration', () => {
  function setupCarrier() {
    const w = new World();
    const p = w.addPlayer('me', 'me');
    p.pos = { x: 0, y: 0 };
    p.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    w.step(); // grabs the hub ball
    expect(p.ballId).not.toBeNull();
    return { w, p };
  }

  it('shoot intent launches a flight and locks the shooter briefly', () => {
    const { w, p } = setupCarrier();
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    w.step();
    expect(p.anim).toBe('shoot');
    expect(p.ballId).toBeNull();
    const ball = w.ballSnaps()[0];
    expect(ball.state).toBe('flight');
  });

  it('made shot scores +2 shooter / −2 hoop owner at landing', () => {
    const { w, p } = setupCarrier();
    w.rng = () => 0; // force make (rng < probability)
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    w.step();
    for (let i = 0; i < TICK_RATE * 3; i++) w.step();
    expect(p.score).toBe(2);
  });

  it('credits the defender by identity even if a join reslots indices mid-flight (M2)', () => {
    const w = new World();
    w.rng = () => 0; // force make
    const shooter = w.addPlayer('A', 'A');
    const defender = w.addPlayer('B', 'B');
    shooter.pos = { x: 0, y: 0 };
    shooter.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    w.step();
    const hoopB = w.hoopSnaps().find((h) => h.owner === 'B')!;
    shooter.pos = { x: hoopB.x, y: hoopB.y - 8 }; // mid-range, no dunk
    shooter.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    w.step(); // launches a made flight at B's hoop
    w.addPlayer('C', 'C'); // join mid-flight → reslot renumbers hoop indices
    for (let i = 0; i < TICK_RATE * 3; i++) w.step();
    expect(shooter.score).toBe(2);
    // the defended build is penalized by identity (score clamps at 0, so check skill)
    expect(defender.skill).toBeLessThan(0.5); // B took the hit
    expect(w.players.get('C')!.skill).toBe(0.5); // newcomer untouched
  });

  it('voids the shot if the targeted defender leaves mid-flight (M3, no phantom +2)', () => {
    const w = new World();
    w.rng = () => 0; // would-be make
    const shooter = w.addPlayer('A', 'A');
    w.addPlayer('B', 'B');
    shooter.pos = { x: 0, y: 0 };
    shooter.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
    w.step();
    const hoopB = w.hoopSnaps().find((h) => h.owner === 'B')!;
    shooter.pos = { x: hoopB.x, y: hoopB.y - 8 };
    shooter.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    w.step();
    w.removePlayer('B'); // the defended rim leaves the game mid-flight
    for (let i = 0; i < TICK_RATE * 3; i++) w.step();
    expect(shooter.score).toBe(0); // no phantom +2 on a vanished rim
    const ball = w.ballSnaps()[0];
    expect(['free', 'respawning']).toContain(ball.state);
  });

  it('missed shot leaves a free ball near the hoop', () => {
    const { w, p } = setupCarrier();
    w.rng = () => 0.999; // force miss
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    w.step();
    for (let i = 0; i < TICK_RATE * 3; i++) w.step();
    const ball = w.ballSnaps()[0];
    expect(ball.state).toBe('free');
    expect(p.score).toBe(0);
  });

  it('dunk picks a variant anim and lunges toward the rim', () => {
    const { w, p } = setupCarrier();
    p.skill = 1; // full roster
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'me')!;
    p.pos = { x: hoop.x, y: hoop.y - 2.5 };
    const startDist = Math.hypot(p.pos.x - hoop.x, p.pos.y - hoop.y);
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: false, dunk: true });
    w.step();
    expect(p.anim.startsWith('dunk')).toBe(true);
    for (let i = 0; i < 15; i++) w.step(); // half the dunk
    const midDist = Math.hypot(p.pos.x - hoop.x, p.pos.y - hoop.y);
    expect(midDist).toBeLessThan(startDist); // lunging in
  });

  it('variants vary across dunks for a skilled player', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      const w = new World();
      w.rng = mulberry32(seed);
      const p = w.addPlayer('me', 'me');
      p.pos = { x: 0, y: 0 };
      p.skill = 1;
      p.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: true, shoot: false, dunk: false });
      w.step();
      const hoop = w.hoopSnaps().find((h) => h.owner !== 'me')!;
      p.pos = { x: hoop.x + 2, y: hoop.y - 1.5 }; // angled approach
      p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: false, dunk: true });
      w.step();
      seen.add(p.anim);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('dunk requires range; in range it always scores and locks for DUNK_TIME', () => {
    const { w, p } = setupCarrier();
    // out of range: dunk intent ignored
    p.pendingIntents.push({ seq: 2, mx: 0, my: 0, grab: false, shoot: false, dunk: true });
    w.step();
    expect(p.anim).not.toBe('dunk');
    expect(p.ballId).not.toBeNull();
    // walk into range of the practice hoop at (0, +14)
    p.pos = { x: 0, y: 12.5 };
    p.pendingIntents.push({ seq: 3, mx: 0, my: 0, grab: false, shoot: false, dunk: true });
    w.step();
    expect(p.anim.startsWith('dunk')).toBe(true);
    // V5: each dunk variant has its own windup+rim+hang+recover lock (longer than the
    // legacy fixed DUNK_TIME), so step well past the longest variant to see it resolve.
    for (let i = 0; i < TICK_RATE * 2; i++) w.step();
    expect(p.score).toBe(2);
    expect(p.anim.startsWith('dunk')).toBe(false);
  });
});
