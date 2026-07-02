# Audit zakázkového systému

**Datum:** 2025-06-30  
**Rozsah:** Interní aplikace WEST COUNTY + klientská zóna (`/portal`)  
**Metoda:** Revize kódu, datového modelu, migrací a dosavadních provozních incidentů (bez implementace)  
**Stav:** Návrh k schválení — **žádné změny v kódu nebyly provedeny**

---

## 1. Shrnutí

Systém má solidní základ: oddělení klient vs. zaměstnanec je v kódu promyšlené, klientský wizard respektuje vědomý výběr presetů/historie, a workflow poptávka → závazná objednávka → zakázka je technicky implementované. Pro reálný provoz firmy ale naráží na **informační architekturu**, **nejasné stavy** a **nouzové opravy**, které maskují systémové mezery.

**Největší problémy (priorita):**

1. **Rozdílné pohledy na stejná data** — `/admin/klienti` počítá všechny poptávky včetně konceptů; `/zakazky/poptavky` je filtruje → operátor vidí „1 poptávka“ u klienta, ale prázdný inbox (ověřeno u Prchala).
2. **Příliš mnoho entry pointů pro totéž** — zakázky (`/moje`, `/zakazky`, dashboard), místa (globální, per-klient, per-zakázka, presety), kontakty (auth, profiles, klienti, poptávka).
3. **Workflow stavů není srozumitelné obsluze** — 11 stavů poptávky, legacy `ceka_na_schvaleni`, mrtvý stav `schvalena`, badge jen pro `odeslana`.
4. **Identita a e-mail jsou rozptýlené** — chybná doména `@email.com`, dual-account šéf (gmail vs. email.cz), mrtvá tabulka `povolene_emaily`, zastaralá hláška na `/login`.
5. **Chybí provozní nástroje** — vyhledávání, filtry, audit log poptávek, přehled konceptů, sloučení klientů, centrální správa e-mailů.

**Doporučený postup po schválení:** nejdřív rychlé výhry (texty, filtry, diagnostika, sjednocení názvů), pak střední zásahy (workflow UI, admin nástroje), až nakonec koncepční vrstva (centralizované identity a audit).

---

## 2. Co funguje dobře

| Oblast | Konkrétně |
|--------|-----------|
| **Oddělení klient / interní** | `client_accounts` + `klienti` vs. `profiles`; guard v `internal-access-rules.ts`; klientská registrace maže orphan profily (`client-profile-isolation.ts`). |
| **Klientský wizard — vědomý výběr** | Presety/historie se neaplikují automaticky; potvrzovací dialogy u techniky a sestavy (`PoptavkaFormClient.tsx`, `/portal/presety`). |
| **Místo vs. sestava vs. technika** | V kroku 2 se explicitně nepřebírá sestava; presety míst vs. `mista_konani` mají oddělené chování (`client-mista-place-data.ts`). |
| **Smazání konceptu** | `deletePoptavkaDraftAction` — jen `stav = koncept`, confirm dialog, cleanup fotek ve storage. |
| **Závazná objednávka → zakázka** | Po potvrzení klientem auto-convert (`createZakazkaFromApprovedPoptavka`); retry tlačítko při selhání. |
| **Fotky poptávky** | Thumbnaily, lazy originál, deduplikace (`poptavka-fotky-dedup.ts`, migrace 20260625–20260629). |
| **Diagnostika poptávek (začátek)** | `KlientPoptavkyDiagnosticPanel` na `/admin/klienti/[id]` vysvětluje viditelnost v inboxu. |
| **Varování @email.com** | `EmailDomainHint` v registraci a wizardu — neblokuje, ale upozorní. |
| **Gmail normalizace** | Porovnání pro interní login/allowlist (`normalize-auth-email.ts`). |
| **Uložení konceptu** | Minimální validace (název + datum), progress bar (`PoptavkaSaveProgress`), oddělené od submit validace. |

---

## 3. Největší problémy z pohledu uživatele

