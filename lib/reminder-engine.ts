import {
  createNotification,
  createNotificationsForRoles,
  createNotificationsForUsers,
  emptyNotificationRunStats,
  mergeNotificationRunStats,
  statsFromNotificationResult,
} from "@/lib/notifications";

function inRange(value: string | null | undefined, from: Date, to: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= from.getTime() && time <= to.getTime();
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function zakazkaStart(row: any) {
  if (row.akce_od) return row.akce_od;
  if (!row.datum_od) return null;
  return `${row.datum_od}T00:00:00`;
}

export async function runReminderEngine(supabase: any, nowInput = new Date()) {
  const now = nowInput;
  const result = {
    notifications: emptyNotificationRunStats(),
    tomorrowEvents: 0,
    departureSoon: 0,
    openAttendance: 0,
    unpaidWork: 0,
    pendingApprovals: 0,
    clientApprovals: 0,
    longRepairs: 0,
    overdueInvoices: 0,
  };

  const tomorrow = addDays(now, 1);
  const tomorrowStart = startOfDay(tomorrow);
  const tomorrowEnd = endOfDay(tomorrow);

  const { data: zakazky } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, datum_od, akce_od, odjezd_ze_skladu, zrusena, workflow_stav, workflow_change_pending, client_approval_status")
    .neq("workflow_stav", "zruseno");

  for (const zakazka of zakazky ?? []) {
    if (zakazka.zrusena) continue;
    const title = [zakazka.cislo_zakazky, zakazka.nazev].filter(Boolean).join(" · ") || "Zakázka";
    const start = zakazkaStart(zakazka);

    if (inRange(start, tomorrowStart, tomorrowEnd)) {
      const { data: assignments } = await supabase
        .from("zakazka_lide")
        .select("user_id")
        .eq("zakazka_id", zakazka.zakazka_id);

      mergeNotificationRunStats(result.notifications, await createNotificationsForUsers(
        supabase,
        (assignments ?? []).map((row: { user_id: string | null }) => row.user_id),
        {
          type: "zakazka_reminder_tomorrow",
          priority: "warning",
          title: "Zítra máte akci",
          message: title,
          relatedZakazkaId: zakazka.zakazka_id,
          actionUrl: `/moje/zakazky/${zakazka.zakazka_id}`,
          dedupeKeyPrefix: `reminder:tomorrow:${zakazka.zakazka_id}:${tomorrowStart.toISOString().slice(0, 10)}`,
        }
      ));
      result.tomorrowEvents += 1;
    }

    if (inRange(zakazka.odjezd_ze_skladu, now, addHours(now, 2))) {
      mergeNotificationRunStats(result.notifications, await createNotificationsForRoles(supabase, ["admin", "sef", "skladnik"], {
        type: "zakazka_departure_soon",
        priority: "critical",
        title: "Odjezd/nakládka do 2 hodin",
        message: title,
        relatedZakazkaId: zakazka.zakazka_id,
        actionUrl: `/zakazky/${zakazka.zakazka_id}/nakladka`,
        dedupeKeyPrefix: `reminder:departure:${zakazka.zakazka_id}:${new Date(zakazka.odjezd_ze_skladu).toISOString().slice(0, 13)}`,
      }));
      result.departureSoon += 1;
    }

    if (zakazka.workflow_change_pending) {
      mergeNotificationRunStats(result.notifications, await createNotificationsForRoles(supabase, ["admin", "sef"], {
        type: "zakazka_pending_reapproval",
        priority: "warning",
        title: "Zakázka čeká na znovuschválení změn",
        message: title,
        relatedZakazkaId: zakazka.zakazka_id,
        actionUrl: `/zakazky/${zakazka.zakazka_id}`,
        dedupeKeyPrefix: `reminder:pending-reapproval:${zakazka.zakazka_id}`,
      }));
      result.pendingApprovals += 1;
    }

    if (zakazka.workflow_stav === "cekani_na_schvaleni" || zakazka.client_approval_status === "sent_for_approval") {
      mergeNotificationRunStats(result.notifications, await createNotificationsForRoles(supabase, ["admin", "sef"], {
        type: "zakazka_waiting_client_approval",
        priority: "warning",
        title: "Zakázka čeká na schválení klientem",
        message: title,
        relatedZakazkaId: zakazka.zakazka_id,
        actionUrl: `/zakazky/${zakazka.zakazka_id}#schvaleni-klienta`,
        dedupeKeyPrefix: `reminder:client-approval:${zakazka.zakazka_id}`,
      }));
      result.clientApprovals += 1;
    }
  }

  const openAttendanceLimit = addHours(now, -8).toISOString();
  const { data: openAttendance } = await supabase
    .from("dochazka_zakazky")
    .select("id, zakazka_id, user_id, checkin_at")
    .is("checkout_at", null)
    .lte("checkin_at", openAttendanceLimit);

  for (const row of openAttendance ?? []) {
    mergeNotificationRunStats(result.notifications, statsFromNotificationResult(await createNotification(supabase, {
      userId: row.user_id,
      type: "attendance_open_too_long",
      priority: "warning",
      title: "Neukončená docházka",
      message: "Máte aktivní práci déle než 8 hodin. Zkontrolujte check-out.",
      relatedZakazkaId: row.zakazka_id,
      actionUrl: `/moje/zakazky/${row.zakazka_id}`,
      dedupeKey: `reminder:open-attendance:${row.id}`,
    })));
    mergeNotificationRunStats(result.notifications, await createNotificationsForRoles(supabase, ["admin", "sef"], {
      type: "attendance_open_too_long_admin",
      priority: "warning",
      title: "Neukončená docházka zaměstnance",
      message: "Docházka je otevřená déle než 8 hodin.",
      relatedZakazkaId: row.zakazka_id,
      actionUrl: `/zakazky/${row.zakazka_id}`,
      dedupeKeyPrefix: `reminder:open-attendance-admin:${row.id}`,
    }));
    result.openAttendance += 1;
  }

  const unpaidLimit = addDays(now, -7).toISOString();
  const { data: unpaid } = await supabase
    .from("dochazka_zakazky")
    .select("id, zakazka_id, user_id, checkout_at")
    .eq("payment_status", "ceka_na_proplaceni")
    .lte("checkout_at", unpaidLimit);

  for (const row of unpaid ?? []) {
    mergeNotificationRunStats(result.notifications, await createNotificationsForRoles(supabase, ["admin", "sef"], {
      type: "attendance_payment_waiting_long",
      priority: "warning",
      title: "Práce čeká dlouho na proplacení",
      message: "Ukončená práce čeká na proplacení déle než 7 dní.",
      relatedZakazkaId: row.zakazka_id,
      actionUrl: "/admin/proplaceni",
      dedupeKeyPrefix: `reminder:unpaid-work:${row.id}`,
    }));
    result.unpaidWork += 1;
  }

  const longRepairLimit = addDays(now, -14).toISOString();
  const { data: longRepairPieces } = await supabase
    .from("sklad_polozky_kusy")
    .select("kus_id, skladova_polozka_id, stav, servisni_stav_changed_at, skladove_polozky(nazev)")
    .eq("stav", "v_oprave")
    .lte("servisni_stav_changed_at", longRepairLimit);

  for (const piece of longRepairPieces ?? []) {
    const item = Array.isArray(piece.skladove_polozky) ? piece.skladove_polozky[0] : piece.skladove_polozky;
    mergeNotificationRunStats(result.notifications, await createNotificationsForRoles(supabase, ["admin", "sef", "skladnik"], {
      type: "stock_piece_repair_too_long",
      priority: "warning",
      title: "Kus je dlouho v opravě",
      message: item?.nazev ? `${item.nazev} je v opravě déle než 14 dní.` : "Kus skladu je v opravě déle než 14 dní.",
      relatedKusId: piece.kus_id,
      actionUrl: `/sklad/kus/${piece.kus_id}`,
      dedupeKeyPrefix: `reminder:long-repair:${piece.kus_id}`,
    }));
    result.longRepairs += 1;
  }

  const { data: overdueInvoices } = await supabase
    .from("zakazka_faktury")
    .select("id, zakazka_id, cislo_dokladu, splatnost_at, stav, payment_status")
    .lt("splatnost_at", now.toISOString())
    .neq("stav", "stornovano")
    .or("payment_status.is.null,payment_status.neq.uhrazeno");

  for (const invoice of overdueInvoices ?? []) {
    if (invoice.payment_status !== "po_splatnosti") {
      await supabase
        .from("zakazka_faktury")
        .update({ payment_status: "po_splatnosti", updated_at: now.toISOString() })
        .eq("id", invoice.id)
        .neq("payment_status", "uhrazeno")
        .neq("stav", "stornovano");
    }

    mergeNotificationRunStats(result.notifications, await createNotificationsForRoles(supabase, ["admin", "sef"], {
      type: "invoice_overdue_placeholder",
      priority: "warning",
      title: "Faktura po splatnosti",
      message: invoice.cislo_dokladu ? `Faktura ${invoice.cislo_dokladu} je po splatnosti.` : "Faktura je po splatnosti.",
      relatedZakazkaId: invoice.zakazka_id,
      relatedFakturaId: invoice.id,
      actionUrl: `/zakazky/${invoice.zakazka_id}`,
      dedupeKeyPrefix: `reminder:invoice-overdue:${invoice.id}`,
    }));
    result.overdueInvoices += 1;
  }

  return result;
}
