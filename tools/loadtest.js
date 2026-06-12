// tools/loadtest.js — scaling evidence, not hand-waving.
//
//   npm run loadtest                          # 100 bots across all courts
//   node tools/loadtest.js --bots 100 --court rucker   # single-court pile-up
//   node tools/loadtest.js --bots 100 --duration 60
//
// Spawns N full game bots (real socket.io clients running the same AI as
// tools/bot.js), lets them play, then reports: join success, snapshot rate
// and bandwidth per client, server tick percentiles, and room layout.
// For the mega-room AOI test, start the server with DUNK_ROOM_CAP=120 and
// pass --court so every bot lands in one room.

import { Bot } from './bot.js';
import { COURT_IDS } from '../shared/courts.js';

const args = parseArgs(process.argv.slice(2));
const URL_ = args.url || 'http://localhost:3000';
const N = Number(args.bots || 100);
const DURATION = Number(args.duration || 30) * 1000;
const COURTS = args.court ? [args.court] : COURT_IDS;

console.log(`Load test: ${N} bots → ${URL_} (courts: ${COURTS.join(', ')}), ${DURATION / 1000}s`);

const t0 = Date.now();
const bots = [];
let joinFailures = 0;

// Staggered join: ~25 connects/second, like a real rush.
for (let i = 0; i < N; i++) {
  const bot = new Bot(URL_, {
    name: `Bot${String(i).padStart(3, '0')}`,
    courtId: COURTS[i % COURTS.length],
  });
  bots.push(bot);
  bot.connect().catch(() => joinFailures++);
  if (i % 25 === 24) await sleep(1000);
}
await sleep(2000);
const joined = bots.filter((b) => b.pid !== null);
console.log(`Joined: ${joined.length}/${N} (${joinFailures} failures) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// Reset counters now that everyone is in.
for (const b of joined) { b.snapshots = 0; b.bytesIn = 0; }
const statusBefore = await status();

// Play. Each bot steps at ~15Hz on a staggered offset to avoid sync storms.
const timers = joined.map((b, i) =>
  setInterval(() => { try { b.step(); } catch { /* disconnected */ } }, 62 + (i % 17)));
const playStart = Date.now();
await sleep(DURATION);
for (const t of timers) clearInterval(t);
const playSecs = (Date.now() - playStart) / 1000;

const statusAfter = await status();

// ---- report ---------------------------------------------------------------

const snapRates = joined.map((b) => b.snapshots / playSecs).sort((a, b) => a - b);
const kbRates = joined.map((b) => b.bytesIn / 1024 / playSecs).sort((a, b) => a - b);
const events = joined.reduce((s, b) => s + b.events.length, 0);
const scores = joined.reduce((s, b) => s + b.events.filter((e) => e.k === 'score' && e.pid === b.pid).length, 0);

const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] ?? 0;

console.log('\n================ RESULTS ================');
console.log(`bots playing        ${joined.length} for ${playSecs.toFixed(1)}s`);
console.log(`rooms               ${statusAfter.rooms.length} (${statusAfter.rooms.map((r) => `${r.id}:${r.players}`).join(' ')})`);
console.log(`snapshot rate/client  p50 ${pct(snapRates, 0.5).toFixed(1)}/s   min ${snapRates[0]?.toFixed(1)}/s   (target ${20}/s)`);
console.log(`downstream/client     p50 ${pct(kbRates, 0.5).toFixed(1)} KB/s   p95 ${pct(kbRates, 0.95).toFixed(1)} KB/s   max ${kbRates.at(-1)?.toFixed(1)} KB/s`);
console.log(`est. server egress    ${(kbRates.reduce((a, b) => a + b, 0) / 1024).toFixed(2)} MB/s total`);
console.log(`server tick (idle→load)  p50 ${statusBefore.tickMs.p50}→${statusAfter.tickMs.p50}ms   p95 ${statusBefore.tickMs.p95}→${statusAfter.tickMs.p95}ms   p99 →${statusAfter.tickMs.p99}ms   max →${statusAfter.tickMs.max}ms`);
console.log(`tick budget           ${(1000 / 20).toFixed(0)}ms/tick @20Hz → headroom ×${(50 / Math.max(0.001, statusAfter.tickMs.p95)).toFixed(0)} at p95`);
console.log(`gameplay              ${events} events delivered, ${scores} baskets scored by bots`);

const ok =
  joined.length >= N * 0.98 &&
  pct(snapRates, 0.5) >= 18 &&
  statusAfter.tickMs.p95 < 25;
console.log(ok ? '\nVERDICT: PASS' : '\nVERDICT: FAIL');

for (const b of joined) { try { b.disconnect(); } catch { /* closed */ } }
process.exit(ok ? 0 : 1);

async function status() {
  return fetch(`${URL_}/api/status`).then((r) => r.json());
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}
