#!/usr/bin/env bash
set -e

cd /var/www/west-county-akce

echo "== Git pull =="
git pull

echo "== Install dependencies =="
npm ci

echo "== Build =="
npm run build

echo "== Restart PM2 =="
pm2 restart west-county-akce

echo "== Save PM2 process list =="
pm2 save

echo "== Done =="
