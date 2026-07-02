import { describe, it, expect } from 'vitest';
import { DEFAULT_CHARACTER, sanitizeCharacter, deriveRimverseAppearance, hueOfHex } from '../src/character';

describe('sanitizeCharacter', () => {
  it('passes a valid character through unchanged', () => {
    expect(sanitizeCharacter(DEFAULT_CHARACTER)).toEqual(DEFAULT_CHARACTER);
  });
  it('clamps out-of-range indices and junk to defaults', () => {
    const c = sanitizeCharacter({ skin: 9, hair: -1, hairColor: 'x', jersey: 'nope', number: 500, accessory: 4, build: 2 });
    expect(c.skin).toBe(DEFAULT_CHARACTER.skin);
    expect(c.hair).toBe(DEFAULT_CHARACTER.hair);
    expect(c.hairColor).toBe(DEFAULT_CHARACTER.hairColor);
    expect(c.jersey).toBe(DEFAULT_CHARACTER.jersey);
    expect(c.number).toBe(DEFAULT_CHARACTER.number);
    expect(c.accessory).toBe(4);
    expect(c.build).toBe(2);
  });
  it('accepts a valid 6-digit hex and an in-range number', () => {
    const c = sanitizeCharacter({ ...DEFAULT_CHARACTER, jersey: '#1A2b3C', number: 7 });
    expect(c.jersey).toBe('#1A2b3C');
    expect(c.number).toBe(7);
  });
});

describe('hueOfHex + deriveRimverseAppearance', () => {
  it('maps primary colors to expected hues', () => {
    expect(hueOfHex('#ff0000')).toBe(0);
    expect(hueOfHex('#00ff00')).toBe(120);
    expect(hueOfHex('#0000ff')).toBe(240);
    expect(hueOfHex('bad')).toBe(0);
  });
  it('derives rimverse hue from jersey and accent from trim', () => {
    const a = deriveRimverseAppearance({ ...DEFAULT_CHARACTER, jersey: '#0000ff', jersey2: '#00ff00' });
    expect(a.hue).toBe(240);
    expect(a.accentHue).toBe(120);
  });
});
