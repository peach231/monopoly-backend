const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const {
  createGame, joinGame, rejoinGame, disconnectPlayer, startGame,
  handleRoll, buyProperty, startAuction, placeBid, endAuction,
  payJailFine, useJailCard, resolveCard,
  buildHouse, sellHouse, mortgageProperty, unmortgageProperty,
  proposeTrade, respondTrade, endTurn, forceEndTurn,
  getSanitizedState
} = require('./game/engine');

const app = express();
const server = http.createServer(app);

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
  pingTimeout: 30000,
  pingInterval: 15000,
  connectTimeout: 20000,
  transports: ['websocket', 'polling'],
  allowUpgrades: true
});

const games = new Map();
const socketToRoom = new Map();
const socketToPlayer = new Map();
const disconnectTimers = new Map();

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
      try {
        const state = getSanitizedState(game, p.id);
        io.to(p.socketId).emit('gameState', state);
      } catch (err) {
        console.error('Broadcast error to', p.socketId, err.message);
      }
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

function clearDisconnectTimer(roomCode) {
  if (disconnectTimers.has(roomCode)) {
    clearTimeout(disconnectTimers.get(roomCode));
    disconnectTimers.delete(roomCode);
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('clientPing', () => {
    socket.emit('clientPong');
  });

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
      console.error('createRoom error:', err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('joinRoom', ({ roomCode, playerName, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) {
        callback({ success: false, message: 'Room not found or expired' });
        return;
      }

      // CASE 1: Reconnecting with existing playerId
      if (playerId) {
        const existing = game.players.find(p => p.id === playerId);
        if (existing) {
          existing.socketId = socket.id;
          existing.isConnected = true;
          clearDisconnectTimer(roomCode);
          socket.join(roomCode);
          socketToRoom.set(socket.id, roomCode);
          socketToPlayer.set(socket.id, { roomCode, playerId });
          game.log.push(`${existing.name} reconnected.`);
          callback({ success: true, roomCode, playerId, reconnected: true });
          safeBroadcast(roomCode);
          return;
        }
      }

      // CASE 2: New player joining
      if (game.status !== 'waiting') {
        callback({ success: false, message: 'Game already started' });
        return;
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
      console.error('joinRoom error:', err);
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
      console.error('startGame error:', err);
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
      console.error('rollDice error:', err);
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
      console.error('buyProperty error:', err);
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
      console.error('startAuction error:', err);
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
      console.error('placeBid error:', err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('endAuction', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      if (game.auction && Date.now() < game.auction.endTime) {
        return callback({ success: false, message: 'Auction still active' });
      }
      const result = endAuction(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error('endAuction error:', err);
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
      console.error('payJailFine error:', err);
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
      console.error('useJailCard error:', err);
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
      console.error('resolveCard error:', err);
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
      console.error('buildHouse error:', err);
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
      console.error('sellHouse error:', err);
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
      console.error('mortgageProperty error:', err);
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
      console.error('unmortgageProperty error:', err);
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
      console.error('proposeTrade error:', err);
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
      console.error('respondTrade error:', err);
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
      console.error('endTurn error:', err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('forceEndTurn', ({ roomCode, playerId }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) return callback({ success: false, message: 'Room not found' });
      const result = forceEndTurn(game, playerId);
      callback(result);
      if (result.success) safeBroadcast(roomCode);
    } catch (err) {
      console.error('forceEndTurn error:', err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('rejoinRoom', ({ roomCode, playerId, playerName }, callback) => {
    try {
      const game = games.get(roomCode);
      if (!game) {
        return callback({ success: false, message: 'Room not found or expired' });
      }

      const player = game.players.find(p => p.id === playerId);
      if (!player) {
        return callback({ success: false, message: 'Player not found in this room' });
      }

      player.socketId = socket.id;
      player.isConnected = true;
      clearDisconnectTimer(roomCode);
      socket.join(roomCode);
      socketToRoom.set(socket.id, roomCode);
      socketToPlayer.set(socket.id, { roomCode, playerId });
      game.log.push(`${player.name} reconnected.`);

      const state = getSanitizedState(game, playerId);
      socket.emit('gameState', state);
      safeBroadcast(roomCode);

      callback({ success: true });
    } catch (err) {
      console.error('rejoinRoom error:', err);
      callback({ success: false, message: err.message });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, reason);
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const game = games.get(mapping.roomCode);
      if (game) {
        const player = game.players.find(p => p.id === mapping.playerId);
        if (player && player.socketId === socket.id) {
          player.isConnected = false;
          game.log.push(`${player.name} disconnected.`);

          const currentPlayer = game.players[game.currentPlayerIndex];
          if (currentPlayer && player.id === currentPlayer.id && game.status === 'playing') {
            clearDisconnectTimer(mapping.roomCode);

            const timer = setTimeout(() => {
              const g = games.get(mapping.roomCode);
              if (!g) return;
              const cp = g.players[g.currentPlayerIndex];
              if (cp && !cp.isConnected) {
                const requester = g.players.find(p => p.isConnected && !p.isBankrupt && p.id !== cp.id);
                if (requester) {
                  const r = forceEndTurn(g, requester.id);
                  if (r.success) safeBroadcast(mapping.roomCode);
                }
              }
              disconnectTimers.delete(mapping.roomCode);
            }, 15000);
            disconnectTimers.set(mapping.roomCode, timer);
          }
        }

        safeBroadcast(mapping.roomCode);

        const connectedCount = game.players.filter(p => p.isConnected).length;
        if (connectedCount === 0) {
          const roomCode = mapping.roomCode;
          const cleanupKey = roomCode + '_cleanup';
          if (!disconnectTimers.has(cleanupKey)) {
            const cleanupTimer = setTimeout(() => {
              const g = games.get(roomCode);
              if (g && g.players.every(p => !p.isConnected)) {
                games.delete(roomCode);
                console.log(`Cleaned up empty room: ${roomCode}`);
              }
              disconnectTimers.delete(cleanupKey);
            }, 300000);
            disconnectTimers.set(cleanupKey, cleanupTimer);
          }
        }
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
