#!/usr/bin/env bash
# SHADOW EMPIRE — установщик на Ubuntu/Debian VPS.
# Запускать на СВОЁМ сервере от root:  bash install.sh [домен]
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR=/opt/shadow-empire
PORT=3000
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf "\n\033[1;33m==> %s\033[0m\n" "$*"; }

[ "$(id -u)" = "0" ] || { echo "Нужен root (sudo bash install.sh)"; exit 1; }

say "1/6 Node.js"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "Node $(node -v) уже подходит"
fi

say "2/6 Копирую приложение в $APP_DIR"
mkdir -p "$APP_DIR"
for f in src public package.json README.md PLAN.md; do
  [ -e "$SRC_DIR/$f" ] && cp -r "$SRC_DIR/$f" "$APP_DIR/"
done
cd "$APP_DIR"
npm install --omit=dev --no-audit --no-fund

say "3/6 Пользователь и права"
if ! id -u shadow >/dev/null 2>&1; then
  if getent group shadow >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin -g shadow shadow
  else
    useradd --system --no-create-home --shell /usr/sbin/nologin --user-group shadow
  fi
fi
chown -R shadow:shadow "$APP_DIR"

say "4/6 systemd-сервис"
cat > /etc/systemd/system/shadow-empire.service <<EOF
[Unit]
Description=Shadow Empire game server
After=network.target

[Service]
Type=simple
User=shadow
WorkingDirectory=$APP_DIR
Environment=PORT=$PORT
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now shadow-empire
sleep 3
systemctl is-active --quiet shadow-empire && echo "сервис поднят" || { journalctl -u shadow-empire -n 30 --no-pager; exit 1; }

say "5/6 nginx"
command -v nginx >/dev/null 2>&1 || apt-get install -y nginx
SRV_NAME="${DOMAIN:-_}"
cat > /etc/nginx/sites-available/shadow-empire <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SRV_NAME;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/shadow-empire /etc/nginx/sites-enabled/shadow-empire
nginx -t && systemctl reload nginx

say "6/6 HTTPS"
if [ -n "$DOMAIN" ]; then
  command -v certbot >/dev/null 2>&1 || apt-get install -y certbot python3-certbot-nginx
  echo "Если домен за Cloudflare — временно переключи DNS-запись в режим 'DNS only' (серая тучка)"
  echo "перед выпуском сертификата, иначе certbot не сможет провалидировать домен."
  read -p "Готово? Enter чтобы продолжить, Ctrl+C чтобы прервать и сделать вручную позже... " _
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m "admin@$DOMAIN" --redirect || echo "Certbot не смог — проверь, что A-запись $DOMAIN указывает на этот сервер и DNS-only в Cloudflare"
  echo; echo "ГОТОВО: https://$DOMAIN"
  echo "Не забудь вернуть в Cloudflare оранжевую тучку (проксирование) для $DOMAIN после выпуска сертификата."
else
  IP=$(curl -s -m 5 ifconfig.me || hostname -I | awk '{print $1}')
  echo; echo "ГОТОВО: http://$IP"
  echo "Домен не указан — HTTPS не выпущен. Для WebSocket на HTTPS-сайте нужен домен + сертификат:"
  echo "  bash install.sh game.твой-домен.ru"
fi

cat <<'TIP'

Полезное:
  systemctl status shadow-empire        # состояние
  journalctl -u shadow-empire -f        # живые логи (видно обновления мира)
  systemctl restart shadow-empire       # рестарт после правок баланса
Файлы: /opt/shadow-empire  (баланс — src/game.js: CFG и ASSETS)
TIP
