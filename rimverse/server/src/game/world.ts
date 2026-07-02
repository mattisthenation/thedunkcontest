import { AOI_CAP, GRAV, MAX_PLAYERS, RIM_HEIGHT, TICK_DT, TURBO_MAX } from '../../../shared/src/constants';
import { DEFAULT_MODE, type GameMode } from '../../../shared/src/gameMode';
import { botIntent } from './bots';
import { aoiPlayers } from './aoi';
import { clampToArena, hoopCount, hoopPosition, spawnPos } from '../../../shared/src/geometry';
import { dcHoops, dcClamp, dcSpawn, DC_POINTS, dcDunkReach, dcRespawnBall, DC_STEAL } from '../../../shared/src/dunkConstants';
import { pickDunk, type DunkDef } from '../../../shared/src/dunks';
import { startDunkVert, stepDunkVert, slamTick, type DunkVert } from '../../../shared/src/dunkPhysics';
import { applyBlocked, applyScore, blockChance, stealChance } from '../../../shared/src/progression';
import { mulberry32 } from '../../../shared/src/rng';
import { stepPlayer, type SimInput } from '../../../shared/src/sim';
import type { SnapshotMsg } from '../../../shared/src/protocol';
import type { AnimState, BallSnap, GameEvent, HoopSnap, Vec2 } from '../../../shared/src/types';
import {
  ensureBallCount,
  resolveGrabs,
  startRespawn,
  tickRespawns,
  toSnap,
  type BallEnt,
} from './balls';
import {
  ACTION_TIMES,
  flightDuration,
  inDunkRange,
  makeProbability,
  pickTargetHoop,
} from './shooting';
import { findBlockTarget, findStealTarget } from './defend';
import { shotAccuracy, shotPoints, fireOnMake, fireOnMiss, isOnFire } from './dunkContest';
import { BLOCK_LOCK, GRAB_RADIUS, STEAL_LOCK, STUN_TIME } from '../../../shared/src/constants';

export interface PlayerIntent {
  seq: number;
  mx: number;
  my: number;
  grab: boolean;
  shoot: boolean;
  dunk: boolean;
  turbo?: boolean;
  defend?: boolean;
}

export interface PlayerEnt {
  id: string;
  name: string;
  pos: Vec2;
  dir: Vec2;
  z: number; // height above floor (dunk/jump arc); 0 on the ground
  dunkVert: DunkVert | null; // active dunk arc state, null when grounded
  lastSeq: number;
  pendingIntents: PlayerIntent[];
  moving: boolean;
  wantsGrab: boolean;
  anim: AnimState;
  size: number;
  skill: number;
  turboLeft: number;
  turboCd: number;
  hue: number;
  accentHue: number;
  ballId: string | null;
  score: number;
  sessionPoints: number; // monotonic points scored this connection (career delta)
  sessionDunks: number; // made dunks this connection
  peakScore: number; // highest live score reached this connection
  consecutiveMakes: number;
  fireUntil: number;
  nextStealAt: number;
  protectUntil: number;
  hoop: number;
  isBot: boolean;
  botWander: Vec2;
  action: {
    kind: 'shoot' | 'dunk' | 'steal' | 'block' | 'stunned' | 'celebrate';
    until: number;
    targetHoop: number;
    defenderId?: string | null; // id of the attacked rim's owner (AOI interest; L3)
    lunge?: { fx: number; fy: number; tx: number; ty: number };
    dunk?: { def: DunkDef; startTick: number; released: boolean }; // V5 dunk timeline
  } | null;
}

export class World {
  readonly mode: GameMode;
  combinedScore = 0;
  constructor(mode: GameMode = DEFAULT_MODE) {
    this.mode = mode;
  }
  tick = 0;
  topoVersion = 0;
  players = new Map<string, PlayerEnt>();
  balls = new Map<string, BallEnt>();
  rng: () => number = mulberry32(Date.now() & 0xffffffff);
  /** One-shot events accumulated during ticks; drained by the broadcast loop. */
  events: GameEvent[] = [];
  private nextBotId = 1;

  get time(): number {
    return this.tick * TICK_DT;
  }

