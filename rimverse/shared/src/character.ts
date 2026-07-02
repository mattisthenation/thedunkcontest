/** v3 character model (cosmetics). Indices map into the renderer's arrays. */
export interface Character {
  skin: number;      // 0..5
  hair: number;      // 0..7
  hairColor: number; // 0..5
  jersey: string;    // #rrggbb
  jersey2: string;   // #rrggbb (trim)
  shorts: string;    // #rrggbb
  shoes: string;     // #rrggbb
  number: number;    // 0..99
  accessory: number; // 0..4
  build: number;     // 0..2
}

export const DEFAULT_CHARACTER: Character = {
  skin: 2, hair: 1, hairColor: 0, jersey: '#e8432e', jersey2: '#f5f0e0',
  shorts: '#e8432e', shoes: '#f5f0e0', number: 23, accessory: 0, build: 1,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
function intIn(v: unknown, min: number, max: number, def: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}
function hex(v: unknown, def: string): string {
  return typeof v === 'string' && HEX.test(v) ? v : def;
}

/** Clamp untrusted client cosmetics to known ranges (port of v3 roomManager.sanitizeCharacter). */
export function sanitizeCharacter(c: unknown): Character {
  const o = (c ?? {}) as Record<string, unknown>;
  const d = DEFAULT_CHARACTER;
  return {
    skin: intIn(o.skin, 0, 5, d.skin),
    hair: intIn(o.hair, 0, 7, d.hair),
    hairColor: intIn(o.hairColor, 0, 5, d.hairColor),
    jersey: hex(o.jersey, d.jersey),
    jersey2: hex(o.jersey2, d.jersey2),
    shorts: hex(o.shorts, d.shorts),
    shoes: hex(o.shoes, d.shoes),
    number: intIn(o.number, 0, 99, d.number),
    accessory: intIn(o.accessory, 0, 4, d.accessory),
    build: intIn(o.build, 0, 2, d.build),
  };
}

/** Hue (0..359) of a #rrggbb color; 0 for invalid/greyscale. Pure. */
export function hueOfHex(h: string): number {
  const m = HEX.exec(h);
  if (!m) return 0;
  const n = parseInt(m[0].slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return Math.round(hue) % 360;
}

/** The rimverse rig's colors, derived from the dunk-contest character ("soul"). */
export interface RimverseAppearance { hue: number; accentHue: number; }
export function deriveRimverseAppearance(c: Character): RimverseAppearance {
  return { hue: hueOfHex(c.jersey), accentHue: hueOfHex(c.jersey2) };
}
