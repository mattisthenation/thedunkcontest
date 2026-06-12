// main.js — boot: identity, lobby (court select), join handshake, game loop.
// Character creation UI lives in creator.js and mounts into the lobby.

import { getCourt } from '/shared/courts.js';
import { NetClient } from './net.js';
import { World } from './world.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Creator } from './creator.js';

const token = localStorage.dunkToken || (localStorage.dunkToken = crypto.randomUUID());

const world = new World(document.getElementById('game'));
const net = new NetClient();
const hud = new Hud();
const game = new Game(world, net, hud, null);

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

async function join() {
  const name = nameInput.value.trim() || 'Baller';
  localStorage.dunkName = name;
  const character = creator.current();
  const welcome = await (inGame
    ? net.switchCourt({ token, name, character, courtId: selectedCourt })
    : net.hello({ token, name, character, courtId: selectedCourt }));

  const def = getCourt(welcome.courtId);
  world.loadCourt(def);
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
  if (e.code === 'Escape' && inGame) lobby.classList.toggle('hidden');
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
  if (inGame) game.update(dt);
  world.render();
}
requestAnimationFrame(frame);
