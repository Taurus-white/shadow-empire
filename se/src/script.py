cat > /tmp/fix_game.py << 'EOF'
import re

with open('game.js', 'r') as f:
    content = f.read()

content = content.replace('startInfluence: 6,', 'startInfluence: 5,')

seize_block = """      if (!mayor || mayor.owner !== pid) return fail('Нужен свой мэр в этой зоне — иначе захват не оформить');

      // ПРОВЕРКА ВСЕХ УСЛОВИЙ ЗАХВАТА
      const def = DEF.seize;
      if (p.influence < def.inf) return fail('Не хватает влияния (нужно 6)');
      if (p.black < def.black) return fail('Не хватает нала (нужно $130K)');
      if (p.ap < def.ap) return fail('Не хватает AP (нужно 2)');"""

content = content.replace(
    "if (!mayor || mayor.owner !== pid) return fail('Нужен свой мэр в этой зоне — иначе захват не оформить');",
    seize_block,
    1
)

with open('game.js', 'w') as f:
    f.write(content)

print("Готово!")
EOF
