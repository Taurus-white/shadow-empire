#!/bin/bash
# PATCHES.sh — Автоматическое применение исправлений багов Shadow Empire
# Запускать из папки se/src

cd "$(dirname "$0")"

echo "=== PATCHES.sh — Применение исправлений ==="
echo

# 1. Start influence: 6 → 5
echo "[1/4] startInfluence: 6 → 5"
sed -i 's/startInfluence: 6,/startInfluence: 5,/' game.js

# 2. Лоббизм: +2 → +1
echo "[2/4] Лоббизм: p.influence += 2 → += 1"
sed -i 's/p\.influence += 2;/p.influence += 1;/' game.js

# 3. Рейд: -30% стоимости (вместо фиксированных -40000)
echo "[3/4] Рейд: victim.white -= 40000 → -= 30% от assetValue"
# Находим строку и заменяем на расчёт 30%
sed -i 's/victim\.white = Math\.max(0, victim\.white - 40000);/const value = Math.round(assetValue(a, room) * 0.3);\n    victim.white = Math.max(0, victim.white - value);/' game.js

# 4. Рейдерский захват: добавить проверки влияния/нала/AP
echo "[4/4] Рейдерский захват: добавить проверки влияния/нала/AP"
# Вставляем проверки после строки с проверкой мэра
sed -i '/if (!mayor || mayor\.owner !== pid) return fail.*свой мэр.*иначе захват не оформить/a\  \n  \/\/ ✅ ПРОВЕРКА ВСЕХ УСЛОВИЙ ЗАХВАТА\n  const def = DEF.seize;  \/\/ { ap: 2, inf: 6, black: 130000, heat: 30 }\n  if (p.influence < def.inf) return fail('\''Не хватает влияния (нужно 6)'\'');\n  if (p.black < def.black) return fail('\''Не хватает нала (нужно $130K)'\'');\n  if (p.ap < def.ap) return fail('\''Не хватает AP (нужно 2)'\'');' game.js

echo
echo "=== Готово! ==="
echo "Проверьте изменения: git diff game.js"
echo "Для отката: git checkout game.js"
