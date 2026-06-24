import { redirect } from "next/navigation";
import PoptavkaFormClient from "@/components/portal/PoptavkaFormClient";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import type { PoptavkaPrefill } from "@/lib/client-portal/poptavka-form";
import { loadClientMistaKonaniForPortal, loadClientMistaKnowHowByIdForPortal } from "@/lib/client-portal/client-mista-server";
import { loadClientPreviousTechnikaOptionsForPortal } from "@/lib/client-portal/client-previous-technika-server";
import { loadPortalSetups } from "@/lib/client-portal/poptavka-server";
import { loadPortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-server";
import { createClient } from "@/lib/supabase/server";

async function loadPoptavkaPrefill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: Extract<
    Awaited<ReturnType<typeof loadClientPortalSession>>,
    { kind: "active" }
  >
): Promise<PoptavkaPrefill> {
  const [{ data: klient }, { data: authUser }] = await Promise.all([
    supabase
      .from("klienti")
      .select("nazev, ico, email, telefon")
      .eq("klient_id", session.account.klient_id!)
      .single(),
    supabase.auth.getUser(),
  ]);

  const kontaktJmeno = [session.account.jmeno, session.account.prijmeni]
    .filter(Boolean)
    .join(" ");

  return {
    kontakt_jmeno: kontaktJmeno,
    kontakt_telefon: session.account.telefon ?? klient?.telefon ?? "",
    kontakt_email: authUser.user?.email ?? klient?.email ?? "",
    firma_nazev: session.klientNazev ?? klient?.nazev ?? "",
    firma_ico: klient?.ico ?? "",
  };
}

export default async function PortalNovaPoptavkaPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (session.kind !== "active") {
    redirect("/portal/prihlaseni?next=/portal/poptavka/nova");
  }

  const [prefill, setupsByOblast, savedMista, previousTechnikaOptions, sestavaKatalog] =
    await Promise.all([
    loadPoptavkaPrefill(supabase, session),
    loadPortalSetups(supabase),
    loadClientMistaKonaniForPortal(supabase),
    loadClientPreviousTechnikaOptionsForPortal(supabase),
    loadPortalSestavaKatalog(),
  ]);

  const savedMistaKnowHowById = await loadClientMistaKnowHowByIdForPortal(
    supabase,
    savedMista.map((misto) => misto.misto_id)
  );

  return (
    <PoptavkaFormClient
      mode="create"
      prefill={prefill}
      setupsByOblast={setupsByOblast}
      savedMista={savedMista}
      savedMistaKnowHowById={savedMistaKnowHowById}
      previousTechnikaOptions={previousTechnikaOptions}
      sestavaKatalog={sestavaKatalog}
      errorCode={resolvedSearchParams?.error ?? null}
    />
  );
}
