import { describe, it, expect } from 'vitest';
import { leaderboardHTML } from '../src/lobby/leaderboard';

const E = (over: Partial<Record<string, unknown>> = {}) =>
  ({ rank: 1, name: 'Ace', points: 50, dunks: 9, bestSession: 22, character: null, ...over }) as never;

describe('leaderboardHTML', () => {
  it('renders title, header, and a row with PTS/DNK/STK', () => {
    const html = leaderboardHTML([E()], null);
    expect(html).toContain('ALL-TIME GREATS');
    expect(html).toContain('class="lbRow"');
    expect(html).toContain('>Ace<');
    expect(html).toContain('50');
    expect(html).toContain('9🏀');
    expect(html).toContain('22🔥');
  });
  it('renders the YOU row from career and the empty state', () => {
    const html = leaderboardHTML([], { points: 12, dunks: 3, bestSession: 8, sessions: 2, rank: 4 });
    expect(html).toContain('YOU — RANK 4 · 12 PTS · 3 DUNKS · BEST SESSION 8');
    expect(html).toContain('No legends yet');
  });
  it('escapes names and shows — for a null rank', () => {
    expect(leaderboardHTML([E({ name: '<b>x' })], null)).toContain('&lt;b&gt;x');
    expect(leaderboardHTML([], { points: 0, dunks: 0, bestSession: 0, sessions: 0, rank: null })).toContain('RANK —');
  });
  it('marks the player\'s own row with .me when ranks match', () => {
    const html = leaderboardHTML([E({ rank: 4 })], { points: 12, dunks: 3, bestSession: 8, sessions: 2, rank: 4 });
    expect(html).toContain('class="lbRow me"');
  });
});
