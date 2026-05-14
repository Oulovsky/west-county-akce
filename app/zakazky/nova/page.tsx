"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";

type TypObsluhy = "s_obsluhou" | "bez_obsluhy";

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

const selectClassName =
  "mt-2 w-full appearance-none rounded-xl border border-slate-700 bg-[#0f172a] bg-no-repeat px-4 py-3 pr-12 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const selectChevronStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23e2e8f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 7 5 5 5-5'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 1rem center",
  backgroundSize: "1rem",
} as const;

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

  const [poznamka, setPoznamka] = useState("");
  const [ukladam, setUkladam] = useState(false);

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

  async function ulozit() {
    if (!nazev || !misto || !akceOdDatum || !akceDoDatum) {
      alert("Vyplň název, místo, akce od a akce do.");
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
      alert("Vyplň začátek a konec akce.");
      return;
    }

    if (new Date(akceOd).getTime() >= new Date(akceDo).getTime()) {
      alert("Konec akce musí být později než začátek akce.");
      return;
    }

    if (typObsluhy === "bez_obsluhy") {
      if (!stavbaOd || !stavbaDo || !bouraniOd || !bouraniDo) {
        alert("U zakázky bez obsluhy je povinná stavba i bourání.");
        return;
      }
    }

    if (stavbaOd && stavbaDo && new Date(stavbaOd).getTime() >= new Date(stavbaDo).getTime()) {
      alert("Konec stavby musí být později než začátek stavby.");
      return;
    }

    if (bouraniOd && bouraniDo && new Date(bouraniOd).getTime() >= new Date(bouraniDo).getTime()) {
      alert("Konec bourání musí být později než začátek bourání.");
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
          alert(`U ${item.nazev} vyplň šířku i výšku LED.`);
          return;
        }

        if (!ledRequestedArea || ledRequestedArea <= 0) {
          alert(`LED plocha u ${item.nazev} musí být větší než 0.`);
          return;
        }

        if (ledMaxArea && ledRequestedArea > ledMaxArea) {
          alert(
            `Požadovaná LED plocha ${ledRequestedArea} m² překračuje maximum ${ledMaxArea} m² pro ${getLedKindLabel(item.ledKind)} u ${item.nazev}.`
          );
          return;
        }
      }
    }

    try {
      setUkladam(true);

      const cisloZakazky = await vygenerovatCisloZakazky();
      const prvniRealizace = realizaceList[0];

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

      const { data, error } = await supabase
        .from("zakazky")
        .insert({
          cislo_zakazky: cisloZakazky,
          stav_zakazky_id: "7a0e168f-216f-40bd-b33e-3f1f517620da",
          nazev,
          misto,
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

          poznamka: poznamka || null,
        })
        .select("zakazka_id")
        .single();

      if (error) {
        alert(error.message);
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
          alert(realizaceError.message);
          setUkladam(false);
          return;
        }
      }

      router.push(`/zakazky/${zakazkaId}`);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Neznámá chyba";
      alert(message);
      setUkladam(false);
    }
  }

  return (
    <div className="w-full">
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

          <Field label="Místo">
            <Input
              value={misto}
              onChange={(e) => setMisto(e.target.value)}
              placeholder="Např. Bečov"
            />
          </Field>

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
                <div className="text-lg font-semibold text-white">Basic look</div>
                <div className="mt-1 text-sm text-slate-400">
                  Základní produkční zadání po jednotlivých stage / realizacích.
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

                    <div className="grid gap-6 md:grid-cols-2">
                      <Card className="border-slate-700 bg-[#0b1324]">
                        <div className="space-y-4">
                          <div className="text-base font-semibold text-white">Stage</div>

                          <Field label="Setup stage">
                            <select
                              value={realizace.stagePreset}
                              onChange={(e) =>
                                updateRealizace(realizace.local_id, "stagePreset", e.target.value)
                              }
                              className={selectClassName}
                              style={selectChevronStyle}
                            >
                              <option value="">—</option>
                              <option value="mala">Malý setup</option>
                              <option value="velka">Velký setup</option>
                              <option value="nejvetsi">Největší setup</option>
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
                        </div>
                      </Card>

                      <Card className="border-slate-700 bg-[#0b1324]">
                        <div className="space-y-4">
                          <div className="text-base font-semibold text-white">Sound & lights</div>

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
                            </select>
                          </Field>

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
                            </select>
                          </Field>
                        </div>
                      </Card>
                    </div>

                    <Card className="border-slate-700 bg-[#0b1324]">
                      <div className="space-y-4">
                        <div className="text-base font-semibold text-white">LED / mantinel</div>

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

                          <div className="flex items-end pb-[14px]">
                            <label className="flex items-center gap-2 text-white">
                              <input
                                type="checkbox"
                                checked={realizace.dron}
                                onChange={(e) =>
                                  updateRealizace(realizace.local_id, "dron", e.target.checked)
                                }
                              />
                              Dron
                            </label>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Card>
                );
              })}
            </div>
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
            <Button onClick={ulozit} disabled={ukladam}>
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