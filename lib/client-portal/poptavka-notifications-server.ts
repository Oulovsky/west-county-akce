import "server-only";

import { createNotificationsForRoles } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyInternalTeamAboutSubmittedPoptavka({
  poptavkaId,
  cisloPoptavky,
  mistoNazev,
  isResubmit,
}: {
  poptavkaId: string;
  cisloPoptavky: string;
  mistoNazev: string | null;
  isResubmit: boolean;
}) {
  const admin = createAdminClient();
  const akceLabel = mistoNazev?.trim() || "Bez názvu akce";

  await createNotificationsForRoles(admin, ["admin", "sef"], {
    type: isResubmit ? "poptavka_resubmitted" : "poptavka_submitted",
    priority: "info",
    title: isResubmit ? "Poptávka znovu odeslána" : "Nová klientská poptávka",
    message: `${cisloPoptavky} · ${akceLabel}`,
    actionUrl: `/zakazky/poptavky/${poptavkaId}`,
  });
}
