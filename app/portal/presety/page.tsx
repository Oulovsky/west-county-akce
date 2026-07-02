import { redirect } from "next/navigation";
import PortalPresetyClient from "@/components/portal/PortalPresetyClient";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { guardVerifiedClientPortalPage } from "@/lib/auth/client-portal-route-guard";
import {
  loadClientPlacePresetsForPortal,
  loadClientSetupPresetsForPortal,
  loadClientTechnicalPresetsForPortal,
} from "@/lib/client-portal/client-presets-server";
import { createClient } from "@/lib/supabase/server";

export default async function PortalPresetyPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  guardVerifiedClientPortalPage(session, "/portal/presety");

  const [placePresets, technicalPresets, setupPresets] = await Promise.all([
    loadClientPlacePresetsForPortal(supabase),
    loadClientTechnicalPresetsForPortal(supabase),
    loadClientSetupPresetsForPortal(supabase),
  ]);

  return (
    <PortalShell showBackToPortal showMainNav>
      <PortalCard title="Moje místa a presety">
        <p className="text-sm text-slate-400">
          Spravujte místa, technické profily a sestavy mimo konkrétní poptávku. V nové poptávce je
          použijete jen po vědomém kliknutí — nic se nenačte automaticky.
        </p>

        {resolvedSearchParams?.saved ? (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Preset byl uložen.
          </p>
        ) : null}

        {resolvedSearchParams?.error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {resolvedSearchParams.error}
          </p>
        ) : null}

        <div className="mt-6">
          <PortalPresetyClient
            placePresets={placePresets}
            technicalPresets={technicalPresets}
            setupPresets={setupPresets}
          />
        </div>
      </PortalCard>
    </PortalShell>
  );
}
