import type { SimInput } from '../../shared/src/sim';

export class Input {
  private keys = new Set<string>();
  /** one-shot action latches, cleared when consumed */
  grab = false;
  shoot = false;
  dunk = false;
  defend = false;

  constructor() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.shoot = true;
      if (e.code === 'KeyM' || e.code === 'KeyE') this.grab = true; // grab/steal/block (E alias)
      if (e.code === 'KeyF') this.dunk = true;
      if (e.code === 'KeyQ') this.defend = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  /** Move vector in sim space: screen-up (W) = -y. Turbo is held (Shift). */
  move(): SimInput {
    let mx = 0;
    let my = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    return { mx, my, turbo: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }

  consumeActions(): { grab: boolean; shoot: boolean; dunk: boolean; defend: boolean } {
    const a = { grab: this.grab, shoot: this.shoot, dunk: this.dunk, defend: this.defend };
    this.grab = this.shoot = this.dunk = this.defend = false;
    return a;
  }
}
