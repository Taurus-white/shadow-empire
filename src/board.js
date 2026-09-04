/**
 * SHADOW EMPIRE — доска 40 клеток, цепочки-монополии, колода карт.
 *
 * МАСШТАБ ДЕНЕГ: суммы карт/налогов заданы в "монопольных" числах из ТЗ
 * и умножаются на MONEY_SCALE, чтобы соответствовать масштабу активов ($180–450K).
 * Хотите классические мелкие суммы — поставьте MONEY_SCALE = 1.
 */
const MONEY_SCALE = 3;   // масштаб сумм на картах (числа из ТЗ × 3)
const M = n => Math.round(n * MONEY_SCALE);

// ---------- РАСКЛАДКА 40 КЛЕТОК ----------
// 1 START + 26 бизнесов + 6 карточных + 7 спец = 40
// (арифметика: 28 бизнесов не влезают вместе с 6 карточными и 7 спец — взял 26)
const CELL = {
  START: 'start',
  PROP: 'prop',            // бизнес (легал/серое/крим)
  CARD_CHANCE: 'chance',   // «Шанс»
  CARD_CHEST: 'chest',     // «Общественная казна»
  JAIL: 'jail',            // сама тюрьма (посещение — безопасно)
  GO_TO_JAIL: 'go_to_jail',
  FREE_PARKING: 'free_parking',
  INCOME_TAX: 'income_tax',
  PAY_ROOF: 'pay_roof',
  RIOTS: 'riots',
  DISASTER: 'disaster',
};

// Бизнесы: 6 городов, в каждом 2 легал + 1 серое + (1–2) крим = 26 клеток.
// price/base — в тех же деньгах, что и раньше; link — тикер живого рынка.
// beta — плечо к рынку, warB — реакция на войну, unrestB — на беспорядки, wx — погода.
const P = (id, zone, name, nameEn, icon, price, base, link, beta, warB, unrestB, wx, kind, chain) =>
  ({ id, zone, name, nameEn, icon, price, base, link, beta, warB, unrestB, wx, kind, chain });

