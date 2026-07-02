import { ANIMS, type AnimName } from './poses';
import { drawPoseFacing, type Appearance, type Facing } from './draw';

export const FACINGS: Facing[] = ['side', 'front', 'back'];

export const CELL_PX = 128;

export interface AtlasLayout {
  cols: number;
  rowCount: number;
  rows: Record<AnimName, { row: number; frames: number }>;
}

export function atlasLayout(): AtlasLayout {
  const names = Object.keys(ANIMS) as AnimName[];
  const rows = {} as AtlasLayout['rows'];
  let cols = 0;
  names.forEach((name, i) => {
    const frames = ANIMS[name].frames.length;
    rows[name] = { row: i, frames };
    cols = Math.max(cols, frames);
  });
  return { cols, rowCount: names.length, rows };
}

export interface CellUV {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** v measured from the TOP of the atlas image (flip when applying to three.js UVs). */
export function cellUV(
  layout: AtlasLayout,
  anim: AnimName,
  frame: number,
  facing: Facing = 'side',
): CellUV {
  const row = layout.rows[anim].row * FACINGS.length + FACINGS.indexOf(facing);
  const totalRows = layout.rowCount * FACINGS.length;
  return {
    u0: frame / layout.cols,
    u1: (frame + 1) / layout.cols,
    v0: row / totalRows,
    v1: (row + 1) / totalRows,
  };
}

const cache = new Map<string, HTMLCanvasElement>();

/** Render every anim frame for an appearance into one canvas. Cached by hue bucket. */
export function buildAtlas(look: Appearance): HTMLCanvasElement {
  const key = `h${Math.round(look.hue / 30) * 30}a${Math.round(look.accentHue / 30) * 30}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const layout = atlasLayout();
  const canvas = document.createElement('canvas');
  canvas.width = layout.cols * CELL_PX;
  canvas.height = layout.rowCount * FACINGS.length * CELL_PX;
  const ctx = canvas.getContext('2d')!;
  for (const [name, def] of Object.entries(ANIMS)) {
    const baseRow = layout.rows[name as AnimName].row * FACINGS.length;
    FACINGS.forEach((facing, fi) => {
      def.frames.forEach((pose, f) => {
        ctx.save();
        ctx.translate(f * CELL_PX, (baseRow + fi) * CELL_PX);
        ctx.beginPath();
        ctx.rect(0, 0, CELL_PX, CELL_PX);
        ctx.clip();
        drawPoseFacing(ctx, pose, CELL_PX, look, facing);
        ctx.restore();
      });
    });
  }
  cache.set(key, canvas);
  return canvas;
}
