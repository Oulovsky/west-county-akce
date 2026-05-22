# CLEANUP PASS — schema / migrace (priorita 0)

Datum auditu: 2026-05-20

## 1. `templates` / `template_items`

| Kontrola | Výsledek |
|----------|----------|
| Migrace v `supabase/migrations/` | **NE** — žádný soubor nevytváří `templates` ani `template_items` |
| Kód v repu | **ANO** — `app/templates/page.tsx`, `app/templates/[id]/page.tsx` čtou/zapisují tabulky |
| Baseline `20260401000000` | **NE** — tabulky v baseline chybí |

**TODO (před odstraněním legacy routes):**
- [ ] Na produkci ověřit: `SELECT to_regclass('public.templates'), to_regclass('public.template_items');`
- [ ] Pokud tabulky existují: doplnit historickou migraci do repa NEBO označit routes read-only (už je banner)
- [ ] Pokud tabulky neexistují: `/templates` je broken — **nemaž** routes bez rozhodnutí produktu

**Riziko:** Nové prostředí z čistých migrací = `/templates` spadne na DB chybě.

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

SQL dotaz nebyl spuštěn (lokální Postgres neběží; remote query vyžaduje ruční check v Supabase SQL editoru).
