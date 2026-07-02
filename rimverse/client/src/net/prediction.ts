import { TICK_DT } from '../../../shared/src/constants';
import { initialSimState, stepPlayer, type SimInput, type SimState } from '../../../shared/src/sim';
import type { Vec2 } from '../../../shared/src/types';

export class Predictor {
  state: SimState;
  seq = 0;
  private pending: { seq: number; input: SimInput; locked: boolean }[] = [];

  constructor(start: Vec2) {
    this.state = initialSimState(start);
  }

  get pos(): Vec2 {
    return this.state.pos;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /**
   * Sample local input for one fixed tick: advance prediction, return seq to send.
   * `locked` mirrors the server's action-lock (shoot/dunk/steal/block/stun/celebrate):
   * the server integrates no movement while locked, so neither do we (M4 — no rubber-band).
   */
  applyInput(input: SimInput, n: number, size = 1, locked = false): number {
    this.seq++;
    this.pending.push({ seq: this.seq, input, locked });
    if (!locked) this.state = stepPlayer(this.state, input, TICK_DT, n, size);
    return this.seq;
  }

  /** Snap to the authoritative state, drop acked intents, replay the rest (locked = no-op). */
  reconcile(
    server: { x: number; y: number; turboLeft: number; turboCd: number },
    ack: number,
    n: number,
    size = 1,
  ): void {
    this.pending = this.pending.filter((p) => p.seq > ack);
    let state: SimState = {
      pos: { x: server.x, y: server.y },
      turboLeft: server.turboLeft,
      turboCd: server.turboCd,
    };
    for (const p of this.pending) {
      if (!p.locked) state = stepPlayer(state, p.input, TICK_DT, n, size);
    }
    this.state = state;
  }
}