const PROPS = [
  // Басра · Ормуз (нефть)
  P('bas_oil',  'basra', 'Нефтебаза',           'Oil depot',        '🛢️', 64000, 14100, 'oil',  3.0,  0.55, 0.25, null,   'legal', 'energy'),
  P('bas_ref',  'basra', 'Мини-НПЗ',            'Mini refinery',    '⚙️', 58500, 12900, 'oil',  2.6,  0.40, 0.30, null,   'legal', 'energy'),
  P('bas_tank', 'basra', 'Танкер «Аль-Хур»',     'Tanker "Al-Khor"', '🚢', 52500, 11600, 'oil',  2.2,  0.75, 0.10, 'storm','grey',  null),
  P('bas_smug', 'basra', 'Слив топлива',         'Fuel skimming',    '🛴', 31000, 6800, 'oil',  1.6,  0.60, 0.35, null,   'crime', null),
  P('bas_tap',  'basra', 'Врезка в трубу',       'Pipeline tap',     '🕳️', 29000, 6400, 'oil',  1.9,  0.65, 0.40, null,   'crime', null),

  // Йоханнесбург (золото) — старт цепочки «золото → ювелирка → чипы → банк»
  P('joh_mine', 'joburg','Золотой прииск',       'Gold mine',        '⛏️', 68500, 15100, 'gold', 2.8,  0.30, 0.35, null,   'legal', 'gold'),
  P('joh_ref',  'joburg','Аффинажный завод',     'Gold refinery',    '🏭', 55500, 12200, 'gold', 2.2,  0.25, 0.30, null,   'legal', 'gold'),
  P('joh_sec',  'joburg','ЧОП «Гарант»',         'Security firm',    '🦺', 25000, 5500, 'spx',  0.4,  0.25,-0.80, null,   'grey',  null),
  P('joh_cash', 'joburg','Обнал через ломбард',  'Pawnshop cash-out','💰', 32500, 7200, 'gold', 1.7,  0.35, 0.30, null,   'crime', null),

  // Дубай (ювелирка + хавала)
  P('dxb_jew',  'dubai', 'Ювелирный салон',      'Jewelry store',    '💎', 61500, 13500, 'gold', 2.4,  0.35, 0.20, null,   'legal', 'gold'),
  P('dxb_hot',  'dubai', 'Отель «Мираж»',        'Hotel "Mirage"',   '🏨', 58500, 12900, 'spx',  1.2, -0.50, 0.55, 'heat', 'legal', null),
  P('dxb_gold', 'dubai', 'Золотая лавка',        'Gold shop',        '🪙', 45000, 9900, 'gold', 2.4,  0.35, 0.20, null,   'grey',  null),
  P('dxb_exch', 'dubai', 'Обменник «Хавала»',    'Hawala exchange',  '💱', 33500, 7400, 'btc',  1.5,  0.45, 0.15, null,   'crime', null),

  // Тайбэй (полупроводники)
  P('tpe_fab',  'taipei','Завод полупроводников','Semiconductor fab','🔌', 70000, 15400, 'spx',  2.0, -0.35, 0.25, null,   'legal', 'chips'),
  P('tpe_asm',  'taipei','Сборочный цех',        'Assembly plant',   '🧩', 51000, 11200, 'spx',  1.5, -0.25, 0.35, null,   'legal', 'chips'),
  P('tpe_ware', 'taipei','Бондовый склад',       'Bonded warehouse', '📥', 42500, 9400, 'spx',  1.0,  0.20, 0.45, 'storm','grey',  null),
  P('tpe_grey', 'taipei','Серый импорт чипов',   'Grey chip import', '📦', 35000, 7700, 'spx',  1.6,  0.30, 0.30, null,   'crime', null),

  // Цюрих (банки)
  P('zur_bank', 'zurich','Частный банк',         'Private bank',     '🏦', 62500, 13800, 'spx',  1.4, -0.30, 0.10, null,   'legal', 'bank'),
  P('zur_trust','zurich','Трастовый фонд',       'Trust fund',       '📜', 54000, 11900, 'spx',  1.3, -0.25, 0.10, null,   'legal', 'bank'),
  P('zur_vault','zurich','Хранилище',            'Vault service',    '🔐', 44000, 9700, 'gold', 1.6,  0.20, 0.10, null,   'grey',  null),
  P('zur_shell','zurich','Банк без вопросов',    'No-questions bank','🕵️', 41000, 9000, 'btc',  1.7,  0.20, 0.10, null,   'crime', null),

  // Одесса (зерно)
  P('ods_term', 'odesa', 'Зернотерминал',        'Grain terminal',   '🌾', 54000, 11900, 'wheat',2.5, -0.30, 0.40, 'storm','legal', 'food'),
  P('ods_mill', 'odesa', 'Мукомольный завод',    'Flour mill',       '🌽', 46500, 10200, 'wheat',2.0, -0.20, 0.35, null,   'legal', 'food'),
  P('ods_ins',  'odesa', 'Страховка грузов',     'Cargo insurance',  '📄', 38000, 8400, 'wheat',1.2,  0.85, 0.20, null,   'grey',  null),
  P('ods_grey', 'odesa', '«Серый» коридор',      'Grey corridor',    '📦', 32500, 7200, 'wheat',1.8,  0.70, 0.45, 'storm','crime', null),
];

/**
 * ЦЕПОЧКИ («монополии нового типа»): не по цвету, а по реальной
 * производственной логике через разные города.
 * Игрок, собравший всю цепочку, получает множитель к аренде и разовый бонус.
 * Первый собравший цепочку в партии получает удвоенный разовый бонус.
 */
