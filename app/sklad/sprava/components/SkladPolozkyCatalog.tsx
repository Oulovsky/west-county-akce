"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { useProfileRole } from "@/lib/auth/use-profile-role";
import { SpravaInventoryFilters } from "./SpravaInventoryFilters";
import { SpravaActionPanel } from "./SpravaActionPanel";
import { useSpravaKusSelection } from "./SpravaKusSelectionContext";
import { supabase } from "@/lib/supabase";
import { isPolozkaObsahCase } from "@/lib/sklad/caseKus";
import { nastavitPolozkaJeCase } from "@/lib/sklad/spravaKusActions";
import { SkladPolozkyHeader } from "../../components/SkladPolozkyHeader";
import { AddItemModal } from "./AddItemModal";
import { SkladTable } from "./SkladTable";
import { SkladTableRow } from "./SkladTableRow";
import {
  SKLAD_DEFAULT_JEDNOTKA,
  SKLAD_REALTIME_CHANNEL,
  SKLAD_RPC,
  SKLAD_TABLE,
} from "@/lib/sklad/constants";
import { filterCatalogPolozky } from "@/lib/sklad/caseContentPolozka";
import {
  listActiveKategorie,
  listJednotkaSelectOptions,
  listPodkategorieSelectOptions,
} from "@/lib/sklad/kategorieCatalog";
import {
  enrichSpravaPolozkyWithPodkategorie,
  enrichSpravaPolozkyWithVlastnici,
  filterSpravaInventoryItems,
  toNumber,
} from "@/lib/sklad/helpers";
import {
  createInlineJednotka,
  createInlineKategorie,
  createInlinePodkategorie,
  createInlineSkladBlok,
  type InlineConfigCreateResult,
} from "@/lib/sklad/inlineConfigCreate";
import {
  queryJednotkySkladuFull,
  queryKategorieTechnikyFull,
  queryPodkategorieTechnikyFull,
  querySkladBloky,
  querySkladovePolozkyPodkategorie,
  querySpravaCaseMetadata,
  querySpravaKatalog,
  queryTechnickyVlastniciFull,
} from "@/lib/sklad/queries";
import {
  querySpravaFyzickyNaZakazkachCountsByPolozka,
  querySpravaNaZakazkachCountsByPolozka,
} from "@/lib/sklad/spravaNaZakazkach";
import {
  computeSpravaNaSklade,
  querySpravaBlokujiciPoskozeneByPolozka,
} from "@/lib/sklad/spravaSkladem";
import { syncPolozkaKusyToCelkem } from "@/lib/sklad/syncPolozkaKusy";
import {
  SPRAVA_INVENTORY_FILTERS_EMPTY,
  type SkladBlok,
  type SkladJednotka,
  type SkladKategorie,
  type SkladPodkategorie,
  type SkladPolozkaRow,
  type SpravaInventoryFilters as SpravaInventoryFiltersState,
  type TechnickyVlastnik,
} from "@/lib/sklad/types";
import type {
  ObsahChildPolozkaAppliedFields,
  SpravaObsahPolozkaUpdaters,
} from "./spravaCaseObsahTreeTypes";
import { SetupSelectionPanel } from "../../setupy/components/SetupSelectionPanel";

type RpcErrorResult = {
  error: { message: string } | null;
};

type AddItemMode = "polozka" | "case";

type SkladPolozkyCatalogProps = {
  catalogMode?: "sprava" | "setup" | "select";
  setupId?: string;
};

