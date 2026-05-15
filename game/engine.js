const { v4: uuidv4 } = require('uuid');

// ============================================
// CHAT FILTER (inlined — no external dependency)
// ============================================
const BAD_WORDS = [
  'nigger', 'nigga', 'chink', 'gook', 'spic', 'wetback', 'kike', 'dyke',
  'faggot', 'fag', 'retard', 'retarded',
  'rape', 'rapist', 'molest', 'pedo', 'pedophile',
  'fuck', 'fucking', 'fucked', 'fucker', 'shit', 'shitting', 'shitted',
  'bitch', 'bitching', 'bastard', 'damnit', 'cunt', 'cock', 'dick',
  'pussy', 'asshole', 'whore', 'slut', 'cum', 'jizz',
  'fuk', 'fck', 'sh1t', 'b1tch', 'd1ck', 'c0ck', 'n1gger', 'n1gga',
  'fuking', 'fcking', 'fuker', 'fcker',
];

const _escapedWords = BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const FILTER_REGEX = new RegExp('\\b(' + _escapedWords.join('|') + ')\\b', 'gi');

function censorMessage(text) {
  if (!text || typeof text !== 'string') return { censored: text || '', wasFiltered: false };
  let wasFiltered = false;
  const censored = text.replace(FILTER_REGEX, (match) => {
    wasFiltered = true;
    return '*'.repeat(match.length);
  });
  return { censored, wasFiltered };
}

const {
  BOARD_TILES, COLOR_GROUPS, CHANCE_CARDS, COMMUNITY_CHEST_CARDS,
  TOKENS, STARTING_MONEY, SALARY, JAIL_FINE, MAX_PLAYERS, MAX_HOUSES, MAX_HOTELS
} = require('./data');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createGame(roomCode, hostName) {
  const hostId = uuidv4();
  const game = {
    roomCode,
    status: 'waiting',
    players: [{
      id: hostId,
      name: hostName || 'Player 1',
      token: TOKENS[0],
      socketId: null,
      money: STARTING_MONEY,
      position: 0,
      properties: [],
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      isBankrupt: false,
      isConnected: false,
      color: '#e74c3c',
      autoMortgage: false,
      inDebt: false,
      debtAmount: 0
    }],
    properties: BOARD_TILES.map(t => ({
      id: t.id,
      ownerId: null,
      houses: 0,
      hotel: false,
      isMortgaged: false
    })),
    currentPlayerIndex: 0,
    dice: [1, 1],
    doublesCount: 0,
    turnPhase: 'waiting',
    pendingCard: null,
    auction: null,
    pendingTrade: null,
    freeParkingMoney: 0,
    chanceDeck: shuffle(CHANCE_CARDS.map(c => c.id)),
    communityChestDeck: shuffle(COMMUNITY_CHEST_CARDS.map(c => c.id)),
    chanceDiscard: [],
    communityChestDiscard: [],
    turnSequence: 0,
    extraRoll: false,
    log: [`Room ${roomCode} created. Waiting for players...`],
    chatMessages: []
  };
  return { game, hostId };
}

function joinGame(game, playerName) {
  if (game.status !== 'waiting') return { success: false, message: 'Game already started' };
  if (game.players.length >= MAX_PLAYERS) return { success: false, message: 'Room full' };

  const takenTokens = game.players.map(p => p.token);
  const token = TOKENS.find(t => !takenTokens.includes(t));
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

  const player = {
    id: uuidv4(),
    name: playerName || `Player ${game.players.length + 1}`,
    token,
    socketId: null,
    money: STARTING_MONEY,
    position: 0,
    properties: [],
    inJail: false,
    jailTurns: 0,
    jailCards: 0,
    isBankrupt: false,
    isConnected: false,
    color: colors[game.players.length],
    autoMortgage: false,
    inDebt: false,
    debtAmount: 0
  };
  game.players.push(player);
  game.log.push(`${player.name} joined the game.`);
  return { success: true, playerId: player.id };
}

function rejoinGame(game, playerId, socketId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { success: false, message: 'Player not found' };
  player.socketId = socketId;
  player.isConnected = true;
  game.log.push(`${player.name} reconnected.`);
  return { success: true };
}

function disconnectPlayer(game, socketId) {
  const player = game.players.find(p => p.socketId === socketId);
  if (!player) return;
  player.isConnected = false;
  game.log.push(`${player.name} disconnected.`);
}

function startGame(game) {
  if (game.players.length < 2) return { success: false, message: 'Need at least 2 players' };
  game.status = 'playing';
  game.turnPhase = 'roll';
  game.currentPlayerIndex = 0;
  game.log.push('Game started!');
  return { success: true };
}

function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

