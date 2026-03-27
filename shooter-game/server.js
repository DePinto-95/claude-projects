'use strict';

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// Serve the game files
app.use(express.static(path.join(__dirname, 'public')));

// ── Room store ────────────────────────────────────────────────
const rooms = new Map(); // code → room

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

function makeRoom() {
  return {
    players:       [],   // socket references
    started:       false,
    items:         new Map(), // id → item object
    itemIdCounter: 0,
    itemTimer:     8,    // seconds until first item spawn
  };
}

// ── Item spawner (server-authoritative) ───────────────────────
const W = 800, H = 600;
const WEP_TYPES = ['shotgun', 'smg', 'sniper'];
const TICK_MS   = 200;

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (!room.started || room.players.length < 2) continue;

    room.itemTimer -= TICK_MS / 1000;
    if (room.itemTimer <= 0) {
      room.itemTimer = 12 + Math.random() * 8; // next spawn in 12-20 s

      const isWeapon = Math.random() < 0.55;
      const item = {
        id:         room.itemIdCounter++,
        x:          50 + Math.random() * (W - 100),
        y:          50 + Math.random() * (H - 100),
        type:       isWeapon ? 'weapon' : 'health',
        weaponType: isWeapon ? WEP_TYPES[Math.floor(Math.random() * WEP_TYPES.length)] : null,
        alive:      true,
      };
      room.items.set(item.id, item);
      io.to(code).emit('item_spawn', item);
    }
  }
}, TICK_MS);

// ── Socket logic ──────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`+ ${socket.id}`);

  // ── CREATE ROOM ──
  socket.on('create_room', () => {
    const code = makeCode();
    const room = makeRoom();
    room.players.push(socket);
    rooms.set(code, room);
    socket.roomCode    = code;
    socket.playerIndex = 0;
    socket.join(code);
    socket.emit('room_created', { code });
    console.log(`Room ${code} created by ${socket.id}`);
  });

  // ── JOIN ROOM ──
  socket.on('join_room', ({ code }) => {
    code = (code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room)                  { socket.emit('join_error', { msg: 'Room not found' });  return; }
    if (room.players.length >= 2) { socket.emit('join_error', { msg: 'Room is full' }); return; }

    room.players.push(socket);
    socket.roomCode    = code;
    socket.playerIndex = 1;
    socket.join(code);
    room.started = true;

    // Tell both players to start
    room.players[0].emit('game_start', { yourIndex: 0 });
    socket.emit('game_start',           { yourIndex: 1 });
    console.log(`Room ${code} started`);
  });

  // ── GAME EVENTS (all just relayed to the other player) ──

  socket.on('player_state', data =>
    socket.to(socket.roomCode).emit('opponent_state', data));

  socket.on('player_fire', data =>
    socket.to(socket.roomCode).emit('opponent_fire', data));

  // Self-reported HP so opponent can display it
  socket.on('player_hp', data =>
    socket.to(socket.roomCode).emit('opponent_hp', data));

  // Caller died → schedule a round-reset for both after 2.5 s
  socket.on('player_died', () => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('opponent_died');
    setTimeout(() => {
      if (rooms.has(socket.roomCode)) {
        io.to(socket.roomCode).emit('round_reset');
      }
    }, 2500);
  });

  // One side's lives hit 0 → broadcast pvp_over to both
  socket.on('game_over', ({ winner }) => {
    if (!socket.roomCode) return;
    // 'self' means sender won; translate for each recipient
    socket.emit('pvp_over',             { winner: 'player' });
    socket.to(socket.roomCode).emit('pvp_over', { winner: 'bot' });
  });

  // Item picked up → remove from server map + tell opponent
  socket.on('pickup_item', ({ id }) => {
    if (!socket.roomCode) return;
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const item = room.items.get(id);
    if (!item || !item.alive) return;
    item.alive = false;
    socket.to(socket.roomCode).emit('item_removed', { id });
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    console.log(`- ${socket.id}`);
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent_left');
      rooms.delete(socket.roomCode);
      console.log(`Room ${socket.roomCode} closed`);
    }
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log(`  │  Shooter Game Server  →  http://localhost:${PORT}  │`);
  console.log('  └──────────────────────────────────────────────┘');
  console.log('');
  console.log('  Share your IP address so friends can connect.');
  console.log('  Press Ctrl+C to stop the server.');
  console.log('');
});
