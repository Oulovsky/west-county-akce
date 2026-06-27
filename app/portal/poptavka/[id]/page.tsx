import Link from "next/link";
import { redirect } from "next/navigation";
import PoptavkaFormClient from "@/components/portal/PoptavkaFormClient";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { CLIENT_POPTAVKA_STAV_LABELS, SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import {
  formatPoptavkaDateRange,
  formatPoptavkaTime,
  formatTypAkce,
} from "@/lib/client-portal/poptavka-form";
import { logistikaOknaFromPoptavka } from "@/lib/logistika-okna";
import PoptavkaLogistikaOknaPanel from "@/components/portal/PoptavkaLogistikaOknaPanel";
import PoptavkaMistoReadOnly from "@/components/portal/PoptavkaMistoReadOnly";
import PoptavkaTechnickePodminkyReadOnly from "@/components/portal/PoptavkaTechnickePodminkyReadOnly";
import { PoptavkaObjednavkaPortalSection } from "@/components/portal/PoptavkaObjednavkaPortalSection";
import { technikaFromRecord } from "@/lib/client-portal/poptavka-technika-form";
import {
  buildSestavaSummaryLines,
  sestavaFromOdpovediExtra,
} from "@/lib/client-portal/sestava-konfigurator-form";
import { loadPortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-server";
import { loadClientMistaKonaniForPortal, loadClientMistaKnowHowByIdForPortal } from "@/lib/client-portal/client-mista-server";
import { loadPortalPoptavkaObjednavkaDecisionView } from "@/lib/client-portal/poptavka-objednavka-link-server";
import {
  isPoptavkaEditable,
  loadPoptavkaDetail,
  loadPortalSetups,
} from "@/lib/client-portal/poptavka-server";
import { SETUP_OBLASTI } from "@/lib/client-portal/types";
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
        <div className="whitespace-pre-wrap text-sm text-slate-200">
          {state.atypicka_poptavka_text || "Text atypické poptávky nebyl vyplněn."}
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
      <ul className="space-y-1 text-sm text-slate-200">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function PortalPoptavkaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string; submitted?: string; technik_vyjezd_ordered?: string }>;
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
    const [{ data: klient }, setupsByOblast, savedMista, sestavaKatalog] = await Promise.all([
      supabase
        .from("klienti")
        .select("nazev, ico, email, telefon")
        .eq("klient_id", session.account.klient_id!)
        .single(),
      loadPortalSetups(supabase),
      loadClientMistaKonaniForPortal(supabase),
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
        sestavaKatalog={sestavaKatalog}
        initialSestava={sestavaFromOdpovediExtra(detail.technicke_udaje?.odpovedi_extra ?? {})}
        initialValues={{
          wizard_krok: detail.wizard_krok ?? 1,
          kontakt_jmeno: detail.kontakt_jmeno ?? "",
          kontakt_telefon: detail.kontakt_telefon ?? "",
          kontakt_email: detail.kontakt_email ?? "",
          misto_nazev: detail.misto_nazev ?? "",
          typ_akce: detail.typ_akce ?? "",
          misto_adresa: detail.misto_adresa ?? "",
          presny_popis_mista: detail.presny_popis_mista ?? "",
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
          ...logistikaOknaFromPoptavka(detail),
        }}
        initialTechnika={technikaFromRecord(detail.technicke_udaje)}
        initialFotky={detail.fotky}
        errorCode={resolvedSearchParams?.error ?? null}
        saved={resolvedSearchParams?.saved === "1"}
        submitted={resolvedSearchParams?.submitted === "1"}
        technikVyjezdOrdered={resolvedSearchParams?.technik_vyjezd_ordered === "1"}
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

  const objednavkaView =
    detail.stav === "objednavka_odeslana" ||
    detail.stav === "objednavka_potvrzena" ||
    detail.stav === "objednavka_odmitnuta"
      ? await loadPortalPoptavkaObjednavkaDecisionView(
          id,
          session.account.klient_id!,
          detail.stav
        )
      : null;

  return (
    <PortalShell showBackToPortal showMainNav>
      <PortalCard title="Detail poptávky">
        {detail.stav === "zamitnuta" ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Poptávka byla odmítnuta z důvodu vytíženosti. Děkujeme za pochopení.
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
        {detail.stav === "objednavka_odeslana" ||
        detail.stav === "objednavka_potvrzena" ||
        detail.stav === "objednavka_odmitnuta" ? (
          <PoptavkaObjednavkaPortalSection
            poptavkaId={id}
            stav={detail.stav}
            view={objednavkaView}
            potvrzenaAt={detail.objednavka_potvrzena_at}
            odmitnutaDuvod={detail.objednavka_odmitnuta_duvod}
          />
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
        </dl>

        <PoptavkaMistoReadOnly
          mistoAdresa={detail.misto_adresa}
          presnyPopisMista={detail.presny_popis_mista}
          mistoLat={detail.misto_lat}
          mistoLng={detail.misto_lng}
        />

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
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

        <div className="mt-6">
          <PoptavkaLogistikaOknaPanel
            mode="read"
            values={logistikaOknaFromPoptavka(detail)}
          />
        </div>

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

        <PoptavkaTechnickePodminkyReadOnly row={detail.technicke_udaje} fotky={detail.fotky} />

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
