/**
 * SHADOW EMPIRE — ходы по кубику, клетки, карты, тюрьма, цепочки, залог банку.
 * Подключается к game.js: там остаются живой мир, доход, коррупция и следствие.
 */
const B = require('./board');

const T = {
  rollMs: 10000,     // 10 сек на бросок кубика
  decideMs: 20000,   // 20 сек на решение по событию
  winGoal: 1000000,  // победа по достижению $1M чистого капитала
  jailTurns: 2,      // «сидит 2 хода подряд, кидает на третий»
};

function rollDie() { return 1 + Math.floor(Math.random() * 6); }

/** Тасует колоду и выдаёт следующую карту (с автоперетасовкой). */
function drawCard(room, deckName) {
  const src = deckName === 'chance' ? B.CHANCE : B.CHEST;
  room.decks = room.decks || {};
  if (!room.decks[deckName] || !room.decks[deckName].length) {
    room.decks[deckName] = src.map((_, i) => i).sort(() => Math.random() - 0.5);
  }
  return src[room.decks[deckName].pop()];
}

/** Полная стоимость имущества игрока по текущим рыночным ценам. */
function propertyValue(room, pid, valueFn) {
  let v = 0;
  for (const p of B.PROPS) {
    const st = room.assets[p.id];
    if (st?.owner === pid) v += valueFn(p, room);
  }
  return v;
}

function ownedProps(room, pid) {
  return B.PROPS.filter(p => room.assets[p.id]?.owner === pid);
}

/**
 * Списание из банка/в банк с автопродажей активов, если не хватает.
 * Возвращает {paid, sold:[], bankrupt:bool}
 * Цена продажи банку зависит от репутации: rep 100 → 90% стоимости, rep 0 → 45%.
 */
function chargeOrSell(room, p, amount, valueFn, log) {
  const sold = [];
  let need = amount;
  const take = Math.min(p.white, need);
  p.white -= take; need -= take;
  if (need > 0) {                       // добираем налом по курсу 60%
    const use = Math.min(p.black, Math.ceil(need / 0.6));
    p.black -= use; need -= Math.round(use * 0.6);
  }
  // не хватило — продаём активы банку по цене, зависящей от репутации
  while (need > 0) {
    const owned = ownedProps(room, p.id).sort((a, b) => valueFn(a, room) - valueFn(b, room));
    if (!owned.length) break;
    const asset = owned[0];
    const rate = 0.45 + Math.max(0, Math.min(100, p.rep)) / 100 * 0.45;
    const price = Math.round(valueFn(asset, room) * rate);
    delete room.assets[asset.id].owner;
    p.white += price; sold.push({ id: asset.id, price, rate });
    const take2 = Math.min(p.white, need);
    p.white -= take2; need -= take2;
    if (log) log(room, 'law', { key: 'log_sell_bank', params: { icon: asset.icon, assetId: asset.id, amt: Math.round(price), rate: Math.round(rate * 100), rep: p.rep }, actorId: p.id });
  }
  return { paid: amount - Math.max(0, need), sold, bankrupt: need > 0 };
}

/** Проверка собранных цепочек. Первый собравший получает удвоенный бонус. */
function checkChains(room, pid, log, i18nName = 'name') {
  const p = room.players[pid];
  p.chains = p.chains || [];
  for (const ch of (room.chains || [])) {
    if (p.chains.includes(ch.id)) continue;
    const all = ch.props.every(id => room.assets[id]?.owner === pid);
    if (!all) continue;
    p.chains.push(ch.id);
    room.chainClaimed = room.chainClaimed || {};
    const first = !room.chainClaimed[ch.id];
    room.chainClaimed[ch.id] = pid;
    const bonus = first ? ch.bonus * 2 : ch.bonus;
    p.white += bonus;
    if (log) log(room, 'win', { key: 'log_chain', params: { first, chain: ch[i18nName] || ch.name, amt: bonus }, actorId: pid });
  }
}

/** Множитель аренды от собранных цепочек, в которые входит этот актив. */
function chainRentMult(room, pid, propId) {
  let m = 1;
  for (const ch of (room.chains || [])) {
    if (!ch.props.includes(propId)) continue;
    if (ch.props.every(id => room.assets[id]?.owner === pid)) m = Math.max(m, ch.rentMult);
  }
  return m;
}

/** Отправить в тюрьму. */
function sendToJail(room, p, log) {
  p.pos = 10;
  p.jailed = T.jailTurns;
  p.inJail = true;
  if (log) log(room, 'law', { key: 'log_go_jail', params: { amt: B.FEES.jailBail }, actorId: p.id });
}

/**
 * Обработка клетки, на которую встал игрок.
 * deps: { valueFn, incomeFn, log, payRent }
 * Возвращает описание события для клиента.
 */
