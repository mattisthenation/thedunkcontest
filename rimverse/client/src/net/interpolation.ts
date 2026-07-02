export interface RemotePoint {
  id: string;
  x: number;
  y: number;
  z: number;
}

interface Entry {
  time: number;
  points: Map<string, RemotePoint>;
}

const WINDOW_MS = 1000;

export class SnapshotBuffer {
  private entries: Entry[] = [];

  get size(): number {
    return this.entries.length;
  }

  push(time: number, points: RemotePoint[]): void {
    this.entries.push({ time, points: new Map(points.map((p) => [p.id, p])) });
    const cutoff = time - WINDOW_MS;
    while (this.entries.length > 2 && this.entries[0].time < cutoff) this.entries.shift();
  }

  /** Positions at render time t (caller already applies INTERP_DELAY_MS). */
  sample(t: number): Map<string, { x: number; y: number; z: number }> {
    const out = new Map<string, { x: number; y: number; z: number }>();
    if (this.entries.length === 0) return out;
    let a = this.entries[0];
    let b = this.entries[this.entries.length - 1];
    for (let i = 0; i < this.entries.length - 1; i++) {
      if (this.entries[i].time <= t && this.entries[i + 1].time >= t) {
        a = this.entries[i];
        b = this.entries[i + 1];
        break;
      }
    }
    const span = b.time - a.time;
    const f = span > 0 ? Math.min(1, Math.max(0, (t - a.time) / span)) : 1;
    for (const [id, pb] of b.points) {
      const pa = a.points.get(id) ?? pb;
      out.set(id, {
        x: pa.x + (pb.x - pa.x) * f,
        y: pa.y + (pb.y - pa.y) * f,
        z: pa.z + (pb.z - pa.z) * f,
      });
    }
    return out;
  }
}
