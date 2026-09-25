/**
 * SHADOW EMPIRE — игровой движок (авторитарный сервер).
 * Раунды по таймеру, одновременные действия, доход считается из РЕАЛЬНОГО снапшота мира.
 */
const world = require('./world');
const B = require('./board');
const TURN = require('./turn');

const CFG = {
  rollMs: TURN.T.rollMs,       // 10 сек на бросок
  decideMs: TURN.T.decideMs,   // 20 сек на решение по событию
  winGoal: TURN.T.winGoal,     // резервная цель по капиталу (не используется как основной триггер победы)
  roundMs: 60000,              // (устаревшее) окно раунда для начисления дохода
  matchMs: 30 * 60 * 1000,     // партия длится 30 минут — победа по итоговому капиталу
  totalRounds: 200,
  startWhite: 80000,
  startBlack: 30000,
  startInfluence: 5,
  apPerRound: 3,
  blackWorth: 0.6,       // нал считается в итоге с дисконтом
  launderFee: 0.25,
  heatDecay: 4,
  caseThreshold: 3,      // улик до открытия дела
};

// ---------- АКТИВЫ ----------
// beta   — плечо к движению рынка
// warB   — как влияет война (+ выигрывает от войны, − страдает)
// unrestB— как страдает от беспорядков (0..1)
// wx     — тип погодной чувствительности
const ASSETS = B.PROPS;   // 26 бизнесов = клетки доски
const ASSET_BY_ID = Object.fromEntries(ASSETS.map(a => [a.id, a]));

// ---------- МИР → МОДИФИКАТОРЫ ----------
function weatherMod(wx, w) {
  if (!wx || !w) return { m: 1, key: null, params: {} };
  if (wx === 'storm') {
    if (w.wind >= 40 || w.precip >= 6) return { m: 0.62, key: 'wx_storm_hard', params: { wind: Math.round(w.wind) } };
    if (w.wind >= 28 || w.precip >= 2) return { m: 0.85, key: 'wx_storm_soft', params: { wind: Math.round(w.wind) } };
  }
  if (wx === 'heat') {
    if (w.t >= 45) return { m: 0.72, key: 'wx_heat_hard', params: { t: Math.round(w.t) } };
    if (w.t >= 40) return { m: 0.88, key: 'wx_heat_soft', params: { t: Math.round(w.t) } };
  }
  if (wx === 'cold') {
    if (w.t <= -25) return { m: 0.75, key: 'wx_cold_hard', params: { t: Math.round(w.t) } };
    if (w.t <= -12) return { m: 0.9, key: 'wx_cold_soft', params: { t: Math.round(w.t) } };
  }
  return { m: 1, key: null, params: {} };
}

/** Разложение дохода актива на факторы — это то, что видит игрок в «почему». */
function income(asset, room, ownerId) {
  const W = world.snapshot();
  const z = W.zones[asset.zone] || { unrest: 0, war: 0, weather: null, headlines: [] };
  const mk = W.markets[asset.link] || { delta: 0, label: asset.link, price: null };
  const st = room.assets[asset.id] || {};
  const p = ownerId ? room.players[ownerId] : null;
  const factors = [];
  let m = 1;

  const md = (mk.delta || 0) * asset.beta;
  m *= (1 + md);
  factors.push({ key: 'f_market', params: { label: mk.label, labelEn: mk.labelEn, pct: ((mk.delta || 0) * 100).toFixed(1), beta: asset.beta }, v: md });

  if (z.war > 0.02) {
    const wm = 1 + z.war * asset.warB;
    m *= wm;
    factors.push({ key: 'f_war', params: { n: z.warN }, v: wm - 1 });
  }
  if (z.unrest > 0.02 && asset.unrestB !== 0) {
    const um = 1 - z.unrest * asset.unrestB * (st.protected ? 0.35 : 1);
    m *= um;
    factors.push({ key: st.protected ? 'f_unrest_shielded' : 'f_unrest', params: { n: z.unrestN }, v: um - 1 });
  }
  const wxm = weatherMod(asset.wx, z.weather);
  if (wxm.key) { m *= wxm.m; factors.push({ key: wxm.key, params: wxm.params, v: wxm.m - 1 }); }

  const zb = room.zoneBribe[asset.zone];
  if (zb) {
    if (zb.owner === ownerId) { m *= 1.3; factors.push({ key: 'f_mayor_own', params: {}, v: 0.3 }); }
    else { m *= 0.82; factors.push({ key: 'f_mayor_rival', params: {}, v: -0.18 }); }
  }
  if (st.frozen > 0) { m = 0; factors.push({ key: 'f_frozen', params: { n: st.frozen }, v: -1 }); }
  if (st.damaged > 0) { m *= 0.5; factors.push({ key: 'f_damaged', params: { n: st.damaged }, v: -0.5 }); }
  if (p?.protection) { factors.push({ key: 'f_protection', params: {}, v: 0 }); }
  if (p && p.heat > 60) { m *= 0.9; factors.push({ key: 'f_heat_high', params: { heat: p.heat }, v: -0.1 }); }

  const gross = Math.round(asset.base * Math.max(0, m));
  const isBlack = asset.kind === 'crime';
  return { gross, factors, isBlack, mult: m };
}

function assetValue(asset, room) {
  const W = world.snapshot();
  const z = W.zones[asset.zone] || { unrest: 0, war: 0 };
  const mk = W.markets[asset.link] || { delta: 0 };
  const st = room.assets[asset.id] || {};
  let v = asset.price;
  v *= 1 + (mk.delta || 0) * asset.beta * 0.5;
  v *= 1 - z.unrest * asset.unrestB * 0.25;
  v *= 1 + z.war * asset.warB * 0.2;
  if (st.damaged > 0) v *= 0.7;
  return Math.round(v);
}

// ---------- КОМНАТА ----------
let ROOM_SEQ = 0;
function newRoom(id, opts = {}) {
  return {
    id: id || 'main', seq: ++ROOM_SEQ,
    isPublic: opts.isPublic !== undefined ? opts.isPublic : true,
    withBots: opts.withBots !== undefined ? opts.withBots : true,
    title: opts.title || null,
    createdAt: Date.now(),
    // важно: таймер партии запускается НЕ в момент создания объекта комнаты (который для общего
    // стола 'main' совпадает с моментом старта процесса сервера!), а в момент,
    // когда в комнату зайдёт реальный игрок (см. addPlayer) — иначе на долгоживущем
    // сервере игрок мог видеть «30 минут», от которых уже истекли несколько минут.
    matchEndsAt: null,
    matchStarted: false,
    players: {}, order: [],
    assets: {},              // assetId -> {owner, frozen, damaged, protected}
    zoneBribe: {},           // zone -> {owner, rounds}
    round: 1, roundEndsAt: Date.now() + CFG.roundMs,
    started: false, finished: false,
    log: [], version: 0,
    chains: B.pickChains(),      // 3 случайные цепочки на партию — их надо угадать
    chainClaimed: {},            // кто первый собрал
    turnIdx: 0,                  // чей ход
    phase: 'roll',               // 'roll' | 'decide'
    phaseEndsAt: Date.now() + CFG.rollMs,
    lastRoll: null,              // {d1,d2,...} для анимации на клиенте
    diceOracle: TURN.createDiceOracle(),
    diceRolls: [],
    pendingEvent: null,          // событие клетки, ждущее решения
    decks: {},
    winner: null,
  };
}

