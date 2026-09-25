/* SHADOW EMPIRE — клиент */
window.bash = window.bash || { user: null, chat: null };
const parentOrigin = (() => { try { return document.referrer ? new URL(document.referrer).origin : null; } catch { return null; } })();
window.addEventListener('message', e => {
  if (parentOrigin && e.origin !== parentOrigin) return;
  if (e.data?.type !== 'bash-bootstrap' || !e.data?.bash) return;
  window.bash = e.data.bash;
  const n = document.getElementById('nameInput');
  if (n && !n.value && window.bash.user?.username) n.value = window.bash.user.username;
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('sheet').classList.contains('hidden')) { closeSheet(); return; }
  if (window.parent !== window) window.parent.postMessage({ type: 'bash-escape' }, parentOrigin || '*');
});

/* ================= I18N ================= */
const DICT = {
  ru: {
    tag: 'Монополия, где кубик бросает реальный мир',
    loadingLive: 'загрузка живых данных…',
    namePh: 'Твоё имя / псевдоним',
    enter: 'Войти в дело',
    rulesBtn: 'Правила игры',
    fine: 'Сатира. Все совпадения с реальными схемами — на вашей совести.',
    playBots: '🤖 Играть с ботами', createPublic: '🌐 Создать публичную комнату', createPrivate: '🔒 Создать приватную комнату',
    joiningRoom: 'Вход по ссылке в комнату', roomsListTitle: 'Открытые публичные комнаты:',
    noRooms: 'Пока нет открытых комнат — создай свою!',
    roomLinkCopied: 'Ссылка на комнату скопирована!', shareRoom: '🔗 Скопировать ссылку на комнату',
    join: 'Войти', roomPlayers: (h, b) => `игроков: ${h}${b ? ` · ботов: ${b}` : ''}`,
    hWhiteL: 'БЕЗНАЛ', hBlackL: 'НАЛ', hInfL: 'ВЛИЯНИЕ', hHeatL: 'ПАЛЕВО',
    roundL: 'Круг', tabBoard: 'Доска', tabChains: 'Цепочки', tabMap: 'Карта', tabCrime: 'Схемы', tabNews: 'Мир', tabRank: 'Игроки',
    endRound: 'Завершить раунд', endRoundWait: 'Ждём остальных…', gameOver: 'Игра окончена', playAgainBtn: '🔁 Переиграть',
    connLost: 'Связь потеряна, переподключаюсь…',
    jailed: n => `⛓️ Ты под стражей: ${n} раунд`,
    caseOpenAlert: n => `📢 Против тебя ОТКРЫТО ДЕЛО. Осталось ${n} р. — решай вопрос`,
    heatAlert: h => `🔥 Палево ${h}/100 — следствие дышит в затылок`,
    mapHint: 'Доход пересчитывается по реальным ценам, погоде и новостям. Тапни актив — увидишь причины.',
    war: 'война', unrest: 'бунт', yourMayor: 'твой мэр', mayorBought: 'мэр куплен',
    free: 'свободен', forCash: 'за нал', owned: 'ТВОЙ',
    frozenTag: 'заморожен', damagedTag: 'повреждён',
    payRentBtn: (rent, black) => `💳 Заплатить аренду ${rent}${black ? ' ' + black : ''}`,
    legal: 'ЛЕГАЛ', grey: 'СЕРОЕ', crime: 'КРИМ',
    buy: cost => `Купить ${cost}`, buyBlack: 'налом', later: 'Позже',
    auditBtn: '🚔 Проверка $50K нал', raidBtn: '🔥 Рейд $90K нал',
    buyoutBtn: p => `🤝 Выкупить за ${p}`, seizeBtn: '⚔️ Рейдерский захват (нужен свой мэр) 6 влияния + $130K нал',
    seizeNeedMayor: 'Захват возможен только если актив повреждён рейдом И у тебя куплен мэр этой зоны.',
    needAp: n => `действий в раунде (${n}◆)`, needInfluence: n => `влияния (${n})`, needCash: c => `нала (${c})`,
    seizeMissing: m => `Не хватает для захвата: ${m}. Вернись когда накопится.`,
    close: 'Закрыть', linkedTo: l => `привязан к «${l}»`, leverage: 'плечо',
    perRoundBlack: '/раунд налом', perRoundWhite: '/раунд белыми',
    baseIncome: b => `Базовый доход ${b}`, value: v => `стоимость ${v}`, ownerLbl: 'владелец',
    evStandsOn: 'встал на', evPaysRent: 'платит аренду', evOnOwn: 'на своём', evDebt: 'долг',
    evTax: 'платит налог', evRoof: 'платит крыше',
    centerBtn: 'Моя клетка', surrenderBtn: '🏳️ Сдаться', surrenderConfirm: 'Все твои объекты вернутся в банк и станут свободны для покупки. Точно сдаёшься?',
    you: 'ТЫ', why: 'ПОЧЕМУ ИМЕННО СТОЛЬКО', calm: 'Мир спокоен, базовый доход.',
    newsSec: 'ЧТО ПИШУТ В НОВОСТЯХ',
    caseOpenTitle: '📢 ДЕЛО ОТКРЫТО', caseInvestTitle: '🔍 Следствие интересуется',
    evidenceCount: (e, r) => `Улик собрано: <b>${e}</b> / 3${r ? ` · до приговора ${r} раунда` : ''}`,
    payProsecutor: c => `⚖️ Занести ${c}`, snitchBtn: '🐍 Сдать другого',
    heatRepTitle: (h, r) => `ПАЛЕВО ${h}/100 · РЕПУТАЦИЯ ${r}`,
    heatCostHint: c => `Обслуживание палева в этом раунде: −${c}. Выше 70 — рейды полиции и утечки в прессу.`,
    secBlackNoCrime: 'ДОБЫТЬ НАЛ БЕЗ КРИМ-БИЗНЕСА',
    skimTitle: 'Провести доход мимо кассы', skimDesc: 'часть белых → нал (конверсия 55%), работает даже если у тебя только легальные активы',
    kickbackTitle: 'Откат с госконтракта', kickbackDesc: 'подрядчик по твоему тендеру заносит нал сверху',
    secMoney: 'ДЕНЬГИ',
    launderTitle: b => `Отмыть весь нал (${b})`, launderDesc: f => `комиссия ${f}% · нал нельзя вложить в легальное`,
    lobbyTitle: '+2 влияния', lobbyDesc: 'влияние = валюта коррупции, покупает решения',
    offshoreTitle: on => `Открыть офшор ${on}`, offshoreDesc: 'спасает один актив от конфискации',
    secDefense: 'ЗАЩИТА',
    protTitle: on => `Нанять крышу ${on}`, protDesc: 'отбивает рейды, гасит убытки от беспорядков на 65%',
    inspTitle: on => `Купить инспектора ${on}`, inspDesc: '−25% к шансу собрать улику на тебя, 3 раунда',
    secMayor: 'КОРРУПЦИЯ · ВЗЯТКА МЭРУ', secTender: 'КОРРУПЦИЯ · ГОСКОНТРАКТЫ',
    mayorDesc: 'твои налоги −30%, конкурентам +18% издержек',
    tenderTitle: z => `Тендер · ${z}`, tenderDesc: 'гарантированный поток $26–40K/раунд',
    attackHint: 'Атаки на конкурентов (проверка/рейд) — на вкладке «Карта», тапни чужой актив.',
    noRivals: 'Пока нет соперников.',
    skimSheetTitle: '🧾 Мимо кассы', skimSheetSub: 'Конверсия 55% белых → нал. Работает даже если у тебя нет ни одного крим-актива.',
    skimTooLittle: 'Слишком мало белых, чтобы было что скрывать', cancel: 'Отмена',
    snitchTitle: '🐍 Сделка со следствием', snitchSub: 'Твои улики обнулятся, палево −30. Но репутация −15, и он узнает, кто сдал.',
    capitalLbl: 'капитал', heatLbl: 'палево', evidenceToHim: '+2 улики ему',
    updated: t => `Обновлено ${t}`, liveData: '🟢 живые данные', cachedData: '🟡 кэш',
    realNewsHint: 'это настоящие заголовки, они уже влияют на твой доход.',
    chronicle: 'ХРОНИКА ПАРТИИ', quiet: 'Тихо.',
    zoomIn: 'Увеличить поле', zoomOut: 'Уменьшить поле',
    tradeBtn: '🤝 Торговля', auctionBtn: '🔨 Аукцион', seizeBoardBtn: '⚔️ Захватить',
    auctionLeader: n => `Лидирует: ${n}`, auctionNoBids: 'Ставок пока нет — торги открыты',
    auctionPassBtn: 'Пас', auctionYouPassed: 'Ты вышел из торгов',
    tradeDesc: 'предложи свой объект/деньги в обмен на объект другого игрока',
    seizeBoardDesc: 'силовой захват любого чужого актива без предварительного рейда — дорого и палевно',
    acceptTradeBtn: '✅ Принять', declineTradeBtn: '✖️ Отклонить',
    tradeSheetTitle: '🤝 Предложить сделку', pickPlayer: 'Кому предлагаешь?',
    tradeGiveLbl: 'Отдаёшь (свой объект)', tradeWantLbl: 'Хочешь получить (его объект)',
    tradeCashLbl: 'Доплата (можно 0, можно в минус — тогда доплачивает он)',
    none: 'ничего', sendTradeBtn: 'Отправить предложение',
    seizeSheetTitle: '⚔️ Силовой захват', seizeSheetSub: 'Выбери чужой актив — захват стоит дорого и сильно поднимает палево',
    zoneEffect: e => `— эффект: ${e}`,
    effWar: 'военная премия к сырью, минус недвижимость', effUnrest: 'беспорядки давят аренду', effCalm: 'спокойно',
    capitalFormula: 'Капитал = белые + нал×0.6 + стоимость активов по текущему рынку.', tierLbl: 'уровень',
    hiddenMoneyHint: 'Капитал всех игроков виден всем — так проще понять, кто реально отстаёт.',
    finalLbl: 'финал',
    tagWAR: 'ВОЙНА', tagUNREST: 'БУНТ', tagCRIME: 'КРИМ',
    rentLbl: 'аренда', rollBtn: '🎲 Бросить кубик', rolling: 'Кубик…', notYourTurn: 'Ход соперника',
    yourTurn: 'ТВОЙ ХОД', turnOf: n => `Ходит ${n}`, endTurnBtn: 'Завершить ход',
    inJailMsg: n => `⛓️ В тюрьме: ${n} ход(а). Залог или ждать`, payBail: b => `Заплатить залог ${b}`,
    myAssets: 'МОИ ОБЪЕКТЫ (цена по рынку)', noAssets: 'Объектов пока нет — вставай на клетку и покупай',
    sellBank: r => `🏦 Продать банку ${r}`, offerPlayers: 'Предложить игрокам',
    chainsTitle: 'ЦЕПОЧКИ ЭТОЙ ПАРТИИ', chainsHint: 'В каждой цепочке 4 предприятия — все 4 видны сразу. Собери все 4 — множитель аренды и бонус, первому — вдвое.',
    chainRevealHint: n => `Собрано ${n} из 4`, chainYours: 'у тебя',
    claimedBy: n => `собрал: ${n}`, notClaimed: 'ещё никто',
    winGoalHint: g => `Партия 30 минут — победит тот, у кого больше капитал (недвижимость + деньги)`,
    matchTimeLeft: m => `⏱ До конца партии: ${m}`,
    cellStart: 'СТАРТ', cellJail: 'Tower of London', cellFree: 'Стоянка', cellGoJail: 'В тюрьму!',
    cellTax: 'Налог', cellRoof: 'Крыше', cellRiots: 'Бунты', cellDisaster: 'Бедствие',
    cellChance: 'Шанс', cellChest: 'Казна',
    offersTitle: 'ПРЕДЛОЖЕНИЯ ИГРОКОВ', buyFor: p => `Купить за ${p}`,
    f_market: p => `${p.label} ${p.pct}% × плечо ${p.beta}`,
    f_war: p => `Военный фон (${p.n} новостей)`,
    f_unrest: p => `Беспорядки (${p.n} новостей)`,
    f_unrest_shielded: p => `Беспорядки (${p.n} новостей) — крыша гасит`,
    f_mayor_own: () => 'Мэр «свой» — налоги ниже',
    f_mayor_rival: () => `Мэр куплен кем-то другим`,
    f_frozen: p => `Актив заморожен проверкой (${p.n})`,
    f_damaged: p => `Повреждён после рейда (${p.n})`,
    f_protection: () => 'Крыша: −$12K обслуживание',
    f_heat_high: p => `Палево ${p.heat} — «решать вопросы» дорого`,
    wx_storm_hard: p => `Шторм: ветер ${p.wind} км/ч`,
    wx_storm_soft: p => `Непогода: ветер ${p.wind} км/ч`,
    wx_heat_hard: p => `Жара ${p.t}°C — туристов нет`,
    wx_heat_soft: p => `Жара ${p.t}°C`,
    wx_cold_hard: p => `Мороз ${p.t}°C — оборудование встало`,
    wx_cold_soft: p => `Мороз ${p.t}°C`,
  },
  en: {
    tag: 'Monopoly where the dice is the real world',
    loadingLive: 'loading live data…',
    namePh: 'Your name / alias',
    enter: 'Enter the business',
    rulesBtn: 'Rules',
    fine: 'Satire. Any resemblance to real schemes is on you.',
    playBots: '🤖 Play with bots', createPublic: '🌐 Create public room', createPrivate: '🔒 Create private room',
    joiningRoom: 'Joining room via link', roomsListTitle: 'Open public rooms:',
    noRooms: 'No open rooms yet — create your own!',
    roomLinkCopied: 'Room link copied!', shareRoom: '🔗 Copy room link',
    join: 'Join', roomPlayers: (h, b) => `players: ${h}${b ? ` · bots: ${b}` : ''}`,
    hWhiteL: 'CARD', hBlackL: 'CASH', hInfL: 'INFLUENCE', hHeatL: 'HEAT',
    roundL: 'Lap', tabBoard: 'Board', tabChains: 'Chains', tabMap: 'Map', tabCrime: 'Schemes', tabNews: 'World', tabRank: 'Players',
    endRound: 'End round', endRoundWait: 'Waiting for others…', gameOver: 'Game over', playAgainBtn: '🔁 Play again',
    connLost: 'Connection lost, reconnecting…',
    jailed: n => `⛓️ You're detained: ${n} round`,
    caseOpenAlert: n => `📢 A CASE IS OPEN against you. ${n} rounds left — settle it`,
    heatAlert: h => `🔥 Heat ${h}/100 — investigators breathing down your neck`,
    mapHint: 'Income is recalculated from real prices, weather and news. Tap an asset to see why.',
    war: 'war', unrest: 'unrest', yourMayor: 'your mayor', mayorBought: 'mayor bought',
    free: 'free', forCash: 'for cash', owned: 'YOURS',
    frozenTag: 'frozen', damagedTag: 'damaged',
    payRentBtn: (rent, black) => `💳 Pay rent ${rent}${black ? ' ' + black : ''}`,
    legal: 'LEGAL', grey: 'GREY', crime: 'CRIME',
    buy: cost => `Buy ${cost}`, buyBlack: 'in cash', later: 'Later',
    auditBtn: '🚔 Audit $50K cash', raidBtn: '🔥 Raid $90K cash',
    buyoutBtn: p => `🤝 Buy out for ${p}`, seizeBtn: '⚔️ Hostile takeover (needs your mayor) 6 influence + $130K cash',
    seizeNeedMayor: 'Takeover only works if the asset is raid-damaged AND you own the mayor of this zone.',
    needAp: n => `actions this round (${n}◆)`, needInfluence: n => `influence (${n})`, needCash: c => `cash (${c})`,
    seizeMissing: m => `Missing to seize: ${m}. Come back once you have it.`,
    close: 'Close', linkedTo: l => `linked to "${l}"`, leverage: 'leverage',
    perRoundBlack: '/round in cash', perRoundWhite: '/round in cash (white)',
    baseIncome: b => `Base income ${b}`, value: v => `value ${v}`, ownerLbl: 'owner',
    evStandsOn: 'lands on', evPaysRent: 'pays rent for', evOnOwn: 'on own', evDebt: 'debt',
    evTax: 'pays tax', evRoof: 'pays the roof',
    centerBtn: 'My cell', surrenderBtn: '🏳️ Surrender', surrenderConfirm: 'All your properties return to the bank and become available for purchase. Are you sure?',
    you: 'YOU', why: 'WHY EXACTLY THIS MUCH', calm: 'World is calm, base income.',
    newsSec: 'WHAT THE NEWS SAYS',
    caseOpenTitle: '📢 CASE OPEN', caseInvestTitle: '🔍 Under investigation',
    evidenceCount: (e, r) => `Evidence collected: <b>${e}</b> / 3${r ? ` · verdict in ${r} rounds` : ''}`,
    payProsecutor: c => `⚖️ Pay off ${c}`, snitchBtn: '🐍 Snitch on someone',
    heatRepTitle: (h, r) => `HEAT ${h}/100 · REPUTATION ${r}`,
    heatCostHint: c => `Heat upkeep this round: −${c}. Above 70 — police raids and press leaks.`,
    secBlackNoCrime: 'GET CASH WITHOUT CRIME BUSINESS',
    skimTitle: 'Skim revenue off the books', skimDesc: 'part of your cash → black money (55% rate), works even with only legal assets',
    kickbackTitle: 'Kickback from gov contract', kickbackDesc: 'your contractor kicks back cash on top',
    secMoney: 'MONEY',
    launderTitle: b => `Launder all black money (${b})`, launderDesc: f => `fee ${f}% · black money can't buy legal assets`,
    lobbyTitle: '+2 influence', lobbyDesc: 'influence = corruption currency, buys decisions',
    offshoreTitle: on => `Open offshore ${on}`, offshoreDesc: 'shields one asset from seizure',
    secDefense: 'PROTECTION',
    protTitle: on => `Hire protection ${on}`, protDesc: 'blocks raids, cuts unrest losses by 65%',
    inspTitle: on => `Buy an inspector ${on}`, inspDesc: '−25% chance of evidence against you, 3 rounds',
    secMayor: 'CORRUPTION · BRIBE MAYOR', secTender: 'CORRUPTION · GOV CONTRACTS',
    mayorDesc: 'your taxes −30%, rivals\' costs +18%',
    tenderTitle: z => `Contract · ${z}`, tenderDesc: 'guaranteed $26–40K/round',
    attackHint: 'Attacks on rivals (audit/raid) are on the Map tab — tap a rival\'s asset.',
    noRivals: 'No rivals yet.',
    skimSheetTitle: '🧾 Off the books', skimSheetSub: '55% conversion rate cash→black. Works even with zero crime assets.',
    skimTooLittle: 'Too little cash to hide anything', cancel: 'Cancel',
    snitchTitle: '🐍 Deal with prosecutors', snitchSub: 'Your evidence resets, heat −30. But reputation −15, and they\'ll know who snitched.',
    capitalLbl: 'net worth', heatLbl: 'heat', evidenceToHim: '+2 evidence on them',
    updated: t => `Updated ${t}`, liveData: '🟢 live data', cachedData: '🟡 cached',
    realNewsHint: 'these are real headlines already affecting your income.',
    chronicle: 'MATCH LOG', quiet: 'Quiet.',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out',
    tradeBtn: '🤝 Trade', auctionBtn: '🔨 Auction', seizeBoardBtn: '⚔️ Seize',
    auctionLeader: n => `Leading: ${n}`, auctionNoBids: 'No bids yet — auction is open',
    auctionPassBtn: 'Pass', auctionYouPassed: 'You dropped out of bidding',
    tradeDesc: 'offer your property/cash in exchange for another player\'s property',
    seizeBoardDesc: 'forcibly seize any rival asset without a prior raid — expensive and risky',
    acceptTradeBtn: '✅ Accept', declineTradeBtn: '✖️ Decline',
    tradeSheetTitle: '🤝 Propose a trade', pickPlayer: 'Offer to whom?',
    tradeGiveLbl: 'You give (your property)', tradeWantLbl: 'You want (their property)',
    tradeCashLbl: 'Cash top-up (0 is fine, negative means they pay you)',
    none: 'none', sendTradeBtn: 'Send offer',
    seizeSheetTitle: '⚔️ Forced seizure', seizeSheetSub: 'Pick a rival asset — seizing is expensive and raises heat a lot',
    zoneEffect: e => `— effect: ${e}`,
    effWar: 'war premium on commodities, real estate down', effUnrest: 'unrest hurts rent', effCalm: 'calm',
    capitalFormula: 'Net worth = cash + black×0.6 + market value of assets.', tierLbl: 'tier',
    hiddenMoneyHint: 'Everyone\'s net worth is visible to all — easier to see who is really behind.',
    finalLbl: 'final',
    tagWAR: 'WAR', tagUNREST: 'UNREST', tagCRIME: 'CRIME',
    rentLbl: 'rent', rollBtn: '🎲 Roll dice', rolling: 'Rolling…', notYourTurn: "Opponent's turn",
    yourTurn: 'YOUR TURN', turnOf: n => `${n} is playing`, endTurnBtn: 'End turn',
    inJailMsg: n => `⛓️ In jail: ${n} turn(s). Pay bail or wait`, payBail: b => `Pay bail ${b}`,
    myAssets: 'MY PROPERTIES (live market price)', noAssets: 'No properties yet — land on a cell and buy',
    sellBank: r => `🏦 Sell to bank ${r}`, offerPlayers: 'Offer to players',
    chainsTitle: 'CHAINS IN THIS GAME', chainsHint: 'Each chain has 4 businesses — all 4 are shown upfront. Collect all 4 for a rent multiplier and bonus, double for first.',
    chainRevealHint: n => `${n} of 4 collected`, chainYours: 'yours',
    claimedBy: n => `claimed: ${n}`, notClaimed: 'nobody yet',
    winGoalHint: g => `30-minute match — highest total capital (property + cash) wins`,
    matchTimeLeft: m => `⏱ Time left: ${m}`,
    cellStart: 'GO', cellJail: 'Tower of London', cellFree: 'Parking', cellGoJail: 'Go to Jail!',
    cellTax: 'Tax', cellRoof: 'Roof', cellRiots: 'Riots', cellDisaster: 'Disaster',
    cellChance: 'Chance', cellChest: 'Chest',
    offersTitle: 'PLAYER OFFERS', buyFor: p => `Buy for ${p}`,
    f_market: p => `${p.labelEn || p.label} ${p.pct}% × ${p.beta}x leverage`,
    f_war: p => `War headlines (${p.n})`,
    f_unrest: p => `Unrest (${p.n} headlines)`,
    f_unrest_shielded: p => `Unrest (${p.n} headlines) — protection absorbs it`,
    f_mayor_own: () => 'Mayor is "yours" — lower taxes',
    f_mayor_rival: () => `Mayor bought by someone else`,
    f_frozen: p => `Asset frozen by audit (${p.n})`,
    f_damaged: p => `Damaged after a raid (${p.n})`,
    f_protection: () => 'Protection: −$12K upkeep',
    f_heat_high: p => `Heat ${p.heat} — "handling it" costs extra`,
    wx_storm_hard: p => `Storm: wind ${p.wind} km/h`,
    wx_storm_soft: p => `Bad weather: wind ${p.wind} km/h`,
    wx_heat_hard: p => `Heat wave ${p.t}°C — no tourists`,
    wx_heat_soft: p => `Heat wave ${p.t}°C`,
    wx_cold_hard: p => `Frost ${p.t}°C — equipment down`,
    wx_cold_soft: p => `Frost ${p.t}°C`,
  },
};
const SE_HOST = location.hostname.toLowerCase();
const SE_LANG_KEY =
  SE_HOST === 'ru-game.rebbe47.info'
    ? 'se_lang_ru'
    : 'se_lang_en';

