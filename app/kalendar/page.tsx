import { createClient } from "@/lib/supabase/server";
import KalendarClient from "./KalendarClient";

export default async function KalendarPage() {
  const supabase = await createClient();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { data } = await supabase.rpc("get_kalendar_zakazky", {
    p_from: from.toISOString().split("T")[0],
    p_to: to.toISOString().split("T")[0],
  });

  return <KalendarClient data={data || []} />;
}
