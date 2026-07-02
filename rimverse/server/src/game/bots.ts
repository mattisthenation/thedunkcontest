import { GRAB_RADIUS } from '../../../shared/src/constants';
import type { PlayerEnt, World } from './world';

export interface BotAction {
  mx: number;
  my: number;
  grab: boolean;
  shoot: boolean;
  dunk: boolean;
  defend: boolean;
  turbo: boolean;
}

/**
 * Bot brain (server-side, full world visibility): hunt a nearby carrier to steal,
 * else chase a free ball and grab it, else drive the carried ball to an enemy rim
 * and shoot (auto-dunks in range), else wander. Uses Math.random (server-only).
 */
export function botIntent(bot: PlayerEnt, world: World): BotAction {
  const a: BotAction = {
    mx: 0,
    my: 0,
    grab: false,
    shoot: false,
    dunk: false,
    defend: false,
    turbo: false,
  };

  if (Math.random() < 0.03 || (bot.botWander.x === 0 && bot.botWander.y === 0)) {
    const ang = Math.random() * Math.PI * 2;
    bot.botWander = { x: Math.cos(ang), y: Math.sin(ang) };
  }
  a.mx = bot.botWander.x;
  a.my = bot.botWander.y;

  const players = [...world.players.values()];
  const hoops = world.hoopSnaps();
  const owned = hoops.some((h) => h.owner);
  const enemyHoop = owned
    ? (hoops.find((h) => h.owner && h.owner !== bot.id) ?? hoops.find((h) => h.owner !== bot.id))
    : hoops.reduce((best, h) =>
        Math.hypot(h.x - bot.pos.x, h.y - bot.pos.y) < Math.hypot(best.x - bot.pos.x, best.y - bot.pos.y) ? h : best);
  const carrier = players.find(
    (p) => p.id !== bot.id && p.ballId && Math.hypot(p.pos.x - bot.pos.x, p.pos.y - bot.pos.y) < 6,
  );
  const freeBall = [...world.balls.values()].find((b) => b.state === 'free');

  if (!bot.ballId && carrier) {
    const d = Math.hypot(carrier.pos.x - bot.pos.x, carrier.pos.y - bot.pos.y) || 1;
    a.mx = (carrier.pos.x - bot.pos.x) / d;
    a.my = (carrier.pos.y - bot.pos.y) / d;
    a.turbo = d > 2;
    a.grab = d < 1.5; // empty-handed grab routes to a steal on the server
  } else if (!bot.ballId && freeBall) {
    const d = Math.hypot(freeBall.pos.x - bot.pos.x, freeBall.pos.y - bot.pos.y) || 1;
    a.mx = (freeBall.pos.x - bot.pos.x) / d;
    a.my = (freeBall.pos.y - bot.pos.y) / d;
    a.grab = d < GRAB_RADIUS;
    a.turbo = d > 5;
  } else if (bot.ballId && enemyHoop) {
    const d = Math.hypot(enemyHoop.x - bot.pos.x, enemyHoop.y - bot.pos.y) || 1;
    a.mx = (enemyHoop.x - bot.pos.x) / d;
    a.my = (enemyHoop.y - bot.pos.y) / d;
    if (d < 2.5) a.shoot = true; // shoot auto-upgrades to a dunk in range
    else if (d < 9 && Math.random() < 0.02) a.shoot = true;
    else a.turbo = d > 4;
  }
  return a;
}