  addPlayer(id: string, name: string, isBot = false): PlayerEnt {
    const hue = (Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
    const p: PlayerEnt = {
      id,
      name,
      pos: { x: 0, y: 0 },
      dir: { x: 1, y: 0 },
      z: 0,
      dunkVert: null,
      lastSeq: 0,
      pendingIntents: [],
      moving: false,
      wantsGrab: false,
      anim: 'idle',
      size: 1,
      skill: 0.5,
      turboLeft: TURBO_MAX,
      turboCd: 0,
      hue,
      accentHue: 0,
      ballId: null,
      score: 0,
      sessionPoints: 0,
      sessionDunks: 0,
      peakScore: 0,
      consecutiveMakes: 0,
      fireUntil: 0,
      nextStealAt: 0,
      protectUntil: 0,
      hoop: -1,
      action: null,
      isBot,
      botWander: { x: 0, y: 0 },
    };
    this.players.set(id, p);
    this.reslot();
    p.pos = this.mode === 'dunkContest' ? dcSpawn(this.rng) : spawnPos(p.hoop, Math.max(1, this.players.size));
    return p;
  }

  removePlayer(id: string): void {
    const leaver = this.players.get(id);
    if (leaver?.ballId) {
      const b = this.balls.get(leaver.ballId);
      if (b) {
        b.state = 'free';
        b.carrier = null;
      }
    }
    this.players.delete(id);
    this.reslot();
  }

  /** Hoop index i belongs to the i-th player in join order; clients animate toward new slots. */
  private reslot(): void {
    let i = 0;
    for (const p of this.players.values()) p.hoop = i++;
    this.topoVersion++;
  }

  hoopSnaps(): HoopSnap[] {
    if (this.mode === 'dunkContest') {
      return dcHoops().map((h, i) => ({ index: i, x: h.x, y: h.y, owner: null }));
    }
    const n = this.players.size;
    const count = hoopCount(Math.max(1, n));
    const owners = new Map<number, string>();
    for (const p of this.players.values()) owners.set(p.hoop, p.id);
    const out: HoopSnap[] = [];
    for (let i = 0; i < count; i++) {
      const pos = hoopPosition(i, Math.max(1, n));
      out.push({ index: i, x: pos.x, y: pos.y, owner: owners.get(i) ?? null });
    }
    return out;
  }

  step(): void {
    this.tick++;
    this.driveBots(); // queue each bot's intent before the shared intent processing
    const n = Math.max(1, this.players.size);
    ensureBallCount(this.balls, this.mode === 'dunkContest' ? 1 : this.players.size); // before intents: E-routing checks ball reach
    for (const p of this.players.values()) {
      // Drain the whole intent queue this tick, but integrate movement ONLY ONCE
      // from the latest move vector — emitting intents faster must not buy speed (H2).
      let move: SimInput = { mx: 0, my: 0, turbo: false };
      while (p.pendingIntents.length > 0) {
        const intent = p.pendingIntents.shift()!;
        p.lastSeq = intent.seq; // always ack, even while action-locked
        if (p.action) continue; // locked: latch the ack only
        move = { mx: intent.mx, my: intent.my, turbo: intent.turbo ?? false };
        if (intent.shoot && p.ballId) {
          // Space: flashier wins — dunk when in range, otherwise shoot
          const hoops = this.hoopSnaps();
          const target = pickTargetHoop(p.pos, p.id, hoops);
          if (target >= 0 && this.inDunkRangeFor(p, hoops[target], move.turbo ?? false)) this.tryDunk(p, move.turbo ?? false);
          else this.startShoot(p);
        } else if (intent.dunk && p.ballId) this.tryDunk(p, intent.turbo ?? false);
        else if ((intent.defend || intent.grab) && !p.ballId) {
          if (intent.grab) p.wantsGrab = true;
          // E falls through to defend only when no free ball is within grab reach
          const grabbable = Array.from(this.balls.values()).some(
            (b) =>
              b.state === 'free' &&
              Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y) <= GRAB_RADIUS,
          );
          if (intent.defend || !grabbable) this.tryDefend(p);
        }
      }
      if (!p.action) {
        // exactly one integration step per tick (turbo also advances at real time)
        const next = stepPlayer(
          { pos: p.pos, turboLeft: p.turboLeft, turboCd: p.turboCd },
          move,
          TICK_DT,
          n,
          p.size,
        );
        p.pos = next.pos;
        if (this.mode === 'dunkContest') p.pos = dcClamp(p.pos);
        p.turboLeft = next.turboLeft;
        p.turboCd = next.turboCd;
        const mlen = Math.hypot(move.mx, move.my);
        p.moving = mlen > 0.01;
        if (p.moving) p.dir = { x: move.mx / mlen, y: move.my / mlen };
        p.anim = p.moving ? (p.ballId ? 'dribbleRun' : 'run') : p.ballId ? 'dribbleIdle' : 'idle';
      }
    }

    const heldBefore = this.mode === 'dunkContest' ? new Set([...this.players.values()].filter((p) => p.ballId).map((p) => p.id)) : null;
    const grabbers = Array.from(this.players.values()).filter((p) => p.wantsGrab);
    resolveGrabs(this.balls, grabbers);
    for (const p of this.players.values()) p.wantsGrab = false;
    if (this.mode === 'dunkContest' && heldBefore) for (const p of this.players.values()) if (p.ballId && !heldBefore.has(p.id)) p.protectUntil = this.time + DC_STEAL.protectMs / 1000;
    tickRespawns(this.balls, this.time);
    // carried balls follow their carrier
    for (const b of this.balls.values()) {
      if (b.state === 'carried' && b.carrier) {
        const c = this.players.get(b.carrier);
        if (c) b.pos = { ...c.pos };
      }
    }
    this.tickFlightsAndActions();
  }