function nextPlayer(game) {
  let attempts = 0;
  do {
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    attempts++;
  } while (getCurrentPlayer(game).isBankrupt && attempts < game.players.length);
  game.doublesCount = 0;
  game.extraRoll = false;
  game.turnPhase = 'roll';
  game.turnSequence++;
  const p = getCurrentPlayer(game);
  game.log.push(`It's ${p.name}'s turn.`);
}

function rollDice() {
  return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}

function movePlayer(game, playerId, newPos, collectSalary = true) {
  const player = game.players.find(p => p.id === playerId);
  const oldPos = player.position;
  player.position = newPos;
  if (collectSalary && newPos < oldPos && oldPos !== 30) {
    player.money += SALARY;
    game.log.push(`${player.name} passed Go and collected $${SALARY}`);
  }
}

function calculateRent(game, propertyId, diceSum = 0) {
  const tile = BOARD_TILES[propertyId];
  const prop = game.properties[propertyId];
  if (!prop.ownerId || prop.isMortgaged) return 0;

  const owner = game.players.find(p => p.id === prop.ownerId);
  if (tile.type === 'property') {
    if (prop.hotel) return tile.rent[5];
    if (prop.houses > 0) return tile.rent[prop.houses];
    const group = COLOR_GROUPS[tile.colorGroup];
    const ownsAll = group.every(id => game.properties[id].ownerId === prop.ownerId);
    return ownsAll ? tile.rent[0] * 2 : tile.rent[0];
  }
  if (tile.type === 'airport') {
    const airports = [5, 15, 25, 35].filter(id => game.properties[id].ownerId === prop.ownerId);
    return 25 * Math.pow(2, airports.length - 1);
  }
  if (tile.type === 'utility') {
    const utilities = [12, 28].filter(id => game.properties[id].ownerId === prop.ownerId);
    return utilities.length === 2 ? diceSum * 10 : diceSum * 4;
  }
  return 0;
}

function ownsMonopoly(game, playerId, colorGroup) {
  const group = COLOR_GROUPS[colorGroup];
  return group.every(id => game.properties[id].ownerId === playerId);
}

function drawCard(game, deckType) {
  let deck, discard, cards;
  if (deckType === 'chance') {
    deck = game.chanceDeck;
    discard = game.chanceDiscard;
    cards = CHANCE_CARDS;
  } else {
    deck = game.communityChestDeck;
    discard = game.communityChestDiscard;
    cards = COMMUNITY_CHEST_CARDS;
  }
  if (deck.length === 0) {
    deck.push(...shuffle(discard));
    discard.length = 0;
  }
  const cardId = deck.shift();
  discard.push(cardId);
  return cards.find(c => c.id === cardId);
}

function executeCard(game, playerId, card) {
  const player = game.players.find(p => p.id === playerId);
  let result = { text: card.text, action: card.action };

  switch (card.action) {
    case 'move':
      movePlayer(game, playerId, card.target, card.collect !== false);
      result.landedOn = player.position;
      break;
    case 'moveRelative':
      const newPos = (player.position + card.offset + 40) % 40;
      movePlayer(game, playerId, newPos, false);
      result.landedOn = newPos;
      break;
    case 'nearest': {
      const targets = BOARD_TILES
        .filter(t => t.type === card.targetType)
        .map(t => t.id)
        .sort((a, b) => a - b);
      let target = targets.find(t => t > player.position);
      if (!target) target = targets[0];
      movePlayer(game, playerId, target, true);
      result.landedOn = target;
      result.payDouble = card.payDouble || false;
      break;
    }
    case 'money':
      player.money += card.amount;
      if (card.amount > 0) {
        game.log.push(`${player.name} collected $${card.amount} from card.`);
      } else {
        game.log.push(`${player.name} paid $${Math.abs(card.amount)} from card.`);
        game.freeParkingMoney += Math.abs(card.amount);
      }
      break;
    case 'payEach':
      game.players.forEach(p => {
        if (p.id !== playerId && !p.isBankrupt) {
          p.money += card.amount;
          player.money -= card.amount;
        }
      });
      game.log.push(`${player.name} paid $${card.amount} to each player.`);
      break;
    case 'collectEach':
      game.players.forEach(p => {
        if (p.id !== playerId && !p.isBankrupt) {
          p.money -= card.amount;
          player.money += card.amount;
        }
      });
      game.log.push(`${player.name} collected $${card.amount} from each player.`);
      break;
    case 'jailCard':
      player.jailCards++;
      game.log.push(`${player.name} received a Get Out of Jail Free card.`);
      break;
    case 'goToJail':
      player.position = 10;
      player.inJail = true;
      player.jailTurns = 0;
      game.log.push(`${player.name} was sent to Jail!`);
      break;
    case 'repairs': {
      let cost = 0;
      game.properties.forEach(prop => {
        if (prop.ownerId === playerId) {
          if (prop.hotel) cost += card.hotelCost;
          else cost += prop.houses * card.houseCost;
        }
      });
      player.money -= cost;
      game.log.push(`${player.name} paid $${cost} for repairs.`);
      break;
    }
  }
  return result;
}