const SE_DEFAULT_LANG =
  SE_HOST === 'ru-game.rebbe47.info' ? 'ru' : 'en';

const SE_SAVED_LANG = localStorage.getItem(SE_LANG_KEY);

let LANG =
  SE_SAVED_LANG === 'ru' || SE_SAVED_LANG === 'en'
    ? SE_SAVED_LANG
    : SE_DEFAULT_LANG;
const t = (key, ...args) => {
  const v = (DICT[LANG] && DICT[LANG][key]) ?? (DICT.ru[key]);
  return typeof v === 'function' ? v(...args) : v;
};
function applyStaticI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('.langsw .lg').forEach(b => b.classList.toggle('active', b.dataset.lang === LANG));
}
const zn = z => (LANG === 'en' && z.nameEn) ? z.nameEn : z.name;
const an = a => (LANG === 'en' && a.nameEn) ? a.nameEn : a.name;
const mn = m => (LANG === 'en' && m.labelEn) ? m.labelEn : m.label;

// ---------- Шаблоны логов (RU/EN). Сервер шлёт key+params, клиент собирает текст. ----------
const LOG_TPL = {
  ru: {
    log_join: p => `${p.name} входит в игру`,
    log_bot_replace: p => `${p.bn} уступает место живому игроку`,
    log_buy: p => `${p.actor} покупает ${p.icon} ${p.asset} за ${money(p.amt)}`,
    log_mayor_bribed: p => `🤝 Кто-то «договорился» с мэром ${p.zone}`,
    log_inspector: p => `📋 ${p.actor} купил инспектора — проверки мимо`,
    log_tender: p => `📜 ${p.actor} выиграл «конкурс» в ${p.zone} (+${money(p.amt)}/раунд)`,
    log_audit: p => `🚔 Проверка: ${p.icon} ${p.asset} (${p.target}) заморожен${p.caught ? ` — заказчик засветился: ${p.actor}` : ''}`,
    log_raid_blocked: p => `🛡️ Рейд на ${p.icon} ${p.asset} (${p.target}) отбит крышей. ${p.actor} потерял людей`,
    log_raid_hit: p => `🔥 Рейд: ${p.icon} ${p.asset} (${p.target}) горит. −30% стоимости`,
    log_protection: p => `🦺 ${p.actor} под «крышей»`,
    log_launder: p => `🧺 ${p.actor} отмыл ${money(p.amt)} (комиссия ${p.fee}%)`,
    log_offshore: p => `🏝️ ${p.actor} открыл офшор`,
    log_pay_prosecutor: p => `⚖️ ${p.actor} «решил вопрос» со следствием за ${money(p.amt)}`,
    log_snitch: p => `🐍 ${p.actor} пошёл на сделку со следствием и сдал ${p.target}`,
    log_lobby: p => `🎩 ${p.actor} завёл нужные знакомства (+2 влияния)`,
    log_skim: p => `🧾 ${p.actor} провёл ${money(p.amt)} мимо кассы`,
    log_buyout: p => `🤝 ${p.actor} выкупил ${p.icon} ${p.asset} у ${p.target} за ${money(p.amt)}`,
    log_seize: p => `⚔️ ${p.actor} рейдерски захватил ${p.icon} ${p.asset} у ${p.target} через своего мэра`,
    log_kickback: p => `💸 ${p.actor} получил откат ${money(p.amt)} с госконтракта`,
    log_rent: p => `💳 ${p.actor} платит аренду ${p.icon} ${p.asset} → ${p.target}: ${money(p.amt)}${p.mult > 1 ? ` (цепочка ×${p.mult})` : ''}`,
    log_rent_converted: p => `💳 ${p.actor} оплатил аренду ${p.icon} ${p.asset} → ${p.target} (конвертацией по курсу)`,
    log_rent_partial: p => `💳 ${p.actor} оплатил аренду ${p.icon} ${p.asset} частично — ${money(p.amt)} в долг`,
    log_bail_out: p => `🔓 ${p.actor} внёс залог ${money(p.amt)} и вышел из тюрьмы`,
    log_bankrupt: p => `💀 ${p.actor} не смог внести залог — банкрот`,
    log_sell_bank: p => `🏦 ${p.actor} продал банку ${p.icon} ${p.asset} за ${money(p.amt)} (${p.rate}% — по репутации ${p.rep})`,
    log_offer: p => `📣 ${p.actor} предлагает ${p.icon} ${p.asset} за ${money(p.amt)}`,
    log_accept_offer: p => `🤝 ${p.actor} купил ${p.icon} ${p.asset} у ${p.target} за ${money(p.amt)}`,
    log_trade_offer: p => `🤝 ${p.actor} предложил сделку ${p.target}`,
    log_trade_done: p => `🤝 ${p.actor} и ${p.target} заключили сделку`,
    log_auction_start: p => `🔨 ${p.actor} выставил ${p.icon} ${p.asset} на аукцион`,
    log_auction_bid: p => `🔨 Ставка ${money(p.amt)}`,
    log_auction_won: p => `🔨 ${p.actor} выиграл аукцион: ${p.icon} ${p.asset} за ${money(p.amt)}`,
    log_auction_novone: p => `🔨 Аукцион на ${p.icon} ${p.asset} закрыт — ставок не было`,
    log_seize_board: p => `⚔️ ${p.actor} силой захватил ${p.icon} ${p.asset} у ${p.target}`,
    log_surrender: p => `🏳️ ${p.actor} сдался — все активы в банк`,
    log_inactive: p => `👻 ${p.actor} выбывает по неактивности (5 пропусков) — активы в банк`,
    log_investigation: p => `🔍 Следствие собирает материал на ${p.actor} (улик: ${p.n})`,
    log_case_open: p => `📢 Открыто дело против ${p.actor}! 3 раунда, чтобы решить`,
    log_confiscate: p => `🔨 Конфискация: ${p.icon} ${p.asset} изъят у ${p.actor}`,
    log_offshore_saved: p => `🏝️ Активы ${p.actor} спрятаны в офшоре — конфискация сорвалась`,
    log_jailed: p => `⛓️ ${p.actor} задержан на раунд, штраф ${money(p.amt)}`,
    log_unrest: p => `⚠️ ${p.flag} ${p.zone}: беспорядки бьют по активам${p.title ? ' — «' + p.title + '»' : ''}`,
    log_war: p => `💥 ${p.flag} ${p.zone}: военная эскалация${p.title ? ' — «' + p.title + '»' : ''}`,
    log_mayor_expired: p => `🕳️ Договорённость с мэром ${p.zone} истекла`,
    log_win: p => `🏆 ${p.actor} первым достиг ${money(p.amt)} — победа!`,
    log_win_time: p => `🏆 Время партии истекло. Победитель — ${p.actor} с капиталом ${money(p.amt)}!`,
    log_win_last: p => `🏆 ${p.actor} остался единственным игроком — победа!`,
    log_game_over: p => `🏆 Игра окончена. Победитель: ${p.actor}`,
    log_skip: p => `⏭️ ${p.actor} пропускает ход`,
    log_roll: p => `🎲 ${p.actor} бросил ${p.d1}+${p.d2}=${p.sum} → клетка ${p.pos}`,
    log_release: p => `🔓 ${p.actor} освободился — может бросать кубик`,
    log_jail_skip: p => `⛓️ ${p.actor} сидит: осталось ${p.n} ход(а)`,
    log_go_jail: p => `⛓️ ${p.actor} отправлен в тюрьму. Залог ${money(p.amt)} или 2 хода пропуска`,
    log_tax: p => `🧾 ${p.actor} платит налог ${money(p.amt)} в банк`,
    log_roof: p => `🕶️ ${p.actor} платит крыше ${money(p.amt)}`,
    log_riots: p => `⚠️ ${p.actor} застрял в беспорядках — пропускает ход`,
    log_disaster: p => `🌪️ ${p.actor} попал под стихийное бедствие — пропускает ход`,
    log_card: p => `🃏 ${p.actor} тянет карту: «${p.card}»`,
    log_card_skipped_noprops: p => `ℹ️ у ${p.actor} нет имущества — карта не сработала`,
    log_start: p => `🏁 ${p.actor} точно на СТАРТ: +${money(p.amt)}`,
    log_pass_start: p => `🏁 ${p.actor} прошёл СТАРТ: +${money(p.amt)}`,
    log_chain: p => `${p.first ? '🥇' : '🔗'} ${p.actor} собрал цепочку «${p.chain}»${p.first ? ' ПЕРВЫМ' : ''} — бонус ${money(p.amt)}`,
  },
  en: {
    log_join: p => `${p.name} joined`,
    log_bot_replace: p => `${p.bn} makes room for a human player`,
    log_buy: p => `${p.actor} buys ${p.icon} ${p.asset} for ${money(p.amt)}`,
    log_mayor_bribed: p => `🤝 Someone "reached an understanding" with the mayor of ${p.zone}`,
    log_inspector: p => `📋 ${p.actor} bought an inspector — audits miss`,
    log_tender: p => `📜 ${p.actor} won a "tender" in ${p.zone} (+${money(p.amt)}/round)`,
    log_audit: p => `🚔 Audit: ${p.icon} ${p.asset} (${p.target}) frozen${p.caught ? ` — client exposed: ${p.actor}` : ''}`,
    log_raid_blocked: p => `🛡️ Raid on ${p.icon} ${p.asset} (${p.target}) repelled by protection. ${p.actor} lost men`,
    log_raid_hit: p => `🔥 Raid: ${p.icon} ${p.asset} (${p.target}) burns. −30% value`,
    log_protection: p => `🦺 ${p.actor} under "protection"`,
    log_launder: p => `🧺 ${p.actor} laundered ${money(p.amt)} (fee ${p.fee}%)`,
    log_offshore: p => `🏝️ ${p.actor} opened an offshore`,
    log_pay_prosecutor: p => `⚖️ ${p.actor} "settled it" with prosecutors for ${money(p.amt)}`,
    log_snitch: p => `🐍 ${p.actor} took a plea deal and ratted out ${p.target}`,
    log_lobby: p => `🎩 ${p.actor} made the right connections (+2 influence)`,
    log_skim: p => `🧾 ${p.actor} skimmed ${money(p.amt)} off the books`,
    log_buyout: p => `🤝 ${p.actor} bought out ${p.icon} ${p.asset} from ${p.target} for ${money(p.amt)}`,
    log_seize: p => `⚔️ ${p.actor} hostile-took ${p.icon} ${p.asset} from ${p.target} via their mayor`,
    log_kickback: p => `💸 ${p.actor} got a ${money(p.amt)} kickback from a contractor`,
    log_rent: p => `💳 ${p.actor} pays rent ${p.icon} ${p.asset} → ${p.target}: ${money(p.amt)}${p.mult > 1 ? ` (chain ×${p.mult})` : ''}`,
    log_rent_converted: p => `💳 ${p.actor} paid rent ${p.icon} ${p.asset} → ${p.target} (currency conversion)`,
    log_rent_partial: p => `💳 ${p.actor} paid rent ${p.icon} ${p.asset} partly — ${money(p.amt)} into debt`,
    log_bail_out: p => `🔓 ${p.actor} posted bail ${money(p.amt)} and left jail`,
    log_bankrupt: p => `💀 ${p.actor} couldn't post bail — bankrupt`,
    log_sell_bank: p => `🏦 ${p.actor} sold ${p.icon} ${p.asset} to bank for ${money(p.amt)} (${p.rate}% — by reputation ${p.rep})`,
    log_offer: p => `📣 ${p.actor} offers ${p.icon} ${p.asset} for ${money(p.amt)}`,
    log_accept_offer: p => `🤝 ${p.actor} bought ${p.icon} ${p.asset} from ${p.target} for ${money(p.amt)}`,
    log_trade_offer: p => `🤝 ${p.actor} proposed a trade to ${p.target}`,
    log_trade_done: p => `🤝 ${p.actor} and ${p.target} made a deal`,
    log_auction_start: p => `🔨 ${p.actor} put ${p.icon} ${p.asset} up for auction`,
    log_auction_bid: p => `🔨 Bid ${money(p.amt)}`,
    log_auction_won: p => `🔨 ${p.actor} won the auction: ${p.icon} ${p.asset} for ${money(p.amt)}`,
    log_auction_novone: p => `🔨 Auction for ${p.icon} ${p.asset} closed — no bids`,
    log_seize_board: p => `⚔️ ${p.actor} forcibly seized ${p.icon} ${p.asset} from ${p.target}`,
    log_surrender: p => `🏳️ ${p.actor} surrendered — all assets to the bank`,
    log_inactive: p => `👻 ${p.actor} eliminated for inactivity (5 skips) — assets to bank`,
    log_investigation: p => `🔍 Investigators gathering material on ${p.actor} (evidence: ${p.n})`,
    log_case_open: p => `📢 Case opened against ${p.actor}! 3 rounds to settle`,
    log_confiscate: p => `🔨 Confiscation: ${p.icon} ${p.asset} seized from ${p.actor}`,
    log_offshore_saved: p => `🏝️ ${p.actor}'s assets hidden offshore — confiscation foiled`,
    log_jailed: p => `⛓️ ${p.actor} detained for a round, fine ${money(p.amt)}`,
    log_unrest: p => `⚠️ ${p.flag} ${p.zone}: unrest hits assets${p.title ? ' — "' + p.title + '"' : ''}`,
    log_war: p => `💥 ${p.flag} ${p.zone}: military escalation${p.title ? ' — "' + p.title + '"' : ''}`,
    log_mayor_expired: p => `🕳️ Deal with the mayor of ${p.zone} expired`,
    log_win: p => `🏆 ${p.actor} first to reach ${money(p.amt)} — wins!`,
    log_win_time: p => `🏆 Match time is up. Winner — ${p.actor} with ${money(p.amt)} net worth!`,
    log_win_last: p => `🏆 ${p.actor} is the last player standing — wins!`,
    log_game_over: p => `🏆 Game over. Winner: ${p.actor}`,
    log_skip: p => `⏭️ ${p.actor} skips a turn`,
    log_roll: p => `🎲 ${p.actor} rolled ${p.d1}+${p.d2}=${p.sum} → cell ${p.pos}`,
    log_release: p => `🔓 ${p.actor} released — can roll`,
    log_jail_skip: p => `⛓️ ${p.actor} in jail: ${p.n} round(s) left`,
    log_go_jail: p => `⛓️ ${p.actor} sent to jail. Bail ${money(p.amt)} or skip 2 turns`,
    log_tax: p => `🧾 ${p.actor} pays tax ${money(p.amt)} to the bank`,
    log_roof: p => `🕶️ ${p.actor} pays the roof ${money(p.amt)}`,
    log_riots: p => `⚠️ ${p.actor} caught in riots — skips a turn`,
    log_disaster: p => `🌪️ ${p.actor} hit by a natural disaster — skips a turn`,
    log_card: p => `🃏 ${p.actor} draws a card: "${p.card}"`,
    log_card_skipped_noprops: p => `ℹ️ ${p.actor} owns no property — card had no effect`,
    log_start: p => `🏁 ${p.actor} landed exactly on GO: +${money(p.amt)}`,
    log_pass_start: p => `🏁 ${p.actor} passed GO: +${money(p.amt)}`,
    log_chain: p => `${p.first ? '🥇' : '🔗'} ${p.actor} collected chain "${p.chain}"${p.first ? ' FIRST' : ''} — bonus ${money(p.amt)}`,
  },
};
const CARD_TXT = {};
function logText(e) {
  const tpl = (LOG_TPL[LANG] && LOG_TPL[LANG][e.key]) || LOG_TPL.ru[e.key];
  if (!tpl) return '';
  const allProps = S.zones.flatMap(z => z.assets);
  const propById = Object.fromEntries(allProps.map(a => [a.id, a]));
  const disp = id => { if (!id) return ''; const pl = S.players.find(p => p.id === id); return pl ? pl.name : (nameCache[id] || (id === PID ? t('you') : '?')); };
  const zoneName = zid => { const z = S.zones.find(x => x.id === zid); return z ? zn(z) : zid; };
  const cardText = cid => {
    const c = S.cards?.find(x => x.id === cid) || null;
    if (!c) return cid;
    return LANG === 'en' ? (c.textEn || c.text) : c.text;
  };
  const P = { ...e.params };
  if (e.params.assetId) { const a = propById[e.params.assetId]; P.asset = a ? an(a) : e.params.assetId; P.icon = P.icon || a?.icon || ''; }
  P.actor = disp(e.actorId);
  P.target = disp(e.targetId);
  if (e.params.zoneId) P.zone = zoneName(e.params.zoneId);
  if (e.params.cardId) P.card = cardText(e.params.cardId);
  return tpl(P);
}