const rooms = { main: newRoom('main') };
function getRoom(id = 'main', opts) {
  if (!rooms[id]) rooms[id] = newRoom(id, opts);
  return rooms[id];
}

/** meta: {key, params, actorId, targetId} — клиент сам соберёт текст на нужном языке. */
function log(room, kind, meta = {}) {
  room.log.unshift({
    t: Date.now(), key: meta.key || null, params: meta.params || {},
    kind, round: room.round, actorId: meta.actorId || null, targetId: meta.targetId || null,
  });
  if (room.log.length > 120) room.log.pop();
}

function newPlayer(id, name, isBot = false) {
  return {
    id, name, isBot,
    white: CFG.startWhite, black: CFG.startBlack, influence: CFG.startInfluence,
    heat: 0, evidence: 0, rep: 50, ap: CFG.apPerRound,
    protection: false, insider: 0, offshore: false,
    caseOpen: 0, jailed: 0, ready: false,
    debt: 0, // недоплаченная аренда — списывается из будущего дохода первым делом
    pos: 0, inJail: false, skipTurns: 0, chains: [], rolledThisTurn: false,
    missedTurns: 0, eliminated: false, connected: true,
    lastIncome: 0, history: [], pfp: null,
  };
}

/**
 * Оплата аренды владельцу актива (как в оригинальной Монополии — платит тот,
 * кто встал на чужую клетку). Номинал зависит от типа актива: легал/серое → белые,
 * крим → нал. Никаких штрафов/палева/репутации — только денежная механика:
 *  1) хватает нужной валюты — платим как обычно
 *  2) не хватает, но есть другая валюта — конвертируем по курсу 60% (сам курс — единственная "потеря")
 *  3) не хватает вообще — остаток уходит в долг, спишется из будущего дохода первым делом
 */
function payRent(room, payerId, asset, amount) {
  const payer = room.players[payerId];
  const st = room.assets[asset.id];
  const ownerId = st?.owner;
  const owner = ownerId ? room.players[ownerId] : null;
  const wantBlack = asset.kind === 'crime';
  const primary = wantBlack ? 'black' : 'white';
  const secondary = wantBlack ? 'white' : 'black';
  let remaining = amount;
  const fromPrimary = Math.min(payer[primary], remaining);
  payer[primary] -= fromPrimary; remaining -= fromPrimary;

  let converted = 0;
  if (remaining > 0 && payer[secondary] > 0) {
    const need = Math.ceil(remaining / 0.6); // курс конвертации 60%
    const use = Math.min(payer[secondary], need);
    payer[secondary] -= use;
    converted = Math.round(use * 0.6);
    remaining -= converted;
  }

  let unpaid = 0;
  if (remaining > 0) {
    unpaid = remaining;
    payer.debt = (payer.debt || 0) + unpaid;
  }
  const paid = amount - unpaid;
  if (owner) { owner[primary] = (owner[primary] || 0) + paid; }
  return { paid, converted, unpaid };
}

function addPlayer(room, id, name, isBot = false, pfp = null) {
  if (room.players[id]) return room.players[id];
  const p = newPlayer(id, name, isBot);
  p.pfp = pfp;
  room.players[id] = p;
  room.order.push(id);
  // таймер партии (30 мин) заводится ровно один раз — в момент, когда в комнате появился
  // первый реальный (не бот) игрок. Для общего стола 'main' комната
  // существует с запуска сервера, поэтому без выделения в отдельный шаг таймер стартовал бы
  // от момента старта процесса, а не от момента, когда игрок реально зашёл.
  if (!isBot && !room.matchStarted) {
    room.matchStarted = true;
    room.matchEndsAt = Date.now() + CFG.matchMs;
  }
  log(room, 'join', { key: 'log_join', params: { name } });
  return p;
}

function netWorth(room, p) {
  let v = p.white + p.black * CFG.blackWorth - (p.debt || 0);
  for (const a of ASSETS) if (room.assets[a.id]?.owner === p.id) v += assetValue(a, room);
  return Math.round(v);
}


// ---------- ПОШАГОВЫЙ РЕЖИМ ----------
function currentPlayerId(room) {
  if (!room.order.length) return null;
  return room.order[room.turnIdx % room.order.length];
}

/** Передать ход следующему; каждый полный круг = начисление дохода (endRound). */
function advanceTurn(room) {
  const cur = room.players[currentPlayerId(room)];
  if (cur) { cur.rolledThisTurn = false; cur.ready = false; }
  const before = room.turnIdx % Math.max(1, room.order.length);
  room.turnIdx = (room.turnIdx + 1) % Math.max(1, room.order.length);
  // круг замкнулся — начисляем доход и крутим мир
  if (room.turnIdx <= before) endRound(room);
  const next = room.players[currentPlayerId(room)];
  if (next) {
    next.rolledThisTurn = false;
    next.ap = CFG.apPerRound;
    // в тюрьме ход тратится на отсидку
    if (next.jailed > 0) {
      next.jailed--;
      if (next.jailed === 0) { next.inJail = false; log(room, 'law', { key: 'log_release', actorId: next.id }); }
      else log(room, 'law', { key: 'log_jail_skip', params: { n: next.jailed }, actorId: next.id });
    }
  }
  room.phase = 'roll';
  room.phaseEndsAt = Date.now() + CFG.rollMs;
  room.pendingEvent = null;
}

/** Сдаться или выбыть по неактивности: все активы возвращаются в банк (свободны для продажи). */
function surrenderPlayer(room, pid, reason = 'surrender') {
  const p = room.players[pid];
  if (!p || p.eliminated) return;
  for (const a of ASSETS) {
    if (room.assets[a.id]?.owner === pid) delete room.assets[a.id].owner;
  }
  for (const z of Object.keys(room.zoneBribe)) {
    if (room.zoneBribe[z].owner === pid) delete room.zoneBribe[z];
  }
  room.offers = (room.offers || []).filter(o => o.from !== pid);
  p.eliminated = true;
  const wasCurrent = currentPlayerId(room) === pid;
  const idx = room.order.indexOf(pid);
  room.order = room.order.filter(id => id !== pid);
  if (idx >= 0 && idx < room.turnIdx) room.turnIdx = Math.max(0, room.turnIdx - 1);
  if (room.order.length) room.turnIdx = room.turnIdx % room.order.length;
  log(room, 'law', { key: reason === 'inactive' ? 'log_inactive' : 'log_surrender', actorId: pid });
  if (wasCurrent && room.order.length) {
    room.turnIdx = room.turnIdx % room.order.length;
    room.phase = 'roll';
    room.phaseEndsAt = Date.now() + CFG.rollMs;
    const next = room.players[currentPlayerId(room)];
    if (next) { next.rolledThisTurn = false; next.actedThisTurn = false; next.ap = CFG.apPerRound; }
  }
  const alive = room.order.filter(id => !room.players[id].isBot);
  if (room.order.length === 1) {
    room.finished = true; room.winner = room.order[0];
    if (room.diceOracle) room.diceOracle.revealed = room.diceOracle.seed;
    log(room, 'win', { key: 'log_win_last', actorId: room.order[0] });
  }
}