function handleLanding(game, playerId, diceSum) {
  const player = game.players.find(p => p.id === playerId);
  const tile = BOARD_TILES[player.position];
  const prop = game.properties[player.position];

    if (tile.type === 'property' || tile.type === 'airport' || tile.type === 'utility') {
    if (prop.ownerId && prop.ownerId !== playerId && !prop.isMortgaged) {
      const rent = calculateRent(game, player.position, diceSum);
      if (rent > 0) {
        const owner = game.players.find(p => p.id === prop.ownerId);
        player.money -= rent;
        owner.money += rent;
        game.log.push(`${player.name} paid $${rent} rent to ${owner.name}.`);
        checkBankruptcy(game, playerId);
      }
    } else if (!prop.ownerId && !player.isBankrupt) {
      game.turnPhase = 'buy';
      return { action: 'offerBuy', propertyId: player.position, price: tile.price };
    }
  }

  if (tile.type === 'tax') {
    player.money -= tile.amount;
    game.freeParkingMoney += tile.amount;
    game.log.push(`${player.name} paid $${tile.amount} in taxes.`);
    checkBankruptcy(game, playerId);
  }

  if (tile.type === 'chance') {
    const card = drawCard(game, 'chance');
    game.pendingCard = { ...card, deck: 'chance' };
    return { action: 'drawCard', card: game.pendingCard };
  }

  if (tile.type === 'chest') {
    const card = drawCard(game, 'communityChest');
    game.pendingCard = { ...card, deck: 'communityChest' };
    return { action: 'drawCard', card: game.pendingCard };
  }

  if (tile.action === 'goToJail') {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    game.log.push(`${player.name} was sent to Jail!`);
    game.turnPhase = 'end';
    return { action: 'jail' };
  }

  if (tile.action === 'parking') {
    if (game.freeParkingMoney > 0) {
      player.money += game.freeParkingMoney;
      game.log.push(`${player.name} collected $${game.freeParkingMoney} from Free Vacation!`);
      game.freeParkingMoney = 0;
    }
  }

  if (game.turnPhase !== 'buy') game.turnPhase = 'end';
  return { action: 'landed' };
}

// Total liquidation value if player sold/mortgaged everything.
// Used to determine if a player is mathematically able to recover from debt.
function calculateTotalAssets(game, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return 0;
  let assets = player.money; // can be negative
  game.properties.forEach(prop => {
    if (prop.ownerId !== playerId) return;
    const tile = BOARD_TILES[prop.id];
    if (!prop.isMortgaged) {
      assets += tile.mortgageValue || 0;
    }
    // Houses & hotels sell at half cost
    if (tile.houseCost) {
      if (prop.hotel) {
        // Hotel = 4 houses + 1 hotel piece, sells for 5 * houseCost/2
        assets += 5 * (tile.houseCost / 2);
      } else if (prop.houses > 0) {
        assets += prop.houses * (tile.houseCost / 2);
      }
    }
  });
  return assets;
}

function autoMortgageAll(game, playerId) {
  const player = game.players.find(p => p.id === playerId);
  // First sell all houses/hotels, then mortgage unmortgaged props.
  // We try to recover to >= 0; we always liquidate everything possible if needed.
  const playerOwnedProps = game.properties.filter(p => p.ownerId === playerId);

  // Sell houses/hotels first (highest-rent properties last would be ideal,
  // but for simplicity we go in order and only stop when we're back to >=0)
  for (const prop of playerOwnedProps) {
    const tile = BOARD_TILES[prop.id];
    while (prop.hotel || prop.houses > 0) {
      if (prop.hotel) {
        prop.hotel = false;
        prop.houses = 4;
        player.money += tile.houseCost / 2;
        game.log.push(`${player.name} sold hotel on ${tile.name} (auto).`);
      } else if (prop.houses > 0) {
        prop.houses--;
        player.money += tile.houseCost / 2;
        game.log.push(`${player.name} sold a house on ${tile.name} (auto).`);
      }
      if (player.money >= 0) return;
    }
  }

  // Then mortgage properties
  for (const prop of playerOwnedProps) {
    if (prop.isMortgaged || prop.houses > 0 || prop.hotel) continue;
    const tile = BOARD_TILES[prop.id];
    prop.isMortgaged = true;
    player.money += tile.mortgageValue;
    game.log.push(`${player.name} auto-mortgaged ${tile.name} for $${tile.mortgageValue}.`);
    if (player.money >= 0) return;
  }
}

