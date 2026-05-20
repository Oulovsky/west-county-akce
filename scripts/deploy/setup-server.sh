#!/usr/bin/env bash
# Jednorázová příprava Ubuntu 24.04 (VPS / WEDOS) pro west-county-akce.
# Spusť jako root: sudo bash scripts/deploy/setup-server.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/west-county-akce}"
DEPLOY_USER="${DEPLOY_USER:-$SUDO_USER}"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Spusťte skript jako root (sudo)." >&2
  exit 1
fi

if [[ -z "${DEPLOY_USER}" || "${DEPLOY_USER}" == "root" ]]; then
  echo "Nastavte DEPLOY_USER (běžný SSH uživatel), např.: DEPLOY_USER=ubuntu sudo -E bash scripts/deploy/setup-server.sh" >&2
  exit 1
fi

echo "==> Aktualizace systému"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> Základní balíčky"
apt-get install -y \
  git \
  curl \
  ca-certificates \
  gnupg \
  build-essential \
  nginx \
  ufw

echo "==> Node.js LTS (NodeSource)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"

echo "==> PM2 (globálně)"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "==> Adresář aplikace: ${APP_DIR}"
mkdir -p "${APP_DIR}"
chown -R "${DEPLOY_USER}:www-data" "${APP_DIR}"
chmod -R 775 "${APP_DIR}"

echo "==> PM2 startup (systemd)"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "${DEPLOY_USER}" --hp "/home/${DEPLOY_USER}"

echo ""
echo "Hotovo. Další kroky:"
echo "  1) Naklonujte repozitář do ${APP_DIR} (viz scripts/deploy/README.md)"
echo "  2) Vytvořte ${APP_DIR}/.env.production (šablona: scripts/deploy/env.production.example)"
echo "  3) Nginx: sudo cp scripts/deploy/nginx-westcounty.conf /etc/nginx/sites-available/west-county-akce"
echo "     sudo ln -sf /etc/nginx/sites-available/west-county-akce /etc/nginx/sites-enabled/"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo "  4) Deploy: bash scripts/deploy/deploy-app.sh"
