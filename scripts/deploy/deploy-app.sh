#!/usr/bin/env bash
# Deploy / aktualizace aplikace na serveru (spouštět z kořene repa nebo s nastaveným APP_DIR).
# Příklad:
#   export DEPLOY_GIT_REPO="https://github.com/vase-org/west-county-akce.git"
#   export DEPLOY_GIT_BRANCH="main"
#   bash scripts/deploy/deploy-app.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/west-county-akce}"
DEPLOY_GIT_REPO="${DEPLOY_GIT_REPO:-}"
DEPLOY_GIT_BRANCH="${DEPLOY_GIT_BRANCH:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECOSYSTEM_SRC="${SCRIPT_DIR}/ecosystem.config.cjs"

if [[ ! -f "${ECOSYSTEM_SRC}" ]]; then
  echo "Chybí ${ECOSYSTEM_SRC}" >&2
  exit 1
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  if [[ -z "${DEPLOY_GIT_REPO}" ]]; then
    echo "Repozitář v ${APP_DIR} neexistuje. Nastavte DEPLOY_GIT_REPO a spusťte znovu." >&2
    exit 1
  fi
  echo "==> git clone ${DEPLOY_GIT_REPO} -> ${APP_DIR}"
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone --branch "${DEPLOY_GIT_BRANCH}" --depth 1 "${DEPLOY_GIT_REPO}" "${APP_DIR}"
else
  echo "==> git pull (${DEPLOY_GIT_BRANCH})"
  cd "${APP_DIR}"
  git fetch origin "${DEPLOY_GIT_BRANCH}"
  git checkout "${DEPLOY_GIT_BRANCH}"
  git pull --ff-only origin "${DEPLOY_GIT_BRANCH}"
fi

cd "${APP_DIR}"

if [[ ! -f ".env.production" ]]; then
  echo "Varování: chybí ${APP_DIR}/.env.production (viz scripts/deploy/env.production.example)" >&2
fi

echo "==> npm ci"
export NODE_ENV=production
npm ci

echo "==> npm run build"
npm run build

echo "==> PM2 ecosystem"
cp "${ECOSYSTEM_SRC}" "${APP_DIR}/ecosystem.config.cjs"
# cwd v ecosystem musí odpovídat APP_DIR
sed -i "s|/var/www/west-county-akce|${APP_DIR}|g" "${APP_DIR}/ecosystem.config.cjs"

if pm2 describe west-county-akce >/dev/null 2>&1; then
  echo "==> pm2 restart west-county-akce"
  pm2 restart ecosystem.config.cjs --update-env
else
  echo "==> pm2 start west-county-akce"
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
echo "Deploy dokončen. Stav: pm2 status"
pm2 status west-county-akce