// Каждая цепочка — 4 предприятия. clues/cluesEn — синонимичные, размытые подсказки
// (НЕ точные названия бизнеса), по одной на каждый из 4 слотов. На клиенте раскрываются
// только 2 случайных слота из 4 — угадывать оставшиеся два нужно самому.
const CHAIN_TEMPLATES = [
  {
    id: 'gold_to_bank',
    name: 'Золотой контур', nameEn: 'Gold circuit',
    props: ['joh_mine', 'dxb_jew', 'tpe_fab', 'zur_bank'],
    clues: ['жёлтый металл из-под земли', 'блеск для запястья', 'кремний и провода', 'сейф с процентом'],
    cluesEn: ['yellow metal from the ground', 'shine for the wrist', 'silicon and wires', 'a vault with interest'],
    rentMult: 2.2, bonus: 150000,
  },
  {
    id: 'energy_chain',
    name: 'Чёрное золото', nameEn: 'Black gold',
    props: ['bas_oil', 'bas_ref', 'bas_tank', 'joh_ref'],
    clues: ['качает из скважины', 'варит в котлах', 'плавает по морю', 'плавит в слитки'],
    cluesEn: ['pumps from a well', 'boils in tanks', 'floats on the sea', 'melts into bars'],
    rentMult: 1.9, bonus: 120000,
  },
  {
    id: 'food_chain',
    name: 'Хлебный путь', nameEn: 'Bread route',
    props: ['ods_term', 'ods_mill', 'ods_ins', 'tpe_ware'],
    clues: ['колосья у моря', 'жёрнов крутится', 'бумага против шторма', 'ящики под пломбой'],
    cluesEn: ['grain by the sea', 'the millstone turns', 'paper against the storm', 'sealed crates'],
    rentMult: 1.8, bonus: 100000,
  },
  {
    id: 'wash_chain',
    name: 'Тихие деньги', nameEn: 'Quiet money',
    props: ['dxb_exch', 'zur_shell', 'zur_vault', 'joh_cash'],
    clues: ['слово без бумаги', 'банк без вопросов', 'дверь толще стены', 'ломбард на углу'],
    cluesEn: ['a word instead of paper', 'a bank that asks nothing', 'a door thicker than the wall', 'the corner pawnshop'],
    rentMult: 2.0, bonus: 130000,
  },
  {
    id: 'chip_chain',
    name: 'Кремниевый след', nameEn: 'Silicon trail',
    props: ['tpe_fab', 'tpe_asm', 'tpe_grey', 'dxb_gold'],
    clues: ['чистая комната и маски', 'руки собирают плату', 'груз без декларации', 'лавка с весами'],
    cluesEn: ['a clean room and masks', 'hands assembling a board', 'cargo with no paperwork', 'a shop with scales'],
    rentMult: 1.9, bonus: 115000,
  },
  {
    id: 'smuggle_chain',
    name: 'Ночной коридор', nameEn: 'Night corridor',
    props: ['bas_smug', 'bas_tap', 'ods_grey', 'zur_shell'],
    clues: ['канистры в темноте', 'дырка в металле', 'фура без опознавания', 'банк без вопросов'],
    cluesEn: ['jerry cans in the dark', 'a hole cut in metal', 'an unmarked truck', 'a bank that asks nothing'],
    rentMult: 2.0, bonus: 125000,
  },
  {
    id: 'gold_street',
    name: 'Улица блеска', nameEn: 'Street of shine',
    props: ['dxb_gold', 'dxb_jew', 'joh_cash', 'joh_mine'],
    clues: ['лавка с весами', 'блеск для запястья', 'ломбард на углу', 'жёлтый металл из-под земли'],
    cluesEn: ['a shop with scales', 'shine for the wrist', 'the corner pawnshop', 'yellow metal from the ground'],
    rentMult: 1.8, bonus: 105000,
  },
];

/** В каждой партии активны только 3 случайные цепочки. все 4 слота каждой цепочки видны сразу —
 * без загадок: игрок сразу видит, какие 4 бизнеса нужно скупить, чтобы собрать цепочку. */
function pickChains(rnd = Math.random) {
  const pool = [...CHAIN_TEMPLATES];
  const out = [];
  while (out.length < 3 && pool.length) {
    const tpl = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    out.push({ ...tpl, revealIdx: [0, 1, 2, 3] });
  }
  return out;
}

