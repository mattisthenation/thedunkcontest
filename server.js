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
server.listen(PORT, () => {
  console.log(`The Dunk Contest v3 — http://localhost:${PORT}`);
});
