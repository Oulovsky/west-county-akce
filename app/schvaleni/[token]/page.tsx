import { unstable_noStore as noStore } from "next/cache";
import { hashClientApprovalToken } from "@/lib/client-approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { ApprovalDecisionClient } from "./ApprovalDecisionClient";
import type { ApprovalSnapshotData } from "@/lib/approval-snapshot";

type PageProps = {
  params: Promise<{ token: string }>;
};

type LinkRow = {
  link_id: string;
  zakazka_id: string;
  revoked_at: string | null;
  opened_at: string | null;
  open_count: number | null;
  approved_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  approval_snapshot?: ApprovalSnapshotData | null;
};

function invalidLinkView() {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <div className="rounded-3xl border border-red-500/40 bg-red-950/20 p-6 text-red-100">
        <h1 className="text-2xl font-bold">Neplatný nebo zneplatněný odkaz.</h1>
        <p className="mt-2 text-sm text-red-200">
          Požádejte prosím organizátora akce o nový odkaz na schválení zakázky.
        </p>
      </div>
    </div>
  );
}

function legacyLinkWithoutSnapshotView() {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <div className="rounded-3xl border border-amber-500/40 bg-amber-950/20 p-6 text-amber-100">
        <h1 className="text-2xl font-bold">Odkaz je potřeba vystavit znovu.</h1>
        <p className="mt-2 text-sm text-amber-200">
          Tento starší schvalovací odkaz nemá uložený snapshot objednávky, proto přes něj nejde bezpečně schválit živá data.
          Požádejte prosím organizátora akce o nový odkaz.
        </p>
      </div>
    </div>
  );
}

function finalView({ approved, reason }: { approved: boolean; reason?: string | null }) {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <div
        className={[
          "rounded-3xl border p-6",
          approved
            ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-100"
            : "border-amber-500/40 bg-amber-950/20 text-amber-100",
        ].join(" ")}
      >
        <h1 className="text-2xl font-bold">
          {approved ? "Zakázka už byla schválena." : "Zakázka už byla odmítnuta."}
        </h1>
        {reason ? <p className="mt-2 text-sm">Důvod: {reason}</p> : null}
      </div>
    </div>
  );
}

export default async function PublicApprovalPage({ params }: PageProps) {
  noStore();

  const { token } = await params;
  const supabase = createAdminClient();
  const tokenHash = hashClientApprovalToken(token);

  const { data: linkRaw, error: linkError } = await supabase
    .from("zakazka_approval_links")
    .select("link_id, zakazka_id, revoked_at, opened_at, open_count, approved_at, declined_at, declined_reason, approval_snapshot")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }

  const link = (linkRaw ?? null) as LinkRow | null;
  if (!link || link.revoked_at) return invalidLinkView();
  if (link.approved_at) return finalView({ approved: true });
  if (link.declined_at) return finalView({ approved: false, reason: link.declined_reason });

  const now = new Date().toISOString();
  await supabase
    .from("zakazka_approval_links")
    .update({
      opened_at: link.opened_at ?? now,
      last_opened_at: now,
      open_count: (link.open_count ?? 0) + 1,
    })
    .eq("link_id", link.link_id);

  const snapshot = link.approval_snapshot?.version === 1 ? link.approval_snapshot : null;
  if (snapshot) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <div className="rounded-3xl border border-slate-700 bg-[#0b1324] p-5 shadow-xl sm:p-8">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              WEST COUNTY
            </div>
            <h1 className="mt-2 break-words text-3xl font-black text-white">
              Schválení finální podoby zakázky
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Zobrazená objednávka je snapshot stavu odeslaného ke schválení.
            </p>
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
            <div><strong>Akce:</strong> {[snapshot.zakazka.cisloZakazky, snapshot.zakazka.nazev].filter(Boolean).join(" · ") || "Zakázka"}</div>
            <div><strong>Klient:</strong> {snapshot.klient.name ?? "Neuvedeno"}</div>
            <div><strong>Místo:</strong> {snapshot.zakazka.misto ?? "Místo není vyplněné"}</div>
            <div><strong>Termín:</strong> {snapshot.zakazka.termin}</div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
            <h2 className="text-lg font-bold text-white">Technický plán</h2>
            {snapshot.technika.length === 0 ? (
              <div className="mt-2 text-sm text-slate-400">Technický plán zatím není vyplněný.</div>
            ) : (
              <div className="mt-3 divide-y divide-slate-800">
                {snapshot.technika.map((item) => (
                  <div key={item.skladova_polozka_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0 break-words font-semibold text-slate-100">
                      {item.nazev}
                    </div>
                    <div className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-slate-200">
                      {item.mnozstvi}×
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {snapshot.zakazka.poznamka ? (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
              <h2 className="text-lg font-bold text-white">Poznámka</h2>
              <div className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">
                {snapshot.zakazka.poznamka}
              </div>
            </div>
          ) : null}

          {snapshot.dotaznik.submittedAt ? (
            <div className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4 text-sm text-blue-100">
              Technické informace od klienta jsou doplněné.{" "}
              {snapshot.dotaznik.pozadovanVyjezdTechnika ? "Klient požádal o výjezd technika. " : ""}
              {snapshot.dotaznik.rizikaCount > 0 ? `Technická upozornění: ${snapshot.dotaznik.rizikaCount}.` : "Bez technických upozornění."}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700 bg-white">
            <InvoiceDocument data={snapshot.invoiceDocument} />
          </div>

          <div className="mt-5">
            <ApprovalDecisionClient token={token} />
          </div>
        </div>
      </div>
    );
  }

  return legacyLinkWithoutSnapshotView();
}
