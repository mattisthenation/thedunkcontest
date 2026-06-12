// main.js — boot: identity, lobby (court select), join handshake, game loop.
// Character creation UI lives in creator.js and mounts into the lobby.

import { getCourt } from '/shared/courts.js';
import { NetClient } from './net.js';
import { World } from './world.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Creator } from './creator.js';
import { Fx } from './fx.js';
import { Stage } from './stage.js';

const token = localStorage.dunkToken || (localStorage.dunkToken = crypto.randomUUID());

const world = new World(document.getElementById('game'));
const net = new NetClient();
const hud = new Hud();
const fx = new Fx(world);
const game = new Game(world, net, hud, fx);
let stage = null;

const lobby = document.getElementById('lobby');
const courtGrid = document.getElementById('courtGrid');
const nameInput = document.getElementById('nameInput');
const playBtn = document.getElementById('playBtn');
const creator = new Creator(document.getElementById('creatorMount'));

nameInput.value = localStorage.dunkName || '';
let selectedCourt = localStorage.dunkCourt || 'rucker';
let inGame = false;

net.on('net', ({ up }) => {
  hud.setConnection(up);
  // socket.io reconnected: re-run the handshake to restore our session.
  if (up && inGame) join();
});

function renderCourtGrid(courts) {
  courtGrid.innerHTML = courts.map((c) => `
    <button class="courtCard${c.id === selectedCourt ? ' sel' : ''}" data-id="${c.id}">
      <span class="cFlag">${c.flag}</span>
      <span class="cName">${c.name}</span>
      <span class="cLoc">${c.location}</span>
    </button>`).join('');
  for (const btn of courtGrid.querySelectorAll('.courtCard')) {
    btn.addEventListener('click', () => {
      selectedCourt = btn.dataset.id;
      localStorage.dunkCourt = selectedCourt;
      renderCourtGrid(courts);
    });
  }
}

// Until the first welcome arrives we render the static roster from shared/.
import('/shared/courts.js').then(({ COURTS }) => renderCourtGrid(COURTS));

// ---- leaderboard (lobby panel) --------------------------------------------

async function renderLeaderboard() {
  const mount = document.getElementById('leaderboardMount');
  try {
    const [board, me] = await Promise.all([
      fetch('/api/leaderboard').then((r) => r.json()),
      fetch(`/api/me/${token}`).then((r) => r.json()),
    ]);
    const rows = board.players.slice(0, 10).map((p) => `
      <div class="lbRow${me && p.name === me.name && p.points === me.points ? ' me' : ''}">
        <span class="lbRank">${p.rank}</span>
        <span class="lbName">${esc(p.name)}</span>
        <span class="lbStat" title="career points">${p.points}</span>
        <span class="lbStat sm" title="dunks">${p.dunks}🏀</span>
        <span class="lbStat sm" title="best streak">${p.best_streak}🔥</span>
      </div>`).join('');
    const mine = me ? `
      <div class="lbMe">
        YOU — RANK ${me.rank ?? '—'} · ${me.points} PTS · ${me.dunks} DUNKS ·
        BEST STREAK ${me.best_streak} · BEST SESSION ${me.best_session}
      </div>` : '';
    mount.innerHTML = `
      <h2 class="lbTitle">ALL-TIME GREATS</h2>
      <div class="lbHead"><span class="lbRank">#</span><span class="lbName">BALLER</span>
        <span class="lbStat">PTS</span><span class="lbStat sm">DNK</span><span class="lbStat sm">STK</span></div>
      ${rows || '<div class="lbEmpty">No legends yet. Be the first.</div>'}${mine}`;
  } catch {
    mount.innerHTML = '';
  }
}
renderLeaderboard();

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function join() {
  const name = nameInput.value.trim() || 'Baller';
  localStorage.dunkName = name;
  const character = creator.current();
  const welcome = await (inGame
    ? net.switchCourt({ token, name, character, courtId: selectedCourt })
    : net.hello({ token, name, character, courtId: selectedCourt }));

  const def = getCourt(welcome.courtId);
  world.loadCourt(def);
  stage?.dispose();
  stage = new Stage(world.scene, def);
  game.applyWelcome(welcome);
  hud.setCourt(def, welcome.roomId);
  hud.setConnection(true);
  lobby.classList.add('hidden');
  inGame = true;
}

playBtn.addEventListener('click', () => join().catch((e) => {
  console.error(e);
  hud.announce('JOIN FAILED — RETRYING', 1500, 'minor');
}));

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && inGame) {
    lobby.classList.toggle('hidden');
    if (!lobby.classList.contains('hidden')) renderLeaderboard();
  }
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  if (inGame) lobby.classList.add('hidden');
});

// ---- render loop ---------------------------------------------------------

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (inGame) {
    game.update(dt);
    stage?.update(dt);
    fx.update(dt);
  }
  world.render();
}
requestAnimationFrame(frame);
