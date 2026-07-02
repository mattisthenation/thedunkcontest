import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { BALL_RESPAWN_DELAY, GRAB_RADIUS, TICK_RATE } from '../../shared/src/constants';

function tickN(w: World, n: number) {
  for (let i = 0; i < n; i++) w.step();
}

const grabIntent = (seq: number) => ({ seq, mx: 0, my: 0, grab: true, shoot: false, dunk: false });

describe('balls', () => {
  it('spawns max(1, ceil(N/6)) balls at the hub', () => {
    const w = new World();
    w.addPlayer('p1', 'a');
    w.step();
    expect(w.ballSnaps().length).toBe(1);
    expect(w.ballSnaps()[0].x).toBeCloseTo(0);
    for (let i = 2; i <= 7; i++) w.addPlayer(`p${i}`, `n${i}`);
    w.step();
    expect(w.ballSnaps().length).toBe(2);
  });

  it('grab intent within radius takes a free ball; closest contender wins', () => {
    const w = new World();
    const a = w.addPlayer('a', 'a');
    const b = w.addPlayer('b', 'b');
    a.pos = { x: 0.5, y: 0 };
    b.pos = { x: 1.0, y: 0 };
    a.pendingIntents.push(grabIntent(1));
    b.pendingIntents.push(grabIntent(1));
    w.step();
    expect(a.ballId).not.toBeNull();
    expect(b.ballId).toBeNull();
  });

  it('grab outside GRAB_RADIUS does nothing', () => {
    const w = new World();
    const a = w.addPlayer('a', 'a');
    a.pos = { x: GRAB_RADIUS + 2, y: 0 };
    a.pendingIntents.push(grabIntent(1));
    w.step();
    expect(a.ballId).toBeNull();
  });

  it('scored ball respawns at the hub after the delay', () => {
    const w = new World();
    const a = w.addPlayer('a', 'a');
    a.pos = { x: 0, y: 0 };
    a.pendingIntents.push(grabIntent(1));
    w.step();
    const ballId = a.ballId!;
    expect(ballId).not.toBeNull();
    w.scoreBall(ballId); // helper used by shooting
    expect(w.ballSnaps().find((b) => b.id === ballId)!.state).toBe('respawning');
    tickN(w, Math.ceil(BALL_RESPAWN_DELAY * TICK_RATE) + 1);
    const ball = w.ballSnaps().find((b) => b.id === ballId)!;
    expect(ball.state).toBe('free');
    expect(ball.x).toBeCloseTo(0);
  });
});
