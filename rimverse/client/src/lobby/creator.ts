import { Character, DEFAULT_CHARACTER, sanitizeCharacter } from '../../../shared/src/character';
import { renderPreview, SKINS, HAIR_COLORS, HAIR_STYLES, ACCESSORIES, BUILDS } from '../dunkchar/generator';

const CHAR_KEY = 'rimverse-character';
const JERSEY_COLORS = ['#e8432e', '#2e6fe8', '#1fa84a', '#f2b011', '#9b30c9', '#e85a9b', '#11b5b5', '#f06014', '#23282e', '#f5f0e0'];
const SHOE_COLORS = ['#f5f0e0', '#23282e', '#e8432e', '#2e6fe8', '#f2b011'];
const PREVIEW_ANIMS = [0, 1, 2, 6]; // idle, run, dribble, celebrate (v3 creator.js order)

export function loadCharacter(): Character {
  try {
    const raw = localStorage.getItem(CHAR_KEY);
    if (raw) return sanitizeCharacter(JSON.parse(raw));
  } catch { /* fall through to default */ }
  return { ...DEFAULT_CHARACTER };
}

export function persistCharacter(c: Character): void {
  localStorage.setItem(CHAR_KEY, JSON.stringify(sanitizeCharacter(c)));
}

function randomCharacter(): Character {
  const rand = (n: number) => Math.floor(Math.random() * n);
  const j = rand(JERSEY_COLORS.length);
  return sanitizeCharacter({
    skin: rand(SKINS.length),
    hair: rand(HAIR_STYLES.length),
    hairColor: rand(4), // v3 parity: intentionally 0–3 only (not rand(HAIR_COLORS.length)); do not "fix"
    jersey: JERSEY_COLORS[j],
    jersey2: JERSEY_COLORS[(j + 5) % JERSEY_COLORS.length],
    shorts: JERSEY_COLORS[j], // v3 parity: shorts always match jersey; no separate UI control
    shoes: Math.random() < 0.5 ? '#f5f0e0' : '#23282e',
    number: rand(99) + 1,
    accessory: rand(ACCESSORIES.length),
    build: rand(BUILDS.length),
  });
}

/** Port of v3 public/js/creator.js — HAIR/BUILD/EXTRA are <select> dropdowns (the only deviation). */
export class Creator {
  private mount: HTMLElement;
  private cfg: Character;
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private previewAnim = 0;
  private previewFrame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(mount: HTMLElement) {
    this.mount = mount;
    this.cfg = loadCharacter();
    this.build();
    this.timer = setInterval(() => { this.previewFrame++; this.renderFrame(); }, 140);
  }

  current(): Character { return { ...this.cfg }; }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private setKey(key: keyof Character, val: number | string): void {
    (this.cfg as unknown as Record<string, unknown>)[key] = val;
    persistCharacter(this.cfg);
  }

  private swatchRow(label: string, key: keyof Character, colors: string[], indexed: boolean): string {
    const cells = colors.map((c, i) => {
      const val = indexed ? i : c;
      const sel = this.cfg[key] === val ? ' sel' : '';
      return `<button type="button" class="swatch${sel}" data-key="${key}" data-val="${val}" style="background:${c}"></button>`;
    }).join('');
    return `<div class="knobRow"><label>${label}</label><div class="swatches">${cells}</div></div>`;
  }

  private selectRow(label: string, key: keyof Character, options: string[]): string {
    const cur = Number(this.cfg[key]);
    const opts = options.map((o, i) => `<option value="${i}"${i === cur ? ' selected' : ''}>${o}</option>`).join('');
    return `<div class="knobRow"><label>${label}</label><select data-key="${key}">${opts}</select></div>`;
  }

  private build(): void {
    this.mount.innerHTML = `
      <div class="creator">
        <div class="previewBox">
          <canvas id="charPreview" width="192" height="256"></canvas>
          <div class="previewBtns">
            <button class="mini" id="prevAnimBtn">▶ POSE</button>
            <button class="mini" id="randomBtn">🎲 RANDOM</button>
          </div>
        </div>
        <div class="knobs">
          ${this.swatchRow('SKIN', 'skin', SKINS.map((s) => s[0]), true)}
          ${this.selectRow('HAIR', 'hair', HAIR_STYLES)}
          ${this.swatchRow('HAIR COLOR', 'hairColor', HAIR_COLORS, true)}
          ${this.swatchRow('JERSEY', 'jersey', JERSEY_COLORS, false)}
          ${this.swatchRow('TRIM', 'jersey2', JERSEY_COLORS, false)}
          ${this.swatchRow('SHOES', 'shoes', SHOE_COLORS, false)}
          ${this.selectRow('BUILD', 'build', BUILDS)}
          ${this.selectRow('EXTRA', 'accessory', ACCESSORIES)}
          <div class="knobRow"><label>NUMBER</label><input type="number" id="numInput" min="0" max="99" value="${this.cfg.number}"></div>
        </div>
      </div>`;
    this.canvas = this.mount.querySelector('#charPreview') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    this.bind();
    this.renderFrame();
  }

  private bind(): void {
    (this.mount.querySelector('#randomBtn') as HTMLElement).addEventListener('click', () => {
      this.cfg = randomCharacter();
      persistCharacter(this.cfg);
      this.build();
    });
    (this.mount.querySelector('#prevAnimBtn') as HTMLElement).addEventListener('click', () => {
      this.previewAnim = (this.previewAnim + 1) % PREVIEW_ANIMS.length;
      this.previewFrame = 0;
    });
    (this.mount.querySelector('#numInput') as HTMLElement).addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) || 0;
      this.setKey('number', Math.max(0, Math.min(99, v)));
    });
    for (const el of Array.from(this.mount.querySelectorAll<HTMLElement>('[data-key]'))) {
      const key = el.dataset.key as keyof Character;
      if (el.tagName === 'SELECT') {
        el.addEventListener('change', () => this.setKey(key, Number((el as HTMLSelectElement).value)));
      } else {
        el.addEventListener('click', () => {
          const raw = el.dataset.val as string;
          this.setKey(key, isNaN(Number(raw)) ? raw : Number(raw));
          for (const sib of Array.from(this.mount.querySelectorAll(`[data-key="${key}"]`))) sib.classList.remove('sel');
          el.classList.add('sel');
        });
      }
    }
  }

  private renderFrame(): void {
    if (!this.ctx) return;
    const anim = PREVIEW_ANIMS[this.previewAnim];
    const frame = renderPreview(this.cfg, anim, this.previewFrame, 2);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(frame, 0, 0);
  }
}
