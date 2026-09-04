const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const world = require('./world');
const G = require('./game');
const AG = require('./agents');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };


function readBody(req) {
  return new Promise(res => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { res(JSON.parse(d || '{}')); } catch { res({}); } }); });
}

async function agentApi(req, res, u) {
  const send = (code, obj, extraHeaders = {}) => {
    res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*',
      'access-control-allow-headers': '*', 'access-control-expose-headers': 'PAYMENT-REQUIRED,PAYMENT-RESPONSE', ...extraHeaders });
    res.end(JSON.stringify(obj, null, 2));
  };
  const base = 'https://' + (req.headers.host || 'localhost');

  if (u.pathname === '/api/agent/manifest') return send(200, AG.agentManifest(base));

  if (u.pathname === '/api/agent/seat' && req.method === 'POST') {
    const agentName = req.headers['x-agent'];
    if (!agentName) return send(403, { error: 'X-Agent header required — agents must identify themselves' });
    const roomId = u.searchParams.get('table') || 'agents';
    const gate = AG.canJoin(roomId, true);
    if (!gate.ok) return send(403, { error: gate.reason });
    const sig = req.headers['payment-signature'];
    const resource = base + '/api/agent/seat';
    const pay = await AG.verifyPayment(sig, resource);
    if (!pay.ok) {
      return send(402, { ...AG.paymentRequired(resource), reason: pay.reason },
                  { 'PAYMENT-REQUIRED': AG.paymentRequiredHeader(resource) });
    }
    const seat = AG.issueSeat(String(agentName).slice(0, 24), roomId, pay.txHash);
    const room = G.getRoom(roomId);
    G.addPlayer(room, seat.pid, '🤖 ' + seat.agent, false, null);
    room.players[seat.pid].isAgent = true;
    return send(200, { token: seat.token, pid: seat.pid, table: roomId, txHash: pay.txHash, dev: !!pay.dev },
                { 'PAYMENT-RESPONSE': Buffer.from(JSON.stringify({ success: true, transaction: pay.txHash })).toString('base64') });
  }

  if (u.pathname === '/api/agent/state') {
    const seat = AG.getSeat(u.searchParams.get('token'));
    if (!seat) return send(401, { error: 'invalid or expired token — buy a seat first' });
    return send(200, G.view(G.getRoom(seat.roomId), seat.pid));
  }

  if (u.pathname === '/api/agent/act' && req.method === 'POST') {
    const seat = AG.getSeat(u.searchParams.get('token'));
    if (!seat) return send(401, { error: 'invalid or expired token' });
    const body = await readBody(req);
    const room = G.getRoom(seat.roomId);
    const r = G.doAction(room, seat.pid, body.act, body.arg || {});
    broadcast(seat.roomId);
    return send(r.ok ? 200 : 400, { result: r, state: G.view(room, seat.pid) });
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }); return res.end(); }
  if (u.pathname.startsWith('/api/agent/')) { if (await agentApi(req, res, u) !== false) return; }
  if (u.pathname === '/api/world') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(world.snapshot()));
  }
  if (u.pathname === '/api/rooms') {
    const list = Object.values(G.rooms)
      .filter(r => r.isPublic && r.id !== 'main' && !r.finished)
      .map(r => ({
        id: r.id, title: r.title || r.id,
        players: r.order.filter(id => !r.players[id].isBot).length,
        bots: r.order.filter(id => r.players[id].isBot).length,
        started: r.started, round: r.round,
      }));
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(list));
  }
  if (u.pathname === '/api/rooms/create' && req.method === 'POST') {
    const body = await readBody(req);
    const isPublic = !!body.isPublic;
    const withBots = body.withBots !== false;
    const id = 'r' + Math.random().toString(36).slice(2, 9);
    G.getRoom(id, { isPublic, withBots, title: (body.title || '').toString().slice(0, 24) || null });
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ id }));
  }
  let f = u.pathname === '/' ? '/index.html' : u.pathname;
  const fp = path.join(PUB, path.normalize(f).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(fp, (e, data) => {
    if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const clients = new Map(); // ws -> {pid, roomId}

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

// Оптимизация: view() тяжёлая (считает доход всех клеток по живому миру).
// Кэшируем результат на 300мс per (room,pid) — при 100+ игроках это снимает основную нагрузку.
const viewCache = new Map();
function cachedView(room, pid) {
  const key = room.id + '|' + pid;
  const hit = viewCache.get(key);
  if (hit && Date.now() - hit.t < 300) return hit.v;
  const v = G.view(room, pid);
  viewCache.set(key, { t: Date.now(), v });
  return v;
}
function broadcast(roomId) {
  const room = G.getRoom(roomId);
  viewCache.clear();
  for (const [ws, c] of clients) {
    if (c.roomId !== roomId) continue;
    if (ws.bufferedAmount > 262144) continue;   // не топим медленных клиентов
    send(ws, { type: 'state', state: cachedView(room, c.pid) });
  }
}

wss.on('connection', (ws) => {
  clients.set(ws, { pid: null, roomId: 'main' });
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf); } catch { return; }
    const c = clients.get(ws);
    if (!c) return;

    if (m.type === 'join') {
      const roomId = (m.roomId || 'main').toString().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'main';
      c.roomId = roomId;
      const withBots = m.withBots !== false;
      let room = G.getRoom(roomId, { isPublic: m.isPublic !== false, withBots, title: m.title || null });
      const pid = m.pid || ('p' + Math.random().toString(36).slice(2, 9));
      c.pid = pid;
      const name = (m.name || 'Игрок').toString().slice(0, 18);
      // Если партия уже закончена — стартуем новую (чистая хроника, свежий стол)
      if (room.finished) {
        G.rooms[roomId] = G.newRoom(roomId, { isPublic: room.isPublic, withBots: room.withBots, title: room.title });
        room = G.getRoom(roomId);
      }
      const maxSeats = room.withBots === false ? 8 : 4;
      // Игра с друзьями: живой игрок ВЫТЕСНЯЕТ бота, если стол уже забит ботами.
      const isReturning = !!room.players[pid];
      if (!isReturning && room.withBots && room.order.length >= 4) {
        const botId = room.order.find(id => room.players[id].isBot);
        if (botId) {
          for (const a of G.ASSETS) if (room.assets[a.id]?.owner === botId) delete room.assets[a.id].owner;
          const bn = room.players[botId].name;
          room.order = room.order.filter(id => id !== botId);
          delete room.players[botId];
          if (room.turnIdx >= room.order.length) room.turnIdx = 0;
          G.log(room, `${bn} уступает место живому игроку`, 'join');
        }
      }
      G.addPlayer(room, pid, name, false, m.pfp || null);
      // добиваем ботами только до 4 участников — только если комната создана с ботами
      if (room.withBots) {
        const humans = room.order.filter(id => !room.players[id].isBot).length;
        const bots = room.order.filter(id => !!room.players[id].isBot).length;
        let need = Math.max(0, 4 - humans - bots);
        for (let i = 0; i < need; i++) {
          const bn = G.BOT_NAMES[(bots + i) % G.BOT_NAMES.length];
          G.addPlayer(room, 'bot_' + bn.replace(/\s/g, '') + '_' + i, bn, true);
        }
      }
      send(ws, { type: 'joined', pid, roomId });
      broadcast(roomId);
      return;
    }
    let room = G.getRoom(c.roomId);
    if (m.type === 'action') {
      const pl = room.players[c.pid];
      if (pl && m.act === 'roll') pl.missedTurns = 0;   // живая активность — сбрасываем счётчик выбывания
      const r = G.doAction(room, c.pid, m.act, m.arg || {});
      send(ws, { type: 'result', ok: r.ok, msg: r.msg, act: m.act });
      broadcast(c.roomId);
      return;
    }
    if (m.type === 'ready') {
      const p = room.players[c.pid];
      if (p) p.ready = true;
      // если все живые готовы — сразу конец раунда
      const humans = room.order.map(i => room.players[i]).filter(p => !p.isBot);
      if (humans.length && humans.every(p => p.ready)) tick(c.roomId, true);
      else broadcast(c.roomId);
      return;
    }
    if (m.type === 'reset') {
      G.rooms[c.roomId] = G.newRoom(c.roomId);
      broadcast(c.roomId);
      return;
    }
  });

  ws.on('close', () => clients.delete(ws));
});

