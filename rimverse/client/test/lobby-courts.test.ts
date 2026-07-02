// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { COURTS, renderCourtGrid } from '../src/lobby/courts';

describe('COURTS', () => {
  it('has the 6 v3 courts in order', () => {
    expect(COURTS.map((c) => c.id)).toEqual(['rucker', 'venice', 'tokyo', 'rio', 'paris', 'tundra']);
  });
});

describe('renderCourtGrid (selectable)', () => {
  it('renders 6 enabled cards, defaults a selection, and updates on click', () => {
    const el = document.createElement('div');
    const grid = renderCourtGrid(el);
    const cards = el.querySelectorAll<HTMLButtonElement>('.courtCard');
    expect(cards).toHaveLength(6);
    expect(Array.from(cards).some((c) => c.disabled)).toBe(false);
    expect(grid.getSelected()).toBe('rucker'); // default
    expect(el.querySelector('.courtCard.selected')?.getAttribute('data-id')).toBe('rucker');
    (el.querySelector('[data-id="venice"]') as HTMLButtonElement).click();
    expect(grid.getSelected()).toBe('venice');
    expect(el.querySelector('.courtCard.selected')?.getAttribute('data-id')).toBe('venice');
  });
});
