"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import PoptavkaSestavaKonfigurator from "@/components/portal/PoptavkaSestavaKonfigurator";
import PoptavkaTechnickePodminkyStep, {
  createInitialSectionPhotos,
} from "@/components/portal/PoptavkaTechnickePodminkyStep";
import PoptavkaObjednavkaPricingPanel, {
  syncPricingHiddenFields,
} from "@/components/poptavka/PoptavkaObjednavkaPricingPanel";
import {
  savePoptavkaObjednavkaDraftAction,
  sendPoptavkaObjednavkaAction,
} from "@/app/zakazky/poptavky/[id]/objednavka/actions";
import { OBJEDNAVKA_DRAFT_STAV_LABELS } from "@/lib/client-portal/poptavka-objednavka-draft-form";
import type { PoptavkaObjednavkaDraftData } from "@/lib/client-portal/poptavka-objednavka-types";
import type {
  ObjednavkaExtraPolozka,
  ObjednavkaPricingBlock,
} from "@/lib/client-portal/poptavka-objednavka-types";
import {
  buildObjednavkaPricingBlock,
  deriveObjednavkaSetupyFromSestava,
  type ObjednavkaPricingCatalog,
} from "@/lib/client-portal/poptavka-objednavka-pricing";
import { TYP_AKCE_OPTIONS } from "@/lib/client-portal/poptavka-form";
import type { PoptavkaFotkaWithUrl } from "@/lib/client-portal/poptavka-fotky-shared";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";
import type { PoptavkaTechnikaFormValues } from "@/lib/client-portal/poptavka-technika-form";
import type { TechnickeRezim } from "@/lib/client-portal/poptavka-technika-podminky";
import {
  formatLogistikaOknoRange,
  getTerminRealizaceRange,
  toDatetimeLocalInput,
} from "@/lib/logistika-okna";
import {
  hasSestavaKonfigurace,
  normalizeSestavaStateForSave,
} from "@/lib/client-portal/sestava-konfigurator-form";
import type {
  PortalSestavaKatalog,
  SestavaKonfiguratorState,
} from "@/lib/client-portal/sestava-konfigurator-types";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Draft objednávky nebyl nalezen.",
  read_only: "Tento draft už nelze upravovat.",
  save_failed: "Uložení se nezdařilo.",
  link_failed: "Vytvoření závazné objednávky se nezdařilo. Zkuste to znovu nebo kontaktujte správce.",
  invalid_state: "Závaznou objednávku v aktuálním stavu poptávky už nelze odeslat.",
};

type Props = {
  poptavkaId: string;
  cisloPoptavky: string;
  draftId: string;
  draftStav: string;
  draftData: PoptavkaObjednavkaDraftData;
  sourceChanged: boolean;
  readOnly: boolean;
  canEdit: boolean;
  canSend: boolean;
  odeslanychVerzi: number;
  dalsiNavrhVerze: number;
  saved: boolean;
  errorCode: string | null;
  sestavaKatalog: PortalSestavaKatalog;
  setupsByOblast: PortalSetupsByOblast;
  pricingCatalog: ObjednavkaPricingCatalog;
  initialFotky: PoptavkaFotkaWithUrl[];
};

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
      <h2 className="text-lg font-semibold text-white">
        <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  rows = 3,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
      />
    </label>
  );
}

function PartyFields({
  prefix,
  party,
  disabled,
}: {
  prefix: "klient" | "dodavatel";
  party: PoptavkaObjednavkaDraftData["klient"];
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Název / firma" name={`${prefix}_nazev`} defaultValue={party.nazev} disabled={disabled} />
      <Field label="IČO" name={`${prefix}_ico`} defaultValue={party.ico} disabled={disabled} />
      <Field label="DIČ" name={`${prefix}_dic`} defaultValue={party.dic} disabled={disabled} />
      <Field label="Kontaktní osoba" name={`${prefix}_kontakt_jmeno`} defaultValue={party.kontaktJmeno} disabled={disabled} />
      <Field label="Telefon" name={`${prefix}_telefon`} defaultValue={party.telefon} disabled={disabled} />
      <Field label="E-mail" name={`${prefix}_email`} defaultValue={party.email} disabled={disabled} />
      <div className="md:col-span-2">
        <Field label="Adresa" name={`${prefix}_adresa`} defaultValue={party.adresa} disabled={disabled} />
      </div>
      <div className="md:col-span-2">
        <Field label="Bankovní spojení" name={`${prefix}_bankovni_spojeni`} defaultValue={party.bankovniSpojeni} disabled={disabled} />
      </div>
    </div>
  );
}

