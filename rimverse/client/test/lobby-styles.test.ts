// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { injectLobbyStyles } from '../src/lobby/styles';

describe('injectLobbyStyles', () => {
  it('injects once and carries the v3 gold token + title shadow', () => {
    injectLobbyStyles();
    injectLobbyStyles();
    const styles = document.querySelectorAll('#lobby-styles');
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain('--gold: #ffc928');
    expect(styles[0].textContent).toContain('4px 4px 0 var(--red)');
    expect(styles[0].textContent).toContain('.knobRow select');
  });
});
