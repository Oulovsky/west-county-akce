"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import Toast from "@/components/Toast";
import { GpsLocationFields, type SavedPlaceSuggestion } from "../GpsLocationFields";
import { KlientSelectWithCreate, type KlientOption } from "../KlientSelectWithCreate";
import {
  FakturacniFirmaSelect,
  getDefaultFakturacniFirmaId,
} from "@/components/zakazky/FakturacniFirmaSelect";
import type { FakturacniFirma } from "@/lib/fakturacni-firmy";

type TypObsluhy = "s_obsluhou" | "bez_obsluhy";
type TechSectionKey = "stage" | "sound" | "lights" | "led" | "kamery";
type SetupCategoryKey = "stage" | "sound" | "lights" | "led" | "kamery";

type RealizaceForm = {
  local_id: string;
  nazev: string;
  stagePreset: string;
  stageWidth: string;
  stageDepth: string;
  soundPreset: string;
  lightsPreset: string;
  ledKind: string;
  ledWidth: string;
  ledHeight: string;
  ledRohy: boolean;
  kamery: number;
  dron: boolean;
};

type SkladSetup = {
  setup_id: string;
  nazev: string;
  popis: string | null;
  poradi: number | null;
};

type Klient = KlientOption;

type MistoKonani = SavedPlaceSuggestion & {
  aktivni?: boolean | null;
};

type SetupPolozka = {
  setup_polozka_id: string;
  setup_id: string;
  skladova_polozka_id: string;
  mnozstvi: number | string;
  poradi: number | null;
  skladove_polozky:
    | {
        nazev: string | null;
        pozice: number | string | null;
      }
    | {
        nazev: string | null;
        pozice: number | string | null;
      }[]
    | null;
};

type SetupSelection = {
  selected: boolean;
  quantity: string;
};

type SetupPlanPreviewRow = {
  skladova_polozka_id: string;
  nazev: string;
  pozice: number | string | null;
  mnozstviVSetupu: number;
  pocetSetupu: number;
  vysledneMnozstvi: number;
};

type SkladPolozka = {
  skladova_polozka_id: string;
  nazev: string;
  pozice: number | string | null;
  celkem_k_dispozici: number | string | null;
  aktivni: boolean | null;
  sklad_blok_id: string | null;
  kategorie_techniky_id: string | null;
  podkategorie_techniky_id: string | null;
};

type SkladBlok = {
  sklad_blok_id: string;
  nazev: string;
  poradi: number | null;
};

type KategorieTechniky = {
  kategorie_techniky_id: string;
  nazev: string;
  poradi: number | null;
};

type PodkategorieTechniky = {
  podkategorie_techniky_id: string;
  nazev: string;
  poradi: number | null;
};

type ManualPlanItem = {
  local_id: string;
  skladova_polozka_id: string;
  mnozstvi: string;
};

type AggregatedPlanRow = {
  skladova_polozka_id: string;
  nazev: string;
  pozice: number | string | null;
  setupMnozstvi: number;
  manualMnozstvi: number;
  vysledneMnozstvi: number;
};

type ZakazkaAvailabilityRow = {
  zakazka_id: string;
  datum_od: string | null;
  datum_do: string | null;
  cas_od: string | null;
  cas_do: string | null;
  akce_od: string | null;
  akce_do: string | null;
  zrusena: boolean | null;
};

type TechnikaAvailabilityRow = {
  zakazka_id: string;
  skladova_polozka_id: string;
  mnozstvi: number | string | null;
};

type SkladKusAvailabilityRow = {
  skladova_polozka_id: string;
  stav: string | null;
};

type AvailabilityConflict = {
  skladova_polozka_id: string;
  nazev: string;
  pozadovano: number;
  celkemSkladem: number;
  planovanoKolize: number;
  nedostupneKusy: number;
  fyzickyNalozenoJinde: number;
  rezervyJinde: number;
  dostupne: number;
  chybi: number;
};

const selectClassName =
  "mt-2 w-full appearance-none rounded-xl border border-slate-700 bg-[#0f172a] bg-no-repeat px-4 py-3 pr-12 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const selectChevronStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 7 5 5 5-5'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 1rem center",
  backgroundSize: "1rem",
} as const;

const AVAILABILITY_WARNING_NOTE =
  "Upozornění dostupnosti: některé položky překračují dostupné množství. Řešení: půjčit / doplnit externě.";

const STAGE_PRESET_DIMENSIONS: Record<string, { width: string; depth: string }> = {
  mala: { width: "6", depth: "4" },
  stredni: { width: "8", depth: "6" },
  velka: { width: "10", depth: "8" },
};

const SETUP_CATEGORY_KEYWORDS: Record<SetupCategoryKey, string[]> = {
  stage: ["stage", "pódium", "podium", "střecha", "strecha"],
  sound: ["sound", "zvuk", "audio", "pa", "repro"],
  lights: ["lights", "světla", "svetla", "osvětlení", "osvetleni"],
  led: ["led", "mantinel", "obrazovka"],
  kamery: ["kamera", "kamery", "video", "stream"],
};