| Oblast | Problém | Dopad | Priorita | Doporučení |
|--------|---------|-------|----------|------------|
| **Interní inbox** | Koncepty a legacy stavy nejsou v `/zakazky/poptavky`, ale `/admin/klienti` je počítá | „Ztracená“ poptávka, zbytečný support | **Kritická** | Sjednotit počty; přidat záložku „Koncepty / mimo inbox“ nebo jasnější popisek u countu |
| **Navigace** | Poptávky jsou pod URL `/zakazky/poptavky`, ale v menu vedle Zakázek | Uživatel neví, kam patří poptávka vs. zakázka | **Vysoká** | Přejmenovat / přesunout (např. „Klientské poptávky“ jako samostatná sekce) |
| **Navigace** | `/admin/klienti` není v Admin panelu, ale v hlavní liště | Šéf/HDT vidí Klienti, ale ne Admin — matoucí hierarchie | **Střední** | Sloučit CRM klientů pod Admin nebo přejmenovat cestu mimo `/admin` |
| **Workflow stavů** | 11 stavů; popisky v `labels.ts` se liší od toho, co UI dělá | Obsluha neví, co má dělat dál | **Vysoká** | Zjednodušit na 5–6 „uživatelských“ stavů + technické pod-stavy |
| **Workflow stavů** | Badge „čekající poptávky“ = jen `odeslana` | Po odmítnutí objednávky (`objednavka_odmitnuta`) badge neupozorní | **Střední** | Rozšířit badge o stavy vyžadující interní akci |
| **E-mail** | Potvrzení jde na auth e-mail klienta, ne vždy na kontakt v poptávce | Mail nedorazí (incident Prchal @email.com) | **Kritická** | Priorita e-mailu sjednotit; diagnostika „kam půjde mail“ před odesláním |
| **Identita** | Šéf potřebuje 2 účty (Google gmail + portál email.cz) | Záměna účtů, beta hláška, falešný zaměstnanec | **Vysoká** | Dokumentovat; long-term sloučit identitu |
| **Klienti** | Klient lze založit v zakázce (`KlientSelectWithCreate`) i registrací portálu | Duplicitní klienti bez `client_accounts` | **Vysoká** | Varování při duplicitním IČO; nástroj sloučení |
| **Místa** | Tři vrstvy: `/mista`, klient detail, presety, volný text v zakázce | Know-how na špatném místě | **Střední** | Vysvětlit v UI, kam patří trvalé know-how |
| **Mobilní app** | Tab „Zakázky“ vede na `/moje`, desktop má Moje + Zakázky | Zaměstnanec hledá jinde než kolega | **Střední** | Sjednotit názvy mobil/desktop |
| **Login** | Hláška „beta přístup“ / `not_allowed` odkazuje na starý whitelist | Zbytečná panika po Google loginu | **Střední** | Text: „Nemáte interní profil — kontaktujte admina“ |
| **Orphan stránka** | `/admin/client-registrace` není v menu | Admin registrace nevidí | **Nízká** | Propojit s `/admin/klienti` nebo odstranit |
| **Uložení poptávky** | Dlouhé ukládání fotek bez jasného „co se děje“ | Klient opakuje kliknutí → duplicity (historicky) | **Střední** | Progress + disable tlačítek (částečně hotovo) |
| **HDT role** | Vidí Klienti + Poptávky, ale ne Dashboard/Moje | Jiný mentální model než zbytek týmu | **Nízká** | Ověřit s provozem, zda je to záměr |

---

## 4. Duplicitní nebo překrývající se funkce

| Funkce A | Funkce B | Proč se překrývají | Doporučení |
|----------|----------|---------------------|------------|
| **Seznam poptávek** `/zakazky/poptavky` | **Poptávky u klienta** `/admin/klienti/[id]` | Stejná entita, jiný filtr stavů | Jednotný filtr + odkaz „proč není v inboxu“ |
| **Zakázky** `/zakazky` | **Moje zakázky** `/moje` | Obě = zakázky, jiný scope (vše vs. přiřazené) | Přejmenovat: „Všechny zakázky“ / „Moje přiřazení“ |
| **Klienti** `/admin/klienti` | **Klient v zakázce** dropdown + create | Stejná tabulka `klienti`, různé cesty vzniku | Jednotný flow „nový klient“ s volbou portál ano/ne |
| **Místa konání** `/mista` | **Místa u klienta** | Per-klient vs. globální registry | OK, ale UI musí vysvětlit vztah |
| **Místo preset** `/portal/presety` | **Uložené místo** wizard dropdown | Oba kopírují adresu/GPS; preset navíc název akce | Sjednotit copy v kroku 2 wizardu |
| **Technický profil preset** | **Historie techniky z akce** | Obojí kopíruje step 4; historie i fotky | Jasně označit rozdíl (fotky jen u historie) |
| **Sestava preset** | **Historie sestavy** | Obojí na kroku 3 | OK s confirm dialogy — udržet |
| **Resend potvrzení poptávky** | **Admin release koncept** | Oba posílají „Přijali jsme poptávku“ | Sjednotit UI text; release jen pro koncept |
| **Resend závazné objednávky** | **Nové odeslání po odmítnutí** | Resend = nový token; po reject = nový draft | Vysvětlit v UI objednávky rozdíl |
| **Whitelist** `/admin` (WhitelistClient) | **Zaměstnanci** `/admin` | Whitelist mutace disabled; zaměstnanci = pravda | Odstranit mrtvý whitelist UI |
| **`povolene_emaily` DB** | **`profiles` + Google login** | Tabulka existuje, app ji nepoužívá | Migrace: deprecate nebo propojit |
| **Interní profil** `profiles` | **Klientský účet** `client_accounts` | Stejný `auth.users` může mít obojí | Tvrdé oddělení login URL (hotovo); dokumentace |
| **Kontakt e-mail** `poptavky.kontakt_email` | **Klient** `klienti.email` | Oba pro komunikaci | Priorita v `resolvePoptavkaClientEmail` — zobrazit v admin UI |
| **Audit log** `/admin` | **Historie zakázky** `/zakazky/[id]/historie` | Dva auditní zdroje | Sjednotit nebo cross-link |
| **Notifikace** `/notifikace` | **E-mail Resend** | Push in-app vs. mail — bez propojení | Log odeslaných mailů v detailu poptávky |

