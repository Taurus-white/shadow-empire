/**
 * WORLD ENGINE — тянет реальные данные и нормализует их в игровые модификаторы.
 * Источники (все бесплатные, без ключей):
 *   - Yahoo Finance chart API : нефть, золото, газ, пшеница, BTC, RUB, S&P500
 *   - Open-Meteo             : погода по координатам зон
 *   - Google News RSS        : война / протесты / санкции по каждой зоне
 * Клиент НИКОГДА не ходит наружу — только сюда. Кэш + фолбэк на последний снапшот.
 */

const UA = 'Mozilla/5.0 (compatible; ShadowEmpireBot/0.1)';

const TICKERS = {
  oil:   { sym: 'CL=F',    label: 'Нефть WTI',  labelEn: 'Oil WTI',   unit: '$' },
  gold:  { sym: 'GC=F',    label: 'Золото',     labelEn: 'Gold',      unit: '$' },
  gas:   { sym: 'NG=F',    label: 'Газ',        labelEn: 'Gas',       unit: '$' },
  wheat: { sym: 'ZW=F',    label: 'Пшеница',    labelEn: 'Wheat',     unit: 'c' },
  btc:   { sym: 'BTC-USD', label: 'Bitcoin',    labelEn: 'Bitcoin',   unit: '$' },
  rub:   { sym: 'RUB=X',   label: 'USD/RUB',    labelEn: 'USD/RUB',   unit: '₽' },
  spx:   { sym: '^GSPC',   label: 'S&P 500',    labelEn: 'S&P 500',   unit: '' },
  chips: { sym: 'SOXX',    label: 'Полупроводники', labelEn: 'Semiconductors', unit: '$' },
};

// Зоны игры = реальные точки на карте
const ZONES = {
  basra:   { name: 'Басра · Ормуз',    nameEn: 'Basra · Hormuz',    flag: '🛢️', landmarks: ['🕌','🛕','⚓'], lat: 30.5,  lon: 47.8,
             q: 'Hormuz OR Iraq oil OR Iran oil OR refinery strike' },
  joburg:  { name: 'Йоханнесбург',     nameEn: 'Johannesburg',      flag: '⛏️', landmarks: ['🏰','🦒','💎'], lat: -26.2, lon: 28.04,
             q: 'South Africa gold mine OR mining strike OR Johannesburg unrest' },
  dubai:   { name: 'Дубай',            nameEn: 'Dubai',             flag: '🏙️', landmarks: ['🏢','🏜️','🛍️'], lat: 25.2,  lon: 55.27,
             q: 'Dubai gold OR UAE sanctions OR Gulf trade' },
  taipei:  { name: 'Тайбэй',           nameEn: 'Taipei',            flag: '🔌', landmarks: ['🗼','🏮','🏯'], lat: 25.03, lon: 121.56,
             q: 'Taiwan semiconductor OR TSMC OR chip export controls OR Taiwan strait' },
  zurich:  { name: 'Цюрих',            nameEn: 'Zurich',            flag: '🏦', landmarks: ['⛰️','🔔','🍫'], lat: 47.37, lon: 8.54,
             q: 'Switzerland banking OR Swiss secrecy OR sanctions evasion OR banking scandal' },
  odesa:   { name: 'Одесса · Порт',    nameEn: 'Odesa · Port',      flag: '🌾', landmarks: ['🏛️','⚓','🏖️'], lat: 46.48, lon: 30.73,
             q: 'Black Sea grain OR Odesa port OR shipping insurance war' },
};

const UNREST_WORDS = ['protest','riot','unrest','clash','strike','curfew','crackdown','demonstrat','looting','arrest','полиц','протест'];
const WAR_WORDS    = ['war','strike','missile','drone','attack','blockade','military','troops','sanction','embargo','shelling'];
const CRIME_WORDS  = ['corrupt','bribe','fraud','cartel','smuggl','launder','indict','probe','raid','seiz'];

const state = {
  ts: 0,
  live: false,
  markets: {},
  zones: {},
  errors: [],
};

