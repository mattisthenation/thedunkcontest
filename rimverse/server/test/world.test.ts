import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { PLAYER_SPEED, TICK_DT, RIM_HEIGHT } from '../../shared/src/constants';
import { DUNKS } from '../../shared/src/dunks';
import { slamTick } from '../../shared/src/dunkPhysics';
import { dcHoops, DC_COURT, DC_STEAL } from '../../shared/src/dunkConstants';

const intent = (seq: number, mx: number, my: number) => ({
  seq,
  mx,
  my,
  grab: false,
  shoot: false,
  dunk: false,
});

const actionIntent = (
  seq: number,
  over: Partial<{ grab: boolean; shoot: boolean; dunk: boolean; defend: boolean }>,
) => ({ seq, mx: 0, my: 0, grab: false, shoot: false, dunk: false, defend: false, ...over });

describe('World movement', () => {
  it('folds queued intents to one integration per tick and acks the latest', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pendingIntents.push(intent(1, 1, 0), intent(2, 1, 0));
    w.step();
    expect(p.pos.x).toBeCloseTo(PLAYER_SPEED * TICK_DT); // ONE step, not two
    expect(p.lastSeq).toBe(2);
    expect(p.pendingIntents.length).toBe(0);
  });

  it('preserves normal speed across ticks: one intent/tick for 30 ticks = ~1s of travel (H2 regression)', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    for (let t = 0; t < 30; t++) {
      p.pendingIntents.push(intent(t + 1, 1, 0));
      w.step();
    }
    expect(p.pos.x).toBeCloseTo(30 * PLAYER_SPEED * TICK_DT, 5); // ~8 units, full speed
  });

  it('intent flooding buys no speed: 20 queued = one tick of travel (anti-speedhack, H2)', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    for (let s = 1; s <= 20; s++) p.pendingIntents.push(intent(s, 1, 0));
    w.step();
    expect(p.pos.x).toBeCloseTo(PLAYER_SPEED * TICK_DT); // exactly one step despite 20 intents
    expect(p.pendingIntents.length).toBe(0); // fully drained (no backlog to accelerate later)
    expect(p.lastSeq).toBe(20);
  });

  it('updates facing and anim from movement', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pendingIntents.push(intent(1, 0, -1));
    w.step();
    expect(p.dir.y).toBeLessThan(0);
    expect(p.anim).toBe('run');
    w.step();
    expect(p.anim).toBe('idle');
  });

  it('shoot intent auto-upgrades to a dunk when in range', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pos = { x: 0, y: 0 };
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    expect(p.ballId).not.toBeNull();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 2 };
    p.pendingIntents.push(actionIntent(2, { shoot: true }));
    w.step();
    expect(p.anim.startsWith('dunk')).toBe(true);
  });

  it('grab intent with no free ball nearby falls through to defend (steal)', () => {
    const w = new World();
    const c = w.addPlayer('carrier', 'c');
    const d = w.addPlayer('defender', 'd');
    c.pos = { x: 6, y: -10 }; // in bounds, far from the hub ball at (0,0)
    d.pos = { x: 6.8, y: -10 };
    w.step();
    const ball = Array.from(w.balls.values())[0];
    ball.state = 'carried';
    ball.carrier = 'carrier';
    c.ballId = ball.id;
    w.rng = () => 0; // force steal success
    d.pendingIntents.push(actionIntent(1, { grab: true })); // E, not Q
    w.step();
    expect(d.anim).toBe('steal');
    expect(c.ballId).toBeNull();
  });

  it('builds a snapshot with ack for a given player', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pendingIntents.push(intent(7, 0, 0));
    w.step();
    const snap = w.snapshotFor('p1');
    expect(snap.ack).toBe(7);
    expect(snap.players[0].id).toBe('p1');
    expect(snap.n).toBe(1);
  });
});

describe('World dunk arc (V5)', () => {
  const setupDunker = () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.skill = 1; // unlock all dunks
    p.pos = { x: 0, y: 0 }; // sit on the hub ball so the grab actually lands (spawn is far from center)
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 2 };
    p.dir = { x: 0, y: Math.sign(hoop.y - p.pos.y) };
    return { w, p, hoop };
  };

  it('keeps the ball in hand at launch, then releases it at the slam', () => {
    const { w, p } = setupDunker();
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    expect(p.action?.kind).toBe('dunk');
    expect(p.ballId).not.toBeNull(); // still carried during windup/rise
    const ball = Array.from(w.balls.values()).find((b) => b.carrier === 'p1');
    expect(ball?.state).toBe('carried');
  });

  it('the body rises off the floor and peaks near the rim', () => {
    const { w, p } = setupDunker();
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    const def = DUNKS.find((d) => d.anim === p.anim)!;
    let peak = 0;
    for (let i = 0; i < slamTick(def) + 2; i++) { w.step(); peak = Math.max(peak, p.z); }
    expect(peak).toBeGreaterThan(0.8);
  });

  it('scores after the dunk completes and the ball respawns', () => {
    const { w, p } = setupDunker();
    const startScore = p.score;
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    for (let i = 0; i < 60; i++) w.step();
    expect(p.score).toBeGreaterThan(startScore);
    expect(p.action).toBeNull();
    expect(p.z).toBe(0);
  });

  it('a made dunk does NOT cut to celebrate mid-air (the dunk plays its own choreography)', () => {
    const { w, p } = setupDunker();
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    const def = DUNKS.find((d) => d.anim === p.anim)!;
    // step through the slam + the short ball flight that scores (~0.2s ≈ 6 ticks)
    for (let i = 0; i < slamTick(def) + 8; i++) w.step();
    // points already registered, but while the dunk lock is still active the action stays 'dunk'
    if (p.action) expect(p.action.kind).not.toBe('celebrate');
    expect(p.score).toBeGreaterThan(0);
  });
});