function declareBankruptcy(game, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player || player.isBankrupt) return;

  player.isBankrupt = true;
  player.inDebt = false;
  player.debtAmount = 0;
  game.log.push(`${player.name} went bankrupt!`);

  game.properties.forEach(p => {
    if (p.ownerId === playerId) {
      p.ownerId = null;
      p.houses = 0;
      p.hotel = false;
      p.isMortgaged = false;
    }
  });

  const alive = game.players.filter(p => !p.isBankrupt);
  if (alive.length === 1) {
    game.status = 'ended';
    game.log.push(`${alive[0].name} wins the game!`);
  }
}

// Returns true if player became bankrupt or had debt resolved/applied.
function checkBankruptcy(game, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player || player.isBankrupt) return false;
  if (player.money >= 0) {
    // No longer in debt
    if (player.inDebt) {
      player.inDebt = false;
      player.debtAmount = 0;
      game.log.push(`${player.name} is no longer in debt.`);
    }
    return false;
  }

  // Player is in the red. Check if they can mathematically recover at all.
  const totalAssets = calculateTotalAssets(game, playerId);
  if (totalAssets < 0) {
    // Mathematically impossible to recover - auto-bankrupt regardless of autoMortgage setting
    game.log.push(`${player.name} cannot cover debts even by selling everything.`);
    declareBankruptcy(game, playerId);
    return true;
  }

  if (player.autoMortgage) {
    // Auto-mortgage / auto-sell their way back to >= 0
    autoMortgageAll(game, playerId);
    if (player.money < 0) {
      // Couldn't recover even with auto-liquidation - bankrupt
      declareBankruptcy(game, playerId);
      return true;
    }
    if (player.inDebt) {
      player.inDebt = false;
      player.debtAmount = 0;
    }
    return false;
  }

  // Manual mode: put player into debt state. They can't roll until they recover.
  player.inDebt = true;
  player.debtAmount = -player.money;
  game.log.push(`${player.name} owes $${player.debtAmount}. They must trade, mortgage, or sell to recover.`);
  return false;
}

// Called after any action that changes player money (mortgage, sell, trade, etc).
// If they were in debt and now recovered, clear the flag. If still in debt but
// no longer mathematically recoverable, auto-bankrupt.
function reevaluateDebt(game, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player || player.isBankrupt) return;
  if (!player.inDebt && player.money >= 0) return;

  if (player.money >= 0) {
    if (player.inDebt) {
      player.inDebt = false;
      player.debtAmount = 0;
      game.log.push(`${player.name} is no longer in debt.`);
    }
    return;
  }

  // Still in red
  player.inDebt = true;
  player.debtAmount = -player.money;

  const totalAssets = calculateTotalAssets(game, playerId);
  if (totalAssets < 0) {
    game.log.push(`${player.name} cannot cover debts even by selling everything.`);
    declareBankruptcy(game, playerId);
  }
}

function setAutoMortgage(game, playerId, enabled) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { success: false, message: 'Player not found' };
  player.autoMortgage = !!enabled;
  game.log.push(`${player.name} ${enabled ? 'enabled' : 'disabled'} auto-mortgage.`);

  // If they enable auto-mortgage while currently in debt, immediately try to resolve.
  if (enabled && player.inDebt && !player.isBankrupt) {
    autoMortgageAll(game, playerId);
    if (player.money < 0) {
      declareBankruptcy(game, playerId);
    } else {
      player.inDebt = false;
      player.debtAmount = 0;
    }
  }
  return { success: true };
}

function handleRoll(game, playerId) {
  if (game.status !== 'playing') return { success: false, message: 'Game not in progress' };
  if (getCurrentPlayer(game).id !== playerId) return { success: false, message: 'Not your turn' };
  if (game.turnPhase !== 'roll' && game.turnPhase !== 'jailRoll') return { success: false, message: 'Cannot roll now' };

  const player = getCurrentPlayer(game);
  if (player.inDebt) {
    return { success: false, message: `You owe $${player.debtAmount}. Trade, mortgage, or sell properties before rolling.` };
  }
  game.dice = rollDice();
  const sum = game.dice[0] + game.dice[1];
  const isDouble = game.dice[0] === game.dice[1];

  game.log.push(`${player.name} rolled ${game.dice[0]} and ${game.dice[1]}.`);

  if (player.inJail) {
    if (isDouble) {
      player.inJail = false;
      player.jailTurns = 0;
      game.log.push(`${player.name} rolled doubles and escaped Jail!`);
      movePlayer(game, playerId, (player.position + sum) % 40);
      const result = handleLanding(game, playerId, sum);
      game.extraRoll = true;
      game.doublesCount = 0;
      if (game.turnPhase !== 'buy') {
        game.turnPhase = 'roll';
      }
      return { success: true, dice: game.dice, ...result };
    } else {
      player.jailTurns++;
      if (player.jailTurns >= 3) {
        player.money -= JAIL_FINE;
        game.freeParkingMoney += JAIL_FINE;
        player.inJail = false;
        player.jailTurns = 0;
        game.log.push(`${player.name} paid $${JAIL_FINE} to leave Jail.`);
        movePlayer(game, playerId, (player.position + sum) % 40);
        const result = handleLanding(game, playerId, sum);
        return { success: true, dice: game.dice, ...result };
      }
      game.turnPhase = 'end';
      game.extraRoll = false;
      game.doublesCount = 0;
      return { success: true, dice: game.dice, action: 'jailStay' };
    }
  }

  if (isDouble) {
    game.doublesCount++;
    if (game.doublesCount >= 3) {
      player.position = 10;
      player.inJail = true;
      player.jailTurns = 0;
      game.doublesCount = 0;
      game.extraRoll = false;
      game.log.push(`${player.name} rolled 3 doubles and was sent to Jail!`);
      game.turnPhase = 'end';
      return { success: true, dice: game.dice, action: 'jail' };
    }
    game.extraRoll = true;
  } else {
    game.doublesCount = 0;
    game.extraRoll = false;
  }

  movePlayer(game, playerId, (player.position + sum) % 40);
  const result = handleLanding(game, playerId, sum);

  if (game.extraRoll && game.turnPhase !== 'buy' && !game.pendingCard && game.turnPhase !== 'auction') {
    game.turnPhase = 'roll';
  }

  return { success: true, dice: game.dice, ...result };
}

