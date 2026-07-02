import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Character } from '../../shared/src/types';
import type { LeaderboardEntry } from '../../shared/src/protocol';

export interface CareerRow {
  name: string;
  character: Character | null;
  points: number;
  dunks: number;
  bestSession: number;
  sessions: number;
}
export interface SessionDeltas {
  points: number;
  dunks: number;
}
export interface Db {
  loadPlayer(token: string): CareerRow | null;
  upsertIdentity(token: string, name: string, character: Character): void;
  recordSession(token: string, peakScore: number, deltas: SessionDeltas): void;
  leaderboard(limit?: number): LeaderboardEntry[];
  playerRank(token: string): number | null;
  close(): void;
}

function safeParse(s: string): Character | null {
  try { return JSON.parse(s) as Character; } catch { return null; }
}

export function openDb(file?: string, opts?: { readonly?: boolean }): Db {
  const here = dirname(fileURLToPath(import.meta.url));
  const dbPath = file ?? join(here, '..', 'data', 'rimverse.db');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000'); // two processes (v3 writer + V5 reader) may share this file
  // v3 owns the DDL on the shared store, so a read-only V5 handle never creates the table.
  // Writable handles establish v3's SUPERSET schema (incl. makes/misses/threes/best_streak) so
  // it's correct regardless of which app touches an empty file first.
  if (!opts?.readonly) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        token        TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        character    TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        last_seen    INTEGER NOT NULL,
        points       INTEGER NOT NULL DEFAULT 0,
        makes        INTEGER NOT NULL DEFAULT 0,
        misses       INTEGER NOT NULL DEFAULT 0,
        dunks        INTEGER NOT NULL DEFAULT 0,
        threes       INTEGER NOT NULL DEFAULT 0,
        best_streak  INTEGER NOT NULL DEFAULT 0,
        best_session INTEGER NOT NULL DEFAULT 0,
        sessions     INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_players_points ON players(points DESC);
    `);
  }

  const stmtUpsert = db.prepare(`
    INSERT INTO players (token, name, character, created_at, last_seen)
    VALUES (@token, @name, @character, @now, @now)
    ON CONFLICT(token) DO UPDATE SET name = @name, character = @character, last_seen = @now
  `);
  const stmtRecord = db.prepare(`
    UPDATE players SET
      points = points + @points,
      dunks = dunks + @dunks,
      best_session = MAX(best_session, @peak),
      sessions = sessions + 1,
      last_seen = @now
    WHERE token = @token
  `);
  const stmtTop = db.prepare(`
    SELECT name, points, dunks, best_session AS bestSession, character
    FROM players WHERE points > 0
    ORDER BY points DESC, best_session DESC LIMIT ?
  `);
  const stmtOne = db.prepare(`
    SELECT name, character, points, dunks, best_session AS bestSession, sessions
    FROM players WHERE token = ?
  `);
  const stmtRank = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM players
    WHERE points > (SELECT points FROM players WHERE token = ?)
  `);

  return {
    loadPlayer(token) {
      const r = stmtOne.get(token) as (Omit<CareerRow, 'character'> & { character: string }) | undefined;
      if (!r) return null;
      return { ...r, character: safeParse(r.character) };
    },
    upsertIdentity(token, name, character) {
      if (opts?.readonly) return; // v3 is the sole writer of the shared store
      stmtUpsert.run({ token, name, character: JSON.stringify(character), now: Date.now() });
    },
    recordSession(token, peakScore, d) {
      if (opts?.readonly) return; // v3 is the sole writer of the shared store
      stmtRecord.run({ token, points: d.points, dunks: d.dunks, peak: peakScore, now: Date.now() });
    },
    leaderboard(limit = 20) {
      const rows = stmtTop.all(limit) as Array<Omit<LeaderboardEntry, 'rank' | 'character'> & { character: string }>;
      return rows.map((r, i) => ({ rank: i + 1, name: r.name, points: r.points, dunks: r.dunks, bestSession: r.bestSession, character: safeParse(r.character) }));
    },
    playerRank(token) {
      const r = stmtRank.get(token) as { rank: number } | undefined;
      return r?.rank ?? null;
    },
    close() { db.close(); },
  };
}
