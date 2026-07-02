import { describe, it, expect } from 'vitest';
import { Predictor } from '../src/net/prediction';
import { initialSimState, speedFor, stepPlayer, type SimState } from '../../shared/src/sim';
import { TICK_DT, TURBO_MAX } from '../../shared/src/constants';

describe('Predictor', () => {
  it('predicts forward locally', () => {
    const pred = new Predictor({ x: 0, y: 0 });
    pred.applyInput({ mx: 1, my: 0 }, 4);
    pred.applyInput({ mx: 1, my: 0 }, 4);
    expect(pred.pos.x).toBeCloseTo(2 * speedFor(1) * TICK_DT);
  });

  it('reconciles: server state + replay of unacked intents', () => {
    const pred = new Predictor({ x: 0, y: 0 });
    pred.applyInput({ mx: 1, my: 0 }, 4); // seq 1
    pred.applyInput({ mx: 1, my: 0 }, 4); // seq 2
    pred.applyInput({ mx: 1, my: 0 }, 4); // seq 3
    pred.reconcile({ x: 0.1, y: 0, turboLeft: TURBO_MAX, turboCd: 0 }, 2, 4);
    expect(pred.pos.x).toBeCloseTo(0.1 + speedFor(1) * TICK_DT);
    expect(pred.pendingCount).toBe(1);
  });

  it('freezes movement while action-locked (M4: no predict-walk during a dunk)', () => {
    const pred = new Predictor({ x: 0, y: 0 });
    pred.applyInput({ mx: 1, my: 0 }, 4, 1, true); // locked
    pred.applyInput({ mx: 1, my: 0 }, 4, 1, true); // still locked
    expect(pred.pos.x).toBe(0); // frozen in place, no rubber-band fuel
    expect(pred.pendingCount).toBe(2);
  });

  it('reconcile replays only the unlocked intents (M4)', () => {
    const pred = new Predictor({ x: 0, y: 0 });
    pred.applyInput({ mx: 1, my: 0 }, 4, 1, true); // seq 1, locked → no move
    pred.applyInput({ mx: 1, my: 0 }, 4, 1, false); // seq 2, free → moves
    pred.reconcile({ x: 0.1, y: 0, turboLeft: TURBO_MAX, turboCd: 0 }, 1, 4, 1);
    expect(pred.pos.x).toBeCloseTo(0.1 + speedFor(1) * TICK_DT); // only seq 2 replayed
    expect(pred.pendingCount).toBe(1);
  });

  it('matches the server exactly when they agree — including turbo state', () => {
    const pred = new Predictor({ x: 0, y: 0 });
    let server: SimState = initialSimState({ x: 0, y: 0 });
    for (let i = 0; i < 60; i++) {
      const input = { mx: Math.sin(i), my: Math.cos(i), turbo: i % 9 < 4 };
      pred.applyInput(input, 4, 1.1);
      server = stepPlayer(server, input, TICK_DT, 4, 1.1);
    }
    pred.reconcile(
      { x: server.pos.x, y: server.pos.y, turboLeft: server.turboLeft, turboCd: server.turboCd },
      60,
      4,
      1.1,
    );
    expect(pred.state).toEqual(server);
  });
});