// ---------- КОЛОДА КАРТ ----------
// kind: 'gain' | 'pay' | 'move' | 'jail' | 'perprop' | 'pct' | 'fromall'
const CHANCE = [
  { id: 'ch_go',       icon: '🏁', title: 'НА СТАРТ', titleEn: 'TO START', kind: 'move',    to: 0,      text: 'На старт. Получи $200',                    textEn: 'Advance to GO. Collect $200',          amount: M(200) },
  { id: 'ch_div',      icon: '🏦', title: 'ДИВИДЕНД', titleEn: 'DIVIDEND', kind: 'gain',    amount: M(50),   text: 'Банк платит дивиденд $50',            textEn: 'Bank pays you a dividend of $50' },
  { id: 'ch_jail',     icon: '🚨', title: 'АРЕСТ', titleEn: 'ARREST', kind: 'jail',    text: 'Отправляйся в тюрьму',                                 textEn: 'Go to Jail' },
  { id: 'ch_repair',   icon: '🔨', title: 'РЕМОНТ', titleEn: 'REPAIRS', kind: 'perprop', amount: M(100),  text: 'Общий ремонт: $100 за каждый объект', textEn: 'General repairs: $100 per property' },
  { id: 'ch_speed',    icon: '🚨', title: 'ШТРАФ', titleEn: 'FINE', kind: 'pay',     amount: M(150),  text: 'Штраф за превышение скорости $150',   textEn: 'Speeding fine $150' },
  { id: 'ch_doc',      icon: '🏥', title: 'СЧЁТ ОТ ВРАЧА', titleEn: "DOCTOR'S BILL", kind: 'pay',     amount: M(500),  text: 'Счёт от врача. Заплати $500',         textEn: "Doctor's fee. Pay $500" },
  { id: 'ch_refund',   icon: '💰', title: 'ВОЗВРАТ НАЛОГА', titleEn: 'TAX REFUND', kind: 'gain',    amount: M(2000), text: 'Возврат налога. Получи $2000',        textEn: 'Income tax refund. Collect $2000' },
  { id: 'ch_bday',     icon: '🎂', title: 'ДЕНЬ РОЖДЕНИЯ', titleEn: 'BIRTHDAY', kind: 'fromall', amount: M(100),  text: 'День рождения: по $100 с каждого',    textEn: 'Birthday: collect $100 from each player' },
  { id: 'ch_life',     icon: '📄', title: 'СТРАХОВКА', titleEn: 'INSURANCE', kind: 'gain',    amount: M(1000), text: 'Страховка жизни. Получи $1000',       textEn: 'Life insurance matures. Collect $1000' },
  { id: 'ch_inherit',  icon: '🏰', title: 'НАСЛЕДСТВО', titleEn: 'INHERITANCE', kind: 'gain',    amount: M(10000),text: 'Наследство $10 000',                  textEn: 'You inherit $10,000' },
  { id: 'ch_taxerr',   icon: '📝', title: 'ОШИБКА В ДЕКЛАРАЦИИ', titleEn: 'TAX ERROR', kind: 'pay',     amount: M(1500), text: 'Ошибки в декларации. Заплати $1500',  textEn: 'Tax filing errors. Pay $1,500' },
  { id: 'ch_audit',    icon: '🔎', title: 'НАЛОГОВАЯ ПРОВЕРКА', titleEn: 'TAX AUDIT', kind: 'pay',     amount: M(2000), text: 'Налоговая проверка. Заплати $2000',   textEn: 'Tax audit. Pay $2,000' },
  { id: 'ch_fire',     icon: '🔥', title: 'ПОЖАРНАЯ ИНСПЕКЦИЯ', titleEn: 'FIRE INSPECTION', kind: 'pay',     amount: M(200),  text: 'Пожарная инспекция. Заплати $200',    textEn: 'Fire inspection. Pay $200' },
  { id: 'ch_robbed',   icon: '🥷', title: 'ОГРАБЛЕНИЕ', titleEn: 'ROBBERY', kind: 'pay',     amount: M(300),  text: 'Салон обокрали. Заплати $300',        textEn: 'Your store was robbed. Pay $300' },
  { id: 'ch_pipes',    icon: '💧', title: 'АВАРИЯ НА ТРУБЕ', titleEn: 'BURST PIPES', kind: 'pay',     amount: M(500),  text: 'Прорвало трубы. Заплати $500',        textEn: 'Pipes burst. Pay $500' },
  { id: 'ch_insider',  icon: '👥', title: 'ВОР СРЕДИ СВОИХ', titleEn: 'INSIDE THIEF', kind: 'pay',     amount: M(500),  text: 'Вор среди своих. Заплати $500',       textEn: 'A thief among your own. Pay $500' },
];

