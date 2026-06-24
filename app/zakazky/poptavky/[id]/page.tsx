import Link from "next/link";
import { headers } from "next/headers";
import PoptavkaFotkyClient from "@/components/portal/PoptavkaFotkyClient";
import { verifyInternalPoptavkyReadPage } from "@/lib/auth/admin-access-server";
import { loadSessionRolePermissions } from "@/lib/auth/internal-role-access-server";
import { POPTAVKA_STAV_LABELS, SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import {
  formatPoptavkaDateRange,
  formatPoptavkaTime,
  formatTypAkce,
} from "@/lib/client-portal/poptavka-form";
import {
  formatTriVolba,
  technikaFromRecord,
} from "@/lib/client-portal/poptavka-technika-form";
import {
  canConvertPoptavkaToZakazka,
} from "@/lib/client-portal/convert-poptavka-to-zakazka";
import {
  formatPoptavkaOutboundForCopy,
  getPortalAppBaseUrl,
  preparePoptavkaOutboundMessage,
  type PoptavkaOutboundKind,
} from "@/lib/client-portal/poptavka-email-server";
import {
  canInternalActOnPoptavka,
  loadInternalPoptavkaDetail,
} from "@/lib/client-portal/poptavka-internal-server";
import { loadPoptavkaObjednavkaDraft } from "@/lib/client-portal/poptavka-objednavka-draft-server";
import { loadActivePoptavkaObjednavkaLink } from "@/lib/client-portal/poptavka-objednavka-link-server";
import type { PoptavkaStav } from "@/lib/client-portal/types";
import { SETUP_OBLASTI } from "@/lib/client-portal/types";
import { createClient } from "@/lib/supabase/server";
import PoptavkaInboxActions, {
  PoptavkaInterniPoznamkaForm,
} from "../PoptavkaInboxActions";
import PoptavkaOutboundMessagePanel from "../PoptavkaOutboundMessagePanel";

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-100">{value}</dd>
    </div>
  );
}

const SAVED_MESSAGES: Record<string, string> = {
  revision: "Klient byl požádán o doplnění poptávky.",
  rejected: "Poptávka byla odmítnuta.",
  approved:
    "Poptávka byla schválena k převodu. Závazná objednávka klientem bude řešena v dalším kroku workflow.",
  note: "Interní poznámka byla uložena.",
  converted: "Interní zakázka byla vytvořena.",
};

const EMAIL_STATUS_MESSAGES: Record<string, string> = {
  sent: "Klientovi byl odeslán informační e-mail s odkazem do klientské zóny.",
  missing_email:
    "Stav poptávky byl uložen, ale klient nemá dostupný e-mail pro upozornění.",
  missing_resend_key:
    "Stav poptávky byl uložen, ale chybí RESEND_API_KEY — e-mail klientovi nebyl odeslán.",
  missing_base_url:
    "Stav poptávky byl uložen, ale nepodařilo se sestavit veřejnou URL aplikace pro e-mail.",
  failed: "Stav poptávky byl uložen, ale odeslání e-mailu klientovi selhalo.",
};

const SAVED_TO_OUTBOUND_KIND: Partial<
  Record<string, Exclude<PoptavkaOutboundKind, "binding_order">>
> = {
  revision: "revision",
  rejected: "rejected",
};

function canShowObjednavkaEditorLink(stav: PoptavkaStav) {
  return (
    stav === "odeslana" ||
    stav === "v_revizi" ||
    stav === "objednavka_odeslana" ||
    stav === "objednavka_potvrzena" ||
    stav === "objednavka_odmitnuta" ||
    stav === "schvalena"
  );
}