/** Победа по таймеру партии (30 минут) — у кого больше итоговый капитал
 * (недвижимость по рыночной цене + деньги), тот победил. */
function checkWin(room) {
  if (room.finished) return;
  if (!room.matchEndsAt || Date.now() < room.matchEndsAt) return;
  if (!room.order.length) return;
  const rank = room.order.map(id => ({ id, nw: netWorth(room, room.players[id]) }))
    .sort((a, b) => b.nw - a.nw);
  room.finished = true;
  room.winner = rank[0].id;
  if (room.diceOracle) room.diceOracle.revealed = room.diceOracle.seed;
  log(room, 'win', { key: 'log_win_time', params: { amt: rank[0].nw }, actorId: rank[0].id });
}

// ---------- ДЕЙСТВИЯ ----------
const ACTIONS = {
  buy: { ap: 1, label: 'Купить актив' },
  bribe_mayor: { ap: 1, label: 'Взятка мэру', inf: 4, black: 90000, heat: 12 },
  buy_inspector: { ap: 1, label: 'Купить инспектора', black: 60000, heat: 8 },
  tender: { ap: 1, label: 'Госконтракт (тендер)', inf: 5, heat: 10 },
  audit_rival: { ap: 1, label: 'Заказать проверку', black: 50000, heat: 10 },
  raid: { ap: 2, label: 'Рейд / поджог', black: 90000, heat: 26 },
  protection: { ap: 1, label: 'Нанять крышу', black: 40000, heat: 4 },
  launder: { ap: 1, label: 'Отмыть нал', heat: 6 },
  offshore: { ap: 1, label: 'Открыть офшор', white: 120000, heat: 5 },
  bribe_prosecutor: { ap: 1, label: 'Занести прокурору', heat: -20 },
  snitch: { ap: 1, label: 'Сдать партнёра', heat: -30 },
  lobby: { ap: 1, label: 'Лоббировать (купить влияние)', white: 42000 },
  skim: { ap: 1, label: 'Провести доход мимо кассы' },
  kickback: { ap: 1, label: 'Откат с госконтракта' },
  buyout: { ap: 1, label: 'Предложить выкуп' },
  seize: { ap: 2, label: 'Рейдерский захват', inf: 6, black: 130000, heat: 30 },
  pay_rent: { ap: 0, label: 'Оплатить аренду' },
  surrender: { ap: 0, label: 'Сдаться' },
  roll: { ap: 0, label: 'Бросить кубик' },
  end_turn: { ap: 0, label: 'Завершить ход' },
  pay_bail: { ap: 0, label: 'Заплатить залог' },
  sell_bank: { ap: 0, label: 'Продать банку' },
  offer_asset: { ap: 0, label: 'Предложить игрокам' },
  accept_offer: { ap: 0, label: 'Принять предложение' },
  propose_trade: { ap: 0, label: 'Предложить сделку игроку' },
  accept_trade: { ap: 0, label: 'Принять сделку' },
  decline_trade: { ap: 0, label: 'Отклонить сделку' },
  auction_bid: { ap: 0, label: 'Ставка на аукционе' },
  auction_pass: { ap: 0, label: 'Пас на аукционе' },
  seize_board: { ap: 2, label: 'Силовой захват клетки', inf: 8, black: 160000, heat: 32 },
  start_auction: { ap: 1, label: 'Начать аукцион' },
};

function fail(msg) { return { ok: false, msg }; }