const CHEST = [
  { id: 'cc_labor',    icon: '👷', title: 'ТРУДИНСПЕКЦИЯ', titleEn: 'LABOR INSPECTION', kind: 'perprop', amount: M(100),  text: 'Трудовая инспекция: $100 за объект',  textEn: 'Labor inspection: $100 per property' },
  { id: 'cc_vat',      icon: '🧾', title: 'ПЕНЯ ПО НДС', titleEn: 'VAT PENALTY', kind: 'pct',     pct: 0.10,       text: 'Пеня по НДС: 10% стоимости имущества',textEn: 'VAT penalty: 10% of property value' },
  { id: 'cc_eco',      icon: '🌿', title: 'ЭКОШТРАФ', titleEn: 'ECO FINE', kind: 'pay',     amount: M(750),  text: 'Экологический штраф $750',            textEn: 'Environmental penalty $750' },
  { id: 'cc_govt',     icon: '🏛️', title: 'ГОСКОНТРАКТ', titleEn: 'GOV CONTRACT', kind: 'gain',    amount: M(20000),text: 'Госконтракт выполнен. Получи $20 000',textEn: 'Government contract. Collect $20,000' },
  { id: 'cc_patent',   icon: '⚖️', title: 'ПАТЕНТНЫЙ СПОР', titleEn: 'PATENT LAWSUIT', kind: 'pay',     amount: M(1500), text: 'Проигран патентный спор. $1500',      textEn: 'Lost patent lawsuit. Pay $1,500' },
  { id: 'cc_cyber',    icon: '💻', title: 'КИБЕРАТАКА', titleEn: 'CYBERATTACK', kind: 'pay',     amount: M(1000), text: 'Кибератака. Восстановление $1000',    textEn: 'Cyberattack. Pay $1,000 to restore' },
  { id: 'cc_charity',  icon: '❤️', title: 'БЛАГОТВОРИТЕЛЬНОСТЬ', titleEn: 'CHARITY', kind: 'pay',     amount: M(500),  text: 'Благотворительный взнос $500',        textEn: 'Charity contribution $500' },
  { id: 'cc_sponsor',  icon: '🎙️', title: 'СПОНСОРСТВО', titleEn: 'SPONSORSHIP', kind: 'pay',     amount: M(750),  text: 'Спонсорство конференции $750',        textEn: 'Event sponsorship $750' },
  { id: 'cc_innov',    icon: '💡', title: 'ПРЕМИЯ ЗА ИННОВАЦИИ', titleEn: 'INNOVATION AWARD', kind: 'gain',    amount: M(10000),text: 'Премия за инновации $10 000',         textEn: 'Innovation award $10,000' },
  // 7 своих карт, 50/50 хороших и плохих
  { id: 'cc_leak',     icon: '📢', title: 'УТЕЧКА В ПРЕССУ', titleEn: 'PRESS LEAK', kind: 'pay',     amount: M(1200), text: 'Утечка в прессу: PR-расходы $1200',   textEn: 'Press leak: PR costs $1,200' },
  { id: 'cc_whistle',  icon: '🤫', title: 'ИНФОРМАТОР', titleEn: 'WHISTLEBLOWER', kind: 'pay',     amount: M(900),  text: 'Информатор в компании. $900 «на решение»', textEn: 'Whistleblower inside. Pay $900 to handle it' },
  { id: 'cc_sanction', icon: '🚧', title: 'САНКЦИОННЫЙ КОМПЛАЕНС', titleEn: 'SANCTIONS COMPLIANCE', kind: 'pct',     pct: 0.06,       text: 'Санкционный комплаенс: 6% имущества', textEn: 'Sanctions compliance: 6% of property' },
  { id: 'cc_tender',   icon: '📜', title: 'ЗАКРЫТЫЙ ТЕНДЕР', titleEn: 'CLOSED TENDER', kind: 'gain',    amount: M(8000), text: 'Выиграл закрытый тендер. $8000',      textEn: 'Won a closed tender. Collect $8,000' },
  { id: 'cc_amnesty',  icon: '📝', title: 'НАЛОГОВАЯ АМНИСТИЯ', titleEn: 'TAX AMNESTY', kind: 'gain',    amount: M(5000), text: 'Налоговая амнистия. Возврат $5000',   textEn: 'Tax amnesty. Refund $5,000' },
  { id: 'cc_offshore', icon: '🏝️', title: 'ОФШОРНЫЙ ДИВИДЕНД', titleEn: 'OFFSHORE DIVIDEND', kind: 'gain',    amount: M(6500), text: 'Офшорный дивиденд $6500',             textEn: 'Offshore dividend $6,500' },
  { id: 'cc_grant',    icon: '🎓', title: 'ГРАНТ НА МОДЕРНИЗАЦИЮ', titleEn: 'MODERNIZATION GRANT', kind: 'gain',    amount: M(7000), text: 'Грант на модернизацию $7000',         textEn: 'Modernization grant $7,000' },
];

