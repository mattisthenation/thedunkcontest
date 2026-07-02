import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/rng';

describe('mulberry32', () => {
  it('same seed → same sequence; output in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
