// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/dunkchar/generator', async (orig) => ({
  ...(await orig() as object),
  renderPreview: vi.fn(() => document.createElement('canvas')),
}));

import { Creator, loadCharacter, persistCharacter } from '../src/lobby/creator';
import { DEFAULT_CHARACTER } from '../../shared/src/character';

beforeEach(() => localStorage.clear());

describe('loadCharacter / persistCharacter', () => {
  it('falls back to the default when storage is empty', () => {
    expect(loadCharacter()).toEqual(DEFAULT_CHARACTER);
  });
  it('round-trips a sanitized character', () => {
    persistCharacter({ ...DEFAULT_CHARACTER, skin: 4, jersey: '#2e6fe8' });
    expect(loadCharacter()).toMatchObject({ skin: 4, jersey: '#2e6fe8' });
  });
  it('sanitizes junk on load', () => {
    localStorage.setItem('rimverse-character', JSON.stringify({ skin: 99, jersey: 'nope' }));
    const c = loadCharacter();
    expect(c.skin).toBe(DEFAULT_CHARACTER.skin);
    expect(c.jersey).toBe(DEFAULT_CHARACTER.jersey);
  });
});

describe('Creator', () => {
  it('changing the HAIR select updates cfg + persists', () => {
    const mount = document.createElement('div');
    const creator = new Creator(mount);
    const hair = mount.querySelector('select[data-key="hair"]') as HTMLSelectElement;
    hair.value = '3';
    hair.dispatchEvent(new Event('change'));
    expect(creator.current().hair).toBe(3);
    expect(loadCharacter().hair).toBe(3);
    creator.destroy();
  });
  it('clicking a JERSEY swatch sets sel + persists the hex', () => {
    const mount = document.createElement('div');
    const creator = new Creator(mount);
    const sw = mount.querySelector('[data-key="jersey"][data-val="#2e6fe8"]') as HTMLButtonElement;
    sw.click();
    expect(creator.current().jersey).toBe('#2e6fe8');
    expect(sw.classList.contains('sel')).toBe(true);
    expect(loadCharacter().jersey).toBe('#2e6fe8');
    creator.destroy();
  });
});