---

## 5. Co chybí

| Chybějící funkce | Komu pomůže | Proč je důležitá | Priorita |
|------------------|-------------|------------------|----------|
| **Přehled konceptů (interní)** | Obsluha, admin | Koncepty jsou neviditelné v inboxu | **Vysoká** |
| **Vyhledávání klienta / poptávky / zakázky** | Všichni interní | Bez IČO/e-mailu se hledá ručně v DB | **Vysoká** |
| **Filtr inboxu** (stav, klient, datum) | Šéf, obchod | Rostoucí počet poptávek | **Vysoká** |
| **Audit log změn poptávky** (stav, e-mail, kdo) | Admin, provoz | Debugging incidentů | **Vysoká** |
| **Náhled „kam půjde e-mail“** před odesláním | Obsluha | Prevence @email.com chyb | **Vysoká** |
| **Sloučení duplicitních klientů** | Admin | IČO duplicity z internal create + registrace | **Střední** |
| **Interní editace e-mailu klienta** s kontrolou domény | Admin | Oprava bez SQL migrace | **Střední** |
| **Propojení `/admin/client-registrace`** do navigace | Admin | Přehled neúspěšných registrací | **Střední** |
| **Dashboard widget „poptávky mimo inbox“** | Šéf | Count konceptů / legacy | **Střední** |
| **Notifikace při selhání auto-convert** | Obsluha | `objednavka_potvrzena` bez `zakazka_id` | **Střední** |
| **Export seznamu klientů / poptávek** | Obchod, účetní | Reporting | **Nízká** |
| **CI testy auth scénářů** | Vývoj | `verify:auth-isolation` není v CI | **Střední** |
| **Jednotný help / onboarding** v portálu | Nový klient | 4-krokový wizard je náročný | **Střední** |
| **Verze závazné objednávky** (historie snapshotů) | Právní / obchod | Pouze revoke + nový link | **Nízká** |

---

## 6. Rizika a bezpečnostní/produktové pasti

| Riziko | Scénář | Následky | Prevence |
|--------|--------|----------|----------|
| **Duplicitní klient** | Interní vytvoří klienta v zakázce; později registrace stejného IČO | 2 záznamy, rozdělené poptávky | Unique IČO warning; sloučení |
| **Špatný e-mail** | Překlep domény (@email.com) | Mail nedorazí, klient čeká | `EmailDomainHint` (hotovo); blokovat? (ověřit) |
| **Ztracená poptávka** | Koncept / špatný stav | Inbox prázdný, klient vidí „odesláno“ | Diagnostika (hotovo); interní přehled konceptů |
| **Falešný zaměstnanec** | Auth trigger / orphan profile | Klient v `/admin` zaměstnancích | Cleanup + filtr (hotovo); RLS sladit |
| **Dual auth user** | Google login jiný user_id než createEmployee | Profil existuje, login neprojde | Verify script; link identity |
| **RLS vs. app guard** | Orphan profile s rolí v DB | DB read i bez UI login | RLS `isProvisionedInternalProfile` |
| **Duplicitní fotky** | Opakované uložení / historie | Nafouklá DB, pomalý detail | Dedup migrace (hotovo); monitorovat |
| **Přepsání techniky** | Historie bez confirm | Ztráta dat klienta | Confirm dialog (hotovo) |
| **Auto preset místa** | Regrese v kódu | Porušení požadavku #2 | Test / code review checklist |
| **E-mail na špatnou adresu** | `resolvePoptavkaClientEmail` → auth | Kontakt v poptávce ignorován | Zobrazit resolved e-mail v admin |
| **Selhání convert** | RPC chyba po potvrzení objednávky | Klient potvrdil, zakázka nevznikla | Retry UI (hotovo) + alert |
| **Dlouhé ukládání** | Timeout / opakovaný submit | Duplicity, frustrace | Disable + progress (částečně) |
| **Mrtvý whitelist** | Admin přidá do `povolene_emaily` | Nic se nestane | Odstranit nebo propojit |
| **Šéf na klientském loginu** | `/portal/prihlaseni` stejný mail | Redirect na portal, ne admin | Dokumentace + oddělené URL |

