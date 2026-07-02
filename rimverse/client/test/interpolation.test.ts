import { describe, it, expect } from 'vitest';
import { SnapshotBuffer } from '../src/net/interpolation';

describe('SnapshotBuffer', () => {
  it('lerps remote positions between snapshots at render time', () => {
    const buf = new SnapshotBuffer();
    buf.push(1000, [{ id: 'r1', x: 0, y: 0, z: 0 }]);
    buf.push(1100, [{ id: 'r1', x: 10, y: 0, z: 0 }]);
    const at = buf.sample(1050);
    expect(at.get('r1')!.x).toBeCloseTo(5);
  });

  it('clamps to latest when render time is ahead', () => {
    const buf = new SnapshotBuffer();
    buf.push(1000, [{ id: 'r1', x: 0, y: 0, z: 0 }]);
    buf.push(1100, [{ id: 'r1', x: 10, y: 0, z: 0 }]);
    expect(buf.sample(2000).get('r1')!.x).toBe(10);
  });

  it('drops snapshots older than the window', () => {
    const buf = new SnapshotBuffer();
    for (let i = 0; i < 100; i++) buf.push(i * 50, [{ id: 'r1', x: i, y: 0, z: 0 }]);
    expect(buf.size).toBeLessThan(30);
  });

  it('lerps remote z on the same track as x/y', () => {
    const buf = new SnapshotBuffer();
    buf.push(1000, [{ id: 'r1', x: 0, y: 0, z: 0 }]);
    buf.push(1100, [{ id: 'r1', x: 0, y: 0, z: 2 }]);
    const at = buf.sample(1050);
    expect(at.get('r1')!.z).toBeCloseTo(1);
  });
});