document.querySelectorAll('.langsw .lg').forEach(b => b.onclick = () => {
  LANG = b.dataset.lang; localStorage.setItem(SE_LANG_KEY, LANG);
  applyStaticI18n();
  if (S) render();
  // список комнат на экране входа (gate) рендерится отдельно от render() и раньше
  // не перестраивался при смене языка — из-за этого «нет открытых комнат» оставалось на RU.
  if (!S && typeof loadRoomsList === 'function') loadRoomsList();
});
applyStaticI18n();

/* ================= APP ================= */
const $ = id => document.getElementById(id);
let ws, S = null, PID = localStorage.getItem('se_pid') || null, lastLogTop = 0;
const nameCache = {};

const money = n => {
  n = Math.round(n || 0);
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
  if (a >= 1e3) return s + '$' + Math.round(a / 1e3) + 'K';
  return s + '$' + a;
};
const pct = v => (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

// toast живёт как отдельный DOM-узел (не через innerHTML доски, чтобы не терять таймер
// анимации при каждом ререндере), но визуально пришит внутрь игрового поля сверху.
let toastEl = null;
function ensureToastEl() {
  if (toastEl && document.body.contains(toastEl)) return toastEl;
  toastEl = document.createElement('div');
  toastEl.id = 'toast';
  toastEl.className = 'toast hidden';
  return toastEl;
}
function toast(msg, cls = '') {
  const el = ensureToastEl();
  const boardwrap = document.querySelector('#tab-board .boardwrap');
  if (boardwrap && el.parentElement !== boardwrap) boardwrap.appendChild(el);
  else if (!boardwrap && el.parentElement !== document.body) document.body.appendChild(el);
  el.textContent = msg; el.className = 'toast ' + cls;
  clearTimeout(el._h); el._h = setTimeout(() => el.classList.add('hidden'), 2600);
}

/* ---------- rooms / lobby ---------- */
const urlParams = new URLSearchParams(location.search);
const joinRoomId = urlParams.get('r') || null;
let ROOM = { id: joinRoomId || 'main', isPublic: true, withBots: !joinRoomId, title: null };

function enterGame() {
  const name = ($('nameInput').value || window.bash.user?.username || 'Player').trim().slice(0, 18);
  localStorage.setItem('se_name', name);
  $('gate').classList.add('hidden');
  $('app').classList.remove('hidden');
  connect(name);
}

if (joinRoomId) {
  $('gateMenu').classList.add('hidden');
  $('joinLinkBox').classList.remove('hidden');
  $('joinLinkBtn').onclick = enterGame;
} else {
  $('botsBtn').onclick = () => {
    ROOM = { id: 'main', isPublic: true, withBots: true, title: null };
    enterGame();
  };
  $('createPubBtn').onclick = () => createRoom(true);
  $('createPrivBtn').onclick = () => createRoom(false);
  loadRoomsList();
}

async function createRoom(isPublic) {
  try {
    const r = await fetch('/api/rooms/create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPublic, withBots: false, title: null }),
    });
    const data = await r.json();
    ROOM = { id: data.id, isPublic, withBots: false, title: null };
    enterGame();
  } catch { toast('Ошибка создания комнаты', 'bad'); }
}