  private inDunkRangeFor(p: PlayerEnt, hoop: HoopSnap, turbo: boolean): boolean {
    const d = Math.hypot(p.pos.x - hoop.x, p.pos.y - hoop.y);
    return this.mode === 'dunkContest' ? d <= dcDunkReach(turbo) : inDunkRange(p.pos, hoop, p.skill);
  }

  private startShoot(p: PlayerEnt): void {
    const hoops = this.hoopSnaps();
    const target = pickTargetHoop(p.pos, p.id, hoops);
    if (target < 0) return;
    const hoop = hoops[target];
    const ball = this.balls.get(p.ballId!);
    if (!ball) return;
    const dist = Math.hypot(p.pos.x - hoop.x, p.pos.y - hoop.y);
    const made = this.rng() < (this.mode === 'dunkContest'
      ? shotAccuracy(dist, isOnFire({ consecutiveMakes: p.consecutiveMakes, fireUntil: p.fireUntil }, this.time))
      : makeProbability(dist, p.skill));
    ball.state = 'flight';
    ball.carrier = null;
    ball.flight = {
      from: { ...p.pos },
      to: { x: hoop.x, y: hoop.y },
      start: this.time,
      duration: flightDuration(dist),
      made,
      isDunk: false,
      targetHoop: target,
      shooter: p.id,
      defenderId: hoop.owner,
    };
    p.ballId = null;
    p.action = {
      kind: 'shoot',
      until: this.time + ACTION_TIMES.shoot,
      targetHoop: target,
      defenderId: hoop.owner,
    };
    p.anim = 'shoot';
    this.events.push({ kind: 'shootStart', player: p.id, hoop: target });
  }