function tickAuction(room) {
  const au = room.auction;
  if (!au || au.closed) return;
  const activeBidders = room.order.filter(id => !au.passed.includes(id));
  const everyonePassedExceptWinner = au.currentBidder && activeBidders.length <= 1;
  if (Date.now() < au.endsAt && !everyonePassedExceptWinner) return;
  au.closed = true;
  const a = G.ASSET_BY_ID[au.assetId];
  if (au.currentBidder && a) {
    const winner = room.players[au.currentBidder];
    if (winner && winner.white >= au.currentBid) {
      winner.white -= au.currentBid;
      room.assets[a.id] = { ...(room.assets[a.id] || {}), owner: au.currentBidder };
      G.log(room, 'buy', { key: 'log_auction_won', params: { icon: a.icon, assetId: a.id, amt: au.currentBid }, actorId: au.currentBidder });
      G.checkWin(room);
    }
  } else if (a) {
    G.log(room, 'info', { key: 'log_auction_novone', params: { icon: a.icon, assetId: a.id } });
  }
  room.auction = null;
}

function tick(roomId = 'main', forced = false) {
  const room = G.getRoom(roomId);
  G.checkWin(room);
  if (room.finished) return;
  tickAuction(room);
  const humans = room.order.filter(id => !room.players[id].isBot);
  if (!humans.length) { room.phaseEndsAt = Date.now() + G.CFG.rollMs; return; }
  const curId = G.currentPlayerId(room);
  const cur = room.players[curId];
  if (!cur) return;

  // ход бота: бросает и играет теневые действия
  if (cur.isBot && !cur.rolledThisTurn) {
    if (cur.jailed > 0) {
      // бот в тюрьме: платит залог если есть деньги и сразу бросает; иначе пропускает ход
      if (cur.white >= G.FEES.jailBail) {
        G.doAction(room, curId, 'pay_bail', {});
        const r = G.doAction(room, curId, 'roll', {});
        if (r.ok && r.event?.type === 'prop_free') G.doAction(room, curId, 'buy', { assetId: r.event.propId });
        G.botTurn(room, cur);
        room.phase = 'decide'; room.phaseEndsAt = Date.now() + 1200;
      } else {
        G.doAction(room, curId, 'end_turn', {});  // сидит, нечем платить — пропускает
      }
      broadcast(roomId);
      return;
    }
    const r = G.doAction(room, curId, 'roll', {});
    if (r.ok && r.event?.type === 'prop_free') G.doAction(room, curId, 'buy', { assetId: r.event.propId });
    G.botTurn(room, cur);
    room.phase = 'decide';
    room.phaseEndsAt = Date.now() + 1200;
    broadcast(roomId);
    return;
  }

  // Живому игроку в комнате «играть с ботами» время хода не ограничено —
  // таймауты/автопропуск применяются только к реальным игрокам в мультиплеере
  // (публичные/приватные комнаты без ботов) и к самим ботам (у них свой инстант-тик выше).
  if (room.withBots && !cur.isBot) return;

  // таймауты: 10с на бросок, 20с на решение
  if (!forced && Date.now() < room.phaseEndsAt) return;
  if (!cur.rolledThisTurn) {
    if (cur.jailed > 0) {
      // в тюрьме нельзя бросать — ход просто пропускается (отсидка)
      G.doAction(room, curId, 'end_turn', {});
      broadcast(roomId);
      return;
    }
    // живой игрок молчал весь тайм-аут броска — считаем пропущенным ходом
    if (!cur.isBot) {
      cur.missedTurns = (cur.missedTurns || 0) + 1;
      if (cur.missedTurns >= 5) {
        G.surrenderPlayer(room, curId, 'inactive');
        broadcast(roomId);
        return;
      }
    }
    G.doAction(room, curId, 'roll', {});   // авто-бросок по истечении 10с
    broadcast(roomId);
    return;
  }
  G.doAction(room, curId, 'end_turn', {}); // авто-конец хода по истечении 20с
  broadcast(roomId);
}

// Cloudflare/nginx закрывают простаивающие WS — держим keepalive и убираем мёртвые
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} clients.delete(ws); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 25000);

setInterval(() => { for (const id of Object.keys(G.rooms)) tick(id); }, 1000);
// пульс таймера клиентам
setInterval(() => { for (const id of Object.keys(G.rooms)) broadcast(id); }, 10000);

async function worldLoop() {
  try {
    await world.refresh();
    const s = world.snapshot();
    console.log(`[world] ${new Date(s.ts).toISOString()} live=${s.live} errors=${s.errors.length}`);
    for (const id of Object.keys(G.rooms)) broadcast(id);
  } catch (e) { console.error('[world] fail', e.message); }
  setTimeout(worldLoop, 12 * 60 * 1000);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('SHADOW EMPIRE on :' + PORT);
  worldLoop();
});
