"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { savePoptavkaObjednavkaDraftAction } from "@/app/zakazky/poptavky/[id]/objednavka/actions";
import { OBJEDNAVKA_DRAFT_STAV_LABELS } from "@/lib/client-portal/poptavka-objednavka-draft-form";
import type { PoptavkaObjednavkaDraftData } from "@/lib/client-portal/poptavka-objednavka-types";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Draft objednávky nebyl nalezen.",
  read_only: "Tento draft už nelze upravovat.",
  save_failed: "Uložení se nezdařilo.",
};

const TRI_OPTIONS = [
  ["", "—"],
  ["ano", "Ano"],
  ["ne", "Ne"],
  ["nevim", "Nevím"],
] as const;

type Props = {
  poptavkaId: string;
  cisloPoptavky: string;
  draftId: string;
  draftStav: string;
  draftData: PoptavkaObjednavkaDraftData;
  sourceChanged: boolean;
  readOnly: boolean;
  canEdit: boolean;
  saved: boolean;
  errorCode: string | null;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
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

function TriSelect({
  label,
  name,
  defaultValue,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
      >
        {TRI_OPTIONS.map(([value, text]) => (
          <option key={value || "empty"} value={value}>
            {text}
          </option>
        ))}
      </select>
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
      <Field label="E-mail" name={`${prefix}_email`} defaultValue={party.email} type="email" disabled={disabled} />
      <div className="md:col-span-2">
        <Field label="Adresa" name={`${prefix}_adresa`} defaultValue={party.adresa} disabled={disabled} />
      </div>
      {prefix === "dodavatel" ? (
        <div className="md:col-span-2">
          <Field
            label="Bankovní spojení"
            name={`${prefix}_bankovni_spojeni`}
            defaultValue={party.bankovniSpojeni}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="md:col-span-2">
          <Field
            label="Fakturační / bankovní spojení"
            name={`${prefix}_bankovni_spojeni`}
            defaultValue={party.bankovniSpojeni}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
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
  saved,
  errorCode,
}: Props) {
  const d = draftData;
  const disabled = !canEdit;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-5 text-sm text-indigo-100">
        <p className="font-semibold">Návrh závazné objednávky — interní dokument</p>
        <p className="mt-2 text-indigo-200/90">
          Klient zatím nic nevidí. Po odeslání (další krok) se z návrhu vytvoří zmrazená verze ke
          schválení. Setupy v objednávce jsou konfigurace služeb, ne rezervace konkrétních kusů ze
          skladu.
        </p>
      </div>

      {saved ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
          Návrh objednávky byl uložen.
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

      <form action={savePoptavkaObjednavkaDraftAction} className="space-y-6">
        <input type="hidden" name="draft_id" value={draftId} />
        <input type="hidden" name="poptavka_id" value={poptavkaId} />

        <Section title="Klient">
          <PartyFields prefix="klient" party={d.klient} disabled={disabled} />
        </Section>

        <Section title="Naše firma (dodavatel)">
          <PartyFields prefix="dodavatel" party={d.dodavatel} disabled={disabled} />
        </Section>

        <Section title="Akce">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Název akce" name="akce_nazev" defaultValue={d.akce.nazevAkce} disabled={disabled} />
            <Field label="Typ akce" name="akce_typ" defaultValue={d.akce.typAkce} disabled={disabled} />
            <Field label="Datum od" name="akce_datum_od" type="date" defaultValue={d.akce.datumOd} disabled={disabled} />
            <Field label="Datum do" name="akce_datum_do" type="date" defaultValue={d.akce.datumDo} disabled={disabled} />
            <Field label="Čas od" name="akce_cas_od" type="time" defaultValue={d.akce.casProgramuOd ?? ""} disabled={disabled} />
            <Field label="Čas do" name="akce_cas_do" type="time" defaultValue={d.akce.casProgramuDo ?? ""} disabled={disabled} />
            <div className="md:col-span-2">
              <Field label="Poznámka k typu akce" name="akce_typ_poznamka" defaultValue={d.akce.typAkcePoznamka} disabled={disabled} />
            </div>
            <div className="md:col-span-2">
              <TextArea label="Poznámka k akci / místu" name="akce_poznamka" defaultValue={d.akce.poznamka} disabled={disabled} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                name="akce_vice_denni"
                defaultChecked={d.akce.viceDenni}
                disabled={disabled}
                className="rounded border-slate-600"
              />
              Vícedenní akce
            </label>
          </div>
        </Section>

        <Section title="Místo a technické podmínky">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Název místa" name="misto_nazev" defaultValue={d.misto.nazev} disabled={disabled} />
            <Field label="Adresa" name="misto_adresa" defaultValue={d.misto.adresa} disabled={disabled} />
            <Field label="GPS lat" name="misto_gps_lat" defaultValue={d.misto.gps.lat != null ? String(d.misto.gps.lat) : ""} disabled={disabled} />
            <Field label="GPS lng" name="misto_gps_lng" defaultValue={d.misto.gps.lng != null ? String(d.misto.gps.lng) : ""} disabled={disabled} />
            <div className="md:col-span-2">
              <TextArea label="Popis příjezdu" name="misto_prijezd" defaultValue={d.misto.prijezdPopis} disabled={disabled} />
            </div>
            <div className="md:col-span-2">
              <TextArea label="Přístupová cesta / parkování" name="misto_pristup" defaultValue={d.misto.pristupovaCesta} disabled={disabled} />
            </div>
            <TriSelect label="Povrch / terén zpevněný" name="misto_povrch" defaultValue={d.misto.povrchTeren} disabled={disabled} />
            <TriSelect label="Vjezd technikou / autem" name="misto_vjezd" defaultValue={d.misto.vjezdTechnikou} disabled={disabled} />
            <TextArea label="Místo pro stage" name="misto_stage" defaultValue={d.misto.mistoStage} disabled={disabled} />
            <TextArea label="Místo pro FOH" name="misto_foh" defaultValue={d.misto.mistoFoh} disabled={disabled} />
            <TextArea label="LED / režie" name="misto_led_rezie" defaultValue={d.misto.mistoLedRezie} disabled={disabled} />
            <Field label="Elektro přípojka" name="elektro_pripojka" defaultValue={d.misto.elektro.pripojka} disabled={disabled} />
            <Field label="Jištění" name="elektro_jisteni" defaultValue={d.misto.elektro.jisteni} disabled={disabled} />
            <Field label="Typ zásuvky" name="elektro_zasuvka" defaultValue={d.misto.elektro.zasuvka} disabled={disabled} />
            <Field
              label="Vzdálenost elektřiny (m)"
              name="elektro_vzdalenost_m"
              defaultValue={d.misto.elektro.vzdalenostM != null ? String(d.misto.elektro.vzdalenostM) : ""}
              disabled={disabled}
            />
            <TextArea label="Rozvaděče / poznámka" name="elektro_rozvadece" defaultValue={d.misto.elektro.rozvadecePoznamka} disabled={disabled} />
            <TextArea label="Kabelové trasy" name="elektro_kabelove_trasy" defaultValue={d.misto.elektro.kabeloveTrasy} disabled={disabled} />
            <TriSelect label="Kabel přes silnici" name="elektro_kabel_pres_silnici" defaultValue={d.misto.elektro.kabelPresSilnici} disabled={disabled} />
            <TriSelect label="Potřeba elektrocentrály" name="elektro_centrala" defaultValue={d.misto.elektro.potrebaElektrocentraly} disabled={disabled} />
            <Field label="Vzdálenost rozvaděče" name="elektro_vzdalenost_rozvadece" defaultValue={d.misto.elektro.vzdalenostRozvadece} disabled={disabled} />
            <TextArea label="Omezení hluku" name="misto_omezeni_hluku" defaultValue={d.misto.omezeniHluku} disabled={disabled} />
            <TextArea label="Časová omezení" name="misto_casova_omezeni" defaultValue={d.misto.casovaOmezeni} disabled={disabled} />
            <TextArea label="Omezení noční práce" name="misto_nocni_prace" defaultValue={d.misto.nocniPraceOmezeni} disabled={disabled} />
            <TextArea label="Kotvení / zavěšení" name="misto_kotveni" defaultValue={d.misto.kotveniZaveseni} disabled={disabled} />
            <TextArea label="Požadavky pořadatele" name="misto_pozadavky_poradatele" defaultValue={d.misto.pozadavkyPoradatele} disabled={disabled} />
            <div className="md:col-span-2">
              <TextArea label="Další technické poznámky" name="misto_dalsi_poznamky" defaultValue={d.misto.dalsiTechnickePoznamky} disabled={disabled} rows={4} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
              <input
                type="checkbox"
                name="misto_vyjezd_technika"
                defaultChecked={d.misto.pozadovanVyjezdTechnika}
                disabled={disabled}
                className="rounded border-slate-600"
              />
              Požadovaný výjezd technika na místo
            </label>
          </div>
        </Section>

        <Section title="Organizace — stavba a bourání">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Příjezd techniky (orientačně)" name="org_prijezd_techniky" defaultValue={d.organizace.prijezdTechniky} disabled={disabled} />
            </div>
            <p className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stavba</p>
            <Field label="Datum stavby" name="stavba_datum" type="date" defaultValue={d.organizace.stavba.datum} disabled={disabled} />
            <Field label="Přístup od" name="stavba_pristup_od" defaultValue={d.organizace.stavba.pristupOd} disabled={disabled} />
            <Field label="Čas od" name="stavba_cas_od" type="time" defaultValue={d.organizace.stavba.casOd ?? ""} disabled={disabled} />
            <Field label="Čas do" name="stavba_cas_do" type="time" defaultValue={d.organizace.stavba.casDo ?? ""} disabled={disabled} />
            <div className="md:col-span-2">
              <TextArea label="Omezení vjezdu" name="stavba_omezeni_vjezdu" defaultValue={d.organizace.stavba.omezeniVjezdu} disabled={disabled} />
            </div>
            <div className="md:col-span-2">
              <TextArea label="Poznámka ke stavbě" name="stavba_poznamka" defaultValue={d.organizace.stavba.poznamka} disabled={disabled} />
            </div>
            <p className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bourání</p>
            <Field label="Datum bourání" name="bourani_datum" type="date" defaultValue={d.organizace.bourani.datum} disabled={disabled} />
            <Field label="Místo uvolněno do" name="bourani_misto_uvolneno_do" defaultValue={d.organizace.bourani.mistoUvolnenoDo} disabled={disabled} />
            <Field label="Čas od" name="bourani_cas_od" type="time" defaultValue={d.organizace.bourani.casOd ?? ""} disabled={disabled} />
            <Field label="Čas do" name="bourani_cas_do" type="time" defaultValue={d.organizace.bourani.casDo ?? ""} disabled={disabled} />
            <div className="md:col-span-2">
              <TextArea label="Poznámka k bourání" name="bourani_poznamka" defaultValue={d.organizace.bourani.poznamka} disabled={disabled} />
            </div>
            <div className="md:col-span-2">
              <TextArea label="Součinnost klienta" name="org_soucinnost_klienta" defaultValue={d.organizace.soucinnostKlienta} disabled={disabled} />
            </div>
          </div>
        </Section>

        <Section title="Technické plnění — setupy">
          {d.technickePlneni.setupy.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-300">
              {d.technickePlneni.setupy.map((row) => (
                <li key={row.setupId} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                  <span className="font-medium text-white">{row.nazev}</span>
                  <span className="text-slate-500"> · {row.oblast}</span>
                  <span className="text-slate-400"> · {row.mnozstvi}× setup</span>
                  {row.poznamkaKlienta ? (
                    <p className="mt-1 text-slate-400">Klient: {row.poznamkaKlienta}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">V poptávce nejsou vybrané setupy.</p>
          )}
          <TextArea
            label="Shrnutí / poznámka k technice (editovatelné)"
            name="technika_poznamka"
            defaultValue={d.technickePlneni.poznamkaKTechnice}
            rows={5}
            disabled={disabled}
          />
        </Section>

        <Section title="Smluvní podmínky">
          <div className="space-y-4">
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

        <Section title="Text pro klienta">
          <div className="space-y-4">
            <TextArea label="Úvodní text" name="text_uvod" defaultValue={d.textProKlienta.uvod} rows={3} disabled={disabled} />
            <TextArea label="Závěrečný text" name="text_zaver" defaultValue={d.textProKlienta.zaver} rows={3} disabled={disabled} />
            <TextArea label="Poznámka šéfa (interní tón pro klienta)" name="text_poznamka_sefa" defaultValue={d.textProKlienta.poznamkaSefa} rows={3} disabled={disabled} />
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6">
          {canEdit ? (
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Uložit návrh
            </button>
          ) : (
            <p className="text-sm text-slate-400">
              {readOnly
                ? "Nemáte oprávnění upravovat návrh objednávky."
                : "Tento draft nelze upravovat (není aktivní)."}
            </p>
          )}
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-500"
            title="Odeslání klientovi bude v dalším kroku"
          >
            Odeslat klientovi — připravuje se
          </button>
          <Link
            href={`/zakazky/poptavky/${poptavkaId}/objednavka/nahled`}
            className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900"
          >
            Náhled objednávky
          </Link>
          <Link
            href={`/zakazky/poptavky/${poptavkaId}`}
            className="text-sm text-blue-300 hover:text-blue-200"
          >
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
