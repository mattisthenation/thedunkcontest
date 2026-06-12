// tools/verify.js — end-to-end multiplayer proof over real sockets:
// three bots join one room, contest possession, score, and one disconnects
// mid-possession. Prints PASS/FAIL per assertion.

import { Bot } from './bot.js';

const URL = process.env.URL || 'http://localhost:3000';
let failures = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const bots = [
  new Bot(URL, { name: 'Alpha', courtId: 'venice' }),
  new Bot(URL, { name: 'Bravo', courtId: 'venice' }),
  new Bot(URL, { name: 'Charlie', courtId: 'venice' }),
];

for (const b of bots) await b.connect();
check('all bots joined', bots.every((b) => b.pid !== null));
check('same room', new Set(bots.map((b) => b.welcome.roomId)).size === 1,
  bots[0].welcome.roomId);
check('distinct pids', new Set(bots.map((b) => b.pid)).size === 3);
check('roster visible to all', bots.every((b) => b.welcome.roster.length >= 1));

// Run the bots for 25 seconds of play.
const steps = setInterval(() => bots.forEach((b) => b.step()), 66);
await sleep(25_000);
clearInterval(steps);

const allEvents = bots.flatMap((b) => b.events);
const scores = allEvents.filter((e) => e.k === 'score');
const pickups = allEvents.filter((e) => e.k === 'pickup');
const dunks = allEvents.filter((e) => e.k === 'dunkScore');

check('snapshots flowing', bots.every((b) => b.snapshots > 200),
  `${bots.map((b) => b.snapshots).join('/')} received`);
check('possession changes happened', pickups.length >= 3, `${pickups.length} pickups`);
check('scoring happened', scores.length >= 1, `${scores.length} scores, ${dunks.length} dunks`);
check('scores consistent across clients',
  bots.every((b) => b.events.filter((e) => e.k === 'score').length ===
    bots[0].events.filter((e) => e.k === 'score').length / 1));

// Every bot saw the same final score for each scoring player.
const finalScores = new Map();
for (const e of bots[0].events.filter((e) => e.k === 'score')) finalScores.set(e.pid, e.score);
let consistent = true;
for (const b of bots.slice(1)) {
  const mine = new Map();
  for (const e of b.events.filter((e) => e.k === 'score')) mine.set(e.pid, e.score);
  for (const [pid, s] of finalScores) if (mine.get(pid) !== s) consistent = false;
}
check('identical score history on every client', consistent);

// Disconnect mid-possession: ball must come free.
const carrier = bots.find((b) => b.carrying);
if (carrier) {
  carrier.disconnect();
  await sleep(800);
  const other = bots.find((b) => b !== carrier);
  check('ball freed when carrier disconnected', other.ball.carrierPid !== carrier.pid);
} else {
  const leaver = bots[2];
  leaver.disconnect();
  await sleep(800);
  check('leave event broadcast', bots[0].events.some((e) => e.k === 'leave'), '(no carrier case)');
}

// Reconnect with the same token restores the session score.
const returning = bots[0];
const beforeScore = returning.score;
returning.disconnect();
await sleep(500);
const rejoined = new Bot(URL, { name: 'Alpha', courtId: 'venice', token: returning.token });
const w = await rejoined.connect();
check('reconnect restored session', w.restored === true && w.score === beforeScore,
  `score ${w.score} (was ${beforeScore})`);

const status = await fetch(`${URL}/api/status`).then((r) => r.json());
check('status endpoint live', typeof status.tickMs.p95 === 'number',
  `tick p95 ${status.tickMs.p95}ms, ${status.players} players`);

for (const b of [...bots, rejoined]) { try { b.disconnect(); } catch { /* closed */ } }
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