function buyProperty(game, playerId) {
  if (getCurrentPlayer(game).id !== playerId) return { success: false, message: 'Not your turn' };
  if (game.turnPhase !== 'buy') return { success: false, message: 'Cannot buy now' };

  const player = getCurrentPlayer(game);
  const tile = BOARD_TILES[player.position];
  const prop = game.properties[player.position];

  if (prop.ownerId) return { success: false, message: 'Already owned' };
  if (player.money < tile.price) return { success: false, message: 'Not enough money' };

  player.money -= tile.price;
  prop.ownerId = playerId;
  player.properties.push(player.position);
  game.log.push(`${player.name} bought ${tile.name} for $${tile.price}.`);
  game.turnPhase = game.extraRoll ? 'roll' : 'end';
  return { success: true };
}

function startAuction(game, playerId) {
  if (getCurrentPlayer(game).id !== playerId) return { success: false, message: 'Not your turn' };
  if (game.turnPhase !== 'buy') return { success: false, message: 'Cannot auction now' };

  const tile = BOARD_TILES[getCurrentPlayer(game).position];
  const activeBidders = game.players
    .filter(p => !p.isBankrupt && p.isConnected)
    .map(p => p.id);
    
  if (activeBidders.length === 0) {
    activeBidders.push(...game.players.filter(p => !p.isBankrupt && p.isConnected).map(p => p.id));
  }
  
  game.auction = {
    propertyId: getCurrentPlayer(game).position,
    bids: [],
    highestBid: 0,
    highestBidder: null,
    activeBidders: activeBidders,
    startedAt: Date.now(),
    endTime: Date.now() + 10000
  };
  game.turnPhase = 'auction';
  game.log.push(`Auction started for ${tile.name}!`);
  return { success: true };
}

function placeBid(game, playerId, amount) {
  if (game.turnPhase !== 'auction') return { success: false, message: 'No active auction' };
  if (!game.auction.activeBidders.includes(playerId)) return { success: false, message: 'Cannot bid' };

  const player = game.players.find(p => p.id === playerId);
  if (amount > player.money) return { success: false, message: 'Not enough money' };
  if (amount <= game.auction.highestBid) return { success: false, message: 'Bid too low' };

  game.auction.bids.push({ playerId, amount });
  game.auction.highestBid = amount;
  game.auction.highestBidder = playerId;
  game.auction.endTime = Date.now() + 5000;
  game.log.push(`${player.name} bid $${amount}.`);
  return { success: true };
}

function endAuction(game, playerId) {
  if (game.turnPhase !== 'auction') return { success: false, message: 'No active auction' };

  const auction = game.auction;
  const tile = BOARD_TILES[auction.propertyId];

  if (auction.highestBidder) {
    const winner = game.players.find(p => p.id === auction.highestBidder);
    if (winner.money >= auction.highestBid) {
      winner.money -= auction.highestBid;
      const prop = game.properties[auction.propertyId];
      prop.ownerId = auction.highestBidder;
      winner.properties.push(auction.propertyId);
      game.log.push(`${winner.name} won ${tile.name} for $${auction.highestBid}!`);
    } else {
      game.log.push(`${winner.name} couldn't afford $${auction.highestBid}. Property remains unsold.`);
    }
  } else {
    game.log.push(`No bids for ${tile.name}. Property remains unsold.`);
  }

  game.auction = null;
  game.turnPhase = game.extraRoll ? 'roll' : 'end';
  return { success: true };
}