function doAction(room, pid, act, arg = {}) {
  const p = room.players[pid];
  if (!p) return fail('Игрок не найден');
  if (room.finished) return fail('Игра окончена');
  const FREE_IN_JAIL = ['end_turn', 'pay_bail', 'sell_bank', 'offer_asset', 'accept_offer', 'roll'];
  if (p.jailed > 0 && !FREE_IN_JAIL.includes(act)) return fail(`Ты под стражей ещё ${p.jailed} р.`);
  const def = ACTIONS[act];
  if (!def) return fail('Неизвестное действие');
  const apCost = def.ap ?? 1;
  if (p.ap < apCost) return fail('Нет действий в этом раунде');
  if (def.black && p.black < def.black) return fail('Не хватает нала');
  if (def.white && p.white < def.white) return fail('Не хватает белых');
  if (def.inf && p.influence < def.inf) return fail('Не хватает влияния');

  const pay = () => {
    p.ap -= apCost;
    if (def.black) p.black -= def.black;
    if (def.white) p.white -= def.white;
    if (def.inf) p.influence -= def.inf;
    if (def.heat) p.heat = Math.max(0, p.heat + def.heat);
  };

  switch (act) {
    case 'buy': {
      const a = ASSET_BY_ID[arg.assetId];
      if (!a) return fail('Нет такого актива');
      const st = room.assets[a.id] || {};
      if (st.owner) return fail('Уже занято');
      if (B.POS_BY_PROP[a.id] !== p.pos) return fail('Купить можно только клетку, на которой стоишь');
      const price = assetValue(a, room);
      if (a.kind === 'crime') {
        if (p.black < price * 0.7) return fail('Крим-активы берут за нал');
        p.black -= Math.round(price * 0.7);
      } else {
        if (p.white < price) return fail('Не хватает белых денег');
        p.white -= price;
      }
      room.assets[a.id] = { ...st, owner: pid };
      p.ap -= 1;
      if (a.kind === 'crime') { p.heat += 10; p.rep -= 4; }
      log(room, 'buy', { key: 'log_buy', params: { icon: a.icon, assetId: a.id, amt: price }, actorId: pid });
      TURN.checkChains(room, pid, log);
      checkWin(room);
      return { ok: true };
    }
    case 'bribe_mayor': {
      if (!arg.zone || !world.ZONES[arg.zone]) return fail('Нужна зона');
      pay();
      room.zoneBribe[arg.zone] = { owner: pid, rounds: 5 };
      p.rep -= 3;
      // кто именно купил мэра — не пишем в открытую хронику (это анонимная коррупция)
      log(room, 'corrupt', { key: 'log_mayor_bribed', params: { zoneId: arg.zone } });
      return { ok: true };
    }
    case 'buy_inspector': { pay(); p.insider = 3; log(room, 'corrupt', { key: 'log_inspector', actorId: pid }); return { ok: true }; }
    case 'tender': {
      if (!arg.zone) return fail('Нужна зона');
      pay();
      const bonus = 26000 + Math.round(Math.random() * 14000);
      p.history.push({ tender: bonus });
      p.tender = (p.tender || 0) + bonus;
      log(room, 'corrupt', { key: 'log_tender', params: { zoneId: arg.zone, amt: bonus }, actorId: pid });
      return { ok: true };
    }
    case 'audit_rival': {
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && room.assets[a.id];
      if (!st?.owner || st.owner === pid) return fail('Нужен чужой актив');
      pay();
      st.frozen = 2;
      const victim = room.players[st.owner];
      const caught = Math.random() < 0.4;
      log(room, 'attack', { key: 'log_audit', params: { icon: a.icon, assetId: a.id, caught }, actorId: pid, targetId: victim.id });
      if (caught) { p.heat += 8; victim.knows = victim.knows || []; victim.knows.push(p.name); }
      return { ok: true };
    }
    case 'raid': {
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && room.assets[a.id];
      if (!st?.owner || st.owner === pid) return fail('Нужен чужой актив');
      const victim = room.players[st.owner];
      pay();
      if (st.protected || victim.protection) {
        log(room, 'attack', { key: 'log_raid_blocked', params: { icon: a.icon, assetId: a.id }, actorId: pid, targetId: victim.id });
        p.heat += 6;
      } else {
        // Считаем до damaged: assetValue повреждённого объекта уже применяет скидку 30%.
        const loss = Math.round(assetValue(a, room) * 0.3);
        st.damaged = 3;
        victim.white = Math.max(0, victim.white - loss);
        log(room, 'attack', { key: 'log_raid_hit', params: { icon: a.icon, assetId: a.id, amt: loss }, actorId: pid, targetId: victim.id });
      }
      p.rep -= 8; p.evidence += 1;
      return { ok: true };
    }
    case 'protection': { pay(); p.protection = true; log(room, 'corrupt', { key: 'log_protection', actorId: pid }); return { ok: true }; }
    case 'launder': {
      const amt = Math.min(p.black, Math.max(0, Math.round(arg.amount || p.black)));
      if (amt < 10000) return fail('Мало нала');
      const fee = p.influence >= 8 ? 0.18 : CFG.launderFee;
      pay();
      p.black -= amt; p.white += Math.round(amt * (1 - fee));
      log(room, 'corrupt', { key: 'log_launder', params: { amt, fee: Math.round(fee * 100) }, actorId: pid });
      return { ok: true };
    }
    case 'offshore': { pay(); p.offshore = true; log(room, 'corrupt', { key: 'log_offshore', actorId: pid }); return { ok: true }; }
    case 'bribe_prosecutor': {
      if (p.evidence === 0 && p.caseOpen === 0) return fail('Дела нет — не за что платить');
      const cost = 60000 + p.evidence * 45000;
      if (p.black < cost) return fail(`Нужно $${fmt(cost)} нала`);
      p.black -= cost; p.ap -= 1;
      p.evidence = Math.max(0, p.evidence - 2); p.caseOpen = 0;
      p.heat = Math.max(0, p.heat - 20);
      log(room, 'corrupt', { key: 'log_pay_prosecutor', params: { amt: cost }, actorId: pid });
      return { ok: true };
    }
    case 'snitch': {
      const target = room.players[arg.targetId];
      if (!target || target.id === pid) return fail('Нужен другой игрок');
      p.ap -= 1;
      p.evidence = 0; p.caseOpen = 0; p.heat = Math.max(0, p.heat - 30); p.rep -= 15;
      target.evidence += 2; target.heat += 20;
      target.knows = target.knows || []; target.knows.push(p.name);
      log(room, 'attack', { key: 'log_snitch', actorId: pid, targetId: target.id });
      return { ok: true };
    }
    case 'lobby': { pay(); p.influence += 2; log(room, 'corrupt', { key: 'log_lobby', actorId: pid }); return { ok: true }; }
    case 'skim': {
      // легальный/серый бизнес без единого крим-актива: часть выручки мимо отчётности
      const amt = Math.min(p.white, Math.max(0, Math.round(arg.amount || p.white * 0.3)));
      if (amt < 20000) return fail('Слишком мало белых, чтобы было что скрывать');
      p.ap -= 1;
      p.white -= amt;
      p.black += Math.round(amt * 0.55);
      p.heat += 9;
      log(room, 'corrupt', { key: 'log_skim', params: { amt }, actorId: pid });
      return { ok: true };
    }
    case 'buyout': {
      // легальный выкуп чужого актива с премией — всегда срабатывает
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && room.assets[a.id];
      if (!st?.owner || st.owner === pid) return fail('Нужен чужой актив');
      const victim = room.players[st.owner];
      const price = Math.round(assetValue(a, room) * 1.6); // премия за принуждение к продаже
      if (p.white < price) return fail(`Нужно $${fmt(price)} белых (цена с премией 60%)`);
      p.ap -= 1;
      p.white -= price;
      victim.white += price;
      st.owner = pid;
      log(room, 'buy', { key: 'log_buyout', params: { icon: a.icon, assetId: a.id, amt: price }, actorId: pid, targetId: victim.id });
      return { ok: true };
    }
    case 'seize': {
      // рейдерский захват — нужны ВСЕ ТРИ условия: актив ослаблен рейдом, свой мэр
      // зоны (значит нужно и влияние на взятку), и нал на сам захват
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && room.assets[a.id];
      if (!st?.owner || st.owner === pid) return fail('Нужен чужой актив');
      if (!(st.damaged > 0)) return fail('Актив нужно сначала ослабить рейдом');
      if (st.protected || room.players[st.owner].protection) return fail('Актив под крышей — отжать нельзя');
      const mayor = room.zoneBribe[a.zone];
      if (!mayor || mayor.owner !== pid) return fail('Нужен свой мэр в этой зоне — иначе захват не оформить');
      const victim = room.players[st.owner];
      pay();
      st.owner = pid; st.damaged = 0; st.frozen = 0;
      p.rep -= 12; p.evidence += 2;
      log(room, 'attack', { key: 'log_seize', params: { icon: a.icon, assetId: a.id }, actorId: pid, targetId: victim.id });
      return { ok: true };
    }
    case 'pay_rent': {
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && room.assets[a.id];
      if (!st?.owner || st.owner === pid) return fail('Тут нечего платить');
      const inc = income(a, room, st.owner);
      const rentDue = Math.max(0, Math.round(inc.gross * 0.5));
      if (rentDue <= 0) return fail('Аренда сейчас нулевая');
      const r = payRent(room, pid, a, rentDue);
      const owner = room.players[st.owner];
      if (r.unpaid > 0) {
        log(room, 'buy', { key: 'log_rent_partial', params: { icon: a.icon, assetId: a.id, amt: r.unpaid }, actorId: pid, targetId: st.owner });
      } else if (r.converted > 0) {
        log(room, 'buy', { key: 'log_rent_converted', params: { icon: a.icon, assetId: a.id }, actorId: pid, targetId: st.owner });
      } else {
        log(room, 'buy', { key: 'log_rent', params: { icon: a.icon, assetId: a.id, amt: r.paid }, actorId: pid, targetId: st.owner });
      }
      return { ok: true, rentDue, ...r };
    }
    case 'roll': {
      if (currentPlayerId(room) !== pid) return fail('Не твой ход');
      if (p.rolledThisTurn) return fail('Уже бросал в этом ходу');
      if (p.jailed > 0) return fail(`Ты в тюрьме: осталось ${p.jailed} ход(а). Заплати залог или жди`);
      if (p.skipTurns > 0) { p.skipTurns--; p.rolledThisTurn = true; log(room, 'world', { key: 'log_skip', actorId: pid }); return { ok: true, skipped: true }; }
      const deps = { valueFn: assetValue, incomeFn: income, log, payRent };
      const from = p.pos;
      // важен порядок: сначала бросаем/двигаемся и логируем сам бросок,
      // и только ПОСЛЕ этого разрешаем клетку — иначе в ленте сначала видно
      // событие клетки («попал под бедствие»), а только потом сам бросок.
      const mv = TURN.rollAndMove(room, p);
      room.diceRolls.push({
        pid,
        at: Date.now(),
        d1: mv.d1,
        d2: mv.d2,
        dice: mv.oracle.dice,
      });
      log(room, 'info', { key: 'log_roll', params: {
        d1: mv.d1, d2: mv.d2, sum: mv.steps, pos: mv.to,
        proof: mv.oracle?.dice?.[0]?.proof?.slice(0, 10),
      }, actorId: pid });
      if (mv.passAmount > 0) {
        log(room, 'buy', { key: 'log_pass_start', params: { amt: mv.passAmount }, actorId: pid });
      }
      const event = TURN.resolveCell(room, p, deps);
      const r = { ...mv, event };
      p.rolledThisTurn = true;
      room.lastRoll = { pid, from, ...r, at: Date.now() };
      TURN.checkChains(room, pid, log);
      room.phase = 'decide';
      room.phaseEndsAt = Date.now() + CFG.decideMs;
      room.pendingEvent = r.event?.type === 'prop_free' ? { pid, ...r.event } : null;
      checkWin(room);
      return { ok: true, ...r };
    }
    case 'end_turn': {
      if (currentPlayerId(room) !== pid) return fail('Не твой ход');
      if (!p.rolledThisTurn && !p.jailed) return fail('Сначала брось кубик');
      advanceTurn(room);
      return { ok: true };
    }
    case 'pay_bail': {
      if (!(p.jailed > 0)) return fail('Ты не в тюрьме');
      const bail = B.FEES.jailBail;
      if (p.white + p.black * 0.6 < bail) return fail(`Нужно $${fmt(bail)} — нечем платить, придётся сидеть`);
      const res = TURN.chargeOrSell(room, p, bail, assetValue, log);
      if (res.bankrupt) { log(room, 'law', { key: 'log_bankrupt', actorId: pid }); }
      p.jailed = 0; p.inJail = false;
      log(room, 'law', { key: 'log_bail_out', params: { amt: bail }, actorId: pid });
      return { ok: true };
    }
    case 'sell_bank': {
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && room.assets[a.id];
      if (!st || st.owner !== pid) return fail('Это не твой актив');
      const rate = 0.45 + Math.max(0, Math.min(100, p.rep)) / 100 * 0.45;
      const price = Math.round(assetValue(a, room) * rate);
      delete st.owner;
      p.white += price;
      log(room, 'law', { key: 'log_sell_bank', params: { icon: a.icon, assetId: a.id, amt: price, rate: Math.round(rate * 100), rep: p.rep }, actorId: pid });
      return { ok: true, price, rate };
    }
    case 'offer_asset': {
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && room.assets[a.id];
      if (!st || st.owner !== pid) return fail('Это не твой актив');
      const price = Math.max(1, Math.round(arg.price || assetValue(a, room)));
      room.offers = room.offers || [];
      room.offers = room.offers.filter(o => o.assetId !== a.id);
      room.offers.push({ assetId: a.id, from: pid, price, at: Date.now() });
      log(room, 'info', { key: 'log_offer', params: { icon: a.icon, assetId: a.id, amt: price }, actorId: pid });
      return { ok: true };
    }
    case 'accept_offer': {
      room.offers = room.offers || [];
      const o = room.offers.find(x => x.assetId === arg.assetId);
      if (!o) return fail('Предложение не найдено');
      if (o.from === pid) return fail('Это твоё же предложение');
      const a = ASSET_BY_ID[o.assetId];
      const st = room.assets[a.id];
      if (!st || st.owner !== o.from) return fail('Актив уже сменил владельца');
      if (p.white < o.price) return fail(`Нужно $${fmt(o.price)} белых`);
      const seller = room.players[o.from];
      p.white -= o.price; seller.white += o.price;
      st.owner = pid;
      room.offers = room.offers.filter(x => x.assetId !== o.assetId);
      TURN.checkChains(room, pid, log);
      log(room, 'buy', { key: 'log_accept_offer', params: { icon: a.icon, assetId: a.id, amt: o.price }, actorId: pid, targetId: o.from });
      checkWin(room);
      return { ok: true };
    }
    case 'surrender': {
      surrenderPlayer(room, pid);
      return { ok: true };
    }
    // ---------- ТОРГОВЛЯ (прямая сделка с конкретным игроком, с доплатой или без) ----------
    case 'propose_trade': {
      const target = room.players[arg.targetId];
      if (!target || target.id === pid) return fail('Нужен другой игрок');
      const giveAssetId = arg.giveAssetId || null;
      const wantAssetId = arg.wantAssetId || null;
      const cashDelta = Math.round(arg.cashDelta || 0); // >0 — я доплачиваю, <0 — доплачивает партнёр
      if (giveAssetId) {
        const st = room.assets[giveAssetId];
        if (!st || st.owner !== pid) return fail('Это не твой актив');
      }
      if (wantAssetId) {
        const st = room.assets[wantAssetId];
        if (!st || st.owner !== target.id) return fail('Актив не принадлежит этому игроку');
      }
      if (!giveAssetId && !wantAssetId && cashDelta === 0) return fail('Сделка пустая — предложи актив или деньги');
      room.trades = room.trades || [];
      room.trades = room.trades.filter(tr => !(tr.from === pid && tr.to === target.id));
      const trade = { id: 'tr' + Math.random().toString(36).slice(2, 8), from: pid, to: target.id,
        giveAssetId, wantAssetId, cashDelta, at: Date.now() };
      room.trades.push(trade);
      log(room, 'info', { key: 'log_trade_offer', actorId: pid, targetId: target.id });
      return { ok: true, trade };
    }
    case 'accept_trade': {
      room.trades = room.trades || [];
      const tr = room.trades.find(x => x.id === arg.tradeId);
      if (!tr) return fail('Сделка не найдена (возможно, отменена)');
      if (tr.to !== pid) return fail('Эта сделка не тебе');
      const from = room.players[tr.from];
      if (!from) return fail('Инициатор сделки не найден');
      // проверяем, что активы всё ещё у тех же владельцев к моменту принятия
      if (tr.giveAssetId) {
        const st = room.assets[tr.giveAssetId];
        if (!st || st.owner !== tr.from) return fail('Актив инициатора уже сменил владельца');
      }
      if (tr.wantAssetId) {
        const st = room.assets[tr.wantAssetId];
        if (!st || st.owner !== pid) return fail('Твой актив уже сменил владельца');
      }
      // cashDelta > 0 — инициатор платит принимающему; < 0 — принимающий платит инициатору
      if (tr.cashDelta > 0) {
        if (from.white < tr.cashDelta) return fail('У инициатора не хватает белых на доплату');
      } else if (tr.cashDelta < 0) {
        if (p.white < -tr.cashDelta) return fail('Не хватает белых на доплату');
      }
      if (tr.giveAssetId) room.assets[tr.giveAssetId].owner = pid;
      if (tr.wantAssetId) room.assets[tr.wantAssetId].owner = tr.from;
      if (tr.cashDelta > 0) { from.white -= tr.cashDelta; p.white += tr.cashDelta; }
      else if (tr.cashDelta < 0) { p.white -= (-tr.cashDelta); from.white += (-tr.cashDelta); }
      room.trades = room.trades.filter(x => x.id !== tr.id);
      TURN.checkChains(room, pid, log);
      TURN.checkChains(room, tr.from, log);
      log(room, 'buy', { key: 'log_trade_done', actorId: tr.from, targetId: pid });
      checkWin(room);
      return { ok: true };
    }
    case 'decline_trade': {
      room.trades = room.trades || [];
      const tr = room.trades.find(x => x.id === arg.tradeId);
      if (!tr) return fail('Сделка не найдена');
      if (tr.to !== pid && tr.from !== pid) return fail('Это не твоя сделка');
      room.trades = room.trades.filter(x => x.id !== tr.id);
      return { ok: true };
    }
    // ---------- АУКЦИОН ----------
    case 'start_auction': {
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && (room.assets[a.id] || {});
      if (!a) return fail('Нет такого актива');
      if (st.owner) return fail('Уже занято');
      if (B.POS_BY_PROP[a.id] !== p.pos) return fail('Начать аукцион можно только на своей клетке');
      if (room.auction && !room.auction.closed) return fail('Аукцион уже идёт');
      p.ap -= 1;
      room.auction = {
        assetId: a.id, startedBy: pid, currentBid: Math.round(assetValue(a, room) * 0.3),
        currentBidder: null,
        reservedBid: 0,
        escrowed: true,
        passed: [],
        endsAt: Date.now() + 20000,
        closed: false,
        phaseRemainingMs: Math.max(1000, room.phaseEndsAt - Date.now()),
      };
      log(room, 'info', { key: 'log_auction_start', params: { icon: a.icon, assetId: a.id }, actorId: pid });
      return { ok: true };
    }
    case 'auction_bid': {
      const au = room.auction;
      if (!au || au.closed) return fail('Аукцион не идёт');
      const bid = Math.round(arg.amount || 0);
      if (bid <= au.currentBid) return fail(`Ставка должна быть выше $${fmt(au.currentBid)}`);
      const ownReserved = au.currentBidder === pid ? (au.reservedBid || 0) : 0;
      if (p.white + ownReserved < bid) return fail('Не хватает белых на такую ставку');
      if (au.currentBidder && au.reservedBid > 0) {
        const previous = room.players[au.currentBidder];
        if (previous) previous.white += au.reservedBid;
      }
      p.white -= bid;
      au.currentBid = bid;
      au.currentBidder = pid;
      au.reservedBid = bid;
      au.endsAt = Date.now() + 12000; // каждая новая ставка продлевает аукцион на 12 сек
      au.passed = (au.passed || []).filter(x => x !== pid);
      log(room, 'info', { key: 'log_auction_bid', params: { amt: bid, icon: ASSET_BY_ID[au.assetId]?.icon }, actorId: pid });
      return { ok: true };
    }
    case 'auction_pass': {
      const au = room.auction;
      if (!au || au.closed) return fail('Аукцион не идёт');
      if (au.currentBidder === pid) return fail('Лидер торгов не может пасовать');
      au.passed = au.passed || [];
      if (!au.passed.includes(pid)) au.passed.push(pid);
      return { ok: true };
    }
    // ---------- СИЛОВОЙ ЗАХВАТ КЛЕТКИ (альтернатива обычному seize, без требования рейда) ----------
    case 'seize_board': {
      const a = ASSET_BY_ID[arg.assetId];
      const st = a && room.assets[a.id];
      if (!st?.owner || st.owner === pid) return fail('Нужен чужой актив');
      if (st.protected || room.players[st.owner].protection) return fail('Актив под крышей — захват невозможен');
      const mayor = room.zoneBribe[a.zone];
      if (!mayor || mayor.owner !== pid) return fail('Нужен свой мэр в этой зоне — иначе захват не оформить');
      const victim = room.players[st.owner];
      pay();
      st.owner = pid; st.damaged = 0; st.frozen = 0;
      p.rep -= 16; p.evidence += 3;
      log(room, 'attack', { key: 'log_seize_board', params: { icon: a.icon, assetId: a.id }, actorId: pid, targetId: victim.id });
      return { ok: true };
    }
    case 'kickback': {
      if (!p.tender) return fail('Нужен активный госконтракт (тендер)');
      p.ap -= 1;
      const cut = Math.round(p.tender * (1.3 + Math.random() * 0.6));
      p.black += cut;
      p.heat += 14; p.rep -= 3;
      log(room, 'corrupt', { key: 'log_kickback', params: { amt: cut }, actorId: pid });
      return { ok: true };
    }
  }
  return fail('?');
}

