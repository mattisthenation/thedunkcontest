// src/db.js — persistence via better-sqlite3.
// Why SQLite: single-process game server, zero-config single file, synchronous
// API (no await soup in the hot path — all writes happen on session
// boundaries, not per tick), survives restarts, and trivially backed up.
//
// Identity model: the browser generates a random token kept in localStorage.
// No accounts, no passwords — arcade-style "enter your initials" persistence.

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openDb(file) {
  const dbPath = file || path.join(__dirname, '..', 'data', 'dunkcontest.db');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      token       TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      character   TEXT NOT NULL,          -- JSON character config
      created_at  INTEGER NOT NULL,
      last_seen   INTEGER NOT NULL,
      points      INTEGER NOT NULL DEFAULT 0,
      makes       INTEGER NOT NULL DEFAULT 0,
      misses      INTEGER NOT NULL DEFAULT 0,
      dunks       INTEGER NOT NULL DEFAULT 0,
      threes      INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      best_session INTEGER NOT NULL DEFAULT 0,
      sessions    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_players_points ON players(points DESC);
  `);

  const upsert = db.prepare(`
    INSERT INTO players (token, name, character, created_at, last_seen)
    VALUES (@token, @name, @character, @now, @now)
    ON CONFLICT(token) DO UPDATE SET
      name = @name, character = @character, last_seen = @now
  `);

  const record = db.prepare(`
    UPDATE players SET
      points = points + @points,
      makes = makes + @makes,
      misses = misses + @misses,
      dunks = dunks + @dunks,
      threes = threes + @threes,
      best_streak = MAX(best_streak, @bestStreak),
      best_session = MAX(best_session, @session),
      sessions = sessions + 1,
      last_seen = @now
    WHERE token = @token
  `);

  const top = db.prepare(`
    SELECT name, points, dunks, threes, best_streak, best_session, character
    FROM players WHERE points > 0
    ORDER BY points DESC, best_session DESC LIMIT ?
  `);

  const one = db.prepare(`
    SELECT name, character, points, makes, misses, dunks, threes,
           best_streak, best_session, sessions
    FROM players WHERE token = ?
  `);

  const rank = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM players
    WHERE points > (SELECT points FROM players WHERE token = ?)
  `);

  return {
    upsertPlayer(token, name, character) {
      upsert.run({ token, name, character: JSON.stringify(character), now: Date.now() });
    },
    // Called when a session ends (disconnect past grace, or court switch).
    recordSession(token, sessionScore, stats) {
      record.run({
        token,
        points: stats.points, makes: stats.makes, misses: stats.misses,
        dunks: stats.dunks, threes: stats.threes,
        bestStreak: stats.bestStreak, session: sessionScore,
        now: Date.now(),
      });
    },
    leaderboard(limit = 20) {
      return top.all(limit).map((r, i) => ({
        rank: i + 1, ...r, character: safeParse(r.character),
      }));
    },
    getPlayer(token) {
      const row = one.get(token);
      if (!row) return null;
      return { ...row, character: safeParse(row.character), rank: rank.get(token)?.rank ?? null };
    },
    close() { db.close(); },
  };
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
