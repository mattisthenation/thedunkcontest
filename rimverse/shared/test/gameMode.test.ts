import { describe, it, expect } from 'vitest';
import { DEFAULT_MODE, type GameMode } from '../src/gameMode';

describe('GameMode', () => {
  it('defaults to rimverse (existing behavior)', () => {
    const m: GameMode = DEFAULT_MODE;
    expect(m).toBe('rimverse');
  });
});
