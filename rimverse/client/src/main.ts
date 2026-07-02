import { INTERP_DELAY_MS, TICK_RATE, TURBO_MAX } from '../../shared/src/constants';
import type { SnapshotMsg } from '../../shared/src/protocol';
import type { AnimState, HoopSnap } from '../../shared/src/types';
import { Input } from './input';
import { SnapshotBuffer } from './net/interpolation';
import { Net } from './net/net';
import { Predictor } from './net/prediction';
import { GameScene } from './scene/scene';
import { buildBlips, drawRadar, makeRadar, ringViewRange } from './hud/radar';
import { Lobby } from './lobby/lobby';

const hud = document.getElementById('hud')!;
const radar = makeRadar(document.getElementById('radar') as HTMLCanvasElement);
const net = new Net();
const input = new Input();
const scene = new GameScene();
const remoteBuf = new SnapshotBuffer();
let predictor: Predictor | null = null;
let latest: SnapshotMsg | null = null;
let hoops: HoopSnap[] = []; // cached; server sends hoops only on topology change
let arena = 0;

net.onWelcome = (_id, x, y) => {
  predictor = new Predictor({ x, y });
};

// debug/QA handle (read-only inspection)
(window as unknown as Record<string, unknown>).__rim = {
  get predictor() {
    return predictor;
  },
  get latest() {
    return latest;
  },
  net,
};

net.onArena = (c) => { arena = c; };

net.onSnapshot = (snap) => {
  latest = snap;
  if (snap.hoops) hoops = snap.hoops;
  const me = snap.players.find((p) => p.id === net.myId);
  if (me && predictor) {
    predictor.reconcile(
      { x: me.x, y: me.y, turboLeft: me.turboLeft, turboCd: me.turboCd },
      snap.ack,
      Math.max(1, snap.n),
      me.size,
    );
  }
  remoteBuf.push(
    performance.now(),
    snap.players.filter((p) => p.id !== net.myId),
  );
};

const localFacing = { x: 1, y: 0 }; // last non-zero input dir, for instant sprite flips

// B cycles practice bots: 0 → 5 → 15 → 30 → 0 (server-driven, authority-correct)
const BOT_STEPS = [0, 5, 15, 30];
let botStep = 0;
addEventListener('keydown', (e) => {
  if (e.repeat || e.code !== 'KeyB') return;
  botStep = (botStep + 1) % BOT_STEPS.length;
  net.send({ t: 'bots', count: BOT_STEPS[botStep] });
});

// The server integrates no movement while in an action anim, so the predictor must not either.
const LOCOMOTION = new Set<AnimState>(['idle', 'run', 'dribbleIdle', 'dribbleRun']);
const isActionLocked = (anim: AnimState | undefined) => !!anim && !LOCOMOTION.has(anim);

// Fixed-rate input sampling → intents (mirrors server tick so prediction stays in lockstep)
setInterval(() => {
  if (!predictor || !net.myId) return;
  const move = input.move();
  const actions = input.consumeActions();
  if (Math.hypot(move.mx, move.my) > 0.01) {
    localFacing.x = move.mx;
    localFacing.y = move.my;
  }
  const me = latest?.players.find((p) => p.id === net.myId);
  const seq = predictor.applyInput(move, Math.max(1, latest?.n ?? 1), me?.size ?? 1, isActionLocked(me?.anim));
  net.send({ t: 'intent', seq, mx: move.mx, my: move.my, turbo: move.turbo, ...actions });
}, 1000 / TICK_RATE);

let lastFrame = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!latest) return;
  if (net.mode === 'dunkContest') scene.setDunkCourt(dt);
  else scene.setArena(Math.max(1, latest.n), dt);
  // Feed the local player as the bend origin BEFORE entity syncs, so floor + hoops +
  // balls + sprites all bend around the same point this frame.
  if (predictor) scene.setWrapOrigin(predictor.pos.x, predictor.pos.y, scene.floorRadius);
  scene.setShaderTime(now / 1000);
  scene.syncHoops(hoops, net.myId, dt);
  scene.syncBalls(latest.balls);

  const live = new Set<string>();
  if (predictor && net.myId) {
    live.add(net.myId);
    const me = latest.players.find((p) => p.id === net.myId);
    scene.upsertPlayer(
      net.myId,
      predictor.pos.x,
      predictor.pos.y,
      me?.z ?? 0,
      me?.hue ?? 0,
      me?.accentHue ?? 0,
      me?.anim ?? 'idle',
      localFacing.x,
      localFacing.y,
      me?.size ?? 1,
      now,
    );
    scene.followCam(predictor.pos.x, predictor.pos.y, dt);
  }
  const remotes = remoteBuf.sample(now - INTERP_DELAY_MS);
  for (const [id, pos] of remotes) {
    const snapP = latest.players.find((p) => p.id === id);
    if (!snapP) continue; // already left
    live.add(id);
    scene.upsertPlayer(id, pos.x, pos.y, pos.z, snapP.hue, snapP.accentHue, snapP.anim, snapP.dx, snapP.dy, snapP.size, now);
  }
  scene.removeMissingPlayers(live);

  // flat-truth radar (unwarped) — the tactical reference while the lens disorients
  if (predictor) {
    const myHoop = hoops.find((h) => h.owner === net.myId);
    const blips = buildBlips(latest.players, hoops, latest.balls, net.myId, myHoop ?? null);
    drawRadar(radar, predictor.pos, blips, ringViewRange(latest.n), now);
  }

  const me = latest.players.find((p) => p.id === net.myId);
  if (net.mode === 'dunkContest') {
    const board = latest.players.slice().sort((a, b) => b.score - a.score).slice(0, 8)
      .map((p, i) => `${i + 1}. ${p.name} ${p.score}${p.onFire ? ' 🔥' : ''}`).join('\n');
    hud.textContent =
      `THE DUNK CONTEST\nARENA ${arena}\n` +
      (me?.onFire ? 'ON FIRE 🔥\n' : '') +
      `★ SCORES ★\n${board}\n` +
      `WASD move · SHIFT turbo · M grab/steal/block · SPACE shoot (dunks close)`;
  } else {
    const turboFrac = (predictor?.state.turboLeft ?? 0) / TURBO_MAX;
    const turboBar = '█'.repeat(Math.round(turboFrac * 8)).padEnd(8, '░');
    const career = net.career;
    hud.textContent =
      `RIMVERSE\nplayers ${latest.n}  score ${me?.score ?? 0}${me?.hasBall ? '  ● BALL' : ''}\n` +
      `TURBO ${turboBar}  size ${(me?.size ?? 1).toFixed(2)}  skill ${(me?.skill ?? 0.5).toFixed(2)}\n` +
      (career ? `career ${career.points} pts · ${career.dunks} dunks · rank ${career.rank ?? '—'}\n` : '') +
      `WASD move · SHIFT turbo · M grab/steal/block · SPACE shoot (dunks close) · B bots (${BOT_STEPS[botStep]})`;
  }
  scene.render();
}
requestAnimationFrame(frame);
// The lobby gates the join: it mounts over the idle scene and joins the rimverse on PLAY.
new Lobby({ net, onPlay: (name, court) => net.join(name, court) });
