import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SetupRow = {
  setup_id: string;
  nazev: string;
  aktivni: boolean;
  pocet_polozek: number;
  celkem_kusu: number | string;
};

export default async function SetupyPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_setupy");

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Chyba: {error.message}
      </div>
    );
  }

  const setupy = (data ?? []) as SetupRow[];

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Setupy</h1>

      <div
        style={{
          marginBottom: 20,
          padding: 12,
          border: "1px solid #8a6d1d",
          borderRadius: 8,
          background: "#2a2208",
          color: "#fff",
        }}
      >
        Legacy/starý systém. Aktivní skladové setupy pro nové zakázky jsou na /sklad/setupy.
      </div>

      {setupy.length === 0 ? (
        <div>Žádné setupy</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {setupy.map((s) => (
            <Link
              key={s.setup_id}
              href={`/setupy/${s.setup_id}`}
              style={{
                display: "block",
                padding: 12,
                border: "1px solid #333",
                borderRadius: 8,
                background: "#111",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.nazev}</div>

              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                položek: {s.pocet_polozek} | kusů: {String(s.celkem_kusu)}
              </div>

              {!s.aktivni ? (
                <div style={{ color: "orange", fontSize: 12, marginTop: 6 }}>
                  neaktivní
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}