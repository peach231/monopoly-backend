const BOARD_TILES = [
  { id: 0, name: "START", type: "corner", action: "go" },
  { id: 1, name: "Rio de Janeiro", type: "property", price: 60, colorGroup: "brown", rent: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgageValue: 30 },
  { id: 2, name: "Treasure", type: "chest" },
  { id: 3, name: "Sao Paulo", type: "property", price: 60, colorGroup: "brown", rent: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgageValue: 30 },
  { id: 4, name: "Earnings Tax", type: "tax", amount: 200 },
  { id: 5, name: "YYZ Airport", type: "airport", price: 200, colorGroup: "airport", mortgageValue: 100 },
  { id: 6, name: "Montreal", type: "property", price: 100, colorGroup: "lightblue", rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { id: 7, name: "Surprise", type: "chance" },
  { id: 8, name: "Vancouver", type: "property", price: 100, colorGroup: "lightblue", rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { id: 9, name: "Toronto", type: "property", price: 120, colorGroup: "lightblue", rent: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgageValue: 60 },
  { id: 10, name: "Prison", type: "corner", action: "jail" },
  { id: 11, name: "Venice", type: "property", price: 140, colorGroup: "pink", rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { id: 12, name: "Electric Company", type: "utility", price: 150, mortgageValue: 75 },
  { id: 13, name: "Milan", type: "property", price: 140, colorGroup: "pink", rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { id: 14, name: "Rome", type: "property", price: 160, colorGroup: "pink", rent: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgageValue: 80 },
  { id: 15, name: "CDG Airport", type: "airport", price: 200, colorGroup: "airport", mortgageValue: 100 },
  { id: 16, name: "Nice", type: "property", price: 180, colorGroup: "orange", rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { id: 17, name: "Treasure", type: "chest" },
  { id: 18, name: "Lyon", type: "property", price: 180, colorGroup: "orange", rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { id: 19, name: "Paris", type: "property", price: 200, colorGroup: "orange", rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgageValue: 100 },
  { id: 20, name: "Vacation", type: "corner", action: "parking" },
  { id: 21, name: "Manchester", type: "property", price: 220, colorGroup: "red", rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { id: 22, name: "Surprise", type: "chance" },
  { id: 23, name: "Birmingham", type: "property", price: 220, colorGroup: "red", rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { id: 24, name: "London", type: "property", price: 240, colorGroup: "red", rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgageValue: 120 },
  { id: 25, name: "HND Airport", type: "airport", price: 200, colorGroup: "airport", mortgageValue: 100 },
  { id: 26, name: "Kyoto", type: "property", price: 260, colorGroup: "yellow", rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { id: 27, name: "Osaka", type: "property", price: 260, colorGroup: "yellow", rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { id: 28, name: "Water Company", type: "utility", price: 150, mortgageValue: 75 },
  { id: 29, name: "Tokyo", type: "property", price: 280, colorGroup: "yellow", rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgageValue: 140 },
  { id: 30, name: "Go to Prison", type: "corner", action: "goToJail" },
  { id: 31, name: "Chongqing", type: "property", price: 300, colorGroup: "green", rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { id: 32, name: "Shanghai", type: "property", price: 300, colorGroup: "green", rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { id: 33, name: "Treasure", type: "chest" },
  { id: 34, name: "Beijing", type: "property", price: 320, colorGroup: "green", rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgageValue: 160 },
  { id: 35, name: "JFK Airport", type: "airport", price: 200, colorGroup: "airport", mortgageValue: 100 },
  { id: 36, name: "Surprise", type: "chance" },
  { id: 37, name: "Chicago", type: "property", price: 350, colorGroup: "darkblue", rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgageValue: 175 },
  { id: 38, name: "Premium Tax", type: "tax", amount: 100 },
  { id: 39, name: "New York", type: "property", price: 400, colorGroup: "darkblue", rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 }
];

const COLOR_GROUPS = {
  airport: [5, 15, 25, 35],
  brown: [1, 3],
  lightblue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkblue: [37, 39]
};

const CHANCE_CARDS = [
  { id: "c1", text: "Advance to New York", action: "move", target: 39 },
  { id: "c2", text: "Advance to START (Collect $200)", action: "move", target: 0, collect: true },
  { id: "c3", text: "Advance to London", action: "move", target: 24 },
  { id: "c4", text: "Advance to Venice", action: "move", target: 11 },
  { id: "c5", text: "Advance to nearest Airport", action: "nearest", targetType: "airport", payDouble: true },
  { id: "c6", text: "Advance to nearest Airport", action: "nearest", targetType: "airport", payDouble: true },
  { id: "c7", text: "Advance to nearest Utility", action: "nearest", targetType: "utility" },
  { id: "c8", text: "Bank pays you dividend of $50", action: "money", amount: 50 },
  { id: "c9", text: "Get Out of Jail Free", action: "jailCard" },
  { id: "c10", text: "Go Back 3 Spaces", action: "moveRelative", offset: -3 },
  { id: "c11", text: "Go to Prison", action: "goToJail" },
  { id: "c12", text: "Make general repairs: $25 per house, $100 per hotel", action: "repairs", houseCost: 25, hotelCost: 100 },
  { id: "c13", text: "Pay poor tax of $15", action: "money", amount: -15 },
  { id: "c14", text: "Take a trip to YYZ Airport", action: "move", target: 5 },
  { id: "c15", text: "Elected Chairman: Pay each player $50", action: "payEach", amount: 50 },
  { id: "c16", text: "Building loan matures: Collect $150", action: "money", amount: 150 },
  { id: "c17", text: "Flight upgrade! Collect $50", action: "money", amount: 50 },
  { id: "c18", text: "Missed your connection. Advance to nearest Airport", action: "nearest", targetType: "airport", payDouble: true },
  { id: "c19", text: "Baggage fee refund: Collect $25", action: "money", amount: 25 },
  { id: "c20", text: "First class upgrade: Collect $100", action: "money", amount: 100 },
  { id: "c21", text: "Flight delay: Pay $30 for hotel", action: "money", amount: -30 },
  { id: "c22", text: "Airport lounge access: Collect $20", action: "money", amount: 20 },
  { id: "c23", text: "Lost luggage compensation: Collect $75", action: "money", amount: 75 },
  { id: "c24", text: "Duty-free jackpot: Collect $50", action: "money", amount: 50 }
];

const COMMUNITY_CHEST_CARDS = [
  { id: "cc1", text: "Advance to START (Collect $200)", action: "move", target: 0, collect: true },
  { id: "cc2", text: "Bank error in your favor: Collect $200", action: "money", amount: 200 },
  { id: "cc3", text: "Doctor's fees: Pay $50", action: "money", amount: -50 },
  { id: "cc4", text: "From sale of stock: Collect $50", action: "money", amount: 50 },
  { id: "cc5", text: "Get Out of Jail Free", action: "jailCard" },
  { id: "cc6", text: "Go to Prison", action: "goToJail" },
  { id: "cc7", text: "Holiday fund matures: Collect $100", action: "money", amount: 100 },
  { id: "cc8", text: "Income tax refund: Collect $20", action: "money", amount: 20 },
  { id: "cc9", text: "It's your birthday: Collect $10 from each player", action: "collectEach", amount: 10 },
  { id: "cc10", text: "Life insurance matures: Collect $100", action: "money", amount: 100 },
  { id: "cc11", text: "Pay hospital fees: $100", action: "money", amount: -100 },
  { id: "cc12", text: "Pay school fees: $150", action: "money", amount: -150 },
  { id: "cc13", text: "Receive $25 consultancy fee", action: "money", amount: 25 },
  { id: "cc14", text: "Street repairs: $40 per house, $115 per hotel", action: "repairs", houseCost: 40, hotelCost: 115 },
  { id: "cc15", text: "Won beauty contest: Collect $10", action: "money", amount: 10 },
  { id: "cc16", text: "Inheritance: Collect $100", action: "money", amount: 100 },
  { id: "cc17", text: "Airport parking refund: Collect $15", action: "money", amount: 15 },
  { id: "cc18", text: "Duty free shopping spree: Pay $40", action: "money", amount: -40 },
  { id: "cc19", text: "Mileage points redeemed: Collect $100", action: "money", amount: 100 },
  { id: "cc20", text: "Airport meal voucher: Collect $25", action: "money", amount: 25 },
  { id: "cc21", text: "Extra baggage fee: Pay $35", action: "money", amount: -35 },
  { id: "cc22", text: "Flight voucher: Collect $50", action: "money", amount: 50 },
  { id: "cc23", text: "Airport shuttle missed: Go back 3 spaces", action: "moveRelative", offset: -3 },
  { id: "cc24", text: "VIP lounge pass: Collect $30", action: "money", amount: 30 }
];

const TOKENS = ["backpack", "textbooks", "graduation-hat", "pencil", "compass", "suitcase"];
const STARTING_MONEY = 1500;
const SALARY = 200;
const JAIL_FINE = 50;
const MAX_PLAYERS = 6;
const MAX_HOUSES = 32;
const MAX_HOTELS = 12;

module.exports = {
  BOARD_TILES,
  COLOR_GROUPS,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  TOKENS,
  STARTING_MONEY,
  SALARY,
  JAIL_FINE,
  MAX_PLAYERS,
  MAX_HOUSES,
  MAX_HOTELS
};