function syncJsonFields(
  form: HTMLFormElement,
  sestava: SestavaKonfiguratorState,
  technika: PoptavkaTechnikaFormValues
) {
  const sestavaInput = form.elements.namedItem("sestava_konfigurator_json") as HTMLInputElement | null;
  const technikaInput = form.elements.namedItem("technika_json") as HTMLInputElement | null;
  if (sestavaInput) {
    sestavaInput.value = JSON.stringify(normalizeSestavaStateForSave(sestava));
  }
  if (technikaInput) {
    technikaInput.value = JSON.stringify(technika);
  }
}

export default function PoptavkaObjednavkaDraftEditor({
  poptavkaId,
  cisloPoptavky,
  draftId,
  draftStav,
  draftData,
  sourceChanged,
  readOnly,
  canEdit,
  canSend,
  odeslanychVerzi,
  dalsiNavrhVerze,
  saved,
  errorCode,
  sestavaKatalog,
  setupsByOblast,
  pricingCatalog,
  initialFotky,
}: Props) {
  const d = draftData;
  const disabled = !canEdit;

  const [sestava, setSestava] = useState<SestavaKonfiguratorState>(d.sestava);
  const [technika, setTechnika] = useState<PoptavkaTechnikaFormValues>(d.technika);
  const [extraPolozky, setExtraPolozky] = useState<ObjednavkaExtraPolozka[]>(
    d.technickePlneni.extraPolozky ?? []
  );
  const [pricing, setPricing] = useState<ObjednavkaPricingBlock | null>(d.pricing);
  const [uiRezim, setUiRezim] = useState<TechnickeRezim | null>(
    d.technika.technicke_rezim === "klient_vyplni" || d.technika.technicke_rezim === "vyjezd_technika"
      ? d.technika.technicke_rezim
      : null
  );
  const [uiPotvrzeno, setUiPotvrzeno] = useState(true);
  const [sectionPhotos, setSectionPhotos] = useState(() => createInitialSectionPhotos(initialFotky));

  const inputClass =
    "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60";
  const labelClass = "text-sm text-slate-400";
  const optionCardClass =
    "flex gap-2 rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-200";

  const setupy = useMemo(
    () => deriveObjednavkaSetupyFromSestava(sestava, sestavaKatalog, setupsByOblast),
    [sestava, sestavaKatalog, setupsByOblast]
  );

  const livePricing = useMemo(
    () =>
      buildObjednavkaPricingBlock({
        setupy,
        extraPolozky,
        pricingCatalog,
        pozadovanaCena: pricing?.pozadovanaCena ?? null,
        previous: pricing,
      }),
    [setupy, extraPolozky, pricingCatalog, pricing]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    syncJsonFields(event.currentTarget, sestava, {
      ...technika,
      technicke_rezim: uiRezim ?? technika.technicke_rezim,
    });
    syncPricingHiddenFields(event.currentTarget, extraPolozky, livePricing);
  }

  function handleSendClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (
      !window.confirm(
        "Odesláním se vytvoří zmrazená verze objednávky a klient dostane odkaz k potvrzení. Pokračovat?"
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-5 text-sm text-indigo-100">
        <p className="font-semibold">Návrh závazné objednávky — stejná struktura jako klientská poptávka</p>
        <p className="mt-2 text-indigo-200/90">
          Sekce odpovídají krokům klientského formuláře. Po odeslání vznikne zmrazená verze pro klienta.
          {odeslanychVerzi > 0
            ? ` Dříve odeslaných verzí: ${odeslanychVerzi}. Další odeslání bude verze ${dalsiNavrhVerze}.`
            : ` Při odeslání vznikne verze ${dalsiNavrhVerze}.`}
        </p>
      </div>

      {d.upravenoOprotiPoptavce ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Na základě naší komunikace byly v poptávce provedeny změny.
        </p>
      ) : null}

      {saved ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
          Návrh objednávky byl uložen k této poptávce. Klient ho zatím nevidí. Pro odeslání
          klientovi použijte tlačítko Odeslat klientovi ke schválení.
        </p>
      ) : null}

      {errorCode && ERROR_MESSAGES[errorCode] ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-100">
          {ERROR_MESSAGES[errorCode]}
        </p>
      ) : null}

      {sourceChanged ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Poptávka byla po vytvoření návrhu změněna. Zkontrolujte údaje.
        </p>
      ) : null}

      {d.validationWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Upozornění k návrhu</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {d.validationWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={savePoptavkaObjednavkaDraftAction} onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="draft_id" value={draftId} />
        <input type="hidden" name="poptavka_id" value={poptavkaId} />
        <input type="hidden" name="sestava_konfigurator_json" defaultValue={JSON.stringify(normalizeSestavaStateForSave(d.sestava))} />
        <input type="hidden" name="technika_json" defaultValue={JSON.stringify({
          ...technika,
          technicke_rezim: uiRezim ?? technika.technicke_rezim,
        })} />
        <input type="hidden" name="extra_polozky_json" defaultValue={JSON.stringify(d.technickePlneni.extraPolozky ?? [])} />
        <input type="hidden" name="pricing_json" defaultValue={JSON.stringify(d.pricing)} />
        <input type="hidden" name="stavba_okno_od" value={d.organizace.stavba.oknoOd ?? ""} />
        <input type="hidden" name="stavba_okno_do" value={d.organizace.stavba.oknoDo ?? ""} />
        <input type="hidden" name="bourani_okno_od" value={d.organizace.bourani.oknoOd ?? ""} />
        <input type="hidden" name="bourani_okno_do" value={d.organizace.bourani.oknoDo ?? ""} />

        <Section step={0} title="Změny oproti poptávce klienta">
          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              name="upraveno_oproti_poptavce"
              defaultChecked={d.upravenoOprotiPoptavce}
              disabled={disabled}
              className="mt-1 rounded border-slate-600"
            />
            <span>
              V návrhu byly provedeny změny oproti původní poptávce
              <span className="mt-1 block text-xs text-slate-500">
                Původní klientská poptávka zůstává v systému beze změny.
              </span>
            </span>
          </label>
        </Section>

        <Section step={1} title="Kdo zadává / klient">
          <PartyFields prefix="klient" party={d.klient} disabled={disabled} />
          <div className="mt-6 border-t border-slate-800 pt-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Dodavatel (WEST COUNTY)
            </h3>
            <PartyFields prefix="dodavatel" party={d.dodavatel} disabled={disabled} />
          </div>
        </Section>

        <Section step={2} title="Kde a kdy">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Název akce" name="akce_nazev" defaultValue={d.akce.nazevAkce} disabled={disabled} />
            <label className="block space-y-1.5">
              <span className="text-sm text-slate-400">Typ akce</span>
              <select
                name="akce_typ_kod"
                defaultValue={d.akce.typAkceKod ?? ""}
                disabled={disabled}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                <option value="">—</option>
                {TYP_AKCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Datum od" name="akce_datum_od" type="date" defaultValue={d.akce.datumOd} disabled={disabled} />
            <Field label="Datum do" name="akce_datum_do" type="date" defaultValue={d.akce.datumDo} disabled={disabled} />
            <Field label="Čas programu od" name="akce_cas_od" type="time" defaultValue={d.akce.casProgramuOd ?? ""} disabled={disabled} />
            <Field label="Čas programu do" name="akce_cas_do" type="time" defaultValue={d.akce.casProgramuDo ?? ""} disabled={disabled} />
            <Field label="Název místa" name="misto_nazev" defaultValue={d.misto.nazev} disabled={disabled} />
            <Field label="Adresa místa" name="misto_adresa" defaultValue={d.misto.adresa} disabled={disabled} />
            <Field label="GPS lat" name="misto_gps_lat" defaultValue={d.misto.gps.lat != null ? String(d.misto.gps.lat) : ""} disabled={disabled} />
            <Field label="GPS lng" name="misto_gps_lng" defaultValue={d.misto.gps.lng != null ? String(d.misto.gps.lng) : ""} disabled={disabled} />
            <div className="md:col-span-2">
              <TextArea label="Přesný popis místa" name="presny_popis_mista" defaultValue={d.akce.presnyPopisMista} rows={3} disabled={disabled} />
            </div>
            <div className="md:col-span-2">
              <TextArea label="Poznámka k místu / akci" name="akce_poznamka" defaultValue={d.akce.poznamka} disabled={disabled} />
            </div>
            <div className="md:col-span-2">
              <TextArea label="Upřesnění typu akce" name="akce_typ_poznamka" defaultValue={d.akce.typAkcePoznamka} disabled={disabled} />
            </div>
            <div className="md:col-span-2">
              <TextArea label="Poznámka klienta k logistice" name="logistika_poznamka_klienta" defaultValue={d.akce.logistikaPoznamkaKlienta} disabled={disabled} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
              <input type="checkbox" name="akce_vice_denni" defaultChecked={d.akce.viceDenni} disabled={disabled} className="rounded border-slate-600" />
              Vícedenní akce
            </label>
          </div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Klientská logistická okna</p>
            <p className="mt-2">
              Stavba:{" "}
              <span className="text-white">
                {formatLogistikaOknoRange(d.organizace.stavba.oknoOd, d.organizace.stavba.oknoDo) ?? "—"}
              </span>
            </p>
            <p className="mt-1">
              Bourání:{" "}
              <span className="text-white">
                {formatLogistikaOknoRange(d.organizace.bourani.oknoOd, d.organizace.bourani.oknoDo) ?? "—"}
              </span>
            </p>
          </div>
        </Section>

        <Section step={3} title="Konfigurace sestavy">
          {hasSestavaKonfigurace(sestava) && d.technickePlneni.setupy.length === 0 ? (
            <p className="mb-4 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
              Konkrétní skladové setupy zatím nejsou přiřazené — pro klienta platí konfigurace sestavy níže.
            </p>
          ) : null}
          <PoptavkaSestavaKonfigurator
            katalog={sestavaKatalog}
            setupsByOblast={setupsByOblast}
            state={sestava}
            onChange={setSestava}
            readOnly={disabled}
            inputClass={inputClass}
            labelClass={labelClass}
            optionCardClass={optionCardClass}
          />
        </Section>

        <Section step={4} title="Extra položky a cenový výpočet">
          <PoptavkaObjednavkaPricingPanel
            sestava={sestava}
            extraPolozky={extraPolozky}
            pricing={pricing}
            pricingCatalog={pricingCatalog}
            sestavaKatalog={sestavaKatalog}
            setupsByOblast={setupsByOblast}
            disabled={disabled}
            onExtraPolozkyChange={setExtraPolozky}
            onPricingChange={setPricing}
          />
        </Section>

        <Section step={5} title="Technické podmínky">
          <PoptavkaTechnickePodminkyStep
            technika={technika}
            onChange={setTechnika}
            uiRezim={uiRezim}
            uiPotvrzeno={uiPotvrzeno}
            onUiRezimChange={setUiRezim}
            onUiPotvrzenoChange={setUiPotvrzeno}
            readOnly={disabled}
            poptavkaId={poptavkaId}
            initialFotky={initialFotky}
            sectionPhotos={sectionPhotos}
            onSectionPhotosChange={(key, next) =>
              setSectionPhotos((current) => ({ ...current, [key]: next }))
            }
            inputClass={inputClass}
            labelClass={labelClass}
            optionCardClass={optionCardClass}
            mistoLat={d.misto.gps.lat}
            mistoLng={d.misto.gps.lng}
            kontaktJmeno={d.klient.kontaktJmeno ?? ""}
            kontaktTelefon={d.klient.telefon ?? ""}
            kontaktEmail={d.klient.email ?? ""}
          />
        </Section>

        <Section step={6} title="Interní termíny a organizace">
          <p className="text-sm text-slate-400">
            Domluvené termíny realizace doplňují klientskou poptávku a po potvrzení se propíší do zakázky.
          </p>
          <Field label="Příjezd techniky" name="org_prijezd_techniky" defaultValue={d.organizace.prijezdTechniky} disabled={disabled} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stavba</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Domluvená realizace — od" name="stavba_realizace_od" type="datetime-local" defaultValue={toDatetimeLocalInput(getTerminRealizaceRange(d.organizace.stavba).od)} disabled={disabled} />
                <Field label="Domluvená realizace — do" name="stavba_realizace_do" type="datetime-local" defaultValue={toDatetimeLocalInput(getTerminRealizaceRange(d.organizace.stavba).do)} disabled={disabled} />
              </div>
              <Field label="Přístup od" name="stavba_pristup_od" defaultValue={d.organizace.stavba.pristupOd} disabled={disabled} />
              <div className="mt-3">
                <TextArea label="Omezení vjezdu" name="stavba_omezeni_vjezdu" defaultValue={d.organizace.stavba.omezeniVjezdu} disabled={disabled} />
              </div>
              <div className="mt-3">
                <TextArea label="Poznámka ke stavbě" name="stavba_poznamka" defaultValue={d.organizace.stavba.poznamka} disabled={disabled} />
              </div>
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bourání</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Domluvená realizace — od" name="bourani_realizace_od" type="datetime-local" defaultValue={toDatetimeLocalInput(getTerminRealizaceRange(d.organizace.bourani).od)} disabled={disabled} />
                <Field label="Domluvená realizace — do" name="bourani_realizace_do" type="datetime-local" defaultValue={toDatetimeLocalInput(getTerminRealizaceRange(d.organizace.bourani).do)} disabled={disabled} />
              </div>
              <Field label="Místo uvolněno do" name="bourani_misto_uvolneno_do" defaultValue={d.organizace.bourani.mistoUvolnenoDo} disabled={disabled} />
              <div className="mt-3">
                <TextArea label="Poznámka k bourání" name="bourani_poznamka" defaultValue={d.organizace.bourani.poznamka} disabled={disabled} />
              </div>
            </div>
            <div className="md:col-span-2">
              <TextArea label="Součinnost klienta" name="org_soucinnost_klienta" defaultValue={d.organizace.soucinnostKlienta} disabled={disabled} />
            </div>
          </div>
        </Section>

        <Section step={7} title="Smluvní podmínky">
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
            Text smluvních podmínek je pracovní šablona a musí projít právní kontrolou.
          </p>
          <div className="mt-4 space-y-4">
            <TextArea label="Závaznost objednávky" name="smluvni_zavaznost" defaultValue={d.smluvniPodminky.zavaznost} rows={4} disabled={disabled} />
            <TextArea label="Součinnost klienta" name="smluvni_soucinnost" defaultValue={d.smluvniPodminky.soucinnostKlienta} rows={4} disabled={disabled} />
            <TextArea label="Elektro a technické podmínky" name="smluvni_elektro" defaultValue={d.smluvniPodminky.elektroTechnicke} rows={4} disabled={disabled} />
            <TextArea label="Počasí / vyšší moc" name="smluvni_pocasi" defaultValue={d.smluvniPodminky.pocasiVyssiMoc} rows={3} disabled={disabled} />
            <TextArea label="Storno" name="smluvni_storno" defaultValue={d.smluvniPodminky.storno} rows={3} disabled={disabled} />
            <TextArea label="Odpovědnost za místo" name="smluvni_odpovednost" defaultValue={d.smluvniPodminky.odpovednostZaMisto} rows={3} disabled={disabled} />
            <TextArea label="Bezpečnost" name="smluvni_bezpecnost" defaultValue={d.smluvniPodminky.bezpecnost} rows={3} disabled={disabled} />
            <TextArea label="Platební podmínky" name="smluvni_platebni" defaultValue={d.smluvniPodminky.platebni} rows={2} disabled={disabled} />
          </div>
        </Section>

        <Section step={8} title="Text pro klienta">
          <div className="space-y-4">
            <TextArea label="Úvodní text" name="text_uvod" defaultValue={d.textProKlienta.uvod} rows={3} disabled={disabled} />
            <TextArea label="Závěrečný text" name="text_zaver" defaultValue={d.textProKlienta.zaver} rows={3} disabled={disabled} />
            <TextArea label="Poznámka šéfa" name="text_poznamka_sefa" defaultValue={d.textProKlienta.poznamkaSefa} rows={3} disabled={disabled} />
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6">
          {canEdit ? (
            <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
              Uložit návrh
            </button>
          ) : (
            <p className="text-sm text-slate-400">
              {readOnly ? "Nemáte oprávnění upravovat návrh objednávky." : "Tento draft nelze upravovat (není aktivní)."}
            </p>
          )}
          {canEdit && canSend ? (
            <button
              type="submit"
              formAction={sendPoptavkaObjednavkaAction}
              onClick={handleSendClick}
              className="rounded-xl border border-emerald-500/50 bg-emerald-950/40 px-5 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/50"
            >
              Odeslat závaznou objednávku klientovi
            </button>
          ) : null}
          <Link href={`/zakazky/poptavky/${poptavkaId}/objednavka/nahled`} className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900">
            Náhled objednávky
          </Link>
          <Link href={`/zakazky/poptavky/${poptavkaId}`} className="text-sm text-blue-300 hover:text-blue-200">
            ← Zpět na poptávku
          </Link>
          <span className="text-xs text-slate-500">
            Stav draftu: {OBJEDNAVKA_DRAFT_STAV_LABELS[draftStav] ?? draftStav} · {cisloPoptavky}
          </span>
        </div>
      </form>
    </div>
  );
}
