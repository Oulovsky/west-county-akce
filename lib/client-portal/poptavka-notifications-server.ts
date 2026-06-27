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

export async function notifyInternalTeamAboutPoptavkaObjednavkaConfirmed({
  poptavkaId,
  cisloPoptavky,
  mistoNazev,
}: {
  poptavkaId: string;
  cisloPoptavky: string;
  mistoNazev: string | null;
}) {
  const admin = createAdminClient();
  const akceLabel = mistoNazev?.trim() || "Bez názvu akce";

  await createNotificationsForRoles(admin, ["admin", "sef"], {
    type: "poptavka_objednavka_potvrzena",
    priority: "info",
    title: "Klient potvrdil závaznou objednávku",
    message: `${cisloPoptavky} · ${akceLabel}`,
    actionUrl: `/zakazky/poptavky/${poptavkaId}`,
  });
}

export async function notifyInternalTeamAboutPoptavkaObjednavkaRejected({
  poptavkaId,
  cisloPoptavky,
  mistoNazev,
  reason,
}: {
  poptavkaId: string;
  cisloPoptavky: string;
  mistoNazev: string | null;
  reason: string | null;
}) {
  const admin = createAdminClient();
  const akceLabel = mistoNazev?.trim() || "Bez názvu akce";
  const suffix = reason?.trim() ? ` — ${reason.trim().slice(0, 120)}` : "";

  await createNotificationsForRoles(admin, ["admin", "sef"], {
    type: "poptavka_objednavka_odmitnuta",
    priority: "warning",
    title: "Klient odmítl návrh závazné objednávky",
    message: `${cisloPoptavky} · ${akceLabel}${suffix}`,
    actionUrl: `/zakazky/poptavky/${poptavkaId}`,
  });
}