function PickerInput({
  type,
  value,
  onChange,
}: {
  type: "date" | "time";
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const iconSvg =
    type === "time"
      ? "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 7v6l4 2'/%3E%3C/svg%3E"
      : "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cpath d='M16 2v4M8 2v4M3 10h18'/%3E%3C/svg%3E";

  return (
    <div className="relative mt-2">
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="app-picker-input app-native-picker-hide w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 pr-14 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
      />
      <div className="pointer-events-none absolute inset-y-[1px] right-[1px] w-14 rounded-r-xl bg-[#0f172a]" />
      <div
        className="pointer-events-none absolute inset-y-0 right-4 my-auto h-5 w-5 bg-no-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,${iconSvg}")`,
          backgroundPosition: "center",
          backgroundSize: "1.1rem",
        }}
      />
    </div>
  );
}

function combineDateAndTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null;
  return `${dateValue}T${timeValue}:00`;
}

function normalizeTime(value: string | null | undefined, fallback: string) {
  if (!value || value.trim() === "") return fallback;
  return value.length === 5 ? `${value}:00` : value;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getZakazkaStart(row: ZakazkaAvailabilityRow) {
  const direct = parseDate(row.akce_od);
  if (direct) return direct;
  if (!row.datum_od) return null;
  return parseDate(`${row.datum_od}T${normalizeTime(row.cas_od, "00:00:00")}`);
}

function getZakazkaEnd(row: ZakazkaAvailabilityRow) {
  const direct = parseDate(row.akce_do);
  if (direct) return direct;
  if (!row.datum_do) return null;
  return parseDate(`${row.datum_do}T${normalizeTime(row.cas_do, "23:59:59")}`);
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() <= bEnd.getTime() && aEnd.getTime() >= bStart.getTime();
}

function deriveLegacyDate(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function deriveLegacyTime(value: string | null) {
  return value ? value.slice(11, 16) : null;
}

function getLedMaxArea(kind: string) {
  switch (kind) {
    case "p2_indoor":
      return 24.5;
    case "p2_6_outdoor":
      return 17.5;
    case "p3_9_outdoor":
      return 45;
    case "p4_8_outdoor":
      return 22.5;
    case "p6_4_mantel":
      return 21;
    default:
      return null;
  }
}

function getLedKindLabel(kind: string) {
  switch (kind) {
    case "p2_indoor":
      return "P2 – indoor";
    case "p2_6_outdoor":
      return "P2,6 – outdoor";
    case "p3_9_outdoor":
      return "P3,9 – outdoor";
    case "p4_8_outdoor":
      return "P4,8 – outdoor";
    case "p6_4_mantel":
      return "P6,4 – mantinel";
    default:
      return "—";
  }
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toOptionalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value);
}

function getSkladPolozkaInfo(row: SetupPolozka) {
  if (Array.isArray(row.skladove_polozky)) {
    return row.skladove_polozky[0] ?? null;
  }

  return row.skladove_polozky;
}

function formatPosition(value: number | string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function createManualPlanItem(): ManualPlanItem {
  return {
    local_id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    skladova_polozka_id: "",
    mnozstvi: "1",
  };
}

function createRealizace(index: number): RealizaceForm {
  return {
    local_id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `stage-${Date.now()}-${index}`,
    nazev: `Stage ${index + 1}`,
    stagePreset: "",
    stageWidth: "",
    stageDepth: "",
    soundPreset: "",
    lightsPreset: "",
    ledKind: "",
    ledWidth: "",
    ledHeight: "",
    ledRohy: false,
    kamery: 0,
    dron: false,
  };
}

function isRealizaceEffectivelyEmpty(realizace: RealizaceForm) {
  return (
    realizace.stagePreset === "" &&
    realizace.stageWidth === "" &&
    realizace.stageDepth === "" &&
    realizace.soundPreset === "" &&
    realizace.lightsPreset === "" &&
    realizace.ledKind === "" &&
    realizace.ledWidth === "" &&
    realizace.ledHeight === "" &&
    realizace.ledRohy === false &&
    realizace.kamery === 0 &&
    realizace.dron === false
  );
}

export default function NovaZakazkaPage() {
  const router = useRouter();

  const [nazev, setNazev] = useState("");
  const [misto, setMisto] = useState("");
  const [selectedKlientId, setSelectedKlientId] = useState("");
  const [selectedMistoId, setSelectedMistoId] = useState("");
  const [mistoGps, setMistoGps] = useState({
    lat: "",
    lng: "",
    radiusM: "300",
    accuracyM: "",
    source: "",
    updatedAt: "",
  });
  const [typObsluhy, setTypObsluhy] = useState<TypObsluhy>("s_obsluhou");

  const [odjezdZeSkladuDatum, setOdjezdZeSkladuDatum] = useState("");
  const [odjezdZeSkladuCas, setOdjezdZeSkladuCas] = useState("09:00");

  const [srazNaMisteDatum, setSrazNaMisteDatum] = useState("");
  const [srazNaMisteCas, setSrazNaMisteCas] = useState("10:00");

  const [stavbaOdDatum, setStavbaOdDatum] = useState("");
  const [stavbaOdCas, setStavbaOdCas] = useState("12:00");
  const [stavbaDoDatum, setStavbaDoDatum] = useState("");
  const [stavbaDoCas, setStavbaDoCas] = useState("12:00");

  const [akceOdDatum, setAkceOdDatum] = useState("");
  const [akceOdCas, setAkceOdCas] = useState("12:00");
  const [akceDoDatum, setAkceDoDatum] = useState("");
  const [akceDoCas, setAkceDoCas] = useState("12:00");

  const [bouraniOdDatum, setBouraniOdDatum] = useState("");
  const [bouraniOdCas, setBouraniOdCas] = useState("12:00");
  const [bouraniDoDatum, setBouraniDoDatum] = useState("");
  const [bouraniDoCas, setBouraniDoCas] = useState("12:00");

  const [realizaceList, setRealizaceList] = useState<RealizaceForm[]>([
    createRealizace(0),
  ]);
  const [activeTechSections, setActiveTechSections] = useState<
    Record<string, Partial<Record<TechSectionKey, boolean>>>
  >({});

  const [poznamka, setPoznamka] = useState("");
  const [ukladam, setUkladam] = useState(false);
  const [setupy, setSetupy] = useState<SkladSetup[]>([]);
  const [setupPolozky, setSetupPolozky] = useState<SetupPolozka[]>([]);
  const [setupSelections, setSetupSelections] = useState<Record<string, SetupSelection>>({});
  const [setupyLoading, setSetupyLoading] = useState(true);
  const [setupyError, setSetupyError] = useState<string | null>(null);
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [mistaKonani, setMistaKonani] = useState<MistoKonani[]>([]);
  const [fakturacniFirmy, setFakturacniFirmy] = useState<FakturacniFirma[]>([]);
  const [selectedFakturacniFirmaId, setSelectedFakturacniFirmaId] = useState("");
  const [klientiMistaError, setKlientiMistaError] = useState<string | null>(null);
  const [skladPolozky, setSkladPolozky] = useState<SkladPolozka[]>([]);
  const [skladBloky, setSkladBloky] = useState<SkladBlok[]>([]);
  const [kategorieTechniky, setKategorieTechniky] = useState<KategorieTechniky[]>([]);
  const [podkategorieTechniky, setPodkategorieTechniky] = useState<PodkategorieTechniky[]>([]);
  const [skladLoading, setSkladLoading] = useState(true);
  const [skladError, setSkladError] = useState<string | null>(null);
  const [manualPlanItems, setManualPlanItems] = useState<ManualPlanItem[]>([]);
  const [availabilityConflicts, setAvailabilityConflicts] = useState<AvailabilityConflict[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showError(message: string) {
    setToast({ type: "error", message });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSetupy() {
      setSetupyLoading(true);
      setSetupyError(null);

      const { data: setupData, error: setupError } = await supabase
        .from("setupy")
        .select("setup_id, nazev, popis, poradi")
        .eq("aktivni", true)
        .order("poradi", { ascending: true })
        .order("nazev", { ascending: true });

      if (cancelled) return;

      if (setupError) {
        setSetupyError(setupError.message);
        setSetupyLoading(false);
        return;
      }

      const loadedSetupy = (setupData ?? []) as SkladSetup[];
      setSetupy(loadedSetupy);

      if (loadedSetupy.length === 0) {
        setSetupPolozky([]);
        setSetupyLoading(false);
        return;
      }

      const setupIds = loadedSetupy.map((setup) => setup.setup_id);
      const { data: polozkyData, error: polozkyError } = await supabase
        .from("setup_polozky")
        .select(
          "setup_polozka_id, setup_id, skladova_polozka_id, mnozstvi, poradi, skladove_polozky(nazev, pozice)"
        )
        .in("setup_id", setupIds)
        .order("poradi", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (polozkyError) {
        setSetupyError(polozkyError.message);
        setSetupyLoading(false);
        return;
      }

      setSetupPolozky((polozkyData ?? []) as SetupPolozka[]);
      setSetupyLoading(false);
    }

    async function loadSkladCatalog() {
      setSkladLoading(true);
      setSkladError(null);

      const [
        { data: polozkyData, error: polozkyError },
        { data: blokyData, error: blokyError },
        { data: kategorieData, error: kategorieError },
        { data: podkategorieData, error: podkategorieError },
      ] = await Promise.all([
        supabase
          .from("skladove_polozky")
          .select(
            "skladova_polozka_id, nazev, pozice, celkem_k_dispozici, aktivni, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id"
          )
          .eq("aktivni", true)
          .order("nazev", { ascending: true }),
        supabase
          .from("sklad_bloky")
          .select("sklad_blok_id, nazev, poradi")
          .order("poradi", { ascending: true }),
        supabase
          .from("kategorie_techniky")
          .select("kategorie_techniky_id, nazev, poradi")
          .order("poradi", { ascending: true }),
        supabase
          .from("podkategorie_techniky")
          .select("podkategorie_techniky_id, nazev, poradi")
          .order("poradi", { ascending: true }),
      ]);

      if (cancelled) return;

      const error =
        polozkyError?.message ??
        blokyError?.message ??
        kategorieError?.message ??
        podkategorieError?.message;

      if (error) {
        setSkladError(error);
        setSkladLoading(false);
        return;
      }

      setSkladPolozky((polozkyData ?? []) as SkladPolozka[]);
      setSkladBloky((blokyData ?? []) as SkladBlok[]);
      setKategorieTechniky((kategorieData ?? []) as KategorieTechniky[]);
      setPodkategorieTechniky((podkategorieData ?? []) as PodkategorieTechniky[]);
      setSkladLoading(false);
    }

    async function loadKlientiMista() {
      setKlientiMistaError(null);

      const [
        { data: klientiData, error: klientiError },
        { data: mistaData, error: mistaError },
        { data: fakturacniFirmyData, error: fakturacniFirmyError },
      ] = await Promise.all([
        supabase
          .from("klienti")
          .select("klient_id, nazev")
          .eq("aktivni", true)
          .order("nazev", { ascending: true }),
        supabase
          .from("mista_konani")
          .select("misto_id, klient_id, nazev, adresa_text, lat, lng, radius_m, aktivni")
          .eq("aktivni", true)
          .order("nazev", { ascending: true }),
        supabase
          .from("fakturacni_firmy")
          .select("*")
          .eq("aktivni", true)
          .order("vychozi", { ascending: false })
          .order("nazev", { ascending: true }),
      ]);

      if (cancelled) return;

      const error = klientiError?.message ?? mistaError?.message ?? fakturacniFirmyError?.message;
      if (error) {
        setKlientiMistaError(error);
        return;
      }

      setKlienti((klientiData ?? []) as Klient[]);
      setMistaKonani((mistaData ?? []) as MistoKonani[]);
      const firmy = (fakturacniFirmyData ?? []) as FakturacniFirma[];
      setFakturacniFirmy(firmy);
      setSelectedFakturacniFirmaId((current) => current || getDefaultFakturacniFirmaId(firmy));
    }

    void loadSetupy();
    void loadSkladCatalog();
    void loadKlientiMista();

    return () => {
      cancelled = true;
    };
  }, []);

  const setupPolozkyBySetup = useMemo(() => {
    const map = new Map<string, SetupPolozka[]>();
    for (const row of setupPolozky) {
      const current = map.get(row.setup_id) ?? [];
      current.push(row);
      map.set(row.setup_id, current);
    }
    return map;
  }, [setupPolozky]);

  const skladPolozkaMap = useMemo(
    () => new Map(skladPolozky.map((item) => [item.skladova_polozka_id, item])),
    [skladPolozky]
  );

  const skladBlokMap = useMemo(
    () => new Map(skladBloky.map((item) => [item.sklad_blok_id, item])),
    [skladBloky]
  );

  const kategorieMap = useMemo(
    () => new Map(kategorieTechniky.map((item) => [item.kategorie_techniky_id, item])),
    [kategorieTechniky]
  );

  const podkategorieMap = useMemo(
    () =>
      new Map(
        podkategorieTechniky.map((item) => [item.podkategorie_techniky_id, item])
      ),
    [podkategorieTechniky]
  );

  function handleSavedPlaceSelect(place: SavedPlaceSuggestion) {
    setSelectedMistoId(place.misto_id);
    setMisto(place.nazev);

    if (place.klient_id) {
      setSelectedKlientId(place.klient_id);
    }
  }

  const sortedSkladPolozky = useMemo(() => {
    return [...skladPolozky].sort((a, b) => {
      const aBlok = a.sklad_blok_id
        ? (skladBlokMap.get(a.sklad_blok_id)?.poradi ?? 999999)
        : 999999;
      const bBlok = b.sklad_blok_id
        ? (skladBlokMap.get(b.sklad_blok_id)?.poradi ?? 999999)
        : 999999;

      if (aBlok !== bBlok) return aBlok - bBlok;
      return a.nazev.localeCompare(b.nazev, "cs");
    });
  }, [skladBlokMap, skladPolozky]);

  const selectedSetupPlanRows = useMemo(() => {
    const rows: SetupPlanPreviewRow[] = [];

    for (const setup of setupy) {
      const selection = setupSelections[setup.setup_id];
      if (!selection?.selected) continue;

      const setupQuantity = toNumber(selection.quantity || 1);
      if (setupQuantity <= 0) continue;

      const items = setupPolozkyBySetup.get(setup.setup_id) ?? [];
      for (const item of items) {
        const itemQuantity = toNumber(item.mnozstvi);
        if (itemQuantity <= 0) continue;

        const info = getSkladPolozkaInfo(item);
        rows.push({
          skladova_polozka_id: item.skladova_polozka_id,
          nazev: info?.nazev?.trim() || item.skladova_polozka_id,
          pozice: info?.pozice ?? null,
          mnozstviVSetupu: itemQuantity,
          pocetSetupu: setupQuantity,
          vysledneMnozstvi: itemQuantity * setupQuantity,
        });
      }
    }

    return rows;
  }, [setupPolozkyBySetup, setupSelections, setupy]);

  const aggregatedSetupPlanRows = useMemo(() => {
    const map = new Map<
      string,
      Pick<SetupPlanPreviewRow, "skladova_polozka_id" | "nazev" | "pozice" | "vysledneMnozstvi">
    >();

    for (const row of selectedSetupPlanRows) {
      const current = map.get(row.skladova_polozka_id);
      if (current) {
        current.vysledneMnozstvi += row.vysledneMnozstvi;
      } else {
        map.set(row.skladova_polozka_id, {
          skladova_polozka_id: row.skladova_polozka_id,
          nazev: row.nazev,
          pozice: row.pozice,
          vysledneMnozstvi: row.vysledneMnozstvi,
        });
      }
    }

    return [...map.values()].sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));
  }, [selectedSetupPlanRows]);

  const manualPlanRows = useMemo(() => {
    return manualPlanItems
      .map((item) => {
        const polozka = skladPolozkaMap.get(item.skladova_polozka_id);
        const quantity = toNumber(item.mnozstvi);
        if (!polozka || quantity <= 0) return null;

        return {
          skladova_polozka_id: polozka.skladova_polozka_id,
          nazev: polozka.nazev,
          pozice: polozka.pozice,
          vysledneMnozstvi: quantity,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [manualPlanItems, skladPolozkaMap]);

  const aggregatedPlanRows = useMemo(() => {
    const map = new Map<string, AggregatedPlanRow>();

    for (const row of aggregatedSetupPlanRows) {
      map.set(row.skladova_polozka_id, {
        skladova_polozka_id: row.skladova_polozka_id,
        nazev: row.nazev,
        pozice: row.pozice,
        setupMnozstvi: row.vysledneMnozstvi,
        manualMnozstvi: 0,
        vysledneMnozstvi: row.vysledneMnozstvi,
      });
    }

    for (const row of manualPlanRows) {
      const current = map.get(row.skladova_polozka_id);
      if (current) {
        current.manualMnozstvi += row.vysledneMnozstvi;
        current.vysledneMnozstvi += row.vysledneMnozstvi;
      } else {
        map.set(row.skladova_polozka_id, {
          skladova_polozka_id: row.skladova_polozka_id,
          nazev: row.nazev,
          pozice: row.pozice,
          setupMnozstvi: 0,
          manualMnozstvi: row.vysledneMnozstvi,
          vysledneMnozstvi: row.vysledneMnozstvi,
        });
      }
    }

    return [...map.values()].sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));
  }, [aggregatedSetupPlanRows, manualPlanRows]);

  const selectedSetupCount = useMemo(
    () => Object.values(setupSelections).filter((selection) => selection.selected).length,
    [setupSelections]
  );

  function renderCategorySetups(category: SetupCategoryKey) {
    const categorySetups = getCategorySetups(category);

    if (setupyLoading) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
          Načítám skladové setupy...
        </div>
      );
    }

    if (setupyError) {
      return (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          Chyba načtení setupů: {setupyError}
        </div>
      );
    }

    if (categorySetups.length === 0) return null;

    return (
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div>
          <div className="text-sm font-bold text-white">Skladové setupy pro tuto kategorii</div>
          <div className="mt-1 text-xs text-slate-400">
            Volitelné. Vybrané setupy předvyplní plán techniky po uložení zakázky.
          </div>
        </div>

        <div className="grid gap-2">
          {categorySetups.map((setup) => {
            const selection = setupSelections[setup.setup_id] ?? {
              selected: false,
              quantity: "1",
            };
            const polozky = setupPolozkyBySetup.get(setup.setup_id) ?? [];

            return (
              <div
                key={setup.setup_id}
                className={[
                  "grid gap-3 rounded-xl border px-3 py-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center",
                  selection.selected
                    ? "border-blue-600 bg-blue-950/30"
                    : "border-slate-800 bg-[#0b1324]",
                ].join(" ")}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selection.selected}
                    onChange={(event) =>
                      updateSetupSelection(setup.setup_id, {
                        selected: event.target.checked,
                      })
                    }
                    className="mt-1 h-5 w-5 accent-blue-600"
                  />
                  <span>
                    <span className="block font-bold text-white">{setup.nazev}</span>
                    {setup.popis ? (
                      <span className="mt-1 block text-xs text-slate-400">{setup.popis}</span>
                    ) : null}
                    <span className="mt-1 block text-xs text-slate-500">
                      Položek v setupu: {polozky.length}
                    </span>
                  </span>
                </label>

                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={selection.quantity}
                  onChange={(event) =>
                    updateSetupSelection(setup.setup_id, {
                      quantity: event.target.value,
                    })
                  }
                  disabled={!selection.selected}
                  aria-label={`Množství setupu ${setup.nazev}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function updateRealizace(
    localId: string,
    field: keyof RealizaceForm,
    value: string | number | boolean
  ) {
    setRealizaceList((prev) =>
      prev.map((item) =>
        item.local_id === localId
          ? {
              ...item,
              [field]: value,
              ...(field === "ledKind" && value === "p6_4_mantel"
                ? { ledRohy: false }
                : {}),
            }
          : item
      )
    );
  }

  function hasTechSectionValues(realizace: RealizaceForm, section: TechSectionKey) {
    if (section === "stage") {
      return Boolean(realizace.stagePreset || realizace.stageWidth || realizace.stageDepth);
    }

    if (section === "sound") return Boolean(realizace.soundPreset);
    if (section === "lights") return Boolean(realizace.lightsPreset);
    if (section === "led") {
      return Boolean(realizace.ledKind || realizace.ledWidth || realizace.ledHeight || realizace.ledRohy);
    }

    return realizace.kamery > 0;
  }

  function isTechSectionActive(realizace: RealizaceForm, section: TechSectionKey) {
    return Boolean(activeTechSections[realizace.local_id]?.[section] || hasTechSectionValues(realizace, section));
  }

  function setTechSectionActive(localId: string, section: TechSectionKey, active: boolean) {
    setActiveTechSections((prev) => ({
      ...prev,
      [localId]: {
        ...(prev[localId] ?? {}),
        [section]: active,
      },
    }));

    if (active) return;

    setRealizaceList((prev) =>
      prev.map((item) => {
        if (item.local_id !== localId) return item;

        if (section === "stage") {
          return { ...item, stagePreset: "", stageWidth: "", stageDepth: "" };
        }

        if (section === "sound") return { ...item, soundPreset: "" };
        if (section === "lights") return { ...item, lightsPreset: "" };
        if (section === "led") {
          return { ...item, ledKind: "", ledWidth: "", ledHeight: "", ledRohy: false };
        }

        return { ...item, kamery: 0 };
      })
    );
  }

  function updateStagePreset(localId: string, preset: string) {
    setActiveTechSections((prev) => ({
      ...prev,
      [localId]: {
        ...(prev[localId] ?? {}),
        stage: true,
      },
    }));

    const dimensions = STAGE_PRESET_DIMENSIONS[preset];
    setRealizaceList((prev) =>
      prev.map((item) =>
        item.local_id === localId
          ? {
              ...item,
              stagePreset: preset,
              ...(dimensions ? { stageWidth: dimensions.width, stageDepth: dimensions.depth } : {}),
            }
          : item
      )
    );
  }

  function matchesSetupCategory(setup: SkladSetup, category: SetupCategoryKey) {
    const haystack = `${setup.nazev} ${setup.popis ?? ""}`
      .toLocaleLowerCase("cs-CZ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return SETUP_CATEGORY_KEYWORDS[category].some((keyword) =>
      haystack.includes(
        keyword
          .toLocaleLowerCase("cs-CZ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      )
    );
  }

  function getCategorySetups(category: SetupCategoryKey) {
    return setupy.filter((setup) => matchesSetupCategory(setup, category));
  }

  function addRealizace() {
    setRealizaceList((prev) => [...prev, createRealizace(prev.length)]);
  }

  function removeRealizace(localId: string) {
    setRealizaceList((prev) => {
      if (prev.length <= 1) return prev;

      const next = prev.filter((item) => item.local_id !== localId);
      return next.map((item, index) => ({
        ...item,
        nazev:
          item.nazev.trim() === "" || item.nazev.startsWith("Stage ")
            ? `Stage ${index + 1}`
            : item.nazev,
      }));
    });
  }

  function updateSetupSelection(setupId: string, patch: Partial<SetupSelection>) {
    setSetupSelections((prev) => {
      const current = prev[setupId] ?? { selected: false, quantity: "1" };
      return {
        ...prev,
        [setupId]: {
          ...current,
          ...patch,
          quantity: patch.quantity ?? current.quantity,
        },
      };
    });
  }

  function getSkladPolozkaMeta(polozka: SkladPolozka | null | undefined) {
    return {
      okruh: polozka?.sklad_blok_id
        ? (skladBlokMap.get(polozka.sklad_blok_id)?.nazev ?? "—")
        : "—",
      kategorie: polozka?.kategorie_techniky_id
        ? (kategorieMap.get(polozka.kategorie_techniky_id)?.nazev ?? "—")
        : "—",
      podkategorie: polozka?.podkategorie_techniky_id
        ? (podkategorieMap.get(polozka.podkategorie_techniky_id)?.nazev ?? "—")
        : "—",
      pozice: formatPosition(polozka?.pozice),
    };
  }

  function addManualPlanItem() {
    setManualPlanItems((prev) => [...prev, createManualPlanItem()]);
  }

  function updateManualPlanItem(
    localId: string,
    field: keyof Pick<ManualPlanItem, "skladova_polozka_id" | "mnozstvi">,
    value: string
  ) {
    setManualPlanItems((prev) =>
      prev.map((item) =>
        item.local_id === localId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function removeManualPlanItem(localId: string) {
    setManualPlanItems((prev) => prev.filter((item) => item.local_id !== localId));
  }

  async function checkAvailability(akceOd: string, akceDo: string) {
    if (aggregatedPlanRows.length === 0) return [];

    const response = await fetch("/api/technika-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: akceOd,
        to: akceDo,
        items: aggregatedPlanRows.map((row) => ({
          skladova_polozka_id: row.skladova_polozka_id,
          requestedQuantity: row.vysledneMnozstvi,
        })),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Dostupnost techniky se nepodařilo spočítat.");
    }

    return (payload.items ?? [])
      .filter((item: any) => item.hasCollision)
      .map((item: any) => ({
        skladova_polozka_id: item.skladova_polozka_id,
        nazev: item.nazev ?? "Technika",
        pozadovano: toNumber(item.requestedQuantity),
        celkemSkladem: toNumber(item.totalPieces),
        planovanoKolize: toNumber(item.plannedOnOtherOverlappingZakazky),
        nedostupneKusy:
          toNumber(item.damagedPieces) +
          toNumber(item.blockedPieces) +
          toNumber(item.repairPieces) +
          toNumber(item.pendingCheckPieces) +
          toNumber(item.retiredPieces),
        fyzickyNalozenoJinde: toNumber(item.physicallyLoadedOnOtherZakazky),
        rezervyJinde: toNumber(item.reservePiecesOnOtherZakazky),
        dostupne: toNumber(item.availableQuantity),
        chybi: toNumber(item.missingQuantity),
      }));
  }

  async function vygenerovatCisloZakazky() {
    const rok = new Date().getFullYear();

    const { data, error } = await supabase
      .from("zakazky")
      .select("cislo_zakazky")
      .like("cislo_zakazky", `${rok}/%`)
      .order("cislo_zakazky", { ascending: false })
      .limit(1);

    if (error) throw error;

    let dalsiPoradi = 1;

    if (data && data.length > 0) {
      const posledni = data[0].cislo_zakazky;
      const casti = posledni.split("/");
      const posledniPoradi = parseInt(casti[1], 10);

      if (!isNaN(posledniPoradi)) {
        dalsiPoradi = posledniPoradi + 1;
      }
    }

    return `${rok}/${String(dalsiPoradi).padStart(3, "0")}`;
  }

  async function ulozit(forceAvailabilityWarning = false) {
    if (ukladam) return;

    if (!nazev || !misto || !akceOdDatum || !akceDoDatum) {
      showError("Vyplň název, místo, akce od a akce do.");
      return;
    }

    const odjezdZeSkladu = combineDateAndTime(odjezdZeSkladuDatum, odjezdZeSkladuCas);
    const srazNaMiste = combineDateAndTime(srazNaMisteDatum, srazNaMisteCas);

    const stavbaOd = combineDateAndTime(stavbaOdDatum, stavbaOdCas);
    const stavbaDo = combineDateAndTime(stavbaDoDatum, stavbaDoCas);

    const akceOd = combineDateAndTime(akceOdDatum, akceOdCas);
    const akceDo = combineDateAndTime(akceDoDatum, akceDoCas);

    const bouraniOd = combineDateAndTime(bouraniOdDatum, bouraniOdCas);
    const bouraniDo = combineDateAndTime(bouraniDoDatum, bouraniDoCas);

    if (!akceOd || !akceDo) {
      showError("Vyplň začátek a konec akce.");
      return;
    }

    if (new Date(akceOd).getTime() >= new Date(akceDo).getTime()) {
      showError("Konec akce musí být později než začátek akce.");
      return;
    }

    if (typObsluhy === "bez_obsluhy") {
      if (!stavbaOd || !stavbaDo || !bouraniOd || !bouraniDo) {
        showError("U zakázky bez obsluhy je povinná stavba i bourání.");
        return;
      }
    }

    if (stavbaOd && stavbaDo && new Date(stavbaOd).getTime() >= new Date(stavbaDo).getTime()) {
      showError("Konec stavby musí být později než začátek stavby.");
      return;
    }

    if (bouraniOd && bouraniDo && new Date(bouraniOd).getTime() >= new Date(bouraniDo).getTime()) {
      showError("Konec bourání musí být později než začátek bourání.");
      return;
    }

    const realizaceKeKontrole = realizaceList.filter(
      (item, index) => index === 0 || !isRealizaceEffectivelyEmpty(item)
    );

    for (const item of realizaceKeKontrole) {
      const ledWidthNumber = item.ledWidth ? Number(item.ledWidth.replace(",", ".")) : 0;
      const ledHeightNumber = item.ledHeight ? Number(item.ledHeight.replace(",", ".")) : 0;
      const ledRequestedArea =
        ledWidthNumber > 0 && ledHeightNumber > 0
          ? Number((ledWidthNumber * ledHeightNumber).toFixed(2))
          : null;
      const ledMaxArea = getLedMaxArea(item.ledKind);

      if (item.ledKind) {
        if (!item.ledWidth || !item.ledHeight) {
          showError(`U ${item.nazev} vyplň šířku i výšku LED.`);
          return;
        }

        if (!ledRequestedArea || ledRequestedArea <= 0) {
          showError(`LED plocha u ${item.nazev} musí být větší než 0.`);
          return;
        }

        if (ledMaxArea && ledRequestedArea > ledMaxArea) {
          showError(
            `Požadovaná LED plocha ${ledRequestedArea} m² překračuje maximum ${ledMaxArea} m² pro ${getLedKindLabel(item.ledKind)} u ${item.nazev}.`
          );
          return;
        }
      }
    }

    try {
      setUkladam(true);
      const shouldAppendAvailabilityWarning =
        forceAvailabilityWarning && availabilityConflicts.length > 0;
      setAvailabilityConflicts([]);

      if (!forceAvailabilityWarning) {
        const conflicts = await checkAvailability(akceOd, akceDo);
        if (conflicts.length > 0) {
          setAvailabilityConflicts(conflicts);
          setUkladam(false);
          return;
        }
      }

      const cisloZakazky = await vygenerovatCisloZakazky();
      const prvniRealizace = realizaceList[0];
      const finalPoznamka =
        shouldAppendAvailabilityWarning
          ? [poznamka.trim(), AVAILABILITY_WARNING_NOTE].filter(Boolean).join("\n")
          : poznamka.trim();

      const prvniLedWidthNumber = prvniRealizace.ledWidth
        ? Number(prvniRealizace.ledWidth.replace(",", "."))
        : 0;
      const prvniLedHeightNumber = prvniRealizace.ledHeight
        ? Number(prvniRealizace.ledHeight.replace(",", "."))
        : 0;
      const prvniLedRequestedArea =
        prvniLedWidthNumber > 0 && prvniLedHeightNumber > 0
          ? Number((prvniLedWidthNumber * prvniLedHeightNumber).toFixed(2))
          : null;
      const mistoLat = toOptionalNumber(mistoGps.lat);
      const mistoLng = toOptionalNumber(mistoGps.lng);
      const mistoGpsRadius = toOptionalNumber(mistoGps.radiusM) ?? 300;
      const mistoGpsPresnost = toOptionalNumber(mistoGps.accuracyM);
      let klientId = selectedKlientId || null;
      let mistoId = selectedMistoId || null;
      let createdMistoId: string | null = null;

      async function cleanupPartialCreate(zakazkaId?: string | null) {
        if (zakazkaId) {
          await supabase.from("zakazky").delete().eq("zakazka_id", zakazkaId);
        }
        if (createdMistoId) {
          await supabase.from("mista_konani").delete().eq("misto_id", createdMistoId);
        }
      }

      if (!mistoId && misto.trim() && mistoLat != null && mistoLng != null) {
        const { data: mistoData, error: mistoError } = await supabase
          .from("mista_konani")
          .insert({
            klient_id: klientId,
            nazev: misto,
            adresa_text: misto,
            lat: mistoLat,
            lng: mistoLng,
            radius_m: mistoGpsRadius,
          })
          .select("misto_id")
          .single();

        if (mistoError) {
          showError(mistoError.message);
          setUkladam(false);
          return;
        }

        mistoId = mistoData.misto_id;
        createdMistoId = mistoData.misto_id;
      }

      const { data, error } = await supabase
        .from("zakazky")
        .insert({
          cislo_zakazky: cisloZakazky,
          stav_zakazky_id: "7a0e168f-216f-40bd-b33e-3f1f517620da",
          nazev,
          klient_id: klientId,
          fakturacni_firma_id: selectedFakturacniFirmaId || null,
          misto_id: mistoId,
          misto,
          misto_lat: mistoLat,
          misto_lng: mistoLng,
          misto_gps_radius_m: mistoGpsRadius,
          misto_gps_presnost_m: mistoGpsPresnost,
          misto_gps_zdroj:
            mistoLat != null && mistoLng != null ? mistoGps.source || "manual" : null,
          misto_gps_updated_at:
            mistoLat != null && mistoLng != null
              ? mistoGps.updatedAt || new Date().toISOString()
              : null,
          typ_obsluhy: typObsluhy,

          odjezd_ze_skladu: odjezdZeSkladu,
          sraz_na_miste: srazNaMiste,

          stavba_od: stavbaOd,
          stavba_do: stavbaDo,
          akce_od: akceOd,
          akce_do: akceDo,
          bourani_od: bouraniOd,
          bourani_do: bouraniDo,

          datum_od: deriveLegacyDate(akceOd),
          datum_do: deriveLegacyDate(akceDo),
          cas_od: deriveLegacyTime(akceOd),
          cas_do: deriveLegacyTime(akceDo),

          stage_preset: prvniRealizace.stagePreset || null,
          stage_width_m: prvniRealizace.stageWidth
            ? Number(prvniRealizace.stageWidth.replace(",", "."))
            : null,
          stage_depth_m: prvniRealizace.stageDepth
            ? Number(prvniRealizace.stageDepth.replace(",", "."))
            : null,

          sound_preset: prvniRealizace.soundPreset || null,
          lights_preset: prvniRealizace.lightsPreset || null,

          led_kind: prvniRealizace.ledKind || null,
          led_width_m: prvniRealizace.ledWidth
            ? Number(prvniRealizace.ledWidth.replace(",", "."))
            : null,
          led_height_m: prvniRealizace.ledHeight
            ? Number(prvniRealizace.ledHeight.replace(",", "."))
            : null,
          led_requested_area_m2: prvniLedRequestedArea,
          led_wall_rohy:
            prvniRealizace.ledKind === "p6_4_mantel" ? false : prvniRealizace.ledRohy,
          led_is_mantel: prvniRealizace.ledKind === "p6_4_mantel",

          kamery_count: prvniRealizace.kamery,
          dron: prvniRealizace.dron,

          poznamka: finalPoznamka || null,
        })
        .select("zakazka_id")
        .single();

      if (error) {
        await cleanupPartialCreate(null);
        showError(error.message);
        setUkladam(false);
        return;
      }

      const zakazkaId = data.zakazka_id;

      await supabase
        .from("zakazka_realizace")
        .delete()
        .eq("zakazka_id", zakazkaId);

      const realizaceNaUlozeni = realizaceList.filter(
        (item, index) => index === 0 || !isRealizaceEffectivelyEmpty(item)
      );

      if (realizaceNaUlozeni.length > 0) {
        const payload = realizaceNaUlozeni.map((item, index) => {
          const ledWidthNumber = item.ledWidth ? Number(item.ledWidth.replace(",", ".")) : null;
          const ledHeightNumber = item.ledHeight ? Number(item.ledHeight.replace(",", ".")) : null;

          return {
            zakazka_id: zakazkaId,
            nazev: item.nazev || `Stage ${index + 1}`,
            poradi: index + 1,
            stage_typ: item.stagePreset || null,
            stage_sirka: item.stageWidth ? Number(item.stageWidth.replace(",", ".")) : null,
            stage_hloubka: item.stageDepth ? Number(item.stageDepth.replace(",", ".")) : null,
            sound_typ: item.soundPreset || null,
            lights_typ: item.lightsPreset || null,
            led_typ: item.ledKind || null,
            led_sirka: ledWidthNumber,
            led_vyska: ledHeightNumber,
            led_rohy: item.ledKind === "p6_4_mantel" ? false : item.ledRohy,
            kamery: item.kamery,
            dron: item.dron,
          };
        });

        const { error: realizaceError } = await supabase
          .from("zakazka_realizace")
          .insert(payload);

        if (realizaceError) {
          await cleanupPartialCreate(zakazkaId);
          showError(realizaceError.message);
          setUkladam(false);
          return;
        }
      }

      if (aggregatedPlanRows.length > 0) {
        const technikaPayload = aggregatedPlanRows.map((row) => ({
          zakazka_id: zakazkaId,
          skladova_polozka_id: row.skladova_polozka_id,
          mnozstvi: row.vysledneMnozstvi,
        }));

        const { error: technikaError } = await supabase
          .from("technika_na_zakazce")
          .insert(technikaPayload);

        if (technikaError) {
          await cleanupPartialCreate(zakazkaId);
          showError(technikaError.message);
          setUkladam(false);
          return;
        }
      }

      router.push(`/zakazky/${zakazkaId}`);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Neznámá chyba";
      showError(message);
      setUkladam(false);
    }
  }

  return (
    <div className="w-full">
      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}

      {availabilityConflicts.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border-2 border-amber-500 bg-slate-950 p-5 shadow-2xl shadow-amber-950/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-amber-300">
                  Upozornění dostupnosti
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Některé položky překračují dostupné množství
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Zakázku můžeš přesto uložit. Do poznámky se doplní informace, že
                  chybějící položky je potřeba půjčit nebo doplnit externě.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {availabilityConflicts.map((conflict) => (
                <section
                  key={conflict.skladova_polozka_id}
                  className="rounded-2xl border border-amber-900/70 bg-amber-950/30 p-4"
                >
                  <div className="text-lg font-black text-white">{conflict.nazev}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-8">
                    <div className="rounded-xl bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Požadováno</div>
                      <div className="font-black text-white">{formatNumber(conflict.pozadovano)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Celkem sklad</div>
                      <div className="font-black text-white">{formatNumber(conflict.celkemSkladem)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Plán kolize</div>
                      <div className="font-black text-white">{formatNumber(conflict.planovanoKolize)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Poškoz./blok.</div>
                      <div className="font-black text-white">{formatNumber(conflict.nedostupneKusy)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Fyzicky jinde</div>
                      <div className="font-black text-white">{formatNumber(conflict.fyzickyNalozenoJinde)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Rezervy</div>
                      <div className="font-black text-white">{formatNumber(conflict.rezervyJinde)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Dostupné</div>
                      <div className="font-black text-white">{formatNumber(conflict.dostupne)}</div>
                    </div>
                    <div className="rounded-xl border border-red-800 bg-red-950 p-3">
                      <div className="text-xs text-red-300">Chybí</div>
                      <div className="font-black text-red-100">{formatNumber(conflict.chybi)}</div>
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => setAvailabilityConflicts([])}
                disabled={ukladam}
              >
                Zpět upravit
              </Button>
              <Button onClick={() => void ulozit(true)} disabled={ukladam}>
                {ukladam ? "Ukládám..." : "Přesto uložit"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader
        title="Nová zakázka"
        description="Vyplň základní informace, logistiku, časové bloky a basic look."
      />

      <Card>
        <div className="grid gap-6">
          <Field label="Název akce">
            <Input
              value={nazev}
              onChange={(e) => setNazev(e.target.value)}
              placeholder="Např. Den bezpečnostních sborů"
            />
          </Field>

          <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
            <div>
              <div className="text-lg font-semibold text-white">Klient</div>
              <div className="mt-1 text-sm text-slate-400">
                Základní vazba pro budoucí archiv zakázek. Fakturace se zatím neřeší.
              </div>
            </div>

            {klientiMistaError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                Klienty a místa se nepodařilo načíst: {klientiMistaError}
              </div>
            ) : null}

            <KlientSelectWithCreate
              clients={klienti}
              selectedId={selectedKlientId}
              onSelectedIdChange={setSelectedKlientId}
              onClientCreated={(klient) => {
                setKlienti((current) => [...current, klient]);
                setSelectedKlientId(klient.klient_id);
              }}
            />
          </Card>

          <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
            <div>
              <div className="text-lg font-semibold text-white">Fakturace</div>
              <div className="mt-1 text-sm text-slate-400">
                Vyber firmu, která bude uvedená jako dodavatel na dokladu k zakázce.
              </div>
            </div>
            <Field label="Fakturuje firma">
              <FakturacniFirmaSelect
                firmy={fakturacniFirmy}
                value={selectedFakturacniFirmaId}
                onChange={setSelectedFakturacniFirmaId}
              />
            </Field>
          </Card>

          <Field label="Místo">
            <Input
              value={misto}
              onChange={(e) => {
                setMisto(e.target.value);
                setSelectedMistoId("");
              }}
              placeholder="Např. Bečov"
            />
          </Field>

          <GpsLocationFields
            placeText={misto}
            savedPlaces={mistaKonani}
            onSavedPlaceSelect={handleSavedPlaceSelect}
            onSavedPlaceClear={() => setSelectedMistoId("")}
            onChange={setMistoGps}
          />

          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            Nové místo s vybraným bodem se uloží automaticky.
          </div>

          <Field label="Typ obsluhy">
            <select
              value={typObsluhy}
              onChange={(e) => setTypObsluhy(e.target.value as TypObsluhy)}
              className={selectClassName}
              style={selectChevronStyle}
            >
              <option value="s_obsluhou">S obsluhou</option>
              <option value="bez_obsluhy">Bez obsluhy</option>
            </select>
          </Field>

          <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
            <div>
              <div className="text-lg font-semibold text-white">Logistika</div>
              <div className="mt-1 text-sm text-slate-400">
                Volitelné referenční časy pro odjezd a sraz.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Odjezd ze skladu – datum">
                <PickerInput
                  type="date"
                  value={odjezdZeSkladuDatum}
                  onChange={(e) => setOdjezdZeSkladuDatum(e.target.value)}
                />
              </Field>

              <Field label="Odjezd ze skladu – čas">
                <PickerInput
                  type="time"
                  value={odjezdZeSkladuCas}
                  onChange={(e) => setOdjezdZeSkladuCas(e.target.value)}
                />
              </Field>

              <Field label="Sraz na místě – datum">
                <PickerInput
                  type="date"
                  value={srazNaMisteDatum}
                  onChange={(e) => setSrazNaMisteDatum(e.target.value)}
                />
              </Field>

              <Field label="Sraz na místě – čas">
                <PickerInput
                  type="time"
                  value={srazNaMisteCas}
                  onChange={(e) => setSrazNaMisteCas(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
            <div>
              <div className="text-lg font-semibold text-white">Stavba před akcí</div>
              <div className="mt-1 text-sm text-slate-400">
                {typObsluhy === "bez_obsluhy"
                  ? "Povinné pro zakázku bez obsluhy."
                  : "Volitelné. Vyplň jen pokud stavba probíhá mimo hlavní blok akce."}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Stavba od – datum">
                <PickerInput
                  type="date"
                  value={stavbaOdDatum}
                  onChange={(e) => setStavbaOdDatum(e.target.value)}
                />
              </Field>

              <Field label="Stavba od – čas">
                <PickerInput
                  type="time"
                  value={stavbaOdCas}
                  onChange={(e) => setStavbaOdCas(e.target.value)}
                />
              </Field>

              <Field label="Stavba do – datum">
                <PickerInput
                  type="date"
                  value={stavbaDoDatum}
                  onChange={(e) => setStavbaDoDatum(e.target.value)}
                />
              </Field>

              <Field label="Stavba do – čas">
                <PickerInput
                  type="time"
                  value={stavbaDoCas}
                  onChange={(e) => setStavbaDoCas(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
            <div>
              <div className="text-lg font-semibold text-white">V den akce</div>
              <div className="mt-1 text-sm text-slate-400">
                Hlavní termín zakázky. Tento blok se propisuje i do původních datum/čas polí.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Akce od – datum">
                <PickerInput
                  type="date"
                  value={akceOdDatum}
                  onChange={(e) => setAkceOdDatum(e.target.value)}
                />
              </Field>

              <Field label="Akce od – čas">
                <PickerInput
                  type="time"
                  value={akceOdCas}
                  onChange={(e) => setAkceOdCas(e.target.value)}
                />
              </Field>

              <Field label="Akce do – datum">
                <PickerInput
                  type="date"
                  value={akceDoDatum}
                  onChange={(e) => setAkceDoDatum(e.target.value)}
                />
              </Field>

              <Field label="Akce do – čas">
                <PickerInput
                  type="time"
                  value={akceDoCas}
                  onChange={(e) => setAkceDoCas(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4 border-slate-700 bg-[#0b1324]">
            <div>
              <div className="text-lg font-semibold text-white">Bourání</div>
              <div className="mt-1 text-sm text-slate-400">
                {typObsluhy === "bez_obsluhy"
                  ? "Povinné pro zakázku bez obsluhy."
                  : "Volitelné. Vyplň jen pokud bourání probíhá jako samostatný blok."}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Bourání od – datum">
                <PickerInput
                  type="date"
                  value={bouraniOdDatum}
                  onChange={(e) => setBouraniOdDatum(e.target.value)}
                />
              </Field>

              <Field label="Bourání od – čas">
                <PickerInput
                  type="time"
                  value={bouraniOdCas}
                  onChange={(e) => setBouraniOdCas(e.target.value)}
                />
              </Field>

              <Field label="Bourání do – datum">
                <PickerInput
                  type="date"
                  value={bouraniDoDatum}
                  onChange={(e) => setBouraniDoDatum(e.target.value)}
                />
              </Field>

              <Field label="Bourání do – čas">
                <PickerInput
                  type="time"
                  value={bouraniDoCas}
                  onChange={(e) => setBouraniDoCas(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="space-y-6 border-slate-700 bg-[#0b1324]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Technika</div>
                <div className="mt-1 text-sm text-slate-400">
                  Vyber jen kategorie, které zakázka opravdu potřebuje. Ostatní části zůstanou skryté.
                </div>
              </div>

              <Button variant="secondary" onClick={addRealizace}>
                + Přidat stage
              </Button>
            </div>

            <div className="grid gap-6">
              {realizaceList.map((realizace, index) => {
                const ledWidthNumber = realizace.ledWidth
                  ? Number(realizace.ledWidth.replace(",", "."))
                  : 0;
                const ledHeightNumber = realizace.ledHeight
                  ? Number(realizace.ledHeight.replace(",", "."))
                  : 0;
                const ledRequestedArea =
                  ledWidthNumber > 0 && ledHeightNumber > 0
                    ? Number((ledWidthNumber * ledHeightNumber).toFixed(2))
                    : null;
                const ledMaxArea = getLedMaxArea(realizace.ledKind);
                const isLedOverLimit = Boolean(
                  ledRequestedArea && ledMaxArea && ledRequestedArea > ledMaxArea
                );
                const stageActive = isTechSectionActive(realizace, "stage");
                const soundActive = isTechSectionActive(realizace, "sound");
                const lightsActive = isTechSectionActive(realizace, "lights");
                const ledActive = isTechSectionActive(realizace, "led");
                const kameryActive = isTechSectionActive(realizace, "kamery");

                return (
                  <Card
                    key={realizace.local_id}
                    className="space-y-6 border-slate-700 bg-slate-950/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Field label={`Název realizace ${index + 1}`}>
                        <Input
                          value={realizace.nazev}
                          onChange={(e) =>
                            updateRealizace(realizace.local_id, "nazev", e.target.value)
                          }
                          placeholder={`Stage ${index + 1}`}
                        />
                      </Field>

                      {realizaceList.length > 1 ? (
                        <div className="pt-7">
                          <Button
                            variant="secondary"
                            onClick={() => removeRealizace(realizace.local_id)}
                          >
                            Odebrat stage
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["stage", "Stage"],
                        ["sound", "Sound"],
                        ["lights", "Lights"],
                        ["led", "LED / mantinel"],
                        ["kamery", "Kamery"],
                      ].map(([section, label]) => {
                        const key = section as TechSectionKey;
                        const active = isTechSectionActive(realizace, key);

                        return (
                          <label
                            key={section}
                            className={[
                              "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-black transition",
                              active
                                ? "border-blue-500 bg-blue-600/20 text-white"
                                : "border-slate-700 bg-[#0b1324] text-slate-300 hover:bg-slate-900",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={(event) =>
                                setTechSectionActive(realizace.local_id, key, event.target.checked)
                              }
                              className="h-5 w-5 accent-blue-600"
                            />
                            {label}
                          </label>
                        );
                      })}

                      <label
                        className={[
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-black transition",
                          realizace.dron
                            ? "border-blue-500 bg-blue-600/20 text-white"
                            : "border-slate-700 bg-[#0b1324] text-slate-300 hover:bg-slate-900",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={realizace.dron}
                          onChange={(event) =>
                            updateRealizace(realizace.local_id, "dron", event.target.checked)
                          }
                          className="h-5 w-5 accent-blue-600"
                        />
                        Dron
                      </label>
                    </div>

                    {!stageActive && !soundActive && !lightsActive && !ledActive && !kameryActive && !realizace.dron ? (
                      <div className="rounded-xl border border-dashed border-slate-700 bg-[#0b1324] px-4 py-4 text-sm text-slate-400">
                        Technika je zatím prázdná. Zaškrtni kategorii, kterou chceš pro tuto realizaci zadat.
                      </div>
                    ) : null}

                    <div className="grid gap-4">
                      {stageActive ? (
                      <Card className="border-slate-700 bg-[#0b1324]">
                        <div className="space-y-4">
                          <div className="text-base font-semibold text-white">Stage</div>

                          <Field label="Setup stage">
                            <select
                              value={realizace.stagePreset}
                              onChange={(e) =>
                                updateStagePreset(realizace.local_id, e.target.value)
                              }
                              className={selectClassName}
                              style={selectChevronStyle}
                            >
                              <option value="">—</option>
                              <option value="mala">Malý setup</option>
                              <option value="stredni">Střední setup</option>
                              <option value="velka">Velký setup</option>
                              <option value="vlastni">Vlastní</option>
                            </select>
                          </Field>

                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Šířka stage (m)">
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                min="0"
                                value={realizace.stageWidth}
                                onChange={(e) =>
                                  updateRealizace(realizace.local_id, "stageWidth", e.target.value)
                                }
                                placeholder="Např. 10"
                              />
                            </Field>

                            <Field label="Hloubka stage (m)">
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                min="0"
                                value={realizace.stageDepth}
                                onChange={(e) =>
                                  updateRealizace(realizace.local_id, "stageDepth", e.target.value)
                                }
                                placeholder="Např. 8"
                              />
                            </Field>
                          </div>
                          {renderCategorySetups("stage")}
                        </div>
                      </Card>
                      ) : null}

                      {soundActive || lightsActive ? (
                      <Card className="border-slate-700 bg-[#0b1324]">
                        <div className="space-y-4">
                          <div className="text-base font-semibold text-white">
                            {[soundActive ? "Sound" : "", lightsActive ? "Lights" : ""]
                              .filter(Boolean)
                              .join(" / ")}
                          </div>

                          {soundActive ? (
                          <>
                          <Field label="Sound">
                            <select
                              value={realizace.soundPreset}
                              onChange={(e) =>
                                updateRealizace(realizace.local_id, "soundPreset", e.target.value)
                              }
                              className={selectClassName}
                              style={selectChevronStyle}
                            >
                              <option value="">—</option>
                              <option value="mala">Malý setup</option>
                              <option value="stredni">Střední setup</option>
                              <option value="velka">Velký setup</option>
                              <option value="vlastni">Vlastní</option>
                            </select>
                          </Field>
                          {renderCategorySetups("sound")}
                          </>
                          ) : null}

                          {lightsActive ? (
                          <>
                          <Field label="Lights">
                            <select
                              value={realizace.lightsPreset}
                              onChange={(e) =>
                                updateRealizace(realizace.local_id, "lightsPreset", e.target.value)
                              }
                              className={selectClassName}
                              style={selectChevronStyle}
                            >
                              <option value="">—</option>
                              <option value="mala">Malý setup</option>
                              <option value="stredni">Střední setup</option>
                              <option value="velka">Velký setup</option>
                              <option value="vlastni">Vlastní</option>
                            </select>
                          </Field>
                          {renderCategorySetups("lights")}
                          </>
                          ) : null}
                        </div>
                      </Card>
                      ) : null}
                    </div>

                    {ledActive || kameryActive ? (
                    <Card className="border-slate-700 bg-[#0b1324]">
                      <div className="space-y-4">
                        <div className="text-base font-semibold text-white">
                          {[ledActive ? "LED / mantinel" : "", kameryActive ? "Kamery" : ""]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>

                        {ledActive ? (
                        <>
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                          <Field label="Typ LED / mantinelu">
                            <select
                              value={realizace.ledKind}
                              onChange={(e) =>
                                updateRealizace(realizace.local_id, "ledKind", e.target.value)
                              }
                              className={selectClassName}
                              style={selectChevronStyle}
                            >
                              <option value="">—</option>
                              <option value="p2_indoor">P2 – 24,5 m² indoor</option>
                              <option value="p2_6_outdoor">P2,6 – 17,5 m² outdoor</option>
                              <option value="p3_9_outdoor">P3,9 – 45 m² outdoor</option>
                              <option value="p4_8_outdoor">P4,8 – 22,5 m² outdoor</option>
                              <option value="p6_4_mantel">P6,4 – mantinel – 21 m běžných (22 ks)</option>
                            </select>
                          </Field>

                          <div className="pb-3">
                            <label
                              className={`flex items-center gap-2 whitespace-nowrap ${
                                realizace.ledKind === "p6_4_mantel"
                                  ? "text-slate-500"
                                  : "text-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  realizace.ledKind === "p6_4_mantel" ? false : realizace.ledRohy
                                }
                                onChange={(e) =>
                                  updateRealizace(realizace.local_id, "ledRohy", e.target.checked)
                                }
                                disabled={realizace.ledKind === "p6_4_mantel"}
                              />
                              Rohy
                            </label>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Field
                            label={
                              realizace.ledKind === "p6_4_mantel"
                                ? "Délka mantinelu (m)"
                                : "Šířka LED (m)"
                            }
                          >
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="0"
                              value={realizace.ledWidth}
                              onChange={(e) =>
                                updateRealizace(realizace.local_id, "ledWidth", e.target.value)
                              }
                              placeholder={
                                realizace.ledKind === "p6_4_mantel" ? "Např. 21" : "Např. 7"
                              }
                            />
                          </Field>

                          <Field
                            label={
                              realizace.ledKind === "p6_4_mantel"
                                ? "Výška mantinelu (m)"
                                : "Výška LED (m)"
                            }
                          >
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="0"
                              value={realizace.ledHeight}
                              onChange={(e) =>
                                updateRealizace(realizace.local_id, "ledHeight", e.target.value)
                              }
                              placeholder={
                                realizace.ledKind === "p6_4_mantel" ? "Např. 1" : "Např. 3,5"
                              }
                            />
                          </Field>
                        </div>

                        <div
                          className={`text-sm ${
                            isLedOverLimit ? "font-semibold text-red-400" : "text-slate-400"
                          }`}
                        >
                          Požadovaná plocha / rozsah:{" "}
                          {ledRequestedArea ? `${ledRequestedArea} m²` : "—"}
                          {ledMaxArea ? ` / maximum ${ledMaxArea} m²` : ""}
                        </div>
                        {renderCategorySetups("led")}
                        </>
                        ) : null}

                        {kameryActive ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Kamery">
                            <select
                              value={String(realizace.kamery)}
                              onChange={(e) =>
                                updateRealizace(realizace.local_id, "kamery", Number(e.target.value))
                              }
                              className={selectClassName}
                              style={selectChevronStyle}
                            >
                              <option value="0">0</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                            </select>
                          </Field>
                          {renderCategorySetups("kamery")}
                        </div>
                        ) : null}
                      </div>
                    </Card>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </Card>

          <Card className="border-blue-900/50 bg-blue-950/20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold text-blue-100">Plán techniky</div>
                <div className="mt-1 text-sm text-slate-300">
                  Plán techniky se vytvoří podle vybraných sekcí a setupů.
                </div>
              </div>
              <div className="rounded-xl border border-blue-800/60 bg-slate-950 px-4 py-2 text-sm font-bold text-blue-100">
                {selectedSetupCount > 0
                  ? `${selectedSetupCount} vybraných setupů`
                  : "Bez vybraného skladového setupu"}
              </div>
            </div>
          </Card>

          <Card className="hidden space-y-6 border-slate-700 bg-[#0b1324]">
            <div>
              <div className="text-lg font-semibold text-white">Setupy skladu</div>
              <div className="mt-1 text-sm text-slate-400">
                Vyber skladové setupy, ze kterých se po uložení vytvoří plán množství v technice
                zakázky. Konkrétní kusy se vybírají až při fyzické nakládce scanem.
              </div>
            </div>

            {setupyLoading ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm text-slate-400">
                Načítám setupy skladu…
              </div>
            ) : setupyError ? (
              <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-4 text-sm text-red-100">
                Chyba načtení setupů: {setupyError}
              </div>
            ) : setupy.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-400">
                Zatím nejsou vytvořené žádné aktivní skladové setupy.
              </div>
            ) : (
              <div className="grid gap-4">
                {setupy.map((setup) => {
                  const selection = setupSelections[setup.setup_id] ?? {
                    selected: false,
                    quantity: "1",
                  };
                  const setupQuantity = Math.max(toNumber(selection.quantity || 1), 0);
                  const polozky = setupPolozkyBySetup.get(setup.setup_id) ?? [];

                  return (
                    <section
                      key={setup.setup_id}
                      className={[
                        "rounded-2xl border p-4",
                        selection.selected
                          ? "border-blue-700 bg-blue-950/30"
                          : "border-slate-800 bg-slate-950/50",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selection.selected}
                            onChange={(e) =>
                              updateSetupSelection(setup.setup_id, {
                                selected: e.target.checked,
                              })
                            }
                            className="mt-1 h-5 w-5 accent-blue-600"
                          />
                          <span className="min-w-0">
                            <span className="block text-xl font-black text-white">
                              {setup.nazev}
                            </span>
                            {setup.popis ? (
                              <span className="mt-1 block text-sm text-slate-400">
                                {setup.popis}
                              </span>
                            ) : null}
                            <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Položek v setupu: {polozky.length}
                            </span>
                          </span>
                        </label>

                        <Field label="Množství setupu">
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={selection.quantity}
                            onChange={(e) =>
                              updateSetupSelection(setup.setup_id, {
                                quantity: e.target.value,
                              })
                            }
                            disabled={!selection.selected}
                          />
                        </Field>
                      </div>

                      {selection.selected ? (
                        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <div className="mb-3 text-sm font-bold text-slate-200">
                            Preview položek setupu
                          </div>

                          {polozky.length === 0 ? (
                            <div className="text-sm text-slate-500">
                              Tento setup zatím nemá žádné položky.
                            </div>
                          ) : (
                            <div className="grid gap-2">
                              {polozky.map((item) => {
                                const info = getSkladPolozkaInfo(item);
                                const itemQuantity = toNumber(item.mnozstvi);
                                const total = itemQuantity * setupQuantity;

                                return (
                                  <div
                                    key={item.setup_polozka_id}
                                    className="grid gap-2 rounded-xl border border-slate-800 bg-[#0b1324] px-4 py-3 text-sm md:grid-cols-[1fr_120px_140px_120px]"
                                  >
                                    <div>
                                      <div className="font-bold text-white">
                                        {info?.nazev?.trim() || item.skladova_polozka_id}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        Pozice: {formatPosition(info?.pozice)}
                                      </div>
                                    </div>
                                    <div className="text-slate-300">
                                      <span className="text-slate-500">V setupu: </span>
                                      {formatNumber(itemQuantity)}
                                    </div>
                                    <div className="text-slate-300">
                                      <span className="text-slate-500">Počet setupů: </span>
                                      {formatNumber(setupQuantity)}
                                    </div>
                                    <div className="font-black text-blue-100">
                                      {formatNumber(total)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}

            {aggregatedSetupPlanRows.length > 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-bold text-slate-200">
                  Součet ze setupů
                </div>
                <div className="mt-3 grid gap-2">
                  {aggregatedSetupPlanRows.map((row) => (
                    <div
                      key={row.skladova_polozka_id}
                      className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-[#0b1324] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-bold text-white">{row.nazev}</div>
                        <div className="text-xs text-slate-500">
                          Pozice: {formatPosition(row.pozice)}
                        </div>
                      </div>
                      <div className="text-lg font-black text-blue-100">
                        {formatNumber(row.vysledneMnozstvi)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="hidden space-y-6 border-slate-700 bg-[#0b1324]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Další položky mimo setup</div>
                <div className="mt-1 text-sm text-slate-400">
                  Přidej další skladové položky do plánu množství. Stále se nevybírají konkrétní kusy.
                </div>
              </div>

              <Button variant="secondary" onClick={addManualPlanItem} disabled={skladLoading}>
                + Přidat položku
              </Button>
            </div>

            {skladLoading ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm text-slate-400">
                Načítám skladové položky…
              </div>
            ) : skladError ? (
              <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-4 text-sm text-red-100">
                Chyba načtení skladu: {skladError}
              </div>
            ) : manualPlanItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-400">
                Zatím nejsou přidané žádné ruční položky mimo setup.
              </div>
            ) : (
              <div className="grid gap-4">
                {manualPlanItems.map((manualItem) => {
                  const selectedPolozka = skladPolozkaMap.get(manualItem.skladova_polozka_id);
                  const meta = getSkladPolozkaMeta(selectedPolozka);

                  return (
                    <section
                      key={manualItem.local_id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px_auto] lg:items-start">
                        <Field label="Skladová položka">
                          <select
                            value={manualItem.skladova_polozka_id}
                            onChange={(e) =>
                              updateManualPlanItem(
                                manualItem.local_id,
                                "skladova_polozka_id",
                                e.target.value
                              )
                            }
                            className={selectClassName}
                            style={selectChevronStyle}
                          >
                            <option value="">Vyber položku</option>
                            {sortedSkladPolozky.map((polozka) => {
                              const optionMeta = getSkladPolozkaMeta(polozka);

                              return (
                                <option
                                  key={polozka.skladova_polozka_id}
                                  value={polozka.skladova_polozka_id}
                                >
                                  {optionMeta.okruh} / {polozka.nazev}
                                </option>
                              );
                            })}
                          </select>
                        </Field>

                        <Field label="Množství">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={manualItem.mnozstvi}
                            onChange={(e) =>
                              updateManualPlanItem(
                                manualItem.local_id,
                                "mnozstvi",
                                e.target.value
                              )
                            }
                          />
                        </Field>

                        <div className="pt-7">
                          <Button
                            variant="secondary"
                            onClick={() => removeManualPlanItem(manualItem.local_id)}
                          >
                            Odebrat
                          </Button>
                        </div>
                      </div>

                      {selectedPolozka ? (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                          <span className="rounded-md bg-slate-800 px-2 py-1">
                            Název: {selectedPolozka.nazev}
                          </span>
                          <span className="rounded-md bg-slate-800 px-2 py-1">
                            Okruh: {meta.okruh}
                          </span>
                          <span className="rounded-md bg-slate-800 px-2 py-1">
                            Kategorie: {meta.kategorie}
                          </span>
                          <span className="rounded-md bg-slate-800 px-2 py-1">
                            Podkategorie: {meta.podkategorie}
                          </span>
                          <span className="rounded-md bg-emerald-950 px-2 py-1 text-emerald-100">
                            Pozice: {meta.pozice}
                          </span>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="hidden space-y-4 border-emerald-800 bg-emerald-950/20">
            <div>
              <div className="text-lg font-semibold text-emerald-100">
                Výsledný plán techniky
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Součet setupů a ručních položek, který se po uložení vloží do technika_na_zakazce.
              </div>
            </div>

            {aggregatedPlanRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-emerald-900 px-4 py-4 text-sm text-slate-400">
                Zatím není vybraná žádná plánovaná technika.
              </div>
            ) : (
              <div className="grid gap-2">
                {aggregatedPlanRows.map((row) => (
                  <div
                    key={row.skladova_polozka_id}
                    className="grid gap-2 rounded-xl border border-emerald-900/60 bg-slate-950 px-4 py-3 text-sm md:grid-cols-[1fr_120px_120px_120px]"
                  >
                    <div>
                      <div className="font-bold text-white">{row.nazev}</div>
                      <div className="text-xs text-slate-500">
                        Pozice: {formatPosition(row.pozice)}
                      </div>
                    </div>
                    <div className="text-slate-300">
                      <span className="text-slate-500">Setupy: </span>
                      {formatNumber(row.setupMnozstvi)}
                    </div>
                    <div className="text-slate-300">
                      <span className="text-slate-500">Ručně: </span>
                      {formatNumber(row.manualMnozstvi)}
                    </div>
                    <div className="text-lg font-black text-emerald-100">
                      {formatNumber(row.vysledneMnozstvi)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Field label="Poznámka">
            <Textarea
              value={poznamka}
              onChange={(e) => setPoznamka(e.target.value)}
              rows={6}
              className="resize-y"
              placeholder="Volitelná poznámka k zakázce"
            />
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={() => void ulozit()} disabled={ukladam}>
              {ukladam ? "Ukládám..." : "Uložit"}
            </Button>

            <Button
              variant="secondary"
              onClick={() => router.push("/zakazky")}
              disabled={ukladam}
            >
              Zrušit
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}