export default async function ZakazkyPoptavkaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string; zakazka?: string; email?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const supabase = await createClient();
  const [{ perms }, access] = await Promise.all([
    loadSessionRolePermissions(supabase),
    verifyInternalPoptavkyReadPage(supabase),
  ]);
  const readOnly = !perms.zakazkyEditace;

  if (!access.ok) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Detail poptávky</h1>
        <p className="mt-4 text-red-400">{access.message}</p>
      </div>
    );
  }

  const detail = await loadInternalPoptavkaDetail(supabase, id);
  if (!detail) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Detail poptávky</h1>
        <p className="mt-4 text-red-400">Poptávka nenalezena.</p>
        <Link href="/zakazky/poptavky" className="mt-4 inline-block text-blue-300">
          ← Seznam poptávek
        </Link>
      </div>
    );
  }

  const technika = technikaFromRecord(detail.technicke_udaje);
  const extra = detail.technicke_udaje?.odpovedi_extra ?? {};
  const setupyByOblast = SETUP_OBLASTI.map((oblast) => ({
    oblast,
    rows: detail.setupy.filter((row) => row.setup.oblast === oblast),
  })).filter((group) => group.rows.length > 0);

  const savedKey = resolvedSearchParams?.saved;
  const emailStatus = resolvedSearchParams?.email ?? null;
  const outboundKind = savedKey ? SAVED_TO_OUTBOUND_KIND[savedKey] : undefined;
  const outboundMessage =
    outboundKind && emailStatus && emailStatus !== "sent"
      ? await preparePoptavkaOutboundMessage({
          kind: outboundKind,
          detail,
          baseUrl: getPortalAppBaseUrl(await headers()),
          duvod: detail.zamitnuto_duvod,
        })
      : null;
  const canAct = canInternalActOnPoptavka(detail.stav);
  const canConvert = canConvertPoptavkaToZakazka(detail);
  const showObjednavkaLink = canShowObjednavkaEditorLink(detail.stav);
  const existingObjednavkaDraft = showObjednavkaLink
    ? await loadPoptavkaObjednavkaDraft(supabase, id)
    : null;
  const activeObjednavkaLink =
    detail.stav === "objednavka_odeslana"
      ? await loadActivePoptavkaObjednavkaLink(supabase, id)
      : null;
  const convertedZakazkaId =
    detail.zakazka_id ?? resolvedSearchParams?.zakazka ?? null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
            {detail.cislo_poptavky}
          </div>
          <h1 className="mt-1 text-3xl font-bold text-white">
            {detail.misto_nazev || "Poptávka bez názvu akce"}
          </h1>
          <p className="mt-2 text-slate-400">
            {detail.klient?.nazev ?? "—"}
            {detail.klient?.ico ? ` · IČO ${detail.klient.ico}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showObjednavkaLink && !readOnly ? (
            detail.stav === "objednavka_odeslana" ? (
              <Link
                href={`/zakazky/poptavky/${id}/objednavka`}
                className="rounded-xl border border-blue-500/40 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-950/40"
              >
                Závazná objednávka odeslána
              </Link>
            ) : (
              <Link
                href={`/zakazky/poptavky/${id}/objednavka`}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                {existingObjednavkaDraft ? "Pokračovat v objednávce" : "Připravit závaznou objednávku"}
              </Link>
            )
          ) : null}
          {showObjednavkaLink && readOnly && existingObjednavkaDraft ? (
            <Link
              href={`/zakazky/poptavky/${id}/objednavka`}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
            >
              Zobrazit návrh objednávky
            </Link>
          ) : null}
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-200">
            {POPTAVKA_STAV_LABELS[detail.stav]}
          </span>
          <Link href="/zakazky/poptavky" className="text-sm text-blue-300 hover:text-blue-200">
            ← Poptávky
          </Link>
        </div>
      </div>

      {detail.stav === "objednavka_odeslana" ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm text-blue-100">
            Závazná objednávka byla odeslána klientovi a čeká na jeho potvrzení.
            {detail.objednavka_odeslana_at
              ? ` Odesláno ${new Intl.DateTimeFormat("cs-CZ", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(detail.objednavka_odeslana_at))}.`
              : null}
          </p>
          {activeObjednavkaLink ? (
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
              <p className="font-semibold text-slate-100">Aktivní odkaz pro klienta</p>
              <dl className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                <div>
                  <dt className="inline">Komu: </dt>
                  <dd className="inline text-slate-200">
                    {activeObjednavkaLink.email_to ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Stav linku: </dt>
                  <dd className="inline text-slate-200">{activeObjednavkaLink.stav}</dd>
                </div>
                {activeObjednavkaLink.expires_at ? (
                  <div>
                    <dt className="inline">Platnost do: </dt>
                    <dd className="inline text-slate-200">
                      {new Intl.DateTimeFormat("cs-CZ", {
                        day: "numeric",
                        month: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(activeObjednavkaLink.expires_at))}
                    </dd>
                  </div>
                ) : null}
                {activeObjednavkaLink.email_sent_at ? (
                  <div>
                    <dt className="inline">E-mail odeslán: </dt>
                    <dd className="inline text-slate-200">
                      {new Intl.DateTimeFormat("cs-CZ", {
                        day: "numeric",
                        month: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(activeObjednavkaLink.email_sent_at))}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-2 text-xs text-slate-500">
                Plná URL odkazu není uložena v systému (bezpečnost tokenu). Zkopírujte ji z e-mailu
                nebo z panelu po odeslání v editoru objednávky.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {detail.stav === "objednavka_potvrzena" ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
          Klient potvrdil závaznou objednávku.
          {detail.objednavka_potvrzena_at
            ? ` Potvrzeno ${new Intl.DateTimeFormat("cs-CZ", {
                day: "numeric",
                month: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(detail.objednavka_potvrzena_at))}`
            : null}
          {detail.objednavka_potvrzena_zpusob
            ? ` (${detail.objednavka_potvrzena_zpusob === "portal" ? "klientská zóna" : "odkaz"})`
            : null}
          . Další krok: schválení k převodu na zakázku.
        </p>
      ) : null}
      {detail.stav === "objednavka_odmitnuta" ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Klient závaznou objednávku odmítl.</p>
          {detail.objednavka_odmitnuta_duvod ? (
            <p className="mt-2 whitespace-pre-wrap">{detail.objednavka_odmitnuta_duvod}</p>
          ) : null}
        </div>
      ) : null}

      {savedKey && SAVED_MESSAGES[savedKey] ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
            {SAVED_MESSAGES[savedKey]}
            {savedKey === "converted" && convertedZakazkaId ? (
              <>
                {" "}
                <Link href={`/zakazky/${convertedZakazkaId}`} className="font-semibold underline">
                  Otevřít zakázku
                </Link>
              </>
            ) : null}
          </p>
          {outboundKind && emailStatus && EMAIL_STATUS_MESSAGES[emailStatus] ? (
            <p
              className={[
                "rounded-lg border px-4 py-3 text-sm",
                emailStatus === "sent"
                  ? "border-blue-500/30 bg-blue-950/20 text-blue-100"
                  : "border-amber-500/30 bg-amber-950/20 text-amber-100",
              ].join(" ")}
            >
              {EMAIL_STATUS_MESSAGES[emailStatus]}
            </p>
          ) : null}
          {outboundMessage ? (
            <PoptavkaOutboundMessagePanel
              subject={outboundMessage.subject}
              fullText={formatPoptavkaOutboundForCopy(outboundMessage)}
              bodyText={outboundMessage.text}
              link={outboundMessage.link}
              emailTo={outboundMessage.emailTo}
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
          <h2 className="text-lg font-semibold text-white">Klient a kontakt</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <ReadOnlyField label="Firma" value={detail.klient?.nazev} />
            <ReadOnlyField label="IČO" value={detail.klient?.ico} />
            <ReadOnlyField label="DIČ" value={detail.klient?.dic} />
            <ReadOnlyField
              label="Adresa firmy"
              value={[detail.klient?.ulice, detail.klient?.mesto, detail.klient?.psc]
                .filter(Boolean)
                .join(", ")}
            />
            <ReadOnlyField label="Kontaktní osoba" value={detail.kontakt_jmeno} />
            <ReadOnlyField
              label="Telefon / e-mail"
              value={[detail.kontakt_telefon, detail.kontakt_email].filter(Boolean).join(" · ")}
            />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
          <h2 className="text-lg font-semibold text-white">Akce — místo a termín</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <ReadOnlyField label="Typ akce" value={formatTypAkce(detail.typ_akce)} />
            <ReadOnlyField label="Místo / adresa" value={detail.misto_adresa} />
            <ReadOnlyField
              label="Termín"
              value={formatPoptavkaDateRange(detail.datum_od, detail.datum_do)}
            />
            <ReadOnlyField
              label="Program"
              value={`${formatPoptavkaTime(detail.cas_programu_od)} – ${formatPoptavkaTime(detail.cas_programu_do)}`}
            />
            <ReadOnlyField label="Poznámka klienta k místu" value={detail.misto_poznamka} />
            {detail.zamitnuto_duvod && detail.stav === "zamitnuta" ? (
              <ReadOnlyField label="Důvod zamítnutí" value={detail.zamitnuto_duvod} />
            ) : null}
            {detail.zamitnuto_duvod && detail.stav === "v_revizi" ? (
              <ReadOnlyField label="Poznámka k doplnění" value={detail.zamitnuto_duvod} />
            ) : null}
            {detail.objednavka_odmitnuta_duvod && detail.stav === "objednavka_odmitnuta" ? (
              <ReadOnlyField
                label="Důvod odmítnutí objednávky klientem"
                value={detail.objednavka_odmitnuta_duvod}
              />
            ) : null}
          </dl>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-lg font-semibold text-white">Vybrané setupy</h2>
        {setupyByOblast.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Klient nevybral žádné setupy.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {setupyByOblast.map((group) => (
              <div key={group.oblast}>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-blue-300">
                  {SETUP_OBLAST_LABELS[group.oblast]}
                </h3>
                <ul className="mt-2 space-y-2">
                  {group.rows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm"
                    >
                      <div className="font-medium text-white">
                        {row.setup.nazev}{" "}
                        <span className="text-slate-400">× {row.mnozstvi}</span>
                      </div>
                      {row.poznamka_klienta ? (
                        <p className="mt-1 text-slate-400">{row.poznamka_klienta}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-lg font-semibold text-white">Technické údaje místa</h2>
        {!detail.technicke_udaje ? (
          <p className="mt-3 text-sm text-slate-500">Technické údaje nebyly doplněny.</p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <ReadOnlyField label="Příjezd" value={technika.prijezd_poznamka} />
            <ReadOnlyField
              label="Lze zajet dodávkou"
              value={formatTriVolba(String(extra.lze_zajet_autem ?? ""))}
            />
            <ReadOnlyField label="Parkování" value={technika.parkovani_poznamka} />
            <ReadOnlyField label="Rozvaděče" value={technika.rozvadece_poznamka} />
            <ReadOnlyField label="Přípojka / proud" value={technika.elektro_pripojka} />
            <ReadOnlyField label="Jištění" value={technika.elektro_jisteni} />
            <ReadOnlyField label="Zásuvka" value={technika.elektro_zasuvka} />
            <ReadOnlyField
              label="Vzdálenost elektřiny"
              value={
                technika.elektro_vzdalenost_m ? `${technika.elektro_vzdalenost_m} m` : null
              }
            />
            <ReadOnlyField label="Kabelové trasy" value={technika.kabelove_trasy} />
            <ReadOnlyField
              label="Kabel přes silnici"
              value={formatTriVolba(String(extra.kabel_pres_silnici ?? ""))}
            />
            <ReadOnlyField label="Místo pro stage" value={technika.misto_stage} />
            <ReadOnlyField label="Místo pro FOH" value={technika.misto_foh} />
            <ReadOnlyField label="Omezení hluku" value={technika.omezeni_hluku} />
            <ReadOnlyField label="Časová omezení" value={technika.casova_omezeni} />
            <ReadOnlyField label="Další poznámky" value={technika.dalsi_poznamky} />
            <div>
              <dt className="text-slate-500">Výjezd technika</dt>
              <dd className="text-slate-100">
                {technika.pozadovan_vyjezd_technika ? "Ano" : "Ne"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <PoptavkaFotkyClient
          poptavkaId={detail.poptavka_id}
          initialFotky={detail.fotky}
          readOnly
        />
      </section>

      <PoptavkaInterniPoznamkaForm
        poptavkaId={detail.poptavka_id}
        defaultValue={detail.interni_poznamka ?? ""}
        readOnly={readOnly}
      />

      <PoptavkaInboxActions
        poptavkaId={detail.poptavka_id}
        stav={detail.stav}
        canAct={canAct && !readOnly}
        canConvert={canConvert && !readOnly}
        zakazkaId={convertedZakazkaId}
        errorCode={resolvedSearchParams?.error ?? null}
        readOnly={readOnly}
      />
    </div>
  );
}