  private tryDunk(p: PlayerEnt, turbo: boolean): void {
    const hoops = this.hoopSnaps();
    const target = pickTargetHoop(p.pos, p.id, hoops);
    if (target < 0 || !this.inDunkRangeFor(p, hoops[target], turbo)) return;
    const ball = this.balls.get(p.ballId!);
    if (!ball) return;
    const hoop = hoops[target];
    const dirToHoop = { x: hoop.x - p.pos.x, y: hoop.y - p.pos.y };
    const dh = Math.hypot(dirToHoop.x, dirToHoop.y) || 1;
    const cos = (p.dir.x * dirToHoop.x + p.dir.y * dirToHoop.y) / dh;
    const approachDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    const flashy = turbo || (this.mode === 'dunkContest' && isOnFire({ consecutiveMakes: p.consecutiveMakes, fireUntil: p.fireUntil }, this.time));
    const dunkSkill = this.mode === 'dunkContest' ? (flashy ? 1.0 : 0.5) : p.skill;
    const def = pickDunk(this.rng, dunkSkill, dh, approachDeg);
    const totalTicks = def.windupTicks + def.ticksToRim + def.hangTicks + def.recoverTicks;
    // ball stays carried until the slam — the sprite draws it in-hand (no double ball)
    p.dunkVert = startDunkVert(def, GRAV);
    p.action = {
      kind: 'dunk',
      until: this.time + totalTicks * TICK_DT,
      targetHoop: target,
      defenderId: hoop.owner,
      lunge: { fx: p.pos.x, fy: p.pos.y, tx: hoop.x - (dirToHoop.x / dh) * 0.45, ty: hoop.y - (dirToHoop.y / dh) * 0.45 },
      dunk: { def, startTick: this.tick, released: false },
    };
    p.anim = def.anim;
    this.events.push({ kind: 'dunkStart', player: p.id, hoop: target, dunkName: def.name });
  }

  /** Q resolves contextually: steal if a carrier is close, otherwise a block attempt. */
  private tryDefend(p: PlayerEnt): void {
    const all = Array.from(this.players.values());
    const stealTarget = findStealTarget(p, all);
    if (stealTarget) {
      // dunkContest: v3 steal rules — cooldown gate, protection window, flat 40% chance
      if (this.mode === 'dunkContest') {
        if (this.time < p.nextStealAt) return; // thief on cooldown
        if (this.time < stealTarget.protectUntil) return; // fresh-possession protect
        p.action = { kind: 'steal', until: this.time + STEAL_LOCK, targetHoop: -1 };
        p.anim = 'steal';
        p.nextStealAt = this.time + DC_STEAL.cooldownMs / 1000;
        if (this.rng() < DC_STEAL.chance) {
          const ball = this.balls.get(stealTarget.ballId!);
          if (ball) {
            ball.state = 'free';
            ball.carrier = null;
            ball.pos = this.scatterNear(stealTarget.pos, 1);
          }
          stealTarget.ballId = null;
          this.stun(stealTarget);
          this.events.push({ kind: 'steal', player: p.id, hoop: -1 });
        }
        return;
      }
      // rimverse: original steal path (unchanged)
      p.action = { kind: 'steal', until: this.time + STEAL_LOCK, targetHoop: -1 };
      p.anim = 'steal';
      if (this.rng() < stealChance(p, stealTarget)) {
        const ball = this.balls.get(stealTarget.ballId!);
        if (ball) {
          ball.state = 'free';
          ball.carrier = null;
          ball.pos = this.scatterNear(stealTarget.pos, 1);
        }
        stealTarget.ballId = null;
        this.stun(stealTarget);
        this.events.push({ kind: 'steal', player: p.id, hoop: -1 });
      }
      return;
    }
    const dunker = findBlockTarget(p, all);
    p.action = { kind: 'block', until: this.time + BLOCK_LOCK, targetHoop: -1 };
    p.anim = 'block';
    if (dunker && this.rng() < blockChance(p, dunker)) {
      // cancel the dunk: drop the ball loose near the rim approach. Pre-slam the
      // ball is still carried in the dunker's hand (V5); post-slam it's in flight.
      const carried = dunker.ballId ? this.balls.get(dunker.ballId) : null;
      if (carried) {
        carried.state = 'free';
        carried.carrier = null;
        carried.z = 0;
        carried.pos = this.scatterNear(dunker.pos, 1.5);
        dunker.ballId = null;
      }
      for (const b of this.balls.values()) {
        if (b.state === 'flight' && b.flight?.shooter === dunker.id) {
          b.state = 'free';
          b.flight = null;
          b.z = 0;
          b.pos = this.scatterNear(dunker.pos, 1.5);
        }
      }
      applyBlocked(dunker, p);
      // dunkContest: fire-out on a successful block (v3 fidelity)
      if (this.mode === 'dunkContest') {
        const fr = fireOnMiss({ consecutiveMakes: dunker.consecutiveMakes, fireUntil: dunker.fireUntil });
        dunker.consecutiveMakes = fr.consecutiveMakes;
        dunker.fireUntil = fr.fireUntil;
      }
      this.stun(dunker);
      this.events.push({ kind: 'block', player: p.id, hoop: -1 });
    }
  }

