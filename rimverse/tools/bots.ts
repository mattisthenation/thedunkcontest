/**
 * Headless wandering/scoring bots for QA and loadtesting.
 * Usage: npx tsx tools/bots.ts [count] [ws-url]
 */
import WebSocket from 'ws';
import { TICK_RATE } from '../shared/src/constants';
import type { ServerMsg, SnapshotMsg } from '../shared/src/protocol';
import type { HoopSnap } from '../shared/src/types';

const count = Number(process.argv[2] ?? 8);
const url = process.argv[3] ?? 'ws://localhost:8081';

function startBot(i: number): void {
  const ws = new WebSocket(url);
  let myId: string | null = null;
  let seq = 0;
  let latest: SnapshotMsg | null = null;
  let hoops: HoopSnap[] = []; // hoops arrive only on topology change — cache them
  let wander = { mx: 0, my: 0 };
  const timers: NodeJS.Timeout[] = [];

  timers.push(
    setInterval(() => {
      if (Math.random() < 0.03) {
        const a = Math.random() * Math.PI * 2;
        wander = { mx: Math.cos(a), my: Math.sin(a) };
      }
    }, 100),
  );

  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name: `bot-${i}` })));
  ws.on('message', (raw) => {
    const msg: ServerMsg = JSON.parse(raw.toString());
    if (msg.t === 'welcome') myId = msg.id;
    else if (msg.t === 'snapshot') {
      latest = msg;
      if (msg.hoops) hoops = msg.hoops;
    }
  });
  ws.on('close', () => timers.forEach(clearInterval));
  ws.on('error', (e) => console.error(`[bot-${i}]`, e.message));

  timers.push(
    setInterval(() => {
      if (!myId || !latest || ws.readyState !== WebSocket.OPEN) return;
      const me = latest.players.find((p) => p.id === myId);
      if (!me) return;
      let { mx, my } = wander;
      let grab = false;
      let shoot = false;
      let dunk = false;
      let defend = false;
      let turbo = false;
      const freeBall = latest.balls.find((b) => b.state === 'free');
      const enemyHoop =
        hoops.find((h) => h.owner && h.owner !== myId) ?? hoops.find((h) => h.owner !== myId);
      const carrier = latest.players.find((p) => p.id !== myId && p.hasBall);
      if (!me.hasBall && carrier && Math.hypot(carrier.x - me.x, carrier.y - me.y) < 6) {
        // hunt the carrier: chase with turbo, swipe when close
        const d = Math.hypot(carrier.x - me.x, carrier.y - me.y);
        mx = (carrier.x - me.x) / (d || 1);
        my = (carrier.y - me.y) / (d || 1);
        turbo = d > 2;
        defend = d < 1.5 && Math.random() < 0.15;
      } else if (!me.hasBall && freeBall) {
        const d = Math.hypot(freeBall.x - me.x, freeBall.y - me.y);
        mx = (freeBall.x - me.x) / (d || 1);
        my = (freeBall.y - me.y) / (d || 1);
        grab = d < 1.2;
        turbo = d > 5;
      } else if (me.hasBall && enemyHoop) {
        const d = Math.hypot(enemyHoop.x - me.x, enemyHoop.y - me.y);
        mx = (enemyHoop.x - me.x) / (d || 1);
        my = (enemyHoop.y - me.y) / (d || 1);
        if (d < 2.5) dunk = true;
        else if (d < 9 && Math.random() < 0.02) shoot = true;
      }
      ws.send(JSON.stringify({ t: 'intent', seq: ++seq, mx, my, grab, shoot, dunk, defend, turbo }));
    }, 1000 / TICK_RATE),
  );
}

for (let i = 0; i < count; i++) setTimeout(() => startBot(i), i * 400);
console.log(`[bots] launching ${count} bots → ${url}`);
