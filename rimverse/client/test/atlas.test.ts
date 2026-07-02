import { describe, it, expect } from 'vitest';
import { atlasLayout, cellUV } from '../src/sprites/atlas';

describe('atlas layout', () => {
  it('lays out one row per anim, one column per frame', () => {
    const layout = atlasLayout();
    expect(layout.rows.idle.row).toBe(0);
    expect(layout.rows.run.frames).toBe(8);
    expect(layout.cols).toBeGreaterThanOrEqual(8);
    expect(layout.rowCount).toBe(15);
  });

  it('cellUV maps a frame to its sub-rectangle', () => {
    const layout = atlasLayout();
    const uv = cellUV(layout, 'run', 2);
    expect(uv.u0).toBeCloseTo(2 / layout.cols);
    expect(uv.u1).toBeCloseTo(3 / layout.cols);
    // side facing keeps the base-row v (row*3 / rowCount*3)
    expect(uv.v0).toBeCloseTo(layout.rows.run.row / layout.rowCount);
  });

  it('front/back facings select adjacent rows', () => {
    const layout = atlasLayout();
    const totalRows = layout.rowCount * 3;
    const side = cellUV(layout, 'run', 0, 'side');
    const front = cellUV(layout, 'run', 0, 'front');
    const back = cellUV(layout, 'run', 0, 'back');
    expect(front.v0).toBeCloseTo(side.v0 + 1 / totalRows);
    expect(back.v0).toBeCloseTo(side.v0 + 2 / totalRows);
  });
});