// ---------- КОНЕЦ РАУНДА ----------
function endRound(room) {
  const W = world.snapshot();
  const enforcement = Math.min(1, Object.values(W.zones).reduce((s, z) => s + (z.crimeN || 0), 0) / 12);

  for (const id of room.order) {
    const p = room.players[id];
    if (p.jailed > 0 || p.inJail) { p.ap = CFG.apPerRound; p.lastIncome = 0; continue; } // в тюрьме дохода нет

    let w = 0, b = 0;
    const detail = [];
    for (const a of ASSETS) {
      const st = room.assets[a.id];
      if (st?.owner !== id) continue;
      const r = income(a, room, id);
      if (r.isBlack) b += r.gross; else w += r.gross;
      detail.push({ id: a.id, name: a.name, icon: a.icon, gross: r.gross, black: r.isBlack, factors: r.factors });
      if (st.frozen > 0) st.frozen--;
      if (st.damaged > 0) st.damaged--;
    }
    if (p.tender) w += p.tender;
    if (p.protection) w -= 12000;

    // расходы палева
    const heatCost = Math.round(p.heat * 400);
    w -= heatCost;

    // долг по неоплаченной аренде списывается первым делом из белого дохода
    if (p.debt > 0 && w > 0) {
      const payoff = Math.min(p.debt, w);
      p.debt -= payoff; w -= payoff;
    }

    p.white += w; p.black += b;
    p.lastIncome = w + b;
    p.incomeDetail = detail;
    p.heatCostLast = heatCost;

    // палево остывает
    p.heat = Math.max(0, p.heat - CFG.heatDecay);
    if (p.insider > 0) p.insider--;

    // следствие: реальные новости о коррупции усиливают прокурора.
    // базовый риск — не чистый 0, а минимальный «фоновый шум» — иначе громкие следствия
    // совсем не видны, когда heat близко к 0 и новостей мало (enforcement ≈ 0).
    // инсайдер гасит риск на 30%, а не вычитается из него насухую сумму (то уходило в минус и полностью
    // обнуляло следствие до конца действия инсайдера).
    const baseRisk = Math.max(0.025, (p.heat / 160) + enforcement * 0.18);
    const risk = p.insider > 0 ? baseRisk * 0.7 : baseRisk;
    if (risk > 0 && Math.random() < risk) {
      p.evidence += 1;
      log(room, 'law', { key: 'log_investigation', params: { n: p.evidence }, actorId: id });
    }
    if (p.evidence >= CFG.caseThreshold && p.caseOpen === 0) {
      p.caseOpen = 3;
      log(room, 'law', { key: 'log_case_open', actorId: id });
    }
    if (p.caseOpen > 0) {
      p.caseOpen--;
      if (p.caseOpen === 0 && p.evidence >= CFG.caseThreshold) {
        const owned = ASSETS.filter(a => room.assets[a.id]?.owner === id);
        if (owned.length && !p.offshore) {
          const victim = owned.sort((x, y) => assetValue(y, room) - assetValue(x, room))[0];
          delete room.assets[victim.id].owner;
          log(room, 'law', { key: 'log_confiscate', params: { icon: victim.icon, assetId: victim.id }, actorId: id });
        } else if (p.offshore) {
          p.offshore = false;
          log(room, 'law', { key: 'log_offshore_saved', actorId: id });
        }
        const fine = Math.min(p.white, 120000);
        p.white -= fine;
        p.jailed = 1; p.evidence = 1; p.rep -= 10;
        log(room, 'law', { key: 'log_jailed', params: { amt: fine }, actorId: id });
      }
    }
    p.ap = CFG.apPerRound;
    p.ready = false;
  }

  // события мира по зонам — только НОВЫЕ (без спама повторами)
  room.seenWorld = room.seenWorld || {};
  for (const zid of Object.keys(W.zones)) {
    const z = W.zones[zid];
    if (z.unrest >= 0.5) {
      const head = z.headlines.find(h => h.tags.includes('unrest'));
      const key = 'u:' + zid + ':' + (head?.title || '');
      if (!room.seenWorld[key]) {
        room.seenWorld[key] = 1;
        log(room, 'world', { key: 'log_unrest', params: { flag: z.flag, zoneId: z.id, title: head ? head.title.slice(0, 70) : '' } });
      }
    }
    if (z.war >= 0.6) {
      const head = z.headlines.find(h => h.tags.includes('war'));
      const key = 'w:' + zid + ':' + (head?.title || '');
      if (!room.seenWorld[key]) {
        room.seenWorld[key] = 1;
        log(room, 'world', { key: 'log_war', params: { flag: z.flag, zoneId: z.id, title: head ? head.title.slice(0, 70) : '' } });
      }
    }
  }
  for (const k of Object.keys(room.zoneBribe)) {
    room.zoneBribe[k].rounds--;
    if (room.zoneBribe[k].rounds <= 0) {
      log(room, 'corrupt', { key: 'log_mayor_expired', params: { zoneId: k } });
      delete room.zoneBribe[k];
    }
  }

  room.round++;
  room.roundEndsAt = Date.now() + CFG.roundMs;
  checkWin(room);
}

