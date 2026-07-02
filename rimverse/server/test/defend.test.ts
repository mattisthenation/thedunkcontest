import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { STUN_TIME, TICK_RATE } from '../../shared/src/constants';

const intent = (
  seq: number,
  over: Partial<{
    mx: number;
    my: number;
    grab: boolean;
    shoot: boolean;
    dunk: boolean;
    defend: boolean;
    turbo: boolean;
  }> = {},
) => ({ seq, mx: 0, my: 0, grab: false, shoot: false, dunk: false, defend: false, turbo: false, ...over });

function carrierAndDefender() {
  const w = new World();
  const c = w.addPlayer('carrier', 'c');
  const d = w.addPlayer('defender', 'd');
  c.pos = { x: 0, y: 0 };
  d.pos = { x: 0.8, y: 0 };
  c.pendingIntents.push(intent(1, { grab: true }));
  w.step();
  expect(c.ballId).not.toBeNull();
  return { w, c, d };
}

describe('defend', () => {
  it('successful steal knocks the ball loose and stuns the carrier', () => {
    const { w, c, d } = carrierAndDefender();
    w.rng = () => 0; // force success
    d.pendingIntents.push(intent(1, { defend: true }));
    w.step();
    expect(c.ballId).toBeNull();
    expect(c.anim).toBe('stunned');
    expect(d.anim).toBe('steal');
    expect(w.ballSnaps()[0].state).toBe('free');
  });

  it('failed steal just locks the stealer briefly', () => {
    const { w, c, d } = carrierAndDefender();
    w.rng = () => 0.999; // force failure
    d.pendingIntents.push(intent(1, { defend: true }));
    w.step();
    expect(c.ballId).not.toBeNull();
    expect(d.anim).toBe('steal');
  });

  it('stunned players cannot move until the stun expires', () => {
    const { w, c } = carrierAndDefender();
    w.rng = () => 0;
    w.players.get('defender')!.pendingIntents.push(intent(1, { defend: true }));
    w.step();
    const before = { ...c.pos };
    c.pendingIntents.push(intent(2, { mx: 1 }));
    w.step();
    expect(c.pos).toEqual(before);
    for (let i = 0; i < Math.ceil(STUN_TIME * TICK_RATE) + 2; i++) w.step();
    c.pendingIntents.push(intent(3, { mx: 1 }));
    w.step();
    expect(c.pos.x).toBeGreaterThan(before.x);
  });

  it('block cancels a dunk: ball loose, dunker stunned, blocker rewarded', () => {
    const w = new World();
    const a = w.addPlayer('dunker', 'a');
    const b = w.addPlayer('blocker', 'b');
    a.pos = { x: 0, y: 0 };
    a.pendingIntents.push(intent(1, { grab: true }));
    w.step();
    expect(a.ballId).not.toBeNull();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'dunker')!;
    a.pos = { x: hoop.x, y: hoop.y - 2 };
    b.pos = { x: hoop.x, y: hoop.y - 2.5 };
    a.pendingIntents.push(intent(2, { dunk: true }));
    w.step();
    expect(a.anim).toBe('dunk');
    const skillBefore = b.skill;
    w.rng = () => 0; // force block success
    b.pendingIntents.push(intent(1, { defend: true }));
    w.step();
    expect(a.anim).toBe('stunned');
    expect(b.skill).toBeGreaterThan(skillBefore);
    expect(w.ballSnaps()[0].state).toBe('free');
    expect(a.score).toBe(0);
    for (let i = 0; i < TICK_RATE * 2; i++) w.step();
    expect(a.score).toBe(0); // the cancelled flight never lands
  });
});
