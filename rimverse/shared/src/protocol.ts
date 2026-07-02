import type { BallSnap, Character, GameEvent, HoopSnap, PlayerSnap } from './types';
import type { GameMode } from './gameMode';

export interface IntentMsg {
  t: 'intent';
  seq: number;
  mx: number; // move dir, |[mx,my]| <= 1
  my: number;
  grab?: boolean;
  shoot?: boolean;
  dunk?: boolean;
  turbo?: boolean;
  defend?: boolean;
}

export type ClientMsg =
  | { t: 'join'; name: string; token?: string; character?: Character; room?: string } // token optional: server generates one when absent
  | { t: 'bots'; count: number } // request N server-driven practice bots
  | { t: 'getLeaderboard'; limit?: number }
  | IntentMsg;

export interface SnapshotMsg {
  t: 'snapshot';
  tick: number;
  tv: number; // topology version; hoops are present only when it changed
  ack: number; // last intent seq the server applied for *this* client
  n: number; // current player count (drives geometry)
  players: PlayerSnap[];
  balls: BallSnap[];
  hoops?: HoopSnap[];
  events: GameEvent[];
}

export type ServerMsg =
  | { t: 'welcome'; id: string; tick: number; x: number; y: number; room: string; mode: GameMode }
  | { t: 'identity'; points: number; dunks: number; bestSession: number; sessions: number; rank: number | null }
  | { t: 'leaderboard'; entries: LeaderboardEntry[] }
  | { t: 'arena'; combined: number }
  | SnapshotMsg;

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  dunks: number;
  bestSession: number;
  character: Character | null;
}