---

## 7. Doporučený cílový workflow

### Klientská registrace
1. Klient na `/portal/registrace` — IČO, ARES, kontakt, e-mail, heslo.  
2. Varování u `@email.com`.  
3. Vznikne: `auth.users` (email), `klienti`, `client_accounts` (active), **bez** `profiles`.  
4. Admin vidí klienta v `/admin/klienti` (ne v zaměstnancích).

### Nová poptávka
1. `/portal/poptavka/nova` — krok 1: kontakt předvyplněn z účtu.  
2. Krok 2: místo — **volba** preset / uložené místo / nové; **bez** auto-sestavy.  
3. Krok 3: sestava — preset / historie / ručně.  
4. Krok 4: technika — preset / historie (+ fotky) / ručně / výjezd technika.  
5. „Uložit koncept“ kdykoli (název + datum).  
6. „Odeslat“ → `stav = odeslana`, e-mail potvrzení, interní notifikace.

### Interní zpracování
1. Poptávka v `/zakazky/poptavky` (Aktuální) — badge pro nové `odeslana`.  
2. Akce: přijmout k řešení / vrátit k doplnění / odmítnout.  
3. Příprava závazné objednávky (draft → náhled → odeslat).  
4. Klient potvrdí (token nebo portál).  
5. **Automaticky** vznikne zakázka, poptávka → `prevadena_do_zakazky`.  
6. Obsluha pokračuje v `/zakazky/[id]`.

### Výjimky (musí být viditelné)
- **Koncept** — jen v portálu klienta + admin diagnostika u klienta; ne v inboxu.  
- **objednavka_odmitnuta** — v inboxu s badge „vyžaduje akci“.  
- **Selhání convert** — banner + retry, notifikace internímu týmu.

---

## 8. Rychlé výhry (1–2 dny)

1. **Sjednotit popisky** — sidebar „Poptávky“ → „Klientské poptávky“; stránka `/mista` titulek = sidebar.  
2. **U countu poptávek v `/admin/klienti`** — „1 (0 v inboxu, 1 koncept)“ nebo tooltip.  
3. **Opravit text na `/login`** — místo „beta přístup“ → „Účet nemá interní oprávnění“.  
4. **Odstranit / skrýt mrtvý Whitelist UI** v admin panelu.  
5. **Propojit `/admin/client-registrace`** odkazem z `/admin/klienti`.  
6. **V detailu poptávky zobrazit „E-mail pro odeslání: …“** (`resolvePoptavkaClientEmail`).  
7. **Rozšířit badge** o `objednavka_odmitnuta` (ověřit s Ondřejem).  
8. **Aktualizovat popis na `/zakazky/poptavky`** — auto-convert po potvrzení, ne „schválení k převodu“.  
9. **Přidat filtr „jen odeslané“** do klient detail poptávek (toggle).  
10. **Dokumentace pro šéfa** — interní = `/login` + Google gmail; klient = `/portal` + email.cz.

---

## 9. Střednědobé úpravy (dny až týdny)

1. **Interní přehled konceptů** — `/zakazky/poptavky?tab=drafts` nebo widget v dashboardu.  
2. **Vyhledávání** — klient (IČO, název), poptávka (`cislo_poptavky`), zakázka.  
3. **Audit log poptávky** — stavové přechody, odeslané e-maily, kdo akci provedl.  
4. **Admin: oprava e-mailu klienta** + validace domény + volitelný resend.  
5. **Sloučení klientů** — wizard: vybrat master, přesunout poptávky/zakázky/účty.  
6. **Sjednocení guard vrstev** — jeden `resolveAuthAccessContext`, méně duplicity `AuthGate` vs. `proxy`.  
7. **Zjednodušení stavů v UI** — mapování 11 DB stavů → 5 štítků pro uživatele.  
8. **Wizard onboarding** — krátké vysvětlení kroků 2–4 pro nové klienty.  
9. **Notifikace při failed convert** — in-app + e-mail adminovi.  
10. **CI: `npm run verify:auth-isolation`** v pipeline.  
11. **RLS sladění** s `isProvisionedInternalProfile`.  
12. **Deprecate `povolene_emaily`** nebo napojit na skutečný gate.

