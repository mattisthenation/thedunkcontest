import { ANIMS, frameIndex, type AnimName } from '../sprites/poses';
import { drawPose, drawPoseFacing, type Facing } from '../sprites/draw';
import { CELL_PX } from '../sprites/atlas';
import { renderPreview, generateSpriteSheet, HAIR_STYLES, SKINS, ACCESSORIES, BUILDS } from '../dunkchar/generator';
import { DEFAULT_CHARACTER } from '../../../shared/src/character';

const stage = document.getElementById('stage')!;
const speedEl = document.getElementById('speed') as HTMLInputElement;
const zoomEl = document.getElementById('zoom') as HTMLInputElement;

let liveFacing: Facing = 'side';
const facingBar = document.createElement('span');
facingBar.style.marginLeft = '16px';
for (const f of ['side', 'front', 'back'] as Facing[]) {
  const b = document.createElement('button');
  b.textContent = f;
  b.onclick = () => (liveFacing = f);
  facingBar.append(b);
}
document.getElementById('controls')!.append(facingBar);

const cells: { name: AnimName; ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement }[] = [];
for (const name of Object.keys(ANIMS) as AnimName[]) {
  const wrap = document.createElement('div');
  wrap.className = 'cell';
  const canvas = document.createElement('canvas');
  const label = document.createElement('div');
  label.textContent = name;
  wrap.append(canvas, label);
  stage.append(wrap);
  cells.push({ name, ctx: canvas.getContext('2d')!, canvas });
}

// Static filmstrips: every keyframe of every anim, drawn once (pose inspection).
const strips = document.createElement('div');
strips.id = 'strips';
strips.style.padding = '0 24px 24px';
document.body.append(strips);
for (const name of Object.keys(ANIMS) as AnimName[]) {
  const def = ANIMS[name];
  const label = document.createElement('div');
  label.textContent = `${name} — ${def.frames.length}f @ ${def.fps}fps`;
  const canvas = document.createElement('canvas');
  canvas.width = CELL_PX * def.frames.length;
  canvas.height = CELL_PX;
  canvas.style.border = '1px solid #3a2a5a';
  canvas.style.background = '#150a2e';
  strips.append(label, canvas);
  const ctx = canvas.getContext('2d')!;
  def.frames.forEach((pose, f) => {
    ctx.save();
    ctx.translate(f * CELL_PX, 0);
    ctx.strokeStyle = '#3a2a5a';
    ctx.beginPath();
    ctx.moveTo(0, CELL_PX * 0.94);
    ctx.lineTo(CELL_PX, CELL_PX * 0.94);
    ctx.moveTo(CELL_PX, 0);
    ctx.lineTo(CELL_PX, CELL_PX);
    ctx.stroke();
    drawPose(ctx, pose, CELL_PX, { hue: 210, accentHue: 60 });
    ctx.restore();
  });
}

const start = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const speed = Number(speedEl.value);
  const zoom = Number(zoomEl.value);
  const px = CELL_PX * zoom;
  const t = ((now - start) / 1000) * speed;
  for (const c of cells) {
    if (c.canvas.width !== px) {
      c.canvas.width = px;
      c.canvas.height = px;
    }
    c.ctx.clearRect(0, 0, px, px);
    // floor line for grounding reference
    c.ctx.strokeStyle = '#3a2a5a';
    c.ctx.beginPath();
    c.ctx.moveTo(0, px * 0.94);
    c.ctx.lineTo(px, px * 0.94);
    c.ctx.stroke();
    const def = ANIMS[c.name];
    const loopT = def.loop ? t : t % (def.frames.length / def.fps + 0.8); // replay one-shots
    drawPoseFacing(c.ctx, def.frames[frameIndex(def, loopT)], px, { hue: 210, accentHue: 60 }, liveFacing);
  }
}
requestAnimationFrame(frame);

// ---- Dunk Contest character preview ----------------------------------------

const dunkSection = document.createElement('div');
dunkSection.style.cssText = 'padding: 0 24px 48px;';

const dunkHeading = document.createElement('h2');
dunkHeading.textContent = 'DUNK CONTEST — character preview';
dunkHeading.style.marginTop = '32px';
dunkSection.append(dunkHeading);

const samples = [
  DEFAULT_CHARACTER,
  { ...DEFAULT_CHARACTER, skin: 5, hair: 3, hairColor: 2, jersey: '#2d5fd1', jersey2: '#ffd23f', shorts: '#2d5fd1', shoes: '#ffd23f', accessory: 1, build: 2, number: 8 },
  { ...DEFAULT_CHARACTER, skin: 1, hair: 6, jersey: '#05ffa1', jersey2: '#ff71ce', shorts: '#05ffa1', shoes: '#ff71ce', accessory: 2, build: 0, number: 42 },
];

const ANIM_NAMES: Record<number, string> = { 0: 'idle', 1: 'run', 2: 'dribble', 3: 'jump', 4: 'shoot', 5: 'dunk', 6: 'celebrate' };
const PREVIEW_ANIMS: [number, number][] = [[0, 0], [2, 0], [5, 2]]; // [animCode, frame]

for (const char of samples) {
  const charWrap = document.createElement('div');
  charWrap.style.cssText = 'margin-bottom: 24px;';

  const charLabel = document.createElement('div');
  charLabel.style.cssText = 'margin-bottom: 8px; color: #05ffa1;';
  charLabel.textContent = `#${char.number}  skin:${char.skin}  hair:${HAIR_STYLES[char.hair]}  build:${BUILDS[char.build]}  acc:${ACCESSORIES[char.accessory]}`;
  charWrap.append(charLabel);

  const frameRow = document.createElement('div');
  frameRow.style.cssText = 'display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;';

  for (const [animCode, frameNum] of PREVIEW_ANIMS) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const canvas = renderPreview(char, animCode, frameNum, 3);
    const lbl = document.createElement('div');
    lbl.textContent = `${ANIM_NAMES[animCode]} f${frameNum}`;
    cell.append(canvas, lbl);
    frameRow.append(cell);
  }

  // Full sprite sheet thumbnail.
  const sheetCell = document.createElement('div');
  sheetCell.className = 'cell';
  const sheet = generateSpriteSheet(char);
  sheet.canvas.style.border = '1px solid #3a2a5a';
  sheet.canvas.style.background = '#150a2e';
  sheet.canvas.style.maxWidth = '288px'; // 96*6*0.5 — half-size to fit
  sheet.canvas.style.imageRendering = 'pixelated';
  sheet.canvas.style.width = '288px';
  sheet.canvas.style.height = 'auto';
  const sheetLbl = document.createElement('div');
  sheetLbl.textContent = 'full sheet (7 anims × 6 frames)';
  sheetCell.append(sheet.canvas, sheetLbl);
  frameRow.append(sheetCell);

  charWrap.append(frameRow);
  dunkSection.append(charWrap);
}

document.body.append(dunkSection);
