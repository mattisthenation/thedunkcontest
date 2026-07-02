import { describe, it, expect } from 'vitest';
import type { ClientMsg, ServerMsg } from '../src/protocol';

describe('protocol additive fields', () => {
  it('join carries an optional room; welcome carries room+mode; arena exists', () => {
    const join: ClientMsg = { t: 'join', name: 'A', room: 'rucker' };
    const welcome: ServerMsg = { t: 'welcome', id: 'x', tick: 0, x: 0, y: 0, room: 'rucker-1', mode: 'dunkContest' };
    const arena: ServerMsg = { t: 'arena', combined: 5 };
    expect(join.t).toBe('join');
    expect((welcome as { room: string }).room).toBe('rucker-1');
    expect((arena as { combined: number }).combined).toBe(5);
  });
});
