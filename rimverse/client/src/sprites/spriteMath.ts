/** World height of the sprite quad for size=1 (matches cell headroom: 1/0.62). */
export const QUAD_H = 2.0;

/** World Y of the sprite center: grounded base (feet on the bent floor) + jump height z. */
export function spriteWorldY(size: number, bendY: number, z: number): number {
  return (QUAD_H * size) / 2 - 0.06 + bendY + z;
}
