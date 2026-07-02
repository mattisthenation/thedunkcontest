import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { TICK_RATE } from '../../shared/src/constants';

describe('server bots', () => {
  it('setBotCount adds and removes bot players; humans untouched', () => {
    const w = new World();
    w.addPlayer('human', 'me');
    w.setBotCount(5);
    expect(w.players.size).toBe(6);
    expect([...w.players.values()].filter((p) => p.isBot).length).toBe(5);
    w.setBotCount(2);
    expect([...w.players.values()].filter((p) => p.isBot).length).toBe(2);
    expect(w.players.has('human')).toBe(true);
    w.setBotCount(0);
    expect([...w.players.values()].filter((p) => p.isBot).length).toBe(0);
  });

  it('never exceeds MAX_PLAYERS when adding bots', () => {
    const w = new World();
    w.setBotCount(500);
    expect(w.players.size).toBeLessThanOrEqual(100);
  });

  it('bots act: within a few seconds at least one bot grabs a ball or scores', () => {
    const w = new World();
    w.setBotCount(4);
    let acted = false;
    for (let i = 0; i < TICK_RATE * 10; i++) {
      w.step();
      if ([...w.players.values()].some((p) => p.isBot && (p.ballId || p.score > 0))) {
        acted = true;
        break;
      }
    }
    expect(acted).toBe(true);
  });
});

describe('bots in dunkContest target the nearest rim', () => {
  it('a ball-carrying bot near the +y rim heads toward it, not rim 0', () => {
    const w = new World('dunkContest');
    const bot = w.addPlayer('bot:1', 'BOT 1', true);
    w.step();
    const ball = [...w.balls.values()][0];
    ball.state = 'carried'; ball.carrier = bot.id; bot.ballId = ball.id;
    bot.pos = { x: 0, y: 10 }; // near the +y rim (12.3), far from the -y rim (-12.3)
    const yStart = bot.pos.y;
    for (let i = 0; i < 30; i++) w.step();
    // It should approach the near (+y) rim — move toward +y or already be acting there.
    expect(bot.pos.y).toBeGreaterThanOrEqual(yStart - 1);
  });
});
