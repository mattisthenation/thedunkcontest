import type { Net } from '../net/net';
import type { LeaderboardEntry } from '../../../shared/src/protocol';
import { injectLobbyStyles } from './styles';
import { Creator } from './creator';
import { renderCourtGrid } from './courts';
import type { CourtGrid } from './courts';
import { renderLeaderboard } from './leaderboard';

const NAME_KEY = 'rimverse-name';

export interface LobbyOptions {
  net: Net;
  onPlay: (name: string, court: string) => void;
}

export class Lobby {
  private net: Net;
  private onPlay: (name: string, court: string) => void;
  private root: HTMLElement;
  private creator: Creator;
  private nameInput: HTMLInputElement;
  private lbMount: HTMLElement;
  private entries: LeaderboardEntry[] = [];
  private courtGrid: CourtGrid;

  constructor(opts: LobbyOptions) {
    this.net = opts.net;
    this.onPlay = opts.onPlay;
    injectLobbyStyles();

    this.root = document.createElement('div');
    this.root.id = 'lobby';
    this.root.innerHTML = `
      <div class="lobbyInner">
        <h1>THE<br>DUNK<br>CONTEST</h1>
        <p class="tag">PICK YOUR PLAYER · PICK YOUR COURT · GET BUCKETS</p>
        <div class="lobbyCols">
          <div class="lobbyCol">
            <h2>YOUR BALLER</h2>
            <input id="nameInput" maxlength="16" placeholder="ENTER NAME" autocomplete="off">
            <div id="creatorMount"></div>
          </div>
          <div class="lobbyCol">
            <h2>WORLD TOUR</h2>
            <div id="courtGrid"></div>
            <div id="leaderboardMount"></div>
          </div>
        </div>
        <div class="lobbyActions">
          <button id="playBtn">▶ &nbsp;PLAY</button>
          <button id="resumeBtn" class="ghost">RESUME</button>
        </div>
      </div>`;
    document.body.append(this.root);

    this.nameInput = this.root.querySelector('#nameInput') as HTMLInputElement;
    this.nameInput.value = localStorage.getItem(NAME_KEY) ?? '';
    this.creator = new Creator(this.root.querySelector('#creatorMount') as HTMLElement);
    this.courtGrid = renderCourtGrid(this.root.querySelector('#courtGrid') as HTMLElement);
    this.lbMount = this.root.querySelector('#leaderboardMount') as HTMLElement;
    this.renderBoard();

    this.net.onLeaderboard = (e) => { this.entries = e; this.renderBoard(); };
    this.net.onIdentity = () => this.renderBoard();

    (this.root.querySelector('#playBtn') as HTMLButtonElement).addEventListener('click', () => this.play());
    // RESUME: present-but-inert (v3-faithful) — wired when an in-game lobby overlay exists.
    (this.root.querySelector('#resumeBtn') as HTMLButtonElement).addEventListener('click', () => { /* no-op */ });
  }

  private renderBoard(): void {
    renderLeaderboard(this.lbMount, this.entries, this.net.career);
  }

  private play(): void {
    const name = this.nameInput.value.trim() || 'Baller';
    localStorage.setItem(NAME_KEY, name);
    this.onPlay(name, this.courtGrid.getSelected());
    this.hide();
  }

  show(): void { this.root.classList.remove('hidden'); this.renderBoard(); }
  hide(): void { this.root.classList.add('hidden'); }

  /** Stop the creator preview loop (call when permanently tearing the lobby down). */
  destroy(): void { this.creator.destroy(); }
}
