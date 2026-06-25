import Link from "next/link";
import { redirect } from "next/navigation";
import PoptavkaFormClient from "@/components/portal/PoptavkaFormClient";
import PoptavkaFotkyClient from "@/components/portal/PoptavkaFotkyClient";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { CLIENT_POPTAVKA_STAV_LABELS, SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
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
  buildSestavaSummaryLines,
  sestavaFromOdpovediExtra,
} from "@/lib/client-portal/sestava-konfigurator-form";
import { loadPortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-server";
import PoptavkaSestavaSchema from "@/components/portal/PoptavkaSestavaSchema";
import { loadClientMistaKonaniForPortal, loadClientMistaKnowHowByIdForPortal } from "@/lib/client-portal/client-mista-server";
import { loadClientPreviousTechnikaOptionsForPortal } from "@/lib/client-portal/client-previous-technika-server";
import {
  isPoptavkaEditable,
  loadPoptavkaDetail,
  loadPortalSetups,
} from "@/lib/client-portal/poptavka-server";
import { SETUP_OBLASTI, type PoptavkaTechnickeUdaje } from "@/lib/client-portal/types";
import { createClient } from "@/lib/supabase/server";

function trimTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-100">{value}</dd>
    </div>
  );
}

function SestavaReadOnlySection({
  extra,
  katalog,
}: {
  extra: Record<string, unknown> | null | undefined;
  katalog: Awaited<ReturnType<typeof loadPortalSestavaKatalog>>;
}) {
  const state = sestavaFromOdpovediExtra(extra ?? {});
  const lines = buildSestavaSummaryLines(state, katalog);
  if (state.rezim === "atypicka") {
    return (
      <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold text-white">Konfigurace sestavy</h2>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Atypická technická poptávka — ruční návrh a nacenění
        </div>
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <PoptavkaSestavaSchema state={state} />
          <div className="whitespace-pre-wrap text-sm text-slate-200">
            {state.atypicka_poptavka_text || "Text atypické poptávky nebyl vyplněn."}
          </div>
        </div>
      </section>
    );
  }
  if (!state.stage_typ && lines.length === 0) {
    return (
      <section className="mt-8 space-y-3 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold text-white">Konfigurace sestavy</h2>
        <p className="text-sm text-slate-500">Sestava nebyla nakonfigurována.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
      <h2 className="text-lg font-semibold text-white">Konfigurace sestavy</h2>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <PoptavkaSestavaSchema state={state} />
        <ul className="space-y-1 text-sm text-slate-200">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TechnikaReadOnlySection({ row }: { row: PoptavkaTechnickeUdaje | null }) {
  if (!row) {
    return (
      <section className="mt-8 space-y-3 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold text-white">Technické údaje místa</h2>
        <p className="text-sm text-slate-500">Technické údaje nebyly doplněny.</p>
      </section>
    );
  }

  const extra = row.odpovedi_extra ?? {};

  return (
    <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
      <h2 className="text-lg font-semibold text-white">Technické údaje místa</h2>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <ReadOnlyField label="Příjezd" value={row.prijezd_poznamka} />
        <ReadOnlyField
          label="Lze zajet dodávkou"
          value={formatTriVolba(String(extra.lze_zajet_autem ?? ""))}
        />
        <ReadOnlyField label="Parkování" value={row.parkovani_poznamka} />
        <ReadOnlyField label="Rozvaděče" value={row.rozvadece_poznamka} />
        <ReadOnlyField label="Přípojka / proud" value={row.elektro_pripojka} />
        <ReadOnlyField label="Jištění / okruhy" value={row.elektro_jisteni} />
        <ReadOnlyField label="Typ zásuvky" value={row.elektro_zasuvka} />
        <ReadOnlyField
          label="Vzdálenost elektřiny"
          value={
            row.elektro_vzdalenost_m != null ? `${row.elektro_vzdalenost_m} m` : null
          }
        />
        <ReadOnlyField label="Kabelové trasy" value={row.kabelove_trasy} />
        <ReadOnlyField
          label="Kabel přes silnici"
          value={formatTriVolba(String(extra.kabel_pres_silnici ?? ""))}
        />
        <ReadOnlyField label="Místo pro stage" value={row.misto_stage} />
        <ReadOnlyField label="Místo pro FOH" value={row.misto_foh} />
        <ReadOnlyField label="Omezení hluku" value={row.omezeni_hluku} />
        <ReadOnlyField label="Časová omezení" value={row.casova_omezeni} />
        <ReadOnlyField label="Další poznámky" value={row.dalsi_poznamky} />
        <div>
          <dt className="text-slate-500">Výjezd technika</dt>
          <dd className="text-slate-100">
            {row.pozadovan_vyjezd_technika ? "Ano" : "Ne"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default async function PortalPoptavkaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string; submitted?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);

  if (session.kind !== "active") {
    redirect(`/portal/prihlaseni?next=/portal/poptavka/${id}`);
  }

  const detail = await loadPoptavkaDetail(supabase, id);
  if (!detail) {
    redirect("/portal/poptavky?error=not_found");
  }

  const editable = isPoptavkaEditable(detail);

  if (editable) {
    const [
      { data: klient },
      setupsByOblast,
      savedMista,
      previousTechnikaOptions,
      sestavaKatalog,
    ] = await Promise.all([
      supabase
        .from("klienti")
        .select("nazev, ico, email, telefon")
        .eq("klient_id", session.account.klient_id!)
        .single(),
      loadPortalSetups(supabase),
      loadClientMistaKonaniForPortal(supabase),
      loadClientPreviousTechnikaOptionsForPortal(supabase, {
        excludePoptavkaId: detail.poptavka_id,
      }),
      loadPortalSestavaKatalog(),
    ]);

    const savedMistaKnowHowById = await loadClientMistaKnowHowByIdForPortal(
      supabase,
      savedMista.map((misto) => misto.misto_id)
    );

    const kontaktJmeno = [session.account.jmeno, session.account.prijmeni]
      .filter(Boolean)
      .join(" ");

    return (
      <PoptavkaFormClient
        mode="edit"
        poptavkaId={detail.poptavka_id}
        prefill={{
          kontakt_jmeno: kontaktJmeno,
          kontakt_telefon: session.account.telefon ?? klient?.telefon ?? "",
          kontakt_email: detail.kontakt_email ?? klient?.email ?? "",
          firma_nazev: session.klientNazev ?? klient?.nazev ?? "",
          firma_ico: klient?.ico ?? "",
        }}
        setupsByOblast={setupsByOblast}
        savedMista={savedMista}
        savedMistaKnowHowById={savedMistaKnowHowById}
        previousTechnikaOptions={previousTechnikaOptions}
        sestavaKatalog={sestavaKatalog}
        initialSestava={sestavaFromOdpovediExtra(detail.technicke_udaje?.odpovedi_extra ?? {})}
        initialValues={{
          kontakt_jmeno: detail.kontakt_jmeno ?? "",
          kontakt_telefon: detail.kontakt_telefon ?? "",
          kontakt_email: detail.kontakt_email ?? "",
          misto_nazev: detail.misto_nazev ?? "",
          typ_akce: detail.typ_akce ?? "",
          misto_adresa: detail.misto_adresa ?? "",
          datum_od: detail.datum_od ?? "",
          datum_do: detail.datum_do ?? "",
          cas_programu_od: trimTime(detail.cas_programu_od),
          cas_programu_do: trimTime(detail.cas_programu_do),
          misto_poznamka: detail.misto_poznamka ?? "",
          misto_source: detail.misto_id ? "saved" : "new",
          misto_id: detail.misto_id,
          misto_lat: detail.misto_lat,
          misto_lng: detail.misto_lng,
          setupy: detail.setupy.map((row) => ({
            setup_id: row.setup_id,
            mnozstvi: row.mnozstvi,
            poznamka_klienta: row.poznamka_klienta,
          })),
        }}
        initialTechnika={technikaFromRecord(detail.technicke_udaje)}
        initialFotky={detail.fotky}
        errorCode={resolvedSearchParams?.error ?? null}
        saved={resolvedSearchParams?.saved === "1"}
        submitted={resolvedSearchParams?.submitted === "1"}
        revisionNote={
          detail.stav === "v_revizi" ? detail.zamitnuto_duvod : null
        }
      />
    );
  }

  const setupyByOblast = SETUP_OBLASTI.map((oblast) => ({
    oblast,
    rows: detail.setupy.filter((row) => row.setup.oblast === oblast),
  })).filter((group) => group.rows.length > 0);

  const sestavaKatalog = await loadPortalSestavaKatalog();

  return (
    <PortalShell showBackToPortal showMainNav>
      <PortalCard title="Detail poptávky">
        {detail.stav === "zamitnuta" && detail.zamitnuto_duvod ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <span className="font-semibold">Důvod zamítnutí:</span> {detail.zamitnuto_duvod}
          </p>
        ) : null}
        {detail.stav === "v_revizi" && detail.zamitnuto_duvod ? (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Poptávka byla vrácena k doplnění</p>
            <p className="mt-2 whitespace-pre-wrap">{detail.zamitnuto_duvod}</p>
            <p className="mt-3 text-amber-200/90">
              Upravte poptávku podle poznámky a znovu ji odešlete.
            </p>
          </div>
        ) : null}
        {detail.stav === "schvalena" ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Poptávka byla interně schválena k převodu. WEST COUNTY připravuje další kroky.
          </p>
        ) : null}
        {detail.stav === "objednavka_odeslana" ? (
          <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            <p className="font-semibold">Závazná objednávka čeká na vaše potvrzení</p>
            <p className="mt-2 text-blue-200/90">
              WEST COUNTY vám zaslala závaznou objednávku. Potvrzení bude brzy dostupné přímo v
              klientské zóně.
            </p>
          </div>
        ) : null}
        {detail.stav === "objednavka_potvrzena" ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Závaznou objednávku jste potvrdili. WEST COUNTY nyní připravuje další kroky.
            {detail.objednavka_potvrzena_at
              ? ` Potvrzeno ${new Intl.DateTimeFormat("cs-CZ", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(detail.objednavka_potvrzena_at))}.`
              : null}
          </p>
        ) : null}
        {detail.stav === "objednavka_odmitnuta" ? (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Závaznou objednávku jste odmítli.</p>
            {detail.objednavka_odmitnuta_duvod ? (
              <p className="mt-2 whitespace-pre-wrap">{detail.objednavka_odmitnuta_duvod}</p>
            ) : null}
            <p className="mt-3 text-amber-200/90">
              Pokud chcete pokračovat v jednání, kontaktujte WEST COUNTY.
            </p>
          </div>
        ) : null}
        {detail.stav === "prevadena_do_zakazky" && detail.zakazka_id ? (
          <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            <p>Poptávka byla převedena do interní zakázky.</p>
            <Link
              href={`/portal/zakazky/${detail.zakazka_id}`}
              className="mt-2 inline-flex font-semibold text-blue-200 hover:text-blue-100"
            >
              Zobrazit zakázku →
            </Link>
          </div>
        ) : null}
        {detail.stav === "odeslana" ? (
          <p className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            Poptávka čeká na kontrolu WEST COUNTY.
            {detail.odeslano_at
              ? ` Odesláno ${new Intl.DateTimeFormat("cs-CZ", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(detail.odeslano_at))}.`
              : null}
          </p>
        ) : null}
        {resolvedSearchParams?.submitted === "1" ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Poptávka byla znovu odeslána a čeká na kontrolu WEST COUNTY.
          </p>
        ) : null}
        {resolvedSearchParams?.saved === "1" ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Poptávka byla uložena.
          </p>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {detail.cislo_poptavky}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {detail.misto_nazev || "Bez názvu akce"}
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            {CLIENT_POPTAVKA_STAV_LABELS[detail.stav]}
          </span>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Kontakt</dt>
            <dd className="text-slate-100">{detail.kontakt_jmeno ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Telefon / e-mail</dt>
            <dd className="text-slate-100">
              {[detail.kontakt_telefon, detail.kontakt_email].filter(Boolean).join(" · ") ||
                "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Typ akce</dt>
            <dd className="text-slate-100">{formatTypAkce(detail.typ_akce)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Termín</dt>
            <dd className="text-slate-100">
              {formatPoptavkaDateRange(detail.datum_od, detail.datum_do)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Místo</dt>
            <dd className="text-slate-100">{detail.misto_adresa ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Program od / do</dt>
            <dd className="text-slate-100">
              {formatPoptavkaTime(detail.cas_programu_od)} –{" "}
              {formatPoptavkaTime(detail.cas_programu_do)}
            </dd>
          </div>
          {detail.misto_poznamka ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Poznámka k místu</dt>
              <dd className="text-slate-100">{detail.misto_poznamka}</dd>
            </div>
          ) : null}
        </dl>

        <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <h2 className="text-lg font-semibold text-white">Vybrané setupy</h2>
          {setupyByOblast.length === 0 ? (
            <p className="text-sm text-slate-500">Nebyly vybrány žádné setupy.</p>
          ) : (
            setupyByOblast.map((group) => (
              <div key={group.oblast} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-amber-200/90">
                  {SETUP_OBLAST_LABELS[group.oblast]}
                </h3>
                <ul className="space-y-2">
                  {group.rows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm"
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
            ))
          )}
        </section>

        <SestavaReadOnlySection
          extra={detail.technicke_udaje?.odpovedi_extra ?? {}}
          katalog={sestavaKatalog}
        />

        <TechnikaReadOnlySection row={detail.technicke_udaje} />

        <div className="mt-8 border-t border-white/10 pt-8">
          <PoptavkaFotkyClient
            poptavkaId={detail.poptavka_id}
            initialFotky={detail.fotky}
            readOnly
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/portal/poptavky"
            className="text-sm font-medium text-amber-200 hover:text-amber-100"
          >
            ← Seznam poptávek
          </Link>
          {detail.zakazka_id ? (
            <Link
              href={`/portal/zakazky/${detail.zakazka_id}`}
              className="text-sm font-medium text-blue-300 hover:text-blue-200"
            >
              Zobrazit zakázku →
            </Link>
          ) : null}
        </div>
      </PortalCard>
    </PortalShell>
  );
}
