import type { SkladKusObsahChildRow } from "@/lib/sklad/kusObsahRead";
import { toNumber } from "@/lib/sklad/helpers";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
  TechnickyVlastnik,
} from "@/lib/sklad/types";

export type ObsahChildCatalogs = {
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  vlastnici: TechnickyVlastnik[];
};

export function enrichObsahChildRows(
  children: SkladKusObsahChildRow[],
  catalogs: ObsahChildCatalogs
): SkladKusObsahChildRow[] {
  const blokNazevById = new Map(catalogs.bloky.map((row) => [row.sklad_blok_id, row.nazev]));
  const kategorieNazevById = new Map(
    catalogs.kategorie.map((row) => [row.kategorie_techniky_id, row.nazev])
  );
  const podkategorieNazevById = new Map(
    catalogs.podkategorie.map((row) => [row.podkategorie_techniky_id, row.nazev])
  );
  const jednotkaNazevById = new Map(catalogs.jednotky.map((row) => [row.jednotka_id, row.nazev]));
  const vlastnikNazevById = new Map(catalogs.vlastnici.map((row) => [row.id, row.nazev]));

  return children.map((child) => {
    const blokNazev = child.skladBlokId
      ? (blokNazevById.get(child.skladBlokId) ?? null)
      : null;
    const kategorieNazev = child.kategorieTechnikyId
      ? (kategorieNazevById.get(child.kategorieTechnikyId) ?? null)
      : null;
    const podkategorieNazev = child.podkategorieTechnikyId
      ? (podkategorieNazevById.get(child.podkategorieTechnikyId) ?? null)
      : null;
    const jednotka = child.jednotkaId
      ? (jednotkaNazevById.get(child.jednotkaId) ?? null)
      : null;
    const technickyVlastnikNazev = child.technickyVlastnikId
      ? (vlastnikNazevById.get(child.technickyVlastnikId) ?? null)
      : null;
    const cenaAkce =
      child.fakturacniCena != null
        ? toNumber(child.fakturacniCena)
        : child.interniNaklad != null
          ? toNumber(child.interniNaklad)
          : null;

    return {
      ...child,
      blokNazev,
      kategorieNazev,
      podkategorieNazev,
      jednotka,
      technickyVlastnikNazev,
      cenaAkce,
    };
  });
}
