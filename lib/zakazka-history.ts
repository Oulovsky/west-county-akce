type ZakazkaHistoryInput = {
  zakazkaId: string;
  eventType: string;
  actorId?: string | null;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logZakazkaHistory(
  supabase: any,
  input: ZakazkaHistoryInput
) {
  const { error } = await supabase.from("zakazka_historie").insert({
    zakazka_id: input.zakazkaId,
    event_type: input.eventType,
    actor_id: input.actorId ?? null,
    title: input.title,
    detail: input.detail ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Zakazka history insert failed:", error.message);
  }
}
