// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/dunkchar/generator', async (orig) => ({
  ...(await orig() as object),
  renderPreview: vi.fn(() => document.createElement('canvas')),
}));

import { Lobby } from '../src/lobby/lobby';
import type { Net } from '../src/net/net';

function fakeNet(): Net {
  return { career: null, onLeaderboard: null, onIdentity: null } as unknown as Net;
}

beforeEach(() => { document.body.innerHTML = ''; document.head.innerHTML = ''; localStorage.clear(); });

describe('Lobby', () => {
  it('PLAY persists the name, calls onPlay, then hides', () => {
    const net = fakeNet();
    const onPlay = vi.fn();
    new Lobby({ net, onPlay });
    (document.querySelector('#nameInput') as HTMLInputElement).value = 'Zee';
    (document.querySelector('#playBtn') as HTMLButtonElement).click();
    expect(onPlay).toHaveBeenCalledWith('Zee', 'rucker'); // default court
    expect(localStorage.getItem('rimverse-name')).toBe('Zee');
    expect(document.querySelector('#lobby')!.classList.contains('hidden')).toBe(true);
  });

  it('RESUME is inert (never calls onPlay)', () => {
    const net = fakeNet();
    const onPlay = vi.fn();
    new Lobby({ net, onPlay });
    (document.querySelector('#resumeBtn') as HTMLButtonElement).click();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('re-renders ALL-TIME GREATS when a leaderboard frame arrives', () => {
    const net = fakeNet();
    new Lobby({ net, onPlay: vi.fn() });
    net.onLeaderboard!([{ rank: 1, name: 'Ace', points: 50, dunks: 9, bestSession: 22, character: null }]);
    expect(document.querySelector('#leaderboardMount')!.innerHTML).toContain('Ace');
  });
});