function payJailFine(game, playerId) {
  if (getCurrentPlayer(game).id !== playerId) return { success: false, message: 'Not your turn' };
  const player = getCurrentPlayer(game);
  if (!player.inJail) return { success: false, message: 'Not in jail' };
  if (player.money < JAIL_FINE) return { success: false, message: 'Not enough money' };

  player.money -= JAIL_FINE;
  game.freeParkingMoney += JAIL_FINE;
  player.inJail = false;
  player.jailTurns = 0;
  game.log.push(`${player.name} paid $${JAIL_FINE} to leave Jail.`);
  return { success: true };
}

function useJailCard(game, playerId) {
  if (getCurrentPlayer(game).id !== playerId) return { success: false, message: 'Not your turn' };
  const player = getCurrentPlayer(game);
  if (!player.inJail) return { success: false, message: 'Not in jail' };
  if (player.jailCards <= 0) return { success: false, message: 'No jail card' };

  player.jailCards--;
  player.inJail = false;
  player.jailTurns = 0;
  game.log.push(`${player.name} used a Get Out of Jail Free card.`);
  return { success: true };
}

function resolveCard(game, playerId) {
  if (!game.pendingCard) return { success: false, message: 'No pending card' };
  const player = getCurrentPlayer(game);
  const card = game.pendingCard;
  game.pendingCard = null;

  const result = executeCard(game, player.id, card);

  if (['move', 'moveRelative', 'nearest'].includes(card.action)) {
    const landing = handleLanding(game, player.id, game.dice[0] + game.dice[1]);
    return { success: true, result, landing };
  }

  if (game.turnPhase !== 'buy') {
    game.turnPhase = game.extraRoll ? 'roll' : 'end';
  }
  return { success: true, result };
}

function buildHouse(game, playerId, propertyId) {
  const player = game.players.find(p => p.id === playerId);
  const prop = game.properties[propertyId];
  const tile = BOARD_TILES[propertyId];

  if (prop.ownerId !== playerId) return { success: false, message: 'Not your property' };
  if (!ownsMonopoly(game, playerId, tile.colorGroup)) return { success: false, message: 'Need monopoly' };
  if (prop.hotel) return { success: false, message: 'Already has hotel' };
  if (prop.isMortgaged) return { success: false, message: 'Property mortgaged' };

  const group = COLOR_GROUPS[tile.colorGroup];

  // BUGFIX: a hotel represents level 5 (4 houses + 1 hotel). Treating it as
  // houses=0 caused minLevel to drop to 0 once one property got a hotel,
  // making "build evenly" reject upgrades on the rest of the color group.
  const buildingLevel = (p) => p.hotel ? 5 : p.houses;
  const minLevel = Math.min(...group.map(id => buildingLevel(game.properties[id])));
  const myLevel = buildingLevel(prop);
  if (myLevel > minLevel) return { success: false, message: 'Build evenly' };

  // Also: any property mortgaged in the group blocks building (standard rule).
  const anyMortgaged = group.some(id => game.properties[id].isMortgaged);
  if (anyMortgaged) return { success: false, message: 'Unmortgage all properties in this group first' };

  const totalHouses = game.properties.reduce((sum, p) => sum + p.houses, 0);
  const totalHotels = game.properties.reduce((sum, p) => sum + (p.hotel ? 1 : 0), 0);

  if (prop.houses < 4) {
    if (totalHouses >= MAX_HOUSES) return { success: false, message: 'No houses left in bank' };
    if (player.money < tile.houseCost) return { success: false, message: 'Not enough money' };
    player.money -= tile.houseCost;
    prop.houses++;
    game.log.push(`${player.name} built a house on ${tile.name}.`);
  } else {
    if (totalHotels >= MAX_HOTELS) return { success: false, message: 'No hotels left in bank' };
    if (player.money < tile.houseCost) return { success: false, message: 'Not enough money' };
    player.money -= tile.houseCost;
    prop.houses = 0;
    prop.hotel = true;
    game.log.push(`${player.name} built a hotel on ${tile.name}!`);
  }
  return { success: true };
}

function sellHouse(game, playerId, propertyId) {
  const player = game.players.find(p => p.id === playerId);
  const prop = game.properties[propertyId];
  const tile = BOARD_TILES[propertyId];

  if (prop.ownerId !== playerId) return { success: false, message: 'Not your property' };

  // For even-sell check, treat a hotel as 5 "levels" so a hotel doesn't break
  // the rule when an adjacent property has 4 houses.
  const buildingLevel = (p) => p.hotel ? 5 : p.houses;

  if (prop.hotel) {
    // No "sell evenly" restriction needed here: a hotel is the max level (5),
    // selling it brings the property down to 4 houses, which is always >= every
    // other property in the group (since 4 is the max non-hotel level).
    prop.hotel = false;
    prop.houses = 4;
    player.money += tile.houseCost / 2;
    game.log.push(`${player.name} sold hotel on ${tile.name}.`);
  } else if (prop.houses > 0) {
    const group = COLOR_GROUPS[tile.colorGroup];
    const maxLevel = Math.max(...group.map(id => buildingLevel(game.properties[id])));
    if (prop.houses < maxLevel) return { success: false, message: 'Sell evenly' };

    prop.houses--;
    player.money += tile.houseCost / 2;
    game.log.push(`${player.name} sold a house on ${tile.name}.`);
  } else {
    return { success: false, message: 'No houses to sell' };
  }
  reevaluateDebt(game, playerId);
  return { success: true };
}

