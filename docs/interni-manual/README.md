# Interní manuál WEST COUNTY AKCE

## Soubory

| Soubor | Popis |
|--------|--------|
| `index.html` | Manuál v prohlížeči (tisk / mobil) |
| `WEST-COUNTY-AKCE-Interni-manual.pdf` | Finální PDF pro firmu |
| `screenshots/` | Obrázky z aplikace |

## Obnovení PDF

Z kořene projektu:

```bash
npm run manual:pdf
```

Nebo:

```bash
node scripts/generate-interni-manual-pdf.mjs
```

## Aktualizace screenshotů

Po změně UI pořiřte nové snímky z produkce (`https://westcounty.cz`) nebo z lokálního `npm run dev` a uložte je do `screenshots/` se stejnými názvy souborů jako v `index.html`.
