import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hashClientQuestionnaireToken } from "@/lib/client-questionnaire";
import { DotaznikFormClient } from "./DotaznikFormClient";
import { PAGE_STANDALONE_CLASS } from "@/lib/layout/page-shell";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ odeslano?: string; error?: string }>;
};

type LinkRow = {
  link_id: string;
  zakazka_id: string;
  klient_id: string | null;
  revoked_at: string | null;
  opened_at: string | null;
  open_count: number | null;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
  zrusena?: boolean | null;
  workflow_stav?: string | null;
};

function formatDateRange(data: ZakazkaRow) {
  const start = data.akce_od ?? data.datum_od;
  const end = data.akce_do ?? data.datum_do;
  if (!start && !end) return "Termín není vyplněný";

  const formatter = new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: start?.includes("T") || end?.includes("T") ? "short" : undefined,
  });

  return [start, end]
    .filter(Boolean)
    .map((value) => formatter.format(new Date(value!)))
    .join(" – ");
}

async function loadValidLink(rawToken: string) {
  const supabase = await createClient();
  const tokenHash = hashClientQuestionnaireToken(rawToken);

  const { data: linkRaw, error: linkError } = await supabase
    .from("zakazka_client_links")
    .select("link_id, zakazka_id, klient_id, revoked_at, opened_at, open_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }

  const link = (linkRaw ?? null) as LinkRow | null;
  if (!link || link.revoked_at) {
    return { supabase, link: null, zakazka: null };
  }

  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, misto, akce_od, akce_do, datum_od, datum_do, zrusena, workflow_stav")
    .eq("zakazka_id", link.zakazka_id)
    .single();

  if (zakazkaError) {
    throw new Error(zakazkaError.message);
  }

  const zakazka = zakazkaRaw as ZakazkaRow;
  if (zakazka.zrusena || zakazka.workflow_stav === "zruseno") {
    return { supabase, link: null, zakazka: null };
  }

  return { supabase, link, zakazka };
}

function invalidLinkView() {
  return (
    <div className={`${PAGE_STANDALONE_CLASS} py-16`}>
      <div className="rounded-3xl border border-red-500/40 bg-red-950/20 p-6 text-red-100">
        <h1 className="text-2xl font-bold">Neplatný nebo zneplatněný odkaz.</h1>
        <p className="mt-2 text-sm text-red-200">
          Požádejte prosím organizátora akce o nový odkaz na technický dotazník.
        </p>
      </div>
    </div>
  );
}

function thankYouView() {
  return (
    <div className={`${PAGE_STANDALONE_CLASS} py-16`}>
      <div className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-6 text-emerald-100">
        <h1 className="text-2xl font-bold">Děkujeme, odpovědi byly odeslány.</h1>
        <p className="mt-2 text-sm text-emerald-200">
          Pokud bude potřeba něco upřesnit, ozveme se.
        </p>
        <p className="mt-2 text-sm text-emerald-200">
          Pokud byl zvolen výjezd technika, napíšeme nebo zavoláme kvůli domluvě termínu.
        </p>
      </div>
    </div>
  );
}

function getErrorMessage(error: string | undefined) {
  if (error === "contact_required") {
    return "Vyplňte prosím jméno a telefon kontaktní osoby na místě.";
  }

  if (error === "visit_required") {
    return "Potvrďte prosím objednání výjezdu technika před akcí.";
  }

  if (error === "truth_required") {
    return "Potvrďte prosím pravdivost údajů podle nejlepšího vědomí.";
  }

  if (error === "cost_required") {
    return "Při vlastním vyplnění potvrďte prosím i možné dodatečné náklady při nesouladu na místě.";
  }

  if (error === "distance_required") {
    return "Pokud je elektro přípojka připravená, vyplňte prosím přibližnou vzdálenost v metrech.";
  }

  if (error === "photo_type") {
    return "Fotky musí být ve formátu JPG, PNG nebo WebP.";
  }

  if (error === "photo_size") {
    return "Jedna fotka může mít maximálně 10 MB.";
  }

  if (error === "invalid") {
    return "Odkaz už není platný.";
  }

  return null;
}

export default async function PublicDotaznikPage({ params, searchParams }: PageProps) {
  noStore();

  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const { supabase, link, zakazka } = await loadValidLink(token);

  if (!link || !zakazka) {
    return invalidLinkView();
  }

  const now = new Date().toISOString();
  await supabase
    .from("zakazka_client_links")
    .update({
      opened_at: link.opened_at ?? now,
      last_opened_at: now,
      open_count: (link.open_count ?? 0) + 1,
    })
    .eq("link_id", link.link_id);

  if (resolvedSearchParams?.odeslano === "1") {
    return thankYouView();
  }

  const errorMessage = getErrorMessage(resolvedSearchParams?.error);

  return (
    <div className={`${PAGE_STANDALONE_CLASS} py-6`}>
      <div className="rounded-3xl border border-slate-700 bg-[#0b1324] p-5 shadow-xl sm:p-8">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-300">WEST COUNTY</div>
          <h1 className="mt-2 text-3xl font-black text-white">Technický dotazník k akci</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Potřebujeme ověřit technické informace, abychom správně připravili techniku, kabeláž,
            elektro a logistiku.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
          <div>
            <strong>Akce:</strong> {zakazka.nazev ?? zakazka.cislo_zakazky ?? "Zakázka"}
          </div>
          <div>
            <strong>Místo:</strong> {zakazka.misto ?? "Místo není vyplněné"}
          </div>
          <div>
            <strong>Termín:</strong> {formatDateRange(zakazka)}
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <DotaznikFormClient token={token} />
      </div>
    </div>
  );
}