describe('Snapshot wire format', () => {
  it('snapshot carries accentHue (rig trim accent)', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    w.step();
    expect(w.snapshotFor('p1').players[0].accentHue).toBe(0);
    p.accentHue = 200;
    expect(w.snapshotFor('p1').players[0].accentHue).toBeCloseTo(200);
  });

  it('snapshot carries the player height (z)', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    w.step();
    const snap = w.snapshotFor('p1');
    expect(snap.players[0].z).toBe(0);
    p.z = 1.2; // simulate mid-dunk
    const snap2 = w.snapshotFor('p1');
    expect(snap2.players[0].z).toBeCloseTo(1.2);
  });
});

describe('A1 session counters', () => {
  it('a made dunk increments sessionPoints and sessionDunks; peakScore tracks max', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.skill = 1;
    p.pos = { x: 0, y: 0 };
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 2 };
    p.dir = { x: 0, y: Math.sign(hoop.y - p.pos.y) };
    expect(p.sessionPoints).toBe(0);
    p.pendingIntents.push(actionIntent(2, { dunk: true }));
    w.step();
    for (let i = 0; i < 60; i++) w.step();
    expect(p.sessionPoints).toBe(2);
    expect(p.sessionDunks).toBe(1);
    expect(p.peakScore).toBeGreaterThanOrEqual(2);
  });

  it('a made jump shot increments sessionPoints only (not dunks)', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pos = { x: 0, y: 0 };
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 6 }; // out of dunk range → shot
    w.rng = () => 0; // force the shot to be made
    p.pendingIntents.push(actionIntent(2, { shoot: true }));
    w.step();
    for (let i = 0; i < 60; i++) w.step();
    expect(p.sessionPoints).toBe(2);
    expect(p.sessionDunks).toBe(0);
  });
});

describe('Bug A — shot arc passes through the rim', () => {
  it('a made shot reaches rim height near the end of the flight', () => {
    const w = new World();
    const p = w.addPlayer('p1', 'one');
    p.pos = { x: 0, y: 0 }; // sit on the hub ball so the grab lands
    p.pendingIntents.push(actionIntent(1, { grab: true }));
    w.step();
    const hoop = w.hoopSnaps().find((h) => h.owner !== 'p1')!;
    p.pos = { x: hoop.x, y: hoop.y - 6 }; // mid-range jump shot, not a dunk
    p.pendingIntents.push(actionIntent(2, { shoot: true }));
    w.step();
    const ball = Array.from(w.balls.values()).find((b) => b.state === 'flight')!;
    let maxZ = 0;
    let lastZ = 0; // last height before the make zeroes z on respawn
    for (let i = 0; i < 60 && ball.state === 'flight'; i++) {
      w.step();
      maxZ = Math.max(maxZ, ball.z);
      if (ball.z > 0.1) lastZ = ball.z;
    }
    expect(maxZ).toBeGreaterThan(RIM_HEIGHT); // arcs up to/over the rim (old formula peaked ~2.48, below it)
    expect(lastZ).toBeGreaterThan(RIM_HEIGHT - 0.5); // still ~rim height as it reaches the hoop (old ended at ~1.0)
  });
});

describe('World mode scaffolding', () => {
  it('defaults to rimverse and initializes dunk-contest fields', () => {
    const w = new World();
    expect(w.mode).toBe('rimverse');
    expect(w.combinedScore).toBe(0);
    const p = w.addPlayer('p1', 'one');
    expect(p.consecutiveMakes).toBe(0);
    expect(p.fireUntil).toBe(0);
  });
  it('accepts a dunkContest mode', () => {
    const w = new World('dunkContest');
    expect(w.mode).toBe('dunkContest');
  });
});

