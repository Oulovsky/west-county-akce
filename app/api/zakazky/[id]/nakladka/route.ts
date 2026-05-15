import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  datum_od: string | null;
  datum_do: string | null;
  cas_od: string | null;
  cas_do: string | null;
  poznamka: string | null;
};

type TechnikaNaZakazceRow = {
  skladova_polozka_id: string;
  mnozstvi: number;
};

type SkladovaPolozkaRow = {
  skladova_polozka_id: string;
  nazev: string;
};

export async function GET(_: Request, { params }: RouteContext) {
  const session = await requireSession();

  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const { supabase } = session;

  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("*")
    .eq("zakazka_id", id)
    .single();

  const zakazka = zakazkaRaw as ZakazkaRow | null;

  if (zakazkaError || !zakazka) {
    return new NextResponse("Zakázka nenalezena", { status: 404 });
  }

  const { data: technikaRaw, error: technikaError } = await supabase
    .from("technika_na_zakazce")
    .select("skladova_polozka_id, mnozstvi")
    .eq("zakazka_id", id);

  const technikaRows = (technikaRaw || []) as TechnikaNaZakazceRow[];

  if (technikaError) {
    return new NextResponse("Chyba při načítání techniky", { status: 500 });
  }

  const ids = [
    ...new Set(
      technikaRows.map((t: TechnikaNaZakazceRow) => t.skladova_polozka_id)
    ),
  ];

  let mapaNazvu = new Map<string, string>();

  if (ids.length > 0) {
    const { data: nazvyRaw, error: nazvyError } = await supabase
      .from("skladove_polozky")
      .select("skladova_polozka_id, nazev")
      .in("skladova_polozka_id", ids);

    const nazvy = (nazvyRaw || []) as SkladovaPolozkaRow[];

    if (nazvyError) {
      return new NextResponse("Chyba při načítání názvů techniky", {
        status: 500,
      });
    }

    mapaNazvu = new Map(
      nazvy.map((n: SkladovaPolozkaRow) => [n.skladova_polozka_id, n.nazev])
    );
  }

  const serazenaTechnika = [...technikaRows].sort(
    (a: TechnikaNaZakazceRow, b: TechnikaNaZakazceRow) => {
      const nazevA = mapaNazvu.get(a.skladova_polozka_id) || "";
      const nazevB = mapaNazvu.get(b.skladova_polozka_id) || "";

      return nazevA.localeCompare(nazevB, "cs");
    }
  );

  let text = `${zakazka.cislo_zakazky || "-"} – ${zakazka.nazev || "-"}\n`;
  text += `${zakazka.misto || "-"}\n`;
  text += `${zakazka.datum_od || "-"} → ${zakazka.datum_do || "-"}\n`;

  if (zakazka.cas_od || zakazka.cas_do) {
    text += `${zakazka.cas_od || "-"} → ${zakazka.cas_do || "-"}\n`;
  }

  if (zakazka.poznamka) {
    text += `\nPoznámka: ${zakazka.poznamka}\n`;
  }

  text += `\n--- TECHNIKA ---\n`;

  if (serazenaTechnika.length === 0) {
    text += `Bez techniky\n`;
  } else {
    serazenaTechnika.forEach((t: TechnikaNaZakazceRow) => {
      const nazev = mapaNazvu.get(t.skladova_polozka_id) || t.skladova_polozka_id;
      text += `${nazev} – ${t.mnozstvi} ks\n`;
    });
  }

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}