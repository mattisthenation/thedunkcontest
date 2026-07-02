import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER_PORT, SNAPSHOT_EVERY, TICK_RATE } from '../../shared/src/constants';
import { RoomManager } from './game/roomManager';
import { send, startNet } from './net';
import { openDb } from './db';

const rooms = new RoomManager();
// SP2 shared data layer: read v3's canonical SQLite (it owns identity/character/career and is the
// SOLE writer). Read-only here. The file lives at <repo>/data/dunkcontest.db (this rimverse is
// vendored inside The Dunk Contest at <repo>/rimverse/); override with DUNKVERSE_DB
// (e.g. tests / standalone). It must already exist (v3 created it).
const SHARED_DB =
  process.env.DUNKVERSE_DB ??
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data', 'dunkcontest.db');
const db = openDb(SHARED_DB, { readonly: true });
const { sessions } = startNet(rooms, SERVER_PORT, db);

setInterval(() => {
  rooms.stepAll();
  for (const room of rooms.rooms()) {
    const w = room.world;
    if (w.tick % SNAPSHOT_EVERY !== 0) continue;
    for (const sess of sessions.values()) {
      if (!sess.joined || sess.world !== w) continue;
      const includeHoops = sess.lastTv !== w.topoVersion;
      send(sess.ws, w.snapshotFor(sess.id, includeHoops));
      if (includeHoops) sess.lastTv = w.topoVersion;
      if (w.tick % (SNAPSHOT_EVERY * 8) === 0) send(sess.ws, { t: 'arena', combined: w.combinedScore });
    }
    w.events.length = 0;
  }
}, 1000 / TICK_RATE);

console.log(`[dunk-contest] server on ws://localhost:${SERVER_PORT}, tick ${TICK_RATE} Hz`);
