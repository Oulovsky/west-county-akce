export type NotificationPriority = "info" | "warning" | "critical";

export type CreateNotificationInput = {
  userId?: string | null;
  type: string;
  priority?: NotificationPriority;
  title: string;
  message: string;
  relatedZakazkaId?: string | null;
  relatedKusId?: string | null;
  relatedFakturaId?: string | null;
  actionUrl?: string | null;
  dedupeKey?: string | null;
};

export function getNotificationPriorityLabel(priority?: string | null) {
  if (priority === "critical") return "Kritické";
  if (priority === "warning") return "Warning";
  return "Info";
}

export function getNotificationPriorityClass(priority?: string | null) {
  if (priority === "critical") return "border-red-500/40 bg-red-500/10 text-red-100";
  if (priority === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-blue-500/40 bg-blue-500/10 text-blue-100";
}

export async function createNotification(supabase: any, input: CreateNotificationInput) {
  if (input.dedupeKey) {
    const { data: existing, error: existingError } = await supabase
      .from("notifikace")
      .select("id")
      .eq("dedupe_key", input.dedupeKey)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.warn("Notification dedupe check failed:", existingError.message);
      return { ok: false, error: existingError.message };
    }
    if (existing) return { ok: true, skipped: true, id: existing.id };
  }

  const { data, error } = await supabase
    .from("notifikace")
    .insert({
      user_id: input.userId ?? null,
      typ: input.type,
      priorita: input.priority ?? "info",
      titulek: input.title,
      zprava: input.message,
      related_zakazka_id: input.relatedZakazkaId ?? null,
      related_kus_id: input.relatedKusId ?? null,
      related_faktura_id: input.relatedFakturaId ?? null,
      akce_url: input.actionUrl ?? null,
      dedupe_key: input.dedupeKey ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Notification insert failed:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data.id };
}

export async function createNotificationsForUsers(
  supabase: any,
  userIds: Array<string | null | undefined>,
  input: Omit<CreateNotificationInput, "userId" | "dedupeKey"> & {
    dedupeKeyPrefix?: string | null;
  }
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean).map(String))];
  for (const userId of uniqueUserIds) {
    await createNotification(supabase, {
      ...input,
      userId,
      dedupeKey: input.dedupeKeyPrefix ? `${input.dedupeKeyPrefix}:${userId}` : null,
    });
  }
}

export async function getUsersByRoles(supabase: any, roles: string[]) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .in("role", roles)
    .eq("aktivni", true);

  if (error) {
    console.warn("Notification role lookup failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: { user_id: string | null }) => row.user_id).filter(Boolean) as string[];
}

export async function createNotificationsForRoles(
  supabase: any,
  roles: string[],
  input: Omit<CreateNotificationInput, "userId" | "dedupeKey"> & {
    dedupeKeyPrefix?: string | null;
  }
) {
  const userIds = await getUsersByRoles(supabase, roles);
  await createNotificationsForUsers(supabase, userIds, input);
}
