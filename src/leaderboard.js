const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const BUGS_FILE = path.join(DATA_DIR, 'bug-reports.jsonl');

let db = {
  players: {},
  matches: []
};

try {
  db = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
} catch {
  db = {
    players: {},
    matches: []
  };
}

if (!db || typeof db !== 'object') {
  db = { players: {}, matches: [] };
}

if (!db.players || typeof db.players !== 'object') {
  db.players = {};
}

if (!Array.isArray(db.matches)) {
  db.matches = [];
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const temp = LEADERBOARD_FILE + '.tmp';

  fs.writeFileSync(
    temp,
    JSON.stringify(db, null, 2),
    'utf8'
  );

  fs.renameSync(temp, LEADERBOARD_FILE);
}

function clean(value, maxLength) {
  return String(value || '')
    .replace(/[\r\n\t]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function recordMatch(room, players) {
  if (!room || room.statsSaved) return;

  const list = Array.isArray(players) ? players : [];
  const realPlayers = list.filter(player => !player.isBot);
  const hasBots = list.some(player => player.isBot);

  // Одиночные партии не учитываем.
  if (!realPlayers.length || (!hasBots && realPlayers.length < 2)) {
    room.statsSaved = true;
    return;
  }

  const type = hasBots ? 'pve' : 'pvp';
  const rows = realPlayers
    .map(player => ({
      id: clean(player.id, 100),
      name: clean(player.name, 40) || 'Player',
      capital: Math.max(
        0,
        Math.round(Number(player.netWorth) || 0)
      )
    }))
    .filter(row => row.id);

  for (const row of rows) {
    const player = db.players[row.id] || {
      name: row.name,
      testingGames: 0,
      testingBest: 0,
      testingTotal: 0,
      pvpGames: 0,
      pvpBest: 0,
      pvpTotal: 0
    };

    player.name = row.name;

    if (type === 'pve') {
      player.testingGames += 1;
      player.testingBest = Math.max(
        player.testingBest,
        row.capital
      );
      player.testingTotal += row.capital;
    } else {
      player.pvpGames += 1;
      player.pvpBest = Math.max(
        player.pvpBest,
        row.capital
      );
      player.pvpTotal += row.capital;
    }

    db.players[row.id] = player;
  }

  db.matches.push({
    roomId: String(room.id || ''),
    type,
    players: rows,
    finishedAt: new Date().toISOString()
  });

  if (db.matches.length > 10000) {
    db.matches = db.matches.slice(-10000);
  }

  save();
  room.statsSaved = true;
}

function getPvpLeaderboard(limit = 50) {
  return Object.values(db.players)
    .map(player => ({
      name: player.name,
      games: player.pvpGames || 0,
      best: player.pvpBest || 0,
      total: player.pvpTotal || 0
    }))
    .filter(player => player.games > 0)
    .sort((a, b) =>
      b.best - a.best ||
      b.total - a.total ||
      b.games - a.games
    )
    .slice(0, limit);
}

function getTestingStats(limit = 100) {
  return Object.values(db.players)
    .map(player => ({
      name: player.name,
      testingGames: player.testingGames || 0,
      testingBest: player.testingBest || 0,
      testingTotal: player.testingTotal || 0
    }))
    .filter(player => player.testingGames > 0)
    .sort((a, b) =>
      b.testingGames - a.testingGames ||
      b.testingBest - a.testingBest
    )
    .slice(0, limit);
}

function addBugReport(report) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const item = {
    id: 'bug_' + Date.now() + '_' +
      Math.random().toString(36).slice(2, 8),

    createdAt: new Date().toISOString(),

    text: String(report.text || '').slice(0, 20000),
    nickname: clean(report.nickname, 40),
    playerId: clean(report.playerId, 100),
    roomId: clean(report.roomId, 100),
    round: Number(report.round) || 0,
    language: clean(report.language, 20),
    userAgent: clean(report.userAgent, 500),
    ip: clean(report.ip, 100)
  };

  fs.appendFileSync(
    BUGS_FILE,
    JSON.stringify(item) + '\n',
    'utf8'
  );

  return item;
}

module.exports = {
  recordMatch,
  getPvpLeaderboard,
  getTestingStats,
  addBugReport
};
