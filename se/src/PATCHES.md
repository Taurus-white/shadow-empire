# PATCHES — Исправления багов Shadow Empire

## Баг 1: Начинать с 5 влияния (вместо 6)

**Файл:** `se/src/game.js`, строка 17

**БЫЛО:**
```javascript
startInfluence: 6,
```

**СТАЛО:**
```javascript
startInfluence: 5,
```

---

## Баг 2: Названия объектов в квадратах без пропусков букв

**Где искать:** клиентская часть (фронтенд), не `game.js` или `board.js`

**Что искать:**
- CSS: `letter-spacing`, `text-transform`, `white-space`
- JS: `split('')`, `.map((c,i) => ...)`, `charAt`

**Решение:** Убрать всё, что режет текст на буквы или добавляет пробелы между символами.

---

## Баг 3: Атаки на конкурентов (Карта + Доска) — тап чужого актива + захват

**Где искать:** клиентская часть (фронтенд)

**Что добавить:** обработчик клика по чужому активу → меню действий → "Захват" (вызов API `doAction(room, pid, 'seize', {assetId})`)

---

## Баг 4: Действия в Схемах — выполнять в любое время (не только в свой ход)

**Файл:** `se/src/game.js`

**Где:** найти действия, которые должны работать в любой ход (Схемы), и убрать проверку:
```javascript
if (currentPlayerId(room) !== pid) return fail('Не твой ход');
```

**Оставить** эту проверку только для:
- `roll` (бросок кубика)
- `end_turn` (завершение хода)

**Убрать** для:
- `lobby`, `raid`, `audit_rival`, `protection`, `launder`, `seize`, `seize_board`, `kickback`, `tender` и других действий по схемам

---

## Баг 5: Лоббизм → влияние

**Файл:** `se/src/game.js`, строка 456

**БЫЛО:**
```javascript
case 'lobby': { pay(); p.influence += 2; log(room, 'corrupt', { key: 'log_lobby', actorId: pid }); return { ok: true }; }
```

**СТАЛО:** (если нужно +1 вместо +2)
```javascript
case 'lobby': { pay(); p.influence += 1; log(room, 'corrupt', { key: 'log_lobby', actorId: pid }); return { ok: true }; }
```

---

## Баг 6: Заказать проверку — 40% шанс что жертва узнает заказчика

**Файл:** `se/src/game.js`, строки 401-406

**УЖЕ ГОТОВО:**
```javascript
st.frozen = 2;
const victim = room.players[st.owner];
const caught = Math.random() < 0.4;  // ✅ 40% шанс
log(room, 'attack', { key: 'log_audit', params: { icon: a.icon, assetId: a.id, caught }, actorId: pid, targetId: victim.id });
if (caught) { p.heat += 8; victim.knows = victim.knows || []; victim.knows.push(p.name); }
```

**Проверка:** Убедиться что `log_audit` на клиенте показывает "жертва узнала заказчика" при `caught: true`.

---

## Баг 7: Рейд / поджог — −30% стоимости чужого актива

**Файл:** `se/src/game.js`, строки 408-420

**БЫЛО:**
```javascript
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
    st.damaged = 3;
    victim.white = Math.max(0, victim.white - 40000);  // ❌ фиксированная сумма
    log(room, 'attack', { key: 'log_raid_hit', params: { icon: a.icon, assetId: a.id }, actorId: pid, targetId: victim.id });
  }
  p.rep -= 8; p.evidence += 1;
  return { ok: true };
}
```

**СТАЛО:**
```javascript
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
    st.damaged = 3;
    const value = Math.round(assetValue(a, room) * 0.3);  // ✅ −30% стоимости
    victim.white = Math.max(0, victim.white - value);
    log(room, 'attack', { key: 'log_raid_hit', params: { icon: a.icon, assetId: a.id }, actorId: pid, targetId: victim.id });
  }
  p.rep -= 8; p.evidence += 1;
  return { ok: true };
}
```

---

## Баг 8: Рейдерский захват — нужны ВСЕ условия сразу

**Файл:** `se/src/game.js`, строки 484-497

**БЫЛО:**
```javascript
case 'seize': {
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
```

**СТАЛО:** (добавить проверку влияния, нала и AP)
```javascript
case 'seize': {
  const a = ASSET_BY_ID[arg.assetId];
  const st = a && room.assets[a.id];
  if (!st?.owner || st.owner === pid) return fail('Нужен чужой актив');
  if (!(st.damaged > 0)) return fail('Актив нужно сначала ослабить рейдом');
  if (st.protected || room.players[st.owner].protection) return fail('Актив под крышей — отжать нельзя');
  const mayor = room.zoneBribe[a.zone];
  if (!mayor || mayor.owner !== pid) return fail('Нужен свой мэр в этой зоне — иначе захват не оформить');
  
  // ✅ ПРОВЕРКА ВСЕХ УСЛОВИЙ ЗАХВАТА
  const def = DEF.seize;  // { ap: 2, inf: 6, black: 130000, heat: 30 }
  if (p.influence < def.inf) return fail('Не хватает влияния (нужно 6)');
  if (p.black < def.black) return fail('Не хватает нала (нужно $130K)');
  if (p.ap < def.ap) return fail('Не хватает AP (нужно 2)');
  
  const victim = room.players[st.owner];
  pay();
  st.owner = pid; st.damaged = 0; st.frozen = 0;
  p.rep -= 12; p.evidence += 2;
  log(room, 'attack', { key: 'log_seize', params: { icon: a.icon, assetId: a.id }, actorId: pid, targetId: victim.id });
  return { ok: true };
}
```

---

## Применение патчей на VPS

```bash
cd /opt/shadow-empire/se/src

# 1. Start influence: 6 → 5
sed -i 's/startInfluence: 6,/startInfluence: 5,/' game.js

# 2. Лоббизм: +2 → +1 (если нужно)
sed -i "s/p.influence += 2;/p.influence += 1;/" game.js

# 3. Рейд: -30% стоимости
# Найти строку с victim.white = Math.max(0, victim.white - 40000);
# Заменить на расчёт 30% от assetValue

# 4. Рейдерский захват: добавить проверки влияния/нала/AP
# Вставить после строки с проверкой мэра (if (!mayor || mayor.owner !== pid))
```

---

## Автоматический скрипт (PATCHES.sh)

См. файл `PATCHES.sh` в этом же репозитории.
