import Link from "next/link";
import PoptavkaObjednavkaDocument from "@/components/poptavka/PoptavkaObjednavkaDocument";
import { verifyInternalPoptavkyReadPage } from "@/lib/auth/admin-access-server";
import { draftDataToDocumentData } from "@/lib/client-portal/poptavka-objednavka-document";
import { loadInternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import {
  loadPoptavkaObjednavkaDraft,
  resolveDraftFotkaSignedUrls,
} from "@/lib/client-portal/poptavka-objednavka-draft-server";
import { createClient } from "@/lib/supabase/server";

export default async function PoptavkaObjednavkaNahledPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: poptavkaId } = await params;

  const supabase = await createClient();
  const access = await verifyInternalPoptavkyReadPage(supabase);

  if (!access.ok) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Náhled objednávky</h1>
        <p className="mt-4 text-red-400">{access.message}</p>
      </div>
    );
  }

  const [detail, draft] = await Promise.all([
    loadInternalPoptavkaDetail(supabase, poptavkaId),
    loadPoptavkaObjednavkaDraft(supabase, poptavkaId),
  ]);

  if (!detail) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Náhled objednávky</h1>
        <p className="mt-4 text-red-400">Poptávka nenalezena.</p>
        <Link href="/zakazky/poptavky" className="mt-4 inline-block text-blue-300">
          ← Seznam poptávek
        </Link>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-3xl font-bold text-white">Náhled objednávky</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Aktivní návrh objednávky zatím neexistuje. Nejdřív vytvořte nebo otevřete draft v
          editoru.
        </p>
        <Link
          href={`/zakazky/poptavky/${poptavkaId}/objednavka`}
          className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Připravit závaznou objednávku
        </Link>
        <div>
          <Link href={`/zakazky/poptavky/${poptavkaId}`} className="text-sm text-blue-300">
            ← Zpět na poptávku
          </Link>
        </div>
      </div>
    );
  }

  const fotkaUrls = await resolveDraftFotkaSignedUrls(draft.draftData.fotky);
  const documentData = draftDataToDocumentData(draft.draftData, fotkaUrls);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-3 text-sm text-indigo-100">
          <p className="font-semibold">Interní náhled</p>
          <p className="mt-1 text-indigo-200/90">
            Toto je interní náhled. Klient objednávku zatím nevidí. Po odeslání vznikne zmrazená
            verze pro potvrzení.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={`/zakazky/poptavky/${poptavkaId}/objednavka`}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              ← Zpět do editoru
            </Link>
            <Link
              href={`/zakazky/poptavky/${poptavkaId}`}
              className="rounded-lg border border-indigo-400/40 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-900/40"
            >
              Detail poptávky
            </Link>
          </div>
        </div>

        <PoptavkaObjednavkaDocument
          data={documentData}
          meta={{
            cisloPoptavky: detail.cislo_poptavky,
            nazevAkce: detail.misto_nazev,
            upravenoOprotiPoptavce: draft.draftData.upravenoOprotiPoptavce,
          }}
        />
      </div>
    </div>
  );
}