export function SkladPolozkyCatalog({
  catalogMode = "sprava",
  setupId,
}: SkladPolozkyCatalogProps = {}) {
  const isSetupMode = catalogMode === "setup";
  const isSelectMode = catalogMode === "select";
  const searchParams = useSearchParams();
  const obsahPolozkaId = searchParams.get("obsahPolozka");
  const openCaseKusId = searchParams.get("obsahCase");
  const obsahMode = searchParams.get("obsahMode");
  const obsahMessage = searchParams.get("obsah");
  const obsahError = searchParams.get("obsahError");

  const { nav } = useProfileRole();
  const readOnly = isSetupMode || isSelectMode ? true : nav.readOnly;
  const { caseMetadata, setCaseMetadata, registerAfterKusMutation } =
    useSpravaKusSelection();
  const [items, setItems] = useState<SkladPolozkaRow[]>([]);
  const [kategorie, setKategorie] = useState<SkladKategorie[]>([]);
  const [podkategorie, setPodkategorie] = useState<SkladPodkategorie[]>([]);
  const [jednotky, setJednotky] = useState<SkladJednotka[]>([]);
  const [bloky, setBloky] = useState<SkladBlok[]>([]);
  const [vlastnici, setVlastnici] = useState<TechnickyVlastnik[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    nazev: "",
    kusy: "",
    pozice: "",
    jednotka: "ks",
    naklad: "",
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [kusyReloadById, setKusyReloadById] = useState<Record<string, number>>(
    {}
  );
  const [inventoryFilters, setInventoryFilters] =
    useState<SpravaInventoryFiltersState>(SPRAVA_INVENTORY_FILTERS_EMPTY);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addItemMode, setAddItemMode] = useState<AddItemMode>("polozka");
  const [isCreating, setIsCreating] = useState(false);
  const [newNazev, setNewNazev] = useState("");
  const [newKusy, setNewKusy] = useState("1");
  const [newJednotka, setNewJednotka] = useState("ks");
  const [newKategorieId, setNewKategorieId] = useState("");
  const [newPodkategorieId, setNewPodkategorieId] = useState("");
  const [newBlokId, setNewBlokId] = useState("");
  const [newNaklad, setNewNaklad] = useState("");

  const lastChange = useRef<{ before: SkladPolozkaRow; after: SkladPolozkaRow } | null>(null);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const bumpKusyReload = useCallback((polozkaId: string) => {
    setKusyReloadById((prev) => ({
      ...prev,
      [polozkaId]: (prev[polozkaId] ?? 0) + 1,
    }));
  }, []);

  const obsahReloadKey = useMemo(
    () =>
      [
        obsahPolozkaId ?? "",
        openCaseKusId ?? "",
        obsahMessage ?? "",
        obsahError ?? "",
      ].join(":"),
    [obsahPolozkaId, openCaseKusId, obsahMessage, obsahError]
  );

  useEffect(() => {
    if (!obsahPolozkaId || !obsahMessage) return;
    bumpKusyReload(obsahPolozkaId);
  }, [obsahPolozkaId, obsahMessage, bumpKusyReload]);

  const refreshCaseMetadata = useCallback(async () => {
    const { data } = await querySpravaCaseMetadata(supabase);
    setCaseMetadata(data);
  }, [setCaseMetadata]);

  useEffect(() => {
    void refreshCaseMetadata();
  }, [refreshCaseMetadata]);

  const applyKusySyncAfterCelkemSave = useCallback(
    async (polozkaId: string, nazev: string, celkem: number) => {
      const sync = await syncPolozkaKusyToCelkem(
        supabase,
        polozkaId,
        nazev,
        celkem
      );

      if (!sync.ok) {
        alert(
          `Položka uložena, ale evidenci kusů se nepodařilo doplnit: ${sync.error}\n\n` +
            "Přidejte kusy v detailu položky, nebo požádejte o úpravu oprávnění v databázi."
        );
        return;
      }

      bumpKusyReload(polozkaId);
    },
    [bumpKusyReload]
  );

  const reloadCatalog = useCallback(async () => {
    const [kategorieRes, podkategorieRes, jednotkyRes, blokyRes, vlastniciRes] =
      await Promise.all([
        queryKategorieTechnikyFull(supabase),
        queryPodkategorieTechnikyFull(supabase),
        queryJednotkySkladuFull(supabase),
        querySkladBloky(supabase),
        queryTechnickyVlastniciFull(supabase),
      ]);

    if (kategorieRes.error) {
      alert(kategorieRes.error.message);
      return false;
    }

    if (podkategorieRes.error) {
      alert(podkategorieRes.error.message);
      return false;
    }

    if (jednotkyRes.error) {
      alert(jednotkyRes.error.message);
      return false;
    }

    if (blokyRes.error) {
      alert(blokyRes.error.message);
      return false;
    }

    if (vlastniciRes.error) {
      alert(vlastniciRes.error.message);
      return false;
    }

    setKategorie((kategorieRes.data ?? []) as SkladKategorie[]);
    setPodkategorie((podkategorieRes.data ?? []) as SkladPodkategorie[]);
    setJednotky((jednotkyRes.data ?? []) as SkladJednotka[]);
    setBloky((blokyRes.data ?? []) as SkladBlok[]);
    setVlastnici((vlastniciRes.data ?? []) as TechnickyVlastnik[]);
    return true;
  }, []);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }

      const [
        itemsRes,
        kategorieRes,
        podkategorieRes,
        jednotkyRes,
        blokyRes,
        polozkyPodkategorieRes,
        vlastniciRes,
        polozkyVlastniciRes,
      ] = await querySpravaKatalog(supabase);

      if (itemsRes.error) {
        alert(itemsRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (kategorieRes.error) {
        alert(kategorieRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (podkategorieRes.error) {
        alert(podkategorieRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (jednotkyRes.error) {
        alert(jednotkyRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (blokyRes.error) {
        alert(blokyRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (polozkyPodkategorieRes.error) {
        alert(polozkyPodkategorieRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (vlastniciRes.error) {
        alert(vlastniciRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (polozkyVlastniciRes.error) {
        alert(polozkyVlastniciRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      const podkategorieCatalog = (podkategorieRes.data ??
        []) as SkladPodkategorie[];
      const vlastniciCatalog = (vlastniciRes.data ?? []) as TechnickyVlastnik[];

      setVlastnici(vlastniciCatalog);

      const [
        { data: pozRows, error: pozErr },
        { data: obsahCaseRows, error: obsahCaseErr },
      ] = await Promise.all([
        supabase
          .from(SKLAD_TABLE.skladovePolozky)
          .select("skladova_polozka_id, pozice"),
        supabase
          .from(SKLAD_TABLE.skladovePolozky)
          .select("skladova_polozka_id")
          .eq("je_obsah_case", true),
      ]);

      if (pozErr && !options?.silent) {
        alert(pozErr.message);
      }
      if (obsahCaseErr && !options?.silent) {
        alert(obsahCaseErr.message);
      }

      const obsahCaseIds = new Set<string>(
        (obsahCaseRows ?? []).map(
          (row: { skladova_polozka_id: string }) => row.skladova_polozka_id
        )
      );

      const pozMap = new Map<string, string | number | null>(
        (pozRows ?? []).map(
          (r: { skladova_polozka_id: string; pozice: string | number | null }) => [
            r.skladova_polozka_id,
            r.pozice ?? null,
          ]
        )
      );

      const rawItems = filterCatalogPolozky(
        ((itemsRes.data ?? []) as SkladPolozkaRow[]).map(
          (item) => ({
            ...item,
            pozice:
              pozMap.get(item.skladova_polozka_id) ?? item.pozice ?? null,
          })
        ),
        obsahCaseIds
      );

      const enrichedPodkategorie = enrichSpravaPolozkyWithPodkategorie(
        rawItems,
        (polozkyPodkategorieRes.data ?? []) as Array<{
          skladova_polozka_id: string;
          podkategorie_techniky_id: string | null;
        }>,
        podkategorieCatalog
      );

      const enrichedItems = enrichSpravaPolozkyWithVlastnici(
        enrichedPodkategorie,
        (polozkyVlastniciRes.data ?? []) as Array<{
          skladova_polozka_id: string;
          technicky_vlastnik_id: string | null;
        }>,
        vlastniciCatalog
      );

      const { data: kusyRaw, error: kusyError } = await supabase
        .from(SKLAD_TABLE.skladPolozkyKusy)
        .select("skladova_polozka_id, stav, aktivni");

      if (kusyError && !options?.silent) {
        alert(`Stavy kusů se nepodařilo načíst: ${kusyError.message}`);
      }

      const kusStatusCounts = new Map<
        string,
        { skladem: number; poskozene: number; problemove: number }
      >();
      for (const kus of (kusyRaw ?? []) as Array<{
        skladova_polozka_id: string;
        stav: string | null;
        aktivni: boolean | null;
      }>) {
        const current = kusStatusCounts.get(kus.skladova_polozka_id) ?? {
          skladem: 0,
          poskozene: 0,
          problemove: 0,
        };
        const stav = String(kus.stav ?? "").trim();
        if (kus.aktivni !== false && stav === "skladem") current.skladem += 1;
        if (stav === "poskozeno") current.poskozene += 1;
        if (["blokovano", "v_oprave", "ceka_na_kontrolu", "odpis", "vyrazeno"].includes(stav) || kus.aktivni === false) {
          current.problemove += 1;
        }
        kusStatusCounts.set(kus.skladova_polozka_id, current);
      }

      const [
        { map: naZakazkachMap, error: naZakazkachErr },
        { map: fyzickyNaZakazkachMap, error: fyzickyNaZakazkachErr },
        { map: blokujiciMap, error: blokujiciErr },
      ] =
        await Promise.all([
          querySpravaNaZakazkachCountsByPolozka(supabase, new Date()),
          querySpravaFyzickyNaZakazkachCountsByPolozka(supabase),
          querySpravaBlokujiciPoskozeneByPolozka(supabase),
        ]);

      const futureAvailabilityMap = new Map<
        string,
        { planned: number; usable: number; collision: boolean }
      >();
      try {
        const now = new Date();
        const horizon = new Date(now);
        horizon.setFullYear(horizon.getFullYear() + 1);
        const availabilityResponse = await fetch("/api/technika-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: now.toISOString(),
            to: horizon.toISOString(),
            items: enrichedItems.map((item) => ({
              skladova_polozka_id: item.skladova_polozka_id,
              requestedQuantity: 0,
            })),
          }),
        });

        const availabilityPayload = await availabilityResponse.json();
        if (availabilityResponse.ok) {
          for (const item of availabilityPayload.items ?? []) {
            const planned = toNumber(item.plannedOnOtherOverlappingZakazky);
            const loaded = toNumber(item.physicallyLoadedOnOtherZakazky);
            const usable = toNumber(item.usablePieces);
            futureAvailabilityMap.set(String(item.skladova_polozka_id), {
              planned: Math.max(planned, loaded),
              usable,
              collision: Math.max(planned, loaded) > usable,
            });
          }
        }
      } catch {
        // Přehled skladu zůstává použitelný i bez doplňkového kapacitního warningu.
      }

      const mergedItems = enrichedItems.map((item) => {
        const id = item.skladova_polozka_id;
        const celkem = toNumber(item.celkem_k_dispozici);
        const futureAvailability = futureAvailabilityMap.get(id);

        const naZakazkach =
          naZakazkachErr || !naZakazkachMap
            ? toNumber(item.na_akcich)
            : naZakazkachMap.get(id) ?? 0;
        const fyzickyNaZakazkach =
          fyzickyNaZakazkachErr || !fyzickyNaZakazkachMap
            ? toNumber(item.na_zakazkach_fyzicky)
            : fyzickyNaZakazkachMap.get(id) ?? 0;

        if (naZakazkachErr || blokujiciErr || !blokujiciMap) {
          return {
            ...item,
            na_akcich: naZakazkach,
            na_zakazkach_fyzicky: fyzickyNaZakazkach,
            kusy_skladem: kusStatusCounts.get(id)?.skladem ?? 0,
            kusy_poskozene: kusStatusCounts.get(id)?.poskozene ?? 0,
            kusy_blokovane_servis: kusStatusCounts.get(id)?.problemove ?? 0,
            availability_future_collision: futureAvailability?.collision ?? false,
            availability_future_planned: futureAvailability?.planned ?? null,
            availability_usable: futureAvailability?.usable ?? null,
          };
        }

        const blok = blokujiciMap.get(id) ?? 0;

        return {
          ...item,
          na_akcich: naZakazkach,
          na_zakazkach_fyzicky: fyzickyNaZakazkach,
          na_sklade: computeSpravaNaSklade(celkem, naZakazkach, blok),
          kusy_skladem: kusStatusCounts.get(id)?.skladem ?? 0,
          kusy_poskozene: kusStatusCounts.get(id)?.poskozene ?? 0,
          kusy_blokovane_servis: kusStatusCounts.get(id)?.problemove ?? 0,
          availability_future_collision: futureAvailability?.collision ?? false,
          availability_future_planned: futureAvailability?.planned ?? null,
          availability_usable: futureAvailability?.usable ?? null,
        };
      });

      if (
        !options?.silent &&
        (naZakazkachErr || fyzickyNaZakazkachErr || blokujiciErr)
      ) {
        const parts: string[] = [];
        if (naZakazkachErr) {
          parts.push(`Plán zakázek: ${naZakazkachErr.message}`);
        }
        if (fyzickyNaZakazkachErr) {
          parts.push(`Fyzické kusy na zakázkách: ${fyzickyNaZakazkachErr.message}`);
        }
        if (blokujiciErr) {
          parts.push(`Blokující poškození: ${blokujiciErr.message}`);
        }
        alert(
          `${parts.join(" ")}\n\nSloupce „Plánováno na zakázkách“, „Fyzicky na zakázkách“ a „Skladem“ zůstávají u části dat ze serveru.`
        );
      }
      setItems(mergedItems);
      setKategorie((kategorieRes.data ?? []) as SkladKategorie[]);
      setPodkategorie(podkategorieCatalog);
      setJednotky((jednotkyRes.data ?? []) as SkladJednotka[]);
      setBloky((blokyRes.data ?? []) as SkladBlok[]);
      if (!options?.silent) {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load, reloadCatalog]);

  useEffect(() => {
    registerAfterKusMutation(() => {
      void load({ silent: true });
      void refreshCaseMetadata();
    });
  }, [load, refreshCaseMetadata, registerAfterKusMutation]);

  useEffect(() => {
    const channels = [
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaKategorie)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.kategorieTechniky },
          () => {
            void reloadCatalog();
          }
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaPodkategorie)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.podkategorieTechniky },
          () => {
            void reloadCatalog();
          }
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaJednotky)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.jednotkySkladu },
          () => {
            void reloadCatalog();
          }
        )
        .subscribe(),
      supabase
        .channel("sklad-sprava-na-zakazkach")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: SKLAD_TABLE.technikaNaZakazce,
          },
          () => {
            void load({ silent: true });
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.zakazky },
          () => {
            void load({ silent: true });
          }
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaPoskozeni)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.hlaseniPoskozeni },
          () => {
            void load({ silent: true });
          }
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [load, reloadCatalog]);

  const getPodkategorieOptions = useCallback(
    (currentPodkategorieId?: string | null) =>
      listPodkategorieSelectOptions(podkategorie, currentPodkategorieId),
    [podkategorie]
  );

  const newPodkategorieOptions = useMemo(
    () => listPodkategorieSelectOptions(podkategorie, newPodkategorieId || null),
    [podkategorie, newPodkategorieId]
  );

  const newJednotkaOptions = useMemo(
    () => listJednotkaSelectOptions(jednotky, newJednotka),
    [jednotky, newJednotka]
  );

  const newKategorieOptions = useMemo(
    () => listActiveKategorie(kategorie),
    [kategorie]
  );

  const resolvePolozkaForUpdate = useCallback(
    async (id: string): Promise<SkladPolozkaRow | null> => {
      const fromCatalog = items.find((item) => item.skladova_polozka_id === id);
      if (fromCatalog) return fromCatalog;

      const { data, error } = await supabase
        .from(SKLAD_TABLE.skladovePolozky)
        .select(
          "skladova_polozka_id, nazev, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, technicky_vlastnik_id, jednotka, celkem_k_dispozici, interni_naklad, fakturacni_cena, aktivni"
        )
        .eq("skladova_polozka_id", id)
        .maybeSingle();

      if (error || !data) return null;

      const row = data as SkladPolozkaRow;
      const blok = bloky.find((b) => b.sklad_blok_id === row.sklad_blok_id);
      const kat = kategorie.find(
        (k) => k.kategorie_techniky_id === row.kategorie_techniky_id
      );
      const pod = podkategorie.find(
        (p) => p.podkategorie_techniky_id === row.podkategorie_techniky_id
      );
      const vlastnik = vlastnici.find((v) => v.id === row.technicky_vlastnik_id);

      return {
        ...row,
        blok_nazev: blok?.nazev ?? null,
        kategorie_nazev: kat?.nazev ?? null,
        podkategorie_nazev: pod?.nazev ?? null,
        technicky_vlastnik_nazev: vlastnik?.nazev ?? null,
        na_sklade: 0,
        na_akcich: 0,
        na_zakazkach_fyzicky: 0,
        poskozene: 0,
        availability_usable: 0,
        availability_future_planned: 0,
        availability_future_collision: false,
      };
    },
    [bloky, items, kategorie, podkategorie, vlastnici]
  );

  function inlineCreateError(
    result: InlineConfigCreateResult
  ): { error?: string } {
    if (result.ok) return {};
    return { error: result.message };
  }

  const handleQuickCreateBlok = useCallback(
    async (nazev: string) => {
      const result = await createInlineSkladBlok(supabase, nazev);
      if (!result.ok) return inlineCreateError(result);

      const catalogOk = await reloadCatalog();
      if (!catalogOk) return { error: "Nepodařilo se načíst katalog." };

      setNewBlokId(result.value);
      setNewPodkategorieId("");

      return {};
    },
    [reloadCatalog]
  );

  const handleQuickCreateKategorie = useCallback(
    async (nazev: string) => {
      if (!newBlokId) return { error: "Nejdřív vyber okruh." };

      const result = await createInlineKategorie(supabase, nazev, newBlokId);
      if (!result.ok) return inlineCreateError(result);

      setKategorie((prev) => {
        if (prev.some((k) => k.kategorie_techniky_id === result.value)) {
          return prev;
        }
        return [
          ...prev,
          {
            kategorie_techniky_id: result.value,
            nazev: result.nazev,
            sklad_blok_id: newBlokId,
          },
        ];
      });

      await reloadCatalog();
      setNewKategorieId(result.value);
      setNewPodkategorieId("");

      return {};
    },
    [newBlokId, reloadCatalog]
  );

  const handleQuickCreatePodkategorie = useCallback(
    async (nazev: string) => {
      if (!newKategorieId) return { error: "Nejdřív vyber kategorii." };

      const result = await createInlinePodkategorie(
        supabase,
        nazev,
        newKategorieId
      );
      if (!result.ok) return inlineCreateError(result);

      setPodkategorie((prev) => {
        if (prev.some((p) => p.podkategorie_techniky_id === result.value)) {
          return prev;
        }
        return [
          ...prev,
          {
            podkategorie_techniky_id: result.value,
            nazev: result.nazev,
            kategorie_techniky_id: newKategorieId,
            kategorie_nazev: null,
          },
        ];
      });

      await reloadCatalog();
      setNewPodkategorieId(result.value);

      return {};
    },
    [newKategorieId, reloadCatalog]
  );

  const handleQuickCreateJednotka = useCallback(
    async (nazev: string) => {
      const result = await createInlineJednotka(supabase, nazev);
      if (!result.ok) return inlineCreateError(result);

      const catalogOk = await reloadCatalog();
      if (!catalogOk) return { error: "Nepodařilo se načíst katalog." };

      setNewJednotka(result.value);
      return {};
    },
    [reloadCatalog]
  );

  function resetAddForm() {
    const firstBlokId = bloky[0]?.sklad_blok_id ?? "";

    setNewBlokId(firstBlokId);
    setNewKategorieId("");
    setNewPodkategorieId("");
    setNewNazev("");
    setNewKusy("1");
    setNewJednotka(jednotky[0]?.nazev ?? "ks");
    setNewNaklad("");
  }

  function openAddModal(mode: AddItemMode = "polozka") {
    setAddItemMode(mode);
    resetAddForm();
    setIsAddOpen(true);
  }

  function closeAddModal() {
    if (isCreating) return;
    setIsAddOpen(false);
  }

  function startEdit(item: SkladPolozkaRow) {
    setEditingId(item.skladova_polozka_id);
    setDraft({
      nazev: item.nazev,
      kusy: String(toNumber(item.celkem_k_dispozici)),
      pozice:
        item.pozice == null || item.pozice === ""
          ? ""
          : String(item.pozice),
      jednotka: item.jednotka ?? "ks",
      naklad: item.interni_naklad == null ? "" : String(item.interni_naklad),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({
      nazev: "",
      kusy: "",
      pozice: "",
      jednotka: "ks",
      naklad: "",
    });
  }

  const commitRowSave = useCallback(
    async (
      id: string,
      snapshot: {
        nazev: string;
        kusy: string;
        pozice: string;
        jednotka: string;
        naklad: string;
      },
      options: { exitEdit: boolean }
    ) => {
      const oldItem = items.find((i) => i.skladova_polozka_id === id);
      if (!oldItem) return;

      const parsedKusy = Number(snapshot.kusy);
      const parsedNaklad = snapshot.naklad === "" ? null : Number(snapshot.naklad);
      const parsedPozice =
        snapshot.pozice.trim() === "" ? null : Number(snapshot.pozice);

      if (!snapshot.nazev.trim()) {
        alert("Název je povinný.");
        return;
      }

      if (!snapshot.jednotka.trim()) {
        alert("Jednotka je povinná.");
        return;
      }

      if (!Number.isFinite(parsedKusy) || parsedKusy < 0) {
        alert("Kusy musí být číslo 0 nebo vyšší.");
        return;
      }

      if (parsedPozice !== null && !Number.isFinite(parsedPozice)) {
        alert("Pozice musí být číslo.");
        return;
      }

      if (parsedNaklad !== null && !Number.isFinite(parsedNaklad)) {
        alert("Cena pro akce musí být číslo.");
        return;
      }

      const updated: SkladPolozkaRow = {
        ...oldItem,
        nazev: snapshot.nazev.trim(),
        celkem_k_dispozici: parsedKusy,
        jednotka: snapshot.jednotka.trim(),
        interni_naklad: parsedNaklad,
        pozice: parsedPozice,
      };

      lastChange.current = { before: oldItem, after: updated };

      setItems((prev) =>
        prev.map((i) => (i.skladova_polozka_id === id ? updated : i))
      );

      if (options.exitEdit) {
        setEditingId(null);
      }

      setSavingId(id);
      setHighlightId(id);

      const { error } = await supabase.rpc("update_skladova_polozka_detail", {
        p_id: id,
        p_nazev: updated.nazev,
        p_kusy: updated.celkem_k_dispozici,
        p_jednotka: updated.jednotka,
        p_naklad: updated.interni_naklad,
        p_rent: oldItem.fakturacni_cena,
      });

      setSavingId(null);
      window.setTimeout(() => setHighlightId(null), 1000);

      if (error) {
        alert(error.message);
        await load({ silent: true });
        return;
      }

      const { error: pozUpdateErr } = await supabase
        .from(SKLAD_TABLE.skladovePolozky)
        .update({
          pozice: parsedPozice,
          upraveno_dne: new Date().toISOString(),
        })
        .eq("skladova_polozka_id", id);

      if (pozUpdateErr) {
        alert(pozUpdateErr.message);
        await load({ silent: true });
        return;
      }

      await applyKusySyncAfterCelkemSave(
        id,
        updated.nazev,
        updated.celkem_k_dispozici
      );

      await load({ silent: true });
    },
    [applyKusySyncAfterCelkemSave, items, load]
  );

  const saveEdit = useCallback(
    async (id: string) => {
      await commitRowSave(id, draftRef.current, { exitEdit: true });
    },
    [commitRowSave]
  );

  useEffect(() => {
    function handleUndo(e: KeyboardEvent) {
      if (!(e.ctrlKey && e.key.toLowerCase() === "z")) return;
      if (!lastChange.current) return;

      e.preventDefault();

      const before = lastChange.current.before;

      setItems((prev) =>
        prev.map((i) =>
          i.skladova_polozka_id === before.skladova_polozka_id ? before : i
        )
      );

      setSavingId(before.skladova_polozka_id);

      supabase
        .rpc("update_skladova_polozka_detail", {
          p_id: before.skladova_polozka_id,
          p_nazev: before.nazev,
          p_kusy: before.celkem_k_dispozici,
          p_jednotka: before.jednotka ?? "ks",
          p_naklad: before.interni_naklad,
          p_rent: before.fakturacni_cena,
        })
        .then(async (result: RpcErrorResult) => {
          setSavingId(null);

          if (result.error) {
            alert(result.error.message);
            void load({ silent: true });
            return;
          }

          const rawPoz = before.pozice;
          const parsedUndoPoz =
            rawPoz == null || rawPoz === ""
              ? null
              : Number(rawPoz);
          const poziceUndo =
            parsedUndoPoz !== null && Number.isFinite(parsedUndoPoz)
              ? parsedUndoPoz
              : null;

          const { error: pozUndoErr } = await supabase
            .from(SKLAD_TABLE.skladovePolozky)
            .update({
              pozice: poziceUndo,
              upraveno_dne: new Date().toISOString(),
            })
            .eq("skladova_polozka_id", before.skladova_polozka_id);

          if (pozUndoErr) {
            alert(pozUndoErr.message);
            void load({ silent: true });
            return;
          }

          void applyKusySyncAfterCelkemSave(
            before.skladova_polozka_id,
            before.nazev,
            before.celkem_k_dispozici
          );

          setHighlightId(before.skladova_polozka_id);
          window.setTimeout(() => setHighlightId(null), 1000);
        });

      lastChange.current = null;
    }

    window.addEventListener("keydown", handleUndo);
    return () => window.removeEventListener("keydown", handleUndo);
  }, [applyKusySyncAfterCelkemSave, load, reloadCatalog]);

  useEffect(() => {
    function handleGlobalEnter(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (!editingId) return;

      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === "TEXTAREA") return;

      e.preventDefault();
      void saveEdit(editingId);
    }

    window.addEventListener("keydown", handleGlobalEnter);
    return () => window.removeEventListener("keydown", handleGlobalEnter);
  }, [editingId, saveEdit]);

  type ZakladPatch = {
    kategorieId?: string | null;
    podkategorieId?: string | null;
    blokId?: string | null;
  };

  async function updateVlastnik(
    id: string,
    vlastnikId: string,
    onApplied?: (fields: ObsahChildPolozkaAppliedFields) => void
  ) {
    const oldItem = await resolvePolozkaForUpdate(id);
    if (!oldItem) return;

    const inCatalog = items.some((item) => item.skladova_polozka_id === id);
    const vlastnik = vlastnici.find((v) => v.id === vlastnikId);
    const applied: ObsahChildPolozkaAppliedFields = {
      technickyVlastnikId: vlastnikId,
      technickyVlastnikNazev: vlastnik?.nazev ?? null,
    };

    if (inCatalog) {
      setItems((prev) =>
        prev.map((item) =>
          item.skladova_polozka_id === id
            ? {
                ...item,
                technicky_vlastnik_id: vlastnikId,
                technicky_vlastnik_nazev: vlastnik?.nazev ?? null,
              }
            : item
        )
      );
    }

    setSavingId(id);

    const { error } = await supabase.rpc(SKLAD_RPC.updateSkladovaPolozkaVlastnik, {
      p_skladova_polozka_id: id,
      p_technicky_vlastnik_id: vlastnikId,
    });

    setSavingId(null);

    if (error) {
      alert(error.message);
      if (inCatalog) {
        setItems((prev) =>
          prev.map((item) => (item.skladova_polozka_id === id ? oldItem : item))
        );
      }
      return;
    }

    onApplied?.(applied);
  }

  async function updateJednotka(
    id: string,
    jednotkaValue: string,
    onApplied?: (fields: ObsahChildPolozkaAppliedFields) => void
  ) {
    const trimmed = jednotkaValue.trim();
    if (!trimmed) return;

    const oldItem = await resolvePolozkaForUpdate(id);
    if (!oldItem || (oldItem.jednotka ?? "") === trimmed) return;

    const inCatalog = items.some((item) => item.skladova_polozka_id === id);
    const previous = items;
    setSavingId(id);

    if (inCatalog) {
      setItems((prev) =>
        prev.map((item) =>
          item.skladova_polozka_id === id ? { ...item, jednotka: trimmed } : item
        )
      );
    }

    const { error } = await supabase.rpc("update_skladova_polozka_detail", {
      p_id: id,
      p_nazev: oldItem.nazev,
      p_kusy: oldItem.celkem_k_dispozici,
      p_jednotka: trimmed,
      p_naklad: oldItem.interni_naklad,
      p_rent: oldItem.fakturacni_cena,
    });

    setSavingId(null);

    if (error) {
      if (inCatalog) setItems(previous);
      alert(error.message);
      return;
    }

    if (inCatalog) {
      setHighlightId(id);
      window.setTimeout(() => setHighlightId(null), 1000);
    }

    onApplied?.({ jednotka: trimmed });
  }

  async function updateZaklad(
    id: string,
    patch: ZakladPatch,
    onApplied?: (fields: ObsahChildPolozkaAppliedFields) => void
  ) {
    const previous = items;
    const oldItem = await resolvePolozkaForUpdate(id);
    if (!oldItem) return;

    const inCatalog = items.some((item) => item.skladova_polozka_id === id);

    let finalBlokId =
      patch.blokId !== undefined ? patch.blokId : oldItem.sklad_blok_id;
    let finalKategorieId =
      patch.kategorieId !== undefined
        ? patch.kategorieId
        : oldItem.kategorie_techniky_id;
    let finalPodkategorieId =
      patch.podkategorieId !== undefined
        ? patch.podkategorieId
        : oldItem.podkategorie_techniky_id;

    const zakladChanged =
      finalKategorieId !== oldItem.kategorie_techniky_id ||
      finalBlokId !== oldItem.sklad_blok_id;

    const podkategorieChanged =
      finalPodkategorieId !== oldItem.podkategorie_techniky_id;

    if (!zakladChanged && !podkategorieChanged) return;

    const novaKategorie =
      finalKategorieId === null
        ? null
        : (kategorie.find((k) => k.kategorie_techniky_id === finalKategorieId)
            ?.nazev ?? null);

    const novaPodkategorie =
      finalPodkategorieId === null
        ? null
        : (podkategorie.find(
            (p) => p.podkategorie_techniky_id === finalPodkategorieId
          )?.nazev ?? null);

    const novyBlok =
      finalBlokId === null
        ? null
        : (bloky.find((b) => b.sklad_blok_id === finalBlokId)?.nazev ?? null);

    setSavingId(id);

    if (inCatalog) {
      setItems((prev) =>
        prev.map((item) =>
          item.skladova_polozka_id === id
            ? {
                ...item,
                kategorie_techniky_id: finalKategorieId,
                kategorie_nazev: novaKategorie,
                podkategorie_techniky_id: finalPodkategorieId,
                podkategorie_nazev: novaPodkategorie,
                sklad_blok_id: finalBlokId,
                blok_nazev: novyBlok,
              }
            : item
        )
      );
    }

    if (zakladChanged) {
      const { error } = await supabase.rpc(SKLAD_RPC.updateSkladovaPolozkaZaklad, {
        p_id: id,
        p_kategorie_techniky_id: finalKategorieId,
        p_sklad_blok_id: finalBlokId,
      });

      if (error) {
        setSavingId(null);
        if (inCatalog) setItems(previous);
        alert(error.message);
        return;
      }
    }

    if (podkategorieChanged) {
      const { error } = await supabase.rpc(SKLAD_RPC.updateSkladovaPolozka, {
        p_skladova_polozka_id: id,
        p_nazev: oldItem.nazev,
        p_kategorie_techniky_id: finalKategorieId,
        p_podkategorie_techniky_id: finalPodkategorieId,
        p_jednotka: oldItem.jednotka ?? SKLAD_DEFAULT_JEDNOTKA,
        p_celkem_k_dispozici: oldItem.celkem_k_dispozici,
        p_interni_naklad: oldItem.interni_naklad,
        p_fakturacni_cena: oldItem.fakturacni_cena,
        p_aktivni: true,
      });

      if (error) {
        setSavingId(null);
        if (inCatalog) setItems(previous);
        alert(error.message);
        if (inCatalog) await load({ silent: true });
        return;
      }

      if (inCatalog) {
        const { data: podkategorieRows, error: podkategorieMapError } =
          await querySkladovePolozkyPodkategorie(supabase);

        if (!podkategorieMapError && podkategorieRows) {
          setPodkategorie((currentPodkategorie) => {
            setItems((prev) =>
              enrichSpravaPolozkyWithPodkategorie(
                prev,
                podkategorieRows,
                currentPodkategorie
              )
            );
            return currentPodkategorie;
          });
        }
      }
    }

    setSavingId(null);

    if (inCatalog) {
      setHighlightId(id);
      window.setTimeout(() => setHighlightId(null), 1000);
    }

    onApplied?.({
      skladBlokId: finalBlokId,
      blokNazev: novyBlok,
      kategorieTechnikyId: finalKategorieId,
      kategorieNazev: novaKategorie,
      podkategorieTechnikyId: finalPodkategorieId,
      podkategorieNazev: novaPodkategorie,
    });
  }

  const obsahPolozkaUpdaters = useMemo<SpravaObsahPolozkaUpdaters>(
    () => ({
      savingPolozkaId: savingId,
      onUpdateZaklad: (polozkaId, patch, onApplied) => {
        void updateZaklad(polozkaId, patch, onApplied);
      },
      onUpdateVlastnik: (polozkaId, vlastnikId, onApplied) => {
        void updateVlastnik(polozkaId, vlastnikId, onApplied);
      },
      onUpdateJednotka: (polozkaId, value, onApplied) => {
        void updateJednotka(polozkaId, value, onApplied);
      },
      kategorieOptions: listActiveKategorie(kategorie),
      getPodkategorieOptions,
      getJednotkaOptions: (currentValue) =>
        listJednotkaSelectOptions(jednotky, currentValue),
    }),
    [getPodkategorieOptions, jednotky, kategorie, savingId]
  );

  async function handleCreateItem() {
    const parsedKusy = Number(newKusy);
    const parsedNaklad = newNaklad === "" ? null : Number(newNaklad);

    if (!newBlokId) {
      alert("Vyber okruh.");
      return;
    }

    if (!newNazev.trim()) {
      alert("Název je povinný.");
      return;
    }

    if (!newJednotka.trim()) {
      alert("Jednotka je povinná.");
      return;
    }

    if (!Number.isFinite(parsedKusy) || parsedKusy < 0) {
      alert("Kusy musí být číslo 0 nebo vyšší.");
      return;
    }

    if (parsedNaklad !== null && !Number.isFinite(parsedNaklad)) {
      alert("Cena pro akce musí být číslo.");
      return;
    }

    setIsCreating(true);

    const createRes = await supabase.rpc("create_skladova_polozka", {
      p_nazev: newNazev.trim(),
      p_kategorie_techniky_id: newKategorieId || null,
      p_podkategorie_techniky_id: newPodkategorieId || null,
      p_jednotka: newJednotka.trim(),
      p_celkem_k_dispozici: parsedKusy,
      p_interni_naklad: parsedNaklad,
      p_fakturacni_cena: null,
      p_aktivni: true,
      p_poznamka: null,
    });

    if (createRes.error) {
      setIsCreating(false);
      alert(createRes.error.message);
      return;
    }

    const createdRows = (createRes.data ?? []) as Array<{
      skladova_polozka_id: string;
    }>;

    const createdId = createdRows[0]?.skladova_polozka_id;

    if (!createdId) {
      setIsCreating(false);
      alert("Položka byla vytvořena, ale nepodařilo se získat její ID.");
      return;
    }

    const assignRes = await supabase.rpc("set_sklad_polozka_blok", {
      p_polozka_id: createdId,
      p_blok_id: newBlokId,
    });

    if (assignRes.error) {
      setIsCreating(false);
      alert(
        "Položka byla vytvořena, ale nepodařilo se ji přiřadit do okruhu: " +
          assignRes.error.message
      );
      await load();
      return;
    }

    await applyKusySyncAfterCelkemSave(
      createdId,
      newNazev.trim(),
      parsedKusy
    );

    if (addItemMode === "case") {
      const caseRes = await nastavitPolozkaJeCase(supabase, createdId, true);
      if (!caseRes.ok) {
        alert(
          `Položka byla vytvořena, ale nepodařilo se ji označit jako case: ${caseRes.error}`
        );
      }
    }

    await refreshCaseMetadata();

    setIsCreating(false);
    setIsAddOpen(false);
    await load();
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveEdit(id);
    }

    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  const catalogItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !isPolozkaObsahCase(
            item.skladova_polozka_id,
            caseMetadata.polozkaFlags
          )
      ),
    [items, caseMetadata.polozkaFlags]
  );

  const filteredItems = useMemo(
    () => filterSpravaInventoryItems(catalogItems, inventoryFilters),
    [catalogItems, inventoryFilters]
  );

  return (
    <div className="flex flex-col gap-3">
      {isSetupMode || isSelectMode ? null : <SkladPolozkyHeader readOnly={readOnly} />}

      <SpravaInventoryFilters
          filters={inventoryFilters}
          onChange={setInventoryFilters}
          bloky={bloky}
          kategorie={kategorie}
          filteredCount={filteredItems.length}
          totalCount={catalogItems.length}
        />

        {isSetupMode && setupId ? (
          <SetupSelectionPanel setupId={setupId} />
        ) : isSelectMode ? null : (
          <>
            <SpravaActionPanel
              onAddPolozka={() => openAddModal("polozka")}
              onAddCase={() => openAddModal("case")}
            />

            <AddItemModal
        mode={addItemMode}
        open={isAddOpen}
        onClose={closeAddModal}
        onSave={handleCreateItem}
        isCreating={isCreating}
        bloky={bloky}
        jednotky={newJednotkaOptions}
        newBlokId={newBlokId}
        setNewBlokId={setNewBlokId}
        newKategorieId={newKategorieId}
        setNewKategorieId={setNewKategorieId}
        newPodkategorieId={newPodkategorieId}
        setNewPodkategorieId={setNewPodkategorieId}
        newNazev={newNazev}
        setNewNazev={setNewNazev}
        newKusy={newKusy}
        setNewKusy={setNewKusy}
        newJednotka={newJednotka}
        setNewJednotka={setNewJednotka}
        newNaklad={newNaklad}
        setNewNaklad={setNewNaklad}
        newKategorieOptions={newKategorieOptions}
        newPodkategorieOptions={newPodkategorieOptions}
        onQuickCreateBlok={handleQuickCreateBlok}
        onQuickCreateKategorie={handleQuickCreateKategorie}
        onQuickCreatePodkategorie={handleQuickCreatePodkategorie}
        onQuickCreateJednotka={handleQuickCreateJednotka}
        />
          </>
        )}

        <SkladTable loading={loading}>
          {!loading && filteredItems.length === 0 ? (
            <div className="border-t border-slate-800 px-4 py-10 text-center text-sm text-slate-400">
              Žádná položka nevyhovuje zadaným filtrům.
            </div>
          ) : null}
          {filteredItems.map((i) => {
          const isEditing = editingId === i.skladova_polozka_id;
          const isSaving = savingId === i.skladova_polozka_id;
          const isHighlight = highlightId === i.skladova_polozka_id;

          const kategorieOptions = listActiveKategorie(kategorie);
          const podkategorieOptions = getPodkategorieOptions(
            i.podkategorie_techniky_id
          );

            const isObsahPolozka = obsahPolozkaId === i.skladova_polozka_id;

            return (
              <SkladTableRow
              key={i.skladova_polozka_id}
              item={i}
              isEditing={isEditing}
              isSaving={isSaving}
              isHighlight={isHighlight}
              kusyReloadToken={kusyReloadById[i.skladova_polozka_id] ?? 0}
              obsahReloadKey={isObsahPolozka ? obsahReloadKey : ""}
              autoExpandKusy={isObsahPolozka}
              openCaseKusId={isObsahPolozka ? openCaseKusId : null}
              obsahMode={isObsahPolozka ? obsahMode : null}
              caseObsahFormDefaults={{
                skladBlokId: i.sklad_blok_id ?? null,
                kategorieTechnikyId: i.kategorie_techniky_id ?? null,
                podkategorieTechnikyId: i.podkategorie_techniky_id ?? null,
                technickyVlastnikId: i.technicky_vlastnik_id ?? null,
                jednotka: i.jednotka ?? SKLAD_DEFAULT_JEDNOTKA,
              }}
              draft={draft}
              bloky={bloky}
              jednotky={jednotky}
              vlastnici={vlastnici}
              kategorieOptions={kategorieOptions}
              podkategorieOptions={podkategorieOptions}
              allKategorie={kategorie}
              allPodkategorie={podkategorie}
              onCatalogConfigChanged={() => {
                void reloadCatalog();
              }}
              onStartEdit={() => {
                if (readOnly) return;
                startEdit(i);
              }}
              onUpdateVlastnik={(vlastnikId) =>
                updateVlastnik(i.skladova_polozka_id, vlastnikId)
              }
              onUpdateZaklad={(patch) =>
                updateZaklad(i.skladova_polozka_id, patch)
              }
              onUpdateJednotka={(value) =>
                updateJednotka(i.skladova_polozka_id, value)
              }
              obsahPolozkaUpdaters={obsahPolozkaUpdaters}
              onDraftChange={setDraft}
              onKeyDown={(e) => {
                if (readOnly) return;
                handleKeyDown(e, i.skladova_polozka_id);
              }}
              readOnly={readOnly}
              selectionMode={isSelectMode}
              />
            );
          })}
        </SkladTable>
    </div>
  );
}
