# CLEANUP PASS — schema / migrace (priorita 0)

Datum auditu: 2026-05-20

## 1. `templates` / `template_items`

| Kontrola | Výsledek |
|----------|----------|
| Migrace v `supabase/migrations/` | **NE** — žádný soubor nevytváří `templates` ani `template_items` |
| Kód v repu | **ANO** — `app/templates/page.tsx`, `app/templates/[id]/page.tsx` čtou/zapisují tabulky |
| Baseline `20260401000000` | **NE** — tabulky v baseline chybí |

**Produkce ověřena (2026-05-20, `supabase db query --linked`, projekt `west-county-akce-prod`):**
- `public.templates` — **neexistuje** (`to_regclass` = null)
- `public.template_items` — **neexistuje**
- Aktivní náhrada: `setupy` + `setup_polozky` (v migracích `20260516152000`)

**Řešení v kódu (varianta B):**
- `/templates` → `redirect("/sklad/setupy")` (`app/templates/page.tsx`)
- `/templates/[id]` → `redirect("/sklad/setupy")` (`app/templates/[id]/page.tsx`)
- Migrace `templates` / `template_items` **nevytvářet** (varianta D zamítnuta)

**Riziko po redirectu:** nízké — žádná produkční data, routes nejsou v menu.

## 2. Migrace přepravy (`preprava`)

| Migrace | V repu | Remote (supabase migration list) |
|---------|--------|----------------------------------|
| `20260521180000_add_preprava_attendance.sql` | ano | synced |
| `20260521210000_fix_dochazka_preprava_typ_faze_check.sql` | ano | synced |

`npx supabase migration list` (linked project): **všechny lokální migrace v repu odpovídají remote** včetně `21210000`.

**Závěr:** Přeprava migrace jsou synchronizované. **Novou opravnou migraci nevytvářet.**

## 3. Poznámka: migrace mimo složku repa

V `migration list` se objevuje `20260514154051` (local + remote), ale **soubor není** v `supabase/migrations/` (40 souborů).

**TODO:**
- [ ] Ověřit původ (historický push, jiná větev) — případně doplnit soubor do repa pro reprodukovatelnost

## 4. Ověření tabulek templates na produkci

Hotovo — viz sekce 1 výše. `information_schema` neobsahuje `templates` ani `template_items`.
