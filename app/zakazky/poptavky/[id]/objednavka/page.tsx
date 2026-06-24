import Link from "next/link";
import { verifyInternalPoptavkyReadPage } from "@/lib/auth/admin-access-server";
import { loadSessionRolePermissions } from "@/lib/auth/internal-role-access-server";
import { loadInternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import {
  ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY,
  createOrLoadPoptavkaObjednavkaDraft,
  loadPoptavkaObjednavkaDraft,
} from "@/lib/client-portal/poptavka-objednavka-draft-server";
import type { PoptavkaStav } from "@/lib/client-portal/types";
import { createClient } from "@/lib/supabase/server";
import PoptavkaObjednavkaDraftEditor from "./PoptavkaObjednavkaDraftEditor";

function canOpenObjednavkaEditor(stav: PoptavkaStav) {
  return (
    stav === "odeslana" ||
    stav === "v_revizi" ||
    stav === "objednavka_odeslana" ||
    stav === "objednavka_potvrzena" ||
    stav === "objednavka_odmitnuta" ||
    stav === "schvalena"
  );
}

export default async function PoptavkaObjednavkaEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const { id: poptavkaId } = await params;
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
        <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
        <p className="mt-4 text-red-400">{access.message}</p>
      </div>
    );
  }

  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
        <p className="mt-4 text-red-400">Poptávka nenalezena.</p>
        <Link href="/zakazky/poptavky" className="mt-4 inline-block text-blue-300">
          ← Seznam poptávek
        </Link>
      </div>
    );
  }

  if (!canOpenObjednavkaEditor(detail.stav)) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
        <p className="mt-4 text-amber-200">
          Pro tuto poptávku zatím nelze připravit závaznou objednávku ve stavu{" "}
          <strong>{detail.stav}</strong>.
        </p>
        <Link href={`/zakazky/poptavky/${poptavkaId}`} className="mt-4 inline-block text-blue-300">
          ← Zpět na poptávku
        </Link>
      </div>
    );
  }

  const draft =
    readOnly
      ? await loadPoptavkaObjednavkaDraft(supabase, poptavkaId)
      : await createOrLoadPoptavkaObjednavkaDraft(supabase, poptavkaId, {
          preparedByUserId: undefined,
        });

  if (!draft) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Závazná objednávka</h1>
        <p className="mt-4 text-red-400">
          {readOnly
            ? "Aktivní draft objednávky neexistuje."
            : "Nepodařilo se vytvořit draft objednávky."}
        </p>
        <Link href={`/zakazky/poptavky/${poptavkaId}`} className="mt-4 inline-block text-blue-300">
          ← Zpět na poptávku
        </Link>
      </div>
    );
  }

  const canEdit =
    !readOnly &&
    (ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY as readonly string[]).includes(draft.stav);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
            {detail.cislo_poptavky} · draft objednávky
          </div>
          <h1 className="mt-1 text-3xl font-bold text-white">
            {detail.misto_nazev || "Závazná objednávka"}
          </h1>
          <p className="mt-2 text-slate-400">
            {detail.klient?.nazev ?? "—"}
            {detail.klient?.ico ? ` · IČO ${detail.klient.ico}` : ""}
          </p>
        </div>
        <Link href={`/zakazky/poptavky/${poptavkaId}`} className="text-sm text-blue-300 hover:text-blue-200">
          ← Detail poptávky
        </Link>
      </div>

      <PoptavkaObjednavkaDraftEditor
        poptavkaId={poptavkaId}
        cisloPoptavky={detail.cislo_poptavky}
        draftId={draft.draft_id}
        draftStav={draft.stav}
        draftData={draft.draftData}
        sourceChanged={draft.sourceChanged}
        readOnly={readOnly}
        canEdit={canEdit}
        saved={resolvedSearchParams?.saved === "1"}
        errorCode={resolvedSearchParams?.error ?? null}
      />
    </div>
  );
}
