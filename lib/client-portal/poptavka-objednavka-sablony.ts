import type { SmluvniPodminkyBlock } from "@/lib/client-portal/poptavka-objednavka-types";

/** Výchozí smluvní podmínky — editovatelné v draftu před odesláním. */
export const VYCHOZI_SMLOUVNI_PODMINKY: SmluvniPodminkyBlock = {
  zavaznost:
    "Tato závazná objednávka představuje dohodu o rozsahu technického plnění, termínech a podmínkách realizace akce. " +
    "Potvrzením objednávky klient stvrzuje, že se seznámil s obsahem dokumentu a souhlasí s uvedenými parametry.",
  soucinnostKlienta:
    "Klient zajistí včasný přístup na místo akce, součinnost pořadatele, kontaktní osobu na místě a splnění technických podmínek uvedených v tomto dokumentu. " +
    "Klient informuje WEST COUNTY o změnách, které mohou ovlivnit realizaci (termín, rozsah, přístup, elektro, omezení místa).",
  elektroTechnicke:
    "Klient odpovídá za to, že údaje o elektro přípojce a technických podmínkách místa odpovídají skutečnosti. " +
    "Pokud na místě nebude dostupná dohodnutá elektro přípojka nebo technické zázemí, může být realizace omezena, posunuta nebo řešena náhradním technickým řešením po dohodě.",
  pocasiVyssiMoc:
    "WEST COUNTY nenese odpovědnost za omezení způsobená nepříznivým počasím, vyšší mocí nebo okolnostmi mimo rozumnou kontrolu dodavatele. " +
    "V takovém případě se strany dohodnou na náhradním termínu nebo úpravě rozsahu plnění.",
  storno:
    "Storno nebo podstatná změna objednávky po potvrzení může být zpoplatněna dle rozsahu již vynaložených nákladů a rezervovaných kapacit. " +
    "Konkrétní storno podmínky budou upřesněny ve fakturační dokumentaci, pokud nejsou uvedeny jinak v této objednávce.",
  odpovednostZaMisto:
    "Klient odpovídá za legální užívání místa akce, povolení pořadatele, přístupové cesty a škody způsobené nevhodnými podmínkami místa, které nebyly včas sděleny.",
  bezpecnost:
    "Klient a pořadatel akce odpovídají za bezpečnost návštěvníků a dodržení platných předpisů. " +
    "WEST COUNTY provádí instalaci v souladu s obvyklými bezpečnostními standardy oboru.",
  platebni:
    "Platební podmínky budou upřesněny ve fakturační dokumentaci. Tato objednávka obsahuje konečnou cenu sjednanou pro uvedený rozsah dodávky. Případné vícepráce, změny rozsahu nebo dodatečné požadavky klienta budou řešeny samostatnou dohodou.",
};

export function cloneVychoziSmluvniPodminky(): SmluvniPodminkyBlock {
  return { ...VYCHOZI_SMLOUVNI_PODMINKY };
}