async function loadRoomsList() {
  try {
    const r = await fetch('/api/rooms');
    const list = await r.json();
    const box = $('roomsList');
    if (!list.length) { box.innerHTML = `<div class="mini" style="padding:4px 2px">${t('noRooms')}</div>`; return; }
    box.innerHTML = `<div class="sh-sub" style="margin-bottom:6px">${t('roomsListTitle')}</div>` +
      list.map(rm => `<div class="room-item" data-room="${rm.id}">
        <div><div class="rname">${(rm.title || rm.id)}</div><div class="rmeta">${t('roomPlayers', rm.players, rm.bots)}</div></div>
        <div class="rjoin">${t('join')} →</div>
      </div>`).join('');
    box.querySelectorAll('.room-item').forEach(el => el.onclick = () => {
      ROOM = { id: el.dataset.room, isPublic: true, withBots: false, title: null };
      enterGame();
    });
  } catch {}
}

/* ---------- connect ---------- */
function connect(name) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({
    type: 'join', pid: PID, name,
    pfp: window.bash.user?.pfp || null,
    roomId: ROOM.id, isPublic: ROOM.isPublic, withBots: ROOM.withBots, title: ROOM.title,
  }));
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.type === 'joined') {
      PID = m.pid; localStorage.setItem('se_pid', PID);
      if (m.roomId) ROOM.id = m.roomId;
    }
    if (m.type === 'state') {
      S = m.state;
      // запоминаем имена всех, кто хоть раз был в комнате — иначе после выбывания/захвата
      // места ботом хроника не найдёт игрока в S.players и покажет "Ты"/"?" вместо имени
      (S.players || []).forEach(p => { nameCache[p.id] = p.name; });
      render(); updateShareLink();
    }
    if (m.type === 'result') { if (!m.ok) toast(m.msg, 'bad'); }
  };
  ws.onclose = () => { toast(t('connLost'), 'bad'); setTimeout(() => connect(name), 1800); };
}

let shareLinkShown = false;
function updateShareLink() {
  if (shareLinkShown || !S?.room) return;
  if (S.room.id === 'main') return; // главный публичный стол — делиться не нужно
  shareLinkShown = true;
  const url = location.origin + '/?r=' + encodeURIComponent(S.room.id);
  const btn = document.createElement('button');
  btn.className = 'rules-link';
  btn.title = t('shareRoom');
  btn.textContent = '🔗';
  btn.style.background = 'none'; btn.style.border = 'none'; btn.style.cursor = 'pointer'; btn.style.fontSize = '16px';
  btn.onclick = () => {
    navigator.clipboard?.writeText(url).then(() => toast(t('roomLinkCopied'), 'good')).catch(() => {});
  };
  const bar = document.querySelector('.topbar2');
  if (bar) bar.insertBefore(btn, bar.querySelector('.net'));
}

$('nameInput').value = localStorage.getItem('se_name') || '';

fetch('/api/world').then(r => r.json()).then(w => {
  const ms = Object.values(w.markets || {}).filter(m => m.price);
  if (!ms.length) return;
  $('gateTicker').innerHTML = ms.slice(0, 4).map(m =>
    `${mn(m)}: <b>${m.price}</b> <span class="${m.delta >= 0 ? 'up' : 'down'}">${pct(m.delta)}</span>`).join(' · ')
    + `<br><span style="color:#5a5a66">${t('updated', new Date(w.ts).toLocaleTimeString())}</span>`;
}).catch(() => {});

document.querySelectorAll('.tb').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tb').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('tab-' + b.dataset.tab).classList.add('active');
  $('main').scrollTop = 0;
});

$('endBtn').onclick = () => { ws.send(JSON.stringify({ type: 'ready' })); toast(t('endRoundWait')); };

/* ---------- sheet ---------- */
function openSheet(html) { $('sheetIn').innerHTML = html; $('sheet').classList.remove('hidden'); }
function closeSheet() { $('sheet').classList.add('hidden'); }
$('sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
window.closeSheet = closeSheet;

function act(a, arg) { ws.send(JSON.stringify({ type: 'action', act: a, arg: arg || {} })); closeSheet(); }
window.act = act;

/* ---------- render ---------- */
function render() {
  if (!S) return;
  const me = S.me;
  if (me) {
    $('hWhite').textContent = money(me.white);
    $('hBlack').textContent = money(me.black);
    $('hInf').textContent = me.influence;
    $('hHeat').textContent = me.heat;
    $('hNet').textContent = money(me.netWorth);
    $('hAp').textContent = '◆'.repeat(me.ap) + '◇'.repeat(Math.max(0, S.cfg.apPerRound - me.ap));
    const al = $('alertBar');
    if (me.jailed > 0) { al.className = 'alert'; al.textContent = t('jailed', me.jailed); }
    else if (me.caseOpen > 0) { al.className = 'alert'; al.textContent = t('caseOpenAlert', me.caseOpen); }
    else if (me.heat >= 70) { al.className = 'alert'; al.textContent = t('heatAlert', me.heat); }
    else al.className = 'alert hidden';
  }
  $('hRound').textContent = S.room.round;

  // ticker (курс всегда к USD)
  const tk = S.markets.filter(m => m.price != null).map(m =>
    `<span>${mn(m)} <b>${m.price}</b> <b class="${m.delta >= 0 ? 'up' : 'down'}">${pct(m.delta)}</b></span>`).join('');
  const ti = $('tickInner');
  if (ti.dataset.k !== tk) { ti.dataset.k = tk; ti.innerHTML = tk + tk; }

  renderBoard(); renderMap(); renderCrime(); renderNews(); renderChains();

  const top = S.room.log[0];
  if (top && top.t !== lastLogTop) {
    // Собираем все НОВОЗАСтрОАННые за раз записи (с предыдущего lastLogTop до текущего top) —
    // если бот за один тик сделал несколько действий (купил + взял мэра и т.д.), старая
    // логика брала только вершнию запись и теряла все промежуточные события (включая покупку).
    const newEntries = [];
    for (const l of S.room.log) {
      if (l.t === lastLogTop) break;
      newEntries.push(l);
    }
    lastLogTop = top.t;
    if (!newEntries.length) newEntries.push(top);
    // оверлей карты/покупки в центре поля — берём самое свежее такое событие из пачки
    // (newEntries[0] — самая новая, так как room.log хранится в порядке unshift).
    // Готовый HTML кладём в activeOverlay — renderBoard() встроит его в центр
    // поля сам при каждой перерисовке (вместо полной блокировки рендера доски,
    // как было раньше через overlayActive).
    const overlayEntry = newEntries.find(l => ['log_card', 'log_buy', 'log_buyout', 'log_accept_offer', 'log_auction_won'].includes(l.key));
    if (overlayEntry) {
      const html = overlayEntry.key === 'log_card' ? buildCardOverlayHtml(overlayEntry) : buildBuyOverlayHtml(overlayEntry);
      if (html) { activeOverlay = { html, until: Date.now() + OVERLAY_MS }; renderBoard(); }
    }
    // toasts — для всех новых записей по порядку (старые → новые), но не более 3 сразу, чтобы не забивать экран.
    for (const l of newEntries.slice().reverse().slice(-3)) {
      if (!['world', 'law', 'attack', 'buy', 'corrupt', 'win'].includes(l.kind)) continue;
      const mineEvent = l.actorId === PID || l.targetId === PID;
      const text = logText(l);
      if (text) toast((mineEvent ? '👉 ' : '') + text.slice(0, 110), mineEvent ? 'good' : '');
    }
  }
}

// Активный оверлей карты/покупки в центре поля. Замечание: раньше оверлей вставлялся
// напрямую в DOM и блокировал renderBoard() целиком на 1.7с — из-за этого кнопки
// «бросить/завершить ход» перестали реагировать, если чужой оверлей (от бота) возникал
// в момент моего броска. Теперь оверлей — чистый HTML-снимок, который renderBoard()
// сам встраивает в центр поля при каждой перерисовке, не блокируя остальной рендер.
let activeOverlay = null; // { html, until }
// длительность показа карточки/оверлея покупки в центре поля — увеличена, чтобы успевать прочитать текст
const OVERLAY_MS = 2800;

// анимация вытянутой карты — переворачивается в воздухе и встаёт в центр поля на 1.5 сек
let lastCardT = 0;
function buildCardOverlayHtml(e) {
  if (e.t === lastCardT) return null;
  lastCardT = e.t;
  const card = S.cards?.find(c => c.id === e.params?.cardId);
  if (!card) return null;
  const isChance = card.id.startsWith('ch_');
  const actor = S.players.find(p => p.id === e.actorId);
  const who = e.actorId === PID ? t('you') : (actor?.name || '?');
  const txt = LANG === 'en' ? (card.textEn || card.text) : card.text;
  const title = (LANG === 'en' ? card.titleEn : card.title) || (isChance ? t('cellChance') : t('cellChest'));
  const icon = card.icon || (isChance ? '🎯' : '🎁');
  // Настоящая игровая карта, как в оригинальной Монополии: сверху название колоды,
  // в центре крупная иллюстрация-рамка с иконкой действия, под ней заголовок, и текст карты.
  return `<div class="card-center ${isChance ? '' : 'chest'}">
      <div class="cf-deck">${isChance ? t('cellChance') : t('cellChest')}</div>
      <div class="cf-art"><div class="cf-icon">${icon}</div></div>
      <div class="cf-title">${title}</div>
      <div class="cf-text">${txt}</div>
      <div class="cf-actor">${who}</div></div>`;
}

// анимация покупки недвижимости — слева достопримечательность города, справа объект (8-бит)
let lastBuyT = 0;
function buildBuyOverlayHtml(e) {
  if (e.t === lastBuyT) return null;
  lastBuyT = e.t;
  const allProps = S.zones.flatMap(z => z.assets);
  const a = allProps.find(x => x.id === e.params?.assetId);
  if (!a) return null;
  const z = S.zones.find(x => x.id === a.zone);
  if (!z) return null;
  const landmark = (z.landmarks || [])[0] || z.flag;
  const actor = S.players.find(p => p.id === e.actorId);
  const who = e.actorId === PID ? t('you') : (actor?.name || '?');
  return `<div class="buy-center">
      <div class="bc-side">
        <div class="bc-pixel">${landmark}</div>
        <div class="bc-name">${zn(z)}</div>
      </div>
      <div class="bc-arrow">🡆</div>
      <div class="bc-side">
        <div class="bc-pixel">${a.icon}</div>
        <div class="bc-name">${an(a)}</div>
      </div>
      <div class="cf-actor">${who} ${LANG==='en'?'buys':'купил'}</div>
    </div>`;
}


/* ---------- ДОСКА ---------- */
// сетка 11×11 — равные шаги по обеим осям, поэтому каждая клетка имеет одинаковый размер.
// Прямоугольная широкая форма поля достигается не за счёт сетки, а за счёт самого контейнера
// .boardwrap (широкий прямоугольник) — тогда клетки автоматически растягиваются в одинаковые
// прямоугольники нужных пропорций, без «кривых» угловых клеток.
function cellGrid(i) {
  if (i <= 10) return { r: 11, c: 11 - i };              // низ: справа налево
  if (i <= 20) return { r: 11 - (i - 10), c: 1 };        // лево: вверх
  if (i <= 30) return { r: 1, c: 1 + (i - 20) };         // верх: слева направо
  return { r: 1 + (i - 30), c: 11 };                     // право: вниз
}
const PCOLORS = ['#4ba3ff', '#3ecf8e', '#ffc46b', '#c99bff', '#ff8a95', '#7cc6ff'];
// цвет игрока должен быть стабильным на всю партию. S.players на сервере отсортирован
// по netWorth (рейтинг) и меняется кадрр от кадра — если брать цвет по индексу в этом
// массиве, цвет игрока прыгает при каждой смене расклада — из-за этого и возникала путаница
// «я в списке игроков синий, а мои объекты подсвечены зелёным». Фиксируем карту
// pid -> цвет, присваивая в порядке первого появления (и не меняя потом).
const pcolorMap = new Map();
function pcolor(pid) {
  if (pcolorMap.has(pid)) return pcolorMap.get(pid);
  // привязываем цвет к позиции игрока в room.order (порядок вступления в игру —
  // одинаков для всех клиентов и НЕ меняется при смене рейтинга). S.room.order пришёл с сервера.
  const order = S?.room?.order;
  let idx = Array.isArray(order) ? order.indexOf(pid) : -1;
  if (idx < 0) idx = pcolorMap.size; // fallback для pid без order (не должно случаться)
  const c = PCOLORS[idx % PCOLORS.length];
  pcolorMap.set(pid, c);
  return c;
}
const specName = ty => ({
  start: t('cellStart'), jail: t('cellJail'), free_parking: t('cellFree'), go_to_jail: t('cellGoJail'),
  income_tax: t('cellTax'), pay_roof: t('cellRoof'), riots: t('cellRiots'), disaster: t('cellDisaster'),
  chance: t('cellChance'), chest: t('cellChest'),
}[ty] || '');
const specIcon = ty => ({
  start: '🏁', jail: '🏯', free_parking: '🅿️', go_to_jail: '🚔', income_tax: '🧾',
  pay_roof: '🕶️', riots: '⚠️', disaster: '🌪️', chance: '🎯', chest: '🎁',
}[ty] || '·');

// Стандартные раскладки точек на кубике 1..6 (позиции в сетке 3x3, 1-based row/col)
const PIP_LAYOUTS = {
  1: [[2,2]],
  2: [[1,1],[3,3]],
  3: [[1,1],[2,2],[3,3]],
  4: [[1,1],[1,3],[3,1],[3,3]],
  5: [[1,1],[1,3],[2,2],[3,1],[3,3]],
  6: [[1,1],[1,3],[2,1],[2,3],[3,1],[3,3]],
};
function matchTimerText() {
  if (!S?.room?.matchEndsAt) return t('winGoalHint');
  const left = Math.max(0, S.room.matchEndsAt - Date.now());
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return t('matchTimeLeft', `${m}:${String(s).padStart(2, '0')}`);
}
function dieFace(n) {
  const pips = PIP_LAYOUTS[n] || PIP_LAYOUTS[1];
  // рисуем 9 ячеек 3x3, точки только в нужных позициях
  let html = '';
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) {
    const has = pips.some(p => p[0] === r && p[1] === c);
    html += `<div class="pip" style="grid-row:${r};grid-column:${c};${has ? '' : 'visibility:hidden'}"></div>`;
  }
  return html;
}

