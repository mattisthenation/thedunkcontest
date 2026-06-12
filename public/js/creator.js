// creator.js — "choose your fighter": character design panel with a live
// animated preview. The config it produces is exactly what the server
// sanitizes, persists, and ships to other clients.

import { renderPreview, SKINS, HAIR_COLORS, HAIR_STYLES, ACCESSORIES, BUILDS } from './generator.js';

const JERSEY_COLORS = [
  '#e8432e', '#2e6fe8', '#1fa84a', '#f2b011', '#9b30c9',
  '#e85a9b', '#11b5b5', '#f06014', '#23282e', '#f5f0e0',
];

const PREVIEW_ANIMS = [0, 1, 2, 6]; // idle, run, dribble, celebrate

export class Creator {
  constructor(mount) {
    this.mount = mount;
    this.cfg = this.load();
    this.previewAnim = 0;
    this.previewFrame = 0;
    this.build();
    this.timer = setInterval(() => this.tickPreview(), 140);
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.dunkCharacter || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch { /* fall through */ }
    return this.randomCfg();
  }

  save() {
    localStorage.dunkCharacter = JSON.stringify(this.cfg);
  }

  current() {
    return { ...this.cfg };
  }

  randomCfg() {
    const j = Math.floor(Math.random() * JERSEY_COLORS.length);
    return {
      skin: rand(SKINS.length),
      hair: rand(HAIR_STYLES.length),
      hairColor: rand(4),
      jersey: JERSEY_COLORS[j],
      jersey2: JERSEY_COLORS[(j + 5) % JERSEY_COLORS.length],
      shorts: JERSEY_COLORS[j],
      shoes: Math.random() < 0.5 ? '#f5f0e0' : '#23282e',
      number: Math.floor(Math.random() * 99) + 1,
      accessory: rand(ACCESSORIES.length),
      build: rand(BUILDS.length),
    };
  }

  build() {
    this.mount.innerHTML = `
      <div class="creator">
        <div class="previewBox">
          <canvas id="charPreview" width="192" height="256"></canvas>
          <div class="previewBtns">
            <button type="button" id="prevAnimBtn" class="mini">▶ POSE</button>
            <button type="button" id="randomBtn" class="mini">🎲 RANDOM</button>
          </div>
        </div>
        <div class="knobs">
          ${this.swatchRow('SKIN', 'skin', SKINS.map((s) => s[0]))}
          ${this.cycleRow('HAIR', 'hair', HAIR_STYLES)}
          ${this.swatchRow('HAIR COLOR', 'hairColor', HAIR_COLORS)}
          ${this.swatchRow('JERSEY', 'jersey', JERSEY_COLORS)}
          ${this.swatchRow('TRIM', 'jersey2', JERSEY_COLORS)}
          ${this.swatchRow('SHOES', 'shoes', ['#f5f0e0', '#23282e', '#e8432e', '#2e6fe8', '#f2b011'])}
          ${this.cycleRow('BUILD', 'build', BUILDS)}
          ${this.cycleRow('EXTRA', 'accessory', ACCESSORIES)}
          <div class="knobRow"><label>NUMBER</label>
            <input type="number" id="numInput" min="0" max="99" value="${this.cfg.number}">
          </div>
        </div>
      </div>`;

    this.canvas = this.mount.querySelector('#charPreview');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.mount.querySelector('#randomBtn').addEventListener('click', () => {
      this.cfg = this.randomCfg();
      this.save();
      this.build();
    });
    this.mount.querySelector('#prevAnimBtn').addEventListener('click', () => {
      this.previewAnim = (this.previewAnim + 1) % PREVIEW_ANIMS.length;
      this.previewFrame = 0;
    });
    this.mount.querySelector('#numInput').addEventListener('input', (e) => {
      this.cfg.number = Math.max(0, Math.min(99, Number(e.target.value) || 0));
      this.save();
    });

    for (const el of this.mount.querySelectorAll('[data-key]')) {
      el.addEventListener('click', () => {
        const { key, val } = el.dataset;
        if (el.classList.contains('cycle')) {
          const len = Number(val);
          this.cfg[key] = (Number(this.cfg[key] ?? 0) + 1) % len;
          el.querySelector('.cycleVal').textContent = this.cycleLabel(key, this.cfg[key]);
        } else {
          this.cfg[key] = isNaN(Number(val)) ? val : Number(val);
          for (const sib of this.mount.querySelectorAll(`[data-key="${key}"]`)) sib.classList.remove('sel');
          el.classList.add('sel');
        }
        this.save();
      });
    }
    this.renderFrame();
  }

  cycleLabel(key, v) {
    if (key === 'hair') return HAIR_STYLES[v];
    if (key === 'accessory') return ACCESSORIES[v];
    if (key === 'build') return BUILDS[v];
    return v;
  }

  swatchRow(label, key, colors) {
    const isIndex = key === 'skin' || key === 'hairColor';
    return `<div class="knobRow"><label>${label}</label><div class="swatches">
      ${colors.map((c, i) => {
        const val = isIndex ? i : c;
        const sel = this.cfg[key] === val ? ' sel' : '';
        return `<button type="button" class="swatch${sel}" data-key="${key}" data-val="${val}" style="background:${c}"></button>`;
      }).join('')}
    </div></div>`;
  }

  cycleRow(label, key, options) {
    return `<div class="knobRow"><label>${label}</label>
      <button type="button" class="cycle" data-key="${key}" data-val="${options.length}">
        <span class="cycleVal">${this.cycleLabel(key, this.cfg[key] ?? 0)}</span> ▸
      </button></div>`;
  }

  tickPreview() {
    this.previewFrame++;
    this.renderFrame();
  }

  renderFrame() {
    if (!this.ctx) return;
    const anim = PREVIEW_ANIMS[this.previewAnim];
    const frame = renderPreview(this.cfg, anim, this.previewFrame, 2);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(frame, 0, 0);
  }
}

function rand(n) { return Math.floor(Math.random() * n); }
