export type { Character } from './character';

export interface Vec2 {
  x: number;
  y: number;
}

export type AnimState =
  | 'idle'
  | 'run'
  | 'dribbleIdle'
  | 'dribbleRun'
  | 'shoot'
  | 'dunk'
  | 'dunkTomahawk'
  | 'dunkWindmill'
  | 'dunkDoublePump'
  | 'dunkReverse'
  | 'dunk360'
  | 'steal'
  | 'block'
  | 'stunned'
  | 'celebrate';

export interface PlayerSnap {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number; // height above floor (dunk/jump arc), render-only; sim floor stays 2D
  dx: number; // facing (unit-ish)
  dy: number;
  anim: AnimState;
  size: number; // progression: SIZE_MIN..SIZE_MAX
  skill: number; // progression: 0..1
  turboLeft: number; // seconds of boost remaining (for HUD + reconcile)
  turboCd: number;
  hue: number; // appearance tint bucket, server-assigned
  accentHue: number; // trim accent hue (jersey2 → rig head-glow)
  hasBall: boolean;
  onFire: boolean;
  score: number;
  hoop: number; // owned hoop index, -1 if none
}

export type BallState = 'free' | 'carried' | 'flight' | 'respawning';

export interface BallSnap {
  id: string;
  x: number;
  y: number;
  z: number; // render height (flight arc); sim stays 2D
  state: BallState;
  carrier: string | null;
}

export interface HoopSnap {
  index: number;
  x: number;
  y: number;
  owner: string | null;
}

export interface GameEvent {
  kind: 'score' | 'miss' | 'shootStart' | 'dunkStart' | 'steal' | 'block';
  player: string;
  hoop: number;
  points?: number;
  dunkName?: string;
}
