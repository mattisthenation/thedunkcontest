// server.js — The Dunk Contest v3 entry point.
// Express serves the static client + shared modules; socket.io carries the
// game protocol; RoomManager owns all game state. See README for the
// netcode and scaling model.

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

import { RoomManager } from './src/roomManager.js';
import { openDb } from './src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // The protocol is small JSON messages at 20Hz; permessage-deflate costs
  // more CPU than the bytes it saves at this size.
  perMessageDeflate: false,
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
// The rimverse — the game within the game (built by `npm run build:rimverse`).
app.use('/rimverse', express.static(path.join(__dirname, 'rimverse', 'client', 'dist')));

const db = process.env.DUNK_NO_DB ? null : openDb();
const manager = new RoomManager(io, { db });
manager.start();

io.on('connection', (socket) => manager.attach(socket));

app.get('/api/status', (req, res) => res.json(manager.status()));

app.get('/api/leaderboard', (req, res) => {
  if (!db) return res.json({ players: [] });
  res.json({ players: db.leaderboard(20) });
});

app.get('/api/me/:token', (req, res) => {
  if (!db) return res.json(null);
  res.json(db.getPlayer(String(req.params.token).slice(0, 64)));
});

const PORT = process.env.PORT || 3000;
// In production we bind to localhost and let the reverse proxy (Caddy) face
// the internet; HOST defaults to all interfaces for local dev convenience.
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`The Dunk Contest v3 — listening on ${HOST}:${PORT}`);
});

// Graceful shutdown. systemd sends SIGTERM on stop/restart (deploys). Without
// this, points earned in the current sessions — held in memory and normally
// flushed to SQLite on disconnect — would be lost on every redeploy.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — flushing session stats and shutting down…`);
  manager.stop();
  manager.flushAll();
  db?.close();
  io.close();
  server.close(() => process.exit(0));
  // Hard cap so a hung connection can't block the restart indefinitely.
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