function finish(room) {
  room.finished = true;
  const rank = room.order.map(id => room.players[id]).sort((a, b) => netWorth(room, b) - netWorth(room, a));
  log(room, 'win', { key: 'log_game_over', actorId: rank[0]?.id });
}

function fmt(n) { return (Math.round(n) || 0).toLocaleString('ru-RU'); }

// ---------- БОТЫ ----------
const BOT_NAMES = ['Don Vito', 'Madame Li', 'The Colonel', 'Baron F.'];
function botTurn(room, p) {
  if (p.jailed > 0) return;
  let guard = 5;
  while (p.ap > 0 && guard-- > 0) {
    if (p.caseOpen > 0 && p.black > 150000 && Math.random() < 0.8) { doAction(room, p.id, 'bribe_prosecutor'); continue; }
    if (p.heat > 65 && Math.random() < 0.5) { doAction(room, p.id, 'buy_inspector'); continue; }
    if (p.black > 250000 && Math.random() < 0.5) { doAction(room, p.id, 'launder', { amount: p.black * 0.7 }); continue; }
    const free = ASSETS.filter(a => !room.assets[a.id]?.owner);
    const affordable = free.filter(a => (a.kind === 'crime' ? p.black >= assetValue(a, room) * 0.7 : p.white >= assetValue(a, room)));
    if (affordable.length && Math.random() < 0.75) {
      const best = affordable.map(a => ({ a, s: income(a, room, p.id).gross / assetValue(a, room) }))
        .sort((x, y) => y.s - x.s)[0].a;
      if (doAction(room, p.id, 'buy', { assetId: best.id }).ok) continue;
    }
    if (!p.protection && p.black > 120000 && Math.random() < 0.4) { doAction(room, p.id, 'protection'); continue; }
    if (p.influence >= 4 && p.black >= 90000 && Math.random() < 0.35) {
      const z = Object.keys(world.ZONES)[Math.floor(Math.random() * 6)];
      if (doAction(room, p.id, 'bribe_mayor', { zone: z }).ok) continue;
    }
    if (p.black > 150000 && Math.random() < 0.3) {
      const targets = ASSETS.filter(a => { const o = room.assets[a.id]?.owner; return o && o !== p.id; });
      if (targets.length) {
        const t = targets[Math.floor(Math.random() * targets.length)];
        if (doAction(room, p.id, Math.random() < 0.5 ? 'audit_rival' : 'raid', { assetId: t.id }).ok) continue;
      }
    }
    if (p.white > 200000 && Math.random() < 0.5) { doAction(room, p.id, 'lobby'); continue; }
    break;
  }
}