function mortgageProperty(game, playerId, propertyId) {
  const player = game.players.find(p => p.id === playerId);
  const prop = game.properties[propertyId];
  const tile = BOARD_TILES[propertyId];

  if (prop.ownerId !== playerId) return { success: false, message: 'Not your property' };
  if (prop.isMortgaged) return { success: false, message: 'Already mortgaged' };
  if (prop.houses > 0 || prop.hotel) return { success: false, message: 'Sell houses first' };

  prop.isMortgaged = true;
  player.money += tile.mortgageValue;
  game.log.push(`${player.name} mortgaged ${tile.name} for $${tile.mortgageValue}.`);
  reevaluateDebt(game, playerId);
  return { success: true };
}

function unmortgageProperty(game, playerId, propertyId) {
  const player = game.players.find(p => p.id === playerId);
  const prop = game.properties[propertyId];
  const tile = BOARD_TILES[propertyId];

  if (prop.ownerId !== playerId) return { success: false, message: 'Not your property' };
  if (!prop.isMortgaged) return { success: false, message: 'Not mortgaged' };

  const cost = Math.ceil(tile.mortgageValue * 1.1);
  if (player.money < cost) return { success: false, message: 'Not enough money' };

  player.money -= cost;
  prop.isMortgaged = false;
  game.log.push(`${player.name} unmortgaged ${tile.name} for $${cost}.`);
  return { success: true };
}

function proposeTrade(game, fromId, toId, offerProps, offerMoney, requestProps, requestMoney) {
  if (game.turnPhase === 'auction') return { success: false, message: 'Cannot trade during auction' };
  if (game.pendingTrade) return { success: false, message: 'Another trade is pending' };
  
  const from = game.players.find(p => p.id === fromId);
  const to = game.players.find(p => p.id === toId);
  if (!from || !to || from.isBankrupt || to.isBankrupt) return { success: false, message: 'Invalid players' };
  if (from.money < offerMoney) return { success: false, message: 'Not enough money' };
  if (to.money < requestMoney) return { success: false, message: 'Recipient does not have enough money' };

  for (const pid of offerProps) {
    const prop = game.properties[pid];
    if (!prop || prop.ownerId !== fromId) return { success: false, message: 'You do not own a property' };
  }
  
  for (const pid of requestProps) {
    const prop = game.properties[pid];
    if (!prop || prop.ownerId !== toId) return { success: false, message: 'They do not own a property' };
  }

  if (offerProps.length === 0 && requestProps.length === 0 && offerMoney === 0 && requestMoney === 0) {
    return { success: false, message: 'Trade must include at least one item' };
  }

  const mortgagedCount = [...offerProps, ...requestProps].filter(pid => game.properties[pid].isMortgaged).length;
  
  game.pendingTrade = {
    fromId, toId, offerProps, offerMoney, requestProps, requestMoney,
    fromName: from.name, toName: to.name
  };
  game.log.push(`${from.name} proposed a trade to ${to.name}.${mortgagedCount > 0 ? ` (${mortgagedCount} mortgaged)` : ''}`);
  return { success: true };
}

function respondTrade(game, playerId, accept) {
  if (!game.pendingTrade) return { success: false, message: 'No pending trade' };
  if (game.pendingTrade.toId !== playerId) return { success: false, message: 'Not your trade' };

  if (!accept) {
    game.log.push(`${game.pendingTrade.toName} rejected the trade.`);
    game.pendingTrade = null;
    return { success: true, accepted: false };
  }

  const { fromId, toId, offerProps, offerMoney, requestProps, requestMoney } = game.pendingTrade;
  const from = game.players.find(p => p.id === fromId);
  const to = game.players.find(p => p.id === toId);

  if (from.money < offerMoney || to.money < requestMoney) {
    game.pendingTrade = null;
    return { success: false, message: 'Insufficient funds' };
  }

  from.money -= offerMoney;
  to.money += offerMoney;
  to.money -= requestMoney;
  from.money += requestMoney;

  const transferProperty = (propId, newOwnerId, oldOwner, newOwner) => {
    const prop = game.properties[propId];
    prop.ownerId = newOwnerId;
    const oldIdx = oldOwner.properties.indexOf(propId);
    if (oldIdx > -1) oldOwner.properties.splice(oldIdx, 1);
    if (!newOwner.properties.includes(propId)) newOwner.properties.push(propId);
  };

  offerProps.forEach(pid => transferProperty(pid, toId, from, to));
  requestProps.forEach(pid => transferProperty(pid, fromId, to, from));

  const transferredMortgaged = [...offerProps, ...requestProps].filter(pid => game.properties[pid].isMortgaged);
  game.log.push(`${from.name} and ${to.name} completed a trade.${transferredMortgaged.length > 0 ? ` ${transferredMortgaged.length} mortgaged property(ies) transferred.` : ''}`);
  game.pendingTrade = null;
  // A trade can rescue a player out of debt or push the other into it
  reevaluateDebt(game, fromId);
  reevaluateDebt(game, toId);
  return { success: true, accepted: true };
}