let diceAnim = 0;
let diceRollT = 0, diceRollTimer = null, diceShowFinal = false, diceRand1 = 1, diceRand2 = 1;
const DICE_ROLL_MS = 700;
function startDiceRollAnim(rollT) {
  if (diceRollT === rollT) return; // уже анимируем этот бросок
  diceRollT = rollT;
  diceShowFinal = false;
  clearInterval(diceRollTimer);
  const startedAt = Date.now();
  diceRollTimer = setInterval(() => {
    diceRand1 = 1 + Math.floor(Math.random() * 6);
    diceRand2 = 1 + Math.floor(Math.random() * 6);
    if (Date.now() - startedAt >= DICE_ROLL_MS) {
      clearInterval(diceRollTimer);
      diceShowFinal = true;
      renderBoard();
      return;
    }
    renderDiceOnly();
  }, 90);
}
function renderDiceOnly() {
  const box = document.querySelector('#tab-board .dice');
  if (!box) return;
  const lr = S.room?.lastRoll;
  const finalD1 = lr?.d1 || 1, finalD2 = lr?.d2 || 1;
  const showingFinal = diceShowFinal;
  const d1 = showingFinal ? finalD1 : diceRand1;
  const d2 = showingFinal ? finalD2 : diceRand2;
  const shaking = !showingFinal ? 'rolling' : '';
  box.innerHTML = `<div class="die ${shaking}">${dieFace(d1)}</div><div class="die ${shaking}">${dieFace(d2)}</div>`;
}
// Анимация движения фишки по клеткам.
// Важно: НЕ мутируем p.pos в S.players напрямую — сервер шлёт новый state
// потенциально каждые несколько сотен миллисекунд (действия ботов, пульс таймера),
// и каждый такой state полностью заменяет S (и S.players) новыми объектами,
// где pos уже равен финальному значению на сервере. Если анимация в этот момент
// продолжает прибавлять +1 к уже финальной позиции — получается лишний полный
// круг вокруг доски. Фиксим тем, что ведём анимируемую позицию в отдельном оверлее,
// независимом от S, а renderBoard() берёт позицию из него, если он активен.
let animTokenPid = null, animTo = null, animStep = 0, animTimer = null, animPos = 0, animRollAt = 0;
window._tokenAnimOverride = () => (animTokenPid != null ? { pid: animTokenPid, pos: animPos } : null);
function tickTokenAnim() {
  if (animTokenPid == null) return;
  animPos = (animPos + 1) % 40;
  animStep++;
  renderBoardOnly();
  if (animPos === animTo || animStep > 40) {
    animTokenPid = null;
    renderBoardOnly();
  } else {
    animTimer = setTimeout(tickTokenAnim, 180);
  }
}
window.renderBoardOnly = () => renderBoard();

// масштаб игрового поля кнопками +/- (сохраняется между рендерами и между сессиями)
let boardScale = parseFloat(localStorage.getItem('se_boardscale') || '1');
window.boardZoom = dir => {
  boardScale = Math.max(0.85, Math.min(1.3, +(boardScale + dir * 0.1).toFixed(2)));
  localStorage.setItem('se_boardscale', boardScale);
  applyBoardScale();
};
function applyBoardScale() {
  const bw = document.querySelector('#tab-board .boardwrap');
  if (!bw) return;
  const baseW = Math.max(560, window.innerWidth - 360);
  const baseH = Math.max(420, window.innerHeight - 198);
  bw.style.width = Math.round(baseW * boardScale) + 'px';
  bw.style.height = Math.round(baseH * boardScale) + 'px';
}

window.addEventListener('resize', () => {
  if (S) applyBoardScale();
});

