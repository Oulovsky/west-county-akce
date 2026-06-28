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
  zakazkaId,
}: {
  poptavkaId: string;
  cisloPoptavky: string;
  mistoNazev: string | null;
  zakazkaId?: string | null;
}) {
  const admin = createAdminClient();
  const akceLabel = mistoNazev?.trim() || "Bez názvu akce";

  await createNotificationsForRoles(admin, ["admin", "sef"], {
    type: zakazkaId ? "poptavka_objednavka_prevadena" : "poptavka_objednavka_potvrzena",
    priority: "info",
    title: zakazkaId
      ? "Klient potvrdil objednávku — zakázka vytvořena"
      : "Klient potvrdil závaznou objednávku",
    message: zakazkaId
      ? `${cisloPoptavky} · ${akceLabel}`
      : `${cisloPoptavky} · ${akceLabel} — vytvoření zakázky se nepodařilo automaticky`,
    actionUrl: zakazkaId ? `/zakazky/${zakazkaId}` : `/zakazky/poptavky/${poptavkaId}`,
    relatedZakazkaId: zakazkaId ?? null,
    dedupeKeyPrefix: `poptavka-objednavka-confirmed-${poptavkaId}`,
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
