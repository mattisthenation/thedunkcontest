import { describe, it, expect } from 'vitest';
import { openDb } from '../src/db';
import { sanitizeCharacter, deriveRimverseAppearance } from '../../shared/src/character';

describe('join character resolution', () => {
  it('a sent character is sanitized, stored, and drives the rimverse hue', () => {
    const db = openDb(':memory:');
    const sent = { skin: 3, hair: 2, hairColor: 1, jersey: '#0000ff', jersey2: '#00ff00', shorts: '#222222', shoes: '#ffffff', number: 7, accessory: 1, build: 2 };
    const clean = sanitizeCharacter(sent);
    db.upsertIdentity('tok', 'Ada', clean);
    expect(db.loadPlayer('tok')!.character).toEqual(clean);
    expect(deriveRimverseAppearance(clean).hue).toBe(240); // blue jersey
    db.close();
  });
});
