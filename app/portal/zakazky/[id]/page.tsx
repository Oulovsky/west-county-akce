import Link from "next/link";
import { redirect } from "next/navigation";
import PoptavkaFotkyClient from "@/components/portal/PoptavkaFotkyClient";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { guardVerifiedClientPortalPage } from "@/lib/auth/client-portal-route-guard";
import { SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import {
  formatPoptavkaTime,
  formatTypAkce,
} from "@/lib/client-portal/poptavka-form";
import {
  formatTriVolba,
  technikaFromRecord,
} from "@/lib/client-portal/poptavka-technika-form";
import { SETUP_OBLASTI } from "@/lib/client-portal/types";
import {
  formatClientZakazkaStatus,
  formatClientZakazkaTermin,
  loadClientZakazkaDetail,
} from "@/lib/client-portal/zakazka-server";
import { createClient } from "@/lib/supabase/server";

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-100">{value}</dd>
    </div>
  );
}

export default async function PortalZakazkaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);

  guardVerifiedClientPortalPage(session, `/portal/zakazky/${id}`);

  const detail = await loadClientZakazkaDetail(supabase, id);
  if (!detail) {
    redirect("/portal/zakazky?error=not_found");
  }

  const technika = technikaFromRecord(detail.technicke_udaje);
  const extra = detail.technicke_udaje?.odpovedi_extra ?? {};
  const setupyByOblast = SETUP_OBLASTI.map((oblast) => ({
    oblast,
    rows: detail.setupy.filter((row) => row.setup.oblast === oblast),
  })).filter((group) => group.rows.length > 0);

  const programFrom =
    detail.sourcePoptavka?.cas_programu_od ?? detail.cas_od ?? null;
  const programTo =
    detail.sourcePoptavka?.cas_programu_do ?? detail.cas_do ?? null;

  return (
    <PortalShell showBackToPortal showMainNav>
      <PortalCard title="Detail zakázky">
        <p className="mb-6 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          Toto je informativní náhled zakázky. Pro změny kontaktujte WEST COUNTY nebo upravte
          poptávku, pokud je stále otevřená k doplnění.
        </p>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {detail.sourcePoptavka?.cislo_poptavky
                ? `Z poptávky ${detail.sourcePoptavka.cislo_poptavky}`
                : "Interní zakázka"}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {detail.nazev || "Bez názvu akce"}
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
            {formatClientZakazkaStatus(detail)}
          </span>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Místo</dt>
            <dd className="text-slate-100">{detail.misto ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Termín</dt>
            <dd className="text-slate-100">{formatClientZakazkaTermin(detail)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Program od / do</dt>
            <dd className="text-slate-100">
              {formatPoptavkaTime(programFrom)} – {formatPoptavkaTime(programTo)}
            </dd>
          </div>
          {detail.sourcePoptavka?.typ_akce ? (
            <div>
              <dt className="text-slate-500">Typ akce</dt>
              <dd className="text-slate-100">{formatTypAkce(detail.sourcePoptavka.typ_akce)}</dd>
            </div>
          ) : null}
          {detail.sourcePoptavka?.misto_poznamka ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Poznámka k místu</dt>
              <dd className="text-slate-100">{detail.sourcePoptavka.misto_poznamka}</dd>
            </div>
          ) : null}
        </dl>

        {detail.sourcePoptavka ? (
          <section className="mt-8 space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold text-white">Zdrojová poptávka</h2>
            <p className="text-sm text-slate-400">
              Zakázka vznikla z vaší poptávky{" "}
              <Link
                href={`/portal/poptavka/${detail.sourcePoptavka.poptavka_id}`}
                className="font-semibold text-amber-200 hover:text-amber-100"
              >
                {detail.sourcePoptavka.cislo_poptavky}
              </Link>
              .
            </p>
          </section>
        ) : null}

        <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <h2 className="text-lg font-semibold text-white">Plánovaná technika</h2>
          <p className="text-sm text-slate-400">
            Přehled vybraných setupů z poptávky. Konkrétní skladové kusy se přiřazují interně při
            přípravě akce.
          </p>
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
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                    >
                      <div className="font-medium text-white">
                        {row.setup.nazev}{" "}
                        <span className="text-slate-400">× {row.mnozstvi}</span>
                      </div>
                      {row.setup.portal_popis ? (
                        <p className="mt-1 text-slate-400">{row.setup.portal_popis}</p>
                      ) : null}
                      {row.poznamka_klienta ? (
                        <p className="mt-1 text-slate-500">{row.poznamka_klienta}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <h2 className="text-lg font-semibold text-white">Technické údaje místa</h2>
          {!detail.technicke_udaje ? (
            <p className="text-sm text-slate-500">Technické údaje nebyly doplněny.</p>
          ) : (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <ReadOnlyField label="Příjezd" value={technika.prijezd_poznamka} />
              <ReadOnlyField
                label="Lze zajet dodávkou"
                value={formatTriVolba(String(extra.lze_zajet_autem ?? ""))}
              />
              <ReadOnlyField label="Parkování" value={technika.parkovani_poznamka} />
              <ReadOnlyField label="Rozvaděče" value={technika.rozvadece_poznamka} />
              <ReadOnlyField label="Přípojka / proud" value={technika.elektro_pripojka} />
              <ReadOnlyField label="Jištění / okruhy" value={technika.elektro_jisteni} />
              <ReadOnlyField label="Typ zásuvky" value={technika.elektro_zasuvka} />
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

        {detail.fotky.length > 0 ? (
          <section className="mt-8 border-t border-white/10 pt-6">
            <PoptavkaFotkyClient
              poptavkaId={detail.sourcePoptavka?.poptavka_id ?? detail.zdroj_poptavka_id ?? ""}
              initialFotky={detail.fotky}
              readOnly
            />
          </section>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <Link
            href="/portal/zakazky"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-500/30"
          >
            ← Seznam zakázek
          </Link>
          {detail.sourcePoptavka ? (
            <Link
              href={`/portal/poptavka/${detail.sourcePoptavka.poptavka_id}`}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-500/30"
            >
              Zdrojová poptávka
            </Link>
          ) : null}
        </div>
      </PortalCard>
    </PortalShell>
  );
}
