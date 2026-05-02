const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const {
  createGame, joinGame, rejoinGame, disconnectPlayer, startGame,
  handleRoll, buyProperty, startAuction, placeBid, endAuction,
  payJailFine, useJailCard, resolveCard,
  buildHouse, sellHouse, mortgageProperty, unmortgageProperty,
  proposeTrade, respondTrade, endTurn,
  getSanitizedState
} = require('./game/engine');

const app = express();
const server = http.createServer(app);

// CORS - reads from env var or uses defaults
const rawOrigins = process.env.ALLOWED_ORIGINS;
const ALLOWED_ORIGINS = rawOrigins
  ? rawOrigins.split(',').map(s => s.trim()).filter(Boolean)
  : [
      'http://localhost:3000',
      'https://your-vercel-app.vercel.app',
      'https://your-squarespace-site.com'
    ];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// In-memory storage
const games = new Map();
const socketToRoom = new Map();
const socketToPlayer = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return games.has(code) ? generateRoomCode() : code;
}

function broadcastGameState(roomCode) {
  const game = games.get(roomCode);
  if (!game) return;
  game.players.forEach(p => {
    if (p.socketId && p.isConnected) {
      const state = getSanitizedState(game, p.id);
      io.to(p.socketId).emit('gameState', state);
    }
  });
}

function safeBroadcast(roomCode) {
  try {
    broadcastGameState(roomCode);
  } catch (err) {
    console.error('Broadcast error:', err);
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('createRoom', ({ playerName }, callback) => {
    try {
      const roomCode = generateRoomCode();
      const { game, hostId } = createGame(roomCode, playerName);
      games.set(roomCode, game);
      const host = game.players.find(p => p.id === hostId);
      host.socketId = socket.id;
      host.isConnected = true;
      socket.join(roomCode);
      socketToRoom.set(socket.id, roomCode);
      socketToPlayer.set(socket.id, { roomCode, playerId: hostId });
      callback({ success: true, roomCode, playerId: hostId });
      safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('joinRoom', ({ roomCode, playerName, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) {
        callback({ success: false, message: 'Room not found' });
        return;
      }
      if (playerId) {
        const existing = game.players.find(p => p.id === playerId);
        if (existing) {
          const result = rejoinGame(game, playerId, socket.id);
          if (result.success) {
            socket.join(roomCode);
            socketToRoom.set(socket.id, roomCode);
            socketToPlayer.set(socket.id, { roomCode, playerId });
            callback({ success: true, roomCode, playerId, reconnected: true });
            safeBroadcast(roomCode);
            return;
          }
        }
      }
      const result = joinGame(game, playerName);
      if (!result.success) {
        callback({ success: false, message: result.message });
        return;
      }
      const player = game.players.find(p => p.id === result.playerId);
      player.socketId = socket.id;
      player.isConnected = true;
      socket.join(roomCode);
      socketToRoom.set(socket.id, roomCode);
      socketToPlayer.set(socket.id, { roomCode, playerId: result.playerId });
      callback({ success: true, roomCode, playerId: result.playerId });
      safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('startGame', ({ roomCode }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = startGame(game);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('rollDice', ({ roomCode, playerId, turnSequence }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      if (turnSequence !== undefined && turnSequence !== game.turnSequence) {
        return callback({ success: false, message: 'Stale turn' });
      }
      const result = handleRoll(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('buyProperty', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = buyProperty(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('startAuction', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = startAuction(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('placeBid', ({ roomCode, playerId, amount }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = placeBid(game, playerId, amount);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('endAuction', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = endAuction(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('payJailFine', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = payJailFine(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('useJailCard', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = useJailCard(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('resolveCard', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = resolveCard(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('buildHouse', ({ roomCode, playerId, propertyId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = buildHouse(game, playerId, propertyId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('sellHouse', ({ roomCode, playerId, propertyId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = sellHouse(game, playerId, propertyId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('mortgageProperty', ({ roomCode, playerId, propertyId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = mortgageProperty(game, playerId, propertyId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('unmortgageProperty', ({ roomCode, playerId, propertyId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = unmortgageProperty(game, playerId, propertyId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('proposeTrade', ({ roomCode, fromId, toId, offerProps, offerMoney, requestProps, requestMoney }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = proposeTrade(game, fromId, toId, offerProps, offerMoney, requestProps, requestMoney);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('respondTrade', ({ roomCode, playerId, accept }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = respondTrade(game, playerId, accept);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('endTurn', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = endTurn(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error(err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const game = games.get(mapping.roomCode);
      if (game) {
        disconnectPlayer(game, socket.id);
        safeBroadcast(mapping.roomCode);
      }
      socketToRoom.delete(socket.id);
      socketToPlayer.delete(socket.id);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: games.size });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Monopoly server running on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