function endTurn(game, playerId) {
  if (getCurrentPlayer(game).id !== playerId) return { success: false, message: 'Not your turn' };
  if (game.turnPhase === 'auction') return { success: false, message: 'End auction first' };
  if (game.turnPhase === 'buy') return { success: false, message: 'Buy or auction first' };
  if (game.pendingCard) return { success: false, message: 'Resolve card first' };

  const player = getCurrentPlayer(game);
  if (player.inDebt) {
    return { success: false, message: `You owe $${player.debtAmount}. Trade, mortgage, or sell to recover.` };
  }

  nextPlayer(game);
  return { success: true };
}

function forceEndTurn(game, requesterId) {
  const requester = game.players.find(p => p.id === requesterId);
  if (!requester || requester.isBankrupt) return { success: false, message: 'Invalid requester' };
  
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (!currentPlayer) return { success: false, message: 'No current player' };
  
  if (currentPlayer.isConnected) {
    return { success: false, message: 'Current player is still connected' };
  }
  
  game.log.push(`${requester.name} ended ${currentPlayer.name}'s turn (disconnected).`);
  nextPlayer(game);
  return { success: true };
}

function getSanitizedState(game, requesterId = null) {
  return {
    roomCode: game.roomCode,
    status: game.status,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      token: p.token,
      money: p.money,
      position: p.position,
      propertyCount: p.properties.length,
      inJail: p.inJail,
      jailCards: p.jailCards,
      isBankrupt: p.isBankrupt,
      isConnected: p.isConnected,
      color: p.color,
      autoMortgage: !!p.autoMortgage,
      inDebt: !!p.inDebt,
      debtAmount: p.debtAmount || 0,
      isCurrent: game.players[game.currentPlayerIndex]?.id === p.id
    })),
    properties: game.properties,
    currentPlayerId: game.players[game.currentPlayerIndex]?.id || null,
    dice: game.dice,
    turnPhase: game.turnPhase,
    pendingCard: game.pendingCard,
    auction: game.auction ? {
      propertyId: game.auction.propertyId,
      highestBid: game.auction.highestBid,
      highestBidder: game.auction.highestBidder,
      activeBidders: game.auction.activeBidders,
      endTime: game.auction.endTime
    } : null,
    pendingTrade: game.pendingTrade ? {
      ...game.pendingTrade,
      isForMe: game.pendingTrade.toId === requesterId
    } : null,
    freeParkingMoney: game.freeParkingMoney,
    log: game.log.slice(-20),
    chatMessages: game.chatMessages.slice(-50),
    turnSequence: game.turnSequence,
    extraRoll: game.extraRoll
  };
}


function sendChatMessage(game, playerId, text) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { success: false, message: 'Player not found' };
  if (!text || !text.trim()) return { success: false, message: 'Empty message' };

  const trimmed = text.trim();
  if (trimmed.length > 200) return { success: false, message: 'Message too long' };

  // Server-side censor (backup — client already filtered, but can't be bypassed)
  const { censored } = censorMessage(trimmed);

  const message = {
    id: uuidv4(),
    playerId: player.id,
    playerName: player.name,
    text: censored,
    timestamp: Date.now(),
    type: 'chat'
  };

  game.chatMessages.push(message);
  // Keep only last 100 messages
  if (game.chatMessages.length > 100) {
    game.chatMessages = game.chatMessages.slice(-100);
  }

  return { success: true, message };
}

module.exports = {
  createGame, joinGame, rejoinGame, disconnectPlayer, startGame,
  handleRoll, buyProperty, startAuction, placeBid, endAuction,
  payJailFine, useJailCard, resolveCard,
  buildHouse, sellHouse, mortgageProperty, unmortgageProperty,
  proposeTrade, respondTrade, endTurn, forceEndTurn,
  sendChatMessage, setAutoMortgage,
  getSanitizedState, getCurrentPlayer, calculateRent, ownsMonopoly
};