window.showDiceOracle = () => {
  const o = S?.room?.diceOracle;
  if (!o) return;
  const latest = (o.rolls || []).slice(-5).reverse().map(r =>
    `<div class="fact"><span>#${r.dice[0].nonce}/${r.dice[1].nonce} · ${r.d1}+${r.d2}</span><b>${r.dice[0].proof.slice(0, 12)}…</b></div>`
  ).join('');
  openSheet(`
    <div class="sh-title">🔐 Проверяемые кубики</div>
    <div class="sh-sub">SHA-256 commitment публикуется до первого броска. После финала seed раскрывается, и все HMAC можно воспроизвести.</div>
    <div class="fact"><span>Commitment</span><b style="word-break:break-all">${o.commitment}</b></div>
    <div class="fact"><span>Бросков</span><b>${o.rollCount ?? (o.rolls || []).length}</b></div>
    ${o.revealedSeed ? `<div class="fact"><span>Revealed seed</span><b style="word-break:break-all">${o.revealedSeed}</b></div>` : `<div class="mini">Seed будет раскрыт после окончания партии.</div>`}
    ${latest}
    <div class="rowbtns"><button class="btn" onclick="closeSheet()">${t('close')}</button></div>
  `);
};
function renderBoard() {
  if (!S.board) return;
  // ВАЖНО: раньше тут был гейт `if (overlayActive) return;`, который полностью пропускал
  // всю функцию (включая кнопки «бросить/завершить ход» и авто-открытие покупки) каждый
  // раз, когда у ЛЮБОГО игрока за столом (включая ботов) показывалась карта/покупка.
  // В комнате с активными ботами такие события идут почти непрерывно — из-за этого
  // вся доска практически не обновлялась: кнопки «зависали», а мой собственный
  // авто-попап покупки никогда не заводился, если в тот момент был активен чужой оверлей.
  // Теперь вместо блокировки всего рендера оверлей просто встраивается в центр поля ниже,
  // пока он актуален по времени (см. overlayHtml).
  const me = S.me;
  const myTurn = S.room.currentPid === PID;
  const curPlayer = S.players.find(p => p.id === S.room.currentPid);
  const curName = curPlayer ? (curPlayer.id === PID ? t('you') : curPlayer.name) : '—';
  const allProps = S.zones.flatMap(z => z.assets);
  const propById = Object.fromEntries(allProps.map(a => [a.id, a]));

  const cells = S.board.map(c => {
    const g = cellGrid(c.i);
    const corner = [0, 10, 20, 30].includes(c.i);
    // игрок, чья фишка сейчас анимируется — показывается в промежуточной клетке animPos,
    // а не в финальной p.pos с сервера (иначе анимация делает лишний круг).
    const toks = S.players.filter(p => !p.eliminated)
      .map(p => ({ p, pos: (p.id === animTokenPid ? animPos : (p.pos || 0)) }))
      .filter(x => x.pos === c.i)
      .map(({ p }) => {
        const isMe = p.id === PID;
        const inner = p.pfp
          ? `<img src="${p.pfp}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
          : (isMe ? '★' : (p.name[0] || '?'));
        return `<div class="tok ${isMe ? 'mine' : ''}" style="background:${p.pfp ? 'transparent' : pcolor(p.id)};border-color:${pcolor(p.id)}"
          title="${isMe ? t('you') : p.name}">${inner}</div>`;
      }).join('');
    if (c.type === 'prop') {
      const a = propById[c.propId];
      if (!a) return '';
      // Подсветка клетки владельца берёт цвет из той же палитры, что и фишка/строка в списке
      // игроков (pcolor) — раньше была всегда зелёная/красная и не совпадала с цветом игрока.
      const own = c.owner ? (c.owner === PID ? 'own-me' : 'own-rival') : '';
      const ownColor = c.owner ? pcolor(c.owner) : null;
      const hereCls = me && me.pos === c.i ? 'here' : '';
      return `<div class="cell k-${a.kind} ${own} ${hereCls}" style="grid-row:${g.r};grid-column:${g.c}${ownColor ? `;border-color:${ownColor}` : ''}"
        onclick="showAsset('${a.zone}','${a.id}')">
        <div class="cnum">${c.i}</div>
        <div class="cico">${a.icon}</div>
        <div class="cnm ${an(a).length > 14 ? 'long' : ''}">${an(a)}</div>
        <div class="cpr">${money(a.value)}</div>
        <div class="toks">${toks}</div></div>`;
    }
    const hereCls = me && me.pos === c.i ? 'here' : '';
    return `<div class="cell spec ${corner ? 'corner' : ''} ${hereCls}" style="grid-row:${g.r};grid-column:${g.c}">
      <div class="cnum">${c.i}</div>
      <div class="cico">${specIcon(c.type)}</div><div class="cnm ${specName(c.type).length > 14 ? 'long' : ''}">${specName(c.type)}</div>
      <div class="toks">${toks}</div></div>`;
  }).join('');

  const lr = S.room.lastRoll;
  const isNew = lr && Date.now() - lr.at < 1500;
  if (lr) startDiceRollAnim(lr.at);
  if (isNew) {
    diceAnim = Date.now();
    // запускаем анимацию движения фишки от from к to (через отдельный animPos, без мутации S).
    // animRollAt гатит запуск ровно один раз на каждый реальный бросок (не на каждый render).
    if (lr.from != null && lr.from !== lr.to && animRollAt !== lr.at) {
      animRollAt = lr.at;
      animTokenPid = lr.pid;
      animTo = lr.to;
      animPos = lr.from;
      animStep = 0;
      clearTimeout(animTimer);
      tickTokenAnim();
    }
    // если это МОЙ бросок и я встал на свободную клетку-бизнес — авто-открыть шит покупки
    if (lr.pid === PID && lr.event?.type === 'prop_free' && window._lastAutoBuy !== lr.at) {
      window._lastAutoBuy = lr.at;
      const propId = lr.event.propId;
      if (propId) setTimeout(() => {
        // перепроверяем свежий S вместо захваченного allProps: за 1.7с актив мог уже
        // купить бот на аукционе — тогда автопопап покупки не должен перекрывать другой оверлей.
        const freshProps = S.zones.flatMap(z => z.assets);
        const fresh = freshProps.find(x => x.id === propId);
        if (!fresh || fresh.owner) return;
        if (!document.getElementById('sheet').classList.contains('hidden')) return;
        showAsset(fresh.zone, fresh.id);
      }, OVERLAY_MS);
    }
  }
  const rollingNow = lr && !diceShowFinal && diceRollT === (lr.at);
  const shaking = rollingNow ? 'rolling' : '';
  const d1 = rollingNow ? diceRand1 : (lr?.d1 || 1);
  const d2 = rollingNow ? diceRand2 : (lr?.d2 || 1);

  const left = Math.max(0, S.room.phaseEndsAt - Date.now());
  const secs = Math.ceil(left / 1000);
  const inJail = me && me.jailed > 0;
  // время хода не ограничено для живого игрока в комнате «играть с ботами»
  const unlimitedTurn = S.room.withBots && me && !me.isBot;
  const timerHtml = unlimitedTurn ? '' : `<div class="phasebar">${secs}s</div>`;

  let ctl = '';
  if (S.room.finished) {
    const w = S.players.find(p => p.id === S.room.winner);
    ctl = `<div class="turnbadge mine"><b>🏆 ${w ? (w.id === PID ? t('you') : w.name) : ''}</b></div>
      <button class="rollbtn" onclick="restartGame()">${t('playAgainBtn')}</button>`;
  } else if (myTurn && inJail) {
    ctl = `<div class="evtbox mine">${t('inJailMsg', me.jailed)}</div>
      <button class="rollbtn" onclick="act('pay_bail')">${t('payBail', money(S.fees.jailBail))}</button>
      <button class="rollbtn" style="background:#2a2a33;color:#e8e6e0" onclick="act('end_turn')">${t('endTurnBtn')}</button>`;
  } else if (myTurn && !me.rolledThisTurn) {
    ctl = `<button class="rollbtn" onclick="act('roll')">${t('rollBtn')}</button>
      ${timerHtml}`;
  } else if (myTurn) {
    ctl = `<button class="rollbtn" onclick="act('end_turn')">${t('endTurnBtn')}</button>
      ${timerHtml}`;
  } else {
    ctl = `<div class="turnbadge">${t('turnOf', curName)}</div>${timerHtml}`;
  }

  const evtInfo = lr && Date.now() - lr.at < 6000 ? eventText(lr) : null;

  const surrenderBtn = !S.room.finished && me
    ? `<button class="surrenderbtn" onclick="confirmSurrender()">${t('surrenderBtn')}</button>` : '';

  // центр поля: НЕТ лого — тут место для анимации карточки при вытягивании,
  // либо (если игроки объявили аукцион) — блок торгов
  const au = S.room.auction;
  // встраиваем активный оверлей (если он ещё не истёк по времени) прямо в разметку —
  // без этого он бы терялся при каждой перерисовке доски (тик таймера, действия ботов).
  const overlayHtml = (activeOverlay && Date.now() < activeOverlay.until) ? activeOverlay.html : '';
  const center = au ? renderAuctionCenter(au, allProps, propById) : `<div class="center">
    <div class="matchtimer">${matchTimerText()}</div>
    <div id="centerCardSlot">${overlayHtml}</div>
    <div class="turnbadge ${myTurn ? 'mine' : ''}">${myTurn ? '<b>' + t('yourTurn') + '</b>' : t('turnOf', curName)}</div>
    <div class="dice"><div class="die ${shaking}">${dieFace(d1)}</div><div class="die ${shaking}">${dieFace(d2)}</div></div>
    ${S.room.diceOracle ? `<div class="oracle-proof" onclick="showDiceOracle()" title="Открыть журнал проверяемых бросков">🔐 dice ${S.room.diceOracle.commitment.slice(0, 12)}… · #${S.room.diceOracle.nonce}${S.room.diceOracle.revealedSeed ? ' · seed revealed' : ''}</div>` : ''}
    ${ctl}
    ${evtInfo ? `<div class="evtbox ${evtInfo.cls}">${evtInfo.text}</div>` : ''}
    ${surrenderBtn}
  </div>`;

  // стопки карт — вынесены за пределы поля справа, чтобы не закрывать угловые клетки
  const chanceLeft = S.decksLeft?.chance ?? 16;
  const chestLeft = S.decksLeft?.chest ?? 16;
  const decksCol = `<div class="decks-col">
    <div class="decks-row">
      <div class="deckpile" title="${t('cellChance')}"><div class="back"></div><div class="cnt">${chanceLeft}</div></div>
      <div class="deckpile chest" title="${t('cellChest')}"><div class="back"></div><div class="cnt">${chestLeft}</div></div>
    </div>
    <div class="chronicle-ticker" title="${t('chronicle')}">
      <div class="ct-head">${t('chronicle')}</div>
      <div class="ct-inner"></div>
    </div>
  </div>`;

  // мои объекты карточками — цена/аренда живые
  const mine = allProps.filter(a => a.owner === PID);
  const cards = mine.length ? mine.map(a => {
    const up = a.income >= a.base;
    return `<div class="mycard ${up ? 'up-p' : 'down-p'}" onclick="showAsset('${a.zone}','${a.id}')">
      <div class="mc1">${a.icon}</div>
      <div class="mc2">${an(a)}</div>
      <div class="mc3">${money(a.value)}</div>
      <div class="mc4">${t('rentLbl')} ${money(Math.round(a.income * 0.5))}</div></div>`;
  }).join('') : `<div class="mini" style="padding:6px 2px">${t('noAssets')}</div>`;

  const offers = (S.room.offers || []).filter(o => o.from !== PID);
  const offersHtml = offers.length ? `<div class="sec-title">${t('offersTitle')}</div>` + offers.map(o => {
    const a = propById[o.assetId]; if (!a) return '';
    return `<div class="scheme" onclick="act('accept_offer',{assetId:'${o.assetId}'})">
      <div class="sico">${a.icon}</div><div class="sinfo"><div class="stitle">${an(a)}</div>
      <div class="sdesc">${S.players.find(p => p.id === o.from)?.name || ''}</div></div>
      <div class="scost">${t('buyFor', money(o.price))}</div></div>`;
  }).join('') : '';

  // список игроков — теперь прямо на странице доски (левый нижний угол), без отдельной вкладки
  const ranklist = renderRankList();

  $('tab-board').innerHTML = `
    <div class="boardlayout">
      <div class="side-left">
        <div class="corner">
          <div class="sec-title">${t('myAssets')}</div>
          <div class="mycards">${cards}</div>
          ${offersHtml}
        </div>
        <div class="corner">
          <div class="sec-title">${t('tabRank')}</div>
          ${ranklist}
        </div>
      </div>
      <div class="boardwrap">
        <div class="board">${cells}${center}</div>
      </div>
      <div class="side-right">
        <div class="zoomctl">
          <button class="zbtn" onclick="boardZoom(1)" title="${t('zoomIn')}">+</button>
          <button class="zbtn" onclick="boardZoom(-1)" title="${t('zoomOut')}">−</button>
        </div>
        <div class="corner corner-tr">
          ${decksCol}
        </div>
      </div>
    </div>`;
  renderChronicleTicker();
  applyBoardScale();
  // toast — переносим внутрь свежесозданного .boardwrap, чтобы уведомления
  // всегда были видны наверху игрового поля (а не терялись при ререндере доски)
  const bw = document.querySelector('#tab-board .boardwrap');
  if (bw && toastEl) bw.appendChild(toastEl);
}

function renderAuctionCenter(au, allProps, propById) {
  const a = propById[au.assetId] || allProps.find(x => x.id === au.assetId);
  const bidder = au.currentBidder ? S.players.find(p => p.id === au.currentBidder) : null;
  const left = Math.max(0, au.endsAt - Date.now());
  const secs = Math.ceil(left / 1000);
  const me = S.me;
  const iPassed = me && (au.passed || []).includes(me.id);
  const nextMin = au.currentBid + Math.max(2000, Math.round(au.currentBid * 0.1));
  const canBid = me && !iPassed && me.id !== au.currentBidder;
  return `<div class="center auction-center">
    <div class="sec-title" style="margin:0">${t('auctionBtn')}</div>
    <div class="cf-icon" style="font-size:44px">${a?.icon || '🏢'}</div>
    <div class="cf-text" style="font-size:14px">${a ? an(a) : ''}</div>
    <div class="big-num up">${money(au.currentBid)}</div>
    <div class="mini">${bidder ? t('auctionLeader', bidder.name) : t('auctionNoBids')} · <span class="auction-time">${secs}s</span></div>
    ${canBid ? `
      <div class="rowbtns">
        <button class="rollbtn" style="font-size:15px;padding:10px 18px" onclick="act('auction_bid',{amount:${nextMin}})">+${money(nextMin - au.currentBid)}</button>
        <button class="btn" onclick="act('auction_pass')">${t('auctionPassBtn')}</button>
      </div>` : iPassed ? `<div class="mini">${t('auctionYouPassed')}</div>` : ''}
  </div>`;
}

// Кнопка «Переиграть» после окончания партии — сбрасывает комнату на сервере и перезаходит
// в неё заново 'sтем же pid (сервер и так пересоздаёт комнату при входе в finished-комнату,
// но кнопка даёт явное и мгновенное действие всем за столом, без ожидания чьего-то reconnect).
window.restartGame = () => { ws.send(JSON.stringify({ type: 'reset' })); };

window.confirmSurrender = () => {
  openSheet(`<div class="sh-title">🏳️ ${t('surrenderBtn')}</div>
    <div class="sh-sub">${t('surrenderConfirm')}</div>
    <div class="rowbtns"><button class="btn danger" onclick="act('surrender')">${t('surrenderBtn')}</button>
    <button class="btn" onclick="closeSheet()">${t('cancel')}</button></div>`);
};

function eventText(lr) {
  const e = lr.event; if (!e) return null;
  const isMine = lr.pid === PID;
  const actor = S.players.find(p => p.id === lr.pid);
  const who = isMine ? t('you') : (actor?.name || '');
  const cls = isMine ? 'mine' : 'rival';
  const allProps = S.zones.flatMap(z => z.assets);
  const nm = id => { const a = allProps.find(x => x.id === id); return a ? a.icon + ' ' + an(a) : ''; };
  const wrap = text => ({ text, cls });
  switch (e.type) {
    case 'prop_free':  return wrap(`<b>${who}</b> ${t('evStandsOn')} ${nm(e.propId)}`);
    case 'prop_rent': {
      const ownerP = allProps.find(a => a.id === e.propId);
      const ownerName = ownerP?.ownerName || '';
      const toWhom = isMine ? ownerName : t('you');
      return wrap(`<b>${who}</b> ${t('evPaysRent')} ${nm(e.propId)} → ${toWhom}: ${money(e.paid)}${e.mult > 1 ? ' ×' + e.mult : ''}${e.unpaid ? ' (' + money(e.unpaid) + ' ' + t('evDebt') + ')' : ''}`);
    }
    case 'prop_own':   return wrap(`<b>${who}</b> ${t('evOnOwn')} ${nm(e.propId)}`);
    case 'card':       return wrap(`🃏 <b>${who}</b>: «${LANG === 'en' ? (e.card.textEn || e.card.text) : e.card.text}»`);
    case 'income_tax': return wrap(`🧾 <b>${who}</b> ${t('evTax')} ${money(e.amount)}`);
    case 'pay_roof':   return wrap(`🕶️ <b>${who}</b> ${t('evRoof')} ${money(e.amount)}`);
    case 'go_to_jail': return wrap(`🚔 <b>${who}</b> → ${t('cellGoJail')}`);
    case 'riots':      return wrap(`⚠️ <b>${who}</b>: ${t('cellRiots')}`);
    case 'disaster':   return wrap(`🌪️ <b>${who}</b>: ${t('cellDisaster')}`);
    case 'start':      return wrap(`🏁 <b>${who}</b> +${money(e.amount)}`);
    default: return null;
  }
}

function renderChains() {
  const chains = S.room.chains || [];
  const allProps = S.zones.flatMap(z => z.assets);
  const propById = Object.fromEntries(allProps.map(a => [a.id, a]));
  $('tab-chains').innerHTML = `<div class="mini" style="margin:0 2px 9px">${t('chainsHint')}</div>
    <div class="sec-title">${t('chainsTitle')}</div>` + chains.map(ch => {
    const have = ch.slots.filter(s => s.revealed && propById[s.propId]?.owner === PID).length;
    const revealedCount = ch.slots.filter(s => s.revealed).length;
    const done = ch.slots.every(s => s.revealed && propById[s.propId]?.owner === PID);
    const claimer = ch.claimedBy ? S.players.find(p => p.id === ch.claimedBy)?.name : null;
    const slotsHtml = ch.slots.map(s => {
      if (s.revealed) {
        const a = propById[s.propId];
        const mineP = a?.owner === PID;
        return `<span class="cpi ${mineP ? 'have' : ''}">${a ? a.icon + ' ' + an(a) : s.propId}</span>`;
      }
      const clue = LANG === 'en' ? s.clueEn : s.clue;
      return `<span class="cpi mystery">❓ ${clue}</span>`;
    }).join('');
    return `<div class="chain ${done ? 'done' : ''}">
      <h4>${LANG === 'en' ? ch.nameEn : ch.name} · ×${ch.rentMult} · +${money(ch.bonus)}</h4>
      <div class="cd">${t('chainRevealHint', have)}</div>
      <div class="cp">${slotsHtml}</div>
      <div class="mini" style="margin-top:5px">${have}/4 ${t('chainYours')} · ${claimer ? t('claimedBy', claimer) : t('notClaimed')}</div>
    </div>`;
  }).join('');
}

function renderMap() {
  const html = S.zones.map(z => {
    const wx = z.weather;
    const mayor = S.room.zoneBribe[z.id];
    const pills = [
      z.warN ? `<span class="pill war">💥 ${t('war')} ${z.warN}</span>` : '',
      z.unrestN ? `<span class="pill unrest">⚠️ ${t('unrest')} ${z.unrestN}</span>` : '',
      wx ? `<span class="pill wx">${Math.round(wx.t)}°C ${wx.wind >= 28 ? '💨' : ''}${wx.precip >= 2 ? '🌧️' : ''}</span>` : '',
      mayor ? `<span class="pill mayor">🤝 ${mayor.owner === PID ? t('yourMayor') : t('mayorBought')}</span>` : '',
    ].join('');
    const assets = z.assets.map(a => {
      const mine = a.owner === PID;
      const cls = a.owner ? (mine ? 'owned' : 'rival') : '';
      const ownColor = a.owner ? pcolor(a.owner) : null;
      const kindLbl = a.kind === 'legal' ? t('legal') : a.kind === 'grey' ? t('grey') : t('crime');
      const kind = `<span class="kind k-${a.kind}">${kindLbl}</span>`;
      const sub = a.owner
        ? (mine ? t('owned') : a.ownerName) + (a.frozen ? ' · ❄️' + t('frozenTag') : '') + (a.damaged ? ' · 🔥' + t('damagedTag') : '')
        : t('free') + ' · ' + (a.kind === 'crime' ? t('forCash') + ' ' + money(a.value * 0.7) : money(a.value));
      // подсветка владельца — тот же цвет, что и в списке игроков (pcolor), а не всегда зелёный/красный
      return `<div class="asset ${cls} ${a.frozen ? 'frozen' : ''}" style="${ownColor ? `border-color:${ownColor}` : ''}" onclick="showAsset('${z.id}','${a.id}')">
        <div class="aico">${a.icon}</div>
        <div class="ainfo"><div class="aname">${an(a)}${kind}</div><div class="asub">${sub}</div></div>
        <div class="aright"><div class="aval">${money(a.value)}</div>
          <div class="ainc ${a.income >= 0 ? 'up' : 'down'}">${a.income >= 0 ? '+' : ''}${money(a.income)}/r</div></div>
      </div>`;
    }).join('');
    return `<div class="zone"><div class="zhead"><div class="zflag">${z.flag}</div>
      <div class="zname">${zn(z)}</div><div class="zmeta">${pills}</div></div>
      <div class="zbody">${assets}</div></div>`;
  }).join('');
  $('tab-map').innerHTML = `<div class="mini" style="margin:0 2px 9px">${t('mapHint')}</div>` + html;
}

window.startAuctionFromSheet = assetId => {
  act('start_auction', { assetId });
};
window.showAsset = (zid, aid) => {
  const z = S.zones.find(x => x.id === zid);
  const a = z.assets.find(x => x.id === aid);
  const me = S.me;
  const mine = a.owner === PID;
  const facts = a.factors.map(f => {
    const label = f.key ? t(f.key, f.params || {}) : (f.k || '');
    return `<div class="fact"><span>${label}</span><b class="${f.v > 0 ? 'up' : f.v < 0 ? 'down' : ''}">${f.v === 0 ? '—' : pct(f.v)}</b></div>`;
  }).join('');
  let btns = '';
  if (!a.owner) {
    const cost = a.kind === 'crime' ? a.value * 0.7 : a.value;
    const onMyCell = S.me && S.me.pos === a.pos;
    const auctionBtn = onMyCell && !S.room.auction
      ? `<button class="btn" onclick="startAuctionFromSheet('${a.id}')">${t('auctionBtn')}</button>` : '';
    btns = `<div class="rowbtns"><button class="btn primary" onclick="act('buy',{assetId:'${a.id}'})">${t('buy', money(cost) + (a.kind === 'crime' ? ' ' + t('buyBlack') : ''))}</button>
      <button class="btn" onclick="closeSheet()">${t('later')}</button></div>
      ${auctionBtn ? `<div class="rowbtns">${auctionBtn}</div>` : ''}`;
  } else if (!mine) {
    const buyoutPrice = Math.round(a.value * 1.6);
    const myMayor = S.room.zoneBribe[z.id]?.owner === PID;
    // Захват (seize) требует все условия сразу: актив повреждён рейдом, свой мёр,
    // достаточно влияния (Ⅵ6) и нала ($130K) и очков действия (2 AP). Раньше
    // кнопка показывалась только при damaged+myMayor, и игрок часто видел отказ «не хватает влияния/нала/AP»
    // без объяснения — теперь при недостатке ресурса показывается точная чёрная кнопка всё равно,
    // но с подсказкой, чего ичез — а сервер всё равно перепроверит все условия при act('seize').
    const seizeAct = S.actions?.seize || { ap: 2, inf: 6, black: 130000 };
    const missing = [];
    if ((me.ap || 0) < (seizeAct.ap ?? 2)) missing.push(t('needAp', seizeAct.ap ?? 2));
    if (me.influence < (seizeAct.inf || 0)) missing.push(t('needInfluence', seizeAct.inf));
    if (me.black < (seizeAct.black || 0)) missing.push(t('needCash', money(seizeAct.black)));
    // Аренда платится автоматически в момент попадания на клетку — кнопка
    // «заплатить аренду» тут не нужна (и вводила в заблуждение).
    btns = `
      <div class="rowbtns"><button class="btn danger" onclick="act('audit_rival',{assetId:'${a.id}'})">${t('auditBtn')}</button>
      <button class="btn danger" onclick="act('raid',{assetId:'${a.id}'})">${t('raidBtn')}</button></div>
      <div class="rowbtns"><button class="btn primary" onclick="act('buyout',{assetId:'${a.id}'})">${t('buyoutBtn', money(buyoutPrice))}</button></div>
      ${a.damaged && myMayor ? `<div class="rowbtns"><button class="btn danger" ${missing.length ? 'disabled' : ''} onclick="act('seize',{assetId:'${a.id}'})">${t('seizeBtn')}</button></div>` : ''}
      ${a.damaged && myMayor && missing.length ? `<div class="mini" style="margin:6px 2px;color:#ff9aa5">${t('seizeMissing', missing.join(', '))}</div>` : ''}
      ${a.damaged && !myMayor ? `<div class="mini" style="margin:6px 2px;color:#ff9aa5">${t('seizeNeedMayor')}</div>` : ''}
      <div class="rowbtns"><button class="btn" onclick="closeSheet()">${t('close')}</button></div>`;
  } else {
    const rate = 0.45 + Math.max(0, Math.min(100, S.me?.rep || 50)) / 100 * 0.45;
    const bankPrice = Math.round(a.value * rate);
    btns = `<div class="rowbtns"><button class="btn" onclick="act('sell_bank',{assetId:'${a.id}'})">${t('sellBank', money(bankPrice))}</button></div>
      <div class="rowbtns"><button class="btn" onclick="act('offer_asset',{assetId:'${a.id}',price:${Math.round(a.value * 1.1)}})">${t('offerPlayers')} ${money(Math.round(a.value * 1.1))}</button></div>
      <div class="rowbtns"><button class="btn" onclick="closeSheet()">${t('close')}</button></div>`;
  }
  const lm = (z.landmarks || []).map(e => `<div class="landmark l8">${e}</div>`).join('');
  openSheet(`<div class="sh-title">${a.icon} ${an(a)}</div>
    <div class="sh-sub">${z.flag} ${zn(z)} · ${t('linkedTo', a.link.toUpperCase())} · ${t('leverage')} ${a.beta}</div>
    ${lm ? `<div class="landmarks">${lm}</div>` : ''}
    <div class="big-num ${a.income >= 0 ? 'up' : 'down'}">${a.income >= 0 ? '+' : ''}${money(a.income)}<span style="font-size:13px;color:#8b8b96"> ${a.kind === 'crime' ? t('perRoundBlack') : t('perRoundWhite')}</span></div>
    <div class="mini" style="margin:3px 0 10px">${t('baseIncome', money(a.base))} · ${t('value', money(a.value))}${a.owner ? ' · ' + t('ownerLbl') + ': ' + (mine ? t('you') : a.ownerName) : ''}</div>
    <div class="sec-title">${t('why')}</div>${facts || `<div class="mini">${t('calm')}</div>`}
    ${z.headlines.length ? `<div class="sec-title">${t('newsSec')}</div>` + z.headlines.slice(0, 3).map(h =>
      `<div class="news"><div class="nhead"><a href="${h.link}" target="_blank" rel="noopener">${h.title}</a></div><div class="nmeta">${h.src || ''}</div></div>`).join('') : ''}
    ${btns}`);
};

function renderCrime() {
  const me = S.me; if (!me) return;
  const allProps = S.zones.flatMap(z => z.assets);
  const zoneOpts = S.zones.map(z => `<div class="scheme" onclick="act('bribe_mayor',{zone:'${z.id}'})">
    <div class="sico">${z.flag}</div><div class="sinfo"><div class="stitle">${zn(z)}</div>
    <div class="sdesc">${t('mayorDesc')}</div></div>
    <div class="scost">◆4 · $90K<em>палево +12</em></div></div>`).join('');

  const tenderOpts = S.zones.map(z => `<div class="scheme" onclick="act('tender',{zone:'${z.id}'})">
    <div class="sico">📜</div><div class="sinfo"><div class="stitle">${t('tenderTitle', zn(z))}</div>
    <div class="sdesc">${t('tenderDesc')}</div></div>
    <div class="scost">◆5<em>палево +10</em></div></div>`).join('');

  const rivals = S.players.filter(p => p.id !== PID);
  const caseBlock = (me.evidence > 0 || me.caseOpen > 0) ? `
    <div class="case"><h3>${me.caseOpen > 0 ? t('caseOpenTitle') : t('caseInvestTitle')}</h3>
    <div class="mini">${t('evidenceCount', me.evidence, me.caseOpen)}</div>
    <div class="bar"><i style="width:${Math.min(100, me.evidence / 3 * 100)}%"></i></div>
    <div class="rowbtns">
      <button class="btn" onclick="act('bribe_prosecutor')">${t('payProsecutor', '$' + (60 + me.evidence * 45) + 'K')}</button>
      <button class="btn danger" onclick="pickSnitch()">${t('snitchBtn')}</button>
    </div></div>` : '';

  // входящие торговые предложения от других игроков (адресованные лично мне)
  const incomingTrades = (S.room.trades || []).filter(tr => tr.to === PID);
  const tradesBlock = incomingTrades.length ? `
    <div class="sec-title">${t('tradeBtn')}</div>
    ${incomingTrades.map(tr => {
      const fromP = S.players.find(p => p.id === tr.from);
      const giveA = tr.giveAssetId ? allProps.find(x => x.id === tr.giveAssetId) : null;
      const wantA = tr.wantAssetId ? allProps.find(x => x.id === tr.wantAssetId) : null;
      const parts = [];
      if (giveA) parts.push(`${giveA.icon} ${an(giveA)} → ${t('you')}`);
      if (wantA) parts.push(`${wantA.icon} ${an(wantA)} → ${fromP?.name || ''}`);
      if (tr.cashDelta > 0) parts.push(`+${money(tr.cashDelta)} → ${t('you')}`);
      if (tr.cashDelta < 0) parts.push(`+${money(-tr.cashDelta)} → ${fromP?.name || ''}`);
      return `<div class="scheme">
        <div class="sico">🤝</div><div class="sinfo"><div class="stitle">${fromP?.name || '?'}</div>
        <div class="sdesc">${parts.join(' · ')}</div></div></div>
        <div class="rowbtns">
          <button class="btn primary" onclick="act('accept_trade',{tradeId:'${tr.id}'})">${t('acceptTradeBtn')}</button>
          <button class="btn" onclick="act('decline_trade',{tradeId:'${tr.id}'})">${t('declineTradeBtn')}</button>
        </div>`;
    }).join('')}` : '';

  $('tab-crime').innerHTML = caseBlock + tradesBlock + `
    <div class="sec-title">${t('tradeBtn')} / ${t('seizeBoardBtn')}</div>
    <div class="scheme" onclick="openTradeSheet()">
      <div class="sico">🤝</div><div class="sinfo"><div class="stitle">${t('tradeBtn')}</div>
      <div class="sdesc">${t('tradeDesc')}</div></div></div>
    <div class="scheme" onclick="openSeizeBoardSheet()">
      <div class="sico">⚔️</div><div class="sinfo"><div class="stitle">${t('seizeBoardBtn')}</div>
      <div class="sdesc">${t('seizeBoardDesc')}</div></div>
      <div class="scost">◆8 · $160K<em>палево +32</em></div></div>

    <div class="sec-title">${t('heatRepTitle', me.heat, me.rep)}</div>
    <div class="bar"><i style="width:${me.heat}%"></i></div>
    <div class="mini" style="margin:5px 2px 0">${t('heatCostHint', money(me.heat * 400))}</div>

    <div class="sec-title">${t('secBlackNoCrime')}</div>
    <div class="scheme" onclick="pickSkim()">
      <div class="sico">🧾</div><div class="sinfo"><div class="stitle">${t('skimTitle')}</div>
      <div class="sdesc">${t('skimDesc')}</div></div>
      <div class="scost"><em>+9</em></div></div>
    ${me.tender ? `<div class="scheme" onclick="act('kickback')">
      <div class="sico">💸</div><div class="sinfo"><div class="stitle">${t('kickbackTitle')}</div>
      <div class="sdesc">${t('kickbackDesc')}</div></div>
      <div class="scost"><em>+14</em></div></div>` : ''}

    <div class="sec-title">${t('secMoney')}</div>
    <div class="scheme" onclick="act('launder',{amount:${Math.round(me.black)}})">
      <div class="sico">🧺</div><div class="sinfo"><div class="stitle">${t('launderTitle', money(me.black))}</div>
      <div class="sdesc">${t('launderDesc', me.influence >= 8 ? '18' : '25')}</div></div>
      <div class="scost"><em>+6</em></div></div>
    <div class="scheme" onclick="act('lobby')">
      <div class="sico">🎩</div><div class="sinfo"><div class="stitle">${t('lobbyTitle')}</div>
      <div class="sdesc">${t('lobbyDesc')}</div></div>
      <div class="scost">$42K</div></div>
    <div class="scheme" onclick="act('offshore')">
      <div class="sico">🏝️</div><div class="sinfo"><div class="stitle">${t('offshoreTitle', me.offshore ? '✅' : '')}</div>
      <div class="sdesc">${t('offshoreDesc')}</div></div>
      <div class="scost">$120K<em>+5</em></div></div>

    <div class="sec-title">${t('secDefense')}</div>
    <div class="scheme" onclick="act('protection')">
      <div class="sico">🦺</div><div class="sinfo"><div class="stitle">${t('protTitle', me.protection ? '✅' : '')}</div>
      <div class="sdesc">${t('protDesc')}</div></div>
      <div class="scost">$40K<br>−$12K/r</div></div>
    <div class="scheme" onclick="act('buy_inspector')">
      <div class="sico">📋</div><div class="sinfo"><div class="stitle">${t('inspTitle', me.insider > 0 ? '✅ ' + me.insider : '')}</div>
      <div class="sdesc">${t('inspDesc')}</div></div>
      <div class="scost">$60K<em>+8</em></div></div>

    <div class="sec-title">${t('secMayor')}</div>${zoneOpts}
    <div class="sec-title">${t('secTender')}</div>${tenderOpts}
    <div class="mini" style="margin:14px 2px">${t('attackHint')} ${rivals.length ? '' : t('noRivals')}</div>`;
}

window.openTradeSheet = () => {
  const allProps = S.zones.flatMap(z => z.assets);
  const myAssets = allProps.filter(a => a.owner === PID);
  const rivals = S.players.filter(p => p.id !== PID && !p.eliminated);
  if (!rivals.length) return toast(t('noRivals'), 'bad');
  openSheet(`<div class="sh-title">${t('tradeSheetTitle')}</div>
    <div class="sh-sub">${t('pickPlayer')}</div>
    <select id="tr-target" class="btn big" style="width:100%;margin-bottom:10px">
      ${rivals.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
    </select>
    <div class="mini">${t('tradeGiveLbl')}</div>
    <select id="tr-give" class="btn big" style="width:100%;margin-bottom:10px">
      <option value="">${t('none')}</option>
      ${myAssets.map(a => `<option value="${a.id}">${a.icon} ${an(a)} (${money(a.value)})</option>`).join('')}
    </select>
    <div class="mini" id="tr-want-label">${t('tradeWantLbl')}</div>
    <select id="tr-want" class="btn big" style="width:100%;margin-bottom:10px"></select>
    <div class="mini">${t('tradeCashLbl')}</div>
    <input id="tr-cash" type="number" value="0" step="1000" class="btn big" style="width:100%;margin-bottom:10px">
    <div class="rowbtns"><button class="btn primary" onclick="sendTradeOffer()">${t('sendTradeBtn')}</button>
    <button class="btn" onclick="closeSheet()">${t('cancel')}</button></div>`);
  const updateWantOptions = () => {
    const targetId = document.getElementById('tr-target').value;
    const theirAssets = allProps.filter(a => a.owner === targetId);
    document.getElementById('tr-want').innerHTML = `<option value="">${t('none')}</option>` +
      theirAssets.map(a => `<option value="${a.id}">${a.icon} ${an(a)} (${money(a.value)})</option>`).join('');
  };
  document.getElementById('tr-target').onchange = updateWantOptions;
  updateWantOptions();
};
window.sendTradeOffer = () => {
  const targetId = document.getElementById('tr-target').value;
  const giveAssetId = document.getElementById('tr-give').value || null;
  const wantAssetId = document.getElementById('tr-want').value || null;
  const cashDelta = Math.round(+document.getElementById('tr-cash').value || 0);
  act('propose_trade', { targetId, giveAssetId, wantAssetId, cashDelta });
};

window.openSeizeBoardSheet = () => {
  const allProps = S.zones.flatMap(z => z.assets);
  const targets = allProps.filter(a => a.owner && a.owner !== PID);
  if (!targets.length) return toast(t('noRivals'), 'bad');
  openSheet(`<div class="sh-title">${t('seizeSheetTitle')}</div>
    <div class="sh-sub">${t('seizeSheetSub')}</div>
    <div class="picklist">${targets.map(a => `<div class="scheme" onclick="act('seize_board',{assetId:'${a.id}'});closeSheet()">
      <div class="sico">${a.icon}</div><div class="sinfo"><div class="stitle">${an(a)}</div>
      <div class="sdesc">${a.ownerName || ''}</div></div>
      <div class="scost">${money(a.value)}</div></div>`).join('')}</div>
    <div class="rowbtns"><button class="btn" onclick="closeSheet()">${t('cancel')}</button></div>`);
};

window.pickSkim = () => {
  const me = S.me;
  const opts = [0.2, 0.4, 0.6].filter(f => me.white * f >= 20000);
  if (!opts.length) return toast(t('skimTooLittle'), 'bad');
  openSheet(`<div class="sh-title">${t('skimSheetTitle')}</div>
    <div class="sh-sub">${t('skimSheetSub')}</div>
    <div class="picklist">${opts.map(f => {
      const amt = Math.round(me.white * f);
      return `<div class="scheme" onclick="act('skim',{amount:${amt}})">
        <div class="sico">💵</div><div class="sinfo"><div class="stitle">${Math.round(f * 100)}%</div>
        <div class="sdesc">${money(amt)} → ${money(amt * 0.55)}</div></div>
        <div class="scost"><em>+9</em></div></div>`;
    }).join('')}</div>
    <div class="rowbtns"><button class="btn" onclick="closeSheet()">${t('cancel')}</button></div>`);
};

window.pickSnitch = () => {
  const rivals = S.players.filter(p => p.id !== PID);
  openSheet(`<div class="sh-title">${t('snitchTitle')}</div>
    <div class="sh-sub">${t('snitchSub')}</div>
    <div class="picklist">${rivals.map(p => `<div class="scheme" onclick="act('snitch',{targetId:'${p.id}'})">
      <div class="sico">${p.isBot ? '🤖' : '👤'}</div><div class="sinfo"><div class="stitle">${p.name}</div>
      <div class="sdesc">${t('capitalLbl')} ${money(p.netWorth)} · ${t('heatLbl')} ${p.heat}</div></div>
      <div class="scost">${t('evidenceToHim')}</div></div>`).join('')}</div>
    <div class="rowbtns"><button class="btn" onclick="closeSheet()">${t('cancel')}</button></div>`);
};

function renderNews() {
  const zones = [...S.zones].sort((a, b) => (b.war + b.unrest) - (a.war + a.unrest));
  const blocks = zones.map(z => {
    const hs = z.headlines.map(h => `<div class="news">
      <div class="nhead"><a href="${h.link}" target="_blank" rel="noopener">${h.title}</a></div>
      <div class="nmeta">${h.tags.map(tg => `<span class="tagx t-${tg}">${tg === 'war' ? t('tagWAR') : tg === 'unrest' ? t('tagUNREST') : t('tagCRIME')}</span>`).join('')}${h.src || ''}</div></div>`).join('');
    const eff = z.war > 0.3 ? t('effWar') : z.unrest > 0.3 ? t('effUnrest') : t('effCalm');
    return `<div class="sec-title">${z.flag} ${zn(z).toUpperCase()} ${t('zoneEffect', eff)}</div>${hs || `<div class="mini">${t('quiet')}</div>`}`;
  }).join('');
  $('tab-news').innerHTML = `<div class="mini" style="margin:0 2px 8px">${t('updated', new Date(S.worldTs).toLocaleTimeString())} · ${S.worldLive ? t('liveData') : t('cachedData')} · ${t('realNewsHint')}</div>
    ${blocks}`;
}

// Хроника партии — бегущая строка справа от игрового поля (не отдельная вкладка)
let lastChronicleTop = 0;
function renderChronicleTicker() {
  const el = document.querySelector('#tab-board .chronicle-ticker .ct-inner');
  if (!el) return;
  const top = S.room.log[0];
  // не перестраиваем без необходимости (сохраняем плавность CSS-анимации),
  // НО если элемент только что создан заново после ререндера доски (innerHTML доски
  // пересобирается целиком) — он пустой, и его обязательно нужно заполнить сразу.
  if (el.childElementCount > 0 && top && top.t === lastChronicleTop) return;
  lastChronicleTop = top ? top.t : 0;
  // только реальные ходы/действия игроков — без мировых новостей (те остаются во вкладке «Мир»)
  const items = S.room.log.filter(l => l.key !== 'log_unrest' && l.key !== 'log_war').slice(0, 20).map(l => {
    const mineEvent = l.actorId === PID || l.targetId === PID;
    const text = logText(l);
    return `<div class="ct-item ${mineEvent ? 'mine' : ''}">${text}</div>`;
  }).join('') || `<div class="ct-item">${t('quiet')}</div>`;
  el.innerHTML = items + items; // дублируем для бесшовной прокрутки
}

const TIER_BARS = ['░', '▒', '▓', '█', '★'];
// компактный список игроков — теперь прямо в углу доски (не отдельная вкладка)
function renderRankList() {
  return S.players.map((p, i) => {
    const isMe = p.id === PID;
    return `<div class="prow mini-prow ${isMe ? 'me' : ''}">
    <div class="pnum">${i + 1}</div>
    <div class="pav" style="border:2px solid ${pcolor(p.id)}">${p.pfp ? `<img src="${p.pfp}">` : `<span style="color:${pcolor(p.id)};font-weight:800">${(p.name[0] || '?')}</span>`}</div>
    <div class="pinfo"><div class="pname">${p.name}${isMe ? ' (' + t('you') + ')' : ''}${p.jailed ? ' ⛓️' : ''}${p.caseOpen ? ' 📢' : ''}${p.eliminated ? ' 💀' : ''}</div></div>
    <div class="pworth">${money(p.netWorth)}</div>
  </div>`;
  }).join('');
}

setInterval(() => {
  if (!S) return;
  const unlimitedTurn = S.room.withBots && S.me && !S.me.isBot;
  const auction = S.room.auction;
  const left = Math.max(0, (auction?.endsAt || S.room.phaseEndsAt) - Date.now());
  const sec = Math.ceil(left / 1000);
  $('hTimer').textContent = S.room.finished
    ? t('finalLbl')
    : (auction ? `🔨 ${sec}s` : (unlimitedTurn ? '∞' : sec + 's'));
  // обновляем только цифру таймера внутри доски — НЕ весь renderBoard(),
  // иначе кнопка кубика пересоздаётся 4 раза в секунду и клик по ней "срывается"
  const pb = document.querySelector('#tab-board .phasebar');
  if (pb && !S.room.finished && !auction) pb.textContent = sec + 's';
  const at = document.querySelector('#tab-board .auction-time');
  if (at && auction) at.textContent = sec + 's';
  const mt = document.querySelector('#tab-board .matchtimer');
  if (mt) mt.textContent = matchTimerText();
}, 250);