  private stun(p: PlayerEnt): void {
    p.action = { kind: 'stunned', until: this.time + STUN_TIME, targetHoop: -1 };
    p.anim = 'stunned';
    p.dunkVert = null; // a blocked/stolen dunker drops out of the air
    p.z = 0;
  }

  /** Drop a loose ball a random direction `radius` from `center`, clamped in-arena (L5). */
  private scatterNear(center: Vec2, radius: number): Vec2 {
    const a = this.rng() * Math.PI * 2;
    const p = { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius };
    return this.mode === 'dunkContest' ? dcClamp(p) : clampToArena(p, Math.max(1, this.players.size));
  }

  private tickFlightsAndActions(): void {
    const hoops = this.hoopSnaps();
    for (const b of this.balls.values()) {
      if (b.state !== 'flight' || !b.flight) continue;
      const f = b.flight;
      const t = Math.min(1, (this.time - f.start) / f.duration);
      b.pos = { x: f.from.x + (f.to.x - f.from.x) * t, y: f.from.y + (f.to.y - f.from.y) * t };
      // Parabola that releases at chest height and passes through the rim at the end.
      const release = 1.6; // ball leaves the hands ~chest height
      const apex = RIM_HEIGHT + 1.0 + Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) * 0.06;
      // z(t): release at t=0, peak `apex`, and exactly RIM_HEIGHT at t=1 (drops through)
      b.z = release + (4 * (apex - release)) * t * (1 - t) + (RIM_HEIGHT - release) * t;
      if (t >= 1) {
        // M2/M3: resolve the defender by id captured at launch, not by (reslotted) index.
        const defenderGone = f.defenderId !== null && !this.players.has(f.defenderId);
        if (f.made && !defenderGone) {
          const shooter = this.players.get(f.shooter);
          const owner = f.defenderId ? this.players.get(f.defenderId) : undefined;
          const victim = owner && owner !== shooter ? owner : null;
          const dc = this.mode === 'dunkContest';
          const points = dc
            ? (f.isDunk ? DC_POINTS.dunk : shotPoints(Math.hypot(f.from.x - f.to.x, f.from.y - f.to.y)))
            : 2;
          if (shooter) {
            shooter.score += points;
            shooter.sessionPoints += points;
            shooter.peakScore = Math.max(shooter.peakScore, shooter.score);
            if (f.isDunk) shooter.sessionDunks += 1;
            if (dc) {
              this.combinedScore += points;
              const fr = fireOnMake({ consecutiveMakes: shooter.consecutiveMakes, fireUntil: shooter.fireUntil }, this.time);
              shooter.consecutiveMakes = fr.consecutiveMakes;
              shooter.fireUntil = fr.fireUntil;
            } else {
              applyScore(shooter, victim);
            }
            if (shooter.action?.kind !== 'dunk') {
              shooter.action = { kind: 'celebrate', until: this.time + 0.8, targetHoop: f.targetHoop };
              shooter.anim = 'celebrate';
            }
          }
          if (!dc && victim) victim.score = Math.max(0, victim.score - 2); // rimverse only, outside if(shooter)
          this.events.push({ kind: 'score', player: f.shooter, hoop: f.targetHoop, points });
          if (dc) {
            b.state = 'free'; b.carrier = null; b.z = 0; b.flight = null; b.pos = dcRespawnBall(this.rng);
          } else {
            startRespawn(b, this.time);
          }
        } else {
          // miss, or the defended rim left mid-flight (void — can't score a vanished rim)
          if (this.mode === 'dunkContest') { const s = this.players.get(f.shooter); if (s) { const fr = fireOnMiss({ consecutiveMakes: s.consecutiveMakes, fireUntil: s.fireUntil }); s.consecutiveMakes = fr.consecutiveMakes; s.fireUntil = fr.fireUntil; } }
          this.events.push({ kind: 'miss', player: f.shooter, hoop: f.targetHoop });
          b.state = 'free';
          b.flight = null;
          b.z = 0;
          b.pos = this.scatterNear(f.to, 1.5);
        }
      }
    }
    for (const p of this.players.values()) {
      const act = p.action;
      if (act?.kind === 'dunk' && act.dunk) {
        const { def, startTick } = act.dunk;
        const elapsed = this.tick - startTick;
        if (elapsed >= def.windupTicks && p.dunkVert) {
          p.dunkVert = stepDunkVert(p.dunkVert, GRAV, TICK_DT);
          p.z = p.dunkVert.z;
        }
        if (act.lunge) {
          const slam = slamTick(def);
          const t = Math.min(1, elapsed / Math.max(1, slam));
          const l = act.lunge;
          p.pos = { x: l.fx + (l.tx - l.fx) * t, y: l.fy + (l.ty - l.fy) * t };
        }
        if (!act.dunk.released && elapsed >= slamTick(def)) {
          act.dunk.released = true;
          const ball = p.ballId ? this.balls.get(p.ballId) : null;
          const hoop = this.hoopSnaps()[act.targetHoop];
          if (ball && hoop) {
            ball.state = 'flight';
            ball.carrier = null;
            ball.flight = {
              from: { x: p.pos.x, y: p.pos.y },
              to: { x: hoop.x, y: hoop.y },
              start: this.time,
              duration: 0.18,
              made: true,
              isDunk: true,
              targetHoop: act.targetHoop,
              shooter: p.id,
              defenderId: act.defenderId ?? hoop.owner,
            };
          }
          p.ballId = null;
        }
      }
      if (act && this.time >= act.until) {
        p.action = null;
        p.dunkVert = null;
        p.z = 0;
      }
    }
  }

  /** Add/remove server-driven bot players to reach `target` (humans untouched, capped). */
  setBotCount(target: number): void {
    const humans = [...this.players.values()].filter((p) => !p.isBot).length;
    target = Math.max(0, Math.min(target, MAX_PLAYERS - humans));
    const bots = [...this.players.values()].filter((p) => p.isBot);
    while (bots.length < target) {
      const id = `bot:${this.nextBotId}`;
      bots.push(this.addPlayer(id, `BOT ${this.nextBotId}`, true));
      this.nextBotId++;
    }
    while (bots.length > target) {
      this.removePlayer(bots.pop()!.id);
    }
  }

  private driveBots(): void {
    for (const p of this.players.values()) {
      if (!p.isBot || p.pendingIntents.length > 0) continue;
      const a = botIntent(p, this);
      p.pendingIntents.push({ seq: this.tick, ...a });
    }
  }

  ballSnaps(): BallSnap[] {
    return Array.from(this.balls.values()).map(toSnap);
  }

  scoreBall(id: string): void {
    const b = this.balls.get(id);
    if (!b) return;
    if (b.carrier) {
      const p = this.players.get(b.carrier);
      if (p) p.ballId = null;
    }
    startRespawn(b, this.time);
  }

  snapshotFor(viewerId: string, includeHoops = true): SnapshotMsg {
    const viewer = this.players.get(viewerId);
    const all = Array.from(this.players.values());
    const visible = viewer ? aoiPlayers(viewer, all, AOI_CAP) : all;
    return {
      t: 'snapshot',
      tick: this.tick,
      tv: this.topoVersion,
      ack: viewer?.lastSeq ?? 0,
      n: this.players.size,
      players: visible.map((p) => ({
        id: p.id,
        name: p.name,
        x: p.pos.x,
        y: p.pos.y,
        z: p.z,
        dx: p.dir.x,
        dy: p.dir.y,
        anim: p.anim,
        size: p.size,
        skill: p.skill,
        turboLeft: p.turboLeft,
        turboCd: p.turboCd,
        hue: p.hue,
        accentHue: p.accentHue,
        hasBall: p.ballId !== null,
        onFire: this.mode === 'dunkContest' && isOnFire({ consecutiveMakes: p.consecutiveMakes, fireUntil: p.fireUntil }, this.time),
        score: p.score,
        hoop: p.hoop,
      })),
      balls: this.ballSnaps(),
      hoops: includeHoops ? this.hoopSnaps() : undefined,
      events: [...this.events],
    };
  }
}