/**
 * Реакция бота на события, которые могут возникать НЕ в его ход: аукционы (боты делают
 * ставки), входящие сделки (propose_trade к боту — бот решает принять/отказаться),
 * и предложения offer_asset (выставленные игроками объекты на продажу). Вызывается
 * каждый тик для каждого бота в комнате, независимо от того, чей сейчас ход.
 */
function botReact(room, p) {
  if (!p || p.eliminated) return;
  // аукцион: бот с шансом перебивает, если актив ему выгоден и монет хватает
  const au = room.auction;
  if (au && !au.closed && au.currentBidder !== p.id && !(au.passed || []).includes(p.id)) {
    const a = ASSET_BY_ID[au.assetId];
    if (a) {
      const fairValue = assetValue(a, room);
      const worthIt = income(a, room, p.id).gross / Math.max(1, au.currentBid) > 0.08; // грубая оценка выгоды
      const nextMin = au.currentBid + Math.max(2000, Math.round(au.currentBid * 0.1));
      if (worthIt && nextMin <= fairValue * 1.4 && p.white >= nextMin && Math.random() < 0.7) {
        doAction(room, p.id, 'auction_bid', { amount: nextMin });
      } else if (Math.random() < 0.5) {
        doAction(room, p.id, 'auction_pass', {});
      }
    }
  }
  // входящие торговые сделки, адресованные этому боту
  const trades = (room.trades || []).filter(tr => tr.to === p.id);
  for (const tr of trades) {
    const from = room.players[tr.from];
    if (!from) { room.trades = room.trades.filter(x => x.id !== tr.id); continue; }
    // прикидывается грубая оценка выгоды: сравнивает стоимости обеих сторон сделки
    const giveA = tr.giveAssetId ? ASSET_BY_ID[tr.giveAssetId] : null;
    const wantA = tr.wantAssetId ? ASSET_BY_ID[tr.wantAssetId] : null;
    const giveVal = giveA ? assetValue(giveA, room) : 0;
    const wantVal = wantA ? assetValue(wantA, room) : 0;
    // нетто-выгода для бота (принимающего): что он получает минус что отдаёт, плюс денежная разница
    const netForBot = giveVal - wantVal + (tr.cashDelta || 0);
    const canAfford = tr.cashDelta > 0 ? true : (tr.cashDelta < 0 ? p.white >= -tr.cashDelta : true);
    if (netForBot >= -5000 && canAfford) {
      doAction(room, p.id, 'accept_trade', { tradeId: tr.id });
    } else if (Math.random() < 0.6) {
      doAction(room, p.id, 'decline_trade', { tradeId: tr.id });
    }
  }
  // выставленные игроками предложения купить (offer_asset) — бот иногда покупает, если выгодно
  const offers = (room.offers || []).filter(o => o.from !== p.id);
  for (const o of offers) {
    const a = ASSET_BY_ID[o.assetId];
    if (!a) continue;
    const st = room.assets[a.id];
    if (!st || st.owner !== o.from) continue; // уже продано/неактуально
    const fairValue = assetValue(a, room);
    if (p.white >= o.price && o.price <= fairValue * 1.15 && Math.random() < 0.4) {
      doAction(room, p.id, 'accept_offer', { assetId: o.assetId });
    }
  }
}