---

## 10. Větší koncepční návrhy (později)

1. **Jednotný model identity** — jeden člověk může být klient i interní, ale s jasným přepínačem kontextu (ne dva auth účty).  
2. **Workflow engine** — stavy poptávky jako konfigurovatelný stavový automat s povolenými přechody v adminu.  
3. **Centralizovaná komunikace** — log všech outbound mailů u poptávky/zakázky (Resend webhook).  
4. **CRM vrstva klientů** — jeden kanonický záznam, historie interakcí, IČO jako unique key.  
5. **Místa jako first-class** — jedno místo, vazby na klienty/zakázky/presety, bez volného textu v zakázce.  
6. **Role-based IA redesign** — obchod vs. sklad vs. HDT vidí jen relevantní sekce.  
7. **Klientský portál verze 2** — kratší wizard pro opakované akce („stejná akce jako minule“).  
8. **Reporting** — konverze poptávka → objednávka → zakázka, průměrná doba fáze.

---

## 11. Otázky pro Ondřeje

1. **Má HDT vidět Klienti + Poptávky**, ale ne Dashboard — je to záměr, nebo dočasné?  
2. **Má šéf (`sef`) přistupovat k `/admin` hubu** (zaměstnanci, faktury), nebo jen k vybraným podstránkám?  
3. **Koncept poptávky** — má interní tým vidět všechny koncepty centrally, nebo jen přes detail klienta?  
4. **Při duplicitním IČO** — sloučit automaticky, nebo vždy ručně?  
5. **E-mail pro klienta** — priorita: auth login, `kontakt_email` v poptávce, nebo `klienti.email`?  
6. **@email.com varování** — stačí hint, nebo tvrdá validace pro `.cz` domény?  
7. **Po odmítnutí závazné objednávky** — má badge upozornit stejně jako nová `odeslana` poptávka?  
8. **Stav `schvalena`** — odstranit z DB/workflow, nebo znovu zapojit do UI?  
9. **Interní-only klienti** (bez portálu) — mají být v `/admin/klienti`, nebo jen v dropdownu zakázky?  
10. **Mobilní priorita** — má zaměstnanec na stavbě používat `/moje` nebo `/mobile`? Co je hlavní?  
11. **Audit log** — stačí poptávky + zakázky, nebo i sklad a docházka?  
12. **Dual account šéfa** — akceptovat dlouhodobě, nebo investovat do unified login?  
13. **Kdo smí „uvolnit koncept do inboxu“** — jen admin, nebo i šéf?  
14. **Presety** — má být limit počtu na klienta?  
15. **Po convert na zakázku** — má klient dál vidět poptávku, nebo jen zakázku v portálu?

---

## Příloha: Mapování stavů poptávky (technický přehled)

| Stav | Klient vidí | Interní inbox | Typická akce |
|------|-------------|---------------|--------------|
| `koncept` | Rozpracováno | **Ne** | Dokončit / smazat |
| `odeslana` | Čeká na kontrolu | Ano (badge) | Přijmout / revize / odmítnout |
| `v_revizi` | Vráceno k doplnění | Ano | Čekat na klienta |
| `prijata_k_reseni` | Přijato k řešení | Ano | Připravit objednávku |
| `objednavka_odeslana` | K potvrzení | Ano | Resend / čekat |
| `objednavka_potvrzena` | Potvrzeno | Ano | Auto → zakázka |
| `objednavka_odmitnuta` | Odmítnuto | Ano | Nová objednávka |
| `prevadena_do_zakazky` | Převedeno | Ano | Otevřít zakázku |
| `zamitnuta` | Zamítnuto | Záložka Odmítnuté | — |
| `schvalena` | (legacy UI) | Ano | **Mrtvý stav — ověřit** |
| `ceka_na_schvaleni` | — | **Ne** | **Legacy DB — ověřit** |

---

*Dokument vytvořen pro schválení před implementací. Po schválení doporučujeme prioritizovat sekce 8 → 9 → 10.*
