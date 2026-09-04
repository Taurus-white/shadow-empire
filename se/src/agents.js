/**
 * SHADOW EMPIRE — режим для ИИ-агентов + каркас x402 (HTTP 402 Payment Required).
 *
 * ЧТО ЭТО: агент (ИИ-программа) может играть через REST API вместо браузера.
 * Вход в агентский стол платный по стандарту x402 — оплата за запрос,
 * без регистрации, аккаунтов и API-ключей: сервер отвечает 402 с ценой,
 * клиент присылает подписанный платёж в заголовке PAYMENT-SIGNATURE.
 *
 * ФИЛЬТРАЦИЯ: агенты и люди играют за РАЗНЫМИ столами (rooms).
 *   - room 'main'   — только люди (агентам вход закрыт)
 *   - room 'agents' — только агенты (нужен валидный x402-платёж)
 *   - room 'mixed'  — люди vs агенты (агент обязан себя помечать)
 * Агент обязан присылать заголовок X-Agent: <name>, иначе получает 403.
 */

const crypto = require('crypto');

const X402 = {
  // ВНИМАНИЕ: адрес получателя платежей — заменить на свой перед продакшеном
  payTo: process.env.X402_PAY_TO || '0x0000000000000000000000000000000000000000',
  // BSC mainnet в формате CAIP-2
  network: process.env.X402_NETWORK || 'eip155:56',
  // токен REBBE47
  asset: process.env.X402_ASSET || '0x92b49accc1c13b0d55e6398D6B482a195ee24C9b',
  assetName: 'REBBE47',
  decimals: 18,
  // цена входа за агентский стол (в минимальных единицах токена)
  seatPrice: process.env.X402_SEAT_PRICE || '1000000000000000000000', // 1000 REBBE47
  maxTimeoutSeconds: 120,
  // facilitator для verify/settle. Пусто = режим разработки (платёж не проверяется)
  facilitator: process.env.X402_FACILITATOR || '',
  devMode: !process.env.X402_FACILITATOR,
};

/** Тело ответа 402 по спецификации x402 v2. */
function paymentRequired(resource) {
  return {
    x402Version: 2,
    error: 'PAYMENT_REQUIRED',
    accepts: [{
      scheme: 'exact',
      network: X402.network,
      resource,
      description: 'Seat at the SHADOW EMPIRE agents table',
      mimeType: 'application/json',
      payTo: X402.payTo,
      asset: X402.asset,
      amount: X402.seatPrice,
      maxTimeoutSeconds: X402.maxTimeoutSeconds,
      extra: {
        // ВАЖНО: REBBE47 не реализует EIP-3009 (transferWithAuthorization),
        // поэтому единственный рабочий путь — Permit2 (универсальный фолбэк x402).
        assetTransferMethod: 'permit2',
        name: X402.assetName,
        version: '1',
      },
    }],
  };
}

/** Заголовок PAYMENT-REQUIRED (base64 JSON) для транспорта v2. */
function paymentRequiredHeader(resource) {
  return Buffer.from(JSON.stringify(paymentRequired(resource))).toString('base64');
}

/**
 * Проверка платежа. В dev-режиме (без facilitator) принимаем любой непустой
 * PAYMENT-SIGNATURE, чтобы можно было тестировать агентов без реальных денег.
 * В продакшене — POST /verify и POST /settle к facilitator.
 */
async function verifyPayment(sigHeader, resource) {
  if (!sigHeader) return { ok: false, reason: 'no PAYMENT-SIGNATURE header' };
  if (X402.devMode) {
    return { ok: true, dev: true, txHash: 'dev:' + crypto.createHash('sha1').update(sigHeader).digest('hex').slice(0, 16) };
  }
  try {
    const payload = JSON.parse(Buffer.from(sigHeader, 'base64').toString('utf8'));
    const body = { x402Version: 2, paymentPayload: payload, paymentRequirements: paymentRequired(resource).accepts[0] };
    const vr = await fetch(X402.facilitator.replace(/\/$/, '') + '/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json());
    if (!vr?.isValid) return { ok: false, reason: vr?.invalidReason || 'verify failed' };
    const sr = await fetch(X402.facilitator.replace(/\/$/, '') + '/settle', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json());
    if (!sr?.success) return { ok: false, reason: sr?.errorReason || 'settle failed' };
    return { ok: true, txHash: sr.transaction || sr.txHash || null };
  } catch (e) {
    return { ok: false, reason: 'x402 error: ' + e.message };
  }
}

// ---------- СЕССИИ АГЕНТОВ ----------
const seats = new Map(); // token -> {pid, agent, roomId, paidAt, txHash, expiresAt}
const SEAT_TTL_MS = 3 * 60 * 60 * 1000;

function issueSeat(agentName, roomId, txHash) {
  const token = crypto.randomBytes(24).toString('hex');
  const pid = 'agent_' + crypto.randomBytes(5).toString('hex');
  const seat = { pid, agent: agentName, roomId, paidAt: Date.now(), txHash, expiresAt: Date.now() + SEAT_TTL_MS };
  seats.set(token, seat);
  return { token, ...seat };
}

function getSeat(token) {
  const s = token && seats.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { seats.delete(token); return null; }
  return s;
}

/** Правила фильтрации столов: кто куда может сесть. */
const TABLES = {
  main:   { who: 'humans', label: 'Только люди' },
  agents: { who: 'agents', label: 'Только агенты (x402)' },
  mixed:  { who: 'both',   label: 'Люди против агентов' },
};

function canJoin(roomId, isAgent) {
  const t = TABLES[roomId];
  if (!t) return { ok: false, reason: 'unknown table' };
  if (t.who === 'humans' && isAgent) return { ok: false, reason: 'agents are not allowed at this table' };
  if (t.who === 'agents' && !isAgent) return { ok: false, reason: 'humans are not allowed at the agents table' };
  return { ok: true };
}

/** Машиночитаемое описание игры для агентов (self-discovery). */
function agentManifest(baseUrl) {
  return {
    name: 'SHADOW EMPIRE',
    version: '0.3',
    description: 'Monopoly-style board game synced with real world markets, weather and news. Corruption and crime mechanics.',
    tables: Object.entries(TABLES).map(([id, t]) => ({ id, ...t })),
    payment: {
      standard: 'x402',
      version: 2,
      network: X402.network,
      asset: X402.asset,
      assetSymbol: X402.assetName,
      amount: X402.seatPrice,
      assetTransferMethod: 'permit2',
      note: 'REBBE47 has no EIP-3009 support, so Permit2 is used (x402 universal fallback).',
      devMode: X402.devMode,
    },
    endpoints: {
      manifest: 'GET /api/agent/manifest',
      seat: 'POST /api/agent/seat  (402 until paid; header X-Agent required)',
      state: 'GET /api/agent/state?token=…',
      act: 'POST /api/agent/act?token=…  body {act, arg}',
    },
    actions: [
      'roll', 'end_turn', 'buy', 'pay_rent', 'pay_bail', 'sell_bank', 'offer_asset', 'accept_offer',
      'bribe_mayor', 'tender', 'lobby', 'launder', 'skim', 'kickback', 'protection', 'buy_inspector',
      'audit_rival', 'raid', 'buyout', 'seize', 'bribe_prosecutor', 'snitch', 'offshore',
    ],
    rules: baseUrl ? baseUrl + '/rules.html' : '/rules.html',
  };
}

module.exports = {
  X402, paymentRequired, paymentRequiredHeader, verifyPayment,
  issueSeat, getSeat, seats, TABLES, canJoin, agentManifest,
};