// ---------- ВИД ДЛЯ КЛИЕНТА ----------
function view(room, pid) {
  const W = world.snapshot();
  return {
    cfg: { totalRounds: CFG.totalRounds, roundMs: CFG.roundMs, apPerRound: CFG.apPerRound,
           rollMs: CFG.rollMs, decideMs: CFG.decideMs, winGoal: CFG.winGoal },
    room: {
      id: room.id, isPublic: room.isPublic, withBots: room.withBots, title: room.title,
      round: room.round, roundEndsAt: room.roundEndsAt, matchEndsAt: room.matchEndsAt,
      finished: room.finished, winner: room.winner, log: room.log.slice(0, 40), zoneBribe: room.zoneBribe,
      phase: room.phase, phaseEndsAt: room.phaseEndsAt, lastRoll: room.lastRoll,
      order: room.order,   // порядок вступления в игру — клиент привязывает к него цвет игрока, чтобы
      // он был стабильным и не менялся при каждой смене рейтинга (players сортируется по netWorth).
      currentPid: currentPlayerId(room), offers: room.offers || [],
      trades: room.trades || [], auction: room.auction || null,
      diceOracle: room.diceOracle ? {
        commitment: room.diceOracle.commitment,
        nonce: room.diceOracle.nonce,
        rollCount: (room.diceRolls || []).length,
        rolls: room.finished ? (room.diceRolls || []) : (room.diceRolls || []).slice(-10),
        revealedSeed: room.finished ? room.diceOracle.revealed : null,
      } : null,
      // Раскрываем только 2 из 4 слотов цепочки (revealIdx). Остальные — только
      // синонимичная подсказка, а не точное название бизнеса. Если у игрока уже есть
      // объект, входящий в цепочку (даже "скрытый" слот) — этот слот раскрывается ему лично.
      chains: (room.chains || []).map(c => {
        const slots = c.props.map((propId, i) => {
          const forcedReveal = pid && room.assets[propId]?.owner === pid;
          const revealed = c.revealIdx.includes(i) || forcedReveal;
          return revealed
            ? { revealed: true, propId }
            : { revealed: false, clue: c.clues[i], clueEn: c.cluesEn[i] };
        });
        return {
          id: c.id, name: c.name, nameEn: c.nameEn, slots,
          rentMult: c.rentMult, bonus: c.bonus,
          claimedBy: (room.chainClaimed || {})[c.id] || null,
        };
      }),
    },
    board: B.BOARD.map((c, i) => ({
      i, type: c.type, name: c.name, nameEn: c.nameEn, propId: c.propId || null,
      owner: c.propId ? (room.assets[c.propId]?.owner || null) : null,
    })),
    fees: B.FEES,
    me: pid && room.players[pid] ? {
      ...room.players[pid],
      netWorth: netWorth(room, room.players[pid]),
    } : null,
    players: room.order.map(id => {
      const p = room.players[id];
      const nw = netWorth(room, p);
      const isMe = id === pid;
      // Капитал в деньгах виден только владельцу. Остальным — только качественный
      // ранг (тир от 1 до 5 к цели), чтобы рейтинг игроков оставался осмысленным.
      const tier = Math.max(1, Math.min(5, Math.ceil((nw / CFG.winGoal) * 5)));
      return {
        id, name: p.name, isBot: p.isBot, pfp: p.pfp, heat: p.heat, rep: p.rep,
        evidence: p.evidence, caseOpen: p.caseOpen, jailed: p.jailed,
        netWorth: nw,   // капитал в деньгах виден всем — чтобы отстающие видели разрыв и вовремя сдавались
        tier,                          // остальным — только качественный ранг
        lastIncome: isMe ? p.lastIncome : null,
        assets: ASSETS.filter(a => room.assets[a.id]?.owner === id).length,
        pos: p.pos || 0, inJail: !!p.inJail, skipTurns: p.skipTurns || 0,
        chains: p.chains || [], debt: isMe ? (p.debt || 0) : null,
        eliminated: !!p.eliminated,
      };
    }).sort((a, b) => (b.netWorth ?? -1) - (a.netWorth ?? -1) || b.tier - a.tier),
    zones: Object.values(W.zones).map(z => ({
      id: z.id, name: z.name, nameEn: z.nameEn, flag: z.flag, landmarks: z.landmarks || [], unrest: z.unrest, war: z.war, crime: z.crime,
      unrestN: z.unrestN, warN: z.warN, crimeN: z.crimeN, weather: z.weather,
      headlines: z.headlines?.slice(0, 4) || [],
      assets: ASSETS.filter(a => a.zone === z.id).map(a => {
        const st = room.assets[a.id] || {};
        const inc = income(a, room, st.owner || pid);
        return {
          ...a, owner: st.owner || null,
          ownerName: st.owner ? room.players[st.owner]?.name : null,
          frozen: st.frozen || 0, damaged: st.damaged || 0,
          value: assetValue(a, room), income: inc.gross, factors: inc.factors,
          rentDue: st.owner && st.owner !== pid ? Math.max(0, Math.round(inc.gross * 0.5 * TURN.chainRentMult(room, st.owner, a.id))) : 0,
          pos: B.POS_BY_PROP[a.id],
        };
      }),
    })),
    markets: Object.values(W.markets),
    worldTs: W.ts, worldLive: W.live,
    decksLeft: {
      chance: (room.decks?.chance?.length) ?? B.CHANCE.length,
      chest: (room.decks?.chest?.length) ?? B.CHEST.length,
    },
    cards: [...B.CHANCE, ...B.CHEST].map(c => ({ id: c.id, text: c.text, textEn: c.textEn, icon: c.icon, title: c.title, titleEn: c.titleEn })),
    actions: ACTIONS,
  };
}

module.exports = { CFG, ASSETS, currentPlayerId, advanceTurn, checkWin, checkChains: TURN.checkChains, surrenderPlayer, BOARD: B.BOARD, FEES: B.FEES, ASSET_BY_ID, rooms, getRoom, addPlayer, doAction, endRound, view, botTurn, botReact, netWorth, log, BOT_NAMES, newRoom, fmt };
