import Link from "next/link";
import { redirect } from "next/navigation";
import PoptavkaFormClient from "@/components/portal/PoptavkaFormClient";
import PoptavkaFotkyClient from "@/components/portal/PoptavkaFotkyClient";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
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
    const [{ data: klient }, setupsByOblast] = await Promise.all([
      supabase
        .from("klienti")
        .select("nazev, ico, email, telefon")
        .eq("klient_id", session.account.klient_id!)
        .single(),
      loadPortalSetups(supabase),
    ]);

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

  return (
    <PortalShell showBackToPortal>
      <PortalCard title="Detail poptávky">
        {detail.stav === "zamitnuta" && detail.zamitnuto_duvod ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <span className="font-semibold">Důvod zamítnutí:</span> {detail.zamitnuto_duvod}
          </p>
        ) : null}
        {detail.stav === "schvalena" ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Poptávka byla schválena WEST COUNTY.
          </p>
        ) : null}
        {detail.stav === "odeslana" || detail.stav === "ceka_na_schvaleni" ? (
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
            {POPTAVKA_STAV_LABELS[detail.stav]}
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
        </div>
      </PortalCard>
    </PortalShell>
  );
}
