import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type SetupDetailRow = {
  setup_id: string;
  setup_nazev: string;
  setup_aktivni: boolean;
  setup_poznamka: string | null;
  setup_polozka_id: string | null;
  skladova_polozka_id: string | null;
  skladova_polozka_nazev: string | null;
  mnozstvi: number | string | null;
  jednotka: string | null;
  poradi: number | null;
  poznamka: string | null;
};

type SkladRow = {
  skladova_polozka_id: string;
  nazev: string;
  kategorie_techniky_id: string;
  kategorie_nazev: string | null;
  podkategorie_techniky_id: string | null;
  jednotka: string;
  celkem_k_dispozici: number | string;
  interni_naklad: number | string | null;
  fakturacni_cena: number | string | null;
  aktivni: boolean;
  poznamka: string | null;
};

export default async function SetupDetailPage({ params }: PageProps) {
  const { id } = await params;

  async function addItemToSetup(formData: FormData) {
    "use server";

    const setupId = String(formData.get("setup_id") ?? "");
    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") ?? "");
    const mnozstviRaw = String(formData.get("mnozstvi") ?? "1");
    const poradiRaw = String(formData.get("poradi") ?? "0");
    const poznamkaRaw = String(formData.get("poznamka") ?? "");

    const mnozstvi = Number(mnozstviRaw);
    const poradi = Number(poradiRaw);

    if (!setupId) {
      throw new Error("Chybí setup_id.");
    }

    if (!skladovaPolozkaId) {
      throw new Error("Chybí skladová položka.");
    }

    if (!Number.isFinite(mnozstvi) || mnozstvi <= 0) {
      throw new Error("Množství musí být větší než 0.");
    }

    if (!Number.isFinite(poradi)) {
      throw new Error("Pořadí není platné číslo.");
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc("add_setup_polozka", {
      p_setup_id: setupId,
      p_skladova_polozka_id: skladovaPolozkaId,
      p_mnozstvi: mnozstvi,
      p_poradi: poradi,
      p_poznamka: poznamkaRaw.trim() || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/setupy/${setupId}`);
    revalidatePath("/setupy");
  }

  async function removeItemFromSetup(formData: FormData) {
    "use server";

    const setupId = String(formData.get("setup_id") ?? "");
    const setupPolozkaId = String(formData.get("setup_polozka_id") ?? "");

    if (!setupId) {
      throw new Error("Chybí setup_id.");
    }

    if (!setupPolozkaId) {
      throw new Error("Chybí setup_polozka_id.");
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc("remove_setup_polozka", {
      p_setup_polozka_id: setupPolozkaId,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/setupy/${setupId}`);
    revalidatePath("/setupy");
  }

  const supabase = await createClient();

  const [{ data, error }, { data: skladData, error: skladError }] = await Promise.all([
    supabase.rpc("get_setup_detail", {
      p_setup_id: id,
    }),
    supabase.rpc("get_skladove_polozky"),
  ]);

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Chyba setupu: {error.message}
      </div>
    );
  }

  if (skladError) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Chyba skladu: {skladError.message}
      </div>
    );
  }

  const rows = (data ?? []) as SetupDetailRow[];
  const sklad = ((skladData ?? []) as SkladRow[]).filter((item) => item.aktivni);

  if (rows.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/setupy" style={{ color: "#fff" }}>
            ← Zpět na setupy
          </Link>
        </div>
        <div>Setup nenalezen</div>
      </div>
    );
  }

  const first = rows[0];
  const polozky = rows.filter((r) => r.setup_polozka_id);
  const usedIds = new Set(
    polozky
      .map((p) => p.skladova_polozka_id)
      .filter((value): value is string => Boolean(value))
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/setupy" style={{ color: "#fff" }}>
          ← Zpět na setupy
        </Link>
      </div>

      <h1 style={{ fontSize: 24, marginBottom: 8 }}>{first.setup_nazev}</h1>

      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 20 }}>
        stav: {first.setup_aktivni ? "aktivní" : "neaktivní"}
      </div>

      {first.setup_poznamka ? (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            border: "1px solid #333",
            borderRadius: 8,
            background: "#111",
            color: "#fff",
          }}
        >
          {first.setup_poznamka}
        </div>
      ) : null}

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          Položky v setupu
        </div>

        {polozky.length === 0 ? (
          <div>Setup neobsahuje žádné položky.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {polozky.map((p) => (
              <div
                key={p.setup_polozka_id ?? `${p.skladova_polozka_id}-${p.poradi}`}
                style={{
                  padding: 12,
                  border: "1px solid #333",
                  borderRadius: 8,
                  background: "#111",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>
                    {p.skladova_polozka_nazev}
                  </div>

                  <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                    množství: {String(p.mnozstvi)} {p.jednotka ?? ""}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                    pořadí: {p.poradi ?? 0}
                  </div>

                  {p.poznamka ? (
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                      poznámka: {p.poznamka}
                    </div>
                  ) : null}
                </div>

                <form action={removeItemFromSetup}>
                  <input type="hidden" name="setup_id" value={id} />
                  <input type="hidden" name="setup_polozka_id" value={p.setup_polozka_id ?? ""} />
                  <button
                    type="submit"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #6b2d2d",
                      background: "#2a1111",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Odebrat ze setupu
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          Sklad
        </div>

        {sklad.length === 0 ? (
          <div>Ve skladu nejsou žádné aktivní položky.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sklad.map((item) => {
              const alreadyInSetup = usedIds.has(item.skladova_polozka_id);

              return (
                <div
                  key={item.skladova_polozka_id}
                  style={{
                    padding: 12,
                    border: "1px solid #333",
                    borderRadius: 8,
                    background: "#111",
                    color: "#fff",
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{item.nazev}</div>

                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4, marginBottom: 10 }}>
                    kategorie: {item.kategorie_nazev ?? "—"} | sklad: {String(item.celkem_k_dispozici)} {item.jednotka}
                  </div>

                  <form action={addItemToSetup} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="hidden" name="setup_id" value={id} />
                    <input type="hidden" name="skladova_polozka_id" value={item.skladova_polozka_id} />

                    <input
                      name="mnozstvi"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue="1"
                      style={{
                        width: 90,
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #444",
                        background: "#000",
                        color: "#fff",
                      }}
                    />

                    <input
                      name="poradi"
                      type="number"
                      step="1"
                      defaultValue="0"
                      style={{
                        width: 90,
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #444",
                        background: "#000",
                        color: "#fff",
                      }}
                    />

                    <input
                      name="poznamka"
                      type="text"
                      placeholder="poznámka"
                      style={{
                        minWidth: 180,
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #444",
                        background: "#000",
                        color: "#fff",
                      }}
                    />

                    <button
                      type="submit"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #666",
                        background: alreadyInSetup ? "#3a2f00" : "#1a1a1a",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {alreadyInSetup ? "Přepsat v setupu" : "Přidat do setupu"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}