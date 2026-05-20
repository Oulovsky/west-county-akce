# Deploy west-county-akce (VPS / WEDOS, Ubuntu 24.04)

Skripty pro opakované nasazení bez ručního krok-po-kroku postupu.

## Požadavky

- Ubuntu 24.04 na VPS
- SSH přístup (uživatel s `sudo`)
- Git repozitář aplikace
- Supabase projekt (Auth, DB, Storage)
- Doména nebo IP (doporučeno HTTPS + `app.westcounty.cz`)

## 1. Jednorázová příprava serveru

Na serveru (nebo přes SSH) zkopírujte repozitář, pak:

```bash
cd /cesta/k/repu
chmod +x scripts/deploy/*.sh
DEPLOY_USER=ubuntu sudo -E bash scripts/deploy/setup-server.sh
```

`DEPLOY_USER` = váš běžný SSH účet (ne root). Skript nainstaluje git, nginx, Node.js LTS, npm, PM2 a vytvoří `/var/www/west-county-akce`.

## 2. Produkční proměnné (.env.production)

**Soubor jen na serveru**, nikdy v gitu:

```bash
cp scripts/deploy/env.production.example /var/www/west-county-akce/.env.production
nano /var/www/west-county-akce/.env.production
```

Vyplňte hodnoty podle `env.production.example`. Minimálně:

- `NEXT_PUBLIC_APP_URL` — přesná produkční URL (např. `https://app.westcounty.cz`)
- Supabase URL + anon + service role
- `RESEND_API_KEY` (pokud používáte e-maily)
- `REMINDER_ENGINE_SECRET` (pro `/api/reminders/run`)

Next.js načte `.env.production` při `npm run build` a `npm start` s `NODE_ENV=production`.

## 3. Supabase Auth (dashboard)

V **Authentication → URL Configuration**:

| Pole | Hodnota |
|------|---------|
| **Site URL** | `https://app.westcounty.cz` (vaše produkční URL) |
| **Redirect URLs** | `https://app.westcounty.cz/auth/callback` |

Bez správného redirect URL může OAuth skončit na `/?code=...` místo na callbacku (aplikace má fallback v middleware, ale redirect URL musí být v seznamu).

## 4. Deploy aplikace

První deploy (clone):

```bash
export DEPLOY_GIT_REPO="https://github.com/VASE-ORG/west-county-akce.git"
export DEPLOY_GIT_BRANCH="main"
bash scripts/deploy/deploy-app.sh
```

Další deploye (pull + build + restart):

```bash
cd /var/www/west-county-akce
export DEPLOY_GIT_BRANCH="main"
bash scripts/deploy/deploy-app.sh
```

Skript provede: `git pull` → `npm ci` → `npm run build` → `pm2 restart` → `pm2 save`.

Volitelné proměnné:

- `APP_DIR` — výchozí `/var/www/west-county-akce`
- `DEPLOY_GIT_REPO` — URL repa (pouze při prvním clone)
- `DEPLOY_GIT_BRANCH` — výchozí `main`

## 5. Nginx

```bash
sudo cp scripts/deploy/nginx-westcounty.conf /etc/nginx/sites-available/west-county-akce
sudo ln -sf /etc/nginx/sites-available/west-county-akce /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Upravte `server_name` v konfiguraci. Pro HTTPS použijte např. Certbot (`certbot --nginx -d app.westcounty.cz`).

Aplikace běží na `127.0.0.1:3000` (PM2). Nginx proxyuje port 80/443.

## 6. PM2 — restart a logy

```bash
pm2 status
pm2 restart west-county-akce
pm2 logs west-county-akce
pm2 logs west-county-akce --lines 200
pm2 save
```

Konfigurace: `ecosystem.config.cjs` v kořeni deploy adresáře (kopíruje `deploy-app.sh`).

## 7. Kontrola po nasazení

1. `curl -I http://127.0.0.1:3000` na serveru
2. Otevřít produkční URL v prohlížeči
3. Přihlášení Google → redirect na `/auth/callback` → `/zakazky`
4. Volitelně: `GET /api/debug-auth` (dočasný debug endpoint)

## Struktura skriptů

| Soubor | Účel |
|--------|------|
| `setup-server.sh` | Jednorázová instalace OS balíčků, Node, PM2, adresář |
| `deploy-app.sh` | Git pull, build, PM2 restart |
| `nginx-westcounty.conf` | Reverse proxy + upload fotek (50M) |
| `ecosystem.config.cjs` | PM2 proces `west-county-akce` |
| `env.production.example` | Dokumentace env proměnných |

## Poznámky WEDOS / firewall

- Otevřete porty **80** a **443** (ufw nebo panel WEDOS).
- Puppeteer (PDF) na VPS může vyžadovat další knihovny; při chybách build/start zkontrolujte logy PM2.