describe('dunkContest geometry', () => {
  it('always has exactly 2 shared rims at the fixed court positions, regardless of N', () => {
    const w = new World('dunkContest');
    for (let i = 0; i < 5; i++) w.addPlayer(`p${i}`, `n${i}`);
    const hoops = w.hoopSnaps();
    expect(hoops).toHaveLength(2);
    expect(hoops.every((h) => h.owner === null)).toBe(true);
    expect(hoops.map((h) => ({ x: h.x, y: h.y }))).toEqual(dcHoops());
  });
  it('keeps exactly one ball regardless of N', () => {
    const w = new World('dunkContest');
    for (let i = 0; i < 8; i++) w.addPlayer(`p${i}`, `n${i}`);
    w.step();
    expect(w.balls.size).toBe(1);
  });
  it('spawns players inside the court bounds', () => {
    const w = new World('dunkContest');
    const p = w.addPlayer('p1', 'one');
    expect(Math.abs(p.pos.x)).toBeLessThanOrEqual(9.5);
    expect(Math.abs(p.pos.y)).toBeLessThanOrEqual(14.5);
  });
});

function dcWorldWithCarrier(): { w: World; p: ReturnType<World['addPlayer']> } {
  const w = new World('dunkContest');
  w.rng = () => 0; // shots always make (rng < accuracy)
  const p = w.addPlayer('p1', 'one');
  w.step();
  const ball = [...w.balls.values()][0];
  ball.state = 'carried'; ball.carrier = p.id; p.ballId = ball.id;
  return { w, p };
}

describe('dunkContest scoring (additive, v3 values)', () => {
  it('a made 2 adds 2 to the shooter and combinedScore, no victim loss', () => {
    const { w, p } = dcWorldWithCarrier();
    p.pos = { x: 0, y: -12.3 + 4 }; // ~4 from the near rim → a 2 (and beyond dunk reach 3.7)
    p.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    for (let i = 0; i < 40; i++) w.step();
    expect(p.score).toBe(2);
    expect(w.combinedScore).toBe(2);
    expect(p.size).toBe(1); // no progression (uniform players)
  });
  it('a made 3 adds 3', () => {
    const { w, p } = dcWorldWithCarrier();
    p.pos = { x: 0, y: -12.3 + (DC_COURT.threePointRadius + 1) }; // beyond the arc
    p.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
    for (let i = 0; i < 40; i++) w.step();
    expect(p.score).toBe(3);
    expect(w.combinedScore).toBe(3);
  });
  it('ignites fire after 3 makes', () => {
    const { w, p } = dcWorldWithCarrier();
    p.pos = { x: 0, y: -12.3 + 4 };
    for (let m = 0; m < 3; m++) {
      const b = [...w.balls.values()][0];
      b.state = 'carried'; b.carrier = p.id; p.ballId = b.id; p.action = null;
      p.pendingIntents.push({ seq: m + 1, mx: 0, my: 0, grab: false, shoot: true, dunk: false });
      for (let i = 0; i < 40; i++) w.step();
    }
    expect(p.consecutiveMakes).toBeGreaterThanOrEqual(3);
    expect(p.fireUntil).toBeGreaterThan(0);
  });
});

describe('dunkContest steal fidelity (v3 numbers)', () => {
  function carrier(): { w: World; thief: ReturnType<World['addPlayer']>; vic: ReturnType<World['addPlayer']> } {
    const w = new World('dunkContest');
    const vic = w.addPlayer('v', 'vic');
    const thief = w.addPlayer('t', 'thief');
    w.step();
    const ball = [...w.balls.values()][0];
    ball.state = 'carried'; ball.carrier = vic.id; vic.ballId = ball.id;
    vic.pos = { x: 0, y: 0 }; thief.pos = { x: 1, y: 0 }; // within radius 1.6
    return { w, thief, vic };
  }
  it('cannot steal fresh (protected) possession', () => {
    const { w, thief, vic } = carrier();
    vic.protectUntil = w.time + 1; // protected
    w.rng = () => 0; // would otherwise succeed
    thief.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: false, shoot: false, dunk: false, defend: true });
    w.step();
    expect(vic.ballId).not.toBeNull(); // still held
  });
  it('steal succeeds at 40% (rng below chance) and respects the thief cooldown', () => {
    const { w, thief, vic } = carrier();
    vic.protectUntil = 0; thief.nextStealAt = 0; w.rng = () => DC_STEAL.chance - 0.01; // < 0.40 → success
    thief.pendingIntents.push({ seq: 1, mx: 0, my: 0, grab: false, shoot: false, dunk: false, defend: true });
    w.step();
    expect(thief.ballId === vic.ballId || vic.ballId === null).toBe(true); // possession left the victim
    expect(thief.nextStealAt).toBeGreaterThan(0); // cooldown armed
  });
});

describe('PlayerSnap.onFire', () => {
  it('is false by default and true when a dunkContest player is on fire', () => {
    const w = new World('dunkContest');
    const p = w.addPlayer('p1', 'one');
    expect(w.snapshotFor('p1').players[0].onFire).toBe(false);
    p.consecutiveMakes = 3; p.fireUntil = w.time + 10;
    expect(w.snapshotFor('p1').players[0].onFire).toBe(true);
  });
});