function resolveCell(room, p, deps) {
  const { valueFn, incomeFn, log, payRent } = deps;
  const cell = B.BOARD[p.pos];
  if (!cell) return { type: 'none' };

  switch (cell.type) {
    case B.CELL.START:
      p.white += B.FEES.landStart;
      log(room, 'buy', { key: 'log_start', params: { amt: B.FEES.landStart }, actorId: p.id });
      return { type: 'start', amount: B.FEES.landStart };

    case B.CELL.PROP: {
      const prop = B.PROP_BY_ID[cell.propId];
      const st = room.assets[prop.id];
      if (!st?.owner) return { type: 'prop_free', propId: prop.id };
      if (st.owner === p.id) return { type: 'prop_own', propId: prop.id };
      // аренда владельцу — живая формула × множитель цепочки
      const inc = incomeFn(prop, room, st.owner);
      const mult = chainRentMult(room, st.owner, prop.id);
      const rent = Math.max(0, Math.round(inc.gross * 0.5 * mult));
      const r = payRent(room, p.id, prop, rent);
      const owner = room.players[st.owner];
      log(room, 'buy', { key: 'log_rent', params: { icon: prop.icon, assetId: prop.id, amt: Math.round(r.paid), mult }, actorId: p.id, targetId: owner.id });
      return { type: 'prop_rent', propId: prop.id, rent, mult, ...r };
    }

    case B.CELL.INCOME_TAX: {
      const res = chargeOrSell(room, p, B.FEES.incomeTax, valueFn, log);
      log(room, 'law', { key: 'log_tax', params: { amt: B.FEES.incomeTax }, actorId: p.id });
      return { type: 'income_tax', amount: B.FEES.incomeTax, ...res };
    }

    case B.CELL.PAY_ROOF: {
      const res = chargeOrSell(room, p, B.FEES.payRoof, valueFn, log);
      log(room, 'attack', { key: 'log_roof', params: { amt: B.FEES.payRoof }, actorId: p.id });
      return { type: 'pay_roof', amount: B.FEES.payRoof, ...res };
    }

    case B.CELL.GO_TO_JAIL:
      sendToJail(room, p, log);
      return { type: 'go_to_jail', bail: B.FEES.jailBail };

    case B.CELL.RIOTS:
      p.skipTurns = (p.skipTurns || 0) + 1;
      log(room, 'world', { key: 'log_riots', actorId: p.id });
      return { type: 'riots' };

    case B.CELL.DISASTER:
      p.skipTurns = (p.skipTurns || 0) + 1;
      log(room, 'world', { key: 'log_disaster', actorId: p.id });
      return { type: 'disaster' };

    case B.CELL.JAIL:
    case B.CELL.FREE_PARKING:
      return { type: 'safe', name: cell.name, nameEn: cell.nameEn };

    case B.CELL.CARD_CHANCE:
    case B.CELL.CARD_CHEST: {
      const deck = cell.type === B.CELL.CARD_CHANCE ? 'chance' : 'chest';
      const card = drawCard(room, deck);
      const eff = applyCard(room, p, card, deps);
      log(room, 'world', { key: 'log_card', params: { cardId: card.id }, actorId: p.id });
      // карта по-имуществу (perprop/pct) была вытянута, но у игрока нет объектов — отдельно поясняем,
      // почему деньги не списались (иначе игрок мог бы решить, что карта просто зависла).
      if (eff && eff.skipped) {
        log(room, 'world', { key: 'log_card_skipped_noprops', actorId: p.id });
      }
      return { type: 'card', deck, card, effect: eff };
    }
  }
  return { type: 'none' };
}

/** Применение эффекта карты. */
function applyCard(room, p, card, deps) {
  const { valueFn, log } = deps;
  switch (card.kind) {
    case 'gain':
      p.white += card.amount;
      return { gained: card.amount };
    case 'pay':
      return chargeOrSell(room, p, card.amount, valueFn, log);
    case 'move': {
      if (card.to === 0) { p.pos = 0; p.white += card.amount || 0; }
      else p.pos = card.to;
      return { movedTo: p.pos, gained: card.amount || 0 };
    }
    case 'jail':
      sendToJail(room, p, log);
      return { jailed: true };
    case 'perprop': {
      const n = ownedProps(room, p.id).length;
      // нет своих объектов — карта не должна срабатывать: ничего не списываем и не логируем как оплату/продажу актива
      if (n === 0) return { perProp: card.amount, count: 0, total: 0, paid: 0, sold: [], bankrupt: false, skipped: true };
      const total = card.amount * n;
      const r = chargeOrSell(room, p, total, valueFn, log);
      return { perProp: card.amount, count: n, total, ...r };
    }
    case 'pct': {
      const propVal = propertyValue(room, p.id, valueFn);
      // нет игущества — нет базы для % налога/штрафа, карта не срабатывает
      if (propVal <= 0) return { pct: card.pct, total: 0, paid: 0, sold: [], bankrupt: false, skipped: true };
      const total = Math.round(propVal * card.pct);
      const r = chargeOrSell(room, p, total, valueFn, log);
      return { pct: card.pct, total, ...r };
    }
    case 'fromall': {
      let got = 0;
      for (const id of room.order) {
        if (id === p.id) continue;
        const other = room.players[id];
        const r = chargeOrSell(room, other, card.amount, valueFn, log);
        got += r.paid;
      }
      p.white += got;
      return { collected: got };
    }
  }
  return {};
}

/** Бросок кубика и перемещение (без разрешения клетки — это отдельный шаг,
 * чтобы вызывающий код мог залогировать сам бросок ПЕРЕД событием клетки —
 * иначе в хронике сначала видно последствие («стихийное бедствие»), а потом
 * сам бросок, что выглядит как перепутанный порядок событий). */
function rollAndMove(room, p) {
  const d1 = rollDie(), d2 = rollDie();
  const steps = d1 + d2;
  const from = p.pos || 0;
  let to = (from + steps) % 40;
  let passedStart = false;
  if (from + steps >= 40 && to !== 0) {
    p.white += B.FEES.passStart;
    passedStart = true;
  }
  p.pos = to;
  return { d1, d2, steps, from, to, passedStart };
}

/** Старое API (бросок + сразу разрешение клетки) — оставлено для совместимости. */
function doRoll(room, p, deps) {
  const mv = rollAndMove(room, p);
  const event = resolveCell(room, p, deps);
  return { ...mv, event };
}

module.exports = {
  T, rollDie, rollAndMove, doRoll, resolveCell, applyCard, drawCard,
  chargeOrSell, checkChains, chainRentMult, sendToJail,
  propertyValue, ownedProps,
};
