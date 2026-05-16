import Link from "next/link";
import { addPlaceTechnicalNoteAction } from "@/app/actions/place-technical-notes";
import { Card } from "@/components/ui/card";

export type PlaceTechnicalNoteRow = {
  id: string;
  misto_id: string;
  zakazka_id: string | null;
  autor_id: string | null;
  typ: string;
  text: string;
  dulezite: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlaceTechnicalNoteAuthorRow = {
  user_id: string;
  email: string | null;
  jmeno: string | null;
  prijmeni: string | null;
};

export type PlaceTechnicalNoteZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
};

export type MistoKonaniRow = {
  misto_id: string;
  nazev: string | null;
  adresa_text: string | null;
};

function formatPlaceTechnicalNoteType(value: string | null) {
  if (value === "elektro") return "Elektro";
  if (value === "prijezd") return "Příjezd";
  if (value === "parkovani") return "Parkování";
  if (value === "stage") return "Stage";
  if (value === "hluk") return "Hluk";
  if (value === "omezeni") return "Omezení";
  if (value === "tip") return "Tip";
  if (value === "problem") return "Problém";
  if (value === "jina") return "Jiná";
  return "Jiná";
}

function formatPlaceTechnicalNoteAuthor(author: PlaceTechnicalNoteAuthorRow | undefined) {
  if (!author) return "Neznámý autor";
  return [author.jmeno, author.prijmeni].filter(Boolean).join(" ").trim() || author.email || "Neznámý autor";
}

function formatPlaceTechnicalNoteZakazka(
  note: PlaceTechnicalNoteRow,
  currentZakazkaId: string | null,
  zakazkaById: Map<string, PlaceTechnicalNoteZakazkaRow>
) {
  if (!note.zakazka_id) return "Bez vazby na zakázku";
  if (note.zakazka_id === currentZakazkaId) return "Tato zakázka";

  const zakazka = zakazkaById.get(note.zakazka_id);
  return zakazka?.nazev || zakazka?.cislo_zakazky || `Zakázka ${note.zakazka_id.slice(0, 8)}`;
}

export function PlaceTechnicalNotesCard({
  currentZakazkaId,
  misto,
  notes,
  authorsById,
  zakazkyById,
  showPlaceDetailLink = false,
}: {
  currentZakazkaId?: string | null;
  misto: MistoKonaniRow | null;
  notes: PlaceTechnicalNoteRow[];
  authorsById: Map<string, PlaceTechnicalNoteAuthorRow>;
  zakazkyById: Map<string, PlaceTechnicalNoteZakazkaRow>;
  showPlaceDetailLink?: boolean;
}) {
  if (!misto) return null;

  return (
    <Card className="mt-6 space-y-5 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xl font-bold text-white">Interní technické poznámky místa</div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Dlouhodobé know-how firmy k místu konání. Je oddělené od klientského dotazníku a nikdy se
            nezobrazuje ve veřejném odkazu.
          </p>
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            <div className="font-semibold text-white">{misto.nazev ?? "Místo konání"}</div>
            {misto.adresa_text ? <div className="mt-1 text-slate-400">{misto.adresa_text}</div> : null}
            {showPlaceDetailLink ? (
              <Link
                href={`/mista/${misto.misto_id}`}
                className="mt-3 inline-flex rounded-lg border border-blue-500/40 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:bg-blue-950/40"
              >
                Otevřít detail místa
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-blue-200">Historie poznámek</div>
          <div className="mt-1 text-lg font-black text-white">{notes.length}</div>
        </div>
      </div>

      <form action={addPlaceTechnicalNoteAction} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        {currentZakazkaId ? <input type="hidden" name="zakazka_id" value={currentZakazkaId} /> : null}
        <input type="hidden" name="misto_id" value={misto.misto_id} />

        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <label className="block text-sm font-semibold text-slate-200">
            Typ poznámky
            <select
              name="typ"
              defaultValue="elektro"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="elektro">Elektro</option>
              <option value="prijezd">Příjezd</option>
              <option value="parkovani">Parkování</option>
              <option value="stage">Stage</option>
              <option value="hluk">Hluk</option>
              <option value="omezeni">Omezení</option>
              <option value="tip">Tip</option>
              <option value="problem">Problém</option>
              <option value="jina">Jiná</option>
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-200">
            Nová interní poznámka
            <textarea
              name="text"
              required
              className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              placeholder="Např. rozvaděč je za pódiem vlevo, příjezd pouze zadní branou, kabel chránit přejezdem..."
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-100">
            <input type="checkbox" name="dulezite" />
            <span>Označit jako důležité</span>
          </label>

          <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500">
            Přidat poznámku
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
          K tomuto místu zatím nejsou uložené žádné interní technické poznámky.
        </div>
      ) : (
        <div className="grid gap-3">
          {notes.map((note) => {
            const author = note.autor_id ? authorsById.get(note.autor_id) : undefined;
            const zakazkaLabel = formatPlaceTechnicalNoteZakazka(note, currentZakazkaId ?? null, zakazkyById);
            const linkedZakazkaId =
              note.zakazka_id && note.zakazka_id !== currentZakazkaId ? note.zakazka_id : null;

            return (
              <article
                key={note.id}
                className={[
                  "rounded-2xl border p-4",
                  note.dulezite
                    ? "border-amber-500/50 bg-amber-950/20"
                    : "border-slate-800 bg-slate-950/60",
                ].join(" ")}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-lg border border-blue-500/30 bg-blue-950/30 px-3 py-1 text-xs font-black text-blue-100">
                      {formatPlaceTechnicalNoteType(note.typ)}
                    </span>
                    {note.dulezite ? (
                      <span className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1 text-xs font-black text-amber-100">
                        Důležité
                      </span>
                    ) : null}
                    {linkedZakazkaId ? (
                      <Link
                        href={`/zakazky/${linkedZakazkaId}`}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
                      >
                        {zakazkaLabel}
                      </Link>
                    ) : (
                      <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                        {zakazkaLabel}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500">
                    {note.created_at ? new Date(note.created_at).toLocaleString("cs-CZ") : "Bez data"}
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{note.text}</p>
                <div className="mt-3 text-xs text-slate-500">
                  Autor: {formatPlaceTechnicalNoteAuthor(author)}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Card>
  );
}