async function jget(url, ms = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': UA, accept: '*/*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    return txt;
  } finally { clearTimeout(t); }
}

async function fetchTicker(key) {
  const { sym, label, labelEn, unit } = TICKERS[key];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=7d`;
  const raw = await jget(url);
  const d = JSON.parse(raw);
  const r = d?.chart?.result?.[0];
  if (!r) throw new Error('no result ' + sym);
  const closes = (r.indicators?.quote?.[0]?.close || []).filter(x => typeof x === 'number');
  const price = r.meta?.regularMarketPrice ?? closes.at(-1);
  const prev = r.meta?.chartPreviousClose ?? closes.at(-2) ?? price;
  const delta = prev ? (price - prev) / prev : 0;
  return { key, sym, label, labelEn, unit, price, prev, delta };
}

async function fetchMarkets() {
  const out = {};
  for (const key of Object.keys(TICKERS)) {
    try {
      out[key] = await fetchTicker(key);
    } catch (e) {
      // фолбэк: держим прошлое значение
      if (state.markets[key]) out[key] = { ...state.markets[key], stale: true };
      else out[key] = { key, sym: TICKERS[key].sym, label: TICKERS[key].label,
                        unit: TICKERS[key].unit, price: null, prev: null, delta: 0, stale: true };
      state.errors.push(`market:${key}:${e.message}`);
    }
  }
  return out;
}

async function fetchWeather() {
  const ids = Object.keys(ZONES);
  const lat = ids.map(i => ZONES[i].lat).join(',');
  const lon = ids.map(i => ZONES[i].lon).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
              `&current=temperature_2m,precipitation,wind_speed_10m`;
  const arr = JSON.parse(await jget(url));
  const list = Array.isArray(arr) ? arr : [arr];
  const out = {};
  ids.forEach((id, i) => {
    const c = list[i]?.current;
    if (c) out[id] = { t: c.temperature_2m, precip: c.precipitation, wind: c.wind_speed_10m };
  });
  return out;
}

function stripTags(s) {
  return String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function classify(title) {
  const t = title.toLowerCase();
  const tags = [];
  if (UNREST_WORDS.some(w => t.includes(w))) tags.push('unrest');
  if (WAR_WORDS.some(w => t.includes(w))) tags.push('war');
  if (CRIME_WORDS.some(w => t.includes(w))) tags.push('crime');
  return tags;
}

async function fetchNewsForZone(id) {
  const q = encodeURIComponent(ZONES[id].q);
  const url = `https://news.google.com/rss/search?q=${q}+when:2d&hl=en-US&gl=US&ceid=US:en`;
  const xml = await jget(url, 11000);
  const items = xml.split('<item>').slice(1, 26);
  const heads = items.map(it => {
    const g = (re) => (it.match(re) || [, ''])[1];
    const title = stripTags(g(/<title>([\s\S]*?)<\/title>/));
    const link = stripTags(g(/<link>([\s\S]*?)<\/link>/));
    const src = stripTags(g(/<source[^>]*>([\s\S]*?)<\/source>/));
    const date = stripTags(g(/<pubDate>([\s\S]*?)<\/pubDate>/));
    return { title, link, src, date, tags: classify(title) };
  }).filter(h => h.title);

  const unrestN = heads.filter(h => h.tags.includes('unrest')).length;
  const warN = heads.filter(h => h.tags.includes('war')).length;
  const crimeN = heads.filter(h => h.tags.includes('crime')).length;

  return {
    headlines: heads.slice(0, 8),
    unrestN, warN, crimeN,
    unrest: Math.min(1, unrestN / 6),   // 0..1
    war: Math.min(1, warN / 6),
    crime: Math.min(1, crimeN / 6),
  };
}

async function refresh() {
  state.errors = [];
  const markets = await fetchMarkets();

  let weather = {};
  try { weather = await fetchWeather(); }
  catch (e) { state.errors.push('weather:' + e.message); }

  const zones = {};
  for (const id of Object.keys(ZONES)) {
    let news = { headlines: [], unrest: 0, war: 0, crime: 0, unrestN: 0, warN: 0, crimeN: 0 };
    try { news = await fetchNewsForZone(id); }
    catch (e) {
      state.errors.push(`news:${id}:${e.message}`);
      if (state.zones[id]) news = { ...state.zones[id], stale: true };
    }
    zones[id] = {
      id, ...ZONES[id],
      weather: weather[id] || state.zones[id]?.weather || null,
      ...news,
    };
  }

  state.markets = markets;
  state.zones = zones;
  state.ts = Date.now();
  state.live = Object.values(markets).some(m => m.price && !m.stale);
  return state;
}

function snapshot() { return state; }

module.exports = { refresh, snapshot, TICKERS, ZONES };