// ---------- СБОРКА ДОСКИ ----------
/** Возвращает массив из 40 клеток. Клетки-бизнесы получают ссылку на prop.id. */
function buildBoard() {
  const cells = new Array(40).fill(null);
  // углы и спец-клетки — фиксированные позиции (как в оригинале)
  cells[0]  = { type: CELL.START,        name: 'СТАРТ',              nameEn: 'GO' };
  cells[10] = { type: CELL.JAIL,         name: 'Просто посетили Tower of London', nameEn: 'Just visiting the Tower of London' };
  cells[20] = { type: CELL.FREE_PARKING, name: 'Свободная стоянка',  nameEn: 'Free Parking' };
  cells[30] = { type: CELL.GO_TO_JAIL,   name: 'В тюрьму!',          nameEn: 'Go to Jail!' };
  cells[4]  = { type: CELL.INCOME_TAX,   name: 'Подоходный налог',   nameEn: 'Income Tax' };
  cells[38] = { type: CELL.INCOME_TAX,   name: 'Налог с прибыли',    nameEn: 'Profit Tax' };
  cells[15] = { type: CELL.PAY_ROOF,     name: 'Заплати крыше',      nameEn: 'Pay the roof' };
  cells[25] = { type: CELL.RIOTS,        name: 'Беспорядки в городе',nameEn: 'Riots in the city' };
  cells[35] = { type: CELL.DISASTER,     name: 'Стихийное бедствие', nameEn: 'Natural disaster' };
  // 6 карточных клеток (~1 на каждые 6–7 клеток)
  [2, 7, 17, 22, 27, 33].forEach((i, k) => {
    cells[i] = k % 2 === 0
      ? { type: CELL.CARD_CHANCE, name: 'Шанс',              nameEn: 'Chance' }
      : { type: CELL.CARD_CHEST,  name: 'Общественная казна', nameEn: 'Community Chest' };
  });
  // остальное — бизнесы по порядку
  let pi = 0;
  for (let i = 0; i < 40; i++) {
    if (cells[i]) continue;
    const prop = PROPS[pi++];
    cells[i] = prop
      ? { type: CELL.PROP, propId: prop.id }
      : { type: CELL.FREE_PARKING, name: 'Пустырь', nameEn: 'Vacant lot' };
  }
  return cells;
}

const BOARD = buildBoard();
const PROP_BY_ID = Object.fromEntries(PROPS.map(p => [p.id, p]));
const POS_BY_PROP = {};
BOARD.forEach((c, i) => { if (c.type === CELL.PROP) POS_BY_PROP[c.propId] = i; });

// суммы спец-клеток
const FEES = {
  incomeTax: 25000,   // 2.5% от цели — ощутимо, но не смертельно
  payRoof:   20000,   // «заплати крыше» — бандитам
  jailBail:  30000,   // залог из тюрьмы (крупный, как просили)
  passStart: 25000,   // за проход СТАРТа — основной «мотор» роста
  landStart: 50000,   // точное попадание на СТАРТ
};

module.exports = {
  MONEY_SCALE, M, CELL, BOARD, PROPS, PROP_BY_ID, POS_BY_PROP,
  CHAIN_TEMPLATES, pickChains, CHANCE, CHEST, FEES,
};
